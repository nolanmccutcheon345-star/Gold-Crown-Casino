export {};
const frame=document.querySelector<HTMLIFrameElement>('#qa-frame')!;
const selected=(id:string)=>document.querySelector<HTMLSelectElement>(`#qa-${id}`)!.value;
const output=document.querySelector('#qa-result')!;
function load(){frame.style.width=`${selected('width')}px`;frame.src=`./step5a-play-frame.html?seats=${selected('seats')}&population=${selected('population')}`;output.textContent='LOADING';}
document.querySelector('#qa-load')!.addEventListener('click',load);
document.querySelector('#qa-run')!.addEventListener('click',()=>frame.contentWindow!.postMessage({kind:'run-ui-hands',hands:Number(selected('hands')),fault:document.querySelector<HTMLInputElement>('#qa-fault')!.checked},location.origin));
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.kind==='ui-hand-report'){const {records,...result}=event.data.result;output.textContent=JSON.stringify(result,null,2);if(records)document.querySelector<HTMLTextAreaElement>('#qa-records')!.value=JSON.stringify(records);}});load();
