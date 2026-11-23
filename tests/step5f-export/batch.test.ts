import {beforeAll,describe,it,expect,vi} from 'vitest';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import type {StoredHand} from '../../src/session/types';
import {createPublicHistoryBatch,PUBLIC_HISTORY_BATCH_BYTES} from '../../src/storage/public-history-batch';
import {canonical,GENESIS,parsePublicHistory,seal} from '../../src/storage/integrity';
import {previewPublicStudyImport} from '../../src/storage/study-import';
import {prepareHistoryBatchFiles,sharePreparedHistory} from '../../src/ui/history-file';

const source:StoredHand[]=[];
beforeAll(async()=>{
 const raw=createReadStream('tests/browser/step5d-recovery-fixtures/100.jsonl.gz').pipe(createGunzip()),hash=createHash('sha256');
 raw.on('data',chunk=>hash.update(chunk));
 for await(const line of createInterface({input:raw,crlfDelay:Infinity})){
  const row=JSON.parse(line) as {key:string;value:{value:StoredHand}};
  if(row.key.startsWith('v2:hands:'))source.push(row.value.value);
 }
 expect(hash.digest('hex')).toBe('68eaa79b1b49f877b718d3084014f33eec1a506e02679787f5812815315d63f5');expect(source).toHaveLength(100);
});

