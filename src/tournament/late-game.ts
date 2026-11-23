/** Late-game tournament craft (policy 2.22.0). How real players change once antes are in and the money
 * gets close:
 * - Late steals: folded to them in the cutoff, button or small blind with antes in play and 15–60 big
 *   blinds, thinking players open wider to pick up the blinds and antes.
 * - Re-steals: with 15–25 big blinds, facing a single late-position open, they move all-in over the top
 *   with hands that are too good to fold and too short to flat.
 * - Pay-jump caution: at a final table, a medium stack facing an all-in folds marginal calls; how much
 *   depends on the size of the next real pay jump.
 * - Short-stack desperation: under 8 big blinds, a skilled player with the blinds coming shoves wider;
 *   a weak player sometimes waits too long for a hand.
 * How fully each player does this follows their skill and aggression. Public information only.
 * Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {clamp,completeProfile} from '../bots/profiles';
import {preflopPosition} from '../bots/preflop';
import {craft,blindDefensePlay,multiwayPreflopPlay,floatPlay,floatBetPlay,probePlay,sizeReadPlay,type SizeRead} from '../bots/table-craft';
import {handRank,type PushFoldResult} from './push-fold';
import {bubbleRole} from './bubble-play';
import type {TournamentContext} from './bot-policy-v2';

export type LatePlay='late-steal'|'resteal-shove'|'pay-jump-fold'|'desperate-shove'|'waits-too-long'|null;
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const total=(o:BotObservation,id:number)=>{const s=o.seats.find(x=>x.id===id);return s?s.stack+s.totalCommitted:0;};
const preflop=(o:BotObservation)=>o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop');
const position=(o:BotObservation,seat=o.actingSeat)=>{try{return preflopPosition(o,seat);}catch{return null;}};
/** Extra share of hands a late-position player opens when antes are in and it is folded to them. */
const STEAL_WIDEN:Record<string,number>={CO:.1,BTN:.18,SB:.16};
/** Effective stack in big blinds against the deepest player still to act. */
function effectiveBB(o:BotObservation):number {
 const me=total(o,o.actingSeat),others=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).map(s=>total(o,s.id));
 return Math.min(me,Math.max(0,...others))/o.bigBlind;
}

/** Folded to a late-position player with antes in: open a little wider than usual. */
export function lateStealPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:LatePlay} {
 const keep={action,play:null as LatePlay};
 if(o.street!=='preflop'||action.type!=='fold'||!o.ownCards||o.ownCards.length!==2||!o.legal.canRaise||o.legal.minRaiseTo===null)return keep;
 if(!o.publicEvents.some(e=>e.type==='ante')||preflop(o).some(e=>e.action?.type!=='fold'))return keep;
 const pos=position(o);if(!pos||!(pos in STEAL_WIDEN))return keep;
 const eff=effectiveBB(o);if(eff<15||eff>60)return keep;
 const k=craft(profile),rank=handRank(o.ownCards),base=pos==='BTN'?.42:pos==='SB'?.36:.28;
 // Hands just outside the usual opening range: the ones a thinker adds when the antes are worth taking.
 if(k<=0||rank>=base+STEAL_WIDEN[pos]*k||draw(random)>=.85*k+.1)return keep;
 const u=o.chipUnit??1,to=Math.round(o.bigBlind*(eff<25?2:2.2)/u)*u;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo,to))},play:'late-steal'};
}

/** 15–25 big blinds facing one late-position open and no callers: move all-in over the top. */
export function reStealPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:LatePlay} {
 const keep={action,play:null as LatePlay};
 if(o.street!=='preflop'||(action.type!=='fold'&&action.type!=='call')||!o.ownCards||o.ownCards.length!==2||!o.legal.canRaise||o.legal.maxRaiseTo===null)return keep;
 const pre=preflop(o),raises=pre.filter(e=>e.action?.type==='raise');
 if(raises.length!==1||pre.some(e=>e.action?.type==='call'&&e.revision>raises[0].revision))return keep;
 const raiser=raises[0].seatId!,them=position(o,raiser),me=position(o);
 if(!them||!['CO','BTN','SB'].includes(them)||!me||!['BTN','SB','BB'].includes(me)||raiser===o.actingSeat)return keep;
 const opener=o.seats.find(s=>s.id===raiser)!;if(opener.allIn)return keep;
 const eff=effectiveBB(o);if(eff<15||eff>25)return keep;
 const k=craft(profile),rank=handRank(o.ownCards);
 // Strong-but-not-premium: premiums already 3-bet for value; the re-steal range sits just below them.
 const range=.06+.1*k;
 if(k<=0||rank<.02||rank>=range||draw(random)>=.9*k+.1)return keep;
 return {action:{type:'raise',to:o.legal.maxRaiseTo},play:'resteal-shove'};
}

