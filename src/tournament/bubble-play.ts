/** Bubble and final-table roles (policy 2.19.0). Near the money and at the final table, the stack
 * a player has decides how they play, more than their style:
 * - big stacks bully: open wider when folded to, 3-bet medium stacks who cannot afford to fight, and
 *   bet more when checked to;
 * - medium stacks tighten up against anyone who covers them, folding hands they would normally play;
 * - short stacks hang on to ladder up: when someone else is shorter, they fold marginal shoves and
 *   wait for that player to bust first.
 * How fully each player does this follows their bubble awareness (strong regulars fully, calling
 * stations and maniacs hardly at all). Public information only. Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {clamp} from '../bots/profiles';
import {handFeatures} from '../bots/features';
import {deepRank} from '../bots/three-bet';
import {bubbleAwareness,bubblePressure,type TournamentContext} from './bot-policy-v2';

export type BubbleRole='big'|'medium'|'short';
export type BubblePlay='bully-open'|'bully-3bet'|'bully-bet'|'ladder-fold'|'medium-fold'|'hang-on'|null;
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Pressure from the money bubble, or from the pay jumps at a final table (nine or fewer left). */
export function moneyPressure(c:TournamentContext):number {return Math.max(bubblePressure(c),c.prizes&&c.playersLeft<=9&&c.playersLeft>2?.6:0);}
export function bubbleRole(total:number,bigBlind:number,c:TournamentContext):BubbleRole {
 const avg=c.stacks.reduce((a,b)=>a+b,0)/Math.max(1,c.stacks.length);
 return total/bigBlind<12?'short':total>=1.6*avg?'big':'medium';
}
export function bubblePlay(o:BotObservation,profile:BotProfile,action:Action,c:TournamentContext|undefined,random:()=>number):{action:Action;play:BubblePlay} {
 const keep={action,play:null as BubblePlay};
 if(!c||!o.ownCards||o.ownCards.length!==2)return keep;
 const pressure=moneyPressure(c);if(pressure<.5)return keep;
 const k=clamp(pressure*bubbleAwareness(profile)),own=o.seats.find(s=>s.id===o.actingSeat)!,total=own.stack+own.totalCommitted,bb=o.bigBlind,role=bubbleRole(total,bb,c);
 const totalOf=(id:number)=>{const s=o.seats.find(x=>x.id===id);return s?s.stack+s.totalCommitted:0;};
 const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raises=pre.filter(e=>e.action?.type==='raise'),u=o.chipUnit??1;
 const raiseTo=(to:number):Action|null=>o.legal.canRaise?{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round(to/u)*u))}:null;
 if(o.street==='preflop'){
  const rank=deepRank(o.ownCards),blind=o.publicEvents.find(e=>e.type==='blind'&&e.seatId===o.actingSeat);
  if(role==='big'){
   if(!raises.length&&!pre.some(e=>e.action?.type==='call')&&action.type!=='raise'&&!(blind&&o.legal.check)&&rank<=.55&&draw(random)<.5*k){const r=raiseTo(2.2*bb);if(r)return {action:r,play:'bully-open'};}
   const raiser=raises.at(-1)?.seatId;
   if(raises.length===1&&raiser!==undefined&&action.type!=='raise'&&rank<=.25){const t=totalOf(raiser);if(t<total&&t/bb>=12&&draw(random)<.35*k){const r=raiseTo(3*(raises[0].action!.type==='raise'?raises[0].action!.to:2*bb));if(r)return {action:r,play:'bully-3bet'};}}
   return keep;
  }
  const raiser=raises.at(-1)?.seatId,covered=raiser!==undefined&&totalOf(raiser)>=total;
  if(role==='medium'&&covered){
   if(action.type==='call'&&rank>.05&&draw(random)<.5*k)return {action:{type:'fold'},play:'ladder-fold'};
   if(action.type==='raise'&&rank>.03&&draw(random)<.3*k)return {action:{type:'fold'},play:'ladder-fold'};
  }
  if(role==='short'&&action.type==='raise'&&action.to>=o.legal.maxRaiseTo!&&rank>.12&&c.stacks.some(s=>s>0&&s<total)&&draw(random)<.45*k)
   return {action:o.legal.check?{type:'check'}:{type:'fold'},play:'hang-on'};
  return keep;
 }
 const f=handFeatures(o.ownCards,o.board);
 if(role==='big'&&o.legal.check&&action.type==='check'&&draw(random)<.3*k){const own2=own.streetCommitted+o.pot*.5,r=raiseTo(own2);if(r)return {action:r,play:'bully-bet'};}
 if(role==='medium'&&!o.legal.check&&action.type==='call'&&f.strength<.6){const bettor=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street&&e.action?.type==='raise').at(-1)?.seatId;
  if(bettor!==undefined&&totalOf(bettor)>=total&&draw(random)<.35*k)return {action:{type:'fold'},play:'medium-fold'};}
 return keep;
}
