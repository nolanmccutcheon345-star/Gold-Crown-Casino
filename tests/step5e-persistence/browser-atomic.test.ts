import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AppData} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {canonical,digest} from '../../src/storage/integrity';
import {prepareSegments,segmentKey,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';
import {FAST_HEAD_KEY,FAST_PREVIOUS_KEY,FAST_INSTALL_BACKUP_KEY,journalKey,type RecoveryHead} from '../../src/storage/financial-checkpoint';
import {transactionReference} from '../step36/transaction-reference';

// These tests isolate the real BrowserPersistence transaction/recovery protocol
// from the separately tested projection implementation. Financial audit still
// executes the existing independent full verifier on these small real hands.
vi.mock('../../src/storage/recovery-contracts',()=>({compactRecoveryHooks:{
 async compact(data:AppData){return{data,context:{handOffset:0,handIndex:data.hands.map(h=>({id:h.id,hash:h.hash,sessionId:h.sessionId,net:h.net}))}};},
 async audit(data:AppData){const {auditSnapshot}=await import('../../src/storage/verified');return auditSnapshot(data);},
 contextDelta(before:{handIndex:unknown[]},after:{handIndex:unknown[]}){return{offset:before.handIndex.length,appended:after.handIndex.slice(before.handIndex.length)};},
 applyContext(before:{handIndex:unknown[]},delta:{offset:number;appended:unknown[]}){if(before.handIndex.length!==delta.offset)throw Error('Test index offset mismatch');return{handOffset:0,handIndex:[...before.handIndex,...delta.appended]};},
}}));
const owner='step5e-owner';
function attach(db:IDBDatabase){const port=new BrowserPersistence('ai-texas-step5e-unit');Object.assign(port,{db,owner,writable:true});return port;}
function reference(){
 const result=transactionReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]])),reads:string[]=[];
 const base=result.db.transaction.bind(result.db);
 // Key-only IndexedDB request model; this is an asynchronous transaction
 // reference, not browser execution. It intentionally never copies row bodies.
 Object.assign(result.db,{transaction:(...args:Parameters<IDBDatabase['transaction']>)=>{
  const tx=base(...args),store=tx.objectStore('kv'),nativeGet=store.get.bind(store);
  Object.assign(store,{get:(key:string)=>{reads.push(key);return nativeGet(key);},getAllKeys:(range:{lower:string;upper:string})=>{
   const request={result:[] as string[],onsuccess:null as null|(()=>void),onerror:null};queueMicrotask(()=>{request.result=[...result.records.keys()].filter(key=>key>=range.lower&&key<=range.upper).sort();request.onsuccess?.();});return request;
  }});return tx;
 }});
 vi.stubGlobal('IDBKeyRange',{bound:(lower:string,upper:string)=>({lower,upper})});return{...result,reads};
}
async function populated(){const s=reference(),port=attach(s.db),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});const g=controller.data!.active!.game;await controller.act({type:'fold'},g.handId,g.revision);expect(controller.error).toBe('');return{...s,port,controller};}
const bytes=(records:Map<string,unknown>)=>canonical([...records]);
afterEach(()=>vi.unstubAllGlobals());
describe('Step5E atomic IndexedDB protocol reference (not browser execution)',()=>{
 it('restores the exact settled state without reading old full hand rows',async()=>{
  const s=await populated(),before=structuredClone(s.controller.data!);s.reads.length=0;const reopened=attach(s.db),restored=await reopened.load();
  expect(restored).toEqual(before);expect(s.reads.filter(key=>key.startsWith('v2:hands:'))).toEqual([]);expect(s.reads.some(key=>key.startsWith('v2:ledger:'))).toBe(true);expect(reopened.legacyArchiveAuditStatus).toBe('not-audited');
  const hand=await reopened.readHand(0);expect(hand).toEqual(before.hands[0]);expect(s.reads).toContain(segmentKey('hands',0));
 });
 it.each([FAST_HEAD_KEY,'current'] as const)('interruption writing %s publishes neither journal nor canonical payout',async key=>{
  const s=await populated(),before=bytes(s.records),revision=s.controller.data!.revision;s.control.abortOnPutKey=key;await s.controller.adjustBankroll(s.controller.data!.wallet+17,'interrupted adjustment');
  expect(s.controller.error).toMatch(/Storage write failed/);expect(bytes(s.records)).toBe(before);const reopened=await attach(s.db).load();expect(reopened!.revision).toBe(revision);
 });
 it.each(['ledger-body','ledger-resealed','ledger-missing','hand-missing','journal-missing','checkpoint-missing'] as const)('fails safely on %s without resetting or paying twice',async fault=>{
  const s=await populated(),head=s.records.get(FAST_HEAD_KEY) as RecoveryHead;
  if(fault.startsWith('ledger')){
   const key=segmentKey('ledger',1),row=structuredClone(s.records.get(key)) as StoredSegment;
   if(fault==='ledger-missing')s.records.delete(key);else{(row.value as {walletDelta:number}).walletDelta++;if(fault==='ledger-resealed'){const body={...row} as Partial<StoredSegment>;delete body.hash;row.hash=await digest(body);}s.records.set(key,row);}
  }
  if(fault==='hand-missing')s.records.delete(segmentKey('hands',0));
  if(fault==='journal-missing')s.records.delete(journalKey(head.checkpointHash,head.sequence));
  if(fault==='checkpoint-missing')s.records.delete(head.checkpointKey);
  const before=bytes(s.records);await expect(attach(s.db).load()).rejects.toThrow();expect(bytes(s.records)).toBe(before);
 });
 it('keeps deferred archive-body corruption distinct from current financial verification',async()=>{
  const s=await populated(),key=segmentKey('hands',0),row=structuredClone(s.records.get(key)) as StoredSegment;(row.value as {net:number}).net++;s.records.set(key,row);
  const reopened=attach(s.db);expect((await reopened.load())!.wallet).toBe(s.controller.data!.wallet);expect(reopened.legacyArchiveAuditStatus).toBe('not-audited');
  await expect(reopened.readHand(0)).rejects.toThrow(/checksum/);await expect(reopened.auditCanonicalArchive()).rejects.toThrow();expect(reopened.legacyArchiveAuditStatus).toBe('failed');
 });
 it('old-reader canonical advancement forces full verification and installs at the newer revision',async()=>{
  const s=await populated(),prior=s.records.get('current') as SegmentedEnvelope,priorData=s.controller.data!,next=structuredClone(priorData);next.revision++;next.userNotes={version:1,players:[]} as unknown as AppData['userNotes'];
  // Use a valid unchanged-state revision, as a compatible old writer may do.
  delete next.userNotes;const canonicalNext=await prepareSegments(next,priorData,prior);
  for(const row of canonicalNext.writes)s.records.set(row.key,row.entry);for(const row of canonicalNext.replicas??[])s.records.set(row.key,row.entry);s.records.set('current',canonicalNext.envelope);
  const reopened=attach(s.db),loaded=await reopened.load();expect(loaded!.revision).toBe(next.revision);expect(loaded!.wallet).toBe(priorData.wallet);expect(reopened.recoveryDiagnostics.join(' ')).toMatch(/older compatible writer/);expect(s.records.has(FAST_INSTALL_BACKUP_KEY)).toBe(true);expect((s.records.get(FAST_HEAD_KEY) as RecoveryHead).revision).toBe(next.revision);
 });
 it('rejects a stale writer after another tab takes the transactional lease',async()=>{
  const s=await populated();s.records.set('lease',{owner:'another-tab',expires:Date.now()+12000});const before=bytes(s.records);await s.controller.adjustBankroll(s.controller.data!.wallet+99,'stale tab');expect(s.controller.error).toMatch(/Another tab/);expect(bytes(s.records)).toBe(before);expect(s.port.writable).toBe(false);
 });
 it('atomically prunes only a third obsolete acceleration generation and retains every canonical event',async()=>{
  const s=reference(),controller=new SessionController(attach(s.db));await controller.init();const initial=s.records.get(FAST_HEAD_KEY) as RecoveryHead;
  for(let i=1;i<=127;i++)await controller.adjustBankroll(1000000+i,'checkpoint rotation');expect(controller.error).toBe('');
  const before=bytes(s.records),current=s.records.get(FAST_HEAD_KEY) as RecoveryHead;expect(s.records.has(initial.checkpointKey)).toBe(true);expect(current.checkpointRevision).toBe(64);
  s.control.abortOnPutKey=FAST_HEAD_KEY;await controller.adjustBankroll(1000128,'interrupted rotation');expect(bytes(s.records)).toBe(before);
  const reloaded=new SessionController(attach(s.db));await reloaded.init();await reloaded.adjustBankroll(1000128,'retry rotation');expect(reloaded.error).toBe('');
  const next=s.records.get(FAST_HEAD_KEY) as RecoveryHead,previous=s.records.get(FAST_PREVIOUS_KEY) as RecoveryHead;
  expect(next.checkpointRevision).toBe(128);expect(previous.checkpointRevision).toBe(64);expect(s.records.has(initial.checkpointKey)).toBe(false);expect(s.records.has(journalKey(initial.checkpointHash,1))).toBe(false);
  expect(s.records.has(previous.checkpointKey)).toBe(true);expect(s.records.has(journalKey(previous.checkpointHash,63))).toBe(true);expect(s.records.has(next.checkpointKey)).toBe(true);
  expect([...s.records.keys()].filter(key=>key.startsWith('v2:ledger:'))).toHaveLength(129);expect((await attach(s.db).load())!.wallet).toBe(1000128);
 });
 it('also bounds acceleration generations across repeated compatible-old-writer migrations',async()=>{
  const s=await populated();let port=attach(s.db);
  for(let i=0;i<3;i++){
   const prior=s.records.get('current') as SegmentedEnvelope,data=await port.loadFullHistory(),next=structuredClone(data);next.revision++;
   const prepared=await prepareSegments(next,data,prior);for(const row of [...prepared.writes,...(prepared.replicas??[])])s.records.set(row.key,row.entry);s.records.set('current',prepared.envelope);
   port=attach(s.db);await port.load();
  }
  const head=s.records.get(FAST_HEAD_KEY) as RecoveryHead,previous=s.records.get(FAST_PREVIOUS_KEY) as RecoveryHead;
  expect([...s.records.keys()].filter(key=>key.startsWith('recovery-v1:checkpoint:')).sort()).toEqual([head.checkpointKey,previous.checkpointKey].sort());
  expect((await port.loadFullHistory()).hands).toHaveLength(1);expect(s.records.has(FAST_INSTALL_BACKUP_KEY)).toBe(true);
 });
});
