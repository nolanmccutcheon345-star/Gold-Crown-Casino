/** Residual packed-node provenance capacity, separate from freezer before/after. */
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector/promises';
import {writeHeapSnapshot} from 'node:v8';
import assert from 'node:assert/strict';
import {packHandGraph,unpackHandText,isPackedImmutableNode} from '../../src/storage/packed-hand';
const directory=process.argv[2],count=Number(process.argv[3]??1000);
assert(directory&&Number.isInteger(count)&&count>0&&count<=10000);mkdirSync(directory,{recursive:true});
const source='tests/step5b-resource/evidence/step5e-4ab9ea3/canonical-segments.jsonl.gz';
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sourceSHA256=sha(readFileSync(source)),inspector=new Session();inspector.connect();
await inspector.post('Profiler.enable');await inspector.post('HeapProfiler.enable');
for(let i=0;i<3;i++){await turn();global.gc?.();}
const baseline=process.memoryUsage();
async function run(){
 const begin=performance.now(),rows:object[]=[];
 const stream=createReadStream(source).pipe(createGunzip()),reader=createInterface({input:stream,crlfDelay:Infinity});
 for await(const line of reader){const split=line.indexOf(',"value":');if(split<0)continue;const key=JSON.parse(line.slice(7,split)) as string;if(!key.startsWith('v2:hands:'))continue;rows.push((JSON.parse(line.slice(split+9,-1)) as {value:object}).value);if(rows.length===count)break;}
 reader.close();stream.destroy();assert.equal(rows.length,count);
 const fixtureReadParseMs=performance.now()-begin,fixtureMemory=process.memoryUsage();
 const decoded:object[]=[],timings:number[]=[],before=createHash('sha256'),after=createHash('sha256');let graphNodes=0,canonicalBytes=0,packedBytes=0;
 await inspector.post('HeapProfiler.startSampling',{samplingInterval:32768});await inspector.post('Profiler.start');
 for(const row of rows){const canonical=JSON.stringify(row);before.update(canonical+'\n');canonicalBytes+=Buffer.byteLength(canonical);const at=performance.now(),graph=packHandGraph(row),text=JSON.stringify(graph),value=unpackHandText(text);timings.push(performance.now()-at);graphNodes+=graph.nodes.length;packedBytes+=Buffer.byteLength(text);assert(value&&typeof value==='object');assert(isPackedImmutableNode(value));assert(Object.isFrozen(value));assert.equal(JSON.stringify(value),canonical);after.update(JSON.stringify(value)+'\n');decoded.push(value);}
 const {profile:cpu}=await inspector.post('Profiler.stop');const {profile:allocation}=await inspector.post('HeapProfiler.stopSampling');
 writeFileSync(`${directory}/cpu.cpuprofile.json`,JSON.stringify(cpu));writeFileSync(`${directory}/allocation.heapprofile.json`,JSON.stringify(allocation));
 const canonicalSHA256=before.digest('hex');assert.equal(after.digest('hex'),canonicalSHA256);
 const seen=new Set<object>();function check(value:unknown){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert(Object.isFrozen(value));assert(isPackedImmutableNode(value));for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key)!;assert(!d.get&&!d.set);if('value'in d)check(d.value);}}
 decoded.forEach(check);assert.equal(seen.size,graphNodes);seen.clear();
 const ordered=[...timings].sort((a,b)=>a-b),latency={p50:ordered[Math.floor((ordered.length-1)*.5)],p95:ordered[Math.floor((ordered.length-1)*.95)],p99:ordered[Math.floor((ordered.length-1)*.99)],max:ordered.at(-1)};
 return{refs:{rows:new WeakRef(rows),decoded:new WeakRef(decoded)},result:{fixtureReadParseMs,fixtureMemory,canonicalBytes,packedBytes,graphNodes,decodedNodesConstructed:graphNodes*2,canonicalSHA256,latency,liveMemory:process.memoryUsage(),scope:'1000 real canonical hand values packed and decoded once each. packHandGraph also decodes once internally, so two decoded graphs are constructed per hand. Independently verifies every decoded node immutable and private provenance plus exact canonical JSON. CPU includes pack, decode, serialization and immediate assertions; not ordinary bot preparation or browser memory. No production packed-hand source change.'}};
}
const result=await run(),samples=[];
for(let i=0;i<8;i++){await turn();global.gc?.();await turn();samples.push({iteration:i,memory:process.memoryUsage(),reachable:{rows:!!result.refs.rows.deref(),decoded:!!result.refs.decoded.deref()}});}
const snapshot=writeHeapSnapshot(`${directory}/after-unwind.heapsnapshot`);inspector.disconnect();
writeFileSync(`${directory}/report.json`,JSON.stringify({status:'PASS',count,source,sourceSHA256,node:process.version,platform:process.platform,baseline,...result.result,samples,snapshot},null,2)+'\n');
console.log(JSON.stringify({count,graphNodes:result.result.graphNodes,canonicalBytes:result.result.canonicalBytes,packedBytes:result.result.packedBytes,baselineHeap:baseline.heapUsed,finalHeap:samples.at(-1)!.memory.heapUsed,reachable:samples.at(-1)!.reachable,directory}));
