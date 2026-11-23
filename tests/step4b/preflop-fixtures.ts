import type { Card, GameState } from '../../src/contracts';
import { startHand } from '../../src/core/engine';
import { practiceProfile, rig } from '../verification/helpers';
import { step } from '../step4a/scenarios';

export type FirstInPosition='early'|'middle'|'cutoff'|'button'|'small-blind';
const target:Record<FirstInPosition,number>={early:3,middle:4,cutoff:5,button:0,'small-blind':1};
export function firstIn(own:Card[],position:FirstInPosition='early',stackBB=100):GameState{
 const board=['2c','6h','8d','Ts','3c'].filter(c=>!own.includes(c));
 const available=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!own.includes(c));
 while(board.length<5)board.push(available.find(c=>!board.includes(c))!);
 const remainder=available.filter(c=>!board.includes(c));const actor=target[position];
 const holes=Array.from({length:6},(_,seat)=>seat===actor?[...own]:remainder.splice(0,2));
 let state=rig(startHand({handId:`step4b:first-in:${own.join('')}:${position}:${stackBB}`,seats:Array.from({length:6},(_,id)=>({id,name:`Seat${id}`,stack:stackBB*200})),button:0,profile:practiceProfile()}),holes,board);
 while(state.actor!==actor)state=step(state,{type:'fold'});
 return state;
}
export interface HandClass {label:string;combos:Card[][];weight:number;}
export function allHandClasses():HandClass[]{
 const ranks='23456789TJQKA',deck=[...ranks].flatMap(r=>[...'cdhs'].map(s=>r+s));const classes=new Map<string,Card[][]>();
 for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++){
  const cards=[deck[a],deck[b]].sort((x,y)=>ranks.indexOf(y[0])-ranks.indexOf(x[0]));
  const label=cards[0][0]+cards[1][0]+(cards[0][0]===cards[1][0]?'':cards[0][1]===cards[1][1]?'s':'o');
  const combos=classes.get(label)??[];combos.push(cards);classes.set(label,combos);
 }
 return [...classes].map(([label,combos])=>({label,combos,weight:combos.length}));
}
