/** Live-player habits: the recognisable things real players do that a clean model does not.
 * Recreational players limp and limp-call, min-raise, lead into the raiser ("donk"), and overbet
 * the river with monsters; trappers check-raise; good regulars float and fire delayed bets.
 * Applied after the model's decision, from public information and the player's own cards only.
 * Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

export interface Habits {limpCall:number;minRaise:number;donk:number;trap:number;overbetTell:number;float:number;delayedBet:number;}
export const HABIT_NAMES:Record<keyof Habits,string>={limpCall:'limps and limp-calls',minRaise:'min-raises',donk:'leads into the raiser',trap:'check-raises strong hands',overbetTell:'overbets the river with big hands',float:'floats flop bets',delayedBet:'bets the turn after checking'};

/** A personality's habits from its traits; a regular may override some. */
export function habitsOf(profile:BotProfile,override?:Partial<Habits>):Habits {
 const p=completeProfile(profile),s=p.skill,A=p.aggression,L=p.looseness,t=p.traits;
 return {
  limpCall:clamp((1-A)*L*(1-s)*2.4,0,.85),
  minRaise:clamp((1-s)*.4*(L+.2)),
  donk:clamp((1-s)*(.25+.5*L)*.6+t.mistakeRate*.1),
  trap:clamp(t.slowPlay*.8),
  overbetTell:clamp((.6-s)*1.2),
  float:clamp((s-.5)*A*1.4),
  delayedBet:clamp((s-.45)*(.5+A)*.65),
  ...override,
 };
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
type Acts=BotObservation['publicEvents'];
const actions=(o:BotObservation,street?:string):Acts=>o.publicEvents.filter(e=>e.type==='action'&&(street===undefined||e.street===street));
/** Postflop acting order among players still in: is this player last to act (in position)? */
function inPosition(o:BotObservation,against:number):boolean {
 const live=o.seats.filter(s=>!s.folded).map(s=>s.id).sort((a,b)=>a-b),n=live.length,from=(id:number)=>{const i=live.indexOf(id),b=live.findIndex(x=>x>o.button);const first=b<0?0:b;return (i-first+n)%n;};
 return from(o.actingSeat)>from(against);
}
function bet(o:BotObservation,fraction:number):Action|null {
 if(!o.legal.canRaise)return null;const own=o.seats.find(s=>s.id===o.actingSeat)!,unit=o.chipUnit??1;
 const to=Math.round((own.streetCommitted+o.pot*fraction)/unit)*unit;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))};
}

