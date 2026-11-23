/** What players learn from the hands they have watched (cash layer human-1.13.0, tournament policy
 * 2.16.0), from public information only: the actions, and the cards revealed at showdown.
 *
 * 1. Leak reads. Each player's signature leaks (patch 44) leave traces: a river call shown down with
 *    a weak pair, a flop call with a draw, a missed draw bet on the river, a c-bet every time. Once a
 *    pattern has shown up often enough, it is "noticed", and good players exploit it (exploit.ts).
 *    Hero's play is read exactly the same way.
 * 2. Steam. A bad beat (losing a big pot after being well ahead on the turn) or a cooler (losing a
 *    big pot with a very strong hand) tilts a player for a while, not just for the next hand or two.
 *    It fades with a half-life of about 8 to 30 hands, longer for tilt-prone players, and a big win
 *    halves it.
 * Designed, not fitted to human data. Pure functions. */
import type {SizeRead} from './table-craft';
import type {TempoRead} from './tempo-reads';
import type {BotProfile,Card,GameEvent} from '../contracts';
import {handFeatures} from './features';
import {clamp} from './profiles';
import {tiltProneness} from './human';
import type {Leak} from './leaks';

/** A finished hand as an observer saw it. */
export interface InsightHand {events:readonly GameEvent[];board:readonly string[];payouts:Readonly<Record<number,number>>;revealed:readonly {id:number;hole:readonly string[]}[];committed:Readonly<Record<number,number>>;bigBlind:number;}
/** Evidence counts for one player. */
export interface LeakEvidence {paysOff:number;drawChase:number;overLove:number;riverBluff:number;slow:number;cbetOpp:number;cbet:number;scaredOpp:number;scared:number;giveUpOpp:number;giveUp:number;}
const EMPTY=():LeakEvidence=>({paysOff:0,drawChase:0,overLove:0,riverBluff:0,slow:0,cbetOpp:0,cbet:0,scaredOpp:0,scared:0,giveUpOpp:0,giveUp:0});
const feat=(hole:readonly string[],board:readonly string[])=>handFeatures(hole as Card[],board as Card[]);

interface Step {e:GameEvent;street:string;pot:number;facing:number;}
/** Each action with the pot before it and the amount the actor faced. */
function steps(events:readonly GameEvent[]):Step[] {
 const out:Step[]=[];let street='preflop',total=0,commit=new Map<number,number>();
 const sum=()=>[...commit.values()].reduce((a,b)=>a+b,0);
 for(const e of events){
  if(e.type==='street'){total+=sum();commit=new Map();street=e.street??street;continue;}
  if(e.type==='ante'){total+=e.amount??0;continue;}
  if(e.type==='blind'&&e.seatId!==undefined){commit.set(e.seatId,(commit.get(e.seatId)??0)+(e.amount??0));continue;}
  if(e.type!=='action'||e.seatId===undefined||!e.action)continue;
  const max=Math.max(0,...commit.values()),own=commit.get(e.seatId)??0;
  out.push({e,street:e.street??street,pot:total+sum(),facing:Math.max(0,max-own)});
  if(e.action.type==='raise')commit.set(e.seatId,e.action.to);else if(e.action.type==='call')commit.set(e.seatId,max);
 }
 return out;
}
const BOARD_AT:Record<string,number>={flop:3,turn:4,river:5};

