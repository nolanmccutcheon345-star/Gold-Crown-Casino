import type {AppData,CashSession} from '../session/types';
import {canonical,digest,digestPackedHandSegment,GENESIS,requireData} from './integrity';
import {auditSnapshot,auditRestoredSnapshot,isVerifiedSnapshot,freezeSnapshot,getArchiveContext} from './verified';
import {timed,timedAsync} from '../performance/timing';
import {recoveryScheduler} from './recovery-scheduler';
import {packHandGraph,unpackHandText} from './packed-hand';
export const SEGMENTS=['ledger','hands','closedSessions','importedHands'] as const;
export type Segment=typeof SEGMENTS[number];
type Header=Omit<AppData,'ledger'|'hands'|'sessions'|'importedHands'>&{openSession:CashSession|null};
interface Descriptor {count:number;tail:string}
export interface SegmentedEnvelope {format:'ai-texas-hold-em-private-device';version:2;data:Header;segments:Record<Segment,Descriptor>;packedHands?:{version:1;count:number;tail:string;first?:number};checksum:string}
export interface LegacyEnvelope {format:'ai-texas-hold-em-private-device';version:1;data:AppData;checksum:string}
export type Envelope=LegacyEnvelope|SegmentedEnvelope;
export interface StoredSegment {index:number;previousHash:string;hash:string;value:unknown}
export interface PackedHandSegment {format:'ai-texas-packed-hand';version:1;index:number;previousHash:string;hash:string;graph:string}
export interface PreparedSnapshot {envelope:SegmentedEnvelope;writes:{key:string;entry:StoredSegment}[];replicas?:{key:string;entry:PackedHandSegment}[];diagnostics?:string[];retiredReplicas?:number[]}
const originalHandSegments=new WeakMap<object,Omit<StoredSegment,'value'>>();
// Optional acceleration is bounded; all canonical rows remain authoritative.
export const PACKED_HAND_CACHE_LIMIT=120;
export function packedHandFirst(envelope:SegmentedEnvelope):number {
 const p=envelope.packedHands;if(!p)return 0;const first=p.first??0;
 requireData(p.version===1&&p.count===envelope.segments.hands.count&&p.tail===envelope.segments.hands.tail&&Number.isSafeInteger(first)&&first>=0&&first<=p.count,'Packed hand checkpoint differs from canonical sequence.');return first;
}
export const packedHandKey=(index:number)=>`packed-v1:hands:${String(index).padStart(12,'0')}`;
export interface RestoreOptions {canonicalOnly?:boolean;onDiagnostic?:(message:string)=>void}
export const segmentKey=(segment:Segment,index:number)=>`v2:${segment}:${String(index).padStart(12,'0')}`;
function parts(data:AppData){
 const {ledger,hands,sessions,importedHands,...rest}=data,open=sessions.filter(s=>s.endedAt===null);
 requireData(open.length<=1&&(!open.length||sessions.at(-1)===open[0]),'Invalid open session ordering.');
 return {header:{...rest,openSession:open[0]??null},values:{ledger,hands,closedSessions:open.length?sessions.slice(0,-1):sessions,importedHands}};
}
/** Append-only canonical records plus a small current header. This is an internal storage
 * protocol, never a public export. A v1 reader refuses version 2 before touching records. */
