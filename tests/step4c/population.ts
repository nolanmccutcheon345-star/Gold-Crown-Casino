import type {BotProfile,GameState,OpponentConfig,PopulationPreset,PublicMemoryHand} from '../../src/contracts';
import {chooseDecision,createProfile,buildOpponentMemory} from '../../src/bots/policy';
import {createProfile as createOld} from '../../src/bots/v2/profiles';
import {applyCommand,observeBot,startHand,assertAccounting} from '../../src/core/engine';
import {rig,practiceProfile} from '../verification/helpers';
import {HandAudit,STYLES,physicalPosition,reconcile,rng,clusteredRate,type Counters} from './audit';
import {probeAction,PROBES,type Probe,PROBE_NOTES} from './probes';
export type Model='baseline-1.1'|'candidate-1.2';
export type Cohort='development'|'heldout';
const seedBase=(cohort:Cohort)=>cohort==='development'?0x4c110000:0x4c910000;
export interface TrialPlan {block:string;index:number;seats:number;depth:number;environment:PopulationPreset;replicate:number;rake:boolean;seed:number;}
export function plan(cohort:Cohort):TrialPlan[]{const rows:TrialPlan[]=[];for(const seats of [2,6,9,10])for(const depth of [20,100,250])for(const environment of ['low','mid','high'] as PopulationPreset[])for(let replicate=0;replicate<2;replicate++){
 const index=rows.length;rows.push({block:`${cohort}:population:${index}`,index,seats,depth,environment,replicate,rake:index%2===1,seed:seedBase(cohort)+index*1000});
 }return rows;}
