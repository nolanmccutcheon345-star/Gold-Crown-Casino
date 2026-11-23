/** Reads on Hero: what computer players have seen Hero do in finished hands, and how adaptive
 * players turn those reads into exploits. Public actions only (Hero's cards are never used).
 * Designed adjustments, not a solver or a fitted model. Pure functions. */
import type {BotObservation,BotProfile,GameEvent} from '../contracts';
import {completeProfile,clamp} from './profiles';

export interface Rate {count:number;chances:number;}
export interface HeroReads {
 hands:number;
 /** Folded a blind to a late-position steal. */foldBlinds:Rate;
 /** Folded to a flop continuation bet after calling before the flop. */foldToCbet:Rate;
 /** Folded an opening raise to a re-raise. */foldTo3bet:Rate;
 /** Called or re-shoved when facing an all-in before the flop. */callAllIn:Rate;
 /** With 12 BB or less and first in: moved all-in. */shortShove:Rate;
 /** After the flop: raises among raises and calls. */aggression:Rate;
 /** Reached showdown after seeing the flop. */wtsd:Rate;
}
/** The shape both saved hand views and full game states share. */
export interface ReadableHand {events:readonly GameEvent[];seats:readonly {id:number;startingStack:number;folded:boolean}[];button:number;smallBlindSeat?:number;bigBlindSeat?:number;board:readonly string[];profile:{bigBlind:number};}
const zero=():Rate=>({count:0,chances:0});
export const emptyReads=():HeroReads=>({hands:0,foldBlinds:zero(),foldToCbet:zero(),foldTo3bet:zero(),callAllIn:zero(),shortShove:zero(),aggression:zero(),wtsd:zero()});
const hit=(r:Rate,yes:boolean)=>{r.chances++;if(yes)r.count++;};

