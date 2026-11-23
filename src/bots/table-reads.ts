/** Bots read each other (cash layer human-1.4.0, tournament policy 2.7.0): every player at the
 * table, Hero included, builds a public picture of every other player (how often they play a
 * pot, raise, limp, bet after the flop and go to showdown) and labels the obvious types: the
 * maniac, the nit, the calling station, the loose limper. Players then adjust to the opponent
 * that matters in the spot: they isolate weak limpers, steal from tight blinds, call a maniac
 * down lighter, believe a nit, and stop bluffing a station. Public actions only, deterministic.
 * Designed adjustments, not a solver or a fitted model. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {addHand,emptyReads,exploitStrength,readsProfile,type HeroReads,type Rate,type ReadableHand} from './reads';

export interface PlayerRead {
 hands:number;
 /** Put money in voluntarily before the flop. */vpip:Rate;
 /** Raised before the flop. */pfr:Rate;
 /** Called first in before the flop (open-limped). */limp:Rate;
 /** The same public reads kept on Hero, now kept on everyone. */reads:HeroReads;
}
export type PlayerType='maniac'|'nit'|'station'|'limper'|'solid'|'unknown';
export const TYPE_NAMES:Record<PlayerType,string>={maniac:'maniac',nit:'nit',station:'calling station',limper:'loose limper',solid:'solid player',unknown:'unknown'};
const zero=():Rate=>({count:0,chances:0});
const hit=(r:Rate,yes:boolean)=>{r.chances++;if(yes)r.count++;};
export const emptyPlayerRead=():PlayerRead=>({hands:0,vpip:zero(),pfr:zero(),limp:zero(),reads:emptyReads()});

/** Add one finished hand to the read on `seat`. */
export function addPlayerHand(read:PlayerRead,hand:ReadableHand,seat:number):void {
 const me=hand.seats.find(s=>s.id===seat);if(!me||me.startingStack<=0)return;
 read.hands++;addHand(read.reads,hand,seat);
 const pre=hand.events.filter(e=>e.type==='action'&&e.street==='preflop');
 let raises=0,limps=0,first=true,voluntary=false,raised=false,acted=false;
 for(const e of pre){
  const t=e.action!.type;
  if(e.seatId===seat){
   acted=true;
   if(t==='call'||t==='raise')voluntary=true;
   if(t==='raise')raised=true;
   // Only an unopened first-in decision offers an open-limp opportunity.
   // Overlimps, calls facing raises and a big blind's check are not open limps.
   if(first&&raises===0&&limps===0&&t!=='check')hit(read.limp,t==='call');
   first=false;
  }
  if(t==='raise')raises++;
  else if(t==='call'&&raises===0)limps++;
 }
 // Forced all-ins with no preflop decision offer no VPIP/PFR opportunity.
 if(acted){hit(read.vpip,voluntary);hit(read.pfr,raised);}
}
export function playerReadsFromHands(hands:Iterable<ReadableHand>,seat:number):PlayerRead {const r=emptyPlayerRead();for(const h of hands)addPlayerHand(r,h,seat);return r;}

/** A rate shrunk toward a typical value until there are enough chances. */
const shrunk=(r:Rate,prior:number,weight=15)=>(r.count+prior*weight)/(r.chances+weight);
/** The obvious label a table would put on this player, or 'unknown' before about a dozen hands. */
export function playerType(read:PlayerRead|undefined):PlayerType {
 if(!read||read.hands<12)return 'unknown';
 const vpip=shrunk(read.vpip,.28),pfr=shrunk(read.pfr,.15),limp=shrunk(read.limp,.08),agg=shrunk(read.reads.aggression,.35,10),wtsd=shrunk(read.reads.wtsd,.3,10);
 if(vpip>=.42&&pfr>=.26)return 'maniac';
 if(vpip<=.15)return 'nit';
 if(vpip>=.34&&agg<=.24&&wtsd>=.36)return 'station';
 if(vpip>=.34&&pfr<=.12&&limp>=.15)return 'limper';
 return 'solid';
}
/** How readily a personality acts on obvious types: everyone notices a maniac, but strong adaptive
 * players use it fully. Confidence grows with hands seen. */
