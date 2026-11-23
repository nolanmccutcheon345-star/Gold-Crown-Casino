import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V19} from '../../src/bots/human';
import {fightPlay,fightiness} from '../../src/bots/fights';
import {riverPlay,bettorAggression} from '../../src/bots/river';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V211,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'fr',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number,salt=0)=>(Math.imul(i+1,2654435761)^Math.imul(salt+7,40503))>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),sasha=regularProfile('sasha','high'),earl=regularProfile('big-earl','low');
const table=(id:string)=>startHand({handId:id,button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
/** CO (5) opens, big blind (2) calls: heads-up flop, big blind first. */
const hu=(id:string)=>{let s=table(id);s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'fold'});s=act(s,{type:'fold'});return act(s,{type:'call'});};
const see=(s:GameState,cards:string[],board:string[],p:BotProfile=hiro):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];o.board=board as Card[];return o;};
const FLOP=['Kh','7h','2c'],RIVER=['Kd','8c','4h','2s','Jc'];
const read=(agg:number)=>{const r=emptyPlayerRead(),n=(x:number)=>({count:Math.round(x*60),chances:60});r.hands=60;r.vpip=n(.3);r.pfr=n(.2);r.limp=n(.03);r.reads.hands=60;r.reads.aggression=n(agg);r.reads.wtsd=n(.3);return r;};

describe('postflop fights',()=>{
 it('aggressive skilled players fight; passive recreational players barely do',()=>{
  expect(fightiness(sasha)).toBeGreaterThan(fightiness(hiro)*.8);expect(fightiness(earl)).toBeLessThan(.1);
 });
 it('check-raises sets and draws out of position with legal 3× raises',()=>{
  let s=hu('c1');s=act(s,{type:'check'});s=act(s,{type:'raise',to:550});
  const set=[...Array(300).keys()].map(i=>fightPlay(see(s,['7d','7c'],FLOP),hiro,{type:'call'},seedStream(mix(i)))).filter(r=>r.play==='check-raise-value');
  expect(set.length/300).toBeGreaterThan(.15);for(const r of set){expect(r.action).toEqual({type:'raise',to:1650});expect(()=>act(s,r.action)).not.toThrow();}
  expect(rate(300,i=>fightPlay(see(s,['Ah','5h'],FLOP,sasha),sasha,{type:'call'},seedStream(mix(i))).play==='check-raise-draw')).toBeGreaterThan(.2);
  expect(rate(300,i=>fightPlay(see(s,['Ah','5h'],FLOP,earl),earl,{type:'call'},seedStream(mix(i))).play!==null)).toBeLessThan(.05);
  expect(fightPlay(see(s,['7d','7c'],FLOP),hiro,{type:'fold'},seedStream(1)).play).toBeNull();
 });
 it('floats a flop bet in position and takes it away when checked to on the turn',()=>{
  // CO opens, button calls, blinds fold; CO bets the flop.
  let s=table('f1');s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'call'});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:600});
  expect(s.actor).toBe(0);
  const fl=rate(400,i=>fightPlay(see(s,['Ad','Qc'],['9s','6d','2c']),hiro,{type:'fold'},seedStream(mix(i))).play==='float');expect(fl).toBeGreaterThan(.15);
  const t=act(act(s,{type:'call'}),{type:'check'});expect(t.actor).toBe(0);
  const ta=[...Array(300).keys()].map(i=>fightPlay(see(t,['Ad','Qc'],['9s','6d','2c','3h']),hiro,{type:'check'},seedStream(mix(i)))).filter(r=>r.play==='take-away');
  expect(ta.length/300).toBeGreaterThan(.2);for(const r of ta)expect(()=>act(t,r.action)).not.toThrow();
 });
});

describe('river decisions',()=>{
 it('reads how aggressive a bettor is, shrunk to typical without data',()=>{
  expect(bettorAggression(undefined)).toBeCloseTo(.35,6);expect(bettorAggression(read(.65))).toBeGreaterThan(.55);expect(bettorAggression(read(.1))).toBeLessThan(.2);
 });
 it('thin value when checked to; hero calls aggressive bettors; folds bluff-catchers and good hands to passive players',()=>{
  let c=hu('r1');for(let k=0;k<5;k++)c=act(c,{type:'check'});expect(c.actor).toBe(5);
  const thin=[...Array(300).keys()].map(i=>riverPlay(see(c,['Kc','5d'],RIVER),hiro,{type:'check'},null,seedStream(mix(i)))).filter(r=>r.play==='thin-value');
  expect(thin.length/300).toBeGreaterThan(.25);for(const r of thin){expect((r.action as {to:number}).to).toBeLessThan(c.pot*.5);expect(()=>act(c,r.action)).not.toThrow();}
  let b=hu('r2');for(let k=0;k<5;k++)b=act(b,{type:'check'});b=act(b,{type:'raise',to:1200});expect(b.actor).toBe(2);
  const catcher=see(b,['8d','5s'],RIVER);
  const vsAggro=rate(400,i=>riverPlay(catcher,hiro,{type:'fold'},{5:read(.65)},seedStream(mix(i))).play==='hero-call'),vsPassive=rate(400,i=>riverPlay(catcher,hiro,{type:'fold'},{5:read(.1)},seedStream(mix(i))).play==='hero-call');
  expect(vsAggro).toBeGreaterThan(.2);expect(vsPassive).toBeLessThan(vsAggro/2);
  expect(rate(400,i=>riverPlay(catcher,hiro,{type:'call'},{5:read(.1)},seedStream(mix(i))).play==='big-fold')).toBeGreaterThan(.2);
  expect(rate(300,i=>riverPlay(see(b,['8d','5s'],RIVER,earl),earl,{type:'call'},{5:read(.1)},seedStream(mix(i))).play!==null)).toBe(0);
  // Facing a river raise with two pair.
  let r=hu('r3');for(let k=0;k<4;k++)r=act(r,{type:'check'});r=act(r,{type:'raise',to:700});r=act(r,{type:'raise',to:2100});expect(r.actor).toBe(2);
  expect(rate(400,i=>riverPlay(see(r,['Kc','8d'],RIVER),hiro,{type:'call'},{5:read(.1)},seedStream(mix(i))).play==='big-fold')).toBeGreaterThan(.25);
  expect(riverPlay(see(r,['Kc','8d'],['Kd','8c','4h']),hiro,{type:'call'},{5:read(.1)},seedStream(1)).play).toBeNull();
 });
});

describe('versions',()=>{
 it('new cash tables (1.9.0 and later) play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(9);void HUMAN_LAYER_V19;
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
 },240000);
 it('tournament 2.12.0 or later is the new-event policy, 2.11.0 stays supported, new events pass the audit',async()=>{
  expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(12);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V211)).toBe(true);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
