/** Patch 89: deeper stats, for you and for every player you have sat with. Descriptive counts from saved hands:
 * only public actions, plus cards that were shown at showdown (and your own cards, for your stats). Small samples are
 * marked; nothing here is a prediction or a solver figure. Display only. */
import type {Card,HeroViewModel} from '../contracts';
import type {StoredHand,CashSession} from '../session/types';
import {revealedAtShowdown} from '../bots/insight';
import {positionOf} from './leaks';
import {evaluate,compareRanks} from '../core/evaluator';

export interface Count {count:number;of:number}
const c=():Count=>({count:0,of:0});
const add=(x:Count,hit:boolean)=>{x.of++;if(hit)x.count++;};
export const pct=(x:Count)=>x.of?100*x.count/x.of:null;

export interface PlayerStats {
 name:string;hands:number;net:number;biggestWin:number;biggestLoss:number;
 vpip:Count;pfr:Count;limp:Count;coldCall:Count;threeBet:Count;fourBet:Count;foldToThreeBet:Count;steal:Count;foldToSteal:Count;
 cbet:Count;foldToCbet:Count;turnBarrel:Count;donk:Count;checkRaise:Count;
 /** Postflop bets and raises against calls, and against all postflop actions. */
 bets:number;calls:number;postflopActions:number;
 sawFlop:Count;wtsd:Count;wsd:Count;wwsf:Count;
 showdownNet:number;nonShowdownNet:number;
 shown:Card[][];
}
const empty=(name:string):PlayerStats=>({name,hands:0,net:0,biggestWin:0,biggestLoss:0,vpip:c(),pfr:c(),limp:c(),coldCall:c(),threeBet:c(),fourBet:c(),foldToThreeBet:c(),steal:c(),foldToSteal:c(),cbet:c(),foldToCbet:c(),turnBarrel:c(),donk:c(),checkRaise:c(),bets:0,calls:0,postflopActions:0,sawFlop:c(),wtsd:c(),wsd:c(),wwsf:c(),showdownNet:0,nonShowdownNet:0,shown:[]});
export const aggressionFactor=(s:PlayerStats)=>s.calls?s.bets/s.calls:s.bets?Infinity:null;
export const aggressionFrequency=(s:PlayerStats)=>s.postflopActions?100*s.bets/s.postflopActions:null;

