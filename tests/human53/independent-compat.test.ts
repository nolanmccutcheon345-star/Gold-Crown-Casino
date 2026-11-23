import {describe,it,expect} from 'vitest';
import type {BotObservation,BotProfile,GameState,RuleProfile} from '../../src/contracts';
import type {AppData,PersistencePort} from '../../src/session/types';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V26,TOURNAMENT_POLICY_V27} from '../../src/tournament/bot-policy';
import {chooseTournamentV2,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {regularProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {seedStream} from '../../src/bots/profiles';
import {humanSizing,moodFrom,moodProfile,stackMood,sessionMood,type HandResult} from '../../src/bots/human';
import {readsProfile,emptyReads,type HeroReads} from '../../src/bots/reads';
import {emptyPlayerRead,type PlayerRead} from '../../src/bots/table-reads';
import {applyHabits,applyMinRaise,habitsOf} from '../../src/bots/habits';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {withPublicContext} from '../../src/session/bot-observation';
import {cashRecentResults} from '../../src/session/human-context';
import {memoryReads,memoryFacts} from '../../src/session/human-memory';
import {chooseDecision} from '../../src/bots/policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {EVENT_PRESETS} from '../../src/tournament/presets';

const rules:RuleProfile={id:'independent53',version:'1',mode:'tournament',smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:100,antePriority:'blind-first',buttonRule:'dead-button'}};
const context=():TournamentContext=>({playersLeft:4,paid:3,stacks:[1000,5000,1100,5000],prizes:[5000,3000,2000,0],playerIds:[40,71,9,26],seatPlayers:{0:40,1:71,2:9,3:26}});
// Literal Version52 2.6 dispatch body. The new table-read layer must stay dormant here.
function frozen26(o:BotObservation,profile:BotProfile,random:()=>number,standings:TournamentContext,recent:HandResult[],reads:HeroReads){
 const own=o.seats.find(s=>s.id===o.actingSeat)!,total=own.stack+own.totalCommitted,average=standings.stacks.reduce((a,b)=>a+b,0)/standings.playersLeft;
 const mood={...moodFrom(recent,profile),...stackMood(total/o.bigBlind,total/average)},read=readsProfile(o,moodProfile(profile,mood),reads),decision=chooseTournamentV2(o,read.profile,random,standings,true,true);
 const hash=`${TOURNAMENT_POLICY_V26}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}/${(mood.desperate??0).toFixed(3)}/${(mood.bigStack??0).toFixed(3)}:${read.effect?.applied.join('+')??'-'}`;
 const habits=habitsOf(profile,regularHabitsForProfile(profile)),habit=applyHabits(o,profile,decision.action,habits,random);
 return {...decision,observationHash:`${hash}:${habit.habit??'-'}`,action:applyMinRaise(o,humanSizing(o,profile,habit.action,random),habits,random).action};
}
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(next);}close(){}}
const cashRng=(token:number)=>{let state=token>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
function frozenCash13(d:AppData){
 const a=d.active!,p=a.pending!,profile=a.profiles[p.seatId],o=withPublicContext(observeBot(a.game,p.seatId,p.policyVersion,p.decisionId),a.game.profile.rake,profile,d.hands,a.sessionId);
 const mood={...moodFrom(cashRecentResults(d.hands,a,p.seatId),profile),...sessionMood(memoryFacts(d.humanMemory!,a,p.seatId),profile)};
 const playing=readsProfile(o,moodProfile(profile,mood),memoryReads(d.humanMemory!,a,p.seatId)).profile,decision=chooseDecision(o,playing,cashRng(p.drawToken)),touch=cashRng((p.drawToken^0x5eed1234)>>>0);
 const habits=habitsOf(profile,regularHabitsForProfile(profile)),habit=applyHabits(o,profile,decision.action,habits,touch);
 return {...decision,action:applyMinRaise(o,humanSizing(o,profile,habit.action,touch),habits,touch).action};
}
function read(hands=40):PlayerRead {const r=emptyPlayerRead();r.hands=hands;r.vpip={count:35,chances:40};r.pfr={count:30,chances:40};r.limp={count:0,chances:40};r.reads.hands=hands;return r;}
function observation(){let g=startHand({handId:'independent53-hash',button:0,profile:rules,seats:[1000,5000,1100,5000].map((stack,id)=>({id,name:`P${id}`,stack}))});g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'open',action:{type:'raise',to:300}});return observeBot(g,g.actor!,regularProfile('priya','high').policyVersion,'hash');}

