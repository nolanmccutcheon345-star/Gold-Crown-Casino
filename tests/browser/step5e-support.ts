import {sha256} from '@noble/hashes/sha2.js';

export const HISTORY_SIZES=[0,100,500,1000,5000,10000] as const;
export const BASELINE_COMMIT='f5692f81514c5a4049a93c9bc22ca206f48e7c9c';
export function check(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
export const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const hashText=(text:string)=>hex(sha256(new TextEncoder().encode(text)));
export type RecoveryParameters={run:string;hands:number;reader:'baseline'|'candidate';scenario:'closed'|'pending';storage:'conversion'|'normal'};
export function parameters(search:string):RecoveryParameters {
 const q=new URLSearchParams(search),run=q.get('run')??'',hands=Number(q.get('hands')),reader=q.get('reader'),scenario=q.get('scenario'),storage=q.get('storage');
 check(/^\d+-\d+$/.test(run),'Explicit isolated QA run identity required');
 check(q.has('hands')&&HISTORY_SIZES.includes(hands as typeof HISTORY_SIZES[number]),'Unsupported exact fixture size');
 check(reader==='baseline'||reader==='candidate','Unsupported reader');
 check(scenario==='closed'||scenario==='pending','Unsupported recovery scenario');
 check(storage==='conversion'||storage==='normal','Choose first conversion or normal recovery explicitly');
 return{run,hands,reader,scenario,storage};
}
export const namespaceFor=(p:RecoveryParameters)=>`ai-texas-step5e-recovery-${p.run}`;
export type PreparedReceipt={version:1;parameters:RecoveryParameters;namespace:string;expected:{wallet:number;hands:number;activeDigest:string|null};evidence:Record<string,unknown>};
export function encodeReceipt(value:PreparedReceipt):string {const payload=JSON.stringify(value),encoded=JSON.stringify({payload,sha256:hashText(payload)});check(encoded.length<16384,'Preparation receipt must not contain historical data');return encoded;}
export function decodeReceipt(text:string|null,expected:RecoveryParameters):PreparedReceipt {
 check(text,'Prepared recovery receipt is missing');const value=JSON.parse(text) as {payload:string;sha256:string};
 check(typeof value.payload==='string'&&hashText(value.payload)===value.sha256,'Prepared recovery receipt is corrupted');
 const receipt=JSON.parse(value.payload) as PreparedReceipt;
 check(receipt.version===1&&JSON.stringify(receipt.parameters)===JSON.stringify(expected)&&receipt.namespace===namespaceFor(expected),'Prepared recovery receipt parameters differ');
 check(Number.isSafeInteger(receipt.expected?.wallet)&&receipt.expected.hands===expected.hands&&(receipt.expected.activeDigest===null||/^[a-f\d]{64}$/.test(receipt.expected.activeDigest)),'Invalid expected committed state');
 return receipt;
}
export function distribution(samples:readonly number[]){
 check(samples.length>0&&samples.every(value=>Number.isFinite(value)&&value>=0),'Finite nonnegative timing samples required');
 const sorted=[...samples].sort((a,b)=>a-b),q=(p:number)=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
 return{n:sorted.length,p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)!,method:'nearest-rank' as const};
}
export type BrowserTask={start:number;ms:number};
/** A task can straddle phase markers within the same event-loop callback.
 * Count the whole observed task in every interval it overlaps, never as a
 * completed-startup task when it extends into history/audit work. These are
 * responsiveness windows, not additive CPU attribution. */