/** One seat's stats in one hand, added into `s`. Public actions only. */
function addHand(s:PlayerStats,v:HeroViewModel,seat:number):void {
 const me=v.seats.find(x=>x.id===seat);if(!me)return;
 s.hands++;
 const won=v.payouts[seat]??0,net=won-me.totalCommitted;s.net+=net;s.biggestWin=Math.max(s.biggestWin,net);s.biggestLoss=Math.min(s.biggestLoss,net);
 const acts=v.events.filter(e=>e.type==='action'&&e.action),pre=acts.filter(e=>(e.street??'preflop')==='preflop');
 // Preflop.
 const pos=positionOf(v,seat),late=(p:string)=>p==='BTN'||p==='CO'||p==='SB'||p==='BTN/SB',blind=seat===v.bigBlindSeat||seat===v.smallBlindSeat;
 let raises=0,lastRaiser:number|undefined,iRaised=false,iOpened=false,first=true,vp=false,pf=false,threeSeen=false,fourSeen=false,stealFaced=false,stealAnswered=false;
 const entered=new Set<number>();
 for(const e of pre){
  const a=e.action!.type,sid=e.seatId!;
  if(sid===seat){
   if(first){
    first=false;
    if(raises===0&&entered.size===0&&late(pos))add(s.steal,a==='raise');
    if(raises===0&&!(seat===v.bigBlindSeat&&a==='check'))add(s.limp,a==='call');
    if(raises>=1&&!entered.has(seat))add(s.coldCall,a==='call');
   }
   if(raises===1&&!iRaised&&!threeSeen){threeSeen=true;add(s.threeBet,a==='raise');}
   if(raises===2&&iOpened&&!fourSeen){fourSeen=true;add(s.fourBet,a==='raise');add(s.foldToThreeBet,a==='fold');}
   if(stealFaced&&!stealAnswered){stealAnswered=true;add(s.foldToSteal,a==='fold');}
   if(a==='call'||a==='raise')vp=true;
   if(a==='raise'){pf=true;if(raises===0)iOpened=true;iRaised=true;}
  }else if(a==='raise'&&raises===0&&entered.size===0&&blind&&late(positionOf(v,sid)))stealFaced=true;
  if(a==='call'||a==='raise')entered.add(sid);
  if(a==='raise'){raises++;lastRaiser=sid;}
 }
 if(pre.some(e=>e.seatId===seat)){add(s.vpip,vp);add(s.pfr,pf);}
 // Postflop.
 const flopSeen=v.board.length>=3&&!pre.some(e=>e.seatId===seat&&e.action!.type==='fold')&&v.events.some(e=>e.type==='street'&&e.street==='flop');
 add(s.sawFlop,flopSeen);
 const revealed=new Set(revealedAtShowdown(v.street,Object.keys(v.handLabels??{}).map(Number),v.seats).map(r=>r.id));
 const live=v.seats.filter(x=>!x.folded).length;
 const sd=flopSeen&&!me.folded&&live>=2&&v.street==='complete';
 if(flopSeen){add(s.wtsd,sd);add(s.wwsf,won>0);}
 if(sd){add(s.wsd,won>0);s.showdownNet+=net;}else s.nonShowdownNet+=net;
 if(revealed.has(seat)&&seat!==0&&me.hole.length===2)s.shown.push([...me.hole]);
 for(const street of ['flop','turn','river'] as const){
  const st=acts.filter(e=>e.street===street);if(!st.length)continue;
  let wagered=false,checked=false,aggressorActed=false,cbetBy:number|undefined,answered=false;
  for(const e of st){
   const a=e.action!.type,sid=e.seatId!;
   if(sid===seat){
    s.postflopActions++;if(a==='raise')s.bets++;if(a==='call')s.calls++;
    if(street==='flop'&&!wagered&&lastRaiser===seat)add(s.cbet,a==='raise');
    if(street==='flop'&&!wagered&&!aggressorActed&&lastRaiser!==undefined&&lastRaiser!==seat)add(s.donk,a==='raise');
    if(street==='turn'&&!wagered&&lastRaiser===seat&&acts.some(x=>x.street==='flop'&&x.seatId===seat&&x.action!.type==='raise'))add(s.turnBarrel,a==='raise');
    if(wagered&&checked)add(s.checkRaise,a==='raise');
    if(cbetBy!==undefined&&!answered){answered=true;add(s.foldToCbet,a==='fold');}
    if(a==='check')checked=true;
   }
   if(sid===lastRaiser)aggressorActed=true;
   if(a==='raise'){if(street==='flop'&&!wagered&&sid===lastRaiser&&sid!==seat)cbetBy=sid;wagered=true;}
  }
 }
}
/** Stats for every named player in these hands. Seat 0 is you, named "You". */
export function deepStats(hands:readonly StoredHand[]):Map<string,PlayerStats> {
 const out=new Map<string,PlayerStats>();
 for(const h of hands){if(h.view.street!=='complete')continue;
  for(const seat of h.view.seats){const name=seat.id===0?'You':seat.name;let s=out.get(name);if(!s){s=empty(name);out.set(name,s);}addHand(s,h.view,seat.id);}}
 return out;
}

/* ---------- Your own extras ---------- */
const RANKS='23456789TJQKA';
/** A starting-hand label like "AKs", "TT" or "72o". */
export function handCode(hole:readonly Card[]):string {
 const [a,b]=[...hole].sort((x,y)=>RANKS.indexOf(y[0])-RANKS.indexOf(x[0]));
 return a[0]===b[0]?a[0]+b[0]:a[0]+b[0]+(a[1]===b[1]?'s':'o');
}
export function handGroup(hole:readonly Card[]):string {
 const code=handCode(hole),hi=RANKS.indexOf(code[0]),lo=RANKS.indexOf(code[1]),suited=code.endsWith('s');
 if(code.length===2)return hi>=8?'Big pairs (TT+)':'Small and middle pairs';
 if(hi>=8&&lo>=8)return 'Broadway cards';
 if(code[0]==='A')return suited?'Suited aces':'Offsuit aces';
 if(suited&&hi-lo<=2)return 'Suited connectors and gappers';
 if(suited)return 'Other suited hands';
 return 'Other offsuit hands';
}
export interface Group {key:string;hands:number;net:number;bb:number}
export interface HeroExtras {
 groups:Group[];best:Group[];worst:Group[];
 streakWin:number;streakLose:number;bestSession:number|null;worstSession:number|null;
 straddled:{hands:number;net:number;bb:number;yours:number};
 allIn:AllInLuck;
}
export interface AllInLuck {spots:number;expected:number;actual:number;avgEquity:number|null;won:number;expectedWins:number}

