/** Authored turn/river initiative and price discipline for new cash1.11/tournament2.14.
 * The submitted audit motivates this overlay but its unsourced tracker benchmarks
 * do not establish human calibration. Visible cards/public actions only; strength
 * remains a heuristic rank score, not an equity calculation. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {stationLike} from './calibration';
import {contestablePricing} from './pricing';
import {seatsFromButton} from './preflop';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** How readily a personality bets when nobody else has. */
export function initiative(profile:BotProfile):number {const p=completeProfile(profile);return clamp(.45+.65*p.aggression-.2*p.traits.slowPlay,.2,1.1);}
export type ShowdownPlay='turn-river-value'|'turn-river-protect'|'turn-river-stab'|'flop-stab'|'price-fold'|null;
export function showdownPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:ShowdownPlay} {
 const keep={action,play:null as ShowdownPlay};
 if(!['flop','turn','river'].includes(o.street)||!o.ownCards||o.ownCards.length!==2)return keep;
 const f=handFeatures(o.ownCards,o.board);
 if(f.absoluteNuts&&f.playsBoard)return keep;
 const privateMade=f.made&&!f.playsBoard;
 const responders=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn),others=responders.filter(s=>s.id!==o.actingSeat);
 const acts=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street);
 const checkedTo=responders.at(-1)?.id===o.actingSeat&&others.length>0&&acts.length===others.length&&new Set(acts.map(e=>e.seatId)).size===others.length&&others.every(s=>acts.some(e=>e.seatId===s.id&&e.action?.type==='check'));
 const unbet=acts.every(e=>e.action?.type==='check');
 // Price discipline: facing a bet, a hand that cannot justify the price folds (calling stations excepted).
 if(action.type==='call'&&!o.legal.check&&!stationLike(profile)){
  if(f.absoluteNuts)return keep;
  const p=completeProfile(profile),price=contestablePricing(o).price;
  const equity=f.strength+f.draw*(o.street==='flop'?.45:o.street==='turn'?.25:0),needed=price*(1.25-.45*p.traits.riverCuriosity);
  if(equity<needed&&draw(random)<.55+.35*p.skill)return {action:{type:'fold'},play:'price-fold'};
  return keep;
 }
 if(action.type!=='check'||!o.legal.check||!o.legal.canRaise||!unbet)return keep;
 // Flop: the last player to act after everyone checked takes a stab now and then (two or three players).
 if(o.street==='flop'){
  const opp=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length;
  if(opp<=2&&checkedTo&&draw(random)<clamp(.3*initiative(profile)*(opp>1?.7:1))){const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.45)/u)*u;return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'flop-stab'};}
  return keep;
 }
 const opponents=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length,k=initiative(profile);
 const multi=opponents>1?.75:1;
 let chance=0,play:ShowdownPlay=null,size=.5;
 if(privateMade&&f.strength>=.7){chance=.65;play='turn-river-value';size=.6;}
 else if(privateMade&&f.strength>=.5){chance=opponents===1?.45:.25;play='turn-river-protect';size=.45;}
 else if(checkedTo&&opponents<=2&&(o.street==='turn'||f.strength<.35)){chance=opponents===1?.3:.18;play='turn-river-stab';size=.4;}
 if(!play||draw(random)>=clamp(chance*k*multi))return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*size)/u)*u;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play};
}

/** Patch 47 (layer 1.15.0, tournament 2.18.0): fewer check-downs. The patch-46 audit over 8 tables
 * found nearly half of all showdowns were checked down, which kept stations and passive regulars at
 * about 50% went-to-showdown (live trackers show roughly 35-45%) and nits near 40%. Two adjustments:
 * players with some aggression stab at turns and rivers that are checked to them (fewer free cards),
 * and tight players give up weak bluff-catchers to turn and river bets more often. */
export type StabPlay='stab'|'nit-river-fold'|null;
export function stabPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:StabPlay} {
 const keep={action,play:null as StabPlay};
 if((o.street!=='turn'&&o.street!=='river')||!o.ownCards||o.ownCards.length!==2)return keep;
 const p=completeProfile(profile),f=handFeatures(o.ownCards,o.board),live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length;
 if(o.legal.check&&action.type==='check'&&live<=2&&f.strength<.55&&p.aggression>=.4&&o.legal.canRaise){
  const checkedTo=o.publicEvents.some(e=>e.type==='action'&&e.street===o.street&&e.seatId!==o.actingSeat&&e.action?.type==='check');
  if(checkedTo&&draw(random)<.3*p.aggression*(live===1?1:.6)){const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.55)/u)*u;
   return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'stab'};}
 }
 if(!o.legal.check&&action.type==='call'&&p.looseness<.3&&f.draw<.3&&(o.street==='river'?f.strength<.5&&draw(random)<.45:f.strength<.42&&draw(random)<.3))return {action:{type:'fold'},play:'nit-river-fold'};
 return keep;
}
