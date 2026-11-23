import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,BotProfile,GameState} from '../../src/contracts';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {applyHabits,type Habits} from '../../src/bots/habits';
import {REGULARS,regularProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V24} from '../../src/tournament/bot-policy';
import {chooseTournamentV2,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {humanSizing,moodFrom,moodProfile,stackMood,sessionMood} from '../../src/bots/human';
import {readsProfile,emptyReads,type HeroReads} from '../../src/bots/reads';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {cashRecentResults} from '../../src/session/human-context';
import {memoryFacts,memoryReads} from '../../src/session/human-memory';
import {withPublicContext} from '../../src/session/bot-observation';
import {chooseDecision} from '../../src/bots/policy';
import {validateField,fieldNames,type EventField} from '../../src/tournament/field';

const rules={id:'independent51',version:'1',mode:'cash' as const,smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative' as const,oddChipOrder:'clockwise-from-button' as const};
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`a:${g.revision}`,action});
const habits=(h:Partial<Habits>):Habits=>({limpCall:0,minRaise:0,donk:0,trap:0,overbetTell:0,float:0,delayedBet:0,...h});
const p=regularProfile('viktor','high');
/** Heads-up flop after button limp-calls the big blind's raise: BB acts first, button last. */
function flop(){let g=startHand({handId:'independent51-float',button:0,profile:rules,seats:Array.from({length:3},(_,id)=>({id,name:`P${id}`,stack:10000}))});
 expect(g.actor).toBe(0);g=act(g,{type:'call'});g=act(g,{type:'fold'});g=act(g,{type:'raise',to:300});g=act(g,{type:'call'});expect(g.actor).toBe(2);expect(g.street).toBe('flop');return g;}
const obs=(g:GameState)=>observeBot(g,g.actor!,p.policyVersion,`decision:${g.revision}`);
// Frozen Version50 2.4 branch, copied before habits were introduced. Downstream base policy,
// mood and reads implementations are unchanged in this patch; compare complete decisions and RNG consumption.
function frozen24(o:BotObservation,profile:BotProfile,random:()=>number,standings:TournamentContext,reads:HeroReads){
 const recent=[{deltaBB:-40,showdownLoss:true,share:-.5}],own=o.seats.find(s=>s.id===o.actingSeat)!,total=own.stack+own.totalCommitted,average=standings.stacks.reduce((a,b)=>a+b,0)/standings.playersLeft;
 const mood={...moodFrom(recent,profile),...stackMood(total/o.bigBlind,total/average)},read=readsProfile(o,moodProfile(profile,mood),reads),decision=chooseTournamentV2(o,read.profile,random,standings,true);
 return {...decision,observationHash:`${TOURNAMENT_POLICY_V24}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}/${(mood.desperate??0).toFixed(3)}/${(mood.bigStack??0).toFixed(3)}:${read.effect?.applied.join('+')??'-'}`,action:humanSizing(o,profile,decision.action,random)};
}
// Frozen cash draw stream; policy and sizing deliberately receive separate streams.
function seeded(token:number):()=>number {let state=token>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}

describe('independent Version51 habit boundaries',()=>{
 it('floating applies to a continuation bet, not to a check-raise after leading',()=>{
  let g=flop();g=act(g,{type:'raise',to:200});const positive=applyHabits(obs(g),p,{type:'fold'},habits({float:1}),()=>0);expect(positive.habit).toBe('float');expect(positive.action).toEqual({type:'call'});expect(()=>act(g,positive.action)).not.toThrow();
  g=flop();g=act(g,{type:'check'});g=act(g,{type:'raise',to:200});g=act(g,{type:'raise',to:400});
  const negative=applyHabits(obs(g),p,{type:'fold'},habits({float:1}),()=>0);expect(negative.habit).toBeNull();expect(negative.action).toEqual({type:'fold'});
 });
 it('a flop floater can take a checked-to turn, but does not do so facing a bet',()=>{
  let g=flop();g=act(g,{type:'raise',to:200});g=act(g,{type:'call'});expect(g.street).toBe('turn');g=act(g,{type:'check'});
  const out=applyHabits(obs(g),p,{type:'check'},habits({delayedBet:1}),()=>0);expect(out.habit).toBe('delayedBet');expect(out.action.type).toBe('raise');expect(()=>act(g,out.action)).not.toThrow();
  let facing=flop();facing=act(facing,{type:'raise',to:200});facing=act(facing,{type:'call'});facing=act(facing,{type:'raise',to:200});expect(applyHabits(obs(facing),p,{type:'fold'},habits({delayedBet:1}),()=>0).habit).toBeNull();
 });
 it('uses named habit overrides only for an unedited regular profile',()=>{
  const base=regularProfile('bubba','low');expect(regularHabitsForProfile(base)?.limpCall).toBeGreaterThan(.7);
  expect(regularHabitsForProfile({...base,skill:.99})).toBeUndefined();
  expect(regularHabitsForProfile({...base,traits:{...base.traits!,slowPlay:.001}})).toBeUndefined();
  expect(regularHabitsForProfile({...base,aggression:.99})).toBeUndefined();
  expect(regularHabitsForProfile(structuredClone(base))).toEqual(regularHabitsForProfile(base));
 });
 it('does not consult any private opponent cards or future deck',()=>{
  let g=flop();g=act(g,{type:'raise',to:200});const o=obs(g);Object.defineProperty(o,'deck',{get(){throw Error('private deck');}});
  for(const seat of o.seats)Object.defineProperty(seat,'hole',{get(){throw Error('opponent private cards');}});
  expect(()=>applyHabits(o,p,{type:'fold'},habits({float:1}),()=>0)).not.toThrow();
 });
});

