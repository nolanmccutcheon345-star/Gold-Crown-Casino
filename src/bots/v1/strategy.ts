import type {BotObservation,BotProfile} from '../../contracts';
import {permittedObservation,validate} from './boundary';
import {completeProfile,clamp,sigmoid,POLICY_VERSION} from './profiles';
import {handFeatures,decisionContext,type HandFeatures,type DecisionContext} from './features';
export interface PolicyDistribution{fold:number;check:number;call:number;raise:number;}
export interface DecisionAnalysis{version:string;label:string;features:HandFeatures;context:DecisionContext;distribution:PolicyDistribution;families:{value:number;bluff:number;semiBluff:number;trap:number;checkRaise:number;delayedCbet:number};sizing:{label:string;raiseTo:number;weight:number}[];memoryAdjustment:{call:number;bluff:number};}
function memoryAdjustment(o:BotObservation,p:ReturnType<typeof completeProfile>,lastAggressor:number|null):{call:number;bluff:number}{
 const opponents=o.memory?.opponents.filter(m=>o.seats.some(s=>s.id===m.seatId&&!s.folded)&&m.seatId!==o.actingSeat)??[];
 if(!opponents.length)return {call:0,bluff:0};
 const relevant=lastAggressor!==null?opponents.filter(m=>m.seatId===lastAggressor):opponents;
 let call=0,bluff=0;
 for(const m of relevant){const n=m.aggression.opportunities,conf=n/(n+24);call+=(n?m.aggression.count/n-.35:0)*conf;}
 for(const m of opponents){const n=m.foldToBet.opportunities,conf=n/(n+24);bluff+=(n?m.foldToBet.count/n-.45:0)*conf;}
 return {call:clamp(call/Math.max(1,relevant.length)*p.traits.adaptation*p.skill*.2,-.07,.07),bluff:clamp(bluff/opponents.length*p.traits.adaptation*p.skill*.3,-.1,.1)};
}
function sizing(o:BotObservation,p:ReturnType<typeof completeProfile>,f:HandFeatures,c:DecisionContext):DecisionAnalysis['sizing']{
 if(!o.legal.canRaise)return [];
 if(o.legal.shortAllInTo!==null)return [{label:'Short all-in',raiseTo:o.legal.shortAllInTo,weight:1}];
 const own=o.seats.find(s=>s.id===o.actingSeat)!,base=own.streetCommitted+o.legal.callAmount,min=o.legal.minRaiseTo!,max=o.legal.maxRaiseTo!;
 const candidates:{label:string;raiseTo:number;weight:number}[]=[];
 const add=(label:string,to:number,weight:number)=>{const raiseTo=clamp(Math.round(to),min,max);const prior=candidates.find(x=>x.raiseTo===raiseTo);if(prior)prior.weight+=weight;else candidates.push({label:raiseTo===max?'All-in':label,raiseTo,weight});};
 if(o.street==='preflop'){
  if(c.preflopNode==='unopened'||c.preflopNode==='limped'){
   const isolation=c.limpers*(.7+p.traits.sizingAggression*.6),offset=p.environment==='low'?.4:p.environment==='high'?-.15:0;
   for(const [bb,w] of [[2.2,.25],[2.7,.45],[3.5,.3]])add(c.limpers?'Isolation raise':'Open raise',(bb+isolation+offset)*o.bigBlind,w*(bb>3?.6+p.traits.sizingAggression:1));
  }else{
   const multiple=c.preflopNode==='facing-open'?(c.inPosition?2.7:3.25):2.2;
   for(const [delta,w] of [[-.3,.25],[0,.5],[.6,.25]])add(c.squeeze?'Squeeze':c.preflopNode==='facing-open'?'3-bet':'4-bet+',base*(multiple+delta)+c.limpers*.25*o.bigBlind,w);
  }
 }else{
  const polarized=o.street==='river'&&(f.strength>.8||f.strength<.35),target=.4+p.traits.sizingAggression*.65+(f.wetness>.55?.15:0)+(polarized?.35:0);
  for(const fraction of [.25,1/3,.5,.75,1,1.5,2,3]){
   let weight=Math.exp(-Math.abs(fraction-target)*2.7);
   if(fraction>=1.5)weight*=polarized?.35+p.traits.sizingAggression*.65:.04+p.traits.sizingAggression*.12;
   add(`${Math.round(fraction*100)}% pot`,base+(o.pot+o.legal.callAmount)*fraction,weight);
  }
 }
 if(c.spr<1.7&&(f.strength>.66||p.traits.riskTolerance>.8))add('All-in',max,.35+p.traits.riskTolerance*.4);
 const total=candidates.reduce((sum,x)=>sum+x.weight,0);return candidates.map(x=>({...x,weight:x.weight/total}));
}
export function analyzeDecision(observation:BotObservation,profile:BotProfile):DecisionAnalysis{
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 const t=p.traits,f=handFeatures(o.ownCards,o.board),c=decisionContext(o),pre=o.street==='preflop',call=o.legal.callAmount;
 const multi=Math.max(0,c.activePlayers-2),memory=memoryAdjustment(o,p,c.lastAggressor);
 const awareness=t.positionAwareness*(.4+.6*p.skill),position=c.position==='late'?.085*awareness:c.position==='early'?-.07*awareness:c.position==='blinds'?-.025*awareness:0;
 const environment=p.environment==='low'?-.022:p.environment==='high'?.018:0;
 const rakeCost=(o.rake?.cap??0)>0?(o.rake?.basisPoints??0)/10000:0;
 const callBB=call/o.bigBlind;
 const pricePenalty=pre?Math.max(0,callBB-1)/(callBB+2)*(.18+t.sizeSensitivity*.28)+c.price*.1:c.price*(.3+t.sizeSensitivity*.55)+Math.min(3,c.betToPot)*.035*t.sizeSensitivity;
 const shallow=c.effectiveStackBB<20,deep=c.effectiveStackBB>150;
 const drawValue=f.draw*t.drawCalling*(o.street==='flop'?.9:.56)*(1+(deep?.16:0))*(1-f.wetness*t.multiwayCaution*.12)+(f.nutDraw?.025*t.drawCalling:0);
 const raisesPenalty=c.preflopNode==='facing-4bet'?.29:c.preflopNode==='facing-3bet'?.18:c.preflopNode==='facing-open'?.07:0;
 const fitPenalty=p.archetype==='fit-or-fold'&&!pre&&!f.made&&f.draw<.2?.23:0;
 const speculative=pre&&(f.handClass==='suited-connector'||f.handClass==='pocket-pair'&&f.pairRank<10);
 const strength=f.strength+(pre?position:0)+drawValue-(pre?raisesPenalty*(.7+.3*p.skill):f.vulnerability*t.riskTolerance*.025)+(speculative&&deep?.035:0)-(speculative&&shallow?.045:0);
 const behindPressure=pre?Math.max(0,c.playersBehind-1)*t.positionAwareness*(.006+.005*p.skill):0;
 const ownStack=o.seats.find(s=>s.id===o.actingSeat)!.stack;
 const stackPressure=call/Math.max(1,ownStack)*(1-t.riskTolerance)*.12;
 const threshold=behindPressure+stackPressure+(pre?.37:.24)-(p.looseness-.4)*.34+pricePenalty+multi*.025*t.multiwayCaution+fitPenalty+environment+rakeCost*.3;
 const riverCatch=o.street==='river'&&f.made&&f.strength<.75?t.riverCuriosity*.065+memory.call:0;
 let continueChance=clamp(sigmoid((strength-threshold+riverCatch)*9),.008,.997);
 if(!pre&&o.street!=='river'&&f.draw>0){
  const futureClosed=call>=ownStack||o.seats.filter(s=>!s.folded&&s.id!==o.actingSeat).every(s=>s.allIn);
  const remaining=52-o.ownCards.length-o.board.length;
  const clean=f.cleanOuts*(1-Math.min(.35,multi*.055*t.multiwayCaution));
  const oneCard=clean/remaining;
  const twoCard=1-(1-oneCard)*(1-clean/(remaining-1));
  const realization=futureClosed?1:clamp(.16+(c.inPosition?.16:0)+(f.nutDraw?.12:0)+Math.min(.12,c.spr*.015)-multi*.025,0,.6);
  const drawProxy=o.street==='flop'?oneCard+(twoCard-oneCard)*realization:oneCard;
  const drawContinue=sigmoid((drawProxy-c.price)*22+(t.drawCalling-.5)*2+p.skill*.75);
  continueChance=Math.max(continueChance,drawContinue);
 }
 const value=sigmoid((f.strength-(.49+t.valueThreshold*.27)+drawValue*.18)*11);
 const air=1-sigmoid((f.strength-.46)*11);
 const rangeAdvantage=(c.ownPreflopAggressor&&(f.wetness<.5||o.board.some(card=>card[0]==='A'||card[0]==='K'))?.04:0)*p.skill;
 const blockerBluff=f.blockerStrength*t.bluffFrequency*p.aggression*.065*air/(1+multi*t.multiwayCaution);
 const bluff=clamp(t.bluffFrequency*p.aggression*(pre?.21:.19)*air/(1+multi*t.multiwayCaution*1.5)+memory.bluff*air+rangeAdvantage*air+blockerBluff,0,.38);
 const semiBluff=!pre&&o.street!=='river'?f.draw*p.aggression*(.25+t.riskTolerance*.35)/(1+multi*t.multiwayCaution*.7):0;
 const trap=!pre&&call===0?value*t.slowPlay*(1-f.wetness*.7)*.5:0;
 const checkRaise=c.checkedEarlier&&call>0?(value*.13+semiBluff*.4)*p.aggression:0;
 const delayedCbet=c.delayedCbetOpportunity&&call===0?(value*.08+bluff*.5)*p.aggression:0;
 let raising=value*(.22+p.aggression*.67)+bluff+semiBluff+checkRaise+delayedCbet-trap;
 if(pre){
  if(c.preflopNode==='unopened'){
   // Competent aggressive styles enter unopened pots primarily by raising; passive profiles retain limps.
   const openingPreference=sigmoid((p.aggression+p.skill*.65-.55)*8);
   raising=Math.max(raising,openingPreference)+position*p.aggression*.5;
  }
  if(c.preflopNode==='limped')raising+=p.aggression*(.05+c.limpers*.015)*Math.max(0,f.strength-.4);
  if(c.squeeze)raising+=p.aggression*t.bluffFrequency*.07/(1+multi*.2);
  if(c.preflopNode==='facing-3bet'||c.preflopNode==='facing-4bet')raising*=.6+f.strength*.4;
 }else if(c.raisesThisStreet>1)raising*=.65+f.strength*.25;
 if(c.spr<1.3&&f.made&&f.strength>.55)raising+=.1*t.riskTolerance;
 raising=clamp(raising,.006,.965);
 // Stable, bounded mistakes: no psychic card reads or personality re-sampling.
 const mistakes=t.mistakeRate*(1-p.skill*.8)*.18;
 continueChance=clamp(continueChance*(1-mistakes)+(.3+p.looseness*.5)*mistakes,.005,.998);
 raising=clamp(raising*(1-mistakes)+(.08+p.aggression*.4)*mistakes,.005,.97);
 // Fundamental strategy safeguards outrank noisy style: never fold pocket aces preflop or an unbeatable river hand.
 if(pre&&f.pairRank===14||f.absoluteNuts)continueChance=1;
 else if(pre&&f.pairRank===13)continueChance=Math.max(continueChance,c.preflopNode==='facing-4bet'?.975:.998);
 if(o.street==='river'&&f.absoluteNuts&&!f.playsBoard&&o.legal.canRaise)raising=1;
 if(!o.legal.canRaise)raising=0;
 let distribution:PolicyDistribution;
 if(call===0)distribution={fold:0,check:1-raising,call:0,raise:raising};
 else{const fold=o.legal.fold?1-continueChance:0,remaining=1-fold;distribution={fold,check:0,call:remaining*(1-raising),raise:remaining*raising};}
 return {version:POLICY_VERSION,label:'SYNTHETIC / NOT HUMAN-VALIDATED',features:f,context:c,distribution,families:{value,bluff,semiBluff,trap,checkRaise,delayedCbet},sizing:sizing(o,p,f,c),memoryAdjustment:memory};
}
