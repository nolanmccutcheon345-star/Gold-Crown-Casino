import type {AppData,CashSession,MoneyEvent,PublicHand,StoredHand} from '../session/types';
import {canonical,digest,requireData} from './integrity';
import type {SegmentedEnvelope} from './segments';
import {recoveryScheduler} from './recovery-scheduler';
import {freezeSnapshot} from './verified';

/** Internal acceleration records only. Canonical v2 rows remain the rollback and
 * independent-audit source. Hashes detect accidental corruption, not an attacker
 * who can replace every local record and recompute its hashes. */
export const FAST_HEAD_KEY='recovery-v1:head';
export const FAST_PREVIOUS_KEY='recovery-v1:previous';
export const FAST_INSTALL_BACKUP_KEY='recovery-v1:pre-install';
export const CHECKPOINT_INTERVAL=64;
export const RECENT_HAND_LIMIT=120;
export const checkpointKey=(revision:number,checksum:string)=>`recovery-v1:checkpoint:${revision}:${checksum}`;
export const journalKey=(checkpointHash:string,sequence:number)=>`recovery-v1:journal:${checkpointHash}:${String(sequence).padStart(8,'0')}`;
type Header=Omit<AppData,'ledger'|'hands'|'sessions'|'importedHands'>;
export interface CompactPayload<C> {data:AppData;context:C}
export interface CompactHooks<C,D> {
 compact(data:AppData):Promise<CompactPayload<C>>;
 audit(data:AppData,context:C):Promise<AppData>;
 contextDelta(before:C,after:C):D;
 applyContext(before:C,delta:D):C;
}
export interface FinancialCheckpoint<C> {
 format:'ai-texas-financial-checkpoint';version:1;revision:number;
 canonicalChecksum:string;canonicalHands:number;payload:CompactPayload<C>;checksum:string;
}
export interface RecoveryHead {
 format:'ai-texas-recovery-head';version:1;revision:number;canonicalChecksum:string;
 checkpointKey:string;checkpointHash:string;checkpointRevision:number;
 sequence:number;tail:string;canonicalHands:number;checksum:string;
}
export interface JournalDelta<D> {
 header:Header;ledgerOffset:number;ledger:MoneyEvent[];handOffset:number;hands:StoredHand[];
 importedOffset:number;importedHands:PublicHand[];sessionCount:number;sessions:Array<{index:number;value:CashSession}>;
 context:D;
}
export interface RecoveryJournal<D> {
 format:'ai-texas-recovery-journal';version:1;id:string;sequence:number;revision:number;
 previousRevision:number;previousHash:string;canonicalChecksum:string;canonicalHands:number;
 delta:JournalDelta<D>;checksum:string;
}
export interface FastState<C> {head:RecoveryHead;payload:CompactPayload<C>}
export interface FastPrepared<C> {state:FastState<C>;writes:Array<{key:string;value:unknown}>;checkpoint:boolean}
const hashShape=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const ordinal=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const verifiedEnvelopes=new WeakMap<AppData,unknown>();
/** Private identity proof is granted only after this module verifies a durable
 * checkpoint and every journal link. Frozen caller objects cannot grant it. */
export function hasVerifiedRecoveryEnvelope(data:AppData,context:unknown):boolean{return verifiedEnvelopes.get(data)===context;}
async function checkHash(record:{checksum:string}):Promise<void>{const {checksum,...body}=record;requireData(hashShape(checksum)&&checksum===await digest(body),'Recovery record checksum differs. Original saved data was preserved.');}
/** Compact only superseded acceleration generations. Canonical v2 rows are
 * never returned. Malformed/untrusted retirement metadata is preserved. */
