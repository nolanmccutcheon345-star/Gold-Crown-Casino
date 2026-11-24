/** Patch 105: the Live coach's starting-hand ranges. The 169 starting hands are put in one order by a simple
 * playability score (high cards, pairs, suitedness, connectedness), and each seat opens the top share of that order.
 * The widths follow the user's Master Playbook (tight up front, wide on the button); the order itself is the coach's
 * own, not a copy of any published chart. Rules of thumb, not solver output. */
import type {Card} from '../contracts';

export const RANKS='23456789TJQKA';
const value=(r:string)=>RANKS.indexOf(r)+2;
export interface HandClass {key:string;hi:number;lo:number;pair:boolean;suited:boolean;gap:number;combos:number;score:number}
const PAIR_SCORE:Record<number,number>={14:72,13:68,12:64,11:60,10:56,9:52.5,8:50,7:47.8,6:45.5,5:44,4:42.4,3:41,2:40};
function score(hi:number,lo:number,suited:boolean):number {
 if(hi===lo)return PAIR_SCORE[hi];
 const gap=hi-lo-1,ace=hi===14;
 const link=suited?(gap===0?4:gap===1?3:gap===2?1.5:0):(gap===0?1.5:gap===1?.75:0);
 const wide=ace?0:Math.max(0,gap-2)*1.1;
 return hi*2+lo*1.5+(suited?6:-1)+link-wide+(ace&&lo===13?5:0)+(ace&&lo===12&&!suited?2:0)+(ace&&suited&&lo<=5?1.5:0)-(ace&&!suited&&lo<10?1.5:0);
}
/** Every starting hand, best first. */
export const ORDER:readonly HandClass[]=(()=>{
 const out:HandClass[]=[];
 for(let hi=14;hi>=2;hi--)for(let lo=hi;lo>=2;lo--){
  const a=RANKS[hi-2],b=RANKS[lo-2];
  if(hi===lo)out.push({key:a+b,hi,lo,pair:true,suited:false,gap:-1,combos:6,score:score(hi,lo,false)});
  else for(const suited of [true,false])out.push({key:a+b+(suited?'s':'o'),hi,lo,pair:false,suited,gap:hi-lo-1,combos:suited?4:12,score:score(hi,lo,suited)});
 }
 return out.sort((x,y)=>y.score-x.score||y.hi-x.hi||y.lo-x.lo);
})();
const BY_KEY=new Map(ORDER.map(h=>[h.key,h]));
/** Where each hand's last combo falls, as a share of all 1,326 combos: AA is 0.0045, 72o is 1. */
const CUMULATIVE=(()=>{const m=new Map<string,number>();let n=0;for(const h of ORDER){n+=h.combos;m.set(h.key,n/1326);}return m;})();
export function handKey(hole:readonly Card[]):string {
 const [a,b]=[...hole].sort((x,y)=>value(y[0])-value(x[0]));
 return a[0]===b[0]?a[0]+b[0]:a[0]+b[0]+(a[1]===b[1]?'s':'o');
}
export const handClass=(hole:readonly Card[]):HandClass=>BY_KEY.get(handKey(hole))!;
/** The hand's place in the order: 0.05 means it is in the top 5% of starting hands. */
export const percentile=(key:string)=>CUMULATIVE.get(key)??1;
export const inTop=(key:string,share:number)=>percentile(key)<=share+1e-9;
/** The hands in the top share, as hand names. */
export const topHands=(share:number)=>ORDER.filter(h=>inTop(h.key,share)).map(h=>h.key);
/** A short description of a top-share range: its weakest pair, suited ace, and offsuit hand. */
export function describeTop(share:number):string {
 const hands=ORDER.filter(h=>inTop(h.key,share));if(!hands.length)return 'almost nothing';
 const pairs=hands.filter(h=>h.pair),lastPair=pairs.at(-1),off=hands.filter(h=>!h.pair&&!h.suited).at(-1),suitedAce=hands.filter(h=>h.suited&&h.hi===14).at(-1);
 return [lastPair?`${lastPair.key}+`:'',suitedAce?`${suitedAce.key}+`:'',off?`down to ${off.key}`:'no offsuit hands'].filter(Boolean).join(', ');
}
/** How wide each seat opens an unraised pot (share of all hands). Seats are named by distance from the button, so a
 * six-handed table simply has no UTG seats. */
