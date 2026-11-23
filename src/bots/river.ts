/** River decisions (cash layer human-1.9.0, tournament policy 2.12.0). The river is where player
 * types separate most: good players value-bet medium hands thinly when checked to, make hero calls
 * with bluff-catchers against aggressive players (more readily when the price is good), and make
 * big folds with good-but-not-great hands when a passive player suddenly bets big or raises.
 * Recreational players rarely bet thin, call too much and almost never find big folds.
 * Uses the public reads kept on the bettor (patch 35). Designed frequencies, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {contestablePricing} from './pricing';
import {seatsFromButton} from './preflop';
import {keyOpponent,playerType,type PlayerRead} from './table-reads';

/** How aggressive the reads say this player is after the flop (0 passive … 1 wild), shrunk to typical without data. */
export function bettorAggression(read:PlayerRead|undefined):number {
 if(!read)return .35;const r=read.reads.aggression;return clamp((r.count+.35*10)/(r.chances+10));
}
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
export type RiverPlay='thin-value'|'hero-call'|'big-fold'|null;
export function riverPlay(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,PlayerRead>>|null|undefined,random:()=>number):{action:Action;play:RiverPlay} {
 const keep={action,play:null as RiverPlay};
 if(o.street!=='river'||o.board.length!==5||!o.ownCards||o.ownCards.length!==2)return keep;
 const me=o.actingSeat,p=completeProfile(profile),f=handFeatures(o.ownCards,o.board),headsUp=o.seats.filter(s=>s.id!==me&&!s.folded).length===1;
 // Shared absolute nuts and board-only ranks are not private bluff-catchers/value hands.
 if(f.absoluteNuts||!f.made||f.playsBoard)return keep;
 if(o.legal.check){
  // Thin value: a medium hand bets small when checked to heads-up.
  if(seatsFromButton(o).filter(s=>!s.folded&&!s.allIn).at(-1)?.id===me&&headsUp&&action.type==='check'&&o.legal.canRaise&&f.strength>=.55&&f.strength<.78&&o.publicEvents.some(e=>e.type==='action'&&e.street==='river'&&e.seatId!==me&&e.action?.type==='check')&&draw(random)<clamp(.5*p.skill*(.6+.4*p.aggression))){
   const own=o.seats.find(s=>s.id===me)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.35)/u)*u;return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'thin-value'};
  }
  return keep;
 }
 // The authored recreational presets have skill <= .3; they retain the base calls/folds.
 if(p.skill<=.3)return keep;
 const bettor=keyOpponent(o);if(bettor===null)return keep;
 const lastBet=o.publicEvents.filter(e=>e.type==='action'&&e.street==='river'&&e.action?.type==='raise').at(-1);
 if(lastBet?.seatId!==bettor)return keep;
 const read=reads?.[bettor],aggr=bettorAggression(read),type=playerType(read);
 const price=contestablePricing(o).price,raised=o.publicEvents.filter(e=>e.type==='action'&&e.street==='river'&&e.action?.type==='raise').length>=2;
 // Hero call: a bluff-catcher against an aggressive bettor, more readily at a good price.
 if(action.type==='fold'&&headsUp&&f.strength>=.35&&f.strength<.62&&o.legal.callAmount>0){
  const chance=p.skill*(.1+.9*Math.max(0,aggr-.3)+(type==='maniac'?.25:0))*(1.4-price*1.6);
  if(draw(random)<clamp(chance,0,.7))return {action:{type:'call'},play:'hero-call'};
 }
 // Big fold: good-but-not-great facing a raise, or a big bet from a passive player; and bluff-catchers
 // let go against a passive player, whose river bets are rarely bluffs. Skilled players only.
 const discipline=clamp((p.skill-.3)*1.4),passive=aggr<.25||type==='nit'||type==='station';
 if(action.type==='call'&&f.strength>=.62&&f.strength<.85){
  const big=price>=.4;
  if((raised||(big&&passive))&&draw(random)<clamp(discipline*(raised?.55:.45)*(passive?1.2:.7)))return {action:{type:'fold'},play:'big-fold'};
 }
 if(action.type==='call'&&headsUp&&passive&&f.strength<.62&&price>=.3&&draw(random)<clamp(discipline*.45))return {action:{type:'fold'},play:'big-fold'};
 return keep;
}
