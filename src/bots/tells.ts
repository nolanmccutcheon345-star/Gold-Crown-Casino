/** Tells (patch 64). Screen only: nothing here changes a decision or the saved hand.
 * Every computer player has their own tells, the way real players do:
 * - Timing: some take a long, theatrical pause before betting a big hand; others bet it instantly. Weak
 *   players snap-call with draws.
 * - Speech: "weak means strong" actors sigh and say "I guess I'll bet" with a monster and talk tough when
 *   bluffing; quiet types go silent with a big hand and chatter when bluffing.
 * - Face and body: glancing at their chips after the board, shaking hands, looking away (strength); staring
 *   you down, leaning in with chips ready, shrugging (weakness).
 * - Fake tells: skilled players give few tells, and some of what they give is deliberately reversed.
 * Weaker players leak more and more reliably. Deterministic per decision, so a redraw shows the same
 * tell, and the session coaching can work out afterwards which tells were shown. Designed, not fitted. */
import type {Action,BotProfile,Card,GameEvent} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {startingScore} from './table-craft';

export type Meaning='strong'|'weak'|'draw';
export type TimingStyle='hollywood'|'snap';
export type SpeechStyle='actor'|'quiet'|'none';
export interface TellStyle {
 /** How often this player leaks a tell on a decision that can carry one. */
 rate:number;
 /** Share of shown tells that are deliberately reversed (skilled players only). */
 fake:number;
 timing:TimingStyle;speech:SpeechStyle;
 /** The one body cue this player gives for strength, and the one for weakness. */
 strongCue:number;weakCue:number;
}
/** Short words for the seat, while they decide. */
export const STRONG_CUES=['eyes their chips','shaky hands','looks away','goes still'] as const;
export const WEAK_CUES=['stares at you','leans in','shrugs','taps the table'] as const;
/** The same cues, as a sentence for the session coaching. */
export const CUE_PHRASES:Record<string,string>={'eyes their chips':'glanced at their chips','shaky hands':'bet with shaking hands','looks away':'looked away from the table','goes still':'went very still','stares at you':'stared you down','leans in':'leaned in with chips ready','shrugs':'shrugged and grinned','taps the table':'tapped the table'};
export const TIMING_PHRASES:Record<string,string>={'long pause, then bets':'took a long pause, then bet','bets instantly':'bet instantly','bets quickly':'bet quickly','takes a while, then bets':'took a while, then bet','snap-calls':'snap-called','thinks a long time, then calls':'thought a long time, then called'};
export const SPEECH={
 actorStrong:['I guess I’ll bet.','Probably no good, but…','Ugh. Fine, I’ll put some in.','This is probably a mistake.'],
 actorBluff:['You don’t want to call this.','I’ve got you this time.','Better fold, friend.','Easy decision for you.'],
 quietBluff:['Big pot, huh?','Your turn, buddy.','What are you gonna do?','Let’s see it.'],
 /** Facing a bet from you, while deciding. */
 askWeak:['You got it this time?','Do you have it?','Hmm. What do you have?'],
 askStrong:['How much do you have behind?','Bet’s a bet.','Interesting.'],
};
const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return h>>>0;};
const unit=(seed:string)=>hash(seed)/4294967296;
const pick=<T>(list:readonly T[],seed:string)=>list[Math.floor(unit(seed)*list.length)];

/** This player's tells. Stable for a personality. */
export function tellStyle(profile:BotProfile):TellStyle {
 const p=completeProfile(profile),id=profile.personalityId??profile.archetype,h=hash(`tells:${id}`);
 const rate=clamp(.95-1.05*p.skill,.04,.8),fake=p.skill>=.65?clamp((p.skill-.6)*1.5,0,.45):0;
 const speech:SpeechStyle=p.skill>=.75?'none':(h&3)===0?'none':(h&4)?'actor':'quiet';
 return {rate,fake,timing:(h>>3)&1?'hollywood':'snap',speech,strongCue:(h>>4)%STRONG_CUES.length,weakCue:(h>>6)%WEAK_CUES.length};
}

