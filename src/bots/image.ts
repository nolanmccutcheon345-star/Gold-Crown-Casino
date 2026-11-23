/** Table image from showdowns (cash layer human-1.7.0, tournament policy 2.10.0). Players remember
 * what was shown down: a player caught bluffing gets called lighter for a while, and a player who
 * just showed a monster gets more respect. Players who were caught bluffing themselves (good ones)
 * bluff less and value-bet thinner while their image is loose. Images fade over the next hands.
 * Only cards actually revealed at showdown are used. Designed behaviour, not fitted to human data. */
import type {Action,BotObservation,BotProfile,GameEvent,Card} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {keyOpponent} from './table-reads';

/** A finished hand as the table saw it: public actions, the board, and only the revealed cards. */
export interface ShowdownHand {events:readonly GameEvent[];board:readonly string[];payouts:Readonly<Record<number,number>>;revealed:readonly {id:number;hole:readonly string[]}[];}
export interface Image {/** Recent times caught bluffing, faded. */bluff:number;/** Recent monsters shown, faded. */monster:number;}
export const NO_IMAGE:Readonly<Image>=Object.freeze({bluff:0,monster:0});

/** What one showdown says about each revealed player. */
export function showdownImages(hand:ShowdownHand):Map<number,{bluff:boolean;monster:boolean}> {
 const out=new Map<number,{bluff:boolean;monster:boolean}>();
 if(hand.board.length<5||!hand.revealed.length)return out;
 const post=hand.events.filter(e=>e.type==='action'&&['flop','turn','river'].includes(e.street??'')),aggressor=[...post].reverse().find(e=>e.street==='river'&&e.action?.type==='raise')?.seatId;
 for(const r of hand.revealed){
  if(r.hole.length!==2)continue;
  const f=handFeatures([...r.hole] as Card[],[...hand.board] as Card[]),won=(hand.payouts[r.id]??0)>0,bet=post.some(e=>e.seatId===r.id&&e.action?.type==='raise');
  out.set(r.id,{bluff:r.id===aggressor&&!won&&f.strength<.45,monster:bet&&f.made&&!f.playsBoard&&f.strength>=.85});
 }
 return out;
}
/** Faded images for each seat from hands listed oldest first (the last is the most recent). `seatOf`
 * maps a hand index to the seat this player held then (or null when they were not there). */
// A DTO may be mutated by a caller or reused after restore. Object identity alone
// cannot establish that its public showdown contents are unchanged.
const read=new WeakMap<ShowdownHand,{fingerprint:string;value:Map<number,{bluff:boolean;monster:boolean}>}>();
const readOnce=(hand:ShowdownHand)=>{const fingerprint=JSON.stringify(hand),prior=read.get(hand);if(prior?.fingerprint===fingerprint)return prior.value;const value=showdownImages(hand);read.set(hand,{fingerprint,value});return value;};
export function imageFrom(hands:readonly ShowdownHand[],seatOf:(index:number)=>number|null):Image {
 let bluff=0,monster=0;
 for(let i=0;i<hands.length;i++){const seat=seatOf(i);if(seat===null)continue;const age=hands.length-1-i,s=readOnce(hands[i]).get(seat);if(!s)continue;
  if(s.bluff)bluff+=Math.exp(-age/30);if(s.monster)monster+=Math.exp(-age/15);}
 return {bluff,monster};
}

export interface ImageEffect {target:number|null;applied:string[];}
/** Adjust to the key opponent's image, and to this player's own image. */
export function imageProfile(o:BotObservation,profile:BotProfile,images:Readonly<Record<number,Image>>|null|undefined):{profile:BotProfile;effect:ImageEffect|null} {
 if(!images||o.street==='preflop')return {profile,effect:null};
 const p=completeProfile(profile),t={...p.traits},applied:string[]=[],attention=.5+.5*p.skill;
 const target=keyOpponent(o),theirs=target===null?NO_IMAGE:images[target]??NO_IMAGE,facing=!o.legal.check;
 if(facing&&theirs.bluff>.2){const k=clamp(theirs.bluff)*attention;t.riverCuriosity=clamp(t.riverCuriosity+.3*k);t.sizeSensitivity=clamp(t.sizeSensitivity-.15*k);t.drawCalling=clamp(t.drawCalling+.1*k);applied.push('call-caught-bluffer');}
 if(facing&&theirs.monster>.2){const k=clamp(theirs.monster)*attention;t.riverCuriosity=clamp(t.riverCuriosity-.25*k);t.sizeSensitivity=clamp(t.sizeSensitivity+.15*k);applied.push('respect-shown-monster');}
 const mine=images[o.actingSeat]??NO_IMAGE;
 if(mine.bluff>.2&&p.skill>=.5){const k=clamp(mine.bluff)*p.skill;t.bluffFrequency=clamp(t.bluffFrequency-.35*k);t.valueThreshold=clamp(t.valueThreshold-.1*k);applied.push('own-loose-image');}
 if(!applied.length)return {profile,effect:null};
 return {profile:{...p,traits:t},effect:{target,applied}};
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Image plays applied after the decision, facing a bet after the flop: look up a player who was
 * just caught bluffing with a hand that could beat a bluff; let go against a player who just showed
 * a monster unless the hand is strong. */
export function imagePlay(o:BotObservation,profile:BotProfile,action:Action,images:Readonly<Record<number,Image>>|null|undefined,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(!images||o.street==='preflop'||o.legal.check||!o.ownCards||o.ownCards.length!==2)return keep;
 const target=keyOpponent(o);if(target===null)return keep;const theirs=images[target]??NO_IMAGE;
 const p=completeProfile(profile),attention=.5+.5*p.skill,f=handFeatures(o.ownCards,o.board);
 if(action.type==='fold'&&theirs.bluff>.2&&f.strength>=.3&&o.legal.callAmount>0&&draw(random)<clamp(theirs.bluff)*attention*.55)return {action:{type:'call'},play:'look-up-bluffer'};
 if(action.type==='call'&&theirs.monster>.2&&!f.absoluteNuts&&f.strength<.7&&draw(random)<clamp(theirs.monster)*attention*.4)return {action:{type:'fold'},play:'respect-monster'};
 return keep;
}
