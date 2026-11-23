import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createGunzip,gzipSync} from 'node:zlib';
import {createInterface} from 'node:readline';
import {PerformanceObserver,monitorEventLoopDelay} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {prepareSegments,restoreSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {canonical,validateData} from '../../src/storage/integrity';
import {observeTimings,timed,timedAsync} from '../../src/performance/timing';
import {assertAccounting,legalActions} from '../../src/core/engine';
import {CashStatsProjection} from '../../src/stats/projection';
import {deriveCashStats} from '../../src/stats/cash';
import {summarize,overlap} from '../step5c-stall/statistics';
const runName=process.env.STALL_RUN??'baseline',goal=Number(process.env.STALL_DECISIONS??5000),archive=process.env.STALL_ARCHIVE??'tests/step5b-resource/evidence/full/canonical-segments.jsonl.gz',pressureMB=Number(process.env.STALL_PRESSURE_MB??0),directory=`tests/step5d-recovery/evidence/stall-${runName}`;mkdirSync(directory,{recursive:true});
assert.ok(goal>0&&Number.isSafeInteger(goal));assert.ok(pressureMB>=0&&pressureMB<=1024);
let randomState=0x51c57a11;
const random=()=>{randomState+=0x6D2B79F5;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};
// Reproducible test-only entropy. Production entropy source is unchanged.
Object.defineProperty(globalThis,'crypto',{value:{getRandomValues<T extends ArrayBufferView>(array:T):T{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(let i=0;i<bytes.length;i+=4){let word=random();for(let j=0;j<4&&i+j<bytes.length;j++){bytes[i+j]=word&255;word>>>=8;}}return array;}}});
type Window={name:string;start:number;end:number;ms:number;decision:number;hands:number;seats:number};
const stages:Window[]=[],windows:Window[]=[],gc:{start:number;end:number;ms:number;detail:unknown}[]=[],slow:unknown[]=[],memory:unknown[]=[],heartbeats:{start:number;end:number;ms:number;decision:number}[]=[];
let phase='setup',decision=0,hands=0,seats=0,phaseStart=performance.now(),previousBeat=performance.now();
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())gc.push({start:entry.startTime,end:entry.startTime+entry.duration,ms:entry.duration,detail:(entry as typeof entry&{detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});
const loop=monitorEventLoopDelay({resolution:10});loop.enable();
const heartbeat=setInterval(()=>{const end=performance.now(),ms=end-previousBeat;if(ms>50)heartbeats.push({start:previousBeat,end,ms,decision});previousBeat=end;},10);heartbeat.unref();
observeTimings(s=>{const end=performance.now();stages.push({name:s.name,start:end-s.milliseconds,end,ms:s.milliseconds,decision,hands,seats});});
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function measured<T>(name:string,fn:()=>Promise<T>){phase=name;phaseStart=performance.now();const start=phaseStart;try{return await fn();}finally{const end=performance.now();windows.push({name,start,end,ms:end-start,decision,hands,seats});}}
class Port implements PersistencePort {
 data:AppData|null=null;manifest:SegmentedEnvelope|null=null;records=new Map<string,string>();writable=true;commits=0;
 async load(){if(!this.manifest)return null;this.data=await timedAsync('port.restoreSegments',()=>restoreSegments(this.manifest!,async keys=>timed('port.jsonRead',()=>keys.map(k=>JSON.parse(this.records.get(k)!)))));
  if(!this.manifest.packedHands){const next=await timedAsync('port.initialPackedInstallation',()=>prepareSegments(this.data!,this.data,this.manifest,{packHands:true}));assert.ok(next.envelope.packedHands);assert.equal(next.writes.length,0);for(const row of next.replicas??[])this.records.set(row.key,JSON.stringify(row.entry));this.manifest=next.envelope;this.records.set('current',JSON.stringify(next.envelope));}
  return this.data;
 }
 async commit(rev:number|null,data:AppData){assert.equal(this.manifest?.data.revision??null,rev);const next=await timedAsync('port.prepareSegments',()=>prepareSegments(data,this.data,this.manifest));timed('port.jsonWrite',()=>{for(const record of [...next.writes,...(next.replicas??[])])this.records.set(record.key,JSON.stringify(record.entry));this.records.set('previous',JSON.stringify(this.manifest));this.records.set('current',JSON.stringify(next.envelope));});this.manifest=next.envelope;this.data=data;this.commits++;}
 close(){}
}
const clockCalibration={performanceNow:performance.now(),hrtimeMicroseconds:Number(process.hrtime.bigint()/1000n)};
const port=new Port();let controller=new SessionController(port);const projection=new CashStatsProjection();const initialMemory=process.memoryUsage();
if(archive!=='none')await measured('archive.stream',async()=>{for await(const line of createInterface({input:createReadStream(archive).pipe(createGunzip()),crlfDelay:Infinity})){if(!line)continue;const split=line.indexOf(',"value":');assert.ok(line.startsWith('{"key":')&&split>0&&line.endsWith('}'));port.records.set(JSON.parse(line.slice(7,split)) as string,line.slice(split+9,-1));}port.manifest=JSON.parse(port.records.get('current')!) as SegmentedEnvelope;});
await measured('cold.controller.init',()=>controller.init());assert.equal(controller.error,'');assert.equal(controller.status,'ready');hands=controller.data!.hands.length;
// Gameplay is measured after an actual packed restore, not on the large legacy
// graph retained during the one-time installation. Both startup costs are kept.
controller.close();controller=new SessionController(port);await measured('warm.packed.reload',()=>controller.init());assert.equal(controller.error,'');assert.equal(controller.status,'ready');
const initialHands=hands,initialLedger=controller.data!.ledger.length,initialWallet=controller.data!.wallet,initialNet=controller.data!.hands.reduce((n,h)=>n+h.net,0),policyVersions=new Set<string>(),occupied:Record<number,number>={},streets:Record<string,number>={};
if(archive!=='none'&&hands===10000){const expected=JSON.parse(readFileSync('tests/step5b-resource/evidence/full/report.json','utf8')) as {canonicalSHA256:string};await measured('archive.canonicalVerification',async()=>{assert.equal(createHash('sha256').update(canonical(controller.data)).digest('hex'),expected.canonicalSHA256);});}
await measured('initial.stats',async()=>{assert.equal(canonical(projection.derive(controller.data!.hands,controller.data!.sessions,0)),canonical(deriveCashStats(controller.data!.hands,controller.data!.sessions,0)));});
memory.push({phase:'ready',decision,hands,memory:process.memoryUsage()});
let completed=0,sessionHands=0,sessionNumber=0,reloads=0;
const retainedPressure:number[][]=[];if(pressureMB)await measured('pressure.allocate',async()=>{for(let m=0;m<pressureMB;m++){const chunk=new Array<number>(131072);for(let i=0;i<chunk.length;i++)chunk[i]=i+random();retainedPressure.push(chunk);}assert.equal(retainedPressure.length,pressureMB);});
await turn();loop.reset();const gameplayStart=performance.now();
while(decision<goal){
 if(!controller.data!.active){seats=[2,6,10][sessionNumber++%3];sessionHands=0;await measured('session.start',()=>controller.startSession({...DEFAULT_SETTINGS,seats,buyIn:20000,population:sessionNumber%2?'low':'high'}));}
 else if(controller.data!.active.game.street==='complete'){if(sessionHands>=25||controller.data!.active.game.seats.filter(s=>s.stack>0).length<2){await measured('session.cashOut',()=>controller.cashOut());continue;}if(controller.data!.active.game.seats[0].stack===0)await measured('session.topUp',()=>controller.topUp(20000));await measured('hand.next',()=>controller.nextHand());}
 assert.equal(controller.error,'');const a=controller.data!.active!,g=a.game;assertAccounting(g);seats=g.seats.length;
 if(g.actor===0){const legal=legalActions(g);await measured('hero.action',()=>controller.act(legal.check?{type:'check'}:(completed%4!==0||legal.callAmount>4000)?{type:'fold'}:{type:'call'},g.handId,g.revision));}
 else{
  decision++;occupied[seats]=(occupied[seats]??0)+1;streets[g.street]=(streets[g.street]??0)+1;policyVersions.add(a.profiles[g.actor!].policyVersion);
  const mark=stages.length,start=performance.now();await measured('bot.prepare',()=>controller.prepareBot());const duration=performance.now()-start;assert.equal(controller.error,'');const ready=controller.data!.active!;assert.ok(ready.pending?.decision);
  if(duration>250&&slow.length<100)slow.push({decision,phase,start,end:performance.now(),duration,hands,seats,street:g.street,allowedInput:(globalThis as unknown as {__stallObservation:unknown}).__stallObservation,stages:stages.slice(mark),memory:process.memoryUsage()});
  const identity=canonical(ready.pending.decision);await measured('bot.prepare.idempotent',()=>controller.prepareBot());assert.equal(canonical(controller.data!.active!.pending!.decision),identity);
  await measured('bot.commit',()=>controller.commitBot(ready.game.handId,ready.game.revision));
  if(decision%500===0){memory.push({phase:'gameplay',decision,hands,memory:process.memoryUsage()});writeFileSync(`${directory}/progress.json`,JSON.stringify({decision,goal,hands,elapsedMs:performance.now()-gameplayStart,memory:process.memoryUsage()}));console.log(JSON.stringify({decision,goal,hands,elapsedMs:performance.now()-gameplayStart}));}
 }
 assert.equal(controller.error,'');assert.equal(controller.status,'ready');
 if(controller.data!.active!.game.street==='complete'){completed++;sessionHands++;hands=controller.data!.hands.length;assertAccounting(controller.data!.active!.game);projection.derive(controller.data!.hands,controller.data!.sessions,0);}
 await turn();
}
const gameplayEnd=performance.now(),gameplayLoop={min:loop.min/1e6,p50:loop.percentile(50)/1e6,p95:loop.percentile(95)/1e6,p99:loop.percentile(99)/1e6,max:loop.max/1e6,mean:loop.mean/1e6};
// Interrupt a durably prepared choice, restore it, and prove no extra action or payout.
for(let attempt=0;attempt<12;attempt++){const a=controller.data!.active!;if(a.game.street==='complete'){if(a.game.seats.filter(s=>s.stack>0).length<2){await controller.cashOut();await controller.startSession({...DEFAULT_SETTINGS,seats:6});}else{if(a.game.seats[0].stack===0)await controller.topUp(20000);await controller.nextHand();}}else if(a.game.actor===0)await controller.act({type:'fold'},a.game.handId,a.game.revision);else break;assert.equal(controller.error,'');}
if(controller.data!.active?.game.street!=='complete'){
 await controller.prepareBot();const prepared=controller.data!.active!,expected=canonical(prepared.pending);assert.ok(prepared.pending?.decision);const handsBefore=controller.data!.hands.length,revision=prepared.game.revision;controller.close();controller=new SessionController(port);await measured('pending.reload',()=>controller.init());reloads++;assert.equal(controller.error,'');assert.equal(canonical(controller.data!.active!.pending),expected);await controller.prepareBot();assert.equal(canonical(controller.data!.active!.pending),expected);await controller.commitBot(prepared.game.handId,revision);assert.equal(controller.error,'');const after=controller.data!.active!.game.revision;await controller.commitBot(prepared.game.handId,revision);assert.equal(controller.data!.active!.game.revision,after);assert.match(controller.error,/Obsolete bot callback rejected/);assert.ok(controller.data!.hands.length<=handsBefore+1);controller.error='';
}
await measured('final.fullAudit',async()=>{await validateData(controller.data!);assert.equal(canonical(projection.derive(controller.data!.hands,controller.data!.sessions,0)),canonical(deriveCashStats(controller.data!.hands,controller.data!.sessions,0)));const d=controller.data!,table=d.active?d.active.game.seats[0].stack+(d.active.game.street==='complete'?0:d.active.game.seats[0].totalCommitted):0;assert.equal(d.wallet+table,initialWallet+d.hands.reduce((n,h)=>n+h.net,0)-initialNet);assert.equal(new Set(d.hands.map(h=>h.id)).size,d.hands.length);assert.equal(d.ledger.filter(e=>e.kind==='hand-net').length,d.hands.length);});
const final={hands:controller.data!.hands.length,ledgerEvents:controller.data!.ledger.length,wallet:controller.data!.wallet,table:controller.data!.active?controller.data!.active.game.seats[0].stack+(controller.data!.active.game.street==='complete'?0:controller.data!.active.game.seats[0].totalCommitted):0,commits:port.commits};
controller.close();await turn();clearInterval(heartbeat);loop.disable();observer.disconnect();observeTimings(null);
const releaseBefore=process.memoryUsage();port.data=null;port.manifest=null;port.records.clear();retainedPressure.length=0;projection.reset('stress cleanup');(globalThis as unknown as {__stallObservation:unknown}).__stallObservation=null;controller.data=null;await turn();global.gc?.();await turn();const released=process.memoryUsage();
const byStage:Record<string,number[]>={};for(const s of stages)if(s.start>=gameplayStart&&s.end<=gameplayEnd)(byStage[s.name]??=[]).push(s.ms);
const prep=windows.filter(w=>w.name==='bot.prepare'),worst=[...prep].sort((a,b)=>b.ms-a.ms).slice(0,25).map(w=>({...w,gcOverlapMs:gc.reduce((n,g)=>n+overlap(w,g),0),gc:gc.filter(g=>overlap(w,g)>0),stages:stages.filter(s=>s.decision===w.decision&&s.start>=w.start&&s.end<=w.end+.01)}));
const sourceFiles=['src/session/controller.ts','src/storage/verified.ts','src/storage/segments.ts','src/storage/integrity.ts','src/bots/policy.ts','src/bots/ranges.ts','src/bots/strategy.ts','src/storage/packed-hand.ts','src/session/hand-provenance.ts'];
const report={status:'PASS',runName,sourceCommit:execFileSync('git',['-C',process.env.STALL_SOURCE_ROOT??'.','rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync((process.env.STALL_SOURCE_ROOT??'.')+'/'+p)).digest('hex')])),environment:{node:process.version,flags:process.execArgv,cpu:cpus()[0]?.model,timeOrigin:performance.timeOrigin,clockCalibration,pressureMB},methodology:'Node production controller and segmented persistence serialization reference with verified packed hand replicas; full original backup rows retained; one-time encoding included in cold initialization, never hidden in gameplay statistics, deterministic test-only seed0x51c57a11, rotating2/6/10seat sessions per25completedhands with natural bustouts, hero checks/calls<=20BB each4thhand andotherwise folds. Each measured prepare followed by duplicate prepare identity assertion and actualcommit. CPUprofile,GCtimestamps and10ms eventloopmonitor simultaneous. Test-only instrumented controller captures allowed observation plus ownprofile byreference beforepolicy; no forbidden cards and no productionruntimechange. Storage reference keeps serializedhistory plusapplicationobjects inRAM; browser/physicaldevice responsiveness is not inferred. Slowsamples contain private synthetic diagnostic inputs, notordinaryUI/export.',archive,goal,decisions:decision,completedDuringWorkload:completed,initialHands,initialLedger,final,policyVersions:[...policyVersions],occupied,streets,reloads,initialMemory,memory,releaseBefore,released,gameplayMs:gameplayEnd-gameplayStart,preparation:summarize(prep.map(w=>w.ms)),stageLatency:Object.fromEntries(Object.entries(byStage).map(([k,v])=>[k,summarize(v)])),gameplayLoop,gc:{count:gc.length,totalMs:gc.reduce((n,g)=>n+g.ms,0),maxMs:Math.max(0,...gc.map(g=>g.ms))},slowPreparations:slow,worstPreparations:worst,recoveryWindows:windows.filter(w=>/init|reload|Audit|stats|archive|pressure/.test(w.name)),artifact:'trace.json.gz',pendingRecoveryPassed:reloads>0,original9791ms:'No contemporaneous trace exists for original sample; this new trace cannot retrospectively attribute it.'};
writeFileSync(`${directory}/trace.json.gz`,gzipSync(JSON.stringify({timeOrigin:performance.timeOrigin,windows,stages,gc,heartbeats})));writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,decisions:decision,completed:completed,preparation:report.preparation,gameplayLoop,slowCount:slow.length,final}));
