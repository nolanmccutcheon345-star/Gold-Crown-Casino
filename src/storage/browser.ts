import type { AppData, PersistencePort, StoredHand } from '../session/types';
import { canonical, digest, digestPackedHandSegment, GENESIS, migrateData, requireData } from './integrity';
import { auditSnapshot,freezeSnapshot,getArchiveContext } from './verified';
import { prepareSegments, restoreSegments, sameManifest, packedHandFirst, PACKED_HAND_CACHE_LIMIT, SEGMENTS, segmentKey, packedHandKey, type Envelope, type PreparedSnapshot, type SegmentedEnvelope, type StoredSegment, type PackedHandSegment } from './segments';
import { timedAsync } from '../performance/timing';
import { newHandId } from '../identity';
import {migrationReceipt,verifyMigrationBackup,MIGRATION_RECEIPT_KEY,PRE_UPGRADE_KEY} from './rollback';
import {ERASURE_KEY,assertErasureMarker,erasePracticeStore,PracticeDataDeletedError,type ErasureMarker} from './erasure';
import {compactRecoveryHooks,type CompactArchiveContext} from './recovery-contracts';
import {FAST_HEAD_KEY,FAST_PREVIOUS_KEY,FAST_INSTALL_BACKUP_KEY,RECENT_HAND_LIMIT,fastHeadMatches,obsoleteRecoveryKeys,prepareFastCommit,restoreFastState,type FastState,type RecoveryHead} from './financial-checkpoint';
import {recoveryScheduler} from './recovery-scheduler';
import {unpackHandText} from './packed-hand';
const DATABASE='ai-texas-hold-em-guest';
const LEASE_MS=12000;
const MISSING_MANIFEST='Saved account manifest is missing while other records remain. Existing data was preserved; gameplay is blocked. Do not clear site data. Use verified backup recovery.';
function tabOwner(databaseName:string):string{
 // Reuse only for a true reload of this browsing context. New/duplicated tabs
 // receive a fresh token; the transactional fence remains mandatory.
 const fresh=newHandId();
 try{
  const key=`${databaseName}-writer`;
  const reload=(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='reload';
  const prior=sessionStorage.getItem(key);const owner=reload&&prior?prior:fresh;
  sessionStorage.setItem(key,owner);return owner;
 }catch{return fresh;}
}
interface Lease {owner:string;expires:number;}
/** Private device persistence, not an export format. No authentication or network. */
export class BrowserPersistence implements PersistencePort {
 private db:IDBDatabase|null=null;
 private saved:AppData|null=null;
 private manifest:Envelope|null=null;
 private fast:FastState<CompactArchiveContext>|null=null;
 private owner:string;
 constructor(private databaseName=DATABASE){this.owner=tabOwner(databaseName);}
 private release:(()=>void)|null=null;
 private closed=false;
 private heartbeat:ReturnType<typeof setInterval>|null=null;
 writable=false;
 persistent=false;
 deleted=false;
 readonly recoveryDiagnostics:string[]=[];
 legacyArchiveAuditStatus:'not-required'|'not-audited'|'verified'|'failed'='not-required';
 legacyArchiveAuditReceipt:{revision:number;checksum:string;hands:number;wallet:number}|null=null;
 private auditGeneration=0;
 private diagnostic(message:string):void{if(this.recoveryDiagnostics.length<20)this.recoveryDiagnostics.push(message);}
 async requestProtection():Promise<boolean>{
  this.persistent=await navigator.storage?.persist?.()??false;return this.persistent;
 }
 private async open():Promise<IDBDatabase>{
  if(this.db)return this.db;
  requireData(typeof indexedDB!=='undefined','Browser storage is unavailable. Enable site storage to play safely.');
  this.db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const req=indexedDB.open(this.databaseName,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('kv'))req.result.createObjectStore('kv');};
   req.onerror=()=>reject(req.error??new Error('Cannot open saved guest data.'));
   req.onblocked=()=>reject(new Error('Another tab is blocking a storage upgrade. Close it and retry.'));
   req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();this.db=null;this.writable=false;};resolve(req.result);};
  });
  return this.db;
 }
 private transaction(db:IDBDatabase):IDBTransaction{
  try{return db.transaction('kv','readwrite',{durability:'strict'});}catch{return db.transaction('kv','readwrite');}
 }
 private async acquire(steal=false):Promise<void>{
  if(this.closed)throw new Error('Storage connection closed. Reload to continue.');
  if(this.writable&&!steal)return;
  if(navigator.locks){
   await new Promise<void>((resolve,reject)=>{
    void navigator.locks.request(this.databaseName,steal?{steal:true}:{ifAvailable:true},async lock=>{
     this.writable=!!lock;resolve();
     if(lock)await new Promise<void>(release=>{this.release=release;});
    }).catch(reject);
   });
   if(this.writable)await this.renewLease(true,true);
  }else await this.renewLease(true,steal);
  if(this.writable&&!this.heartbeat)this.heartbeat=setInterval(()=>{void this.renewLease(false).catch(()=>{this.writable=false;});},3000);
 }
 async takeOver():Promise<void>{this.release?.();this.release=null;this.writable=false;await this.acquire(true);}
 private async renewLease(acquire:boolean,force=false):Promise<void>{
  const db=await this.open();await new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db);const store=tx.objectStore('kv');const req=store.get('lease');
   req.onsuccess=()=>{const lease=req.result as Lease|undefined;const now=Date.now();
    this.writable=force||lease?.owner===this.owner|| (!!acquire&&(!lease||lease.expires<=now));
    if(this.writable)store.put({owner:this.owner,expires:now+LEASE_MS} satisfies Lease,'lease');
   };tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Writer lease failed.'));tx.onerror=()=>{};
  });
 }
 private async readCurrent(db:IDBDatabase):Promise<Envelope|null>{
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('kv','readonly'),store=tx.objectStore('kv'),req=store.get('current');
   let value:Envelope|null=null,count:IDBRequest<number>|null=null,lease:IDBRequest| null=null;
   req.onsuccess=()=>{
    value=req.result??null;
    // Only an empty store (apart from its writer lease) is a new account.
    // Count keys without parsing any archived hand, in this same transaction.
    if(value===null){try{count=store.count();lease=store.get('lease');}catch(error){reject(error);tx.abort();}}
   };
   tx.oncomplete=()=>{try{if(value===null)requireData(count?.result===(lease?.result===undefined?0:1),MISSING_MANIFEST);resolve(value);}catch(error){reject(error);}};
   tx.onabort=()=>reject(tx.error??new Error('Saved account read was interrupted. Existing data was preserved.'));
   tx.onerror=()=>{};
  });
 }
 private async readKeys(db:IDBDatabase,keys:string[]):Promise<unknown[]>{
  if(!keys.length)return [];
  return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readonly'),store=tx.objectStore('kv'),values:unknown[]=new Array(keys.length);let count=0;
   keys.forEach((key,index)=>{const request=store.get(key);request.onsuccess=()=>{values[index]=request.result;if(++count===keys.length)resolve(values);};request.onerror=()=>reject(request.error);});tx.onabort=()=>reject(tx.error??new Error('Snapshot read interrupted.'));
  });
 }
 /** Check original archive existence using keys only. Historical body bytes are
  * intentionally not claimed audited by this check; explicit full audit remains. */
 private async verifyInventory(db:IDBDatabase,envelope:SegmentedEnvelope):Promise<void>{
  await timedAsync('recovery.archiveInventory',async()=>{
   for(const name of SEGMENTS){
    const count=envelope.segments[name].count;requireData(Number.isSafeInteger(count)&&count>=0&&count<=1_000_000,'Invalid canonical archive inventory size.');if(!count)continue;
    const tx=db.transaction('kv','readonly'),store=tx.objectStore('kv');
    if(typeof store.getAllKeys==='function'&&typeof IDBKeyRange!=='undefined'){
     const keys=await new Promise<IDBValidKey[]>((resolve,reject)=>{const request=store.getAllKeys(IDBKeyRange.bound(segmentKey(name,0),segmentKey(name,count-1)));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error??new Error('Archive inventory read interrupted.'));});
     requireData(keys.length===count&&keys.every((key,index)=>key===segmentKey(name,index)),'Canonical archive inventory is missing or reordered. Existing data was preserved.');
    }else{
     // Standards-compatible fallback for old storage shims/test references.
     // Actual supported browsers use getAllKeys and do not load full history.
     for(let offset=0;offset<count;offset+=64){const keys=Array.from({length:Math.min(64,count-offset)},(_,i)=>segmentKey(name,offset+i)),rows=await this.readKeys(db,keys);requireData(rows.length===keys.length&&rows.every(Boolean),'Canonical archive inventory is missing. Existing data was preserved.');}
    }
   }
  });
 }
 /** Financial canonical bytes are small and must be verified before play.
  * Only historical full hand bodies are deferred to explicit archive audit. */
 private async verifyFinancialArchive(db:IDBDatabase,envelope:SegmentedEnvelope,data:AppData):Promise<void>{
  await timedAsync('recovery.financialArchive',async()=>{
   const values={ledger:data.ledger,closedSessions:data.sessions.filter(session=>session.endedAt!==null),importedHands:data.importedHands},cooperate=recoveryScheduler();
   for(const name of ['ledger','closedSessions','importedHands'] as const){
    const descriptor=envelope.segments[name];requireData(values[name].length===descriptor.count,'Recovery canonical financial count differs.');let tail=GENESIS;
    for(let offset=0;offset<descriptor.count;offset+=64){
     const keys=Array.from({length:Math.min(64,descriptor.count-offset)},(_,i)=>segmentKey(name,offset+i)),rows=await this.readKeys(db,keys);
     requireData(rows.length===keys.length,'Recovery canonical financial records are missing.');
     for(let j=0;j<rows.length;j++){
      const row=freezeSnapshot(rows[j]) as StoredSegment|undefined,index=offset+j;
      requireData(row&&row.index===index&&row.previousHash===tail,'Canonical financial record is missing, duplicated or reordered.');
      const {hash,...body}=row;requireData(hash===await digest(body),'Canonical financial record checksum differs.');
      requireData(canonical(row.value)===canonical(values[name][index]),'Checkpoint differs from canonical financial records.');tail=hash;await cooperate();
     }
    }
    requireData(tail===descriptor.tail,'Canonical financial tail differs.');
   }
  });
 }
 /** Check that the bounded actual resident tail is still recoverable from the
  * canonical archive or its existing exact replica. A checkpoint must not hide
  * loss/corruption of both archival copies of its current resident records. */
 private async verifyResidentArchive(db:IDBDatabase,envelope:SegmentedEnvelope,state:FastState<CompactArchiveContext>):Promise<void>{
  await timedAsync('recovery.residentArchive',async()=>{
   const {data,context}=state.payload,offset=context.handOffset,packed=!!envelope.packedHands,cooperate=recoveryScheduler();let tail:string|null=offset===0?GENESIS:null;
   const firstPacked=packedHandFirst(envelope),usePacked=(index:number)=>packed&&index>=firstPacked;
   for(let start=0;start<data.hands.length;start+=32){
    const count=Math.min(32,data.hands.length-start),rows=await this.readKeys(db,Array.from({length:count},(_,i)=>usePacked(offset+start+i)?packedHandKey(offset+start+i):segmentKey('hands',offset+start+i)));
    requireData(rows.length===count,'Resident archive integrity failed: missing records.');
    for(let j=0;j<count;j++){
     const index=offset+start+j,expected=data.hands[start+j];
     const checked=async(raw:unknown,usePacked:boolean):Promise<StoredSegment>=>{
      const input=freezeSnapshot(raw);let row:StoredSegment;
      if(usePacked){const p=input as PackedHandSegment|undefined;requireData(p&&p.format==='ai-texas-packed-hand'&&p.version===1,'Resident replica integrity failed.');row={index:p.index,previousHash:p.previousHash,hash:p.hash,value:unpackHandText(p.graph)};}
      else row=input as StoredSegment;
      requireData(row&&row.index===index&&(tail===null||row.previousHash===tail),'Resident archive integrity failed: missing or reordered record.');
      const {hash,...body}=row;requireData(hash===await (usePacked?digestPackedHandSegment(body,hash):digest(body)),'Resident archive integrity failed: segment hash differs.');
      const hand=row.value as StoredHand,{hash:inner,...handBody}=hand;
      requireData(inner===expected.hash&&hand.id===expected.id&&(usePacked||inner===await digest(handBody)),'Resident hand integrity differs from verified checkpoint.');return row;
     };
     let row:StoredSegment;
     try{row=await checked(rows[j],usePacked(index));}catch(error){
      if(!usePacked(index))throw error;
      this.diagnostic(`Resident replica ${index} was unavailable or invalid; verifying its canonical record. ${error instanceof Error?error.message:'Replica integrity failed.'}`);
      row=await checked((await this.readKeys(db,[segmentKey('hands',index)]))[0],false);
     }
     tail=row.hash;await cooperate();
    }
   }
   requireData(tail===envelope.segments.hands.tail,'Resident archive integrity failed: tail differs from canonical manifest.');
  });
 }
 async load():Promise<AppData|null>{
  return timedAsync('persistence.load',async()=>{
   this.auditGeneration++;this.legacyArchiveAuditReceipt=null;this.fast=null;
   const db=await this.open();await this.acquire();const [marker]=await this.readKeys(db,[ERASURE_KEY]);
   if(marker!==undefined&&marker!==null){assertErasureMarker(marker);this.deleted=true;this.saved=null;this.manifest=null;throw new PracticeDataDeletedError();}
   const result=await this.readCurrent(db);this.deleted=false;
   if(result===null){this.saved=null;this.manifest=null;return null;}
   requireData(result.format==='ai-texas-hold-em-private-device'&&(result.version===1||result.version===2),'Unknown guest snapshot format. Existing data was preserved.');
   if(result.version===2){
    this.recoveryDiagnostics.length=0;
    const [fastHead]=await this.readKeys(db,[FAST_HEAD_KEY]);
    if(fastHeadMatches(fastHead,result)){
     const restored=await timedAsync('recovery.fastRestore',()=>restoreFastState(fastHead,result,keys=>this.readKeys(db,keys),compactRecoveryHooks));
     await this.verifyFinancialArchive(db,result,restored.payload.data);
     await this.verifyResidentArchive(db,result,restored);
     await this.verifyInventory(db,result);
     requireData(sameManifest(await this.readCurrent(db),result),'Saved revision changed during recovery. Reload the latest saved session.');
     this.fast=restored;this.saved=restored.payload.data;this.manifest=result;this.legacyArchiveAuditStatus='not-audited';
     this.diagnostic('Current financial state verified from checkpoint and ordered journal. Older canonical hand bodies remain available; full archive audit was pending when recovery completed; see the current audit status in Cashier.');
     return this.saved;
    }
    if(fastHead)this.diagnostic('Recovery checkpoint differs from the current canonical save, possibly after an older compatible writer. Performing full canonical reconstruction before installing a new checkpoint.');
    this.legacyArchiveAuditStatus=result.packedHands?'not-audited':'verified';
    this.saved=await restoreSegments(result,keys=>this.readKeys(db,keys),{onDiagnostic:message=>this.diagnostic(message)});this.manifest=result;
    // Full canonical verification above remains mandatory. Encoding every old
    // hand again is unnecessary for financial-checkpoint startup and measured
    // expensive at large archive sizes; retain the original rows directly.
    if(!result.packedHands&&this.writable&&result.segments.hands.count<=RECENT_HAND_LIMIT){
     try{await this.optimizeStorage();}catch(error){this.diagnostic(`Optional packed-history installation did not commit; the independently verified original save remains in use. ${error instanceof Error?error.message:'Storage failure'}`);return this.saved;}
    }
    if(this.writable){try{await this.installRecoveryCheckpoint();}catch(error){this.diagnostic(`Optional recovery checkpoint installation did not commit; the independently verified canonical save remains in use. ${error instanceof Error?error.message:'Storage failure'}`);}}
    return this.saved;
   }
   requireData(result.checksum===await digest(result.data),'Saved snapshot failed its integrity check. Existing data was preserved; no bankroll was reset.');
   const migrated=await migrateData(result.data);
   this.manifest=result;this.saved=null;
   if(this.writable){
    migrated.revision=result.data.revision+1; // Format migration is a fenced, atomic revision too.
    await this.commit(result.data.revision,migrated);
    // Complete optional representation initialization in this first load too.
    // The original v1->v2 receipt still identifies that separately committed
    // migration; pre-packed-v1 retains its exact target manifest.
    if(migrated.hands.length<=RECENT_HAND_LIMIT)try{await this.optimizeStorage();}catch(error){this.diagnostic(`Optional packed-history installation did not commit; the verified migrated save remains in use. ${error instanceof Error?error.message:'Storage failure'}`);}
   }else this.saved=await auditSnapshot(migrated);
   return this.saved;
  });
 }
 /** Retiring a redundant cache must never discard the only recoverable copy.
  * Verify the immutable canonical replacement against both hashes and the
  * independently verified financial hand index before the fenced transaction. */
 private async verifyReplicaRetirement(db:IDBDatabase,data:AppData,indices:number[]):Promise<void>{
  const index=getArchiveContext(data)?.handIndex,cooperate=recoveryScheduler();
  for(let offset=0;offset<indices.length;offset+=32){
   const batch=indices.slice(offset,offset+32),rows=await this.readKeys(db,batch.flatMap(i=>[segmentKey('hands',i),packedHandKey(i)]));
   for(let j=0;j<batch.length;j++){
    const i=batch[j],row=freezeSnapshot(rows[j*2]) as StoredSegment|undefined,replica=freezeSnapshot(rows[j*2+1]) as PackedHandSegment|undefined;
    requireData(row&&row.index===i,'Canonical hand is unavailable; redundant cache retirement was refused.');
    const {hash,...body}=row;requireData(hash===await digest(body),'Canonical hand segment integrity differs; cache was preserved.');
    const hand=row.value as StoredHand,{hash:inner,...handBody}=hand,expected=index?.[i]??data.hands[i];
    requireData(inner===await digest(handBody)&&expected&&hand.id===expected.id&&hand.hash===expected.hash&&hand.sessionId===expected.sessionId&&hand.net===expected.net,'Canonical hand differs from verified financial evidence; cache was preserved.');
    requireData(!replica||replica.index===i&&replica.hash===hash&&replica.previousHash===row.previousHash,'Canonical and replica positions differ; cache was preserved.');
    await cooperate();
   }
  }
 }
 async commit(expectedRevision:number|null,data:AppData):Promise<void>{
  if(this.deleted)throw new PracticeDataDeletedError();
  requireData(this.writable,'Another tab owns this session. This tab is read-only; close the other tab and retry.');
  const db=await this.open();
  if(!this.manifest&&expectedRevision!==null)this.manifest=await this.readCurrent(db);
  requireData((this.manifest?.data.revision??null)===expectedRevision,'Saved revision changed. Reload the saved session before acting.');
  requireData(!this.manifest||this.manifest.data.schemaVersion<=data.schemaVersion,'Saved-data downgrade refused. Use a compatible application version.');
  // New saves start with an empty packed descriptor, so another read never
  // changes their manifest and invalidates the original writer's CAS token.
  // Existing/migrating saves keep their established representation semantics.
  const prepared:PreparedSnapshot=await timedAsync('persistence.prepareSegments',()=>prepareSegments(data,this.saved,this.manifest,this.manifest===null?{packHands:true}:undefined));
  const retiredReplicas=(prepared.retiredReplicas??[]).filter(index=>index<(this.manifest?.version===2?this.manifest.segments.hands.count:0));
  await timedAsync('persistence.verifyReplicaRetirement',()=>this.verifyReplicaRetirement(db,data,retiredReplicas));
  const fast=await timedAsync('persistence.prepareRecovery',()=>prepareFastCommit(data,prepared.envelope,this.fast,compactRecoveryHooks));
  const retired=fast.checkpoint&&this.fast?await obsoleteRecoveryKeys((await this.readKeys(db,[FAST_PREVIOUS_KEY]))[0],[this.fast.head.checkpointKey,fast.state.head.checkpointKey]):[];
  for(const message of prepared.diagnostics??[])this.diagnostic(message);
  const receipt=this.manifest?.version===1?await migrationReceipt(this.manifest,prepared.envelope,data):null;
  await timedAsync('persistence.transaction',()=>new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db);const store=tx.objectStore('kv');let reason='Storage write failed. The last committed game remains intact. Retry after making space.';
   const current=store.get('current');const erased=store.get(ERASURE_KEY);const inventory=expectedRevision===null?store.count():null;let reads=0;let erasedValue:unknown;
   const proceed=()=>{
    if(++reads!==(inventory?3:2))return;
    if(erasedValue!==undefined&&erasedValue!==null){this.deleted=true;reason=new PracticeDataDeletedError().message;tx.abort();return;}
    const prior=current.result as Envelope|undefined;
    // Repeat the empty-origin guard inside the actual initial write. A prior
    // empty read does not authorize overwriting records that appeared later.
    if(!prior&&inventory&&inventory.result!==1){reason=MISSING_MANIFEST;tx.abort();return;}
    if(prior&&prior.data.schemaVersion>data.schemaVersion){reason='Saved-data downgrade refused. Use a compatible application version.';tx.abort();return;}
    if((prior?.data.revision??null)!==expectedRevision||!sameManifest(prior,this.manifest)){reason='Saved revision changed in another tab. Reload the saved session before acting.';tx.abort();return;}
    const save=()=>{
     if(prior){store.put(prior,'previous');if(prior.version===1){store.put(prior,PRE_UPGRADE_KEY);store.put(receipt,MIGRATION_RECEIPT_KEY);}if(prior.data.schemaVersion!==data.schemaVersion)store.put(prior,`pre-migration-v${prior.data.schemaVersion}`);}
     for(const write of [...prepared.writes,...(prepared.replicas??[])])store.put(write.entry,write.key);
     for(const index of retiredReplicas)store.delete(packedHandKey(index));
     for(const key of retired)store.delete(key);
     for(const write of fast.writes)store.put(write.value,write.key);
     store.put(prepared.envelope,'current');
    };
    const req=store.get('lease');req.onsuccess=()=>{const lease=req.result as Lease|undefined;if(!this.writable||lease?.owner!==this.owner){this.writable=false;reason='Another tab owns this session. Retry or explicitly take over here.';tx.abort();return;}try{store.put({owner:this.owner,expires:Date.now()+LEASE_MS},'lease');save();}catch(error){const cause=error as Error;reason=`Storage write failed. The last committed game remains intact. ${cause.name}: ${cause.message}`;try{tx.abort();}catch{/* A deliberately interrupted transaction may already be aborted. */}}};
   };
   current.onsuccess=proceed;erased.onsuccess=()=>{erasedValue=erased.result;proceed();};
   if(inventory)inventory.onsuccess=proceed;
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(this.deleted?new PracticeDataDeletedError():new Error(reason+(tx.error?` (${tx.error.name})`:'')));tx.onerror=()=>{};
  }));
  this.saved=data;this.manifest=prepared.envelope;this.fast=fast.state;this.auditGeneration++;this.legacyArchiveAuditStatus='not-audited';
 }
 /** First migration/old-reader re-entry: atomic acceleration install, retaining
  * the exact canonical manifest as backup. No revision, wallet or hand changes. */
 async installRecoveryCheckpoint():Promise<void>{
  const prior=this.manifest,data=this.saved;requireData(prior?.version===2&&data,'A verified canonical save is required for recovery installation.');
  requireData(this.writable&&!this.closed,'Another tab owns this session. Recovery installation was refused.');
  const fast=await timedAsync('persistence.installRecovery.prepare',()=>prepareFastCommit(data,prior,null,compactRecoveryHooks));
  const db=await this.open(),[oldHead,oldPrevious]=await this.readKeys(db,[FAST_HEAD_KEY,FAST_PREVIOUS_KEY]);
  const retained=(await obsoleteRecoveryKeys(oldHead,[fast.state.head.checkpointKey])).length?oldHead as RecoveryHead:null;
  const retired=retained?await obsoleteRecoveryKeys(oldPrevious,[retained.checkpointKey,fast.state.head.checkpointKey]):[];
  await timedAsync('persistence.installRecovery.transaction',()=>new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db),store=tx.objectStore('kv');let reason='Recovery installation did not commit. Original saved data was preserved.';
   const current=store.get('current');current.onsuccess=()=>{
    if(!sameManifest(current.result,prior)||this.saved!==data||this.manifest!==prior){reason='Saved revision changed during recovery installation.';tx.abort();return;}
    const erased=store.get(ERASURE_KEY);erased.onsuccess=()=>{
     if(erased.result){reason='Saved practice was deleted during recovery installation.';tx.abort();return;}
     const lease=store.get('lease');lease.onsuccess=()=>{
      if(!this.writable||(lease.result as Lease|undefined)?.owner!==this.owner){this.writable=false;reason='Another tab owns this session. Recovery installation was refused.';tx.abort();return;}
      try{store.put(prior,FAST_INSTALL_BACKUP_KEY);for(const key of retired)store.delete(key);if(retained)store.put(retained,FAST_PREVIOUS_KEY);for(const write of fast.writes)store.put(write.value,write.key);store.put({owner:this.owner,expires:Date.now()+LEASE_MS},'lease');}
      catch(error){reason+=` ${error instanceof Error?error.name+': '+error.message:'Storage failure'}`;try{tx.abort();}catch{/* Already aborted. */}}
     };
    };
   };tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error(reason+(tx.error?` (${tx.error.name})`:'')));tx.onerror=()=>{};
  }));this.fast=fast.state;
 }
 /** Explicit bounded cache maintenance. Full canonical reconstruction is
  * required before retiring legacy replicas; it never runs on normal startup
  * for a large archive. Canonical rows, financial history and backups stay intact. */
 async optimizeStorage():Promise<void>{
  const prior=this.manifest,saved=this.saved;
  if(!prior||prior.version!==2||!saved)return;
  const first=Math.max(0,prior.segments.hands.count-PACKED_HAND_CACHE_LIMIT);
  if(prior.packedHands&&packedHandFirst(prior)===first)return;
  requireData(this.writable&&!this.closed,'Another tab owns this session. History optimization was refused.');
  const db=await this.open();
  // The canonical-only path validates every link, inner hand, policy and ledger.
  // A corrupt/missing canonical row leaves its surviving replica untouched.
  const data=await timedAsync('persistence.compactCache.audit',()=>restoreSegments(prior,keys=>this.readKeys(db,keys),{canonicalOnly:true}));
  const prepared=await timedAsync('persistence.installPacked.prepare',()=>prepareSegments(data,data,prior,{packHands:true,compactPacked:true}));
  requireData(prepared.writes.length===0,'History optimization cannot change canonical records.');
  requireData(prepared.envelope.packedHands,prepared.diagnostics?.[0]??'Packed history was unavailable; the original save remains unchanged.');
  const fast=await prepareFastCommit(data,prepared.envelope,null,compactRecoveryHooks),[oldHead,oldPrevious]=await this.readKeys(db,[FAST_HEAD_KEY,FAST_PREVIOUS_KEY]);
  const retained=(await obsoleteRecoveryKeys(oldHead,[fast.state.head.checkpointKey])).length?oldHead as RecoveryHead:null;
  const retired=retained?await obsoleteRecoveryKeys(oldPrevious,[retained.checkpointKey,fast.state.head.checkpointKey]):[];
  await timedAsync('persistence.installPacked.transaction',()=>new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db),store=tx.objectStore('kv');let reason='Packed-history maintenance did not commit. The original save is preserved.';
   const current=store.get('current');current.onsuccess=()=>{
    if(!sameManifest(current.result,prior)||this.manifest!==prior||this.saved!==saved){reason='Saved revision changed during history optimization. The newer save is preserved.';tx.abort();return;}
    const erased=store.get(ERASURE_KEY);erased.onsuccess=()=>{
     if(erased.result){reason='Saved practice was deleted during history optimization.';tx.abort();return;}
     const lease=store.get('lease');lease.onsuccess=()=>{
      if(!this.writable||(lease.result as Lease|undefined)?.owner!==this.owner){this.writable=false;reason='Another tab owns this session. History optimization was refused.';tx.abort();return;}
      try{
       for(const write of prepared.replicas??[])store.put(write.entry,write.key);
       for(const i of prepared.retiredReplicas??[])store.delete(packedHandKey(i));
       // Preserve the last financial snapshot and the original migration backup.
       store.put(prior,prior.packedHands?'pre-packed-compaction-v1':'pre-packed-v1');
       for(const key of retired)store.delete(key);
       if(retained)store.put(retained,FAST_PREVIOUS_KEY);
       for(const write of fast.writes)store.put(write.value,write.key);
       store.put(prepared.envelope,'current');store.put({owner:this.owner,expires:Date.now()+LEASE_MS},'lease');
      }catch(error){reason+=` ${error instanceof Error?error.name+': '+error.message:'Storage failure'}`;try{tx.abort();}catch{/* Already interrupted. */}}
     };
    };
   };tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error(reason+(tx.error?` (${tx.error.name})`:'')));tx.onerror=()=>{};
  }));
  this.manifest=prepared.envelope;this.fast=fast.state;this.auditGeneration++;this.legacyArchiveAuditStatus='verified';this.legacyArchiveAuditReceipt={revision:data.revision,checksum:prepared.envelope.checksum,hands:prior.segments.hands.count,wallet:data.wallet};
 }
 /** Explicit full canonical history loading never mutates the live wallet or
  * active game. Callers must compare revision before using it as a UI snapshot. */
 async loadFullHistory():Promise<AppData>{
  const db=await this.open(),manifest=await this.readCurrent(db);requireData(manifest?.version===2,'A segmented canonical archive is required.');
  const data=await timedAsync('recovery.explicitFullHistory',()=>restoreSegments(manifest,keys=>this.readKeys(db,keys),{canonicalOnly:true}));
  requireData(sameManifest(await this.readCurrent(db),manifest),'Saved revision changed while loading history. Retry the history request.');return data;
 }
 /** Indexed history view: the financial index pins this exact canonical hand
  * identity and inner hash. This does not claim the entire archive was audited. */
 async readHand(index:number):Promise<StoredHand>{
  requireData(Number.isSafeInteger(index)&&index>=0&&this.manifest?.version===2&&index<this.manifest.segments.hands.count,'Saved hand index is unavailable.');
  const manifest=this.manifest,db=await this.open(),[raw]=await this.readKeys(db,[segmentKey('hands',index)]),entry=raw as StoredSegment|undefined;
  requireData(entry&&entry.index===index,'Canonical hand record is missing or reordered.');
  const {hash,...body}=entry;requireData(hash===await digest(body),'Canonical hand segment checksum differs.');
  const hand=entry.value as StoredHand,{hash:handHash,...handBody}=hand;requireData(handHash===await digest(handBody),'Canonical hand checksum differs.');
  const expected=this.fast?.payload.context.handIndex[index]??this.saved?.hands[index];
  requireData(expected&&hand.id===expected.id&&hand.hash===expected.hash&&hand.sessionId===expected.sessionId&&hand.net===expected.net,'Canonical hand differs from verified financial index.');
  requireData(sameManifest(await this.readCurrent(db),manifest),'Saved revision changed while loading this hand. Retry the history request.');return hand;
 }
 /** Independent full reconstruction of the retained canonical v2 archive. It
  * never substitutes a replica, rewrites records or rolls back live game state. */
 async auditCanonicalArchive():Promise<{revision:number;hands:number;wallet:number;checksum:string;current:boolean;status:'verified'}>{
  const generation=this.auditGeneration,db=await this.open(),envelope=await this.readCurrent(db);requireData(envelope&&envelope.version===2,'A segmented canonical archive is required.');
  try{const audited=await timedAsync('recovery.canonicalArchiveAudit',()=>restoreSegments(envelope,keys=>this.readKeys(db,keys),{canonicalOnly:true}));
   const receipt={revision:audited.revision,hands:audited.hands.length,wallet:audited.wallet,checksum:envelope.checksum};
   const latest=await this.readCurrent(db),current=!this.closed&&generation===this.auditGeneration&&sameManifest(latest,envelope)&&sameManifest(this.manifest,envelope);
   if(current){this.legacyArchiveAuditStatus='verified';this.legacyArchiveAuditReceipt=receipt;}
   return {...receipt,current,status:'verified'};
  }catch(error){if(!this.closed&&generation===this.auditGeneration){this.legacyArchiveAuditStatus='failed';this.diagnostic('The retained canonical rollback archive failed its independent audit; no records were reset or overwritten.');}throw error;}
 }
 /** Inspect the verified pre-upgrade copy without overwriting latest balances/history. */
 async inspectUpgradeBackup():Promise<Awaited<ReturnType<typeof verifyMigrationBackup>>>{
  const [backup,receipt]=await this.readKeys(await this.open(),[PRE_UPGRADE_KEY,MIGRATION_RECEIPT_KEY]);
  return verifyMigrationBackup(backup,receipt);
 }
 async erase(expectedRevision:number):Promise<void>{
  requireData(this.writable,'Another tab owns this session. Deletion was refused.');
  const marker:ErasureMarker={format:'ai-texas-hold-em-erasure',version:1,id:newHandId(),erasedAt:new Date().toISOString()};
  await erasePracticeStore(await this.open(),{owner:this.owner,expectedRevision,marker,...(this.manifest?{expectedChecksum:this.manifest.checksum}:{})});
  this.deleted=true;this.saved=null;this.manifest=null;this.fast=null;this.auditGeneration++;this.legacyArchiveAuditReceipt=null;this.legacyArchiveAuditStatus='not-required';
 }
 /** Patch 69: after an explicit deletion, write a backup that has passed the full saved-data audit, with no open
  * table. Same atomic path as a fresh start: refused unless the deletion marker is present and nothing else was saved. */
 async restoreFresh(data:AppData,expectedRevision?:number):Promise<void>{
  requireData(this.writable,'Another tab owns this session. Close it before restoring.');
  requireData(data&&data.active===null,'A backup with an open table cannot be restored.');
  await auditSnapshot(data);
  await this.writeFresh(data,'Restore did not commit. The previous save was preserved.',expectedRevision);
 }
 async startFresh(initial:AppData):Promise<void>{
  requireData(this.writable,'Another tab owns this session. Close it before starting fresh.');
  requireData(initial&&initial.revision===0&&initial.active===null&&initial.hands.length===0&&initial.importedHands.length===0&&initial.sessions.length===0&&initial.ledger.length===1&&initial.ledger[0].kind==='adjustment','An empty explicitly initialized guest save is required.');
  await this.writeFresh(initial,'Fresh start did not commit. Saved deletion remains in effect.');
 }
 private async writeFresh(initial:AppData,failure:string,expectedRevision?:number):Promise<void>{
  const prepared=await prepareSegments(initial,null,null,{packHands:true});
  const fast=await prepareFastCommit(initial,prepared.envelope,null,compactRecoveryHooks);
  const db=await this.open();await new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db),store=tx.objectStore('kv');let reason=failure;
   const erased=store.get(ERASURE_KEY);erased.onsuccess=()=>{
    try{if(expectedRevision===undefined)assertErasureMarker(erased.result);else requireData(!erased.result,'Cash save was deleted during restore.');}catch(e){reason=(e as Error).message;tx.abort();return;}
    const current=store.get('current');current.onsuccess=()=>{
     const previous=current.result;
     const matches=expectedRevision===undefined?!previous:previous?.data?.revision===expectedRevision&&previous.data.active===null&&previous.checksum===this.manifest?.checksum;
     if(!matches){reason='Saved revision changed. Reload before replacing it.';tx.abort();return;}
     const lease=store.get('lease');lease.onsuccess=()=>{
      if((lease.result as Lease|undefined)?.owner!==this.owner){this.writable=false;reason='Another tab owns this session. Fresh start was refused.';tx.abort();return;}
      if(expectedRevision!==undefined)store.clear();
      for(const write of [...prepared.writes,...(prepared.replicas??[])])store.put(write.entry,write.key);
      for(const write of fast.writes)store.put(write.value,write.key);
      store.put(prepared.envelope,'current');store.delete(ERASURE_KEY);store.put({owner:this.owner,expires:Date.now()+LEASE_MS},'lease');
     };
    };
   };tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error(reason));tx.onerror=()=>{};
  });this.deleted=false;this.saved=initial;this.manifest=prepared.envelope;this.fast=fast.state;
 }
 close():void{
  this.closed=true;this.auditGeneration++;this.writable=false;if(this.heartbeat)clearInterval(this.heartbeat);
  this.release?.();this.release=null;
  if(this.db){try{const tx=this.transaction(this.db);const s=tx.objectStore('kv');const r=s.get('lease');r.onsuccess=()=>{if((r.result as Lease|undefined)?.owner===this.owner)s.delete('lease');};}catch{/* Lease expires if closing interrupted. */}}
  this.db?.close();this.db=null;
 }
}
