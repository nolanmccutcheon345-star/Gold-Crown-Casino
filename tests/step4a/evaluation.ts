import type { Action, Archetype, BotProfile, GameState } from '../../src/contracts';
import { applyCommand, assertAccounting, legalActions, observeBot } from '../../src/core/engine';
import { ARCHETYPES, analyzeDecision, chooseDecision, createProfile, POLICY_VERSION } from '../../src/bots/policy';
import { archetypeAssignment, scenarios, seededEngineHand, seededRandom } from './scenarios';

type ActionName=Action['type'];
export interface Rate {count:number;opportunities:number;percent:number|null;ci95:[number,number]|null;}
export function rate(count:number,opportunities:number):Rate{
 if(!opportunities)return{count,opportunities,percent:null,ci95:null};
 const p=count/opportunities,z=1.959963984540054,divisor=1+z*z/opportunities;
 const mid=(p+z*z/(2*opportunities))/divisor;
 const half=z*Math.sqrt(p*(1-p)/opportunities+z*z/(4*opportunities*opportunities))/divisor;
 return{count,opportunities,percent:100*p,ci95:[100*Math.max(0,mid-half),100*Math.min(1,mid+half)]};
}
function assert(ok:unknown,why:string):asserts ok{if(!ok)throw new Error(why);}
const counts=()=>({fold:0,check:0,call:0,raise:0});
function profile(archetype:Archetype,seed:number):BotProfile{return createProfile({selection:archetype},seed,'neutral');}
function legal(state:GameState,action:Action):boolean{
 const a=legalActions(state);
 if(action.type==='fold')return a.fold;
 if(action.type==='check')return a.check;
 if(action.type==='call')return a.callAmount>0;
 if(action.type!=='raise')return false;
 return a.canRaise&&Number.isSafeInteger(action.to)&&((action.to>=a.minRaiseTo!&&action.to<=a.maxRaiseTo!)||action.to===a.shortAllInTo);
}
const percentile=(list:number[],p:number)=>list.length?[...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor((list.length-1)*p))]:0;
interface ControlledRow {scenario:string;label:string;notes:string;archetype:Archetype;profile:BotProfile;samples:number;actions:Record<ActionName,number>;rates:Record<ActionName,Rate>;raiseTo:{count:number;min:number;median:number;max:number;unique:number[]}|null;diagnostic:ReturnType<typeof analyzeDecision>;}
export function controlledEvaluation(samples=1000){
 const probes=scenarios();const rows:ControlledRow[]=[];const latencies:number[]=[];
 for(const probe of probes)for(const [archetypeIndex,archetype] of ARCHETYPES.entries()){
  const p=profile(archetype,1001+archetypeIndex);const o=observeBot(probe.state,probe.state.actor!,p.policyVersion,`evaluation:${probe.id}`);o.rake=probe.state.profile.rake;
  const diagnostic=analyzeDecision(o,p);const actions=counts();const raises:number[]=[];
  const before=JSON.stringify({state:probe.state,o,p});
  for(let sample=0;sample<samples;sample++){
   // A fresh paired stream per sample prevents an extra sizing draw in one
   // context from shifting every later action draw in its comparison context.
   const random=seededRandom(0x4ab123^sample);const time=performance.now();const decision=chooseDecision(o,p,random);latencies.push(performance.now()-time);
   assert(legal(probe.state,decision.action),`${probe.id}/${archetype}: illegal sampled action`);actions[decision.action.type]++;
   if(decision.action.type==='raise')raises.push(decision.action.to);
   // Apply each distinct branch through the authority once; every sample is
   // independently range-checked above, avoiding millions of redundant clones.
   if(actions[decision.action.type]===1)assertAccounting(applyCommand(probe.state,decision));
  }
  assert(JSON.stringify({state:probe.state,o,p})===before,`${probe.id}/${archetype}: mutated input`);
  const rates=Object.fromEntries(Object.entries(actions).map(([action,n])=>[action,rate(n,samples)])) as Record<ActionName,Rate>;
  rows.push({scenario:probe.id,label:probe.label,notes:probe.notes,archetype,profile:p,samples,actions,rates,
   raiseTo:raises.length?{count:raises.length,min:Math.min(...raises),median:percentile(raises,.5),max:Math.max(...raises),unique:[...new Set(raises)].sort((a,b)=>a-b)}:null,
   diagnostic});
 }
 const row=(scenario:string,archetype:Archetype)=>rows.find(r=>r.scenario===scenario&&r.archetype===archetype)!;
 const checks=[
  {id:'station-continues-more-than-nit',pass:row('flop-marginal-overbet','station').actions.fold<row('flop-marginal-overbet','nit').actions.fold},
  {id:'maniac-raises-air-more-than-passive',pass:row('heads-up-air','maniac').actions.raise>row('heads-up-air','passive-reg').actions.raise},
  {id:'tag-raises-aa-more-than-station',pass:row('unopened-aa','tag').actions.raise>row('unopened-aa','station').actions.raise},
  {id:'late-unopened-jto-continues-more-than-early-tag',pass:row('button-jto','tag').actions.fold<row('early-jto','tag').actions.fold},
  {id:'expensive-top-pair-does-not-reduce-folding',pass:ARCHETYPES.every(a=>row('flop-marginal-overbet',a).actions.fold>=row('flop-marginal-cheap',a).actions.fold)},
  {id:'live-flush-draw-continues-more-than-dry-acehigh-tag',pass:row('flop-flushdraw','tag').actions.fold<row('flop-dry-acehigh','tag').actions.fold},
  {id:'river-missed-draw-is-not-a-live-draw',pass:ARCHETYPES.every(a=>row('river-missed-flush',a).diagnostic.features.draw===0)},
  {id:'multiway-air-bluffing-below-headsup-tag',pass:row('sixway-air','tag').actions.raise<row('heads-up-air','tag').actions.raise},
  {id:'aa-unopened-not-degenerate-folding',pass:ARCHETYPES.every(a=>row('unopened-aa',a).actions.fold<=samples*.2)},
  {id:'river-nuts-not-degenerate-folding',pass:ARCHETYPES.every(a=>row('river-nuts',a).actions.fold<=samples*.02)},
  {id:'competent-aa-open-raise-floor',pass:(['tag','stronger-reg'] as const).every(a=>row('unopened-aa',a).actions.raise>=samples*.9)},
  {id:'competent-terminal-nuts-value-floor',pass:(['tag','stronger-reg'] as const).every(a=>row('river-nuts',a).actions.raise>=samples*.95)},
  {id:'competent-profitable-forced-draw-continue-floor',pass:(['tag','stronger-reg'] as const).every(a=>row('turn-cheap-forced-flushdraw',a).actions.fold<=samples*.1)},
 ];
 return{label:'Synthetic controlled decisions; not human-validated and not VPIP/PFR',method:'One stable profile per archetype. Matched first action draw for each sample across contexts; raise-size draws cannot shift later comparisons. Wilson intervals describe this Monte Carlo experiment, not human population frequencies.',policyVersion:POLICY_VERSION,seed:0x4ab123,samplesPerContext:samples,contextCount:probes.length,totalDecisions:rows.length*samples,rows,checks,
  decisionComputeMs:{p50:percentile(latencies,.5),p95:percentile(latencies,.95),max:latencies.reduce((a,b)=>Math.max(a,b),0)}};
}

