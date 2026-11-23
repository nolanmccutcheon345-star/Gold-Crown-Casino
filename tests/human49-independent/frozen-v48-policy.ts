/* Frozen saved Version48 policy2.2, relative imports only. */
/** Tournament policy 2.0.0: a designed tournament layer above the frozen synthetic-cash-1.6.0
 * base profile. It is NOT a solver, Nash or ICM model and is not fitted to human data.
 *
 * What it adds over the 1.0.0 short-stack overlay:
 *  - preflop decisions at every stack depth, priced with the big-blind ante's dead money;
 *  - position-based first-in raising, push/fold below each player's own push depth, re-shoves
 *    and price-based big-blind defence;
 *  - calling all-ins against the shover's likely range at any depth;
 *  - flop continuation bets as the preflop raiser.
 * Every archetype keeps its own style: tight, loose, passive and aggressive players widen or
 * narrow the same reference ranges, and weaker players make more noisy choices. Only own
 * cards and public information are read, through the same permitted observation as 1.0.0. */
import type {Action,BotDecision,BotObservation,BotProfile} from '../../src/contracts';
import {chooseDecision} from '../../src/bots/policy';
import {permittedObservation,validate,fingerprint} from '../../src/bots/boundary';
import {completeProfile,clamp,sigmoid,presetTraits} from '../../src/bots/profiles';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition,publicBlindSeats,type StartingClass} from '../../src/bots/preflop';
import {contestablePricing} from '../../src/bots/pricing';

export const TOURNAMENT_POLICY_V2='synthetic-tournament-2.0.0';
/** 2.1.0 = 2.0.0 plus bubble and pay-jump awareness from the event's public standings. */
export const TOURNAMENT_POLICY_V21='synthetic-tournament-2.1.0';
/** 2.2.0 = 2.1.0 plus personal quirks: how far a player's traits sit from their archetype's
 * stock values shifts their push depth, all-in calling, steals, continuation bets and bubble
 * caution. Stock players barely change; the named regulars play their own tournament styles. */
export const TOURNAMENT_POLICY_V22='synthetic-tournament-2.2.0';
/** Trait deviations from the profile's own archetype (zero for a stock profile without jitter). */
function quirks(profile:BotProfile){const p=completeProfile(profile),stock=presetTraits(p.archetype),d=(k:keyof typeof stock)=>p.traits[k]-stock[k];return {risk:d('riskTolerance'),bluff:d('bluffFrequency'),position:d('positionAwareness'),draws:d('drawCalling')};}

/** Public tournament standings a player could see on the lobby screen: how many are left, how
 * many places pay, and every remaining player's chips at the start of the current hand/round. */
export interface TournamentContext {playersLeft:number;paid:number;stacks:number[];}
export function validContext(c:TournamentContext):boolean {
 return Number.isSafeInteger(c.playersLeft)&&c.playersLeft>=1&&Number.isSafeInteger(c.paid)&&c.paid>=1&&Array.isArray(c.stacks)&&c.stacks.length===c.playersLeft&&c.stacks.every(n=>Number.isSafeInteger(n)&&n>=0);
}
/** How much a bust costs in prize terms beyond chips, from 0 (no pay jump ahead) to 1 (the money bubble).
 * Designed heuristic, not an ICM calculation. */
export function bubblePressure(c:TournamentContext):number {
 if(c.playersLeft<=2)return 0;
 if(c.playersLeft<=c.paid)return c.playersLeft<=3?.2:.3;
 return clamp(1-(c.playersLeft-c.paid-1)/(.5*c.paid+2));
}
/** How fully an archetype applies bubble pressure: strong regulars fully, nits a little too much,
 * calling stations and maniacs hardly at all. */
