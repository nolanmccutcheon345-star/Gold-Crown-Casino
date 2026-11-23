/** Patch 103: how the dealer's hand finishes from the card showing, counted exactly for an infinite shoe (each card
 * value 1/13, tens 4/13). When the dealer has already checked for blackjack (an ace or ten showing and play goes
 * on), the hole card cannot complete one. Display only: it never changes a deal. */
export interface DealerOdds {bust:number;final:Record<17|18|19|20|21,number>}
const P=(v:number)=>v===10?4/13:1/13;
function play(total:number,soft:boolean,h17:boolean,memo:Map<string,DealerOdds>):DealerOdds {
 const k=`${total}|${soft}`,known=memo.get(k);if(known)return known;
 let out:DealerOdds;
 if(total>21)out={bust:1,final:{17:0,18:0,19:0,20:0,21:0}};
 else if(total>=18||(total===17&&!(soft&&h17)))out={bust:0,final:{17:0,18:0,19:0,20:0,21:0,[total]:1} as DealerOdds['final']};
 else{out={bust:0,final:{17:0,18:0,19:0,20:0,21:0}};
  for(let v=1;v<=10;v++){let t=total+v,s=soft;if(v===1&&t+10<=21){t+=10;s=true;}if(t>21&&s){t-=10;s=false;}
   const r=play(t,s,h17,memo),p=P(v);out.bust+=p*r.bust;for(const f of [17,18,19,20,21] as const)out.final[f]+=p*r.final[f];}}
 memo.set(k,out);return out;
}
/** `up`: 1 for an ace, 10 for any ten. `peeked`: the dealer checked and has no blackjack. */
export function dealerOdds(up:number,h17:boolean,peeked=true):DealerOdds {
 const memo=new Map<string,DealerOdds>(),out:DealerOdds={bust:0,final:{17:0,18:0,19:0,20:0,21:0}};
 const ruled=(v:number)=>peeked&&((up===1&&v===10)||(up===10&&v===1));
 const norm=Array.from({length:10},(_,i)=>i+1).filter(v=>!ruled(v)).reduce((a,v)=>a+P(v),0);
 for(let v=1;v<=10;v++){if(ruled(v))continue;
  let t=up+v,s=false;if((up===1||v===1)&&t+10<=21){t+=10;s=true;}
  const r=play(t,s,h17,memo),p=P(v)/norm;out.bust+=p*r.bust;for(const f of [17,18,19,20,21] as const)out.final[f]+=p*r.final[f];}
 return out;
}
