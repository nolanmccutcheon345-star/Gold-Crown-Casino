/** Recent public results of every player in an event, by name, for mood (policy 2.3.0).
 * Uses only finished hands already saved on the event: single-table history, or for multi-table
 * events enough sealed blocks to cover the last eight rounds plus the unsealed hands. Oldest first, at most `limit` per player. */
import type {BotProfile,GameState} from '../contracts';
import {handResults,type HandResult} from '../bots/human';
import type {TournamentEvent} from './runtime';
import {allHeroHands} from './mtt-event';
import {readsFromHands,mergeReads,validReads,type HeroReads} from '../bots/reads';
import {addPlayerHand,emptyPlayerRead,type PlayerRead} from '../bots/table-reads';
import {imageFrom,type Image,type ShowdownHand} from '../bots/image';
import {REGULARS,regularById} from '../bots/regulars';
import {observerInsight,revealedAtShowdown,type InsightHand,type TableInsight} from '../bots/insight';
import {grudgesFrom,type Grudges} from '../bots/rivalry';
import {sizeReadsFrom,type SizeRead} from '../bots/table-craft';
import {tempoReadFrom,EMPTY_TEMPO,type TempoRead} from '../bots/tempo-reads';

function recentStates(event:TournamentEvent):GameState[] {
 if(!event.mtt)return event.history.slice(-10).map(hand=>hand.state);
 const cutoff=Math.max(1,event.handNumber-8),blocks=[];
 for(let i=event.mtt.blocks.length-1;i>=0;i--){const block=event.mtt.blocks[i];if(block.lastRound<cutoff)break;blocks.unshift(block);}
 const rows:{round:number;order:number;state:GameState}[]=[];
 for(const record of [...blocks.flatMap(block=>block.hands),...event.mtt.recent])rows.push({round:record.round,order:record.table,state:record.state});
 for(const hand of [...blocks.flatMap(block=>block.heroHands),...event.history])rows.push({round:hand.number,order:0,state:hand.state});
 return rows.filter(row=>row.round>=cutoff).sort((a,b)=>a.round-b.round||a.order-b.order).map(row=>row.state);
}
export function recentResultsByName(event:TournamentEvent,limit=8):Map<string,HandResult[]> {
 const out=new Map<string,HandResult[]>();
 for(const state of recentStates(event)){
  const results=handResults(state.seats,state.profile.bigBlind);
  for(const seat of state.seats){const r=results.get(seat.id);if(!r)continue;const list=out.get(seat.name)??[];list.push(r);if(list.length>limit)list.shift();out.set(seat.name,list);}
 }
 return out;
}


/** What the acting player has seen Hero do: Hero's hands in this event in which that player sat,
 * plus (for named regulars only) the reads they carried in from earlier events. Hero's table only. */
export function tournamentReadsFor(event:TournamentEvent,name:string):HeroReads|null {
 if(event.status!=='running')return null;
 const hands=allHeroHands(event);
 const reads=readsFromHands(hands.filter(hand=>hand.state.seats.some(seat=>seat.name===name&&seat.startingStack>0)&&hand.state.seats.some(seat=>seat.id===0&&seat.startingStack>0)).map(hand=>hand.state),0);
 const regular=event.field&&Object.values(event.field.regulars).find(id=>regularById(id)?.name===name);
 return regular&&event.heroReads?.[regular]?mergeReads(event.heroReads[regular],reads):reads;
}
/** Reads on Hero carried into a new event: Hero's dealt hands from the last ten finished events. */
export type EventHeroReads=Record<string,HeroReads>;
export function heroReadsSnapshot(completed:readonly TournamentEvent[]):EventHeroReads {
 const result:EventHeroReads={};
 for(const regular of REGULARS){
  const hands=completed.slice(-10).flatMap(event=>Object.values(event.field?.regulars??{}).includes(regular.id)?allHeroHands(event).map(hand=>hand.state).filter(state=>state.seats.some(seat=>seat.id===0&&seat.name==='You'&&seat.startingStack>0)&&state.seats.some(seat=>seat.name===regular.name&&seat.startingStack>0)):[]);
  if(hands.length)result[regular.id]=readsFromHands(hands,0);
 }
 return result;
}
export function validEventReads(value:unknown):value is EventHeroReads {
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([id,reads])=>!!regularById(id)&&validReads(reads));
}

