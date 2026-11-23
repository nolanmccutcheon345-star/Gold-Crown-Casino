/** Patch 99: the casino balance for roulette, craps, baccarat and the races, kept on this device apart from poker,
 * blackjack and slots money. Practice money only. Every amount is in cents. A round is paid for and its result saved
 * in one step, so reloading the page during an animation never changes what happened. */
export type Random=(n:number)=>number;
export const secureRandom:Random=n=>{const a=new Uint32Array(1),limit=Math.floor(0x100000000/n)*n;let x;do{crypto.getRandomValues(a);x=a[0];}while(x>=limit);return x%n;};

export const CASINO_KEY='poker-night-ai:casino';
export const CASINO_START=100000;
export type CasinoGame='roulette'|'craps'|'baccarat'|'races';
export const CASINO_GAMES:readonly CasinoGame[]=['roulette','craps','baccarat','races'];
export interface GameRecord {rounds:number;wagered:number;returned:number;biggest:number}
export interface CasinoState {balance:number;reloads:number;games:Partial<Record<CasinoGame,GameRecord>>;
 recent:{game:CasinoGame;wagered:number;returned:number;at:string;
  /** Patch 102: what the round was ("Red, 17 · 3 bets") and how it came out ("17 red"). */
  bet?:string;result?:string}[];
 /** Craps chips still on the layout between rolls (the money is already out of the balance). */
 craps?:unknown;
 /** Each game's own short history (numbers, results), for the boards at the tables. */
 boards?:Partial<Record<CasinoGame,unknown[]>>;
 /** Patch 101: saved roulette layouts, and the day at the races (cards, a Daily Double waiting on its second leg, results). */
 favs?:{name:string;wheel:'european'|'american';bets:{kind:string;numbers:number[];amount:number}[]}[];
 raceDay?:unknown;
 /** Patch 102: the baccarat shoe in use (checked when it is read). */
 bacShoe?:unknown;
}
/** Rounds kept in the recent list, per game, so a long craps session never pushes the other games' rounds out. */
export const RECENT_KEEP=60;
export function trimRecent<T extends {game:CasinoGame}>(list:readonly T[]):T[] {
 const seen:Partial<Record<CasinoGame,number>>={},out:T[]=[];
 for(let i=list.length-1;i>=0;i--){const g=list[i].game,n=seen[g]??0;if(n<RECENT_KEEP){out.push(list[i]);seen[g]=n+1;}}
 return out.reverse();
}
export const freshCasino=():CasinoState=>({balance:CASINO_START,reloads:0,games:{},recent:[]});
const cents=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
export function checkCasino(value:unknown):CasinoState {
 const v=value as CasinoState;
 if(!v||typeof v!=='object'||!cents(v.balance)||!cents(v.reloads)||!v.games||typeof v.games!=='object'||!Array.isArray(v.recent))throw new Error('Casino save is damaged.');
 for(const [k,r] of Object.entries(v.games)){if(!CASINO_GAMES.includes(k as CasinoGame)||!r||![r.rounds,r.wagered,r.returned,r.biggest].every(cents))throw new Error('Casino record is damaged.');}
 if(v.favs!==undefined&&(!Array.isArray(v.favs)||v.favs.length>3||!v.favs.every(f=>f&&typeof f.name==='string'&&(f.wheel==='european'||f.wheel==='american')&&Array.isArray(f.bets)&&f.bets.every(b=>b&&typeof b.kind==='string'&&Array.isArray(b.numbers)&&cents(b.amount)))))throw new Error('Saved roulette layouts are damaged.');
 return {balance:v.balance,reloads:v.reloads,games:{...v.games},recent:trimRecent(v.recent.filter(r=>r&&CASINO_GAMES.includes(r.game))),...(v.craps!==undefined?{craps:v.craps}:{}),...(v.boards?{boards:{...v.boards}}:{}),...(v.favs?{favs:v.favs.map(f=>({...f,bets:f.bets.map(b=>({...b,numbers:[...b.numbers]}))}))}:{}),...(v.raceDay!==undefined?{raceDay:v.raceDay}:{}),...(v.bacShoe!==undefined?{bacShoe:v.bacShoe}:{})};
}
export function readCasino(store:Pick<Storage,'getItem'>|null=globalThis.localStorage??null):{state:CasinoState;notice:string} {
 try{const raw=store?.getItem(CASINO_KEY);return {state:raw?checkCasino(JSON.parse(raw)):freshCasino(),notice:''};}
 catch{return {state:freshCasino(),notice:'Your casino save could not be read, so the casino balance was reset to $1,000.'};}
}
export function saveCasino(state:CasinoState,store:Pick<Storage,'setItem'>|null=globalThis.localStorage??null):void {try{store?.setItem(CASINO_KEY,JSON.stringify(state));}catch{/* this visit only */}}
/** Take a stake off the balance (the chips go on the layout). */
export function stake(state:CasinoState,amount:number):CasinoState {
 if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Bets must be at least one cent.');
 if(amount>state.balance)throw new Error('Not enough in your casino balance for that bet.');
 return {...state,balance:state.balance-amount};
}
/** Record a settled round: what was risked and what came back (stakes returned plus winnings). */
export function settle(state:CasinoState,game:CasinoGame,wagered:number,returned:number,note?:{bet:string;result:string}):CasinoState {
 const r=state.games[game]??{rounds:0,wagered:0,returned:0,biggest:0};
 return {...state,balance:state.balance+returned,games:{...state.games,[game]:{rounds:r.rounds+1,wagered:r.wagered+wagered,returned:r.returned+returned,biggest:Math.max(r.biggest,returned-wagered)}},
  recent:trimRecent([...state.recent,{game,wagered,returned,at:new Date().toISOString(),...(note?{bet:note.bet.slice(0,80),result:note.result.slice(0,60)}:{})}])};
}
export function pushBoard<T>(state:CasinoState,game:CasinoGame,entry:T,keep=72):CasinoState {
 return {...state,boards:{...(state.boards??{}),[game]:[...((state.boards?.[game]??[]) as T[]),entry].slice(-keep)}};
}
/** Practice money: when nothing is left to bet with, top the balance back up to $1,000. */
export function reloadCasino(state:CasinoState):CasinoState {
 if(state.balance>=100)throw new Error('You can reload only when your casino balance is under $1.');
 return {...state,balance:CASINO_START,reloads:state.reloads+1};
}
/** Chip values offered at the tables, in cents. */
export const CHIPS=[100,500,2500,10000,50000] as const;
export const money=(c:number)=>`$${(c/100).toLocaleString('en-US',{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2})}`;
