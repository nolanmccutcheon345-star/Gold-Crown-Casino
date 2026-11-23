/** Patch 90: slot machines. Virtual chips only, with their own balance. Every spin is pure chance: reel stops are drawn
 * with the browser's secure random numbers, nothing remembers past spins, and no choice you make changes the odds.
 * Each machine's payback percentage is measured in the tests over millions of spins and shown on the machine. */

export type Sym=string;
export type Random=(n:number)=>number;
export const secureRandom:Random=n=>{const a=new Uint32Array(1),limit=Math.floor(0x100000000/n)*n;let x;do{crypto.getRandomValues(a);x=a[0];}while(x>=limit);return x%n;};

export interface CoinSpec {sym:Sym;
 /** Coin values as multiples of the total bet, with weights. Strings are named jackpots. */
 values:{x:number;w:number;name?:string}[];
 /** Coins anywhere that start Hold & Spin. */
 trigger:number;
 /** Chance an empty cell lands a coin on each respin. */
 land:number;
 /** Paid when every cell holds a coin, as a multiple of the total bet. */
 grand:number;}
export interface WheelSpec {sym:Sym;reel:number;row:number;segments:{x:number;w:number}[]}
export interface ScatterSpec {sym:Sym;pays:Record<number,number>;freeSpins:Record<number,number>;freeMultiplier:number}
export interface Machine {
 id:string;name:string;tagline:string;kind:'classic'|'video'|'hold'|'wheel'|'ways'|'cascade'|'pick';
 /** Measured payback, percent, from the tests. */
 rtp:number;volatility:'low'|'medium'|'high';
 /** Patch 93, measured over a million spins in the tests: share of spins that pay anything, how often the feature
  * comes (null: no feature), the swing meter (1 calm to 5 wild) and the biggest win seen, in bets. */
 stats:{hitRate:number;featureEvery:number|null;swing:number;topSeen:number};
 rows:number;reels:Sym[][];lines:number[][];
 /** Line pays as multiples of the line bet, by symbol and count of a kind (index = count). */
 pays:Record<Sym,number[]>;
 wild?:Sym;scatter?:ScatterSpec;coin?:CoinSpec;wheel?:WheelSpec;
 /** Classic-machine extras: cherries pay anywhere on the line, and any three bars pay. */
 cherry?:{sym:Sym;pays:number[]};anyBar?:{syms:Sym[];pay:number};
 /** Patch 92: a classic wild that multiplies the line it helps (each wild multiplies again). */
 wildMultiplier?:number;
 /** Patch 92: ways machines pay any left-to-right run of adjacent reels; the bet buys `betUnit` units. */
 ways?:{betUnit:number;
  /** In free spins, each wild carries one of these multipliers; a way's wilds multiply together. */
  freeWild?:{x:number;w:number}[]};
 /** Patch 92: cascade machines draw each cell on its own, pay clusters anywhere, and tumble winners away. */
 cascade?:{weights:{sym:Sym;w:number}[];
  /** Count needed for each pay tier (pays[sym] index 0, 1, 2). */
  tiers:number[];bomb:{w:number;values:{x:number;w:number}[]}};
 /** Patch 92: pick bonus: three or more of the symbol open a board of chests; you pick `picks` of them. */
 pick?:{sym:Sym;trigger:number;picks:number;board:number;prizes:{x:number;w:number}[]};
 /** Total bets per spin, in cents. */
 bets:number[];
 symbols:Record<Sym,{label:string;art:string;tone:string}>;
 /** Patch 91: cabinet colours (top, bottom, glow) and a short marquee line. */
 theme:{top:string;bottom:string;glow:string;marquee:string};
}
export interface LineWin {line:number;sym:Sym;count:number;amount:number;cells:[number,number][]}
export interface HoldFrame {grid:(number|null)[][];respins:number}
export interface SpinResult {
 grid:Sym[][];wins:LineWin[];scatterWin:number;lineTotal:number;
 free?:{spins:SpinResult[];total:number};
 hold?:{frames:HoldFrame[];coins:{reel:number;row:number;x:number;name?:string}[];total:number;full:boolean};
 wheel?:{segment:number;x:number;amount:number};
 /** Patch 92: the tumbles of a cascade spin, and the bombs that multiplied it. */
 cascade?:{frames:{grid:Sym[][];hits:[number,number][];win:number}[];bombs:number[];multiplier:number};
 /** Patch 92: the pick bonus. `prizes` are what your picks reveal, in order; `others` are shown afterwards. */
 pick?:{prizes:number[];others:number[];amount:number};
 /** Patch 92: in ways free spins, each wild's multiplier (1 elsewhere). */
 wildMultipliers?:number[][];
 /** Everything this spin pays, bonuses included. */
 total:number;bet:number;
}

