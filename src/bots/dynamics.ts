/** Table dynamics (cash layer human-1.14.0, tournament policy 2.17.0). Where an aggressive player
 * sits matters as much as what they do. Good players:
 * - 3-bet lighter, and flat more speculative hands, when the habitual opener sits directly on their
 *   right: they will have position on that player for the whole hand;
 * - float that opener's c-bets more after the flop, in position;
 * - open fewer marginal hands when an aggressive player sits directly on their left, who would
 *   3-bet them and play the pot in position.
 * "Aggressive" comes from the public table reads (how often a player has raised before the flop),
 * after enough hands. How strongly a player adjusts follows their skill and how long the reads have
 * run. Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {clamp} from './profiles';
import {handFeatures} from './features';
import {deepRank} from './three-bet';
import {typeStrength,type PlayerRead} from './table-reads';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const acts=(o:BotObservation,street:string)=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street);
/** The seated player directly on this player's right (acts just before) or left (acts just after). */
export function neighbour(o:BotObservation,side:'left'|'right'):number|null {
 const ids=o.seats.map(s=>s.id).sort((a,b)=>a-b),i=ids.indexOf(o.actingSeat);if(ids.length<3||i<0)return null;
 return ids[(i+(side==='left'?1:-1)+ids.length)%ids.length];
}
/** Opens often: raises before the flop at least about a quarter of the time, after 15+ hands (shrunk toward 15%). */
export function aggressiveOpener(read:PlayerRead|undefined):boolean {if(!read||read.hands<15)return false;return (read.pfr.count+.15*10)/(read.pfr.chances+10)>=.24;}
function raiseTo(o:BotObservation,to:number):Action|null {if(!o.legal.canRaise)return null;const u=o.chipUnit??1;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round(to/u)*u))};}

export type Dynamic='position-3bet'|'position-flat'|'respect-left'|'position-float'|null;
export function dynamicsPlay(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,PlayerRead>>|null|undefined,random:()=>number):{action:Action;play:Dynamic} {
 const keep={action,play:null as Dynamic};
 if(!reads||!o.ownCards||o.ownCards.length!==2)return keep;
 const right=neighbour(o,'right'),left=neighbour(o,'left'),bb=o.bigBlind;
 if(o.street==='preflop'){
  const pre=acts(o,'preflop'),raises=pre.filter(e=>e.action?.type==='raise'),rank=deepRank(o.ownCards);
  // The habitual opener on the right just opened, and nobody else has come in: punish it in position.
  if(right!==null&&o.button!==right&&raises.length===1&&pre.at(-1)?.seatId===right&&raises[0].seatId===right&&aggressiveOpener(reads[right])&&!pre.some(e=>e.action?.type==='call')){
   const k=typeStrength(profile,reads[right]!);
   if(action.type!=='raise'&&rank<=.2&&draw(random)<clamp(.45*k)){const r=raiseTo(o,3*(raises[0].action!.type==='raise'?raises[0].action!.to:3*bb));if(r)return {action:r,play:'position-3bet'};}
   if(action.type==='fold'&&rank<=.35&&o.legal.callAmount<=3.5*bb&&draw(random)<clamp(.35*k))return {action:{type:'call'},play:'position-flat'};
   return keep;
  }
  // First in, with an aggressive player still to act directly on the left: open fewer marginal hands.
  const blind=o.publicEvents.some(e=>e.type==='blind'&&e.seatId===o.actingSeat);
  if(left!==null&&!pre.some(e=>e.action?.type==='raise'||e.action?.type==='call')&&!blind&&action.type==='raise'&&rank>.14&&aggressiveOpener(reads[left])&&!o.seats.find(s=>s.id===left)?.folded&&!pre.some(e=>e.seatId===left)){
   const k=typeStrength(profile,reads[left]!);if(draw(random)<clamp(.5*k))return {action:o.legal.check?{type:'check'}:{type:'fold'},play:'respect-left'};
  }
  return keep;
 }
 // Flop: float the opener on the right in position.
 if(o.street==='flop'&&right!==null&&action.type==='fold'&&!o.legal.check){
  const pfr=acts(o,'preflop').filter(e=>e.action?.type==='raise').at(-1)?.seatId,live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded),bets=acts(o,'flop').filter(e=>e.action?.type==='raise');
  if(pfr===right&&live.length===1&&live[0].id===right&&bets.length===1&&bets[0].seatId===right&&!acts(o,'flop').some(e=>e.seatId===o.actingSeat)&&aggressiveOpener(reads[right])&&o.legal.callAmount<=.6*o.pot){
   const f=handFeatures(o.ownCards,o.board);
   if((f.made||f.overcards>=1||f.draw>=.1)&&draw(random)<clamp(.4*typeStrength(profile,reads[right]!)))return {action:{type:'call'},play:'position-float'};
  }
 }
 return keep;
}