export function bubbleAwareness(profile:BotProfile,personal=false):number {const p=completeProfile(profile),base=.3+.9*p.skill-.6*(p.looseness-.4);return clamp(personal?base*(1-1.3*quirks(p).risk):base,.1,1.4);}
/** Bubble factor for risking `mine` against an opponent with `theirs` (totals in chips). */
export function bubbleFactor(c:TournamentContext,profile:BotProfile,mine:number,theirs:number,bigBlind:number,personal=false):number {
 const pressure=bubblePressure(c);if(pressure===0||mine<=0)return 1;
 const average=c.stacks.reduce((a,b)=>a+b,0)/c.playersLeft,relative=mine/average,depth=mine/bigBlind;
 // Very short stacks cannot wait for others to bust; huge stacks risk little of their position.
 const stack=depth<6?.4:relative>2.5?.5:relative<.35?.7:1;
 const covered=theirs>=mine?1:.3;
 const shorter=c.stacks.filter(n=>n>0&&n<mine).length/Math.max(1,c.playersLeft-1);
 return Math.min(2.5,1+1.2*pressure*stack*covered*(.7+.6*shorter)*bubbleAwareness(profile,personal));
}
const withFactor=(need:number,factor:number)=>factor===1?need:need*factor/(need*factor+1-need);

/* Two hand orders. The short-stack order (all-in play) lifts pairs and aces and discounts
 * speculative hands; the deep order is the base model's playability score. Both are ordinal
 * selection scores expressly not equities. */
const shortScore=(c:Readonly<StartingClass>)=>c.baseScore+(c.pair?12:c.highRank===14?12:0)-c.speculative*(c.highRank===14?0:7);
const deepScore=(c:Readonly<StartingClass>)=>c.baseScore+(c.pair?4:0)+c.speculative*3;
function percentiles(score:(c:Readonly<StartingClass>)=>number):Map<string,number>{
 return new Map(PREFLOP_CLASSES.map(c=>{const s=score(c);return [c.handClass,PREFLOP_CLASSES.reduce((sum,d)=>{const t=score(d);return sum+(t>s?d.comboCount:t===s?d.comboCount/2:0);},0)/1326];}));
}
const SHORT=percentiles(shortScore),DEEP=percentiles(deepScore),CLASS=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));

/** Reference first-in raising fraction for a skilled player with this many players left to act
 * (blinds included). Designed for nine-handed play with a big-blind ante. */
const RFI_BY_BEHIND=[1,.56,.44,.31,.26,.22,.19,.17,.15,.14];
/** Reference open-shove fraction at a given depth with players behind. */
export function shoveFraction(depthBB:number,behind:number):number {return clamp(7.6/(Math.max(1,depthBB)*Math.pow(Math.max(1,behind),.8)),.02,.98);}
/** Likely raising range of a player who opened from a coarse position. */
const OPENER_RANGE:Record<string,number>={UTG:.15,MP:.21,CO:.3,BTN:.44,SB:.5,BB:.3};

interface Style {width:number;callWidth:number;raiseShare:number;noise:number;pushDepth:number;cbet:number;}
/** Each archetype's tournament style from its stored traits. stronger-reg is the reference. */
export function tournamentStyle(profile:BotProfile,personal=false):Style {
 const p=completeProfile(profile),L=p.looseness,A=p.aggression,s=p.skill;
 const style={
  width:clamp(1+(L-.4)*1.25,.55,1.75),
  // Calling stations call far wider than they raise; nits call tighter than they open.
  callWidth:clamp(1+(L-.4)*1.4+(p.traits.drawCalling-.55)*.5,.5,2),
  raiseShare:clamp(A*1.1+s*.35-.05),
  noise:.012+.07*(1-s),
  pushDepth:9+6*s+3*(A-.5),
  cbet:clamp(.18+.42*A+.14*s,.2,.8),
 };
 if(!personal)return style;
 const q=quirks(p);
 return {...style,
  width:clamp(style.width*(1+.6*q.bluff),.5,1.9),
  callWidth:clamp(style.callWidth*(1+1.1*q.risk+.4*q.draws),.45,2.2),
  pushDepth:clamp(style.pushDepth+9*q.risk,6,22),
  cbet:clamp(style.cbet+.6*q.bluff,.15,.9),
 };
}

