/** Patch 66: your long-run results in each game, with a likely range. The range is the usual 95% interval
 * for an average (mean ± 1.96 × standard error), so it is wide until you have played a lot; the verdict only
 * says "winning" or "losing" when the whole range is on one side of zero. Screen only. */
import type {StoredHand} from '../session/types';
import type {EventResult} from '../tournament/stats';
import type {SlotsState} from '../slots/state';
import {money,type CasinoState,type CasinoGame} from '../casino/wallet';

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
export interface GameResult {game:'cash'|'tournaments'|'blackjack'|'omaha'|'slots'|'roulette'|'craps'|'baccarat'|'races';label:string;samples:number;unit:string;
 /** Below this many samples the range is too rough to trust, so no verdict is given. */
 minimum:number;
 /** Total result in that game's money (cents for cash and blackjack, tournament chips' money for tournaments). */
 net:number;rate:Interval|null;rateLabel:string;verdict:Verdict;more:number|null;
 /** Phase 2: when the rate comes from a recent window rather than every sample
  * ever played (slots and the casino games keep bounded recent lists), this is
  * how many samples the rate and verdict actually rest on. */
 rateSamples?:number;
 /** Phase 2: one extra all-time line for the card (volume, payback, records). */
 detail?:string}
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
/** Phase 2: slots. The all-time totals come from the per-machine records; the rate
 * rests on the recent spins the slots save keeps (its last 30), measured as the
 * result per spin against the bet, like blackjack. Slots have no skill edge, so
 * an honest long-run verdict here is expected to read "likely losing". */
export function slotsResult(slots:SlotsState):GameResult {
 const machines=Object.values(slots.machines),spins=machines.reduce((a,m)=>a+m.spins,0),wagered=machines.reduce((a,m)=>a+m.wagered,0),won=machines.reduce((a,m)=>a+m.won,0);
 const recent=slots.recent.filter(r=>r.bet>0),per=recent.map(r=>100*(r.total-r.bet)/r.bet),i=interval(per);
 const payback=wagered>0?Math.round(1000*won/wagered)/10:null;
 return {game:'slots',label:'Slots',samples:spins,unit:'spins',net:won-wagered,rate:i,rateLabel:'% result per spin vs your bet (recent spins)',rateSamples:recent.length,
  detail:spins?`${spins.toLocaleString()} spins all-time across ${machines.length} machine${machines.length===1?'':'s'} · ${payback?.toFixed(1)}% paid back overall`:'',...judged(i,recent.length,30)};
}
const CASINO_LABELS:Record<CasinoGame,string>={roulette:'Roulette',craps:'Craps',baccarat:'Baccarat',races:'Horse racing'};
/** Phase 2: roulette, craps, baccarat and the races. All-time totals come from the
 * casino save's per-game record; the rate rests on that game's recent rounds
 * (the save keeps the last 60 per game), as the result per round vs the stake. */
export function casinoResult(game:CasinoGame,state:CasinoState):GameResult {
 const r=state.games[game]??{rounds:0,wagered:0,returned:0,biggest:0};
 const recent=state.recent.filter(x=>x.game===game&&x.wagered>0),per=recent.map(x=>100*(x.returned-x.wagered)/x.wagered),i=interval(per);
 const back=r.wagered>0?Math.round(1000*r.returned/r.wagered)/10:null;
 return {game,label:CASINO_LABELS[game],samples:r.rounds,unit:'rounds',net:r.returned-r.wagered,rate:i,rateLabel:'% result per round vs your stake (recent rounds)',rateSamples:recent.length,
  detail:r.rounds?`${r.rounds.toLocaleString()} rounds all-time · ${back?.toFixed(1)}% of stakes returned · biggest round ${money(r.biggest)}`:'',...judged(i,recent.length,60)};
}
