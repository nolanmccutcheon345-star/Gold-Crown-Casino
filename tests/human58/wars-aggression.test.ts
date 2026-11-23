import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V18} from '../../src/bots/human';
import {deepRank,bluffCandidate,warriorness,threeBetPlay} from '../../src/bots/three-bet';
import {spotOf,aggressionFactor,aggressionPlay} from '../../src/bots/aggression';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V210,TOURNAMENT_POLICY_V211,supportedTournamentPolicy,chooseTournamentDecision} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'w',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),sasha=regularProfile('sasha','high'),earl=regularProfile('big-earl','low'),dot=regularProfile('dot','low');
const table=(id:string,stack=20000)=>startHand({handId:id,button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack}))});
const see=(s:GameState,cards:string[],p:BotProfile=hiro,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
/** 6-handed, button 0: seats 3,4 fold, CO (5) opens to 2.5 BB; button to act. */
const coOpen=(id='o',stack=20000)=>{let s=table(id,stack);s=act(s,{type:'fold'});s=act(s,{type:'fold'});return act(s,{type:'raise',to:500});};

describe('preflop raising wars',()=>{
 it('ranks hands deep-stack and picks suited blocker and connector bluffs',()=>{
  expect(deepRank(['As','Ad'])).toBeLessThan(.01);expect(deepRank(['7c','2d'])).toBeGreaterThan(.9);
  expect(bluffCandidate(['As','5s'])).toBe(true);expect(bluffCandidate(['8h','7h'])).toBe(true);expect(bluffCandidate(['Kd','Jd'])).toBe(true);
  expect(bluffCandidate(['As','5d'])).toBe(false);expect(bluffCandidate(['9c','9d'])).toBe(false);expect(bluffCandidate(['Jh','5h'])).toBe(false);
  expect(warriorness(sasha)).toBeGreaterThan(warriorness(earl));expect(warriorness(earl)).toBe(0);
 });
 it('regulars 3-bet light in position with legal sizes; recreational players flat everything but the top',()=>{
  const s=coOpen('l1'),o=see(s,['As','4s']);
  const light=[...Array(300).keys()].map(i=>threeBetPlay(o,sasha,{type:'fold'},seedStream(i))).filter(r=>r.play==='light-3bet');
  expect(light.length/300).toBeGreaterThan(.3);for(const r of light){expect(r.action).toEqual({type:'raise',to:1500});expect(()=>act(s,r.action)).not.toThrow();}
  expect(rate(200,i=>threeBetPlay(see(s,['As','4s'],earl),earl,{type:'fold'},seedStream(i)).play!==null)).toBe(0);
  const flat=rate(300,i=>threeBetPlay(see(s,['Th','Td'],earl),earl,{type:'raise',to:1500},seedStream(i)).play==='flat-not-3bet');expect(flat).toBeGreaterThan(.5);
  expect(rate(200,i=>threeBetPlay(see(s,['Ah','Ad'],earl),earl,{type:'raise',to:1500},seedStream(i)).play!==null)).toBe(0);
  const vince=regularProfile('vince','mid');expect(rate(200,i=>threeBetPlay(see(s,['Th','Td'],vince),vince,{type:'raise',to:1500},seedStream(i)).play!==null)).toBe(0);
  // Squeeze: open plus a call, the big blind squeezes bigger.
  let q=coOpen('q1');q=act(q,{type:'call'});q=act(q,{type:'fold'});const sq=[...Array(300).keys()].map(i=>threeBetPlay(see(q,['7h','6h'],sasha),sasha,{type:'fold'},seedStream(i))).find(r=>r.play==='squeeze')!;
  expect(sq).toBeDefined();expect((sq.action as {to:number}).to).toBe(2500);expect(()=>act(q,sq.action)).not.toThrow();
  // Shallow stacks are push/fold territory: nothing here.
  expect(rate(200,i=>threeBetPlay(see(coOpen('s1',4000),['As','4s']),sasha,{type:'fold'},seedStream(i)).play!==null)).toBe(0);
 });
 it('defends opens against 3-bets and 4-bet bluffs with an ace blocker, legally',()=>{
  let s=coOpen('d1');s=act(s,{type:'raise',to:1600});s=act(s,{type:'fold'});s=act(s,{type:'fold'});
  expect(s.actor).toBe(5);
  expect(rate(300,i=>threeBetPlay(see(s,['9c','9d']),hiro,{type:'fold'},seedStream(i)).play==='defend-3bet')).toBeGreaterThan(.4);
  const four=[...Array(400).keys()].map(i=>threeBetPlay(see(s,['As','3s'],sasha),sasha,{type:'fold'},seedStream(i))).filter(r=>r.play==='4bet-bluff');
  expect(four.length).toBeGreaterThan(20);for(const r of four){expect((r.action as {to:number}).to).toBe(4160);expect(()=>act(s,r.action)).not.toThrow();}
  expect(rate(200,i=>threeBetPlay(see(s,['7c','2d']),hiro,{type:'fold'},seedStream(i)).play!==null)).toBe(0);
 });
});

describe('heads-up aggression',()=>{
 /** CO opens, the big blind calls: heads-up flop with the big blind first. */
 const hu=(id:string)=>{let s=coOpen(id);s=act(s,{type:'fold'});s=act(s,{type:'fold'});return act(s,{type:'call'});};
 it('names the spot',()=>{
  const f=hu('s1'),cbet=act(f,{type:'check'});expect(spotOf(see(cbet,['Ah','Kc']))).toBe('cbet');expect(spotOf(see(f,['Ah','Kc']))).toBeNull();
  let t=act(cbet,{type:'raise',to:700});t=act(t,{type:'call'});expect(spotOf(see(act(t,{type:'check'}),['Ah','Kc']))).toBe('barrel');
  const d=act(cbet,{type:'check'});expect(spotOf(see(d,['Ah','Kc']))).toBe('probe');expect(spotOf(see(act(d,{type:'check'}),['Ah','Kc']))).toBe('delayed-cbet');
  const r=act(act(d,{type:'check'}),{type:'check'});expect(spotOf(see(r,['Ah','Kc']))).toBe('stab');
  let rb=act(act(t,{type:'check'}),{type:'raise',to:1800});rb=act(rb,{type:'call'});expect(spotOf(see(act(rb,{type:'check'}),['Ah','Kc']))).toBe('river-barrel');
  // Multiway is not a heads-up spot.
  let m=coOpen('m1');m=act(m,{type:'call'});m=act(m,{type:'fold'});m=act(m,{type:'call'});m=act(m,{type:'check'});m=act(m,{type:'check'});expect(spotOf(see(m,['Ah','Kc']))).toBeNull();
 });
 it('regulars bet far more of these spots than passive players; sizes are legal; only checks change',()=>{
  const s=act(hu('a1'),{type:'check'}),dry=['Kd','7c','2s'];
  const reg=rate(400,i=>aggressionPlay(see(s,['5h','4h'],hiro,dry),hiro,{type:'check'},seedStream(i)).play==='cbet'),fish=rate(400,i=>aggressionPlay(see(s,['5h','4h'],earl,dry),earl,{type:'check'},seedStream(i)).play==='cbet');
  expect(reg).toBeGreaterThan(.35);expect(fish).toBeLessThan(.15);expect(aggressionFactor(sasha)).toBeGreaterThan(aggressionFactor(dot));
  for(let i=0;i<100;i++){const r=aggressionPlay(see(s,['5h','4h'],sasha,dry),sasha,{type:'check'},seedStream(i));expect(()=>act(s,r.action)).not.toThrow();if(r.play)expect((r.action as {to:number}).to).toBeLessThan(s.pot*.5);}
  expect(aggressionPlay(see(s,['5h','4h'],hiro,dry),hiro,{type:'raise',to:900},seedStream(1)).play).toBeNull();
  // Wet flop: skilled players bet air less.
  const wet=rate(400,i=>aggressionPlay(see(s,['5c','4d'],hiro,['Jh','Th','9c']),hiro,{type:'check'},seedStream(i)).play==='cbet');expect(wet).toBeLessThan(reg);
 });
});

describe('versions',()=>{
 it('new cash tables (1.8.0 and later) play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(8);void HUMAN_LAYER_V18;
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
 },240000);
 it('tournament 2.11.0 or later is the new-event policy, 2.10.0 stays supported, new events pass the audit',async()=>{
  expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(11);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V210)).toBe(true);
  const trules={...rules,mode:'tournament' as const,tournament:{bigBlindAnte:200,antePriority:'blind-first' as const,buttonRule:'dead-button' as const}};
  let s=startHand({handId:'t',button:0,profile:trules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});
  const ctx={playersLeft:40,paid:5,stacks:Array(40).fill(20000)},hashes=new Set<string>();
  for(let i=0;i<300;i++){const o=see(s,['As','4s'],sasha);hashes.add(chooseTournamentDecision(o,sasha,seedStream(i),TOURNAMENT_POLICY_V211,ctx,[],null,{},{}).observationHash);}
  expect([...hashes].some(h=>h.includes('light-3bet'))).toBe(true);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
