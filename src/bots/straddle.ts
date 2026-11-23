/** Live straddles (cash layer human-1.5.0). Who straddles under the gun, and how players treat a
 * straddled pot. Loose, aggressive and recreational players straddle; stuck tilt-prone players and
 * players on a heater straddle more; short-stackers and strong tight players rarely do. In a
 * straddled pot everyone treats the straddle as the big blind (opens are sized off it and stacks
 * count in straddles), and recreational players call more because the pot is bigger.
 * Deterministic per hand. Designed behaviour, not fitted to human data. Pure functions. */
import type {BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import type {Mood} from './human';

const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};

/** How often a personality straddles when under the gun. A regular may name it. */
export function straddleRate(profile:BotProfile,mood?:Partial<Mood>,override?:number):number {
 const p=completeProfile(profile);
 const base=override??clamp(.02+.55*Math.max(0,p.looseness-.5)*(.4+p.aggression)+.35*Math.max(0,p.aggression-.6)+.05*(1-p.skill)-.05*p.skill,0,.75);
 const feel=1+1.2*(mood?.tilt??0)+.6*(mood?.heater??0);
 return clamp(base*feel,0,.85);
}
/** This player's straddle decision for the hand after `previousHandId` (deterministic). */
export function decidesToStraddle(profile:BotProfile,previousHandId:string,seat:number,stackBB:number,mood?:Partial<Mood>,override?:number):boolean {
 // Nobody straddles a short stack away: at least 30 big blinds behind.
 if(stackBB<30)return false;
 return unit(`straddle:${previousHandId}:${seat}:${profile.personalityId??''}`)<straddleRate(profile,mood,override);
}
/** Regulars known for straddling (or for never doing it). */
export const REGULAR_STRADDLE:Readonly<Record<string,number>>=Object.freeze({tex:.6,vince:.7,monty:.55,pete:.5,marco:.35,bubba:.3,hiro:0,mei:0,ruth:0,nina:0,gloria:0,hank:0});

/** Before the flop in a straddled pot, players read the straddle as the big blind. */
export function straddledView(o:BotObservation,straddleAmount:number):BotObservation {
 if(o.street!=='preflop')return o;
 return {...o,bigBlind:straddleAmount};
}
/** Recreational players loosen up in a bigger pot; strong players barely change. */
export function straddledProfile(profile:BotProfile):BotProfile {
 const p=completeProfile(profile),k=1-p.skill;
 return {...p,looseness:clamp(p.looseness+.06*k),traits:{...p.traits,drawCalling:clamp(p.traits.drawCalling+.06*k)}};
}