function position(hand:ReadableHand,seat:number):string {
 const dealt=hand.seats.filter(s=>s.startingStack>0).map(s=>s.id).sort((a,b)=>a-b),n=dealt.length;
 const sb=hand.smallBlindSeat??hand.events.find(e=>e.type==='blind'&&(e.amount??0)<hand.profile.bigBlind)?.seatId;
 const bb=hand.bigBlindSeat??hand.events.find(e=>e.type==='blind'&&e.seatId!==sb)?.seatId;
 if(seat===sb)return 'SB';if(seat===bb)return 'BB';if(seat===hand.button)return 'BTN';
 const clockwise=dealt.filter(id=>id>hand.button).concat(dealt.filter(id=>id<=hand.button));
 return n>2&&seat===clockwise.filter(id=>id!==hand.button).at(-1)?'CO':'EP';
}
/** Add one finished hand to the reads on `hero`. */
export function addHand(reads:HeroReads,hand:ReadableHand,hero=0):void {
 const me=hand.seats.find(s=>s.id===hero);if(!me||me.startingStack<=0)return;
 reads.hands++;
 const bb=hand.profile.bigBlind,acts=hand.events.filter(e=>e.type==='action'),pre=acts.filter(e=>e.street==='preflop');
 const stack=(id:number)=>hand.seats.find(s=>s.id===id)?.startingStack??0;
 const antes=new Map<number,number>();for(const e of hand.events)if(e.type==='ante'&&e.seatId!==undefined)antes.set(e.seatId,(antes.get(e.seatId)??0)+(e.amount??0));
 const allIn=(e:GameEvent)=>e.action?.type==='raise'&&e.action.to===stack(e.seatId!)-(antes.get(e.seatId!)??0);
 let raises=0,limps=0,shove=false,opener:number|null=null,heroOpened=false,stealer=false,lastRaiser:number|null=null;const acted=new Set<number>();
 for(const e of pre){
  const id=e.seatId!,t=e.action!.type,first=!acted.has(id);acted.add(id);
  if(id===hero){
   const pos=position(hand,hero);
   if(first&&raises===0&&limps===0&&pos!=='BB'&&me.startingStack/bb<=12)hit(reads.shortShove,allIn(e));
   if(first&&raises===1&&stealer&&!shove&&(pos==='SB'||pos==='BB'))hit(reads.foldBlinds,t==='fold');
   if(shove)hit(reads.callAllIn,t!=='fold');
   else if(heroOpened&&raises===2)hit(reads.foldTo3bet,t==='fold');
  }
  if(t==='raise'){
   if(raises===0&&limps===0){opener=id;heroOpened=id===hero;stealer=['CO','BTN','SB'].includes(position(hand,id))&&id!==hero;}
   raises++;lastRaiser=id;if(allIn(e))shove=true;
  }else if(t==='call'&&raises===0)limps++;
 }
 const sawFlop=hand.board.length>=3&&!pre.some(e=>e.seatId===hero&&e.action!.type==='fold');
 if(!sawFlop)return;
 const post=acts.filter(e=>e.street!=='preflop'&&e.seatId===hero);
 for(const e of post)if(e.action!.type==='raise'||e.action!.type==='call')hit(reads.aggression,e.action!.type==='raise');
 const others=hand.seats.filter(s=>s.startingStack>0&&s.id!==hero&&!s.folded).length;
 hit(reads.wtsd,!me.folded&&others>0);
 // Facing the preflop raiser's first flop bet after calling before the flop.
 if(lastRaiser!==null&&lastRaiser!==hero&&opener!==null){
  const flop=acts.filter(e=>e.street==='flop'),bet=flop.findIndex(e=>e.seatId===lastRaiser&&e.action!.type==='raise');
  if(bet>=0&&flop.slice(0,bet).every(e=>e.action!.type==='check')){const reply=flop.slice(bet+1).find(e=>e.seatId===hero);if(reply)hit(reads.foldToCbet,reply.action!.type==='fold');}
 }
}
export function readsFromHands(hands:Iterable<ReadableHand>,hero=0):HeroReads {const r=emptyReads();for(const h of hands)addHand(r,h,hero);return r;}
export function mergeReads(a:HeroReads,b:HeroReads):HeroReads {
 const m=(x:Rate,y:Rate)=>({count:x.count+y.count,chances:x.chances+y.chances});
 return {hands:a.hands+b.hands,foldBlinds:m(a.foldBlinds,b.foldBlinds),foldToCbet:m(a.foldToCbet,b.foldToCbet),foldTo3bet:m(a.foldTo3bet,b.foldTo3bet),callAllIn:m(a.callAllIn,b.callAllIn),shortShove:m(a.shortShove,b.shortShove),aggression:m(a.aggression,b.aggression),wtsd:m(a.wtsd,b.wtsd)};
}
/** Typical rates the adjustments measure Hero against (designed reference values). */
export const REFERENCE={foldBlinds:.6,foldToCbet:.45,foldTo3bet:.55,callAllIn:.3,shortShove:.6,aggression:.35,wtsd:.3} as const;
/** How far Hero is from typical on one stat, shrunk toward zero with few chances (−1 … 1 scale). */
export function lean(r:Rate,reference:number,prior=25):number {if(!r.chances)return 0;return clamp((r.count/r.chances-reference)*(r.chances/(r.chances+prior))*2,-1,1);}
/** How much a personality exploits reads: strong adaptive regulars fully, recreational players hardly. */
export function exploitStrength(profile:BotProfile):number {const p=completeProfile(profile);return clamp(p.traits.adaptation*p.skill*1.25);}

