/** Patch 105: the Live coach for Texas hold'em. For Hero's decision it recommends a play and a size, and explains
 * why in the order of the user's own notecards: Ranges, Objective, Responses, Alternatives, Future (R-O-R-A-F).
 *
 * It is a rule-based coach built from the principles in the user's Master Playbook, not a solver. Every number it
 * shows is labelled: `exact` (counted from the cards and the pot), `estimate` (Hero's chance against an assumed
 * range), `pool` (live-pool averages recorded in the playbook), `rule` (a rule of thumb) or `measured` (Patch 106:
 * measured in a long simulated test against this app's own players).
 *
 * It reads only what Hero can see: Hero's two cards, the board, the pot, the stacks and the public actions. It never
 * reads another seat's cards and it has no access to the deck. Display only: nothing here reaches the engine or the
 * bots. */
import type {Card,HeroViewModel} from '../contracts';
import {evaluate,compareRanks,handLabel} from '../core/evaluator';
import {positionOf} from '../stats/leaks';
import {equityVsRange} from '../stats/drills';
import {oddsHelp,boardCategory} from '../ui/odds-helper';
import {ORDER,RANKS,handClass,percentile,inTop,describeTop,openWidth,BB_DEFEND,shoveWidth,valueThreeBet,bluffThreeBet,speculative} from './ranges';
import {LESSONS,NOTECARDS,OVERLAYS,type Lesson,type Notecard} from './lessons';
import {classifySpot,chartCoverage,poolFor,callEv,betEv,raiseEv,riskPremium,commitEquity,tournamentStage,depthRead,type Alternative,type PoolProfile,type StakeBand,type TournamentCoachContext} from './engine';

export type CoachAction='fold'|'check'|'call'|'bet'|'raise'|'all-in';
export type Basis='exact'|'estimate'|'pool'|'rule'|'measured'|'icm';
export type {Alternative,StakeBand,TournamentCoachContext} from './engine';
export interface CoachNumber {label:string;value:string;basis:Basis}
export interface Why {ranges:string;objective:string;responses:string;alternatives:string;future:string}
export interface Advice {
 /** The decision this advice is for. */
 key:string;action:CoachAction;
 /** For a bet or raise: the total to put in on this street. */
 to:number|null;headline:string;close:boolean;
 /** What the hand is for in this spot ("thick value", "strong draw", "top 6% of starting hands"). */
 job:string;why:Why;numbers:CoachNumber[];lesson:Lesson;card:Notecard;overlay:Notecard;
 /** The notecard for the situation (facing a bet, facing a raise, or free to bet), which does not give the play away. */
 ask:Notecard;
 /** Phase 3 (Coach Engine Spec): the spot classification, in the spec's terms. */
 spot?:string;
 /** Phase 3: the close alternatives with their relative EV where the spec's math supports an estimate
  * (null EV = a chart decision, where no honest EV estimate exists). Sorted best first. */
 alternatives?:Alternative[];
 /** Phase 3: set when no playbook chart covers this spot — the advice is then a principle-based read,
  * and the panel says so instead of dressing it up as chart precision. */
 gap?:string;
 /** Phase 3: true when tournament advice was priced with the payout context (ICM), not chip EV alone. */
 icmPriced?:boolean;
}
export interface PlayerRead {label:string;hands:number;aggressive:boolean;vpip:number;
 /** Times this player has faced a bet after the flop and folded or called, and the share of those that were folds. */
 faced?:number;foldToBet?:number|null}
export interface CoachOptions {mode:'cash'|'tournament';money:(n:number)=>string;
 /** What Hero has seen a player do this session (public actions only), if anything. */
 styleOf?:(seat:number)=>PlayerRead|null;
 /** Phase 3: the stake band, which selects the pool profile (playbook-sourced per-stake tendencies).
  * Unset = the playbook's live mixed-stakes pool, the coach's original behaviour. */
 stake?:StakeBand;
 /** Phase 3: the tournament payout context (players left, places paid, prizes, stacks), when the app
  * can supply it. Supplied, tournament advice prices prize equity (ICM); unsupplied, it falls back to
  * the stage/stack-risk heuristics and labels them as rules of thumb. */
 tournament?:TournamentCoachContext}

/** Live-pool averages recorded in the user's playbook (a mixed-stakes live database). The bots here may differ. */
export const POOL={flopFoldThird:.31,flopFold:.42,turnFold:.40,riverFold:.49,foldToThreeBet:.34,riverBluffShare:.32};
/** Patch 106: measured in a long simulated test of this coach against this app's computer players (about one million
 * hands in all). They describe these opponents, not live players, and they are shown with the label "measured here". */
