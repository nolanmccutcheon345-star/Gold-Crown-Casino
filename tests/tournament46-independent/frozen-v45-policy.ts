// Frozen V45 policy oracle, commit cb5f61c9fd663daaa29ac70822e1d60490c28765.
// Only import paths changed; do not update this fixture alongside production policies.
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
export const TOURNAMENT_BOT_POLICY_VERSION='synthetic-tournament-shortstack-1.0.0';
export function supportedTournamentPolicy(version:string|undefined):boolean{return version===undefined||version===TOURNAMENT_BOT_POLICY_VERSION;}
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
export function chooseTournamentDecision(observation:BotObservation,profile:BotProfile,random:()=>number,version?:string):BotDecision {
 if(!supportedTournamentPolicy(version))throw Error('Unsupported tournament decision policy');
 if(version===undefined)return chooseDecision(observation,profile,random);
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
