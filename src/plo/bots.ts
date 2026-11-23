/** Patch 74: Omaha players. Each sees only its own four cards, the board and the betting, never anyone's hidden cards.
 * Before the flop they score their four cards the way Omaha players do (pairs, suits, connected ranks, danglers);
 * after it they estimate their equity by dealing out random hands for the players still in, then weigh it against
 * the price, with their own looseness, aggression and stubbornness. */
import type {Card} from '../contracts';
import {standardDeck} from '../core/deck';
import {compareRanks} from '../core/evaluator';
import {legalPlo,omahaRank,type PloAction,type PloHand} from './engine';
import {adjusted,sizeChoice,EMPTY_READS,type PloMoodState,type PloReads} from './human';

export interface PloPersonality {id:string;name:string;style:string;read:string;looseness:number;aggression:number;bluff:number;stubborn:number}
/** The Omaha table's regulars. */
export const PLO_PLAYERS:readonly PloPersonality[]=Object.freeze([
 {id:'otto',name:'Otto',style:'Any four cards',read:'Plays almost every hand and chases any draw. Bet your made hands big.',looseness:.85,aggression:.35,bluff:.12,stubborn:.8},
 {id:'birdie',name:'Birdie',style:'Wraps and nuts',read:'Waits for big wraps and nut hands, then pots it. When she raises the turn, believe her.',looseness:.3,aggression:.7,bluff:.05,stubborn:.3},
 {id:'cash',name:'Johnny Cash',style:'Pot-pot-pot',read:'Pots every street when he likes his hand and sometimes when he does not. Call down lighter on dry boards.',looseness:.6,aggression:.9,bluff:.3,stubborn:.5},
 {id:'mae',name:'Mae',style:'Careful pro',read:'Solid and patient; folds second-best hands. Bluff her on scary boards.',looseness:.4,aggression:.55,bluff:.15,stubborn:.25},
 {id:'rusty',name:'Rusty',style:'Hold’em player',read:'Plays Omaha like Hold’em: overvalues one pair and big aces. Value-bet him relentlessly.',looseness:.6,aggression:.4,bluff:.1,stubborn:.75},
 {id:'zora',name:'Zora',style:'Double-suited fan',read:'Loves suited hands and flush draws. Make her pay for draws; beware when the flush comes.',looseness:.55,aggression:.5,bluff:.18,stubborn:.55},
 {id:'big-al',name:'Big Al',style:'Splashy',read:'Gambles with big pots and pots preflop often. Let him build the pot for you.',looseness:.75,aggression:.75,bluff:.25,stubborn:.6},
 {id:'quinn',name:'Quinn',style:'Nit',read:'Tight and passive; folds unless she holds the nuts. Steal her blinds.',looseness:.2,aggression:.3,bluff:.03,stubborn:.2},
]);
export const ploPlayer=(id:string)=>PLO_PLAYERS.find(p=>p.id===id);

const RANK='23456789TJQKA';
const rank=(c:Card)=>RANK.indexOf(c[0])+2;
/** A 0–1 score for four Omaha cards. Aces, pairs, suited aces, double suits and connected ranks score well;
 * three or four of a kind and a lone "dangler" score poorly. */
export function preflopScore(hole:Card[]):number {
 const ranks=hole.map(rank).sort((a,b)=>b-a),counts=new Map<number,number>();ranks.forEach(r=>counts.set(r,(counts.get(r)??0)+1));
 const suits=new Map<string,Card[]>();for(const c of hole)suits.set(c[1],[...(suits.get(c[1])??[]),c]);
 let score=0;
 for(const [r,n] of counts){if(n===2)score+=r>=10?.22+(r-10)*.04:.08+(r-2)*.01;if(n>=3)score-=.25;}
 const suited=[...suits.values()].filter(cs=>cs.length===2);
 score+=suited.length*.12;if(suited.length===2)score+=.06;
 if([...suits.values()].some(cs=>cs.length===2&&cs.some(c=>c[0]==='A')))score+=.1;
 if([...suits.values()].some(cs=>cs.length>=3))score-=.05;
 const unique=[...counts.keys()].sort((a,b)=>b-a);
 for(let i=0;i<unique.length-1;i++){const gap=unique[i]-unique[i+1];if(gap===1)score+=.08;else if(gap===2)score+=.05;else if(gap===3)score+=.02;}
 if(unique.length===4&&unique[2]-unique[3]>4)score-=.08;// a dangler
 score+=ranks.reduce((a,r)=>a+Math.max(0,r-9)*.015,0);
 if(counts.get(14)&&counts.get(14)!>=1)score+=.06;
 return Math.max(0,Math.min(1,score/0.95));
}

