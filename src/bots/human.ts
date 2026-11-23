/** Human touches layered on top of any bot decision: mood (tilt and confidence) from a player's
 * own recent public results, human-looking bet amounts with size tells, and think time.
 * Designed behaviour for practice realism, not a model fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile,Card} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

export const HUMAN_LAYER_VERSION='human-1.0.0';
/** 1.1.0 = 1.0.0 plus session moods (stuck, winning, fatigue) and reads on Hero. */
export const HUMAN_LAYER_V11='human-1.1.0';
/** 1.2.0 = 1.1.0 plus live-player habits (limp-calls, min-raises, donk bets, traps, overbet tells, floats, delayed bets). */
export const HUMAN_LAYER_V12='human-1.2.0';
/** 1.3.0 = 1.2.0 plus table churn (rebuys, top-ups, players leaving and new players sitting down). */
export const HUMAN_LAYER_V13='human-1.3.0';
/** 1.4.0 = 1.3.0 plus buy-in styles, stack-depth play, and players reading each other. */
export const HUMAN_LAYER_V14='human-1.4.0';
/** 1.5.0 = 1.4.0 plus live straddles: who straddles, and how players treat a straddled pot. */
export const HUMAN_LAYER_V15='human-1.5.0';
/** 1.6.0 = 1.5.0 plus multiway-pot discipline and per-player bet-size habits (tells). */
export const HUMAN_LAYER_V16='human-1.6.0';
/** 1.7.0 = 1.6.0 plus table image from showdowns and reactions to scare cards and board texture. */
export const HUMAN_LAYER_V17='human-1.7.0';
/** 1.8.0 = 1.7.0 plus preflop raising wars (light 3-bets, squeezes, 3-bet defence, 4-bet bluffs) and heads-up aggression (c-bets, barrels, delayed c-bets, probes). */
export const HUMAN_LAYER_V18='human-1.8.0';
/** 1.9.0 = 1.8.0 plus postflop fights (check-raises, raises, floats, take-aways) and river decisions (thin value, hero calls, big folds). */
export const HUMAN_LAYER_V19='human-1.9.0';
/** 1.10.0 = 1.9.0 plus the realism-audit calibration and rivalries (grudges) between players. */
export const HUMAN_LAYER_V110='human-1.10.0';
/** 1.11.0 = 1.10.0 plus turn and river initiative (closing the showdown gap found by the audit). */
export const HUMAN_LAYER_V111='human-1.11.0';
/** 1.12.0 = 1.11.0 plus signature leaks (one or two lasting flaws per player) and recreational quirks (limp-reraises, over-limps, junk big-blind defends, flop leads, river blocker bets). */
export const HUMAN_LAYER_V112='human-1.12.0';
/** 1.13.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V113='human-1.13.0';
/** 1.14.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V114='human-1.14.0';
/** 1.15.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V115='human-1.15.0';
/** 1.16.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V116='human-1.16.0';
/** 1.17.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V117='human-1.17.0';
/** 1.18.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V118='human-1.18.0';
/** 1.19.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V119='human-1.19.0';
/** 1.20.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V120='human-1.20.0';
/** 1.21.0: see MODEL_CARDS.md. */
export const HUMAN_LAYER_V121='human-1.21.0';

/** One finished hand from one player's point of view, in big blinds. */
export interface HandResult {deltaBB:number;/** Lost chips with cards still live at the end (showdown or all-in). */showdownLoss:boolean;/** Change as a share of the starting stack (−1 = lost everything). */share?:number;}
export interface Mood {/** 0 calm … 1 full tilt. */tilt:number;/** 0 neutral … 1 running hot. */heater:number;
 /** Session or stack state (layer 1.1.0 / policy 2.4.0 only), each 0 … 1. */
 stuck?:number;winning?:number;fatigue?:number;desperate?:number;bigStack?:number;}
export const CALM:Mood=Object.freeze({tilt:0,heater:0});