export async function obsoleteRecoveryKeys(raw:unknown,protectedCheckpointKeys:readonly string[]):Promise<string[]>{
 const head=raw as RecoveryHead|undefined;
 if(!head||head.format!=='ai-texas-recovery-head'||head.version!==1||!ordinal(head.checkpointRevision)||!ordinal(head.sequence)||head.sequence>=CHECKPOINT_INTERVAL||!hashShape(head.checkpointHash)||head.checkpointKey!==checkpointKey(head.checkpointRevision,head.checkpointHash)||protectedCheckpointKeys.includes(head.checkpointKey))return [];
 try{await checkHash(head);}catch{return [];}
 return [head.checkpointKey,...Array.from({length:head.sequence},(_,i)=>journalKey(head.checkpointHash,i+1))];
}
function header(data:AppData):Header {const value={...data} as Partial<AppData>;delete value.ledger;delete value.hands;delete value.sessions;delete value.importedHands;return value as Header;}
function assertManifestBinding(head:RecoveryHead,manifest:SegmentedEnvelope):void {
 requireData(head.revision===manifest.data.revision&&head.canonicalChecksum===manifest.checksum&&head.canonicalHands===manifest.segments.hands.count,'Recovery checkpoint is stale relative to canonical storage.');
}
function assertCurrentDataBinding(data:AppData,manifest:SegmentedEnvelope):void {
 const open=data.sessions.filter(session=>session.endedAt===null),closed=data.sessions.length-open.length;
 requireData(open.length<=1&&(!open.length||data.sessions.at(-1)===open[0]),'Recovery current session ordering differs.');
 requireData(canonical({...header(data),openSession:open[0]??null})===canonical(manifest.data),'Recovery active/financial header differs from the canonical committed state.');
 requireData(data.ledger.length===manifest.segments.ledger.count&&data.importedHands.length===manifest.segments.importedHands.count&&closed===manifest.segments.closedSessions.count,'Recovery financial/archive counts differ from canonical storage.');
}
export function fastHeadMatches(raw:unknown,manifest:SegmentedEnvelope):boolean {
 const head=raw as Partial<RecoveryHead>|null;
 return !!head&&head.format==='ai-texas-recovery-head'&&head.version===1&&head.revision===manifest.data.revision&&head.canonicalChecksum===manifest.checksum;
}
export async function validateRecoveryHead(raw:unknown,manifest:SegmentedEnvelope):Promise<RecoveryHead>{
 const head=freezeSnapshot(raw) as RecoveryHead;
 requireData(head&&head.format==='ai-texas-recovery-head'&&head.version===1&&ordinal(head.revision)&&ordinal(head.checkpointRevision)&&ordinal(head.sequence)&&head.sequence<CHECKPOINT_INTERVAL&&ordinal(head.canonicalHands),'Invalid recovery head. Original saved data was preserved.');
 requireData(hashShape(head.checkpointHash)&&hashShape(head.tail)&&head.checkpointKey===checkpointKey(head.checkpointRevision,head.checkpointHash),'Invalid recovery checkpoint identity.');
 requireData(head.revision-head.checkpointRevision===head.sequence,'Recovery revision sequence differs.');
 await checkHash(head);assertManifestBinding(head,manifest);return head;
}
async function makeHead<C>(checkpoint:FinancialCheckpoint<C>,sequence:number,tail:string,manifest:SegmentedEnvelope):Promise<RecoveryHead>{
 const body={format:'ai-texas-recovery-head' as const,version:1 as const,revision:manifest.data.revision,canonicalChecksum:manifest.checksum,
  checkpointKey:checkpointKey(checkpoint.revision,checkpoint.checksum),checkpointHash:checkpoint.checksum,checkpointRevision:checkpoint.revision,
  sequence,tail,canonicalHands:manifest.segments.hands.count};
 return {...body,checksum:await digest(body)};
}
function appendOnly<T>(prior:T[],next:T[],name:string):T[]{
 requireData(next.length>=prior.length,`Recovery ${name} lost records.`);
 if(next!==prior)for(let i=0;i<prior.length;i++)requireData(next[i]===prior[i]||canonical(next[i])===canonical(prior[i]),`Recovery ${name} immutable prefix changed.`);
 return next.slice(prior.length);
}
/** Called only after the application verifier authorized the new state. It
 * records engine-produced facts; there is no betting, payout or wallet logic. */