export type Metric='vpip'|'pfr'|'threeBet'|'flopCbet'|'foldToPrice'|'checkRaise';
type Counter={count:number;opportunities:number};
type HandSeat={vpipOpp:boolean;vpip:boolean;pfrOpp:boolean;pfr:boolean;threeBetOpp:boolean;threeBet:boolean;};
const handSeat=():HandSeat=>({vpipOpp:false,vpip:false,pfrOpp:false,pfr:false,threeBetOpp:false,threeBet:false});
export const DEFINITIONS={
 vpip:'Once per hand/player: voluntary preflop call or raise / at least one voluntary preflop decision. Forced blinds and players with no decision are excluded.',
 pfr:'Once per hand/player: preflop raise / at least one legal preflop raise opportunity. Closed raising and all-in calls alone do not create an opportunity.',
 threeBet:'Once per hand/player: raise after exactly one prior preflop raise / at least one decision facing exactly one prior raise with legal raising available.',
 flopCbet:'Once per hand: last preflop aggressor bets flop / last preflop aggressor has a legal unopened flop betting opportunity (zero call price).',
 foldToPrice:'Decision-level: folds / decisions with a strictly positive call amount. Includes preflop blind price and re-raise decisions; it is not a once-per-hand rate.',
 checkRaise:'Once per hand/player/street: raise after checking that street / later decision with positive call price and legal raising after that earlier check.',
};
function emptyMetrics():Record<Metric,Counter>{return Object.fromEntries(Object.keys(DEFINITIONS).map(k=>[k,{count:0,opportunities:0}])) as Record<Metric,Counter>;}
export class OpportunityAudit {
 private flags=new Map<number,HandSeat>();private checked=new Set<string>();private checkRaiseSeen=new Set<string>();private cbetSeen=false;
 private preflopRaises=0;private lastPreflopAggressor:number|null=null;
 readonly seats=new Map<number,Record<Metric,Counter>>();
 constructor(ids:number[]){for(const id of ids){this.flags.set(id,handSeat());this.seats.set(id,emptyMetrics());}}
 record(before:GameState,action:Action){
  const seat=before.actor!;const f=this.flags.get(seat)!;const m=this.seats.get(seat)!;const a=legalActions(before);const key=`${before.street}:${seat}`;
  if(before.street==='preflop'){
   f.vpipOpp=true;if(action.type==='call'||action.type==='raise')f.vpip=true;
   if(a.canRaise)f.pfrOpp=true;if(action.type==='raise')f.pfr=true;
   if(this.preflopRaises===1&&a.canRaise){f.threeBetOpp=true;if(action.type==='raise')f.threeBet=true;}
   if(action.type==='raise'){this.preflopRaises++;this.lastPreflopAggressor=seat;}
  }
  if(before.street==='flop'&&seat===this.lastPreflopAggressor&&!this.cbetSeen&&a.callAmount===0&&a.canRaise){
   this.cbetSeen=true;m.flopCbet.opportunities++;if(action.type==='raise')m.flopCbet.count++;
  }
  if(a.callAmount>0){m.foldToPrice.opportunities++;if(action.type==='fold')m.foldToPrice.count++;}
  if(this.checked.has(key)&&!this.checkRaiseSeen.has(key)&&a.callAmount>0&&a.canRaise){
   this.checkRaiseSeen.add(key);m.checkRaise.opportunities++;if(action.type==='raise')m.checkRaise.count++;
  }
  if(action.type==='check')this.checked.add(key);
 }
 finish(){for(const [seat,f]of this.flags){const m=this.seats.get(seat)!;
  for(const metric of ['vpip','pfr','threeBet'] as const){m[metric].opportunities=Number(f[`${metric}Opp`]);m[metric].count=Number(f[metric]);}
 }return this.seats;}
}

