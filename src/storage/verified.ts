import {assertHumanMemory,appendHumanMemory,catchUpHumanMemory} from '../session/human-memory';
import type {AppData,MoneyEvent,StoredHand} from '../session/types';
import {assertAccounting} from '../core/engine';
import {addSessionMoney,emptySessionMoney,validateMoneyEvent,validateSessionMoney,validatePolicyViolations,validateImportedRecords,assertLatestPublicFrame,type SessionMoney,canonical,cents,digest,GENESIS,requireData,validateData} from './integrity';
import {validateConfigurationData} from '../session/configuration';
import {timedAsync,timed} from '../performance/timing';
import {assertCashHandProvenance,ruleProfileFingerprint} from '../session/hand-provenance';
import {validateUserNotes} from '../session/notes';
import {validateConfigurationHistory} from '../session/configuration-history';
import {assertSupportedCashScope} from '../session/release-scope';
import {recoveryScheduler} from './recovery-scheduler';
import {isPackedImmutableNode} from './packed-hand';
import type {CompactArchiveContext,CompactSnapshot,HandFinancialIndex} from './recovery-contracts';
import {CashStatsProjection} from '../stats/projection';
import {frozenPolicyVersions} from '../stats/cash';
import {supportedPolicy} from '../bots/policy';
import {preparePublicMemoryCheckpoint,validatePublicMemoryCheckpoint} from '../session/bot-observation';
import {hasVerifiedRecoveryEnvelope} from './financial-checkpoint';
type FinancialHand=Readonly<Pick<StoredHand,'id'|'sessionId'|'net'>>;
interface Checkpoint { wallet:number;table:number;ledgerIds:Set<string>;hands:Map<string,FinancialHand>;settlements:Map<string,MoneyEvent>;sessionHands:Map<string,string[]>;financialSessions:Map<string,SessionMoney> }
const verifiedHistories=new WeakSet<StoredHand[]>();
const checkpoints=new WeakMap<AppData,Checkpoint>(),frozen=new WeakSet<object>();
const archiveContexts=new WeakMap<AppData,CompactArchiveContext>();
const compactSnapshots=new WeakMap<AppData,CompactSnapshot>();
/** Read-only metadata from this module's audited capability, never a caller flag. */
export function getArchiveContext(data:AppData):CompactArchiveContext|undefined{return archiveContexts.get(data);}
export function totalHandCount(data:AppData):number{return archiveContexts.get(data)?.handIndex.length??data.hands.length;}
/** A private provenance set, not Object.isFrozen or a caller-provided hash, establishes trust.
 * Cache completed roots and structural sharing boundaries (snapshot collections
 * and their records, or transport values). Historical frame/card descendants are
 * still recursively checked and frozen, but not all retained as WeakSet entries:
 * V8 kept a128MiB backing table after a10k-hand graph had otherwise been collected.
 * A cached boundary is added only AFTER its complete descendant walk succeeds. */
export function freezeSnapshot<T>(value:T):T {
 if(!value||typeof value!=='object'||frozen.has(value)||isPackedImmutableNode(value))return value;
 // Call-local memoization keeps shared DAGs linear; its table dies with this walk.
 const visited=new Set<object>();
 function visit(node:unknown,depth:number):void {
  if(!node||typeof node!=='object'||visited.has(node)||frozen.has(node)||isPackedImmutableNode(node))return;
  for(const key of Reflect.ownKeys(node)){const descriptor=Object.getOwnPropertyDescriptor(node,key)!;requireData(!descriptor.get&&!descriptor.set,'Saved data cannot contain accessors.');if('value'in descriptor)visit(descriptor.value,depth+1);}
  Object.freeze(node);visited.add(node);if(depth<=2)frozen.add(node);
 }
 visit(value,0);return value;
}
export function isVerifiedHistory(hands:readonly StoredHand[]):boolean{return verifiedHistories.has(hands as StoredHand[]);}
export function isVerifiedSnapshot(data:AppData):boolean{return checkpoints.has(data);}
/** TypeScript Pick does not remove runtime fields. Keep financial identity only,
 * so a promoted compact snapshot cannot retain archived cards/frames via its
 * private checkpoint. Callers have already frozen and verified the source. */
