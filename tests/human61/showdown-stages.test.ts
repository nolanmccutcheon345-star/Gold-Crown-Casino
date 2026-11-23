import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile,completeProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V111} from '../../src/bots/human';
import {showdownPlay,initiative} from '../../src/bots/showdown';
import {stageOf,stageProfile,stagePlay} from '../../src/tournament/stages';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V213,TOURNAMENT_POLICY_V214,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'sd',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const tour=(ante:number):RuleProfile=>({...cash,mode:'tournament',tournament:{bigBlindAnte:ante,antePriority:'blind-first',buttonRule:'dead-button'}});
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number,salt=0)=>(Math.imul(i+1,2654435761)^Math.imul(salt+7,40503))>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),vince=regularProfile('vince','mid'),earl=regularProfile('big-earl','low'),dot=regularProfile('dot','low');
const see=(s:GameState,cards:string[],p:BotProfile,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
/** CO opens, big blind calls, checked to the turn; big blind checks the turn: CO to act. */
function turn(id:string){let s=startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'check'});return act(s,{type:'check'});}
const BOARD=['Kh','7d','2c','4s'];

describe('turn and river initiative',()=>{
 it('bets value, medium and stab hands when checked to; more for aggressive players; legal sizes',()=>{
  const s=turn('i1');expect(s.actor).toBe(5);expect(initiative(vince)).toBeGreaterThan(initiative(earl));
  const value=[...Array(300).keys()].map(i=>showdownPlay(see(s,['7c','7s'],hiro,BOARD),hiro,{type:'check'},seedStream(mix(i)))).filter(r=>r.play==='turn-river-value');
  expect(value.length/300).toBeGreaterThan(.35);for(const r of value)expect(()=>act(s,r.action)).not.toThrow();
  expect(rate(300,i=>showdownPlay(see(s,['Kc','Qd'],hiro,BOARD),hiro,{type:'check'},seedStream(mix(i))).play==='turn-river-protect')).toBeGreaterThan(.2);
  expect(rate(300,i=>showdownPlay(see(s,['9c','8d'],vince,BOARD),vince,{type:'check'},seedStream(mix(i))).play==='turn-river-stab')).toBeGreaterThan(.15);
  expect(showdownPlay(see(s,['7c','7s'],hiro,BOARD),hiro,{type:'raise',to:900},seedStream(1)).play).toBeNull();
 });
 it('folds hands that cannot justify the price; calling stations keep calling',()=>{
  let s=turn('p1');s=act(s,{type:'raise',to:1200});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:2400});
  const station=createProfile({selection:'station'},3,'neutral');
  expect(rate(300,i=>showdownPlay(see(s,['Qc','9d'],hiro,['Kh','7d','2c','4s','3h']),hiro,{type:'call'},seedStream(mix(i))).play==='price-fold')).toBeGreaterThan(.5);
  expect(rate(300,i=>showdownPlay(see(s,['Qc','9d'],station,['Kh','7d','2c','4s','3h']),station,{type:'call'},seedStream(mix(i))).play!==null)).toBe(0);
  expect(rate(300,i=>showdownPlay(see(s,['Kc','Kd'],hiro,['Kh','7d','2c','4s','3h']),hiro,{type:'call'},seedStream(mix(i))).play!==null)).toBe(0);
 });
});

describe('tournament stages',()=>{
 const table=(seats:number,bb:number,ante:number,actor:number,id:string)=>{let s=startHand({handId:id,button:0,profile:tour(ante),seats:Array.from({length:seats},(_,j)=>({id:j,name:`S${j}`,stack:bb*200}))});while(s.actor!==actor)s=act(s,{type:'fold'});return s;};
 const ctx=(bb:number,left=120,paid=15)=>({playersLeft:left,paid,stacks:Array(left).fill(bb*200)});
 it('names the stage from average stacks and the money',()=>{
  const s=table(9,40,200,0,'s1'),o=see(s,['2c','3d'],hiro);
  expect(stageOf(o,ctx(150))).toBe('early');expect(stageOf(o,ctx(40))).toBe('middle');expect(stageOf(o,ctx(20))).toBe('late');expect(stageOf(o,ctx(40,18,15))).toBe('late');
 });
 it('early: recreational players limp in deep; good players unchanged; legal',()=>{
  const s=table(9,150,0,4,'e1');
  const limps=[...Array(300).keys()].map(i=>stagePlay(see(s,['Jd','8d'],earl),earl,{type:'fold'},ctx(150),seedStream(mix(i)))).filter(r=>r.play==='early-limp');
  expect(limps.length/300).toBeGreaterThan(.35);for(const r of limps)expect(()=>act(s,r.action)).not.toThrow();
  expect(rate(300,i=>stagePlay(see(s,['Jd','8d'],hiro),hiro,{type:'fold'},ctx(150),seedStream(mix(i))).play==='early-limp')).toBe(0);
  expect(completeProfile(stageProfile(see(s,['Jd','8d'],dot),dot,ctx(150)).profile).looseness).toBeGreaterThan(completeProfile(dot).looseness);
  expect(stageProfile(see(s,['Jd','8d'],hiro),hiro,ctx(150)).effect).toBeNull();
 });
 it('middle: steals from late position when folded to, and short-handed from anywhere; nothing late',()=>{
  const btn=table(9,40,200,0,'m1');
  const steals=[...Array(300).keys()].map(i=>stagePlay(see(btn,['Kd','9c'],hiro),hiro,{type:'fold'},ctx(40),seedStream(mix(i)))).filter(r=>r.play==='steal');
  expect(steals.length/300).toBeGreaterThan(.4);for(const r of steals){expect(r.action).toEqual({type:'raise',to:440});expect(()=>act(btn,r.action)).not.toThrow();}
  expect(rate(300,i=>stagePlay(see(table(9,40,200,3,'m2'),['Kd','9c'],hiro),hiro,{type:'fold'},ctx(40),seedStream(mix(i))).play!==null)).toBe(0);
  expect(rate(300,i=>stagePlay(see(table(5,40,200,3,'m3'),['Ad','Tc'],hiro),hiro,{type:'fold'},ctx(40),seedStream(mix(i))).play==='steal')).toBeGreaterThan(.3);
  expect(rate(300,i=>stagePlay(see(btn,['Kd','9c'],hiro),hiro,{type:'fold'},ctx(20),seedStream(mix(i))).play!==null)).toBe(0);
  expect(completeProfile(stageProfile(see(table(5,40,200,3,'m4'),['Kd','9c'],hiro),hiro,ctx(40)).profile).looseness).toBeGreaterThan(completeProfile(hiro).looseness);
 });
});

describe('versions',()=>{
 it('new cash tables use 1.11.0 and play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(Number(HUMAN_LAYER_V111.split('.')[1]));
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
 },240000);
 it('tournament 2.14.0 is the new-event policy, 2.13.0 stays supported, new events pass the audit',async()=>{
  expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(Number(TOURNAMENT_POLICY_V214.split('.')[1]));expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V213)).toBe(true);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(Number(c.data!.active!.tournamentPolicyVersion!.split('.')[1])).toBeGreaterThanOrEqual(14);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
