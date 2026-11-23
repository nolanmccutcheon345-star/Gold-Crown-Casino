import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createGunzip,gzipSync} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {PerformanceObserver} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import assert from 'node:assert/strict';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {prepareSegments,restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {canonical,validateData} from '../../src/storage/integrity';
import {legalActions,assertAccounting} from '../../src/core/engine';
import {CashStatsProjection} from '../../src/stats/projection';
import {deriveCashStats} from '../../src/stats/cash';
import {observeTimings} from '../../src/performance/timing';

const archiveDirectory='tests/step5b-resource/evidence/step5e-4ab9ea3',directory='tests/step5e-performance/resource-tail-evidence';mkdirSync(directory,{recursive:true});
const expected=JSON.parse(readFileSync(`${archiveDirectory}/report.json`,'utf8')) as {canonicalSHA256:string;finalWallet:number};
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const quantiles=(values:number[])=>{const s=[...values].sort((a,b)=>a-b),q=(p:number)=>s[Math.max(0,Math.ceil(s.length*p)-1)]??null;return{samples:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)??null};};
let randomState=0x5e7a11b9;const random=()=>{randomState+=0x6D2B79F5;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};
// Same entropy algorithm/hash fallback as the resource harness, distinct seed:
// replaying its original stream caused a proven archived-hand ID collision.
Object.defineProperty(globalThis,'crypto',{value:{getRandomValues<T extends ArrayBufferView>(array:T):T{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(let i=0;i<bytes.length;i+=4){let word=random();for(let j=0;j<4&&i+j<bytes.length;j++){bytes[i+j]=word&255;word>>>=8;}}return array;}}});
const timers=new Set<ReturnType<typeof setInterval>>(),realSetInterval=globalThis.setInterval,realClearInterval=globalThis.clearInterval;let maximumTimers=0;
globalThis.setInterval=((fn:(...args:unknown[])=>void,ms?:number,...args:unknown[])=>{const timer=realSetInterval(fn,ms,...args);timer.unref();timers.add(timer);maximumTimers=Math.max(maximumTimers,timers.size);return timer;}) as typeof setInterval;
globalThis.clearInterval=((timer:ReturnType<typeof setInterval>)=>{timers.delete(timer);realClearInterval(timer);}) as typeof clearInterval;
Object.defineProperty(globalThis,'document',{value:Object.assign(new EventTarget(),{visibilityState:'hidden'})});Object.defineProperty(globalThis,'window',{value:new EventTarget()});
let phase='setup';const stages:{phase:string;name:string;start:number;end:number;ms:number}[]=[],gc:{start:number;end:number;ms:number;detail:unknown}[]=[],windows:{phase:string;start:number;end:number;ms:number}[]=[],memories:{phase:string;memory:ReturnType<typeof process.memoryUsage>}[]=[];
observeTimings(s=>{const end=performance.now();stages.push({phase,name:s.name,start:end-s.milliseconds,end,ms:s.milliseconds});});
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())gc.push({start:entry.startTime,end:entry.startTime+entry.duration,ms:entry.duration,detail:(entry as typeof entry&{detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});
async function measured<T>(label:string,fn:()=>Promise<T>):Promise<T>{phase=label;const start=performance.now();try{return await fn();}finally{const end=performance.now();windows.push({phase:label,start,end,ms:end-start});await turn();}}
const remember=(label:string)=>memories.push({phase:label,memory:process.memoryUsage()});
class Port implements PersistencePort {
 data:AppData|null=null;manifest:SegmentedEnvelope|null=null;records=new Map<string,string>();writable=true;commits=0;
 async load(){assert(this.manifest);return this.data=await restoreSegments(this.manifest,async keys=>keys.map(k=>JSON.parse(this.records.get(k)!)));}
 async commit(revision:number|null,data:AppData){assert.equal(this.manifest?.data.revision??null,revision);const next=await prepareSegments(data,this.data,this.manifest);for(const row of next.writes)this.records.set(row.key,JSON.stringify(row.entry));this.records.set('previous',JSON.stringify(this.manifest));this.records.set('current',JSON.stringify(next.envelope));this.manifest=next.envelope;this.data=data;this.commits++;}
 close(){}
}
let operationBefore:{commits:number;revision:number;manifest:string;ledgerEvents:number;wallet:number;table:number}|null=null;
function healthy(controller:SessionController,port:Port){
 if(controller.error){
  const data=controller.data!,failed=(controller as unknown as {failed:{next:AppData}|null}).failed?.next,game=(failed??data).active?.game;
  const priorMatches=data.hands.filter(hand=>hand.id===game?.handId).map(hand=>({id:hand.id,sessionId:hand.sessionId,number:hand.number,net:hand.net,hash:hand.hash}));
  const balances=(value:AppData)=>({revision:value.revision,wallet:value.wallet,ledgerEvents:value.ledger.length,table:value.ledger.reduce((sum,e)=>sum+e.tableDelta,0),hero:value.active?.game.seats.find(s=>s.id===0),street:value.active?.game.street,session:value.active?.sessionId,handId:value.active?.game.handId});
  writeFileSync(`${directory}/failure-context.json`,JSON.stringify({error:controller.error,phase,operationBefore,persistedAfter:balances(data),proposedAfter:failed?balances(failed):null,priorMatches,settlements:data.ledger.filter(e=>e.handId===game?.handId),commitsAfter:port.commits,manifestUnchanged:operationBefore?.manifest===port.records.get('current'),committedDataUnchanged:port.data===data,persistedLedgerTail:data.ledger.slice(-4)},null,2)+'\n');controller.close();
 }
 assert.equal(controller.error,'');
}
global.gc?.();const baseline=process.memoryUsage();
const cpu=new Session();cpu.connect();
const post=<T=unknown>(method:string,params:Record<string,unknown>={})=>new Promise<T>((resolve,reject)=>cpu.post(method as 'Profiler.enable',params,(error,result)=>error?reject(error):resolve(result as T)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
async function run(){
 const port=new Port();let controller:SessionController|null=new SessionController(port),projection:CashStatsProjection|null=new CashStatsProjection();
 await measured('archive.stream',async()=>{for await(const line of createInterface({input:createReadStream(`${archiveDirectory}/canonical-segments.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity})){const split=line.indexOf(',"value":');assert(line.startsWith('{"key":')&&split>0&&line.endsWith('}'));const key=JSON.parse(line.slice(7,split));assert(!port.records.has(key));port.records.set(key,line.slice(split+9,-1));}port.manifest=JSON.parse(port.records.get('current')!);});
 await measured('cold.controller.init',()=>controller!.init());assert.equal(controller.status,'ready');assert.equal(controller.data!.hands.length,10000);assert.equal(controller.data!.wallet,expected.finalWallet);
 assert.equal(createHash('sha256').update(canonical(controller.data)).digest('hex'),expected.canonicalSHA256);remember('cold.canonical.verified');
 await measured('projection.initial.full',async()=>{assert.deepEqual(projection!.derive(controller!.data!.hands,controller!.data!.sessions,0),deriveCashStats(controller!.data!.hands,controller!.data!.sessions,0));});
 await measured('session.start6',()=>controller!.startSession({...DEFAULT_SETTINGS,seats:6}));assert.equal(controller.error,'');
 let newHands=0;
 for(let n=0;n<500;n++){
  if(n&&n%100===0){controller.close();controller=new SessionController(port);await measured(`reload.${n}`,()=>controller!.init());assert.equal(controller.status,'ready');assert.equal(timers.size,1);remember(`after.reload.${n}`);}
  while(controller.data!.active!.game.street==='complete'||controller.data!.active!.game.actor===0){
   operationBefore={commits:port.commits,revision:controller.data!.revision,manifest:port.records.get('current')!,ledgerEvents:controller.data!.ledger.length,wallet:controller.data!.wallet,table:controller.data!.ledger.reduce((sum,e)=>sum+e.tableDelta,0)};
   const a=controller.data!.active!;
   if(a.game.street==='complete'){
    projection!.derive(controller.data!.hands,controller.data!.sessions,0);newHands=controller.data!.hands.length-10000;
    if(a.game.seats.filter(s=>s.stack>0).length<2){await controller.cashOut();await controller.startSession({...DEFAULT_SETTINGS,seats:6});}
    else{if(a.game.seats.find(s=>s.id===0)!.stack===0)await controller.topUp(20000);await controller.nextHand();}
   }else{const legal=legalActions(a.game);await controller.act(legal.check?{type:'check'}:(newHands%4!==0||legal.callAmount>4000)?{type:'fold'}:{type:'call'},a.game.handId,a.game.revision);}
   healthy(controller,port);assertAccounting(controller.data!.active!.game);
  }
  await measured(`prepare.${n}`,()=>controller!.prepareBot());assert.equal(controller.error,'');assert(controller.data!.active!.pending?.decision);
  const a=controller.data!.active!;await measured(`commit.${n}`,()=>controller!.commitBot(a.game.handId,a.game.revision));assert.equal(controller.error,'');assertAccounting(controller.data!.active!.game);
  if((n+1)%100===0){remember(`decisions.${n+1}`);console.log(JSON.stringify({decisions:n+1,newHands:controller.data!.hands.length-10000}));}
 }
 await measured('final.fullAuditAndStats',async()=>{await validateData(controller!.data!);assert.deepEqual(projection!.derive(controller!.data!.hands,controller!.data!.sessions,0),deriveCashStats(controller!.data!.hands,controller!.data!.sessions,0));});
 const result={decisions:500,completedNewHands:controller.data!.hands.length-10000,wallet:controller.data!.wallet,totalHands:controller.data!.hands.length};remember('before.cleanup');
 controller.close();controller=null;projection.reset('resource-tail release');projection=null;port.data=null;port.manifest=null;port.records.clear();global.gc?.();remember('inside.function.after.clear.gc');assert.equal(timers.size,0);return result;
}
let failure:string|null=null;let result:{decisions:number;completedNewHands:number;wallet:number;totalHands:number}|null=null;
try{result=await run();}catch(error){failure=error instanceof Error?error.stack??error.message:String(error);process.exitCode=1;}observeTimings(null);
for(let n=0;n<6;n++){await turn();global.gc?.();await turn();remember(`after.function.unwind.gc.${n}`);}
const {profile}=await post<{profile:unknown}>('Profiler.stop');cpu.disconnect();observer.disconnect();
const correlations=windows.map(w=>({...w,gcOverlapMs:gc.reduce((sum,g)=>sum+Math.max(0,Math.min(w.end,g.end)-Math.max(w.start,g.start)),0),gcEntries:gc.filter(g=>g.start<w.end&&g.end>w.start)}));
const byName:Record<string,number[]>={};for(const row of stages)(byName[row.name]??=[]).push(row.ms);
writeFileSync(`${directory}/cpu.cpuprofile.json.gz`,gzipSync(JSON.stringify(profile)));writeFileSync(`${directory}/trace.json.gz`,gzipSync(JSON.stringify({windows,stages,gc,timeOrigin:performance.timeOrigin})));
const report={status:failure?'FAIL':'PASS',failure,scope:'Diagnostic from the completed current10000-hand archive, same original segmented-reference persistence and JS hash fallback,target500 actual bot decisions and4 full reloads, Node Inspector1000us sampling and PerformanceObserverGC. No browser or fast-DB performance claim; does not identify the earlier untraced10072ms sample by itself.',...result,maximumTimers,timersAfterClose:timers.size,baseline,memories,botPreparation:quantiles(windows.filter(w=>w.phase.startsWith('prepare.')).map(w=>w.ms)),stageQuantiles:Object.fromEntries(Object.entries(byName).map(([k,v])=>[k,quantiles(v)])),slowestPreparations:correlations.filter(w=>w.phase.startsWith('prepare.')).sort((a,b)=>b.ms-a.ms).slice(0,20),windows:correlations,profile:'cpu.cpuprofile.json.gz',trace:'trace.json.gz'};
writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,decisions:result?.decisions,botPreparation:report.botPreparation,baseline,released:memories.at(-1),maximumTimers,timersAfterClose:timers.size}));
