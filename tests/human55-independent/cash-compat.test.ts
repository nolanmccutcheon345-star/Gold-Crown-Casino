import {describe,it,expect,vi,afterEach} from 'vitest';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {startHand,applyCommand,legalActions,projectView,observeBot} from '../../src/core/engine';
import {auditSnapshot,getArchiveContext} from '../../src/storage/verified';
import {tableReadsProfile,isolate,answerRaise} from '../../src/bots/table-reads';
import {buyInStyle,depthPlay,depthProfile} from '../../src/bots/depth';
import {regularConfig,regularBuyInForProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {applyHabits,applyMinRaise,habitsOf} from '../../src/bots/habits';
import {memoryReads,memoryFacts} from '../../src/session/human-memory';
import {chooseDecision} from '../../src/bots/policy';
import {humanSizing,moodFrom,moodProfile,sessionMood} from '../../src/bots/human';
import {readsProfile} from '../../src/bots/reads';
import {cashRecentResults,cashSessionFacts,cashReads,cashTableReads} from '../../src/session/human-context';
import {withPublicContext} from '../../src/session/bot-observation';
import {straddledProfile,straddledView} from '../../src/bots/straddle';
import * as sizing from '../../src/bots/sizing-tells';
import * as churn from '../../src/session/churn';

class Port implements PersistencePort{value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(next);}close(){}}
function seeded(token:number){let state=token>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
// Literal Version54 controller human-1.5.0 branch, commit1cf32654eeebaf74e8a1ed062c0b168d1af1c8d0.
// Intentionally independent of the current controller's branch and version constants.
function version54Decision(d:AppData){
 const a=d.active!,p=a.pending!,profile=a.profiles[p.seatId];
 const base=observeBot(a.game,p.seatId,p.policyVersion,p.decisionId);
 const context=withPublicContext(base,a.game.profile.rake,profile,d.hands,a.sessionId,getArchiveContext(d)?.botMemory);
 const straddled=a.game.straddleSeat!==undefined,observation=straddled?straddledView(context,a.game.profile.bigBlind*2):context;
 const mood={...moodFrom(cashRecentResults(d.hands,a,p.seatId),profile),...sessionMood(d.humanMemory?memoryFacts(d.humanMemory,a,p.seatId):cashSessionFacts(d.hands,a,p.seatId),profile)};
 let playing=readsProfile(observation,moodProfile(profile,mood),d.humanMemory?memoryReads(d.humanMemory,a,p.seatId):cashReads(d.hands,a,p.seatId)).profile;
 if(straddled)playing=straddledProfile(playing);
 const table=cashTableReads(d.hands,a,p.seatId);
 playing=tableReadsProfile(observation,depthProfile(observation,playing).profile,table).profile;
 const decision=chooseDecision(observation,playing,seeded(p.drawToken)),touch=seeded((p.drawToken^0x5eed1234)>>>0);
 const habits=habitsOf(profile,regularHabitsForProfile(profile));
 let chosen=applyHabits(observation,profile,decision.action,habits,touch).action;
 chosen=isolate(observation,profile,chosen,table,touch).action;
 chosen=answerRaise(observation,profile,chosen,table,touch).action;
 chosen=depthPlay(observation,profile,buyInStyle(profile,regularBuyInForProfile(profile)),chosen,touch).action;
 return {...decision,observationHash:decision.observationHash+':human-1.5.0:'+bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(table)))),action:applyMinRaise(observation,humanSizing(observation,profile,chosen,touch),habits,touch).action};
}
afterEach(()=>vi.restoreAllMocks());
async function setup(){const port=new Port();const c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4,liveStraddle:true,seatStacks:{0:20000,1:20000,2:20000,3:20000},opponents:['tess','big-earl','hiro'].map(regularConfig)});expect(c.error).toBe('');return {c,port};}