/** Add one hand's evidence for the player in seat `seat` of that hand. */
export function addEvidence(ev:LeakEvidence,hand:InsightHand,seat:number):void {
 const all=steps(hand.events),mine=all.filter(s=>s.e.seatId===seat),hole=hand.revealed.find(r=>r.id===seat)?.hole;
 const pfr=[...all].reverse().find(s=>s.street==='preflop'&&s.e.action?.type==='raise')?.e.seatId,lost=hole&&!(hand.payouts[seat]>0);
 const first=(street:string)=>mine.find(s=>s.street===street);
 for(const s of mine){
  const a=s.e.action!.type,n=BOARD_AT[s.street];
  if(hole&&n&&hand.board.length>=n){
   const f=feat(hole,hand.board.slice(0,n));
   if(a==='call'&&s.street==='river'&&s.facing>0&&f.made&&f.strength<.55&&!f.playsBoard)ev.paysOff++;
   if(a==='call'&&s.street!=='river'&&s.facing>=.4*s.pot&&f.draw>=.3&&f.strength<.5)ev.drawChase++;
   if(a==='call'&&s.street!=='flop'&&s.facing>=.6*s.pot&&lost&&(f.handClass==='overpair'||f.handClass==='top-pair'))ev.overLove++;
   if(a==='raise'&&s.street==='river'&&!f.made&&f.strength<.35)ev.riverBluff++;
  }
 }
 if(hole&&hand.board.length>=3&&feat(hole,hand.board.slice(0,3)).strength>=.8){
  const post=mine.filter(s=>s.street==='flop'||s.street==='turn');if(post.length>=2&&!post.some(s=>s.e.action?.type==='raise'))ev.slow++;
 }
 const flop=first('flop');
 if(pfr===seat&&flop&&flop.facing===0){ev.cbetOpp++;if(flop.e.action?.type==='raise')ev.cbet++;
  const turn=first('turn');if(flop.e.action?.type==='raise'&&turn&&turn.facing===0){ev.giveUpOpp++;if(turn.e.action?.type==='check')ev.giveUp++;}}
 for(const street of ['turn','river']){const s=mine.find(x=>x.street===street&&x.facing>=.7*x.pot&&x.facing>0);if(s){ev.scaredOpp++;if(s.e.action?.type==='fold')ev.scared++;}}
}
const evidenceMemo=new WeakMap<InsightHand,Map<number,LeakEvidence>>();
/** One hand's evidence for one seat, computed once per immutable hand object. */
function handEvidence(hand:InsightHand,seat:number):LeakEvidence {
 let bySeat=evidenceMemo.get(hand);if(!bySeat){bySeat=new Map();evidenceMemo.set(hand,bySeat);}
 let ev=bySeat.get(seat);if(!ev){ev=EMPTY();addEvidence(ev,hand,seat);bySeat.set(seat,ev);}return ev;
}
/** Evidence for one player over the hands listed, oldest first; `seatOf(i)` is the player's seat in hand i, or null. */
export function evidenceFrom(hands:readonly InsightHand[],seatOf:(index:number)=>number|null):LeakEvidence {
 const ev=EMPTY();hands.forEach((h,i)=>{const s=seatOf(i);if(s===null)return;const one=handEvidence(h,s);for(const k of Object.keys(ev) as (keyof LeakEvidence)[])ev[k]+=one[k];});return ev;
}
/** The leaks an observer would have noticed: a pattern seen at least twice, or a rate seen often enough. */
export function noticedLeaks(ev:LeakEvidence):Leak[] {
 const out:Leak[]=[];
 if(ev.paysOff>=2)out.push('pays-off-rivers');if(ev.drawChase>=2)out.push('draw-chaser');if(ev.overLove>=2)out.push('overpair-love');
 if(ev.riverBluff>=2)out.push('river-bluffer');if(ev.slow>=2)out.push('slowplays-monsters');
 if(ev.cbetOpp>=5&&ev.cbet/ev.cbetOpp>=.85)out.push('auto-cbet');
 if(ev.scaredOpp>=4&&ev.scared/ev.scaredOpp>=.75)out.push('scared-money');
 if(ev.giveUpOpp>=4&&ev.giveUp/ev.giveUpOpp>=.7)out.push('one-and-done');
 return out;
}