export async function prepareFastCommit<C,D>(data:AppData,manifest:SegmentedEnvelope,prior:FastState<C>|null,hooks:CompactHooks<C,D>):Promise<FastPrepared<C>>{
 const payload=await hooks.compact(data);
 requireData(payload.data.revision===manifest.data.revision&&payload.data.hands.length<=RECENT_HAND_LIMIT,'Invalid compact recovery payload.');
 requireData(!prior||manifest.data.revision===prior.head.revision+1,'Recovery commits must advance exactly one revision.');
 if(!prior||prior.head.sequence+1>=CHECKPOINT_INTERVAL){
  const body={format:'ai-texas-financial-checkpoint' as const,version:1 as const,revision:data.revision,canonicalChecksum:manifest.checksum,canonicalHands:manifest.segments.hands.count,payload};
  const checkpoint={...body,checksum:await digest(body)},head=await makeHead(checkpoint,0,checkpoint.checksum,manifest);
  return {state:{head,payload},writes:[{key:head.checkpointKey,value:checkpoint},{key:FAST_HEAD_KEY,value:head},...(prior?[{key:FAST_PREVIOUS_KEY,value:prior.head}]:[])],checkpoint:true};
 }
 const before=prior.payload.data,next=payload.data,addedHands=manifest.segments.hands.count-prior.head.canonicalHands;
 requireData(ordinal(addedHands)&&addedHands<=next.hands.length,'Recovery hand append count differs.');
 const hands=addedHands?next.hands.slice(-addedHands):[];
 const overlap=next.hands.slice(0,next.hands.length-addedHands),beforeTail=before.hands.slice(-overlap.length);
 requireData(!overlap.length||overlap.length<=before.hands.length&&overlap.every((hand,i)=>hand===beforeTail[i]||hand.id===beforeTail[i].id&&hand.hash===beforeTail[i].hash),'Recovery recent-history prefix changed.');
 requireData(next.sessions.length>=before.sessions.length,'Recovery sessions lost records.');
 const sessions:Array<{index:number;value:CashSession}>=[];
 for(let i=0;i<next.sessions.length;i++){
  requireData(i>=before.sessions.length||next.sessions[i].id===before.sessions[i].id,'Recovery session ordering changed.');
  if(next.sessions[i]!==before.sessions[i]&&canonical(next.sessions[i])!==canonical(before.sessions[i]))sessions.push({index:i,value:next.sessions[i]});
 }
 const delta:JournalDelta<D>={header:header(next),ledgerOffset:before.ledger.length,ledger:appendOnly(before.ledger,next.ledger,'ledger'),
  handOffset:prior.head.canonicalHands,hands,importedOffset:before.importedHands.length,importedHands:appendOnly(before.importedHands,next.importedHands,'imports'),sessionCount:next.sessions.length,sessions,context:hooks.contextDelta(prior.payload.context,payload.context)};
 const sequence=prior.head.sequence+1,body={format:'ai-texas-recovery-journal' as const,version:1 as const,id:`${data.revision}:${manifest.checksum}`,sequence,revision:data.revision,previousRevision:prior.head.revision,previousHash:prior.head.tail,canonicalChecksum:manifest.checksum,canonicalHands:manifest.segments.hands.count,delta};
 const journal={...body,checksum:await digest(body)},headBody={...prior.head,revision:data.revision,canonicalChecksum:manifest.checksum,sequence,tail:journal.checksum,canonicalHands:manifest.segments.hands.count};
 const headContent={...headBody} as Partial<RecoveryHead>;delete headContent.checksum;const head={...headContent,checksum:await digest(headContent)} as RecoveryHead;
 return {state:{head,payload},writes:[{key:journalKey(head.checkpointHash,sequence),value:journal},{key:FAST_HEAD_KEY,value:head}],checkpoint:false};
}
/** Pure transport replay. Every record is verified before applying it, then the
 * independent financial verifier must authorize the assembled state. */