const financialHand=(hand:FinancialHand):FinancialHand=>Object.freeze({id:hand.id,sessionId:hand.sessionId,net:hand.net});
function index(data:AppData,handIndex:readonly Pick<StoredHand,'id'|'sessionId'|'net'>[]=data.hands):Checkpoint {
 const result:Checkpoint={wallet:0,table:0,ledgerIds:new Set(),hands:new Map(),settlements:new Map(),sessionHands:new Map(),financialSessions:new Map()};
 for(const e of data.ledger){result.wallet+=e.walletDelta;result.table+=e.tableDelta;result.ledgerIds.add(e.id);if(e.kind==='hand-net')result.settlements.set(e.handId!,e);if(e.sessionId&&e.kind!=='adjustment'&&e.kind!=='reset')result.financialSessions.set(e.sessionId,addSessionMoney(result.financialSessions.get(e.sessionId)??emptySessionMoney(),e));}
 for(const h of handIndex){result.hands.set(h.id,financialHand(h));const ids=result.sessionHands.get(h.sessionId)??[];ids.push(h.id);result.sessionHands.set(h.sessionId,ids);}
 return result;
}
/** Always replay canonical records at an external trust boundary, even when previously branded. */
export async function auditSnapshot(data:AppData):Promise<AppData>{return audit(data,false);}
/** Normal storage restore may reuse only inner hashes freshly executed against
 * privately immutable decoded records; explicit independent audits never do. */
export async function auditRestoredSnapshot(data:AppData):Promise<AppData>{return audit(data,true);}
async function audit(data:AppData,reusePackedHandHashes:boolean):Promise<AppData>{
 requireData(!archiveContexts.get(data)?.handOffset,'A complete historical audit requires the canonical archive, not a compact resident tail.');
 await timedAsync('recovery.freeze',async()=>{
  const cooperate=recoveryScheduler();
  // Inspect descriptors before reading collection members: even an already
  // frozen caller object or an array index can contain an executable accessor.
  if(data&&typeof data==='object')for(const key of ['ledger','hands','sessions','importedHands']){
   const descriptor=Object.getOwnPropertyDescriptor(data,key);requireData(!descriptor?.get&&!descriptor?.set,'Saved data cannot contain accessors.');const list=descriptor?.value;
   if(Array.isArray(list))for(let i=0;i<list.length;i++){
    const item=Object.getOwnPropertyDescriptor(list,String(i));requireData(!item?.get&&!item?.set,'Saved data cannot contain accessors.');freezeSnapshot(item?.value);await cooperate();
   }
  }
  freezeSnapshot(data);
 });await timedAsync('integrity.fullAudit',()=>validateData(data,{reusePackedHandHashes}));const cp=index(data);checkSessions(data,cp);checkpoints.set(data,cp);verifiedHistories.add(data.hands);return data;
}
async function handDescriptor(hand:StoredHand):Promise<HandFinancialIndex>{
 return {id:hand.id,sessionId:hand.sessionId,epoch:hand.epoch,number:hand.number,startedAt:hand.startedAt,endedAt:hand.endedAt,net:hand.net,hash:hand.hash,previousHash:hand.previousHash,
  viewHash:await digest(hand.view),seats:hand.view.seats.map(seat=>seat.id).sort((a,b)=>a-b),policyVersions:frozenPolicyVersions(hand.privateProfiles),
  rules:{id:hand.view.profile.id,version:hand.view.profile.version,fingerprint:ruleProfileFingerprint(hand.view.profile)},configurationId:hand.configuration?.id??null};
}
const binding=(entries:readonly HandFinancialIndex[],count:number)=>({hands:count,lastId:entries[count-1]?.id??null,lastHash:entries[count-1]?.hash??null});
/** Promote only an already verified in-process state. This never manufactures
 * money, changes an engine state, deletes history, or trusts an imported summary. */
