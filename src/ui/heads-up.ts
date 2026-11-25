/** Patch 73: the heads-up challenge. Ten regulars in order of difficulty; beat one to unlock the next. A match is an
 * ordinary $1/$2 cash session with two seats, 100 big blinds each, no top-ups and nobody joining or leaving. It ends
 * when someone is out of chips, or after MATCH_HANDS hands with the chip leader winning. Your money result counts in
 * your cash results like any session; only the ladder progress is kept here, on this device. */
import {facesFor} from './face-hook';
import type {AppData,CashSettings} from '../session/types';
import {regularById,regularConfig} from '../bots/regulars';

export const LADDER_IDS=['sal','big-earl','frank','tex','marco','dante','priya','ana','viktor','hiro'] as const;
export const MATCH_HANDS=150;
const KEY='poker-night-ai:heads-up';

export interface MatchRecord {opponent:string;rung:number;won:boolean;hands:number;net:number;at:string;sessionId:string;how:'bust'|'hands'|'left'}
export interface LadderState {beaten:string[];matches:MatchRecord[]}
export function readLadder():LadderState {try{const v=JSON.parse(localStorage.getItem(KEY)??'null');if(v&&Array.isArray(v.beaten)&&Array.isArray(v.matches))return {beaten:v.beaten.filter((id:unknown)=>typeof id==='string'),matches:v.matches.slice(-200)};}catch{/* fresh */}return {beaten:[],matches:[]};}
export function saveLadder(state:LadderState):void {try{localStorage.setItem(KEY,JSON.stringify({beaten:state.beaten,matches:state.matches.slice(-200)}));}catch{/* this visit only */}}
/** The next rung to play: the first one not yet beaten. */
export const nextRung=(state:LadderState)=>{const i=LADDER_IDS.findIndex(id=>!state.beaten.includes(id));return i<0?LADDER_IDS.length:i;};

/** Table settings for a match, from the ordinary $1/$2 table. */
export function matchSettings(base:CashSettings,rung:number):CashSettings {
 const id=LADDER_IDS[rung];if(!id)throw Error('No such rung.');
 const bb=base.bigBlind;
 return {...structuredClone(base),seats:2,capacity:2,occupiedSeatIds:[0,1],opponents:[regularConfig(id)],seatNames:undefined,seatStacks:undefined,buyIn:100*bb,minBuyInBB:Math.min(base.minBuyInBB,100),maxBuyInBB:Math.max(base.maxBuyInBB,100),allowTopUp:false,liveStraddle:false,challenge:{rung,opponent:id}};
}

export interface MatchState {sessionId:string;rung:number;opponent:string;name:string;hands:number;hero:number;villain:number;over:boolean;won:boolean;how:MatchRecord['how']|null;net:number}
/** Where the current (or just-ended) challenge session stands. */
export function matchState(data:AppData):MatchState|null {
 const active=data.active,session=active?data.sessions.find(s=>s.id===active.sessionId):data.sessions.at(-1);
 const c=session?.settings.challenge;if(!session||!c)return null;
 const ids=new Set(session.handIds),hands=data.hands.filter(h=>ids.has(h.id));
 const last=active?(active.game.street==='complete'?active.game:null):null;
 const seat=(id:number)=>active?active.game.seats.find(s=>s.id===id)?.stack??0:(hands.at(-1)?.view.seats.find(s=>s.id===id)?.stack??0);
 const hero=seat(0),villain=seat(1),played=session.handIds.length,known=!!active||hands.length>0,between=known&&(!active||!!last);
 const bust=between&&(hero===0||villain===0),limit=between&&played>=MATCH_HANDS;
 const over=bust||limit||!active;
 const how:MatchState['how']=bust?'bust':limit?'hands':!active?'left':null;
 const net=hands.reduce((a,h)=>a+h.net,0);
 return {sessionId:session.id,rung:c.rung,opponent:c.opponent,name:regularById(c.opponent)?.name??c.opponent,hands:played,hero,villain,over,won:over&&(how==='bust'?villain===0:how==='hands'?hero>villain:false),how,net};
}
/** Records a finished match once. Returns the record when it is new. */
export function recordMatch(state:LadderState,m:MatchState,at=new Date().toISOString()):MatchRecord|null {
 if(!m.over||state.matches.some(r=>r.sessionId===m.sessionId))return null;
 const record:MatchRecord={opponent:m.opponent,rung:m.rung,won:m.won,hands:m.hands,net:m.net,at,sessionId:m.sessionId,how:m.how??'left'};
 state.matches.push(record);if(m.won&&!state.beaten.includes(m.opponent))state.beaten.push(m.opponent);
 return record;
}

