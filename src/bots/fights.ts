/** Postflop fights (cash layer human-1.9.0, tournament policy 2.12.0). Facing a bet after the flop,
 * real players do more than call or fold: they check-raise strong hands and draws (and the odd
 * bluff), raise draws in position, float a continuation bet in position with a plan to take the pot
 * away, and then bet when the bettor gives up. Aggressive skilled players fight most; passive
 * recreational players mostly just call. Value raises in multiway pots only. Designed frequencies,
 * not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {seatsFromButton} from './preflop';
import {contestablePricing} from './pricing';

/** How readily a personality fights back after the flop (0 … 1). */
export function fightiness(profile:BotProfile):number {const p=completeProfile(profile);return clamp((p.aggression-.25)*1.5)*(.35+.65*p.skill);}
const actionsOn=(o:BotObservation,street:string)=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street);
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const raiseTo=(o:BotObservation,multiple:number):Action=>{const facing=Math.max(...o.seats.map(s=>s.streetCommitted)),u=o.chipUnit??1,to=Math.round(facing*multiple/u)*u;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))};};

export type Fight='check-raise-value'|'check-raise-draw'|'check-raise-bluff'|'raise-draw'|'raise-value'|'float'|'take-away'|null;
export function fightPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:Fight} {
 const keep={action,play:null as Fight};
 if(!['flop','turn','river'].includes(o.street)||!o.ownCards||o.ownCards.length!==2)return keep;
 const me=o.actingSeat,opponents=o.seats.filter(s=>s.id!==me&&!s.folded).length,headsUp=opponents===1,f=handFeatures(o.ownCards,o.board),k=fightiness(profile),p=completeProfile(profile);
 if(f.absoluteNuts&&f.playsBoard)return keep;
 const here=actionsOn(o,o.street),raises=here.filter(e=>e.action?.type==='raise'),bet=raises.at(-1);
 const checkedFirst=!!bet&&here.some(e=>e.revision<bet.revision&&e.seatId===me&&e.action?.type==='check');
 const inPosition=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn).at(-1)?.id===me;
 const facing=!o.legal.check,bets=raises.length;
 // Take the pot away after floating: called a bet in position last street, now checked to.
 if(!facing&&headsUp&&action.type==='check'&&o.street!=='flop'&&o.legal.canRaise){
  const prev=o.street==='turn'?'flop':'turn',last=actionsOn(o,prev),previousBets=last.filter(e=>e.action?.type==='raise'),bettor=previousBets.at(-1)?.seatId,opponent=o.seats.find(s=>s.id!==me&&!s.folded);
  const iCalled=last.at(-1)?.seatId===me&&last.at(-1)?.action?.type==='call';
  const noCheckRaise=previousBets.length===1&&!last.some(e=>e.seatId===me&&e.action?.type==='check');
  const checkedTo=here.at(-1)?.seatId===bettor&&here.at(-1)?.action?.type==='check'&&raises.length===0;
  if(inPosition&&bettor===opponent?.id&&noCheckRaise&&iCalled&&checkedTo&&draw(random)<clamp(k*.75)){const own=o.seats.find(s=>s.id===me)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.55)/u)*u;return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'take-away'};}
  return keep;
 }
 if(!facing||bets!==1||!o.legal.canRaise)return keep;
 const strong=f.made&&!f.playsBoard&&f.strength>=.68,drawing=(f.draw>=.3||['open-ended','double-gutshot'].includes(f.drawClass))&&!strong,air=!f.made&&f.strength<.35&&!drawing;
 if(checkedFirst){
  if(strong&&action.type==='call'&&draw(random)<clamp(.1+.3*k))return {action:raiseTo(o,3),play:'check-raise-value'};
  if(!headsUp)return keep;
  if(drawing&&o.street!=='river'&&action.type!=='raise'&&draw(random)<clamp(k*.45))return {action:raiseTo(o,3),play:'check-raise-draw'};
  if(air&&o.street==='flop'&&f.wetness<.35&&action.type==='fold'&&draw(random)<clamp(k*.12))return {action:raiseTo(o,3),play:'check-raise-bluff'};
  return keep;
 }
 // A first response is not automatically in position: players may remain behind.
 if(!inPosition)return keep;
 // In-position value raises and draw raises.
 if(strong&&action.type==='call'&&draw(random)<clamp(.15+.4*k))return {action:raiseTo(o,2.8),play:'raise-value'};
 if(!headsUp)return keep;
 if(drawing&&o.street==='flop'&&action.type!=='raise'&&draw(random)<clamp(k*.3))return {action:raiseTo(o,2.8),play:'raise-draw'};
 // Float a flop bet in position with overcards or a backdoor, planning to take it away later.
 if(o.street==='flop'&&action.type==='fold'&&f.strength<.45&&(f.overcards>=1||f.draw>=.1)&&o.legal.callAmount<o.seats.find(s=>s.id===me)!.stack&&contestablePricing(o).price<=.375&&draw(random)<clamp(p.skill*k*.6))return {action:{type:'call'},play:'float'};
 return keep;
}
