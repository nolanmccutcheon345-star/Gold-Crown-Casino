export {};
const frame=document.querySelector<HTMLIFrameElement>('#persona-table')!,button=document.querySelector<HTMLButtonElement>('#run-persona')!,status=document.querySelector('#status')!,out=document.querySelector('#result')!;
let receive:((result:unknown)=>void)|null=null;
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.kind==='step5b-persona-result')receive?.(event.data.result);});
button.onclick=()=>{void(async()=>{
 button.disabled=true;const results:unknown[]=[];
 for(const test of ['unknown-random','low-12','low-13','mid-25','high-510']){
  status.textContent=`Running ${test}…`;
  const row=await new Promise<unknown>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(`${test} timeout`)),120000);receive=result=>{clearTimeout(timeout);receive=null;resolve(result);};frame.src=`./step5b-persona-frame.html?case=${test}&fresh=${Date.now()}`;});
  results.push(row);out.textContent=JSON.stringify({status:'RUNNING',results},null,2);
 }
 const passed=results.filter(row=>(row as {status:string}).status==='PASS').length;status.textContent=`${passed===results.length?'PASS':'FAIL'} · ${passed}/${results.length} scenarios`;
 out.textContent=JSON.stringify({status:passed===results.length?'PASS':'FAIL',passed,total:results.length,userAgent:navigator.userAgent,results,requirementLimitation:'V514 historical population/mix-change grouping in session statistics remains incomplete; this harness verifies current settings provenance and persistence only.',humanCalibration:'NOT CLAIMED'},null,2);
 })().catch(error=>{status.textContent='FAIL';out.textContent=JSON.stringify({status:'FAIL',error:String(error)});}).finally(()=>{button.disabled=false;});};