export const OPEN_WIDTH:Record<string,number>={UTG:.10,'UTG+1':.11,'UTG+2':.13,'UTG+3':.14,LJ:.15,HJ:.19,CO:.27,BTN:.43,SB:.36,BB:0,'BTN/SB':.72};
export const openWidth=(position:string)=>OPEN_WIDTH[position]??.12;
/** How wide the big blind defends against one raise of about three big blinds, by the raiser's seat. */
export const BB_DEFEND:Record<string,number>={UTG:.20,'UTG+1':.21,'UTG+2':.23,'UTG+3':.24,LJ:.26,HJ:.30,CO:.36,BTN:.48,SB:.55,'BTN/SB':.62};
/** Short-stack shoving ranges at ten big blinds, by seat (wider with fewer chips, tighter with more). */
export const SHOVE_WIDTH:Record<string,number>={UTG:.09,'UTG+1':.10,'UTG+2':.12,'UTG+3':.13,LJ:.15,HJ:.19,CO:.26,BTN:.38,SB:.55,'BTN/SB':.60};
export function shoveWidth(position:string,stackBB:number):number {
 const base=SHOVE_WIDTH[position]??.12,scale=stackBB<=5?1.6:stackBB<=7?1.3:stackBB<=10?1:stackBB<=13?.85:.7;
 return Math.min(1,base*scale);
}
/* ------------------------------------------------------------------ *
 * Phase 3: the playbook's chart sets, as data, every number labelled with its source.
 * The playbook (Texas Hold'em Master Playbook) holds the full chart grids in its Preflop Ranges tab;
 * the extract supplied for this build (the Overview tab) states only some widths numerically.
 * Widths the sources state are numbers; widths that live only in the chart tab are `null` —
 * the coach falls back to its working set for those seats and says so, rather than inventing a chart.
 * ------------------------------------------------------------------ */
export interface ChartSet {id:string;name:string;source:string;kind:'recommended'|'pool';
 /** Opening (RFI) width by seat, as a share of all starting hands. Null: in the playbook's chart tab, not stated numerically in the supplied sources. */
 widths:Record<string,number|null>}
/** Janda, Applications of No-Limit Hold 'em: 6-max, 100bb, 3.5bb opens. Anchors stated in Master NLHE §2.1–2.2:
 * UTG opens a linear 17.6% at NL500; the button opens 42% at 100bb. The other seats' grids are in the playbook's
 * Preflop Ranges tab (Book 1 hand chart, pp. 81–86) and are not reproduced numerically in the supplied extract. */
export const JANDA_6MAX:ChartSet={id:'janda-6max',name:'Janda 6-max RFI (100bb)',kind:'recommended',
 source:'Janda, Applications of No-Limit Hold ’em, via Master NLHE §2.1–2.2 (UTG 17.6%, BTN 42% anchors)',
 widths:{UTG:.176,'UTG+1':null,'UTG+2':null,LJ:null,HJ:null,CO:null,BTN:.42,SB:null,BB:0}};
/** The coach's working full-ring set: Red Chip Poker's live 9-handed opening charts as captured in the playbook,
 * in the bands the playbook records (tight up front, wide on the button). Same numbers as OPEN_WIDTH above. */
export const REDCHIP_LIVE_9MAX:ChartSet={id:'redchip-live-9max',name:'Red Chip live full-ring RFI',kind:'recommended',
 source:'Red Chip Poker CORE live full-ring RFI charts (EP1–SB), captured in the playbook’s Preflop Ranges tab',
 widths:{...OPEN_WIDTH}};
/** What the pool actually opens, from a large database audit — a description of opponents, not a recommendation.
 * Master NLHE rule 167 (Red Chip, w34z3l): RFI ≈ UTG 13 / MP 18 / CO 27 / BTN 48 / SB 36; iso vs limpers ≈ 40%. */
export const POOL_RFI:ChartSet={id:'pool-rfi',name:'Pool RFI frequencies (measured)',kind:'pool',
 source:'Master NLHE rule 167 — Red Chip Poker frequency audit (blog #460)',
 widths:{UTG:.13,'UTG+1':.15,'UTG+2':.16,'UTG+3':.17,LJ:.18,HJ:.22,CO:.27,BTN:.48,SB:.36,BB:0}};
/** Pool 3-bet frequencies by the 3-bettor's seat (rule 167: ≈ 4 / 6 / 8–10 / 8 / 8). */
export const POOL_3BET_FREQ:Record<string,number>={UTG:.04,'UTG+1':.05,'UTG+2':.06,'UTG+3':.07,LJ:.06,HJ:.07,CO:.09,BTN:.08,SB:.08,BB:.08};
/** One sourced solver anchor: at 100bb the big blind 3-bets a UTG open about 5.4% of the time, and the pool
 * 3-bets less than that from the big blind (Master NLHE §2.4) — which is why default 4-bet bluffs are cut. */
