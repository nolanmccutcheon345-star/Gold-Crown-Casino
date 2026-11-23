import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,StoredHand} from '../../src/session/types';
import {migrateData} from '../../src/storage/integrity';
import {packHandGraph,unpackHandText} from '../../src/storage/packed-hand';
import {prepareSegments,restoreSegments,packedHandKey,segmentKey,type PackedHandSegment,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {transactionReference} from '../step36/transaction-reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';
import {AtomicPort,encode,hash,resealManifest} from './reference';

const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
let original:AppData,source:SegmentedEnvelope,sourceRecords:Map<string,unknown>;
beforeAll(async()=>{
 original=await migrateData(fixture.streets.flop);const p=await prepareSegments(original,null,null,{packHands:true});source=p.envelope;
 sourceRecords=new Map([...p.writes,...(p.replicas??[])].map(w=>[w.key,w.entry]));
});
const archive=()=>({envelope:structuredClone(source),records:structuredClone(sourceRecords)});
const cloneReader=(records:Map<string,unknown>)=>async(keys:string[])=>keys.map(k=>structuredClone(records.get(k)));
function attach(db:IDBDatabase){const p=new BrowserPersistence('ai-texas-step5d-independent');Object.assign(p,{db,owner:'independent-review',writable:true});return p;}

describe('Step5D independent packed snapshot trust and fallback',()=>{
 it('reconstructs both copies independently and agrees with event replay',async()=>{
  const {envelope,records}=archive(),seen:string[]=[];
  const packed=await restoreSegments(envelope,async keys=>{seen.push(...keys);return cloneReader(records)(keys);});
  expect(seen.some(key=>key.startsWith('packed-v1:hands:'))).toBe(true);expect(seen.some(key=>key.startsWith('v2:hands:'))).toBe(false);
  const canonicalSeen:string[]=[],full=await restoreSegments(structuredClone(source),async keys=>{canonicalSeen.push(...keys);return cloneReader(records)(keys);},{canonicalOnly:true});
  expect(canonicalSeen.some(key=>key.startsWith('packed-v1:'))).toBe(false);expect(encode(packed)).toBe(encode(full));expect(replayAccounting(packed)).toEqual(replayAccounting(original));
 });
 it.each(['swapped-graph','missing-copy','bad-type','cycle-reference'] as const)('uses verified canonical fallback for %s and leaves both copies untouched',async attack=>{
  const {envelope,records}=archive(),key=packedHandKey(0),p=records.get(key) as PackedHandSegment;
  if(attack==='swapped-graph')p.graph=structuredClone((records.get(packedHandKey(1)) as PackedHandSegment).graph);
  if(attack==='missing-copy')records.delete(key);if(attack==='bad-type')(p as unknown as {version:number}).version=99;
  if(attack==='cycle-reference')p.graph=JSON.stringify({format:'ai-texas-hand-graph',version:1,nodes:[['array',[{ref:0}]]],root:{ref:0}});
  const before=encode([...records]),diagnostics:string[]=[];
  const restored=await restoreSegments(envelope,cloneReader(records),{onDiagnostic:d=>diagnostics.push(d)});
  expect(replayAccounting(restored)).toEqual(replayAccounting(original));expect(diagnostics).toHaveLength(1);expect(diagnostics[0]).toMatch(/canonical|original/i);expect(encode([...records])).toBe(before);
 });
 it.each(['missing','bit-corruption','wrong-original-index'] as const)('cannot hide %s financial ledger events behind a valid packed history',async attack=>{
  const {envelope,records}=archive(),key=segmentKey('ledger',2),entry=records.get(key) as StoredSegment;
  if(attack==='missing')records.delete(key);if(attack==='bit-corruption')(entry.value as {walletDelta:number}).walletDelta++;if(attack==='wrong-original-index')entry.index++;
  await expect(restoreSegments(envelope,cloneReader(records))).rejects.toThrow(/missing|integrity|reordered/);
 });
 it('still checks the inner canonical hand hash after independently resealing the final packed outer hash',async()=>{
  const {envelope,records}=archive(),index=envelope.segments.hands.count-1,p=records.get(packedHandKey(index)) as PackedHandSegment;
  const hand=structuredClone(unpackHandText(p.graph)) as StoredHand;hand.startedAt='2000-01-01T00:00:00.000Z';p.graph=JSON.stringify(packHandGraph(hand));
  p.hash=hash({index:p.index,previousHash:p.previousHash,value:hand});envelope.segments.hands.tail=p.hash;envelope.packedHands!.tail=p.hash;resealManifest(envelope);
  const diagnostics:string[]=[];await expect(restoreSegments(envelope,cloneReader(records),{onDiagnostic:d=>diagnostics.push(d)})).rejects.toThrow(/Storage segment checkpoint mismatch/);
  expect(diagnostics).toHaveLength(1);expect(diagnostics[0]).toMatch(/Saved hand integrity/);
 });
 it('reports redundant archive integrity separately and does not silently repair its missing record',async()=>{
  const {envelope,records}=archive();records.set('current',envelope);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});records.delete(segmentKey('hands',1));
  const fake=transactionReference(records),p=attach(fake.db);const data=await p.load();expect(data).not.toBeNull();expect(replayAccounting(data!)).toEqual(replayAccounting(original));
  expect(p.legacyArchiveAuditStatus).toBe('not-audited');const before=encode([...fake.records]);await expect(p.auditCanonicalArchive()).rejects.toThrow();expect(p.legacyArchiveAuditStatus).toBe('failed');expect(encode([...fake.records])).toBe(before);
  expect(p.recoveryDiagnostics.some(s=>/archive.*failed/i.test(s))).toBe(true);
 });
 it('does not label a newer manifest verified when an earlier asynchronous archive audit completes',async()=>{
  const {envelope,records}=archive();records.set('current',envelope);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});
  const fake=transactionReference(records),p=attach(fake.db),c=new SessionController(p);await c.init();expect(c.status).toBe('ready');
  const internals=p as unknown as {readKeys:(db:IDBDatabase,keys:string[])=>Promise<unknown[]>},read=internals.readKeys.bind(p);
  let reached!:()=>void,release!:()=>void;const waiting=new Promise<void>(resolve=>{reached=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});let intercepted=false;
  internals.readKeys=async(db,keys)=>{const values=await read(db,keys);if(!intercepted&&keys[0]?.startsWith('v2:ledger:')){intercepted=true;reached();await barrier;}return values;};
  const audit=p.auditCanonicalArchive();await waiting;const oldRevision=c.data!.revision;
  await c.adjustBankroll(c.data!.wallet+17,'new revision while old audit waits');expect(c.error).toBe('');expect(c.data!.revision).toBe(oldRevision+1);
  await p.load();expect(p.legacyArchiveAuditStatus).toBe('not-audited');const before=encode([...fake.records]);
  release();await audit.catch(()=>undefined);expect(p.legacyArchiveAuditStatus).not.toBe('verified');expect(encode([...fake.records])).toBe(before);expect(replayAccounting(c.data!).poker).toBe(replayAccounting(original).poker);
 });
 it('rejects missing data in both complete hand copies without resetting wallet',async()=>{
  const {envelope,records}=archive();records.delete(segmentKey('hands',1));records.delete(packedHandKey(1));const before=encode([...records]);
  await expect(restoreSegments(envelope,cloneReader(records))).rejects.toThrow(/missing|reordered/);expect(encode([...records])).toBe(before);
 });
 it('does not allow a reader to mutate the packed transport after it has been validated',async()=>{
  const {envelope,records}=archive(),retained=records.get(packedHandKey(0)) as PackedHandSegment;let mutationSucceeded=false;
  const data=await restoreSegments(envelope,async keys=>{
   if(keys[0]?.startsWith('v2:closedSessions:')){try{retained.index=999;mutationSucceeded=true;}catch{/* Exact validated packed bytes are immutable. */}}
   return keys.map(k=>records.get(k));
  });expect(mutationSucceeded).toBe(false);expect(replayAccounting(data)).toEqual(replayAccounting(original));
 });
});

