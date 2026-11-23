/** Patch 99: horse racing. Each race has eight runners with a true chance to win; the race is run by drawing the
 * finishing order from those chances (first place by chance, then second from the rest in proportion, and so on: the
 * Harville model). The book offers fixed odds built from the same chances with a 16% take, so every bet returns
 * 84% in the long run, like a track's pari-mutuel pools. Win, Place (first or second), Show (top three) and Exacta
 * (first two in order) bets. */
import type {Random} from './wallet';

/** Patch 100: a past race on a runner's record. */
export interface PastRace {track:string;distance:string;finish:number;field:number;speed:number;daysAgo:number}
export interface Runner {no:number;name:string;jockey:string;silks:[string,string];form:string;age:number;weight:number;
 /** Last races, most recent first, and the best speed figure among them. */
 past:PastRace[];best:number;
 /** Patch 101: a late scratch. A scratched horse does not run and takes no bets; its chance is 0. */
 scratched?:boolean;
 /** True chance to win, the sum over the field is 1. */
 p:number}
export interface RaceCard {id:string;number:number;track:string;distance:string;going:string;purse:string;runners:Runner[]}
export const TAKE=.16;
const NAMES=['Midnight Ledger','Copper Canyon','River Spirit','Red Dirt Road','Lucky Strike','Prairie Fire','Thunder Alley','Sooner Magic','Tin Star','Wildcat Willie','Okie Dokie','Last Call','Dealer’s Choice','Pocket Rockets','All In Annie','Royal Flush','Dust Storm','Blue Norther','Cimarron Kid','Turnpike Tess','Neon Cowboy','Smoke Signal','Saddle Up Sam','Big Sky Belle','Rattlesnake Ridge','Sunday Money','Second Wind','Long Shot Larry','Ace Of Hearts','Diamond Dottie','Whiskey River','Golden Hour'];
const JOCKEYS=['M. Ortiz','J. Rosario','L. Saez','F. Prat','I. Ortiz Jr.','T. Gaffalione','J. Castellano','J. Velazquez','R. Santana Jr.','D. Davis','C. Lanerie','E. Jaramillo'];
const COLOURS:[string,string][]=[['#c62828','#ffffff'],['#1565c0','#ffd54f'],['#2e7d32','#ffffff'],['#f9a825','#212121'],['#6a1b9a','#ffffff'],['#212121','#e53935'],['#ef6c00','#1a237e'],['#00838f','#fff59d'],['#ad1457','#e0e0e0'],['#4e342e','#ffcc80']];
const TRACKS=['Remington Park','Will Rogers Downs','Oaklawn','Lone Star Park'];
const DIST=['6 furlongs','7 furlongs','1 mile','1 1/16 miles'];
const GOING=['Fast','Good','Sloppy','Firm'];
/** A new race card. The chances come from hidden ratings plus race-day luck; the form line is a hint, not a guarantee. */
export function newRace(number:number,random:Random):RaceCard {
 const names=[...NAMES];for(let i=names.length-1;i>0;i--){const j=random(i+1);[names[i],names[j]]=[names[j],names[i]];}
 const ratings=Array.from({length:8},()=>random(1000)/1000);
 const w=ratings.map(r=>Math.exp(2.6*r));const sum=w.reduce((a,b)=>a+b,0);
 const silks=[...COLOURS];for(let i=silks.length-1;i>0;i--){const j=random(i+1);[silks[i],silks[j]]=[silks[j],silks[i]];}
 const runners:Runner[]=ratings.map((r,i)=>{const p=w[i]/sum;
  // Past performances: better for stronger horses, but noisy, so they hint rather than tell.
  let day=7+random(14);
  const past:PastRace[]=Array.from({length:4},()=>{const field=7+random(4),finish=Math.min(field,1+Math.max(0,Math.floor((1-r)*6+random(4)-1)));const pr={track:TRACKS[random(TRACKS.length)],distance:DIST[random(DIST.length)],finish,field,speed:Math.round(68+r*28+random(11)-5),daysAgo:day};day+=14+random(28);return pr;});
  const form=past.map(x=>x.finish>9?'0':String(x.finish)).reverse().join('');
  return {no:i+1,name:names[i],jockey:JOCKEYS[random(JOCKEYS.length)],silks:silks[i],form,age:3+random(4),weight:118+random(9),past,best:Math.max(...past.map(x=>x.speed)),p};});
 // About one race in four has a late scratch; the others' chances are scaled back up to 1.
 if(random(4)===0){const out=random(8);runners[out].scratched=true;const rest=1-runners[out].p;runners[out].p=0;for(const r of runners)if(!r.scratched)r.p/=rest;}
 return {id:`race-${number}-${random(1e9)}`,number,track:TRACKS[random(TRACKS.length)],distance:DIST[random(DIST.length)],going:GOING[random(GOING.length)],purse:`$${(20+random(60))*1000}`,runners};
}
/** The finishing order, drawn from the true chances. */
export function runRace(card:RaceCard,random:Random):number[] {
 const left=card.runners.filter(r=>!r.scratched).map(r=>({no:r.no,p:r.p})),order:number[]=[];
 while(left.length){const total=left.reduce((a,r)=>a+r.p,0);let x=random(1_000_000)/1_000_000*total,i=0;
  for(;i<left.length-1;i++){x-=left[i].p;if(x<0)break;}
  order.push(left[i].no);left.splice(i,1);}
 return order;
}
/** Chance that `a` finishes first and `b` second (Harville). */
const pairP=(card:RaceCard,a:number,b:number)=>{const pa=card.runners[a-1].p,pb=card.runners[b-1].p;return pa*pb/(1-pa);};
export function chance(card:RaceCard,kind:BetKind,picks:readonly number[]):number {
 const n=card.runners.length,P=(i:number)=>card.runners[i-1].p,all=Array.from({length:n},(_,i)=>i+1);
 const a=picks[0];
 if(kind==='win')return P(a);
 if(kind==='place')return P(a)+all.filter(b=>b!==a).reduce((s,b)=>s+pairP(card,b,a),0);
 if(kind==='show'){let s=P(a);for(const x of all)if(x!==a){s+=pairP(card,x,a);for(const y of all)if(y!==a&&y!==x)s+=pairP(card,x,y)*P(a)/(1-P(x)-P(y));}return s;}
 if(kind==='quinella')return pairP(card,a,picks[1])+pairP(card,picks[1],a);
 if(kind==='trifecta'){const b=picks[1],c=picks[2];return pairP(card,a,b)*P(c)/(1-P(a)-P(b));}
 if(kind==='superfecta'){const [,b,c,d]=picks;return pairP(card,a,b)*P(c)/(1-P(a)-P(b))*P(d)/(1-P(a)-P(b)-P(c));}
 return pairP(card,a,picks[1]);
}
export type BetKind='win'|'place'|'show'|'exacta'|'quinella'|'trifecta'|'superfecta';
export const PICKS:Record<BetKind,number>={win:1,place:1,show:1,exacta:2,quinella:2,trifecta:3,superfecta:4};
export interface RaceBet {kind:BetKind;picks:number[];amount:number}
/** Offered odds, to one, rounded down to the nearest tenth (so the take is at least 16%). 0 means the book does not
 * take that bet (a very short price, under 1/10). */
