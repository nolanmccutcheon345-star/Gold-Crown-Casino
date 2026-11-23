import {beforeAll,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {publicHistory,parsePublicHistory} from '../../src/storage/integrity';
import {packHandGraph} from '../../src/storage/packed-hand';
import {prepareSegments,packedHandKey,segmentKey,type SegmentedEnvelope,type StoredSegment,type PackedHandSegment} from '../../src/storage/segments';
import {encode,hash,resealManifest} from '../step5d-independent/reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';
import {PRE_UPGRADE_KEY,MIGRATION_RECEIPT_KEY} from '../../src/storage/rollback';
import {transactionReference} from '../step36/transaction-reference';

// Independent archive fixture intentionally creates the old *complete* replica
// set. It does not inherit the new writer's retention selection or use its
// compaction implementation to define expected canonical bytes.
const COUNT=124,TAIL=120,owner='step5h-independent-owner';
class Memory implements PersistencePort {
 data:AppData|null=null;
 async load(){return this.data;}
 async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=next;}
 close(){}
}
let original:AppData,legacy:Map<string,unknown>,canonicalDigest:string,publicDigest:string;
const legacyRuntimeURL='../step5c-rollback/generated/recovery.js';
const old=await import(legacyRuntimeURL) as {BrowserPersistence:typeof BrowserPersistence;SessionController:typeof SessionController};
const version13=await import('data:text/javascript;base64,'+readFileSync(new URL('./version13-runtime.mjs.bin',import.meta.url)).toString('base64')) as typeof old;
function attach(db:IDBDatabase,Runtime=BrowserPersistence){Object.assign(db,{close:()=>{}});const p=new Runtime('ai-texas-step5h-independent');Object.assign(p,{db,owner,writable:true});return p;}
function canonicalRows(rows:Map<string,unknown>){return [...rows].filter(([k])=>k.startsWith('v2:')).sort(([a],[b])=>a.localeCompare(b));}
function replicaIndices(rows:Map<string,unknown>){return [...rows.keys()].filter(k=>k.startsWith('packed-v1:hands:')).map(k=>Number(k.split(':').at(-1))).sort((a,b)=>a-b);}
const bytes=(rows:Map<string,unknown>)=>encode([...rows].sort(([a],[b])=>a.localeCompare(b)));
async function setup(){const s=transactionReference(legacy),port=attach(s.db);await port.load();return {...s,port};}
beforeAll(async()=>{
 const controller=new SessionController(new Memory());await controller.init();
 for(let i=0;i<COUNT;i++){
  await controller.startSession({...DEFAULT_SETTINGS,seats:2});const g=controller.data!.active!.game;
  await controller.act({type:'fold'},g.handId,g.revision);await controller.cashOut();expect(controller.error).toBe('');
 }
 original=controller.data!;controller.close();expect(original.hands).toHaveLength(COUNT);
 const prepared=await prepareSegments(original,null,null,{packHands:false});legacy=new Map(prepared.writes.map(w=>[w.key,w.entry]));
 for(let i=0;i<COUNT;i++){
  const source=legacy.get(segmentKey('hands',i)) as StoredSegment;
  const body={format:'ai-texas-packed-hand' as const,version:1 as const,index:i,previousHash:source.previousHash,hash:source.hash,graph:JSON.stringify(packHandGraph(source.value))};
  legacy.set(packedHandKey(i),body);
 }
 const envelope=structuredClone(prepared.envelope);envelope.packedHands={version:1,count:COUNT,tail:envelope.segments.hands.tail};resealManifest(envelope);
 legacy.set('current',envelope);legacy.set('lease',{owner,expires:Date.now()+12000});
 canonicalDigest=hash(canonicalRows(legacy));publicDigest=hash(await publicHistory(original.hands));
},60000);

