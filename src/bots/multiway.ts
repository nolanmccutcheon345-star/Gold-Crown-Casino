/** Multiway pots (cash layer human-1.6.0, tournament policy 2.9.0). With three or more players
 * after the flop, someone usually has something: good players bluff and continuation-bet far less,
 * value-bet only stronger hands, bet their big hands for protection instead of slow-playing, and
 * give up marginal bluff-catchers when more players are still to act. Weaker players hardly adjust.
 * Public information and own cards only. Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

/** Opponents still in the hand (including all-in players). */
export function opponentsIn(o:BotObservation):number {return o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length;}
/** How much a personality adjusts to extra opponents: strong players fully, recreational players little. */
export function multiwayDiscipline(profile:BotProfile):number {const p=completeProfile(profile);return clamp(.15+.85*p.skill-.3*Math.max(0,p.looseness-.6));}

export interface MultiwayEffect {opponents:number;discipline:number;}
/** The same player adjusted for a multiway pot after the flop. */
export function multiwayProfile(o:BotObservation,profile:BotProfile):{profile:BotProfile;effect:MultiwayEffect|null} {
 const n=opponentsIn(o);if(o.street==='preflop'||n<2)return {profile,effect:null};
 const d=multiwayDiscipline(profile),extra=Math.min(3,n-1),p=completeProfile(profile),t={...p.traits};
 t.bluffFrequency=clamp(t.bluffFrequency*(1-.3*extra*d));
 t.valueThreshold=clamp(t.valueThreshold+.05*extra*d);
 t.riverCuriosity=clamp(t.riverCuriosity-.08*extra*d);
 t.slowPlay=clamp(t.slowPlay*(1-.35*extra*d));
 return {profile:{...p,traits:t},effect:{opponents:n,discipline:d}};
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Multiway plays applied after the decision:
 * - give-up: no bet with air (no pair, little draw) into two or more opponents;
 * - protect: bet a strong hand instead of checking it;
 * - fold-marginal: fold a bare bluff-catcher facing a bet with another player still to act behind. */
export function multiwayPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};const n=opponentsIn(o);
 if(o.street==='preflop'||n<2||!o.ownCards||o.ownCards.length!==2)return keep;
 const d=multiwayDiscipline(profile),extra=Math.min(3,n-1),f=handFeatures(o.ownCards,o.board),noBet=o.legal.check;
 // Open-ended and double-gutshot draws have eight outs despite a draw score below .3.
 const littleDraw=f.draw<.3&&!['open-ended','double-gutshot'].includes(f.drawClass);
 if(noBet&&action.type==='raise'&&f.strength<.4&&littleDraw&&draw(random)<clamp(d*(.35+.2*extra)))return {action:{type:'check'},play:'give-up'};
 if(noBet&&action.type==='check'&&f.made&&!f.playsBoard&&f.strength>=.68&&o.legal.canRaise&&draw(random)<clamp(d*(.25+.15*extra))){
  const own=o.seats.find(s=>s.id===o.actingSeat)!,unit=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.66)/unit)*unit;
  return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'protect'};
 }
 if(!noBet&&action.type==='call'&&f.strength>=.35&&f.strength<.6&&littleDraw&&!f.absoluteNuts){
  // Other players who still owe the bet (they will act after this one).
  const bet=Math.max(...o.seats.map(s=>s.streetCommitted));
  const behind=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded&&!s.allIn&&s.streetCommitted<bet).length;
  if(behind>0&&draw(random)<clamp(d*(.3+.15*behind)))return {action:{type:'fold'},play:'fold-marginal'};
 }
 return keep;
}