export interface TournamentV2Analysis {
 version:typeof TOURNAMENT_POLICY_V2;street:string;depthBB:number;effectiveBB:number;node:string;behind:number;
 percentile:number;target:number;bubble:number;continueProbability:number;raiseProbability:number;raiseTo:number|null;label:string;
}

function playersBehind(o:BotObservation):number {
 const ordered=[...o.seats].sort((a,b)=>a.id-b.id),me=ordered.findIndex(s=>s.id===o.actingSeat),big=publicBlindSeats(o).big,bb=ordered.findIndex(s=>s.id===big);
 if(ordered[me].id===big)return 0;
 let n=0;for(let step=1;step<ordered.length;step++){const i=(me+step)%ordered.length,seat=ordered[i];if(!seat.folded&&!seat.allIn)n++;if(i===bb)break;}
 return n;
}
const total=(o:BotObservation,id:number)=>{const s=o.seats.find(x=>x.id===id)!;return s.stack+s.totalCommitted-(s.deadAnte??0);};

/** Preflop analysis: the target fraction of hands that continue, how many of them raise, and to what. */
export function analyzeTournamentV2(observation:BotObservation,profile:BotProfile,context?:TournamentContext,personal=false):TournamentV2Analysis {
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 const style=tournamentStyle(p,personal),bb=o.bigBlind,own=o.seats.find(s=>s.id===o.actingSeat)!;
 const depth=total(o,own.id)/bb,live=o.seats.filter(s=>s.id!==own.id&&!s.folded);
 const effective=Math.min(depth,Math.max(0,...live.map(s=>total(o,s.id)/bb)));
 const handClass=classifyStartingHand(o.ownCards),blend=clamp((effective-14)/26);
 const pct=SHORT.get(handClass)!*(1-blend)+DEEP.get(handClass)!*blend;
 const actions=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop');
 const raises=actions.filter(e=>e.action?.type==='raise'),last=raises.at(-1);
 const limpers=raises.length?0:actions.filter(e=>e.action?.type==='call').length;
 const behind=playersBehind(o),pricing=contestablePricing(o),need=pricing.rakeAdjustedPrice;
 const myTotal=total(o,own.id),factor=(theirs:number)=>context?bubbleFactor(context,p,myTotal,theirs,bb,personal):1;
 let bubble=1;
 const unit=o.chipUnit??1,round=(n:number)=>Math.round(n/unit)*unit;
 const allIn=o.legal.canRaise?o.legal.maxRaiseTo:null;
 const sized=(to:number)=>{if(!o.legal.canRaise)return null;if(o.legal.shortAllInTo!==null)return o.legal.shortAllInTo;const t=clamp(round(to),o.legal.minRaiseTo!,o.legal.maxRaiseTo!);return t>=.4*(own.stack+own.streetCommitted)?o.legal.maxRaiseTo:t;};
 let node:string,target:number,raiseShare:number,raiseTo:number|null;
 if(!raises.length&&o.legal.check){
  // Big blind with a free option: raise limpers for value and isolation, otherwise check.
  node='bb-option';target=clamp(.1*style.width+.05*style.raiseShare);raiseShare=1;
  raiseTo=effective<=style.pushDepth?allIn:sized(o.pot*.6+3.5*bb);
 } else if(!raises.length) {
  node=limpers?'limped':'unopened';
  if(effective<=style.pushDepth){
   // Push/fold: a raise-fold is wasted below a player's own push depth.
   target=shoveFraction(effective,behind)*Math.pow(style.width,.7)*(limpers?.75:1);raiseShare=style.raiseShare>.5||pct<.06?1:.75;raiseTo=allIn;
  } else {
   target=RFI_BY_BEHIND[Math.min(9,behind)]*style.width*(limpers?.6:1)*(effective<20?.9:1)*(personal&&behind<=3&&behind>=1?clamp(1+2*quirks(p).position,.7,1.6):1);
   raiseShare=behind===1?clamp(style.raiseShare*.85+.1):clamp(style.raiseShare+.15);
   const open=(effective<25?2:effective<45?2.2:2.4)+style.raiseShare*.3+(behind===1?.6:0)+limpers*1.2;
   raiseTo=sized(open*bb+(limpers?0:0));
  }
  if(context&&bubblePressure(context)>0){
   const left=o.seats.filter(s=>s.id!==own.id&&!s.folded),biggest=Math.max(0,...left.map(s=>total(o,s.id)));
   const average=context.stacks.reduce((a,b)=>a+b,0)/context.playersLeft,covers=left.filter(s=>total(o,s.id)<=myTotal).length/Math.max(1,left.length);
   if(myTotal>1.5*average&&covers>=.6)bubble=1+.5*bubblePressure(context)*bubbleAwareness(p)*clamp((myTotal/average-1)/2)*(personal?clamp(1+2.5*quirks(p).risk,.3,2):1);
   else if(effective>8)bubble=1/(1+.35*(factor(biggest)-1));
   target*=bubble;
  }
 } else {
  const raiser=o.seats.find(s=>s.id===last!.seatId)!,raiseBB=(last!.action!.type==='raise'?last!.action!.to:0)/bb;
  const raiserDepth=total(o,raiser.id)/bb,raiserAllIn=raiser.allIn||raiseBB>=.85*raiserDepth;
  const coldCallers=actions.slice(actions.lastIndexOf(last!)+1).filter(e=>e.action?.type==='call').length;
  const allInsFaced=o.seats.filter(s=>s.id!==own.id&&s.allIn&&!s.folded).length;
  let range=raises.length>1?.07:OPENER_RANGE[preflopPosition(o,raiser.id)]??.2;
  if(raiserAllIn&&raises.length===1)range=Math.max(range,shoveFraction(raiserDepth,4)*.9);
  else if(raiseBB>3.2&&raises.length===1)range*=raiseBB>5?.55:.75;
  const committing=o.legal.callAmount>=.45*(own.stack+own.streetCommitted)||raiserAllIn;
  if(committing){
   // Facing an all-in (or a call of most of the stack): continue against the shover's range at this price.
   node='facing-all-in';
   bubble=factor(total(o,raiser.id));
   target=range*clamp(2-3.3*withFactor(need,bubble),.12,1.6)*Math.pow(style.callWidth,.8)*Math.pow(.6,Math.max(0,allInsFaced-1))*Math.pow(.8,coldCallers);
   raiseShare=1;raiseTo=allIn;
  } else if(effective<=Math.max(style.pushDepth,22)&&raises.length===1) {
   // Re-shove or fold over a single raise; the big blind may also call with the ante's price.
   node='facing-open-short';
   bubble=factor(total(o,raiser.id));const priced=withFactor(need,1+(bubble-1)*.6);
   const reshove=range*clamp(.8-1.1*priced,.18,.6)*Math.pow(style.width,.6)*Math.pow(.75,coldCallers);
   const flat=preflopPosition(o)==='BB'&&effective>12?range*clamp(2.2-5*priced,0,1.3)*style.callWidth*Math.pow(.8,coldCallers):0;
   target=reshove+flat;raiseShare=target>0?reshove/target:1;raiseTo=allIn;
  } else {
   node=raises.length===1?'facing-open':'facing-3bet';
   const inBB=preflopPosition(o)==='BB';bubble=factor(total(o,raiser.id));
   target=range*clamp(2.6-6*withFactor(need,1+(bubble-1)*.5),.15,1.6)*style.callWidth*(inBB?1.12:1)*Math.pow(.8,coldCallers)*(raises.length>1?.7:1);
   raiseShare=clamp((.08+.2*style.raiseShare)*(raises.length>1?.6:1)+(coldCallers?.04:0));
   const facing=(last!.action!.type==='raise'?last!.action!.to:0);
   raiseTo=raises.length>1?(effective<=45?allIn:sized(facing*2.3)):effective<=25?allIn:sized(facing*(inBB||preflopPosition(o)==='SB'?3.6:3)+coldCallers*facing);
  }
 }
 target=clamp(target,0,.98);
 const premium=CLASS.get(handClass)!.pair&&CLASS.get(handClass)!.highRank>=12||handClass==='AKs';
 const continueProbability=premium?1:sigmoid((target-pct)/style.noise);
 // The best hands in the continuing range raise; the rest raise at the player's own rate.
 const valueRaise=pct<target*.35;
 const raiseProbability=raiseTo===null?0:valueRaise?Math.max(raiseShare,.85):raiseShare;
 return {version:TOURNAMENT_POLICY_V2,street:'preflop',depthBB:depth,effectiveBB:effective,node,behind,percentile:pct,target,bubble,continueProbability,raiseProbability,raiseTo,label:'Designed tournament reference ranges; no solver or ICM validation'};
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
function legalize(o:BotObservation,action:Action):Action {
 if(action.type==='raise'&&!o.legal.canRaise)return o.legal.check?{type:'check'}:{type:'call'};
 if(action.type==='call'&&o.legal.check)return {type:'check'};
 if(action.type==='fold'&&o.legal.check)return {type:'check'};
 return action;
}

/** Flop continuation bet as the last preflop raiser, when the base model would check. */
function continuationBet(o:BotObservation,p:BotProfile,base:Action,random:()=>number,personal=false):Action {
 if(o.street!=='flop'||base.type!=='check'||!o.legal.check||!o.legal.canRaise)return base;
 const lastRaise=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise').at(-1);
 if(lastRaise?.seatId!==o.actingSeat)return base;
 if(o.publicEvents.some(e=>e.type==='action'&&e.street==='flop'&&e.action?.type==='raise'))return base;
 const opponents=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded&&!s.allIn).length;if(opponents<1||opponents>2)return base;
 const style=tournamentStyle(p,personal),chance=clamp((style.cbet-.2)/.8)*(opponents===2?.55:1);
 if(draw(random)>=chance)return base;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,unit=o.chipUnit??1,size=Math.round(o.pot*(.33+.17*style.raiseShare)/unit)*unit;
 const to=clamp(own.streetCommitted+size,o.legal.minRaiseTo!,o.legal.maxRaiseTo!);
 return {type:'raise',to:o.legal.shortAllInTo??to};
}

export function chooseTournamentV2(observation:BotObservation,profile:BotProfile,random:()=>number,context?:TournamentContext,personal=false):BotDecision {
 if(context!==undefined&&!validContext(context))throw Error('Invalid tournament standings for a bot decision.');
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 let action:Action;
 if(o.street==='preflop'){
  const a=analyzeTournamentV2(o,p,context,personal),go=draw(random)<a.continueProbability;
  if(go&&a.raiseTo!==null&&draw(random)<a.raiseProbability)action={type:'raise',to:a.raiseTo};
  else if(go)action={type:'call'};
  else action={type:'fold'};
 } else {
  const base=chooseDecision(o,p,random).action;
  action=continuationBet(o,p,base,random,personal);
 }
 return {handId:o.handId,revision:o.revision,seatId:o.actingSeat,decisionId:o.decisionId,policyVersion:p.policyVersion,observationHash:context?`${personal?TOURNAMENT_POLICY_V22:TOURNAMENT_POLICY_V21}:${fingerprint(o,p)}:${context.playersLeft}/${context.paid}/${[...context.stacks].sort((a,b)=>a-b).join(",")}`:`${TOURNAMENT_POLICY_V2}:${fingerprint(o,p)}`,action:legalize(o,action)};
}
