/** A cash opponent's recent results, for mood. Public end-of-hand facts from this session only,
 * and only while the same personality has held the seat. */
import type {HandResult,SessionFacts} from '../bots/human';
import {handResults} from '../bots/human';
import {readsFromHands,type HeroReads} from '../bots/reads';
import {playerReadsFromHands,type PlayerRead} from '../bots/table-reads';
import {imageFrom,type Image,type ShowdownHand} from '../bots/image';
import {observerInsight,revealedAtShowdown,type InsightHand,type TableInsight} from '../bots/insight';
import {breakAt} from '../bots/routines';
import {memoryFacts,type HumanMemory} from './human-memory';
import {sessionMoodOf,type SessionMood} from '../bots/session-mood';
import type {ActiveTable,StoredHand} from './types';
import {grudgesFrom,type Grudges} from '../bots/rivalry';
import {sizeReadsFrom,type SizeRead} from '../bots/table-craft';
import {tempoReadFrom,type TempoRead} from '../bots/tempo-reads';
import {riverReadFrom,type RiverRead} from '../bots/hero-memory';

export function cashRecentResults(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,seat:number,limit=8):HandResult[] {
 const identity=active.profiles[seat]?.personalityId,out:HandResult[]=[];
 if(!identity)return out;
 for(let i=hands.length-1;i>=0&&out.length<limit;i--){
  const hand=hands[i];if(hand.sessionId!==active.sessionId)break;
  if(hand.privateProfiles?.[seat]?.personalityId!==identity)break;
  const result=handResults(hand.view.seats,hand.view.profile.bigBlind).get(seat);if(result)out.unshift(result);
 }
 return out;
}

/** Hands and net result since this personality sat down in this session (layer 1.1.0). */
export function cashSessionFacts(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,seat:number):SessionFacts {
 const identity=active.profiles[seat]?.personalityId;let count=0,net=0;
 if(!identity)return {hands:0,netBB:0};
 for(let i=hands.length-1;i>=0;i--){
  const hand=hands[i];if(hand.sessionId!==active.sessionId||hand.privateProfiles?.[seat]?.personalityId!==identity)break;
  const r=handResults(hand.view.seats,hand.view.profile.bigBlind).get(seat);if(r){count++;net+=r.deltaBB;}
 }
 return {hands:count,netBB:net};
}
const readsCache=new Map<string,{key:string;reads:HeroReads}>();
/** What this personality has seen Hero do: every saved hand in which it sat at Hero's table
 * (any session; identities persist between sessions), most recent 400. Public actions only. */
export function cashReads(hands:readonly StoredHand[],active:Pick<ActiveTable,'profiles'>,seat:number):HeroReads|null {
 const identity=active.profiles[seat]?.personalityId;if(!identity)return null;
 const key=`${hands.length}:${hands.at(-1)?.id??''}`,cached=readsCache.get(identity);if(cached?.key===key)return cached.reads;
 const seen:StoredHand[]=[];
 for(let i=hands.length-1;i>=0&&seen.length<400;i--){const hand=hands[i];if(Object.values(hand.privateProfiles??{}).some(p=>p.personalityId===identity))seen.push(hand);}
 const reads=readsFromHands(seen.reverse().map(hand=>hand.view),0);
 if(readsCache.size>64)readsCache.clear();readsCache.set(identity,{key,reads});
 return reads;
}
/** Layer 1.4.0: reads the acting observer actually witnessed during the current
 * uninterrupted seat assignments. Fixed at the latest 120 canonical hands so a
 * full-history load and the compact resident tail produce identical decisions.
 * Identity metadata selects witnesses; only public views supply behavior. */
export function cashTableReads(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,observerSeat=0):Record<number,PlayerRead> {
 const seats=[0,...Object.keys(active.profiles).map(Number).filter(seat=>seat!==0)],identity=(seat:number)=>seat===0?'hero':active.profiles[seat]?.personalityId;
 const observer=identity(observerSeat),out:Record<number,PlayerRead>={};
 const seated=(hand:StoredHand,seat:number,id:string|undefined)=>!!id&&hand.view.seats.some(s=>s.id===seat&&s.startingStack>0)&&(seat===0||hand.privateProfiles?.[seat]?.personalityId===id);
 for(const seat of seats){
  const id=identity(seat),seen:StoredHand[]=[];
  for(let i=hands.length-1;i>=Math.max(0,hands.length-120);i--){
   const hand=hands[i];
   if(hand.sessionId!==active.sessionId||!seated(hand,observerSeat,observer)||!seated(hand,seat,id))break;
   seen.push(hand);
  }
  out[seat]=playerReadsFromHands(seen.reverse().map(hand=>hand.view),seat);
 }
 return out;
}

/** Exact public-content cache, not a session/length/hand-ID cache. A restored save with
 * changed public evidence receives a distinct DTO. No observer's image is cached. */
