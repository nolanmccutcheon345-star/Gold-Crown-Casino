import type {Action,BotObservation} from '../../src/contracts';
import {auditCards} from '../step4c/audit';
export const REFERENCE_POLICIES=['always-minbet','oversized-value-pressure','value-only-river','overbluff','nit','random','balanced-heuristic'] as const;
export type ReferencePolicy=typeof REFERENCE_POLICIES[number];
export const REFERENCE_ASSUMPTIONS:Record<ReferencePolicy,string>={
 'always-minbet':'Raises the legal minimum whenever possible; otherwise checks/calls. Deliberately exploitable fixed probe.',
 'oversized-value-pressure':'Checks/calls to river; 2.5pot or capped shove with private value, occasional ace-blocker air. Targets excessive oversized calls, not an optimal policy.',
 'value-only-river':'Checks/calls earlier streets; river bets1.5pot only with private two-pair or better, folds non-value to pressure.',
 overbluff:'Raises1.25pot at every legal opportunity regardless of strength; calls when raising unavailable.',
 nit:'Preflop TT+/AQ+, value-led postflop; folds non-value to prices over20%. Fixed independent rule, not production nit archetype.',
 random:'Uniformly chooses among distinct legal fold/check/call/minraise/potraise/all-in actions.',
 'balanced-heuristic':'Declared mixture: value bets and ace-blocker air25%; price-sensitive private-pair/draw calls. Balanced is a descriptive heuristic, not solver equilibrium.',
};
export function referenceAction(kind:ReferencePolicy,o:BotObservation,random:()=>number):Action{
 const own=o.seats.find(s=>s.id===o.actingSeat)!,legal=o.legal,passive=():Action=>legal.check?{type:'check'}:{type:'call'},fold=():Action=>legal.check?{type:'check'}:legal.fold?{type:'fold'}:passive(),base=own.streetCommitted+legal.callAmount,pot=o.pot+legal.callAmount;
 const raise=(total:number):Action=>!legal.canRaise?passive():{type:'raise',to:legal.shortAllInTo!==null&&legal.minRaiseTo!>legal.maxRaiseTo!?legal.shortAllInTo:Math.round(Math.max(legal.minRaiseTo!,Math.min(legal.maxRaiseTo!,total)))};
 const bet=(fraction:number)=>raise(base+pot*fraction),r=o.ownCards.map(c=>'23456789TJQKA'.indexOf(c[0])+2),pair=r[0]===r[1],high=Math.max(...r),low=Math.min(...r),f=auditCards(o.ownCards,o.board),price=legal.callAmount/Math.max(1,pot);
 if(kind==='always-minbet')return raise(legal.minRaiseTo??0);
 if(kind==='overbluff')return bet(1.25);
 if(kind==='random'){const options:Action[]=[passive()];if(legal.fold)options.push({type:'fold'});if(legal.canRaise)options.push(raise(legal.minRaiseTo!),bet(1),raise(legal.maxRaiseTo!));const unique=[...new Map(options.map(a=>[JSON.stringify(a),a])).values()];return unique[Math.floor(random()*unique.length)];}
 if(kind==='value-only-river'||kind==='oversized-value-pressure'){
  if(o.street!=='river')return passive();
  if(kind==='value-only-river')return f.value&&f.categoryIndex>=2?bet(1.5):fold();
  return f.value||f.air&&high===14&&random()<.125?bet(2.5):price<=.15&&f.privatePair?passive():fold();
 }
 if(o.street==='preflop'){
  const premium=pair&&high>=10||high===14&&low>=12;
  if(premium)return raise(Math.max(3*o.bigBlind,base*3));
  if(kind==='nit')return fold();
  return pair||high>=12&&low>=9||o.ownCards[0][1]===o.ownCards[1][1]&&high-low<=2?price<=.3?passive():fold():fold();
 }
 if(kind==='nit')return f.value?bet(.65):price<=.2&&f.privatePair?passive():fold();
 if(f.value)return bet(.75);
 if(f.air&&high===14&&random()<.25)return bet(.75);
 if(f.draw&&price<=.25||f.privatePair&&price<=.3)return passive();
 return fold();
}
