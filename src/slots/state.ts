/** Patch 90: the slots balance and record, kept on this device. A spin is paid and its result saved in one step, so
 * reloading the page mid-animation never changes what happened. */
import type {Machine,SpinResult,Random} from './engine';
import {spin,secureRandom} from './engine';

export const SLOTS_KEY='poker-night-ai:slots';
export const SLOTS_START=100000;
export interface MachineRecord {spins:number;wagered:number;won:number;biggest:number;features:number}
/** Phase 10 (fun #15, BONUS WATCH): per-machine feature history — spins since the last
 * bonus feature, features hit, and spins counted. A history counter only: it starts
 * when this field first appears in a save and is labelled as such wherever shown.
 * It never implies a feature is due; every spin is independent. */
export interface MachineWatch {since:number;hits:number;spins:number}
export interface SlotsState {balance:number;reloads:number;machines:Record<string,MachineRecord>;recent:{machine:string;bet:number;total:number;at:string}[];
 /** Patch 93: double-up gambles, kept apart from the machines' own records. */
 gamble?:{rounds:number;wagered:number;won:number};
 /** Phase 10: bonus-watch counters per machine (absent until the first spin after the update). */
 watch?:Record<string,MachineWatch>}
export const freshSlots=():SlotsState=>({balance:SLOTS_START,reloads:0,machines:{},recent:[]});
const cents=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
export function checkSlots(value:unknown):SlotsState {
 const v=value as SlotsState;
 if(!v||typeof v!=='object'||!cents(v.balance)||!cents(v.reloads)||!v.machines||typeof v.machines!=='object'||!Array.isArray(v.recent))throw new Error('Slots save is damaged.');
 for(const r of Object.values(v.machines))if(!r||![r.spins,r.wagered,r.won,r.biggest,r.features].every(cents))throw new Error('Slots record is damaged.');
 if(v.gamble!==undefined&&(!v.gamble||![v.gamble.rounds,v.gamble.wagered,v.gamble.won].every(cents)))throw new Error('Slots gamble record is damaged.');
 if(v.watch!==undefined){if(!v.watch||typeof v.watch!=='object')throw new Error('Slots bonus-watch record is damaged.');for(const w of Object.values(v.watch))if(!w||![w.since,w.hits,w.spins].every(cents))throw new Error('Slots bonus-watch record is damaged.');}
 return {balance:v.balance,reloads:v.reloads,machines:{...v.machines},recent:v.recent.slice(-30),...(v.gamble?{gamble:{...v.gamble}}:{}),...(v.watch?{watch:Object.fromEntries(Object.entries(v.watch).map(([k,w])=>[k,{...w}]))}:{})};
}
export function readSlots(store:Pick<Storage,'getItem'>|null=globalThis.localStorage??null):{state:SlotsState;notice:string} {
 try{const raw=store?.getItem(SLOTS_KEY);return {state:raw?checkSlots(JSON.parse(raw)):freshSlots(),notice:''};}
 catch{return {state:freshSlots(),notice:'Your slots save could not be read, so the slots balance was reset to $1,000.'};}
}
/** Phase 14 (Round-3 audit, BLOCKER): two tabs on one profile must not erase
 * each other. Slots state is additive — a balance, per-machine counters, a
 * recent list — so a tab that saves with the base it read can be merged with
 * whatever another tab wrote since: every counter moves by the saver's own
 * delta, and the recent list gains the saver's new entries. Both tabs'
 * spins, records and debits survive. */
export function mergeSlots(base:SlotsState,mine:SlotsState,theirs:SlotsState):SlotsState {
 const delta=(b:number,m:number,t:number)=>Math.max(0,t+(m-b));
 const machines:Record<string,MachineRecord>={};
 for(const id of new Set([...Object.keys(base.machines),...Object.keys(mine.machines),...Object.keys(theirs.machines)])){
  const b=base.machines[id],m=mine.machines[id],t=theirs.machines[id];
  if(!m){if(t)machines[id]=t;continue;}
  if(!t){machines[id]=m;continue;}
  const bb=b??{spins:0,wagered:0,won:0,biggest:0,features:0};
  machines[id]={spins:delta(bb.spins,m.spins,t.spins),wagered:delta(bb.wagered,m.wagered,t.wagered),won:delta(bb.won,m.won,t.won),biggest:Math.max(m.biggest,t.biggest),features:delta(bb.features,m.features,t.features)};
 }
 /* The recent list merges as a multiset, like the casino lists: mine's net
  * additions over base, counted per entry, appended to theirs — repeated
  * identical spins all survive, and when theirs is base the result is
  * exactly mine. */
 const counts=new Map<string,number>();for(const e of base.recent){const k=JSON.stringify(e);counts.set(k,(counts.get(k)??0)+1);}
 const seen=new Map<string,number>(),adds:SlotsState['recent']=[];
 for(const e of mine.recent){const k=JSON.stringify(e),n=(seen.get(k)??0)+1;seen.set(k,n);if(n>(counts.get(k)??0))adds.push(e);}
 const recent=[...theirs.recent,...adds].slice(-30);
 const merged:SlotsState={balance:delta(base.balance,mine.balance,theirs.balance),reloads:delta(base.reloads,mine.reloads,theirs.reloads),machines,recent};
 const g=(s:SlotsState)=>s.gamble??{rounds:0,wagered:0,won:0};
 if(mine.gamble||theirs.gamble)merged.gamble={rounds:delta(g(base).rounds,g(mine).rounds,g(theirs).rounds),wagered:delta(g(base).wagered,g(mine).wagered,g(theirs).wagered),won:delta(g(base).won,g(mine).won,g(theirs).won)};
 const watch:Record<string,MachineWatch>={};
 const wids=new Set([...Object.keys(base.watch??{}),...Object.keys(mine.watch??{}),...Object.keys(theirs.watch??{})]);
 if(wids.size){
  for(const id of wids){
   const b=base.watch?.[id],m=mine.watch?.[id],t=theirs.watch?.[id];
   if(!m){if(t)watch[id]=t;continue;}
   if(!t){watch[id]=m;continue;}
   /* One side unchanged since base: the other side's entry wins wholesale
    * (keeps the merge exactly mine when theirs is base). */
   if(JSON.stringify(t)===JSON.stringify(b)){watch[id]=m;continue;}
   if(JSON.stringify(m)===JSON.stringify(b)){watch[id]=t;continue;}
   const bb=b??{since:0,hits:0,spins:0};
   watch[id]={spins:delta(bb.spins,m.spins,t.spins),hits:delta(bb.hits,m.hits,t.hits),since:(m.hits>bb.hits||t.hits>bb.hits)?Math.min(m.since,t.since):delta(bb.since,m.since,t.since)};
  }
  merged.watch=watch;
 }
 return merged;
}
/** Save the slots state. Returns the state actually written, or null when
 * the write did not land (storage full or unavailable) — callers must not
 * present a result as saved on null. With `base` (the state this tab read
 * or last wrote), another tab's intervening writes are merged, not erased;
 * without one, the save is a plain overwrite (genesis and backup restores). */
