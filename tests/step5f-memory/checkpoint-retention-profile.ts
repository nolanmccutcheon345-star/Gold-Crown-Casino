/** Real canonical restore/promotion; no fixture graph survives except the compact state. */
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {writeHeapSnapshot} from 'node:v8';
import assert from 'node:assert/strict';
import {restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {prepareCompactSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {referenceFinancial,financialInput} from '../step5e-independent/financial-reference';
const directory=process.argv[2],expectCollected=process.argv[3]==='collected';assert(directory);mkdirSync(directory,{recursive:true});
const source='tests/browser/step5d-recovery-fixtures/1000.jsonl.gz',turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const digest=(input:Buffer)=>createHash('sha256').update(input).digest('hex');
for(let i=0;i<3;i++){await turn();global.gc?.();}const baseline=process.memoryUsage();
async function run(){
 const rows=new Map<string,unknown>(),start=performance.now();
 for await(const line of createInterface({input:createReadStream(source).pipe(createGunzip()),crlfDelay:Infinity})){const parsed=JSON.parse(line) as {key:string;value:unknown};rows.set(parsed.key,parsed.value);}
 const fixtureMs=performance.now()-start,restoreStart=performance.now(),full=await restoreSegments(rows.get('current') as SegmentedEnvelope,async keys=>keys.map(key=>rows.get(key)),{canonicalOnly:true});
 assert.equal(full.hands.length,1000);rows.clear();const restoreMs=performance.now()-restoreStart,expected=referenceFinancial(financialInput(full)),first=full.hands[0];
 const promotionStart=performance.now(),compact=await prepareCompactSnapshot(full),promotionMs=performance.now()-promotionStart;
 assert.equal(compact.data.hands.length,120);assert.equal(compact.context.handOffset,880);assert(isVerifiedSnapshot(compact.data));
 assert.deepEqual(referenceFinancial({...compact.data,handIndex:compact.context.handIndex}),expected);
 assert.deepEqual(compact.data.hands.map(h=>h.hash),full.hands.slice(-120).map(h=>h.hash));
 return{compact,refs:{full:new WeakRef(full),oldHand:new WeakRef(first),oldView:new WeakRef(first.view),oldFrames:new WeakRef(first.frames)},summary:{fixtureMs,restoreMs,promotionMs,finance:expected,firstHandId:first.id,retainedTail:120,archivedHands:880,liveMemory:process.memoryUsage()}};
}
const state=await run(),samples=[];
for(let i=0;i<8;i++){await turn();global.gc?.();await turn();samples.push({iteration:i,memory:process.memoryUsage(),reachable:Object.fromEntries(Object.entries(state.refs).map(([key,ref])=>[key,!!ref.deref()]))});}
const actual=samples.at(-1)!;assert.equal(actual.reachable.full,false,'Original AppData must collect in either version');
for(const key of ['oldHand','oldView','oldFrames'])assert.equal(actual.reachable[key],!expectCollected,`${key} retention differs from stated baseline/candidate expectation`);
const snapshot=writeHeapSnapshot(`${directory}/after-unwind.heapsnapshot`);
assert(isVerifiedSnapshot(state.compact.data));assert.equal(state.compact.context.handIndex.length,1000);
writeFileSync(`${directory}/report.json`,JSON.stringify({status:'PASS',source,sourceSHA256:digest(readFileSync(source)),node:process.version,expectCollected,baseline,...state.summary,samples,snapshot,scope:'Actual canonical 1000-hand restore and independent financial oracle, promoted to 120-hand compact resident state. Canonical rows and original full AppData released; compact snapshot remains strongly reachable through heap capture. Explicit GC demonstrates reachability, not ordinary browser memory or latency.'},null,2)+'\n');
console.log(JSON.stringify({directory,finance:state.summary.finance,heap:actual.memory.heapUsed,reachable:actual.reachable}));
