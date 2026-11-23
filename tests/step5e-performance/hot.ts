import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGunzip,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {PerformanceObserver,monitorEventLoopDelay} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {BrowserPersistence} from '../../src/storage/browser';
import {serializedIDB} from './serialized-idb';
import {FAST_HEAD_KEY} from '../../src/storage/financial-checkpoint';
import {getArchiveContext,totalHandCount} from '../../src/storage/verified';
import type {AppData,PersistencePort} from '../../src/session/types';
import {canonical} from '../../src/storage/integrity';
import {observeTimings,timed} from '../../src/performance/timing';
import {legalActions,assertAccounting} from '../../src/core/engine';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';
import {referenceFinancial,financialInput} from '../step5e-independent/financial-reference';

const goal=Number(process.argv[2]??2000),folder=process.argv[3]??'tests/step5e-performance/hot-evidence';mkdirSync(folder,{recursive:true});
const source=JSON.parse(readFileSync(`${folder}/source.json`,'utf8')),archive='tests/browser/step5d-recovery-fixtures/10000.jsonl.gz';
let randomState=0x5e20004a;
const random=()=>{randomState+=0x6D2B79F5;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};
const nativeCrypto=globalThis.crypto;
Object.defineProperty(globalThis,'crypto',{value:{subtle:nativeCrypto.subtle,getRandomValues<T extends ArrayBufferView>(array:T):T{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(let i=0;i<bytes.length;i+=4){let word=random();for(let j=0;j<4&&i+j<bytes.length;j++){bytes[i+j]=word&255;word>>>=8;}}return array;}}});
type Span={name:string;start:number;end:number;ms:number;decision:number;hands:number;seats:number};
const stages:Span[]=[],windows:Span[]=[],gc:Array<{start:number;end:number;ms:number}>=[],memory:unknown[]=[],slow:unknown[]=[],reloads:unknown[]=[];
let decision=0,hands=10000,seats=0;
observeTimings(sample=>{const end=performance.now();stages.push({name:sample.name,start:end-sample.milliseconds,end,ms:sample.milliseconds,decision,hands,seats});});
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({start:e.startTime,end:e.startTime+e.duration,ms:e.duration});});observer.observe({entryTypes:['gc']});
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function measured<T>(name:string,fn:()=>Promise<T>){const start=performance.now();try{return await fn();}finally{const end=performance.now();windows.push({name,start,end,ms:end-start,decision,hands,seats});}}
class Port implements PersistencePort {
 writable=true;browser:BrowserPersistence|null=null;records=new Map<string,string>();adapter=serializedIDB(this.records);commits=0;promotions=0;retired=0;
 get manifest(){return JSON.parse(this.records.get('current')!) as SegmentedEnvelope;}
 read=async(keys:string[])=>timed('port.independentAuditReadParse',()=>keys.map(key=>{const text=this.records.get(key);assert(text!==undefined,`Missing ${key}`);return JSON.parse(text);}));
 async load(){await turn();this.browser=this.adapter.attach();this.writable=true;return this.browser.load();}
 async commit(expected:number|null,data:AppData){
  assert(this.browser);const before=this.records.has(FAST_HEAD_KEY)?JSON.parse(this.records.get(FAST_HEAD_KEY)!).checkpointHash:null;
  await this.browser.commit(expected,data);this.commits++;
  const after=JSON.parse(this.records.get(FAST_HEAD_KEY)!).checkpointHash;if(before!==after)this.promotions++;
  this.retired=this.adapter.metrics.recoveryDeletes;
 }
 close(){this.browser?.close();this.browser=null;this.writable=false;}
}
const port=new Port(),archiveHash=createHash('sha256');
await measured('archive.readExactBytes',async()=>{for await(const line of createInterface({input:createReadStream(archive).pipe(createGunzip()),crlfDelay:Infinity})){archiveHash.update(line+'\n');const split=line.indexOf(',"value":');assert(split>0);port.records.set(JSON.parse(line.slice(7,split)),line.slice(split+9,-1));}});
assert.equal(archiveHash.digest('hex'),'48565330c9824353bffb7fa8ec0d0fa94055273a697f0790d715a7c5b9d3d5b5');
let controller=new SessionController(port);await measured('initial.controllerInit',()=>controller.init());assert.equal(controller.error,'');assert.equal(controller.status,'ready');assert.equal(totalHandCount(controller.data!),10000);
await measured('initial.postConversionCompleteReload',async()=>{controller.close();controller.data=null;controller=new SessionController(port);await controller.init();assert.equal(controller.error,'');assert.equal(controller.status,'ready');});
const initial=referenceFinancial({...financialInput(controller.data!),handIndex:getArchiveContext(controller.data!)!.handIndex}),initialRows=new Map([...port.records].filter(([key])=>key.startsWith('v2:')).map(([key,value])=>[key,createHash('sha256').update(value).digest('hex')]));
let completed=0,sessionHands=0,sessionNumber=0;const occupied:Record<string,number>={},streets:Record<string,number>={},policies=new Set<string>();
const loop=monitorEventLoopDelay({resolution:10});loop.enable();await turn();loop.reset();const start=performance.now();
while(decision<goal){
 if(!controller.data!.active){seats=[2,6,10][sessionNumber++%3];sessionHands=0;await measured('session.start',()=>controller.startSession({...DEFAULT_SETTINGS,seats,buyIn:20000,population:sessionNumber%2?'low':'high'}));}
 else if(controller.data!.active.game.street==='complete'){
  if(sessionHands>=40||controller.data!.active.game.seats.filter(s=>s.stack>0).length<2){await measured('session.cashOut',()=>controller.cashOut());continue;}
  if(controller.data!.active.game.seats[0].stack===0)await measured('session.topUp',()=>controller.topUp(20000));await measured('hand.next',()=>controller.nextHand());
 }
 assert.equal(controller.error,'');const a=controller.data!.active!,g=a.game;assertAccounting(g);seats=g.seats.length;
 if(g.street==='complete'){completed++;sessionHands++;hands=totalHandCount(controller.data!);continue;}
 if(g.actor===0){const legal=legalActions(g);await measured('hero.action',()=>controller.act(legal.check?{type:'check'}:completed%4!==0||legal.callAmount>4000?{type:'fold'}:{type:'call'},g.handId,g.revision));}
 else{
  decision++;occupied[seats]=(occupied[seats]??0)+1;streets[g.street]=(streets[g.street]??0)+1;policies.add(a.profiles[g.actor!].policyVersion);
  const mark=stages.length,t=performance.now();await measured('bot.prepare',()=>controller.prepareBot());const ms=performance.now()-t;assert.equal(controller.error,'');
  let prepared=controller.data!.active!;assert(prepared.pending?.decision);const identity=canonical(prepared.pending),actions=prepared.game.events.filter(e=>e.type==='action').length;
  if(ms>250&&slow.length<100)slow.push({decision,ms,hands,seats,street:g.street,stages:stages.slice(mark),memory:process.memoryUsage()});
  await measured('bot.prepare.idempotent',()=>controller.prepareBot());assert.equal(canonical(controller.data!.active!.pending),identity);
  if(decision%250===0){
   const before=totalHandCount(controller.data!),revision=controller.data!.revision;controller.close();controller.data=null;controller=new SessionController(port);
   await measured('pending.reload',()=>controller.init());assert.equal(controller.error,'');assert.equal(controller.data!.revision,revision);assert.equal(totalHandCount(controller.data!),before);assert.equal(canonical(controller.data!.active!.pending),identity);
   await measured('pending.prepareResume',()=>controller.prepareBot());assert.equal(canonical(controller.data!.active!.pending),identity);prepared=controller.data!.active!;
   reloads.push({decision,handId:prepared.game.handId,gameRevision:prepared.game.revision,canonicalHands:before,identityStable:true,settlementsBefore:controller.data!.ledger.filter(e=>e.kind==='hand-net').length});
  }
  await measured('bot.commit',()=>controller.commitBot(prepared.game.handId,prepared.game.revision));assert.equal(controller.error,'');
  assert.equal(controller.data!.active!.game.events.filter(e=>e.type==='action').length,actions+1);
  if(decision%250===0){const committed=controller.data;await measured('bot.staleCommit',()=>controller.commitBot(prepared.game.handId,prepared.game.revision));assert.equal(controller.data,committed);assert.match(controller.error,/Obsolete/);controller.error='';}
  if(decision%100===0){const entry={decision,completed,hands:totalHandCount(controller.data!),elapsedMs:performance.now()-start,memory:process.memoryUsage(),recoveryRows:[...port.records.keys()].filter(k=>k.startsWith('recovery-v1:')).length};memory.push(entry);writeFileSync(`${folder}/progress.json`,JSON.stringify(entry));console.log(JSON.stringify(entry));}
 }
 assert.equal(controller.error,'');assert.equal(controller.status,'ready');assertAccounting(controller.data!.active!.game);
 if(controller.data!.active!.game.street==='complete'){completed++;sessionHands++;hands=totalHandCount(controller.data!);}
 await turn();
}
const end=performance.now(),nodeEventLoop={p50Ms:loop.percentile(50)/1e6,p95Ms:loop.percentile(95)/1e6,p99Ms:loop.percentile(99)/1e6,maxMs:loop.max/1e6};loop.disable();
const compact=controller.data!,context=getArchiveContext(compact)!,finalFinancial=referenceFinancial({...financialInput(compact),handIndex:context.handIndex});assert.equal(finalFinancial.manual,initial.manual);
await measured('final.independentCanonicalAudit',async()=>{
 const full=await restoreSegments(JSON.parse(port.records.get('current')!),port.read);assert.equal(full.hands.length,totalHandCount(compact));assert.equal(full.wallet,compact.wallet);assert.deepEqual(full.ledger,compact.ledger);
 assert.deepEqual(referenceFinancial(financialInput(full)),finalFinancial);
 const cp=context.statistics,projection=CashStatsProjection.restoreCheckpoint(cp,cp.checkpoint),projected=projection.appendVerifiedTail(compact.hands.slice(context.statisticsHands-context.handOffset),compact.sessions,0);assert.deepEqual(projected,deriveCashStats(full.hands,full.sessions,0));
 for(const [key,hash]of initialRows)assert.equal(createHash('sha256').update(port.records.get(key)!).digest('hex'),hash,'Original canonical archive changed');
});
controller.close();observeTimings(null);observer.disconnect();const byStage:Record<string,number[]>={};for(const s of stages)if(s.start>=start&&s.end<=end)(byStage[s.name]??=[]).push(s.ms);
const quantify=(values:number[])=>{const a=[...values].sort((x,y)=>x-y),q=(p:number)=>a[Math.max(0,Math.ceil(a.length*p)-1)]??null;return{samples:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)??null};};
const preparation=windows.filter(w=>w.name==='bot.prepare'),worst=[...preparation].sort((a,b)=>b.ms-a.ms).slice(0,20).map(w=>({...w,stages:stages.filter(s=>s.decision===w.decision&&s.start>=w.start&&s.end<=w.end+.1),gc:gc.filter(g=>g.start<w.end&&g.end>w.start)}));
const result={status:'PASS',source,goal,decisions:decision,completedHands:completed,initialHands:10000,finalHands:totalHandCount(compact),initialFinancial:initial,finalFinancial,preparation:quantify(preparation.map(w=>w.ms)),stageLatency:Object.fromEntries(Object.entries(byStage).map(([key,values])=>[key,quantify(values)])),occupied,streets,policies:[...policies],reloads,commits:port.commits,checkpointPromotions:port.promotions,prunedRecoveryRows:port.retired,elapsedMs:end-start,nodeEventLoop,memory,slow,worst,initializationAndFinalAudits:windows.filter(w=>/initial|archive|final/.test(w.name)),methodology:'Native Node actual SessionController and complete BrowserPersistence.load/commit through serialized-string IDB request/transaction adapter including canonical financial bytes, resident archive, key inventory and current-manifest fence, deterministic TEST-ONLY entropy seed0x5e20004a retaining native crypto.subtle hashing, exact unchanged10k Step5D archive, rotating2/6/10 configured seats every40completedhands with natural bustouts. Hero checks, otherwise folds except bounded calls every fourth completed hand; decisions never use hidden Hero/opponent cards. Every bot preparation is durably persisted, duplicate preparation checked, then engine-committed once. Every250th decision reloads a pending action and rejects stale duplicate commit. JSON-string memory storage reference is not IndexedDB/browser durability or UI performance. No intentional think-time is included.',limitations:['Native Node timing and event-loop delay, not browser INP/long tasks or physical devices.','A2000-decision sample does not retrospectively establish the cause of the original9.79s outlier.','Synthetic workload; no expert or measured human calibration claim.']};
writeFileSync(`${folder}/trace.json.gz`,gzipSync(JSON.stringify({windows,stages,gc,timeOrigin:performance.timeOrigin})));writeFileSync(`${folder}/report.json`,JSON.stringify(result,(_,value)=>typeof value==='bigint'?value.toString():value,2)+'\n');console.log(JSON.stringify({status:result.status,preparation:result.preparation,completedHands:completed,reloads:reloads.length,elapsedMs:result.elapsedMs}));
