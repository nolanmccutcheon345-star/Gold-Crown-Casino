import type {BotObservation,BotProfile} from '../../contracts';
import {permittedObservation,validate} from './boundary';
import {completeProfile,clamp,sigmoid,POLICY_VERSION} from './profiles';
import {handFeatures,decisionContext,runoutFeatures,type HandFeatures,type DecisionContext,type RunoutFeatures} from './features';
import {analyzePreflop} from './preflop';
import {analyzeRanges} from './ranges';
import {contestablePricing} from './pricing';
import type {PreflopAnalysis,RangeAnalysis} from './range-contract';
export interface PolicyDistribution{fold:number;check:number;call:number;raise:number;}
export interface PostflopReasoning {
 modelVersion:string; showdownEquity:number; perceivedEquity:number; realization:number; realizedEquity:number;
 potOdds:number; rakeAdjustedPrice:number; futureCost:number; impliedOdds:number; reverseImpliedOdds:number;
 rangeWeight:number; modelUncertainty:number; textureCaution:number; foldEquity:number; drawContinue:number; futureBettingClosed:boolean;
 continuationBet:boolean; barrel:boolean; runout:RunoutFeatures; mistakeAdjustment:number;
 contestableAfterCall?:number;excludedChips?:number;estimatedRake?:number;
 /** Exact, deliberately narrow HU river proof; null outside a forced shared-board showdown. */
 guaranteedChopCallEV?:number|null;
}
export interface DecisionAnalysis {
 version:string;label:string;features:HandFeatures;context:DecisionContext;distribution:PolicyDistribution;
 families:{value:number;bluff:number;semiBluff:number;trap:number;checkRaise:number;delayedCbet:number;cbet?:number;barrel?:number;protection?:number;thinValue?:number};
 sizing:{label:string;raiseTo:number;weight:number}[];memoryAdjustment:{call:number;bluff:number};
 preflop?:PreflopAnalysis;ranges?:RangeAnalysis;postflop?:PostflopReasoning;
}
type Profile=ReturnType<typeof completeProfile>;
function memoryAdjustment(o:BotObservation,p:Profile,lastAggressor:number|null):{call:number;bluff:number}{
 const opponents=o.memory?.opponents.filter(m=>o.seats.some(s=>s.id===m.seatId&&!s.folded)&&m.seatId!==o.actingSeat)??[];
 if(!opponents.length)return {call:0,bluff:0};
 const relevant=lastAggressor!==null?opponents.filter(m=>m.seatId===lastAggressor):opponents;
 let call=0,bluff=0;
 for(const m of relevant){const n=m.aggression.opportunities,conf=n/(n+24);call+=(n?m.aggression.count/n-.35:0)*conf;}
 for(const m of opponents){const n=m.foldToBet.opportunities,conf=n/(n+24);bluff+=(n?m.foldToBet.count/n-.45:0)*conf;}
 return {call:clamp(call/Math.max(1,relevant.length)*p.traits.adaptation*p.skill*.2,-.07,.07),bluff:clamp(bluff/opponents.length*p.traits.adaptation*p.skill*.3,-.1,.1)};
}
function postflopSizing(o:BotObservation,p:Profile,f:HandFeatures,c:DecisionContext,r:RangeAnalysis,equity:number):DecisionAnalysis['sizing'] {
 if(!o.legal.canRaise)return [];
 if(o.legal.shortAllInTo!==null)return [{label:'Short all-in',raiseTo:o.legal.shortAllInTo,weight:1}];
 const own=o.seats.find(s=>s.id===o.actingSeat)!,base=own.streetCommitted+o.legal.callAmount,min=o.legal.minRaiseTo!,max=o.legal.maxRaiseTo!;
 const candidates:DecisionAnalysis['sizing']=[];
 const add=(label:string,to:number,weight:number)=>{const raiseTo=clamp(Math.round(to),min,max),prior=candidates.find(x=>x.raiseTo===raiseTo);if(prior)prior.weight+=weight;else candidates.push({label:raiseTo===max?'All-in':label,raiseTo,weight});};
 const terminal=o.street==='river',polarized=terminal&&(equity>.78||equity<.3);
 const thin=f.made&&equity>=.5&&equity<.72;
 // Value and bluffs share overlapping sizes. Range/nut edge changes the distribution,
 // never encodes a deterministic hand-strength tell or a claimed optimal sizing.
 const target=thin?.32+p.traits.sizingAggression*.32:.4+p.traits.sizingAggression*.65+f.wetness*.18+(polarized?.2+Math.max(0,r.nutAdvantage)*.35:0);
 const noise=p.traits.mistakeRate*(1-p.skill*.65);
 for(const fraction of [.25,1/3,.5,.75,1,1.5,2,3]){
  let weight=Math.exp(-Math.abs(fraction-target)*(3-noise*1.5));
  if(fraction>=1.5)weight*=polarized?(.25+.55*p.traits.sizingAggression+Math.max(0,r.nutAdvantage)*.5):.025+p.traits.sizingAggression*.1;
  if(c.activePlayers>2&&fraction>=1.5&&!f.absoluteNuts)weight*=.45;
  add(`${Math.round(fraction*100)}% pot`,base+(o.pot+o.legal.callAmount)*fraction,weight);
 }
 if(c.spr<1.7&&(equity>.62||f.draw>.3&&p.traits.riskTolerance>.65))add('All-in',max,.2+equity*.45+p.traits.riskTolerance*.2);
 const total=candidates.reduce((sum,x)=>sum+x.weight,0);return candidates.map(x=>({...x,weight:x.weight/total}));
}
function lineContext(o:BotObservation,c:DecisionContext):{continuationBet:boolean;barrel:boolean} {
 const actions=o.publicEvents.filter(e=>e.type==='action');
 const previousStreet=o.street==='river'?'turn':o.street==='turn'?'flop':null;
 const previousRaise=actions.filter(e=>e.street===previousStreet&&e.action?.type==='raise').at(-1);
 return {continuationBet:o.street==='flop'&&c.ownPreflopAggressor&&c.raisesThisStreet===0&&o.legal.callAmount===0,
  barrel:previousStreet!==null&&previousRaise?.seatId===o.actingSeat&&c.raisesThisStreet===0&&o.legal.callAmount===0};
}
export function analyzeDecision(observation:BotObservation,profile:BotProfile):DecisionAnalysis {
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 const t=p.traits,f=handFeatures(o.ownCards,o.board),c=decisionContext(o),memory=memoryAdjustment(o,p,c.lastAggressor);
 if(o.street==='preflop'){
  const preflop=analyzePreflop(o,p);
  return {version:POLICY_VERSION,label:'SYNTHETIC / NOT HUMAN-VALIDATED',features:f,context:c,distribution:preflop.distribution,
   families:{value:Number(preflop.diagnostics.premiumValue??0),bluff:0,semiBluff:0,trap:Number(preflop.diagnostics.trapProbability??0),checkRaise:0,delayedCbet:0},sizing:preflop.sizing,memoryAdjustment:memory,preflop};
 }
 const ranges=analyzeRanges(o,p),call=o.legal.callAmount,own=o.seats.find(s=>s.id===o.actingSeat)!;
 const multi=Math.max(0,c.activePlayers-2),terminal=o.street==='river',runout=runoutFeatures(o.ownCards,o.board),line=lineContext(o,c);
 const futureClosed=terminal||call>=own.stack||o.seats.filter(s=>!s.folded&&s.id!==o.actingSeat).every(s=>s.allIn);
 // Range equity is showdown share, not payout or decision EV. Position, reverse
 // implied odds, future payments and uncertain public priors are explicit here.
 const sampleSupport=clamp(ranges.equitySamples/48),samplePrecision=clamp(1-ranges.equityStdError*2,.2,1);
 // A bounded sampler's zero-trial fallback is not evidence. Sparse/noisy trial
 // estimates receive less weight; epistemic uncertainty remains separately visible.
 const rangeWeight=clamp((.42+.53*p.skill-ranges.uncertainty*.08)*sampleSupport*samplePrecision,0,.95);
 const localEquity=clamp((f.strength-.14+f.draw*.38)/(1+multi*.23));
 const mistakeScale=t.mistakeRate*(1-p.skill*.8);
 const attachment=f.made&&!f.absoluteNuts?Math.max(0,p.looseness-.35)*(.05+mistakeScale*.17):0;
 const missedFit=p.archetype==='fit-or-fold'&&!f.made&&f.draw<.12?.08:0;
 const perceivedEquity=clamp(ranges.equity*rangeWeight+localEquity*(1-rangeWeight)+attachment-missedFit);
 const realization=futureClosed?1:clamp(.9+(c.inPosition?.07:-.06)+p.skill*.045+(f.nutDraw?.055:0)-multi*.035*t.multiwayCaution-f.vulnerability*.055,.55,1);
 const streetsRemaining=o.street==='flop'?2:o.street==='turn'?1:0;
 const futureCost=futureClosed?0:streetsRemaining*.018*Math.min(1,c.spr/4)*(c.inPosition?.55:1.2)*(f.draw>0?1:.55)*(1-p.skill*.35);
 const impliedOdds=futureClosed||f.draw===0?0:Math.min(.065,f.draw*(f.nutDraw?.16:.07)*(1-Math.exp(-c.spr/7))*(c.inPosition?1:.7));
 const reverseImpliedOdds=futureClosed?0:(f.vulnerability*.035+(f.draw>0&&!f.nutDraw?f.wetness*.025:0))*Math.min(1,c.spr/5)*(1+multi*.2);
 const realizedEquity=clamp(perceivedEquity*realization+impliedOdds-futureCost-reverseImpliedOdds);
 const pricing=contestablePricing(o),rakeAdjustedPrice=pricing.rakeAdjustedPrice;
 const fourSuitBoard=[...'cdhs'].some(suit=>o.board.filter(card=>card[1]===suit).length>=4);
 // A low private flush / board-only made hand is a bluff-catcher on a hostile
 // board, especially when the public betting sample leaves a broad prior.
 // Smooth price sensitivity preserves cheap calls without treating hand class
 // alone as a license to pay every overbet. Exact nuts bypass this caution.
 const textureCaution=!f.absoluteNuts&&(fourSuitBoard||f.playsBoard)?Math.max(0,.82-f.strength)*c.betToPot/(1+c.betToPot)*(.6+.4*ranges.uncertainty):0;
 const threat=textureCaution+Math.min(.15,Math.max(0,c.betToPot-.6)*t.sizeSensitivity*.035)+Math.max(0,c.raisesThisStreet-1)*.025*p.skill;
 const riskPremium=.008+(1-t.riskTolerance)*.025+multi*t.multiwayCaution*.012+threat;
 const curiosity=terminal&&f.made&&!f.playsBoard?t.riverCuriosity*.055+memory.call:memory.call*.4;
 const clarity=15+p.skill*7-Math.min(4,ranges.equityStdError*20);
 let continueChance=clamp(sigmoid((realizedEquity-rakeAdjustedPrice-riskPremium+curiosity)*clarity),.005,.998);
 let drawContinue=0;
 if(!terminal&&f.draw>0){
  const remaining=52-o.ownCards.length-o.board.length,clean=f.cleanOuts*(1-Math.min(.35,multi*.055*t.multiwayCaution));
  const oneCard=clean/remaining,twoCard=1-(1-oneCard)*(1-clean/(remaining-1));
  const secondCardRealization=futureClosed?1:clamp(.16+(c.inPosition?.16:0)+(f.nutDraw?.12:0)+Math.min(.12,c.spr*.015)-multi*.025,0,.6);
  const drawProxy=o.street==='flop'?oneCard+(twoCard-oneCard)*secondCardRealization:oneCard;
  drawContinue=sigmoid((drawProxy-rakeAdjustedPrice)*22+(t.drawCalling-.5)*2+p.skill*.75);
  // Deliberate chasing remains price/outs dependent, never automatic draw calls.
  continueChance=Math.max(continueChance,drawContinue);
 }
 const equity=clamp(ranges.equity*rangeWeight+localEquity*(1-rangeWeight));
 const air=1-sigmoid((equity-.44)*12),valueThreshold=.59+t.valueThreshold*.15+(call>0?.045:0)+multi*.035;
 const value=sigmoid((equity-valueThreshold)*14)*(f.made?1:.15);
 const foldEquity=clamp(ranges.foldEquity+memory.bluff);
 const pressureDenominator=1+multi*(.65+t.multiwayCaution);
 const blockerSelection=.7+f.blockerStrength*(.45+.35*p.skill);
 const missedSelection=terminal&&runout.missedDraw?.7+f.blockerStrength*.45:1;
 const bluff=clamp(t.bluffFrequency*p.aggression*(.08+foldEquity*.3)*air*blockerSelection*missedSelection/pressureDenominator*(call>0?.65:1),0,.4);
 const semiBluff=!terminal?f.draw*p.aggression*(.16+t.riskTolerance*.32)*(.5+foldEquity)/pressureDenominator:0;
 const thinValue=f.made&&!f.playsBoard&&equity>.5&&equity<.8?sigmoid((equity-.58)*15)*p.skill*.13*(call>0?.35:1):0;
 const protection=!terminal&&f.made&&equity>.45?f.vulnerability*(.08+.12*p.aggression)/(1+multi*.5):0;
 const trap=call===0?value*t.slowPlay*(1-f.wetness*.8)*.5*(c.spr>2?1:.35):0;
 const checkRaise=c.checkedEarlier&&call>0?(value*.2+semiBluff*.35+bluff*.45)*p.aggression:0;
 const advantage=clamp(.5+ranges.rangeAdvantage*.5);
 const cbet=line.continuationBet?(value*.055+air*.12*advantage*(1-f.wetness*.45))*p.aggression/pressureDenominator:0;
 const delayedCbet=c.delayedCbetOpportunity&&call===0?(value*.08+air*foldEquity*.08)*p.aggression/pressureDenominator:0;
 const scare=Number(runout.flushCompletion||runout.straightCompletion||runout.overcardArrival);
 const barrel=line.barrel?(value*.09+air*.11*(advantage*.45+scare*p.skill*.3+f.blockerStrength*.25)*foldEquity)*p.aggression/pressureDenominator:0;
 let raising=value*(.22+p.aggression*.67)+bluff+semiBluff+checkRaise+delayedCbet+cbet+barrel+thinValue+protection-trap;
 if(c.raisesThisStreet>1)raising*=.55+equity*.4;
 if(c.spr<1.3&&f.made&&equity>.55)raising+=.1*t.riskTolerance;
 // Errors retain context: weak pairs overattach, aggressive personalities
 // overpressure, and passive players miss thin value; no uniform random action.
 const mistakeAdjustment=mistakeScale*((f.made&&equity<.7?p.looseness*.035:0)-(p.archetype==='nit'&&equity<.55?.025:0));
 continueChance=clamp(continueChance+mistakeAdjustment,.005,.998);
 raising=clamp(raising+mistakeScale*(p.aggression-.5)*(.035+f.draw*.04),.005,.97);
 // An unbeatable BOARD is a guaranteed chop, not a guaranteed profit. In a
 // heads-up river all-in there is no remaining raise/fold-equity alternative:
 // both matched contributions share one pot, including the button's odd-cent
 // rule. Do not force a losing call when rake exceeds the caller's dead money.
 // Restrict the proof to two original seats; multiway tiers need separate
 // eligibility accounting and must not be approximated by dividing the pot.
 let guaranteedChopCallEV:number|null=null;
 if(terminal&&f.absoluteNuts&&f.playsBoard&&o.seats.length===2&&c.activePlayers===2&&call>0&&!o.legal.canRaise){
  const net=Math.max(0,pricing.contestableAfterCall-pricing.estimatedRake);
  const share=Math.floor(net/2)+(net%2!==0&&o.actingSeat!==o.button?1:0);
  guaranteedChopCallEV=share-call;
 }
 if(f.absoluteNuts)continueChance=guaranteedChopCallEV!==null&&guaranteedChopCallEV<0?0:1;
 if(terminal&&f.absoluteNuts&&!f.playsBoard&&o.legal.canRaise)raising=1;
 if(!o.legal.canRaise)raising=0;
 let distribution:PolicyDistribution;
 if(call===0)distribution={fold:0,check:1-raising,call:0,raise:raising};
 else{const fold=o.legal.fold?1-continueChance:0,remaining=1-fold;distribution={fold,check:0,call:remaining*(1-raising),raise:remaining*raising};}
 return {version:POLICY_VERSION,label:'SYNTHETIC / NOT HUMAN-VALIDATED',features:f,context:c,distribution,
  families:{value,bluff,semiBluff,trap,checkRaise,delayedCbet,cbet,barrel,protection,thinValue},sizing:postflopSizing(o,p,f,c,ranges,equity),memoryAdjustment:memory,ranges,
  postflop:{modelVersion:'public-range-postflop-1.3.0',showdownEquity:ranges.equity,perceivedEquity,realization,realizedEquity,potOdds:c.price,rakeAdjustedPrice,futureCost,impliedOdds,reverseImpliedOdds,rangeWeight,modelUncertainty:ranges.uncertainty,textureCaution,foldEquity,drawContinue,futureBettingClosed:futureClosed,continuationBet:line.continuationBet,barrel:line.barrel,runout,mistakeAdjustment,contestableAfterCall:pricing.contestableAfterCall,excludedChips:pricing.excludedChips,estimatedRake:pricing.estimatedRake,guaranteedChopCallEV}};
}
