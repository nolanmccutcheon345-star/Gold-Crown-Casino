/** Patch 65: spot drills from your own hands. Each drill is a decision you faced (a bet on the flop,
 * turn or river, or a 3-bet), asked again with what you knew then. The answer shows what you did, what
 * happened, and a rough guide: your chance to win against a range for that player (built only from
 * what they showed at the table this session) compared with the price of the call.
 * A guide, not a solver. Screen only. */
import type {Card} from '../contracts';
import type {StoredHand} from '../session/types';
import {evaluate,compareRanks,handLabel} from '../core/evaluator';
import {handFeatures} from '../bots/features';
import {startingScore} from '../bots/table-craft';
import {heroDecisions,positionOf,type HeroDecision} from './leaks';

export type DrillChoice='fold'|'call'|'raise';
export interface Drill {
 id:string;handId:string;sessionId:string;number:number;street:string;position:string;
 hole:Card[];board:Card[];pot:number;toCall:number;bb:number;canRaise:boolean;
 villain:{seat:number;name:string;position:string;style:string};
 /** What Hero actually did, and how the hand came out. */
 did:DrillChoice;net:number;shown:Card[]|null;shownLabel:string|null;
 prompt:string;
 /** Patch 66: a push/fold spot (tournaments): your hand's rank and the chart's shoving line, as shares of all hands. */
 push?:{rank:number;line:number;stack:number;behind:number};
}
export interface DrillAnswer {best:DrillChoice;close:boolean;equity:number;worth:number;needed:number;why:string}
const RANKS='23456789TJQKA',SUITS='cdhs';
const DECK:Card[]=[...RANKS].flatMap(r=>[...SUITS].map(s=>`${r}${s}` as Card));
const pct=(x:number)=>`${Math.round(100*x)}%`;
const chips=(n:number,bb:number)=>`${Math.round(10*n/bb)/10} BB`;

