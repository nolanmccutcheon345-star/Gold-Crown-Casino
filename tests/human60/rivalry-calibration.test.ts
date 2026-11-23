import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,completeProfile,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V110} from '../../src/bots/human';
import {bigPot,grudgesFrom,grudge,rivalryProfile,rivalryPlay,GRUDGE_LINES,type RivalryHand} from '../../src/bots/rivalry';
import {calibrationPlay,stationLike} from '../../src/bots/calibration';
import {handChatter} from '../../src/bots/talk';
import {cashGrudges,cashIdentity} from '../../src/session/human-context';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V215,supportedTournamentPolicy,policyUsesGrudges} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'rv',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number,salt=0)=>(Math.imul(i+1,2654435761)^Math.imul(salt+7,40503))>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),vince=regularProfile('vince','mid');
const table=(id:string)=>startHand({handId:id,button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
const see=(s:GameState,cards:string[],board:string[],p:BotProfile):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];o.board=board as Card[];return o;};
const pot=(loser:string,winner:string,lossBB:number):RivalryHand=>({identities:{1:loser,2:winner,3:'other'},committed:{1:lossBB*200,2:lossBB*200,3:200},won:{2:lossBB*400+200},bigBlind:200});
const small:RivalryHand={identities:{1:'a',2:'b'},committed:{1:2000,2:2000},won:{2:4000},bigBlind:200};

describe('grudges',()=>{
 it('big pots create grudges against the winner; small pots do not; grudges fade',()=>{
  expect(bigPot(pot('vince','hero',100))).toEqual({loser:'vince',winner:'hero',lossBB:100});expect(bigPot(small)).toBeNull();
  const fresh=grudgesFrom([pot('vince','hero',100)]),old=grudgesFrom([pot('vince','hero',100),...Array(600).fill(small)]);
  expect(grudge(fresh,'vince','hero')).toBeCloseTo(1,6);expect(grudge(old,'vince','hero')).toBeCloseTo(.25,2);expect(grudge(fresh,'hero','vince')).toBe(0);
  expect(grudge(grudgesFrom([pot('vince','hero',100),pot('vince','hero',100)]),'vince','hero')).toBeCloseTo(1.5,6);
 });
 it('against the grudge target players loosen up and get stubborn; strong players much less',()=>{
  let s=table('g1');s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:550});
  // Seat 2 (big blind) faces seat 5's bet; seat 2 holds a grudge against seat 5's identity.
  const id=(seat:number)=>seat===5?'hero':seat===2?'me':undefined,g={me:{hero:1}};
  const uncapped=see(s,['8d','5s'],['Kh','7h','2c'],vince);expect(rivalryProfile(uncapped,vince,g,id).effect).toBeNull();
  // Profile changes are allowed only when every legal wager stays below half a stack.
  const o={...uncapped,legal:{...uncapped.legal,maxRaiseTo:3000}},base=completeProfile(vince),after=completeProfile(rivalryProfile(o,vince,g,id).profile);
  expect(after.traits.riverCuriosity).toBeGreaterThan(base.traits.riverCuriosity);expect(after.looseness).toBeGreaterThan(base.looseness);
  const hb=completeProfile(hiro),ha=completeProfile(rivalryProfile(o,hiro,g,id).profile);
  expect(ha.traits.riverCuriosity-hb.traits.riverCuriosity).toBeLessThan(after.traits.riverCuriosity-base.traits.riverCuriosity);
  expect(rivalryProfile(o,vince,{},id).effect).toBeNull();expect(rivalryProfile(o,vince,{me:{other:1}},id).effect).toBeNull();
  // Grudge plays: stay in with a pair instead of folding; legal; never without a grudge; never for a whole stack.
  const op=see(s,['7s','5d'],['Kh','7h','2c'],vince);
  const calls=[...Array(300).keys()].map(i=>rivalryPlay(op,vince,{type:'fold'},g,id,seedStream(mix(i)))).filter(r=>r.play==='grudge-call');
  expect(calls.length/300).toBeGreaterThan(.2);for(const r of calls)expect(()=>act(s,r.action)).not.toThrow();
  expect(rate(200,i=>rivalryPlay(op,vince,{type:'fold'},{},id,seedStream(mix(i))).play!==null)).toBe(0);
  expect(rate(300,i=>rivalryPlay(see(s,['7s','5d'],['Kh','7h','2c'],hiro),hiro,{type:'fold'},g,id,seedStream(mix(i))).play!==null)).toBeLessThan(calls.length/300);
  let shove=act(act(table('g2'),{type:'raise',to:20000}),{type:'fold'});while(shove.actor!==null&&shove.street==='preflop'&&shove.actor!==2)shove=act(shove,{type:'fold'});
  if(shove.actor===2){const so=observeBot(shove,2,vince.policyVersion,'v');so.ownCards=['Kc','Qd'] as Card[];expect(rate(100,i=>rivalryPlay(so,vince,{type:'fold'},{me:{hero:1}},seat=>seat===3?'hero':seat===2?'me':undefined,seedStream(mix(i))).play!==null)).toBe(0);}
 });
 it('grudge lines after a big pot against Hero',()=>{
  // Heads-up all-ins for 100 BB that Hero (seat 0) wins: grudge lines appear only with a grudge.
  let withGrudge=0,without=0,deals=0;
  for(let i=0;i<200&&deals<30;i++){let s=startHand({handId:`t${i}`,button:0,profile:rules,seats:[{id:0,name:'You',stack:20000},{id:1,name:'Vince',stack:20000}]});
   s=act(s,{type:'raise',to:20000});s=act(s,{type:'call'});if(s.street!=='complete'||!((s.payouts[0]??0)>20000))continue;deals++;
   const persona={1:{name:'Vince',profile:vince,regular:'vince'}};
   withGrudge+=handChatter(s,persona,{grudgeAt:()=>1}).lines.filter(l=>GRUDGE_LINES.lost.includes(l.text)).length;
   without+=handChatter(s,persona,{grudgeAt:()=>0}).lines.filter(l=>GRUDGE_LINES.lost.includes(l.text)).length;}
  expect(deals).toBeGreaterThan(10);expect(withGrudge/deals).toBeGreaterThan(.4);expect(without).toBe(0);
 });
});