export interface HabitResult {action:Action;habit:keyof Habits|null;}
/** Apply at most one habit to a decision. `minRaise` is left to `applyMinRaise`, after sizing. */
export function applyHabits(o:BotObservation,profile:BotProfile,action:Action,habits:Habits,random:()=>number):HabitResult {
 const keep={action,habit:null};if(!o.ownCards||o.ownCards.length!==2)return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,stack=own.stack+own.streetCommitted,bb=o.bigBlind,f=handFeatures(o.ownCards,o.board);
 const pre=actions(o,'preflop'),raises=pre.filter(e=>e.action?.type==='raise'),pfr=raises.at(-1)?.seatId,here=actions(o,o.street);
 const live=o.seats.filter(s=>!s.folded&&s.id!==o.actingSeat),headsUp=live.length===1,allIn=action.type==='raise'&&action.to>=o.legal.maxRaiseTo!;
 const roll=(p:number)=>p>0&&draw(random)<p;
 if(o.street==='preflop'){
  const blind=o.publicEvents.some(e=>e.type==='blind'&&e.seatId===o.actingSeat);
  // Open-limp instead of raising a middling hand.
  if(!raises.length&&!blind&&action.type==='raise'&&!allIn&&f.strength<.72&&stack>15*bb&&roll(habits.limpCall))return {action:{type:'call'},habit:'limpCall'};
  // Limp-call: having limped, call a small raise rather than fold.
  const firstRaise=pre.findIndex(e=>e.action?.type==='raise'),firstOwn=pre.findIndex(e=>e.seatId===o.actingSeat&&e.action?.type==='call');
  const limped=firstOwn>=0&&firstRaise>firstOwn&&raises.length===1;
  if(limped&&action.type==='fold'&&o.legal.callAmount<=4*bb&&f.strength>=.3&&roll(habits.limpCall*.8))return {action:{type:'call'},habit:'limpCall'};
  return keep;
 }
 const noBet=o.legal.check,iWasPfr=pfr===o.actingSeat;
 // Trap: check a big hand first, then check-raise.
 if(noBet&&action.type==='raise'&&!allIn&&o.street!=='river'&&f.strength>=.82&&roll(habits.trap*.6))return {action:{type:'check'},habit:'trap'};
 const checkedThisStreet=here.some(e=>e.seatId===o.actingSeat&&e.action?.type==='check');
 if(!noBet&&checkedThisStreet&&action.type==='call'&&f.strength>=.8&&o.legal.canRaise&&roll(habits.trap*.7)){const facing=Math.max(...o.seats.map(s=>s.streetCommitted));const r=bet(o,0);if(r){const to=Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round(facing*3)));return {action:{type:'raise',to},habit:'trap'};}}
 // Donk: lead into the preflop raiser out of position with any piece.
 if(noBet&&action.type==='check'&&o.street!=='river'&&pfr!==undefined&&!iWasPfr&&o.seats.some(s=>s.id===pfr&&!s.folded)&&!here.length&&!inPosition(o,pfr)&&(f.strength>=.45||f.draw>=.3)&&roll(habits.donk)){const r=bet(o,.33);if(r)return {action:r,habit:'donk'};}
 // River overbet with a monster (weaker players only): a size tell.
 if(o.street==='river'&&noBet&&action.type==='raise'&&!allIn&&f.strength>=.88&&roll(habits.overbetTell)){const r=bet(o,1.5);if(r)return {action:r,habit:'overbetTell'};}
 // Float only an opening flop bet by the preflop raiser, never a check-raise.
 const streetRaises=here.filter(e=>e.action?.type==='raise'),facingCbet=streetRaises.length===1&&streetRaises[0].seatId===pfr&&here.at(-1)?.seatId===pfr;
 if(o.street==='flop'&&headsUp&&facingCbet&&!noBet&&action.type==='fold'&&pfr!==undefined&&pfr!==o.actingSeat&&inPosition(o,pfr)&&o.legal.callAmount<=.6*o.pot&&roll(habits.float*.5))return {action:{type:'call'},habit:'float'};
 // Delayed bet on the turn: as the raiser who checked the flop, or after the raiser checked to a floater.
 if(o.street==='turn'&&headsUp&&noBet&&action.type==='check'&&!here.some(e=>e.action?.type==='raise')){
  const flop=actions(o,'flop'),flopChecked=!flop.some(e=>e.action?.type==='raise');
  const opp=live[0].id,oppChecked=here.some(e=>e.seatId===opp&&e.action?.type==='check');
  const flopRaises=flop.filter(e=>e.action?.type==='raise'),floated=flopRaises.length===1&&flopRaises[0].seatId===pfr&&flop.at(-1)?.seatId===o.actingSeat&&flop.at(-1)?.action?.type==='call';
  const delayed=(flopChecked&&(iWasPfr||(pfr===opp&&oppChecked)))||(floated&&pfr===opp&&oppChecked&&inPosition(o,opp));
  if(delayed&&roll(habits.delayedBet)){const r=bet(o,.5);if(r)return {action:r,habit:'delayedBet'};}
 }
 return keep;
}
/** Min-raise habit, applied after bet sizing: a non-all-in raise becomes the minimum. */
export function applyMinRaise(o:BotObservation,action:Action,habits:Habits,random:()=>number):HabitResult {
 if(action.type!=='raise'||!o.legal.canRaise||action.to>=o.legal.maxRaiseTo!||action.to===o.legal.minRaiseTo)return {action,habit:null};
 return draw(random)<habits.minRaise*.6?{action:{type:'raise',to:o.legal.minRaiseTo!},habit:'minRaise'}:{action,habit:null};
}
