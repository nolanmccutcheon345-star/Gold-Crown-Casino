import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {canonical,migrateData,digest} from '../../src/storage/integrity';
import {auditSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {packHandGraph,unpackHandGraph} from '../../src/storage/packed-hand';
import {prepareSegments,restoreSegments,segmentKey,packedHandKey,type PreparedSnapshot,type PackedHandSegment} from '../../src/storage/segments';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {Archetype} from '../../src/contracts';
import {replayAccounting} from '../step5c-independent/accounting-reference';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const recordMap=(prepared:PreparedSnapshot)=>new Map<string,unknown>([...prepared.writes,...(prepared.replicas??[])].map(w=>[w.key,structuredClone(w.entry)]));
async function packed(){const original=await migrateData(fixture.streets.flop),prepared=await prepareSegments(original,null,null,{packHands:true});return {original,prepared,records:recordMap(prepared)};}
describe('bounded lossless history replicas with complete canonical financial verification',()=>{
 it.each(['preflop','flop','turn','river'])('preserves every %s canonical byte, independent financial replay and old archive',async street=>{
  const original=await migrateData(fixture.streets[street]),prepared=await prepareSegments(original,null,null,{packHands:true}),records=recordMap(prepared),reads:string[]=[];
  const restored=await restoreSegments(structuredClone(prepared.envelope),async keys=>{reads.push(...keys);return keys.map(k=>structuredClone(records.get(k)));});
  expect(canonical(restored)).toBe(canonical(original));expect(replayAccounting(restored)).toEqual(replayAccounting(original));expect(isVerifiedSnapshot(restored)).toBe(true);
  expect(reads.some(k=>k.startsWith('packed-v1:hands:'))).toBe(true);expect(reads.some(k=>k.startsWith('v2:hands:'))).toBe(false);
  const independent=await restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(k=>structuredClone(records.get(k))),{canonicalOnly:true});expect(canonical(independent)).toBe(canonical(restored));
  await expect(auditSnapshot(structuredClone(restored))).resolves.toBeTruthy();
 });
 it.each(['nit','tag','lag','station','passive-reg','maniac','fit-or-fold','stronger-reg'] as Archetype[])('encodes actual unroundtripped %s session/settlement without changing money',async archetype=>{
  const port:PersistencePort={async load(){return null;},async commit(){},close(){}};const c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,archetypes:[archetype]});
  const game=c.data!.active!.game;await c.act({type:'fold'},game.handId,game.revision);expect(c.error).toBe('');const source=c.data!,packed=await prepareSegments(source,null,null,{packHands:true});
  expect(packed.diagnostics).toBeUndefined();expect(packed.replicas).toHaveLength(1);const records=recordMap(packed),restored=await restoreSegments(packed.envelope,async keys=>keys.map(key=>records.get(key)));
  expect(canonical(restored)).toBe(canonical(source));expect(replayAccounting(restored)).toEqual(replayAccounting(source));c.close();
 });
 it('does not authorize financial state merely by decoding/freeze provenance',()=>{const decoded=unpackHandGraph(packHandGraph({wallet:100000000})) as AppData;expect(Object.isFrozen(decoded)).toBe(true);expect(isVerifiedSnapshot(decoded)).toBe(false);});
 it.each(['missing','corrupt-graph','wrong-index','wrong-previous','wrong-hash'])('records %s replica failure then independently verifies original without repair',async mode=>{
  const {original,prepared,records}=await packed(),key=packedHandKey(1),record=records.get(key) as PackedHandSegment,diagnostics:string[]=[];
  if(mode==='missing')records.delete(key);else if(mode==='corrupt-graph')record.graph='not valid JSON';else if(mode==='wrong-index')record.index=5;else if(mode==='wrong-previous')record.previousHash='0'.repeat(64);else record.hash='f'.repeat(64);
  const before=JSON.stringify([...records]),restored=await restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(k=>records.get(k)),{onDiagnostic:d=>diagnostics.push(d)});
  expect(canonical(restored)).toBe(canonical(original));expect(diagnostics).toHaveLength(1);expect(JSON.stringify([...records])).toBe(before);
 });
 it('fails safely when both complete copies are missing',async()=>{const {prepared,records}=await packed();records.delete(packedHandKey(1));records.delete(segmentKey('hands',1));await expect(restoreSegments(prepared.envelope,async keys=>keys.map(k=>records.get(k)))).rejects.toThrow(/missing|reordered/);});
 it('retains a verifiable packed copy while explicit legacy archive audit detects damaged backup',async()=>{
  const {prepared,records}=await packed();records.delete(segmentKey('hands',1));await expect(restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(k=>records.get(k)))).resolves.toBeTruthy();
  await expect(restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(k=>records.get(k)),{canonicalOnly:true})).rejects.toThrow(/missing|reordered/);
 });
 it.each(['count','tail'])('rejects %s descriptor disagreement even with repaired manifest hash',async key=>{
  const {prepared,records}=await packed(),e=prepared.envelope;e.packedHands={...e.packedHands!,...(key==='count'?{count:e.segments.hands.count-1}:{tail:'0'.repeat(64)})};const {checksum:_,...body}=e;void _;e.checksum=await digest(body);
  await expect(restoreSegments(e,async keys=>keys.map(k=>records.get(k)))).rejects.toThrow(/checkpoint differs/);
 });
 it('keeps unchanged default legacy receipts and supports old-writer removal of optional replica metadata',async()=>{
  const {original,prepared,records}=await packed(),legacy=await prepareSegments(original,null,null);
  expect(legacy.envelope.packedHands).toBeUndefined();expect(legacy.replicas).toBeUndefined();
  const rollback=await prepareSegments(original,original,prepared.envelope,{packHands:false});expect(rollback.writes).toHaveLength(0);expect(rollback.envelope).toEqual(legacy.envelope);
  const data=await restoreSegments(rollback.envelope,async keys=>keys.map(k=>records.get(k)));expect(canonical(data)).toBe(canonical(original));
 });
 it('creates no financial/canonical writes during optional packing and does no repeated history encoding on hot writes',async()=>{
  const original=await migrateData(fixture.streets.flop),legacy=await prepareSegments(original,null,null),records=recordMap(legacy),restored=await restoreSegments(legacy.envelope,async keys=>keys.map(k=>records.get(k)));
  const installed=await prepareSegments(restored,restored,legacy.envelope,{packHands:true});expect(installed.writes).toHaveLength(0);expect(installed.replicas).toHaveLength(original.hands.length);expect(installed.envelope.data.revision).toBe(original.revision);
  const hot=await prepareSegments(restored,restored,installed.envelope);expect(hot.writes).toHaveLength(0);expect(hot.replicas).toHaveLength(0);
 });
});