describe('Step5D independent optional storage installation safety',()=>{
 it.each([packedHandKey(0),'pre-packed-v1','current'])('interrupted installation at %s publishes no partial checkpoint or financial change',async key=>{
  const legacy=await prepareSegments(original,null,null),records=new Map<string,unknown>(legacy.writes.map(w=>[w.key,w.entry]));records.set('current',legacy.envelope);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});
  const fake=transactionReference(records);fake.control.abortOnPutKey=key;const p=attach(fake.db),before=encode([...fake.records]);
  const restored=await p.load();expect(replayAccounting(restored!)).toEqual(replayAccounting(original));expect(encode([...fake.records])).toBe(before);expect(p.recoveryDiagnostics.length).toBeGreaterThan(0);
  await p.optimizeStorage();const current=fake.records.get('current') as SegmentedEnvelope;expect(current.data.revision).toBe(original.revision);expect(current.packedHands?.count).toBe(original.hands.length);
  const reloaded=await p.load();expect(replayAccounting(reloaded!)).toEqual(replayAccounting(original));expect(reloaded!.ledger).toEqual(original.ledger);expect(reloaded!.hands).toEqual(original.hands);
 });
 it('retains the exact preceding financial snapshot through interrupted and completed representation installation',async()=>{
  const legacy=await prepareSegments(original,null,null),previous={format:'ai-texas-hold-em-private-device',version:1,data:structuredClone(original),checksum:hash(original)};
  const records=new Map<string,unknown>(legacy.writes.map(w=>[w.key,w.entry]));records.set('current',legacy.envelope);records.set('previous',previous);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});
  const fake=transactionReference(records);fake.control.abortOnPutKey='current';const p=attach(fake.db);await p.load();expect(encode(fake.records.get('previous'))).toBe(encode(previous));expect(fake.records.has('pre-packed-v1')).toBe(false);
  await p.optimizeStorage();expect(encode(fake.records.get('previous'))).toBe(encode(previous));expect(encode(fake.records.get('pre-packed-v1'))).toBe(encode(legacy.envelope));
 });
 it.each(['none','custom','pokerstars-usd-2026'] as const)('packs actual newly settled %s hands without JSON normalization',async rakeMode=>{
  const port=new AtomicPort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,rakeMode,rakeBasisPoints:500,rakeCap:300});
  const game=c.data!.active!.game;await c.act({type:'fold'},game.handId,game.revision);expect(c.error).toBe('');expect(c.data!.hands).toHaveLength(1);
  const prepared=await prepareSegments(c.data!,null,null,{packHands:true});expect(prepared.replicas).toHaveLength(1);
  const rows=new Map([...prepared.writes,...prepared.replicas!].map(w=>[w.key,w.entry]));const restored=await restoreSegments(prepared.envelope,async keys=>keys.map(k=>rows.get(k)));
  expect(encode(restored)).toBe(encode(c.data));expect(replayAccounting(restored)).toEqual(replayAccounting(c.data!));c.close();
 });
});

