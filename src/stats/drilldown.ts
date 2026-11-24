/** Phase 7: per-game drill-down aggregates for the Stats game-detail pages.
 * Pure functions of the records the games already save. Every figure here is
 * computed from stored records only: where a record does not carry the data a
 * metric would need (per-spot craps amounts, race odds, Omaha action streams,
 * tournament knockouts), the function simply does not produce that metric —
 * the UI lists it as a gap instead of estimating it. Money stays integer
 * cents; rates are plain ratios for display. */
import type {StoredHand} from '../session/types';
import {isCashPerformanceHand} from '../session/hand-provenance';
import type {PloHandRecord,PloSession} from '../plo/table';
import type {BlackjackRound} from '../blackjack/engine';
import type {CasinoState} from '../casino/wallet';
import type {SlotsState} from '../slots/state';
import {slotsMachines,type MachineLine} from './career';
import type {EventResult} from '../tournament/stats';
import {colourOf,label as pocketLabel} from '../casino/roulette';

/* ---------------- Cash poker ---------------- */

/** The canonical cash records the cash statistics are allowed to see: settled,
 * cash-mode, performance-eligible (imported study hands never enter). */
export function cashPerformanceHands(hands:readonly StoredHand[]):StoredHand[] {
 return hands.filter(h=>h.view.street==='complete'&&h.view.profile.mode==='cash'&&isCashPerformanceHand(h,'cash'));
}
export interface TierGroup {tier:'low'|'mid'|'high';label:string;hands:number;net:number;bb100:number|null}
/** Results split by stakes tier, the tier set by the hand's own big blind:
 * low = $2 and under, mid = $5–$10, high = $25 and up. */
export function stakesTierGroups(hands:readonly StoredHand[]):TierGroup[] {
 const defs:{tier:TierGroup['tier'];label:string;test:(bb:number)=>boolean}[]=[
  {tier:'low',label:'Low · big blind $2 or less',test:bb=>bb<=200},
  {tier:'mid',label:'Mid · big blind $5–$10',test:bb=>bb>200&&bb<=1000},
  {tier:'high',label:'High · big blind $25 or more',test:bb=>bb>1000},
 ];
 return defs.map(d=>{
  const rows=hands.filter(h=>d.test(h.view.profile.bigBlind));
  const bbWon=rows.reduce((a,h)=>a+h.net/h.view.profile.bigBlind,0);
  return {tier:d.tier,label:d.label,hands:rows.length,net:rows.reduce((a,h)=>a+h.net,0),bb100:rows.length?100*bbWon/rows.length:null};
 }).filter(g=>g.hands>0);
}
export interface VsOpponent {name:string;hands:number;heroNet:number;heroBb100:number|null;oppNet:number;showdowns:number;heroShowdownWins:number}
/** Your results in the hands each opponent sat in: your net and bb/100 in those
 * hands, their net in the same hands, and how the showdowns between you went
 * (both cards shown; a split pot counts as nobody's win). */
