/** Remembering you across sessions (cash layer human-1.21.0). A regular is the same person every time they
 * sit down, so what they saw you do in earlier sessions still counts: your timing (Patch 64) and what your
 * river bets turned out to be when shown down. Strangers have only met you this session. Evidence: hands this
 * player was seated for (any session, the saved hands kept on this device), and only your shown-down cards.
 * A player with skill 0.4 or more who has seen at least 4 of your river bets shown down calls lighter if 40% or
 * more were bluffs or thin, and folds more if at least 5 were all strong. Designed, not fitted. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile} from './profiles';
import {handFeatures} from './features';
import type {TempoHand} from './tempo-reads';

export interface RiverRead {strong:number;weak:number}
export const EMPTY_RIVER:RiverRead=Object.freeze({strong:0,weak:0});
/** What your shown-down river bets were, in hands this observer witnessed. */
export function riverReadFrom(hands:readonly TempoHand[],witnessed:(index:number)=>boolean):RiverRead {
 const r={strong:0,weak:0};
 hands.forEach((hand,i)=>{
  if(!witnessed(i)||hand.board.length<5)return;
  const hole=hand.revealed.find(x=>x.id===0)?.hole;if(!hole||hole.length!==2)return;
  if(!hand.events.some(e=>e.type==='action'&&e.street==='river'&&e.seatId===0&&e.action?.type==='raise'))return;
  if(handFeatures(hole as never,hand.board as never).strength>=.68)r.strong++;else r.weak++;
 });
 return r;
}
export const riverDigest=(r:RiverRead|null|undefined)=>r?`${r.strong}/${r.weak}`:'-';
export type MemoryPlay='remember-call'|'remember-fold'|null;
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Facing your river bet, with what they remember of your river bets. */
export function rememberPlay(o:BotObservation,profile:BotProfile,action:Action,read:RiverRead|null|undefined,random:()=>number):{action:Action;play:MemoryPlay} {
 const keep={action,play:null as MemoryPlay};
 if(!read||o.street!=='river'||o.legal.check||!o.ownCards||o.ownCards.length!==2)return keep;
 const bet=o.publicEvents.filter(e=>e.type==='action'&&e.street==='river'&&e.action?.type==='raise').at(-1);
 if(!bet||bet.seatId!==0)return keep;
 const p=completeProfile(profile),n=read.strong+read.weak;if(p.skill<.4||n<4)return keep;
 const f=handFeatures(o.ownCards,o.board);
 if(read.weak/n>=.4&&action.type==='fold'&&f.strength>=.3&&draw(random)<.5+.4*p.skill)return {action:{type:'call'},play:'remember-call'};
 if(read.weak===0&&n>=5&&action.type==='call'&&f.strength<.75&&draw(random)<.5+.4*p.skill)return {action:{type:'fold'},play:'remember-fold'};
 return keep;
}
/** What a returning player says to you (screen only), from what they remember. */
export function greetingFor(tempo:{snapStrong:number;snapWeak:number;tankStrong:number;tankWeak:number},river:RiverRead,handsTogether:number):string|null {
 if(tempo.snapStrong>=3&&tempo.snapStrong>=3*tempo.snapWeak)return 'You again. Still snap-betting your big hands?';
 if(tempo.tankWeak>=3&&tempo.tankWeak>=2*tempo.tankStrong)return 'Take all the time you want. I know what the long ones mean.';
 if(river.strong+river.weak>=4&&river.weak/(river.strong+river.weak)>=.4)return 'Careful, everyone. This one bluffs rivers.';
 if(river.strong>=5&&river.weak===0)return 'When you bet the river, I believe you.';
 if(handsTogether>=60)return 'Good to see you again.';
 return null;
}
export const MEMORY_LINES:Record<Exclude<MemoryPlay,null>,string[]>={'remember-call':['I’ve seen you bluff this river before.','Not this time. I remember.'],'remember-fold':['You always have it on the river. Fine.','I’ve paid you off enough.']};
