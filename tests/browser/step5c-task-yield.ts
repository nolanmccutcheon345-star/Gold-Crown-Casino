export {};
type Backend={name:string;yieldControl:()=>Promise<void>;close:()=>void};
type HostScheduler={postTask?:<T>(work:()=>T,options:{priority:'background'})=>Promise<T>;yield?:()=>Promise<void>};
const host=(globalThis as typeof globalThis&{scheduler?:HostScheduler}).scheduler;
const status=document.getElementById('status')!,button=document.getElementById('run') as HTMLButtonElement,output=document.getElementById('evidence') as HTMLTextAreaElement;
const pings:{at:number;eventAgeMs:number;phase:string}[]=[];let phase='idle';
(document.getElementById('ping') as HTMLButtonElement).onclick=event=>{const at=performance.now(),eventAgeMs=Math.max(0,at-event.timeStamp);pings.push({at,eventAgeMs,phase});document.getElementById('ping-result')!.textContent=`Handled interaction ${pings.length}; event age ${eventAgeMs.toFixed(1)}ms during ${phase}`;};
const quantiles=(values:number[])=>{const x=values.slice().sort((a,b)=>a-b),q=(p:number)=>x[Math.max(0,Math.ceil(x.length*p)-1)]??null;return{samples:x.length,p50:q(.5),p95:q(.95),p99:q(.99),max:x.at(-1)??null};};
function channelBackend():Backend{
 const channel=new MessageChannel(),pending:(()=>void)[]=[];
 channel.port1.onmessage=()=>{const resolve=pending.shift();resolve?.();};
 return{name:'message-channel',yieldControl:()=>new Promise(resolve=>{pending.push(resolve);channel.port2.postMessage(null);}),close:()=>{channel.port1.close();channel.port2.close();}};
}
button.onclick=async()=>{
 button.disabled=true;const rows:unknown[]=[],longTasks:{start:number;ms:number}[]=[],beats:{at:number;gap:number}[]=[];let last=performance.now(),count=0;
 const heartbeat=setInterval(()=>{const at=performance.now();beats.push({at,gap:at-last});last=at;document.getElementById('heartbeat')!.textContent=`Heartbeat ${++count}`;},16),observer=new PerformanceObserver(entries=>{for(const e of entries.getEntries())longTasks.push({start:e.startTime,ms:e.duration});});observer.observe({type:'longtask',buffered:false});
 const backends:Backend[]=[{name:'timer',yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0)),close:()=>{}},...(host?.postTask?[{name:'post-task-background',yieldControl:()=>host.postTask!(()=>{}, {priority:'background'}),close:()=>{}}]:[]),channelBackend()];
 try{
  for(const backend of backends){
   phase=`${backend.name}: empty task overhead`;status.textContent=phase;await new Promise<void>(resolve=>setTimeout(resolve,30));let start=performance.now();const latencies:number[]=[];
   for(let i=0;i<500;i++){const t=performance.now();await backend.yieldControl();latencies.push(performance.now()-t);}const emptyEnd=performance.now();
   phase=`${backend.name}: 250 chunks of 8ms CPU work`;status.textContent=phase;await new Promise<void>(resolve=>setTimeout(resolve,30));start=performance.now();let checksum=0;
   for(let i=0;i<250;i++){const until=performance.now()+8;while(performance.now()<until)checksum=(checksum+17)%65521;await backend.yieldControl();}
   const end=performance.now();await new Promise<void>(resolve=>setTimeout(resolve,30));rows.push({backend:backend.name,emptyTasks:quantiles(latencies),emptyEnd,workChunks:250,targetWorkPerChunkMs:8,totalWorkWindowMs:end-start,heartbeatGapsMs:quantiles(beats.filter(b=>b.at>=start&&b.at<=end).map(b=>b.gap)),longTasks:longTasks.filter(t=>t.start<end&&t.start+t.ms>start),checksum});backend.close();
   output.value=JSON.stringify({userAgent:navigator.userAgent,secureContext:isSecureContext,capabilities:{postTask:typeof host?.postTask,yield:typeof host?.yield,MessageChannel:typeof MessageChannel},rows,pings},null,2);
  }
  phase='complete';status.textContent='Comparison complete. These scheduling measurements do not replace actual poker recovery validation.';
 }catch(e){status.textContent=`FAIL: ${(e as Error).message}`;}
 finally{clearInterval(heartbeat);observer.disconnect();for(const backend of backends)backend.close();button.disabled=false;}
};