export async function prepareCompactSnapshot(data:AppData):Promise<CompactSnapshot>{
 requireData(isVerifiedSnapshot(data),'Recovery checkpoint promotion requires verified financial state.');
 const cached=compactSnapshots.get(data);if(cached)return cached;
 return timedAsync('recovery.prepareCheckpoint',async()=>{
  let context=archiveContexts.get(data);
  if(!context){
   const handIndex:HandFinancialIndex[]=[],cooperate=recoveryScheduler();
   for(const hand of data.hands){handIndex.push(await handDescriptor(hand));await cooperate();}
   const projection=await CashStatsProjection.prewarm(data.hands);
   context={format:'ai-texas-compact-financial',version:1,handOffset:0,handIndex,statistics:projection.exportCheckpoint(),statisticsHands:handIndex.length,
    botMemory:preparePublicMemoryCheckpoint(data.hands,data.active?.sessionId??null)};
  }else{
   let statistics=context.statistics;
   if(context.statisticsHands!==context.handIndex.length){
    requireData(context.statisticsHands>=context.handOffset,'Checkpoint statistics tail is not resident.');
    const projection=CashStatsProjection.restoreCheckpoint(statistics,binding(context.handIndex,context.statisticsHands));
    projection.appendVerifiedTail(data.hands.slice(context.statisticsHands-context.handOffset),data.sessions);
    statistics=projection.exportCheckpoint();
   }
   const last=context.handIndex.at(-1),old=context.botMemory;
   const botMemory=old.activeSessionId===(data.active?.sessionId??null)&&old.processedLastHandId===(last?.id??null)&&old.processedLastHandHash===(last?.hash??GENESIS)?old:
    preparePublicMemoryCheckpoint(data.hands,data.active?.sessionId??null,old);
   context={...context,statistics,statisticsHands:context.handIndex.length,botMemory};
  }
  freezeSnapshot(context);archiveContexts.set(data,context);
  const hands=data.hands.slice(-120),compactContext=freezeSnapshot({...context,handOffset:context.handIndex.length-hands.length});
  const compactData=freezeSnapshot({...data,hands});
  archiveContexts.set(compactData,compactContext);checkpoints.set(compactData,checkpoints.get(data)!);verifiedHistories.add(hands);
  const result={data:compactData,context:compactContext};compactSnapshots.set(data,result);compactSnapshots.set(compactData,result);return result;
 });
}
/** Executed after the durable envelope/journal is verified and pinned to the
 * canonical manifest. Replay EVERY financial event independently of the saved
 * balances, and validate the bounded real hand tail. Archived hand bodies are
 * explicitly not audited by this operation; full canonical audit remains separate. */
