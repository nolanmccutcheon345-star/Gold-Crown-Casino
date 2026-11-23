/** Heads-up aggression (cash layer human-1.8.0, tournament policy 2.11.0). The frozen base model is
 * passive heads-up: it rarely continuation-bets, barrels, stabs or probes without a strong hand.
 * Real players bet these spots often, and how often is one of the clearest differences between
 * player types: regulars continuation-bet most flops and keep firing turns, take delayed c-bets
 * and probes when the raiser checks; passive recreational players bet mainly when they have it.
 * When the decision is a check in one of these spots, the player bets instead with a chance that
 * depends on the hand (value, draw, medium, air) and the personality. Heads-up only; multiway pots
 * and scare-card plays are handled elsewhere. Designed frequencies, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

export type Spot='cbet'|'barrel'|'delayed-cbet'|'probe'|'river-barrel'|'stab'|null;
const lastRaiser=(o:BotObservation,street:string)=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street&&e.action?.type==='raise').at(-1)?.seatId;
const preflopRaiser=(o:BotObservation)=>[...o.publicEvents].reverse().find(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise')?.seatId;
/** Which betting spot this is for the acting player, or null. */
export function spotOf(o:BotObservation):Spot {
 if(!['flop','turn','river'].includes(o.street)||!o.legal.check||!o.legal.canRaise)return null;
 if(o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length!==1)return null;
 const me=o.actingSeat,pfr=preflopRaiser(o)===me;
 if(o.street==='flop')return pfr?'cbet':null;
 const prev=o.street==='turn'?'flop':'turn';
 const aggressor=lastRaiser(o,prev);
 // A caller of a check-raise did not retain the betting initiative.
 if(aggressor!==undefined)return aggressor===me?(o.street==='turn'?'barrel':'river-barrel'):null;
 if(!o.publicEvents.some(e=>e.type==='action'&&e.street===prev))return null;
 if(o.street==='turn')return pfr?'delayed-cbet':preflopRaiser(o)!==undefined?'probe':null;
 return 'stab';
}
/** How readily a personality bets these spots (0 … about 1.1). */
export function aggressionFactor(profile:BotProfile):number {const p=completeProfile(profile);return clamp((.15+1.05*p.aggression)*(.55+.45*p.skill),0,1.1);}
// Chance to bet instead of check, by spot and hand, before the personality factor.
const RATES:Record<Exclude<Spot,null>,{strong:number;medium:number;draw:number;air:number;size:number}>={
 'cbet':{strong:.85,medium:.55,draw:.75,air:.6,size:.45},
 'barrel':{strong:.85,medium:.35,draw:.65,air:.4,size:.66},
 'delayed-cbet':{strong:.85,medium:.45,draw:.6,air:.45,size:.5},
 'probe':{strong:.8,medium:.3,draw:.5,air:.25,size:.5},
 'river-barrel':{strong:.85,medium:.1,draw:0,air:.3,size:.7},
 'stab':{strong:.8,medium:.3,draw:0,air:.3,size:.5},
};
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
export function aggressionPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:Spot} {
 const keep={action,play:null as Spot};
 if(action.type!=='check'||!o.ownCards||o.ownCards.length!==2)return keep;
 const spot=spotOf(o);if(!spot)return keep;
 const p=completeProfile(profile),f=handFeatures(o.ownCards,o.board),r=RATES[spot],k=aggressionFactor(profile);
 const strong=f.made&&!f.playsBoard&&f.strength>=.68;
 const substantialDraw=f.draw>=.3||['open-ended','double-gutshot'].includes(f.drawClass);
 const kind=strong?'strong':substantialDraw?'draw':f.made||f.strength>=.5?'medium':'air';
 // Skilled players save air bets for boards that favour them: fewer on wet flops.
 const texture=kind==='air'&&o.street==='flop'?1-.6*f.wetness*p.skill:1;
 if(draw(random)>=clamp(r[kind]*k*texture))return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,unit=o.chipUnit??1,size=spot==='cbet'&&f.wetness<.25?.33:r.size;
 const to=Math.round((own.streetCommitted+o.pot*size)/unit)*unit;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:spot};
}