export const BB_3BET_VS_UTG=.054;
/** Facing a 3-bet, solver continuing shares: about 45% against a small 3-bet, about 39% against a large one
 * (Master NLHE §8.5: solver folding runs mid-50s% to ~61% — defend more than naive MDF says). */
export const DEFEND_VS_3BET={small:.45,large:.39};
/** The chart set that governs a table of this size: 6-max and shorter uses the Janda set (with the working
 * full-ring set filling its unstated seats); 7+ seats uses the Red Chip live full-ring set. */
export function rfiChart(seats:number):ChartSet {return seats<=6?JANDA_6MAX:REDCHIP_LIVE_9MAX;}
/** The opening width for a seat from a chart set, falling back to the working set where the chart is unstated. */
export function chartWidth(chart:ChartSet,position:string):{width:number;stated:boolean} {
 const w=chart.widths[position];return w===null||w===undefined?{width:openWidth(position),stated:false}:{width:w,stated:true};
}

/* Stack-depth bands for tournament play (Master NLHE §2.7 depth ladder, §11.5, rules 48/57/98).
 * Depth rotates a range before it resizes it: shallower stacks trade small pairs and suited connectors
 * for high cards, until very short, where shove-or-fold takes over. */
export interface DepthBand {maxBB:number;label:string;rises:string;falls:string;note:string}
export const DEPTH_BANDS:readonly DepthBand[]=[
 {maxBB:5,label:'shove-or-fold (micro)',rises:'any two that can be ahead when called — at 2bb a jam of ~36% is profitable because the big blind calls everything',falls:'nothing plays postflop',note:'At 5bb a shove range is about 20% of hands; calling ranges run just over half the shoving range, except the big blind at 5bb, which calls wider (rule 57).'},
 {maxBB:9,label:'shove-or-fold',rises:'strong offsuit aces, pairs',falls:'min-raising — at 9bb and below the min-raise becomes a shove (rule 57)',note:'AA still min-raises at 9bb to induce; at 7bb and below it shoves too.'},
 {maxBB:17,label:'the tightest zone',rises:'ace-x blockers, high cards',falls:'low-card board coverage, weakest pairs (66 is the weakest pair at 20bb)',note:'Around 14bb a min-raise induce range (~7.5%) and a small limping range (AA/KK traps, ~4.6%) appear in MTTs; 17bb is the tightest point of the ladder.'},
 {maxBB:30,label:'shallow',rises:'offsuit broadways, suited high cards (top pair is a stack-off hand)',falls:'22–44 leave the early opens; small pairs and low suited connectors shrink (set-mining needs depth)',note:'Open sizes drop (2.3bb → 2.1bb): shallow stacks get all-in easily.'},
 {maxBB:50,label:'medium',rises:'high-card hands keep rising (UTG in MTTs plays 17.7% at 50bb vs 16.5% at 100bb)',falls:'suited connectors keep shrinking',note:'Depth has rotated the range more than resized it.'},
 {maxBB:Infinity,label:'full stack (100bb+)',rises:'small pairs and suited connectors hold their value (implied odds)',falls:'—',note:'The baseline the charts are built for. Deeper (200bb), position and nut potential are worth still more.'},
];
export const depthBand=(effBB:number):DepthBand=>DEPTH_BANDS.find(b=>effBB<=b.maxBB)!;
/** Calling a shove: the calling range runs at just over half the shoving range (rule 57) — except the
 * big blind at about 5bb, which calls wider than the range that shoves into it. */
export const shoveCallShare=(position:string,effBB:number):number=>position==='BB'&&effBB<=6?.62:.55;

const PREMIUM=new Set(['AA','KK','QQ','AKs','AKo']);
/** Hands that re-raise a first raise for value. A wider raiser (a later seat) is re-raised with more hands. */
export function valueThreeBet(key:string,openerWidth:number):boolean {
 if(PREMIUM.has(key))return true;
 if(openerWidth>=.19&&(key==='JJ'||key==='AQs'))return true;
 return openerWidth>=.27&&['TT','AJs','KQs','AQo'].includes(key);
}
/** Suited wheel aces: the standard re-raise bluffs (they block AA and AK, and can still make the nut flush). */
export const bluffThreeBet=(key:string,openerWidth:number)=>openerWidth>=.27&&['A5s','A4s'].includes(key)||openerWidth>=.43&&['A3s','A2s'].includes(key);
/** Hands that want a cheap flop and a big pot when they hit: small and middle pairs and suited connectors. */
export const speculative=(h:HandClass)=>h.pair&&h.hi<=10||h.suited&&!h.pair&&h.gap<=1&&h.hi<=11&&h.lo>=4;