const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const dollars=(cents:number)=>`${cents<0?'−':''}$${Math.abs(Math.round(cents/100)).toLocaleString('en-US')}`;

export function ladderMarkup(state:LadderState,opts:{busy:boolean;tableOpen:boolean;bankroll:number;buyIn:number;last:MatchRecord|null;notice?:string}):string {
 const next=nextRung(state);
 /* Each opponent's own table face: the ladder lists them one at a time, so no table sharing applies. */
 const one=(name:string)=>facesFor([name]);
 const rows=LADDER_IDS.map((id,i)=>{const r=regularById(id)!,faces=one(r.name);const beaten=state.beaten.includes(id),current=i===next,locked=i>next;
  const record=state.matches.filter(m=>m.opponent===id),wins=record.filter(m=>m.won).length;
  return `<li class="hu-rung${beaten?' beaten':''}${current?' current':''}${locked?' locked':''}"><div class="hu-rung-head"><span class="hu-step">${i+1}</span>${faces?`<span class="hu-face" aria-hidden="true">${faces(r.name)}</span>`:''}<b>${esc(r.name)}</b><span class="hu-style">${esc(r.style)}</span><span class="hu-mark">${beaten?'Beaten':current?'Next':'Locked'}</span></div>${locked?'':`<p>${esc(r.read)}</p>`}${record.length?`<small>${wins}–${record.length-wins} in matches · ${dollars(record.reduce((a,m)=>a+m.net,0))}</small>`:''}${current||beaten?`<button type="button" class="button ${current?'primary':'secondary'}" data-hu-rung="${i}" ${opts.tableOpen||opts.bankroll<opts.buyIn?'disabled':''}>${beaten?'Rematch':'Challenge'} ${esc(r.name)}</button>`:''}</li>`;}).join('');
 const last=opts.last?`<p class="hu-last ${opts.last.won?'won':'lost'}" role="status" data-testid="hu-last">${opts.last.won?`You beat ${esc(regularById(opts.last.opponent)?.name??'')}`:`${esc(regularById(opts.last.opponent)?.name??'')} won`} ${opts.last.how==='bust'?'by busting the other player':opts.last.how==='hands'?`on chips after ${opts.last.hands} hands`:'(you left the match)'} · ${dollars(opts.last.net)}.</p>${opts.last.won?'':`<p class="hu-grudge"><button type="button" class="button secondary" data-hu-rung="${opts.last.rung}" ${opts.tableOpen||opts.bankroll<opts.buyIn?'disabled':''}>Rematch ${esc(regularById(opts.last.opponent)?.name??'')}</button> <span>Settle it.</span></p>`}`:'';
 const done=next>=LADDER_IDS.length?'<p class="hu-done">You have beaten the whole ladder. Rematch anyone.</p>':'';
 return `<section class="panel heads-up" data-testid="heads-up"><span class="eyebrow">HEADS-UP CHALLENGE</span><h2>Beat the regulars one on one</h2>
 <p class="muted">$1/$2, 100 big blinds each, no top-ups. The match ends when someone is out of chips, or after ${MATCH_HANDS} hands with the chip leader winning. Your result counts in your cash results.</p>
 ${opts.tableOpen?'<p class="privacy-blocked">You have a table open. Finish it first.</p>':opts.bankroll<opts.buyIn?`<p class="privacy-blocked">You need ${dollars(opts.buyIn)} in your bankroll.</p>`:''}${opts.notice?`<p class="hu-notice" role="status" data-testid="hu-notice">${esc(opts.notice)}</p>`:''}${last}${done}<ol class="hu-ladder">${rows}</ol></section>`;
}
/** The banner over the table during a match. */
export function matchBanner(m:MatchState):string {
 return `<div class="hu-banner" data-testid="hu-banner"><b>Heads-up vs ${esc(m.name)}</b><span>Hand ${Math.min(m.hands+1,MATCH_HANDS)} of ${MATCH_HANDS}</span><span>You ${dollars(m.hero)} · ${esc(m.name)} ${dollars(m.villain)}</span><span class="hu-bar" role="img" aria-label="Chip share: you ${m.hero+m.villain?Math.round(100*m.hero/(m.hero+m.villain)):50}%"><i style="width:${m.hero+m.villain?(100*m.hero/(m.hero+m.villain)).toFixed(1):'50'}%"></i></span></div>`;
}

