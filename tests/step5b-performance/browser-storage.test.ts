import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {canonical,digest,migrateData,validateData} from '../../src/storage/integrity';
import {transactionReference} from '../step36/transaction-reference';
import {segmentKey,packedHandKey,type Envelope,type SegmentedEnvelope,restoreSegments} from '../../src/storage/segments';
import type {AppData} from '../../src/session/types';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const frozenURL='../browser/step5b-baseline.js';
const baseline=await import(frozenURL) as {BrowserPersistence:typeof BrowserPersistence};
function attach(port:BrowserPersistence,db:IDBDatabase,owner='test-owner'){const internals=port as unknown as {db:IDBDatabase;owner:string};internals.db=db;internals.owner=owner;port.writable=true;}
async function setup(){const data=await migrateData(fixture.streets.flop),prior:Envelope={format:'ai-texas-hold-em-private-device',version:1,data,checksum:await digest(data)};const fake=transactionReference(new Map<string,unknown>([['current',prior],['lease',{owner:'test-owner',expires:Date.now()+12000}]]));const port=new BrowserPersistence('ai-texas-step5b-test-storage');attach(port,fake.db);return{...fake,port,prior};}
afterEach(()=>vi.unstubAllGlobals());
describe('Step5B populated segmented-storage atomicity, downgrade refusal and retry',()=>{
 it('upgrades actual schema4 v1 to segmentedv2 once and retains exact canonical records and original envelope',async()=>{
  const {port,records,prior}=await setup(),saved=await port.load();expect(saved!.revision).toBe(prior.data.revision+1);expect(saved!.ledger).toEqual(prior.data.ledger);expect(saved!.hands).toEqual(prior.data.hands);expect(records.get('pre-segment-v1')).toEqual(prior);const bytes=canonical([...records]);expect(await port.load()).toEqual(saved);expect(canonical([...records])).toBe(bytes);
 });
 it.each([segmentKey('ledger',0),segmentKey('hands',0),segmentKey('closedSessions',0),'current'])('rolls back interrupted migration at%s then retries without duplicate events',async key=>{
  const {port,records,control,prior}=await setup(),bytes=canonical([...records]);control.abortOnPutKey=key;await expect(port.load()).rejects.toThrow(/Storage write failed/);expect(canonical([...records])).toBe(bytes);const saved=await port.load();expect(saved!.ledger).toEqual(prior.data.ledger);expect(saved!.hands).toEqual(prior.data.hands);await validateData(saved!);
 });
 it('actual Step5A schema4 reader refuses segmented save and cached old writer is revisionfenced without touching any bytes',async()=>{
  const {port,records,db,prior}=await setup(),old=new baseline.BrowserPersistence('ai-texas-step5b-test-storage');attach(old,db);const cached=await old.load();await port.load();const bytes=canonical([...records]);await expect(old.load()).rejects.toThrow(/Unknown guest snapshot format/);cached!.revision++;await expect(old.commit(prior.data.revision,cached!)).rejects.toThrow(/revision changed/);expect(canonical([...records])).toBe(bytes);
 });
 it('detects retained historical corruption, restores only an independently verified identical copy, and rejects damage to both copies',async()=>{
  const {port,records}=await setup(),verified=await port.load();const key=segmentKey('hands',0),record=structuredClone(records.get(key)) as {value:{net:number}};record.value.net++;records.set(key,record);const bytes=canonical([...records]);
  // Step5D adds a redundant lossless representation. It may recover the exact
  // original hash-verified hand; it must not certify the damaged retained copy.
  expect(await port.load()).toEqual(verified);expect(port.legacyArchiveAuditStatus).toBe('not-audited');expect(canonical([...records])).toBe(bytes);
  await expect(port.auditCanonicalArchive()).rejects.toThrow(/integrity/);expect(port.legacyArchiveAuditStatus).toBe('failed');expect(canonical([...records])).toBe(bytes);
  records.delete(packedHandKey(0));const bothDamaged=canonical([...records]);await expect(port.load()).rejects.toThrow(/integrity/);expect(canonical([...records])).toBe(bothDamaged);
 });
 it('fences stale concurrent writers and stale ownership inside the commit transaction',async()=>{
  const {port,records,db}=await setup();await port.load();const second=new BrowserPersistence('ai-texas-step5b-test-storage');attach(second,db);const a=new SessionController(port),b=new SessionController(second);await a.init();await b.init();await a.adjustBankroll(190100,'firstwriter');await b.adjustBankroll(190200,'stalewriter');expect(b.status).toBe('readonly');expect((records.get('current') as SegmentedEnvelope).data.wallet).toBe(190100);records.set('lease',{owner:'other-tab',expires:Date.now()+12000});await a.adjustBankroll(190300,'lostlease');expect(a.status).toBe('readonly');expect((records.get('current') as SegmentedEnvelope).data.wallet).toBe(190100);
 });
 it('controller retries a failed ordinary delta after full reload with new object identities and no duplicate money',async()=>{
  const {port,records,control}=await setup();const c=new SessionController(port);await c.init();const before=c.data!,wallet=before.wallet;control.abortOnPutKey='current';await c.adjustBankroll(wallet+123,'retry-once');expect(c.status).toBe('error');expect(c.data).toBe(before);await c.retry();expect(c.status).toBe('ready');expect(c.data!.wallet).toBe(wallet+123);expect(c.data!.ledger.filter(e=>e.note==='retry-once')).toHaveLength(1);const manifest=records.get('current') as SegmentedEnvelope;expect(await restoreSegments(manifest,async keys=>keys.map(k=>records.get(k)))).toEqual(c.data);
 });
 it('a real closed session remains recoverable via previous manifest after next-session creation',async()=>{
  const fake=transactionReference(new Map<string,unknown>([['lease',{owner:'test-owner',expires:Date.now()+12000}]]));const port=new BrowserPersistence('ai-texas-step5b-empty');attach(port,fake.db);const c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();const closed=c.data;await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.error).toBe('');const previous=fake.records.get('previous') as SegmentedEnvelope;expect(await restoreSegments(previous,async keys=>keys.map(k=>fake.records.get(k)))).toEqual(closed);await validateData(c.data!);
 });
});