/** What a hand means right now: strong, weak (giving up or bluffing) or a draw. */
export function meaningOf(hole:readonly Card[],board:readonly Card[]):Meaning {
 if(board.length<3){const s=startingScore(hole);return s>=75?'strong':s<=30?'weak':'draw';}
 const f=handFeatures([...hole],[...board]);
 return f.strength>=.7?'strong':f.draw>=.25&&f.strength<.5?'draw':f.strength<.3?'weak':'draw';
}

export interface TellInput {
 handId:string;seatId:number;
 /** Number of action events in the hand before this decision: the same while deciding and afterwards. */
 index:number;street:string;board:readonly Card[];hole:readonly Card[];profile:BotProfile;action:Action;
 /** Whether the last bet or raise this street came from Hero (seat 0). */
 facingHero:boolean;
}
export interface Tells {
 meaning:Meaning;fake:boolean;
 /** Multiplier on the normal think time, when there is a timing tell. */
 timing?:number;timingLabel?:string;
 cue?:string;speech?:string;
}
const NONE:Tells=Object.freeze({meaning:'draw',fake:false}) as Tells;
/** The tells a player gives on one decision, if any. Postflop only (preflop: premium pairs shake hands). */
export function tellsFor(input:TellInput):Tells {
 if(input.hole.length!==2)return NONE;
 const st=tellStyle(input.profile),seed=`${input.handId}:${input.seatId}:${input.index}`,truth=meaningOf(input.hole,input.board);
 const a=input.action.type,aggressive=a==='raise',call=a==='call';
 if(input.street==='preflop'&&!(truth==='strong'&&aggressive))return {...NONE,meaning:truth};
 // A tell is only worth giving on a decision that matters: betting, raising or calling.
 if(!aggressive&&!call)return {...NONE,meaning:truth};
 if(unit(`${seed}:rate`)>=st.rate+(st.fake>0?.12:0))return {...NONE,meaning:truth};
 const fake=st.fake>0&&unit(`${seed}:fake`)<st.fake;
 // What the tell says; a fake says the opposite of the truth.
 const shown:Meaning=fake?(truth==='strong'?'weak':'strong'):truth;
 const out:Tells={meaning:truth,fake};
 const kind=unit(`${seed}:kind`);
 if(kind<.38){
  if(aggressive&&shown==='strong'){out.timing=st.timing==='hollywood'?1.9:.45;out.timingLabel=st.timing==='hollywood'?'long pause, then bets':'bets instantly';}
  else if(aggressive&&shown==='weak'){out.timing=st.timing==='hollywood'?.7:1.7;out.timingLabel=st.timing==='hollywood'?'bets quickly':'takes a while, then bets';}
  else if(call&&shown==='draw'){out.timing=.4;out.timingLabel='snap-calls';}
  else if(call&&shown==='strong'){out.timing=1.6;out.timingLabel='thinks a long time, then calls';}
 }
 if(!out.timing&&kind<.75&&shown!=='draw')out.cue=shown==='strong'?STRONG_CUES[st.strongCue]:WEAK_CUES[st.weakCue];
 if(!out.timing&&!out.cue&&st.speech!=='none'&&(aggressive||input.facingHero)){
  if(input.facingHero&&call)out.speech=pick(shown==='strong'?SPEECH.askStrong:SPEECH.askWeak,`${seed}:say`);
  else if(aggressive)out.speech=st.speech==='actor'?pick(shown==='strong'?SPEECH.actorStrong:SPEECH.actorBluff,`${seed}:say`):shown==='weak'?pick(SPEECH.quietBluff,`${seed}:say`):undefined;
 }
 return out.timing||out.cue||out.speech?out:{...NONE,meaning:truth};
}

