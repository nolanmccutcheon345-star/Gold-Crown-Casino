/** Opt-in diagnostics. No timers/observations or private poker data are persisted. */
export interface TimingSample { name:string; milliseconds:number;startTime?:number;endTime?:number }
let observer:((sample:TimingSample)=>void)|null=null;
export function observeTimings(next:((sample:TimingSample)=>void)|null):void { observer=next; }
export function timed<T>(name:string,work:()=>T):T { if(!observer)return work();const startTime=performance.now();try{return work();}finally{const endTime=performance.now();observer?.({name,milliseconds:endTime-startTime,startTime,endTime});} }
export async function timedAsync<T>(name:string,work:()=>Promise<T>):Promise<T> { if(!observer)return work();const startTime=performance.now();try{return await work();}finally{const endTime=performance.now();observer?.({name,milliseconds:endTime-startTime,startTime,endTime});} }
