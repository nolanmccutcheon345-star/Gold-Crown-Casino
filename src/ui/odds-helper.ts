/** Patch 103: the odds helper for Hold'em. It reads only your own two cards, the board and the price of a call, and
 * counts exactly. "Improves" means your best hand moves up a category (a pair to two pair, a draw to a flush…) in a
 * way your own cards are part of: a pair landing on the board, which helps everyone, does not count. Display only:
 * nothing here reaches the engine or the bots. */
import type {Card} from '../contracts';
import {evaluate,handLabel} from '../core/evaluator';

const RANKS='23456789TJQKA',SUITS='cdhs';
export const ODDS_HELPER_KEY='poker-night-ai:odds-helper';
const CATEGORY=['High card','Pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
const MAKES=['','a pair','two pair','three of a kind','a straight','a flush','a full house','four of a kind','a straight flush'];

/** The category of the board on its own (3 to 5 cards). Under five cards it cannot hold a straight or flush. */
export function boardCategory(board:readonly Card[]):number {
 if(board.length>=5)return evaluate([...board])[0];
 const counts=[...new Map([...board].map(c=>[c[0],0] as [string,number])).keys()].map(r=>board.filter(c=>c[0]===r).length).sort((a,b)=>b-a);
 return counts[0]===4?7:counts[0]===3&&counts[1]===2?6:counts[0]===3?3:counts[0]===2&&counts[1]===2?2:counts[0]===2?1:0;
}
const category=(hole:readonly Card[],board:readonly Card[])=>evaluate([...hole,...board])[0];
/** Does this board leave you a better category, one your cards are part of? Pairs and two pair made only by the board
 * pairing (none of the new cards matching your cards) do not count: they help everyone. */
const better=(hole:readonly Card[],board:readonly Card[],now:number,fresh:readonly Card[])=>{const c=category(hole,board);if(c<=now||c<=boardCategory(board))return 0;if(c<=2&&!fresh.some(f=>hole.some(h=>h[0]===f[0])))return 0;return c;};

export interface OddsHelp {
 /** Your best hand now ("Pair of eights"), or null preflop. */
 hand:string|null;
 /** Cards left unseen by you, and how many of them improve you on the next card, by what they make. */
 unseen:number;outs:number;byMake:{make:string;cards:number}[];
 /** Chance of improving on the next card, and (on the flop) by the river. */
 next:number|null;river:number|null;
 /** When you face a bet: what you put in, what you can win, and the share of the time a call must win to break even. */
 price:{call:number;win:number;need:number}|null;
}
const memo=new Map<string,OddsHelp|null>();
/** Cached: the table redraws often, and the counting only changes when the cards or the price do. */
export function oddsHelp(hole:readonly Card[],board:readonly Card[],callAmount:number,pot:number):OddsHelp|null {
 const k=`${hole.join('')}|${board.join('')}|${callAmount}|${pot}`;if(memo.has(k))return memo.get(k)!;
 const v=countOdds(hole,board,callAmount,pot);if(memo.size>40)memo.clear();memo.set(k,v);return v;
}
function countOdds(hole:readonly Card[],board:readonly Card[],callAmount:number,pot:number):OddsHelp|null {
 if(hole.length!==2||board.length>5||new Set([...hole,...board]).size!==hole.length+board.length)return null;
 const price=callAmount>0?{call:callAmount,win:pot,need:callAmount/(pot+callAmount)}:null;
 if(board.length<3)return {hand:null,unseen:50,outs:0,byMake:[],next:null,river:null,price};
 const seen=new Set([...hole,...board]),deck:Card[]=[];for(const r of RANKS)for(const s of SUITS){const c=(r+s) as Card;if(!seen.has(c))deck.push(c);}
 const rank=evaluate([...hole,...board]),now=rank[0];
 if(board.length===5)return {hand:handLabel(rank),unseen:deck.length,outs:0,byMake:[],next:null,river:null,price};
 const makes=new Map<number,number>();let outs=0;
 for(const c of deck){const b=better(hole,[...board,c],now,[c]);if(b){outs++;makes.set(b,(makes.get(b)??0)+1);}}
 let river:number|null=null;
 if(board.length===3){let hit=0,all=0;
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){all++;if(better(hole,[...board,deck[i],deck[j]],now,[deck[i],deck[j]]))hit++;}
  river=hit/all;}
 return {hand:handLabel(rank),unseen:deck.length,outs,byMake:[...makes].sort((a,b)=>b[1]-a[1]||b[0]-a[0]).map(([k,n])=>({make:MAKES[k],cards:n})),next:outs/deck.length,river,price};
}
const pct=(x:number)=>`${(100*x).toFixed(x<.1?1:0)}%`;
/** The helper as a small panel. `money` formats an amount the way this table shows it (dollars or chips). */
export function oddsHelperMarkup(help:OddsHelp|null,money:(n:number)=>string):string {
 if(!help)return '';
 const lines:string[]=[];
 if(help.hand)lines.push(`<p><b>You have:</b> ${help.hand}</p>`);
 if(help.next!==null){
  lines.push(help.outs?`<p><b>${help.outs} of ${help.unseen}</b> unseen cards improve you on the next card (<b>${pct(help.next)}</b>)${help.byMake.length?`: ${help.byMake.map(m=>`${m.cards} make ${m.make}`).join(', ')}`:''}.</p>`:'<p>No single card improves your hand now.</p>');
  if(help.river!==null)lines.push(`<p>Chance to improve by the river: <b>${pct(help.river)}</b>.</p>`);
 }
 if(help.price)lines.push(`<p><b>Pot odds:</b> call ${money(help.price.call)} to win ${money(help.price.win)}. A call breaks even if you win <b>${pct(help.price.need)}</b> of the time.</p>`);
 if(!lines.length)lines.push('<p>Nothing to price yet: no bet to call and no board.</p>');
 return `<div class="odds-helper" data-testid="odds-helper" role="note">${lines.join('')}<small>Counts use only your cards and the board. Improving is not the same as winning: an opponent can still have you beaten.</small></div>`;
}
export const CATEGORY_NAMES=CATEGORY;
