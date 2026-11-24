import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {regularProfile,REGULARS} from '../../src/bots/regulars';
import {leakPlay,leaksOf,leakStrength,leakRead,LEAKS,REGULAR_LEAKS,type Leak} from '../../src/bots/leaks';
import {quirkPlay,quirkiness} from '../../src/bots/quirks';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V214,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';

/* Patch 44: signature leaks and recreational quirks (cash human-1.12.0, tournament 2.15.0). */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'lq',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number,salt=0)=>(Math.imul(i+1,2654435761)^Math.imul(salt+7,40503))>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),weak=createProfile({selection:'station'},11,'neutral');
const see=(s:GameState,cards:string[],p:BotProfile,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
const hand=(id:string)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
/** Seat 5 (cutoff) opens to 500 and the big blind (seat 2) calls: the flop, big blind to act. */
function flop(id:string){let s=hand(id);for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'}] as Action[])s=act(s,a);return s;}
const turn=(id:string)=>{let s=flop(id);s=act(s,{type:'check'});s=act(s,{type:'check'});return act(s,{type:'check'});};
const leak=(o:BotObservation,p:BotProfile,a:Action,l:Leak,i:number)=>leakPlay(o,p,a,[l],seedStream(mix(i)));
const legal=(s:GameState,results:{action:Action;play:unknown}[])=>{for(const r of results.filter(r=>r.play))expect(()=>act(s,r.action)).not.toThrow();};

describe('signature leaks: who has which',()=>{
  it('named regulars have their hand-picked leaks, shown with their read',()=>{
    expect(Object.keys(REGULAR_LEAKS).sort()).toEqual(REGULARS.map(r=>r.id).sort());
    expect(leaksOf(earl,'big-earl')).toEqual(['pays-off-rivers','draw-chaser']);
    expect(leakRead('hank')).toBe('Leak: folds medium hands to big turn and river bets.');
  });
  it('everyone else gets one or two leaks that suit their type, fixed by personality; weaker players more often two',()=>{
    const two={weak:0,strong:0};
    for(let seed=1;seed<=400;seed++)for(const type of ARCHETYPES){
      const p=createProfile({selection:type},seed,'neutral'),l=leaksOf(p);
      expect(l.length===1||l.length===2).toBe(true);expect(new Set(l).size).toBe(l.length);for(const x of l)expect(LEAKS).toContain(x);
      expect(leaksOf(structuredClone(p))).toEqual(l);
      if(type==='station')two.weak+=+(l.length===2);if(type==='stronger-reg')two.strong+=+(l.length===2);
      if(type==='nit')expect(l.some(x=>['river-bluffer','draw-chaser','pays-off-rivers','auto-cbet'].includes(x))).toBe(false);
    }
    expect(two.weak).toBeGreaterThan(two.strong*2);
    expect(leakStrength(weak)).toBeGreaterThan(leakStrength(hiro));
  });
});

describe('signature leaks: spots',()=>{
  it('overpair love: calls a big turn bet it would fold',()=>{
    const s=act(turn('o1'),{type:'raise',to:2000}),B=['9h','7d','2c','4s'];expect(s.actor).toBe(2);
    const r=[...Array(300).keys()].map(i=>leak(see(s,['Qc','Qd'],weak,B),weak,{type:'fold'},'overpair-love',i));
    expect(rate(300,i=>r[i].play==='overpair-love')).toBeGreaterThan(.5);legal(s,r);
    expect(rate(300,i=>leak(see(s,['Qc','Qd'],hiro,B),hiro,{type:'fold'},'overpair-love',i).play!==null)).toBeLessThan(.45);
    expect(rate(300,i=>leak(see(s,['6c','5d'],weak,['Kh','Td','2c','3s']),weak,{type:'fold'},'overpair-love',i).play!==null)).toBe(0);
  });
  it('pays off rivers with any pair; scared money folds medium hands to big bets',()=>{
    let s=turn('p1');s=act(s,{type:'raise',to:1200});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:2800});
    const B=['Kh','7d','2c','4s','3h'];
    const pay=[...Array(300).keys()].map(i=>leak(see(s,['7c','8d'],weak,B),weak,{type:'fold'},'pays-off-rivers',i));
    expect(rate(300,i=>pay[i].play!==null)).toBeGreaterThan(.5);legal(s,pay);
    expect(rate(300,i=>leak(see(s,['Qc','9d'],weak,B),weak,{type:'fold'},'pays-off-rivers',i).play!==null)).toBe(0);
    expect(rate(300,i=>leak(see(s,['7c','8d'],weak,B),weak,{type:'call'},'scared-money',i).play==='scared-money')).toBeGreaterThan(.5);
    expect(rate(300,i=>leak(see(s,['Kc','Kd'],weak,B),weak,{type:'call'},'scared-money',i).play!==null)).toBe(0);
  });
  it('draw chaser calls with draws; auto c-bet and slow-play on the flop; one-and-done on the turn',()=>{
    const t=act(turn('d1'),{type:'raise',to:2000});
    expect(rate(300,i=>leak(see(t,['Ah','5h'],weak,['Kh','7h','2c','4s']),weak,{type:'fold'},'draw-chaser',i).play!==null)).toBeGreaterThan(.5);
    const f=act(flop('c1'),{type:'check'});expect(f.actor).toBe(5);
    const cb=[...Array(300).keys()].map(i=>leak(see(f,['Qc','Jd'],weak,['Kh','7d','2c']),weak,{type:'check'},'auto-cbet',i));
    expect(rate(300,i=>cb[i].play==='auto-cbet')).toBeGreaterThan(.5);legal(f,cb);
    const sp=[...Array(300).keys()].map(i=>leak(see(f,['7c','7s'],weak,['Kh','7d','2c']),weak,{type:'raise',to:600},'slowplays-monsters',i));
    expect(rate(300,i=>sp[i].action.type==='check')).toBeGreaterThan(.5);
    let g=act(f,{type:'raise',to:600});g=act(g,{type:'call'});g=act(g,{type:'check'});expect(g.actor).toBe(5);
    expect(rate(300,i=>leak(see(g,['Qc','Jd'],weak,['Kh','7d','2c','4s']),weak,{type:'raise',to:1400},'one-and-done',i).action.type==='check')).toBeGreaterThan(.5);
  });
  it('river bluffer bets a missed hand when checked to',()=>{
    let s=act(turn('r1'),{type:'check'});s=act(s,{type:'check'});expect(s.actor).toBe(5);
    const r=[...Array(300).keys()].map(i=>leak(see(s,['Qh','9h'],weak,['Kh','7h','2c','4s','Jd']),weak,{type:'check'},'river-bluffer',i));
    expect(rate(300,i=>r[i].play==='river-bluffer')).toBeGreaterThan(.5);legal(s,r);
  });
});