describe('Step5H independent legacy replica retirement and canonical financial preservation',()=>{
 it('pins the actual Version13 compatibility runtime to its immutable source and compiled bytes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./version13-runtime.json',import.meta.url),'utf8')) as {sourceCommit:string;sourceHashes:Record<string,string>;bundleSHA256:string};
  const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');expect(manifest.sourceCommit).toBe('8419a0ec5f25eb208c14d87131d6c3edfd210c3e');
  expect(sha(readFileSync(new URL('./version13-runtime.mjs.bin',import.meta.url)))).toBe(manifest.bundleSHA256);
  for(const [p,h]of Object.entries(manifest.sourceHashes))expect(sha(execFileSync('git',['show',manifest.sourceCommit+':'+p]))).toBe(h);
 });
 it('reduces only redundant cold copies and preserves exact canonical records, public replay and independent full accounting',async()=>{
  const s=await setup(),revision=original.revision;expect(replicaIndices(s.records)).toHaveLength(COUNT);
  await s.port.optimizeStorage();
  expect(replicaIndices(s.records)).toEqual(Array.from({length:TAIL},(_,i)=>COUNT-TAIL+i));
  expect(hash(canonicalRows(s.records))).toBe(canonicalDigest);
  const full=await s.port.loadFullHistory();expect(hash(full)).toBe(hash(original));expect(full.revision).toBe(revision);
  expect(replayAccounting(full)).toEqual(replayAccounting(original));expect(hash(await publicHistory(full.hands))).toBe(publicDigest);
  const parsed=await parsePublicHistory(JSON.stringify(await publicHistory(full.hands)));
  expect(parsed.map(h=>h.handId)).toEqual(original.hands.map(h=>h.id));
  expect(JSON.stringify(parsed)).not.toMatch(/privateProfiles|personalitySeed|drawToken|deckCursor/);
  const audit=await s.port.auditCanonicalArchive();expect(audit.current).toBe(true);expect(audit.hands).toBe(COUNT);
 });
 // Keep all 124 indexed-read assertions, with independent compacted fixtures.
 // This separates archive lookup cost from full replay/export/audit checks;
 // every case retains the standard 20-second timeout.
 it.each([0,31,62,93])('preserves exact canonical indexed reads for 31 hands starting at %i after replica retirement',async start=>{
  const s=await setup();await s.port.optimizeStorage();
  expect(hash(canonicalRows(s.records))).toBe(canonicalDigest);
  for(let i=start;i<start+31;i++)expect(hash(await s.port.readHand(i))).toBe(hash(original.hands[i]));
 });
 it('compaction is idempotent and does not advance any financial event, hand ID, policy version or revision',async()=>{
  const s=await setup();await s.port.optimizeStorage();const before=bytes(s.records);await s.port.optimizeStorage();
  expect(bytes(s.records)).toBe(before);const full=await s.port.loadFullHistory();expect(encode(full.ledger)).toBe(encode(original.ledger));
  expect(full.hands.map(h=>[h.id,h.hash,h.privateProfiles])).toEqual(original.hands.map(h=>[h.id,h.hash,h.privateProfiles]));
 });
 it.each(['missing-canonical','corrupted-canonical','resealed-outer-corruption'] as const)('never deletes a surviving replica when %s makes its cold canonical record untrustworthy',async mode=>{
  const s=await setup(),key=segmentKey('hands',0),entry=structuredClone(s.records.get(key)) as StoredSegment;
  if(mode==='missing-canonical')s.records.delete(key);
  else{(entry.value as StoredHand).startedAt='1900-01-01T00:00:00.000Z';if(mode==='resealed-outer-corruption'){const {hash:_,...body}=entry;void _;entry.hash=hash(body);}s.records.set(key,entry);}
  const before=bytes(s.records);await expect(s.port.optimizeStorage()).rejects.toThrow();expect(bytes(s.records)).toBe(before);
  expect(s.records.has(packedHandKey(0))).toBe(true);expect((s.records.get('current') as SegmentedEnvelope).data.wallet).toBe(original.wallet);
 });
 it('atomic interruption while publishing the new manifest retains every old copy and retry does not credit money',async()=>{
  const s=await setup(),before=bytes(s.records);s.control.abortOnPutKey='current';
  await expect(s.port.optimizeStorage()).rejects.toThrow();expect(bytes(s.records)).toBe(before);
  const reopened=attach(s.db);await reopened.load();await reopened.optimizeStorage();
  expect(replicaIndices(s.records)).toHaveLength(TAIL);expect(replayAccounting(await reopened.loadFullHistory())).toEqual(replayAccounting(original));
 });
 it('a quota exception during manifest publication rolls back all deletions and leaves original history recoverable',async()=>{
  const s=await setup(),before=bytes(s.records),base=s.db.transaction.bind(s.db);let fail=true;
  Object.assign(s.db,{transaction:(...args:Parameters<IDBDatabase['transaction']>)=>{
   const tx=base(...args),store=tx.objectStore('kv'),put=store.put.bind(store);
   Object.assign(store,{put:(value:unknown,key:string)=>{if(fail&&key==='current'){fail=false;throw new DOMException('Injected independent quota exhaustion','QuotaExceededError');}return put(value,key);}});return tx;
  }});
  await expect(s.port.optimizeStorage()).rejects.toThrow(/quota|Quota|compaction|preserved|Storage/i);expect(bytes(s.records)).toBe(before);
  expect(hash(await s.port.loadFullHistory())).toBe(hash(original));await s.port.optimizeStorage();expect(replicaIndices(s.records)).toHaveLength(TAIL);
 });
 it('does not let a stale tab trim copies after another owner acquires the lease',async()=>{
  const s=await setup();s.records.set('lease',{owner:'different-tab',expires:Date.now()+12000});const before=bytes(s.records);
  await expect(s.port.optimizeStorage()).rejects.toThrow(/Another tab|ownership|lease/i);expect(bytes(s.records)).toBe(before);
 });
 it.each([['V7-R',old],['Version13',version13]] as const)('actual frozen %s reads trimmed saves, makes one explicit adjustment, and latest code restores exact original histories',async(_name,runtime)=>{
  const s=await setup();await s.port.optimizeStorage();const legacyPort=attach(s.db,runtime.BrowserPersistence),fallback=new runtime.SessionController(legacyPort);await fallback.init();
  expect(fallback.status).toBe('ready');expect(fallback.data!.wallet).toBe(original.wallet);
  // Version13 legitimately returns a compact resident suffix; V7-R returns all.
  const legacyFull=typeof legacyPort.loadFullHistory==='function'?await legacyPort.loadFullHistory():fallback.data;expect(hash(legacyFull)).toBe(hash(original));
  await fallback.adjustBankroll(original.wallet+53,'independent older compatible writer');expect(fallback.error).toBe('');
  const reopened=attach(s.db);await reopened.load();const full=await reopened.loadFullHistory();
  expect(full.wallet).toBe(original.wallet+53);expect(hash(full.hands)).toBe(hash(original.hands));expect(hash(await publicHistory(full.hands))).toBe(publicDigest);
  expect(full.ledger.filter(e=>e.note==='independent older compatible writer')).toHaveLength(1);
  expect(replayAccounting(full).poker).toBe(replayAccounting(original).poker);
 });
 it('preserves the exact verified populated pre-upgrade snapshot and receipt across replica optimization',async()=>{
  const prior={format:'ai-texas-hold-em-private-device',version:1,data:original,checksum:hash(original)},s=transactionReference(new Map<string,unknown>([['current',prior],['lease',{owner,expires:Date.now()+12000}]])),port=attach(s.db);
  await port.load();const backup=encode(s.records.get(PRE_UPGRADE_KEY)),receipt=encode(s.records.get(MIGRATION_RECEIPT_KEY));
  await port.optimizeStorage();expect(encode(s.records.get(PRE_UPGRADE_KEY))).toBe(backup);expect(encode(s.records.get(MIGRATION_RECEIPT_KEY))).toBe(receipt);
  expect(hash((await port.inspectUpgradeBackup()).snapshot)).toBe(hash(original));
  const full=await port.loadFullHistory();expect(hash(full.hands)).toBe(hash(original.hands));expect(replayAccounting(full)).toEqual(replayAccounting(original));
 });
 it('a cached Version13 writer is fenced after same-revision compaction changes the manifest',async()=>{
  const s=await setup(),older=new version13.SessionController(attach(s.db,version13.BrowserPersistence));await older.init();const revision=older.data!.revision;
  await s.port.optimizeStorage();expect((s.records.get('current') as SegmentedEnvelope).data.revision).toBe(revision);const before=bytes(s.records);
  await older.adjustBankroll(older.data!.wallet+88,'stale version13 writer');expect(older.status).toBe('readonly');expect(bytes(s.records)).toBe(before);
 });
 it('ordinary settlement refuses to retire its only surviving archived copy, then retries and cashes out exactly once after repair',async()=>{
  const s=await setup();await s.port.optimizeStorage();const controller=new SessionController(s.port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});expect(controller.error).toBe('');
  const key=segmentKey('hands',COUNT-TAIL),originalRow=structuredClone(s.records.get(key));s.records.delete(key);const before=bytes(s.records),g=controller.data!.active!.game;
  await controller.act({type:'fold'},g.handId,g.revision);expect(controller.error).toMatch(/Canonical hand|cache|retirement/);expect(bytes(s.records)).toBe(before);expect(s.records.has(packedHandKey(COUNT-TAIL))).toBe(true);
  s.records.set(key,originalRow);const port=attach(s.db),reopened=new SessionController(port);await reopened.init();expect(reopened.status).toBe('ready');
  const current=reopened.data!.active!.game;expect(current.handId).toBe(g.handId);expect(current.revision).toBe(g.revision);
  await reopened.act({type:'fold'},current.handId,current.revision);await reopened.cashOut();expect(reopened.error).toBe('');const committed=await port.loadFullHistory();await reopened.cashOut();const repeated=await port.loadFullHistory();
  // A no-active-session command may publish a no-money revision. Idempotence
  // here means no extra transfer, settlement, bankroll change or history edit.
  expect(repeated.wallet).toBe(committed.wallet);expect(hash(repeated.ledger)).toBe(hash(committed.ledger));expect(hash(repeated.hands)).toBe(hash(committed.hands));
  const full=await port.loadFullHistory();expect(full.hands).toHaveLength(COUNT+1);expect(hash(full.hands.slice(0,COUNT))).toBe(hash(original.hands));
  expect(full.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(COUNT+1);expect(full.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(COUNT+1);
  expect(full.wallet).toBe(original.wallet-100);expect(replayAccounting(full).poker).toBe(replayAccounting(original).poker-100);
  expect(replicaIndices(s.records)).toEqual(Array.from({length:TAIL},(_,i)=>COUNT+1-TAIL+i));
 });
 it('tampering a retained hot replica falls back to its exact canonical copy without rewriting or duplicating settlement',async()=>{
  const s=await setup();await s.port.optimizeStorage();const key=packedHandKey(COUNT-1),replica=structuredClone(s.records.get(key)) as PackedHandSegment;replica.graph='invalid replica text';s.records.set(key,replica);
  const before=bytes(s.records),port=attach(s.db);const restored=await port.load();expect(restored!.wallet).toBe(original.wallet);
  expect(hash(await port.loadFullHistory())).toBe(hash(original));expect(bytes(s.records)).toBe(before);expect(port.recoveryDiagnostics.some(x=>/canonical/i.test(x))).toBe(true);
 });
});
