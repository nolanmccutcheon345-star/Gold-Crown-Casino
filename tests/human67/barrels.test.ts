import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead,type PlayerRead} from '../../src/bots/table-reads';
import {barrelCaller,barrelFoldPlay,stationValuePlay} from '../../src/bots/barrels';
import {NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';

/* Patch 49: calling stations give up to repeated big bets; thinking players value-bet them harder (cash human-1.17.0, tournament 2.20.0). */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'br',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const rate=(n:number,f:(i:number)=>boolean|string|null)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const station=createProfile({selection:'station'},3,'neutral'),passive=createProfile({selection:'passive-reg'},3,'neutral'),tag=createProfile({selection:'tag'},3,'neutral'),hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const see=(s:GameState,cards:string[],p:BotProfile,board:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];o.board=board as Card[];return o;};
const hand=(id:string)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
/** Seat 5 opens, the big blind (seat 2) calls; seat 5 bets the flop and the big blind calls. */
function afterFlopCall(id:string){let s=hand(id);for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'},{type:'raise',to:700},{type:'call'}] as Action[])s=act(s,a);return s;}
const stationRead=():PlayerRead=>{const r=emptyPlayerRead();r.hands=60;r.vpip={count:30,chances:60};r.pfr={count:3,chances:60};r.reads.aggression={count:3,chances:30};r.reads.wtsd={count:15,chances:30};return r;};

describe('callers give up to repeated big bets',()=>{
  it('only stations and passive regulars',()=>{expect(barrelCaller(station)).toBeGreaterThan(0);expect(barrelCaller(passive)).toBeGreaterThan(0);expect(barrelCaller(tag)).toBe(0);expect(barrelCaller(hiro)).toBe(0);});
  it('a weak pair folds to a big turn bet after calling the flop; a good pair or a draw does not; legal',()=>{
    let s=afterFlopCall('t1');s=act(s,{type:'check'});s=act(s,{type:'raise',to:1600});expect(s.street).toBe('turn');expect(s.actor).toBe(2);
    const B=['Kh','7d','2c','4s'],weak=[...Array(400).keys()].map(i=>barrelFoldPlay(see(s,['7c','6s'],station,B),station,{type:'call'},seedStream(mix(i))));
    expect(rate(400,i=>weak[i].play==='give-up-to-barrel')).toBeGreaterThan(.3);for(const x of weak.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
    expect(rate(400,i=>barrelFoldPlay(see(s,['Kc','Qd'],station,B),station,{type:'call'},seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>barrelFoldPlay(see(s,['Ah','5h'],station,['Kh','7h','2c','4s']),station,{type:'call'},seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>barrelFoldPlay(see(s,['7c','6s'],tag,B),tag,{type:'call'},seedStream(mix(i))).play)).toBe(0);
  });
  it('not on the first bet, and not to a small bet',()=>{
    let s=hand('f1');for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'},{type:'check'},{type:'check'},{type:'raise',to:1000}] as Action[])s=act(s,a);
    expect(s.street).toBe('turn');expect(rate(200,i=>barrelFoldPlay(see(s,['7c','6s'],station,['Kh','7d','2c','4s']),station,{type:'call'},seedStream(mix(i))).play)).toBe(0);
    let t=afterFlopCall('f2');t=act(t,{type:'check'});t=act(t,{type:'raise',to:400});
    expect(rate(200,i=>barrelFoldPlay(see(t,['7c','6s'],station,['Kh','7d','2c','4s']),station,{type:'call'},seedStream(mix(i))).play)).toBe(0);
  });
  it('the river third barrel gets more folds than the turn',()=>{
    let s=afterFlopCall('r1');s=act(s,{type:'check'});s=act(s,{type:'raise',to:1600});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:3500});expect(s.street).toBe('river');
    const river=rate(400,i=>barrelFoldPlay(see(s,['7c','6s'],station,['Kh','7d','2c','4s','9h']),station,{type:'call'},seedStream(mix(i))).play!==null);
    let t=afterFlopCall('r2');t=act(t,{type:'check'});t=act(t,{type:'raise',to:1600});
    const turn=rate(400,i=>barrelFoldPlay(see(t,['7c','6s'],station,['Kh','7d','2c','4s']),station,{type:'call'},seedStream(mix(i))).play!==null);
    expect(river).toBeGreaterThan(turn);
  });
});

describe('value-betting a known station',()=>{
  it('thinking players bet medium-strong hands when checked to and size up; legal; not without the read',()=>{
    let s=afterFlopCall('v1');s=act(s,{type:'check'});expect(s.actor).toBe(5);const B=['Kh','7d','2c','4s'];
    const v=[...Array(400).keys()].map(i=>stationValuePlay(see(s,['Kc','9d'],hiro,B),hiro,{type:'check'},{2:stationRead()},seedStream(mix(i))));
    expect(rate(400,i=>v[i].play==='value-station')).toBeGreaterThan(.3);for(const x of v.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
    expect(rate(400,i=>stationValuePlay(see(s,['Kc','9d'],hiro,B),hiro,{type:'check'},{},seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>stationValuePlay(see(s,['Kc','9d'],earl,B),earl,{type:'check'},{2:stationRead()},seedStream(mix(i))).play!==null)).toBeLessThan(rate(400,i=>v[i].play!==null));
    const up=[...Array(400).keys()].map(i=>stationValuePlay(see(s,['Kc','Kd'],hiro,B),hiro,{type:'raise',to:1000},{2:stationRead()},seedStream(mix(i))));
    expect(rate(400,i=>up[i].play==='size-up-station')).toBeGreaterThan(.3);expect((up.find(x=>x.play)!.action as {to:number}).to).toBeGreaterThan(1000);
  });
});

describe('versions and full runs',()=>{
  it('new cash tables use 1.17.0 and play complete legal hands',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    for(let h=0;h<40;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<39){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  },400000);
  it('a 2.20.0 event runs to the end and passes the audit',async()=>{
    expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',9,'fast');expect(c.error).toBe('');
    for(let guard=0;guard<20000&&c.data!.active!.status!=='complete';guard++){const a=c.data!.active!,g=c.gameView!;
     if(a.game.street==='complete'){await c.nextHand();expect(c.error).toBe('');continue;}
     if(a.game.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
    expect(c.data!.active!.status).toBe('complete');expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
  },600000);
});