export type SteamCause='bad-beat'|'cooler';
export interface Steam {level:number;cause:SteamCause|null;handsAgo:number|null;}
export const NO_STEAM:Steam=Object.freeze({level:0,cause:null,handsAgo:null});
/** Whether the player in `seat` took a bad beat or a cooler in this hand (losing at least 25 big blinds at showdown). */
export function beatIn(hand:InsightHand,seat:number):{cause:SteamCause;lossBB:number}|null {
 const hole=hand.revealed.find(r=>r.id===seat)?.hole;if(!hole||hand.board.length<5||(hand.payouts[seat]??0)>0)return null;
 const lossBB=((hand.committed[seat]??0)-(hand.payouts[seat]??0))/hand.bigBlind;if(lossBB<25)return null;
 const winner=hand.revealed.filter(r=>r.id!==seat&&(hand.payouts[r.id]??0)>0).sort((a,b)=>(hand.payouts[b.id]??0)-(hand.payouts[a.id]??0))[0];if(!winner)return null;
 const mineTurn=feat(hole,hand.board.slice(0,4)).strength,theirsTurn=feat(winner.hole,hand.board.slice(0,4)).strength;
 if(mineTurn>=.5&&mineTurn>=theirsTurn+.15)return {cause:'bad-beat',lossBB};
 if(feat(hole,hand.board).strength>=.8)return {cause:'cooler',lossBB};
 return null;
}
/** How long steam lasts, as a half-life in hands: about 8 for the calmest players, 30 for the most tilt-prone. */
export const steamHalfLife=(profile:BotProfile)=>6+24*tiltProneness(profile);
/** Current steam for one player from the hands listed, oldest first. */
export function steamFrom(hands:readonly InsightHand[],seatOf:(index:number)=>number|null,profile:BotProfile):Steam {
 const half=steamHalfLife(profile),prone=tiltProneness(profile);let level=0,cause:SteamCause|null=null,ago:number|null=null;
 hands.forEach((h,i)=>{const s=seatOf(i);if(s===null)return;const age=hands.length-1-i;
  const won=((h.payouts[s]??0)-(h.committed[s]??0))/h.bigBlind;if(won>=25)level*=.5;
  const b=beatIn(h,s);if(b){level+=(b.cause==='bad-beat'?.7:.5)*Math.min(1.5,b.lossBB/50)*Math.pow(.5,age/half);cause=b.cause;ago=age;}});
 const out=clamp(level*(.4+.8*prone));
 return out>=.05?{level:out,cause,handsAgo:ago}:NO_STEAM;
}
/** What one player (the observer) knows from the hands it watched: the leaks it has noticed in
 * each other player, from hands both of them played, and its own steam. Version 61 rule: evidence is
 * witnessed by the observer only, and nothing is cached by history length or hand ID. */
export interface TableInsight {leaks:Readonly<Record<number,readonly Leak[]>>;steam:Steam;
 /** Tournament policy 2.22.0 only: what this observer has seen each player's bet sizes mean. */
 sizes?:Readonly<Record<number,SizeRead>>;
 /** Tournament policy 2.23.0 only: what this observer has seen your snap and slow bets turn out to be. */
 tempo?:TempoRead;}
/** `seatIn(i,seat)` maps a current seat to that player's seat in hand i, or null when that player, or
 * the observer, was not dealt in. */
export function observerInsight(hands:readonly InsightHand[],seats:readonly number[],seatIn:(index:number,seat:number)=>number|null,observer:number,profile:BotProfile):TableInsight {
 const leaks:Record<number,Leak[]>={};
 for(const seat of seats){if(seat===observer)continue;const l=noticedLeaks(evidenceFrom(hands,i=>seatIn(i,observer)===null?null:seatIn(i,seat)));if(l.length)leaks[seat]=l;}
 return {leaks,steam:steamFrom(hands,i=>seatIn(i,observer),profile)};
}
/** Public evidence of a completed hand: revealed cards only for players who reached the showdown unfolded. */
export function revealedAtShowdown(street:string,ids:readonly number[],seats:readonly {id:number;folded:boolean;hole:readonly string[]}[]):{id:number;hole:readonly string[]}[] {
 if(street!=='complete')return [];
 return ids.flatMap(id=>{const seat=seats.find(s=>s.id===id);return seat&&!seat.folded&&seat.hole.length===2?[{id,hole:seat.hole}]:[];});
}
/** A stable digest of what the observer knows, for decision hashes. */
export function insightDigest(insight:TableInsight|null|undefined):string {
 if(!insight)return '-';const rows=Object.entries(insight.leaks).sort(([a],[b])=>Number(a)-Number(b)).map(([seat,l])=>`${seat}=${[...l].sort().join('+')}`);
 return `${rows.join(',')||'none'}/steam${insight.steam.level.toFixed(3)}${insight.steam.cause?`-${insight.steam.cause}`:''}`;
}
