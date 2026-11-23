/** Reading your timing (cash layer human-1.20.0). At a live table everyone sees how long you take, so
 * the computer players watch it too. Your action records whether you acted in a snap (under 1.5 s) or
 * after a long think (7 s or more); nothing else about your timing is kept.
 * A skilled player who has seen your snap (or slow) turn and river bets turn out strong at showdown at least
 * three times, and at least 75% of the time, folds more to the next one; if they have turned out weak at
 * least 65% of the time, they call lighter. Evidence: only hands this observer watched, and only your cards
 * that were shown down. Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile,GameEvent} from '../contracts';
import {completeProfile} from './profiles';
import {handFeatures} from './features';

export type Tempo='snap'|'tank';
/** Hero's timing on one action, from its decision id (`hero:<hand>:<revision>:snap|tank`; tournaments `tournament-hero:…`, policy 2.23.0). */
export function tempoOf(e:Pick<GameEvent,'decisionId'|'seatId'>):Tempo|null {
 if(e.seatId!==0||!(e.decisionId?.startsWith('hero:')||e.decisionId?.startsWith('tournament-hero:')))return null;
 return e.decisionId.endsWith(':snap')?'snap':e.decisionId.endsWith(':tank')?'tank':null;
}
export interface TempoRead {snapStrong:number;snapWeak:number;tankStrong:number;tankWeak:number}
export const EMPTY_TEMPO:TempoRead=Object.freeze({snapStrong:0,snapWeak:0,tankStrong:0,tankWeak:0});
export interface TempoHand {events:readonly GameEvent[];board:readonly string[];revealed:readonly {id:number;hole:readonly string[]}[]}
const CARDS:Record<string,number>={flop:3,turn:4,river:5};
/** What this observer has seen your timed turn and river bets turn out to be. `witnessed(i)` says whether
 * the observer saw hand i. */
export function tempoReadFrom(hands:readonly TempoHand[],witnessed:(index:number)=>boolean):TempoRead {
 const r={...EMPTY_TEMPO};
 hands.forEach((hand,i)=>{
  if(!witnessed(i))return;
  const hole=hand.revealed.find(x=>x.id===0)?.hole;if(!hole||hole.length!==2)return;
  for(const e of hand.events){
   if(e.type!=='action'||e.action?.type!=='raise'||(e.street!=='turn'&&e.street!=='river'))continue;
   const t=tempoOf(e);if(!t)continue;
   const strong=handFeatures(hole as never,hand.board.slice(0,CARDS[e.street]) as never).strength>=.68;
   if(t==='snap'){if(strong)r.snapStrong++;else r.snapWeak++;}else{if(strong)r.tankStrong++;else r.tankWeak++;}
  }
 });
 return r;
}
export const tempoDigest=(r:TempoRead|null|undefined)=>r?`${r.snapStrong}/${r.snapWeak}/${r.tankStrong}/${r.tankWeak}`:'-';
export type TempoPlay='tempo-fold'|'tempo-call'|null;
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Facing your turn or river bet, made with a timing they have learned to read. */
export function tempoReadPlay(o:BotObservation,profile:BotProfile,action:Action,read:TempoRead|null|undefined,random:()=>number):{action:Action;play:TempoPlay;tempo:Tempo|null} {
 const keep={action,play:null as TempoPlay,tempo:null as Tempo|null};
 if(!read||(o.street!=='turn'&&o.street!=='river')||o.legal.check||!o.ownCards||o.ownCards.length!==2)return keep;
 const bet=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street&&e.action?.type==='raise').at(-1);
 if(!bet||bet.seatId!==0)return keep;
 const t=tempoOf(bet);if(!t)return keep;
 const p=completeProfile(profile);if(p.skill<.45)return {...keep,tempo:t};
 const strong=t==='snap'?read.snapStrong:read.tankStrong,weak=t==='snap'?read.snapWeak:read.tankWeak,n=strong+weak;
 if(n<3)return {...keep,tempo:t};
 const f=handFeatures(o.ownCards,o.board);
 if(strong/n>=.75&&action.type==='call'&&f.strength<.72&&draw(random)<.8*p.skill)return {action:{type:'fold'},play:'tempo-fold',tempo:t};
 if(weak/n>=.65&&action.type==='fold'&&f.strength>=.3&&draw(random)<.8*p.skill)return {action:{type:'call'},play:'tempo-call',tempo:t};
 return {...keep,tempo:t};
}
/** What they say when they act on it (screen only). */
export const TEMPO_LINES:Record<Exclude<TempoPlay,null>,Record<Tempo,string[]>>={
 'tempo-fold':{snap:['You snapped that in. I believe you.','That was fast. Too fast for me.'],tank:['You thought a long time about that. I’ll let it go.','Long think, big bet. Fine.']},
 'tempo-call':{snap:['Snap bet again? I don’t buy it.','Every time you bet that fast…'],tank:['You took forever. I don’t believe you.','All that thinking for a bluff? Call.']},
};
