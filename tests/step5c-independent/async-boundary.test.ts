import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,CashSession} from '../../src/session/types';
import {migrateData} from '../../src/storage/integrity';
import {prepareSegments,restoreSegments,segmentKey} from '../../src/storage/segments';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};

describe('Step5C independent asynchronous recovery boundary',()=>{
 it('does not accept a manifest header changed by a reader after manifest verification',async()=>{
  const data=await migrateData(fixture.streets.flop),prepared=await prepareSegments(data,null,null),envelope=structuredClone(prepared.envelope);
  const records=new Map(prepared.writes.map(write=>[write.key,structuredClone(write.entry)]));
  const original=envelope.data.initialBankroll;let mutated=false,rejected=false;
  try{await restoreSegments(envelope,async keys=>{
   try{envelope.data.initialBankroll=original+100;mutated=true;}catch{/* Safe immutable manifest boundary. */}
   return keys.map(key=>records.get(key));
  });}catch{rejected=true;}
  expect(rejected||!mutated).toBe(true);if(!rejected)expect(envelope.data.initialBankroll).toBe(original);
 });
 it('does not accept a retained read alias changed after its outer hash was verified',async()=>{
  const data=await migrateData(fixture.streets.flop),prepared=await prepareSegments(data,null,null);
  const records=new Map(prepared.writes.map(write=>[write.key,structuredClone(write.entry)]));
  const closed=records.get(segmentKey('closedSessions',0))!.value as CashSession;
  expect(prepared.envelope.segments.importedHands.count).toBeGreaterThan(0);
  let mutated=false,rejected=false;const original=closed.startedAt;
  try{
   await restoreSegments(structuredClone(prepared.envelope),async keys=>{
    // Imported records are read after all closed-session segment hashes have
    // been checked. This caller retains the earlier returned object reference.
    if(keys[0]?.startsWith('v2:importedHands:')){
     try{closed.startedAt='2000-01-01T00:00:00.000Z';mutated=true;}catch{/* Safe immutable transport boundary. */}
    }
    return keys.map(key=>records.get(key));
   });
  }catch{rejected=true;}
  expect(rejected||!mutated).toBe(true);
  if(!rejected)expect(closed.startedAt).toBe(original);
 });
});