/** Estimated chance to win against `opponents` random hands, from the cards this player can see. */
export function ploEquity(hole:Card[],board:Card[],opponents:number,random:(n:number)=>number,trials=120):number {
 if(opponents<1)return 1;
 const known=new Set([...hole,...board]),pool=standardDeck().filter(c=>!known.has(c));
 let won=0;
 for(let t=0;t<trials;t++){
  const deck=[...pool];for(let i=0;i<Math.min(deck.length,4*opponents+5-board.length);i++){const j=i+random(deck.length-i);[deck[i],deck[j]]=[deck[j],deck[i]];}
  let k=0;const full=[...board];while(full.length<5)full.push(deck[k++]);
  const me=omahaRank(hole,full);let best=1,ties=1;
  for(let o=0;o<opponents;o++){const r=omahaRank(deck.slice(k,k+4),full);k+=4;const c=compareRanks(r,me);if(c>0){best=0;break;}if(c===0)ties++;}
  won+=best?1/ties:0;
 }
 return won/trials;
}

/** One decision. `random(n)` returns 0..n-1. */
export function ploDecide(h:PloHand,p:PloPersonality,random:(n:number)=>number,ctx?:DecideContext):PloAction {return ploDecideDetailed(h,p,random,ctx).action;}
export interface DecideContext {mood?:PloMoodState;reads?:PloReads}
/** A decision with how strong the hand felt (0–1) and whether it was a big decision, for timing. */
export function ploDecideDetailed(h:PloHand,base:PloPersonality,random:(n:number)=>number,ctx:DecideContext={}):{action:PloAction;strength:number;big:boolean} {
 const l=legalPlo(h);if(!l)throw new Error('No decision is due.');
 const me=h.seats.find(s=>s.id===h.actor)!,opponents=h.seats.filter(s=>!s.folded&&s.id!==me.id).length;
 const lastRaise=[...h.events].reverse().find(e=>e.kind==='action'&&e.action?.type==='raise'),facingHero=l.call>0&&lastRaise?.seatId===0;
 const p=adjusted(base,ctx.mood,ctx.reads??EMPTY_READS,facingHero);
 const pot=h.potCollected+h.seats.reduce((a,s)=>a+s.bet,0),u=()=>random(10000)/10000;
 const big=l.call>=me.stack/3||pot>=me.stack*.6;
 const raise=(strong:boolean):PloAction=>l.canRaise?{type:'raise',to:sizeChoice(p,l.minRaiseTo,l.maxRaiseTo,strong,u())}:l.check?{type:'check'}:{type:'call'};
 if(h.street==='preflop'){
  let score=preflopScore(me.hole);
  // The Hold'em player loves a big pair however the other two cards look.
  if(p.id==='rusty'){const r=me.hole.map(c=>c[0]);if(['A','K'].some(x=>r.filter(y=>y===x).length===2))score+=.25;}
  const s=score+(p.looseness-.5)*.35-(opponents>4?.04:0);
  const facingRaise=h.currentBet>h.bigBlind,price=l.call/(pot+l.call||1);
  const act=(action:PloAction)=>({action,strength:Math.min(1,score),big});
  if(s>.62+(facingRaise?.12:0)&&u()<.4+p.aggression*.5)return act(raise(true));
  if(l.check)return act(u()<p.bluff*.3&&l.canRaise?raise(false):{type:'check'});
  if(s>.28+price*.6+(facingRaise?.12:0))return act({type:'call'});
  return act({type:'fold'});
 }
 const eq=ploEquity(me.hole,h.board,opponents,random);
 const act=(action:PloAction)=>({action,strength:eq,big});
 const price=l.call/(pot+l.call||1),strong=eq>Math.max(.55,1.4/(opponents+1));
 if(l.check){
  if(strong&&u()<.45+p.aggression*.5)return act(raise(true));
  if(u()<p.bluff*(opponents===1?1.4:.6)&&l.canRaise)return act(raise(false));
  return act({type:'check'});
 }
 if(strong&&u()<.25+p.aggression*.45&&l.canRaise)return act(raise(true));
 if(eq>=price+.04-p.stubborn*.08)return act({type:'call'});
 if(u()<p.bluff*.15&&l.canRaise&&opponents===1)return act(raise(false));
 return act({type:'fold'});
}
