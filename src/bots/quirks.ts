/** Recreational quirks (cash layer human-1.12.0, tournament policy 2.15.0). Weaker, looser players
 * make plays that good players almost never make, and that give a live game its feel:
 * - limping with aces or kings to trap, then re-raising when someone raises (the limp-reraise);
 * - limping behind other limpers with any suited, connected, paired or ace hand;
 * - defending the big blind against a small raise with almost anything ("it's only a bit more");
 * - leading into the raiser on the flop with any pair or draw;
 * - a small "blocker" bet on the river with a medium hand, out of position.
 * How often depends on how recreational the player is: none for skilled players. These add to the
 * existing habits (limp-calling, min-raising, donking). Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {deepRank} from './three-bet';
import {effectiveBB} from './depth';
import {seatsFromButton} from './preflop';

export type Quirk='limp-trap'|'limp-reraise'|'over-limp'|'junk-defend'|'piece-donk'|'blocker-bet';
/** How recreational the player plays: 0 for skilled players, up to about .6 for loose, weak ones. */
export function quirkiness(profile:BotProfile):number {const p=completeProfile(profile);return clamp((.62-p.skill)*1.6*(.5+.5*p.looseness),0,.65);}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const acts=(o:BotObservation,street?:string)=>o.publicEvents.filter(e=>e.type==='action'&&(street===undefined||e.street===street));
function raiseTo(o:BotObservation,to:number):Action|null {
 if(!o.legal.canRaise)return null;const u=o.chipUnit??1;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round(to/u)*u))};
}
function bet(o:BotObservation,fraction:number):Action|null {const own=o.seats.find(s=>s.id===o.actingSeat)!;return raiseTo(o,own.streetCommitted+o.pot*fraction);}

export function quirkPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:Quirk|null} {
 const keep={action,play:null as Quirk|null},q=quirkiness(profile);
 if(!o.ownCards||o.ownCards.length!==2||q<=0)return keep;
 const pre=acts(o,'preflop'),raises=pre.filter(e=>e.action?.type==='raise'),bb=o.bigBlind,own=o.seats.find(s=>s.id===o.actingSeat)!;
 const allIn=action.type==='raise'&&action.to>=o.legal.maxRaiseTo!;
 if(o.street==='preflop'){
  if(effectiveBB(o)<=25||allIn)return keep;
  const rank=deepRank(o.ownCards),blind=o.publicEvents.find(e=>e.type==='blind'&&e.seatId===o.actingSeat),iLimped=pre.findIndex(e=>e.seatId===o.actingSeat&&e.action?.type==='call')>=0&&pre.findIndex(e=>e.seatId===o.actingSeat&&e.action?.type==='call')<pre.findIndex(e=>e.action?.type==='raise')&&!pre.some(e=>e.seatId===o.actingSeat&&e.action?.type==='raise');
  // A player who limped with a big hand re-raises when someone raises behind (no quirk roll: that was the plan).
  if(iLimped&&raises.length===1&&rank<=.06&&action.type!=='raise'&&draw(random)<(rank<=.035?.85:.45)){const r=raiseTo(o,raises[0].action!.type==='raise'?3.5*raises[0].action!.to:4*bb);if(r)return {action:r,play:'limp-reraise'};}
  if(q<=0)return keep;
  // Limp with aces or kings (and the like) to trap.
  if(!raises.length&&!blind&&action.type==='raise'&&!allIn&&o.legal.callAmount>0&&rank<=.035&&own.stack>20*bb&&draw(random)<q*.6)return {action:{type:'call'},play:'limp-trap'};
  // Limp behind other limpers with anything playable.
  const limpers=pre.filter(e=>e.action?.type==='call').length,f=handFeatures(o.ownCards,[]);
  if(!raises.length&&limpers>0&&action.type==='fold'&&o.legal.callAmount>0&&o.legal.callAmount<=bb&&(f.suited||f.connected||f.handClass==='pocket-pair'||o.ownCards.some(c=>c[0]==='A'))&&draw(random)<q)return {action:{type:'call'},play:'over-limp'};
  // Big blind against one small raise, nobody else in: "it's only a bit more".
  if(blind?.amount===bb&&raises.length===1&&pre.filter(e=>e.action?.type==='call').length===0&&action.type==='fold'&&o.legal.callAmount<=2*bb&&draw(random)<q*.5)return {action:{type:'call'},play:'junk-defend'};
  return keep;
 }
 if(q<=0||!o.legal.check||action.type!=='check')return keep;
 const f=handFeatures(o.ownCards,o.board),pfr=raises.at(-1)?.seatId,here=acts(o,o.street),live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length;
 const first=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn)[0]?.id===o.actingSeat;
 // Lead into the preflop raiser with any pair or draw.
 if(o.street==='flop'&&pfr!==undefined&&pfr!==o.actingSeat&&o.seats.some(s=>s.id===pfr&&!s.folded)&&first&&!here.length&&((f.made&&!f.playsBoard&&f.strength>=.35)||f.draw>=.2)&&draw(random)<q*.35){const r=bet(o,.4);if(r)return {action:r,play:'piece-donk'};}
 // A small blocker bet on the river with a medium hand, first to act, heads-up.
 if(o.street==='river'&&live===1&&first&&!here.length&&f.made&&!f.playsBoard&&pfr!==o.actingSeat&&f.strength>=.35&&f.strength<.65&&draw(random)<q*.5){const r=bet(o,.25);if(r)return {action:r,play:'blocker-bet'};}
 return keep;
}
