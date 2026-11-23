/** Isolated freezer allocation/CPU experiment, not browser/application latency. */
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector/promises';
import {writeHeapSnapshot} from 'node:v8';
import assert from 'node:assert/strict';
import {freezeSnapshot} from '../../src/storage/verified';
const directory=process.argv[2],count=Number(process.argv[3]??1000);
assert(directory&&Number.isInteger(count)&&count>0&&count<=10000);mkdirSync(directory,{recursive:true});
const source='tests/step5b-resource/evidence/step5e-4ab9ea3/canonical-segments.jsonl.gz';
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const digest=sha(readFileSync(source)),inspector=new Session();inspector.connect();
await inspector.post('Profiler.enable');await inspector.post('HeapProfiler.enable');
for(let i=0;i<3;i++){await turn();global.gc?.();}
const baseline=process.memoryUsage();
async function run(){
 const begin=performance.now(),rows:{key:string;value:object}[]=[];
 const stream=createReadStream(source).pipe(createGunzip()),reader=createInterface({input:stream,crlfDelay:Infinity});
 for await(const line of reader){const split=line.indexOf(',"value":');if(split<0)continue;const key=JSON.parse(line.slice(7,split)) as string;if(!key.startsWith('v2:hands:'))continue;rows.push({key,value:JSON.parse(line.slice(split+9,-1))});if(rows.length===count)break;}
 reader.close();stream.destroy();assert.equal(rows.length,count);
 const fixtureReadParseMs=performance.now()-begin,fixtureMemory=process.memoryUsage(),before=sha(rows.map(r=>JSON.stringify(r)).join('\n'));
 await inspector.post('HeapProfiler.startSampling',{samplingInterval:32768});await inspector.post('Profiler.start');
 const timings:number[]=[];const start=performance.now();for(const row of rows){const at=performance.now();freezeSnapshot(row.value);timings.push(performance.now()-at);}
 const initialFreezeMs=performance.now()-start,root={hands:rows.map(row=>(row.value as {value:object}).value)};freezeSnapshot(root);
 const repeated:number[]=[];for(let n=0;n<5;n++){const at=performance.now();freezeSnapshot({hands:[...root.hands]});repeated.push(performance.now()-at);}
 const {profile:cpu}=await inspector.post('Profiler.stop');const {profile:allocation}=await inspector.post('HeapProfiler.stopSampling');
 writeFileSync(`${directory}/cpu.cpuprofile.json`,JSON.stringify(cpu));writeFileSync(`${directory}/allocation.heapprofile.json`,JSON.stringify(allocation));
 assert.equal(sha(rows.map(r=>JSON.stringify(r)).join('\n')),before,'Freeze changed canonical bytes');
 const seen=new Set<object>();function check(v:unknown){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);assert(Object.isFrozen(v));for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key)!;assert(!d.get&&!d.set);if('value'in d)check(d.value);}}
 for(const row of rows)check(row.value);const graphObjects=seen.size;seen.clear();
 const ordered=[...timings].sort((a,b)=>a-b),latency={p50:ordered[Math.floor((ordered.length-1)*.5)],p95:ordered[Math.floor((ordered.length-1)*.95)],p99:ordered[Math.floor((ordered.length-1)*.99)],max:ordered.at(-1)};
 const liveMemory=process.memoryUsage();return{refs:{rows:new WeakRef(rows),root:new WeakRef(root)},result:{fixtureReadParseMs,fixtureMemory,initialFreezeMs,repeated,latency,liveMemory,graphObjects,canonicalSHA256:before}};
}
const result=await run(),samples=[];
for(let i=0;i<8;i++){await turn();global.gc?.();await turn();samples.push({iteration:i,memory:process.memoryUsage(),reachable:{rows:!!result.refs.rows.deref(),root:!!result.refs.root.deref()}});}
const snapshot=process.env.HEAP_SNAPSHOT==='1'?writeHeapSnapshot(`${directory}/after-unwind.heapsnapshot`):null;inspector.disconnect();
writeFileSync(`${directory}/report.json`,JSON.stringify({status:'PASS',count,source,sourceSHA256:digest,node:process.version,platform:process.platform,baseline,...result.result,samples,snapshot,scope:'Actual canonical stored-hand record graphs. Fixture read/parse separate. Inspector CPU and sampled allocations cover freeze plus repeated immutable-prefix calls. No controller, bot, storage writes or browser latency claim. Snapshot after eight event-loop/explicit-GC cycles. Canonical bytes and every descendant freeze independently checked.'},null,2)+'\n');console.log(JSON.stringify({count,initialFreezeMs:result.result.initialFreezeMs,latency:result.result.latency,baselineHeap:baseline.heapUsed,finalHeap:samples.at(-1)!.memory.heapUsed,reachable:samples.at(-1)!.reachable,graphObjects:result.result.graphObjects,directory}));