describe('calibration',()=>{
 /** CO opens, big blind calls; checked through to the turn, big blind checks again. */
 const turnCheckedTo=(id:string)=>{let s=table(id);s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'check'});return act(s,{type:'check'});};
 it('strong and top-pair hands bet when checked to on the turn; last-to-act stabs; legal sizes',()=>{
  const s=turnCheckedTo('c1');expect(s.actor).toBe(5);const board=['Kh','7d','2c','4s'];
  const strong=[...Array(300).keys()].map(i=>calibrationPlay(see(s,['7c','7s'],board,hiro),hiro,{type:'check'},seedStream(mix(i)))).filter(r=>r.play==='value-floor');
  expect(strong.length/300).toBeGreaterThan(.4);for(const r of strong)expect(()=>act(s,r.action)).not.toThrow();
  expect(rate(300,i=>calibrationPlay(see(s,['Kc','Qd'],board,hiro),hiro,{type:'check'},seedStream(mix(i))).play==='value-floor')).toBeGreaterThan(.2);
  expect(rate(300,i=>calibrationPlay(see(s,['Qc','Jd'],board,vince),vince,{type:'check'},seedStream(mix(i))).play==='last-stab')).toBeGreaterThan(.1);
  expect(calibrationPlay(see(s,['7c','7s'],board,hiro),hiro,{type:'raise',to:900},seedStream(1)).play).toBeNull();
 });
 it('calling stations call with any pair or draw; others fold nothing-hands to turn bets',()=>{
  const station=createProfile({selection:'station'},5,'neutral');expect(stationLike(station)).toBe(true);expect(stationLike(hiro)).toBe(false);
  let s=table('c2');s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});s=act(s,{type:'fold'});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:600});
  expect(rate(300,i=>calibrationPlay(see(s,['7s','4d'],['Kh','7h','2c'],station),station,{type:'fold'},seedStream(mix(i))).play==='station-call')).toBeGreaterThan(.5);
  let t=act(s,{type:'call'});t=act(t,{type:'check'});t=act(t,{type:'raise',to:1200});
  expect(rate(300,i=>calibrationPlay(see(t,['Qc','Jd'],['Kh','7h','2c','4s'],hiro),hiro,{type:'call'},seedStream(mix(i))).play==='weak-fold')).toBeGreaterThan(.35);
  expect(rate(300,i=>calibrationPlay(see(t,['Qc','Jd'],['Kh','7h','2c','4s'],station),station,{type:'call'},seedStream(mix(i))).play==='weak-fold')).toBe(0);
 });
});

describe('versions',()=>{
 it('new cash tables (1.10.0 and later) keep grudges by identity, and play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(10);void HUMAN_LAYER_V110;
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  const g=cashGrudges(c.data!.hands),id=cashIdentity(c.data!.active!);expect(id(0)).toBe('hero');expect(id(1)).toBe(c.data!.active!.profiles[1].personalityId);
  for(const holder of Object.keys(g))for(const v of Object.values(g[holder]))expect(v).toBeGreaterThan(0);
  expect(cashGrudges(c.data!.hands)).toEqual(g);
 },240000);
 it('tournament 2.13.0 is the new-event policy, 2.12.0 stays supported, new events pass the audit',async()=>{
  expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V212)).toBe(true);expect(policyUsesGrudges(TOURNAMENT_POLICY_V212)).toBe(false);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