/** Result of each seat in a finished hand (public end-of-hand facts only). */
export function handResults(seats:readonly {id:number;startingStack:number;stack:number;folded:boolean}[],bigBlind:number):Map<number,HandResult> {
 const out=new Map<number,HandResult>();
 for(const seat of seats){if(seat.startingStack<=0)continue;const delta=(seat.stack-seat.startingStack)/bigBlind;out.set(seat.id,{deltaBB:delta,showdownLoss:delta<0&&!seat.folded,share:(seat.stack-seat.startingStack)/seat.startingStack});}
 return out;
}
/** How easily a personality tilts: weaker, error-prone, risk-loving players tilt; strong regulars barely do. */
export function tiltProneness(profile:BotProfile):number {const p=completeProfile(profile);return clamp((1-p.skill)*.9+p.traits.mistakeRate*.6+(p.traits.riskTolerance-.5)*.3,.05,1);}
/** Mood from the player's last hands, oldest first. Big losses at showdown tilt; big wins add confidence; both fade. */
export function moodFrom(results:readonly HandResult[],profile:BotProfile):Mood {
 const prone=tiltProneness(profile);let tilt=0,heater=0;
 for(const r of results.slice(-8)){
  tilt*=.72;heater*=.8;
  // A big pot is big in big blinds (cash, deep stacks) or as a share of the stack (short tournament stacks).
  const loss=Math.max(-r.deltaBB/30,-(r.share??0)/.6),gain=Math.max(r.deltaBB/30,(r.share??0)/.8);
  if(loss>=.5)tilt+=(r.showdownLoss?.55:.3)*Math.min(1.6,loss);
  else if(loss>=.2&&r.showdownLoss)tilt+=.15;
  if(gain>=.5)heater+=.35*Math.min(1.5,gain);
  if(r.deltaBB>0)tilt*=.8;
 }
 return {tilt:clamp(tilt*prone),heater:clamp(heater*(.6+.4*(1-completeProfile(profile).skill)))};
}
/** The same player in this mood: tilt loosens, adds aggression, bluffs and mistakes; a heater adds swagger. */
export function moodProfile(profile:BotProfile,mood:Mood):BotProfile {
 const extra=(mood.stuck??0)+(mood.winning??0)+(mood.fatigue??0)+(mood.desperate??0)+(mood.bigStack??0);
 if(mood.tilt<=0&&mood.heater<=0&&extra<=0)return profile;
 const base=mood.tilt<=0&&mood.heater<=0?completeProfile(profile):tiltProfile(profile,mood);
 return extra>0?sessionProfile(base,mood):base;
}
function tiltProfile(profile:BotProfile,mood:Mood):BotProfile {
 const p=completeProfile(profile),t=mood.tilt,h=mood.heater,tr=p.traits;
 return {...p,aggression:clamp(p.aggression+.22*t+.1*h),looseness:clamp(p.looseness+.32*t+.08*h),traits:{...tr,
  bluffFrequency:clamp(tr.bluffFrequency+.25*t+.06*h),mistakeRate:clamp(tr.mistakeRate+.22*t),valueThreshold:clamp(tr.valueThreshold-.1*t),
  riverCuriosity:clamp(tr.riverCuriosity+.15*t),riskTolerance:clamp(tr.riskTolerance+.2*t+.08*h),sizingAggression:clamp(tr.sizingAggression+.18*t+.05*h),multiwayCaution:clamp(tr.multiwayCaution-.15*t)}};
}

const pow10=(n:number)=>Math.pow(10,Math.floor(Math.log10(Math.max(1,n))));
/** A round amount a person would say out loud: 2,350 → 2,400; $37.40 → $35; 11,500 → 12,000. */
export function roundStep(amount:number,unit:number,coarse=false):number {
 const p=pow10(amount),m=amount/p,step=(m<2.5?p/10:p/2)*(coarse?2:1);
 return Math.max(unit,Math.round(step/unit)*unit);
}
const isPremium=(cards:Card[])=>{const r=cards.map(c=>'23456789TJQKA'.indexOf(c[0])+2).sort((a,b)=>b-a);return (r[0]===r[1]&&r[0]>=12)||(r[0]===14&&r[1]===13);};

/** Turn a decided raise into a human-looking amount. Calls, checks and folds are unchanged.
 * Weaker players give size tells: bigger with strong hands, smaller with draws and bluffs. */
/** `withTells` false (layer 1.6.0, policy 2.9.0): the per-player sizing habits in sizing-tells.ts replace the generic tell here. */
export function humanSizing(observation:BotObservation,profile:BotProfile,action:Action,random:()=>number,withTells=true):Action {
 if(action.type!=='raise'||!observation.legal.canRaise)return action;
 const o=observation,legal=o.legal,p=completeProfile(profile),own=o.seats.find(s=>s.id===o.actingSeat)!;
 const min=legal.minRaiseTo!,max=legal.maxRaiseTo!,unit=o.chipUnit??1,facing=Math.max(0,...o.seats.map(s=>s.streetCommitted));
 if(legal.shortAllInTo!==null||action.to>=max)return action;
 let to=action.to;
 // Size tells from weaker players only; strong players stay balanced.
 const tells=clamp((.55-p.skill)*2.2);
 if(withTells&&tells>0&&random()<.85){
  const extra=to-facing,f=o.street==='preflop'?{strength:isPremium(o.ownCards)?1:.4,draw:0}:handFeatures(o.ownCards,o.board);
  const scale=f.strength>=.78?1+.45*tells:f.draw>=.3||f.strength<.35?1-.3*tells:1;
  to=facing+extra*scale;
 }
 const coarse=p.skill<.45&&random()<.6,step=roundStep(to,unit,coarse);
 to=Math.round(to/step)*step;
 // Nobody leaves a sliver behind: close to all-in means all-in.
 if(to>=.82*(own.stack+own.streetCommitted))return {type:'raise',to:max};
 to=Math.min(max,Math.max(min,to));
 if(to%unit)to=Math.min(max,Math.ceil(to/unit)*unit);
 return {type:'raise',to};
}

