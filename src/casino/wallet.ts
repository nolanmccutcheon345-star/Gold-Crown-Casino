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
/** Phase 14 (Round-3 audit, BLOCKER): two tabs on one profile must not erase
 * each other. The money and the per-game records are additive, so a tab that
 * saves with the base it read is merged with whatever another tab wrote
 * since — both tabs' settled rounds and debits survive. Single-blob session
 * features (the craps layout, the race day, the baccarat shoe, saved layouts)
 * describe one live table rather than a ledger; those follow whichever tab
 * changed them most recently. */
export function mergeCasino(base:CasinoState,mine:CasinoState,theirs:CasinoState):CasinoState {
 const delta=(b:number,m:number,t:number)=>Math.max(0,t+(m-b));
 const games:CasinoState['games']={};
 for(const g of CASINO_GAMES){
  const b=base.games[g],m=mine.games[g],t=theirs.games[g];
  if(!m){if(t)games[g]=t;continue;}
  if(!t){games[g]=m;continue;}
  const bb=b??{rounds:0,wagered:0,returned:0,biggest:0};
  games[g]={rounds:delta(bb.rounds,m.rounds,t.rounds),wagered:delta(bb.wagered,m.wagered,t.wagered),returned:delta(bb.returned,m.returned,t.returned),biggest:Math.max(m.biggest,t.biggest)};
 }
 /* Append-only lists merge as multisets: theirs' entries plus mine's net
  * additions over base, counted per entry — repeated identical entries
  * (two Banker coups, two rolls of the same dice) are distinct rounds and
  * all survive. When theirs is base, the result is exactly mine. */
 const additions=<T,>(b:readonly T[],m:readonly T[]):T[]=>{
  const counts=new Map<string,number>();for(const e of b){const k=JSON.stringify(e);counts.set(k,(counts.get(k)??0)+1);}
  const seen=new Map<string,number>(),out:T[]=[];
  for(const e of m){const k=JSON.stringify(e),n=(seen.get(k)??0)+1;seen.set(k,n);if(n>(counts.get(k)??0))out.push(e);}
  return out;
 };
 const recent=trimRecent([...theirs.recent,...additions(base.recent,mine.recent)]);
 const boards:CasinoState['boards']={};
 for(const g of CASINO_GAMES){
  const b=(base.boards?.[g]??[]) as unknown[],m=(mine.boards?.[g]??[]) as unknown[],t=(theirs.boards?.[g]??[]) as unknown[];
  boards[g]=[...t,...additions(b,m)].slice(-Math.max(m.length,t.length,72));
 }
 const blob=<T,>(b:T,m:T,t:T):T=>JSON.stringify(m)!==JSON.stringify(b)?m:t;
 return {balance:delta(base.balance,mine.balance,theirs.balance),reloads:delta(base.reloads,mine.reloads,theirs.reloads),games,recent,boards,
  craps:blob(base.craps,mine.craps,theirs.craps),favs:blob(base.favs,mine.favs,theirs.favs),raceDay:blob(base.raceDay,mine.raceDay,theirs.raceDay),bacShoe:blob(base.bacShoe,mine.bacShoe,theirs.bacShoe)};
}
/** Save the casino state. Returns the state actually written, or null when
 * the write did not land (storage full or unavailable) — callers must not
 * present a result as saved on null. With `base` (the state this tab read
 * or last wrote), another tab's intervening writes are merged, not erased. */
export function saveCasino(state:CasinoState,store:Pick<Storage,'getItem'|'setItem'>|null=globalThis.localStorage??null,base?:CasinoState):CasinoState|null {
 try{
  let out=state;
  if(base&&store&&typeof store.getItem==='function'){
   const raw=store.getItem(CASINO_KEY);
   if(raw){const theirs=checkCasino(JSON.parse(raw));if(JSON.stringify(theirs)!==JSON.stringify(base))out=mergeCasino(base,state,theirs);}
  }
  store?.setItem(CASINO_KEY,JSON.stringify(out));
  return out;
 }catch{return null;}
}
/** Replace the casino save outright (backup restores — an explicit player
 * action that is supposed to supersede, never merge). False when the write
 * did not land. */
export function overwriteCasino(state:CasinoState,store:Pick<Storage,'setItem'>|null=globalThis.localStorage??null):boolean {
 try{store?.setItem(CASINO_KEY,JSON.stringify(state));return true;}catch{return false;}
}
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