describe('independent Version53 compatibility and fingerprints',()=>{
 it('retains exact 2.6 decisions and random consumption across complete hands',()=>{
  let compared=0;const hero=emptyReads(),recent:HandResult[]=[{deltaBB:-40,showdownLoss:true,share:-.5}];hero.hands=80;hero.foldToCbet={count:60,chances:80};
  const forbidden=new Proxy({} as Record<number,PlayerRead>,{get(){throw Error('Old policy read new context');},ownKeys(){throw Error('Old policy serialized new context');}});
  for(const id of ['priya','big-earl','nina','yuki'])for(let seed=0;seed<3;seed++){
   const profile=regularProfile(id,'mid');let g:GameState=startHand({handId:`old53:${id}:${seed}`,button:seed,profile:rules,seats:context().stacks.map((stack,i)=>({id:i,name:`P${i}`,stack}))});
   for(let n=0;g.street!=='complete'&&n<150;n++){
    const o=observeBot(g,g.actor!,profile.policyVersion,`old53:${n}`),a=seedStream(seed*1000+n),b=seedStream(seed*1000+n);
    const actual=chooseTournamentDecision(o,profile,a,TOURNAMENT_POLICY_V26,context(),recent,hero,forbidden),expected=frozen26(o,profile,b,context(),recent,hero);
    expect(actual).toEqual(expected);expect(a()).toBe(b());g=applyCommand(g,actual);compared++;
   }expect(g.street).toBe('complete');
  }expect(compared).toBeGreaterThan(40);
 });
 it('fingerprints numeric read changes even when the qualitative label is unchanged',()=>{
  const o=observation(),p=regularProfile('priya','high'),r=read(),other=structuredClone(r);other.vpip.count--;
  const hash=(rows:Record<number,PlayerRead>)=>chooseTournamentDecision(o,p,seedStream(9),TOURNAMENT_POLICY_V27,context(),[],null,rows).observationHash;
  expect(hash({3:r})).not.toBe(hash({3:other}));expect(hash({3:r,1:read()})).toBe(hash({1:read(),3:r}));
  // No diagnostic caller extras or private data enter the saved fingerprint.
  Object.defineProperty(r,'privateCards',{get(){throw Error('Private data serialized');},enumerable:true});expect(()=>hash({3:r})).not.toThrow();
  expect(hash({3:r}).split(':table:')[1]).toMatch(/^[a-f0-9]{64}$/);
 });
 it('retains old cash1.3 decisions through reload and churn boundaries',async()=>{
  const port=new Port();let c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4,seatStacks:{1:8000,2:30000,3:50000},maxBuyInBB:300});expect(c.error).toBe('');
  port.value!.active!.humanLayer='human-1.3.0';c.close();c=new SessionController(port);await c.init();let compared=0,reloads=0;
  for(let hand=0;hand<8;hand++){
   for(let n=0;c.data!.active!.game.street!=='complete'&&n<200;n++){
    const g=c.data!.active!.game;if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{
     await c.prepareBot();expect(c.error).toBe('');const expected=frozenCash13(c.data!);expect(c.data!.active!.pending!.decision).toEqual(expected);compared++;
     if(reloads<3){const before=structuredClone(c.data!.active!.pending);c.close();c=new SessionController(port);await c.init();expect(c.data!.active!.pending).toEqual(before);reloads++;}
     await c.commitBot(g.handId,g.revision);
    }expect(c.error).toBe('');
   }expect(c.data!.active!.game.street).toBe('complete');
   if(hand<7){if(c.data!.active!.game.seats[0].stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.humanLayer).toBe('human-1.3.0');}
  }expect(compared).toBeGreaterThan(10);c.close();
 },120000);
 it('reloads prepared2.7 decisions with witnessed history and exact money',async()=>{
  const port=new MemoryTournamentPersistence();let c=new TournamentController(port);await c.init();await c.startEvent(EVENT_PRESETS.find(p=>p.fields.includes(6))!.id,6,'real');expect(c.error).toBe('');let reloads=0;
  for(let n=0;n<1500&&c.data!.active!.handNumber<=14&&c.data!.active!.status!=='complete';n++){
   const e=c.data!.active!,g=e.game;if(g.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{
    await c.prepareBot();expect(c.error).toBe('');
    if(e.handNumber>=12&&reloads<3){const snapshot=structuredClone(c.data!);c.close();c=new TournamentController(port);await c.init();expect(c.error).toBe('');expect(c.data).toEqual(snapshot);expect(auditTournamentData(c.data!)).toBeGreaterThan(0);reloads++;}
    await c.commitBot(g.handId,g.revision);
   }expect(c.error).toBe('');
  }expect(reloads).toBe(3);c.close();
 },120000);
});