export function makeGame(id:string,count:number,seed:number,depth:number,rake:boolean,button:number,shortSeat:number|null=null):GameState {
 const random=rng(seed^0x8e2d3c51),deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const profile=practiceProfile();profile.version='0.3.0';if(rake)profile.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
 return rig(startHand({handId:id,seats:Array.from({length:count},(_,i)=>({id:i,name:`Player${i}`,stack:Math.round(200*depth*(i===shortSeat?.5:1))})),button,profile}),Array.from({length:count},(_,i)=>deck.slice(i*2,i*2+2)),deck.slice(count*2,count*2+5));
}
function profile(model:Model,config:OpponentConfig,seed:number,environment:PopulationPreset):BotProfile{return(model==='baseline-1.1'?createOld:createProfile)(config,seed,environment);}
function add(target:Counters,source:Counters){for(const [key,c]of Object.entries(source)){const old=target[key]??{count:0,opportunities:0};old.count+=c.count;old.opportunities+=c.opportunities;target[key]=old;}}
function publicHand(g:GameState):PublicMemoryHand{return{handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events};}
export function runHand(g:GameState,profiles:BotProfile[],seed:number,histories:PublicMemoryHand[],focus:number|null=null,probe:Probe|null=null){
 const audit=new HandAudit(g.seats.map(s=>s.id)),initial=g.seats.map(s=>({id:s.id,stack:s.startingStack,cards:s.hole})),times:number[]=[];let guard=0;
 while(g.street!=='complete'&&guard++<300){
  const actor=g.actor!,p=profiles[actor],o=observeBot(g,actor,p.policyVersion,`${g.handId}:${g.revision}`);o.rake=g.profile.rake;o.memory=buildOpponentMemory(histories,actor,p.traits?.memoryRetention??.5);
  const started=performance.now();const decision=probe&&actor!==focus?{handId:g.handId,revision:g.revision,seatId:actor,decisionId:o.decisionId,action:probeAction(probe,o)}:chooseDecision(o,p,rng(seed^Math.imul(actor+1,0x71e142bd)^Math.imul(g.revision+1,0x9e3779b9)));
  if(!probe||actor===focus)times.push(performance.now()-started);audit.record(g,decision.action);g=applyCommand(g,decision);audit.after(g);assertAccounting(g);
 }
 const money=reconcile(g),metrics=audit.finish(g);return{game:g,audit,metrics,times,record:{handId:g.handId,seed,initial,button:g.button,profile:g.profile,profiles,board:g.board,events:g.events,pots:g.pots,payouts:g.payouts,final:g.seats.map(s=>({id:s.id,stack:s.stack,folded:s.folded,revealed:g.revealedSeats.includes(s.id)})),money}};
}
export interface PopulationBlock {plan:TrialPlan;model:Model;profiles:BotProfile[];metrics:Record<string,Counters>;segments:Record<string,Counters>;net:Record<string,{hands:number;bb:number;showdownBB:number;nonshowdownBB:number}>;hands:ReturnType<typeof runHand>['record'][];sizing:({archetype:string}&HandAudit['sizing'][number])[];flops:number;multiwayFlops:number;sidePots:number;times:number[];}
export function populationBlock(p:TrialPlan,model:Model,hands=20):PopulationBlock {
 const profiles=Array.from({length:p.seats},(_,seat)=>{const style=STYLES[(seat+p.index)%8],selection=p.replicate===0?style:seat===0?'unknown':seat===1?'custom':'random';return profile(model,{selection,baseArchetype:selection==='custom'?style:undefined,skill:[.3,.65,.9][(p.index+seat)%3]},0x4caa0000+p.index*100+seat,p.environment);});
 const out:PopulationBlock={plan:p,model,profiles,metrics:{},segments:{},net:{},hands:[],sizing:[],flops:0,multiwayFlops:0,sidePots:0,times:[]},history:PublicMemoryHand[]=[];
 for(let hand=0;hand<hands;hand++){
  const seed=p.seed+hand,button=hand%p.seats,g=makeGame(`${p.block}:${hand}`,p.seats,seed,p.depth,p.rake,button,hand%5===4?(hand+1)%p.seats:null),result=runHand(g,profiles,seed,history);
  history.push(publicHand(result.game));out.hands.push(result.record);out.times.push(...result.times);if(result.game.board.length>=3){out.flops++;const flop=result.game.events.find(e=>e.type==='street'&&e.street==='flop');const folded=new Set(result.game.events.filter(e=>e.type==='action'&&e.action?.type==='fold'&&(!flop||e.revision<flop.revision)).map(e=>e.seatId));if(p.seats-folded.size>=3)out.multiwayFlops++;}if(result.game.pots.length>1)out.sidePots++;
  for(const [seat,counters]of result.metrics){const a=profiles[seat].archetype;out.metrics[a]??={};add(out.metrics[a],counters);const net=(result.game.seats[seat].stack-result.game.seats[seat].startingStack)/200;out.net[a]??={hands:0,bb:0,showdownBB:0,nonshowdownBB:0};out.net[a].hands++;out.net[a].bb+=net;if(result.game.revealedSeats.length>1)out.net[a].showdownBB+=net;else out.net[a].nonshowdownBB+=net;
   for(const [dimension,value]of Object.entries({seats:p.seats,depth:p.depth,environment:p.environment,position:physicalPosition(p.seats,button,seat),skill:profiles[seat].skill,rake:p.rake,selection:p.replicate===0?'fixed-style':seat===0?'unknown':seat===1?'custom':'random'})){const key=`${a}|${dimension}=${value}`;out.segments[key]??={};add(out.segments[key],counters);}
  }
  for(const row of result.audit.segments){const a=profiles[row.seat].archetype;for(const [dimension,value]of Object.entries({street:row.street,node:row.node,board:row.texture,players:row.players>2?'multiway':'heads-up'})){const key=`${a}|${dimension}=${value}`;out.segments[key]??={};add(out.segments[key],{[row.metric]:{count:row.count,opportunities:row.opportunities}});}}
  out.sizing.push(...result.audit.sizing.map(s=>({...s,archetype:profiles[s.seat].archetype})));
 }return out;
}
function summaryRates(blocks:PopulationBlock[],field:'metrics'|'segments'){
 const keys=[...new Set(blocks.flatMap(b=>Object.keys(b[field])))].sort();return Object.fromEntries(keys.map(key=>{const metrics=[...new Set(blocks.flatMap(b=>Object.keys(b[field][key]??{})))].sort();return[key,Object.fromEntries(metrics.map(m=>[m,clusteredRate(blocks.map(b=>b[field][key]?.[m]??{count:0,opportunities:0}))]))];}));
}
export function summarizePopulation(blocks:PopulationBlock[]){
 const times=blocks.flatMap(b=>b.times).sort((a,b)=>a-b);return{model:blocks[0]?.model,blocks:blocks.length,completedHands:blocks.reduce((n,b)=>n+b.hands.length,0),decisions:blocks.reduce((n,b)=>n+b.hands.reduce((v,h)=>v+h.money.actions,0),0),flops:blocks.reduce((n,b)=>n+b.flops,0),multiwayFlops:blocks.reduce((n,b)=>n+b.multiwayFlops,0),sidePotHands:blocks.reduce((n,b)=>n+b.sidePots,0),rates:summaryRates(blocks,'metrics'),marginalSegments:summaryRates(blocks,'segments'),net:blocks.map(b=>({block:b.plan.block,net:b.net})),computeMs:{n:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)},notes:'All metrics from actual actions; no policy probabilities imported. Marginal segments are not a full factorial joint estimate. Whole table/personality blocks bootstrap; sparse conditional cells are marked.'};
}
export function probeBlock(model:Model,cohort:Cohort,probe:Probe,archetype:typeof STYLES[number],block:number,hands=12){
 const index=PROBES.indexOf(probe)*8+STYLES.indexOf(archetype),depth=(cohort==='development'?[40,100,200,80]:[25,75,175,300])[block%4],seats=probe==='multiway-squeeze'?6:2,profiles=Array.from({length:seats},(_,seat)=>profile(model,{selection:archetype},0x4cbb0000+index*100+block*10+seat,'neutral'));
 const out={model,cohort,probe,definition:PROBE_NOTES[probe],archetype,block,depth,netBB:[] as number[],metrics:{} as Counters,hands:[] as ReturnType<typeof runHand>['record'][],times:[] as number[]},history:PublicMemoryHand[]=[];
 for(let hand=0;hand<hands;hand++){
  const seed=seedBase(cohort)+0x50000+index*1000+block*100+hand,focus=hand%seats,button=(focus+(hand%2))%seats,g=makeGame(`${cohort}:probe:${probe}:${archetype}:${block}:${hand}`,seats,seed,depth,block%2===1,button),result=runHand(g,profiles,seed,history,focus,probe);history.push(publicHand(result.game));out.hands.push(result.record);out.times.push(...result.times);out.netBB.push((result.game.seats[focus].stack-result.game.seats[focus].startingStack)/200);add(out.metrics,result.metrics.get(focus)!);
 }return out;
}
export function summarizeProbes(blocks:ReturnType<typeof probeBlock>[]){const keys=[...new Set(blocks.map(b=>`${b.probe}:${b.archetype}`))];return{model:blocks[0]?.model,cohort:blocks[0]?.cohort,blocks:blocks.length,completedHands:blocks.reduce((n,b)=>n+b.hands.length,0),decisions:blocks.reduce((n,b)=>n+b.hands.reduce((v,h)=>v+h.money.actions,0),0),rows:keys.map(key=>{
 const group=blocks.filter(b=>`${b.probe}:${b.archetype}`===key),values=group.map(b=>b.netBB.reduce((s,v)=>s+v,0)/b.netBB.length),all=group.flatMap(b=>b.netBB),random=rng(551),boot:number[]=[];if(group.length>=8)for(let n=0;n<1000;n++){let sum=0;for(let j=0;j<group.length;j++)sum+=values[Math.floor(random()*values.length)];boot.push(sum/group.length);}boot.sort((a,b)=>a-b);
 const metrics=[...new Set(group.flatMap(b=>Object.keys(b.metrics)))];return{probe:group[0].probe,archetype:group[0].archetype,hands:all.length,blocks:group.length,meanBBPerHand:all.reduce((s,v)=>s+v,0)/all.length,clusterBootstrap95:boot.length?[boot[24],boot[974]]:null,blockMeans:values,minBB:Math.min(...all),maxBB:Math.max(...all),rates:Object.fromEntries(metrics.map(m=>[m,clusteredRate(group.map(b=>b.metrics[m]??{count:0,opportunities:0}))])),coverage:group.length<8?'INSUFFICIENT_INDEPENDENT_BLOCKS_FOR_OUTCOME_INTERVAL':'DESCRIPTIVE_SYNTHETIC_ESTIMATE'};
 }),warning:'Purposefully hostile fixed strategies; no solver exploitability bound or real-world profitability. Few blocks and rare heavy tails can leave large uncertainty.'};}
