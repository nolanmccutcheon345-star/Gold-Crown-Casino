import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile,completeProfile} from '../../src/bots/profiles';
import {regularProfile,REGULARS} from '../../src/bots/regulars';
import {HUMAN_LAYER_V16,humanSizing} from '../../src/bots/human';
import {opponentsIn,multiwayProfile,multiwayPlay,multiwayDiscipline} from '../../src/bots/multiway';
import {sizingStyle,tellStrength,applySizingTell,REGULAR_SIZING,STYLE_READS,type SizingStyle} from '../../src/bots/sizing-tells';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V28,TOURNAMENT_POLICY_V29,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'mw',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),tess=regularProfile('tess','mid');
/** Seat 3 opens; `callers` players behind call; flop; seat 3 first to act. */
function flop(callers:number,id='f'){let s=startHand({handId:id,button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
 s=act(s,{type:'raise',to:600});let c=0;while(s.street==='preflop'){const caller=c<callers&&s.actor!==1&&s.actor!==2;s=act(s,caller?{type:'call'}:{type:'fold'});if(caller)c++;}return s;}
/** Fixed observation cards isolate the policy from random dealt-card collisions.
 * Engine state remains real for legal-action checks; only the policy view is synthetic. */
function hand(_s:GameState,kind:'air'|'set'|'pair'):Card[] {
 return kind==='set'?['Kh','Kd']:kind==='pair'?['7c','9s']:['4s','9h'];
}
const view=(s:GameState,cards:Card[],p:BotProfile=hiro):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.board=['Kc','7d','2h'];o.ownCards=cards;return o;};
/** A flop with no pair on the board, so the hand kinds are what they claim. */
function cleanFlop(callers:number,tag:string){for(let i=0;i<200;i++){const s=flop(callers,`${tag}${i}`);if(new Set(s.board.map(c=>c[0])).size===3&&new Set(s.board.map(c=>c[1])).size>=2)return s;}throw Error('no flop');}

describe('multiway pots',()=>{
 it('counts opponents and tightens disciplined players far more than recreational ones',()=>{
  const hu=cleanFlop(1,'h'),three=cleanFlop(2,'t'),four=cleanFlop(3,'q');
  expect(opponentsIn(view(hu,hand(hu,'air')))).toBe(1);expect(opponentsIn(view(four,hand(four,'air')))).toBe(3);
  expect(multiwayProfile(view(hu,hand(hu,'air')),hiro).effect).toBeNull();
  const bluff=(p:BotProfile,s:GameState)=>completeProfile(multiwayProfile(view(s,hand(s,'air'),p),p).profile).traits.bluffFrequency/completeProfile(p).traits.bluffFrequency;
  expect(bluff(hiro,four)).toBeLessThan(bluff(hiro,three));expect(bluff(hiro,four)).toBeLessThan(bluff(earl,four));
  expect(multiwayDiscipline(hiro)).toBeGreaterThan(multiwayDiscipline(earl));
 });
 it('gives up air, bets big hands for protection, folds bare bluff-catchers with players behind; legal; nothing heads-up',()=>{
  const four=cleanFlop(3,'g'),o=view(four,hand(four,'air'));const bet:Action={type:'raise',to:1200};
  expect(rate(300,i=>multiwayPlay(o,hiro,bet,seedStream(i)).play==='give-up')).toBeGreaterThan(.4);
  expect(rate(300,i=>multiwayPlay(o,earl,bet,seedStream(i)).play==='give-up')).toBeLessThan(.3);
  const set=view(four,hand(four,'set')),prot=[...Array(300).keys()].map(i=>multiwayPlay(set,hiro,{type:'check'},seedStream(i))).filter(r=>r.play==='protect');
  expect(prot.length/300).toBeGreaterThan(.3);for(const r of prot)expect(()=>act(four,r.action)).not.toThrow();
  const hu=cleanFlop(1,'u');expect(rate(200,i=>multiwayPlay(view(hu,hand(hu,'air')),hiro,bet,seedStream(i)).play!==null)).toBe(0);
  // Seat 3 checks, seat 4 bets: seat 5 (pair) faces it with nobody behind; seat 3 (pair) faces it with seat 5 still to act.
  let b=cleanFlop(3,'b');b=act(b,{type:'check'});b=act(b,{type:'raise',to:1000});
  const faced=view(b,hand(b,'pair'));expect(faced.actingSeat).toBe(5);
  expect(rate(200,i=>multiwayPlay(faced,hiro,{type:'call'},seedStream(i)).play==='fold-marginal')).toBeGreaterThan(.3);
 });
});

describe('bet-size tells',()=>{
 it('every regular habit is valid; strong players are balanced; the population shows every habit',()=>{
  for(const [id,style] of Object.entries(REGULAR_SIZING)){expect(REGULARS.some(r=>r.id===id)).toBe(true);expect(STYLE_READS[style]).toBeTruthy();}
  expect(sizingStyle(hiro,REGULAR_SIZING.hiro)).toBe('balanced');expect(tellStrength(hiro,'balanced')).toBe(0);
  const seen=new Set<SizingStyle>();for(let i=1;i<=400;i++)seen.add(sizingStyle(createProfile({selection:'random'},i,'neutral')));expect(seen.size).toBe(5);
  expect(sizingStyle(createProfile({selection:'stronger-reg'},3,'neutral'))).toBe('balanced');
 });
 it('sizes follow each habit, stay legal, and leave preflop, calls and all-ins alone',()=>{
  const s=cleanFlop(1,'z'),base:Action={type:'raise',to:Math.round(view(s,hand(s,'air')).pot*.6)};
  const med=(p:BotProfile,kind:'air'|'set',style?:SizingStyle)=>{const o=view(s,hand(s,kind),p),x:number[]=[];for(let i=0;i<200;i++){const a=humanSizing(o,p,applySizingTell(o,p,base,seedStream(i),style).action,seedStream(i+1),false);expect(()=>act(s,a)).not.toThrow();if(a.type==='raise')x.push(a.to);}x.sort((a,b)=>a-b);return x[100];};
  expect(med(earl,'set',REGULAR_SIZING['big-earl'])).toBeGreaterThan(med(earl,'air',REGULAR_SIZING['big-earl'])*1.8);
  expect(med(tess,'set',REGULAR_SIZING.tess)).toBeLessThan(med(tess,'air',REGULAR_SIZING.tess)*.6);
  expect(med(hiro,'set','balanced')).toBe(med(hiro,'air','balanced'));
  const o=view(s,hand(s,'set'),earl);
  expect(applySizingTell(o,earl,{type:'call'},seedStream(1)).tell).toBeNull();
  expect(applySizingTell(o,earl,{type:'raise',to:o.legal.maxRaiseTo!},seedStream(1)).tell).toBeNull();
  const pre=startHand({handId:'p',button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
  expect(applySizingTell(view(pre,['As','Ad'],earl),earl,{type:'raise',to:600},seedStream(1)).tell).toBeNull();
 });
 it('the generic size tell is unchanged for older layers and switched off only on request',()=>{
  const s=cleanFlop(1,'w'),o=view(s,hand(s,'set'),earl);
  for(let i=0;i<50;i++)expect(humanSizing(o,earl,{type:'raise',to:900},seedStream(i))).toEqual(humanSizing(o,earl,{type:'raise',to:900},seedStream(i),true));
  expect(rate(100,i=>JSON.stringify(humanSizing(o,earl,{type:'raise',to:900},seedStream(i)))!==JSON.stringify(humanSizing(o,earl,{type:'raise',to:900},seedStream(i),false)))).toBeGreaterThan(0);
 });
});

describe('versions',()=>{
 it('new cash tables (1.6.0 and later) play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(6);void HUMAN_LAYER_V16;
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
 },240000);
 it('tournament 2.9.0 adds multiway and sizing to the hash; 2.8.0 stays supported; new events pass the audit',async()=>{
  expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(9);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V28)).toBe(true);
  const trules={...rules,mode:'tournament' as const,tournament:{bigBlindAnte:200,antePriority:'blind-first' as const,buttonRule:'dead-button' as const}};
  let s=startHand({handId:'t',button:0,profile:trules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});s=act(s,{type:'raise',to:600});while(s.street==='preflop')s=act(s,s.actor===1||s.actor===2?{type:'fold'}:{type:'call'});
  const o=view(s,['4s','9h']),ctx={playersLeft:40,paid:5,stacks:Array(40).fill(20000)};
  expect(chooseTournamentDecision(o,hiro,seedStream(1),TOURNAMENT_POLICY_V29,ctx,[],null,{}).observationHash).toMatch(/:[a-z-]+\/[a-z=-]+$/);
  expect(chooseTournamentDecision(o,hiro,seedStream(1),TOURNAMENT_POLICY_V28,ctx,[],null,{}).observationHash).not.toMatch(/\/(give-up|-)\/?/);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