export function typeStrength(profile:BotProfile,read:PlayerRead):number {return clamp(.25+.75*exploitStrength(profile))*clamp((read.hands-8)/30);}

type Acts=BotObservation['publicEvents'];
const actionsOn=(o:BotObservation,street:string):Acts=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street);
/** The opponent who matters most in this spot: the last raiser if facing one, otherwise the player
 * still to act behind in the blinds (before the flop) or the only opponent left (after it). */
export function keyOpponent(o:BotObservation):number|null {
 const here=actionsOn(o,o.street),raises=here.filter(e=>e.action?.type==='raise'&&e.seatId!==o.actingSeat),live=o.seats.filter(s=>s.stack+s.totalCommitted>0&&!s.folded&&s.id!==o.actingSeat);
 if(!o.legal.check&&raises.length){const id=raises.at(-1)!.seatId!;return live.some(s=>s.id===id)?id:null;}
 if(o.street==='preflop'){
  // A limped pot is not a blind-steal opportunity; isolation is handled separately.
  if(here.some(e=>e.action?.type==='call'))return null;
  const acted=new Set(here.map(e=>e.seatId)),blinds=o.publicEvents.filter(e=>e.type==='blind'&&e.seatId!==o.actingSeat&&!acted.has(e.seatId)&&live.some(s=>s.id===e.seatId&&!s.allIn&&s.stack>0)).map(e=>e.seatId!);
  return blinds.at(-1)??null;
 }
 return live.length===1&&!live[0].allIn?live[0].id:null;
}

export interface TableReadsEffect {target:number|null;type:PlayerType;applied:string[];}
/** The same player adjusted to the opponent that matters. Hero's own reads layer is applied before
 * this one, so when the opponent is Hero only the type adjustments are added here. */
