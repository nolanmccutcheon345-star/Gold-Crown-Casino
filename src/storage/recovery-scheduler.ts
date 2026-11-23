type OrdinaryScheduler={postTask?:(work:()=>void,options:{priority:'background'})=>Promise<void>};
interface ChannelQueue {channel:MessageChannel;pending:(()=>void)[];scheduled:boolean}
let channelQueue:ChannelQueue|null=null;
const timerTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function closeChannel(state:ChannelQueue):void {
 state.channel.port1.close();state.channel.port2.close();if(channelQueue===state)channelQueue=null;
}
/** At most one shared channel and one posted message. A final empty message
 * closes both ports, so an idle/finished recovery retains no active channel. */
function channelTask():Promise<void> {
 if(typeof MessageChannel!=='function')return timerTask();
 let state=channelQueue;
 if(!state){
  try{state={channel:new MessageChannel(),pending:[],scheduled:false};}catch{return timerTask();}
  channelQueue=state;const queue=state;
  queue.channel.port1.onmessage=()=>{
   queue.scheduled=false;const next=queue.pending.shift();
   if(!next){closeChannel(queue);return;}
   next();scheduleMessage(queue);
  };
 }
 const queue=state;
 return new Promise<void>(resolve=>{queue.pending.push(resolve);scheduleMessage(queue);});
}
function scheduleMessage(state:ChannelQueue):void {
 if(state.scheduled)return;state.scheduled=true;
 try{state.channel.port2.postMessage(null);}catch{
  const pending=state.pending.splice(0);closeChannel(state);
  // Failure still crosses an ordinary task boundary before any work continues.
  void timerTask().then(()=>pending.forEach(resolve=>resolve()));
 }
}
function ordinaryTask():Promise<void> {
 const host=(globalThis as typeof globalThis&{scheduler?:OrdinaryScheduler}).scheduler;
 if(typeof host?.postTask==='function'){
  try{return host.postTask(()=>{}, {priority:'background'}).catch(()=>channelTask());}catch{/* Supported fallback below. */}
 }
 return channelTask();
}
/** Yield only between fully checked records. New background tasks are deliberately
 * used instead of boosted scheduler.yield continuations; the measured timer fallback
 * otherwise pays a nested 4ms clamp. No timeout, early trust or skipped work is added.
 * Node reference runs do not inject scheduling delays. */
export function recoveryScheduler():()=>Promise<void>|undefined {
 let last=performance.now();
 return ()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||performance.now()-last<8)return;
  return ordinaryTask().then(()=>{last=performance.now();});
 };
}