export function completeHandEvaluation(handsPerSeats=400){
 const aggregates=new Map<string,{seats:number;archetype:Archetype;playerHands:number;metrics:Record<Metric,Counter>;actions:Record<ActionName,number>;net:number;allIns:number}>();
 const latencies:number[]=[];const tables=[];let totalHands=0,totalDecisions=0;const warnings:string[]=[];
 let completedExample:Record<string,unknown>|null=null;
 for(const count of [2,6,9,10]){
  let maxDecisions=0,rake=0,sidePotHands=0,showdowns=0,allFoldHands=0;const streetCounts={preflop:0,flop:0,turn:0,river:0};
  for(let hand=0;hand<handsPerSeats;hand++){
   const seed=0x4a0000+count*10000+hand;let game=seededEngineHand(count,seed);const starting=game.seats.reduce((n,s)=>n+s.stack+s.totalCommitted,0);
   const assignment=archetypeAssignment(hand,count);
   const profiles=game.seats.map((seat,i)=>profile(ARCHETYPES[assignment[i]],3000+count*100+seat.id));
   const randoms=game.seats.map((_,i)=>seededRandom(seed^(0x9e3779b9+i*982451653)));const audit=new OpportunityAudit(game.seats.map(s=>s.id));let decisions=0;
   for(const p of profiles){const key=`${count}:${p.archetype}`;if(!aggregates.has(key))aggregates.set(key,{seats:count,archetype:p.archetype,playerHands:0,metrics:emptyMetrics(),actions:counts(),net:0,allIns:0});}
   while(game.street!=='complete'&&decisions<500){
    assertAccounting(game);assert(new Set(game.deck).size===52,'Duplicate sealed card');const actor=game.actor!;const p=profiles[actor];
    const o=observeBot(game,actor,p.policyVersion,`sim:${game.handId}:${game.revision}`);o.rake=game.profile.rake;
    const time=performance.now();const d=chooseDecision(o,p,randoms[actor]);latencies.push(performance.now()-time);
    assert(legal(game,d.action),`Illegal simulation action in ${game.handId}`);audit.record(game,d.action);
    const aggregate=aggregates.get(`${count}:${p.archetype}`)!;aggregate.actions[d.action.type]++;streetCounts[game.street]++;
    const before=game;game=applyCommand(game,d);if(game.seats[actor].allIn&&!before.seats[actor].allIn)aggregate.allIns++;
    decisions++;totalDecisions++;
   }
   assert(game.street==='complete',`${game.handId}: exceeded500 decisions`);assertAccounting(game);
   assert(game.seats.every(s=>s.stack>=0),'Negative final stack');assert(game.seats.reduce((n,s)=>n+s.stack,0)+game.rake===starting,'Independent settlement conservation failed');
   if(!completedExample&&count===6&&game.board.length===5&&game.revealedSeats.length>1){
    const total=(type:string)=>game.events.filter(e=>e.type===type).reduce((n,e)=>n+(e.amount??0),0);
    completedExample={label:'Deterministic synthetic engine example, not a browser hand',handId:game.handId,seed,seats:count,button:game.button,board:game.board,
     players:game.seats.map(s=>({id:s.id,archetype:profiles[s.id].archetype,startingStack:s.startingStack,endingStack:s.stack,revealedCards:game.revealedSeats.includes(s.id)?s.hole:[]})),
     events:game.events,paidCents:total('blind')+total('action'),returnedCents:total('refund'),rakeCents:game.rake,awardedCents:total('award'),pots:game.pots,payouts:game.payouts};
   }
   for(const [seat,metrics]of audit.finish()){
    const aggregate=aggregates.get(`${count}:${profiles[seat].archetype}`)!;aggregate.playerHands++;aggregate.net+=game.seats[seat].stack-game.seats[seat].startingStack;
    for(const metric of Object.keys(DEFINITIONS) as Metric[]){aggregate.metrics[metric].count+=metrics[metric].count;aggregate.metrics[metric].opportunities+=metrics[metric].opportunities;}
   }
   maxDecisions=Math.max(maxDecisions,decisions);rake+=game.rake;if(game.pots.length>1)sidePotHands++;if(game.board.length===5&&game.revealedSeats.length>1)showdowns++;else allFoldHands++;totalHands++;
  }
  tables.push({seats:count,hands:handsPerSeats,maxDecisions,rakeCents:rake,sidePotHands,showdowns,allFoldHands,streetDecisions:streetCounts});
 }
 const rows=[...aggregates.values()].map(row=>({...row,metrics:Object.fromEntries((Object.entries(row.metrics) as [Metric,Counter][]).map(([key,c])=>[key,rate(c.count,c.opportunities)]))}));
 for(const row of rows){const decisionCount=Object.values(row.actions).reduce((n,x)=>n+x,0);if(row.actions.raise===0)warnings.push(`${row.seats}-seat ${row.archetype}: no raises across${decisionCount} decisions`);if(row.actions.fold/decisionCount>.95)warnings.push(`${row.seats}-seat ${row.archetype}: more than95% fold decisions`);}
 return{label:'Independent seeded whole-hand simulation; synthetic opponents, not human validation',method:'Independent deck, button, seat-assignment and per-seat decision streams. Every hand starts a new mixed-stack table. No across-hand opponent memory. Wilson intervals are descriptive; within-hand actors and decisions are correlated. Net results do not estimate real poker skill or validated EV.',policyVersion:POLICY_VERSION,handsPerSeats,totalHands,totalDecisions,definitions:DEFINITIONS,tables,rows,warnings,completedExample,
  decisionComputeMs:{p50:percentile(latencies,.5),p95:percentile(latencies,.95),max:latencies.reduce((a,b)=>Math.max(a,b),0)}};
}