/* Patch 77: the opponent talks to you through the match, and what they have noticed about your play is shown, the same
 * evidence the computer players use at every cash table (actions and showdown cards only). Display only. */
export const LEAK_WORDS:Record<string,string>={'overpair-love':'you overplay big pairs','pays-off-rivers':'you pay off river bets','scared-money':'you fold to big bets','draw-chaser':'you chase draws','auto-cbet':'you bet every flop','slowplays-monsters':'you slow-play big hands','river-bluffer':'you bluff rivers','one-and-done':'you give up after one bet'};
const NEEDLES:Record<string,string>={'overpair-love':'Big pair again? I’ll remember that.','pays-off-rivers':'You always pay me on the river.','scared-money':'You don’t like big pots, do you?','draw-chaser':'Chasing again?','auto-cbet':'You bet every flop, you know.','one-and-done':'One bet and done, every time.','slowplays-monsters':'When you check, I’m careful now.','river-bluffer':'Another river bet? I’m calling more.'};
const HELLO:Record<string,string>={sal:'Go easy on me!','big-earl':'Let’s see some flops.',frank:'Heads up? Bring it.',tex:'Let’s gamble, partner.',marco:'Hope you like big bets.',dante:'Good luck.',priya:'Let’s play.',ana:'Good luck. You’ll need it.',viktor:'Let’s go.',hiro:'…'};
const FUN=new Set(['sal','big-earl','frank','tex']);
const unit=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h/4294967296;};
const pickOf=(list:readonly string[],key:string)=>list[Math.floor(unit(key)*list.length)%list.length];
/** What the opponent says after a hand, if anything. `noticed` are leak ids they have seen in your play. */
export function matchLine(m:MatchState,handId:string,noticed:readonly string[],bigBlind:number):string|null {
 const fun=FUN.has(m.opponent),key=`${handId}:${m.opponent}`;
 if(m.over)return m.won?pickOf(fun?['Good game! You got me.','Nice playing. Rematch sometime?']:['Well played.','Good game. You earned it.','Fair enough. Next time.'],key):pickOf(fun?['Ha! I can’t believe that worked.','Good game, good game!']:['Good game.','That’s heads-up poker.','Thanks for the match.'],key);
 if(m.hands<=1)return HELLO[m.opponent]??null;
 // Once in a while, not every hand: a needle at most every fourth hand, a stack remark at most every fifth.
 if(noticed.length&&m.hands%4===0&&unit(`${key}:needle`)<.5)return NEEDLES[noticed[Math.floor(unit(`${key}:which`)*noticed.length)%noticed.length]]??null;
 if(m.hero>0&&m.hero<30*bigBlind&&m.hands%5===0&&unit(`${key}:short`)<.6)return pickOf(fun?['Uh oh, you’re getting short!','Almost there…']:['You’re getting short.','Careful now.'],key);
 if(m.villain>0&&m.villain<30*bigBlind&&m.hands%5===0&&unit(`${key}:vshort`)<.6)return pickOf(fun?['Uh oh.','I’m not done yet!']:['Not done yet.','One double and we’re even.'],key);
 return null;
}
export function noticedMarkup(name:string,noticed:readonly string[]):string {
 if(!noticed.length)return '';
 return `<p class="hu-noticed" data-testid="hu-noticed">${esc(name)} has noticed: ${noticed.map(l=>esc(LEAK_WORDS[l]??l)).join('; ')}. Expect them to use it.</p>`;
}