describe('Step5D optional encoding never prevents canonical persistence',()=>{
 it('keeps a valid legacy-canonical record with an undefined optional field via an explicit diagnostic',async()=>{
  const data=structuredClone(original);Object.assign(data.hands[0],{optionalLegacyMetadata:undefined});
  const prepared=await prepareSegments(data,null,null,{packHands:true});expect(prepared.envelope.packedHands).toBeUndefined();expect(prepared.replicas).toBeUndefined();expect(prepared.diagnostics).toHaveLength(1);
  const records=new Map(prepared.writes.map(w=>[w.key,w.entry]));const restored=await restoreSegments(prepared.envelope,async keys=>keys.map(k=>records.get(k)));
  expect(encode(restored)).toBe(encode(original));expect(replayAccounting(restored)).toEqual(replayAccounting(original));
 });
});

const recoveryModule='../step5c-rollback/generated/recovery.js';
const frozenRecovery=await import(recoveryModule) as {BrowserPersistence:typeof BrowserPersistence;SessionController:typeof SessionController};
function attachFrozen(db:IDBDatabase){const p=new frozenRecovery.BrowserPersistence('ai-texas-step5d-independent');Object.assign(p,{db,owner:'independent-review',writable:true});return p;}

describe('Step5D independent frozen V7-R and same-revision metadata fencing',()=>{
 it('fences a cached V7-R writer after optional installation changes only the manifest checksum',async()=>{
  const legacy=await prepareSegments(original,null,null),records=new Map<string,unknown>(legacy.writes.map(w=>[w.key,w.entry]));records.set('current',legacy.envelope);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});
  const fake=transactionReference(records),old=new frozenRecovery.SessionController(attachFrozen(fake.db));await old.init();expect(old.status).toBe('ready');
  const current=attach(fake.db),latest=await current.load();expect(latest!.revision).toBe(old.data!.revision);expect((fake.records.get('current') as SegmentedEnvelope).packedHands).toBeTruthy();const before=encode([...fake.records]);
  await old.adjustBankroll(old.data!.wallet+500,'stale same-revision writer');expect(old.status).toBe('readonly');expect(encode([...fake.records])).toBe(before);
 });
 it('reads the packed-manifest state through actual frozen V7-R, preserves all records and resumes in current code after a legacy write',async()=>{
  const {envelope,records}=archive();records.set('current',envelope);records.set('lease',{owner:'independent-review',expires:Date.now()+12000});const fake=transactionReference(records);
  const old=new frozenRecovery.SessionController(attachFrozen(fake.db));await old.init();expect(old.status).toBe('ready');expect(replayAccounting(old.data!)).toEqual(replayAccounting(original));
  await old.adjustBankroll(old.data!.wallet+321,'old compatible code adjustment');expect(old.error).toBe('');expect((fake.records.get('current') as SegmentedEnvelope).packedHands).toBeUndefined();
  const afterOld=structuredClone(old.data!),fresh=new SessionController(attach(fake.db));await fresh.init();expect(fresh.status).toBe('ready');expect(encode(fresh.data)).toBe(encode(afterOld));
  expect(replayAccounting(fresh.data!).poker).toBe(replayAccounting(original).poker);expect(fresh.data!.hands).toEqual(original.hands);expect(fresh.data!.ledger.filter(e=>e.note==='old compatible code adjustment')).toHaveLength(1);
 });
});
