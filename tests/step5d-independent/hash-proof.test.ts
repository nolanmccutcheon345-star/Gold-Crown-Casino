import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {GENESIS,checkChain,digestPackedHandSegment,migrateData,canonical} from '../../src/storage/integrity';
import {auditSnapshot,auditRestoredSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {packHandGraph,unpackHandText} from '../../src/storage/packed-hand';
import {prepareSegments,restoreSegments,packedHandKey,segmentKey,type StoredSegment,type PackedHandSegment} from '../../src/storage/segments';
import type {AppData,StoredHand} from '../../src/session/types';
import {hash,encode,resealManifest} from './reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';

function payload(){const body={previousHash:GENESIS,payload:'independent proof boundary '.repeat(400)};return {...body,hash:hash(body)};}
function decode<T>(value:T):T{return unpackHandText(JSON.stringify(packHandGraph(value))) as T;}
function outer(value:unknown){return {index:0,previousHash:GENESIS,value};}
afterEach(()=>vi.restoreAllMocks());

describe('Step5D independent exact-object hash proof boundary',()=>{
 it('executes both original hashes before proof and always recomputes an explicit chain audit',async()=>{
  const hand=decode(payload()),record=outer(hand),spy=vi.spyOn(globalThis.crypto.subtle,'digest');
  expect(await digestPackedHandSegment(record,hash(record))).toBe(hash(record));expect(spy).toHaveBeenCalledTimes(2);
  spy.mockClear();await checkChain([hand],true);expect(spy).toHaveBeenCalledTimes(0);
  await checkChain([hand]);expect(spy).toHaveBeenCalledTimes(1);expect(canonical(hand)).toBe(encode(hand));
 });
 it('never grants proof after an invalid inner hash even when the outer hash is correct',async()=>{
  const hand=decode({...payload(),hash:'1'.repeat(64)}),record=outer(hand);
  await expect(digestPackedHandSegment(record,hash(record))).rejects.toThrow(/hand integrity/);
  const spy=vi.spyOn(globalThis.crypto.subtle,'digest');await expect(checkChain([hand],true)).rejects.toThrow(/record integrity/);expect(spy).toHaveBeenCalledTimes(1);
 });
 it('never grants proof after an invalid outer hash even when the inner hash is correct',async()=>{
  const hand=decode(payload());await expect(digestPackedHandSegment(outer(hand),'1'.repeat(64))).rejects.toThrow(/segment integrity/);
  const spy=vi.spyOn(globalThis.crypto.subtle,'digest');await checkChain([hand],true);expect(spy).toHaveBeenCalledTimes(1);
 });
 it('revokes any earlier exact-object proof after a subsequent outer comparison fails',async()=>{
  const hand=decode(payload()),record=outer(hand);await digestPackedHandSegment(record,hash(record));
  await expect(digestPackedHandSegment(record,'1'.repeat(64))).rejects.toThrow(/segment integrity/);
  const spy=vi.spyOn(globalThis.crypto.subtle,'digest');await checkChain([hand],true);expect(spy).toHaveBeenCalledTimes(1);
 });
 it('does not transfer hash proof to a structurally equal cloned and caller-frozen object',async()=>{
  const hand=decode(payload()),record=outer(hand);await digestPackedHandSegment(record,hash(record));
  const cloned=Object.freeze(structuredClone(hand)),spy=vi.spyOn(globalThis.crypto.subtle,'digest');
  await checkChain([cloned],true);expect(spy).toHaveBeenCalledTimes(1);
  await expect(digestPackedHandSegment(outer(cloned),hash(outer(cloned)))).rejects.toThrow(/private immutable/);
 });
 it.each(['reordered','duplicate'] as const)('does not bypass %s sequence validation for independently verified immutable records',async attack=>{
  const first=decode(payload()),body={previousHash:first.hash,payload:'second'.repeat(2000)},second=decode({...body,hash:hash(body)});
  for(const hand of [first,second]){const record=outer(hand);await digestPackedHandSegment(record,hash(record));}
  await expect(checkChain(attack==='reordered'?[second,first]:[first,first],true)).rejects.toThrow(/chain is broken/);
 });
});

const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
let original:AppData;
beforeAll(async()=>{original=await migrateData(fixture.streets.flop);});
async function packed(){const p=await prepareSegments(original,null,null,{packHands:true});return {envelope:structuredClone(p.envelope),records:new Map<string,unknown>([...p.writes,...p.replicas!].map(w=>[w.key,structuredClone(w.entry)]))};}

describe('Step5D independent packed proof never substitutes financial or semantic audit',()=>{
 it('explicitly rehashes a recovered snapshot and agrees with independent accounting',async()=>{
  const {envelope,records}=await packed(),restored=await restoreSegments(envelope,async keys=>keys.map(k=>records.get(k)));
  expect(isVerifiedSnapshot(restored)).toBe(true);const spy=vi.spyOn(globalThis.crypto.subtle,'digest');
  await auditSnapshot(restored);expect(spy.mock.calls.length).toBeGreaterThanOrEqual(restored.hands.length);
  expect(replayAccounting(restored)).toEqual(replayAccounting(original));
 });
 it('rechecks current financial state even when every historical hand already has proof',async()=>{
  const {envelope,records}=await packed(),restored=await restoreSegments(envelope,async keys=>keys.map(k=>records.get(k)));
  const wrongWallet={...restored,wallet:restored.wallet+1};await expect(auditRestoredSnapshot(wrongWallet)).rejects.toThrow(/Wallet does not reconcile/);expect(isVerifiedSnapshot(wrongWallet)).toBe(false);
 });
 it.each(['net','ruleset'] as const)('rejects semantic %s corruption with independently recomputed valid inner and outer hashes',async attack=>{
  const {envelope,records}=await packed(),i=envelope.segments.hands.count-1,entry=records.get(segmentKey('hands',i)) as StoredSegment,hand=entry.value as StoredHand;
  if(attack==='net')hand.net++;
  else {const profile=hand.view.profile;hand.provenance={version:1,mode:'cash',source:'csprng',ruleset:{id:profile.id,version:profile.version,fingerprint:hash(profile)}};hand.frames[0].profile.version+='-tampered';}
  const {hash:_discarded,...inner}=hand;void _discarded;hand.hash=hash(inner);const outerRecord={index:entry.index,previousHash:entry.previousHash,value:hand};entry.hash=hash(outerRecord);
  const replica=records.get(packedHandKey(i)) as PackedHandSegment;replica.hash=entry.hash;replica.graph=JSON.stringify(packHandGraph(hand));
  envelope.segments.hands.tail=entry.hash;envelope.packedHands!.tail=entry.hash;resealManifest(envelope);const before=encode([...records]);
  await expect(restoreSegments(envelope,async keys=>keys.map(k=>records.get(k)))).rejects.toThrow(attack==='net'?/Invalid completed hand|Hand result does not reconcile/:/provenance|ruleset/i);
  expect(encode([...records])).toBe(before);
 });
});
