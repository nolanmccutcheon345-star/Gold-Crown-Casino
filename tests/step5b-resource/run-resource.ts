import {mkdirSync,writeFileSync,readFileSync,createWriteStream,statSync} from 'node:fs';
import {createGzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import assert from 'node:assert/strict';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {prepareSegments,restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {canonical,validateData} from '../../src/storage/integrity';
import {assertAccounting,legalActions} from '../../src/core/engine';
import {CashStatsProjection} from '../../src/stats/projection';
import {deriveCashStats} from '../../src/stats/cash';
import {publicMemoryHands} from '../../src/session/bot-observation';
import {observeTimings} from '../../src/performance/timing';
const goal=Number(process.env.RESOURCE_HANDS??10000),name=process.env.RESOURCE_RUN??'full',directory=`tests/step5b-resource/evidence/${name}`;mkdirSync(directory,{recursive:true});
const quantiles=(v:number[])=>{const s=[...v].sort((a,b)=>a-b),q=(p:number)=>s[Math.max(0,Math.ceil(s.length*p)-1)]??null;return {samples:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)??null};};
let randomState=0x51a7e5b;const random=()=>{randomState+=0x6D2B79F5;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};
// Deterministic entropy only in this explicitly isolated test process.
Object.defineProperty(globalThis,'crypto',{value:{getRandomValues<T extends ArrayBufferView>(array:T):T{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(let i=0;i<bytes.length;i+=4){let word=random();for(let j=0;j<4&&i+j<bytes.length;j++){bytes[i+j]=word&255;word>>>=8;}}return array;}}});
class SegmentReference implements PersistencePort {
 writable=true;data:AppData|null=null;manifest:SegmentedEnvelope|null=null;records=new Map<string,string>();bytes=0;commits=0;writes=0;maxWrites=0;maxHeaderBytes=0;
 async load(){if(!this.manifest)return null;return this.data=await restoreSegments(this.manifest,async keys=>keys.map(k=>{const json=this.records.get(k);return json?JSON.parse(json):undefined;}));}
 put(key:string,value:unknown){const json=JSON.stringify(value);this.bytes+=Buffer.byteLength(json)-Buffer.byteLength(this.records.get(key)??'');this.records.set(key,json);}
 async commit(expected:number|null,data:AppData){assert.equal(this.manifest?.data.revision??null,expected);const prepared=await prepareSegments(data,this.data,this.manifest);for(const w of prepared.writes)this.put(w.key,w.entry);if(this.manifest)this.put('previous',this.manifest);this.put('current',prepared.envelope);this.manifest=prepared.envelope;this.data=data;this.commits++;this.writes+=prepared.writes.length;this.maxWrites=Math.max(this.maxWrites,prepared.writes.length);this.maxHeaderBytes=Math.max(this.maxHeaderBytes,Buffer.byteLength(this.records.get('current')!));}
 close(){}
}
const timers=new Set<ReturnType<typeof setInterval>>(),realSetInterval=globalThis.setInterval,realClearInterval=globalThis.clearInterval;let maximumTimers=0;
globalThis.setInterval=((fn:(...args:unknown[])=>void,ms?:number,...args:unknown[])=>{const timer=realSetInterval(fn,ms,...args);timer.unref();timers.add(timer);maximumTimers=Math.max(maximumTimers,timers.size);return timer;}) as typeof setInterval;
globalThis.clearInterval=((timer:ReturnType<typeof setInterval>)=>{timers.delete(timer);realClearInterval(timer);}) as typeof clearInterval;
// This provides the controller's actual lifecycle callbacks/timer; no rendered DOM.
const doc=Object.assign(new EventTarget(),{visibilityState:'hidden'}),win=new EventTarget();Object.defineProperty(globalThis,'document',{value:doc});Object.defineProperty(globalThis,'window',{value:win});
const memory=()=>{global.gc?.();return process.memoryUsage();};
const baseline=memory(),port=new SegmentReference();let controller:SessionController|null=new SessionController(port),stats:CashStatsProjection|null=new CashStatsProjection();
const policyTimings:number[]=[],preparation:number[]=[],handMs:number[]=[],checkpoints:unknown[]=[],seatsHands:Record<string,number>={},endings:Record<string,number>={},versions=new Set<string>();let actions=0,decisions=0,maxMemoryWindow=0,maxFrames=0,reloads=0,threeStreetHands=0;
observeTimings(sample=>{if(sample.name==='bot.policy')policyTimings.push(sample.milliseconds);});
await controller.init();assert.equal(controller.status,'ready');await controller.adjustBankroll(100000000,'Isolated U12 resource budget');
const started=performance.now();let batchStarted=started,lastCount=0;
const snapshot=async (count:number)=>{
 const data=controller!.data!;const begun=performance.now();await validateData(data);const incremental=stats!.derive(data.hands,data.sessions,Date.parse('2026-11-01T00:00:00Z')),full=deriveCashStats(data.hands,data.sessions,Date.parse('2026-11-01T00:00:00Z'));assert.equal(canonical(incremental),canonical(full));
 assert.equal(data.hands.length,count);assert.equal(new Set(data.hands.map(h=>h.id)).size,count);assert.equal(data.ledger.filter(e=>e.kind==='hand-net').length,count);assert.equal(data.wallet+(data.active?.game.seats.find(s=>s.id===0)?.stack??0),data.ledger.reduce((n,e)=>n+e.walletDelta+e.tableDelta,0));
 assert.equal(port.records.size,Object.values(port.manifest!.segments).reduce((sum,segment)=>sum+segment.count,0)+2);
 const state=(globalThis as unknown as {__resourceRangeCache:()=>{shape:number;analysis:number}}).__resourceRangeCache();assert.ok(state.shape<=4&&state.analysis<=8);
 const sampled=memory(),row={hands:count,sessions:data.sessions.length,resources:sampled,storageBytes:port.bytes,storageRecords:port.records.size,commits:port.commits,segmentWrites:port.writes,cacheEntries:state,liveTimers:timers.size,projection:stats!.getDiagnostics(),batchHands:count-lastCount,batchMs:performance.now()-batchStarted,fullIntegrityAndStatsReplayMs:performance.now()-begun};checkpoints.push(row);writeFileSync(`${directory}/progress.json`,JSON.stringify({goal,completed:count,elapsedMs:performance.now()-started,checkpoints},null,2));process.stdout.write(JSON.stringify(row)+'\n');lastCount=count;batchStarted=performance.now();
};
await snapshot(0);
for(let n=1;n<=goal;n++){
 const c:SessionController=controller!;const start=performance.now();
 if(!c.data!.active){const seats=[2,6,10][Math.floor((n-1)/100)%3];await c.startSession({...DEFAULT_SETTINGS,seats,buyIn:20000,stake:'0',population:Math.floor(n/100)%2?'low':'high'});}
 else if(c.data!.active.game.street==='complete'){const g=c.data!.active.game;if(g.seats.find(s=>s.id===0)!.stack===0)await c.topUp(20000);await c.nextHand();}
 assert.equal(c.error,'');const occupied=c.data!.active!.game.seats.length;seatsHands[occupied]=(seatsHands[occupied]??0)+1;
 let steps=0;while(c.data!.active!.game.street!=='complete'){
  assert.ok(++steps<400,'No stalled/unbounded hand');const a=c.data!.active!,g=a.game;assertAccounting(g);maxFrames=Math.max(maxFrames,a.frames.length);
  if(g.actor===0){const legal=legalActions(g);await c.act(legal.check?{type:'check'}:(n%4!==0||legal.callAmount>4000)?{type:'fold'}:{type:'call'},g.handId,g.revision);}
  else{versions.add(a.profiles[g.actor!].policyVersion);const start=performance.now();await c.prepareBot();preparation.push(performance.now()-start);assert.equal(c.error,'');const prepared=c.data!.active!;assert.ok(prepared.pending?.decision);await c.commitBot(prepared.game.handId,prepared.game.revision);decisions++;}
  actions++;assert.equal(c.status,'ready');assert.equal(c.error,'');
 }
 const game=c.data!.active!.game;assertAccounting(game);const ending=game.board.length===5?'five-card-board':'early';endings[ending]=(endings[ending]??0)+1;if(game.board.length===5)threeStreetHands++;
 maxMemoryWindow=Math.max(maxMemoryWindow,publicMemoryHands(c.data!.hands,c.data!.active!.sessionId,Math.min(1,occupied-1)).length);assert.ok(maxMemoryWindow<=120);stats!.derive(c.data!.hands,c.data!.sessions,Date.parse('2026-11-01T00:00:00Z'));
 if(n%100===0||game.seats.filter(s=>s.stack>0).length<2){await c.cashOut();assert.equal(c.error,'');}
 handMs.push(performance.now()-start);
 if(n===100||n%1000===0||n===goal){await snapshot(n);if(n<goal){c.close();controller=new SessionController(port);await controller.init();assert.equal(controller.status,'ready');assert.equal(controller.data!.hands.length,n);reloads++;assert.equal(timers.size,1);}}
}
if(controller!.data!.active)await controller!.cashOut();assert.equal(controller!.error,'');await validateData(controller!.data!);assert.equal(controller!.data!.hands.length,goal);assert.equal(controller!.data!.wallet,100000000+controller!.data!.hands.reduce((sum,h)=>sum+h.net,0));assert.ok(!controller!.data!.policyViolations?.length);
const canonicalSHA256=createHash('sha256').update(canonical(controller!.data)).digest('hex'),finalWallet=controller!.data!.wallet,sessionCount=controller!.data!.sessions.length;
async function* archiveEntries(){for(const [key,json] of port.records)yield `{"key":${JSON.stringify(key)},"value":${json}}\n`;}
await pipeline(Readable.from(archiveEntries()),createGzip(),createWriteStream(`${directory}/canonical-segments.jsonl.gz`));const archiveBytes=statSync(`${directory}/canonical-segments.jsonl.gz`).size;
let restored=await port.load();assert.equal(createHash('sha256').update(canonical(restored)).digest('hex'),canonicalSHA256);restored=null;
controller!.close();controller=null;stats!.reset('resource release');stats=null;port.data=null;port.manifest=null;port.records.clear();port.bytes=0;observeTimings(null);assert.equal(timers.size,0);
const released=memory();const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(['src/session/controller.ts','src/storage/verified.ts','src/storage/segments.ts','src/bots/policy.ts','src/bots/ranges.ts','tests/step5b-resource/run-resource.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{node:process.version,nodeFlags:process.execArgv,cpu:cpus()[0]?.model,gcExposed:!!global.gc},methodology:'10,000 target genuine full controller hands with current policy for every automated opponent action. Hero checks, otherwise folds in3of4hands and calls <=20BB ineach4th. Table sizes2/6/10 rotate per100hands; busted opponents naturally leave. Deterministic test-only entropy seed0x51a7e5b. Immutable canonical records retained in production segmented serialization reference; no IndexedDB/browser claim. Real Node controller timer lifecycle uses hidden EventTarget document, so clock does not change deterministic accounting; every controller closes/reloads at checkpoints. Full replay stats/financial audit atcheckpoints; allhistory restored atfinal. GC-normalized heap trend includes retainedcanonical data, segmentedJSONstrings and harnesssamplearrays. Range-cache size instrumentation is build-time read-only telemetry in actual productionmodule; no policychange. Concurrentsharedhost workloads canaffect timing; notreleasebrowserlatency.',status:'PASS',completedHands:goal,sessionCount,actions,decisions,threeStreetHands,seatsHands,endings,versions:[...versions],reloads,baseline,released,maximumTimers,timersAfterClose:timers.size,maxMemoryWindow,maxFrames,maxSegmentWritesPerCommit:port.maxWrites,maxHeaderBytes:port.maxHeaderBytes,policyLatency:quantiles(policyTimings),botPreparationLatency:quantiles(preparation),handLatency:quantiles(handMs),elapsedMs:performance.now()-started,canonicalSHA256,archiveBytes,finalWallet,checkpoints};writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));process.stdout.write(JSON.stringify({status:report.status,completedHands:goal,decisions,elapsedMs:report.elapsedMs,archiveBytes:report.archiveBytes,botPreparationLatency:report.botPreparationLatency})+'\n');
