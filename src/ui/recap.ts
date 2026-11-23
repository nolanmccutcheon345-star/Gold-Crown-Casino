/** Patch 57: session recap, all-in spotlight and stack trends. Reads saved hands and public table state only. */
import type {HeroViewModel} from '../contracts';
import type {AppData,StoredHand} from '../session/types';

export interface RecapHand {id:string;number:number;net:number;label:string}
export interface Rival {name:string;net:number}
export interface SessionRecap {
 hands:number;won:number;showdowns:number;showdownsWon:number;
 biggestWin:RecapHand|null;biggestLoss:RecapHand|null;keyHands:RecapHand[];
 /** Hero's chips won from (positive) or lost to (negative) each opponent, largest first. */
 rivals:Rival[];
 /** Running result after each hand, for the sparkline. */
 curve:number[];
}

const label=(hand:StoredHand):string=>{
 const own=hand.view.handLabels[0];
 if(own)return own;
 const hero=hand.view.seats.find(seat=>seat.id===0);
 if(hero?.folded)return hand.view.street==='complete'&&hand.view.board.length===0?'Folded preflop':'Folded';
 return 'Won without a showdown';
};
const brief=(hand:StoredHand):RecapHand=>({id:hand.id,number:hand.number,net:hand.net,label:label(hand)});

/**
 * Splits Hero's result in each hand across opponents in proportion to their part of it: in a hand Hero won, the
 * opponents whose stacks went down; in a hand Hero lost, the opponents who were paid.
 */
export function rivalsOf(hands:readonly StoredHand[]):Rival[] {
 const totals=new Map<string,number>();
 for(const hand of hands){
  if(!hand.net)continue;
  const others=hand.view.seats.filter(seat=>seat.id!==0);
  const weights=hand.net>0
   ?others.map(seat=>({name:seat.name,w:Math.max(0,seat.startingStack-seat.stack)}))
   :others.map(seat=>({name:seat.name,w:hand.view.payouts[seat.id]??0}));
  const sum=weights.reduce((a,b)=>a+b.w,0);
  if(!sum)continue;
  for(const {name,w} of weights)if(w)totals.set(name,(totals.get(name)??0)+hand.net*w/sum);
 }
 return [...totals].map(([name,net])=>({name,net:Math.round(net/100)*100})).filter(rival=>rival.net!==0).sort((a,b)=>Math.abs(b.net)-Math.abs(a.net));
}

export function sessionRecap(data:AppData,sessionId:string):SessionRecap|null {
 const hands=data.hands.filter(hand=>hand.sessionId===sessionId).sort((a,b)=>a.number-b.number);
 if(!hands.length)return null;
 const shown=hands.filter(hand=>hand.view.handLabels[0]!==undefined);
 const wins=hands.filter(hand=>hand.net>0),losses=hands.filter(hand=>hand.net<0);
 const best=wins.reduce<StoredHand|null>((a,b)=>!a||b.net>a.net?b:a,null),worst=losses.reduce<StoredHand|null>((a,b)=>!a||b.net<a.net?b:a,null);
 let running=0;
 return {
  hands:hands.length,won:hands.filter(hand=>(hand.view.payouts[0]??0)>0).length,
  showdowns:shown.length,showdownsWon:shown.filter(hand=>(hand.view.payouts[0]??0)>0).length,
  biggestWin:best?brief(best):null,biggestLoss:worst?brief(worst):null,
  keyHands:[...hands].sort((a,b)=>Math.abs(b.net)-Math.abs(a.net)).filter(hand=>hand.net!==0).slice(0,3).map(brief),
  rivals:rivalsOf(hands).slice(0,3),
  curve:[0,...hands.map(hand=>running+=hand.net)],
 };
}

/** A tiny line for the recap, 120×28. */
export function sparkline(values:readonly number[]):string {
 if(values.length<2)return '';
 const lo=Math.min(...values,0),hi=Math.max(...values,0),span=hi-lo||1;
 const X=(i:number)=>(i/(values.length-1)*118+1).toFixed(1),Y=(v:number)=>(27-(v-lo)/span*26).toFixed(1);
 return `<svg class="recap-spark" viewBox="0 0 120 28" aria-hidden="true"><line x1="1" x2="119" y1="${Y(0)}" y2="${Y(0)}" class="spark-zero"/><polyline points="${values.map((v,i)=>`${X(i)},${Y(v)}`).join(' ')}" class="spark-line"/></svg>`;
}

/** All-in and called: two or more players still in, at least one all-in, and no decisions left (or the hand just ended). */
export function allInSpotlight(view:HeroViewModel|null|undefined):boolean {
 if(!view)return false;
 const live=view.seats.filter(seat=>!seat.folded&&(seat.totalCommitted>0||seat.allIn));
 if(live.length<2||!live.some(seat=>seat.allIn))return false;
 return view.street==='complete'||view.actor===null;
}

/** Each seat's stack at the first saved hand this session in which the same player sat there. */
export function stackBaselines(data:AppData,sessionId:string):Map<string,number> {
 const base=new Map<string,number>();
 for(const hand of data.hands.filter(item=>item.sessionId===sessionId).sort((a,b)=>a.number-b.number))
  for(const seat of hand.view.seats){const key=`${seat.id}:${seat.name}`;if(!base.has(key))base.set(key,seat.startingStack);}
 return base;
}
/** Up or down once a stack has moved at least ten big blinds from its baseline. */
export function stackTrend(stack:number,baseline:number|undefined,bigBlind:number):'up'|'down'|'' {
 if(baseline===undefined||bigBlind<=0)return '';
 const moved=(stack-baseline)/bigBlind;
 return moved>=10?'up':moved<=-10?'down':'';
}