describe('independent Version50 compatibility',()=>{
 it('preserves complete old 2.4 decisions and the RNG stream across legal full hands',()=>{
  let compared=0;const reads=emptyReads();reads.hands=100;reads.foldBlinds={count:96,chances:100};reads.foldToCbet={count:75,chances:100};
  for(const id of ['big-earl','nina','priya','gus','sal','ana'])for(let seed=0;seed<3;seed++){
   const profile=regularProfile(id,'mid');let g=startHand({handId:`old51:${id}:${seed}`,button:seed,profile:rules,seats:Array.from({length:6},(_,i)=>({id:i,name:`P${i}`,stack:800+i*900}))});
   const standings={playersLeft:12,paid:3,stacks:[800,1700,2600,3500,4400,5300,8000,3000,2000,1500,6000,7000]};
   for(let step=0;g.street!=='complete'&&step<100;step++){
    const o=observeBot(g,g.actor!,profile.policyVersion,`old:${step}`),r1=seedStream(seed*1000+step),r2=seedStream(seed*1000+step);
    const a=chooseTournamentDecision(o,profile,r1,TOURNAMENT_POLICY_V24,standings,[{deltaBB:-40,showdownLoss:true,share:-.5}],reads),b=frozen24(o,profile,r2,standings,reads);
    expect(a).toEqual(b);expect(r1()).toBe(r2());g=applyCommand(g,a);compared++;
   }expect(g.street).toBe('complete');
  }expect(compared).toBeGreaterThan(100);
 });
 it('continues and reloads a stored human1.1 cash table with its original exact decision path',async()=>{
  const port=new Port(),first=new SessionController(port);await first.init();await first.startSession({...DEFAULT_SETTINGS,seats:4});port.value!.active!.humanLayer='human-1.1.0';first.close();
  const c=new SessionController(port);await c.init();expect(c.error).toBe('');let compared=0;
  for(let hand=0;hand<3;hand++){
   for(let step=0;c.data!.active!.game.street!=='complete'&&step<200;step++){
    const a=c.data!.active!,g=a.game;if(g.actor===0){await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);continue;}
    await c.prepareBot();expect(c.error).toBe('');const d=c.data!,active=d.active!,pending=active.pending!,profile=active.profiles[pending.seatId];
    const o=withPublicContext(observeBot(g,pending.seatId,pending.policyVersion,pending.decisionId),g.profile.rake,profile,d.hands,active.sessionId);
    const mood={...moodFrom(cashRecentResults(d.hands,active,pending.seatId),profile),...sessionMood(memoryFacts(d.humanMemory!,active,pending.seatId),profile)},playing=readsProfile(o,moodProfile(profile,mood),memoryReads(d.humanMemory!,active,pending.seatId)).profile;
    const base=chooseDecision(o,playing,seeded(pending.drawToken)),expected={...base,action:humanSizing(o,profile,base.action,seeded((pending.drawToken^0x5eed1234)>>>0))};
    expect(pending.decision).toEqual(expected);await c.commitBot(g.handId,g.revision);expect(c.error).toBe('');compared++;
   }
   if(hand<2){if(c.data!.active!.game.seats[0].stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}
  }
  expect(compared).toBeGreaterThan(3);c.close();const reload=new SessionController(port);await reload.init();expect(reload.error).toBe('');expect(reload.data!.active!.humanLayer).toBe('human-1.1.0');reload.close();
 });
 it('still validates original cast-1 regulars outside the new stakes pool and rejects new identities there',()=>{
  const entrants=9,population='low' as const,profiles=Object.fromEntries(Array.from({length:entrants},(_,id)=>[id,regularProfile('sal',population)]));
  const field:EventField={version:'cast-1',population,regulars:{1:'priya',2:'ana',3:'marco'}};for(const [player,id]of Object.entries(field.regulars))profiles[Number(player)]=regularProfile(id,population);
  expect(()=>validateField({entrants,preset:{tier:'home'},profiles,field},fieldNames(entrants,field))).not.toThrow();
  const changed:EventField={...field,regulars:{...field.regulars,1:'viktor'}};profiles[1]=regularProfile('viktor',population);
  expect(()=>validateField({entrants,preset:{tier:'home'},profiles,field:changed},fieldNames(entrants,changed))).toThrow(/pool/);
  expect(REGULARS.slice(0,20).map(r=>r.id)).toEqual(['big-earl','nina','marco','dot','vince','priya','hank','tess','rocco','lena','gus','mei','duke','sal','ruth','theo','ivy','frank','ana','walt']);
 });
});