export async function restoreFastState<C,D>(raw:unknown,manifest:SegmentedEnvelope,read:(keys:string[])=>Promise<unknown[]>,hooks:CompactHooks<C,D>):Promise<FastState<C>>{
 freezeSnapshot(manifest);
 const {checksum,...manifestBody}=manifest;requireData(checksum===await digest(manifestBody),'Canonical manifest checksum differs.');
 const head=await validateRecoveryHead(raw,manifest),[rawCheckpoint]=await read([head.checkpointKey]),checkpoint=freezeSnapshot(rawCheckpoint) as FinancialCheckpoint<C>|undefined;
 requireData(checkpoint&&checkpoint.format==='ai-texas-financial-checkpoint'&&checkpoint.version===1&&checkpoint.revision===head.checkpointRevision&&checkpoint.checksum===head.checkpointHash,'Recovery checkpoint is missing or mismatched.');
 await checkHash(checkpoint);
 requireData(checkpoint.payload?.data?.revision===checkpoint.revision&&ordinal(checkpoint.canonicalHands)&&checkpoint.payload.data.hands.length<=RECENT_HAND_LIMIT,'Recovery checkpoint contents differ.');
 let payload=checkpoint.payload,revision=checkpoint.revision,tail=checkpoint.checksum,handCount=checkpoint.canonicalHands,canonicalChecksum=checkpoint.canonicalChecksum;
 const rows=await read(Array.from({length:head.sequence},(_,i)=>journalKey(head.checkpointHash,i+1))),ids=new Set<string>(),cooperate=recoveryScheduler();
 requireData(rows.length===head.sequence,'Recovery journal is incomplete.');
 for(let i=0;i<rows.length;i++){
  const row=freezeSnapshot(rows[i]) as RecoveryJournal<D>|undefined,sequence=i+1;
  requireData(row&&row.format==='ai-texas-recovery-journal'&&row.version===1&&row.sequence===sequence&&row.previousRevision===revision&&row.revision===revision+1&&row.previousHash===tail,'Recovery journal is missing, duplicated or reordered.');
  requireData(row.id===`${row.revision}:${row.canonicalChecksum}`&&!ids.has(row.id),'Recovery journal event identity differs.');ids.add(row.id);await checkHash(row);
  const d=row.delta,before=payload.data;
  requireData(d&&d.header.revision===row.revision&&d.ledgerOffset===before.ledger.length&&d.importedOffset===before.importedHands.length&&d.handOffset===handCount&&row.canonicalHands===handCount+d.hands.length,'Recovery journal append offsets differ.');
  requireData(ordinal(d.sessionCount)&&d.sessionCount>=before.sessions.length,'Recovery journal session count differs.');
  const sessions=before.sessions.slice(),changed=new Set<number>();
  for(const item of d.sessions){requireData(ordinal(item.index)&&item.index<d.sessionCount&&!changed.has(item.index),'Recovery journal duplicates a session.');changed.add(item.index);requireData(!sessions[item.index]||sessions[item.index].id===item.value.id,'Recovery journal session identity differs.');sessions[item.index]=item.value;}
  requireData(sessions.length===d.sessionCount&&Array.from({length:d.sessionCount},(_,j)=>sessions[j]).every(Boolean),'Recovery journal is missing a session.');
  payload={data:{...d.header,ledger:[...before.ledger,...d.ledger],hands:[...before.hands,...d.hands].slice(-RECENT_HAND_LIMIT),sessions,importedHands:[...before.importedHands,...d.importedHands]},context:hooks.applyContext(payload.context,d.context)};
  revision=row.revision;tail=row.checksum;handCount=row.canonicalHands;canonicalChecksum=row.canonicalChecksum;await cooperate();
 }
 requireData(revision===head.revision&&tail===head.tail&&handCount===head.canonicalHands&&canonicalChecksum===head.canonicalChecksum,'Recovery journal tail differs from committed canonical state.');
 assertCurrentDataBinding(payload.data,manifest);
 verifiedEnvelopes.set(payload.data,payload.context);
 try{payload={...payload,data:await hooks.audit(payload.data,payload.context)};}catch(error){verifiedEnvelopes.delete(payload.data);throw error;}
 return {head,payload};
}
