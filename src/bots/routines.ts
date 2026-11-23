/** Live-game routines at cash tables (layer human-1.15.0).
 * - Breaks: now and then a player steps away for a smoke, a phone call or food and misses 5 to 18
 *   hands. They stay seated and are dealt out of the action: they check when they can and otherwise
 *   fold, and still post their blinds (a simple stand-in for live missed-blind rules). Recreational
 *   players take more breaks than grinders.
 * - Last orbit: a player who decides to go (not after busting) announces it and plays about one more
 *   orbit, a little looser ("last orbit, let's gamble"), before racking up.
 * Pure functions, deterministic per session, seat occupant and hand count. Designed, not fitted. */
import type {BotProfile} from '../contracts';
import {completeProfile} from './profiles';

const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
/** Chance per hand of starting a break: about 1 in 110 for the weakest players, 1 in 400 for the best. */
export const breakChance=(profile:BotProfile)=>1/(110+290*completeProfile(profile).skill);
const MIN=5,SPAN=14,EARLY=10;
/** Length of a break that starts at this hand, in hands (5 to 18). */
const breakLength=(key:string,start:number)=>MIN+Math.floor(unit(`${key}:${start}:len`)*SPAN);
/** Whether the player is on a break at hand `index` (the number of hands this occupant has already
 * played this session), and whether it starts or ends here. `key` identifies the session and occupant. */
export function breakAt(key:string,profile:BotProfile,index:number):{onBreak:boolean;starting:boolean;returning:boolean} {
 const chance=breakChance(profile),gap=MIN+SPAN+EARLY;
 // A start counts only when no other candidate start came within the previous `gap` hands: a local
 // rule, so every hand gets the same answer whichever hand asks, and breaks never overlap.
 const raw=(s:number)=>s>=EARLY&&unit(`${key}:${s}:break`)<chance;
 const valid=(s:number)=>{if(!raw(s))return false;for(let t=Math.max(EARLY,s-gap);t<s;t++)if(raw(t))return false;return true;};
 let onBreak=false,starting=false,returning=false;
 for(let s=Math.max(EARLY,index-(MIN+SPAN));s<=index;s++){
  if(!valid(s))continue;const end=s+breakLength(key,s);
  if(index>=s&&index<end){onBreak=true;starting=index===s;}else if(index===end)returning=true;
 }
 return {onBreak,starting,returning};
}
/** Last-orbit lines. */
export const LAST_ORBIT_LINES=['Last orbit for me.','One more time around, then I’m done.','Dealing me two more blinds, then I’m out.'];
export const BREAK_LINES={leave:['is taking a break.','steps away from the table.','goes for a smoke.','takes a phone call.'],back:['is back.','sits back down.']};
export const pickLine=(lines:readonly string[],seed:string)=>lines[Math.floor(unit(seed)*lines.length)];