export function taskWindows(tasks:readonly BrowserTask[],boundaries:{ready:number;historyStart:number;historyEnd:number;auditStart:number;auditEnd:number}){
 const overlaps=(task:BrowserTask,start:number,end:number)=>task.start<end&&task.start+task.ms>start;
 const maximum=(selected:readonly BrowserTask[])=>Math.max(0,...selected.map(task=>task.ms));
 return{completedBeforeReadyMs:maximum(tasks.filter(task=>task.start+task.ms<=boundaries.ready)),crossingReadyMs:maximum(tasks.filter(task=>task.start<boundaries.ready&&task.start+task.ms>boundaries.ready)),completedBeforeHistoryMs:maximum(tasks.filter(task=>task.start+task.ms<=boundaries.historyStart)),historyOverlapMs:maximum(tasks.filter(task=>overlaps(task,boundaries.historyStart,boundaries.historyEnd))),auditOverlapMs:maximum(tasks.filter(task=>overlaps(task,boundaries.auditStart,boundaries.auditEnd)))};
}
export function memory(){const m=(performance as Performance&{memory?:{jsHeapSizeLimit:number;totalJSHeapSize:number;usedJSHeapSize:number}}).memory;return m?{jsHeapSizeLimit:m.jsHeapSizeLimit,totalJSHeapSize:m.totalJSHeapSize,usedJSHeapSize:m.usedJSHeapSize}:null;}
export const turn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
export const paint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
export function evidenceDownload(id:string,filename:string,contents:unknown):void {
 let link=document.querySelector<HTMLAnchorElement>('#'+id);if(!link){link=document.createElement('a');link.id=id;link.style.cssText='display:inline-block;padding:12px;margin:10px;background:#fff4cf;color:#201c10;font:16px system-ui';document.body.append(link);}
 if(link.href.startsWith('blob:'))URL.revokeObjectURL(link.href);link.href=URL.createObjectURL(new Blob([typeof contents==='string'?contents:JSON.stringify(contents,null,2)],{type:'application/json'}));link.download=filename;link.textContent='Download complete evidence JSON';link.hidden=false;
}
export async function until(test:()=>boolean,label:string,timeout=240000,onTick?:()=>void){const start=performance.now();while(!test()){onTick?.();check(performance.now()-start<timeout,`QA deadline exceeded: ${label}`);await new Promise(resolve=>setTimeout(resolve,16));}}
export type RuntimeManifest={format:string;version:number;name:string;sourceCommit:string;productionDirty:string;artifacts:Array<{path:string;sha256:string;bytes:number}>;sourceFiles:Record<string,string>};
export async function verifiedRuntime<T>(reader:'baseline'|'candidate',includeCSS=true):Promise<{runtime:T;manifest:RuntimeManifest}>{
 const response=await fetch(`./step5e-fixtures/${reader}-manifest.json`);check(response.ok,'Runtime provenance missing');const manifest=await response.json() as RuntimeManifest;
 check(manifest.format==='ai-texas-step5e-runtime-provenance'&&manifest.version===1&&manifest.name===reader,'Unexpected runtime provenance');
 if(reader==='baseline')check(manifest.sourceCommit===BASELINE_COMMIT,'Frozen V10 source commit differs');
 let moduleURL='';for(const asset of manifest.artifacts){check(asset.path.startsWith(`tests/browser/step5e-fixtures/${reader}.`),'Unexpected runtime asset path');const response=await fetch('/'+asset.path);check(response.ok,'Verified runtime asset unavailable');const bytes=new Uint8Array(await response.arrayBuffer());check(bytes.length===asset.bytes&&hex(sha256(bytes))===asset.sha256,'Runtime byte hash/size mismatch');const css=asset.path.endsWith('.css.bin');check(css||asset.path.endsWith('.js.bin'),'Unsupported runtime asset');const url=URL.createObjectURL(new Blob([bytes],{type:css?'text/css':'text/javascript'}));if(css&&includeCSS){const link=document.createElement('link');link.rel='stylesheet';link.href=url;document.head.append(link);}if(!css)moduleURL=url;}
 check(moduleURL,'Runtime JavaScript missing');return{runtime:await import(/* @vite-ignore */moduleURL) as T,manifest};
}
/** Original Step5D byte-identical archives; no reconstructed or renamed records. */
export async function seedExactFixture(namespace:string,size:number,post:(message:string)=>void){
 check(namespace.startsWith('ai-texas-step5e-recovery-')&&HISTORY_SIZES.includes(size as typeof HISTORY_SIZES[number]),'Refusing non-QA fixture target');
 const response=await fetch('./step5d-recovery-fixtures/manifest.json');check(response.ok,'Exact Step5D fixture manifest missing');const manifest=await response.json(),metadata=manifest.fixtures.find((f:{size:number})=>f.size===size);check(metadata,'Requested exact fixture missing');
 const archive=await fetch(`./step5d-recovery-fixtures/${metadata.filename}`);check(archive.ok&&archive.body,'Canonical archive unavailable');const source=archive.body.getReader();let first=await source.read();while(!first.done&&first.value.length===0)first=await source.read();check(!first.done,'Empty canonical archive');const prefix=first.value,compressed=prefix[0]===0x1f&&prefix[1]===0x8b;let transferBytes=prefix.length;
 const bytes=new ReadableStream<BufferSource>({start(c){c.enqueue(prefix);},async pull(c){const chunk=await source.read();if(chunk.done)c.close();else{transferBytes+=chunk.value.length;c.enqueue(chunk.value);}},cancel(reason){return source.cancel(reason);}}),decoded=compressed?bytes.pipeThrough(new DecompressionStream('gzip')):bytes;
 const hash=sha256.create(),decoder=decoded.pipeThrough(new TransformStream<BufferSource,BufferSource>({transform(chunk,c){hash.update(chunk instanceof ArrayBuffer?new Uint8Array(chunk):new Uint8Array(chunk.buffer,chunk.byteOffset,chunk.byteLength));c.enqueue(chunk);}})).pipeThrough(new TextDecoderStream()).getReader();
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(namespace,1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
 let current:Record<string,unknown>|null=null,pending='',records=0,batch:Array<{key:string;value:unknown}>=[];
 const flush=async()=>{if(!batch.length)return;const selected=batch;batch=[];await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');for(const row of selected)tx.objectStore('kv').put(row.value,row.key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Fixture seeding transaction aborted'));});};
 const consume=async(line:string)=>{if(!line)return;const item=JSON.parse(line) as {key:string;value:Record<string,unknown>};records++;if(item.key==='current'){check(current===null,'Duplicate canonical fixture current');current=item.value;}else{check(item.key.startsWith('v2:'),'Unexpected fixture key');batch.push(item);if(batch.length===32){await flush();post(`Preparing exact ${size}-hand archive (${records} rows); recovery measurement has not started.`);}}};
 try{for(;;){const chunk=await decoder.read();if(chunk.done)break;pending+=chunk.value;let at;while((at=pending.indexOf('\n'))>=0){await consume(pending.slice(0,at));pending=pending.slice(at+1);}}if(pending)await consume(pending);await flush();check(current&&hex(hash.digest())===metadata.rawSHA256&&records===metadata.records,'Fixture byte/count integrity mismatch');check((current as Record<string,unknown>).checksum===metadata.manifestChecksum,'Fixture checkpoint differs');await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(current,'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});return{wallet:metadata.wallet as number,canonicalStorageBytes:metadata.canonicalUncompressedBytes as number,fixtureTransferBytes:transferBytes,fixtureRawSHA256:metadata.rawSHA256 as string,fixtureManifestChecksum:metadata.manifestChecksum as string,records};}finally{db.close();}
}