describe('Bounded independently importable public history files',()=>{
 it('exports an empty archive without touching record storage',async()=>{
  const read=vi.fn(),batch=await createPublicHistoryBatch(read,{startIndex:0,total:0});
  expect(read).not.toHaveBeenCalled();expect(batch.nextIndex).toBe(0);expect(batch.bytes).toBe(new TextEncoder().encode(batch.text).byteLength);
  expect(await parsePublicHistory(batch.text)).toEqual([]);
 });
 it.each([
  {startIndex:-1,total:10},{startIndex:1,total:0},{startIndex:0,total:1.5},
  {startIndex:0,total:1,maxBytes:10_000_001},{startIndex:0,total:1,maxHands:0},
 ])('rejects invalid range or unsafe budget before reading: %j',async options=>{
  const read=vi.fn();await expect(createPublicHistoryBatch(read,options)).rejects.toThrow(/Invalid history export/);expect(read).not.toHaveBeenCalled();
 });
 it('stops at the hand limit without loading another canonical record',async()=>{
  const read=vi.fn(async(index:number)=>source[index]);
  const batch=await createPublicHistoryBatch(read,{startIndex:2,total:100,maxHands:3});
  expect(batch.startIndex).toBe(2);expect(batch.nextIndex).toBe(5);expect(read.mock.calls.map(call=>call[0])).toEqual([2,3,4]);
  expect(batch.history.hands.map(h=>h.handId)).toEqual(source.slice(2,5).map(h=>h.id));expect(batch.history.hands[0].previousHash).toBe(GENESIS);
  expect(await parsePublicHistory(batch.text)).toEqual(batch.history.hands);
 });
 it('accepts an exact byte fit and uses at most one lookahead to find the next boundary',async()=>{
  const first=await createPublicHistoryBatch(async i=>source[i],{startIndex:0,total:1});
  const read=vi.fn(async(index:number)=>source[index]),batch=await createPublicHistoryBatch(read,{startIndex:0,total:100,maxBytes:first.bytes});
  expect(batch.bytes).toBe(first.bytes);expect(batch.nextIndex).toBe(1);expect(read.mock.calls.map(call=>call[0])).toEqual([0,1]);
  expect(await parsePublicHistory(batch.text)).toEqual(batch.history.hands);
  const next=await createPublicHistoryBatch(async i=>source[i],{startIndex:batch.nextIndex,total:100,maxHands:1});
  expect(next.history.hands[0].previousHash).toBe(GENESIS);expect((await parsePublicHistory(next.text))[0].handId).toBe(source[1].id);
 });
 it('rejects a single oversized hand visibly without dropping or changing it',async()=>{
  const first=await createPublicHistoryBatch(async i=>source[i],{startIndex:0,total:1}),before=canonical(source[0]);
  await expect(createPublicHistoryBatch(async i=>source[i],{startIndex:0,total:1,maxBytes:first.bytes-1})).rejects.toThrow(/Hand 1 is too large.*No hand was omitted or changed/);
  expect(canonical(source[0])).toBe(before);
 });
 it('measures UTF-8 bytes as well as characters for international text',async()=>{
  const hand=await seal({...source[0],sessionId:'会議🌵'.repeat(20)});
  const batch=await createPublicHistoryBatch(async()=>hand,{startIndex:0,total:1});
  expect(batch.bytes).toBe(new TextEncoder().encode(batch.text).byteLength);expect(batch.bytes).toBeGreaterThan(batch.text.length);
  await expect(createPublicHistoryBatch(async()=>hand,{startIndex:0,total:1,maxBytes:batch.text.length})).rejects.toThrow(/too large/);
  expect((await parsePublicHistory(batch.text))[0].sessionId).toBe(hand.sessionId);
 });
 it('keeps every varied canonical hand exactly once across bounded redacted files',async()=>{
  const before=createHash('sha256').update(canonical(source)).digest('hex'),received:string[]=[];let cursor=0,files=0;
  while(cursor<source.length){
   const batch=await createPublicHistoryBatch(async i=>source[i],{startIndex:cursor,total:source.length,maxBytes:90_000}),imported=await parsePublicHistory(batch.text);
   expect(batch.bytes).toBeLessThanOrEqual(90_000);expect(batch.nextIndex).toBeGreaterThan(cursor);expect(batch.history.hands[0].previousHash).toBe(GENESIS);
   expect(JSON.parse(batch.text)).toEqual(batch.history);expect(imported).toEqual(batch.history.hands);
   expect(batch.text).not.toMatch(/"(?:deck|deckCursor|burned|privateProfiles|profiles|drawToken|pending|ownCards|seed|personalitySeed|traits|memory|ranges|rangeAnalysis|weightedCombos|diagnostics)"/);
   const preview=await previewPublicStudyImport(batch.text);expect(preview.invalidCount).toBe(0);expect(preview.validCount).toBe(imported.length);
   for(let offset=0;offset<imported.length;offset++){
    const actual=imported[offset],canonicalHand=source[cursor+offset];received.push(actual.handId);
    expect(actual.frames).toEqual(canonicalHand.frames);expect(actual.view).toEqual(canonicalHand.view);expect(actual.net).toBe(canonicalHand.net);
    for(const frame of actual.frames)if(frame.street!=='complete')for(const seat of frame.seats)if(seat.id!==0)expect(seat.hole).toEqual([]);
   }
   cursor=batch.nextIndex;files++;
  }
  expect(files).toBeGreaterThan(1);expect(received).toEqual(source.map(h=>h.id));expect(new Set(received).size).toBe(source.length);
  expect(createHash('sha256').update(canonical(source)).digest('hex')).toBe(before);
 },60000);
 it('propagates archive integrity/read failures rather than substituting an empty file',async()=>{
  await expect(createPublicHistoryBatch(async()=>{throw Error('Canonical segment hash mismatch');},{startIndex:0,total:1})).rejects.toThrow('Canonical segment hash mismatch');
 });
 it('uses the identical bounded bytes for numbered JSON and text files and synchronous native sharing',async()=>{
  const batch=await createPublicHistoryBatch(async i=>source[i],{startIndex:2,total:100,maxHands:3}),files=prepareHistoryBatchFiles(batch);
  expect(await files.json.text()).toBe(batch.text);expect(await files.plain.text()).toBe(batch.text);expect(files.json.size).toBe(batch.bytes);
  expect(files.json.name).toBe('ai-texas-hold-em-history-3-5-of-100.json');expect(files.plain.name).toBe(files.json.name+'.txt');
  const share=vi.fn().mockResolvedValue(undefined),pending=sharePreparedHistory(files,{canShare:()=>true,share});
  expect(share).toHaveBeenCalledOnce();expect(await pending).toBe('shared');expect(await parsePublicHistory(files.text)).toEqual(batch.history.hands);
 });
 it('keeps the default below unchanged study import ceilings',()=>{expect(PUBLIC_HISTORY_BATCH_BYTES).toBeLessThan(10_000_000);});
});
