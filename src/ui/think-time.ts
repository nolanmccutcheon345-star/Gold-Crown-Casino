/** How long a computer player takes over the decision just prepared, as a multiple of the table's
 * normal pace. Visual only: the decision is already saved. Tables and events from before the human
 * layer keep the fixed pace. */
import type {Action,BotProfile,GameState} from '../contracts';
import {cashBreak} from '../session/human-context';
import {POLICY_VERSION} from '../bots/profiles';
import {liveTells} from '../bots/tells';
import {CALM,moodFrom,personalTempo,thinkFactor,type Mood} from '../bots/human';
import type {ActiveTable,AppData} from '../session/types';
import {cashRecentResults} from '../session/human-context';
import type {TournamentEvent} from '../tournament/runtime';
import {tournamentRecent} from '../tournament/runtime';
import {mttProfileAt} from '../tournament/mtt-event';
import {policyUsesMood} from '../tournament/bot-policy';

export function decisionFactor(game:GameState,action:Action,profile:BotProfile,mood:Mood,random:()=>number=Math.random):number {
 const seat=game.seats.find(s=>s.id===game.actor);if(!seat)return 1;
 const top=Math.max(0,...game.seats.map(s=>s.streetCommitted)),toCall=Math.max(0,top-seat.streetCommitted),pot=Math.max(1,game.pot);
 const allIn=(action.type==='raise'&&action.to>=seat.stack+seat.streetCommitted)||(action.type==='call'&&toCall>=seat.stack);
 const base=thinkFactor({street:game.street,action:action.type,facing:toCall/pot,allIn,potBB:pot/game.profile.bigBlind},profile,mood,random);
 // Patch 64: a timing tell, when this player gives one on this decision.
 const tell=liveTells(game,profile,action)?.timing;
 return tell?Math.min(5,Math.max(.25,base*tell)):base;
}
export function cashThinkFactor(active:ActiveTable|null|undefined,data?:AppData|null):number {
 if(!active||!active.humanLayer||!active.pending?.decision)return 1;
 const seat=active.pending.seatId,profile=active.profiles[seat];if(!profile||profile.policyVersion!==POLICY_VERSION)return 1;
 // Layer 1.15.0: the dealer folds a player on a break straight away.
 if(data&&Number(active.humanLayer.split('.')[1]??0)>=15&&cashBreak(data.hands,active,seat,data.humanMemory).onBreak)return .25;
 const mood=data?moodFrom(cashRecentResults(data.hands,active,seat),profile):CALM;
 return decisionFactor(active.game,active.pending.decision.action,profile,mood);
}
export function tournamentThinkFactor(event:TournamentEvent):number {
 if(!policyUsesMood(event.tournamentPolicyVersion)||!event.pending?.decision||event.game.actor===null)return 1;
 const seat=event.game.actor,profile=event.mtt?mttProfileAt(event,seat):event.profiles[seat];
 return decisionFactor(event.game,event.pending.decision.action,profile,moodFrom(tournamentRecent(event,seat)??[],profile));
}

/** Patch 94: think time in milliseconds at the normal pace (900 ms a step). Easy decisions are snapped: a small
 * fold in a quarter to half a second, a check or a small call in under a second. Hard ones (a big bet to face,
 * the river, all in, a big pot, a raise war) take three to eight seconds and now and then longer. When the player
 * gives a visible tell (a cue or a remark) while deciding, they take at least READ_HOLD_MS so you can see it.
 * Display only: the decision is already saved. */
