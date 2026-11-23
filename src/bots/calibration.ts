/** Authored postflop corrections for new human-1.10.0 / tournament2.13.0 games.
 * The upstream simulation reported excessive check-downs and station folds. These
 * are heuristic behavior adjustments, not sourced human calibration or solver EV.
 * Existing policy modules stay frozen. Pure visible-card/public-state functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {seatsFromButton} from './preflop';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const betPot=(o:BotObservation,fraction:number):Action=>{const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*fraction)/u)*u;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))};};
/** True for players who behave like calling stations, whatever their label. */
export function stationLike(profile:BotProfile):boolean {const p=completeProfile(profile);return p.archetype==='station'||(p.skill<.4&&p.traits.riverCuriosity>=.75&&p.aggression<.4);}

export type CalibrationPlay='value-floor'|'last-stab'|'station-call'|'weak-fold'|null;
export function calibrationPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CalibrationPlay} {
 const keep={action,play:null as CalibrationPlay};
 if(!['flop','turn','river'].includes(o.street)||!o.ownCards||o.ownCards.length!==2)return keep;
 const p=completeProfile(profile),f=handFeatures(o.ownCards,o.board),noBet=o.legal.check,opponents=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length;
 if(f.absoluteNuts&&f.playsBoard)return keep;
 const privateMade=f.made&&!f.playsBoard,liveDraw=f.drawClass!=='none'&&f.drawClass!=='backdoor';
 if(noBet&&action.type==='check'&&o.legal.canRaise){
  // Value floor: strong hands bet the turn and river when checked to (slow-players a little less).
  if(o.street!=='flop'&&privateMade&&f.strength>=.68&&draw(random)<clamp(.5+.3*p.aggression-.25*p.traits.slowPlay))return {action:betPot(o,o.street==='river'?.6:.55),play:'value-floor'};
  // On the flop too, strong made hands bet more often than they check (multiway included).
  if(o.street==='flop'&&privateMade&&f.strength>=.68&&draw(random)<clamp(.3+.3*p.aggression-.2*p.traits.slowPlay))return {action:betPot(o,.5),play:'value-floor'};
  // Good-but-not-great hands (top pair and the like) bet for value more often than they check down.
  if(o.street!=='flop'&&privateMade&&f.strength>=.56&&f.strength<.68&&draw(random)<clamp((.25+.35*p.aggression)*(opponents>1?.7:1)))return {action:betPot(o,.45),play:'value-floor'};
  // Last to act on the turn or river after everyone checked: a small stab now and then.
  const acts=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street);
  const responders=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn),others=responders.filter(s=>s.id!==o.actingSeat);
  const checkedTo=responders.at(-1)?.id===o.actingSeat&&others.length>0&&acts.length===others.length&&new Set(acts.map(e=>e.seatId)).size===others.length&&others.every(s=>acts.some(e=>e.seatId===s.id&&e.action?.type==='check'));
  if(o.street!=='flop'&&checkedTo&&!privateMade&&f.strength<.45&&draw(random)<clamp(.35*p.aggression*(opponents>1?.6:1)))return {action:betPot(o,.4),play:'last-stab'};
  return keep;
 }
 // Everyone else lets go of nothing-hands facing a turn or river bet instead of calling it down.
 if(!noBet&&action.type==='call'&&o.street!=='flop'&&!stationLike(profile)&&!f.absoluteNuts&&!privateMade&&f.strength<.3&&!liveDraw&&draw(random)<.5)return {action:{type:'fold'},play:'weak-fold'};
 // Calling stations call with any pair or any draw, only below half their remaining stack.
 if(!noBet&&action.type==='fold'&&stationLike(profile)&&(privateMade||liveDraw)&&o.legal.callAmount>0){
  const own=o.seats.find(s=>s.id===o.actingSeat)!;
  if(o.legal.callAmount<own.stack*.5&&draw(random)<.65)return {action:{type:'call'},play:'station-call'};
 }
 return keep;
}
