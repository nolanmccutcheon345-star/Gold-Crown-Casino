import {isGesture} from '../bots/banter';
/** Table talk and shown hands on the screen, for the cash table and tournaments. */
import type {BotProfile,GameState} from '../contracts';
import {lastActionTells,needleFor} from '../bots/tells';
import {QUIET,actionChatter,handChatter,regularOfProfile,type Chatter,type ShownHand,type TalkLine,type TournamentMoment} from '../bots/talk';

const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const TABLE_TALK_KEY='poker-night-ai:table-talk';
/** On unless the player turned it off. Storage can be unavailable; then it stays on for the visit. */
export function readTableTalk():boolean {try{return localStorage.getItem(TABLE_TALK_KEY)!=='off';}catch{return true;}}
export function saveTableTalk(on:boolean):void {try{localStorage.setItem(TABLE_TALK_KEY,on?'on':'off');}catch{/* keep for this visit only */}}
export const shownHand=(chatter:Chatter,seatId:number):ShownHand|undefined=>chatter.shows.find(show=>show.seatId===seatId);
/** A speech bubble for a seat's line. Patch 58: typing dots first, then the words; speakers take turns in line order. */
const talkText=(text:string)=>isGesture(text)?`<span class="talk-text talk-gesture"><i>${escape(text.slice(1,-1))}</i></span>`:`<span class="talk-text">“${escape(text)}”</span>`;
export function talkMarkup(chatter:Chatter,seatId:number):string {
 const mine=chatter.lines.map((row,i)=>({row,i})).filter(x=>x.row.seatId===seatId);
 if(!mine.length)return '';
 // Patch 97: a player who speaks more than once (a conversation going back and forth) keeps one bubble whose words
 // change in turn; lines are spaced further apart so each one can be read.
 const turns=new Set(chatter.lines.map(l=>l.seatId)).size<chatter.lines.length,step=turns?'--talk-step:1.9s;':'';
 if(mine.length===1)return `<span class="seat-talk" style="${step}--talk-i:${mine[0].i}"><i class="talk-dots" aria-hidden="true"><b></b><b></b><b></b></i>${talkText(mine[0].row.text)}</span>`;
 const parts=mine.map((x,k)=>talkText(x.row.text).replace('class="talk-text','class="talk-text'+(k<mine.length-1?' talk-earlier':''),).replace('<span ',`<span style="--talk-i:${x.i}${k<mine.length-1?`;--talk-next:${mine[k+1].i}`:''}" `));
 return `<span class="seat-talk talk-turns" style="${step}--talk-i:${mine[0].i}"><i class="talk-dots" aria-hidden="true"><b></b><b></b><b></b></i><span class="talk-seq">${parts.join('')}</span></span>`;
}
const cache=new Map<string,Chatter>();
/** Chatter for a completed hand. `profileAt` gives each computer seat's profile (undefined for Hero). */
export function chatterFor(game:GameState|null|undefined,profileAt:(seatId:number)=>BotProfile|undefined,tournament:boolean,on:boolean,grudgeAt?:(seatId:number)=>number,moment?:TournamentMoment|null,allowMisreadTalk=false):Chatter {
 if(!on||!game||game.street!=='complete')return QUIET;
 const levels=grudgeAt?game.seats.map(s=>[s.id,grudgeAt(s.id)]):null,key=grudgeAt?JSON.stringify({game,profiles:game.seats.map(s=>[s.id,profileAt(s.id)]),tournament,levels,moment:moment??null,allowMisreadTalk}):`${game.handId}:${game.revision}:${moment??''}:${allowMisreadTalk?'misread':'legacy'}`,hit=cache.get(key);if(hit)return hit;
 const personas:Record<number,{name:string;profile:BotProfile;regular?:string}>={};
 for(const seat of game.seats){if(seat.id===0)continue;const profile=profileAt(seat.id);if(profile)personas[seat.id]={name:seat.name,profile,regular:regularOfProfile(profile)};}
 let chatter:Chatter=QUIET;try{chatter=handChatter(game,personas,{tournament,grudgeAt,moment,allowMisreadTalk});}catch{chatter=QUIET;}
 if(cache.size>40)cache.clear();cache.set(key,chatter);return chatter;
}