export function heroVsOpponents(hands:readonly StoredHand[]):VsOpponent[] {
 const byName=new Map<string,VsOpponent&{bbSum:number}>();
 for(const h of hands){
  const hero=h.view.seats.find(s=>s.id===0);if(!hero)continue;
  const bb=h.view.profile.bigBlind,heroShown=!!h.view.handLabels?.[0];
  for(const seat of h.view.seats){
   if(seat.id===0)continue;
   const row=byName.get(seat.name)??{name:seat.name,hands:0,heroNet:0,heroBb100:null,oppNet:0,showdowns:0,heroShowdownWins:0,bbSum:0};
   row.hands++;row.heroNet+=h.net;row.bbSum+=h.net/bb;
   row.oppNet+=(h.view.payouts[seat.id]??0)-seat.totalCommitted;
   if(heroShown&&!hero.folded&&!seat.folded&&!!h.view.handLabels?.[seat.id]){
    row.showdowns++;
    if((h.view.payouts[0]??0)>(h.view.payouts[seat.id]??0))row.heroShowdownWins++;
   }
   byName.set(seat.name,row);
  }
 }
 return [...byName.values()].map(({bbSum,...row})=>({...row,heroBb100:row.hands?100*bbSum/row.hands:null})).sort((a,b)=>b.hands-a.hands);
}
export interface PotLine {id:string;number:number;at:string;pot:number;net:number;bb:number}
/** Your biggest pots, won and lost, by the size of your result in the hand. */
export function biggestPots(hands:readonly StoredHand[],limit=5):{won:PotLine[];lost:PotLine[]} {
 const lines=hands.map(h=>({id:h.id,number:h.number,at:h.startedAt,pot:Object.values(h.view.payouts).reduce((a,b)=>a+b,0),net:h.net,bb:h.view.profile.bigBlind}));
 return {
  won:lines.filter(l=>l.net>0).sort((a,b)=>b.net-a.net).slice(0,limit),
  lost:lines.filter(l=>l.net<0).sort((a,b)=>a.net-b.net).slice(0,limit),
 };
}
/** The heads-up subset of the cash records: two-seat tables only. */
export const headsUpHands=(hands:readonly StoredHand[]):StoredHand[]=>hands.filter(h=>h.view.seats.length===2);

/* ---------------- Tournaments ---------------- */

export interface BuyInGroup {label:string;events:number;cashes:number;cost:number;prizes:number;net:number;roi:number|null;itm:number|null}
/** Event results grouped by entry cost. Same accounting as tournament/stats. */
export function buyInTierGroups(events:readonly EventResult[]):BuyInGroup[] {
 const defs:{label:string;test:(cost:number)=>boolean}[]=[
  {label:'Micro · up to $10',test:c=>c<=1000},
  {label:'Low · $11–$50',test:c=>c>1000&&c<=5000},
  {label:'Mid · $51–$200',test:c=>c>5000&&c<=20000},
  {label:'High · over $200',test:c=>c>20000},
 ];
 return defs.map(d=>{
  const rows=events.filter(e=>d.test(e.cost)),cost=rows.reduce((a,e)=>a+e.cost,0),prizes=rows.reduce((a,e)=>a+e.prize,0),cashes=rows.filter(e=>e.prize>0).length;
  return {label:d.label,events:rows.length,cashes,cost,prizes,net:prizes-cost,roi:cost>0?(prizes-cost)/cost:null,itm:rows.length?cashes/rows.length:null};
 }).filter(g=>g.events>0);
}
/** The largest prizes you have won, biggest first. */
export const biggestCashes=(events:readonly EventResult[],limit=5):EventResult[]=>[...events].filter(e=>e.prize>0).sort((a,b)=>b.prize-a.prize).slice(0,limit);

/* ---------------- Omaha ---------------- */

export interface PloDrill {
 hands:number;net:number;bb100:number|null;winRate:number|null;biggestWin:number;biggestLoss:number;
 byStakes:{stakes:string;hands:number;net:number;bb100:number|null}[];
 shownHands:number;shownWins:number;shownBreakdown:{label:string;hands:number;wins:number}[];
 sessions:{stakes:string;startedAt:string;endedAt:string|null;buyIns:number;cashOut:number;hands:number;net:number|null}[];
}
/** Omaha from its hand records. The records carry no action stream, so this is
 * results depth only — VPIP-style rates are a flagged gap, never estimated. */