function stopGrid(m:Machine,random:Random):Sym[][] {
 return m.reels.map(strip=>{const stop=random(strip.length);return Array.from({length:m.rows},(_,r)=>strip[(stop+r)%strip.length]);});
}
function lineWins(m:Machine,grid:Sym[][],lineBet:number):LineWin[] {
 const out:LineWin[]=[];
 m.lines.forEach((rows,line)=>{
  const syms=rows.map((r,reel)=>grid[reel][r]);
  if(m.kind==='classic'||m.kind==='wheel'){
   // Three of a kind, any three bars, or cherries anywhere on the line.
   const cells=rows.map((r,reel)=>[reel,r] as [number,number]);
   const wilds=m.wild?syms.filter(s=>s===m.wild).length:0,others=syms.filter(s=>s!==m.wild),mult=(m.wildMultiplier??1)**wilds;
   if(!others.length&&m.wild){const pay=m.pays[m.wild]?.[3]??0;if(pay)out.push({line,sym:m.wild,count:3,amount:pay*lineBet,cells});return;}
   const pay=m.pays[others[0]]?.[3]??0;
   if(others.every(s=>s===others[0])&&pay){out.push({line,sym:others[0],count:3,amount:pay*lineBet*mult,cells});return;}
   if(m.anyBar&&others.every(s=>m.anyBar!.syms.includes(s))){out.push({line,sym:'anybar',count:3,amount:m.anyBar.pay*lineBet*mult,cells});return;}
   if(m.cherry){const n=others.filter(s=>s===m.cherry!.sym).length;if(n)out.push({line,sym:m.cherry.sym,count:n+wilds,amount:m.cherry.pays[Math.min(3,n+wilds)]*lineBet*mult,cells:cells.filter((_,i)=>syms[i]===m.cherry!.sym||syms[i]===m.wild)});}
   return;
  }
  const first=syms.find(s=>s!==m.wild)??m.wild!;
  if(first===m.scatter?.sym||first===m.coin?.sym)return;
  let n=0;while(n<syms.length&&(syms[n]===first||syms[n]===m.wild))n++;
  // A run of wilds can pay as wilds when that pays more.
  let w=0;while(w<syms.length&&syms[w]===m.wild)w++;
  const asFirst=(m.pays[first]?.[n]??0),asWild=m.wild?(m.pays[m.wild]?.[w]??0):0;
  const [sym,count,pay]=asWild>asFirst?[m.wild!,w,asWild]:[first,n,asFirst];
  if(pay>0)out.push({line,sym,count,amount:pay*lineBet,cells:rows.slice(0,count).map((r,reel)=>[reel,r])});
 });
 return out;
}
const countSym=(grid:Sym[][],sym:Sym)=>grid.reduce((a,col)=>a+col.filter(s=>s===sym).length,0);
function pickWeighted<T extends {w:number}>(list:readonly T[],random:Random):T {const total=list.reduce((a,x)=>a+x.w,0);let r=random(total);for(const x of list){if(r<x.w)return x;r-=x.w;}return list[list.length-1];}

/** Ways: every symbol that runs from the first reel across adjacent reels pays once per combination. `mult` gives each
 * cell's wild multiplier (1 for an ordinary wild). */