/** Policy 2.7.0: public reads from the last 300 archived Hero-table hands that
 * both observer and target actually played. No off-table observations or
 * carried-over reads about other opponents are invented. Names are unique
 * event identities; historical seat numbers may change when tables break. */
export function tournamentTableReadsFor(event:TournamentEvent,observerSeat=event.game.actor??0):Record<number,PlayerRead> {
 const hands=allHeroHands(event).slice(-300),seats=event.game.seats.filter(s=>s.startingStack>0),observer=seats.find(s=>s.id===observerSeat);
 const out:Record<number,PlayerRead>={};
 for(const seat of seats){
  const read=emptyPlayerRead();
  if(observer)for(const hand of hands){
   if(!hand.state.seats.some(s=>s.name===observer.name&&s.startingStack>0))continue;
   const target=hand.state.seats.find(s=>s.name===seat.name&&s.startingStack>0);if(target)addPlayerHand(read,hand.state,target.id);
  }
  out[seat.id]=read;
 }
 return out;
}

/** Exact public evidence is reusable; inferred per-observer images are not cached. */
const shownTournamentCache=new Map<string,ShowdownHand>();
function tournamentShown(state:GameState):ShowdownHand {
 const shown:ShowdownHand={events:state.events,board:state.board,payouts:state.payouts,revealed:state.street==='complete'?state.revealedSeats.flatMap(id=>{const seat=state.seats.find(s=>s.id===id);return seat&&!seat.folded&&seat.hole.length===2?[{id,hole:seat.hole}]:[];}):[]};
 const key=JSON.stringify(shown),cached=shownTournamentCache.get(key);if(cached)return cached;
 const copy=JSON.parse(key) as ShowdownHand;
 const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(copy);
 if(shownTournamentCache.size>=120)shownTournamentCache.delete(shownTournamentCache.keys().next().value!);
 shownTournamentCache.set(key,copy);return copy;
}
/** Policy2.10: latest60 archived Hero-table hands jointly witnessed by actor and
 * target. Validated event names are unique immutable identities across seat moves.
 * No off-table or prior-event observations are invented; unseen hands only age an
 * earlier image, never supply revealed cards to it. */
export function tournamentImagesFor(event:TournamentEvent,observerSeat:number):Record<number,Image> {
 const hands=allHeroHands(event).slice(-60),shown=hands.map(hand=>tournamentShown(hand.state));
 const seats=event.game.seats.filter(s=>s.startingStack>0),observer=seats.find(s=>s.id===observerSeat),out:Record<number,Image>={};
 for(const seat of seats)out[seat.id]=imageFrom(shown,i=>{
  const historical=hands[i].state.seats;
  if(!observer||!historical.some(s=>s.name===observer.name&&s.startingStack>0))return null;
  return historical.find(s=>s.name===seat.name&&s.startingStack>0)?.id??null;
 });
 return out;
}

/** Policy2.13: own losses witnessed at Hero's table in this event's latest300
 * archived Hero-table hands. Validated names are immutable event identities across
 * table/seat moves. Only the acting holder's row is exposed; no off-table or prior
 * event evidence is invented. Unseen hands age earlier evidence but add none.
 * Recompute from public facts, without a length/event-ID cache. */