export function odds(card:RaceCard,kind:BetKind,picks:readonly number[]):number {
 const p=chance(card,kind,picks);if(!(p>0))return 0;const x=Math.floor(((1-TAKE)/p-1)*10)/10;return x>=.1?x:0;
}
/** Odds the way a tote board shows them: 5/2, 9/5, 30/1… */
export function oddsLabel(x:number):string {
 const fr:[number,string][]=[[.2,'1/5'],[.4,'2/5'],[.5,'1/2'],[.6,'3/5'],[.8,'4/5'],[1,'1/1'],[1.2,'6/5'],[1.4,'7/5'],[1.5,'3/2'],[1.6,'8/5'],[1.8,'9/5'],[2,'2/1'],[2.5,'5/2'],[3,'3/1'],[3.5,'7/2'],[4,'4/1'],[4.5,'9/2']];
 if(x<5){let best=fr[0];for(const f of fr)if(f[0]<=x+1e-9)best=f;return best[1];}
 return `${Math.floor(x)}/1`;
}
export function validRaceBet(card:RaceCard,b:RaceBet):boolean {
 const n=card.runners.length,ok=(x:number)=>Number.isInteger(x)&&x>=1&&x<=n;
 if(!Number.isSafeInteger(b.amount)||b.amount<=0||!b.picks.every(ok))return false;
 return b.picks.length===PICKS[b.kind]&&new Set(b.picks).size===b.picks.length;
}
/** What a bet returns for a finishing order (stake plus winnings, rounded down to the cent; nothing on a loss).
 * The odds are fixed when the bet goes in. */
