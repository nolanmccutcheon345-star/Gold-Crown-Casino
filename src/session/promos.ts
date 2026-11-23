/** Patch 70: card room promotions and dealer tokes.
 *
 * Promotions are paid by the house, the way a real card room pays a high-hand bonus or a bad-beat jackpot from its
 * promotional fund. They never move chips in a hand, never change the rake and never count as poker winnings: Hero's
 * share is a wallet adjustment with a fixed id, so paying twice is impossible. Everything here is worked out again
 * from saved hands and the verified ledger, so nothing about a promotion needs its own storage.
 *
 * Only cards the table saw count. A player qualifies with a hand shown at showdown, and Hero with Hero's own cards when
 * Hero reached the river. Both hole cards must play. */
import type {Card,HeroViewModel} from '../contracts';
import {derivePots} from '../core/engine';
import {compareRanks,evaluate,handLabel} from '../core/evaluator';
import type {AppData,MoneyEvent,StoredHand} from './types';

export const HIGH_HAND_HOUR=30;
export const JACKPOT_BASE=1_500_000;
export const JACKPOT_PER_HAND=400;
/** One in this many hands, the jackpot hits at another table in the room. */
export const ROOM_HIT_ODDS=40_000;
export const HERO=0;

/** Best five cards that use both hole cards and three from the board. Null unless the river is out. */
export function bothCardsRank(hole:Card[],board:Card[]):number[]|null {
 if(hole.length!==2||board.length!==5)return null;
 let best:number[]|null=null;
 for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)for(let c=b+1;c<5;c++){const rank=evaluate([...hole,board[a],board[b],board[c]]);if(!best||compareRanks(rank,best)>0)best=rank;}
 return best;
}
/** A full house or better with both hole cards playing. */
export const highHandQualifies=(rank:number[]|null)=>!!rank&&rank[0]>=6;
/** Aces full of tens or better, both hole cards playing. */
export const badBeatQualifies=(rank:number[]|null)=>!!rank&&(rank[0]>=7||rank[0]===6&&rank[1]===14&&rank[2]>=10);

export function highHandPrize(bigBlind:number):number {return Math.max(10_000,50*bigBlind);}

interface Shown {seatId:number;name:string;rank:number[];label:string}
/** Hands the table saw at the end of a hand, with both hole cards playing. */
export function shownHands(view:HeroViewModel):Shown[] {
 if(view.board.length!==5)return[];
 return view.seats.filter(s=>!s.folded&&s.hole.length===2&&(s.id===HERO||!!view.handLabels[s.id])).flatMap(s=>{const rank=bothCardsRank(s.hole,view.board);return rank&&compareRanks(rank,evaluate([...s.hole,...view.board]))===0?[{seatId:s.id,name:s.id===HERO?'You':s.name,rank,label:handLabel(rank)}]:[];});
}

export interface HighHand {handId:string;number:number;seatId:number;name:string;label:string;rank:number[]}
export interface HighHandHour {sessionId:string;hour:number;hands:number;closed:boolean;prize:number;leader:HighHand|null}
/** Session hands in play order, split into hours of HIGH_HAND_HOUR hands. The last hour closes when the session ends. */
export function highHandHours(data:AppData,sessionId:string,latestOnly=false):HighHandHour[] {
 const session=data.sessions.find(s=>s.id===sessionId);if(!session)return[];
 const offset=latestOnly&&session.handIds.length?Math.floor((session.handIds.length-1)/HIGH_HAND_HOUR)*HIGH_HAND_HOUR:0;
 const byId=new Map((latestOnly?data.hands.slice(-HIGH_HAND_HOUR):data.hands).map(h=>[h.id,h]));const hours:HighHandHour[]=[];
 session.handIds.slice(offset).forEach((id,i)=>{
  const hour=Math.floor((offset+i)/HIGH_HAND_HOUR);
  const slot=hours[Math.floor(i/HIGH_HAND_HOUR)]??=({sessionId,hour,hands:0,closed:false,prize:highHandPrize(session.settings.bigBlind),leader:null});
  slot.hands++;const hand=byId.get(id);if(!hand)return;
  for(const s of shownHands(hand.view))if(highHandQualifies(s.rank)&&(!slot.leader||compareRanks(s.rank,slot.leader.rank)>0))slot.leader={handId:hand.id,number:hand.number,seatId:s.seatId,name:s.name,label:s.label,rank:s.rank};
 });
 hours.forEach((h,i)=>{h.closed=h.hands>=HIGH_HAND_HOUR||i<hours.length-1||session.endedAt!==null;});
 return hours;
}

