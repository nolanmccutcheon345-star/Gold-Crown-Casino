/** Rivalries and grudges (cash layer human-1.10.0, tournament policy 2.13.0). Players remember who
 * took their stack. Every big pot a player loses to one winner adds to a grudge against that winner,
 * and grudges fade slowly (about half every 300 hands). Facing the player they hold a grudge against,
 * people play looser, more aggressive and more stubborn, and say so. Strong players feel it much less.
 * Identities persist: regulars and Hero carry grudges across cash sessions. Public end-of-hand results
 * only. Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {handFeatures} from './features';
import {deepRank} from './three-bet';
import {completeProfile,clamp} from './profiles';
import {keyOpponent} from './table-reads';

/** One finished hand: who sat where (stable identities), chips in and won, the big blind. */
export interface RivalryHand {identities:Readonly<Record<number,string>>;committed:Readonly<Record<number,number>>;won:Readonly<Record<number,number>>;bigBlind:number;/** Public awarded pots; multiwinner hands are conservatively excluded. */pots?:readonly {winners?:readonly number[]}[];}
/** Grudges as holder → target → level (0 none … about 1.5 strong). */
export type Grudges=Record<string,Record<string,number>>;

/** The biggest loser and biggest winner of a hand, when the loser lost at least 30 big blinds. */
export function bigPot(hand:RivalryHand):{loser:string;winner:string;lossBB:number}|null {
 if(!Number.isFinite(hand.bigBlind)||hand.bigBlind<=0)return null;
 const recipients=hand.pots?.length?new Set(hand.pots.flatMap(p=>p.winners??[])):new Set(Object.keys(hand.won).map(Number).filter(seat=>(hand.won[seat]??0)>0));
 // A net winner may have won only a side pot the loser never contested. Do not infer a
 // rivalry from aggregate net results when public awards have different recipients.
 if(recipients.size!==1||hand.pots?.some(p=>!p.winners?.length))return null;
 const winnerSeat=[...recipients][0],winner=hand.identities[winnerSeat];
 if(!winner||!Number.isFinite(hand.won[winnerSeat])||hand.won[winnerSeat]-(hand.committed[winnerSeat]??0)<=0)return null;
 let loser:string|null=null,worst=0;
 for(const [seat,id] of Object.entries(hand.identities)){
  const committed=hand.committed[+seat]??0,won=hand.won[+seat]??0;
  if(!Number.isFinite(committed)||!Number.isFinite(won)||committed<0||won<0)return null;
  const net=(won-committed)/hand.bigBlind;if(net<worst){worst=net;loser=id;}
 }
 return loser&&loser!==winner&&-worst>=30?{loser,winner,lossBB:-worst}:null;
}
/** Grudges from hands listed oldest first. */
export function grudgesFrom(hands:readonly RivalryHand[]):Grudges {
 const out:Grudges={};
 hands.forEach((hand,i)=>{const b=bigPot(hand);if(!b)return;const age=hands.length-1-i,w=b.lossBB/100*Math.pow(.5,age/300);(out[b.loser]??={})[b.winner]=(out[b.loser][b.winner]??0)+w;});
 return out;
}
export const grudge=(g:Grudges|null|undefined,holder:string|undefined,target:string|undefined)=>holder&&target?clamp(g?.[holder]?.[target]??0,0,1.5):0;

export interface RivalryEffect {target:number;level:number;}
/** The same player adjusted against the opponent they hold a grudge against, if that is the key opponent. */
export function rivalryProfile(o:BotObservation,profile:BotProfile,grudges:Grudges|null|undefined,identityOf:(seat:number)=>string|undefined):{profile:BotProfile;effect:RivalryEffect|null} {
 if(!grudges)return {profile,effect:null};
 const own=o.seats.find(s=>s.id===o.actingSeat);
 // Profile changes affect the base policy, so enable them only where every legal
 // wager is below the exposure bound. The explicit overlay handles other small calls.
 if(!own||o.legal.callAmount>=own.stack*.5||(o.legal.canRaise&&(o.legal.maxRaiseTo??Infinity)-own.streetCommitted>=own.stack*.5))return {profile,effect:null};
 const target=keyOpponent(o);if(target===null)return {profile,effect:null};
 const level=grudge(grudges,identityOf(o.actingSeat),identityOf(target));if(level<.15)return {profile,effect:null};
 const p=completeProfile(profile),k=Math.min(1,level)*(1-.6*p.skill),t={...p.traits};
 t.riverCuriosity=clamp(t.riverCuriosity+.2*k);t.sizeSensitivity=clamp(t.sizeSensitivity-.12*k);t.bluffFrequency=clamp(t.bluffFrequency+.1*k);
 return {profile:{...p,looseness:clamp(p.looseness+.08*k),aggression:clamp(p.aggression+.12*k),traits:t},effect:{target,level}};
}
export const GRUDGE_LINES={lost:['You again.','I’ll get that back.','Not this guy again.','That’s twice now.','Enjoy it while it lasts.'],won:['Payback.','Told you I’d get it back.','That one’s mine.','Now we’re even.']};

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Grudge plays applied after the decision, against the grudge target only: stay in instead of folding
 * (calling down after the flop, defending playable hands before it) and raise more often with a
 * decent hand. Strong players feel it much less. */
export function rivalryPlay(o:BotObservation,profile:BotProfile,action:Action,grudges:Grudges|null|undefined,identityOf:(seat:number)=>string|undefined,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(!grudges||!o.ownCards||o.ownCards.length!==2||o.legal.check)return keep;
 const target=keyOpponent(o);if(target===null)return keep;
 const level=grudge(grudges,identityOf(o.actingSeat),identityOf(target));if(level<.15)return keep;
 const p=completeProfile(profile),k=Math.min(1,level)*(1-.6*p.skill),own=o.seats.find(s=>s.id===o.actingSeat)!;
 if(o.legal.callAmount>=own.stack*.5)return keep;// no grudge is worth a whole stack on its own
 if(o.street==='preflop'){
  if(action.type==='fold'&&deepRank(o.ownCards)<=.45&&draw(random)<.4*k)return {action:{type:'call'},play:'grudge-defend'};
  return keep;
 }
 const f=handFeatures(o.ownCards,o.board);
 if(action.type==='fold'&&((f.made&&!f.playsBoard)||f.drawClass!=='none'&&f.drawClass!=='backdoor')&&draw(random)<.45*k)return {action:{type:'call'},play:'grudge-call'};
 if(action.type==='call'&&f.made&&!f.playsBoard&&f.strength>=.55&&o.legal.canRaise&&draw(random)<.2*k){const facing=Math.max(...o.seats.map(s=>s.streetCommitted)),u=o.chipUnit??1,to=Math.round(facing*2.8/u)*u,cap=Math.ceil((own.streetCommitted+own.stack*.5)/u)*u-u;
  if(cap<o.legal.minRaiseTo!)return keep;
  return {action:{type:'raise',to:Math.min(cap,o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'grudge-raise'};}
 return keep;
}

/** Final sizing must not turn a rivalry-only change into a large commitment. */
export function protectRivalryExposure(o:BotObservation,candidate:Action,fallback:Action):Action {
 const own=o.seats.find(s=>s.id===o.actingSeat);if(!own)return fallback;
 const added=candidate.type==='raise'?candidate.to-own.streetCommitted:candidate.type==='call'?o.legal.callAmount:0;
 return added>=own.stack*.5?fallback:candidate;
}
