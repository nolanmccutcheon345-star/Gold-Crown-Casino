/** Session moods at cash tables (layer human-1.16.0). Players arrive in a mood that lasts the whole
 * session and shapes how they play, how long they stay and what they say when they sit down:
 * - grinding: focused and a bit tighter;
 * - out for fun: looser and splashier, stays longer;
 * - tired: more mistakes, more passive, leaves sooner;
 * - confident: more aggressive.
 * Recreational players are more often out for fun; regulars more often grinding. Fixed per session
 * and seat occupant. Designed, not fitted. Pure functions. */
import type {BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';

export type SessionMood='grinding'|'fun'|'tired'|'confident';
export const SESSION_MOODS:readonly SessionMood[]=Object.freeze(['grinding','fun','tired','confident']);
const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
/** The player's mood for this session; `key` identifies the session and seat occupant. */
export function sessionMoodOf(key:string,profile:BotProfile):SessionMood {
 const p=completeProfile(profile),rec=p.skill<.5;
 const weights:[SessionMood,number][]=rec?[['fun',.45],['tired',.25],['confident',.15],['grinding',.15]]:[['grinding',.45],['tired',.25],['confident',.15],['fun',.15]];
 let r=unit(`${key}:mood`);for(const [m,w] of weights){r-=w;if(r<0)return m;}return weights[0][0];
}
const SHIFT:Readonly<Record<SessionMood,{skill:number;looseness:number;aggression:number}>>={grinding:{skill:.04,looseness:-.03,aggression:0},fun:{skill:-.03,looseness:.08,aggression:.04},tired:{skill:-.08,looseness:.02,aggression:-.06},confident:{skill:0,looseness:.03,aggression:.08}};
/** The profile as the mood plays it. */
export function moodedProfile(profile:BotProfile,mood:SessionMood):BotProfile {
 const p=completeProfile(profile),s=SHIFT[mood];
 return {...profile,skill:clamp(p.skill+s.skill),looseness:clamp(p.looseness+s.looseness),aggression:clamp(p.aggression+s.aggression)};
}
/** How the mood changes the chance of leaving: tired players go sooner, players out for fun stay. */
export const MOOD_LEAVE:Readonly<Record<SessionMood,number>>={grinding:1,fun:.75,tired:1.7,confident:.9};
export const MOOD_LINES:Readonly<Record<SessionMood,readonly string[]>>={grinding:['Just here to grind.','Quiet game tonight, I hope.'],fun:['Let’s gamble!','Here to have some fun, boys.'],tired:['Long day.','One more coffee and I’m good.'],confident:['Feeling lucky tonight.','Who’s ready to pay me off?']};
export const pickMoodLine=(mood:SessionMood,seed:string)=>MOOD_LINES[mood][Math.floor(unit(seed)*MOOD_LINES[mood].length)];
