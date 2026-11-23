import type { Action, BotObservation } from '../../src/contracts';
import { evaluate } from '../../src/core/evaluator';

/** Independent fixed evaluation opponents. They use only an observation, never
 * the implementation under evaluation's features, equity or range decisions. */
export const PROBES=['minbet','hyper-overbet','limp-all','never-bluff','always-call','max-aggression'] as const;
export type Probe=typeof PROBES[number];
export const PROBE_DEFINITIONS:Record<Probe,string>={
 minbet:'Raise to the smallest legal full raise (or legal short all-in), otherwise check/call.',
 'hyper-overbet':'Raise by three times pot after calling, clamped to legal min/max, otherwise check/call.',
 'limp-all':'Preflop check/call every hand without raising. Postflop check when free, call with at least a pair, fold unpaired hands facing a price.',
 'never-bluff':'Preflop raise TT+/AQ+/AK, otherwise call broadways at≤3BB or check/fold. Postflop value-bet two-pair+ or top pair; call any pair at≤one-third-pot price, otherwise check/fold. Uses exact own visible rank only.',
 'always-call':'Always check for free or call the legal price; never voluntarily raise or fold.',
 'max-aggression':'Raise to the maximum legal stack commitment whenever raising is open; otherwise check/call.',
};
function passive(o:BotObservation):Action{return o.legal.check?{type:'check'}:{type:'call'};}
function raiseTo(o:BotObservation,to:number):Action{
 if(!o.legal.canRaise)return passive(o);
 if(o.legal.shortAllInTo!==null&&o.legal.minRaiseTo!>o.legal.maxRaiseTo!)return{type:'raise',to:o.legal.shortAllInTo};
 return{type:'raise',to:Math.max(o.legal.minRaiseTo!,Math.min(o.legal.maxRaiseTo!,Math.round(to)))};
}
const rank=(card:string)=>'23456789TJQKA'.indexOf(card[0])+2;
export function probeAction(probe:Probe,o:BotObservation):Action{
 const own=o.seats.find(s=>s.id===o.actingSeat)!;
 if(probe==='always-call')return passive(o);
 if(probe==='minbet')return raiseTo(o,o.legal.minRaiseTo??0);
 if(probe==='max-aggression')return raiseTo(o,o.legal.maxRaiseTo??0);
 if(probe==='hyper-overbet')return raiseTo(o,own.streetCommitted+o.legal.callAmount+3*(o.pot+o.legal.callAmount));
 if(probe==='limp-all'){
  if(o.street==='preflop'||o.legal.check)return passive(o);
  return evaluate([...o.ownCards,...o.board])[0]>=1?{type:'call'}:{type:'fold'};
 }
 if(o.street==='preflop'){
  const [high,low]=o.ownCards.map(rank).sort((a,b)=>b-a);
  if(high===low&&high>=10||high===14&&low>=12)return raiseTo(o,Math.max(3*o.bigBlind,own.streetCommitted+o.legal.callAmount*3));
  if(o.legal.check)return{type:'check'};
  return high>=11&&low>=10&&o.legal.callAmount<=3*o.bigBlind?{type:'call'}:{type:'fold'};
 }
 const ranks=evaluate([...o.ownCards,...o.board]);const top=Math.max(...o.board.map(rank));
 const value=ranks[0]>=2||ranks[0]===1&&ranks[1]===top&&o.ownCards.some(c=>rank(c)===top);
 if(value)return raiseTo(o,own.streetCommitted+o.legal.callAmount+o.pot+o.legal.callAmount);
 if(o.legal.check)return{type:'check'};
 return ranks[0]>=1&&o.legal.callAmount/(o.pot+o.legal.callAmount)<=1/3?{type:'call'}:{type:'fold'};
}
