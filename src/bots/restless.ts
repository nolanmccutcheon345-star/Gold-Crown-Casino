/** Patch 77: the restless side of a long session. Display only: these lines never change a decision.
 * - Card dead: a player who has folded before the flop hand after hand says so.
 * - Fatigue: deep into a long session or event, someone yawns, asks for coffee or loses track of the level.
 * - Short stack (tournaments): a player with few big blinds left says they need a spot.
 * Lines are picked from the hand id, so a hand always says the same thing. */
import type {GameState} from '../contracts';
import type {Chatter} from './talk';

export const CARD_DEAD=['I haven’t seen a playable hand in an hour.','Card dead. Again.','Seven-deuce, seven-deuce, seven-deuce…','Can somebody shuffle these properly?','I forgot what aces look like.'];
export const TIRED=['Long day.','I need coffee.','My eyes are going.','What level is it?','One more orbit and I’m done.','Is it really that late?'];
export const SHORT=['I’m short. Gotta find a spot.','Need a double up here.','Running out of time.','Any ace, any king, I’m going.'];
export const CARD_DEAD_HANDS=14,TIRED_FROM=150;

const unit=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h/4294967296;};
const pick=(list:readonly string[],key:string)=>list[Math.floor(unit(key)*list.length)%list.length];

/** Whether a seat played the hand without putting chips in voluntarily before the flop (folding, or checking the big blind). */
export function foldedPreflop(game:Pick<GameState,'events'>,seat:number):boolean {
 const acts=game.events.filter(e=>e.type==='action'&&e.seatId===seat);
 const pre=acts.filter(e=>(e.street??'preflop')==='preflop');
 return pre.length>0&&pre.every(e=>e.action?.type==='fold'||e.action?.type==='check');
}
/** Consecutive earlier hands (newest first) in which this seat folded before the flop. */
export interface PastHand {events:GameState['events'];seats:readonly {id:number;startingStack:number}[]}
export function foldStreak(previous:readonly PastHand[],seat:number,sameSeat:(index:number)=>boolean=()=>true):number {
 let n=0;for(let i=previous.length-1;i>=0;i--){if(!sameSeat(i)||!previous[i].seats.some(s=>s.id===seat&&s.startingStack>0))break;if(!foldedPreflop(previous[i],seat))break;n++;}return n;
}

export interface RestlessContext {streak:(seat:number)=>number;handsPlayed:number;tournament:boolean}
/** At most one restless line for a finished hand, from a computer player who was not already talking. */
export function restlessLine(game:GameState,talkers:readonly number[],ctx:RestlessContext,hero=0):{seatId:number;text:string}|null {
 if(game.street!=='complete')return null;
 const seats=game.seats.filter(s=>s.id!==hero&&s.startingStack>0&&!talkers.includes(s.id));
 for(const s of seats){
  if(foldedPreflop(game,s.id)&&ctx.streak(s.id)+1>=CARD_DEAD_HANDS&&unit(`${game.handId}:${s.id}:dead`)<.3)return {seatId:s.id,text:pick(CARD_DEAD,`${game.handId}:${s.id}:deadline`)};
 }
 if(ctx.tournament){const bb=game.profile.bigBlind;for(const s of seats)if(s.stack>0&&s.stack<10*bb&&unit(`${game.handId}:${s.id}:short`)<.1)return {seatId:s.id,text:pick(SHORT,`${game.handId}:${s.id}:shortline`)};}
 if(ctx.handsPlayed>=TIRED_FROM&&seats.length&&unit(`${game.handId}:tired`)<.04){const s=seats[Math.floor(unit(`${game.handId}:tiredwho`)*seats.length)%seats.length];return {seatId:s.id,text:pick(TIRED,`${game.handId}:tiredline`)};}
 return null;
}
/** The usual chatter plus a restless line when fewer than two players spoke. */
export function withRestless(chatter:Chatter,game:GameState|null|undefined,ctx:RestlessContext|null):Chatter {
 if(!game||!ctx||chatter.lines.length>=2)return chatter;
 const line=restlessLine(game,chatter.lines.map(l=>l.seatId),ctx);
 return line?{...chatter,lines:[...chatter.lines,line]}:chatter;
}
