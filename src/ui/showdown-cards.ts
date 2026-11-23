/** Patch 58: the five cards that won at showdown, and the chips in the pot pile. Public, revealed cards only. */
import type {Card,HeroViewModel} from '../contracts';
import {compareRanks,evaluate} from '../core/evaluator';

/** The best five of the given cards (5–7), as the evaluator ranks them. */
export function bestFive(cards:readonly Card[]):Card[] {
 if(cards.length<5)return [];
 let best:Card[]=[],rank:number[]=[];
 const n=cards.length;
 for(let a=0;a<n-4;a++)for(let b=a+1;b<n-3;b++)for(let c=b+1;c<n-2;c++)for(let d=c+1;d<n-1;d++)for(let e=d+1;e<n;e++){
  const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]],r=evaluate(hand);
  if(!best.length||compareRanks(r,rank)>0){best=hand;rank=r;}
 }
 return best;
}
/**
 * The cards to light up after a showdown: each paid winner's best five revealed cards. A side-pot winner
 * may hold a weaker hand than the main-pot winner, so do not filter by one global hand rank.
 * Nothing for hands won without a showdown or before the river; hidden cards are never read.
 */
export function winningCards(view:HeroViewModel|null|undefined):Set<Card> {
 const out=new Set<Card>();
 if(!view||view.street!=='complete'||view.board.length<5)return out;
 const shown=view.seats.filter(seat=>view.handLabels[seat.id]!==undefined&&(view.payouts[seat.id]??0)>0&&seat.hole.length===2);
 for(const seat of shown)for(const c of bestFive([...seat.hole,...view.board]))out.add(c);
 return out;
}

/** The pot as up to four stacks of up to five chips, largest denominations first. */
export function potPile(amount:number,bigBlind:number):string[][] {
 if(amount<=0||bigBlind<=0)return [];
 const denoms:[number,string][]=[[100,'black'],[25,'green'],[5,'red'],[1,'white']];
 const chips:string[]=[];let left=amount/bigBlind;
 for(const [size,color] of denoms)while(left>=size-1e-9&&chips.length<20){chips.push(color);left-=size;}
 if(!chips.length)chips.push('blue');
 const stacks:string[][]=[];
 for(let i=0;i<chips.length;i+=5)stacks.push(chips.slice(i,i+5));
 return stacks;
}
