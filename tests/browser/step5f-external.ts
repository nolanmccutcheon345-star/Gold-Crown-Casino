import {sha256} from '@noble/hashes/sha2.js';
import {installExternalObserver} from './step5f-external-observer';
import {beginCandidateVerification,focusCandidateApplication} from './step5g-external-navigation';

const PRODUCTION_ORIGIN='https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site';
const app=document.querySelector<HTMLElement>('#app')!,status=document.querySelector<HTMLElement>('#external-status')!,proof=document.querySelector<HTMLElement>('#external-proof')!;
const get=(id:string)=>(document.getElementById(id) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement).value;
const hash=(bytes:Uint8Array)=>Array.from(sha256(bytes),b=>b.toString(16).padStart(2,'0')).join('');
function required(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
let capture:ReturnType<typeof installExternalObserver>|null=null,identity:Record<string,unknown>|null=null,downloadURL:string|null=null;
document.querySelector<HTMLButtonElement>('#external-start')!.onclick=()=>{void(async()=>{
 const button=document.querySelector<HTMLButtonElement>('#external-start')!;beginCandidateVerification(button,status);
 try{
  required(location.origin!==PRODUCTION_ORIGIN,'Refusing to load this test harness on the production origin.');
  required(['http:','https:'].includes(location.protocol),'Serve the candidate on a separate HTTP(S) origin; do not open it as a local file.');
  required(isSecureContext&&!!crypto.subtle&&!!indexedDB,'This candidate needs a secure context, browser cryptography and IndexedDB. Use localhost for desktop review or a separate authorized HTTPS origin for a physical device.');
  const params=new URLSearchParams(location.search),manifestURL=new URL(params.get('manifest')??app.dataset.externalManifest??'./step5f-candidate/manifest.json',location.href);
  required(manifestURL.origin===location.origin,'Candidate manifest must be on this isolated origin.');
  status.textContent='Verifying candidate source and exact compiled assets…';
  const response=await fetch(manifestURL);required(response.ok,'Candidate manifest is unavailable; the integrator must package a tested candidate first.');
  const manifestBytes=new Uint8Array(await response.arrayBuffer());const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)) as {status:string;sourceCommit:string;executionReceipt?:string;executionReceiptSHA256?:string;assets:Array<{source:string;url:string;sha256:string;bytes:number}>};
  required(manifest.status==='BUILD_BYTES_VERIFIED'&&/^[a-f0-9]{40}$/.test(manifest.sourceCommit),'Unverified candidate manifest.');
  required(Array.isArray(manifest.assets)&&manifest.assets.length>=3,'Candidate assets are missing.');
  const assets:Array<{source:string;url:string;sha256:string;bytes:Uint8Array}>=[];
  for(const asset of manifest.assets){const url=new URL(asset.url,manifestURL);required(url.origin===location.origin&&/^[a-f0-9]{64}$/.test(asset.sha256),'Invalid candidate asset identity.');const result=await fetch(url);required(result.ok,'Candidate asset unavailable.');const bytes=new Uint8Array(await result.arrayBuffer());required(bytes.length===asset.bytes&&hash(bytes)===asset.sha256,'Candidate asset hash/size mismatch.');assets.push({source:asset.source,url:url.href,sha256:asset.sha256,bytes});}
  const html=assets.find(a=>a.source==='dist/index.html');required(html,'Compiled index is missing.');
  const index=new DOMParser().parseFromString(new TextDecoder().decode(html.bytes),'text/html');
  const declared=[...index.querySelectorAll('link[rel="stylesheet"],script[type="module"][src]')].map(e=>'dist'+(e.getAttribute('href')??e.getAttribute('src'))),runtime=assets.filter(a=>a!==html);
  required(declared.length===runtime.length&&runtime.every(a=>declared.includes(a.source))&&runtime.filter(a=>a.source.endsWith('.js')).length===1,'Expected one self-contained compiled application module and its declared styles.');
  let run=params.get('run');if(!run){run=`${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;params.set('run',run);history.replaceState(null,'',`${location.pathname}?${params}`);}
  required(/^[A-Za-z0-9_-]{1,80}$/.test(run),'Invalid test run identity.');
  const namespace=`ai-texas-step5f-external-${run}`,nativeOpen=indexedDB.open.bind(indexedDB);
  indexedDB.open=(name,version)=>{required(name==='ai-texas-hold-em-guest','Unexpected database request blocked by candidate isolation.');return nativeOpen(namespace,version);};
  identity={sourceCommit:manifest.sourceCommit,executionReceipt:manifest.executionReceipt??'NOT_RECORDED',executionReceiptSHA256:manifest.executionReceiptSHA256??'NOT_RECORDED',manifestURL:manifestURL.href,manifestSHA256:hash(manifestBytes),assets:assets.map(({source,sha256})=>({source,sha256})),origin:location.origin,run,namespace,productionDatabaseAccessed:false,applicationBytesChanged:false,adapter:'Only default IndexedDB open is remapped; no poker action, controller, deck or private-state instrumentation.',performanceOptIn:params.get('measurePerformance')==='1'};
  capture=installExternalObserver(app);proof.textContent=JSON.stringify(identity,null,2);
  for(const asset of runtime){const css=asset.source.endsWith('.css'),url=URL.createObjectURL(new Blob([Uint8Array.from(asset.bytes).buffer],{type:css?'text/css':'text/javascript'}));if(css){const element=document.createElement('link');element.rel='stylesheet';element.href=url;document.head.append(element);}else{const element=document.createElement('script');element.type='module';element.src=url;document.body.append(element);}}
  status.textContent='Exact candidate assets verified. Use the ordinary table below. Loading and financial readiness are reported by the application.';
  document.querySelector<HTMLAnchorElement>('#external-jump-app')!.hidden=false;
  document.querySelector<HTMLButtonElement>('#external-capture')!.disabled=false;document.querySelector<HTMLButtonElement>('#external-new-measurement')!.disabled=false;
 }catch(error){status.textContent=`BLOCKED: ${String(error)}`;proof.textContent='No candidate verification PASS is inferred.';}
 })();};
document.querySelector<HTMLAnchorElement>('#external-jump-app')!.onclick=event=>{event.preventDefault();focusCandidateApplication(app);};
document.querySelector<HTMLButtonElement>('#external-capture')!.onclick=()=>{
 if(!capture||!identity)return;
 const report={format:'step5f-external-observation-file',version:1,status:'OBSERVATIONS_ONLY',identity,operatorDeclared:{anonymousTester:get('tester-id'),hardwareKind:get('device-kind'),device:get('device-description'),browser:get('browser-description'),screenReader:get('reader-description'),phase:get('run-phase'),conditions:get('device-conditions'),observations:get('external-notes')},measurements:capture.capture(),reviewRequired:'Operator declarations and structured observations do not independently verify physical hardware, speech or participant independence. No original acceptance requirement is automatically promoted.'};
 const text=JSON.stringify(report,null,2),file=new File([text],`ai-texas-candidate-observations-${Date.now()}.json`,{type:'application/json'});
 if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(file);const link=document.querySelector<HTMLAnchorElement>('#external-download')!;link.href=downloadURL;link.download=file.name;link.hidden=false;
 const copy=document.querySelector<HTMLButtonElement>('#external-copy')!,raw=document.querySelector<HTMLTextAreaElement>('#external-json')!;raw.value=text;copy.hidden=false;copy.onclick=()=>{raw.hidden=false;raw.focus();raw.select();};
 const share=document.querySelector<HTMLButtonElement>('#external-share')!;share.hidden=!(navigator.canShare?.({files:[file]})&&navigator.share);share.onclick=()=>{void navigator.share({files:[file],title:'AI Texas Hold Em candidate observations'}).then(()=>{document.querySelector('#external-export-status')!.textContent='Share request completed; independently check the saved file.';}).catch(error=>{document.querySelector('#external-export-status')!.textContent=`Share did not complete: ${String(error)}. Download or show/copy JSON remains available.`;});};
 document.querySelector('#external-export-status')!.textContent='Observation file prepared. Actual download/share and app History export still need to be checked.';
};

document.querySelector<HTMLButtonElement>('#external-new-measurement')!.onclick=()=>{if(!capture)return;capture.close();capture=installExternalObserver(app);document.querySelector('#external-export-status')!.textContent='New measurement window started. The prior prepared file remains available until the next capture. Poker state was not changed.';};