const shownCashCache=new Map<string,ShowdownHand>();
function cashShown(hand:StoredHand):ShowdownHand {
 const view=hand.view,shown:ShowdownHand={events:view.events,board:view.board,payouts:view.payouts,revealed:view.street==='complete'?Object.keys(view.handLabels??{}).map(Number).flatMap(id=>{const seat=view.seats.find(s=>s.id===id);return seat&&!seat.folded&&seat.hole.length===2?[{id,hole:seat.hole}]:[];}):[]};
 const key=JSON.stringify(shown),cached=shownCashCache.get(key);if(cached)return cached;
 // Own an immutable copy; never freeze or retain mutable input arrays.
 const copy=JSON.parse(key) as ShowdownHand;
 const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(copy);
 if(shownCashCache.size>=120)shownCashCache.delete(shownCashCache.keys().next().value!);
 shownCashCache.set(key,copy);return copy;
}
/** Layer1.7: latest60 canonical hands in this session, restricted to the current
 * uninterrupted observer and target seat identities. Hero's private cards in a
 * view are not public unless the completed view explicitly labels the showdown. */
export function cashImages(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,observerSeat:number):Record<number,Image> {
 const recent=hands.slice(-60),shown=recent.map(cashShown),seats=[0,...Object.keys(active.profiles).map(Number).filter(s=>s!==0)];
 const identity=(seat:number)=>seat===0?'hero':active.profiles[seat]?.personalityId,observer=identity(observerSeat),out:Record<number,Image>={};
 const seated=(hand:StoredHand,seat:number,id:string|undefined)=>!!id&&hand.view.seats.some(s=>s.id===seat&&s.startingStack>0)&&(seat===0||hand.privateProfiles?.[seat]?.personalityId===id);
 for(const seat of seats){const id=identity(seat);let since=recent.length;
  for(let i=recent.length-1;i>=0;i--){const hand=recent[i];if(hand.sessionId!==active.sessionId||!seated(hand,observerSeat,observer)||!seated(hand,seat,id))break;since=i;}
  out[seat]=imageFrom(shown,i=>i>=since?seat:null);
 }
 return out;
}

/** Only unambiguous persistent personalities identify a cash player. Reusing the
 * same personality twice at one table cannot establish which person was involved. */
export function cashIdentity(active:Pick<ActiveTable,'profiles'>):(seat:number)=>string|undefined {
 const ids=Object.entries(active.profiles).filter(([seat])=>Number(seat)!==0).map(([,p])=>p.personalityId);
 return seat=>{if(seat===0)return 'hero';const id=active.profiles[seat]?.personalityId;return id&&ids.filter(value=>value===id).length===1?id:undefined;};
}
/** Layer1.10: own publicly settled losses in the latest120 canonical table hands.
 * The fixed window matches the compact resident tail, so audit/materialization
 * cannot change a prepared decision. Persistent personalities may carry their own
 * grudges across sessions within this window; unseen losses never belong to them.
 * No length/last-ID cache: restored or modified evidence must be recomputed. */
export function cashGrudges(hands:readonly StoredHand[]):Grudges {
 const recent=hands.slice(-120).map(hand=>{
  const identities:Record<number,string>={},committed:Record<number,number>={},identity=cashIdentity({profiles:hand.privateProfiles??{}});
  if(hand.view.street==='complete')for(const seat of hand.view.seats){
   if(seat.startingStack<=0)continue;const id=identity(seat.id);if(!id)continue;
   identities[seat.id]=id;committed[seat.id]=seat.totalCommitted;
  }
  return {identities,committed,won:hand.view.payouts,bigBlind:hand.view.profile.bigBlind,pots:hand.view.pots};
 });
 return grudgesFrom(recent);
}

/** Immutable stored hands are converted once; the conversion holds public facts only. */
const insightHandMemo=new WeakMap<object,InsightHand>();
function cashInsightHand(hand:StoredHand):InsightHand {
 const view=hand.view;let out=insightHandMemo.get(view);
 if(!out){out={events:view.events,board:view.board,payouts:view.payouts,revealed:revealedAtShowdown(view.street,Object.keys(view.handLabels??{}).map(Number),view.seats),committed:Object.fromEntries(view.seats.map(s=>[s.id,s.totalCommitted])),bigBlind:view.profile.bigBlind};insightHandMemo.set(view,out);}
 return out;
}
/** Layer 1.13.0: what the observer has noticed about each other player's leaks, from the latest 150
 * canonical hands this session that both of them played without a change of occupant, and the
 * observer's own steam from its own uninterrupted run. Actions and showdown cards only. */