describe('recreational quirks',()=>{
  it('only weaker, looser players have them',()=>{expect(quirkiness(earl)).toBeGreaterThan(.2);expect(quirkiness(hiro)).toBe(0);});
  it('limp-trap with aces, then limp-reraise when raised; legal',()=>{
    const s=hand('l1');expect(s.actor).toBe(3);
    expect(rate(400,i=>quirkPlay(see(s,['Ac','Ad'],earl),earl,{type:'raise',to:600},seedStream(mix(i))).play==='limp-trap')).toBeGreaterThan(.1);
    expect(rate(400,i=>quirkPlay(see(s,['Ac','Ad'],hiro),hiro,{type:'raise',to:600},seedStream(mix(i))).play!==null)).toBe(0);
    let r=act(s,{type:'call'});r=act(r,{type:'raise',to:800});for(let k=0;k<4;k++)r=act(r,{type:'fold'});expect(r.actor).toBe(3);
    const rr=[...Array(300).keys()].map(i=>quirkPlay(see(r,['Ac','Ad'],earl),earl,{type:'call'},seedStream(mix(i))));
    expect(rate(300,i=>rr[i].play==='limp-reraise')).toBeGreaterThan(.7);legal(r,rr);
    expect(rr.find(x=>x.play)!.action).toEqual({type:'raise',to:2800});
  });
  it('over-limps with playable hands and defends the big blind light against a small raise',()=>{
    const s=act(hand('ol'),{type:'call'});
    const ol=[...Array(300).keys()].map(i=>quirkPlay(see(s,['8c','6c'],earl),earl,{type:'fold'},seedStream(mix(i))));
    expect(rate(300,i=>ol[i].play==='over-limp')).toBeGreaterThan(.2);legal(s,ol);
    let b=hand('bb');for(const a of [{type:'fold'},{type:'fold'},{type:'fold'},{type:'raise',to:400},{type:'fold'}] as Action[])b=act(b,a);expect(b.actor).toBe(2);
    expect(rate(300,i=>quirkPlay(see(b,['9c','3d'],earl),earl,{type:'fold'},seedStream(mix(i))).play==='junk-defend')).toBeGreaterThan(.1);
  });
  it('leads into the raiser with any piece, and blocker-bets the river',()=>{
    const f=flop('pd');expect(f.actor).toBe(2);
    const d=[...Array(400).keys()].map(i=>quirkPlay(see(f,['7c','6s'],earl,['Kh','7d','2c']),earl,{type:'check'},seedStream(mix(i))));
    expect(rate(400,i=>d[i].play==='piece-donk')).toBeGreaterThan(.05);legal(f,d);
    const r=act(turn('bk'),{type:'check'});expect(r.actor).toBe(2);
    const bk=[...Array(400).keys()].map(i=>quirkPlay(see(r,['7c','8d'],earl,['Kh','7d','2c','4s','3h']),earl,{type:'check'},seedStream(mix(i))));
    expect(rate(400,i=>bk[i].play==='blocker-bet')).toBeGreaterThan(.05);legal(r,bk);
  });
});

describe('versions',()=>{
  it('new cash tables use 1.12.0 and play complete legal hands',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  },240000);
  it('tournament 2.15.0 is the new-event policy, 2.14.0 stays supported, new events pass the audit',async()=>{
    expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V214)).toBe(true);
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
    expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
    for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
     if(a.game.street==='complete'){await c.nextHand();continue;}
     if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
    expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
  },240000);
});