export function settleBet(b:RaceBet,locked:number,order:readonly number[]):number {
 const a=b.picks[0];
 const won=b.kind==='win'?order[0]===a:b.kind==='place'?order.slice(0,2).includes(a):b.kind==='show'?order.slice(0,3).includes(a):b.kind==='quinella'?order.slice(0,2).every(x=>b.picks.includes(x)):b.kind==='trifecta'?order[0]===a&&order[1]===b.picks[1]&&order[2]===b.picks[2]:b.kind==='superfecta'?b.picks.every((x,i)=>order[i]===x):order[0]===a&&order[1]===b.picks[1];
 return won?b.amount+Math.floor(b.amount*locked):0;
}
/** Where each horse is at each moment of the show, as a share of the distance (0 to 1), for frames 0..steps. The
 * finishing order is decided first; these paths only show it: everyone breaks together, the field strings out, and
 * the leaders come home in the right order. */
export function paths(order:readonly number[],steps:number,random:Random):Record<number,number[]> {
 const out:Record<number,number[]>={};
 const gaps=order.map(()=>.002+random(1000)/1000*.03);
 order.forEach((no,place)=>{
  // Finishing time grows with the place; gaps vary, so some finishes are close.
  const finish=1+gaps.slice(0,place).reduce((x,y)=>x+y,0);
  const style=random(3);// 0 front-runner, 1 stalker, 2 closer
  const pts:number[]=[];
  for(let k=0;k<=steps;k++){const t=k/steps;
   // Distance covered at time t (scaled so the horse reaches 1 at `finish`): a curve shaped by running style.
   const x=Math.min(1,t/finish),shape=style===0?Math.pow(x,.92):style===2?Math.pow(x,1.12):x;
   const wobble=k===0||k===steps?0:Math.sin(k*.9+no)*.004;
   pts.push(Math.min(1,Math.max(0,shape+wobble)));}
  pts[steps]=Math.min(1,1/finish);out[no]=pts;});
 return out;
}
/** How far the winner won by, from the show's finishing positions: a nose, a head, a neck, or lengths. */
export function margin(paths:Record<number,number[]>,order:readonly number[]):{text:string;photo:boolean} {
 const last=paths[order[0]].length-1,gap=paths[order[0]][last]-paths[order[1]][last];
 if(gap<.004)return {text:'by a nose',photo:true};if(gap<.008)return {text:'by a head',photo:true};if(gap<.012)return {text:'by a neck',photo:false};
 const l=Math.round(gap/.012);return {text:`by ${l===1?'a length':`${l} lengths`}`,photo:false};
}
/** The caller's lines through the race. */
export function calls(card:RaceCard,order:readonly number[],leaderAt:(frac:number)=>number,won?:{text:string;photo:boolean}):{at:number;text:string}[] {
 const name=(no:number)=>card.runners[no-1].name;
 if(won)return [
  {at:0,text:'And they’re off!'},
  {at:.25,text:`${name(leaderAt(.25))} breaks on top.`},
  {at:.5,text:`Down the backstretch, ${name(leaderAt(.5))} leads.`},
  {at:.72,text:`Into the far turn, ${name(leaderAt(.72))} in front!`},
  {at:.88,text:won.photo?`Down the stretch, ${name(order[0])} and ${name(order[1])} head to head!`:'Down the stretch they come!'},
  {at:1,text:`${name(order[0])} wins it ${won.text}! ${name(order[1])} second, ${name(order[2])} third.`},
 ];
 return [
  {at:0,text:'And they’re off!'},
  {at:.25,text:`${name(leaderAt(.25))} breaks on top.`},
  {at:.5,text:`Down the backstretch, ${name(leaderAt(.5))} leads.`},
  {at:.72,text:`Into the far turn, ${name(leaderAt(.72))} in front!`},
  {at:.88,text:'Down the stretch they come!'},
  {at:1,text:`${name(order[0])} wins it! ${name(order[1])} second, ${name(order[2])} third.`},
 ];
}