export function ploDrill(hands:readonly PloHandRecord[],sessions:readonly PloSession[],bigBlindOf:(stakes:string)=>number|undefined):PloDrill {
 const bbSum=hands.reduce((a,h)=>{const bb=bigBlindOf(h.stakes);return bb?a+h.net/bb:a;},0);
 const counted=hands.filter(h=>bigBlindOf(h.stakes)!==undefined).length;
 const byStakes=new Map<string,PloHandRecord[]>();
 for(const h of hands){const rows=byStakes.get(h.stakes)??[];rows.push(h);byStakes.set(h.stakes,rows);}
 const shown=hands.filter(h=>h.shown.some(s=>s.name==='You'));
 return {
  hands:hands.length,net:hands.reduce((a,h)=>a+h.net,0),bb100:counted?100*bbSum/counted:null,
  winRate:hands.length?hands.filter(h=>h.net>0).length/hands.length:null,
  biggestWin:hands.length?Math.max(...hands.map(h=>h.net)):0,biggestLoss:hands.length?Math.min(...hands.map(h=>h.net)):0,
  byStakes:[...byStakes].map(([stakes,rows])=>{const bb=bigBlindOf(stakes);return {stakes,hands:rows.length,net:rows.reduce((a,h)=>a+h.net,0),bb100:bb?100*rows.reduce((a,h)=>a+h.net/bb,0)/rows.length:null};}),
  shownHands:shown.length,shownWins:shown.filter(h=>h.net>0).length,
  shownBreakdown:(()=>{const map=new Map<string,{label:string;hands:number;wins:number}>();for(const h of shown){const label=h.shown.find(s=>s.name==='You')!.label;const row=map.get(label)??{label,hands:0,wins:0};row.hands++;if(h.net>0)row.wins++;map.set(label,row);}return [...map.values()].sort((a,b)=>b.hands-a.hands);})(),
  sessions:sessions.map(s=>({stakes:s.stakes,startedAt:s.startedAt,endedAt:s.endedAt,buyIns:s.buyIns,cashOut:s.cashOut,hands:s.hands,net:s.endedAt?s.cashOut-s.buyIns:null})),
 };
}

/* ---------------- Blackjack ---------------- */

export interface BjOutcome {hands:number;win:number;loss:number;push:number;blackjack:number;surrender:number}
const bjOutcome=():BjOutcome=>({hands:0,win:0,loss:0,push:0,blackjack:0,surrender:0});
function tallyOutcome(o:BjOutcome,result:string|undefined):void {o.hands++;if(result==='win')o.win++;else if(result==='loss')o.loss++;else if(result==='push')o.push++;else if(result==='blackjack')o.blackjack++;else if(result==='surrender')o.surrender++;}
export interface BjGroup {label:string;rounds:number;net:number;winRate:number|null}
export interface BlackjackDrill {
 rounds:number;hands:number;net:number;baseWagered:number;outcomes:BjOutcome;
 doubles:BjOutcome;splits:BjOutcome;
 insurance:{rounds:number;wagered:number;returned:number;net:number};
 byBetSize:BjGroup[];byUpcard:BjGroup[];biggestWin:number;biggestLoss:number;
}
/** Blackjack depth from the full round records. Money splits use the round's
 * own net (the authoritative figure); hand-level splits are outcome counts,
 * because a hand record's payout is defined against its own bet at settle
 * time and is never re-summed here into money. */
