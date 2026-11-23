/** Patch 99: roulette. European (single zero, 37 pockets) and American (double zero, 38 pockets) wheels, with the
 * standard inside and outside bets and the standard payouts. The house edge is the zero: 1/37 = 2.70% on every bet
 * in Europe, 2/38 = 5.26% in America (7.89% on the top line 0-00-1-2-3, as in a real casino). */
import type {Random} from './wallet';

export type Wheel='european'|'american';
/** Pockets in wheel order. 37 stands for 00. */
export const ORDER:Record<Wheel,readonly number[]>={
 european:[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
 american:[0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2],
};
export const DOUBLE_ZERO=37;
export const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const colourOf=(n:number):'red'|'black'|'green'=>n===0||n===DOUBLE_ZERO?'green':REDS.has(n)?'red':'black';
export const label=(n:number)=>n===DOUBLE_ZERO?'00':String(n);

export type BetKind='straight'|'split'|'street'|'corner'|'line'|'basket'|'dozen'|'column'|'red'|'black'|'odd'|'even'|'low'|'high';
export interface RouletteBet {kind:BetKind;numbers:readonly number[];amount:number}
/** Pays to one, by kind. */
export const PAYS:Record<BetKind,number>={straight:35,split:17,street:11,corner:8,line:5,basket:6,dozen:2,column:2,red:1,black:1,odd:1,even:1,low:1,high:1};
const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
/** The numbers an outside bet covers. */
export function outside(kind:BetKind,which=0):number[] {
 switch(kind){
  case 'dozen':return range(12*which+1,12*which+12);
  case 'column':return range(1,36).filter(n=>(n-1)%3===which);
  case 'red':return range(1,36).filter(n=>REDS.has(n));
  case 'black':return range(1,36).filter(n=>!REDS.has(n));
  case 'odd':return range(1,36).filter(n=>n%2===1);
  case 'even':return range(1,36).filter(n=>n%2===0);
  case 'low':return range(1,18);
  case 'high':return range(19,36);
  default:throw new Error('Not an outside bet.');
 }
}
/** Is this a bet a real layout allows? Inside bets must be adjacent on the layout (three columns, twelve rows). */
export function validBet(bet:RouletteBet,wheel:Wheel):boolean {
 const ns=[...bet.numbers].sort((a,b)=>a-b),n=ns.length,ok=(x:number)=>Number.isInteger(x)&&x>=0&&(x<=36||(x===DOUBLE_ZERO&&wheel==='american'));
 if(!Number.isSafeInteger(bet.amount)||bet.amount<=0||!ns.every(ok)||new Set(ns).size!==n)return false;
 const col=(x:number)=>(x-1)%3,row=(x:number)=>Math.floor((x-1)/3);
 switch(bet.kind){
  case 'straight':return n===1;
  case 'split':{if(n!==2)return false;const [a,b]=ns;
   if(a===0||b===DOUBLE_ZERO){// splits with the zeros: 0-1, 0-2, 0-3 in Europe; 0-1, 0-2, 0-00, 00-2, 00-3 in America
    if(wheel==='european')return a===0&&[1,2,3].includes(b);
    return a===0?[1,2,DOUBLE_ZERO].includes(b):[2,3].includes(a);}
   return (b-a===3)||(b-a===1&&col(a)<2);}
  case 'street':{if(n!==3)return false;const key=ns.join();
   if(ns[0]===0||ns[2]===DOUBLE_ZERO)return wheel==='european'?['0,1,2','0,2,3'].includes(key):['0,1,2',`0,2,${DOUBLE_ZERO}`,`2,3,${DOUBLE_ZERO}`].includes(key);
   return col(ns[0])===0&&ns[1]===ns[0]+1&&ns[2]===ns[0]+2;}
  case 'corner':{if(n!==4)return false;if(ns[0]===0)return wheel==='european'&&ns.join()==='0,1,2,3';const a=ns[0];return col(a)<2&&row(a)<11&&ns.join()===[a,a+1,a+3,a+4].join();}
  case 'line':{if(n!==6)return false;const a=ns[0];return col(a)===0&&row(a)<11&&ns.join()===range(a,a+5).join();}
  case 'basket':return wheel==='american'&&ns.join()===[0,1,2,3,DOUBLE_ZERO].join();
  default:{const which=bet.kind==='dozen'||bet.kind==='column'?[0,1,2].find(w=>outside(bet.kind,w).join()===ns.join()):0;return which!==undefined&&outside(bet.kind,which).join()===ns.join();}
 }
}
export interface SpinOutcome {pocket:number;wagered:number;returned:number;wins:{bet:RouletteBet;paid:number}[]}
/** Resolve bets against a pocket: a winning bet returns its stake and the payout. */
export const EVEN_MONEY:readonly BetKind[]=['red','black','odd','even','low','high'];
/** `partage`: Patch 101's La Partage rule on the single-zero wheel: when zero comes up, even-money bets get half
 * their stake back (rounded down to the cent). That halves their house edge to 1.35%. */
export function resolve(bets:readonly RouletteBet[],pocket:number,partage=false):SpinOutcome {
 const wins=bets.flatMap(b=>b.numbers.includes(pocket)?[{bet:b,paid:b.amount*(PAYS[b.kind]+1)}]:partage&&pocket===0&&EVEN_MONEY.includes(b.kind)?[{bet:b,paid:Math.floor(b.amount/2)}]:[]);
 return {pocket,wagered:bets.reduce((a,b)=>a+b.amount,0),returned:wins.reduce((a,w)=>a+w.paid,0),wins};
}
export function spinWheel(wheel:Wheel,random:Random):number {const o=ORDER[wheel];return o[random(o.length)];}
/** The dealer's call for a pocket: "17 black, odd, low." */
export function call(pocket:number):string {
 if(pocket===0||pocket===DOUBLE_ZERO)return `${label(pocket)} green.`;
 return `${pocket} ${colourOf(pocket)}, ${pocket%2?'odd':'even'}, ${pocket<=18?'low':'high'}.`;
}

/* ---------- Patch 100: the French racetrack (single-zero wheel) ---------- */
export type Announced='voisins'|'tiers'|'orphelins'|'zero';
export const ANNOUNCED:Record<Announced,{name:string;units:number;pieces:{kind:BetKind;numbers:number[];units:number}[]}>={
 voisins:{name:'Voisins du Zéro',units:9,pieces:[{kind:'street',numbers:[0,2,3],units:2},{kind:'split',numbers:[4,7],units:1},{kind:'split',numbers:[12,15],units:1},{kind:'split',numbers:[18,21],units:1},{kind:'split',numbers:[19,22],units:1},{kind:'split',numbers:[32,35],units:1},{kind:'corner',numbers:[25,26,28,29],units:2}]},
 tiers:{name:'Tiers du Cylindre',units:6,pieces:[[5,8],[10,11],[13,16],[23,24],[27,30],[33,36]].map(n=>({kind:'split' as BetKind,numbers:n,units:1}))},
 orphelins:{name:'Orphelins',units:5,pieces:[{kind:'straight',numbers:[1],units:1},{kind:'split',numbers:[6,9],units:1},{kind:'split',numbers:[14,17],units:1},{kind:'split',numbers:[17,20],units:1},{kind:'split',numbers:[31,34],units:1}]},
 zero:{name:'Jeu Zéro',units:4,pieces:[{kind:'split',numbers:[0,3],units:1},{kind:'split',numbers:[12,15],units:1},{kind:'straight',numbers:[26],units:1},{kind:'split',numbers:[32,35],units:1}]},
};
/** The bets that make up an announced bet, one unit = `unit` cents. */
export function announcedBets(which:Announced,unit:number):RouletteBet[] {
 return ANNOUNCED[which].pieces.map(p=>({kind:p.kind,numbers:p.numbers,amount:p.units*unit}));
}
/** A number and its `n` neighbours either side on the wheel, as straight-up bets. */
export function neighbours(number:number,wheel:Wheel,n=2,unit=100):RouletteBet[] {
 const o=ORDER[wheel],i=o.indexOf(number);if(i<0)throw new Error('No such number on this wheel.');
 return Array.from({length:2*n+1},(_,k)=>o[(i-n+k+o.length)%o.length]).map(x=>({kind:'straight' as BetKind,numbers:[x],amount:unit}));
}
/** Which section of the wheel a number is in, for the racetrack. */
export function sectionOf(n:number):Announced {
 const cover=(a:Announced)=>ANNOUNCED[a].pieces.some(p=>p.numbers.includes(n));
 return cover('voisins')?'voisins':cover('tiers')?'tiers':'orphelins';
}
/** Hot and cold numbers and the splits, from recent spins. */
export function stats(spins:readonly number[]):{hot:number[];cold:number[];red:number;black:number;zero:number;odd:number;even:number;dozens:[number,number,number];n:number} {
 const count=new Map<number,number>();for(const s of spins)count.set(s,(count.get(s)??0)+1);
 const nums=Array.from({length:37},(_,i)=>i);
 const hot=[...nums].filter(n=>count.get(n)).sort((a,b)=>(count.get(b)??0)-(count.get(a)??0)||a-b).slice(0,5);
 const cold=[...nums].sort((a,b)=>(count.get(a)??0)-(count.get(b)??0)||a-b).slice(0,5);
 const live=spins.filter(s=>s!==0&&s!==DOUBLE_ZERO);
 return {hot,cold,n:spins.length,zero:spins.length-live.length,red:live.filter(s=>REDS.has(s)).length,black:live.filter(s=>!REDS.has(s)).length,odd:live.filter(s=>s%2).length,even:live.filter(s=>s%2===0).length,dozens:[0,1,2].map(d=>live.filter(s=>Math.floor((s-1)/12)===d).length) as [number,number,number]};
}

/** Patch 101: finals (finale en plein): a straight-up chip on every number ending in a digit. */
export function finals(digit:number,unit:number):RouletteBet[] {
 if(!Number.isInteger(digit)||digit<0||digit>9)throw new Error('Finals go from 0 to 9.');
 return Array.from({length:37},(_,n)=>n).filter(n=>n%10===digit).map(n=>({kind:'straight' as BetKind,numbers:[n],amount:unit}));
}

/* ---------- Patch 103: named layout bets (both wheels) ---------- */
export type Special='snake'|'redSplits'|'blackSplits';
export const SPECIALS:Record<Special,{name:string;blurb:string;pieces:{kind:BetKind;numbers:number[]}[]}>={
 snake:{name:'Snake',blurb:'12 red numbers that zig-zag down the layout, a chip on each',pieces:[1,5,9,12,14,16,19,23,27,30,32,34].map(n=>({kind:'straight' as BetKind,numbers:[n]}))},
 redSplits:{name:'Red splits',blurb:'every split of two red numbers: 9-12, 16-19, 18-21, 27-30',pieces:[[9,12],[16,19],[18,21],[27,30]].map(n=>({kind:'split' as BetKind,numbers:n}))},
 blackSplits:{name:'Black splits',blurb:'every split of two black numbers: 8-11, 10-11, 10-13, 17-20, 26-29, 28-29, 28-31',pieces:[[8,11],[10,11],[10,13],[17,20],[26,29],[28,29],[28,31]].map(n=>({kind:'split' as BetKind,numbers:n}))},
};
export const specialBets=(which:Special,unit:number):RouletteBet[]=>SPECIALS[which].pieces.map(p=>({kind:p.kind,numbers:p.numbers,amount:unit}));