/** Your chance to win (ties count half) against one known hand, from the board at the moment of the all-in. */
export function equityVs(hero:readonly Card[],villain:readonly Card[],board:readonly Card[],seed='eq',trials=1500):number {
 const used=new Set([...hero,...villain,...board]),deck:Card[]=[];
 for(const r of RANKS)for(const s of 'cdhs'){const k=(r+s) as Card;if(!used.has(k))deck.push(k);}
 const need=5-board.length;let win=0,n=0;
 const score=(extra:Card[])=>{const all=[...board,...extra];const cmp=compareRanks(evaluate([...hero,...all]),evaluate([...villain,...all]));win+=cmp>0?1:cmp===0?.5:0;n++;};
 if(need===0)score([]);
 else if(need===1)for(const x of deck)score([x]);
 else if(need===2){for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)score([deck[i],deck[j]]);}
 else{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  const rnd=()=>{h=(Math.imul(h^(h>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return h/4294967296;};
  for(let t=0;t<trials;t++){const pick:Card[]=[],taken=new Set<number>();while(pick.length<need){const i=Math.floor(rnd()*deck.length);if(!taken.has(i)){taken.add(i);pick.push(deck[i]);}}score(pick);}}
 return n?win/n:0;
}
/** All-ins where you and exactly one other player were all in or called before the river and both hands were shown. */
export function allInLuck(hands:readonly StoredHand[]):AllInLuck {
 const out:AllInLuck={spots:0,expected:0,actual:0,avgEquity:null,won:0,expectedWins:0};let eqSum=0;
 for(const h of hands){
  const v=h.view;if(v.street!=='complete'||v.board.length!==5)continue;
  const hero=v.seats.find(s=>s.id===0);if(!hero||hero.folded||hero.hole.length!==2)continue;
  const live=v.seats.filter(s=>!s.folded);if(live.length!==2)continue;
  const villain=live.find(s=>s.id!==0)!;if(villain.hole.length!==2||!(hero.allIn||villain.allIn))continue;
  // The street on which the money went in: the last street with any action.
  const acts=v.events.filter(e=>e.type==='action');const last=acts.at(-1);if(!last)continue;
  const street=last.street??'preflop';if(street==='river')continue;
  const board=v.board.slice(0,{preflop:0,flop:3,turn:4}[street as 'preflop'|'flop'|'turn']);
  const pot=Object.values(v.payouts).reduce((a,b)=>a+b,0);
  const eq=equityVs(hero.hole,villain.hole,board,h.id);
  out.spots++;eqSum+=eq;out.expected+=eq*pot-hero.totalCommitted;out.actual+=(v.payouts[0]??0)-hero.totalCommitted;out.expectedWins+=eq;if((v.payouts[0]??0)>pot/2)out.won++;
 }
 out.avgEquity=out.spots?eqSum/out.spots:null;return out;
}
export function heroExtras(hands:readonly StoredHand[],sessions:readonly CashSession[]):HeroExtras {
 const groups=new Map<string,Group>(),codes=new Map<string,Group>();
 const sorted=[...hands].filter(h=>h.view.street==='complete').sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.number-b.number);
 let run=0,streakWin=0,streakLose=0;
 const straddled={hands:0,net:0,bb:0,yours:0};
 for(const h of sorted){
  const hero=h.view.seats.find(s=>s.id===0),bb=h.view.profile.bigBlind;if(!hero||hero.hole.length!==2)continue;
  for(const [map,key] of [[groups,handGroup(hero.hole)],[codes,handCode(hero.hole)]] as const){const g=map.get(key)??{key,hands:0,net:0,bb:0};g.hands++;g.net+=h.net;g.bb+=h.net/bb;map.set(key,g);}
  if(h.net>0){run=run>0?run+1:1;streakWin=Math.max(streakWin,run);}else if(h.net<0){run=run<0?run-1:-1;streakLose=Math.max(streakLose,-run);}
  if(h.view.straddleSeat!==undefined){straddled.hands++;straddled.net+=h.net;straddled.bb+=h.net/bb;if(h.view.straddleSeat===0)straddled.yours++;}
 }
 const enough=[...codes.values()].filter(g=>g.hands>=3);
 const results=sessions.filter(s=>s.endedAt).map(s=>s.cashOut-s.buyIns);
 const order=['Big pairs (TT+)','Small and middle pairs','Broadway cards','Suited aces','Offsuit aces','Suited connectors and gappers','Other suited hands','Other offsuit hands'];
 return {groups:order.map(k=>groups.get(k)).filter((g):g is Group=>!!g),best:[...enough].sort((a,b)=>b.bb-a.bb).slice(0,5),worst:[...enough].sort((a,b)=>a.bb-b.bb).slice(0,5),
  streakWin,streakLose,bestSession:results.length?Math.max(...results):null,worstSession:results.length?Math.min(...results):null,straddled,allIn:allInLuck(sorted)};
}
