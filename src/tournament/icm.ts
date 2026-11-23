/** Independent Chip Model (Malmuth–Harville) for final tables: each player's expected prize from
 * chip stacks and the remaining prizes, and the bubble factor of an all-in between two players.
 * Exact over all finishing orders for up to 10 players. A standard approximation, not a solver. */

function validate(stacks:readonly number[],prizes:readonly number[]):void {
 if(stacks.length>10)throw Error('ICM is limited to ten players');
 if(stacks.some(n=>!Number.isFinite(n)||n<0)||!Number.isFinite(stacks.reduce((a,b)=>a+b,0)))throw Error('Invalid ICM stacks');
 if(prizes.length>stacks.length||prizes.some((n,i)=>!Number.isFinite(n)||n<0||(i>0&&n>prizes[i-1])))throw Error('Invalid ICM prize schedule');
}

/** Expected prize for each player. `prizes[k]` is the prize for place k+1; missing places pay 0. */
export function icmEquities(stacks:readonly number[],prizes:readonly number[]):number[] {
 validate(stacks,prizes);const n=stacks.length;
 const memo=new Map<number,number[]>();
 const solve=(taken:number):number[]=>{
  const hit=memo.get(taken);if(hit)return hit;
  const place=bitCount(taken),out=Array(n).fill(0);
  if(place>=n){memo.set(taken,out);return out;}
  const prize=prizes[place]??0;let remaining=0;for(let i=0;i<n;i++)if(!(taken&1<<i))remaining+=stacks[i];
  for(let j=0;j<n;j++){
   if(taken&1<<j)continue;
   // Zero stacks finish below every live stack; among themselves, equally likely.
   const live=remaining>0,p=live?stacks[j]/remaining:1/(n-place);if(p===0)continue;
   out[j]+=p*prize;const rest=solve(taken|1<<j);for(let i=0;i<n;i++)out[i]+=p*rest[i];
  }
  memo.set(taken,out);return out;
 };
 return solve(0);
}
function bitCount(x:number):number {let c=0;while(x){x&=x-1;c++;}return c;}

/** Bubble factor for player `me` risking an all-in against `opponent`: prize equity lost by losing
 * divided by prize equity gained by winning (1 = chips and prizes worth the same). This
 * is a symmetric whole-effective-stack transfer, not the equity threshold for a real call
 * with blinds, antes, prior commitments, dead money or multiway side pots. */
export function icmBubbleFactor(stacks:readonly number[],prizes:readonly number[],me:number,opponent:number):number {
 validate(stacks,prizes);if(!Number.isInteger(me)||!Number.isInteger(opponent)||me<0||opponent<0||me>=stacks.length||opponent>=stacks.length||me===opponent)throw Error('Invalid ICM player identities');
 const risk=Math.min(stacks[me],stacks[opponent]);if(risk<=0)return 1;
 const now=icmEquities(stacks,prizes)[me];
 const win=[...stacks],lose=[...stacks];win[me]+=risk;win[opponent]-=risk;lose[me]-=risk;lose[opponent]+=risk;
 const gained=icmEquities(win,prizes)[me]-now,lost=now-icmEquities(lose,prizes)[me];
 return gained>0?Math.max(1,lost/gained):1;
}