export function blackjackDrill(rounds:readonly BlackjackRound[]):BlackjackDrill {
 const outcomes=bjOutcome(),doubles=bjOutcome(),splits=bjOutcome();
 const insurance={rounds:0,wagered:0,returned:0,net:0};
 const betBands:{label:string;test:(bet:number)=>boolean}[]=[
  {label:'$10 or less',test:b=>b<=1000},{label:'$25',test:b=>b>1000&&b<=2500},{label:'$50',test:b=>b>2500&&b<=5000},
  {label:'$100',test:b=>b>5000&&b<=10000},{label:'Over $100',test:b=>b>10000},
 ];
 const upcardOf=(round:BlackjackRound):string=>{
  const card=round.dealer[0]?.split(':')[1]??'';const rank=card[0]??'';
  if(rank==='A')return 'Ace';if('TJQK'.includes(rank))return '10-value';if('23456'.includes(rank))return '2–6';return '7–9';
 };
 const betMap=new Map<string,BjGroup&{won:number}>(),upMap=new Map<string,BjGroup&{won:number}>();
 const group=(map:Map<string,BjGroup&{won:number}>,label:string,round:BlackjackRound)=>{
  const row=map.get(label)??{label,rounds:0,net:0,winRate:null,won:0};
  row.rounds++;row.net+=round.net??0;if((round.net??0)>0)row.won++;map.set(label,row);
 };
 let hands=0;
 for(const round of rounds){
  for(const hand of round.hands){hands++;tallyOutcome(outcomes,hand.result);if(hand.doubled)tallyOutcome(doubles,hand.result);if(hand.split)tallyOutcome(splits,hand.result);}
  if(round.insuranceBet>0){insurance.rounds++;insurance.wagered+=round.insuranceBet;insurance.returned+=round.insuranceReturn;}
  const band=betBands.find(b=>b.test(round.baseBet));if(band)group(betMap,band.label,round);
  group(upMap,upcardOf(round),round);
 }
 insurance.net=insurance.returned-insurance.wagered;
 const finish=(map:Map<string,BjGroup&{won:number}>,order:string[])=>order.map(label=>map.get(label)).filter((g):g is BjGroup&{won:number}=>!!g&&g.rounds>0)
  .map(({won,...g})=>({...g,winRate:g.rounds?won/g.rounds:null}));
 return {
  rounds:rounds.length,hands,net:rounds.reduce((a,r)=>a+(r.net??0),0),baseWagered:rounds.reduce((a,r)=>a+r.baseBet,0),
  outcomes,doubles,splits,insurance,
  byBetSize:finish(betMap,betBands.map(b=>b.label)),
  byUpcard:finish(upMap,['2–6','7–9','10-value','Ace']),
  biggestWin:rounds.length?Math.max(...rounds.map(r=>r.net??0)):0,biggestLoss:rounds.length?Math.min(...rounds.map(r=>r.net??0)):0,
 };
}

/* ---------------- Casino games (roulette, baccarat, craps, races) ---------------- */

export type CasinoRecent=CasinoState['recent'][number];
export interface BetTypeGroup {label:string;rounds:number;wagered:number;returned:number;net:number}
/** Rounds whose saved note names exactly one bet: only those can be honestly
 * attributed to a bet type, because the note records no per-bet amounts.
 * Returns the groups plus how many rounds were left out as multi-bet. */
function singleBetGroups(recent:readonly CasinoRecent[],game:CasinoRecent['game']):{groups:BetTypeGroup[];multi:number} {
 const map=new Map<string,BetTypeGroup>();let multi=0;
 for(const r of recent){
  if(r.game!==game||!r.bet)continue;
  if(r.bet.includes(' · ')||r.bet.includes(' + ')){multi++;continue;}
  const row=map.get(r.bet)??{label:r.bet,rounds:0,wagered:0,returned:0,net:0};
  row.rounds++;row.wagered+=r.wagered;row.returned+=r.returned;row.net+=r.returned-r.wagered;map.set(r.bet,row);
 }
 return {groups:[...map.values()].sort((a,b)=>b.rounds-a.rounds),multi};
}
export interface RouletteDrill {
 spins:number;red:number;black:number;green:number;
 dozens:[number,number,number];columns:[number,number,number];
 evenMoney:{label:string;count:number}[];
 hot:{label:string;count:number}[];cold:{label:string;count:number}[];
 byBetType:BetTypeGroup[];multiBetRounds:number;
}
/** Roulette from the saved pocket board (last 300 spins) plus single-bet
 * attribution from the recent-round notes. */