export function tournamentGrudgesFor(event:TournamentEvent,observerSeat=event.game.actor??0):Grudges {
 const observer=event.game.seats.find(seat=>seat.id===observerSeat&&seat.startingStack>0);
 if(!observer)return {};
 const rows=allHeroHands(event).slice(-300).map(hand=>{
  const state=hand.state,identities:Record<number,string>={},committed:Record<number,number>={};
  if(state.street==='complete'&&state.seats.some(seat=>seat.name===observer.name&&seat.startingStack>0))for(const seat of state.seats){
   if(seat.startingStack<=0)continue;identities[seat.id]=seat.name;committed[seat.id]=seat.totalCommitted;
  }
  return {identities,committed,won:state.payouts,bigBlind:state.profile.bigBlind,pots:state.pots};
 });
 const own=grudgesFrom(rows)[observer.name];return own?{[observer.name]:own}:{};
}

const tournamentInsightMemo=new WeakMap<object,InsightHand>();
function tournamentInsightHand(state:GameState):InsightHand {
 let out=tournamentInsightMemo.get(state);
 if(!out){out={events:state.events,board:state.board,payouts:state.payouts,revealed:revealedAtShowdown(state.street,state.revealedSeats,state.seats),committed:Object.fromEntries(state.seats.map(s=>[s.id,s.totalCommitted])),bigBlind:state.profile.bigBlind};tournamentInsightMemo.set(state,out);}
 return out;
}
/** Policy 2.16.0: what the acting player has noticed about each other player's leaks, from this
 * event's latest 150 Hero-table hands that both of them played (names are unique event identities),
 * and its own steam. No off-table or prior-event evidence; actions and showdown cards only. */
export function tournamentInsightFor(event:TournamentEvent,observerSeat=event.game.actor??0,profile?:BotProfile):TableInsight|null {
 const seats=event.game.seats.filter(s=>s.startingStack>0),observer=seats.find(s=>s.id===observerSeat);
 if(!observer||!profile||observerSeat===0)return null;
 const hands=allHeroHands(event).slice(-150);
 return observerInsight(hands.map(h=>tournamentInsightHand(h.state)),seats.map(s=>s.id),(i,seat)=>{
  const historical=hands[i].state.seats;if(!historical.some(s=>s.name===observer.name&&s.startingStack>0))return null;
  const name=seats.find(s=>s.id===seat)?.name;return historical.find(s=>s.name===name&&s.startingStack>0)?.id??null;
 },observerSeat,profile);
}
/** Policy 2.23.0: what the acting player has seen your snap and slow bets turn out to be, from the same
 * witnessed Hero-table window. Your shown-down cards only. */
export function tournamentTempoReadFor(event:TournamentEvent,observerSeat:number):TempoRead {
 const observer=event.game.seats.find(s=>s.id===observerSeat&&s.startingStack>0);
 if(!observer||observerSeat===0)return {...EMPTY_TEMPO};
 const hands=allHeroHands(event).slice(-150);
 return tempoReadFrom(hands.map(h=>tournamentInsightHand(h.state)),i=>hands[i].state.seats.some(s=>s.name===observer.name&&s.startingStack>0)&&hands[i].state.seats.some(s=>s.id===0&&s.startingStack>0));
}
/** Policy 2.22.0: what the acting player has seen each other player's bet sizes mean, from the same
 * witnessed Hero-table window as tournamentInsightFor. Showdown cards only. */
export function tournamentSizeReadsFor(event:TournamentEvent,observerSeat:number):Record<number,SizeRead> {
 const seats=event.game.seats.filter(s=>s.startingStack>0),observer=seats.find(s=>s.id===observerSeat);
 if(!observer||observerSeat===0)return {};
 const hands=allHeroHands(event).slice(-150);
 return sizeReadsFrom(hands.map(h=>tournamentInsightHand(h.state)),(i,seat)=>{
  const historical=hands[i].state.seats;if(!historical.some(s=>s.name===observer.name&&s.startingStack>0))return null;
  const name=seats.find(s=>s.id===seat)?.name;return historical.find(s=>s.name===name&&s.startingStack>0)?.id??null;
 },seats.map(s=>s.id).filter(id=>id!==observerSeat));
}
