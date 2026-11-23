import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {PerformanceObserver} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {prepareSegments,restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {canonical} from '../../src/storage/integrity';
import {observeTimings} from '../../src/performance/timing';
import {createHash} from 'node:crypto';
const directory='tests/step5b-resource/evidence/tail';mkdirSync(directory,{recursive:true});
const stages:{phase:string;name:string;start:number;end:number;ms:number}[]=[],gc:{start:number;end:number;ms:number;detail:unknown}[]=[],windows:{phase:string;start:number;end:number;ms:number}[]=[];let phase='setup';
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())gc.push({start:entry.startTime,end:entry.startTime+entry.duration,ms:entry.duration,detail:(entry as typeof entry&{detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});observeTimings(s=>{const end=performance.now();stages.push({phase,name:s.name,start:end-s.milliseconds,end,ms:s.milliseconds});});
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function measured<T>(label:string,fn:()=>Promise<T>){phase=label;const start=performance.now();try{return await fn();}finally{const end=performance.now();windows.push({phase:label,start,end,ms:end-start});await turn();}}
const startMemory=process.memoryUsage();
class Port implements PersistencePort {
 data:AppData|null=null;manifest:SegmentedEnvelope|null=null;records=new Map<string,string>();writable=true;
 async load(){assert.ok(this.manifest);return this.data=await restoreSegments(this.manifest,async keys=>keys.map(k=>JSON.parse(this.records.get(k)!)));}
 async commit(rev:number|null,data:AppData){assert.equal(this.manifest?.data.revision??null,rev);const next=await prepareSegments(data,this.data,this.manifest);for(const record of next.writes)this.records.set(record.key,JSON.stringify(record.entry));this.records.set('previous',JSON.stringify(this.manifest));this.records.set('current',JSON.stringify(next.envelope));this.manifest=next.envelope;this.data=data;}
 close(){}
}
const released:ReturnType<typeof process.memoryUsage>[]=[],memories:unknown[]=[];
async function run(){
 const port=new Port();await measured('archive.stream',async()=>{for await(const line of createInterface({input:createReadStream('tests/step5b-resource/evidence/full/canonical-segments.jsonl.gz').pipe(createGunzip()),crlfDelay:Infinity})){if(!line)continue;const split=line.indexOf(',"value":');assert.ok(line.startsWith('{"key":')&&split>0&&line.endsWith('}'));const key=JSON.parse(line.slice(7,split)) as string;port.records.set(key,line.slice(split+9,-1));}port.manifest=JSON.parse(port.records.get('current')!) as SegmentedEnvelope;});
 let c=new SessionController(port);await measured('cold.controller.init',()=>c.init());assert.equal(c.error,'');const expected=JSON.parse(readFileSync('tests/step5b-resource/evidence/full/report.json','utf8')) as {canonicalSHA256:string};assert.equal(createHash('sha256').update(canonical(c.data)).digest('hex'),expected.canonicalSHA256);assert.equal(c.data!.hands.length,10000);memories.push({phase,memory:process.memoryUsage()});
 await measured('session.start6',()=>c.startSession({...DEFAULT_SETTINGS,seats:6}));assert.equal(c.error,'');
 for(let batch=0;batch<3;batch++){
  if(batch){c.close();c=new SessionController(port);await measured(`reload.${batch}`,()=>c.init());assert.equal(c.error,'');}
  for(let n=0;n<20;n++){
   while(c.data!.active!.game.street==='complete'||c.data!.active!.game.actor===0){const a=c.data!.active!;if(a.game.street==='complete'){if(a.game.seats[0].stack===0)await c.topUp(20000);await c.nextHand();}else await c.act({type:'fold'},a.game.handId,a.game.revision);assert.equal(c.error,'');}
   await measured(`prepare.${batch}.${n}`,()=>c.prepareBot());assert.equal(c.error,'');const a=c.data!.active!;await measured(`commit.${batch}.${n}`,()=>c.commitBot(a.game.handId,a.game.revision));assert.equal(c.error,'');
  }memories.push({phase:`batch.${batch}.done`,memory:process.memoryUsage()});
 }
 c.close();port.data=null;port.manifest=null;port.records.clear();
}
await run();observeTimings(null);
// Let async frames and fulfilled promise values unwind before judging retained heap.
for(let n=0;n<4;n++){await turn();global.gc?.();await turn();released.push(process.memoryUsage());}
observer.disconnect();const quantiles=(values:number[])=>{const x=values.sort((a,b)=>a-b),q=(p:number)=>x[Math.ceil(x.length*p)-1];return{samples:x.length,p50:q(.5),p95:q(.95),p99:q(.99),max:x.at(-1)}};
const byName:Record<string,number[]>={};for(const s of stages)(byName[s.name]??=[]).push(s.ms);
const correlations=windows.map(w=>({...w,gcOverlapMs:gc.reduce((n,g)=>n+Math.max(0,Math.min(w.end,g.end)-Math.max(w.start,g.start)),0),gcEntries:gc.filter(g=>g.start<w.end&&g.end>w.start)}));
const report={status:'PASS',scope:'Same full10000-hand canonical archive, actual controller/production segmented serialization reference, one new six-seat session,60botpreparations and2fullreloads. This is a diagnostic reproduction, not the unknown exact context of the original9.79second sample. No browser claim. CPUprofile+trace-gc+PerformanceObserverGC retained.',policyVersion:'synthetic-cash-1.5.0',node:process.version,startMemory,memories,released,phaseTimings:correlations,stageQuantiles:Object.fromEntries(Object.entries(byName).map(([k,v])=>[k,quantiles(v)])),botPreparation:quantiles(windows.filter(w=>w.phase.startsWith('prepare.')).map(w=>w.ms)),gc,stages};writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({botPreparation:report.botPreparation,released,slow:correlations.filter(w=>w.ms>250).map(({phase,ms,gcOverlapMs})=>({phase,ms,gcOverlapMs}))}));