export async function prepareSegments(data:AppData,priorData:AppData|null,prior:Envelope|null,options:{packHands?:boolean;compactPacked?:boolean}={}):Promise<PreparedSnapshot>{
 if(!isVerifiedSnapshot(data))await auditSnapshot(data);
 const next=parts(data),before=priorData?parts(priorData):null,writes:PreparedSnapshot['writes']=[],segments={} as Record<Segment,Descriptor>;
 const handOffset=getArchiveContext(data)?.handOffset??0,priorHandOffset=priorData?getArchiveContext(priorData)?.handOffset??0:0;
 requireData(!handOffset||prior?.version===2,'A compact snapshot cannot replace a missing canonical archive.');
 for(const name of SEGMENTS){
  const previous=prior?.version===2?prior.segments[name]:{count:0,tail:GENESIS};
  const values=next.values[name],prefix=before?.values[name]??[],offset=name==='hands'?handOffset:0,beforeOffset=name==='hands'?priorHandOffset:0,total=offset+values.length;
  requireData(total>=previous.count&&offset<=previous.count,'Storage segment checkpoint lost records.');
  if(prior?.version===2){requireData(prefix.length+beforeOffset===previous.count,'Storage checkpoint count mismatch.');if(values!==prefix||offset!==beforeOffset)for(let i=Math.max(offset,beforeOffset);i<previous.count;i++)requireData(values[i-offset]===prefix[i-beforeOffset]||canonical(values[i-offset])===canonical(prefix[i-beforeOffset]),'Storage immutable prefix was replaced.');}
  let hash=previous.tail;
  for(let i=previous.count;i<total;i++){
   const body={index:i,previousHash:hash,value:values[i-offset]},entry={...body,hash:await digest(body)};
   writes.push({key:segmentKey(name,i),entry});hash=entry.hash;
  }
  segments[name]={count:total,tail:hash};
 }
 let packed=options.packHands??(prior?.version===2&&!!prior.packedHands);const diagnostics:string[]=[],replicas:NonNullable<PreparedSnapshot['replicas']>=[];
 const priorFirst=prior?.version===2?packedHandFirst(prior):0,total=segments.hands.count,oldCount=prior?.version===2?prior.segments.hands.count:0;
 // A normal commit retires at most the appended hand count. Explicit maintenance
 // audits the old archive before shrinking an already-unbounded replica cache.
 const desiredFirst=Math.max(0,total-PACKED_HAND_CACHE_LIMIT),first=options.compactPacked||!prior?desiredFirst:Math.min(desiredFirst,priorFirst+Math.max(0,total-oldCount));
 if(packed){
  const start=Math.max(first,prior?.version===2?prior.packedHands?.count??0:0);requireData(start>=handOffset&&start<=handOffset+next.values.hands.length,'Packed hand checkpoint requires available canonical records.');
  const cooperate=recoveryScheduler(),fresh=new Map(writes.map(write=>[write.key,write.entry]));let previousHash=GENESIS;
  if(start){
   const known=fresh.get(segmentKey('hands',start))??originalHandSegments.get(next.values.hands[start-handOffset]);
   if(prior?.version===2&&start===prior.packedHands?.count)previousHash=prior.packedHands.tail;
   else if(known)previousHash=known.previousHash;
   else {requireData(handOffset===0,'Original canonical segment boundary is unavailable.');for(let i=0;i<start;i++){previousHash=await digest({index:i,previousHash,value:next.values.hands[i]});await cooperate();}}
  }
  for(let i=start;i<handOffset+next.values.hands.length;i++){
   const value=next.values.hands[i-handOffset];
   // The original segment chain is independent of the inner hand hash chain.
   const known=fresh.get(segmentKey('hands',i))??originalHandSegments.get(value);
   if(i>=start){
    requireData(!known||known.index===i&&known.previousHash===previousHash,'Known canonical segment position differs.');
    const hash=known?.hash??await digest({index:i,previousHash,value});
    let graph:string;try{graph=timed('persistence.packHand',()=>JSON.stringify(packHandGraph(value)));}catch(error){packed=false;replicas.length=0;diagnostics.push(`Optional packed hand encoding was unavailable; unchanged canonical storage remains authoritative. ${error instanceof Error?error.message:'Unsupported value'}`);break;}
    replicas.push({key:packedHandKey(i),entry:{format:'ai-texas-packed-hand',version:1,index:i,previousHash,hash,graph}});previousHash=hash;
   }
   await cooperate();
  }
 }
 const body={format:'ai-texas-hold-em-private-device' as const,version:2 as const,data:next.header,segments,...(packed?{packedHands:{version:1 as const,count:segments.hands.count,tail:segments.hands.tail,...(first?{first}:{})}}:{})};
 return {envelope:{...body,checksum:await digest(body)},writes,...(packed?{replicas}:{}),...(diagnostics.length?{diagnostics}:{}),...(packed&&first>priorFirst?{retiredReplicas:Array.from({length:first-priorFirst},(_,i)=>priorFirst+i)}:{})};
}
/** Full reconstruction audits stored bytes, indices, chain links and tail checkpoints. A missing
 * or reordered event fails closed even if its caller-supplied record hash is unchanged. */