/** Rebuild the input for each of one seat's past actions in a finished hand (for coaching). */
export function pastTellInputs(handId:string,events:readonly GameEvent[],board:readonly Card[],seatId:number,hole:readonly Card[],profile:BotProfile):(TellInput&{event:GameEvent})[] {
 const out:(TellInput&{event:GameEvent})[]=[],cards={preflop:0,flop:3,turn:4,river:5} as Record<string,number>;
 let index=0;const lastRaiser:Record<string,number|undefined>={};
 for(const e of events){
  if(e.type!=='action'||!e.action)continue;
  const street=e.street??'preflop';
  if(e.seatId===seatId)out.push({handId,seatId,index,street,board:board.slice(0,cards[street]??0),hole,profile,action:e.action,facingHero:lastRaiser[street]===0,event:e});
  if(e.action.type==='raise')lastRaiser[street]=e.seatId;
  index++;
 }
 return out;
}

/** The tells for the decision the acting player has just made (still to be shown), from the live hand. */
export function liveTells(game:{handId:string;street:string;board:readonly Card[];actor:number|null;events:readonly GameEvent[];seats:readonly {id:number;hole:readonly Card[]}[]},profile:BotProfile|undefined,action:Action):Tells|null {
 if(!profile||game.actor===null||game.actor===0||game.street==='complete')return null;
 const seat=game.seats.find(s=>s.id===game.actor);if(!seat||seat.hole.length!==2)return null;
 const acts=game.events.filter(e=>e.type==='action'),last=acts.filter(e=>e.street===game.street&&e.action?.type==='raise').at(-1);
 return tellsFor({handId:game.handId,seatId:seat.id,index:acts.length,street:game.street,board:game.board,hole:seat.hole,profile,action,facingHero:last?.seatId===0});
}
/** The tells shown with the latest action, if it was a computer player's. */
export function lastActionTells(game:{handId:string;board:readonly Card[];events:readonly GameEvent[];seats:readonly {id:number;hole:readonly Card[]}[]},profileAt:(seatId:number)=>BotProfile|undefined):{seatId:number;tells:Tells;event:GameEvent}|null {
 let last:GameEvent|undefined;for(let i=game.events.length-1;i>=0;i--)if(game.events[i].type==='action'){last=game.events[i];break;}
 if(!last?.action||last.seatId===undefined||last.seatId===0)return null;
 const seat=game.seats.find(s=>s.id===last!.seatId),profile=profileAt(last.seatId);if(!seat||!profile||seat.hole.length!==2)return null;
 const input=pastTellInputs(game.handId,game.events,game.board,seat.id,seat.hole,profile).find(x=>x.event===last);
 return input?{seatId:seat.id,tells:tellsFor(input),event:last}:null;
}
/** After you fold to a computer player's bet: a needle. Deterministic per hand. */
export const NEEDLES={bluffed:['Good fold.','Smart. Probably.','I’ll show you one day.','Wise choice.'],strong:['Good fold. I had it.','You were beat.','Thanks for not paying me.']};
export function needleFor(game:{handId:string;board:readonly Card[];events:readonly GameEvent[];seats:readonly {id:number;hole:readonly Card[]}[]},profileAt:(seatId:number)=>BotProfile|undefined):{seatId:number;text:string}|null {
 const acts=game.events.filter(e=>e.type==='action'),last=acts.at(-1);
 if(!last||last.seatId!==0||last.action?.type!=='fold')return null;
 const bettor=acts.filter(e=>e.street===last.street&&e.action?.type==='raise').at(-1)?.seatId;
 if(bettor===undefined||bettor===0)return null;
 const seat=game.seats.find(s=>s.id===bettor),profile=profileAt(bettor);if(!seat||!profile||seat.hole.length!==2)return null;
 const st=tellStyle(profile),seed=`${game.handId}:${bettor}:needle`;
 if(st.speech==='none'||unit(seed)>=.4)return null;
 const m=meaningOf(seat.hole,game.board);
 // Honest talkers tell the truth; actors say the opposite.
 const strongTalk=st.speech==='actor'?m!=='strong':m==='strong';
 return {seatId:bettor,text:pick(strongTalk?NEEDLES.strong:NEEDLES.bluffed,`${seed}:pick`)};
}
