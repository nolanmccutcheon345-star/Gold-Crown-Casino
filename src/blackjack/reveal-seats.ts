/** Reconstruct only the recorded movement of other seats' cards. No decisions, wagers or
 * settlement are made here. A split changes card grouping at the next visible draw, instead
 * of displaying the final split hands during the opening deal. Physical IDs disambiguate
 * identical faces in a multi-deck shoe. This helper never returns unseen cards. */
import type {BlackjackRound, ShoeCard} from './engine';

export function seatRevealLayouts(round: BlackjackRound, dealt: readonly ShoeCard[]): Map<ShoeCard, ShoeCard[][]> {
 const layouts=new Map<ShoeCard,ShoeCard[][]>();
 for(const seat of round.others??[]){
  const owned=new Set(seat.hands.flatMap(h=>h.cards)), cards=dealt.filter(card=>owned.has(card));
  if(cards.length<2)throw new Error('Recorded seat has no opening pair');
  const hands:ShoeCard[][]=[[]];let cursor=0;
  const draw=(index:number)=>{
   const card=cards[cursor++];if(!card)throw new Error('Recorded seat draw is missing');
   hands[index].push(card);layouts.set(card,hands.map(h=>[...h]));
  };
  draw(0);draw(0);
  let next=0;
  for(let index=0;index<hands.length;){
   // A split hand receives its second card automatically, including split aces.
   if(hands[index].length===1)draw(index);
   const action=seat.plays[next];
   if(!action||action.hand!==index){index++;continue;}
   next++;
   if(action.play==='split'){
    const pair=hands[index];if(pair.length!==2)throw new Error('Recorded split needs two cards');
    hands.splice(index,1,[pair[0]],[pair[1]]);
   }else if(action.play==='hit')draw(index);
   else if(action.play==='double'){draw(index);index++;}
   else if(action.play==='stand'||action.play==='surrender')index++;
   else throw new Error('Unexpected recorded seat action');
  }
  if(cursor!==cards.length||next!==seat.plays.length||JSON.stringify(hands)!==JSON.stringify(seat.hands.map(h=>h.cards)))throw new Error('Recorded seat reveal does not match its cards');
 }
 return layouts;
}