export async function auditCompactSnapshot(data:AppData,context:CompactArchiveContext):Promise<AppData>{
 requireData(hasVerifiedRecoveryEnvelope(data,context),'Compact recovery requires privately verified durable checkpoint/journal provenance.');
 return timedAsync('recovery.verifyFinancialCheckpoint',async()=>{
  freezeSnapshot(data);freezeSnapshot(context);
  assertHumanMemory(data.humanMemory,data.hands,context.handOffset);
  requireData(data?.schemaVersion===4&&cents(data.revision)&&cents(data.epoch)&&cents(data.wallet)&&cents(data.initialBankroll),'Invalid financial checkpoint header.');
  requireData(Array.isArray(data.ledger)&&Array.isArray(data.hands)&&Array.isArray(data.sessions)&&Array.isArray(data.importedHands),'Incomplete financial checkpoint.');
  requireData(context?.format==='ai-texas-compact-financial'&&context.version===1&&Array.isArray(context.handIndex)&&cents(context.handOffset)&&context.handOffset+data.hands.length===context.handIndex.length&&data.hands.length<=120,'Financial checkpoint history boundary differs.');
  requireData(cents(context.statisticsHands)&&context.statisticsHands<=context.handIndex.length&&context.statisticsHands>=context.handOffset,'Invalid statistics checkpoint boundary.');
  const cp:Checkpoint={wallet:0,table:0,ledgerIds:new Set(),hands:new Map(),settlements:new Map(),sessionHands:new Map(),financialSessions:new Map()};
  const cooperate=recoveryScheduler();let previous=GENESIS;
  for(let i=0;i<data.ledger.length;i++){
   const event=data.ledger[i],{hash,...body}=event;
   requireData(event.previousHash===previous&&hash===await digest(body),'Financial checkpoint event hash/sequence differs.');previous=hash;
   requireData(typeof event.id==='string'&&event.id.length>0&&!cp.ledgerIds.has(event.id),'Duplicate financial checkpoint event.');cp.ledgerIds.add(event.id);validateMoneyEvent(event,i);
   if(event.kind==='hand-net'){requireData(!cp.settlements.has(event.handId!),'Duplicate financial checkpoint payout.');cp.settlements.set(event.handId!,event);}
   if(event.sessionId&&event.kind!=='adjustment'&&event.kind!=='reset')cp.financialSessions.set(event.sessionId,addSessionMoney(cp.financialSessions.get(event.sessionId)??emptySessionMoney(),event));
   cp.wallet+=event.walletDelta;cp.table+=event.tableDelta;requireData(cents(cp.wallet)&&cents(cp.table),'Financial checkpoint has negative or unsafe funds.');await cooperate();
  }
  requireData(cp.wallet===data.wallet,'Financial checkpoint wallet differs from independent ledger replay.');
  previous=GENESIS;const sessions=new Map(data.sessions.map(session=>[session.id,session])),numbers=new Map<string,number>();
  const hashValue=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
  for(const hand of context.handIndex){
   requireData(hand&&typeof hand.id==='string'&&hand.id.length>0&&!cp.hands.has(hand.id)&&typeof hand.sessionId==='string','Invalid or duplicate financial hand identity.');
   requireData(hashValue(hand.hash)&&hashValue(hand.viewHash)&&hand.previousHash===previous,'Financial hand index is missing or reordered.');previous=hand.hash;
   requireData(cents(hand.epoch)&&hand.epoch===sessions.get(hand.sessionId)?.epoch&&hand.number===(numbers.get(hand.sessionId)??0)+1&&Number.isSafeInteger(hand.net),'Financial hand index session/sequence differs.');numbers.set(hand.sessionId,hand.number);
   requireData(typeof hand.startedAt==='string'&&typeof hand.endedAt==='string'&&Number.isFinite(Date.parse(hand.startedAt))&&Number.isFinite(Date.parse(hand.endedAt))&&Date.parse(hand.endedAt)>=Date.parse(hand.startedAt),'Invalid financial hand timestamps.');
   requireData(Array.isArray(hand.seats)&&hand.seats.length>=2&&hand.seats.length<=10&&hand.seats[0]===0&&hand.seats.every((seat,i)=>cents(seat)&&seat<=9&&(i===0||seat>hand.seats[i-1])),'Invalid financial hand seats.');
   requireData(Array.isArray(hand.policyVersions)&&hand.policyVersions.every((version,i)=>supportedPolicy(version)&&(i===0||version>hand.policyVersions[i-1])),'Unsupported historical policy provenance.');
   requireData(hand.rules&&typeof hand.rules.id==='string'&&hand.rules.id.length>0&&typeof hand.rules.version==='string'&&hand.rules.version.length>0&&hashValue(hand.rules.fingerprint),'Invalid financial rules provenance.');
   const expected=sessions.get(hand.sessionId)?.configurationHistory?.filter(entry=>entry.effectiveHandNumber<=hand.number).at(-1);
   requireData(hand.configurationId===(expected?.id??null)&&(!expected||expected.rules.fingerprint===hand.rules.fingerprint&&canonical(expected.occupiedSeatIds)===canonical(hand.seats)&&canonical(expected.policyVersions)===canonical(hand.policyVersions)),'Financial index configuration provenance differs.');
   const event=cp.settlements.get(hand.id);requireData(event?.pokerNet===hand.net&&event.sessionId===hand.sessionId&&event.epoch===hand.epoch,'Financial index settlement differs.');
   cp.hands.set(hand.id,financialHand(hand));const ids=cp.sessionHands.get(hand.sessionId)??[];ids.push(hand.id);cp.sessionHands.set(hand.sessionId,ids);await cooperate();
  }
  requireData(cp.hands.size===cp.settlements.size,'Financial checkpoint settlement/history count differs.');
  for(let i=0;i<data.hands.length;i++){
   const hand=data.hands[i],{hash,...body}=hand,entry=context.handIndex[context.handOffset+i];
   requireData(hash===await digest(body)&&canonical(await handDescriptor(hand))===canonical(entry),'Resident hand differs from verified financial index.');
   assertCashHandProvenance(hand);const hero=hand.view.seats.find(seat=>seat.id===0);
   requireData(hand.view.street==='complete'&&hero&&hand.net===hero.stack-hero.startingStack,'Invalid resident completed hand.');await cooperate();
  }
  checkSessions(data,cp);validateConfigurationData(data);validatePolicyViolations(data);validateUserNotes(data,undefined,context.handIndex);activeIntegrity(data,cp);validateConfigurationHistory(data);
  await validateImportedRecords(data.importedHands);
  validatePublicMemoryCheckpoint(context.botMemory,context.handIndex,data.active?.sessionId??null);
  const projection=CashStatsProjection.restoreCheckpoint(context.statistics,binding(context.handIndex,context.statisticsHands));
  requireData(context.statistics.handIds.every((id,i)=>id===context.handIndex[i]?.id),'Statistics checkpoint hand sequence differs from the financial index.');
  // These are cryptographically checked canonical records. The statistics API
  // also verifies hand sequence/provenance before applying the appended tail.
  verifiedHistories.add(data.hands);
  const stats=projection.appendVerifiedTail(data.hands.slice(context.statisticsHands-context.handOffset),data.sessions,0);
  requireData(stats.hands===context.handIndex.length&&stats.profit===[...cp.settlements.values()].reduce((sum,event)=>sum+event.pokerNet,0),'Statistics checkpoint differs from financial replay.');
  for(const session of stats.sessions)requireData(session.profit===(cp.financialSessions.get(session.id)?.net??0)&&session.hands===(cp.sessionHands.get(session.id)?.length??0),'Session statistics differ from financial replay.');
  archiveContexts.set(data,context);checkpoints.set(data,cp);return data;
 });
}
function orderedPrefix<T>(prior:readonly T[],next:readonly T[],kind:string):void {
 if(prior===next)return;
 requireData(next.length>=prior.length,`${kind} checkpoint lost records.`);
 for(let i=0;i<prior.length;i++)requireData(prior[i]===next[i],`${kind} checkpoint prefix was replaced or reordered.`);
}
function checkSessions(data:AppData,cp:Checkpoint,prior?:AppData):void {
 const ids=new Set<string>();
 for(let i=0;i<data.sessions.length;i++){
  const s=data.sessions[i];requireData(!ids.has(s.id),'Duplicate session.');ids.add(s.id);
  if(prior?.sessions[i]===s)continue;
  validateSessionMoney(s,cp.financialSessions.get(s.id)??emptySessionMoney());
  requireData(cents(s.activeMs)&&cents(s.buyIns)&&cents(s.cashOut),'Invalid session totals.');
  const priorSession=prior?.sessions[i],priorIndex=prior?checkpoints.get(prior):undefined;
  if(s.handIds!==priorSession?.handIds||cp.sessionHands.get(s.id)!==priorIndex?.sessionHands.get(s.id))requireData(canonical(s.handIds)===canonical(cp.sessionHands.get(s.id)??[]),'Session hand identities do not reconcile.');
 }
 requireData([...cp.sessionHands.keys(),...cp.financialSessions.keys()].every(id=>ids.has(id)),'Hand or financial event references missing session.');
}
function activeIntegrity(data:AppData,cp:Checkpoint):void {
 if(!data.active){requireData(cp.table===0,'Unseated table funds remain.');return;}
 const active=data.active;assertAccounting(active.game);assertSupportedCashScope(active.game.profile);
 requireData(active.exitMode===null||active.exitMode==='finish'||active.exitMode==='fold','Invalid saved session exit intent.');
 requireData(data.sessions.some(s=>s.id===active.sessionId&&s.endedAt===null),'Active session missing.');
 const hero=active.game.seats.find(s=>s.id===0);requireData(hero,'Hero seat missing.');
 requireData(cp.table===hero.stack+(active.game.street==='complete'?0:hero.totalCommitted),'Seated chips do not reconcile to ledger.');
 assertLatestPublicFrame(data);
 if(active.pending)requireData(active.pending.handId===active.game.handId&&active.pending.revision===active.game.revision&&active.pending.seatId===active.game.actor,'Obsolete pending decision.');
}
/** Compare immutable provenance/ordered prefixes, verify every appended byte, replay every new
 * financial event, and reconcile the active engine on every transition. No persisted checksum
 * can grant this capability: all restored/imported snapshots must first pass auditSnapshot. */
