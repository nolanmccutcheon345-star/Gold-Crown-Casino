import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {tableReadsProfile,isolate,answerRaise} from '../bots/table-reads';
import {buyInStyle,depthPlay,depthProfile,styleBuyIn} from '../bots/depth';
import {multiwayPlay,multiwayProfile} from '../bots/multiway';
import {applySizingTell,regularSizingForProfile} from '../bots/sizing-tells';
import {imagePlay,imageProfile} from '../bots/image';
import {texturePlay} from '../bots/texture';
import {aggressionPlay} from '../bots/aggression';
import {threeBetPlay} from '../bots/three-bet';
import {fightPlay} from '../bots/fights';
import {riverPlay} from '../bots/river';
import {calibrationPlay} from '../bots/calibration';
import {showdownPlay} from '../bots/showdown';
import {leakPlay,leaksOf} from '../bots/leaks';
import {quirkPlay} from '../bots/quirks';
import {rivalryPlay,rivalryProfile,protectRivalryExposure} from '../bots/rivalry';
import {regularOfProfile} from '../bots/talk';
import {decidesToStraddle,REGULAR_STRADDLE,straddledProfile,straddledView} from '../bots/straddle';
import {regularBuyInForProfile} from '../bots/regulars';
import { applyHabits, applyMinRaise, habitsOf } from '../bots/habits';
import { regularHabitsForProfile } from '../bots/regulars';
import {emptyHumanMemory,appendHumanMemory,memoryReads,memoryFacts} from './human-memory';
import type { Action, RuleProfile } from '../contracts';
import { applyCommand, assertAccounting, legalActions, reconfigureTable, nextHand as dealNextHand, observeBot, projectView, startHand, topUpTable } from '../core/engine';
import { chooseDecision, supportedPolicy, POLICY_VERSION } from '../bots/policy';
import { HUMAN_LAYER_VERSION, HUMAN_LAYER_V11, HUMAN_LAYER_V12, HUMAN_LAYER_V13, HUMAN_LAYER_V14, HUMAN_LAYER_V15, HUMAN_LAYER_V16, HUMAN_LAYER_V17, HUMAN_LAYER_V18, HUMAN_LAYER_V19, HUMAN_LAYER_V110, HUMAN_LAYER_V111, HUMAN_LAYER_V112, HUMAN_LAYER_V113, HUMAN_LAYER_V114, HUMAN_LAYER_V115, HUMAN_LAYER_V116, HUMAN_LAYER_V117, HUMAN_LAYER_V118, HUMAN_LAYER_V119, HUMAN_LAYER_V120, HUMAN_LAYER_V121, humanSizing, moodFrom, moodProfile, sessionMood } from '../bots/human';
import { planChurn } from './churn';
import { readsProfile } from '../bots/reads';
import { exploitPlay, steamPlay } from '../bots/exploit';
import { dynamicsPlay } from '../bots/dynamics';
import { stabPlay } from '../bots/showdown';
import { BREAK_LINES, pickLine } from '../bots/routines';
import { passivePotPlay } from '../bots/passive-pots';
import { barrelFoldPlay, stationValuePlay } from '../bots/barrels';
import { misreadPlay } from '../bots/misreads';
import { tempoReadPlay, tempoDigest, type Tempo } from '../bots/tempo-reads';
import { rememberPlay, riverDigest } from '../bots/hero-memory';
import { blindDefensePlay, multiwayPreflopPlay, floatPlay, floatBetPlay, probePlay, sizeReadPlay, sizeReadsDigest } from '../bots/table-craft';
import { moodedProfile, pickMoodLine } from '../bots/session-mood';
import { NO_STEAM, insightDigest } from '../bots/insight';
import { cashRecentResults, cashSessionFacts, cashReads, cashTableReads, cashImages, cashGrudges, cashInsight, cashSizeReads, cashTempoRead, cashMemoryReads, cashBreak, cashSessionMood, cashIdentity } from './human-context';
import {pokerStarsProfile} from '../rules/pokerstars';
import {withRuleProfileConfigVersion} from '../rules/provenance';
import {makeCashHandProvenance} from './hand-provenance';
import {recordConfigurationBoundary} from './configuration-history';
import {DELETE_PRACTICE_CONFIRMATION,PracticeDataDeletedError} from '../storage/erasure';
import {selectPublicStudyRows,type StudyImportPreview} from '../storage/study-import';
import {savePlayerNote,deletePlayerNote,getPlayerNote} from './notes';
import {normalizeTableSettings,tableParticipants,tableProfiles,queueTableConfiguration,cancelQueuedConfiguration,applyQueuedConfiguration,saveNamedPreset,cloneNamedPreset,loadNamedPreset} from './configuration';
import { withPublicContext } from './bot-observation';
import { auditSnapshot, isVerifiedSnapshot, draftSnapshot, verifyTransition,getArchiveContext,totalHandCount,prepareCompactSnapshot } from '../storage/verified';
import { timed, timedAsync } from '../performance/timing';
import {createPublicHistoryBatch,type PublicHistoryBatch} from '../storage/public-history-batch';
import { newHandId } from '../identity';
import { BrowserPersistence } from '../storage/browser';
import { appendMoney, canonical, cents, GENESIS, parsePublicHistory, publicHistory, requireData, seal } from '../storage/integrity';
import {promoCredits,tokeId,tokeFor,heroCollected,type TokePolicy} from './promos';
import type { AppData, CashSettings, PersistencePort, PublicHistory, StoredHand } from './types';
export const DEFAULT_SETTINGS:CashSettings={seats:6,stake:'0',smallBlind:100,bigBlind:200,buyIn:20000,archetypes:['tag','station','nit','lag','passive-reg','fit-or-fold','stronger-reg','maniac','tag'],rakeMode:'none',rakeBasisPoints:500,rakeCap:300,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:500,allowTopUp:true};
const id=(kind:string)=>`${kind}:${newHandId()}`;
const now=()=>new Date().toISOString();
function seeded(token:number):()=>number {let state=token>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const STRADDLE_RULE={straddle:{kind:'utg-live' as const,multiple:2 as const}};
export function rules(settings:CashSettings):RuleProfile{const straddle=settings.liveStraddle?STRADDLE_RULE:{};if(settings.rakeMode==='pokerstars-usd-2026'){requireData((settings.chipUnit??1)===1,'Sourced USD rake requires one-cent chips.');return withRuleProfileConfigVersion({...pokerStarsProfile(settings.smallBlind,settings.bigBlind),...straddle});}return withRuleProfileConfigVersion({...straddle,id:'practice-cash',version:'0.3.0',mode:'cash',smallBlind:settings.smallBlind,bigBlind:settings.bigBlind,chipUnit:settings.chipUnit??1,rake:{basisPoints:settings.rakeMode==='custom'?settings.rakeBasisPoints:0,cap:settings.rakeMode==='custom'?settings.rakeCap:0,noFlopNoDrop:settings.noFlopNoDrop},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'});}
export class SessionController {
 dealerTipPolicy:TokePolicy='off';
 data:AppData|null=null;
 status:'loading'|'ready'|'readonly'|'error'|'deleted'='loading';
 error='';busy=false;
 private listeners=new Set<()=>void>();
 private failed:{expected:number|null;next:AppData}|null=null;
 private clock:ReturnType<typeof setInterval>|null=null;
 private lastTick=Date.now();
 private visible=true;
 private historyRequest:Promise<StoredHand[]>|null=null;
 // The key is weak: remembering an audited history must not retain its body
 // graph after explicit maintenance returns the controller to compact state.
 private compactHistoryPredecessors=new WeakMap<AppData,AppData>();
 constructor(private port:PersistencePort=new BrowserPersistence()){}
 subscribe(fn:()=>void):()=>void{this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 private emit(){this.listeners.forEach(fn=>fn());}
 private owns():boolean{return this.port.writable!==false;}
 get recoveryDiagnostics():readonly string[]{return this.port.recoveryDiagnostics??[];}
 get archiveAuditStatus(){return this.port.legacyArchiveAuditStatus??'not-required';}
 get canAuditArchive():boolean{return typeof this.port.auditCanonicalArchive==='function';}
 get canCompactSavedHistory():boolean{return typeof this.port.optimizeStorage==='function';}
 get totalHandCount():number{return this.data?totalHandCount(this.data):0;}
 get historyLoaded():boolean{return !this.data||!(getArchiveContext(this.data)?.handOffset);}
 get historyLoading():boolean{return this.historyRequest!==null;}
 /** Explicit history navigation, never a prerequisite for ordinary poker actions.
  * Pause mutations while materializing and compare the exact generation before
  * adopting full immutable records; this is not a financial write or settlement. */
 async loadFullHistory():Promise<StoredHand[]>{
  if(this.historyRequest)return this.historyRequest;
  // Recovery/export must remain available from the last verified commitment
  // after a quota failure or lease loss. This is a read, never a retry/payout;
  // the exact-revision comparison below rejects a newer other-tab snapshot.
  requireData(this.data&&isVerifiedSnapshot(this.data)&&this.status!=='loading'&&this.status!=='deleted'&&!this.busy,'Wait until a verified saved session is available to load history.');
  if(this.historyLoaded)return this.data.hands;
  requireData(this.port.loadFullHistory,'This storage environment cannot load the canonical archive.');
  const expected=this.data;this.busy=true;
  const request=(async()=>{
   const full=await this.port.loadFullHistory!();
   requireData(this.data===expected&&full.hands.length===totalHandCount(expected)&&canonical({...full,hands:[]})===canonical({...expected,hands:[]}),'Saved state changed while loading history. Retry without replacing the current game.');
   requireData(isVerifiedSnapshot(full),'Historical archive did not pass its independent audit.');
   const index=getArchiveContext(expected)?.handIndex;
   requireData(index&&full.hands.every((hand,i)=>hand.id===index[i]?.id&&hand.hash===index[i]?.hash),'Historical archive differs from the committed hand index.');
   this.compactHistoryPredecessors.set(full,expected);
   this.data=full;return full.hands;
  })();this.historyRequest=request;this.emit();
  try{return await request;}finally{this.historyRequest=null;this.busy=false;this.lastTick=Date.now();this.emit();}
 }
 /** End this scope before the storage port reconstructs a second full archive.
  * Reuse only the exact verified predecessor of a read-only history expansion;
  * otherwise use the existing verified compact-snapshot capability. This is a
  * resident cache release, never a storage write, skipped audit or settlement. */
 private async releaseFullHistoryForMaintenance():Promise<AppData>{
  const source=this.data!;
  requireData(isVerifiedSnapshot(source),'Saved history must be verified before maintenance.');
  if(!this.historyLoaded)return source;
  const compact=this.compactHistoryPredecessors.get(source)??(await prepareCompactSnapshot(source)).data;
  requireData(this.data===source&&this.status==='ready'&&this.owns(),'Saved state or ownership changed before history maintenance. Reload before continuing.');
  this.data=compact;
  // Subscribers must drop display/projection caches before the audit begins.
  this.emit();
  return compact;
 }
 async auditSavedArchive():Promise<{revision:number;hands:number;wallet:number;status:'verified'}>{
  requireData(!this.busy&&this.status==='ready'&&this.data&&this.owns(),'Wait until the owned saved session is ready.');
  requireData(!this.data.active,'End and cash out the table before checking the retained history copy.');
  requireData(this.port.auditCanonicalArchive,'This storage environment cannot inspect the retained history copy.');
  this.busy=true;this.emit();
  try{
   const expected=this.data.hands.length>120?await this.releaseFullHistoryForMaintenance():this.data;
   const result=await this.port.auditCanonicalArchive();
   requireData(this.data===expected&&this.owns()&&result.current!==false&&result.revision===expected.revision&&result.hands===totalHandCount(expected)&&result.wallet===expected.wallet,'The saved revision changed during the history check. Reload before checking again.');
   return result;
  }finally{this.busy=false;this.emit();}
 }
 /** Explicit cache maintenance never enters the money mutation path. The port
  * audits originals before retiring redundant copies; reloading verifies the
  * committed financial head without another whole-archive reconstruction. */
 async compactSavedHistory():Promise<{revision:number;hands:number;wallet:number;currentState:'verified-unchanged'}>{
  requireData(!this.busy&&this.status==='ready'&&this.data&&this.owns(),'Wait until the owned saved session is ready.');
  requireData(!this.data.active,'End and cash out the table before reducing saved-history storage.');
  requireData(this.port.optimizeStorage,'This storage environment cannot reduce saved-history storage.');
  this.busy=true;this.error='';this.emit();
  try{
   const expected=this.data.hands.length>120?await this.releaseFullHistoryForMaintenance():this.data;
   await this.port.optimizeStorage();
   const restored=await this.port.load();
   requireData(this.owns(),'Another tab owns this session. Reload before continuing.');
   requireData(restored,'The saved account is unavailable after storage maintenance. Existing records were not reset.');
   if(!isVerifiedSnapshot(restored))await auditSnapshot(restored);
   requireData(this.data===expected&&restored.revision===expected.revision&&restored.wallet===expected.wallet&&restored.epoch===expected.epoch&&restored.initialBankroll===expected.initialBankroll&&totalHandCount(restored)===totalHandCount(expected)&&canonical(restored.ledger)===canonical(expected.ledger)&&canonical(restored.active)===canonical(expected.active),'Saved revision changed during storage maintenance. Reload before continuing.');
   return {revision:expected.revision,hands:totalHandCount(restored),wallet:restored.wallet,currentState:'verified-unchanged'};
  }catch(cause){
   this.error=cause instanceof Error?cause.message:'Storage maintenance failed. Retry the saved account.';
   if(this.port.deleted||cause instanceof PracticeDataDeletedError)this.clearDeletedState();else this.status=/another tab|revision changed|ownership/i.test(this.error)?'readonly':'error';
   throw cause;
  }finally{this.busy=false;this.emit();}
 }
 private async initialGuestData():Promise<AppData>{
  const initial:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
  await appendMoney(initial,{id:id('initial'),at:now(),epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Initial virtual bankroll'});return initial;
 }
 async init():Promise<void>{
  this.busy=true;this.status='loading';this.emit();
  try{
   this.data=await this.port.load();
   if(!this.owns()){this.status='readonly';this.error='Another tab owns this session. Close it, then Retry to continue here.';return;}
   if(!this.data){
    const initial=await this.initialGuestData();
    await this.persist(null,initial);
   }else{if(!isVerifiedSnapshot(this.data))await auditSnapshot(this.data);this.status='ready';}
   this.error='';this.startClock();
  }catch(e){this.error=(e as Error).message;if(this.port.deleted||e instanceof PracticeDataDeletedError)this.clearDeletedState();else this.status='error';}
  finally{this.busy=false;this.emit();}
 }
 private startClock():void{
  this.lastTick=Date.now();
  if(typeof document==='undefined')return;
  this.visible=document.visibilityState!=='hidden';
  document.addEventListener('visibilitychange',this.visibilityChanged);
  window.addEventListener('pagehide',this.pageHide);
  window.addEventListener('pageshow',this.pageShow);
  if(!this.clock)this.clock=setInterval(()=>{void this.tick();},5000);
 }
 private pageShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
 private visibilityChanged=()=>{this.visible=document.visibilityState!=='hidden';this.lastTick=Date.now();};
 private pageHide=()=>{this.close();window.addEventListener('pageshow',this.pageShow,{once:true});};
 private stopClock():void{if(this.clock)clearInterval(this.clock);this.clock=null;if(typeof document!=='undefined'){document.removeEventListener('visibilitychange',this.visibilityChanged);window.removeEventListener('pagehide',this.pageHide);window.removeEventListener('pageshow',this.pageShow);}}
 close():void{this.stopClock();this.port.close();}
 private clearDeletedState():void{this.stopClock();this.data=null;this.failed=null;this.status='deleted';}
 private accountClock(d:AppData):void{
  const time=Date.now();const delta=Math.max(0,Math.min(time-this.lastTick,10000));this.lastTick=time;
  if(d.active){const session=d.sessions.find(s=>s.id===d.active!.sessionId)!;if(this.visible&&!d.active.paused)session.activeMs+=delta;session.lastActiveAt=null;}
 }
 async tick():Promise<void>{if(!this.data?.active||!this.visible||this.data.active.paused){this.lastTick=Date.now();return;}await this.mutate(async()=>{});}
 private async persist(expected:number|null,next:AppData):Promise<void>{
  await verifyTransition(this.data,next);this.failed={expected,next};
  try{await timedAsync('persistence.commit',()=>this.port.commit(expected,next));this.data=next;this.failed=null;this.status='ready';}
  catch(e){if(this.port.deleted||e instanceof PracticeDataDeletedError)this.clearDeletedState();else this.status=/another tab|revision changed|ownership/i.test((e as Error).message)?'readonly':'error';throw e;}
 }
 private async mutate(change:(candidate:AppData)=>Promise<void>):Promise<void>{
  if(this.busy||this.status!=='ready'||!this.data)return;
  this.busy=true;this.emit();this.error='';
  try{const next=draftSnapshot(this.data);this.accountClock(next);await change(next);
   // A duplicate/no-op does not create a new financial event, even if clock time saves.
   next.revision=this.data.revision+1;await this.persist(this.data.revision,next);
  }catch(e){this.error=(e as Error).message;}
  // Every save publishes both busy and ready. Otherwise a background clock
  // commit leaves enabled controls visible while their action guards reject
  // the click. The UI preserves same-decision drafts across these renders.
  finally{this.busy=false;this.emit();}
 }
 async retry():Promise<void>{
  if(this.busy)return;this.busy=true;this.emit();
  try{
   const latest=await this.port.load();
   requireData(this.owns(),'Another tab owns this session. Close it before retrying.');
   // An explicit erased/fresh wallet may reuse revision zero. Its independently
   // verified initial ledger identity is a new history, not an old retry target.
   if(this.failed&&latest&&this.failed.next.ledger[0]?.hash!==latest.ledger[0]?.hash){this.failed=null;this.data=latest;}
   if(this.failed){
    if(latest&&canonical(latest)===canonical(this.failed.next)){this.data=latest;this.failed=null;}
    else if((latest?.revision??null)===this.failed.expected){await this.persist(this.failed.expected,this.failed.next);}
    else{this.failed=null;this.data=latest;requireData(latest,'Saved state missing.');}
   }else{this.data=latest;}
   if(!this.data){this.busy=false;await this.init();return;}
   if(!isVerifiedSnapshot(this.data))await auditSnapshot(this.data);this.startClock();this.status='ready';this.error='';
  }catch(e){this.error=(e as Error).message;if(this.port.deleted||e instanceof PracticeDataDeletedError)this.clearDeletedState();else this.status=/another tab|revision changed|ownership/i.test(this.error)?'readonly':'error';}
  finally{this.busy=false;this.emit();}
 }
 async takeOver():Promise<void>{
  if(this.busy)return;
  if(!this.port.takeOver){await this.retry();return;}
  this.busy=true;this.emit();
  try{await this.port.takeOver();this.failed=null;this.data=await this.port.load();requireData(this.data,'Saved state missing. Retry initialization.');if(!isVerifiedSnapshot(this.data))await auditSnapshot(this.data);this.status='ready';this.error='';this.startClock();}
  catch(e){this.error=(e as Error).message;if(this.port.deleted||e instanceof PracticeDataDeletedError)this.clearDeletedState();else this.status='error';}
  finally{this.busy=false;this.emit();}
 }
 async adjustBankroll(targetCents:number,note:string,reset=false):Promise<void>{await this.mutate(async d=>{
  requireData(cents(targetCents)&&targetCents<=1e12,'Choose a virtual bankroll between $0 and $10 billion.');
  requireData(typeof note==='string'&&note.trim().length>0&&note.length<=200,'Enter a short adjustment reason.');
  if(reset){d.epoch++;d.initialBankroll=targetCents;}
  await appendMoney(d,{id:id(reset?'reset':'adjustment'),kind:reset?'reset':'adjustment',at:now(),epoch:d.epoch,walletDelta:targetCents-d.wallet,tableDelta:0,pokerNet:0,note:note.trim()});
 });}
 async startSession(settings:CashSettings):Promise<void>{await this.mutate(async d=>{
  requireData(!d.active,'Cash out the existing session before starting another.');
  // Bootstrap once at registration, streaming only the most recent400 verified public summaries.
  // No ordinary decision reconstructs or scans the canonical archive.
  if(!d.humanMemory){const count=totalHandCount(d),offset=getArchiveContext(d)?.handOffset??0,start=Math.max(0,count-400);let memory=emptyHumanMemory(start);
   for(let i=start;i<count;i++){const hand=i>=offset?d.hands[i-offset]:await this.port.readHand?.(i);requireData(hand,'Archived opponent reads are unavailable; existing save is unchanged.');memory=appendHumanMemory(memory,hand);if(i%16===0)await new Promise<void>(resolve=>setTimeout(resolve,0));}
   d.humanMemory={...memory,sessionId:null,facts:{}};
  }
  const savedSettings=normalizeTableSettings(settings),profiles=tableProfiles(savedSettings);
  const stacks:Record<number,number>={...savedSettings.seatStacks};
  for(const [seat,profile] of Object.entries(profiles))if(Number(seat)!==0&&stacks[Number(seat)]===undefined)stacks[Number(seat)]=styleBuyIn(buyInStyle(profile,regularBuyInForProfile(profile)),savedSettings);
  if(Object.keys(stacks).length)savedSettings.seatStacks=stacks;
  const seats=tableParticipants(savedSettings);
  if(savedSettings.seatNames)requireData(new Set(seats.map(seat=>seat.name)).size===seats.length,'Newcomer names must be unique at the table.');
  const buyIn=seats.find(s=>s.id===0)!.stack;
  requireData(buyIn<=d.wallet,'Insufficient wallet funds. Adjust your virtual bankroll in Cashier.');
  const sessionId=id('session'),timestamp=now(),profile=rules(savedSettings);
  const game=startHand({handId:newHandId(),seats,button:0,profile});
  delete savedSettings.seatStacks;delete savedSettings.seatNames;
  d.sessions.push({id:sessionId,epoch:d.epoch,startedAt:timestamp,endedAt:null,settings:savedSettings,profile,buyIns:buyIn,cashOut:0,activeMs:0,lastActiveAt:null,handIds:[]});
  d.active={sessionId,game,profiles,number:1,startedAt:timestamp,frames:[projectView(game,0)],paused:false,pending:null,exitMode:null,humanLayer:HUMAN_LAYER_V121};
  recordConfigurationBoundary(d);
  await appendMoney(d,{id:`buy-in:${sessionId}`,kind:'buy-in',at:timestamp,epoch:d.epoch,walletDelta:-buyIn,tableDelta:buyIn,pokerNet:0,sessionId,note:'Wallet to table'});
  await this.settle(d);
 });}
 async savePreset(name:string,settings:CashSettings,presetId?:string):Promise<void>{await this.mutate(async d=>{saveNamedPreset(d,{id:presetId??id('preset'),name,settings,at:now()});});}
 async clonePreset(sourceId:string,name:string):Promise<void>{await this.mutate(async d=>{cloneNamedPreset(d,sourceId,{id:id('preset'),name,at:now()});});}
 loadPreset(presetId:string):CashSettings{requireData(this.data,'Saved data unavailable.');return loadNamedPreset(this.data,presetId);}
 async queueConfiguration(settings:CashSettings,expectedSessionId:string,expectedHandId:string):Promise<void>{await this.mutate(async d=>{queueTableConfiguration(d,{id:id('configuration'),settings,expectedSessionId,expectedHandId,at:now()});});}
 async cancelQueuedConfiguration(expectedSessionId:string,requestId:string):Promise<void>{await this.mutate(async d=>{cancelQueuedConfiguration(d,expectedSessionId,requestId);});}
 /** Hero's standing choice to straddle when under the gun (tables that allow straddles). */
 async setHeroStraddle(on:boolean):Promise<void>{await this.mutate(async d=>{const a=d.active;requireData(a,'No active table.');requireData(typeof on==='boolean','Invalid straddle choice.');requireData(!on||a.game.profile.straddle?.kind==='utg-live','This table does not allow a live straddle.');if(on)a.heroStraddle=true;else delete a.heroStraddle;});}
 async topUp(amount:number):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&a.game.street==='complete','Finish the hand before adding chips.');const s=d.sessions.find(s=>s.id===a.sessionId)!;
  requireData(!a.exitMode,'This session is ending; no more chips can be added.');
  requireData(s.settings.allowTopUp,'Top-ups are disabled for this table.');requireData(cents(amount)&&amount>0&&amount<=d.wallet,'Choose a positive top-up within wallet funds.');
  const transferId=id('top-up');a.game=topUpTable(a.game,0,amount,transferId,s.settings.maxBuyInBB*s.profile.bigBlind);
  s.buyIns+=amount;
  await appendMoney(d,{id:transferId,kind:'top-up',at:now(),epoch:d.epoch,walletDelta:-amount,tableDelta:amount,pokerNet:0,sessionId:s.id,note:'Wallet to table; next-hand chips'});
 });}
 private async closeSession(d:AppData):Promise<void>{
  if(!d.active)return;const a=d.active;requireData(a.game.street==='complete','Finish the active hand before cashing out.');
  const s=d.sessions.find(s=>s.id===a.sessionId)!;const amount=a.game.seats.find(s=>s.id===0)!.stack;
  await appendMoney(d,{id:`cash-out:${s.id}`,kind:'cash-out',at:now(),epoch:d.epoch,walletDelta:amount,tableDelta:-amount,pokerNet:0,sessionId:s.id,note:'Table to wallet'});
  s.cashOut=amount;s.endedAt=now();s.lastActiveAt=null;d.active=null;
  await this.payPromos(d,s.id);
  if(a.dealerTips?.cents){const tips=a.dealerTips;requireData(Number.isSafeInteger(tips.cents)&&tips.cents>0&&Number.isSafeInteger(tips.pots)&&tips.pots>0&&tips.pots<=s.handIds.length&&tips.cents<=500*tips.pots,'Invalid dealer tip total.');
   await appendMoney(d,{id:tokeId(s.id),kind:'adjustment',at:now(),epoch:d.epoch,walletDelta:-Math.min(tips.cents,d.wallet),tableDelta:0,pokerNet:0,sessionId:s.id,note:'Dealer tips for the session.'});}
 }
 async cashOut():Promise<void>{await this.mutate(d=>this.closeSession(d));}
 async requestEndSession(mode:'finish'|'fold',expectedSessionId:string,expectedHandId:string):Promise<void>{await this.mutate(async d=>{
  const a=d.active;
  requireData(a&&a.sessionId===expectedSessionId&&a.game.handId===expectedHandId,'This session or hand has changed. Review the current table before ending it.');
  requireData(mode==='finish'||mode==='fold','Choose how to finish the hand.');
  // Once requested, the chosen commitment cannot be replaced to undo an unfavorable hand.
  requireData(!a.exitMode||a.exitMode===mode,'This session is already ending.');
  a.exitMode=mode;a.paused=false;
  await this.advanceExit(d);await this.settle(d);
 });}
 private async advanceExit(d:AppData):Promise<void>{
  const a=d.active;if(!a||a.exitMode!=='fold'||a.game.actor!==0||a.game.street==='complete')return;
  const {handId,revision}=a.game;
  a.game=applyCommand(a.game,{handId,revision,seatId:0,decisionId:`exit:${handId}:${revision}`,action:{type:'fold'}});
  a.frames.push(projectView(a.game,0));
 }
 async nextHand():Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&a.game.street==='complete','Finish the current hand first.');requireData(!a.exitMode,'This session is ending.');
  // Layer 1.3.0: players come and go between hands, through the ordinary queued configuration.
  const churn=a.humanLayer===HUMAN_LAYER_V13||a.humanLayer===HUMAN_LAYER_V14||a.humanLayer===HUMAN_LAYER_V15||a.humanLayer===HUMAN_LAYER_V16||a.humanLayer===HUMAN_LAYER_V17||a.humanLayer===HUMAN_LAYER_V18||a.humanLayer===HUMAN_LAYER_V19||a.humanLayer===HUMAN_LAYER_V110||a.humanLayer===HUMAN_LAYER_V111||a.humanLayer===HUMAN_LAYER_V112||a.humanLayer===HUMAN_LAYER_V113||a.humanLayer===HUMAN_LAYER_V114||a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121?planChurn(d,a,a.humanLayer!==HUMAN_LAYER_V13,a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121,a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121,a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121):null;
  // Layer 1.15.0: announced last orbits are table state, carried to the next hand.
  const routines=a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121;if(churn&&routines)a.lastOrbit=churn.lastOrbit??{};
  if(churn&&churn.changed!==false)queueTableConfiguration(d,{id:`churn:${a.game.handId}`,settings:churn.settings,expectedSessionId:a.sessionId,expectedHandId:a.game.handId,at:now()});
  const changed=await applyQueuedConfiguration(d,{reconfigure:reconfigureTable,rules,at:now()});
  requireData(a.game.seats.find(s=>s.id===0)!.stack>0,'Add chips or cash out before dealing.');
  // A live straddle, when the table allows one: Hero by choice; players (layer 1.5.0) by personality and mood.
  const previousId=a.game.handId,straddler=(seat:number)=>{
   if(seat===0)return !!a.heroStraddle;
   const profile=a.profiles[seat];if((a.humanLayer!==HUMAN_LAYER_V15&&a.humanLayer!==HUMAN_LAYER_V16&&a.humanLayer!==HUMAN_LAYER_V17&&a.humanLayer!==HUMAN_LAYER_V18&&a.humanLayer!==HUMAN_LAYER_V19&&a.humanLayer!==HUMAN_LAYER_V110&&a.humanLayer!==HUMAN_LAYER_V111&&a.humanLayer!==HUMAN_LAYER_V112&&a.humanLayer!==HUMAN_LAYER_V113&&a.humanLayer!==HUMAN_LAYER_V114&&a.humanLayer!==HUMAN_LAYER_V115&&a.humanLayer!==HUMAN_LAYER_V116&&a.humanLayer!==HUMAN_LAYER_V117&&a.humanLayer!==HUMAN_LAYER_V118&&a.humanLayer!==HUMAN_LAYER_V119&&a.humanLayer!==HUMAN_LAYER_V120&&a.humanLayer!==HUMAN_LAYER_V121)||!profile)return false;
   const stack=a.game.seats.find(s=>s.id===seat)?.stack??0,mood={...moodFrom(cashRecentResults(d.hands,a,seat),profile),...sessionMood(d.humanMemory?memoryFacts(d.humanMemory,a,seat):cashSessionFacts(d.hands,a,seat),profile)};
   return decidesToStraddle(profile,previousId,seat,stack/a.game.profile.bigBlind,mood,regularBuyInForProfile(profile)!==undefined?REGULAR_STRADDLE[regularOfProfile(profile)??'']:undefined);
  };
  a.game=dealNextHand(a.game,newHandId(),a.game.profile.straddle?straddler:undefined);a.number++;a.startedAt=now();a.frames=[projectView(a.game,0)];a.pending=null;a.paused=false;recordConfigurationBoundary(d,changed);
  const breakNews:string[]=[];
  if(routines)for(const seat of a.game.seats){if(seat.id===0||seat.stack===0)continue;const b=cashBreak(d.hands,a,seat.id,d.humanMemory),key=`${a.game.handId}:${seat.id}`;
   if(b.starting)breakNews.push(`${seat.name} ${pickLine(BREAK_LINES.leave,key)}`);else if(b.returning)breakNews.push(`${seat.name} ${pickLine(BREAK_LINES.back,key)}`);}
  // Layer 1.16.0: a player who just sat down (or, after the first hand, one of the starting players) says how the night is going.
  if(a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121){const facts=(seat:number)=>(d.humanMemory?memoryFacts(d.humanMemory,a,seat):cashSessionFacts(d.hands,a,seat)).hands;
   const fresh=a.game.seats.filter(seat=>seat.id!==0&&seat.stack>0&&a.profiles[seat.id]&&facts(seat.id)===(a.number===2?1:0));
   const at=Number.parseInt(a.game.handId.replace(/\D/g,'').slice(-6)||'0',10)%Math.max(1,fresh.length),pick=a.number===2?fresh.slice(at,at+1):fresh;
   for(const seat of pick)breakNews.push(`${seat.name}: “${pickMoodLine(cashSessionMood(a,seat.id),`${a.game.handId}:${seat.id}`)}”`);}
  const lines=[...(churn&&(changed||churn.changed===false)?churn.news:[]),...breakNews].slice(0,9);
  if(lines.length)a.churnNews={handId:a.game.handId,lines};else delete a.churnNews;
  await this.settle(d);
 });}
 /** `tempo` (layer 1.20.0 only): whether Hero acted in a snap or after a long think, which everyone at a live table can see. */
 async act(action:Action,handId:string,revision:number,tempo?:Tempo|null):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&!a.paused&&a.game.actor===0,'Action is not on Hero.');requireData(a.exitMode!=='fold','Fold and leave is already committed.');requireData(a.game.handId===handId&&a.game.revision===revision,'Obsolete action rejected.');
  a.game=applyCommand(a.game,{handId,revision,seatId:0,decisionId:`hero:${handId}:${revision}`+(tempo&&(a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121)?`:${tempo}`:''),action});a.frames.push(projectView(a.game,0));await this.settle(d);
 });}
 async setPaused(paused:boolean):Promise<void>{await this.mutate(async d=>{if(d.active)d.active.paused=paused;});}
 async prepareBot():Promise<void>{
  return timedAsync('bot.prepare',async()=>{
  await this.mutate(async d=>{
   const a=d.active;requireData(a&&!a.paused&&a.game.actor!==null&&a.game.actor!==0,'No bot action is pending.');
   if(a.pending)return;const actor=a.game.actor;const p=a.profiles[actor];requireData(p&&supportedPolicy(p.policyVersion),'This saved policy version is unavailable. The table has been preserved.');
   const drawToken=crypto.getRandomValues(new Uint32Array(1))[0];
   a.pending={handId:a.game.handId,revision:a.game.revision,seatId:actor,decisionId:`bot:${a.game.handId}:${a.game.revision}:${actor}`,policyVersion:p.policyVersion,drawToken,decision:null};
  });
  if(this.status!=='ready'||!this.data?.active?.pending||this.data.active.pending.decision)return;
  await this.mutate(async d=>{
   const a=d.active!;const p=a.pending!;
   const base=observeBot(a.game,p.seatId,p.policyVersion,p.decisionId);
   const context=timed('bot.publicMemory',()=>withPublicContext(base,a.game.profile.rake,a.profiles[p.seatId],d.hands,a.sessionId,getArchiveContext(d)?.botMemory));
   const straddled=(a.humanLayer===HUMAN_LAYER_V15||a.humanLayer===HUMAN_LAYER_V16||a.humanLayer===HUMAN_LAYER_V17||a.humanLayer===HUMAN_LAYER_V18||a.humanLayer===HUMAN_LAYER_V19||a.humanLayer===HUMAN_LAYER_V110||a.humanLayer===HUMAN_LAYER_V111||a.humanLayer===HUMAN_LAYER_V112||a.humanLayer===HUMAN_LAYER_V113||a.humanLayer===HUMAN_LAYER_V114||a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121)&&a.game.straddleSeat!==undefined;
   const observation=straddled?straddledView(context,a.game.profile.bigBlind*2):context;
   // Profiles saved under an older policy keep their exact old decisions; the human layer is for the current policy only.
   if((a.humanLayer===HUMAN_LAYER_VERSION||a.humanLayer===HUMAN_LAYER_V11||a.humanLayer===HUMAN_LAYER_V12||a.humanLayer===HUMAN_LAYER_V13||a.humanLayer===HUMAN_LAYER_V14||a.humanLayer===HUMAN_LAYER_V15||a.humanLayer===HUMAN_LAYER_V16||a.humanLayer===HUMAN_LAYER_V17||a.humanLayer===HUMAN_LAYER_V18||a.humanLayer===HUMAN_LAYER_V19||a.humanLayer===HUMAN_LAYER_V110||a.humanLayer===HUMAN_LAYER_V111||a.humanLayer===HUMAN_LAYER_V112||a.humanLayer===HUMAN_LAYER_V113||a.humanLayer===HUMAN_LAYER_V114||a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121)&&a.profiles[p.seatId].policyVersion===POLICY_VERSION){
    const profile=a.profiles[p.seatId],v121=a.humanLayer===HUMAN_LAYER_V121,v120=a.humanLayer===HUMAN_LAYER_V120||v121,v119=a.humanLayer===HUMAN_LAYER_V119||v120,v118=a.humanLayer===HUMAN_LAYER_V118||v119,v117=a.humanLayer===HUMAN_LAYER_V117||v118,v116=a.humanLayer===HUMAN_LAYER_V116||v117,v115=a.humanLayer===HUMAN_LAYER_V115||v116,v114=a.humanLayer===HUMAN_LAYER_V114||v115,v113=a.humanLayer===HUMAN_LAYER_V113||v114,v112=a.humanLayer===HUMAN_LAYER_V112||v113,v111=a.humanLayer===HUMAN_LAYER_V111||a.humanLayer===HUMAN_LAYER_V112||a.humanLayer===HUMAN_LAYER_V113||a.humanLayer===HUMAN_LAYER_V114||a.humanLayer===HUMAN_LAYER_V115||a.humanLayer===HUMAN_LAYER_V116||a.humanLayer===HUMAN_LAYER_V117||a.humanLayer===HUMAN_LAYER_V118||a.humanLayer===HUMAN_LAYER_V119||a.humanLayer===HUMAN_LAYER_V120||a.humanLayer===HUMAN_LAYER_V121,v110=a.humanLayer===HUMAN_LAYER_V110||v111,v19=a.humanLayer===HUMAN_LAYER_V19||v110,v18=a.humanLayer===HUMAN_LAYER_V18||v19,v17=a.humanLayer===HUMAN_LAYER_V17||v18,v16=a.humanLayer===HUMAN_LAYER_V16||v17,v15=a.humanLayer===HUMAN_LAYER_V15||v16,v14=a.humanLayer===HUMAN_LAYER_V14||v15,v12=a.humanLayer===HUMAN_LAYER_V12||a.humanLayer===HUMAN_LAYER_V13||v14,v11=a.humanLayer===HUMAN_LAYER_V11||v12;
    const mood={...moodFrom(cashRecentResults(d.hands,a,p.seatId),profile),...(v11?sessionMood(d.humanMemory?memoryFacts(d.humanMemory,a,p.seatId):cashSessionFacts(d.hands,a,p.seatId),profile):{})};
    // Layer 1.13.0: leaks this player has noticed in others it has watched, and its own steam after a bad beat or cooler.
    const sizeReads=v119?cashSizeReads(d.hands,a,p.seatId):null,memory=v121?cashMemoryReads(d.hands,a,p.seatId):null,tempoRead=v121?memory?.tempo??null:v120?cashTempoRead(d.hands,a,p.seatId):null;const insight=v113?cashInsight(d.hands,a,p.seatId):null,steam=insight?.steam??NO_STEAM;if(steam.level>mood.tilt)mood.tilt=steam.level;
    // Layer 1.1.0: adaptive players also exploit what they have seen Hero do.
    // Layer 1.16.0: the session mood shifts the profile the base policy plays; named-profile lookups keep the authored profile.
    const sessionProfile=v116?moodedProfile(profile,cashSessionMood(a,p.seatId)):profile;
    let playing=v11?readsProfile(observation,moodProfile(sessionProfile,mood),(d.humanMemory?memoryReads(d.humanMemory,a,p.seatId):cashReads(d.hands,a,p.seatId))).profile:moodProfile(sessionProfile,mood);
    if(straddled)playing=straddledProfile(playing);
    const table=v14?cashTableReads(d.hands,a,p.seatId):null;
    if(v14)playing=tableReadsProfile(observation,depthProfile(observation,playing).profile,table).profile;
    if(v16)playing=multiwayProfile(observation,playing).profile;
    const images=v17?cashImages(d.hands,a,p.seatId):null;
    if(v17)playing=imageProfile(observation,playing,images).profile;
    const grudges=v110?cashGrudges(d.hands):null,identity=cashIdentity(a);
    if(v110)playing=rivalryProfile(observation,playing,grudges,identity).profile;
    const decision=timed('bot.policy',()=>chooseDecision(observation,playing,seeded(p.drawToken)));
    const touch=seeded((p.drawToken^0x5eed1234)>>>0);
    if(v12){
     const habits=habitsOf(profile,regularHabitsForProfile(profile)),habit=applyHabits(observation,profile,decision.action,habits,touch);
     let chosen=habit.action;
     if(v14){chosen=isolate(observation,profile,chosen,table,touch).action;chosen=answerRaise(observation,profile,chosen,table,touch).action;chosen=depthPlay(observation,profile,buyInStyle(profile,regularBuyInForProfile(profile)),chosen,touch).action;}
     let multiway='-',tell='-',texture='-',image='-',wars='-',aggression='-',fight='-',river='-',calibration='-',rivalry='-',showdown='-',leak='-',quirk='-',exploit='-',steamed='-',dynamic='-',stab='-',passive='-',station='-',barrel='-',misread='-',crafted='-',tempoPlay='-',memoryPlay='-';let beforeRivalry=chosen;
     if(v18){const w=threeBetPlay(observation,profile,chosen,touch);chosen=w.action;wars=w.play??'-';}
     if(v17){const t=texturePlay(observation,profile,chosen,touch);chosen=t.action;texture=t.play??'-';const i=imagePlay(observation,profile,chosen,images,touch);chosen=i.action;image=i.play??'-';if(v18&&!t.play){const a=aggressionPlay(observation,profile,chosen,touch);chosen=a.action;aggression=a.play??'-';}}
     if(v19){const f=fightPlay(observation,profile,chosen,touch);chosen=f.action;fight=f.play??'-';const r=riverPlay(observation,profile,chosen,table,touch);chosen=r.action;river=r.play??'-';}
     if(v110){const c=calibrationPlay(observation,profile,chosen,touch);chosen=c.action;calibration=c.play??'-';if(v111){const sd=showdownPlay(observation,profile,chosen,touch);chosen=sd.action;showdown=sd.play??'-';}if(v112){const l=leakPlay(observation,profile,chosen,leaksOf(profile,regularOfProfile(profile)),touch);chosen=l.action;leak=l.play??'-';const q=quirkPlay(observation,profile,chosen,touch);chosen=q.action;quirk=q.play??'-';if(v113){const x=exploitPlay(observation,profile,chosen,insight?.leaks,touch);chosen=x.action;exploit=x.play??'-';const st=steamPlay(observation,profile,chosen,v115&&a.lastOrbit?.[p.seatId]?.personalityId===profile.personalityId?Math.max(steam.level,.3):steam.level,touch);chosen=st.action;steamed=st.play??'-';if(v114){const dy=dynamicsPlay(observation,profile,chosen,table,touch);chosen=dy.action;dynamic=dy.play??'-';}if(v115){const sb=stabPlay(observation,profile,chosen,touch);chosen=sb.action;stab=sb.play??'-';}if(v116){const pp=passivePotPlay(observation,profile,chosen,touch);chosen=pp.action;passive=pp.play??'-';}if(v117){const sv=stationValuePlay(observation,profile,chosen,table,touch);chosen=sv.action;station=sv.play??'-';const bf=barrelFoldPlay(observation,profile,chosen,touch);chosen=bf.action;barrel=bf.play??'-';}if(v118){const mr=misreadPlay(observation,profile,chosen,touch);chosen=mr.action;misread=mr.play??'-';}if(v119){const craftPlays:string[]=[];for(const step of [(x:Action)=>blindDefensePlay(observation,profile,x,touch),(x:Action)=>multiwayPreflopPlay(observation,profile,x,touch),(x:Action)=>floatPlay(observation,profile,x,touch),(x:Action)=>floatBetPlay(observation,profile,x,touch),(x:Action)=>probePlay(observation,profile,x,touch),(x:Action)=>sizeReadPlay(observation,profile,x,sizeReads,touch)]){const c=step(chosen);chosen=c.action;if(c.play)craftPlays.push(c.play);}crafted=craftPlays.join('+')||'-';}if(v120){const tr=tempoReadPlay(observation,profile,chosen,tempoRead,touch);chosen=tr.action;tempoPlay=tr.play??'-';}if(v121){const rm=rememberPlay(observation,profile,chosen,memory?.river,touch);chosen=rm.action;memoryPlay=rm.play??'-';}}}beforeRivalry=chosen;const r=rivalryPlay(observation,profile,chosen,grudges,identity,touch);chosen=r.action;rivalry=r.play??'-';}
     if(v16){const m=multiwayPlay(observation,profile,chosen,touch);chosen=m.action;multiway=m.play??'-';const t=applySizingTell(observation,profile,chosen,touch,regularSizingForProfile(profile));chosen=t.action;tell=t.tell??'-';}
     p.decision={...decision,...(v14?{observationHash:decision.observationHash+(v121?':human-1.21.0:':v120?':human-1.20.0:':v119?':human-1.19.0:':v118?':human-1.18.0:':v117?':human-1.17.0:':v116?':human-1.16.0:':v115?':human-1.15.0:':v114?':human-1.14.0:':v113?':human-1.13.0:':v112?':human-1.12.0:':v111?':human-1.11.0:':v110?':human-1.10.0:':v19?':human-1.9.0:':v18?':human-1.8.0:':v17?':human-1.7.0:':v16?':human-1.6.0:':v15?':human-1.5.0:':':human-1.4.0:')+bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(table))))+(v16?':'+multiway+':'+tell:'')+(v17?':image:'+bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(images))))+':'+texture+':'+image:'')+(v18?':'+wars+':'+aggression:'')+(v19?':'+fight+':'+river:'')+(v110?':grudge:'+bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({grudges,identities:observation.seats.map(s=>[s.id,identity(s.id)]).sort((a,b)=>Number(a[0])-Number(b[0]))}))))+':'+calibration+':'+rivalry:'')+(v111?':showdown:'+showdown:'')+(v112?':leaks:'+leak+':quirks:'+quirk:'')+(v113?':insight:'+insightDigest(insight)+':exploit:'+exploit+':steam:'+steamed:'')+(v114?':dynamics:'+dynamic:'')+(v115?':stab:'+stab+':orbit:'+(a.lastOrbit?.[p.seatId]?.personalityId===profile.personalityId?'last':'-'):'')+(v116?':mood:'+cashSessionMood(a,p.seatId)+':passive:'+passive:'')+(v117?':station-value:'+station+':barrel:'+barrel:'')+(v118?':misread:'+misread:'')+(v119?':craft:'+crafted+':sizes:'+sizeReadsDigest(sizeReads):'')+(v120?':tempo:'+tempoPlay+':'+tempoDigest(tempoRead):'')+(v121?':memory:'+memoryPlay+':'+riverDigest(memory?.river)+':'+(memory?.together??0):'')}:{}),action:applyMinRaise(observation,humanSizing(observation,profile,chosen,touch,!v16),habits,touch).action};
     if(v110&&rivalry!=='-')p.decision.action=protectRivalryExposure(observation,p.decision.action,beforeRivalry);
     // Layer 1.15.0: a player on a break is dealt out of the action: check when possible, otherwise fold.
     if(v115&&cashBreak(d.hands,a,p.seatId,d.humanMemory).onBreak)p.decision={...p.decision,observationHash:p.decision.observationHash+':on-break',action:observation.legal.check?{type:'check'}:{type:'fold'}};
    }else p.decision={...decision,action:humanSizing(observation,profile,decision.action,touch)};
   }else p.decision=timed('bot.policy',()=>chooseDecision(observation,a.profiles[p.seatId],seeded(p.drawToken)));
  });
  });
 }
 async commitBot(handId:string,revision:number):Promise<void>{await this.mutate(async d=>{
  const a=d.active;requireData(a&&!a.paused&&a.game.handId===handId&&a.game.revision===revision,'Obsolete bot callback rejected.');
  const p=a.pending;requireData(p?.decision&&p.handId===handId&&p.revision===revision&&p.policyVersion===a.profiles[p.seatId]?.policyVersion,'Bot decision was not durably prepared.');
  const legal=legalActions(a.game),proposal=p.decision,action=proposal.action,unit=a.game.profile.chipUnit;
  const identity=proposal.handId===p.handId&&proposal.revision===p.revision&&proposal.seatId===p.seatId&&proposal.decisionId===p.decisionId&&proposal.policyVersion===p.policyVersion;
  const actionLegal=!!action&&(action.type==='fold'?legal.fold:action.type==='check'?legal.check:action.type==='call'?legal.callAmount>0:action.type==='raise'?legal.canRaise&&Number.isSafeInteger(action.to)&&action.to%unit===0&&action.to<=legal.maxRaiseTo!&&(action.to>=legal.minRaiseTo!||action.to===legal.shortAllInTo):false);
  const publicAction:Action|null=action?.type==='raise'?(Number.isSafeInteger(action.to)?{type:'raise',to:action.to}:null):action&&['fold','check','call'].includes(action.type)?{type:action.type as 'fold'|'check'|'call'}:null;
  let command={handId:p.handId,revision:p.revision,seatId:p.seatId,decisionId:p.decisionId,policyVersion:p.policyVersion,action:publicAction!};
  if(!identity||!actionLegal){
   const fallback:Action=legal.check?{type:'check'}:{type:'fold'};
   const violation={id:`violation:${p.decisionId}`,at:now(),handId:p.handId,revision:p.revision,seatId:p.seatId,policyVersion:p.policyVersion,proposedAction:publicAction,fallback,reason:!identity?'Invalid proposed action identity':'Proposed action rejected by legal bounds'};
   requireData(!d.policyViolations?.some(v=>v.id===violation.id),'Duplicate policy violation.');
   d.policyViolations=[...(d.policyViolations??[]),violation];
   command={handId:p.handId,revision:p.revision,seatId:p.seatId,decisionId:p.decisionId,policyVersion:p.policyVersion,action:fallback};
  }
  a.game=applyCommand(a.game,command);a.pending=null;a.frames.push(projectView(a.game,0));await this.advanceExit(d);await this.settle(d);
 });}
 private async settle(d:AppData):Promise<void>{
  const a=d.active;if(!a||a.game.street!=='complete')return;
  if(d.hands.some(h=>h.id===a.game.handId)){if(a.exitMode)await this.closeSession(d);return;}
  assertAccounting(a.game);const view=projectView(a.game,0);const hero=view.seats.find(s=>s.id===0)!;const net=hero.stack-hero.startingStack;const endedAt=now();
  const record:StoredHand={id:a.game.handId,sessionId:a.sessionId,epoch:d.sessions.find(s=>s.id===a.sessionId)!.epoch,number:a.number,startedAt:a.startedAt,endedAt,view,frames:structuredClone(a.frames),net,provenance:makeCashHandProvenance(view.profile),...(a.configuration?{configuration:structuredClone(a.configuration)}:{}),privateProfiles:structuredClone(a.profiles),previousHash:d.hands.at(-1)?.hash??GENESIS,hash:''};
  d.hands=[...d.hands,await seal(record)];if(d.humanMemory)d.humanMemory=appendHumanMemory(d.humanMemory,d.hands.at(-1)!);const session=d.sessions.find(s=>s.id===a.sessionId)!;session.handIds=[...session.handIds,record.id];a.pending=null;
  await appendMoney(d,{id:`settle:${record.id}`,kind:'hand-net',at:endedAt,epoch:record.epoch,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:a.sessionId,handId:record.id,note:'Settled hand net after rake; refunds included'});
  const tip=tokeFor(this.dealerTipPolicy,heroCollected(view),view.profile.bigBlind);
  if(tip)a.dealerTips={cents:(a.dealerTips?.cents??0)+tip,pots:(a.dealerTips?.pots??0)+1,lastHand:record.id,lastTip:tip};
  await this.payPromos(d,session.id);
  if(a.exitMode)await this.closeSession(d);
 }
 async savePlayerNote(sessionId:string,seatId:number,text:string,expectedNoteRevision=0):Promise<boolean>{
  if(this.busy||this.status!=='ready'||!this.data)return false;
  await this.mutate(async data=>{data.userNotes=savePlayerNote(data,sessionId,seatId,text,expectedNoteRevision);});
  return !this.error&&getPlayerNote(this.data,sessionId,seatId)?.text===text.trim();
 }
 async deletePlayerNote(sessionId:string,seatId:number,expectedNoteRevision:number):Promise<boolean>{
  if(this.busy||this.status!=='ready'||!this.data)return false;
  await this.mutate(async data=>{data.userNotes=deletePlayerNote(data,sessionId,seatId,expectedNoteRevision);});
  return !this.error&&!getPlayerNote(this.data,sessionId,seatId);
 }
 /** Export a bounded, independently verifiable public file without loading the archive.
  * The captured total permits a multi-file export of one immutable prefix while
  * later hands are appended. No financial writes, imports or settlements occur. */
 async exportHistoryBatch(startIndex=0,total=this.totalHandCount):Promise<PublicHistoryBatch>{
  requireData(this.data&&isVerifiedSnapshot(this.data)&&this.status!=='loading'&&this.status!=='deleted'&&!this.busy,'Wait until a verified saved session is available to export history.');
  const expected=this.data,offset=getArchiveContext(expected)?.handOffset??0;
  requireData(Number.isSafeInteger(total)&&total>=0&&total<=totalHandCount(expected),'The requested history prefix is no longer available. Prepare a new export.');
  this.busy=true;this.emit();
  try{
   const batch=await createPublicHistoryBatch(async index=>{
    requireData(this.data===expected,'Saved state changed during export. Prepare this file again.');
    // Even resident records pass the durable generation fence when supported:
    // another tab may have erased or replaced this account since it was loaded.
    if(this.port.readHand)return this.port.readHand(index);
    requireData(offset===0,'This storage environment cannot read archived hands individually.');
    const hand=expected.hands[index];requireData(hand,'Saved hand is unavailable.');return hand;
   },{startIndex,total});
   requireData(this.data===expected,'Saved state changed during export. Prepare this file again.');
   return batch;
  }finally{this.busy=false;this.lastTick=Date.now();this.emit();}
 }
 async exportHistory():Promise<PublicHistory>{requireData(this.data,'No saved history available.');const hands=await this.loadFullHistory();return publicHistory(hands);}
 async importHistory(text:string):Promise<void>{await this.mutate(async d=>{
  const imported=await parsePublicHistory(text);const known=new Set(d.importedHands.map(h=>h.handId));
  d.importedHands=[...d.importedHands,...imported.filter(h=>!known.has(h.handId))];
 });}
 async importSelectedStudyHands(preview:StudyImportPreview,indices:readonly number[]):Promise<void>{await this.mutate(async d=>{
  const selected=selectPublicStudyRows(preview,indices),known=new Map(d.importedHands.map(h=>[h.handId,h]));
  for(const hand of selected){const prior=known.get(hand.handId);requireData(!prior||canonical(prior)===canonical(hand),'A different imported record already uses this hand identity. No records were replaced.');known.set(hand.handId,hand);}
  const existing=new Set(d.importedHands.map(h=>h.handId));d.importedHands=[...d.importedHands,...selected.filter(h=>!existing.has(h.handId))];
 });}
 async deleteSavedPracticeData(confirmation:string):Promise<void>{
  if(this.busy)return;this.busy=true;this.error='';this.emit();
  try{requireData(confirmation===DELETE_PRACTICE_CONFIRMATION,'Type the exact deletion confirmation.');requireData(this.status==='ready'&&this.data&&this.owns(),'An owned ready save is required for deletion.');requireData(this.data.active===null,'End and cash out the table before deleting saved practice data.');requireData(this.port.erase,'This storage environment does not support safe deletion.');await this.port.erase(this.data.revision);this.clearDeletedState();}
  catch(e){this.error=(e as Error).message;if(this.port.deleted||e instanceof PracticeDataDeletedError)this.clearDeletedState();}
  finally{this.busy=false;this.emit();}
 }
 private async payPromos(d:AppData,sessionId:string):Promise<void>{
  for(const c of promoCredits(d,sessionId,true))await appendMoney(d,{id:c.id,kind:'adjustment',at:now(),epoch:d.epoch,walletDelta:c.cents,tableDelta:0,pokerNet:0,sessionId,note:c.note.slice(0,200)});
 }
 /** Patch 69: everything needed to rebuild this cash save elsewhere: the verified save with its full hand history.
  * Read only. Refused with a table open, so the copy never holds chips in play. */
 async backupData():Promise<AppData>{
  requireData(this.data&&this.status==='ready'&&!this.busy&&isVerifiedSnapshot(this.data),'Wait until your saved session is verified before backing up.');
  requireData(this.data.active===null,'Cash out your table before backing up.');
  const hands=await this.loadFullHistory();return structuredClone({...this.data,hands:[...hands]});
 }
 /** Patch 69: after deleting saved practice data, start from a backup instead. The backup must pass the full
  * saved-data audit; the write is the same atomic fresh-start path. */
 async restoreBackup(data:AppData,confirmation?:string):Promise<void>{
  if(this.busy)throw Error('Cash storage is busy.');this.busy=true;this.error='';this.emit();
  try{const replacing=confirmation==='REPLACE'&&this.status==='ready'&&this.data?.active===null&&this.owns();
   requireData((this.status==='deleted'||replacing)&&this.port.restoreFresh,'Delete saved practice data on this device before restoring a backup.');await this.port.restoreFresh(structuredClone(data),replacing?this.data!.revision:undefined);this.data=null;this.failed=null;this.busy=false;await this.init();}
  catch(e){this.error=(e as Error).message;}
  finally{this.busy=false;this.emit();}
 }
 async startFreshPracticeData():Promise<void>{
  if(this.busy)return;this.busy=true;this.error='';this.emit();
  try{requireData(this.status==='deleted'&&this.port.startFresh,'Delete saved practice data before explicitly starting fresh.');await this.port.startFresh(await this.initialGuestData());this.data=null;this.failed=null;this.busy=false;await this.init();}
  catch(e){this.error=(e as Error).message;}
  finally{this.busy=false;this.emit();}
 }
 async protectStorage():Promise<boolean>{return this.port instanceof BrowserPersistence?this.port.requestProtection():false;}
}
