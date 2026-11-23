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