export function cashInsight(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,observerSeat:number):TableInsight|null {
 const profile=active.profiles[observerSeat];if(!profile||observerSeat===0)return null;
 const recent=hands.slice(-150),seats=[0,...Object.keys(active.profiles).map(Number).filter(s=>s!==0)];
 const identity=(seat:number)=>seat===0?'hero':active.profiles[seat]?.personalityId,observer=identity(observerSeat);
 const seated=(hand:StoredHand,seat:number,id:string|undefined)=>!!id&&hand.view.seats.some(s=>s.id===seat&&s.startingStack>0)&&(seat===0||hand.privateProfiles?.[seat]?.personalityId===id);
 const since:Record<number,number>={};
 for(const seat of seats){const id=identity(seat);let from=recent.length;
  for(let i=recent.length-1;i>=0;i--){const hand=recent[i];if(hand.sessionId!==active.sessionId||!seated(hand,observerSeat,observer)||!seated(hand,seat,id))break;from=i;}
  since[seat]=from;}
 return observerInsight(recent.map(cashInsightHand),seats,(i,seat)=>i>=since[seat]?seat:null,observerSeat,profile);
}
/** Layer 1.19.0: what the observer has seen each other player's turn and river bet sizes mean, over the
 * same witnessed window as cashInsight (latest 150 hands this session, both seated, same occupant).
 * Showdown cards only. */
export function cashSizeReads(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,observerSeat:number):Record<number,SizeRead>|null {
 const profile=active.profiles[observerSeat];if(!profile||observerSeat===0)return null;
 const recent=hands.slice(-150),seats=[0,...Object.keys(active.profiles).map(Number).filter(s=>s!==0&&s!==observerSeat)];
 const identity=(seat:number)=>seat===0?'hero':active.profiles[seat]?.personalityId,observer=identity(observerSeat);
 const seated=(hand:StoredHand,seat:number,id:string|undefined)=>!!id&&hand.view.seats.some(s=>s.id===seat&&s.startingStack>0)&&(seat===0||hand.privateProfiles?.[seat]?.personalityId===id);
 const since:Record<number,number>={};
 for(const seat of seats){const id=identity(seat);let from=recent.length;
  for(let i=recent.length-1;i>=0;i--){const hand=recent[i];if(hand.sessionId!==active.sessionId||!seated(hand,observerSeat,observer)||!seated(hand,seat,id))break;from=i;}
  since[seat]=from;}
 return sizeReadsFrom(recent.map(cashInsightHand),(i,seat)=>i>=since[seat]?seat:null,seats);
}
/** Layer 1.20.0: what the observer has seen your snap and slow turn and river bets turn out to be, over the
 * same witnessed window as cashInsight. Your shown-down cards only. */
export function cashTempoRead(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,observerSeat:number):TempoRead|null {
 const profile=active.profiles[observerSeat];if(!profile||observerSeat===0)return null;
 const recent=hands.slice(-150),observer=profile.personalityId;
 const seated=(hand:StoredHand,seat:number,id:string|undefined)=>hand.view.seats.some(s=>s.id===seat&&s.startingStack>0)&&(seat===0||(!!id&&hand.privateProfiles?.[seat]?.personalityId===id));
 let from=recent.length;
 for(let i=recent.length-1;i>=0;i--){const hand=recent[i];if(hand.sessionId!==active.sessionId||!seated(hand,observerSeat,observer)||!seated(hand,0,undefined))break;from=i;}
 return tempoReadFrom(recent.map(cashInsightHand),i=>i>=from);
}
/** Layer 1.21.0: what this player remembers of you from every saved hand they sat in with you, in any
 * session: your timing, your shown-down river bets, and how many hands you have played together. A regular is the
 * same person each time, so this carries across sessions; a stranger has only met you today. */
export function cashMemoryReads(hands:readonly StoredHand[],active:Pick<ActiveTable,'profiles'>,observerSeat:number):{tempo:TempoRead;river:RiverRead;together:number}|null {
 const id=active.profiles[observerSeat]?.personalityId;if(!id||observerSeat===0)return null;
 const recent=hands.slice(-400);
 const witnessed=(i:number)=>{const h=recent[i];return h.view.seats.some(s=>s.id===0&&s.startingStack>0)&&Object.entries(h.privateProfiles??{}).some(([seat,p])=>p?.personalityId===id&&h.view.seats.some(s=>s.id===Number(seat)&&s.startingStack>0));};
 const shaped=recent.map(cashInsightHand);let together=0;for(let i=0;i<recent.length;i++)if(witnessed(i))together++;
 return {tempo:tempoReadFrom(shaped,witnessed),river:riverReadFrom(shaped,witnessed),together};
}
/** Layer 1.15.0: whether the player in this seat is on a break this hand (see routines.ts). */
export function cashBreak(hands:readonly StoredHand[],active:Pick<ActiveTable,'sessionId'|'profiles'>,seat:number,memory?:HumanMemory){
 const profile=active.profiles[seat];if(!profile||seat===0)return {onBreak:false,starting:false,returning:false};
 return breakAt(`${active.sessionId}:${seat}:${profile.personalityId??''}`,profile,(memory?memoryFacts(memory,active,seat):cashSessionFacts(hands,active,seat)).hands);
}
/** Layer 1.16.0: the mood this seat's player is in for the session. */
export function cashSessionMood(active:Pick<ActiveTable,'sessionId'|'profiles'>,seat:number):SessionMood {
 const profile=active.profiles[seat];return sessionMoodOf(`${active.sessionId}:${seat}:${profile?.personalityId??''}`,profile);
}