export function tableReadsProfile(o:BotObservation,profile:BotProfile,reads:Readonly<Record<number,PlayerRead>>|null|undefined,hero=0):{profile:BotProfile;effect:TableReadsEffect|null} {
 if(!reads)return {profile,effect:null};
 const target=keyOpponent(o);if(target===null)return {profile,effect:null};
 const read=reads[target];if(!read)return {profile,effect:null};
 const applied:string[]=[];let playing=profile;
 // The reads kept on Hero, now kept on whoever the opponent is.
 if(target!==hero){const r=readsProfile(o,playing,read.reads,target);if(r.effect){playing=r.profile;applied.push(...r.effect.applied);}}
 const type=playerType(read),k=typeStrength(playing,read);
 if(type==='unknown'||type==='solid'||k<.05)return applied.length?{profile:playing,effect:{target,type,applied}}:{profile,effect:null};
 const p=completeProfile(playing),t={...p.traits};let looseness=p.looseness,aggression=p.aggression;
 // Before the flop the blinds are not a bet to face: only a raise is.
 const pre=o.street==='preflop',facing=pre?actionsOn(o,'preflop').some(e=>e.action?.type==='raise'&&e.seatId!==o.actingSeat):!o.legal.check;
 if(pre&&facing){
  // A maniac's raise is wide: re-raise and call wider. A nit's raise is strong: fold more.
  if(type==='maniac'){looseness=clamp(looseness+.18*k);aggression=clamp(aggression+.12*k);t.riskTolerance=clamp(t.riskTolerance+.15*k);applied.push('widen-vs-maniac');}
  if(type==='nit'){looseness=clamp(looseness-.22*k);t.riskTolerance=clamp(t.riskTolerance-.15*k);applied.push('respect-nit-raise');}
 }else if(pre){
  // Stealing into the blinds: tight blinds give it up, stations and maniacs fight back.
  if(type==='nit'){looseness=clamp(looseness+.2*k);t.bluffFrequency=clamp(t.bluffFrequency+.15*k);applied.push('steal-vs-nit');}
  if(type==='station'||type==='maniac'){looseness=clamp(looseness-.1*k);applied.push('no-steal');}
 }else if(facing){
  // Facing a bet: call a maniac down, believe a nit; a station who bets has it.
  if(type==='maniac'){t.riverCuriosity=clamp(t.riverCuriosity+.3*k);t.drawCalling=clamp(t.drawCalling+.15*k);t.sizeSensitivity=clamp(t.sizeSensitivity-.2*k);applied.push('call-down-maniac');}
  if(type==='nit'||type==='station'){t.riverCuriosity=clamp(t.riverCuriosity-.3*k);t.sizeSensitivity=clamp(t.sizeSensitivity+.2*k);applied.push(type==='nit'?'believe-nit':'believe-station');}
 }else{
  // Heads-up and checked to: never bluff a station, value-bet it thinly; bluff a nit; let a maniac bluff.
  if(type==='station'){t.bluffFrequency=clamp(t.bluffFrequency-.45*k);t.valueThreshold=clamp(t.valueThreshold-.12*k);applied.push('value-only-vs-station');}
  if(type==='nit'){t.bluffFrequency=clamp(t.bluffFrequency+.25*k);applied.push('bluff-nit');}
  if(type==='maniac'){t.slowPlay=clamp(t.slowPlay+.3*k);t.bluffFrequency=clamp(t.bluffFrequency-.2*k);applied.push('trap-maniac');}
 }
 if(!applied.length)return {profile,effect:null};
 return {profile:{...p,looseness,aggression,traits:t},effect:{target,type,applied}};
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Isolation raise: with one or more weak limpers in an unopened pot, raise to about four big blinds
 * plus one per limper with a playable hand, instead of limping behind or folding. */
export function isolate(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,PlayerRead>>|null|undefined,random:()=>number):{action:Action;isolated:boolean} {
 const keep={action,isolated:false};
 if(!reads||o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||!o.legal.canRaise||action.type==='raise')return keep;
 const pre=actionsOn(o,'preflop');if(pre.some(e=>e.action?.type==='raise'))return keep;
 const limpers=pre.filter(e=>e.action?.type==='call'&&e.seatId!==o.actingSeat&&o.seats.some(s=>s.id===e.seatId&&!s.folded)).map(e=>e.seatId!);
 if(!limpers.length||limpers.length>3)return keep;
 const weak=limpers.filter(id=>{const t=playerType(reads[id]);return t==='limper'||t==='station';});if(!weak.length)return keep;
 const k=Math.max(...weak.map(id=>typeStrength(profile,reads[id]))),p=completeProfile(profile),strength=handFeatures(o.ownCards,o.board).strength;
 const need=action.type==='fold'?.62:.5;if(strength<need-.08*p.aggression)return keep;
 if(draw(random)>=clamp(k*(.35+.6*p.aggression)))return keep;
 const unit=o.chipUnit??1,to=Math.round(o.bigBlind*(4+limpers.length)/unit)*unit;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},isolated:true};
}
/** Answering a single opening raise from an obvious type: re-raise or call a maniac's open with good
 * hands instead of folding, and let go of non-premium hands against a nit's open. */
export function answerRaise(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,PlayerRead>>|null|undefined,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(!reads||o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||o.legal.check||o.legal.callAmount<=0)return keep;
 const raises=actionsOn(o,'preflop').filter(e=>e.action?.type==='raise');if(raises.length!==1||raises[0].seatId===o.actingSeat)return keep;
 const opener=raises[0].seatId!,read=reads[opener],type=playerType(read);if(type!=='maniac'&&type!=='nit')return keep;
 const k=typeStrength(profile,read!),p=completeProfile(profile),strength=handFeatures(o.ownCards,o.board).strength;
 if(type==='maniac'&&action.type==='fold'&&strength>=.5&&draw(random)<clamp(k*(.4+.5*p.aggression))){
  const opened=(raises[0].action as {to:number}).to,unit=o.chipUnit??1;
  if(o.legal.canRaise&&(strength>=.62||draw(random)<p.aggression*.6)){const to=Math.round(opened*3/unit)*unit;return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'3bet-maniac'};}
  return {action:{type:'call'},play:'call-maniac'};
 }
 if(type==='nit'&&(action.type==='call'||action.type==='raise')&&strength<.78&&draw(random)<clamp(k*(.3+.5*p.skill)))return {action:o.legal.check?{type:'check'}:{type:'fold'},play:'fold-to-nit'};
 return keep;
}