/** Patch 59: a mid-hand line from the player who just acted, if any. Off with table talk off. */
export function quipFor(game:GameState|null|undefined,profileAt:(seatId:number)=>BotProfile|undefined,on:boolean):TalkLine|null {
 if(!on||!game||game.street==='complete')return null;
 const personas:Record<number,{name:string;profile:BotProfile;regular?:string}>={};
 for(const seat of game.seats){if(seat.id===0)continue;const profile=profileAt(seat.id);if(profile)personas[seat.id]={name:seat.name,profile,regular:regularOfProfile(profile)};}
 try{
  // Patch 64: a needle after you fold to a bet, or a speech tell, comes before ordinary chatter.
  const needle=needleFor(game,profileAt);if(needle)return needle;
  const told=lastActionTells(game,profileAt);if(told?.tells.speech&&told.event.action?.type==='raise')return {seatId:told.seatId,text:told.tells.speech};
  return actionChatter(game,personas);
 }catch{return null;}
}
export const quipMarkup=(line:TalkLine|null,seatId:number,key:string):string=>line&&line.seatId===seatId?`<span class="seat-quip${isGesture(line.text)?' quip-gesture':''}" data-quip="${escape(key)}">${escape(isGesture(line.text)?line.text.slice(1,-1):line.text)}</span>`:'';

/** Patch 94: names and regulars of the computer seats, for the banter lines. */
export function namesAt(game:GameState,profileAt:(seatId:number)=>BotProfile|undefined):(seatId:number)=>{name:string;regular?:string}|undefined {
 return id=>{if(id===0)return undefined;const seat=game.seats.find(s=>s.id===id),profile=profileAt(id);return seat&&profile?{name:seat.name,regular:regularOfProfile(profile)}:undefined;};
}
/** Patch 95: something you said at the table and the answers, shared by every game mode. Display only. */
export interface HeroSaid {at:number;phrase:string;replies:TalkLine[];}
export const HERO_SAY_MS=5600;
const bubble=(text:string,cls:string,testid:string,delay:number)=>{const g=isGesture(text);return `<span class="seat-quip ${cls}${g?' quip-gesture':''}" data-testid="${testid}" style="animation-delay:${delay}s">${escape(g?text.slice(1,-1):text)}</span>`;};
/** The bubbles for one seat: yours on your seat, each answer on the answering seat, one after another. */
export function heroSaidMarkup(said:HeroSaid|null,seatId:number,heroId=0):string {
 if(!said)return '';
 if(seatId===heroId)return bubble(said.phrase,'hero-say','hero-say',0);
 const i=said.replies.findIndex(r=>r.seatId===seatId);
 return i<0?'':bubble(said.replies[i].text,'hero-reply','hero-reply',1+1.1*i);
}
/** The row of things you can say. `attr` is the data attribute the app listens for. */
export function quickChatRow(phrases:readonly string[],attr='data-say',said?:HeroSaid|null):string {
 return `<div class="quick-chat" role="group" aria-label="Say something to the table" data-testid="quick-chat">${phrases.map(p=>`<button type="button" class="quick-chat-btn" ${attr}="${escape(p)}">${escape(p)}</button>`).join('')}${said?`<span class="quick-chat-said" data-testid="quick-chat-said">You: “${escape(said.phrase)}”</span>`:''}</div>`;
}

/** Patch 97: answers to a question a player asked you. */
export function answerRow(labels:readonly string[],mode:string,asker:string):string {
 return `<div class="quick-chat quick-answers" role="group" aria-label="Answer ${escape(asker)}" data-testid="quick-answers"><span class="quick-answers-label">Answer ${escape(asker)}:</span>${labels.map((l,i)=>`<button type="button" class="quick-chat-btn answer-btn" data-answer="${i}" data-answer-mode="${escape(mode)}">${escape(l)}</button>`).join('')}</div>`;
}
