// Frozen Version49 reference; import paths only relocated.
/** A bounded synthetic chip-EV-oriented short-stack overlay. Not Nash, ICM, a solver
 * chart or a measured human population. Cash and historical tournament policies
 * remain untouched. Only a version explicitly stored on an event enables it. */
import type {Action,BotDecision,BotObservation,BotProfile} from '../../src/contracts';
import {chooseDecision} from '../../src/bots/policy';
import {permittedObservation,validate,fingerprint} from '../../src/bots/boundary';
import {completeProfile,POLICY_VERSION,clamp} from '../../src/bots/profiles';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition} from '../../src/bots/preflop';
import {decisionContext} from '../../src/bots/features';
import {contestablePricing} from '../../src/bots/pricing';
import {TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22,TOURNAMENT_POLICY_V23,chooseTournamentV2,type TournamentContext} from './frozen-v49-policy-v2';
import {humanSizing,moodFrom,moodProfile,type HandResult} from './frozen-v49-human';
/** The 1.0.0 short-stack overlay. Events that stored it keep replaying it unchanged. */
export const TOURNAMENT_BOT_POLICY_VERSION='synthetic-tournament-shortstack-1.0.0';
export {TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22,TOURNAMENT_POLICY_V23};export type {HandResult};export type {TournamentContext};
/** The policy stored on every newly started event. */
export const NEW_EVENT_TOURNAMENT_POLICY=TOURNAMENT_POLICY_V23;
export function supportedTournamentPolicy(version:string|undefined):boolean{return version===undefined||version===TOURNAMENT_BOT_POLICY_VERSION||version===TOURNAMENT_POLICY_V2||version===TOURNAMENT_POLICY_V21||version===TOURNAMENT_POLICY_V22||version===TOURNAMENT_POLICY_V23;}
/** Only 2.3.0 reads players' recent results (mood). */
export function policyUsesMood(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V23;}
/** Policies from 2.1.0 onward read standings; earlier stored policies ignore them. */
export function policyUsesStandings(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V21||version===TOURNAMENT_POLICY_V22||version===TOURNAMENT_POLICY_V23;}
const classes=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
/** Rank ordering gives pairs and high-card blockers appropriate weight for an
 * immediate all-in. It is an ordinal selection score, expressly not equity. */
function shortStackScore(handClass:string):number {
 const c=classes.get(handClass)!;
 return c.baseScore+(c.pair?12:c.highRank===14?12:0)-(c.speculative*(c.highRank===14?0:7));
}
const ranks=[...PREFLOP_CLASSES].map(c=>({score:shortStackScore(c.handClass),combos:c.comboCount}));
function percentile(handClass:string):number {const score=shortStackScore(handClass);return ranks.reduce((sum,c)=>sum+(c.score>score?c.combos:c.score===score?c.combos/2:0),0)/1326;}
export interface TournamentShortStackAnalysis {
 version:typeof TOURNAMENT_BOT_POLICY_VERSION;applicable:boolean;stackBB:number;effectiveStackBB:number;
 handClass:string;ordinalPercentile:number;node:'unopened'|'limped'|'raised';playersBehind:number;liveOpponents:number;
 callPrice:number;assumedOpponentRangeFraction:number|null;selectionFraction:number;continueProbability:number;
 raiseProbability:number;raiseTo:number|null;label:string;
}
function probability(margin:number):number {return clamp(.5+margin/.08);}
/** Exported diagnostic contains only own-card/public information. It is for
 * controlled tests or post-hand analysis, never shown in normal live play. */