export const MEASURED={riverCatcherWins:.11,flopBetFolds:.5,turnBetFolds:.47};
const pct=(x:number)=>`${Math.round(100*x)}%`;
/** An EV in chips, labelled in big blinds (Phase 3 alternatives). */
const evLabel=(ev:number,bb:number)=>`${ev>=0?'+':'-'}${Math.abs(ev/Math.max(1,bb)).toFixed(1)} bb`;
const value=(c:Card)=>RANKS.indexOf(c[0])+2;
const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
const cache=new Map<string,number>();
const memo=(key:string,f:()=>number)=>{const k=cache.get(key);if(k!==undefined)return k;if(cache.size>400)cache.clear();const v=f();cache.set(key,v);return v;};
function rng(seed:string){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return ()=>{h=(h+0x6D2B79F5)>>>0;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const SUITS='cdhs';
/** Before the flop: Hero's chance to win at showdown against the top `share` of starting hands (a seeded sample). */
export function equityVsTop(hole:readonly Card[],share:number,seed:string,trials=600):number {
 return memo(`pre|${hole.join('')}|${share.toFixed(3)}|${trials}`,()=>{
  const dead=new Set(hole),combos:[Card,Card][]=[];
  for(const h of ORDER){if(!inTop(h.key,share))break;const a=RANKS[h.hi-2],b=RANKS[h.lo-2];
   for(const s1 of SUITS)for(const s2 of SUITS){if(h.pair?s1>=s2:h.suited!==(s1===s2))continue;const c1=a+s1,c2=b+s2;if(!dead.has(c1)&&!dead.has(c2))combos.push([c1,c2]);}}
  if(!combos.length)return .5;
  const deck:Card[]=[];for(const r of RANKS)for(const s of SUITS)if(!dead.has(r+s))deck.push(r+s);
  const random=rng(seed);let score=0;
  for(let t=0;t<trials;t++){const [a,b]=combos[Math.floor(random()*combos.length)],rest=deck.filter(c=>c!==a&&c!==b),board:Card[]=[];
   while(board.length<5){const k=Math.floor(random()*rest.length);board.push(rest[k]);rest.splice(k,1);}
   const cmp=compareRanks(evaluate([...hole,...board]),evaluate([a,b,...board]));score+=cmp>0?1:cmp===0?.5:0;}
  return score/trials;});
}
/** Before the flop: Hero's chance against a named list of hands (for the tiny ranges deep in the betting). */
export function equityVsHands(hole:readonly Card[],keys:readonly string[],seed:string,trials=600):number {
 return memo(`hands|${hole.join('')}|${keys.join(',')}|${trials}`,()=>{
  const dead=new Set(hole),combos:[Card,Card][]=[];
  for(const h of ORDER){if(!keys.includes(h.key))continue;const a=RANKS[h.hi-2],b=RANKS[h.lo-2];
   for(const s1 of SUITS)for(const s2 of SUITS){if(h.pair?s1>=s2:h.suited!==(s1===s2))continue;const c1=a+s1,c2=b+s2;if(!dead.has(c1)&&!dead.has(c2))combos.push([c1,c2]);}}
  if(!combos.length)return .5;
  const deck:Card[]=[];for(const r of RANKS)for(const s of SUITS)if(!dead.has(r+s))deck.push(r+s);
  const random=rng(seed);let score=0;
  for(let t=0;t<trials;t++){const [a,b]=combos[Math.floor(random()*combos.length)],rest=deck.filter(c=>c!==a&&c!==b),board:Card[]=[];
   while(board.length<5){const k=Math.floor(random()*rest.length);board.push(rest[k]);rest.splice(k,1);}
   const cmp=compareRanks(evaluate([...hole,...board]),evaluate([a,b,...board]));score+=cmp>0?1:cmp===0?.5:0;}
  return score/trials;});
}
/** After the flop: the share of every other possible two-card hand that Hero's hand beats right now (exact). */
export function beatsShare(hole:readonly Card[],board:readonly Card[]):number {
 return memo(`beats|${hole.join('')}|${board.join('')}`,()=>{
  const dead=new Set([...hole,...board]),deck:Card[]=[];for(const r of RANKS)for(const s of SUITS)if(!dead.has(r+s))deck.push(r+s);
  const mine=evaluate([...hole,...board]);let score=0,n=0;
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){const cmp=compareRanks(mine,evaluate([deck[i],deck[j],...board]));score+=cmp>0?1:cmp===0?.5:0;n++;}
  return score/n;});
}
export interface Texture {label:'dry'|'semi-wet'|'wet';paired:boolean;flushPossible:boolean;twoTone:boolean;straighty:boolean;top:number;high:boolean;words:string}
export function texture(board:readonly Card[]):Texture {
 const ranks=board.map(value),suits=new Map<string,number>();for(const c of board)suits.set(c[1],(suits.get(c[1])??0)+1);
 const maxSuit=Math.max(...suits.values()),uniq=[...new Set(ranks.flatMap(r=>r===14?[14,1]:[r]))].sort((a,b)=>a-b);
 let run=0;for(const lo of uniq)run=Math.max(run,uniq.filter(v=>v>=lo&&v<=lo+4).length);
 const paired=new Set(ranks).size<ranks.length,flushPossible=maxSuit>=3,twoTone=maxSuit===2&&board.length<5,straighty=run>=3,top=Math.max(...ranks);
 const wet=(flushPossible?2:twoTone?1:0)+(straighty?2:run===2&&top<=11?1:0),label=wet>=3?'wet':wet>=1?'semi-wet':'dry';
 const words=[top>=12?`${'JQKA'[top-11]??''}-high`.replace(/^-/,''):'low',paired?'paired':'',flushPossible?(board.length===3?'one suit':'three to a flush'):twoTone?'two-tone':'rainbow',straighty?'connected':''].filter(Boolean).join(', ');
 return {label,paired,flushPossible,twoTone,straighty,top,high:top>=12,words};
}
export type Job='the nuts'|'thick value'|'thin value'|'showdown value'|'strong draw'|'weak draw'|'air';
export interface HandRead {job:Job;made:string;pair:string;beats:number;outs:number;drawOuts:number;nextCard:number;byRiver:number|null}
/** What Hero's hand is on this board: its job, and the exact counts behind it. */
export function readHand(hole:readonly Card[],board:readonly Card[]):HandRead {
 const rank=evaluate([...hole,...board]),cat=rank[0],bcat=boardCategory(board),beats=beatsShare(hole,board),tex=texture(board);
 const help=oddsHelp(hole,board,0,0),river=board.length===5;
 const drawOuts=river||!help?0:help.byMake.filter(m=>/straight|flush/.test(m.make)).reduce((a,m)=>a+m.cards,0);
 const hr=hole.map(value).sort((a,b)=>b-a),br=[...new Set(board.map(value))].sort((a,b)=>b-a),pocket=hr[0]===hr[1];
 let job:Job='air',pair='';
 const real=cat>bcat;
 if(cat>=3&&real)job=beats>=.985?'the nuts':beats>=.9?'thick value':beats>=.75?'thin value':'showdown value';
 else if(cat===2&&bcat===0)job=beats>=.985?'the nuts':'thick value';
 else if((cat===1&&bcat===0)||(cat===2&&bcat===1)){
  // One pair made with a hole card (the board may also hold a pair of its own).
  const mine=pocket?hr[0]:hr.find(r=>br.includes(r))??0,kicker=pocket?0:hr.find(r=>r!==mine)??0;
  if(!mine)job='air';
  else if(pocket&&mine>br[0]){pair='an overpair';job='thick value';}
  else if(mine===br[0]){pair=`top pair, ${kicker>=11?'good':'weak'} kicker`;job=kicker>=11?'thick value':'thin value';}
  else if(mine>=(br[1]??0)){pair=pocket?'a pocket pair under the top card':'second pair';job='showdown value';}
  else{pair=pocket?'a low pocket pair':'bottom pair';job='showdown value';}
  // One pair loses value when the board completes flushes or straights, or when the board itself is paired.
  if(job==='thick value'&&(tex.flushPossible||(river&&tex.straighty)||cat===2&&bcat===1&&mine<br[0]))job='thin value';
 }
 else if(cat>=3&&!real)job=beats>=.9?'thin value':beats>=.6?'showdown value':'air';
 if(job==='air'||job==='showdown value'){if(drawOuts>=8)job='strong draw';else if(job==='air'&&drawOuts>=4)job='weak draw';}
 // When the pair (or better) is all on the board, it plays for everyone: Hero has no made hand of their own.
 const shared=cat>=1&&cat===bcat&&!pair,made=shared?`${handLabel(rank).toLowerCase()}, all of it on the board`:handLabel(rank);
 if(shared&&cat>=2&&job==='air')job=beats>=.9?'thin value':beats>=.65?'showdown value':'air';
 return {job,made,pair,beats,outs:help?.outs??0,drawOuts,nextCard:help?.next??0,byRiver:help?.river??null};
}

interface Ctx {view:HeroViewModel;o:CoachOptions;hero:HeroViewModel['seats'][number];hole:Card[];bb:number;call:number;pot:number;need:number;
 opps:HeroViewModel['seats'];pos:string;eff:number;facing:number;ip:boolean;
 /** The pool profile for the stake band (Phase 3): the playbook's live set unless a stake band selects another. */
 pool:PoolProfile}
/** Clockwise seat order after the flop: first to act is left of the button, the button acts last. */
function inPosition(view:HeroViewModel):boolean {
 const ids=view.seats.map(s=>s.id).sort((a,b)=>a-b),i=ids.indexOf(view.button),order=[...ids.slice(i+1),...ids.slice(0,i+1)];
 const live=order.filter(id=>{const s=view.seats.find(x=>x.id===id)!;return !s.folded&&!s.allIn;});
 return live.length>0&&live.at(-1)===0;
}
function sized(c:Ctx,want:number):{to:number;allIn:boolean}|null {
 const l=c.view.legal;
 if(!l.canRaise||l.minRaiseTo===null||l.maxRaiseTo===null)return l.shortAllInTo!==null?{to:l.shortAllInTo,allIn:true}:null;
 const unit=c.view.profile.chipUnit||1;let to=clamp(Math.round(want/unit)*unit,l.minRaiseTo,l.maxRaiseTo);
 // A raise that puts in most of the stack is an all-in: leaving a few chips behind only gives away information.
 if(to>=.7*l.maxRaiseTo)to=l.maxRaiseTo;
 return {to,allIn:to===l.maxRaiseTo};
}
const lastRaiser=(view:HeroViewModel,street:string)=>{let s=-1;for(const e of view.events)if(e.type==='action'&&e.street===street&&e.action?.type==='raise')s=e.seatId??-1;return s;};
const nameOf=(c:Ctx,seat:number)=>c.view.seats.find(s=>s.id===seat)?.name??'the bettor';

export function advise(view:HeroViewModel,o:CoachOptions):Advice|null {
 const hero=view.seats.find(s=>s.id===0);
 if(!hero||view.actor!==0||view.street==='complete'||hero.folded||hero.hole.length!==2)return null;
 const hole=hero.hole as Card[],bb=view.profile.bigBlind,call=view.legal.callAmount,pot=view.pot,opps=view.seats.filter(s=>s.id!==0&&!s.folded);
 if(!opps.length)return null;
 const heroStart=hero.stack+hero.totalCommitted,eff=Math.min(heroStart,Math.max(...opps.map(s=>s.stack+s.totalCommitted)));
 const c:Ctx={view,o,hero,hole,bb,call,pot,need:call>0?call/(pot+call):0,opps,pos:positionOf(view,0),eff,facing:Math.max(...view.seats.map(s=>s.streetCommitted)),ip:inPosition(view),pool:poolFor(o.stake)};
 return view.street==='preflop'?preflop(c):postflop(c);
}

type Draft={action:CoachAction;to?:number|null;close?:boolean;job:string;why:Why;numbers?:CoachNumber[];lesson:string;card:string;sizeNote?:string;
 /** Phase 3: EV-ranked alternatives computed by the branch that owns the equity estimate (engine spec). */
 alt?:Alternative[];icmPriced?:boolean};
function finish(c:Ctx,d:Draft):Advice {
 const l=c.view.legal,m=c.o.money;let action=d.action;const to=d.to??null;
 // Never recommend something the rules do not allow here.
 if((action==='bet'||action==='raise'||action==='all-in')&&to===null)action=c.call>0?'call':'check';
 if(action==='check'&&!l.check)action=c.call>0?'fold':'check';
 if(action==='fold'&&l.check)action='check';
 if(action==='call'&&c.call===0)action='check';
 if(action==='call'&&c.call>=c.hero.stack)d={...d,sizeNote:'all-in'};
 const headline=action==='fold'?'Fold':action==='check'?'Check':action==='call'?`Call ${m(c.call)}${d.sizeNote==='all-in'?' (all-in)':''}`:action==='all-in'?`All-in for ${m(to!)}`:`${action==='bet'?'Bet':'Raise to'} ${m(to!)}${d.sizeNote?` (${d.sizeNote})`:''}`;
 const out:Advice={key:`${c.view.handId}:${c.view.revision}`,action,to:action==='bet'||action==='raise'||action==='all-in'?to:null,headline,close:!!d.close,job:d.job,why:d.why,numbers:d.numbers??[],lesson:LESSONS[d.lesson],card:NOTECARDS[d.card],overlay:OVERLAYS[c.view.street],
  ask:NOTECARDS[c.call===0?'C02':c.view.street==='preflop'?(c.facing>(c.view.straddleSeat!==undefined?2:1)*c.bb?'C04':'C02'):c.hero.streetCommitted>0?'C09':'C04']};
 /* Phase 3 (Coach Engine Spec): every advice carries its spot classification, its chart coverage, and the
  * close alternatives — EV-ranked where the spec's math supports an estimate, named without one where the
  * decision is a chart lookup (a chart gives ranges, not EVs, and inventing one would break the basis rules). */
 const spot=classifySpot(c.view),coverage=chartCoverage(c.view);
 out.spot=spot.label;if(coverage.gap)out.gap=coverage.gap;if(d.icmPriced)out.icmPriced=true;
 let alt=d.alt;
 if(!alt&&c.view.street==='preflop'){
  const names:Alternative[]=[],src=coverage.chart?`chart decision (${coverage.chart})`:'chart decision';
  const push=(a:string)=>names.push({action:a,ev:null,basis:'rule',note:`${src}: the playbook gives a range for this spot, not an EV estimate.`});
  if(action!=='fold'&&!l.check)push('Fold');
  if(c.call>0&&action!=='call')push('Call');
  if(l.check&&action!=='check')push('Check');
  if(l.canRaise&&action!=='bet'&&action!=='raise'&&action!=='all-in')push('Raise');
  alt=names.slice(0,2);
 }
 if(!alt&&c.view.street!=='preflop'&&c.call===0){
  const board=c.view.board,eqW=equityVsRange(c.hole,board,.45,c.view.handId+'alt',0,500),eqC=equityVsRange(c.hole,board,.35,c.view.handId+'altc',0,500);
  const betAmt=Math.max(c.bb,Math.round(.5*c.pot)),base=c.view.street==='flop'?c.pool.flopFold:c.view.street==='turn'?c.pool.turnFold:c.pool.riverFold;
  const foldShare=clamp(base*(0.7+0.6*(betAmt/Math.max(1,c.pot))),.05,.85);
  const fmt=(ev:number)=>`${ev>=0?'+':''}${(ev/c.bb).toFixed(1)} bb`;
  alt=[{action:'Check',ev:eqW*c.pot,evLabel:fmt(eqW*c.pot),basis:'estimate',note:'Showdown equity against a wide continuing range; future betting not priced.'},
   {action:'Bet',ev:betEv(foldShare,eqC,c.pot,betAmt),evLabel:fmt(betEv(foldShare,eqC,c.pot,betAmt)),basis:'estimate',note:`Half-pot size; the ${c.pool.label} folds about ${pct(foldShare)} to it, and called hands play out at your equity against a calling range.`}];
 }
 if(alt&&alt.length){
  const fam:Record<string,string>={fold:'Fold',check:'Check',call:'Call',bet:'Bet',raise:'Raise','all-in':'All-in'};
  for(const a of alt)if(a.action===fam[action])a.recommended=true;
  alt.sort((x,y)=>(y.ev??-Infinity)-(x.ev??-Infinity));
  out.alternatives=alt;
 }
 return out;
}
const raiseDraft=(c:Ctx,want:number,note:string):{action:CoachAction;to:number|null;sizeNote:string}=>{const s=sized(c,want);return s?{action:s.allIn?'all-in':c.call===0&&c.view.street!=='preflop'?'bet':'raise',to:s.to,sizeNote:s.allIn?'':note}:{action:c.call>0?'call':'check',to:null,sizeNote:''};};

/* ---------------------------------------------------------------- Before the flop ---------------------------------------------------------------- */
function preflop(c:Ctx):Advice {
 const {view,hole,bb,call,pos,o}=c,m=o.money,h=handClass(hole),key=h.key,rankPct=percentile(key);
 const acts=view.events.filter(e=>e.type==='action'&&e.street==='preflop');
 let raises=0,limpers=0,callers=0,opener=-1,last=-1,heroRaised=false;
 for(const e of acts){if(e.action?.type==='raise'){raises++;if(opener<0)opener=e.seatId??-1;last=e.seatId??-1;callers=0;if(e.seatId===0)heroRaised=true;}else if(e.action?.type==='call'&&e.seatId!==0){if(raises===0)limpers++;else callers++;}}
 const unit=view.straddleSeat!==undefined?2*bb:bb,effBB=c.eff/bb,tournament=o.mode==='tournament';
 const job=rankPct>.5?`${key}: in the bottom half of starting hands`:`${key}: top ${Math.max(1,Math.round(100*rankPct))}% of starting hands`;
 const stackNote:CoachNumber={label:'Effective stack',value:`${Math.round(effBB)} big blinds`,basis:'exact'};
 const priceNote=():CoachNumber=>({label:'Price to call',value:`${m(call)} to win ${m(c.pot)}: you need ${pct(c.need)}`,basis:'exact'});
 const allInFacing=call>0&&(call>=c.hero.stack*.5||c.opps.some(s=>s.allIn&&s.streetCommitted>=c.facing));

 /* A raise big enough to commit Hero, or an all-in: pure price against the range that does it. */
 if(raises>=1&&allInFacing&&!(key==='AA'||key==='KK')){
  const shover=view.seats.find(s=>s.id===last),shoverBB=shover?(shover.stack+shover.totalCommitted)/bb:100;
  const share=raises>=3?.03:raises===2?.05:shoverBB<=20?clamp(shoveWidth(positionOf(view,last),shoverBB)*1.1,.05,.6):.06;
  const eq=equityVsTop(hole,share,view.handId);
  /* Phase 3 tournament layer: in a tournament this call is priced in prize equity, not chips. With the
   * payout context, the bubble factor sets the required equity exactly (BF ÷ (BF + 1)); without it, the
   * stage/stack-risk risk premium is added to the chip price. Cash is unchanged: chips are money. */
  const prem=o.mode==='tournament'?riskPremium(o.tournament,c.hero.stack,call):null;
  const required=prem?.bf&&call>=c.hero.stack?prem.bf.requiredAllIn:c.need+(prem?prem.points:0);
  const ok=eq>=required+.01;
  const premNumbers:CoachNumber[]=prem&&prem.points>0?[{label:'Tournament risk premium',value:prem.bf?`needs ${pct(required)} under ICM`:`+${Math.round(100*prem.points)} pts`,basis:prem.basis},...(prem.bf?[{label:'Bubble factor',value:prem.bf.bf.toFixed(2),basis:'icm' as Basis}]:[])]:[];
  const callEvNow=callEv(eq,c.pot,call);
  return finish(c,{action:ok?'call':'fold',close:Math.abs(eq-required)<.04,job,lesson:prem?.bf?'icm':'all-in-math',card:ok?'C05':'C08',icmPriced:!!prem?.bf,
   alt:[{action:'Fold',ev:0,evLabel:'0.0 bb',basis:'exact',note:'Folding risks nothing more.'},
    {action:'Call',ev:callEvNow,evLabel:evLabel(callEvNow,bb),basis:'estimate',note:`Chip EV against the top ${pct(share)} of hands.${prem?.bf?' The tournament price is set by the bubble factor, not by chip EV.':''}`}],
   numbers:[priceNote(),{label:`Your chance against the top ${pct(share)} of hands`,value:`about ${pct(eq)}`,basis:'estimate'},stackNote,...premNumbers],why:{
   ranges:`${nameOf(c,last)} is putting in a stack-sized bet. A range that does this here is roughly the top ${pct(share)} of hands (${describeTop(share)}).`,
   objective:ok?'Realize your equity: with no betting left, a call wins whenever your hand holds up.':'Save the chips: your hand does not win often enough against that range to pay this price.',
   responses:'There is nothing left to respond to. Once the chips are in, the cards decide.',
   alternatives:`Calling needs ${pct(c.need)} and your hand has about ${pct(eq)} against that range, so ${ok?'calling makes money and folding gives it up':'calling loses money on average and folding loses nothing more'}.${prem&&prem.points>0?` ${prem.note}`:o.mode==='tournament'?' Near the money, survival is worth extra, so tighten close calls.':''}`,
   future:'No plan needed: this decision ends the betting for you.'}});
 }

 /* Nobody has raised: open, isolate a limper, shove a short stack, or fold. */
 if(raises===0){
  const blind=pos==='BB'||pos==='SB',canCheck=view.legal.check;
  if(effBB<=12){
   /* Phase 3: with the payout context, bubble and final-table shoving ranges tighten — busting costs prize
    * equity, not just chips (§11). Without context the chart is unchanged and says it ignores ladder pressure. */
   const stage=tournament?tournamentStage(o.tournament):'unknown',tighten=(stage==='bubble'||stage==='final-table')?.85:1;
   const width=shoveWidth(pos,effBB)*(limpers?0.8:1)*tighten,go=inTop(key,width),s=sized(c,view.legal.maxRaiseTo??0);
   const depth=tournament?depthRead(effBB):null;
   return finish(c,{action:go&&s?'all-in':canCheck?'check':'fold',to:go&&s?(view.legal.maxRaiseTo??s.to):null,close:Math.abs(rankPct-width)<.02,job,lesson:'push-fold',card:go?'C06':canCheck?'C03':'C08',numbers:[stackNote,{label:`Shoving range from ${pos}`,value:`top ${pct(width)} (${describeTop(width)})`,basis:'rule'},...(depth?[{label:'Stack depth',value:`${Math.round(effBB)}bb — ${depth.band}`,basis:'rule' as Basis}]:[]),...(tighten<1?[{label:'Tournament stage',value:stage==='bubble'?'on the bubble':'final table',basis:'rule' as Basis}]:[])],why:{
    ranges:`With ${Math.round(effBB)} big blinds from ${pos}, a standard shoving range is about the top ${pct(width)} of hands. Yours is in the top ${Math.max(1,Math.round(100*rankPct))}%.${tighten<1?' On the bubble the range tightens: survival is worth chips, so the weakest shoves come out (§11).':''}`,
    objective:go?'Fold equity plus your hand: you pick up the blinds when everyone folds, and you have real equity when called.':'Wait for a better spot: this hand does not win the blinds often enough, or do well enough when called, to risk the stack.',
    responses:go?'Most hands behind you fold. The hands that call are strong, which is why the range is limited to hands that still have a chance against them.':'A shove here gets called mostly by hands that dominate yours.',
    alternatives:'A small raise commits you anyway and gives opponents a cheap look, so with a stack this short the choice is shove or fold.',
    future:go?'None: you are all-in.':'Your stack is getting short, so plan to shove the next hand that is inside the range for its seat.'}});
  }
  const iso=limpers>0,width=view.seats.length===2&&pos==='BB'?.30:blind&&iso?(limpers>=3?.07:.12):pos==='SB'?openWidth('SB'):iso?Math.max(.08,openWidth(pos)*(limpers>=2?.5:.6)):openWidth(pos);
  const sizeBB=iso?4+limpers+(blind?1:0):tournament?2.3:3,want=sizeBB*unit;
  if(inTop(key,width)&&(pos!=='BB'||iso||view.legal.callAmount>0)){
   const r=raiseDraft(c,want,`${sizeBB} big blinds`);
   return finish(c,{...r,close:Math.abs(rankPct-width)<.015,job,lesson:iso?'iso-raise':pos==='SB'?'sb-play':h.pair||rankPct<.05?'open-raise':'position',card:'C06',numbers:[{label:`Opening range from ${pos}`,value:`top ${pct(width)} (${describeTop(width)})`,basis:'rule'},stackNote],why:{
    ranges:iso?`${limpers} player${limpers===1?' has':'s have'} limped. Limping ranges are weak: hands that were not good enough to raise. Your ${key} is ahead of that range.`:`You are first in from ${pos}. From this seat a sound opening range is about the top ${pct(width)} of hands, and ${key} is inside it.`,
    objective:iso?'Value and isolation: build a pot against a weak range and push the other players out so you play it heads-up with the lead.':'Win the blinds now, or take the lead into the flop with a hand that is ahead of the hands that call.',
    responses:iso?'Limpers call too often with hands you beat. If a limper re-raises instead, that is unusual strength.':'Worse hands call and the blinds often fold. A re-raise is a strong range at most tables.',
    alternatives:iso?`Limping along lets every player see a cheap flop and wastes the value of your hand. The size is larger than a normal open (${sizeBB} big blinds) because each limper has already shown a willingness to call.`:`Limping wins no blinds, hides nothing, and invites several players in. Folding gives up a hand that makes money from here.`,
    future:`If called, you usually bet the flop on boards that favour your range and check the ones that do not. If you are re-raised, continue only with your strongest hands.`}});
  }
  if(iso&&!canCheck&&(speculative(h)||pos==='SB'&&inTop(key,.45))&&(pos==='SB'||limpers>=2||['CO','BTN','HJ'].includes(pos))&&effBB>=40){
   return finish(c,{action:'call',job,lesson:'iso-raise',card:'C05',numbers:[priceNote(),stackNote],why:{
    ranges:`Several players are in for the minimum with weak ranges. ${key} is not strong enough to raise them out, but it can flop a hidden big hand.`,
    objective:'Implied odds: put in a little now to win a big pot the times you flop a set, two pair, or a strong draw.',
    responses:'A player behind may raise. If so, fold unless the price and the stacks still make the call worthwhile.',
    alternatives:'Raising with this hand builds a pot you will often have to give up. Folding gives up a cheap chance at a large pot.',
    future:'Fit or fold: continue with two pair or better and strong draws, and let weak pairs go in a pot with this many players.'}});
  }
  return finish(c,{action:canCheck?'check':'fold',close:Math.abs(rankPct-width)<.015,job,lesson:canCheck?'pot-control':pos==='SB'?'sb-play':'position',card:canCheck?'C03':'C08',numbers:[{label:`Opening range from ${pos}`,value:`top ${pct(width)} (${describeTop(width)})`,basis:'rule'}],why:{
   ranges:canCheck?`You are in the big blind and nobody raised. ${key} is not strong enough to raise for value against ${limpers||1} limper${limpers===1?'':'s'}.`:`From ${pos} a sound ${iso?'isolating':'opening'} range is about the top ${pct(width)} of hands. ${key} is outside it.`,
   objective:canCheck?'See a free flop: it costs nothing and your hand can still connect.':'Save the chips: the hand loses money from this seat over time.',
   responses:canCheck?'Nothing to face yet. After the flop you act early, so play only when you connect.':`With ${view.seats.filter(s=>!s.folded).length-1} players still in or to act, a weak hand is too likely to run into a better one.`,
   alternatives:canCheck?'Raising turns a weak hand into a big pot out of position. Checking keeps it cheap.':'Limping or raising with it plays a dominated hand, often out of position. The small edge you imagine now turns into bigger losses after the flop.',
   future:canCheck?'Continue after the flop with top pair or better and good draws. Fold the rest to a bet.':'Nothing: wait for a hand inside your range for the seat.'}});
 }

 const openerPos=positionOf(view,opener),openerW=openerPos==='BB'||openerPos==='SB'?Math.max(.12,openWidth(openerPos)*.4):openWidth(openerPos),read=o.styleOf?.(last)??null;
 const readNote=read&&read.hands>=8?` You have seen ${nameOf(c,last)} play ${read.hands} hands: ${read.label}.`:'';

 /* One raise in front of you. */
 if(raises===1&&!heroRaised){
  const value3=valueThreeBet(key,openerW),station=!!read&&read.hands>=8&&/calls a lot/.test(read.label);
  const bluff3=bluffThreeBet(key,openerW)&&['CO','BTN','SB','BB','BTN/SB'].includes(pos)&&callers===0&&!station&&effBB>=40;
  // Patch 106: with callers already in, the re-raise is sized up further (each caller adds one and a half raises in a cash game).
  const mult=c.ip?3:4,want=mult*c.facing+callers*c.facing*(tournament?1:1.5);
  if(value3||bluff3||effBB<=20&&inTop(key,.06)){
   const r=effBB<=20?raiseDraft(c,view.legal.maxRaiseTo??want,''):raiseDraft(c,want,`${mult}× the raise${callers?` plus ${tournament?'one raise':'one and a half raises'} for each caller`:''}`);
   return finish(c,{...r,job,lesson:callers?'squeeze':value3?'three-bet-value':'three-bet-bluff',card:'C06',numbers:[{label:`${openerPos} opening range`,value:`about the top ${pct(openerW)}`,basis:'rule'},{label:'Pool folds to a re-raise',value:pct(c.pool.foldToThreeBet),basis:'pool'},stackNote],why:{
    ranges:`${nameOf(c,opener)} raised from ${openerPos}, a range of about the top ${pct(openerW)} of hands (${describeTop(openerW)}).${readNote} ${value3?`${key} is ahead of most of it.`:`${key} is not strong enough to call, but it blocks aces and ace-king.`}`,
    objective:value3?'Value: get more money in while you are ahead, and thin the field.':'A bluff with back-up: win the pot now when they fold, and keep a hand that can make the nuts when they call.',
    responses:value3?`Worse hands call (smaller pairs, weaker aces, suited broadways). Live pools fold to re-raises only about ${pct(c.pool.foldToThreeBet)} of the time, so expect calls, which is what a value hand wants.`:`This only works against a player who opens wide and can fold. The pool folds about ${pct(c.pool.foldToThreeBet)}, so use it sparingly and not against callers.`,
    alternatives:value3?'Just calling keeps the pot small with one of your best hands and lets the blinds in cheaply. Folding is out of the question.':'Calling plays a dominated hand out of position; folding is fine too. Re-raising is the only way this hand makes money here.',
    future:value3?`If you are raised again, continue with ${['AA','KK','AKs'].includes(key)?'this hand':'aces, kings and ace-king suited'} and fold the rest of your re-raising range at most tables. If called, bet most flops for value.`:'If you are raised again, fold. If called, bet small on high, dry flops and give up when the board helps the caller.'}});
  }
  // Calling: the big blind by price, the small blind rarely, everyone else in position with hands that play well.
  const deep=c.eff>=15*call+0*bb&&c.hero.stack>=15*call;
  let ok=false,reason='';
  if(pos==='BB'){const width=clamp((BB_DEFEND[openerPos]??.3)*Math.pow(.31/Math.max(.05,c.need),1.5),.08,.75);ok=inTop(key,width)||speculative(h)&&deep;reason=`In the big blind you defend by price: at this price a sound defending range is about the top ${pct(width)} of hands.`;}
  else if(pos==='SB'){ok=['JJ','TT','99','88','77','AQs','AJs','KQs'].includes(key);reason='From the small blind you are out of position with the big blind still to act, so you call with very few hands.';}
  else{const w=pos==='BTN'?.15:pos==='CO'?.12:.09;ok=inTop(key,w)&&(h.suited||h.pair&&h.hi>=7||inTop(key,.075)||pos==='BTN'&&key==='KQo')||speculative(h)&&deep&&(h.pair||c.ip);reason=`In position you can call with hands that play well after the flop: pairs, suited broadways and suited connectors.`;}
  if(ok){
   const set=h.pair&&h.hi<=10;
   return finish(c,{action:'call',close:false,job,lesson:pos==='BB'?'blind-defense':set?'set-mining':'flat-call',card:'C05',numbers:[priceNote(),{label:`${openerPos} opening range`,value:`about the top ${pct(openerW)}`,basis:'rule'},...(set?[{label:'Stacks behind compared with the call',value:`${Math.floor(c.hero.stack/Math.max(1,call))}× (want 15× or more)`,basis:'exact' as Basis}]:[]),stackNote],why:{
    ranges:`${nameOf(c,opener)} raised from ${openerPos} (about the top ${pct(openerW)} of hands).${readNote} ${reason}`,
    objective:set?'Implied odds: you flop a set about one time in eight, and the stacks are deep enough to pay for the misses.':pos==='BB'?'Realize your equity at a discount: you already have a big blind in the pot.':'Realize equity in position: see a flop cheaply with a hand that can make strong pairs, flushes and straights.',
    responses:'A player behind can still re-raise. If that happens, fold unless you hold one of the hands that continues against a re-raise.',
    alternatives:`${key} is not strong enough to re-raise for value against that range, and it is too good to fold at this price.`,
    future:set?'Fit or fold: play a big pot with a set, and give up to real pressure without one.':pos==='BB'?'Check to the raiser. Continue with pairs and draws at a fair price; plan to check-raise your strongest hands on wet boards.':'Use position: call a bet with pairs and draws, raise your strong hands, and bet when the raiser checks to you.'}});
  }
  return finish(c,{action:'fold',close:false,job,lesson:pos==='SB'?'sb-play':pos==='BB'?'blind-defense':'position',card:'C08',numbers:[priceNote(),{label:`${openerPos} opening range`,value:`about the top ${pct(openerW)}`,basis:'rule'}],why:{
   ranges:`${nameOf(c,opener)} raised from ${openerPos} (about the top ${pct(openerW)} of hands).${readNote} Against that range ${key} is often dominated: when you make a pair, they frequently have the same pair with a better kicker.`,
   objective:'Save the chips: folding here costs nothing more, and calling loses a little every time.',
   responses:'If you called, you would face bets on most flops without knowing where you stand.',
   alternatives:`${reason} ${key} is not one of those hands, and it is not strong enough to re-raise.`,
   future:'Nothing: watch how the hand plays out. What the raiser shows down tells you about their range for next time.'}});
 }

 /* You raised and were re-raised, or the pot was re-raised before it reached you. */
 if(raises===2||raises===1&&heroRaised){
  const rePos=positionOf(view,last),wide=heroRaised&&openWidth(pos)>=.27&&['SB','BB','BTN'].includes(rePos),short=effBB<=40;
  const four=heroRaised?['AA','KK','AKs'].includes(key)||wide&&['QQ','AKo'].includes(key)||short&&['QQ','AKo','JJ'].includes(key):['AA','KK','AKs'].includes(key);
  const flat=heroRaised&&!four&&(['QQ','JJ','TT','AKo','AQs'].includes(key)||!short&&['99','88','AJs','KQs'].includes(key)||!short&&c.ip&&['JTs','T9s','98s','77'].includes(key)&&c.hero.stack>=12*call);
  if(four){
   const r=short?raiseDraft(c,view.legal.maxRaiseTo??0,''):raiseDraft(c,(c.ip?2.3:2.6)*c.facing,`${c.ip?2.3:2.6}× the re-raise`);
   return finish(c,{...r,job,lesson:'four-bet',card:'C06',numbers:[stackNote,{label:'A re-raising range',value:'about the top 5% (TT+, AQs+, AK)',basis:'rule'}],why:{
    ranges:`${nameOf(c,last)} re-raised from ${rePos}. At most tables that is a value-heavy range: big pairs and big aces. ${key} is at the very top of your range.`,
    objective:'Value: get stacks in before the flop while you are ahead of the hands that continue.',
    responses:'Queens, jacks and ace-king often call or shove. Weaker hands fold, which is fine: you win a large pot without seeing a flop.',
    alternatives:'Calling hides your strength but lets them see a flop cheaply and gives overcards a chance to beat you. With hands this strong, building the pot now wins the most.',
    future:'If they shove, call. If they call, bet most flops: the pot is already large compared with the stacks, so you are committed with an overpair or top pair.'}});
  }
  if(flat){
   return finish(c,{action:'call',job,lesson:'facing-3bet',card:'C05',numbers:[priceNote(),stackNote],why:{
    ranges:`${nameOf(c,last)} re-raised from ${rePos}: mostly big pairs and big aces. ${key} does well enough against that range to continue but is not ahead of the hands that would put in a fourth raise.`,
    objective:'Realize equity: see a flop at a fair price with a hand that can flop an overpair, a set or top pair with a strong kicker.',
    responses:'There is nothing behind you to worry about unless other players are still in.',
    alternatives:'Raising again folds out everything you beat and gets called only by better hands. Folding gives up too much with a hand this strong.',
    future:`${c.ip?'You have position: ':'You are out of position: '}continue on the flop with an overpair, top pair or a set. Without one of those, fold to a bet.`}});
  }
  return finish(c,{action:'fold',job,lesson:'facing-3bet',card:'C08',numbers:[priceNote(),{label:'A re-raising range',value:'about the top 5% (TT+, AQs+, AK)',basis:'rule'}],why:{
   ranges:`${nameOf(c,last)} re-raised. That range is mostly big pairs and big aces, and ${key} is dominated by much of it.`,
   objective:'Save the chips: you have invested little, and the hand loses money against this range.',
   responses:'If you called, any flop you hit could still be second best, and you would face a large bet.',
   alternatives:`Calling with a dominated hand is one of the most expensive habits in poker. A fourth raise as a bluff does not work against a pool that rarely re-raises light.`,
   future:'Nothing: let it go and note how often this player re-raises.'}});
 }

 /* Three or more raises: aces and kings play for stacks; everything else is a price decision against a tiny range. */
 const eq=equityVsHands(hole,['AA','KK','QQ','AKs','AKo'],view.handId),top=key==='AA'||key==='KK',okCall=eq>=c.need+.04&&(h.pair&&h.hi>=10||key==='AKs'||key==='AKo');
 const r=top?raiseDraft(c,view.legal.maxRaiseTo??0,''):{action:(okCall?'call':'fold') as CoachAction,to:null,sizeNote:''};
 return finish(c,{...r,close:!top&&Math.abs(eq-c.need)<.04,job,lesson:'four-bet',card:top?'C06':okCall?'C05':'C08',numbers:[priceNote(),{label:'Your chance against QQ+, AK',value:`about ${pct(eq)}`,basis:'estimate'},stackNote],why:{
  ranges:`The pot has been raised ${raises} times. Ranges this deep in the betting are tiny: mostly aces, kings, queens and ace-king.`,
  objective:top?'Value: you hold one of the two best hands. Get the stacks in.':okCall?'Realize your equity at the price offered.':'Save the stack: this is where good-but-not-great hands lose the most.',
  responses:top?'They call with the rest of their range, and you are ahead of all of it except aces.':'Nothing: this is close to an all-in decision.',
  alternatives:top?'Just calling risks a flop that scares away action or beats you. All-in now cannot be outplayed.':`You need ${pct(c.need)} and have about ${pct(eq)} against that range. ${okCall?'That is enough to call.':'That is not enough once you allow for the range being even tighter than assumed, which it often is.'}`,
  future:top?'None: the chips go in.':okCall?'Plan to get the rest in on most flops: the pot will be too big to fold an overpair or top pair.':'Nothing: fold and move on.'}});
}

/* ---------------------------------------------------------------- After the flop ---------------------------------------------------------------- */
export function assumed(street:string,raise:boolean,frac:number,multi:boolean,cbet:boolean,read:PlayerRead|null):{width:number;bluff:number} {
 // Patch 106: measured over a long run against this app's players, a bet or raise was a stronger range, with far fewer
 // bluffs, than Patch 105 assumed (weak pairs won about one river in ten against a bet). These are the corrected sizes.
 let [width,bluff]=raise?(street==='flop'?[.10,.12]:street==='turn'?[.06,.06]:[.045,.05]):street==='flop'?(cbet?[.28,.17]:[.19,.10]):street==='turn'?[.18,frac>=.9?.18:.12]:[.14,frac>.8?.14:frac<=.4?.13:.10];
 if(!raise&&frac<=.4)width*=1.1;
 if(multi){width*=.7;bluff*=.5;}
 // A read changes the picture only when it is about bluffing: a loose player who bets a lot has more air; a tight or
 // calling player has less. Betting often with a tight range is strength, not bluffing.
 if(read&&read.hands>=8){if(read.aggressive&&read.vpip>=.4){width*=1.2;bluff=Math.min(.4,bluff+.08);}else if(/calls a lot/.test(read.label)||read.vpip<=.2)bluff=Math.max(.03,bluff-.05);}
 return {width:clamp(width,.03,.6),bluff};
}
function postflop(c:Ctx):Advice {
 const {view,hole,call,pot,o,hero}=c,m=o.money,street=view.street,board=view.board,tex=texture(board),hand=readHand(hole,board);
 const n=c.opps.length+1,hu=n===2,multi=n>=3,prev=street==='flop'?'preflop':street==='turn'?'flop':'turn';
 const lead=lastRaiser(view,prev),pfr=lastRaiser(view,'preflop'),heroLead=lead===0,villainLead=lead>0&&c.opps.some(s=>s.id===lead);
 const stackBehind=Math.min(hero.stack,Math.max(...c.opps.map(s=>s.stack))),spr=stackBehind/Math.max(1,pot);
 const sprNote:CoachNumber={label:'Stack-to-pot ratio',value:spr.toFixed(1),basis:'exact'};
 const beatsNote:CoachNumber={label:'Possible hands you beat right now',value:pct(hand.beats),basis:'exact'};
 const drawNote=():CoachNumber=>({label:'Cards that complete your draw',value:`${hand.drawOuts} (${pct(hand.drawOuts/(52-2-board.length))} on the next card)`,basis:'exact'});
 const describe=hand.pair||hand.made.toLowerCase(),boardWords=`${board.join(' ')} (${tex.words})`;
 const value=hand.job==='the nuts'||hand.job==='thick value',draw=hand.job==='strong draw'||hand.job==='weak draw';

 /* ------------------------------ Facing a bet or a raise ------------------------------ */
 if(call>0){
  const bettor=lastRaiser(view,street),raise=hero.streetCommitted>0,frac=call/Math.max(1,pot-call),read=o.styleOf?.(bettor)??null;
  const a=assumed(street,raise,frac,multi,bettor===pfr&&street==='flop',read),eq=memo(`post|${hole.join('')}|${board.join('')}|${a.width.toFixed(3)}|${a.bluff.toFixed(2)}`,()=>equityVsRange(hole,board,a.width,view.handId+street,a.bluff,700));
  const allIn=call>=hero.stack||c.opps.every(s=>s.allIn),margin=street==='river'||allIn?0:(c.ip?.02:.04)+(hand.job==='air'?.08:0);
  /* Phase 3 tournament layer: a tournament call must clear the chip price plus the risk premium — prize
   * equity makes chips lost worth more than chips won (§11). Priced from the payout context when the app
   * supplies it (bubble factor), else from stage/stack-risk heuristics, and always labelled. */
  const prem=o.mode==='tournament'?riskPremium(o.tournament,hero.stack,call):null;
  const marginAdj=margin+(prem?prem.points:0);
  const premNumbers:CoachNumber[]=prem&&prem.points>0?[{label:'Tournament risk premium',value:prem.bf?`needs ${pct(prem.bf.requiredAllIn)} under ICM`:`+${Math.round(100*prem.points)} pts`,basis:prem.basis},...(prem.bf?[{label:'Bubble factor',value:prem.bf.bf.toFixed(2),basis:'icm' as Basis}]:[])]:[];
  const who=nameOf(c,bettor),sizeWords=`${pct(frac)} of the pot`,readWords=read&&read.hands>=8?` Your read on ${who} (${read.hands} hands): ${read.label}.`:'';
  const numbers:CoachNumber[]=[{label:'Price to call',value:`${m(call)} to win ${m(pot)}: you need ${pct(c.need)}`,basis:'exact'},{label:'Your chance against the assumed range',value:`about ${pct(eq)}`,basis:'estimate'},beatsNote,sprNote];
  const rangeLine=`${who} ${raise?'raised':'bet'} ${sizeWords} on ${boardWords}${multi?` with ${n} players in`:''}. ${raise?`A ${street} raise is a narrow, strong range at most tables: about the top ${pct(a.width)} of hands, with few bluffs.`:`A bet this size on this street is assumed to be about the top ${pct(a.width)} of possible hands, roughly ${pct(a.bluff)} of them bluffs or draws.`}${readWords}`;
  const mdf=1-frac/(1+frac);
  /* Phase 3: the EV-ranked alternatives for a facing decision, from the same equity estimate the branch
   * decides with (engine spec: fold = 0, call priced by pot odds, a raise priced by fold share against
   * the pool profile and the equity that remains when the top of the betting range continues). */
  const facingAlt=(raiseTo?:number|null):Alternative[]=>{
   const list:Alternative[]=[{action:'Fold',ev:0,evLabel:'0.0 bb',basis:'exact',note:'Folding risks nothing more.'},
    {action:'Call',ev:callEv(eq,pot,call),evLabel:evLabel(callEv(eq,pot,call),c.bb),basis:'estimate',note:`Priced at your ${pct(eq)} against the assumed betting range${prem&&prem.points>0?' — chip EV; the tournament risk premium is charged on top':''}.`}];
   if(raiseTo!=null&&view.legal.canRaise){
    const bettorSeat=view.seats.find(s=>s.id===bettor),added=raiseTo-hero.streetCommitted,callerAdds=Math.max(0,raiseTo-(bettorSeat?.streetCommitted??0));
    const base=street==='flop'?c.pool.flopFold:street==='turn'?c.pool.turnFold:c.pool.riverFold,fR=clamp(base*.8,.05,.8);
    const eqR=equityVsRange(hole,board,Math.max(.03,a.width*.6),view.handId+street+'r',a.bluff/2,500),ev=raiseEv(fR,eqR,pot,added,callerAdds);
    list.push({action:'Raise',ev,evLabel:evLabel(ev,c.bb),basis:'estimate',note:`The ${c.pool.label} folds about ${pct(fR)} to a raise here; when called, you play out against the top of the betting range (about ${pct(eqR)}).`});
   }
   return list;
  };
  // Monsters: raise for value while worse hands still call.
  if(hand.job==='the nuts'||value&&!hand.pair&&street!=='river'&&(tex.label!=='dry'||frac<=.5)){
   const r=raiseDraft(c,c.facing*(street==='flop'?(c.ip?3:3.5):2.7),`${street==='flop'?(c.ip?'3':'3.5'):'2.7'}× the bet`);
   return finish(c,{...r,alt:facingAlt(r.to),icmPriced:!!prem?.bf,job:`${hand.job}: ${describe}`,lesson:tex.label==='dry'?'fast-play':'protection',card:raise?'C09':'C06',numbers:[...numbers,...premNumbers],why:{
    ranges:`${rangeLine} You have ${describe}, which beats ${pct(hand.beats)} of all possible hands here.`,
    objective:'Value: worse hands are putting money in, so make the pot bigger while they still want to continue.',
    responses:`Top pairs and overpairs call, and draws pay to chase. ${tex.label==='dry'?'On a board this dry they have fewer hands to call with, so keep the raise small.':'On a board this wet a later card can scare them or beat you, which is why the money should go in now.'}`,
    alternatives:'Just calling keeps their bluffs in but lets draws see a cheap card and risks a scary card killing the action. Raising wins more on average against players who call too much.',
    future:'If they re-raise, you are happy to get the stacks in. If they call, bet again on most cards and slow down only when an obvious draw completes and you do not hold it.'}});
  }
  // Draws: the price on the next card first, then implied odds.
  if(draw&&street!=='river'){
   const p=allIn&&hand.byRiver!==null?hand.byRiver:hand.drawOuts/(52-2-board.length),extra=Math.max(0,Math.round(call*(1-p)/Math.max(.01,p)-pot));
   const direct=p>=c.need,implied=!allIn&&!direct&&extra<=Math.min(stackBehind-call,.8*(pot+call));
   if(hand.drawOuts>=12&&street==='flop'&&hu&&!allIn&&view.legal.canRaise&&spr>=3){
    const r=raiseDraft(c,c.facing*(c.ip?3:3.5),`${c.ip?'3':'3.5'}× the bet`);
    return finish(c,{...r,alt:facingAlt(r.to),icmPriced:!!prem?.bf,job:`${hand.job}: ${hand.drawOuts} outs`,lesson:'semi-bluff',card:'C06',numbers:[...numbers.slice(0,1),drawNote(),{label:'Chance to improve by the river',value:pct(hand.byRiver??p),basis:'exact'},sprNote,...premNumbers],why:{
     ranges:`${rangeLine} You have a draw with ${hand.drawOuts} outs.`,objective:'A semi-bluff: win the pot now when they fold, and still make the best hand often when they call.',
     responses:`One-pair hands often fold to a raise, and the hands that call are not far ahead of a draw this big.`,alternatives:'Calling is fine too, but it only wins when you hit. Raising adds a second way to win.',
     future:'If called, keep betting when you hit, and take a free card or bet again on the turn depending on how they respond. If they re-raise all-in, compare the price with your chance to improve by the river.'}});
   }
   // A weak draw does not realize its raw equity (it folds to the next bet too often), so only strong draws count it.
   const byEquity=eq>=c.need+marginAdj&&(allIn||hand.job==='strong draw'),callIt=direct||implied||byEquity;
   return finish(c,{action:callIt?'call':'fold',alt:facingAlt(),icmPriced:!!prem?.bf,close:Math.abs(p-c.need)<.03,job:`${hand.job}: ${hand.drawOuts} outs`,lesson:direct||!implied&&byEquity?'pot-odds':'implied-odds',card:callIt?'C05':'C08',numbers:[numbers[0],drawNote(),numbers[1],...(!direct&&!allIn?[{label:'Extra you must win later to break even',value:m(extra),basis:'exact' as Basis}]:[]),sprNote,...premNumbers],why:{
    ranges:`${rangeLine} Your hand is a draw: ${hand.drawOuts} cards complete it.`,
    objective:callIt?(direct?'Realize your equity: the pot is paying enough for the draw by itself.':implied?'Implied odds: the price is a little short now, but you can win the difference when you hit.':'Realize your equity: counting every way your hand can win against the range that bets here, you are getting the right price.'):'Save the chips: the draw does not come in often enough for this price.',
    responses:callIt?'If you hit, a bet or raise usually gets paid by the hands that are betting now.':'Even when you hit, the stacks behind are too small, or the pot too large, to make up the difference.',
    alternatives:`You need ${pct(c.need)}. ${allIn?`With no more betting you see both cards and improve about ${pct(p)} of the time.`:`The next card completes the draw ${pct(p)} of the time.`} ${direct?'That covers the price.':implied?`You are short by an amount you can win later: about ${m(extra)} more.`:byEquity?`That alone is short, but with two cards to come and the weaker hands in their range, your overall chance is about ${pct(eq)}.`:`To make up the gap you would need to win about ${m(extra)} more later, which is not realistic here.`}`,
    future:callIt?'If you hit, bet or raise for value. If you miss and face another big bet, check the price again: it usually gets worse on the turn.':'Nothing: fold.'}});
  }
  // Made hands and everything else: compare your chance against the range with the price.
  const ok=eq>=c.need+marginAdj,bigRiver=street==='river'&&frac>=.7;
  const raiseTo=view.legal.canRaise?(sized(c,c.facing*(street==='flop'?(c.ip?3:3.5):2.7))?.to??null):null;
  return finish(c,{action:ok?'call':'fold',alt:facingAlt(raiseTo),icmPriced:!!prem?.bf,close:Math.abs(eq-c.need-marginAdj)<.04,job:`${hand.job}: ${describe}`,lesson:ok?(hand.job==='thick value'?'raise-or-call':'pot-odds'):raise||bigRiver?'bluff-catch':hand.job==='air'?'give-up':'mdf',card:ok?(raise?'C09':'C04'):'C08',numbers:[...numbers,{label:'Theory defends this share of your range',value:pct(mdf),basis:'rule'},...(spr<=4?[{label:'Commit equity at this SPR',value:pct(commitEquity(spr)),basis:'rule' as Basis}]:[]),...premNumbers,...(street==='river'?[{label:'Pool river bets that are bluffs',value:pct(c.pool.riverBluffShare),basis:'pool' as Basis},{label:'In this app, a weak pair beats a river bet',value:`about ${pct(MEASURED.riverCatcherWins)} of the time`,basis:'measured' as Basis}]:[])],why:{
   ranges:`${rangeLine} You have ${describe}.${street==='river'&&!raise?` The live-pool average for river bluffs is higher (${pct(c.pool.riverBluffShare)}), but the players in this app have bluffed the river much less than that, and the estimate follows what they do.`:''}`,
   objective:ok?(value?'Keep worse hands and bluffs betting: calling wins more than folding and risks less than raising.':'Bluff-catch at the right price: you beat their bluffs and weaker value often enough.'):'Save the chips: your hand does not beat enough of the range that bets like this.',
   responses:ok?'Calling keeps every bluff and worse hand in their range. A raise would fold those out and get called only by better.':`${raise||bigRiver?'Big bets and raises on the later streets are rarely bluffs in most games. ':''}Hands that beat you make up most of this range.`,
   alternatives:`You need ${pct(c.need)} and have about ${pct(eq)}${margin?` (and a little extra is needed because more betting can follow${c.ip?'':' while you are out of position'})`:''}. ${ok?'So calling is profitable; folding gives up that edge.':`So calling loses money. In theory you defend ${pct(mdf)} of your range against this size, but this is the bottom of yours, and against players who under-bluff you fold more than theory says.`}${prem&&prem.points>0?` ${prem.note}`:''}`,
   future:ok?(street==='river'?'None: the hand ends here.':`On the next street, continue against a reasonable bet on safe cards. Re-check the price if an obvious draw completes or the bet gets much bigger.`):'Nothing: fold and note the line they took with whatever they show down.'}});
 }

 /* ------------------------------ Checked to you, or first to act ------------------------------ */
 const betOf=(f:number)=>hero.streetCommitted+f*pot,fracWords=(f:number)=>f<=.34?'a third of the pot':f<=.5?'half the pot':f<=.67?'two-thirds of the pot':f<=.8?'three-quarters of the pot':f<=1?'the pot':'one and a half times the pot';
 const prevChecked=lead<0&&street!=='flop',passive=c.opps.some(s=>{const r=o.styleOf?.(s.id);return !!r&&r.hands>=8&&/calls a lot/.test(r.label);});
 // Patch 106: a bluff is ruled out against a player who has rarely folded to a bet (at least six bets faced, folding to three in ten or fewer).
 const station=c.opps.some(s=>{const r=o.styleOf?.(s.id);return !!r&&(r.faced??0)>=6&&(r.foldToBet??1)<=.3;});
 const leadWords=heroLead?'You have the betting lead.':villainLead?`${nameOf(c,lead)} has the betting lead.`:prevChecked?'The last street was checked through, so nobody has shown strength.':'Nobody has the betting lead.';
 const base=`The board is ${boardWords}${multi?`, with ${n} players in`:', heads-up'}. ${leadWords} You have ${describe}.`;
 const betAdvice=(f:number,lesson:string,why:Why,numbers:CoachNumber[],job:string,close=false)=>{const r=raiseDraft(c,betOf(f),fracWords(f));return finish(c,{...r,close,job,lesson,card:'C02',numbers,why});};
 const checkAdvice=(lesson:string,why:Why,numbers:CoachNumber[],job:string,card='C03')=>finish(c,{action:'check',job,lesson,card,numbers,why});

 if(value){
  // Out of position against the player with the lead on the flop: check to them and raise.
  if(!c.ip&&villainLead&&street==='flop'&&!passive){
   return checkAdvice('check-raise',{ranges:`${base} That beats ${pct(hand.beats)} of possible hands.`,
    objective:'Value through a check-raise: let the player with the lead bet their whole range, then raise.',
    responses:`${nameOf(c,lead)} bets many hands when checked to. Their pairs and draws then call your raise; their bluffs fold, having already paid a bet.`,
    alternatives:'Leading out wins a smaller pot, because their weak hands fold right away. Check-calling hides your hand but lets draws see the turn cheaply.',
    future:`If they bet, raise to about three and a half times their bet. If they check behind, bet ${tex.label==='dry'?'half':'two-thirds of'} the pot on the turn.`},[beatsNote,sprNote],`${hand.job}: ${describe}`,'C07');
  }
  // Patch 106: players here call big bets with worse hands far more often than they fold, so value bets are sized up.
  const f=street==='flop'?(tex.label==='wet'||multi?1:tex.label==='dry'?.5:.75):street==='turn'?(tex.label==='wet'?.75:.67):hand.job==='the nuts'?1.5:1;
  return betAdvice(f,tex.label==='wet'&&street!=='river'?'protection':hand.job==='the nuts'?'fast-play':'value-bet',{ranges:`${base} That beats ${pct(hand.beats)} of possible hands.`,
   objective:`Value${tex.label!=='dry'&&street!=='river'?' and protection':''}: worse hands will call, so bet while they still can.`,
   responses:`Weaker pairs${street!=='river'&&tex.label!=='dry'?' and draws':''} call ${fracWords(f)}. ${tex.label==='dry'&&street==='flop'&&hu?'On a dry board fewer hands can call, so the size is the smallest of your value sizes.':street==='river'?(f>1?'With the best possible hand you want the largest bet a worse hand will pay, and players here who reach the river with a strong hand have paid off more than the pot.':'On the river a worse hand that has come this far usually pays off a big bet, so the size is large.'):'The bigger size charges the hands that are drawing and builds a pot you expect to win.'}`,
   alternatives:'Checking gives a free card and wins nothing from the hands that would have called. Slow-playing only makes sense when nothing can call and nothing can catch up.',
   future:`If you are raised, ${hand.job==='the nuts'?'re-raise: you want the stacks in':spr<=2?'you are committed at this stack-to-pot ratio: get it in':'slow down and judge the price: a raise is a strong range'}. If called, bet again on safe cards${street==='river'?'':` and re-think when an obvious draw completes`}.`},[beatsNote,sprNote],`${hand.job}: ${describe}`);
 }
 if(hand.job==='thin value'){
  const eqCall=street==='river'?memo(`thin|${hole.join('')}|${board.join('')}`,()=>equityVsRange(hole,board,.4,view.handId+'thin',0,1)):1;
  const canBet=(c.ip||heroLead||prevChecked)&&(!multi||hand.pair.startsWith('top pair')||hand.pair==='an overpair')&&eqCall>=.5;
  if(canBet){
   const f=street==='river'?.5:tex.label==='wet'?.6:.33;
   return betAdvice(f,'thin-value',{ranges:base,objective:'Thin value: you are ahead of most of what calls a small bet, but behind the hands that would play a big pot.',
    responses:`Worse pairs and some high cards call ${fracWords(f)}. Better hands call too or raise, which is why the size stays small.`,
    alternatives:'Checking is safe but wins nothing from worse hands. A big bet folds out everything you beat.',
    future:`If you are raised, fold: one pair is not strong enough against a ${street} raise at most tables. If called, plan to check the next street unless the card is a clear blank.`},[beatsNote,sprNote,...(street==='river'?[{label:'Your chance against a calling range',value:`about ${pct(eqCall)}`,basis:'estimate' as Basis}]:[])],`${hand.job}: ${describe}`,true);
  }
  return checkAdvice('pot-control',{ranges:base,objective:'Pot control: keep the pot a size your hand can win at showdown.',
   responses:c.ip?'Checking behind shows weakness, which can earn a call from a worse hand on a later street.':'After your check they may bet. A normal-sized bet you can call; a very large one you can fold.',
   alternatives:`Betting ${multi?'into several players':'out of position without the lead'} builds a pot in which only better hands continue.`,
   future:c.ip?'Call a reasonable bet on the next street, or bet small for value if they check again.':'Check-call one reasonable bet. Fold to a raise or to heavy pressure across two streets.'},[beatsNote,sprNote],`${hand.job}: ${describe}`);
 }
 if(hand.job==='strong draw'&&street!=='river'){
  if((heroLead||c.ip)&&n<=3){
   const f=street==='flop'?(tex.label==='wet'?.67:.5):.67;
   return betAdvice(f,'semi-bluff',{ranges:`${base} ${hand.drawOuts} cards complete your draw.`,objective:'A semi-bluff: two ways to win. They fold now, or you make your hand.',
    responses:`Hands with no pair fold, and many one-pair hands just call, which leaves you drawing at a bigger pot.`,
    alternatives:'Checking takes a free card but wins only when you hit, and a hit is harder to get paid on when you have shown no strength.',
    future:`If you are raised, compare the price with your ${pct(hand.byRiver??hand.nextCard)} chance to improve. If called, bet again when you hit, and usually once more on cards that scare a one-pair hand.`},[drawNote(),...(hand.byRiver!==null?[{label:'Chance to improve by the river',value:pct(hand.byRiver),basis:'exact' as Basis}]:[]),{label:`A ${fracWords(f)} bet needs folds`,value:pct(f/(1+f)),basis:'exact'},{label:`Pool folds to a ${street} bet`,value:pct(street==='flop'?c.pool.flopFold:c.pool.turnFold),basis:'pool'}],`${hand.job}: ${hand.drawOuts} outs`);
  }
  return checkAdvice('check-raise',{ranges:`${base} ${hand.drawOuts} cards complete your draw.`,objective:'See the next card at the best price: out of position without the lead, a bet can be raised off your draw.',
   responses:'If they bet, check the price against your outs. A small bet you can call; a big draw can also check-raise as a semi-bluff.',
   alternatives:`Leading ${multi?'into several players':'into the player with the lead'} gets raised too often, and a raise makes you pay the most to see your draw.`,
   future:`Call when the next card comes in often enough for the price (${pct(hand.nextCard)} on the next card). If you hit, lead out or check-raise for value.`},[drawNote(),sprNote],`${hand.job}: ${hand.drawOuts} outs`);
 }
 /* Bluffs: the small bet by the pre-flop raiser on a board that favours them, and the river bet after two checks. */
 const noShowdown=hand.job==='air'||hand.job==='weak draw'||hand.job==='strong draw';
 const foldSeen=hu?(()=>{const r=o.styleOf?.(c.opps[0].id);return r&&(r.faced??0)>=6&&r.foldToBet!=null?` You have seen ${nameOf(c,c.opps[0].id)} fold to ${Math.round(r.foldToBet*(r.faced??0))} of ${r.faced} bets after the flop.`:'';})():'';
 const needs=(f:number)=>pct(f/(1+f)),sizeName=(f:number)=>f<=.34?'A third-pot':f<=.5?'A half-pot':'A two-thirds';
 if(noShowdown&&heroLead&&hu&&street==='flop'&&!station){
  const f=tex.label==='dry'?.33:.5;
  return betAdvice(f,'range-advantage',{ranges:`${base} ${tex.high?`As the pre-flop raiser you hold more big pairs and big ${'JQKA'[tex.top-11]}s than the caller, who missed this board most of the time.`:'As the pre-flop raiser you can hold every big pair. The caller mostly holds two unpaired cards, and two unpaired cards miss a low flop like this about two times in three.'}`,
   objective:'A cheap bluff with the range advantage: make the hands that missed fold.',
   responses:`${sizeName(f)} bet needs to work only ${needs(f)} of the time. ${f<=.34?`The live pool folds about ${pct(c.pool.flopFoldThird)} to this size`:`The live pool folds to flop bets about ${pct(c.pool.flopFold)} of the time`}, and you can still improve when called.${foldSeen}`,
   alternatives:`Checking gives up a pot your range is favoured to win. ${f<=.34?'A bigger bet risks more to fold out the same hands.':'On a board with draws a very small bet lets them all continue cheaply, so the size goes up to half the pot.'}`,
   future:'If called, give up on most turns unless you pick up a draw or a card that favours your range. If raised, fold.'},[{label:`${sizeName(f)} bet needs folds`,value:needs(f),basis:'exact'},f<=.34?{label:'Pool folds to a third-pot flop bet',value:pct(c.pool.flopFoldThird),basis:'pool'}:{label:'Pool folds to a flop bet',value:pct(c.pool.flopFold),basis:'pool'},{label:'In this app, heads-up flop bets like this won the pot at once',value:`about ${pct(MEASURED.flopBetFolds)} of the time`,basis:'measured'}],`${hand.job}: no pair`,true);
 }
 /* Patch 106: the flop stab. Heads-up in position, they check to you and you have nothing: a small bet wins the pot often enough. */
 if((hand.job==='air'||hand.job==='weak draw')&&street==='flop'&&hu&&!heroLead&&!station&&(c.ip||pfr<0)){
  return betAdvice(.5,'fold-equity',{ranges:`${base} ${c.ip?(villainLead?`${nameOf(c,lead)} raised before the flop and has now checked: a raiser who checks the flop has usually missed it.`:'They checked to you. Two unpaired cards miss the flop about two times in three, and a hand that hit usually bets.'):'Nobody raised before the flop, so nobody has shown a strong hand, and two unpaired cards miss the flop about two times in three.'}`,
   objective:c.ip?'A bluff at a range that has shown no interest in the pot.':'A bluff at a pot nobody has claimed: with one opponent, the first bet often takes it.',
   responses:`A half-pot bet needs to work 33% of the time. The live pool folds to flop bets about ${pct(c.pool.flopFold)} of the time${c.ip?', and a player who has checked folds more often than that':''}.${foldSeen}`,
   alternatives:`${c.ip?'Checking back is safe but gives a free card to a hand that would have folded.':'Checking hands the lead to your opponent, who can then bet you off the pot.'} A bigger bet risks more to fold out the same hands.`,
   future:`If called, give up unless the turn helps you${hand.drawOuts?` (you have ${hand.drawOuts} outs)`:''}. If raised, fold.`},[{label:'A half-pot bet needs folds',value:'33%',basis:'exact'},{label:'Pool folds to a flop bet',value:pct(c.pool.flopFold),basis:'pool'},{label:'In this app, heads-up flop bets like this won the pot at once',value:`about ${pct(MEASURED.flopBetFolds)} of the time`,basis:'measured'},...(hand.drawOuts?[drawNote()]:[])],`${hand.job}: ${hand.drawOuts?`${hand.drawOuts} outs`:'no pair'}`,true);
 }
 if(noShowdown&&street==='river'&&hu&&c.ip&&prevChecked&&!station&&hand.beats<.45){
  return betAdvice(.67,'river-bluff',{ranges:`${base} They checked the turn and have checked again: strong hands usually bet at least once.`,
   objective:'A bluff: your hand cannot win by checking, and their range is weak.',
   responses:`A two-thirds bet needs to work 40% of the time. The live pool folds to river bets about ${pct(c.pool.riverFold)} of the time, and more after showing this much weakness.${foldSeen}`,
   alternatives:'Checking back loses the pot nearly every time with this hand. A tiny bet gets called by any pair.',
   future:'If raised, fold. Win or lose, this is the only bet left.'},[{label:'A two-thirds bet needs folds',value:'40%',basis:'exact'},{label:'Pool folds to a river bet',value:pct(c.pool.riverFold),basis:'pool'},beatsNote],`${hand.job}: no showdown value`,true);
 }
 /* The turn stab: heads-up in position after the flop was checked through and they check again. */
 if(noShowdown&&street==='turn'&&hu&&c.ip&&!station){
  const f=prevChecked?.5:.67;
  return betAdvice(f,'fold-equity',{ranges:`${base} ${prevChecked?'They checked the flop and have checked again, so their range is mostly hands that missed or weak pairs.':'They called the flop and have checked again. A flop call is often a weak pair or a draw, and most of those do not want to face a second bet.'}`,
   objective:prevChecked?'A bluff at a weak range: two checks rarely hide a strong hand.':'A second bet as a bluff: keep the pressure on the weak pairs and draws that called once.',
   responses:`${prevChecked?'A half-pot bet needs to work 33% of the time':'A two-thirds bet needs to work 40% of the time'}. The live pool folds to turn bets about ${pct(c.pool.turnFold)} of the time${prevChecked?', and more often after checking twice':''}.${foldSeen}`,
   alternatives:'Checking again gives up a pot nobody seems to want. A bigger bet risks more to fold out the same hands.',
   future:`If called, give up on the river unless you improve${hand.drawOuts?` (you have ${hand.drawOuts} outs)`:''}. If raised, fold.`},[{label:prevChecked?'A half-pot bet needs folds':'A two-thirds bet needs folds',value:prevChecked?'33%':'40%',basis:'exact'},{label:'Pool folds to a turn bet',value:pct(c.pool.turnFold),basis:'pool'},{label:'In this app, heads-up turn bets like this won the pot at once',value:`about ${pct(MEASURED.turnBetFolds)} of the time`,basis:'measured'},...(hand.drawOuts?[drawNote()]:[])],`${hand.job}: ${hand.drawOuts?`${hand.drawOuts} outs`:'no pair'}`,true);
 }
 const weak=hand.job==='showdown value';
 return checkAdvice(weak?'pot-control':multi?'multiway':villainLead?'initiative':'give-up',{ranges:base,
  objective:weak?'Get to showdown cheaply: your hand beats bluffs and missed draws, but not the hands that call a bet.':'Save the chips: a bet here needs folds you are not likely to get.',
  responses:weak?'A bet folds out the hands you beat and gets called by the hands that beat you.':multi?`With ${n} players in, every one of them has to fold for a bluff to work.`:station?'This opponent has rarely folded to a bet, so a bluff is not worth trying.':`This board ${tex.high?'is not one':'favours the caller more than the raiser, so it is not one'} where a bet gets enough folds.`,
  alternatives:weak?'Betting turns a hand that can win at showdown into a bluff.':'A bet without a draw or a good card just adds to the loss when called. Checking keeps the option to continue if the next card helps.',
  future:weak?(c.ip?'Call one reasonable bet on a later street; fold to big pressure.':'Check-call one reasonable bet; fold to a large bet or a second barrel on a bad card.'):`${hand.drawOuts>=4?`You have ${hand.drawOuts} outs: call only a small bet. `:''}Fold to a normal-sized bet unless the price fits your outs.`},
  [beatsNote,...(hand.drawOuts?[drawNote()]:[]),sprNote],`${hand.job}: ${describe}`);
}