export function rouletteDrill(board:readonly unknown[],recent:readonly CasinoRecent[]):RouletteDrill {
 const pockets=board.filter((p):p is number=>typeof p==='number'&&Number.isInteger(p)&&p>=0&&p<=37);
 const counts=new Map<number,number>();for(const p of pockets)counts.set(p,(counts.get(p)??0)+1);
 const dozens:[number,number,number]=[0,0,0],columns:[number,number,number]=[0,0,0];
 let red=0,black=0,green=0,odd=0,even=0,low=0,high=0;
 for(const p of pockets){
  const c=colourOf(p);if(c==='red')red++;else if(c==='black')black++;else green++;
  if(p>=1&&p<=36){dozens[Math.floor((p-1)/12)]++;columns[(p-1)%3]++;if(p%2)odd++;else even++;if(p<=18)low++;else high++;}
 }
 const ranked=[...counts].map(([p,count])=>({label:pocketLabel(p),count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 const hot=ranked.slice(0,5),hotLabels=new Set(hot.map(r=>r.label));
 const {groups,multi}=singleBetGroups(recent,'roulette');
 return {spins:pockets.length,red,black,green,dozens,columns,
  evenMoney:[{label:'Red',count:red},{label:'Black',count:black},{label:'Odd',count:odd},{label:'Even',count:even},{label:'1–18',count:low},{label:'19–36',count:high}],
  hot,cold:ranked.filter(r=>!hotLabels.has(r.label)).slice(-5).reverse(),byBetType:groups,multiBetRounds:multi};
}
export interface BaccaratDrill {
 coups:number;player:number;banker:number;tie:number;
 longestPlayer:number;longestBanker:number;current:{side:'P'|'B'|'T';length:number}|null;
 bySpot:BetTypeGroup[];multiSpotRounds:number;
}
/** Baccarat from the saved result board (the current shoe's last 150 coups)
 * plus single-spot attribution from the recent-round notes. */
export function baccaratDrill(board:readonly unknown[],recent:readonly CasinoRecent[]):BaccaratDrill {
 const seq=board.filter((x):x is 'P'|'B'|'T'=>x==='P'||x==='B'||x==='T');
 let longestPlayer=0,longestBanker=0,run=0,runSide='';
 for(const x of seq){if(x===runSide)run++;else{runSide=x;run=1;}if(x==='P')longestPlayer=Math.max(longestPlayer,run);if(x==='B')longestBanker=Math.max(longestBanker,run);}
 let current:BaccaratDrill['current']=null;
 if(seq.length){const side=seq[seq.length-1];let length=0;for(let i=seq.length-1;i>=0&&seq[i]===side;i--)length++;current={side,length};}
 const {groups,multi}=singleBetGroups(recent,'baccarat');
 return {coups:seq.length,player:seq.filter(x=>x==='P').length,banker:seq.filter(x=>x==='B').length,tie:seq.filter(x=>x==='T').length,
  longestPlayer,longestBanker,current,bySpot:groups,multiSpotRounds:multi};
}
export interface CrapsDrill {
 rolls:number;sums:{sum:number;count:number;expected:number}[];
 sevens:number;hard:{sum:number;count:number}[];doubles:number;
 recentRolls:number;recentWagered:number;recentReturned:number;recentNet:number;
 bestRoll:{profit:number;result:string}|null;
}
/** Craps from the saved dice board (last 600 rolls). The recent-round notes
 * name the spots that settled but carry no per-spot amounts, so results by
 * bet type are a gap; the dice distribution is exact. */
export function crapsDrill(board:readonly unknown[],recent:readonly CasinoRecent[]):CrapsDrill {
 const dice=board.filter((d):d is [number,number]=>Array.isArray(d)&&d.length===2&&d.every(x=>Number.isInteger(x)&&x>=1&&x<=6)) as [number,number][];
 const ways=[1,2,3,4,5,6,5,4,3,2,1];
 const sums=Array.from({length:11},(_,i)=>({sum:i+2,count:0,expected:ways[i]/36}));
 let sevens=0,doubles=0;const hard=new Map<number,number>();
 for(const [a,b] of dice){const s=a+b;sums[s-2].count++;if(s===7)sevens++;if(a===b){doubles++;if([4,6,8,10].includes(s))hard.set(s,(hard.get(s)??0)+1);}}
 const mine=recent.filter(r=>r.game==='craps');
 const best=mine.length?mine.reduce((a,r)=>(r.returned-r.wagered)>(a.returned-a.wagered)?r:a):null;
 return {rolls:dice.length,sums,sevens,hard:[4,6,8,10].map(sum=>({sum,count:hard.get(sum)??0})),doubles,
  recentRolls:mine.length,recentWagered:mine.reduce((a,r)=>a+r.wagered,0),recentReturned:mine.reduce((a,r)=>a+r.returned,0),
  recentNet:mine.reduce((a,r)=>a+(r.returned-r.wagered),0),
  bestRoll:best?{profit:best.returned-best.wagered,result:best.result??''}:null};
}
export interface RacesDrill {
 rounds:number;wagered:number;returned:number;net:number;roi:number|null;cashed:number;
 byType:BetTypeGroup[];multiBetRounds:number;
 betFrequency:{kind:string;rounds:number}[];
 bestWins:{profit:number;bet:string;result:string}[];
 winners:{name:string;wins:number}[];
}
/** Racing from the recent-round notes (last 60 rounds) and the winners board
 * (last 12 winners). The notes record no odds, so results by odds band are a
 * gap; bet-type money is attributed only for single-bet rounds. */
export function racesDrill(recent:readonly CasinoRecent[],board:readonly unknown[]):RacesDrill {
 const mine=recent.filter(r=>r.game==='races');
 const wagered=mine.reduce((a,r)=>a+r.wagered,0),returned=mine.reduce((a,r)=>a+r.returned,0);
 const {groups,multi}=singleBetGroups(mine,'races');
 const freq=new Map<string,number>();
 for(const r of mine){
  if(!r.bet||r.bet.includes(' + '))continue;
  for(const part of r.bet.split(' · ')){const kind=part.split(' ')[0];if(kind&&/^[A-Za-z]+$/.test(kind))freq.set(kind,(freq.get(kind)??0)+1);}
 }
 const winCount=new Map<string,number>();
 for(const name of board)if(typeof name==='string'&&name)winCount.set(name,(winCount.get(name)??0)+1);
 return {rounds:mine.length,wagered,returned,net:returned-wagered,roi:wagered?returned/wagered-1:null,
  cashed:mine.filter(r=>r.returned>0).length,byType:groups,multiBetRounds:multi,
  betFrequency:[...freq].map(([kind,rounds])=>({kind,rounds})).sort((a,b)=>b.rounds-a.rounds),
  bestWins:[...mine].sort((a,b)=>(b.returned-b.wagered)-(a.returned-a.wagered)).slice(0,5).map(r=>({profit:r.returned-r.wagered,bet:r.bet??'',result:r.result??''})),
  winners:[...winCount].map(([name,wins])=>({name,wins})).sort((a,b)=>b.wins-a.wins)};
}

/* ---------------- Slots ---------------- */

export interface SlotsDrill {
 machines:(MachineLine&{avgBet:number|null;featurePct:number|null})[];
 recentSpins:number;recentHits:number;recentHitPct:number|null;recentNet:number;
 recentByMachine:{id:string;spins:number;hits:number;net:number}[];
 gamble:{rounds:number;wagered:number;won:number;net:number}|null;
}
/** Slots depth: all-time per-machine records (from the career aggregation)
 * plus hit frequency over the recent spins the save keeps (its last 30,
 * across all machines — labelled as a recent window, never as all-time).
 * The save counts features as one combined number, so free spins, hold & win
 * and wheel features cannot be split apart — a gap, not an estimate. */
export function slotsDrill(state:SlotsState):SlotsDrill {
 const recent=state.recent;
 const byMachine=new Map<string,{id:string;spins:number;hits:number;net:number}>();
 for(const r of recent){const row=byMachine.get(r.machine)??{id:r.machine,spins:0,hits:0,net:0};row.spins++;if(r.total>0)row.hits++;row.net+=r.total-r.bet;byMachine.set(r.machine,row);}
 return {
  machines:slotsMachines(state).map(m=>({...m,avgBet:m.spins?m.wagered/m.spins:null,featurePct:m.spins?100*m.features/m.spins:null})),
  recentSpins:recent.length,recentHits:recent.filter(r=>r.total>0).length,recentNet:recent.reduce((s,r)=>s+r.total-r.bet,0),
  recentHitPct:recent.length?100*recent.filter(r=>r.total>0).length/recent.length:null,
  recentByMachine:[...byMachine.values()].sort((a,b)=>b.spins-a.spins),
  gamble:state.gamble?{rounds:state.gamble.rounds,wagered:state.gamble.wagered,won:state.gamble.won,net:state.gamble.won-state.gamble.wagered}:null,
 };
}
