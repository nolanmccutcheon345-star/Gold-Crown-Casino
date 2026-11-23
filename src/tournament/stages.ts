/** Tournament stages (policy 2.14.0). Live tournaments change character as they go:
 * - early, deep stacks (average 80 big blinds or more): recreational players play loose and splashy
 *   and chase draws; good players set-mine and wait;
 * - middle, once antes are in (average 25–80 big blinds): stealing wars: good players open wider from
 *   the cutoff, button and small blind when folded to them;
 * - late (average under 25 big blinds, or the money near): push/fold and prize pressure take over
 *   (policies 2.6.0 and 2.8.0); this module adds nothing there;
 * - short-handed tables (five or fewer players): good players shift gears and open wider from anywhere.
 * Public information only: the observation, the standings and the player's own cards.
 * Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from '../bots/profiles';
import {preflopPosition} from '../bots/preflop';
import {deepRank} from '../bots/three-bet';
import {depthPlay,effectiveBB} from '../bots/depth';
import type {TournamentContext} from './bot-policy-v2';

export type Stage='early'|'middle'|'late';
export function stageOf(o:BotObservation,context:TournamentContext|undefined):Stage {
 const stacks=context?.stacks??o.seats.map(s=>s.stack+s.totalCommitted),avg=stacks.reduce((a,b)=>a+b,0)/Math.max(1,stacks.length)/o.bigBlind;
 const nearMoney=context?context.playersLeft<=context.paid*1.3:false;
 if(avg<25||nearMoney)return 'late';
 return avg>=80?'early':'middle';
}
/** Players dealt in at this table. */
const tableSize=(o:BotObservation)=>o.seats.filter(s=>s.stack+s.totalCommitted>0).length;

export interface StageEffect {stage:Stage;shortHanded:boolean;applied:string[];}
export function stageProfile(o:BotObservation,profile:BotProfile,context:TournamentContext|undefined):{profile:BotProfile;effect:StageEffect|null} {
 const stage=stageOf(o,context);
 // Field-average depth cannot authorize speculative play by a short actor, or
 // against a short raiser. Leave these nodes to the versioned push/fold/ICM path.
 if(stage==='late'||o.street==='preflop'&&effectiveBB(o)<=25)return {profile,effect:null};
 const shortHanded=tableSize(o)<=5,p=completeProfile(profile),t={...p.traits},applied:string[]=[];let looseness=p.looseness,aggression=p.aggression;
 if(stage==='early'&&p.skill<.55){const k=(.55-p.skill)/.55;looseness=clamp(looseness+.1*k);t.drawCalling=clamp(t.drawCalling+.1*k);t.riverCuriosity=clamp(t.riverCuriosity+.08*k);applied.push('early-splash');}
 if(shortHanded){looseness=clamp(looseness+.1*p.skill);aggression=clamp(aggression+.08*p.skill);applied.push('short-handed');}
 if(!applied.length)return {profile,effect:null};
 return {profile:{...p,looseness,aggression,traits:t},effect:{stage,shortHanded,applied}};
}
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const STEAL:Record<string,number>={CO:.33,BTN:.48,SB:.42};
/** Stage plays applied after the decision: set-mining while deep early, and steals in the middle stage
 * (from late position, or from anywhere short-handed) when folded to. */
export function stagePlay(o:BotObservation,profile:BotProfile,action:Action,context:TournamentContext|undefined,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2)return keep;
 const stage=stageOf(o,context),p=completeProfile(profile);
 if(stage==='late'||effectiveBB(o)<=25)return keep;
 if(stage==='early'){
  const r=p.skill>=.55?depthPlay(o,profile,'standard',action,random):null;if(r?.play==='set-mine')return {action:r.action,play:'early-set-mine'};
  // Recreational players limp in (or limp behind) with any playable hand while the stacks are deep.
  const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raised=pre.some(e=>e.action?.type==='raise');
  if(action.type==='fold'&&!raised&&p.skill<.55&&o.legal.callAmount>0&&deepRank(o.ownCards)<=.5&&draw(random)<clamp((.55-p.skill)/.55*.75))return {action:{type:'call'},play:'early-limp'};
  return keep;
 }
 if(stage!=='middle'||action.type!=='fold'||!o.legal.canRaise)return keep;
 const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop');if(pre.some(e=>e.action?.type!=='fold'))return keep;
 const shortHanded=tableSize(o)<=5;
 if(!shortHanded&&!o.seats.some(s=>(s.deadAnte??0)>0))return keep;
 const pos=preflopPosition(o),limit=(STEAL[pos]??(shortHanded?.28:0))*(shortHanded?1.15:1);
 if(!limit||deepRank(o.ownCards)>limit)return keep;
 if(draw(random)>=clamp(p.skill*(.4+.5*p.aggression)))return keep;
 const u=o.chipUnit??1,to=Math.round(o.bigBlind*2.2/u)*u;
 return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'steal'};
}
