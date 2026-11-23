/** Patch 66: your long-run results in each game, with a likely range. The range is the usual 95% interval
 * for an average (mean ± 1.96 × standard error), so it is wide until you have played a lot; the verdict only
 * says "winning" or "losing" when the whole range is on one side of zero. Screen only. */
import type {StoredHand} from '../session/types';
import type {EventResult} from '../tournament/stats';

export interface Interval {n:number;mean:number;low:number;high:number}
export type Verdict='winning'|'losing'|'too-early';
export function interval(values:readonly number[]):Interval|null {
 const n=values.length;if(n<2)return null;
 const mean=values.reduce((a,b)=>a+b,0)/n,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1),half=1.96*Math.sqrt(variance/n);
 return {n,mean,low:mean-half,high:mean+half};
}
export const verdict=(i:Interval|null):Verdict=>!i?'too-early':i.low>0?'winning':i.high<0?'losing':'too-early';
/** Roughly how many more samples until the range would no longer cross zero, if the average held. */
export function moreNeeded(i:Interval|null):number|null {
 if(!i||i.mean===0)return null;const half=(i.high-i.low)/2;if(Math.abs(i.mean)>=half)return 0;
 return Math.ceil(i.n*((half/Math.abs(i.mean))**2-1));
}
export interface GameResult {game:'cash'|'tournaments'|'blackjack'|'omaha';label:string;samples:number;unit:string;
 /** Below this many samples the range is too rough to trust, so no verdict is given. */
 minimum:number;
 /** Total result in that game's money (cents for cash and blackjack, tournament chips' money for tournaments). */
 net:number;rate:Interval|null;rateLabel:string;verdict:Verdict;more:number|null}
const judged=(i:Interval|null,n:number,minimum:number)=>({minimum,verdict:n>=minimum?verdict(i):'too-early' as Verdict,more:n>=minimum?moreNeeded(i):null});
/** Cash: big blinds won per 100 hands. */
export function cashResult(hands:readonly StoredHand[]):GameResult {
 const per=hands.filter(h=>h.view.street==='complete').map(h=>100*h.net/h.view.profile.bigBlind),i=interval(per);
 return {game:'cash',label:'Cash games',samples:per.length,unit:'hands',net:hands.reduce((a,h)=>a+h.net,0),rate:i,rateLabel:'big blinds per 100 hands',...judged(i,per.length,300)};
}
/** Tournaments: return on buy-ins, as a percentage per event. */
export function tournamentResult(events:readonly EventResult[]):GameResult {
 const avg=events.length?events.reduce((a,e)=>a+e.cost,0)/events.length:0,per=events.map(e=>avg>0?100*e.net/avg:0),i=interval(per);
 return {game:'tournaments',label:'Tournaments',samples:events.length,unit:'events',net:events.reduce((a,e)=>a+e.net,0),rate:i,rateLabel:'% return on buy-ins',...judged(i,per.length,10)};
}
/** Blackjack: result per round as a percentage of the opening bet (your edge). */
export function blackjackResult(rounds:readonly {net:number;bet:number}[]):GameResult {
 const played=rounds.filter(r=>r.bet>0),per=played.map(r=>100*r.net/r.bet),i=interval(per);
 return {game:'blackjack',label:'Blackjack',samples:played.length,unit:'rounds',net:played.reduce((a,r)=>a+r.net,0),rate:i,rateLabel:'% of your opening bet per round',...judged(i,per.length,200)};
}
/** Patch 81: Omaha, in big blinds per 100 hands, like cash. Each hand record carries its stakes label. */
export function omahaResult(hands:readonly {net:number;stakes:string}[],bigBlindOf:(stakes:string)=>number|undefined):GameResult {
 const per=hands.flatMap(h=>{const bb=bigBlindOf(h.stakes);return bb?[100*h.net/bb]:[];}),i=interval(per);
 return {game:'omaha',label:'Pot-Limit Omaha',samples:per.length,unit:'hands',net:hands.reduce((a,h)=>a+h.net,0),rate:i,rateLabel:'big blinds per 100 hands',...judged(i,per.length,300)};
}