export async function restoreSegments(envelope:SegmentedEnvelope,read:(keys:string[])=>Promise<unknown[]>,options:RestoreOptions={}):Promise<AppData>{
 // A custom reader may retain aliases. Lock the exact bytes before any
 // asynchronous hash/read can yield, then validate them as usual.
 timed('recovery.freezeTransport',()=>freezeSnapshot(envelope));
 requireData(envelope?.format==='ai-texas-hold-em-private-device'&&envelope.version===2,'Unsupported segmented snapshot format.');
 const {checksum,...body}=envelope;requireData(checksum===await digest(body),'Saved snapshot failed its integrity check. Existing data was preserved; no bankroll was reset.');
 const firstPacked=packedHandFirst(envelope);
 const values={} as Record<Segment,unknown[]>,cooperate=recoveryScheduler();
 for(const name of SEGMENTS){
  const descriptor=envelope.segments[name];requireData(descriptor&&Number.isSafeInteger(descriptor.count)&&descriptor.count>=0&&descriptor.count<=1_000_000,'Invalid storage segment size.');
  let hash=GENESIS;values[name]=[];
  // Bound allocation, IndexedDB structured-clone callbacks and synchronous fallback
  // hashing. Every byte, ordinal, link and checkpoint is still validated.
  for(let offset=0;offset<descriptor.count;offset+=64){
   const count=Math.min(64,descriptor.count-offset);
   const packedAt=(index:number)=>name==='hands'&&!!envelope.packedHands&&!options.canonicalOnly&&index>=firstPacked;
   const records=await timedAsync(`recovery.read.${name}`,()=>read(Array.from({length:count},(_,i)=>packedAt(offset+i)?packedHandKey(offset+i):segmentKey(name,offset+i))));
   requireData(Array.isArray(records)&&records.length===count,'Storage segment checkpoint mismatch.');
   for(let j=0;j<records.length;j++){
    const i=offset+j,usePacked=packedAt(i),property=Object.getOwnPropertyDescriptor(records,String(j));requireData(!property?.get&&!property?.set,'Saved data cannot contain accessors.');
    let raw=property?.value;
    async function checked(input:unknown,packed:boolean):Promise<StoredSegment>{
     const transport=timed('recovery.freezeTransport',()=>freezeSnapshot(input));let entry:StoredSegment|undefined;
     if(packed){
      const p=transport as PackedHandSegment|undefined;
      requireData(p&&p.format==='ai-texas-packed-hand'&&p.version===1&&Object.keys(p).length===6&&Object.keys(p).every(key=>['format','version','index','previousHash','hash','graph'].includes(key)),'Unsupported packed hand replica.');
      entry={index:p.index,previousHash:p.previousHash,hash:p.hash,value:timed('recovery.unpackHand',()=>unpackHandText(p.graph))};
     }else entry=transport as StoredSegment|undefined;
     requireData(entry&&entry.index===i&&entry.previousHash===hash,'Storage segment missing or reordered.');const {hash:claimed,...record}=entry;
     requireData(claimed===await timedAsync(`recovery.segmentHash.${name}`,()=>packed?digestPackedHandSegment(record,claimed):digest(record)),'Saved storage segment integrity check failed.');return entry;
    }
    let entry:StoredSegment;
    try{entry=await checked(raw,usePacked);}catch(error){
     if(!usePacked)throw error;
     options.onDiagnostic?.(`Packed hand replica ${i} was unavailable or invalid; verifying the unchanged canonical record instead. ${error instanceof Error?error.message:'Invalid replica'}`);
     const fallback=await timedAsync('recovery.read.canonicalFallback',()=>read([segmentKey(name,i)]));requireData(Array.isArray(fallback)&&fallback.length===1,'Canonical fallback segment is missing.');
     const descriptor=Object.getOwnPropertyDescriptor(fallback,'0');requireData(descriptor&&!descriptor.get&&!descriptor.set,'Saved data cannot contain accessors.');raw=descriptor.value;entry=await checked(raw,false);
    }
    hash=entry.hash;values[name].push(entry.value);if(name==='hands'&&entry.value&&typeof entry.value==='object')originalHandSegments.set(entry.value,{index:entry.index,previousHash:entry.previousHash,hash:entry.hash});
    await cooperate();
   }
  }
  requireData(values[name].length===descriptor.count&&hash===descriptor.tail,'Storage segment checkpoint mismatch.');
 }
 const {openSession,...header}=envelope.data;
 const data={...header,ledger:values.ledger,hands:values.hands,importedHands:values.importedHands,sessions:[...values.closedSessions,...(openSession?[openSession]:[])]} as AppData;
 return options.canonicalOnly?auditSnapshot(data):auditRestoredSnapshot(data);
}
export function sameManifest(left:Envelope|null|undefined,right:Envelope|null|undefined):boolean{return canonical(left??null)===canonical(right??null);}
