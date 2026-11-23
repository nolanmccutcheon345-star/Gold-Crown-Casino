import {describe,it,expect} from 'vitest';
import {createReadStream,mkdirSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import type {StoredHand} from '../../src/session/types';
import {parsePublicHistory} from '../../src/storage/integrity';
import {createPublicHistoryBatch,PUBLIC_HISTORY_BATCH_BYTES} from '../../src/storage/public-history-batch';
import {prepareHistoryBatchFiles} from '../../src/ui/history-file';
import {referenceEncode,referenceFullHands,referenceHash} from '../step5e-independent/financial-reference';

const fixtures='tests/browser/step5d-recovery-fixtures';
const expectedSHA:Record<number,string>={100:'68eaa79b1b49f877b718d3084014f33eec1a506e02679787f5812815315d63f5',1000:'f531a621211728f95b3dbde6b266007b8cb074c4a1f541e97cd78e8a992bc3e5'};
async function readHands(size:number){
 const hands:StoredHand[]=[],hash=createHash('sha256'),raw=createReadStream(`${fixtures}/${size}.jsonl.gz`).pipe(createGunzip());
 raw.on('data',chunk=>hash.update(chunk));
 for await(const line of createInterface({input:raw,crlfDelay:Infinity})){
  const row=JSON.parse(line) as {key:string;value:{value:StoredHand}};
  if(row.key.startsWith('v2:hands:'))hands.push(row.value.value);
 }
 expect(hash.digest('hex')).toBe(expectedSHA[size]);expect(hands).toHaveLength(size);return hands;
}
function evidence(size:number,value:unknown){const output=process.env.STEP5F_INDEPENDENT_EVIDENCE;if(!output)return;mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`public-export-${size}.json`),JSON.stringify(value,null,2)+'\n');}
function assertRedacted(value:unknown){
 if(!value||typeof value!=='object')return;
 for(const [key,item]of Object.entries(value)){
  if(['deck','deckCursor','burned','privateProfiles','profiles','drawToken','pending','ownCards','seed','personalitySeed','traits','memory','ranges','rangeAnalysis','weightedCombos','diagnostics'].includes(key))throw new Error(`Public export reveals private field ${key}`);
  assertRedacted(item);
 }
}

describe('Step5F independent actual-fixture public export capacity',()=>{
 for(const size of [100,1000])it(`exports all ${size} canonical saved hands into bounded redacted files accepted by study import`,async()=>{
  const hands=await readHands(size),canonicalBefore=createHash('sha256').update(referenceEncode(hands)).digest('hex'),audited=referenceFullHands(hands);
  const received:string[]=[],filesEvidence:Array<{startIndex:number;nextIndex:number;bytes:number;sha256:string;buildMs:number;importMs:number}>=[];
  let cursor=0;
  while(cursor<size){
   const start=performance.now(),batch=await createPublicHistoryBatch(async index=>hands[index],{startIndex:cursor,total:size}),files=prepareHistoryBatchFiles(batch),buildMs=performance.now()-start;
   const text=await files.json.text();expect(text).toBe(batch.text);expect(files.text).toBe(batch.text);expect(await files.plain.text()).toBe(text);
   expect(files.json.size).toBe(batch.bytes);expect(batch.bytes).toBeLessThanOrEqual(PUBLIC_HISTORY_BATCH_BYTES);expect(batch.nextIndex).toBeGreaterThan(cursor);assertRedacted(batch.history);
   const importStart=performance.now(),imported=await parsePublicHistory(text),importMs=performance.now()-importStart;
   expect(imported).toHaveLength(batch.nextIndex-cursor);let previous='0'.repeat(64);
   for(const [offset,hand]of imported.entries()){
    const original=hands[cursor+offset],{hash,...body}=hand;expect(hash).toBe(referenceHash(body));expect(hand.previousHash).toBe(previous);previous=hash;
    expect(hand.handId).toBe(original.id);expect(hand.sessionId).toBe(original.sessionId);expect(hand.net).toBe(original.net);expect(hand.view).toEqual(original.view);expect(hand.frames).toEqual(original.frames);
    for(const frame of hand.frames)if(frame.street!=='complete')for(const seat of frame.seats)if(seat.id!==0&&seat.hole.length)throw new Error('Opponent hole cards exposed before settlement');
    received.push(hand.handId);
   }
   filesEvidence.push({startIndex:cursor,nextIndex:batch.nextIndex,bytes:batch.bytes,sha256:createHash('sha256').update(text).digest('hex'),buildMs,importMs});cursor=batch.nextIndex;
  }
  expect(received).toEqual(hands.map(h=>h.id));expect(new Set(received).size).toBe(size);
  const canonicalAfter=createHash('sha256').update(referenceEncode(hands)).digest('hex');expect(canonicalAfter).toBe(canonicalBefore);
  evidence(size,{runtime:process.version,helperCommit:'2cb4c58',fixture:`${fixtures}/${size}.jsonl.gz`,fixtureRawSHA256:expectedSHA[size],method:'Actual bounded public export + UI batch File construction + unchanged study import. Independent Node SHA-256 public chains and canonical raw-event/hash audit. Node execution, not physical/browser verification.',audited,handCount:size,importedCount:received.length,files:filesEvidence.length,maximumFileBytes:Math.max(...filesEvidence.map(f=>f.bytes)),totalFileBytes:filesEvidence.reduce((sum,f)=>sum+f.bytes,0),canonicalUnchanged:canonicalAfter===canonicalBefore,redacted:true,allOriginalIDsExactlyOnce:true,completeViewsFramesAndNetEqual:true,batches:filesEvidence,limitation:'Public study files do not restore or credit wallet/session state; previous unbounded failure remains in export-baseline evidence.'});
 },120000);
});
