import {createReadStream,readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {createGunzip,gzipSync} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {PerformanceObserver,monitorEventLoopDelay} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {cpus,totalmem} from 'node:os';
import assert from 'node:assert/strict';
import {restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {BrowserPersistence} from '../../src/storage/browser';
import {serializedIDB} from './serialized-idb';
import {getArchiveContext} from '../../src/storage/verified';
import type {CompactArchiveContext} from '../../src/storage/recovery-contracts';
import {observeTimings} from '../../src/performance/timing';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';
import type {AppData} from '../../src/session/types';

const size=Number(process.argv[2]),repeats=Number(process.argv[3]??3),folder=process.argv[4]??'tests/step5e-performance/evidence';
assert([0,100,500,1000,5000,10000].includes(size));assert(Number.isInteger(repeats)&&repeats>0);mkdirSync(folder,{recursive:true});
const source=JSON.parse(readFileSync(`${folder}/source.json`,'utf8'));
const fixtureManifest=JSON.parse(readFileSync('tests/browser/step5d-recovery-fixtures/manifest.json','utf8')) as {fixtures:Array<{size:number;rawSHA256:string;canonicalUncompressedBytes:number;manifestChecksum:string;wallet:number}>};
const fixture=fixtureManifest.fixtures.find(row=>row.size===size)!;
const archive=`tests/browser/step5d-recovery-fixtures/${size}.jsonl.gz`,rawHash=createHash('sha256'),records=new Map<string,string>();
const extractionStart=performance.now();let rawBytes=0;
for await(const line of createInterface({input:createReadStream(archive).pipe(createGunzip()),crlfDelay:Infinity})){
 rawHash.update(line+'\n');rawBytes+=Buffer.byteLength(line)+1;
 const split=line.indexOf(',"value":');assert(line.startsWith('{"key":')&&split>0&&line.endsWith('}'));records.set(JSON.parse(line.slice(7,split)),line.slice(split+9,-1));
}
assert.equal(rawHash.digest('hex'),fixture.rawSHA256);assert.equal(rawBytes,fixture.canonicalUncompressedBytes);
const extractionMs=performance.now()-extractionStart,manifest=JSON.parse(records.get('current')!) as SegmentedEnvelope;assert.equal(manifest.checksum,fixture.manifestChecksum);
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
type Window={phase:string;run:number;name:string;start:number;end:number;ms:number};
const stages:Window[]=[],gc:Array<{start:number;end:number;ms:number;detail:unknown}>=[];
let phase='setup',run=0,readRecords=0,readBytes=0,peak=process.memoryUsage();
const timing=(name:string,start:number)=>{const end=performance.now();stages.push({phase,run,name,start,end,ms:end-start});};
observeTimings(sample=>{const end=performance.now();stages.push({phase,run,name:sample.name,start:end-sample.milliseconds,end,ms:sample.milliseconds});});
(globalThis as typeof globalThis&{__step5eStatisticsTiming?:(ms:number)=>void}).__step5eStatisticsTiming=ms=>{const end=performance.now();stages.push({phase,run,name:'profile.checkpoint.statisticsRestoreAndReconciliation',start:end-ms,end,ms});};
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())gc.push({start:entry.startTime,end:entry.startTime+entry.duration,ms:entry.duration,detail:(entry as typeof entry&{detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});
const memorySampler=setInterval(()=>{const m=process.memoryUsage();if(m.rss>peak.rss)peak=m;},10);memorySampler.unref();
const read=async(keys:string[],store=records)=>{
 const begin=performance.now(),strings=keys.map(key=>{const text=store.get(key);assert.notEqual(text,undefined,`Missing measured storage row ${key}`);readBytes+=Buffer.byteLength(text!);readRecords++;return text!;});timing('profile.storageReadStrings',begin);
 const parse=performance.now(),result=strings.map(text=>JSON.parse(text));timing('profile.parseStoredJSON',parse);return result;
};
function financialReplay(data:AppData,context?:CompactArchiveContext){
 let wallet=0n,table=0n,poker=0n;const ids=new Set<string>(),settlements=new Map<string,number>();
 for(const [index,e]of data.ledger.entries()){
  assert(Number.isSafeInteger(e.walletDelta)&&Number.isSafeInteger(e.tableDelta)&&Number.isSafeInteger(e.pokerNet));assert.equal(e.index,index);assert(!ids.has(e.id));ids.add(e.id);
  wallet+=BigInt(e.walletDelta);table+=BigInt(e.tableDelta);poker+=BigInt(e.pokerNet);assert(wallet>=0n&&table>=0n);
  if(e.kind==='hand-net'){assert(e.handId&&!settlements.has(e.handId));assert.equal(e.pokerNet,e.tableDelta);assert.equal(e.walletDelta,0);settlements.set(e.handId,e.pokerNet);}else assert.equal(e.pokerNet,0);
 }
 const hands=context?.handIndex??data.hands;let net=0n;for(const h of hands){assert.equal(settlements.get(h.id),h.net);net+=BigInt(h.net);}
 assert.equal(hands.length,size);assert.equal(settlements.size,size);assert.equal(wallet,BigInt(data.wallet));assert.equal(wallet,BigInt(fixture.wallet));assert.equal(table,0n);assert.equal(net,poker);assert.equal(data.active,null);
 return {wallet:Number(wallet),table:Number(table),poker:Number(poker),hands:hands.length,ledgerEvents:data.ledger.length,distinctFinancialEvents:ids.size,settlements:settlements.size};
}
interface CpuProfile {nodes:Array<{id:number;callFrame:{functionName:string;url:string;lineNumber:number}}>;samples?:number[];timeDeltas?:number[];startTime:number;endTime:number}
const cpu=new Session();cpu.connect();
const post=<T=unknown>(method:string,params:Record<string,unknown>={})=>new Promise<T>((resolve,reject)=>cpu.post(method as 'Profiler.enable',params,(error,result)=>error?reject(error):resolve(result as T)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});
async function beginCpu(enabled:boolean){if(enabled)await post('Profiler.start');}
async function endCpu(enabled:boolean,label:string){
 if(!enabled)return null;const {profile}=await post<{profile:CpuProfile}>('Profiler.stop'),path=`${size}-${label}.cpuprofile.json.gz`,bytes=gzipSync(JSON.stringify(profile));writeFileSync(`${folder}/${path}`,bytes);
 const nodes=new Map(profile.nodes.map(node=>[node.id,node])),totals=new Map<number,number>();for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples![i];totals.set(id,(totals.get(id)??0)+(profile.timeDeltas?.[i]??0));}
 return {path,sha256:createHash('sha256').update(bytes).digest('hex'),samples:profile.samples?.length??0,durationMs:(profile.endTime-profile.startTime)/1000,topSelfMs:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([id,microseconds])=>({...nodes.get(id)!.callFrame,milliseconds:microseconds/1000}))};
}
async function measured<T>(name:string,index:number,work:()=>Promise<T>,profiled=false){
 phase=name;run=index;readRecords=0;readBytes=0;await turn();global.gc?.();await turn();peak=process.memoryUsage();
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();let previous=performance.now(),maximumHeartbeatMs=0;const beat=setInterval(()=>{const end=performance.now();maximumHeartbeatMs=Math.max(maximumHeartbeatMs,end-previous);previous=end;},10);
 await new Promise(resolve=>setTimeout(resolve,20));loop.reset();maximumHeartbeatMs=0;await beginCpu(profiled);
 const before=process.memoryUsage(),start=performance.now();const value=await work(),end=performance.now(),after=process.memoryUsage();if(after.rss>peak.rss)peak=after;
 await turn();const cpuProfile=await endCpu(profiled,`${name}-${index}`);clearInterval(beat);loop.disable();
 const duringGc=gc.filter(row=>row.start<end&&row.end>start);const ownStages=stages.filter(row=>row.phase===name&&row.run===index&&row.start>=start&&row.end<=end+.5),stageTotals:Record<string,number>={};for(const row of ownStages)stageTotals[row.name]=(stageTotals[row.name]??0)+row.ms;
 return {value,evidence:{phase:name,run:index,milliseconds:end-start,start,end,readRecords,readBytes,before,after,observedPeak:peak,peakLimitation:'10ms sampling plus phase endpoints can miss allocations inside a synchronous block.',nodeEventLoop:{p50Ms:loop.percentile(50)/1e6,p95Ms:loop.percentile(95)/1e6,p99Ms:loop.percentile(99)/1e6,maxMs:loop.max/1e6,maximum10msHeartbeatInterval:maximumHeartbeatMs,limitation:'Node event loop delay, not browser long tasks or INP.'},gc:{count:duringGc.length,totalMs:duringGc.reduce((n,row)=>n+row.ms,0),maxMs:Math.max(0,...duringGc.map(row=>row.ms))},stageTotals,cpuProfile}};
}
const runs:unknown[]=[],fullTimes:number[]=[],fastTimes:number[]=[];let last:AppData|null=null;
for(let i=0;i<repeats;i++){
 last=null;await turn();global.gc?.();
 const measuredFull=await measured('fullCanonicalRestore',i,()=>restoreSegments(JSON.parse(records.get('current')!),keys=>read(keys)),size===10000&&i===0);
 last=measuredFull.value;(measuredFull as {value:unknown}).value=null;
 const accounting=financialReplay(last);fullTimes.push(measuredFull.evidence.milliseconds);runs.push({...measuredFull.evidence,accounting});
 console.log(JSON.stringify({size,phase:'fullCanonicalRestore',run:i,ms:measuredFull.evidence.milliseconds}));
}
assert(last);
const referenceStart=performance.now(),reference=deriveCashStats(last.hands,last.sessions,0),referenceStatsMs=performance.now()-referenceStart;
const adapter=serializedIDB(records,(bytes,count)=>{readBytes+=bytes;readRecords+=count;});
let activePort:BrowserPersistence|null=adapter.attach();Object.assign(activePort,{saved:last,manifest});
const conversion=await measured('initialCheckpointConversion',0,()=>activePort!.installRecoveryCheckpoint(),size===10000);
runs.push(conversion.evidence);
const initialSerializationMs=conversion.evidence.stageTotals['profile.idbSerializeWrite']??0;
const checkpointStoredBytes=[...records].filter(([key])=>key.startsWith('recovery-v1:')).reduce((n,[,text])=>n+Buffer.byteLength(text),0);
activePort.close();Object.assign(activePort,{saved:null,fast:null,manifest:null});activePort=null;last=null;await turn();
for(let i=0;i<repeats;i++){
 const fast=await measured('fastCheckpointRestore',i,async()=>{activePort=adapter.attach();return activePort.load();},size===10000&&i===0);
 let data:AppData|null=fast.value;assert(data);let context:CompactArchiveContext|null=getArchiveContext(data)!;assert(context);
 const accounting=financialReplay(data,context);
 const statisticsStart=performance.now(),projection=CashStatsProjection.restoreCheckpoint(context.statistics,context.statistics.checkpoint),stats=projection.appendVerifiedTail(data.hands.slice(context.statisticsHands-context.handOffset),data.sessions,0),statisticsReadMs=performance.now()-statisticsStart;
 assert.deepEqual(stats,reference);fastTimes.push(fast.evidence.milliseconds);runs.push({...fast.evidence,accounting,statisticsReadMs,fullReplayStatsEqual:true,residentHands:data.hands.length,canonicalHands:context.handIndex.length,archiveReadRecords:Math.min(120,size),completeBrowserPersistenceLoad:true,financialArchiveVerified:true,residentArchiveVerified:true,keyInventoryVerified:true,currentManifestFenceVerified:true});
 console.log(JSON.stringify({size,phase:'fastCheckpointRestore',run:i,ms:fast.evidence.milliseconds,residentHands:data.hands.length}));
 (fast as {value:unknown}).value=null;data=null;context=null;
 (activePort as BrowserPersistence|null)?.close();if(activePort)Object.assign(activePort,{saved:null,fast:null,manifest:null});activePort=null;await turn();
}
const quantiles=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),q=(p:number)=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];return{samples:sorted.length,p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1),warning:sorted.length<100?'Descriptive order statistics only: p95 and p99 are the observed maximum at this small sample size. Not a tail-latency guarantee.':null};};
observeTimings(null);clearInterval(memorySampler);observer.disconnect();cpu.disconnect();await turn();global.gc?.();
const report={status:'PASS',source,environment:{node:process.version,flags:process.execArgv,cpu:cpus()[0]?.model,logicalCPUs:cpus().length,hostMemoryBytes:totalmem(),platform:process.platform,architecture:process.arch,reference:'Native Node, serial JSON-string storage reference. No browser/IndexedDB/physical-device timing claim.'},size,repeats,archive:{path:archive,compressedBytes:statSync(archive).size,rawBytes,expectedSHA256:fixture.rawSHA256,manifestChecksum:manifest.checksum,extractionMs,bytePreservation:'Existing Step5D archives read unchanged; complete decompressed archive hash matched authoritative fixture manifest.'},methodology:{cold:'Each restore reads/parses fresh serialized objects; private audited-object caches cannot be reused between runs. Node process/JIT remains warm after first sample. Forced GC before each run excluded from measured region.',matched:'Same canonical save and same financial totals. Three complete canonical reconstructions, one actual BrowserPersistence.installRecoveryCheckpoint on the fully audited save, and three fresh actual BrowserPersistence.load calls through an asynchronous serialized-string IDB request adapter. Lease ownership is pre-acquired for this single-process reference. Optional all-history packing is not performed by the measured checkpoint-install step. Browser IndexedDB has different disk, scheduling and durability costs.',timeToSafeGameplay:'The actual BrowserPersistence.load returns only after private envelope/journal verification, financial replay, actual canonical ledger/session/import byte verification, bounded resident archive verification, indexed key inventory, and current-manifest fence. Older nonresident bodies remain retained for independent audit.',fullHistoricalAudit:'fullCanonicalRestore reconstructs and independently audits all canonical hand records; its latency is reported separately, not misrepresented as complete at fast readiness.',profiles:'Node Inspector CPU sampling, 1000 microseconds; first 10k full/fast sample and conversion are profiled. CPU overhead is included in those samples.',stageInterpretation:'Nested stage durations overlap and must not be summed as disjoint wall time. Timing-only bundle instrumentation is retained in source.json.',notExecuted:['Browser INP/long tasks','Active-hand startup','2000 bot-decision rare-stall workload','Physical devices']},summary:{fullCanonical:quantiles(fullTimes),fastCheckpoint:quantiles(fastTimes),initialConversionMs:conversion.evidence.milliseconds,initialSerializationMs,checkpointStoredBytes,referenceFullStatsMs:referenceStatsMs,financialAgreement:true,statsFullReplayAgreement:true},runs,postReleaseMemory:process.memoryUsage()};
writeFileSync(`${folder}/${size}.json`,JSON.stringify(report,null,2)+'\n');writeFileSync(`${folder}/${size}-trace.json.gz`,gzipSync(JSON.stringify({stages,gc,timeOrigin:performance.timeOrigin})));
console.log(JSON.stringify({size,status:'PASS',summary:report.summary}));
