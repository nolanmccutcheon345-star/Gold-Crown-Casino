export {};
const frame=document.querySelector<HTMLIFrameElement>('#table')!,status=document.querySelector('#status')!,result=document.querySelector('#result')!;
const check=document.querySelector<HTMLButtonElement>('#check')!,rapid=document.querySelector<HTMLButtonElement>('#rapid')!;
const evidence:unknown[]=[];
document.querySelector<HTMLButtonElement>('#build')!.onclick=()=>{
 const width=Number(document.querySelector<HTMLInputElement>('#width')!.value);
 if(!Number.isInteger(width)||width<320||width>430){status.textContent='Choose a width from320–430 CSS pixels.';return;}
 frame.width=String(width);check.disabled=true;rapid.disabled=true;evidence.length=0;result.textContent='';status.textContent='Building isolated legal-engine fixture…';
 frame.src=`./step5b-sizing-frame.html?fresh=${Date.now()}`;
};
check.onclick=()=>{status.textContent='Running UI controls and geometry assertions…';frame.contentWindow?.postMessage({kind:'step5b-sizing-run'},location.origin);};
rapid.onclick=()=>{status.textContent='Testing two rapid clicks on the same rendered action…';frame.contentWindow?.postMessage({kind:'step5b-sizing-rapid'},location.origin);};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.kind!=='step5b-sizing-report')return;
 const row=event.data.result;evidence.push(row);result.textContent=JSON.stringify({userAgent:navigator.userAgent,frameWidth:Number(frame.width),evidence},null,2);
 status.textContent=`${row.status} · ${row.phase}${row.error?`: ${row.error}`:''}`;
 if(row.status==='READY'){check.disabled=false;rapid.disabled=false;}
 if(row.phase==='double-tap'&&row.status==='PASS')rapid.disabled=true;
});
