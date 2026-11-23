/** Patch 99: punto banco baccarat from an eight-deck shoe, with the standard third-card rules. Player pays even
 * money, Banker pays 19 to 20 (5% commission), Tie pays 8 to 1 (Player and Banker bets push on a tie), and the pair
 * bets pay 11 to 1 on a pair in the first two cards of that hand. House edges: Banker 1.06%, Player 1.24%, Tie 14.4%. */
import type {Random} from './wallet';

export const DECKS=8;
export type Card=string;// rank + suit, e.g. "Ks"
export const pointOf=(c:Card)=>{const r=c[0];return r==='A'?1:'TJQK'.includes(r)?0:Number(r);};
export const total=(cards:readonly Card[])=>cards.reduce((a,c)=>a+pointOf(c),0)%10;
/** A shoe: eight 52-card decks, shuffled. */
export function shoe(random:Random,decks=DECKS):Card[] {
 const out:Card[]=[];for(let d=0;d<decks;d++)for(const r of 'A23456789TJQK')for(const s of 'shdc')out.push(r+s);
 for(let i=out.length-1;i>0;i--){const j=random(i+1);[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
/** Does the Banker draw, given the Banker's two-card total and the Player's third card (null if the Player stood)? */
export function bankerDraws(banker:number,playerThird:number|null):boolean {
 if(playerThird===null)return banker<=5;
 if(banker<=2)return true;
 if(banker===3)return playerThird!==8;
 if(banker===4)return playerThird>=2&&playerThird<=7;
 if(banker===5)return playerThird>=4&&playerThird<=7;
 if(banker===6)return playerThird===6||playerThird===7;
 return false;
}
export interface Coup {player:Card[];banker:Card[];
 /** Deal order for the show: which hand got each card. */
 order:('P'|'B')[];
 winner:'player'|'banker'|'tie';playerTotal:number;bankerTotal:number;natural:boolean}
/** Deal one coup from the top of a shoe (cards are taken from the start of the array). */
export function deal(cards:Card[]):Coup {
 let i=0;const next=()=>{const c=cards[i++];if(!c)throw new Error('The shoe ran out.');return c;};
 const player=[next()],banker=[next()];player.push(next());banker.push(next());
 const order:('P'|'B')[]=['P','B','P','B'];
 const p2=total(player),b2=total(banker),natural=p2>=8||b2>=8;
 if(!natural){
  let third:number|null=null;
  if(p2<=5){const c=next();player.push(c);order.push('P');third=pointOf(c);}
  if(bankerDraws(b2,third)){banker.push(next());order.push('B');}
 }
 const pt=total(player),bt=total(banker);
 return {player,banker,order,natural,playerTotal:pt,bankerTotal:bt,winner:pt>bt?'player':bt>pt?'banker':'tie'};
}
export type BaccaratSpot='player'|'banker'|'tie'|'playerPair'|'bankerPair'|'dragon7'|'panda8'|'lucky6'|'dragonP'|'dragonB';
export const SPOTS:readonly BaccaratSpot[]=['player','banker','tie','playerPair','bankerPair','dragon7','panda8','lucky6','dragonP','dragonB'];
/** Patch 100: EZ Baccarat. No commission: a Banker win pays even money, except a Banker win with a three-card 7 (a
 * "Dragon 7"), which pushes. Side bets: Dragon 7 pays 40 to 1, Panda 8 (a Player win with a three-card 8) pays 25 to 1. */
export const isDragon7=(c:Coup)=>c.winner==='banker'&&c.banker.length===3&&c.bankerTotal===7;
export const isPanda8=(c:Coup)=>c.winner==='player'&&c.player.length===3&&c.playerTotal===8;
/** Patch 102: Lucky 6: the Banker wins with a total of 6. 12 to 1 with two cards, 20 to 1 with three. */
export const isLucky6=(c:Coup)=>c.winner==='banker'&&c.bankerTotal===6;
/** Patch 103: the Dragon Bonus on Player or Banker. Your side wins with a natural: 1 to 1. Both sides tie on naturals:
 * push. Your side wins without a natural by 9 points: 30 to 1; by 8: 10 to 1; by 7: 6 to 1; by 6: 4 to 1; by 5: 2 to 1;
 * by 4: 1 to 1. Anything else loses. Returns the win per unit staked, 0 for a push, -1 for a loss. */
export const DRAGON_PAYS:Record<number,number>={9:30,8:10,7:6,6:4,5:2,4:1};
export function dragonBonus(c:Coup,side:'player'|'banker'):number {
 const mine=side==='player'?c.player:c.banker,me=side==='player'?c.playerTotal:c.bankerTotal,them=side==='player'?c.bankerTotal:c.playerTotal;
 if(c.winner==='tie')return c.natural&&c.player.length===2&&c.banker.length===2&&me>=8?0:-1;
 if(c.winner!==side)return -1;
 if(mine.length===2&&me>=8)return 1;
 return DRAGON_PAYS[me-them]??-1;
}
export type BaccaratBets=Partial<Record<BaccaratSpot,number>>;
const pair=(cards:readonly Card[])=>cards[0][0]===cards[1][0];
/** What comes back on each spot: the stake plus winnings, the stake alone on a push, nothing on a loss. Banker wins
 * pay 0.95 to 1, rounded down to the cent. */
export function payout(coup:Coup,bets:BaccaratBets,ez=false):{returned:number;bySpot:Partial<Record<BaccaratSpot,number>>} {
 const by:Partial<Record<BaccaratSpot,number>>={};
 for(const spot of SPOTS){const a=bets[spot]??0;if(!a)continue;
  let r=0;
  if(spot==='player')r=coup.winner==='player'?2*a:coup.winner==='tie'?a:0;
  else if(spot==='banker')r=coup.winner==='banker'?(ez?(isDragon7(coup)?a:2*a):a+Math.floor(a*95/100)):coup.winner==='tie'?a:0;
  else if(spot==='dragon7')r=ez&&isDragon7(coup)?41*a:0;
  else if(spot==='panda8')r=ez&&isPanda8(coup)?26*a:0;
  else if(spot==='dragonP'||spot==='dragonB'){const x=dragonBonus(coup,spot==='dragonP'?'player':'banker');r=x<0?0:a*(x+1);}
  else if(spot==='lucky6')r=isLucky6(coup)?(coup.banker.length===2?13*a:21*a):0;
  else if(spot==='tie')r=coup.winner==='tie'?9*a:0;
  else if(spot==='playerPair')r=pair(coup.player)?12*a:0;
  else r=pair(coup.banker)?12*a:0;
  by[spot]=r;}
 return {returned:Object.values(by).reduce((x,y)=>x+(y??0),0),bySpot:by};
}
/** The dealer's call: "Player wins, eight over six." */
const WORDS=['zero','one','two','three','four','five','six','seven','eight','nine'];
export function call(c:Coup):string {
 if(c.winner==='tie')return `Tie, ${WORDS[c.playerTotal]} all.`;
 const [w,l]=c.winner==='player'?[c.playerTotal,c.bankerTotal]:[c.bankerTotal,c.playerTotal];
 return `${c.winner==='player'?'Player':'Banker'} wins, ${WORDS[w]} over ${WORDS[l]}${c.natural&&w>=8?' — a natural':''}.`;
}

/** Patch 100: the Big Road. A new column starts each time the winner changes; ties are marked on the last cell. A
 * column longer than six turns right along the bottom row (the "dragon tail"). */
export interface RoadCell {col:number;row:number;v:'P'|'B';ties:number}
export function bigRoad(results:readonly ('P'|'B'|'T')[]):RoadCell[] {
 const out:RoadCell[]=[],taken=new Set<string>();let col=-1,row=0,last:'P'|'B'|null=null,startCol=-1,lead=0,tail=false;
 for(const r of results){
  if(r==='T'){if(out.length)out[out.length-1].ties++;else lead++;continue;}
  if(r!==last){startCol++;col=startCol;row=0;last=r;tail=false;}
  else{const down=row+1;if(!tail&&down<6&&!taken.has(`${col}:${down}`))row=down;else{col++;tail=true;}}
  taken.add(`${col}:${row}`);out.push({col,row,v:r,ties:out.length===0?lead:0});
 }
 return out;
}

/* ---------- Patch 101: the derived roads ---------- */
/** The Big Road as columns (streaks), ties left out. */
export function streaks(results:readonly ('P'|'B'|'T')[]):number[] {
 const cols:number[]=[];let last:'P'|'B'|null=null;
 for(const r of results){if(r==='T')continue;if(r===last)cols[cols.length-1]++;else{cols.push(1);last=r;}}
 return cols;
}
/** One derived road: Big Eye Boy (k=1), Small Road (k=2) or Cockroach Pig (k=3). Each Big Road entry from the
 * starting cell on gets red (the road is orderly: "repeating") or blue (choppy):
 *  - a new column: red when the two columns before it, k apart, are the same length;
 *  - further down a column: red when the column k to the left has a cell at this row, or has neither this row nor
 *    the one above; blue when it stops exactly one row short. */
export function derivedRoad(results:readonly ('P'|'B'|'T')[],k:1|2|3):('R'|'B')[] {
 const out:('R'|'B')[]=[],len:number[]=[];let last:'P'|'B'|null=null;
 for(const r of results){
  if(r==='T')continue;
  if(r!==last){len.push(1);last=r;}else len[len.length-1]++;
  const c=len.length-1,row=len[c]-1;
  // Starts at column k, row 1, or column k+1, row 0.
  if(c<k||(c===k&&row<1))continue;
  if(row===0)out.push(len[c-1]===len[c-1-k]?'R':'B');
  else{const ref=len[c-k];out.push(ref>row?'R':ref===row?'B':'R');}
 }
 return out;
}
/** What each derived road would show next if the next hand is a Banker win or a Player win ("Banker ask", "Player ask"). */
export function ask(results:readonly ('P'|'B'|'T')[],next:'P'|'B'):(('R'|'B')|null)[] {
 return ([1,2,3] as const).map(k=>{const before=derivedRoad(results,k).length,after=derivedRoad([...results,next],k);return after.length>before?after[after.length-1]:null;});
}

/* ---------- Patch 102: a real shoe ---------- */
/** An eight-deck shoe that lasts from hand to hand. When it is fresh, the first card is turned over and that many
 * cards are burned (tens and pictures count 10). The cut card goes in 14 cards from the end: when a hand reaches it,
 * one more hand is dealt and then the shoe is shuffled. */
export interface Shoe {cards:Card[];next:number;cut:number;number:number;burned:Card[];
 /** The cut card has come out: one more hand, then a new shoe. */
 cutOut:boolean;
 /** That last hand has been dealt: shuffle before the next one. */
 last:boolean}
export const CUT_FROM_END=14;
export function newShoe(random:Random,number=1):Shoe {
 const cards=shoe(random),first=cards[0],v=pointOf(first)||10;
 return {cards,next:1+v,cut:cards.length-CUT_FROM_END,number,burned:cards.slice(0,1+v),cutOut:false,last:false};
}
/** Deal a coup from the shoe. Returns the coup and the shoe after it. */
export function dealShoe(s:Shoe):{coup:Coup;shoe:Shoe} {
 const coup=deal(s.cards.slice(s.next)),used=coup.player.length+coup.banker.length,next=s.next+used;
 return {coup,shoe:{...s,next,cutOut:s.cutOut||next>=s.cut,last:s.cutOut}};
}
/** Cards still in the shoe. */
export const cardsLeft=(s:Shoe)=>s.cards.length-s.next;
const CARD=/^[A2-9TJQK][shdc]$/;
export function checkShoe(v:unknown):Shoe {
 const s=v as Shoe;
 if(!s||typeof s!=='object'||!Array.isArray(s.cards)||s.cards.length!==52*DECKS||!s.cards.every(c=>typeof c==='string'&&CARD.test(c))||!Number.isSafeInteger(s.next)||s.next<1||s.next>s.cards.length-6||!Number.isSafeInteger(s.cut)||!Number.isSafeInteger(s.number)||s.number<1||typeof s.last!=='boolean'||typeof s.cutOut!=='boolean'||!Array.isArray(s.burned))throw new Error('Baccarat shoe is damaged.');
 return {...s,cards:[...s.cards],burned:[...s.burned]};
}