/** The next pay jump at a final table, as a share of first prize; 0 when there is none to speak of. */
export function payJump(c:TournamentContext|undefined):number {
 if(!c?.prizes||c.playersLeft>9||c.playersLeft<3||c.prizes.length<c.playersLeft-1)return 0;
 const now=c.prizes[c.playersLeft-1]??0,next=c.prizes[c.playersLeft-2]??0,top=Math.max(1,c.prizes[0]);
 return clamp((next-now)/top);
}
/** A medium stack at a final table, facing an all-in it would call: folds marginal hands when the jump is real. */
export function payJumpPlay(o:BotObservation,profile:BotProfile,action:Action,c:TournamentContext|undefined,random:()=>number):{action:Action;play:LatePlay} {
 const keep={action,play:null as LatePlay};
 if(!c||o.street!=='preflop'||action.type!=='call'||!o.ownCards||o.ownCards.length!==2)return keep;
 const jump=payJump(c);if(jump<.03)return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,mine=own.stack+own.totalCommitted;
 if(bubbleRole(mine,o.bigBlind,c)!=='medium')return keep;
 const shover=o.seats.find(s=>s.id!==o.actingSeat&&s.allIn&&!s.folded);
 if(!shover||o.legal.callAmount<.4*own.stack)return keep;
 // Someone shorter than us still at the table makes waiting worth even more.
 const shorter=c.stacks.some(s=>s>0&&s<mine&&s!==total(o,shover.id));
 const p=completeProfile(profile),care=clamp((.3+.9*p.skill-.5*(p.looseness-.4))*(jump/.12)*(shorter?1.2:.9));
 const rank=handRank(o.ownCards);
 if(rank<.035||draw(random)>=care)return keep;
 return {action:{type:'fold'},play:'pay-jump-fold'};
}

/** Under 8 big blinds, first in: skilled players shove wider before the blinds hit; weak ones wait too long. */
export function desperationPlay(o:BotObservation,profile:BotProfile,pf:PushFoldResult,random:()=>number):{action:Action;play:LatePlay} {
 const keep={action:pf.action,play:null as LatePlay};
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||preflop(o).some(e=>e.action?.type==='raise'))return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,bb=(own.stack+own.totalCommitted)/o.bigBlind;if(bb>=8)return keep;
 const p=completeProfile(profile),pos=position(o);
 if(pf.play==='fold'&&p.skill>=.6&&o.legal.canRaise&&o.legal.maxRaiseTo!==null){
  // The big blind is one or two hands away: a shove now is worth more than a shove from the blind.
  const blindsComing=pos==='BTN'||pos==='CO'||pos==='SB';
  if(blindsComing&&pf.rank<Math.min(.9,pf.range*(1.3+.5*p.skill))&&draw(random)<.4+.5*p.skill)return {action:{type:'raise',to:o.legal.maxRaiseTo},play:'desperate-shove'};
 }
 if(pf.play==='shove'&&p.skill<.45&&pf.rank>.5*pf.range&&bb>=3&&draw(random)<(.45-p.skill)*1.6)
  return {action:o.legal.check?{type:'check'}:{type:'fold'},play:'waits-too-long'};
 return keep;
}

/** Policy 2.22.0 main chain: late-game spots first, then the table craft shared with cash games. */
export function lateGameChain(o:BotObservation,profile:BotProfile,action:Action,c:TournamentContext|undefined,sizes:Readonly<Record<number,SizeRead>>|null|undefined,random:()=>number):{action:Action;plays:string} {
 const plays:string[]=[];let chosen=action;
 const steps:((a:Action)=>{action:Action;play:string|null})[]=[
  a=>lateStealPlay(o,profile,a,random),a=>reStealPlay(o,profile,a,random),a=>payJumpPlay(o,profile,a,c,random),
  a=>blindDefensePlay(o,profile,a,random),a=>multiwayPreflopPlay(o,profile,a,random),
  a=>floatPlay(o,profile,a,random),a=>floatBetPlay(o,profile,a,random),a=>probePlay(o,profile,a,random),a=>sizeReadPlay(o,profile,a,sizes,random)];
 for(const step of steps){const r=step(chosen);chosen=r.action;if(r.play)plays.push(r.play);}
 return {action:chosen,plays:plays.join('+')||'-'};
}
