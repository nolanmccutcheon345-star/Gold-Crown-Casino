import {buildGateFixture} from './step5b-gates-fixtures';
import {canonical} from '../../src/storage/integrity';
const frame=document.querySelector<HTMLIFrameElement>('#frame')!,output=document.querySelector('#result')!,status=document.querySelector('#status')!,run=document.querySelector<HTMLButtonElement>('#run')!;
run.addEventListener('click',()=>{void(async()=>{
 run.disabled=true;const started=new Date().toISOString();const fixture=await buildGateFixture({kind:'layout-preflop',seats:9,chipUnit:100});
 const fixtureSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(fixture.data)))),n=>n.toString(16).padStart(2,'0')).join('');const results:Record<string,unknown>[]=[];
 for(let round=0;round<3;round++)for(const variant of (round%2?['candidate','baseline']:['baseline','candidate'])){
  status.textContent=`Round ${round+1}/3: ${variant}`;
  const row=await new Promise<Record<string,unknown>>((resolve,reject)=>{
   const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;if(event.data?.kind==='patch2-render-ready')frame.contentWindow!.postMessage({kind:'patch2-render-start',data:fixture.data,round,variant,fixtureSHA256},location.origin);if(event.data?.kind==='patch2-render-result'){clearTimeout(timer);window.removeEventListener('message',receive);resolve(event.data.result);}};
   const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('Benchmark frame timeout'));},60000);window.addEventListener('message',receive);frame.src=`./patch1011-render-prebuilt/${variant}/index.html?round=${round}`;
  });results.push(row);output.textContent=JSON.stringify({status:'RUNNING',started,fixtureSHA256,results},null,2);
 }
 const passed=results.every(row=>row.status==='PASS');status.textContent=passed?'PASS · six measured runs':'FAIL';output.textContent=JSON.stringify({status:passed?'PASS':'FAIL',started,finished:new Date().toISOString(),fixtureSHA256,browser:navigator.userAgent,viewport:{width:1366,height:800},runs:results.length,measuredPairs:600,warmupsPerRun:10,results,scope:'Synchronous programmatic proposal events followed by actual Continue session UI render, with forced layout. No CPU throttling. Not long-session performance or a historical-stall resolution.'},null,2);
 })().catch(error=>{status.textContent='FAIL';output.textContent=JSON.stringify({status:'FAIL',error:String(error)},null,2);}).finally(()=>{run.disabled=false;});});
