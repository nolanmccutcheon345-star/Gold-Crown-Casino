import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData} from '../../src/session/types';
import {canonical,migrateData} from '../../src/storage/integrity';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
async function fixtureTransport(){const data=await migrateData(fixture.streets.flop),prepared=await prepareSegments(data,null,null);return {data,envelope:structuredClone(prepared.envelope),records:new Map(prepared.writes.map(w=>[w.key,structuredClone(w.entry)]))};}
describe('Step5C exact immutable transport bytes before asynchronous hashing',()=>{
 it('rejects a manifest getter before reading it or calling the transport reader',async()=>{
  const {envelope}=await fixtureTransport();let invoked=0,reads=0;Object.defineProperty(envelope,'format',{get(){invoked++;return 'ai-texas-hold-em-private-device';}});
  await expect(restoreSegments(envelope,async()=>{reads++;return [];})).rejects.toThrow(/accessors/);expect(invoked).toBe(0);expect(reads).toBe(0);
 });
 it('rejects a returned record getter before hashing or invoking it',async()=>{
  const {envelope,records}=await fixtureTransport();let invoked=0;const record=records.values().next().value!,value=record.value;Object.defineProperty(record,'value',{get(){invoked++;return value;}});
  await expect(restoreSegments(envelope,async keys=>keys.map(k=>records.get(k)))).rejects.toThrow(/accessors/);expect(invoked).toBe(0);
 });
 it('restores identical canonical state while freezing the manifest and every retained record alias',async()=>{
  const {data,envelope,records}=await fixtureTransport(),before=canonical(data);const recovered=await restoreSegments(envelope,async keys=>keys.map(k=>records.get(k)));
  expect(canonical(recovered)).toBe(before);expect(Object.isFrozen(envelope.data)).toBe(true);expect(Object.isFrozen(envelope.segments)).toBe(true);expect([...records.values()].every(record=>Object.isFrozen(record)&&Object.isFrozen(record.value))).toBe(true);
 });
});