export interface BadBeat {handId:string;loser:Shown;winner:Shown;dealtIn:number[];amount:number;shares:Record<number,number>}
/** The bad beat in a hand, if any: the best losing hand at showdown qualifies and the winning hand beats it. */
export function badBeatIn(view:HeroViewModel):Omit<BadBeat,'amount'|'shares'>|null {
 /* A bad beat needs a showdown: every hand counted here was turned face up, Hero's included. */
 const shown=shownHands(view).filter(s=>!!view.handLabels[s.seatId]).sort((a,b)=>compareRanks(b.rank,a.rank));
 if(shown.length<2)return null;
 const [winner,loser]=shown;
 if(view.pots?.length&&!view.pots.some(p=>p.winners.includes(winner.seatId)&&p.eligible.includes(loser.seatId)&&!p.winners.includes(loser.seatId)))return null;
 if(!badBeatQualifies(loser.rank)||compareRanks(winner.rank,loser.rank)<=0)return null;
 return {handId:view.handId,winner,loser,dealtIn:view.seats.filter(s=>s.startingStack>0).map(s=>s.id)};
}
/** Half to the losing hand, a quarter to the winning hand, a quarter shared by everyone else dealt in. */
export function jackpotShares(amount:number,beat:Omit<BadBeat,'amount'|'shares'>):Record<number,number> {
 const shares:Record<number,number>={};const loser=Math.floor(amount/2),winner=Math.floor(amount/4);
 shares[beat.loser.seatId]=loser;shares[beat.winner.seatId]=winner;
 const others=beat.dealtIn.filter(id=>id!==beat.loser.seatId&&id!==beat.winner.seatId);
 const each=others.length?Math.floor((amount-loser-winner)/others.length):0;for(const id of others)shares[id]=each;
 return shares;
}

const fnv=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;};
/** The jackpot hits elsewhere in the room on a few hands, worked out from the hand id alone. */
export const roomHit=(handId:string)=>fnv(`room-jackpot:${handId}`)%ROOM_HIT_ODDS===0;

export interface JackpotState {amount:number;handsSinceHit:number;lastHit:{handId:string;where:'here'|'room'}|null}
/** The progressive jackpot before a given hand (or now), from the verified ledger: it grows with every hand dealt and
 * resets after a hit at Hero's table or elsewhere in the room. */
export function jackpotBefore(data:AppData,handId?:string):JackpotState {
 let since=0,lastHit:JackpotState['lastHit']=null;
 const hits=new Set(data.ledger.filter(e=>e.id.startsWith('promo:bad-beat:')).map(e=>e.id.slice('promo:bad-beat:'.length)));
 for(const e of data.ledger){
  if(e.kind!=='hand-net'||!e.handId)continue;
  if(e.handId===handId)break;
  since++;
  if(hits.has(e.handId)){since=0;lastHit={handId:e.handId,where:'here'};}
  else if(roomHit(e.handId)){since=0;lastHit={handId:e.handId,where:'room'};}
 }
 return {amount:JACKPOT_BASE+JACKPOT_PER_HAND*since,handsSinceHit:since,lastHit};
}

