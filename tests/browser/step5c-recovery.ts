import {SessionController} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {digest,GENESIS} from '../../src/storage/integrity';
import {SEGMENTS,segmentKey,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';
import {observeTimings,type TimingSample} from '../../src/performance/timing';
import {CashStatsProjection} from '../../src/stats/projection';
import type {AppData} from '../../src/session/types';
const baselineURL='./step5c-saved-v8.js';
const baseline=await import(/* @vite-ignore */baselineURL) as {SessionController:typeof SessionController;BrowserPersistence:typeof BrowserPersistence;CashStatsProjection:typeof CashStatsProjection;observeTimings:typeof observeTimings};
const status=document.getElementById('status')!,result=document.getElementById('result')!,button=document.getElementById('run') as HTMLButtonElement;
let pulse=0;setInterval(()=>{document.getElementById('pulse')!.textContent=`Heartbeat: ${++pulse}`;},100);
function browserMemory(){const memory=(performance as Performance&{memory?:{jsHeapSizeLimit:number;totalJSHeapSize:number;usedJSHeapSize:number}}).memory;return memory?{jsHeapSizeLimit:memory.jsHeapSizeLimit,totalJSHeapSize:memory.totalJSHeapSize,usedJSHeapSize:memory.usedJSHeapSize}:null;}
const yieldTurn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
async function corpus(size:number){
 const retained=new Map<string,StoredSegment>();let current:SegmentedEnvelope|null=null;
 const response=await fetch('../step5b-resource/evidence/full/canonical-segments.jsonl.gz');if(!response.ok||!response.body)throw Error('Canonical archive unavailable');
 // Dev/proxy servers may transparently decode Content-Encoding:gzip before
 // fetch exposes the body. Inspect actual bytes instead of decompressing twice.
 const source=response.body.getReader();let first=await source.read();while(!first.done&&first.value.length===0)first=await source.read();if(first.done)throw Error('Canonical archive response was empty');
 const prefix=first.value,compressed=prefix[0]===0x1f&&prefix[1]===0x8b;
 const transport={url:response.url,status:response.status,contentType:response.headers.get('content-type'),contentEncoding:response.headers.get('content-encoding'),firstBytes:Array.from(prefix.slice(0,16)),encoding:compressed?'gzip-bytes':'plain-jsonl-bytes'};
 if(!compressed&&!new TextDecoder().decode(prefix.slice(0,128)).trimStart().startsWith('{'))throw Error(`Expected gzip or JSONL canonical archive, received another response: ${JSON.stringify(transport)}`);
 const bytes=new ReadableStream<BufferSource>({start(c){c.enqueue(prefix);},async pull(c){const chunk=await source.read();if(chunk.done)c.close();else c.enqueue(chunk.value);},cancel(reason){return source.cancel(reason);}});
 const stream:ReadableStream<BufferSource>=compressed?bytes.pipeThrough(new DecompressionStream('gzip')):bytes;
 const reader=stream.pipeThrough(new TextDecoderStream()).getReader();let pending='',lines=0;
 const consume=(line:string)=>{if(!line)return;const split=line.indexOf(',"value":');if(split<0)throw Error('Bad canonical archive line');const key=JSON.parse(line.slice(7,split)) as string;if(key==='current'){current=JSON.parse(line.slice(split+9,-1)) as SegmentedEnvelope;return;}if(key.startsWith('v2:hands:')&&Number(key.slice(key.lastIndexOf(':')+1))>=size)return;if(!key.startsWith('v2:'))return;retained.set(key,JSON.parse(line.slice(split+9,-1)) as StoredSegment);};
 for(;;){const chunk=await reader.read();if(chunk.done)break;pending+=chunk.value;let split:number;while((split=pending.indexOf('\n'))>=0){consume(pending.slice(0,split));pending=pending.slice(split+1);if(++lines%100===0){status.textContent=`Preparing immutable archive: ${lines} records scanned`;await yieldTurn();}}}if(pending)consume(pending);if(!current)throw Error('Missing canonical manifest');
 const manifest=current as SegmentedEnvelope,entry=(name:typeof SEGMENTS[number],i:number)=>retained.get(segmentKey(name,i))!,sessions:AppData['sessions']=[];let hands=0;
 if(size)for(let i=0;i<manifest.segments.closedSessions.count;i++){const s=entry('closedSessions',i).value as AppData['sessions'][number];if(hands+s.handIds.length>size)break;sessions.push(s);hands+=s.handIds.length;if(hands===size&&size!==10000)break;}
 if(hands!==size)throw Error('Fixture is not a closed-session boundary');let ledgerCount=1,wallet=(entry('ledger',0).value as AppData['ledger'][number]).walletDelta,epoch=0;
 if(size){wallet=0;for(let i=0;i<manifest.segments.ledger.count;i++){const e=entry('ledger',i).value as AppData['ledger'][number];wallet+=e.walletDelta;epoch=e.epoch;ledgerCount=i+1;if(e.kind==='cash-out'&&e.sessionId===sessions.at(-1)!.id)break;}}
 const counts={ledger:ledgerCount,hands:size,closedSessions:sessions.length,importedHands:0},segments={} as SegmentedEnvelope['segments'];for(const name of SEGMENTS)segments[name]={count:counts[name],tail:counts[name]?entry(name,counts[name]-1).hash:GENESIS};
 for(const key of retained.keys())if(!SEGMENTS.some(name=>key.startsWith(`v2:${name}:`)&&Number(key.slice(key.lastIndexOf(':')+1))<counts[name]))retained.delete(key);
 const body={format:manifest.format,version:manifest.version,data:{...manifest.data,wallet,epoch,active:null,openSession:null},segments};return {records:retained,manifest:{...body,checksum:await digest(body)} as SegmentedEnvelope,wallet,transport};
}
async function seed(name:string,manifest:SegmentedEnvelope,records:Map<string,StoredSegment>){
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
 const entries=[...records];for(let n=0;n<entries.length;n+=64)await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');for(const [key,value]of entries.slice(n,n+64))tx.objectStore('kv').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(manifest,'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
}
button.onclick=async()=>{
 button.disabled=true;const rows:Record<string,unknown>[]=[],owned=new Set<string>(),opened=new Set<IDBDatabase>(),controllers:SessionController[]=[],cleanup:unknown[]=[],timers:ReturnType<typeof setInterval>[]=[],observers:PerformanceObserver[]=[];
 const nativeOpen=indexedDB.open;
 // Observe only exact database names created by this test. Frozen production
 // readers are unchanged; no normal guest connection is touched by teardown.
 indexedDB.open=function(databaseName,version){const request=nativeOpen.call(indexedDB,databaseName,version);if(owned.has(databaseName))request.addEventListener('success',()=>opened.add(request.result));return request;};
 const context:Record<string,unknown>={userAgent:navigator.userAgent,secureContext:isSecureContext,nativeSHA256:!!crypto.subtle,productionDatabaseAccessed:false,method:'Actual BrowserPersistence + SessionController cold restore from native IndexedDB; exact identical canonical archive subset; baseline source f54cacfb0aa3c861313b691e773a6716379c50a0. Not physical-device evidence.'};let failure:string|null=null;
 const remove=async(name:string)=>{
  for(const database of opened)if(database.name===name)database.close();
  const start=performance.now();let blockedEvents=0;
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated database cleanup remained blocked after five seconds.')),5000),request=indexedDB.deleteDatabase(name);request.onsuccess=()=>{clearTimeout(timer);resolve();};request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{blockedEvents++;status.textContent='Waiting for this isolated test database to close; deletion is not yet confirmed.';for(const database of opened)if(database.name===name)database.close();};});
  owned.delete(name);cleanup.push({name,status:'PASS',deleted:true,ms:performance.now()-start,blockedEvents});
 };
 try{
  const size=Number((document.getElementById('hands') as HTMLSelectElement).value),reader=(document.getElementById('reader') as HTMLSelectElement).value;if(![0,100,500,1000,5000,10000].includes(size))throw Error('Unsupported fixture size');const preparation=performance.now(),fixture=await corpus(size),preparationMs=performance.now()-preparation;
  Object.assign(context,{size,preparationMs,fixtureChecksum:fixture.manifest.checksum,archiveTransport:fixture.transport});
  for(const mode of (reader==='both'?['baseline','candidate']:[reader])){
   const name=`ai-texas-step5c-cold-${mode}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,P=mode==='baseline'?baseline.BrowserPersistence:BrowserPersistence,C=mode==='baseline'?baseline.SessionController:SessionController;owned.add(name);
   const stages:TimingSample[]=[],tasks:{start:number;ms:number}[]=[],ticks:{start:number;gap:number}[]=[],row:Record<string,unknown>={mode,size,status:'RUNNING',stages};rows.push(row);
   status.textContent=`Writing isolated ${size}-hand ${mode} database`;await seed(name,fixture.manifest,fixture.records);let last=performance.now();
   const heartbeat=setInterval(()=>{const time=performance.now();ticks.push({start:last,gap:time-last});last=time;},16),observer=new PerformanceObserver(list=>{for(const e of list.getEntries())tasks.push({start:e.startTime,ms:e.duration});});timers.push(heartbeat);observers.push(observer);observer.observe({type:'longtask',buffered:false});
   status.textContent=`Verifying ${mode}: ${size} hands. Poker actions remain disabled until verification completes.`;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const visibleLoadingPulse=pulse,visibilityAtStart=document.visibilityState;
   const observe=mode==='baseline'?baseline.observeTimings:observeTimings;observe(s=>{const end=performance.now();stages.push({...s,start:end-s.milliseconds,end} as TimingSample);});const start=performance.now(),controller=new C(new P(name));controllers.push(controller);await controller.init();const recovered=performance.now();if(controller.error)throw Error(controller.error);const data=controller.data!;
   if(data.hands.length!==size||data.wallet!==fixture.wallet||data.active!==null||data.ledger.reduce((n,e)=>n+e.tableDelta,0)!==0||data.ledger.filter(e=>e.kind==='hand-net').length!==size)throw Error('Independent financial/count verification failed');
   const statsStart=performance.now(),projection=mode==='baseline'?new baseline.CashStatsProjection():await CashStatsProjection.prewarm(data.hands),stats=projection.derive(data.hands,data.sessions),statsMs=performance.now()-statsStart;
   status.textContent=`Ready: ${mode}, ${size} verified hands, bankroll ${(data.wallet/100).toFixed(2)}`;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const painted=performance.now();await yieldTurn();clearInterval(heartbeat);observer.disconnect();observe(null);controller.close();
   const during=tasks.filter(e=>e.start<painted&&e.start+e.ms>start);Object.assign(row,{status:'PASS',visibilityAtStart,visibilityAtEnd:document.visibilityState,renderScope:'QA status ready paint; not production app hydration',recoveryMs:recovered-start,initialReadyPaintMs:painted-start,statisticsRebuildMs:statsMs,hands:stats.hands,wallet:data.wallet,table:0,loadingStateHeartbeatAdvances:pulse-visibleLoadingPulse,maxAnimationHeartbeatGapMs:Math.max(0,...ticks.map(t=>t.gap)),longTasks:during,heap:browserMemory()});
   await remove(name);
   result.textContent=JSON.stringify({size,rows:rows.map(r=>{const {stages:_,...summary}=r;void _;return summary;})},null,2);
  }
 }catch(e){failure=(e as Error).message;const current=rows.at(-1);if(current?.status==='RUNNING')Object.assign(current,{status:'FAIL',error:failure});}
 finally{
  observeTimings(null);baseline.observeTimings(null);for(const timer of timers)clearInterval(timer);for(const observer of observers)observer.disconnect();for(const controller of controllers)controller.close();for(const database of opened)database.close();
  // Restore the API even if a reader failed, then delete only this run's named DBs.
  indexedDB.open=nativeOpen;for(const name of [...owned])try{await remove(name);}catch(e){const error=(e as Error).message;cleanup.push({name,status:'FAIL',error});failure??=error;}
  const evidence={...context,status:failure?'FAIL':'PASS',...(failure?{error:failure}:{}),rows,cleanup,trackedNativeConnections:opened.size};const json=JSON.stringify(evidence,null,2);
  (document.getElementById('evidence') as HTMLTextAreaElement).value=json;
  result.textContent=JSON.stringify({...evidence,rows:rows.map(r=>{const {stages:_,...summary}=r;void _;return summary;})},null,2);
  const download=document.getElementById('download') as HTMLAnchorElement;download.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));download.hidden=false;
  status.textContent=failure?`FAIL: ${failure}`:'PASS: cold recovery and financial reconciliation completed; isolated databases removed.';button.disabled=false;
 }
};
