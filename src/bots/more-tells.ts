/** Patch 87: more tells. Screen only: nothing here changes a decision, a card or the saved hand.
 * Two kinds that real players give away when it is not their turn:
 * - Waiting tells, while you decide: a player still to act behind you already has cards ready to throw away
 *   (weak), or already has chips in hand (strong). These are the most reliable tells in live poker, because the
 *   player has not been asked anything yet.
 * - Board reactions, when the flop, turn or river comes: a player who holds one card of a suit rechecks their cards
 *   when the board shows a third card of that suit (they are checking whether they have the flush, so they usually
 *   do not); a player whose hand just got strong perks up; a player who just missed slumps.
 * Each player's tell rate and fake rate come from their tell style (tells.ts): weak players leak more and more
 * honestly, skilled players rarely, and sometimes act. Deterministic per hand, seat and street. */
import type {BotProfile,Card,GameEvent} from '../contracts';
import {tellStyle,meaningOf,type Meaning} from './tells';
import {startingScore} from './table-craft';

export type SideKind='waiting'|'board';
export interface SideTell {seatId:number;kind:SideKind;text:string;
 /** What the tell suggests. */
 says:Meaning;
 /** What the hand really is (kept for coaching after showdown; never shown before). */
 truth:Meaning;fake:boolean}

export const WAITING_TELLS={weak:['cards ready to muck','looking away, bored'],strong:['chips already in hand','watching you closely']} as const;
export const BOARD_TELLS={recheck:'rechecks their cards',perk:'perks up',slump:'slumps a little'} as const;
/** Short guide to every tell, for the coach page. */
export const TELL_GUIDE:{tell:string;usually:string;when:string}[]=[
 {tell:'Cards ready to muck',usually:'Weak: about to fold',when:'Before their turn, while you decide'},
 {tell:'Looking away, bored',usually:'Weak: not interested in the pot',when:'Before their turn'},
 {tell:'Chips already in hand',usually:'Strong: ready to call or raise',when:'Before their turn'},
 {tell:'Watching you closely',usually:'Strong: hoping you bet',when:'Before their turn'},
 {tell:'Rechecks their cards',usually:'No flush yet: checking for one card of the suit',when:'A third card of one suit lands'},
 {tell:'Perks up',usually:'The new card helped them',when:'The flop, turn or river'},
 {tell:'Slumps a little',usually:'They missed',when:'The flop, turn or river'},
 {tell:'Eyes their chips / looks away / goes still / shaky hands',usually:'Strength',when:'While betting'},
 {tell:'Stares you down / leans in / shrugs / taps the table',usually:'Weakness',when:'While betting'},
 {tell:'A long pause, then a big bet',usually:'Often strength from an actor; check how this player times things',when:'While betting'},
 {tell:'Snap-calls',usually:'A draw, most of the time',when:'Facing a bet'},
 {tell:'“I guess I’ll bet”',usually:'Weak talk, strong hand: the classic act',when:'While betting'},
];

const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return h>>>0;};
const unit=(seed:string)=>hash(seed)/4294967296;

export interface SideGame {handId:string;street:string;board:readonly Card[];actor:number|null;events:readonly GameEvent[];
 seats:readonly {id:number;hole:readonly Card[];folded:boolean;allIn:boolean;stack:number}[]}
const BOARD_AT:Record<string,number>={flop:3,turn:4,river:5};

