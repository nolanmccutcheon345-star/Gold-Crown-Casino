import {readFileSync,writeFileSync,openSync,writeSync,closeSync,createReadStream,createWriteStream,unlinkSync} from 'node:fs';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {writeProfileArtifact} from '../step5g-performance/profile-artifact';
import {PerformanceObserver,monitorEventLoopDelay} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {cpus,loadavg} from 'node:os';
import assert from 'node:assert/strict';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {legalActions,assertAccounting,observeBot} from '../../src/core/engine';
import {canonical} from '../../src/storage/integrity';
import {getArchiveContext,totalHandCount} from '../../src/storage/verified';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';
import {observeTimings} from '../../src/performance/timing';
import {referenceFinancial,financialInput} from '../step5e-independent/financial-reference';
import {fileIDBReference} from '../step5f-performance/file-idb-reference';
import {DiskRecords} from '../step5f-performance/disk-records';
import type {AppData} from '../../src/session/types';

const size=Number(process.argv[2]),directory=process.argv[3],out=process.argv[4],goal=Number(process.argv[5]);
const sustained=process.env.STEP5G_SUSTAINED==='1';let forcedGCCalls=0;const sampleGC=()=>{if(!sustained&&global.gc){forcedGCCalls++;global.gc();}};
const source=JSON.parse(readFileSync(`${out}/source.json`,'utf8')),turn=()=>new Promise<void>(r=>setImmediate(r));
const quantiles=(v:number[])=>{const a=[...v].sort((a,b)=>a-b),at=(p:number)=>a[Math.max(0,Math.ceil(a.length*p)-1)]??null;return{samples:a.length,p50:at(.5),p95:at(.95),p99:at(.99),max:a.at(-1)??null};};
let randomState=0x5f061001+size;const random=()=>{randomState+=0x6D2B79F5;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};
const nativeCrypto=globalThis.crypto;
Object.defineProperty(globalThis,'crypto',{value:{subtle:nativeCrypto.subtle,getRandomValues<T extends ArrayBufferView>(a:T):T{const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(let i=0;i<bytes.length;i+=4){let v=random();for(let j=0;j<4&&i+j<bytes.length;j++){bytes[i+j]=v&255;v>>>=8;}}return a;}}});
type Span={name:string;phase:string;decision:number;start:number;end:number;ms:number};
let failureState:(()=>unknown)|null=null;let phase='setup',decision=0,traceRows=0;const windows:Span[]=[],gc:{start:number;end:number;ms:number;kind?:number;flags?:number}[]=[],memory:unknown[]=[],slow:unknown[]=[],reloads:unknown[]=[];
const stagesByPhase=new Map<string,Map<string,{count:number;totalMs:number;maxMs:number}>>(),traceBuffer:Span[]=[];
const tracePath=`${out}/${size}-trace.jsonl`,traceFd=openSync(tracePath,'w');
function flush(){if(traceBuffer.length){writeSync(traceFd,traceBuffer.map(x=>JSON.stringify(x)).join('\n')+'\n');traceRows+=traceBuffer.length;traceBuffer.length=0;}}
observeTimings(sample=>{const end=performance.now(),row={name:sample.name,phase,decision,start:sample.startTime??end-sample.milliseconds,end:sample.endTime??end,ms:sample.milliseconds};traceBuffer.push(row);const map=stagesByPhase.get(phase)??new Map();stagesByPhase.set(phase,map);const item=map.get(row.name)??{count:0,totalMs:0,maxMs:0};item.count++;item.totalMs+=row.ms;item.maxMs=Math.max(item.maxMs,row.ms);map.set(row.name,item);if(traceBuffer.length>=1000)flush();});
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){const detail=(e as PerformanceEntry & {detail?:{kind?:number;flags?:number}}).detail;gc.push({start:e.startTime,end:e.startTime+e.duration,ms:e.duration,...detail});}});observer.observe({entryTypes:['gc']});
async function measured<T>(name:string,fn:()=>Promise<T>){phase=name;const start=performance.now();try{return await fn();}finally{const end=performance.now();windows.push({name,phase:name,decision,start,end,ms:end-start});flush();await turn();}}
async function remember(label:string){for(let i=0;i<3;i++){await turn();sampleGC();}await turn();const row={phase:label,decision,memory:process.memoryUsage(),hostLoadAverage:loadavg()};memory.push(row);return row;}
const cpu=new Session();cpu.connect();const post=<T=unknown>(method:string,params:Record<string,unknown>={})=>new Promise<T>((resolve,reject)=>cpu.post(method as 'Profiler.enable',params,(error,result)=>error?reject(error):resolve(result as T)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('HeapProfiler.enable');
const profiled=process.env.STEP5F_PROFILE==='1';
const cpuAnchors:{startBefore?:number;startAfter?:number;stopBefore?:number}={};
if(profiled){cpuAnchors.startBefore=performance.now();await post('Profiler.start');cpuAnchors.startAfter=performance.now();await post('HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});}
const baseline=await remember('process.beforeFixtureIndex');
function account(data:AppData){const context=getArchiveContext(data);return referenceFinancial({...financialInput(data),handIndex:context?.handIndex??data.hands});}
function breakdown(store:DiskRecords){const groups:Record<string,{records:number;bytes:number}>={};for(const row of store.rows.values()){const key=row.key;const family=key.startsWith('v2:hands:')?'canonicalHands':key.startsWith('v2:ledger:')?'canonicalLedger':key.startsWith('v2:closedSessions:')?'canonicalSessions':key.startsWith('v2:importedHands:')?'studyImports':key.startsWith('packed-v1:hands:')?'packedHandReplicas':/backup|migration|pre-/.test(key)?'migrationAndRollbackBackup':key.startsWith('recovery-v1:checkpoint:')?'checkpointGenerations':key.startsWith('recovery-v1:journal:')?'incrementalJournal':key.startsWith('recovery-v1:')?'checkpointHeads':key==='current'||key==='previous'?'currentAndPreviousManifests':'other';const value=groups[family]??={records:0,bytes:0};value.records++;value.bytes+=row.bytes;}return{totalBytes:store.bytes,records:store.size,groups};}
async function run(){
 const store=new DiskRecords(directory),adapter=fileIDBReference(store as unknown as Map<string,string>);let port:BrowserPersistence|null=adapter.attach(),controller:SessionController|null=new SessionController(port);
 failureState=()=>{const raw=store.get('current'),current=raw?JSON.parse(raw):null,privatePort=port as unknown as {manifest?:{data?:{revision:number};checksum:string};saved?:AppData};return{phase,decision,controller:{status:controller?.status,error:controller?.error,revision:controller?.data?.revision,wallet:controller?.data?.wallet,ledger:controller?.data?.ledger.length,hand:controller?.data?.active?.game.handId,handRevision:controller?.data?.active?.game.revision},current:{revision:current?.data?.revision,checksum:current?.checksum},port:{revision:privatePort?.manifest?.data?.revision,checksum:privatePort?.manifest?.checksum,savedRevision:privatePort?.saved?.revision},lease:store.get('lease'),files:{current:store.rows.get('current'),previous:store.rows.get('previous'),count:store.rows.size,distinctNames:new Set([...store.rows.values()].map(r=>r.name)).size}};};const initialStorage=breakdown(store);await remember('fixture.indexOnly');
 await measured(process.env.STEP5F_READY_FIXTURE==='1'?'freshCheckpoint.controllerInit':'firstConversion.controllerInit',()=>controller!.init());assert.equal(controller.status,'ready');assert.equal(controller.error,'');assert.equal(totalHandCount(controller.data!),size);assert.equal(controller.data!.wallet,store.initial.expectedWallet);
 const firstAccount=account(controller.data!);await remember(process.env.STEP5F_READY_FIXTURE==='1'?'freshCheckpoint.readyCompact':'firstConversion.readyFull');const convertedStorage=breakdown(store);
 async function reload(label:string){controller!.close();controller!.data=null;controller=null;port=null;await turn();sampleGC();port=adapter.attach();controller=new SessionController(port);await measured(label,()=>controller!.init());assert.equal(controller.status,'ready');assert.equal(controller.error,'');}
 const recovery:number[]=[];
 for(let n=0;n<3;n++){await reload(`fastRecovery.${n}`);recovery.push(windows.at(-1)!.ms);assert.deepEqual(account(controller!.data!),firstAccount);assert(controller!.data!.hands.length<=120);await remember(`fastRecovery.${n}.readyCompact`);}
 let completed=0,sessionHands=0,sessions=0;const preparationsBySeat:Record<string,number[]>={};const decisionContexts:{decision:number;seats:number;street:string;handId:string;revision:number;ms:number}[]=[];const seatDecisionCounts:Record<string,number>={},streetCounts:Record<string,number>={},policies=new Set<string>();
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();await turn();loop.reset();const playStart=performance.now();
 async function action(){
  const d=controller!.data!;
  if(!d.active){sessionHands=0;await measured('session.start',()=>controller!.startSession({...DEFAULT_SETTINGS,seats:[2,6,10][sessions++%3],buyIn:20000,population:sessions%2?'low':'high'}));return;}
  const game=d.active.game;assertAccounting(game);
  if(game.street==='complete'){
   if(decision>=goal||sessionHands>=40||game.seats.filter(s=>s.stack>0).length<2){await measured('session.cashOut',()=>controller!.cashOut());return;}
   if(game.seats[0].stack===0)await measured('session.topUp',()=>controller!.topUp(20000));await measured('hand.next',()=>controller!.nextHand());return;
  }
  const before=totalHandCount(d);
  if(game.actor===0){const legal=legalActions(game);await measured('hero.action',()=>controller!.act(legal.check?{type:'check'}:completed%4!==0||legal.callAmount>4000?{type:'fold'}:{type:'call'},game.handId,game.revision));}
  else{
   decision++;seatDecisionCounts[game.seats.length]=(seatDecisionCounts[game.seats.length]??0)+1;streetCounts[game.street]=(streetCounts[game.street]??0)+1;policies.add(d.active.profiles[game.actor!].policyVersion);
   const mark=windows.length;await measured('ordinary.bot.prepare',()=>controller!.prepareBot());const span=windows[mark];(preparationsBySeat[game.seats.length]??=[]).push(span.ms);decisionContexts.push({decision,seats:game.seats.length,street:game.street,handId:game.handId,revision:game.revision,ms:span.ms});assert.equal(controller!.error,'');const prepared=controller!.data!.active!;assert(prepared.pending?.decision);
   if(span.ms>250){slow.push({span,ownPermittedObservation:observeBot(game,game.actor!,prepared.pending.policyVersion,prepared.pending.decisionId),proposedAction:prepared.pending.decision,profileVersion:d.active.profiles[game.actor!].policyVersion,memory:process.memoryUsage(),hostLoad:loadavg()});slow.sort((a,b)=>(b as {span:Span}).span.ms-(a as {span:Span}).span.ms);if(slow.length>20)slow.length=20;}
   const pending=canonical(prepared.pending);await measured('ordinary.bot.idempotentPrepare',()=>controller!.prepareBot());assert.equal(canonical(controller!.data!.active!.pending),pending);
   if(!sustained&&decision%250===0){const revision=controller!.data!.revision,events=controller!.data!.ledger.length;await reload('pending.fastRecovery');assert.equal(controller!.data!.revision,revision);assert.equal(controller!.data!.ledger.length,events);assert.equal(canonical(controller!.data!.active!.pending),pending);await measured('pending.resumePrepare',()=>controller!.prepareBot());assert.equal(canonical(controller!.data!.active!.pending),pending);reloads.push({decision,revision,ledgerEvents:events,pendingStable:true});}
   const active=controller!.data!.active!;await measured('ordinary.bot.commit',()=>controller!.commitBot(active.game.handId,active.game.revision));
   if(!sustained&&decision%250===0){const committed=controller!.data;await measured('ordinary.bot.staleCommit',()=>controller!.commitBot(active.game.handId,active.game.revision));assert.equal(controller!.data,committed);assert.match(controller!.error,/Obsolete/);controller!.error='';}
   if(decision%200===0){await remember('activePlay.compact');console.log(JSON.stringify({size,decision,completed,hands:controller!.totalHandCount}));}
  }
  assert.equal(controller!.error,'');assert.equal(controller!.status,'ready');assertAccounting(controller!.data!.active!.game);const added=totalHandCount(controller!.data!)-before;assert(added===0||added===1);completed+=added;sessionHands+=added;
 }
 while(decision<goal||controller!.data!.active)await action();
 const playEnd=performance.now(),loopDelay={p50Ms:loop.percentile(50)/1e6,p95Ms:loop.percentile(95)/1e6,p99Ms:loop.percentile(99)/1e6,maxMs:loop.max/1e6};loop.disable();
 const finalCompactAccount=account(controller!.data!);assert.equal(finalCompactAccount.table,0);assert.equal(finalCompactAccount.manual,firstAccount.manual);const finalStorage=breakdown(store);await remember('activePlay.finished');
 const context=getArchiveContext(controller!.data!)!;assert(context);const cp=context.statistics,projected=CashStatsProjection.restoreCheckpoint(cp,cp.checkpoint).appendVerifiedTail(controller!.data!.hands.slice(context.statisticsHands-context.handOffset),controller!.data!.sessions,0);
 await measured('history.explicitFullLoad',async()=>{await controller!.loadFullHistory();assert.deepEqual(account(controller!.data!),finalCompactAccount);assert.deepEqual(deriveCashStats(controller!.data!.hands,controller!.data!.sessions,0),projected);});
 await remember('history.fullRetained');
 await reload('afterHistory.fastRecovery');assert.deepEqual(account(controller!.data!),finalCompactAccount);await remember('afterHistory.compactRecovered');
 await measured('audit.explicitCanonical',()=>controller!.auditSavedArchive());assert.equal(controller!.archiveAuditStatus,'verified');assert.deepEqual(account(controller!.data!),finalCompactAccount);await remember('audit.finishedCompact');
 const afterAudit=breakdown(store);assert.deepEqual(afterAudit,finalStorage,'History and audit must not write financial state or duplicate records');
 controller!.close();controller!.data=null;controller=null;port=null;store.rows.clear();failureState=null;
 return{fixture:store.initial,initialStorage,convertedStorage,finalStorage,firstAccount,finalCompactAccount,fastRecovery:quantiles(recovery),decisions:decision,goal,completedHands:completed,sessions,seatDecisionCounts,preparationBySeat:Object.fromEntries(Object.entries(preparationsBySeat).map(([seats,times])=>[seats,quantiles(times)])),decisionContexts,streetCounts,policies:[...policies],reloads,playElapsedMs:playEnd-playStart,nodeEventLoopDelay:loopDelay,ordinaryPreparation:quantiles(windows.filter(w=>w.name==='ordinary.bot.prepare').map(w=>w.ms)),policyLatency:stagesByPhase.get('ordinary.bot.prepare')?.get('bot.policy'),financialAndStatisticsFullReplayAgreement:true,storageAdapterMetrics:adapter.metrics};
}
let result:Awaited<ReturnType<typeof run>>|null=null,failure:string|null=null;
try{result=await run();}catch(e){failure=e instanceof Error?e.stack??e.message:String(e);process.exitCode=1;writeFileSync(`${out}/${size}-failure-context.json`,JSON.stringify((failureState as (()=>unknown)|null)?.(),null,2)+'\n');failureState=null;}
observeTimings(null);flush();closeSync(traceFd);await remember('afterFunctionUnwind');observer.disconnect();
const windowsWithGC=windows.map(w=>({...w,gcOverlapMs:gc.reduce((n,g)=>n+Math.max(0,Math.min(w.end,g.end)-Math.max(w.start,g.start)),0)}));
// Preserve completed execution before potentially large profile serialization.
writeFileSync(`${out}/${size}-completed-scenario.json`,JSON.stringify({executionStatus:failure?'FAIL':'PASS',profileCaptureComplete:false,source,size,sustained,forcedGCCalls,failure,memory,gc,windows:windowsWithGC,stageTotals:Object.fromEntries([...stagesByPhase].map(([p,m])=>[p,Object.fromEntries(m)])),slow,...result},null,2)+'\n');
const profiles:Record<string,unknown>={};
if(profiled){cpuAnchors.stopBefore=performance.now();const cpuResult=await post<{profile:unknown}>('Profiler.stop'),allocationResult=await post<{profile:unknown}>('HeapProfiler.stopSampling');for(const[name,profile]of Object.entries({cpu:cpuResult.profile,allocation:allocationResult.profile})){profiles[name]=writeProfileArtifact(out,`${size}-${name}`,profile);}}
cpu.disconnect();await pipeline(createReadStream(tracePath),createGzip(),createWriteStream(tracePath+'.gz'));unlinkSync(tracePath);
const report={profileCaptureComplete:true,sustained,forcedGCCalls,inputReadyCheckpoint:process.env.STEP5F_READY_FIXTURE==='1',status:failure?'FAIL':'PASS',failure,source,size,profiled,seed:0x5f061001+size,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model,logicalCPUs:cpus().length,hostLoad:loadavg(),flags:process.execArgv},methodology:{fixture:'Fixture creation/extraction completed in a different process. Current process keeps only a key/file/size index, not the498MBcanonical JSON strings. Uses unmodified BrowserPersistence and controller through the existing serialized-IDB request reference backed by disk files. Not native IndexedDB, browser durability, browser rendering or physical-device performance.',timing:'Ordinary decisions separated from first conversion, recovery, explicit history load and audit. Real policy/legality/settlement used; test-only seeded entropy preserves native crypto.subtle. Optional InspectorCPU1ms+allocation32KiBsampling is explicitly recorded per run. Timing spans streamed in batches; memory sampling GC mode is explicit: sustained=true disables all forced GC; sustained=false forces GC outside measured operations. Instrumentation overhead is included, nested spans must not be summed as disjoint time.',memory:(sustained?'Natural GC only; coarse, not normalized live-heap, ':'AfterGC ')+ 'process.memoryUsage with fixture construction excluded. Retained storage index, current app state, profiler/native allocations and bounded diagnostic summaries remain. RSS includes allocator/page-cache effects; not a browser heap guarantee.',limits:['Original10.072s sample lacks individual trace/context and remains historically unattributed.','Node disk reference has different scheduling and storage behavior from native browser.','100/1000/10000 fixture shapes differ; compare before/after only matchedsame-size runs.','No human calibration or real-world poker profitability claim.']},baseline,memory,profiles,cpuAnchors,trace:{path:`${size}-trace.jsonl.gz`,rows:traceRows},gc,windows:windowsWithGC,stageTotals:Object.fromEntries([...stagesByPhase].map(([p,m])=>[p,Object.fromEntries(m)])),slow,...result};
writeFileSync(`${out}/${size}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,size,decisions:result?.decisions,preparation:result?.ordinaryPreparation,fastRecovery:result?.fastRecovery,finalMemory:memory.at(-1),failure}));
