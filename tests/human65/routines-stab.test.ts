import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V115} from '../../src/bots/human';
import {breakAt,breakChance,LAST_ORBIT_LINES} from '../../src/bots/routines';
import {stabPlay} from '../../src/bots/showdown';
import {cashBreak} from '../../src/session/human-context';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V218} from '../../src/tournament/bot-policy';

/* Patch 47: live-game routines (breaks, announced last orbits) and the showdown retune (cash human-1.15.0, tournament 2.18.0). */
// This long-session behavior fixture starts fresh and only needs a revision receipt.
class Port implements PersistencePort {
  revision:number|null=null;
  async load(){return null;}
  async commit(expected:number|null,next:AppData){
    if(this.revision!==expected)throw Error('Revision changed');
    this.revision=next.revision;
  }
  close(){}
}
const cash:RuleProfile={id:'rt',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const rate=(n:number,f:(i:number)=>boolean|string|null)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const earl=regularProfile('big-earl','low'),hiro=regularProfile('hiro','high'),lag=createProfile({selection:'lag'},3,'neutral'),nit=createProfile({selection:'nit'},3,'neutral'),station=createProfile({selection:'station'},3,'neutral');
const see=(s:GameState,cards:string[],p:BotProfile,board:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];o.board=board as Card[];return o;};
const hand=(id:string)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
function turn(id:string){let s=hand(id);for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'},{type:'check'}] as Action[])s=act(s,a);return s;}

describe('breaks',()=>{
  it('come now and then, last 5 to 18 hands, never in the first 10, and more often for recreational players',()=>{
    for(const p of [earl,hiro]){let on=0,starts=0,backs=0;const lengths:number[]=[];let current=0;
      for(let i=0;i<20000;i++){const b=breakAt('k',p,i);if(i<10)expect(b.onBreak).toBe(false);if(b.onBreak){on++;current++;}if(b.starting)starts++;if(b.returning){backs++;lengths.push(current);current=0;}}
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(5);expect(Math.max(...lengths)).toBeLessThanOrEqual(18);expect(Math.abs(starts-backs)).toBeLessThanOrEqual(1);
      expect(starts/20000).toBeGreaterThan(breakChance(p)*.5);expect(starts/20000).toBeLessThan(breakChance(p)*1.3);}
    expect(breakChance(earl)).toBeGreaterThan(breakChance(hiro)*2);
    expect(breakAt('a',earl,500)).toEqual(breakAt('a',earl,500));
  });
});

describe('the showdown retune',()=>{
  it('players with some aggression stab at turns checked to them; stations do not',()=>{
    const s=act(turn('st'),{type:'check'});expect(s.actor).toBe(5);
    const r=[...Array(400).keys()].map(i=>stabPlay(see(s,['Qc','9d'],lag,['Kh','7d','2c','4s']),lag,{type:'check'},seedStream(mix(i))));
    expect(rate(400,i=>r[i].play==='stab')).toBeGreaterThan(.08);for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
    expect(rate(400,i=>stabPlay(see(s,['Qc','9d'],station,['Kh','7d','2c','4s']),station,{type:'check'},seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>stabPlay(see(s,['Kc','Kd'],lag,['Kh','7d','2c','4s']),lag,{type:'check'},seedStream(mix(i))).play)).toBe(0);
  });
  it('nits give up weak bluff-catchers to river bets more often',()=>{
    let s=act(turn('nf'),{type:'check'});s=act(s,{type:'check'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:900});expect(s.street).toBe('river');expect(s.actor).toBe(2);
    expect(rate(400,i=>stabPlay(see(s,['7c','8d'],nit,['Kh','7d','2c','4s','3h']),nit,{type:'call'},seedStream(mix(i))).play==='nit-river-fold')).toBeGreaterThan(.3);
    expect(rate(400,i=>stabPlay(see(s,['7c','8d'],station,['Kh','7d','2c','4s','3h']),station,{type:'call'},seedStream(mix(i))).play)).toBe(0);
  });
});

describe('a 1.15.0 cash session',()=>{
  it('players take breaks (check or fold only), announce a last orbit, then leave about an orbit later',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(15);
    expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(18);
    let breaks=0,orbits=0,departures=0;const announced=new Map<string,number>();
    for(let h=0;h<220;h++){
      const a=c.data!.active!,news=a.churnNews?.handId===a.game.handId?a.churnNews.lines:[];
      for(const line of news){const m=line.match(/^(.+?): “(.+)”$/);if(m&&LAST_ORBIT_LINES.includes(m[2])){orbits++;announced.set(m[1],h);}
        for(const [name,at] of announced)if(line.startsWith(`${name} `)&&/leaves|calls it a night|racks up/.test(line)){departures++;expect(h-at).toBeGreaterThanOrEqual(4);expect(h-at).toBeLessThanOrEqual(20);announced.delete(name);}}
      const onBreak=new Set(a.game.seats.filter(s=>s.id!==0&&cashBreak(c.data!.hands,a,s.id).onBreak).map(s=>s.id));breaks+=onBreak.size;
      for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
        if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);
        else{const seat=g.actor!;await c.prepareBot();const d=c.data!.active!.pending!.decision!;if(onBreak.has(seat))expect(['check','fold']).toContain(d.action.type);await c.commitBot(g.handId,g.revision);}
        expect(c.error).toBe('');}
      if(h<219){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
    expect(breaks+orbits).toBeGreaterThan(0);
    if(orbits>1)expect(departures).toBeGreaterThan(0);
  },600000);
});
