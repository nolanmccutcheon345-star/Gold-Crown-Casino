/** Patch 68: career mode. Start at $1/$2 and climb the stakes with bankroll rules, the way a careful live
 * player moves up: move up once your bankroll covers 30 buy-ins of the next stakes and you have beaten your
 * current stakes over at least 500 hands; move down if it falls under 15 buy-ins of where you play. A buy-in is
 * 100 big blinds. Everything is worked out from your saved cash hands and bankroll; the career itself only
 * remembers when it started, where you play and its story. Screen only. */
import type {AppData,StoredHand} from '../session/types';

export const CAREER_KEY='poker-night-ai:career';
/** The ladder, in cents: small blind and big blind. */
export const LADDER:readonly (readonly [number,number])[]=[[100,200],[100,300],[200,500],[500,1000],[1000,2000],[2000,4000],[5000,10000]];
export const MOVE_UP_BUYINS=30,MOVE_DOWN_BUYINS=15,MOVE_UP_HANDS=500,BUYIN_BB=100;
export interface CareerEntry {id:string;at:string;text:string}
export interface Career {version:1;startedAt:string;level:number;startBankroll:number;story:CareerEntry[]}
export const stakeName=(level:number)=>{const [sb,bb]=LADDER[level];return `$${sb/100}/$${bb/100}`;};
export const buyIn=(level:number)=>LADDER[level][1]*BUYIN_BB;

export function readCareer():Career|null {
 try{const v=JSON.parse(localStorage.getItem(CAREER_KEY)??'null');return validCareer(v)?v:null;}catch{return null;}
}
export function saveCareer(c:Career|null):void {try{if(c)localStorage.setItem(CAREER_KEY,JSON.stringify(c));else localStorage.removeItem(CAREER_KEY);}catch{/* this visit only */}}
export function validCareer(v:unknown):v is Career {
 const c=v as Career;
 return !!c&&c.version===1&&typeof c.startedAt==='string'&&Number.isFinite(Date.parse(c.startedAt))&&Number.isInteger(c.level)&&c.level>=0&&c.level<LADDER.length&&
  Number.isSafeInteger(c.startBankroll)&&Array.isArray(c.story)&&c.story.length<=200&&c.story.every(e=>typeof e.id==='string'&&typeof e.at==='string'&&typeof e.text==='string');
}
export function startCareer(bankroll:number,at=new Date().toISOString()):Career {
 return {version:1,startedAt:at,level:0,startBankroll:bankroll,story:[{id:'start',at,text:`Started a career at ${stakeName(0)} with a ${money(bankroll)} bankroll.`}]};
}
const money=(cents:number)=>`$${Math.round(cents/100).toLocaleString('en-US')}`;
/** Career hands: cash hands since the career began. */
export const careerHands=(data:AppData,c:Career)=>data.hands.filter(h=>h.endedAt>=c.startedAt);
const at=(h:StoredHand,level:number)=>h.view.profile.smallBlind===LADDER[level][0]&&h.view.profile.bigBlind===LADDER[level][1];
export interface CareerStatus {
 level:number;stake:string;bankroll:number;buyIns:number;
 handsHere:number;netHereBB:number;winRateHere:number|null;
 canMoveUp:boolean;mustMoveDown:boolean;nextStake:string|null;needBankroll:number|null;needHands:number;
 totalHands:number;totalNet:number;
}
export function careerStatus(data:AppData,c:Career):CareerStatus {
 const active=data.active?.game.seats.find(s=>s.id===0)?.stack??0,bankroll=data.wallet+active;
 const hands=careerHands(data,c),here=hands.filter(h=>at(h,c.level)),bb=LADDER[c.level][1];
 const netHereBB=here.reduce((s,h)=>s+h.net,0)/bb,next=c.level+1<LADDER.length?c.level+1:null;
 const needBankroll=next===null?null:MOVE_UP_BUYINS*buyIn(next);
 return {level:c.level,stake:stakeName(c.level),bankroll,buyIns:bankroll/buyIn(c.level),handsHere:here.length,netHereBB:Math.round(netHereBB*10)/10,
  winRateHere:here.length?Math.round(1000*netHereBB/here.length)/10:null,
  canMoveUp:next!==null&&bankroll>=needBankroll!&&here.length>=MOVE_UP_HANDS&&netHereBB>0,mustMoveDown:c.level>0&&bankroll<MOVE_DOWN_BUYINS*buyIn(c.level),
  nextStake:next===null?null:stakeName(next),needBankroll,needHands:Math.max(0,MOVE_UP_HANDS-here.length),totalHands:hands.length,totalNet:hands.reduce((s,h)=>s+h.net,0)};
}
/** Story entries earned so far that the story does not have yet (milestones). */
export function newMilestones(data:AppData,c:Career,now=new Date().toISOString()):CareerEntry[] {
 const hands=careerHands(data,c),have=new Set(c.story.map(e=>e.id)),out:CareerEntry[]=[];
 const add=(id:string,text:string)=>{if(!have.has(id))out.push({id,at:now,text});};
 for(const n of [100,500,1000,2500,5000,10000])if(hands.length>=n)add(`hands-${n}`,`Played ${n.toLocaleString('en-US')} career hands.`);
 const sessions=new Map<string,number>();for(const h of hands)sessions.set(h.sessionId,(sessions.get(h.sessionId)??0)+h.net);
 const wins=[...sessions.values()].filter(v=>v>0);
 if(wins.length)add('first-win','Won a career session for the first time.');
 const best=Math.max(0,...sessions.values());
 for(const n of [50000,100000,500000])if(best>=n)add(`best-${n}`,`Won ${money(n)} or more in one session.`);
 const biggest=hands.reduce((m,h)=>Math.max(m,h.net),0);
 for(const n of [20000,100000])if(biggest>=n)add(`pot-${n}`,`Won a pot worth ${money(n)} or more.`);
 return out;
}
/** Move a level, with a line for the story. */
export function changeLevel(c:Career,step:1|-1,s:CareerStatus,now=new Date().toISOString()):Career {
 const level=Math.max(0,Math.min(LADDER.length-1,c.level+step));
 const text=step>0?`Moved up to ${stakeName(level)} with ${money(s.bankroll)} (${Math.floor(s.bankroll/buyIn(level))} buy-ins) after ${s.handsHere.toLocaleString('en-US')} hands at ${s.stake}.`
  :`Moved down to ${stakeName(level)} to protect the bankroll (${money(s.bankroll)}).`;
 return {...c,level,story:[...c.story,{id:`level-${c.story.length}`,at:now,text}].slice(-200)};
}