export interface PromoCredit {id:string;cents:number;note:string;sessionId:string}
/** Hero's promotion payouts that the ledger does not have yet. */
export function promoCredits(data:AppData,sessionId:string,latestOnly=false):PromoCredit[] {
 const out:PromoCredit[]=[];
 for(const hour of highHandHours(data,sessionId,latestOnly))if(hour.closed&&hour.leader?.seatId===HERO){
  const id=`promo:high-hand:${sessionId}:${hour.hour}`;
  if(!data.ledger.some(e=>e.id===id))out.push({id,cents:hour.prize,sessionId,note:`High-hand bonus, hour ${hour.hour+1}: ${hour.leader.label} (hand ${hour.leader.number}). House promotion, not poker winnings.`});
 }
 const session=data.sessions.find(s=>s.id===sessionId);
 for(const handId of (latestOnly?session?.handIds.slice(-1):session?.handIds)??[]){
  const hand=latestOnly?data.hands.at(-1):data.hands.find(h=>h.id===handId);if(!hand||hand.id!==handId)continue;
  const beat=badBeatIn(hand.view);if(!beat)continue;
  const id=`promo:bad-beat:${handId}`;if(data.ledger.some(e=>e.id===id))continue;
  const amount=jackpotBefore(data,handId).amount,share=jackpotShares(amount,beat)[HERO]??0;
  const role=beat.loser.seatId===HERO?'losing hand':beat.winner.seatId===HERO?'winning hand':'table share';
  if(beat.dealtIn.includes(HERO))out.push({id,cents:share,sessionId,note:`Bad-beat jackpot ${role} (hand ${hand.number}): ${beat.loser.label} lost to ${beat.winner.label}. House promotion, not poker winnings.`});
 }
 return out;
}

/* Dealer tokes. A toke is Hero's own money: it is recorded once per session as a wallet withdrawal, never in a hand. */
export type TokePolicy='off'|'one'|'regular';
export const TOKE_LABELS:Record<TokePolicy,string>={off:'No tokes',one:'$1 on every pot you win',regular:'$1 at 5 BB, $2 at 30 BB, $5 at 100 BB'};
/** What Hero tokes for a pot. Nothing on a pot that was too small to toke, or one Hero did not win. */
export function tokeFor(policy:TokePolicy,collected:number,bigBlind:number):number {
 if(policy==='off'||collected<=0)return 0;
 if(policy==='one')return 100;
 if(collected<5*bigBlind)return 0;
 return collected>=100*bigBlind?500:collected>=30*bigBlind?200:100;
}
export const tokeId=(sessionId:string)=>`toke:${sessionId}`;
/** Hero's collected chips in a finished hand. */
export const heroCollected=(view:HeroViewModel)=>view.payouts[HERO]??0;

/** What the house took from Hero: rake from pots Hero won (Hero's share of a split pot), tokes and promotions. */
export interface HouseTake {hands:number;potsWon:number;rake:number;tokes:number;promos:number;pokerNet:number;bbPer100Before:number;bbPer100After:number;rakePer100:number}
export function houseTake(hands:StoredHand[],ledger:MoneyEvent[]):HouseTake {
 let rake=0,potsWon=0,bbSum=0,net=0,rakeBB=0;
 for(const hand of hands){
  const v=hand.view,mine=v.payouts[HERO]??0,total=Object.values(v.payouts).reduce((a,b)=>a+b,0);const bb=v.profile.bigBlind||1;
  net+=hand.net;bbSum+=hand.net/bb;
  if(mine>0){potsWon++;let share=total>0?Math.round(v.rake*mine/total):0;
   if(v.rake&&v.pots?.length){const gross=derivePots(v).pots;share=v.pots.reduce((sum,p,i)=>sum+(p.winners.includes(HERO)?Math.round((gross[i].amount-p.amount)/p.winners.length):0),0);}rake+=share;rakeBB+=share/bb;}
 }
 const ids=new Set(hands.map(h=>h.sessionId));
 const tokes=-ledger.filter(e=>e.id.startsWith('toke:')&&ids.has(e.id.slice(5))).reduce((a,e)=>a+e.walletDelta,0);
 const promos=ledger.filter(e=>e.id.startsWith('promo:')&&e.sessionId&&ids.has(e.sessionId)).reduce((a,e)=>a+e.walletDelta,0);
 const n=hands.length||1;
 return {hands:hands.length,potsWon,rake,tokes,promos,pokerNet:net,bbPer100Before:100*(bbSum+rakeBB)/n,bbPer100After:100*bbSum/n,rakePer100:100*rakeBB/n};
}
