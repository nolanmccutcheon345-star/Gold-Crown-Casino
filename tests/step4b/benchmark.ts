import type { Archetype, BotMemory, BotProfile, GameState, PublicMemoryHand } from '../../src/contracts';
import type { PreflopAnalysis, RangeAnalysis } from '../../src/bots/range-contract';
import { analyzeDecision, ARCHETYPES, buildOpponentMemory, chooseDecision, createProfile } from '../../src/bots/policy';
import { createProfile as createVersionOne } from '../../src/bots/v1/profiles';
import { applyCommand, assertAccounting, observeBot, startHand } from '../../src/core/engine';
import { rig, practiceProfile } from '../verification/helpers';
import { OpportunityAudit, rate } from '../step4a/evaluation';
import { archetypeAssignment, seededRandom } from '../step4a/scenarios';
import { PROBES, PROBE_DEFINITIONS, probeAction } from './probes';
import { sequenceFixtures } from './sequence-fixtures';

export type Model='frozen-1.0'|'candidate-1.1';
const models:Model[]=['frozen-1.0','candidate-1.1'];
const counts=()=>({fold:0,check:0,call:0,raise:0});
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
function profile(model:Model,archetype:Archetype,seed:number):BotProfile{return(model==='frozen-1.0'?createVersionOne:createProfile)({selection:archetype},seed,'neutral');}
function diagnostic(o:ReturnType<typeof observeBot>,p:BotProfile){
 const result=analyzeDecision(o,p) as ReturnType<typeof analyzeDecision>&{preflop?:PreflopAnalysis;ranges?:RangeAnalysis};
 const r=result.ranges;
 return{features:result.features,context:result.context,distribution:result.distribution,families:result.families,sizing:result.sizing,
  preflop:result.preflop,ranges:r?{modelVersion:r.modelVersion,equity:r.equity,equitySamples:r.equitySamples,equityStdError:r.equityStdError,rangeAdvantage:r.rangeAdvantage,nutAdvantage:r.nutAdvantage,foldEquity:r.foldEquity,uncertainty:r.uncertainty,assumptions:r.assumptions,
   opponents:r.opponents.map(({combos,...summary})=>({...summary,comboCount:combos.length,topCombos:[...combos].sort((a,b)=>b.weight-a.weight).slice(0,3)})),
   foldedOpponents:r.foldedOpponents?.map(({combos,...summary})=>({...summary,comboCount:combos.length,topCombos:[...combos].sort((a,b)=>b.weight-a.weight).slice(0,3)}))}:undefined};
}
function seededGame(count:number,seed:number,stackBB=100):GameState{
 const random=seededRandom(seed^0x4bdecc),deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const holes=Array.from({length:count},(_,seat)=>deck.slice(seat*2,seat*2+2)),board=deck.slice(count*2,count*2+5);
 const button=Math.floor(seededRandom(seed^0xb0770)()*count);
 return rig(startHand({handId:`step4b-free:${count}:${seed}`,seats:Array.from({length:count},(_,id)=>({id,name:`Seat${id}`,stack:stackBB*200})),button,profile:practiceProfile()}),holes,board);
}
function publicHand(g:GameState):PublicMemoryHand{return{handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events};}
function finishRecord(g:GameState){
 assert(g.street==='complete','Hand did not terminate');assertAccounting(g);
 const sum=g.seats.reduce((n,s)=>n+s.stack,0);assert(sum+g.rake===g.initialTotal,'Independent settlement conservation failed');
 const total=(type:string)=>g.events.filter(e=>e.type===type).reduce((n,e)=>n+(e.amount??0),0);
 assert(total('blind')+total('action')-total('refund')===total('award')+g.rake,'Independent event-pot settlement failed');
 return{handId:g.handId,board:g.board,button:g.button,players:g.seats.map(s=>({id:s.id,startingStack:s.startingStack,endingStack:s.stack,net:s.stack-s.startingStack,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events,pots:g.pots,rake:g.rake,payouts:g.payouts,
  paid:total('blind')+total('action'),refunds:total('refund'),awarded:total('award')};
}
function choose(g:GameState,p:BotProfile,seed:number,memory:BotMemory|undefined,includeDiagnostic:boolean){
 const observation=observeBot(g,g.actor!,p.policyVersion,`step4b:${g.handId}:${g.revision}`);observation.rake=g.profile.rake;if(memory)observation.memory=memory;
 const started=performance.now();const detail=includeDiagnostic?diagnostic(observation,p):undefined;
 const decision=chooseDecision(observation,p,seededRandom(seed^Math.imul(g.revision+1,0x9e3779b9)^Math.imul(g.actor!+1,0x3c6ef372)));
 return{decision,computeMs:performance.now()-started,trace:{actor:g.actor,street:g.street,revision:g.revision,observation,action:decision.action,detail}};
}
function latency(values:number[]){const ordered=[...values].sort((a,b)=>a-b);return{samples:values.length,p50:ordered[Math.floor(ordered.length*.5)]??0,p95:ordered[Math.min(ordered.length-1,Math.floor(ordered.length*.95))]??0,max:ordered.at(-1)??0};}
function uncertainty(values:number[]){const n=values.length,mean=values.reduce((s,v)=>s+v,0)/Math.max(1,n),sd=n>1?Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)):null;
 return{n,meanBB:mean,standardDeviationBB:sd,standardErrorBB:sd===null?null:sd/Math.sqrt(n),descriptiveNormal95:n>=30&&sd!==null?[mean-1.96*sd/Math.sqrt(n),mean+1.96*sd/Math.sqrt(n)]:null,warning:'Seeded synthetic paired outcomes; normal interval is descriptive only. Small samples may entirely miss rare premium/all-in tail outcomes and severely understate long-run uncertainty. Not evidence of real-poker skill or solver exploitability.'};}

export function sequenceBenchmark(repetitions=8){
 const rows=[];const examples=[];const timing:Record<Model,number[]>={'frozen-1.0':[],'candidate-1.1':[]};let completed=0,decisions=0;
 for(const scenario of sequenceFixtures())for(const [archetypeIndex,archetype]of ARCHETYPES.entries())for(const model of models){
  const first=counts(),nets:number[]=[];let longest=0;
  for(let run=0;run<repetitions;run++){
   const seed=0x4b1000+run;const f=sequenceFixtures(seed).find(s=>s.id===scenario.id)!;let game=f.state;
   const profiles=game.seats.map((seat,i)=>profile(model,i===f.focusSeat?archetype:ARCHETYPES[(archetypeIndex+i+3)%8],1001+archetypeIndex+seat.id*109));
   const traces=[];let count=0;
   while(game.street!=='complete'&&count<200){
    const actor=game.actor!,p=profiles[actor];const action=choose(game,p,seed,actor===f.focusSeat?f.memory:undefined,run===0);
    if(count===0)first[action.decision.action.type]++;timing[model].push(action.computeMs);if(run===0)traces.push(action.trace);
    game=applyCommand(game,action.decision);assertAccounting(game);count++;decisions++;
   }
   const record=finishRecord(game);nets.push(record.players.find(s=>s.id===f.focusSeat)!.net/200);longest=Math.max(longest,count);completed++;
   if(run===0)examples.push({model,archetype,scenario:scenario.id,subset:scenario.subset,seed,focusSeat:f.focusSeat,description:f.description,scriptedPrefix:f.prefix,policyVersions:profiles.map(p=>p.policyVersion),traces,record});
  }
  rows.push({model,archetype,scenario:scenario.id,subset:scenario.subset,repetitions,firstDecision:Object.fromEntries(Object.entries(first).map(([key,n])=>[key,rate(n,repetitions)])),netBB:uncertainty(nets),maximumPolicyDecisions:longest});
 }
 return{label:'Synthetic complete legal sequences; scripted prefixes are identified and excluded from conditional first-decision frequencies',repetitions,completedHands:completed,policyDecisions:decisions,rows,examples,computeMs:{legacy:latency(timing['frozen-1.0']),candidate:latency(timing['candidate-1.1'])},heldoutCaveat:'Evaluation subset is operational, not blinded/human. If used to tune this policy, it is consumed and cannot be reused as held-out proof.'};
}

export function exploitBenchmark(repetitions=32){
 const rows=[];const paired=[];const examples=[];const timing:Record<Model,number[]>={'frozen-1.0':[],'candidate-1.1':[]};let completed=0,decisions=0;
 for(const probe of PROBES)for(const [archetypeIndex,archetype]of ARCHETYPES.entries()){
  const outcomes:Record<Model,number[]>={'frozen-1.0':[],'candidate-1.1':[]};
  for(const model of models){
   const actions=counts();let facingSmall=0,foldSmall=0,showdowns=0,facingAllIn=0,continueAllIn=0;const publicHistories:PublicMemoryHand[]=[];
   for(let run=0;run<repetitions;run++){
    const seed=0x4b2000+run;let game=seededGame(2,seed,[20,40,60,100,150,250][run%6]);const p=profile(model,archetype,1001+archetypeIndex);const traces=[];let count=0;
    while(game.street!=='complete'&&count<200){
     if(game.actor===0){
      const memory=buildOpponentMemory(publicHistories,0,p.traits?.memoryRetention??.5);const selected=choose(game,p,seed,memory,run===0);actions[selected.decision.action.type]++;timing[model].push(selected.computeMs);
      const o=selected.trace.observation;if(o.legal.callAmount>0&&o.seats.some(s=>s.id!==o.actingSeat&&!s.folded&&s.allIn)){facingAllIn++;if(selected.decision.action.type!=='fold')continueAllIn++;}if(o.legal.callAmount>0&&o.legal.callAmount<=.25*Math.max(200,o.pot-o.legal.callAmount)){facingSmall++;if(selected.decision.action.type==='fold')foldSmall++;}
      if(run===0)traces.push(selected.trace);game=applyCommand(game,selected.decision);
     }else{
      const o=observeBot(game,1,'independent-probe-v1',`probe:${probe}:${game.handId}:${game.revision}`);const action=probeAction(probe,o);
      game=applyCommand(game,{handId:o.handId,revision:o.revision,seatId:1,decisionId:o.decisionId,action});
     }
     assertAccounting(game);count++;decisions++;
    }
    const record=finishRecord(game);const net=record.players[0].net/200;outcomes[model].push(net);publicHistories.push(publicHand(game));
    if(game.revealedSeats.length>1)showdowns++;completed++;if(run===0)examples.push({model,probe,archetype,seed,traces,record});
   }
   rows.push({model,probe,definition:PROBE_DEFINITIONS[probe],archetype,outcomes:uncertainty(outcomes[model]),rawNetBB:outcomes[model],actions,foldToSmallPrice:rate(foldSmall,facingSmall),continueFacingAllIn:rate(continueAllIn,facingAllIn),showdowns,
    caveat:'True probe identity is never passed to the bot. It may learn only public completed-hand action summaries.'});
  }
  paired.push({probe,archetype,candidateMinusFrozen:uncertainty(outcomes['candidate-1.1'].map((n,i)=>n-outcomes['frozen-1.0'][i]))});
 }
 return{label:'Six fixed synthetic exploit probes, not a proof of unexploitable or human-optimal strategy',repetitions,completedHands:completed,totalLegalDecisions:decisions,definitions:PROBE_DEFINITIONS,rows,paired,examples,computeMs:{legacy:latency(timing['frozen-1.0']),candidate:latency(timing['candidate-1.1'])}};
}

export function ecologyBenchmark(handsPerModel=100){
 const rows=[];const examples=[];let completed=0;
 for(const model of models){
  let multiwayFlops=0,flops=0,limps=0,isolations=0,squeezes=0,folds=0,decisionCount=0;const actionsBySeat=Array(9).fill(0);const netByArchetype=Object.fromEntries(ARCHETYPES.map(a=>[a,0])) as Record<Archetype,number>;const metricTotals=new Map<string,{count:number;opportunities:number}>();const preflopContexts=new Map<string,{decisions:number;fold:number;check:number;call:number;raise:number;raiseToBB:number[];expectedVoluntary:number;expectedRaise:number;dealtClasses:Record<string,number>}>();
  for(let hand=0;hand<handsPerModel;hand++){
   const seed=0x4b3000+hand;let game=seededGame(9,seed,[40,60,100,150,250][hand%5]);const assignment=archetypeAssignment(hand,9);const profiles=game.seats.map((s,i)=>profile(model,ARCHETYPES[assignment[i]],1500+i));
   const audit=new OpportunityAudit(game.seats.map(s=>s.id));let count=0,raises=0,limpers=0,callsAfterRaise=0,flopRecorded=false;
   while(game.street!=='complete'&&count<200){
    const actor=game.actor!,selected=choose(game,profiles[actor],seed,undefined,false);const a=selected.decision.action;audit.record(game,a);actionsBySeat[actor]++;
    if(game.street==='preflop'){
     const node=raises>=3?'facing-4bet':raises===2?'facing-3bet':raises===1?'facing-open':limpers?'limped':'unopened';const key=`${profiles[actor].archetype}:${node}`;const context=preflopContexts.get(key)??{decisions:0,fold:0,check:0,call:0,raise:0,raiseToBB:[],expectedVoluntary:0,expectedRaise:0,dealtClasses:{}};context.decisions++;context[a.type]++;const predicted=analyzeDecision(selected.trace.observation,profiles[actor]).distribution;context.expectedVoluntary+=predicted.call+predicted.raise;context.expectedRaise+=predicted.raise;if(a.type==='raise')context.raiseToBB.push(a.to/200);const ranks='23456789TJQKA';const cards=[...game.seats[actor].hole].sort((x,y)=>ranks.indexOf(y[0])-ranks.indexOf(x[0]));const handClass=cards[0][0]+cards[1][0]+(cards[0][0]===cards[1][0]?'':cards[0][1]===cards[1][1]?'s':'o');context.dealtClasses[handClass]=(context.dealtClasses[handClass]??0)+1;preflopContexts.set(key,context);
     if(a.type==='call'&&raises===0){limpers++;limps++;}
     if(a.type==='call'&&raises>0)callsAfterRaise++;
     if(a.type==='raise'){if(!raises&&limpers)isolations++;if(raises===1&&callsAfterRaise)squeezes++;raises++;callsAfterRaise=0;}
    }
    if(a.type==='fold')folds++;game=applyCommand(game,selected.decision);assertAccounting(game);
    if(!flopRecorded&&game.board.length>=3){flopRecorded=true;flops++;if(game.seats.filter(s=>!s.folded).length>=3)multiwayFlops++;}
    count++;decisionCount++;
   }
   const record=finishRecord(game);for(const player of record.players)netByArchetype[profiles[player.id].archetype]+=player.net/200;
   for(const [seat,metrics]of audit.finish())for(const [key,value]of Object.entries(metrics)){const id=`${profiles[seat].archetype}:${key}`;const prior=metricTotals.get(id)??{count:0,opportunities:0};prior.count+=value.count;prior.opportunities+=value.opportunities;metricTotals.set(id,prior);}
   if(hand<2)examples.push({model,seed,profiles:profiles.map(p=>({archetype:p.archetype,personalityId:p.personalityId,policyVersion:p.policyVersion})),record});completed++;
  }
  rows.push({model,hands:handsPerModel,decisions:decisionCount,actionsBySeat,flops,multiwayFlops,limps,isolations,squeezes,folds,netBBByArchetype:netByArchetype,preflopContexts:Object.fromEntries(preflopContexts),opportunityRates:Object.fromEntries([...metricTotals].map(([key,n])=>[key,rate(n.count,n.opportunities)]))});
 }
 return{label:'Nine-handed ecology: every seat uses a bot, with complete bot-on-bot public actions and conserved chips. Descriptive synthetic data only.',completedHands:completed,rows,examples};
}