export interface ReadsEffect {leans:Record<keyof typeof REFERENCE,number>;applied:string[];}
/** The same player adjusted to exploit what they have seen Hero do, when Hero is in this hand. */
export function readsProfile(observation:BotObservation,profile:BotProfile,reads:HeroReads|null|undefined,hero=0):{profile:BotProfile;effect:ReadsEffect|null} {
 if(!reads||reads.hands<10||observation.actingSeat===hero)return {profile,effect:null};
 const heroSeat=observation.seats.find(s=>s.id===hero);if(!heroSeat||heroSeat.folded)return {profile,effect:null};
 const k=exploitStrength(profile);if(k<.05)return {profile,effect:null};
 const p=completeProfile(profile),t={...p.traits},leans={foldBlinds:lean(reads.foldBlinds,REFERENCE.foldBlinds),foldToCbet:lean(reads.foldToCbet,REFERENCE.foldToCbet),foldTo3bet:lean(reads.foldTo3bet,REFERENCE.foldTo3bet),callAllIn:lean(reads.callAllIn,REFERENCE.callAllIn),shortShove:lean(reads.shortShove,REFERENCE.shortShove),aggression:lean(reads.aggression,REFERENCE.aggression),wtsd:lean(reads.wtsd,REFERENCE.wtsd)};
 const o=observation,pre=o.street==='preflop',raises=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise');
 const heroActs=o.publicEvents.filter(e=>e.type==='action'&&e.seatId===hero&&e.street===o.street);
 const applied:string[]=[];let looseness=p.looseness,aggression=p.aggression;
 // Hero still to act in the blinds behind an unopened pot: steal more if Hero gives up blinds.
 const heroBlind=(()=>{const sb=o.publicEvents.find(e=>e.type==='blind'&&e.seatId===hero);return !!sb;})();
 if(pre&&!raises.length&&heroBlind&&!heroActs.length&&leans.foldBlinds!==0){looseness=clamp(looseness+.3*k*leans.foldBlinds);t.positionAwareness=clamp(t.positionAwareness+.2*k*leans.foldBlinds);t.bluffFrequency=clamp(t.bluffFrequency+.2*k*leans.foldBlinds);applied.push('steal');}
 // Hero opened and this player can re-raise: 3-bet more if Hero folds to 3-bets.
 if(pre&&raises.length===1&&raises[0].seatId===hero&&leans.foldTo3bet!==0){aggression=clamp(aggression+.25*k*leans.foldTo3bet);t.bluffFrequency=clamp(t.bluffFrequency+.2*k*leans.foldTo3bet);applied.push('3bet');}
 // Shoving into Hero: wider if Hero rarely calls all-ins; calling Hero's shove: wider if Hero shoves wide.
 if(pre&&leans.callAllIn!==0&&!raises.some(e=>e.seatId===hero)){t.riskTolerance=clamp(t.riskTolerance-.3*k*leans.callAllIn);applied.push('shove');}
 if(pre&&raises.some(e=>e.seatId===hero)&&heroSeat.allIn&&leans.shortShove!==0){t.riskTolerance=clamp(t.riskTolerance+.35*k*leans.shortShove);t.drawCalling=clamp(t.drawCalling+.2*k*leans.shortShove);applied.push('call-shove');}
 if(!pre){
  // Bluff more into folders, less into callers; value-bet thinner against callers.
  const folds=(leans.foldToCbet-leans.wtsd)/2;
  if(folds!==0){t.bluffFrequency=clamp(t.bluffFrequency+.3*k*folds);t.valueThreshold=clamp(t.valueThreshold+.12*k*folds);applied.push(folds>0?'bluff-more':'value-thin');}
  // Call down an aggressive Hero more; fold more to a passive Hero's raises.
  if(heroActs.some(e=>e.action?.type==='raise')&&leans.aggression!==0){t.riverCuriosity=clamp(t.riverCuriosity+.25*k*leans.aggression);t.drawCalling=clamp(t.drawCalling+.15*k*leans.aggression);t.sizeSensitivity=clamp(t.sizeSensitivity-.2*k*leans.aggression);applied.push(leans.aggression>0?'call-down':'respect-raises');}
 }
 if(!applied.length)return {profile,effect:null};
 return {profile:{...p,looseness,aggression,traits:t},effect:{leans,applied}};
}
/** Structural check for reads saved on an event. */
export function validReads(value:unknown):value is HeroReads {
 if(!value||typeof value!=='object')return false;const r=value as Record<string,unknown>;
 if(!Number.isSafeInteger(r.hands)||(r.hands as number)<0)return false;
 return (Object.keys(REFERENCE) as (keyof typeof REFERENCE)[]).every(k=>{const x=r[k] as Rate|undefined;return !!x&&Number.isSafeInteger(x.count)&&Number.isSafeInteger(x.chances)&&x.count>=0&&x.count<=x.chances;})&&Object.keys(r).length===8;
}