export function analyzeTournamentShortStack(observation:BotObservation,profile:BotProfile):TournamentShortStackAnalysis {
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 const own=o.seats.find(s=>s.id===o.actingSeat)!,context=decisionContext(o),depth=(own.stack+own.streetCommitted)/o.bigBlind;
 const live=o.seats.filter(s=>s.id!==own.id&&!s.folded),effective=Math.min(own.stack+own.streetCommitted,Math.max(0,...live.map(s=>s.stack+s.streetCommitted)))/o.bigBlind;
 const handClass=classifyStartingHand(o.ownCards),ordinal=percentile(handClass),pricing=contestablePricing(o);
 const raises=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise');
 const node=raises.length?'raised':context.limpers?'limped':'unopened';
 const applicable=o.street==='preflop'&&depth<=12;
 const position=preflopPosition(o),late=position==='BTN'?1:position==='SB'?.85:position==='CO'?.7:position==='MP'?.35:0;
 const personality=(p.looseness-.5)*.10+(p.traits!.riskTolerance-.5)*.035;
 let fraction=0,assumedRange:number|null=null,raiseChance=0;
 if(node!=='raised') {
  // Opportunity to win blinds now is worth more as stack depth falls. Limps
  // reduce fold equity; heads-up and late positions expose fewer opponents.
  fraction=clamp(.50-.026*Math.max(.5,effective)+.23*late+(o.seats.length<=3?.08:0)+personality-context.limpers*.045,.12,.92);
  raiseChance=1;
 } else {
  const last=raises.at(-1)!,raiser=o.seats.find(s=>s.id===last.seatId),raiseBB=(last.action!.type==='raise'?last.action!.to:0)/o.bigBlind;
  const raiserPosition=raiser?preflopPosition(o,raiser.id):'UTG';
  const shortShove=!!raiser?.allIn&&raiser.streetCommitted/o.bigBlind<=6;
  // Assumed top-of-range fractions are deliberately explicit and provisional.
  // A second raise is stronger evidence than a lone short-stack shove.
  assumedRange=raises.length>1?.09:shortShove?.45:raiserPosition==='BTN'||raiserPosition==='SB'?.32:.19;
  if(raiseBB>5&&!shortShove)assumedRange*=.65;
  const callers=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='call'&&e.revision>last.revision).length;
  // Pot pricing is eligible winnings only (independent from settlement). No
  // side-pot chips inaccessible to this caller can loosen its calling range.
  fraction=clamp(.10+(.5-pricing.rakeAdjustedPrice)*.9+(assumedRange-.19)*.45+personality-callers*.055,.035,.85);
  // A nearly blind-in stack offered a very cheap all-in price should not keep
  // waiting for a premium hand. This is still bounded by the actual call price.
  if(depth<=2&&pricing.rakeAdjustedPrice<=.20)fraction=Math.max(fraction,.70-pricing.rakeAdjustedPrice);
  raiseChance=ordinal<.045?1:own.stack<=o.legal.callAmount?0:clamp((.18-ordinal)*3+(p.aggression-.5)*.15);
 }
 const c=classes.get(handClass)!;
 const continuation=c.pair&&c.highRank>=12?1:probability(fraction-ordinal);
 const raiseTo=o.legal.canRaise?o.legal.maxRaiseTo:null;
 return {version:TOURNAMENT_BOT_POLICY_VERSION,applicable,stackBB:depth,effectiveStackBB:effective,handClass,ordinalPercentile:ordinal,node,playersBehind:context.playersBehind,liveOpponents:live.length,callPrice:pricing.rakeAdjustedPrice,assumedOpponentRangeFraction:assumedRange,selectionFraction:fraction,continueProbability:continuation,raiseProbability:raiseTo===null?0:raiseChance,raiseTo,label:'Synthetic ordinal short-stack approximation; no ICM or solver validation'};
}
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
export function chooseTournamentDecision(observation:BotObservation,profile:BotProfile,random:()=>number,version?:string,standings?:TournamentContext,recent?:readonly HandResult[]):BotDecision {
 if(!supportedTournamentPolicy(version))throw Error('Unsupported tournament decision policy');
 if(version===undefined)return chooseDecision(observation,profile,random);
 if(version===TOURNAMENT_POLICY_V2){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');return chooseTournamentV2(observation,profile,random);}
 if(version===TOURNAMENT_POLICY_V21){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.1.0 needs the standings');return chooseTournamentV2(observation,profile,random,standings);}
 if(version===TOURNAMENT_POLICY_V22){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.2.0 needs the standings');return chooseTournamentV2(observation,profile,random,standings,true);}
 if(version===TOURNAMENT_POLICY_V23){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.3.0 needs the standings');
  const mood=moodFrom(recent??[],profile),decision=chooseTournamentV2(observation,moodProfile(profile,mood),random,standings,true);
  return {...decision,observationHash:`${TOURNAMENT_POLICY_V23}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}`,action:humanSizing(observation,profile,decision.action,random)};}
 // The overlay has one frozen base-policy contract. It never rewrites an old
 // event/profile; old event metadata omits the overlay entirely.
 if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');
 const o=permittedObservation(observation),p=completeProfile(profile),analysis=analyzeTournamentShortStack(o,p);
 if(!analysis.applicable){const inherited=chooseDecision(o,p,random);return {...inherited,observationHash:`${version}:${inherited.observationHash}`};}
 const continueHand=draw(random)<analysis.continueProbability;
 let action:Action;
 if(continueHand&&analysis.raiseTo!==null&&draw(random)<analysis.raiseProbability)action={type:'raise',to:analysis.raiseTo};
 else if(o.legal.check)action={type:'check'};
 else if(continueHand)action={type:'call'};
 else action={type:'fold'};
 return {handId:o.handId,revision:o.revision,seatId:o.actingSeat,decisionId:o.decisionId,policyVersion:p.policyVersion,observationHash:`${version}:${fingerprint(o,p)}`,action};
}