export const READ_HOLD_MS=2600,MIN_THINK_MS=250,MAX_THINK_MS=12000;
export interface ThinkPlan {ms:number;/** 0 (easy) to 1 (very hard). */difficulty:number;snap:boolean;/** A cue or a remark shows while they think. */visibleTell:boolean;}
export function difficultyOf(game:GameState,action:Action):number {
 const seat=game.seats.find(s=>s.id===game.actor);if(!seat)return 0;
 const top=Math.max(0,...game.seats.map(s=>s.streetCommitted)),toCall=Math.max(0,top-seat.streetCommitted),pot=Math.max(1,game.pot),facing=toCall/pot,bb=game.profile.bigBlind;
 const allIn=(action.type==='raise'&&action.to>=seat.stack+seat.streetCommitted)||(toCall>0&&toCall>=seat.stack);
 const raises=game.events.filter(e=>e.type==='action'&&e.street===game.street&&e.action?.type==='raise').length;
 let d=0;
 if(toCall>0){d+=facing>=1?.45:facing>=.6?.35:facing>=.35?.2:facing>=.15?.08:0;}
 if(game.street==='river')d+=.18;else if(game.street==='turn')d+=.08;
 if(allIn)d+=.35;
 const potBB=pot/bb;if(potBB>=100)d+=.25;else if(potBB>=40)d+=.15;else if(potBB>=20)d+=.05;
 if(raises>=2)d+=.15;
 if(toCall>=.4*seat.stack&&toCall>0)d+=.15;
 // Folding a hand to a small bet, or before anyone has put much in, is not a hard decision.
 if(action.type==='fold'&&(facing<.35||(game.street==='preflop'&&raises<=1&&toCall<=4*bb)))d=Math.min(d,.1);
 if(action.type==='check')d=Math.min(d,.25);
 return Math.max(0,Math.min(1,d));
}
export function thinkPlan(game:GameState,action:Action,profile:BotProfile,mood:Mood,random:()=>number=Math.random):ThinkPlan {
 const d=difficultyOf(game,action),tempo=personalTempo(profile),tilt=1-.35*mood.tilt,r=random(),jitter=.8+.4*random();
 const tells=liveTells(game,profile,action),visibleTell=!!(tells?.cue||(tells?.speech&&action.type==='call'));
 let ms:number,snap=false;
 if(d<.2&&action.type==='fold'){ms=250+350*random();snap=true;}
 else if(d<.2&&action.type==='check'){ms=400+450*random();snap=true;}
 else if(d<.2&&action.type==='call'){ms=500+600*random();snap=true;}
 else if(d<.2){ms=(800+900*random())*tempo*tilt;}
 else{ms=(1100+6400*Math.pow(d,1.15))*tempo*tilt*jitter;if(d>=.4&&r<.08)ms*=1.6;else if(r>.95)ms*=.5;}
 // The timing tell is kept: a hollywood pause stretches it, a snap shortens it.
 if(tells?.timing)ms*=tells.timing;
 if(visibleTell)ms=Math.max(ms,READ_HOLD_MS);
 return {ms:Math.round(Math.max(MIN_THINK_MS,Math.min(MAX_THINK_MS,ms))),difficulty:d,snap,visibleTell};
}
/** Cash: the plan for the decision waiting to be committed, or null for tables before the human layer. */
export function cashThinkPlan(active:ActiveTable|null|undefined,data?:AppData|null,random:()=>number=Math.random):ThinkPlan|null {
 if(!active||!active.humanLayer||!active.pending?.decision)return null;
 const seat=active.pending.seatId,profile=active.profiles[seat];if(!profile||profile.policyVersion!==POLICY_VERSION)return null;
 if(data&&Number(active.humanLayer.split('.')[1]??0)>=15&&cashBreak(data.hands,active,seat,data.humanMemory).onBreak)return {ms:MIN_THINK_MS,difficulty:0,snap:true,visibleTell:false};
 const mood=data?moodFrom(cashRecentResults(data.hands,active,seat),profile):CALM;
 return thinkPlan(active.game,active.pending.decision.action,profile,mood,random);
}
export function tournamentThinkPlan(event:TournamentEvent,random:()=>number=Math.random):ThinkPlan|null {
 if(!policyUsesMood(event.tournamentPolicyVersion)||!event.pending?.decision||event.game.actor===null)return null;
 const seat=event.game.actor,profile=event.mtt?mttProfileAt(event,seat):event.profiles[seat];
 return thinkPlan(event.game,event.pending.decision.action,profile,moodFrom(tournamentRecent(event,seat)??[],profile),random);
}
/** Scale a plan to the table's pace. Snaps stay snappy at every pace; a visible tell keeps a readable floor
 * except at the fastest pace. `scale` is 1 at the normal pace. */
export function pacedMs(plan:ThinkPlan,scale:number,readFloor:number):number {
 const ms=plan.snap?plan.ms*Math.min(1,Math.max(.5,scale)):plan.ms*scale;
 return Math.round(Math.max(plan.snap?Math.min(180,MIN_THINK_MS*scale):MIN_THINK_MS*scale,plan.visibleTell?Math.max(ms,readFloor):ms));
}
