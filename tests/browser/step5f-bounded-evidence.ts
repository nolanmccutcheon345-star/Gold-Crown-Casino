import type {TimingSample} from '../../src/performance/timing';
export interface RecordedTiming extends TimingSample {phase:string;start:number;end:number}
/** QA-only bounded diagnostics. Aggregate maxima/counts include every sample. */
export function timingRecorder(limit=6000){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('Positive timing capacity required');
 const samples:RecordedTiming[]=[],totals:Record<string,{count:number;totalMs:number;maxMs:number}>={};let count=0;
 return{samples,totals,record(sample:RecordedTiming){samples[count%limit]=sample;count++;const key=sample.phase+':'+sample.name,item=totals[key]??={count:0,totalMs:0,maxMs:0};item.count++;item.totalMs+=sample.milliseconds;item.maxMs=Math.max(item.maxMs,sample.milliseconds);},summary(){return{total:count,retained:samples.length,dropped:Math.max(0,count-limit),capacity:limit,scope:'Bounded raw ring; phase/name count, sum and maximum cover all observed samples. Raw rows are sorted only for final presentation.'};}};
}