/** Patch 101: the Daily Double: the winners of this race and the next. */
export const ddChance=(first:RaceCard,second:RaceCard,a:number,b:number)=>first.runners[a-1].p*second.runners[b-1].p;
export function ddOdds(first:RaceCard,second:RaceCard,a:number,b:number):number {
 const p=ddChance(first,second,a,b);if(!p)return 0;const x=Math.floor(((1-TAKE)/p-1)*10)/10;return x>=.1?x:0;
}
export interface DailyDouble {picks:[number,number];amount:number;odds:number;race:number}
export function checkCard(v:unknown):RaceCard {
 const c=v as RaceCard;
 if(!c||typeof c!=='object'||typeof c.id!=='string'||!Number.isSafeInteger(c.number)||!Array.isArray(c.runners)||c.runners.length!==8)throw new Error('Race card is damaged.');
 const total=c.runners.reduce((a,r)=>a+(typeof r.p==='number'&&r.p>=0?r.p:NaN),0);
 if(!(Math.abs(total-1)<1e-9)||!c.runners.every((r,i)=>r.no===i+1&&typeof r.name==='string'&&Array.isArray(r.past)))throw new Error('Race card is damaged.');
 return c;
}

/* ---------- Patch 102 ---------- */
/** "Across the board": Win, Place and Show on one horse, one chip each. */
export function acrossTheBoard(no:number,amount:number):RaceBet[] {return (['win','place','show'] as const).map(kind=>({kind,picks:[no],amount}));}
const hash=(s:string)=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;};
const KEEN=['On his toes and gleaming in the paddock.','Looks fit and ready; walking well.','Blinkers on for the first time today.','Dropping in class after a sharp workout.','Top rider takes the mount today.','Worked a bullet half-mile last week.'];
const QUIET=['Quiet in the post parade.','First try at this distance.','Back from a two-month break.','Wrapped in front, nothing unusual.','Calm, ears pricked, nothing to note.','Has run well here before.'];
const SOUR=['Sweating and washed out in the paddock.','Fractious; took two handlers to saddle.','Moving up in class today.','Looked dull on the walk over.','Kicked at the gate in the warm-up.','Hasn’t raced since a poor run.'];
/** A paddock note on each runner, the same every time for this race. Stronger horses tend to look better, but the
 * notes are only a hint: about a third of the time a horse looks no different from the rest. */
export function paddockNote(card:RaceCard,no:number):string {
 const r=card.runners[no-1];if(!r||r.scratched)return '';
 const live=card.runners.filter(x=>!x.scratched),rank=[...live].sort((a,b)=>b.p-a.p).findIndex(x=>x.no===no),h=hash(`${card.id}:${no}`);
 const third=Math.floor(3*rank/live.length),pool=h%3===0?QUIET:third===0?KEEN:third===2?SOUR:QUIET;
 const mud=card.going==='Sloppy'&&h%7===1?'Bred for the mud; likes a wet track.':'';
 return mud||pool[(h>>>3)%pool.length];
}

/* ---------- Patch 103 ---------- */
/** A box: the same horses in every order, one bet each (Exacta 2, Trifecta 6, Superfecta 24). */
export const BOXABLE:readonly BetKind[]=['exacta','trifecta','superfecta'];
export function boxBets(kind:BetKind,picks:readonly number[],amount:number):RaceBet[] {
 if(!BOXABLE.includes(kind)||picks.length!==PICKS[kind]||new Set(picks).size!==picks.length)throw new Error('A box needs the right number of different horses.');
 const perms=(xs:number[]):number[][]=>xs.length<=1?[xs]:xs.flatMap((x,i)=>perms([...xs.slice(0,i),...xs.slice(i+1)]).map(r=>[x,...r]));
 return perms([...picks]).map(p=>({kind,picks:p,amount}));
}