describe('independent Version55 cash compatibility',()=>{
 it('matches the frozen Version54 action, complete decision and observation hash across straddles and every street',async()=>{
  const {c,port}=await setup();const template=structuredClone(port.value!);c.close();
  for(const straddle of [false,true])for(const street of ['preflop','flop','turn','river'] as const)for(const token of [0,1,0x5eed1234,0xffffffff]){
   const d=structuredClone(template),a=d.active!;a.humanLayer='human-1.5.0';
   let g=startHand({handId:a.game.handId,button:0,profile:a.game.profile,seats:a.game.seats.map(s=>({id:s.id,name:s.name,stack:20000})),...(straddle?{straddle:{seatId:3}}:{})});const frames=[projectView(g,0)];expect(g.straddleSeat).toBe(straddle?3:undefined);
   while(g.street!==street||g.actor===0){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`fixture:${g.revision}`,action:{type:legalActions(g).check?'check':'call'}});frames.push(projectView(g,0));}
   a.game=g;a.frames=frames;a.pending={handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`bot:${g.handId}:${g.revision}:${g.actor}`,policyVersion:a.profiles[g.actor!].policyVersion,drawToken:token,decision:null};
   const expected=version54Decision(d);port.value=d;const restored=new SessionController(port);await restored.init();expect(restored.error).toBe('');await restored.prepareBot();expect(restored.error).toBe('');
   expect(restored.data!.active!.pending!.drawToken).toBe(token);expect(restored.data!.active!.pending!.decision).toEqual(expected);restored.close();
  }
 });
 it('keeps new prepared decisions unchanged through reload, hand boundaries and a full snapshot audit',async()=>{
  const result=await setup();let c=result.c;const port=result.port;c.close();port.value!.active!.humanLayer='human-1.6.0';c=new SessionController(port);await c.init();expect(c.data!.active!.humanLayer).toBe('human-1.6.0');let prepared=0;
  for(let hand=0;hand<8;hand++){
   for(let guard=0;c.data!.active!.game.street!=='complete'&&guard<150;guard++){
    const g=c.data!.active!.game;
    if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);
    else{await c.prepareBot();expect(c.error).toBe('');const saved=structuredClone(c.data!);expect(saved.active!.pending!.decision!.observationHash).toContain(':human-1.6.0:');c.close();c=new SessionController(port);await c.init();expect(c.data).toEqual(saved);await c.commitBot(g.handId,g.revision);prepared++;}
    expect(c.error).toBe('');
   }
   expect(c.data!.active!.game.street).toBe('complete');if(hand===0){const settings=structuredClone(c.data!.sessions.find(s=>s.id===c.data!.active!.sessionId)!.settings);settings.seatStacks={1:20000};const plan=vi.spyOn(churn,'planChurn').mockReturnValueOnce({settings,news:['Tess rebuys.']});await c.nextHand();expect(plan).toHaveBeenCalled();const news=c.data!.active!.churnNews!.lines;expect(news[0]).toBe('Tess rebuys.');expect(news.filter(line=>line==='Tess rebuys.')).toHaveLength(1);plan.mockRestore();}else if(hand<7)await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.humanLayer).toBe('human-1.6.0');
  }
  expect(prepared).toBeGreaterThan(12);await c.cashOut();expect(c.error).toBe('');expect(await auditSnapshot(structuredClone(port.value!))).toEqual(c.data);c.close();
 },30000);
 it('does not force a named sizing override onto an edited regular at the controller boundary',async()=>{
  const {c,port}=await setup();c.close();const a=port.value!.active!;const actor=a.game.actor!;expect(actor).not.toBe(0);a.profiles[actor]={...a.profiles[actor],skill:0.123};
  const spy=vi.spyOn(sizing,'applySizingTell');const restored=new SessionController(port);await restored.init();await restored.prepareBot();expect(restored.error).toBe('');expect(spy).toHaveBeenCalled();expect(spy.mock.calls[0][4]).toBeUndefined();restored.close();
 });
});