export function saveSlots(state:SlotsState,store:Pick<Storage,'getItem'|'setItem'>|null=globalThis.localStorage??null,base?:SlotsState):SlotsState|null {
 try{
  let out=state;
  if(base&&store&&typeof store.getItem==='function'){
   const raw=store.getItem(SLOTS_KEY);
   if(raw){const theirs=checkSlots(JSON.parse(raw));if(JSON.stringify(theirs)!==JSON.stringify(base))out=mergeSlots(base,state,theirs);}
  }
  store?.setItem(SLOTS_KEY,JSON.stringify(out));
  return out;
 }catch{return null;}
}
/** Pay for a spin, play it, and credit the win. Throws if the bet is not allowed or not affordable. */
export function playSpin(state:SlotsState,machine:Machine,bet:number,random:Random=secureRandom):{state:SlotsState;result:SpinResult} {
 if(!machine.bets.includes(bet))throw new Error('That bet is not offered on this machine.');
 if(state.balance<bet)throw new Error('Not enough in your slots balance for that bet.');
 const result=spin(machine,bet,random);
 const prev=state.machines[machine.id]??{spins:0,wagered:0,won:0,biggest:0,features:0};
 const record={spins:prev.spins+1,wagered:prev.wagered+bet,won:prev.won+result.total,biggest:Math.max(prev.biggest,result.total),features:prev.features+(result.free||result.hold||result.wheel?1:0)};
 /* Phase 10 (fun #15): the bonus watch counts every bonus feature the machine offers
  * (free spins, Hold & Spin, the wheel, the chest pick) — history only, never a meter. */
 const featureHit=!!(result.free||result.hold||result.wheel||result.pick);
 const pw=state.watch?.[machine.id]??{since:0,hits:0,spins:0};
 const watch={...(state.watch??{}),[machine.id]:{since:featureHit?0:pw.since+1,hits:pw.hits+(featureHit?1:0),spins:pw.spins+1}};
 return {result,state:{...state,balance:state.balance-bet+result.total,machines:{...state.machines,[machine.id]:record},watch,recent:[...state.recent,{machine:machine.id,bet,total:result.total,at:new Date().toISOString()}].slice(-30)}};
}
/** Practice money: when the balance cannot cover the smallest bet anywhere, it can be topped back up to $1,000. */
export function reloadSlots(state:SlotsState,smallest:number):SlotsState {
 if(state.balance>=smallest)throw new Error('You can reload only when your balance is below the smallest bet.');
 return {...state,balance:SLOTS_START,reloads:state.reloads+1};
}

/** Patch 93: the double-up. A fair card from a fresh shuffled deck: red or black pays 2× (half the cards), the suit pays
 * 4× (a quarter). Even money in the long run: it never changes a machine's payback. */
export type GambleChoice='red'|'black'|'s'|'h'|'d'|'c';
export const GAMBLE_ROUNDS=5;
export function gamble(state:SlotsState,stake:number,choice:GambleChoice,random:Random=secureRandom):{state:SlotsState;card:string;won:boolean;payout:number} {
 if(!Number.isSafeInteger(stake)||stake<=0)throw new Error('Nothing to gamble.');
 if(stake>state.balance)throw new Error('The stake is more than your balance.');
 if(!['red','black','s','h','d','c'].includes(choice))throw new Error('Pick red, black or a suit.');
 const card='A23456789TJQK'[random(13)]+'shdc'[random(4)],suit=card[1],red=suit==='h'||suit==='d';
 const won=choice==='red'?red:choice==='black'?!red:choice===suit,payout=won?stake*(choice.length>1?2:4):0;
 const g=state.gamble??{rounds:0,wagered:0,won:0};
 return {card,won,payout,state:{...state,balance:state.balance-stake+payout,gamble:{rounds:g.rounds+1,wagered:g.wagered+stake,won:g.won+payout}}};
}