/** Players who have not acted yet this street and will act after Hero. */
function stillToAct(g:SideGame,hero:number):number[] {
 const acted=new Set(g.events.filter(e=>e.type==='action'&&e.street===g.street).map(e=>e.seatId));
 return g.seats.filter(s=>s.id!==hero&&!s.folded&&!s.allIn&&s.stack>0&&s.hole.length===2&&!acted.has(s.id)).map(s=>s.id);
}
function waiting(g:SideGame,seatId:number,hole:readonly Card[],profile:BotProfile):SideTell|null {
 const st=tellStyle(profile),seed=`${g.handId}:${seatId}:${g.street}:waiting`;
 const truth:Meaning=g.board.length<3?(startingScore(hole)>=75?'strong':startingScore(hole)<=40?'weak':'draw'):meaningOf(hole,g.board);
 if(truth==='draw'||unit(`${seed}:rate`)>=st.rate*.7)return null;
 const fake=st.fake>0&&unit(`${seed}:fake`)<st.fake,says:Meaning=fake?(truth==='strong'?'weak':'strong'):truth;
 const list=says==='strong'?WAITING_TELLS.strong:WAITING_TELLS.weak;
 return {seatId,kind:'waiting',text:list[Math.floor(unit(`${seed}:pick`)*list.length)],says,truth,fake};
}
function flushRecheck(board:readonly Card[],hole:readonly Card[]):boolean {
 if(board.length<3)return false;
 const newest=board[board.length-1][1],count=board.filter(c=>c[1]===newest).length;
 return count===3&&hole.filter(c=>c[1]===newest).length===1;
}
/** The reaction a player gives to this street's new card(s), if any. */
export function boardTell(g:{handId:string;street:string;board:readonly Card[]},seatId:number,hole:readonly Card[],profile:BotProfile):SideTell|null {
 const n=BOARD_AT[g.street];if(!n||g.board.length!==n||hole.length!==2)return null;
 const st=tellStyle(profile),seed=`${g.handId}:${seatId}:${g.street}:board`;
 const now=meaningOf(hole,g.board),before=n===3?(startingScore(hole)>=75?'strong':'draw'):meaningOf(hole,g.board.slice(0,n-1));
 if(flushRecheck(g.board,hole)&&unit(`${seed}:recheck`)<.25+.6*st.rate)return {seatId,kind:'board',text:BOARD_TELLS.recheck,says:now==='strong'?'draw':now,truth:now,fake:false};
 if(unit(`${seed}:rate`)>=st.rate*.6)return null;
 const fake=st.fake>0&&unit(`${seed}:fake`)<st.fake;
 if(now==='strong'&&before!=='strong')return fake?{seatId,kind:'board',text:BOARD_TELLS.slump,says:'weak',truth:now,fake}:{seatId,kind:'board',text:BOARD_TELLS.perk,says:'strong',truth:now,fake};
 if(now==='weak'&&before!=='weak')return fake?{seatId,kind:'board',text:BOARD_TELLS.perk,says:'strong',truth:now,fake}:{seatId,kind:'board',text:BOARD_TELLS.slump,says:'weak',truth:now,fake};
 return null;
}
/** Tells from players other than the one acting: waiting tells while Hero decides, and board reactions until the
 * player acts on the street. At most one per seat; waiting tells win. */
export function sideTells(g:SideGame,profileAt:(seatId:number)=>BotProfile|undefined,hero=0):Map<number,SideTell> {
 const out=new Map<number,SideTell>();
 if(g.street==='complete')return out;
 const acted=new Set(g.events.filter(e=>e.type==='action'&&e.street===g.street).map(e=>e.seatId));
 if(g.actor===hero)for(const id of stillToAct(g,hero)){const seat=g.seats.find(s=>s.id===id)!,p=profileAt(id);if(!p)continue;const t=waiting(g,id,seat.hole,p);if(t)out.set(id,t);}
 for(const seat of g.seats){
  if(seat.id===hero||out.has(seat.id)||seat.folded||acted.has(seat.id)||seat.id===g.actor)continue;
  const p=profileAt(seat.id);if(!p)continue;const t=boardTell(g,seat.id,seat.hole,p);if(t)out.set(seat.id,t);
 }
 return out;
}
export const sideTellMarkup=(t:SideTell|undefined,escape:(s:string)=>string)=>t?`<span class="side-tell side-${t.kind}" data-testid="side-tell">${escape(t.text)}</span>`:'';
