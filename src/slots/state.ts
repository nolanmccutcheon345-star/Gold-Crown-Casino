/** Patch 90: the slots balance and record, kept on this device. A spin is paid and its result saved in one step, so
 * reloading the page mid-animation never changes what happened. */
import type {Machine,SpinResult,Random} from './engine';
import {spin,secureRandom} from './engine';

export const SLOTS_KEY='poker-night-ai:slots';
export const SLOTS_START=100000;
export interface MachineRecord {spins:number;wagered:number;won:number;biggest:number;features:number}
export interface SlotsState {balance:number;reloads:number;machines:Record<string,MachineRecord>;recent:{machine:string;bet:number;total:number;at:string}[];
 /** Patch 93: double-up gambles, kept apart from the machines' own records. */
 gamble?:{rounds:number;wagered:number;won:number}}
export const freshSlots=():SlotsState=>({balance:SLOTS_START,reloads:0,machines:{},recent:[]});
const cents=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
export function checkSlots(value:unknown):SlotsState {
 const v=value as SlotsState;
 if(!v||typeof v!=='object'||!cents(v.balance)||!cents(v.reloads)||!v.machines||typeof v.machines!=='object'||!Array.isArray(v.recent))throw new Error('Slots save is damaged.');
 for(const r of Object.values(v.machines))if(!r||![r.spins,r.wagered,r.won,r.biggest,r.features].every(cents))throw new Error('Slots record is damaged.');
 if(v.gamble!==undefined&&(!v.gamble||![v.gamble.rounds,v.gamble.wagered,v.gamble.won].every(cents)))throw new Error('Slots gamble record is damaged.');
 return {balance:v.balance,reloads:v.reloads,machines:{...v.machines},recent:v.recent.slice(-30),...(v.gamble?{gamble:{...v.gamble}}:{})};
}
export function readSlots(store:Pick<Storage,'getItem'>|null=globalThis.localStorage??null):{state:SlotsState;notice:string} {
 try{const raw=store?.getItem(SLOTS_KEY);return {state:raw?checkSlots(JSON.parse(raw)):freshSlots(),notice:''};}
 catch{return {state:freshSlots(),notice:'Your slots save could not be read, so the slots balance was reset to $1,000.'};}
}
export function saveSlots(state:SlotsState,store:Pick<Storage,'setItem'>|null=globalThis.localStorage??null):void {try{store?.setItem(SLOTS_KEY,JSON.stringify(state));}catch{/* this visit only */}}
/** Pay for a spin, play it, and credit the win. Throws if the bet is not allowed or not affordable. */
export function playSpin(state:SlotsState,machine:Machine,bet:number,random:Random=secureRandom):{state:SlotsState;result:SpinResult} {
 if(!machine.bets.includes(bet))throw new Error('That bet is not offered on this machine.');
 if(state.balance<bet)throw new Error('Not enough in your slots balance for that bet.');
 const result=spin(machine,bet,random);
 const prev=state.machines[machine.id]??{spins:0,wagered:0,won:0,biggest:0,features:0};
 const record={spins:prev.spins+1,wagered:prev.wagered+bet,won:prev.won+result.total,biggest:Math.max(prev.biggest,result.total),features:prev.features+(result.free||result.hold||result.wheel?1:0)};
 return {result,state:{...state,balance:state.balance-bet+result.total,machines:{...state.machines,[machine.id]:record},recent:[...state.recent,{machine:machine.id,bet,total:result.total,at:new Date().toISOString()}].slice(-30)}};
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
