/** Betting in passive pots (cash layer human-1.16.0, tournament policy 2.19.0). The patch-47 audit
 * found about half of all showdowns were checked down, mostly in multiway pots that nobody bet,
 * which kept calling stations near 50% went-to-showdown. In live games, when three or more players
 * check to the last player, that player usually takes a stab with any pair or draw ("someone has to
 * bet"). This adds that: the last to act in a checked-around multiway pot bets about half the pot
 * with a pair or a draw, more often for aggressive players. Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
export function passivePotPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:'passive-pot-stab'|null} {
 const keep={action,play:null as 'passive-pot-stab'|null};
 if(o.street==='preflop'||!o.legal.check||action.type!=='check'||!o.legal.canRaise||!o.ownCards||o.ownCards.length!==2)return keep;
 const others=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded&&!s.allIn);if(others.length<2)return keep;
 const here=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street);
 // Everyone else has checked this street: this player closes the action.
 if(!others.every(s=>here.some(e=>e.seatId===s.id&&e.action?.type==='check'))||here.some(e=>e.action?.type!=='check'))return keep;
 const f=handFeatures(o.ownCards,o.board);if(f.strength<.3&&f.draw<.2)return keep;
 const p=completeProfile(profile),chance=clamp(.4*(.4+.6*p.aggression)*(1-.25*(others.length-2)));
 if(draw(random)>=chance)return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*.45)/u)*u;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'passive-pot-stab'};
}
