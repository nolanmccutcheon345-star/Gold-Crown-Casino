/** Node evidence probe; browser and physical-device performance are separate checks. */
import {analyzeRanges,RANGE_MODEL_VERSION} from '../../src/bots/ranges';
import {createProfile,POLICY_VERSION} from '../../src/bots/profiles';
import {observeBot} from '../../src/core/engine';
import {seededEngineHand,step} from '../step4a/scenarios';
const profile=createProfile({selection:'stronger-reg'},0x411,'neutral');
const rows:{seats:number;street:string;seed:number;coldMs:number;cachedMeanMs:number;samples:number;equity:number;uncertainty:number}[]=[];
for(const seats of [2,6,10])for(const seed of [1941,2801,4107]){
 let state=seededEngineHand(seats,seed);
 while(state.street==='preflop')state=step(state,state.currentBet>state.seats.find(s=>s.id===state.actor)!.streetCommitted?{type:'call'}:{type:'check'});
 for(const street of ['flop','turn','river']){
  while(state.street!==street&&state.street!=='complete')state=step(state,{type:'check'});
  if(state.street==='complete')break;
  const observation=observeBot(state,state.actor!,POLICY_VERSION,`bench:${seed}:${street}`);
  const start=performance.now(),r=analyzeRanges(observation,profile),coldMs=performance.now()-start,cacheStart=performance.now();
  for(let i=0;i<1000;i++)analyzeRanges(observation,profile);
  rows.push({seats,street,seed,coldMs,cachedMeanMs:(performance.now()-cacheStart)/1000,samples:r.equitySamples,equity:r.equity,uncertainty:r.uncertainty});
 }
}
console.log(JSON.stringify({model:RANGE_MODEL_VERSION,environment:'Node synthetic probe, not browser or physical-device measurement',rows},null,2));
