import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {writeHeapSnapshot} from 'node:v8';
import assert from 'node:assert/strict';
import {restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {canonical} from '../../src/storage/integrity';
import type {AppData} from '../../src/session/types';
const source='tests/step5b-resource/evidence/step5e-4ab9ea3',directory='tests/step5e-performance/resource-cleanup-evidence';mkdirSync(directory,{recursive:true});
const expected=JSON.parse(readFileSync(`${source}/report.json`,'utf8')) as {canonicalSHA256:string;finalWallet:number},turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
global.gc?.();const baseline=process.memoryUsage();
async function run(){
 const rows=new Map<string,string>();for await(const line of createInterface({input:createReadStream(`${source}/canonical-segments.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity})){const split=line.indexOf(',"value":');assert(split>0);rows.set(JSON.parse(line.slice(7,split)),line.slice(split+9,-1));}
 let data:AppData|null=await restoreSegments(JSON.parse(rows.get('current')!) as SegmentedEnvelope,async keys=>keys.map(key=>JSON.parse(rows.get(key)!)));
 assert.equal(data.hands.length,10000);assert.equal(data.wallet,expected.finalWallet);assert.equal(createHash('sha256').update(canonical(data)).digest('hex'),expected.canonicalSHA256);
 const refs={data:new WeakRef(data),hands:new WeakRef(data.hands),rows:new WeakRef(rows)},loaded=process.memoryUsage();rows.clear();data=null;return{refs,loaded};
}
const result=await run(),samples=[];
for(let n=0;n<8;n++){await turn();global.gc?.();await turn();samples.push({iteration:n,memory:process.memoryUsage(),reachable:{data:!!result.refs.data.deref(),hands:!!result.refs.hands.deref(),rows:!!result.refs.rows.deref()}});}
const snapshot=writeHeapSnapshot(`${directory}/after-unwind.heapsnapshot`);
writeFileSync(`${directory}/report.json`,JSON.stringify({status:'PASS',scope:'One independent full canonical restore/hash verification and cleanup only. No CPU profiler, timing-row collection or browser. WeakRefs observe collection without intentionally retaining the data, hand array or storage map.',baseline,loaded:result.loaded,samples,snapshot},null,2)+'\n');console.log(JSON.stringify({baseline,final:samples.at(-1),snapshot}));
