import { newHandId } from '../../src/identity';
import { sha256 } from '@noble/hashes/sha2.js';
const frame=document.querySelector<HTMLIFrameElement>('#qa-frame')!,output=document.querySelector('#qa-result')!,evidence=document.querySelector<HTMLTextAreaElement>('#qa-evidence')!;
const height=()=>Number(document.querySelector<HTMLSelectElement>('#qa-height')!.value);
const width=()=>Number(document.querySelector<HTMLSelectElement>('#qa-width')!.value),count=()=>Number(document.querySelector<HTMLSelectElement>('#qa-count')!.value);
let run='',serial=0,busy=false;let readyResolve:((value:unknown)=>void)|null=null;
const pending=new Map<number,{resolve:(value:Record<string,unknown>)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
const reports:Record<string,unknown>[]=[];
// Full reports stay in memory and the downloadable Blob, never in the DOM.
// This harness overhead is separate from the application's performance samples.
const chunkSize=40000,chunkSelect=document.querySelector<HTMLSelectElement>('#qa-evidence-chunk')!,download=document.querySelector<HTMLAnchorElement>('#qa-evidence-download')!;
let evidenceText='',evidenceUrl='';
function compact(value:unknown,depth=0):unknown{
 if(value===null||typeof value!=='object')return typeof value==='string'&&value.length>500?`${value.slice(0,500)}…`:value;
 if(Array.isArray(value))return{count:value.length,sample:depth<4?value.slice(0,3).map(item=>compact(item,depth+1)):undefined};
 if(depth>=6)return '[object: see full evidence]';
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,['trace','records','timingSamples','runtimeEntries','canonicalOutcomes'].includes(key)&&Array.isArray(item)?{count:item.length}:compact(item,depth+1)]));
}
function showChunk(){const index=Number(chunkSelect.value)||0;evidence.value=evidenceText.slice(index*chunkSize,(index+1)*chunkSize);}
chunkSelect.addEventListener('change',showChunk);
function publish(status:string,extra:Record<string,unknown>={}){
 const began=performance.now(),result={status,at:new Date().toISOString(),browser:navigator.userAgent,viewport:{width:width(),height:height()},run,reports,...extra};
 evidenceText=JSON.stringify(result);const bytes=new TextEncoder().encode(evidenceText),hash=Array.from(sha256(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 if(evidenceUrl)URL.revokeObjectURL(evidenceUrl);evidenceUrl=URL.createObjectURL(new Blob([evidenceText],{type:'application/json'}));download.href=evidenceUrl;download.download=`ai-texas-step5b-${run}-evidence.json`;
 const previous=Number(chunkSelect.value)||0,chunks=Math.max(1,Math.ceil(evidenceText.length/chunkSize));chunkSelect.replaceChildren(...Array.from({length:chunks},(_,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`Chunk ${i+1}/${chunks} — characters ${i*chunkSize+1}–${Math.min((i+1)*chunkSize,evidenceText.length)}`;return option;}));chunkSelect.value=String(Math.min(previous,chunks-1));showChunk();
 const summary={status,at:result.at,browser:result.browser,viewport:result.viewport,run,reports:reports.map(report=>compact(report)),...extra,evidence:{sha256:hash,utf8Bytes:bytes.byteLength,characters:evidenceText.length,chunks,chunkCharacters:chunkSize,reportGenerationMs:performance.now()-began,storage:'Full evidence is retained in this page memory and the JSON download. Textarea contains only the selected chunk.'}};
 const text=JSON.stringify(summary,null,2);output.textContent=text.length<40000?text:JSON.stringify({...summary,reports:{count:reports.length,last:compact(reports.at(-1))},summaryTruncated:true},null,2);
}

window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;const message=event.data;if(message?.kind==='step5b-progress'){output.textContent=JSON.stringify({status:'RUNNING',at:new Date().toISOString(),run,progress:message,completedChecks:reports.length},null,2);}if(message?.kind==='step5b-ready'&&message.namespace===`ai-texas-hold-em-step5b-qa-${run}`){if(message.error){publish('FAIL',{error:message.error});}readyResolve?.(message);readyResolve=null;}if(message?.kind==='step5b-result'){const p=pending.get(message.id);if(!p)return;clearTimeout(p.timer);pending.delete(message.id);const layout=message.result?.layout;if(layout?.status==='FAIL'){message.status='FAIL';message.error=`Responsive assertions: ${JSON.stringify(layout.failures)}`;}reports.push(message);publish('RUNNING');if(message.status==='FAIL')p.reject(Error(message.error));else p.resolve(message.result);}});
function waitReady(){return new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>{readyResolve=null;reject(Error('Fixture did not become ready'));},60000);readyResolve=value=>{clearTimeout(timer);if(value&&typeof value==='object'&&'error' in value&&value.error)reject(Error(String(value.error)));else resolve(value);};});}
async function load(){run=`${Date.now()}-${newHandId()}`;reports.length=0;frame.style.width=`${width()}px`;frame.style.height=`${height()}px`;const ready=waitReady();frame.src=`./step5b-workflows-frame.html?run=${run}`;publish('LOADING');await ready;publish('READY');}
function command(name:string,args:Record<string,unknown>={}){return new Promise<Record<string,unknown>>((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Command timeout ${name}`));},name==='endurance_chunk'?3600000:180000);pending.set(id,{resolve,reject,timer});frame.contentWindow!.postMessage({kind:'step5b-command',id,name,args},location.origin);});}
async function reload(){const before=await command('snapshot');const ready=waitReady();frame.contentWindow!.location.reload();await ready;const after=await command('snapshot');if(before.stateDigest!==after.stateDigest)throw Error('Exact committed state changed across reload');reports.push({check:'real iframe reload',status:'PASS',before,after});publish('RUNNING');return after;}
function lockControls(locked:boolean){document.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=locked;});}
async function guarded(task:()=>Promise<void>){if(busy)return;busy=true;lockControls(true);try{await task();publish('PASS');}catch(error){publish('FAIL',{error:(error as Error).message});}finally{busy=false;lockControls(false);}}
document.querySelector('#qa-load')!.addEventListener('click',()=>{void guarded(load);});
document.querySelector('#qa-restore')!.addEventListener('click',()=>{void guarded(async()=>{
 const requested=document.querySelector<HTMLInputElement>('#qa-restore-run')!.value.trim().replace(/^ai-texas-hold-em-step5b-qa-/,'');
 if(!/^[A-Za-z0-9-]{8,100}$/.test(requested))throw Error('Enter the exact existing isolated QA run identity; production namespaces are not permitted.');
 run=requested;reports.length=0;frame.style.width=`${width()}px`;frame.style.height=`${height()}px`;const ready=waitReady();frame.src=`./step5b-workflows-frame.html?run=${run}&recover=1`;publish('LOADING_EXISTING_READ_ONLY');await ready;
 await command('recovery-audit',{expectedHands:Number(document.querySelector<HTMLSelectElement>('#qa-hands')!.value)});
});});

document.querySelector('#qa-layout')!.addEventListener('click',()=>{void guarded(async()=>{const r=await command('layout',{count:count()});if(r.status==='FAIL')throw Error(JSON.stringify(r.failures));});});
document.querySelector('#qa-reload')!.addEventListener('click',()=>{void guarded(async()=>{await reload();});});
document.querySelector('#qa-photo')!.addEventListener('click',()=>{frame.style.height='1150px';frame.contentDocument?.querySelector('.table-panel')?.scrollIntoView({block:'start'});});
document.querySelector('#qa-endurance')!.addEventListener('click',()=>{void guarded(async()=>{const total=Number(document.querySelector<HTMLSelectElement>('#qa-hands')!.value),players=count();await load();await command('endurance_begin',{count:players});await command('endurance_chunk',{target:Math.ceil(total/2),count:players,total});await command('endurance_pending',{count:players});await reload();await command('endurance_chunk',{target:total,count:players,total});await reload();const final=await command('snapshot');if(final.hands!==total||final.settlements!==total||final.street!=='complete'||final.pendingDecision)throw Error('Final settled endurance snapshot changed or duplicated payout');reports.push({check:'completed endurance target and exact post-payout reload without another hand',status:'PASS',requestedHands:total,final});});});
document.querySelector('#qa-workflow')!.addEventListener('click',()=>{void guarded(async()=>{
 await load();await command('quickstart');await command('safe_exit');await command('presets_start');await command('queue');await command('pending');await reload();await command('finish');await command('apply_next');await command('finish');await command('rake_only');await command('history');await command('safe_exit');await command('newsession',{count:9});await command('safe_exit');await command('newsession',{count:6});await reload();
});});
document.querySelector('#qa-matrix')!.addEventListener('click',()=>{void guarded(async()=>{const all:Record<string,unknown>[]=[];document.querySelector<HTMLSelectElement>('#qa-height')!.value='844';for(const w of [320,360,375,390,430,768,1280])for(const c of [2,3,6,9,10]){document.querySelector<HTMLSelectElement>('#qa-width')!.value=String(w);document.querySelector<HTMLSelectElement>('#qa-count')!.value=String(c);await load();const result=await command('layout',{count:c});all.push({width:w,count:c,...result});output.textContent=JSON.stringify({status:'RUNNING',completed:all.length,total:35,last:result},null,2);}reports.length=0;reports.push(...all);if(all.some(r=>r.status==='FAIL'))throw Error(`${all.filter(r=>r.status==='FAIL').length} layout cases failed`);});});
document.querySelector('#qa-landscape')!.addEventListener('click',()=>{void guarded(async()=>{const all:Record<string,unknown>[]=[];for(const [w,h] of [[844,390],[1024,768],[1280,768]])for(const c of [2,3,6,9,10]){document.querySelector<HTMLSelectElement>('#qa-width')!.value=String(w);document.querySelector<HTMLSelectElement>('#qa-height')!.value=String(h);document.querySelector<HTMLSelectElement>('#qa-count')!.value=String(c);await load();const result=await command('layout',{count:c});all.push({width:w,height:h,count:c,...result});output.textContent=JSON.stringify({status:'RUNNING',completed:all.length,total:15},null,2);}reports.length=0;reports.push(...all);if(all.some(r=>r.status==='FAIL'))throw Error('Landscape/tablet layout failed');});});
busy=true;lockControls(true);void load().catch(error=>publish('FAIL',{error:String(error)})).finally(()=>{busy=false;lockControls(false);});
export {};