/** How a player has played in the hands Hero saw this session: public actions only. */
export function observedStyle(hands:readonly StoredHand[],seat:number,name:string):{vpip:number;hands:number;label:string;width:number;aggressive:boolean;faced:number;foldToBet:number|null} {
 let seen=0,vol=0,bets=0,calls=0,folds=0;
 for(const h of hands){
  const s=h.view.seats.find(x=>x.id===seat&&x.name===name);if(!s)continue;seen++;
  const acts=h.view.events.filter(e=>e.type==='action'&&e.seatId===seat);
  if(acts.some(e=>e.street==='preflop'&&(e.action?.type==='call'||e.action?.type==='raise')&&(e.amount??0)>0))vol++;
  bets+=acts.filter(e=>e.street!=='preflop'&&e.action?.type==='raise').length;calls+=acts.filter(e=>e.street!=='preflop'&&e.action?.type==='call').length;folds+=acts.filter(e=>e.street!=='preflop'&&e.action?.type==='fold').length;
 }
 const vpip=seen?vol/seen:.3,aggressive=bets>calls*1.3,label=seen<8?'not much seen yet':`${vpip>=.4?'loose':vpip<=.2?'tight':'medium'}${seen>=8?aggressive?', aggressive':calls>bets*1.5?', calls a lot':'':''}`;
 // Share of hands this player bets or raises with here: wider for loose and aggressive players.
 const width=Math.min(.6,Math.max(.12,.18+.45*(vpip-.2)+(aggressive?.08:0)));
 // Patch 106: how often this player has folded when facing a bet after the flop (a fold or a call each count once).
 return {vpip,hands:seen,label,width,aggressive:seen>=8&&aggressive,faced:folds+calls,foldToBet:folds+calls?folds/(folds+calls):null};
}
/** Drills from these hands: the biggest decisions facing a bet, newest first. */
export function buildDrills(hands:readonly StoredHand[],limit=10):Drill[] {
 const out:Drill[]=[];
 const complete=hands.filter(h=>h.view.street==='complete');
 const spots=complete.flatMap(heroDecisions).filter(d=>d.toCall>0&&d.villain!==null&&['fold','call','raise'].includes(d.event.action?.type??'')
  &&(d.street!=='preflop'||(d.heroOpened&&d.raisesBefore===2))&&d.toCall>=d.bb);
 spots.sort((a,b)=>(b.pot+b.toCall)/b.bb-(a.pot+a.toCall)/a.bb);
 const used=new Set<string>();
 for(const d of spots){if(used.has(d.hand.id))continue;used.add(d.hand.id);out.push(toDrill(d,complete));if(out.length>=limit)break;}
 return out.sort((a,b)=>b.number-a.number);
}
function toDrill(d:HeroDecision,hands:readonly StoredHand[]):Drill {
 const v=d.hand.view,seat=v.seats.find(s=>s.id===d.villain)!,style=observedStyle(hands.filter(h=>h.sessionId===d.hand.sessionId&&h.number<d.hand.number),seat.id,seat.name);
 const shownSeat=Object.hasOwn(v.handLabels,seat.id)?seat.hole:null,did=d.event.action!.type as DrillChoice;
 const what=d.street==='preflop'?`${seat.name} 3-bets to ${chips(d.toCall+(d.frame.seats.find(s=>s.id===0)?.streetCommitted??0),d.bb)}`:`${seat.name} bets ${chips(d.toCall,d.bb)} into ${chips(d.pot-d.toCall,d.bb)}`;
 return {id:`${d.hand.id}:${d.event.revision}`,handId:d.hand.id,sessionId:d.hand.sessionId,number:d.hand.number,street:d.street,position:d.position,hole:d.hole,board:d.board,pot:d.pot,toCall:d.toCall,bb:d.bb,canRaise:d.frame.legal.canRaise,
  villain:{seat:seat.id,name:seat.name,position:positionOf(v,seat.id),style:style.label},did,net:d.hand.net,shown:shownSeat?[...shownSeat] as Card[]:null,shownLabel:shownSeat?v.handLabels[seat.id]:null,
  prompt:`${d.street==='preflop'?'Before the flop':`On the ${d.street}`}, ${what}. Pot after the bet: ${chips(d.pot,d.bb)}; ${chips(d.toCall,d.bb)} to call.`};
}
/** Seeded random so the same drill always gives the same estimate. */
function rng(seed:string){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return ()=>{h=(h+0x6D2B79F5)>>>0;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
/** Your chance to win against their range: the top part of their possible hands here (value) plus a share
 * of their weakest (bluffs). On the river the result is exact; before it, a seeded sample of run-outs. */
export function equityVsRange(hole:readonly Card[],board:readonly Card[],width:number,seed:string,bluffShare=0,trials=900):number {
 const dead=new Set([...hole,...board]),live=DECK.filter(c=>!dead.has(c)),combos:[Card,Card,number][]=[];
 const river=board.length===5,mine=river?evaluate([...hole,...board] as Card[]):null;
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){const pair:[Card,Card]=[live[i],live[j]];
  combos.push([pair[0],pair[1],river?rankScore(evaluate([pair[0],pair[1],...board] as Card[])):board.length?handFeatures(pair,[...board] as Card[]).strength:startingScore(pair)/100]);}
 combos.sort((a,b)=>b[2]-a[2]);
 const size=Math.max(1,Math.round(combos.length*width)),bluffs=Math.round(size*bluffShare);
 const range=[...combos.slice(0,size-bluffs),...combos.slice(combos.length-bluffs)];
 if(river){let score=0;for(const [a,b] of range){const cmp=compareRanks(mine!,evaluate([a,b,...board] as Card[]));score+=cmp>0?1:cmp===0?.5:0;}return score/range.length;}
 const random=rng(seed);let score=0;
 for(let t=0;t<trials;t++){
  const [a,b]=range[Math.floor(random()*range.length)],used=new Set([...dead,a,b]),rest=live.filter(c=>!used.has(c)),run=[...board];
  while(run.length<5){const k=Math.floor(random()*rest.length);run.push(rest[k]);rest.splice(k,1);}
  const cmp=compareRanks(evaluate([...hole,...run] as Card[]),evaluate([a,b,...run]));score+=cmp>0?1:cmp===0?.5:0;
 }
 return score/trials;
}
/** A single number that orders evaluated hands. */
const rankScore=(r:number[])=>[...r,0,0,0,0,0,0].slice(0,6).reduce((t,x)=>t*15+x,0);
/** The rough guide for a drill. */
export function answerDrill(drill:Drill,hands:readonly StoredHand[]):DrillAnswer {
 if(drill.push){
  const {rank,line,stack,behind}=drill.push,best:DrillChoice=rank<line?'raise':'fold',close=Math.abs(rank-line)<.05;
  const why=`With ${stack} big blinds and ${behind} player${behind===1?'':'s'} behind, a standard shoving range is about the top ${pct(line)} of hands. Your hand is in the top ${pct(rank)}, so ${best==='raise'?'shove':'fold'}.${close?' It is right on the line, so either is reasonable.':''} This is a chart guide; it does not model pay jumps.`;
  return {best,close,equity:1-rank,worth:1-rank,needed:1-line,why};
 }
 const style=observedStyle(hands.filter(h=>h.sessionId===drill.sessionId&&h.number<drill.number),drill.villain.seat,drill.villain.name);
 // A 3-bet range is narrower than a betting range after the flop.
 const width=drill.street==='preflop'?Math.min(.2,Math.max(.06,style.width*.35)):style.width;
 const bluffShare=drill.street==='preflop'?0:style.aggressive?.3:style.label.includes('calls a lot')?.08:.18;
 const equity=equityVsRange(drill.hole,drill.board,width,drill.id,bluffShare),needed=drill.toCall/(drill.pot+drill.toCall);
 // You will not always see every card: bets still to come cost some of that equity before the river.
 const realize=({preflop:.85,flop:.7,turn:.85,river:1} as Record<string,number>)[drill.street]??1,worth=equity*realize;
 const strongRaise=drill.canRaise&&equity>=(drill.street==='preflop'?.6:.72);
 const best:DrillChoice=strongRaise?'raise':worth>=needed?'call':'fold',close=Math.abs(worth-needed)<.05&&needed>=.1&&!strongRaise;
 const range=`${drill.villain.name}'s likely ${drill.street==='preflop'?'3-betting':'betting'} hands here (about ${pct(width)} of hands${bluffShare?`, some of them bluffs`:''}; they have played ${style.label})`;
 const why=`You need ${pct(needed)} to call. Against ${range}, your hand wins about ${pct(equity)} at showdown${realize<1?` (worth about ${pct(worth)} once you count the betting still to come)`:''}. ${strongRaise?'That is strong enough to raise for value.':worth>=needed?'Calling makes money over time.':'Folding saves money over time.'}${close?' It is close, so either is reasonable.':''}`;
 return {best,close,equity,worth,needed,why};
}
export const describeCards=(cards:readonly Card[])=>cards.join(' ');
export const madeHand=(hole:readonly Card[],board:readonly Card[])=>board.length>=3?handLabel(evaluate([...hole,...board] as Card[])):'';