/** A stable personal tempo from the personality: some players act quickly, some take their time. 0.7–1.45. */
export function personalTempo(profile:BotProfile):number {
 const id=profile.personalityId??profile.archetype;let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
 const p=completeProfile(profile);return clamp(.7+.6*(h%1000)/1000+.15*(p.skill-.5),.7,1.45);
}
export interface ThinkInput {street:string;action:Action['type'];/** Amount to call as a fraction of the pot before calling. */facing:number;allIn:boolean;/** Pot in big blinds. */potBB:number;}
/** How long a decision takes, as a multiple of the table's normal pace: snap folds, quick calls,
 * long tanks before big all-in or river decisions; tilted players act faster. */
export function thinkFactor(input:ThinkInput,profile:BotProfile,mood:Mood,random:()=>number):number {
 let f=input.action==='fold'?(input.facing<.3?.45:1.05):input.action==='check'?.6:input.action==='call'?.95:1.15;
 if(input.street==='river'&&input.action!=='check')f*=1.3;
 if(input.facing>=.75)f*=1.25+.5*Math.min(1,input.facing-.75);
 if(input.allIn)f*=1.9;
 if(input.potBB>=40)f*=1.15;
 f*=personalTempo(profile)*(1-.4*mood.tilt);
 // Occasional long tank, occasional snap.
 const r=random();if(r<.07&&input.action!=='check')f*=1.8;else if(r>.93)f*=.6;
 return clamp(f*(.8+.4*random()),.3,4.5);
}

/** Session facts for one cash opponent since they sat down with this personality. */
export interface SessionFacts {hands:number;netBB:number;}
/** Stuck players chase, winners lock up (strong) or splash around (weak), long sessions get sloppy. */
export function sessionMood(facts:SessionFacts,profile:BotProfile):Pick<Mood,'stuck'|'winning'|'fatigue'> {
 const p=completeProfile(profile),prone=tiltProneness(p);
 return {stuck:clamp((-facts.netBB-40)/120)*prone,winning:clamp((facts.netBB-60)/150),fatigue:clamp((facts.hands-150)/250)*(1-p.skill)};
}
/** Tournament stack state: short stacks get desperate, big stacks get comfortable. */
export function stackMood(depthBB:number,relativeToAverage:number):Pick<Mood,'desperate'|'bigStack'> {
 return {desperate:depthBB<=10&&relativeToAverage<.5?clamp((10-depthBB)/6+.3):0,bigStack:clamp((relativeToAverage-2)/2)};
}
function sessionProfile(profile:BotProfile,mood:Mood):BotProfile {
 const p=completeProfile(profile),tr={...p.traits},s=mood.stuck??0,w=mood.winning??0,f=mood.fatigue??0,d=mood.desperate??0,b=mood.bigStack??0,weak=p.skill<.55;
 let looseness=p.looseness,aggression=p.aggression;
 // Chasing losses.
 looseness+=.15*s;tr.riskTolerance+=.2*s;tr.mistakeRate+=.08*s;tr.riverCuriosity+=.1*s;
 // Winning: strong players protect it, weak players play with house money.
 if(weak){looseness+=.1*w;tr.bluffFrequency+=.08*w;}else{looseness-=.08*w;tr.riskTolerance-=.12*w;}
 // Fatigue.
 tr.mistakeRate+=.1*f;tr.positionAwareness-=.12*f;tr.sizeSensitivity-=.08*f;
 // Short-stack desperation: weak risk-takers panic, weak cautious players freeze and blind away.
 if(weak&&d>0){const panic=tr.riskTolerance>=.5;looseness+=(panic?.15:-.12)*d;tr.riskTolerance+=(panic?.2:-.15)*d;}
 // Big stack: weak players loosen up, everyone leans on the table a little.
 if(weak){looseness+=.1*b;aggression+=.08*b;}else aggression+=.05*b;
 for(const k of Object.keys(tr) as (keyof typeof tr)[])tr[k]=clamp(tr[k]);
 return {...p,looseness:clamp(looseness),aggression:clamp(aggression),traits:tr};
}
