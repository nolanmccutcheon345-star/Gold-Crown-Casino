/** Patch 67: card room life. Before sitting down you see a few $1/$2 tables, who is at each (regulars by
 * name and style, everyone else as a new face), pick one, and pick your seat: who sits on your left and who on
 * your right. One table is full and has a short waiting list. Only the table settings change; the table plays
 * exactly like any other. */
import type {CashSettings} from '../session/types';
import {REGULARS,regularConfig,regularFor} from '../bots/regulars';
import {cashStake,initializeOpponentSettings} from './opponent-setup';
import {STRANGER_NAMES} from '../session/churn';
import {REGULAR_STRADDLE} from '../bots/straddle';

export interface TableChoice {id:string;settings:CashSettings;label:string;full:boolean;ahead:number;
 /** Patch 88: a live straddle game. */
 straddle?:boolean}
export interface SeatPreview {seat:number;name:string;regular:boolean;style:string}
type Random=(n:number)=>number;
const secure:Random=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
const TABLE_NAMES=['Table 3','Table 7','Table 12','Table 5','Table 9'];

/** Three tables at these stakes, each with its own players. The last one is full. */
export function tableChoices(base:CashSettings,random:Random=secure):TableChoice[] {
 const stake=cashStake(base.bigBlind),pool=REGULARS.filter(r=>r.stakes.includes(stake)).map(r=>r.id),used=new Set<string>(),names=new Set<string>();
 const pickNames=[...STRANGER_NAMES];
 return [0,1,2].map(k=>{
  const seated=initializeOpponentSettings({...structuredClone(base),opponents:undefined});
  const opponents=[...seated.opponents!];
  // Shuffle who plays which style, then seat 1–3 regulars nobody else has.
  for(let i=opponents.length-1;i>0;i--){const j=random(i+1);[opponents[i],opponents[j]]=[opponents[j],opponents[i]];}
  const want=1+random(3),seats=base.seats-1;
  for(let n=0;n<want&&pool.some(id=>!used.has(id));n++){
   const free=pool.filter(id=>!used.has(id)),id=free[random(free.length)];used.add(id);opponents[random(seats)]=regularConfig(id);
  }
  // Strangers get their own names at each table.
  const seatNames:Record<number,string>={};
  for(let seat=1;seat<base.seats;seat++){
   if(regularFor(opponents[seat-1]))continue;
   const free=pickNames.filter(name=>!names.has(name));if(!free.length)break;
   const name=free[random(free.length)];names.add(name);seatNames[seat]=name;
  }
  return {id:`t${k}`,settings:{...seated,opponents,seatNames},label:TABLE_NAMES[(k+random(2))%TABLE_NAMES.length],full:k===2,ahead:k===2?1+random(2):0};
 });
}
/** Who sits where, clockwise from your left (seat 1) round to your right. */
export function seatPreview(settings:CashSettings):SeatPreview[] {
 const out:SeatPreview[]=[];
 for(let seat=1;seat<settings.seats;seat++){
  const config=settings.opponents?.[seat-1],regular=regularFor(config);
  out.push({seat,name:regular?.name??settings.seatNames?.[seat]??`Seat ${seat}`,regular:!!regular,style:regular?.style??'New face'});
 }
 return out;
}
/** Move one seat round the table: everyone else shifts by one, so your neighbours change. */
export function moveSeat(settings:CashSettings,step:1|-1):CashSettings {
 const n=settings.seats-1,opponents=[...settings.opponents!],names:Record<number,string>={};
 const order=Array.from({length:n},(_,i)=>i),moved=order.map(i=>(i+step+n)%n);
 const next=[...opponents];
 for(let i=0;i<n;i++){next[i]=opponents[moved[i]];const name=settings.seatNames?.[moved[i]+1];if(name)names[i+1]=name;}
 return {...settings,opponents:next,seatNames:names};
}

/** Patch 88: the straddle game. Straddles are allowed (the player under the gun may post twice the big blind and acts
 * last before the flop), and the regulars here are the ones who like to straddle. Uses the existing live-straddle
 * rule (V410); the players play exactly as they do anywhere else. */
export function straddleTable(base:CashSettings,random:Random=secure,avoid:readonly string[]=[]):TableChoice {
 const stake=cashStake(base.bigBlind),seated=initializeOpponentSettings({...structuredClone(base),liveStraddle:true,opponents:undefined});
 const opponents=[...seated.opponents!],seats=base.seats-1;
 for(let i=opponents.length-1;i>0;i--){const j=random(i+1);[opponents[i],opponents[j]]=[opponents[j],opponents[i]];}
 const lovers=REGULARS.filter(r=>r.stakes.includes(stake)&&(REGULAR_STRADDLE[r.id]??0)>=.3&&!avoid.includes(r.id)).map(r=>r.id);
 const order=Array.from({length:seats},(_,i)=>i);for(let i=order.length-1;i>0;i--){const j=random(i+1);[order[i],order[j]]=[order[j],order[i]];}
 lovers.slice(0,Math.min(4,seats)).forEach((id,k)=>{opponents[order[k]]=regularConfig(id);});
 const seatNames:Record<number,string>={},taken=new Set<string>();
 for(let seat=1;seat<base.seats;seat++){if(regularFor(opponents[seat-1]))continue;const free=STRANGER_NAMES.filter(n=>!taken.has(n));if(!free.length)break;const name=free[random(free.length)];taken.add(name);seatNames[seat]=name;}
 return {id:'straddle',settings:{...seated,liveStraddle:true,opponents,seatNames},label:'Table 1',full:false,ahead:0,straddle:true};
}