export async function verifyTransition(prior:AppData|null,next:AppData):Promise<AppData>{
 if(!prior||!checkpoints.has(prior))return auditSnapshot(next);
 return timedAsync('integrity.incremental',async()=>{
  freezeSnapshot(next);
  requireData(next.schemaVersion===4&&next.revision===prior.revision+1&&cents(next.epoch)&&cents(next.wallet),'Invalid checkpoint revision or header.');
  orderedPrefix(prior.ledger,next.ledger,'Financial');orderedPrefix(prior.hands,next.hands,'Hand');orderedPrefix(prior.importedHands,next.importedHands,'Imported hand');orderedPrefix(prior.policyViolations??[],next.policyViolations??[],'Policy violation');
  requireData(next.sessions.length>=prior.sessions.length,'Session checkpoint lost records.');
  for(let i=0;i<prior.sessions.length;i++)requireData(prior.sessions[i].id===next.sessions[i].id&&(!prior.sessions[i].endedAt||prior.sessions[i]===next.sessions[i]),'Closed session checkpoint changed.');
  const old=checkpoints.get(prior)!,ledgerChanged=next.ledger.length!==prior.ledger.length,handsChanged=next.hands.length!==prior.hands.length;
  const cp:Checkpoint={...old,ledgerIds:ledgerChanged?new Set(old.ledgerIds):old.ledgerIds,settlements:ledgerChanged?new Map(old.settlements):old.settlements,hands:handsChanged?new Map(old.hands):old.hands,sessionHands:handsChanged?new Map(old.sessionHands):old.sessionHands,financialSessions:ledgerChanged?new Map(old.financialSessions):old.financialSessions};
  let previous=prior.ledger.at(-1)?.hash??GENESIS;
  for(let i=prior.ledger.length;i<next.ledger.length;i++){
   const e=next.ledger[i],{hash,...body}=e;requireData(e.previousHash===previous&&hash===await digest(body),'Saved financial record integrity check failed.');previous=hash;
   requireData(!cp.ledgerIds.has(e.id),'Duplicate financial event.');cp.ledgerIds.add(e.id);
   validateMoneyEvent(e,i);
   if(e.kind==='hand-net'){requireData(!cp.settlements.has(e.handId!),'Duplicate settlement ledger.');cp.settlements.set(e.handId!,e);}
   if(e.sessionId&&e.kind!=='adjustment'&&e.kind!=='reset')cp.financialSessions.set(e.sessionId,addSessionMoney(cp.financialSessions.get(e.sessionId)??emptySessionMoney(),e));
   cp.wallet+=e.walletDelta;cp.table+=e.tableDelta;requireData(cents(cp.wallet)&&cents(cp.table),'Negative or unsafe account balance.');
  }
  requireData(cp.wallet===next.wallet,'Wallet does not reconcile to ledger.');previous=prior.hands.at(-1)?.hash??GENESIS;
  for(let i=prior.hands.length;i<next.hands.length;i++){
   const h=next.hands[i],{hash,...body}=h;requireData(h.previousHash===previous&&hash===await digest(body),'Saved hand integrity check failed.');previous=hash;
   assertCashHandProvenance(h);
   requireData(!cp.hands.has(h.id),'Duplicate settled hand.');cp.hands.set(h.id,financialHand(h));
   const hero=h.view.seats.find(s=>s.id===0),entry=cp.settlements.get(h.id);
   requireData(hero&&h.view.street==='complete'&&h.net===hero.stack-hero.startingStack,'Invalid completed hand.');
   requireData(entry?.pokerNet===h.net&&entry.sessionId===h.sessionId,'Hand result does not reconcile.');
   cp.sessionHands.set(h.sessionId,[...(cp.sessionHands.get(h.sessionId)??[]),h.id]);
  }
  if(next.importedHands.length>prior.importedHands.length)await validateImportedRecords(next.importedHands,prior.importedHands.length);
  const oldContext=archiveContexts.get(prior);
  if(oldContext){
   const appended:HandFinancialIndex[]=[];for(let i=prior.hands.length;i<next.hands.length;i++)appended.push(await handDescriptor(next.hands[i]));
   const context=freezeSnapshot({...oldContext,handIndex:appended.length?[...oldContext.handIndex,...appended]:oldContext.handIndex});archiveContexts.set(next,context);
  }
  if(prior.humanMemory){let expected=catchUpHumanMemory(prior.humanMemory,prior.hands,oldContext?.handOffset??0);for(const hand of next.hands.slice(prior.hands.length))expected=appendHumanMemory(expected,hand);
   requireData(next.humanMemory===expected||JSON.stringify(next.humanMemory)===JSON.stringify(expected),'Public opponent memory changed without a settled hand');
  }else if(next.humanMemory)assertHumanMemory(next.humanMemory,next.hands,oldContext?.handOffset??0);
  requireData(cp.settlements.size===cp.hands.size,'Settlement/history count mismatch.');checkSessions(next,cp,prior);validateConfigurationData(next,prior);validatePolicyViolations(next,prior);validateUserNotes(next,prior);activeIntegrity(next,cp);validateConfigurationHistory(next,prior);checkpoints.set(next,cp);verifiedHistories.add(next.hands);return next;
 });
}
/** Only the active header and open session counters can change. Engine APIs return new game states; canonical frame prefixes, profiles, settings and hand-ID arrays are shared until replaced. Frozen history arrays retain identity
 * until an append; append operations replace arrays explicitly. Unknown additive root fields
 * are cloned so future configuration helpers never receive aliases to committed objects. */
export function draftSnapshot(prior:AppData):AppData {
 requireData(checkpoints.has(prior),'A full audit is required before a mutable draft.');
 return timed('snapshot.draft',()=>{
  const {hands,ledger,sessions,importedHands,namedPresets,policyViolations,userNotes,humanMemory,active,...header}=prior;
  const draft={...structuredClone(header),...(namedPresets?{namedPresets}:{}),...(policyViolations?{policyViolations}:{}),...(userNotes?{userNotes}:{}),...(humanMemory?{humanMemory:catchUpHumanMemory(humanMemory,hands,archiveContexts.get(prior)?.handOffset??0)}:{}),hands,ledger,importedHands,sessions:sessions.map(s=>s.endedAt?s:{...s}),active:active?{...active,frames:active.frames.slice(),pending:active.pending?structuredClone(active.pending):null}:null};
  const context=archiveContexts.get(prior);if(context)archiveContexts.set(draft,context);return draft;
 });
}
