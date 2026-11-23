/** Matched packed write-validation capacity: unchanged encoding and full read checks. */
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector/promises';
import {writeHeapSnapshot} from 'node:v8';
import assert from 'node:assert/strict';
import {packHandGraph,isPackedImmutableNode,type PackedGraph} from '../../src/storage/packed-hand';
function referenceDecode(graph:PackedGraph):unknown {
 const nodes:unknown[]=[];const read=(value:PackedGraph['root']):unknown=>{if(value&&typeof value==='object'){assert(value.ref>=0&&value.ref<nodes.length);return nodes[value.ref];}return value;};
 for(const [kind,fields]of graph.nodes)nodes.push(kind==='array'?fields.map(read):Object.fromEntries(fields.map(([key,value])=>[key,read(value)])));
 return read(graph.root);
}
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
 const encoded:string[]=[],timings:number[]=[],before=createHash('sha256'),after=createHash('sha256');let graphNodes=0,canonicalBytes=0,packedBytes=0;
 await inspector.post('HeapProfiler.startSampling',{samplingInterval:32768});await inspector.post('Profiler.start');
 for(const row of rows){const canonical=JSON.stringify(row);before.update(canonical+'\n');canonicalBytes+=Buffer.byteLength(canonical);const at=performance.now(),graph=packHandGraph(row),text=JSON.stringify(graph);timings.push(performance.now()-at);graphNodes+=graph.nodes.length;packedBytes+=Buffer.byteLength(text);assert(!isPackedImmutableNode(graph));const value=referenceDecode(graph);assert.equal(JSON.stringify(value),canonical);after.update(JSON.stringify(value)+'\n');encoded.push(text);}
 const {profile:cpu}=await inspector.post('Profiler.stop');const {profile:allocation}=await inspector.post('HeapProfiler.stopSampling');
 writeFileSync(`${directory}/cpu.cpuprofile.json`,JSON.stringify(cpu));writeFileSync(`${directory}/allocation.heapprofile.json`,JSON.stringify(allocation));
 const canonicalSHA256=before.digest('hex');assert.equal(after.digest('hex'),canonicalSHA256);
 const ordered=[...timings].sort((a,b)=>a-b),latency={p50:ordered[Math.floor((ordered.length-1)*.5)],p95:ordered[Math.floor((ordered.length-1)*.95)],p99:ordered[Math.floor((ordered.length-1)*.99)],max:ordered.at(-1)};
 return{refs:{rows:new WeakRef(rows),encoded:new WeakRef(encoded)},result:{fixtureReadParseMs,fixtureMemory,canonicalBytes,packedBytes,graphNodes,decodedNodesConstructed:graphNodes,canonicalSHA256,latency,liveMemory:process.memoryUsage(),scope:'Write-only production packing of1000real canonical hands, preserving encoded JSON strings as a storage writer would. An independent local backward-reference decoder verifies every canonical byte without calling the production decoder or branding nodes. Production still constructs and freezes one validation graph per hand. Per-record latency includes pack+serialization only; CPU includes independent reference assertions. Retained capacity is sampled after all fixture and encoded-string roots are collected. Not ordinary bot or browser latency.'}};
}
const result=await run(),samples=[];
for(let i=0;i<8;i++){await turn();global.gc?.();await turn();samples.push({iteration:i,memory:process.memoryUsage(),reachable:{rows:!!result.refs.rows.deref(),encoded:!!result.refs.encoded.deref()}});}
const snapshot=writeHeapSnapshot(`${directory}/after-unwind.heapsnapshot`);inspector.disconnect();
writeFileSync(`${directory}/report.json`,JSON.stringify({status:'PASS',count,source,sourceSHA256,node:process.version,platform:process.platform,baseline,...result.result,samples,snapshot},null,2)+'\n');
console.log(JSON.stringify({count,graphNodes:result.result.graphNodes,canonicalBytes:result.result.canonicalBytes,packedBytes:result.result.packedBytes,baselineHeap:baseline.heapUsed,finalHeap:samples.at(-1)!.memory.heapUsed,reachable:samples.at(-1)!.reachable,directory}));
