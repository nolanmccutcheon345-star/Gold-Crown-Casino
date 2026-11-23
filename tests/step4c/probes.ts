import type {Action,BotObservation} from '../../src/contracts';
import {evaluate} from '../../src/core/evaluator';
import {auditCards} from './audit';
export const PROBES=['quarter-pressure','river-polarizer','thin-value','missed-selective','never-fold','stack-pressure','probe-shove','multiway-squeeze'] as const;
export type Probe=typeof PROBES[number];
export const PROBE_NOTES:Record<Probe,string>={
 'quarter-pressure':'Quarter-pot increments (at least legal minimum) at every opportunity; call when closed.',
 'river-polarizer':'Check/call until river; overbet2.25pot with private two-pair+ value or unpaired ace-blocker air; otherwise check/fold over halfpot.',
 'thin-value':'Open broadway/pairs; postflop half-pot top-pair-or-better, quarter-pot other private pairs; fold weak hands to large prices.',
 'missed-selective':'Open suited/highcard; bet live draws before river, bluff missed private flush/straight draws with ace/king blocker at75%pot; otherwise check/call cheap pairs.',
 'never-fold':'Check/call every legal price; no raises.',
 'stack-pressure':'Open minraise; jam after another raise or postflop when stack≤1.5pot; otherwise75%pot pressure.',
 'probe-shove':'Minimum bet flop, jam turn/river after own prior flop bet; no private-card dependence.',
 'multiway-squeeze':'Preflop squeeze to5×faced level plus callers when an open and call exist; postflop bet⅓pot HU but use private value-only75%pot multiway.',
};
const passive=(o:BotObservation):Action=>o.legal.check?{type:'check'}:{type:'call'};
const fold=(o:BotObservation):Action=>o.legal.check?{type:'check'}:o.legal.fold?{type:'fold'}:passive(o);
function raise(o:BotObservation,total:number):Action{if(!o.legal.canRaise)return passive(o);return{type:'raise',to:o.legal.shortAllInTo!==null&&o.legal.minRaiseTo!>o.legal.maxRaiseTo!?o.legal.shortAllInTo:Math.round(Math.max(o.legal.minRaiseTo!,Math.min(o.legal.maxRaiseTo!,total)))};}
export function probeAction(probe:Probe,o:BotObservation):Action{
 const own=o.seats.find(s=>s.id===o.actingSeat)!,base=own.streetCommitted+o.legal.callAmount,pot=o.pot+o.legal.callAmount,bet=(fraction:number)=>raise(o,base+pot*fraction);
 const ranks=o.ownCards.map(c=>'23456789TJQKA'.indexOf(c[0])+2),pair=ranks[0]===ranks[1],suited=o.ownCards[0][1]===o.ownCards[1][1],f=auditCards(o.ownCards,o.board),price=o.legal.callAmount/Math.max(1,pot);
 if(probe==='never-fold')return passive(o);
 if(probe==='quarter-pressure')return bet(.25);
 if(probe==='stack-pressure'){
  if(o.street==='preflop'){const raised=o.publicEvents.some(e=>e.street==='preflop'&&e.action?.type==='raise');return raised?raise(o,o.legal.maxRaiseTo??0):raise(o,o.legal.minRaiseTo??0);}
  return own.stack<=1.5*pot?raise(o,o.legal.maxRaiseTo??0):bet(.75);
 }
 if(probe==='probe-shove'){
  if(o.street==='preflop')return passive(o);
  if(o.street==='flop')return raise(o,o.legal.minRaiseTo??0);
  return raise(o,o.legal.maxRaiseTo??0);
 }
 if(probe==='river-polarizer'){
  if(o.street!=='river')return passive(o);
  if(f.value||f.air&&ranks.includes(14))return bet(2.25);
  return price<=.5?passive(o):fold(o);
 }
 if(probe==='multiway-squeeze'){
  if(o.street==='preflop'){
   const acts=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),ri=acts.findIndex(e=>e.action?.type==='raise'),callers=ri<0?0:acts.slice(ri+1).filter(e=>e.action?.type==='call').length;
   if(ri>=0&&callers>0)return raise(o,base*(5+callers));
   if(pair||Math.min(...ranks)>=10)return raise(o,Math.max(2.5*o.bigBlind,base*3));
   return price<.25?passive(o):fold(o);
  }
  return o.seats.filter(s=>!s.folded).length===2?bet(1/3):f.value?bet(.75):fold(o);
 }
 if(o.street==='preflop'){
  if(pair||Math.min(...ranks)>=10||probe==='missed-selective'&&(suited||Math.max(...ranks)>=13))return raise(o,Math.max(2.5*o.bigBlind,base*3));
  return o.legal.callAmount<=o.bigBlind?passive(o):fold(o);
 }
 if(probe==='missed-selective'){
  const missed=o.street==='river'&&!f.value&&auditCards(o.ownCards,o.board.slice(0,4)).draw;
  if(f.draw||missed&&Math.max(...ranks)>=13)return bet(.75);
 }
 if(f.value)return bet(.5);
 if(f.privatePair&&probe==='thin-value')return bet(.25);
 const category=evaluate([...o.ownCards,...o.board])[0];return category>=1&&price<=.2?passive(o):fold(o);
}