function waysWins(m:Machine,grid:Sym[][],unitBet:number,mult:(reel:number,row:number)=>number):LineWin[] {
 const out:LineWin[]=[],syms=Object.keys(m.pays).filter(s=>s!==m.wild);
 for(const sym of syms){
  const counts:number[]=[],cells:[number,number][]=[];
  for(let reel=0;reel<grid.length;reel++){let c=0;grid[reel].forEach((s,row)=>{if(s===sym||(s===m.wild&&reel>0)){c+=s===sym?1:mult(reel,row);cells.push([reel,row]);}});if(!c)break;counts.push(c);}
  const n=counts.length,pay=m.pays[sym]?.[n]??0;
  if(n>=3&&pay)out.push({line:-1,sym,count:n,amount:pay*unitBet*counts.reduce((a,b)=>a*b,1),cells:cells.filter(([r])=>r<n)});
 }
 return out;
}
const bombValue=(s:Sym)=>s.startsWith('bomb:')?Number(s.slice(5)):0;
/** A cascade spin: clusters pay, winners vanish, the rest fall, new cells drop in; bombs multiply the total. */
function cascadeSpin(m:Machine,bet:number,random:Random):SpinResult {
 const c=m.cascade!,rows=m.rows,cols=m.reels.length;
 const draw=():Sym=>{const total=c.weights.reduce((a,x)=>a+x.w,0)+c.bomb.w;let r=random(total);for(const x of c.weights){if(r<x.w)return x.sym;r-=x.w;}return `bomb:${pickWeighted(c.bomb.values,random).x}`;};
 let grid:Sym[][]=Array.from({length:cols},()=>Array.from({length:rows},draw));
 const frames:{grid:Sym[][];hits:[number,number][];win:number}[]=[];let total=0;
 for(let guard=0;guard<40;guard++){
  const counts=new Map<Sym,number>();grid.forEach(col=>col.forEach(s=>{if(!s.startsWith('bomb:')&&s!==m.scatter?.sym)counts.set(s,(counts.get(s)??0)+1);}));
  let win=0;const winners=new Set<Sym>();
  for(const [s,n] of counts){const tier=c.tiers.filter(t=>n>=t).length-1;if(tier>=0&&m.pays[s]?.[tier]){win+=Math.round(m.pays[s][tier]*bet);winners.add(s);}}
  const hits:[number,number][]=[];grid.forEach((col,reel)=>col.forEach((s,row)=>{if(winners.has(s))hits.push([reel,row]);}));
  frames.push({grid:grid.map(col=>[...col]),hits,win});
  if(!win)break;total+=win;
  grid=grid.map(col=>{const keep=col.filter(s=>!winners.has(s));return [...Array.from({length:rows-keep.length},draw),...keep];});
 }
 const bombs=total>0?grid.flat().map(bombValue).filter(x=>x>0):[],multiplier=bombs.length?bombs.reduce((a,b)=>a+b,0):1;
 const lineTotal=total*multiplier;
 let scatterWin=0;if(m.scatter){const n=countSym(frames[0].grid,m.scatter.sym);scatterWin=Math.round((m.scatter.pays[Math.min(n,6)]??0)*bet);}
 return {grid:frames[0].grid,wins:[],scatterWin,lineTotal,total:lineTotal+scatterWin,bet,cascade:{frames,bombs,multiplier}};
}
function baseSpin(m:Machine,bet:number,random:Random,multiplier=1,free=false):SpinResult {
 if(m.cascade)return cascadeSpin(m,bet,random);
 if(m.ways){
  const grid=stopGrid(m,random),fw=free?m.ways.freeWild:undefined,mults=grid.map(col=>col.map(s=>s===m.wild&&fw?pickWeighted(fw,random).x:1));
  const wins=waysWins(m,grid,bet/m.ways.betUnit,(r,c)=>mults[r][c]).map(w=>({...w,amount:Math.round(w.amount*multiplier)}));
  const lineTotal=wins.reduce((a,w)=>a+w.amount,0);let scatterWin=0;
  if(m.scatter){const n=countSym(grid,m.scatter.sym);scatterWin=Math.round((m.scatter.pays[Math.min(n,5)]??0)*bet*multiplier);}
  return {grid,wins,scatterWin,lineTotal,total:lineTotal+scatterWin,bet,...(fw?{wildMultipliers:mults}:{})};
 }
 const grid=stopGrid(m,random),lineBet=bet/m.lines.length,wins=lineWins(m,grid,lineBet).map(w=>({...w,amount:Math.round(w.amount*multiplier)}));
 const lineTotal=wins.reduce((a,w)=>a+w.amount,0);
 let scatterWin=0;
 if(m.scatter){const n=countSym(grid,m.scatter.sym);scatterWin=Math.round((m.scatter.pays[Math.min(n,5)]??0)*bet*multiplier);}
 return {grid,wins,scatterWin,lineTotal,total:lineTotal+scatterWin,bet};
}
/** One paid spin, with any feature it triggers played out in full. `bet` is the total bet in cents. */
export function spin(m:Machine,bet:number,random:Random=secureRandom):SpinResult {
 const r=baseSpin(m,bet,random);
 // Free spins: wins multiplied; more scatters add spins (up to 50 in all).
 if(m.scatter){
  let left=m.scatter.freeSpins[Math.min(countSym(r.grid,m.scatter.sym),m.cascade?6:5)]??0;
  if(left){const spins:SpinResult[]=[];let played=0;
   while(left>0&&played<50){left--;played++;const f=baseSpin(m,bet,random,m.scatter.freeMultiplier,true);spins.push(f);left+=m.scatter.freeSpins[Math.min(countSym(f.grid,m.scatter.sym),m.cascade?6:5)]??0;}
   const total=spins.reduce((a,s)=>a+s.total,0);r.free={spins,total};r.total+=total;}
 }
 // Hold & Spin: coins stick, three respins, every new coin resets them to three.
 if(m.coin&&countSym(r.grid,m.coin.sym)>=m.coin.trigger){
  const c=m.coin,cells:(number|null)[][]=r.grid.map(col=>col.map(()=>null)),coins:{reel:number;row:number;x:number;name?:string}[]=[];
  const land=(reel:number,row:number)=>{const v=pickWeighted(c.values,random);cells[reel][row]=v.x;coins.push({reel,row,x:v.x,...(v.name?{name:v.name}:{})});};
  r.grid.forEach((col,reel)=>col.forEach((s,row)=>{if(s===c.sym)land(reel,row);}));
  const frames:HoldFrame[]=[{grid:cells.map(col=>[...col]),respins:3}];let respins=3;
  const size=m.reels.length*m.rows;
  while(respins>0&&coins.length<size){
   let hit=false;
   for(let reel=0;reel<cells.length;reel++)for(let row=0;row<m.rows;row++)if(cells[reel][row]===null&&random(1000)<c.land*1000){land(reel,row);hit=true;}
   respins=hit?3:respins-1;frames.push({grid:cells.map(col=>[...col]),respins});
  }
  const full=coins.length===size,total=Math.round((coins.reduce((a,x)=>a+x.x,0)+(full?c.grand:0))*bet);
  r.hold={frames,coins,total,full};r.total+=total;
 }
 // The wheel: its symbol on the centre of the last reel spins the bonus wheel.
 if(m.wheel&&r.grid[m.wheel.reel][m.wheel.row]===m.wheel.sym){
  const seg=pickWeighted(m.wheel.segments,random),segment=m.wheel.segments.indexOf(seg),amount=Math.round(seg.x*bet);
  r.wheel={segment,x:seg.x,amount};r.total+=amount;
 }
 // Pick bonus: the prizes behind your picks are drawn now; the chests you tap only reveal them.
 if(m.pick&&countSym(r.grid,m.pick.sym)>=m.pick.trigger){
  const prizes=Array.from({length:m.pick.picks},()=>pickWeighted(m.pick!.prizes,random).x),others=Array.from({length:m.pick.board-m.pick.picks},()=>pickWeighted(m.pick!.prizes,random).x);
  const amount=Math.round(prizes.reduce((a,b)=>a+b,0)*bet);r.pick={prizes,others,amount};r.total+=amount;
 }
 return r;
}
