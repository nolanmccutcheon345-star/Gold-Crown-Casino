import {lateGameChain,desperationPlay,payJumpPlay} from './late-game';
import {sizeReadsDigest} from '../bots/table-craft';
import {tempoReadPlay,tempoDigest} from '../bots/tempo-reads';
import {imageProfile,imagePlay,type Image} from '../bots/image';
import {texturePlay} from '../bots/texture';
import {aggressionPlay} from '../bots/aggression';
import {threeBetPlay} from '../bots/three-bet';
import {fightPlay} from '../bots/fights';
import {riverPlay} from '../bots/river';
import {calibrationPlay} from '../bots/calibration';
import {showdownPlay,stabPlay} from '../bots/showdown';
import {passivePotPlay} from '../bots/passive-pots';
import {barrelFoldPlay,stationValuePlay} from '../bots/barrels';
import {misreadPlay} from '../bots/misreads';
import {bubblePlay} from './bubble-play';
import {leakPlay,leaksOf} from '../bots/leaks';
import {exploitPlay,steamPlay} from '../bots/exploit';
import {dynamicsPlay} from '../bots/dynamics';
import {NO_STEAM,insightDigest,type TableInsight} from '../bots/insight';
import {quirkPlay} from '../bots/quirks';
import {stagePlay,stageProfile} from './stages';
import {rivalryPlay,rivalryProfile,protectRivalryExposure,type Grudges} from '../bots/rivalry';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {pushFold} from './push-fold';
import {multiwayPlay,multiwayProfile} from '../bots/multiway';
import {applySizingTell,regularSizingForProfile} from '../bots/sizing-tells';
import {tableReadsProfile,isolate,answerRaise,type PlayerRead} from '../bots/table-reads';
/** A bounded synthetic chip-EV-oriented short-stack overlay. Not Nash, ICM, a solver
 * chart or a measured human population. Cash and historical tournament policies
 * remain untouched. Only a version explicitly stored on an event enables it. */
import type {Action,BotDecision,BotObservation,BotProfile} from '../contracts';
import {chooseDecision} from '../bots/policy';
import {permittedObservation,validate,fingerprint} from '../bots/boundary';
import {completeProfile,POLICY_VERSION,clamp} from '../bots/profiles';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition} from '../bots/preflop';
import {decisionContext} from '../bots/features';
import {contestablePricing} from '../bots/pricing';
import {TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22,TOURNAMENT_POLICY_V23,TOURNAMENT_POLICY_V24,TOURNAMENT_POLICY_V25,TOURNAMENT_POLICY_V26,TOURNAMENT_POLICY_V27,TOURNAMENT_POLICY_V28,TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V210,TOURNAMENT_POLICY_V211,TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V213,TOURNAMENT_POLICY_V214,TOURNAMENT_POLICY_V215,TOURNAMENT_POLICY_V216,TOURNAMENT_POLICY_V217,TOURNAMENT_POLICY_V218,TOURNAMENT_POLICY_V219,TOURNAMENT_POLICY_V220,TOURNAMENT_POLICY_V221,TOURNAMENT_POLICY_V222,TOURNAMENT_POLICY_V223,chooseTournamentV2,type TournamentContext} from './bot-policy-v2';
import {humanSizing,moodFrom,moodProfile,stackMood,type HandResult} from '../bots/human';
import {readsProfile,type HeroReads} from '../bots/reads';
import {applyHabits,applyMinRaise,habitsOf} from '../bots/habits';
import {regularOfProfile} from '../bots/talk';
import {regularHabitsForProfile} from '../bots/regulars';
/** The 1.0.0 short-stack overlay. Events that stored it keep replaying it unchanged. */
export const TOURNAMENT_BOT_POLICY_VERSION='synthetic-tournament-shortstack-1.0.0';
export {TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22,TOURNAMENT_POLICY_V23,TOURNAMENT_POLICY_V24,TOURNAMENT_POLICY_V25,TOURNAMENT_POLICY_V26,TOURNAMENT_POLICY_V27,TOURNAMENT_POLICY_V28,TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V210,TOURNAMENT_POLICY_V211,TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V213,TOURNAMENT_POLICY_V214,TOURNAMENT_POLICY_V215,TOURNAMENT_POLICY_V216,TOURNAMENT_POLICY_V217,TOURNAMENT_POLICY_V218,TOURNAMENT_POLICY_V219,TOURNAMENT_POLICY_V220,TOURNAMENT_POLICY_V221,TOURNAMENT_POLICY_V222,TOURNAMENT_POLICY_V223};export type {HeroReads};export type {HandResult};export type {TournamentContext};
/** The policy stored on every newly started event. */
export const NEW_EVENT_TOURNAMENT_POLICY=TOURNAMENT_POLICY_V223;
export function supportedTournamentPolicy(version:string|undefined):boolean{return version===undefined||version===TOURNAMENT_BOT_POLICY_VERSION||version===TOURNAMENT_POLICY_V2||version===TOURNAMENT_POLICY_V21||version===TOURNAMENT_POLICY_V22||version===TOURNAMENT_POLICY_V23||version===TOURNAMENT_POLICY_V24||version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
/** 2.3.0 and later read players' recent results (mood). */
export function policyUsesMood(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V23||version===TOURNAMENT_POLICY_V24||version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
/** 2.4.0 and later read Hero's tendencies. */
export function policyUsesReads(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V24||version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
/** Policies from 2.1.0 onward read standings; earlier stored policies ignore them. */
export function policyUsesStandings(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V21||version===TOURNAMENT_POLICY_V22||version===TOURNAMENT_POLICY_V23||version===TOURNAMENT_POLICY_V24||version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
export function policyUsesIcm(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
/** Policy 2.7 observes the current actor's witnessed public table history. */
export function policyUsesTableReads(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
export function policyUsesImages(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
/** Only new events receive public rivalry context. */
/** 2.16.0 and later: leak reads and steam from witnessed hands at Hero's table. */
export function policyUsesInsight(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
export function policyUsesGrudges(version:string|undefined):boolean{return version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223;}
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
/** Canonical public rate data only; never serialize a caller's extra/private fields. */
function tableReadFingerprint(reads:Readonly<Record<number,PlayerRead>>|null|undefined):string {
 const text=JSON.stringify(Object.entries(reads??{}).sort(([a],[b])=>Number(a)-Number(b)).map(([seat,r])=>[Number(seat),r.hands,
  [r.vpip.count,r.vpip.chances],[r.pfr.count,r.pfr.chances],[r.limp.count,r.limp.chances],r.reads.hands,
  ...(['foldBlinds','foldToCbet','foldTo3bet','callAllIn','shortShove','aggression','wtsd'] as const).map(k=>[r.reads[k].count,r.reads[k].chances])
 ]));
 return bytesToHex(sha256(new TextEncoder().encode(text)));
}
/** Bind only public numeric image evidence, including sub-threshold values. */
function imageFingerprint(images:Readonly<Record<number,Image>>|null|undefined,publicOnly=false):string {
 const entries=publicOnly?Object.keys(images??{}).filter(key=>/^(0|[1-9]\d*)$/.test(key)).map(key=>[key,images![Number(key)]] as const):Object.entries(images??{});
 const text=JSON.stringify(entries.sort(([a],[b])=>Number(a)-Number(b)).map(([seat,value])=>[Number(seat),value.bluff,value.monster]));
 return bytesToHex(sha256(new TextEncoder().encode(text)));
}
export interface TournamentGrudges {grudges:Grudges;identityOf:(seat:number)=>string|undefined;}
/** Fingerprint only the actor's numeric rivalry evidence for current public seat identities. */
function grudgeFingerprint(o:BotObservation,context:TournamentGrudges|null|undefined):string {
 const holder=context?.identityOf(o.actingSeat);
 const rows=o.seats.slice().sort((a,b)=>a.id-b.id).map(seat=>{const target=context?.identityOf(seat.id);return [seat.id,target??null,holder&&target?context?.grudges[holder]?.[target]??0:0];});
 return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([holder??null,rows]))));
}
export function chooseTournamentDecision(observation:BotObservation,profile:BotProfile,random:()=>number,version?:string,standings?:TournamentContext,recent?:readonly HandResult[],reads?:HeroReads|null,tableReads?:Readonly<Record<number,PlayerRead>>|null,images?:Readonly<Record<number,Image>>|null,grudges?:TournamentGrudges|null,insight?:TableInsight|null):BotDecision {
 if(!supportedTournamentPolicy(version))throw Error('Unsupported tournament decision policy');
 if(version===undefined)return chooseDecision(observation,profile,random);
 if(version===TOURNAMENT_POLICY_V2){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');return chooseTournamentV2(observation,profile,random);}
 if(version===TOURNAMENT_POLICY_V21){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.1.0 needs the standings');return chooseTournamentV2(observation,profile,random,standings);}
 if(version===TOURNAMENT_POLICY_V22){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.2.0 needs the standings');return chooseTournamentV2(observation,profile,random,standings,true);}
 if(version===TOURNAMENT_POLICY_V23){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error('Tournament policy 2.3.0 needs the standings');
  const mood=moodFrom(recent??[],profile),decision=chooseTournamentV2(observation,moodProfile(profile,mood),random,standings,true);
  return {...decision,observationHash:`${TOURNAMENT_POLICY_V23}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}`,action:humanSizing(observation,profile,decision.action,random)};}
 if(version===TOURNAMENT_POLICY_V24||version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||version===TOURNAMENT_POLICY_V27||version===TOURNAMENT_POLICY_V28||version===TOURNAMENT_POLICY_V29||version===TOURNAMENT_POLICY_V210||version===TOURNAMENT_POLICY_V211||version===TOURNAMENT_POLICY_V212||version===TOURNAMENT_POLICY_V213||version===TOURNAMENT_POLICY_V214||version===TOURNAMENT_POLICY_V215||version===TOURNAMENT_POLICY_V216||version===TOURNAMENT_POLICY_V217||version===TOURNAMENT_POLICY_V218||version===TOURNAMENT_POLICY_V219||version===TOURNAMENT_POLICY_V220||version===TOURNAMENT_POLICY_V221||version===TOURNAMENT_POLICY_V222||version===TOURNAMENT_POLICY_V223){if(profile.policyVersion!==POLICY_VERSION)throw Error('Tournament overlay base policy mismatch');if(!standings)throw Error(`Tournament policy ${version.slice(-5)} needs the standings`);const v223=version===TOURNAMENT_POLICY_V223,v222=version===TOURNAMENT_POLICY_V222||v223,v221=version===TOURNAMENT_POLICY_V221||v222,v220=version===TOURNAMENT_POLICY_V220||v221,v219=version===TOURNAMENT_POLICY_V219||v220,v218=version===TOURNAMENT_POLICY_V218||v219,v217=version===TOURNAMENT_POLICY_V217||v218,v216=version===TOURNAMENT_POLICY_V216||v217,v215=version===TOURNAMENT_POLICY_V215||v216,v214=version===TOURNAMENT_POLICY_V214||v215,v213=version===TOURNAMENT_POLICY_V213||v214,v212=version===TOURNAMENT_POLICY_V212||v213,v211=version===TOURNAMENT_POLICY_V211||v212,v210=version===TOURNAMENT_POLICY_V210||v211,v29=version===TOURNAMENT_POLICY_V29||v210,v28=version===TOURNAMENT_POLICY_V28||v29,v27=version===TOURNAMENT_POLICY_V27||v28,v25=version===TOURNAMENT_POLICY_V25||version===TOURNAMENT_POLICY_V26||v27,icm=version===TOURNAMENT_POLICY_V26||v27;
  const own=observation.seats.find(s=>s.id===observation.actingSeat)!,total=own.stack+own.totalCommitted,average=standings.stacks.reduce((a,b)=>a+b,0)/standings.playersLeft;
  const steamed=v216&&insight?insight.steam:NO_STEAM,mood0={...moodFrom(recent??[],profile),...stackMood(total/observation.bigBlind,total/average)},mood={...mood0,tilt:Math.max(mood0.tilt,steamed.level)},read=readsProfile(observation,moodProfile(profile,mood),reads);
  const table=v27?tableReadsProfile(observation,read.profile,tableReads):null,im=v210?imageProfile(observation,table?.profile??read.profile,images):null,multi=v29?multiwayProfile(observation,im?.profile??table?.profile??read.profile):null,rival=v213&&grudges?rivalryProfile(observation,multi?.profile??table?.profile??read.profile,grudges.grudges,grudges.identityOf):null,stage=v214?stageProfile(observation,rival?.profile??multi?.profile??table?.profile??read.profile,standings):null,decision=chooseTournamentV2(observation,stage?.profile??rival?.profile??multi?.profile??table?.profile??read.profile,random,standings,true,icm);
  const hash=`${version}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}/${(mood.desperate??0).toFixed(3)}/${(mood.bigStack??0).toFixed(3)}:${read.effect?.applied.join('+')??'-'}`+(v210?`:image:${imageFingerprint(images,v214)}`:'')+(v213?`:grudge:${grudgeFingerprint(observation,grudges)}`:'')+(v214?`:stage-profile:${stage?.effect?.applied.join('+')??'-'}`:'');
  if(!v25)return {...decision,observationHash:hash,action:humanSizing(observation,profile,decision.action,random)};
  const habits=habitsOf(profile,regularHabitsForProfile(profile)),habit=applyHabits(observation,profile,decision.action,habits,random);
  if(!v27)return {...decision,observationHash:`${hash}:${habit.habit??'-'}`,action:applyMinRaise(observation,humanSizing(observation,profile,habit.action,random),habits,random).action};
  // New events only: legacy 2.7 keeps its exact decision and random draw sequence.
  const pf=v28?pushFold(observation,table?.profile??read.profile,standings,random):null;
  // 2.19.0: short stacks near the money hang on to ladder up.
  const pfd=pf&&v222?desperationPlay(observation,profile,pf,random):null,pj=pfd?payJumpPlay(observation,profile,pfd.action,standings,random):null,pfa=pj?.action??pf?.action;
  const pfb=pf&&v219?bubblePlay(observation,profile,pfa!,standings,random):null;
  if(pf)return {...decision,observationHash:`${hash}:pf:${pf.play}:${pf.range.toFixed(3)}:table:${tableReadFingerprint(tableReads)}`+(v219?`:bubble:${pfb?.play??'-'}`:'')+(v222?`:late:${pfd?.play??'-'}+${pj?.play??'-'}`:''),action:pfb?.play?pfb.action:pfa!};
  const iso=isolate(observation,profile,habit.action,tableReads,random),answer=answerRaise(observation,profile,iso.action,tableReads,random),seen=table?.effect?`${table.effect.target}/${table.effect.type}/${table.effect.applied.join('+')}`:'-';
  if(!v29)return {...decision,observationHash:`${hash}:${habit.habit??'-'}:${seen}:${iso.isolated?'iso':answer.play??'-'}:table:${tableReadFingerprint(tableReads)}`,action:applyMinRaise(observation,humanSizing(observation,profile,answer.action,random),habits,random).action};
  // New 2.9 events only. Keep old decision/RNG paths and their numeric read digest intact.
  const st=v214?stagePlay(observation,profile,answer.action,standings,random):null,tb=v211?threeBetPlay(observation,profile,st?.action??answer.action,random):null,mw=multiwayPlay(observation,profile,tb?.action??st?.action??answer.action,random),ip=v210?imagePlay(observation,profile,mw.action,images,random):null,tx=v210?texturePlay(observation,profile,ip?.action??mw.action,random):null,ag=v211&&!tx?.play?aggressionPlay(observation,profile,tx?.action??ip?.action??mw.action,random):null,fg=v212?fightPlay(observation,profile,ag?.action??tx?.action??mw.action,random):null,rv=v212?riverPlay(observation,profile,fg?.action??ag?.action??tx?.action??mw.action,tableReads,random):null,cb=v213?calibrationPlay(observation,profile,rv?.action??fg?.action??ag?.action??tx?.action??mw.action,random):null,sd=v214?showdownPlay(observation,profile,cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action,random):null,lk=v215?leakPlay(observation,profile,sd?.action??cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action,leaksOf(profile,regularOfProfile(profile)),random):null,qk=v215?quirkPlay(observation,profile,lk?.action??sd?.action??cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action,random):null,ex=v216?exploitPlay(observation,profile,qk!.action,insight?.leaks,random):null,sm=v216?steamPlay(observation,profile,ex!.action,steamed.level,random):null,dy=v217?dynamicsPlay(observation,profile,sm!.action,tableReads,random):null,sb=v218?stabPlay(observation,profile,dy!.action,random):null,pp=v219?passivePotPlay(observation,profile,sb!.action,random):null,bu=v219?bubblePlay(observation,profile,pp!.action,standings,random):null,sv=v220?stationValuePlay(observation,profile,bu!.action,tableReads,random):null,bf=v220?barrelFoldPlay(observation,profile,sv!.action,random):null,mr=v221?misreadPlay(observation,profile,bf!.action,random):null,lg=v222?lateGameChain(observation,profile,mr!.action,standings,insight?.sizes,random):null,tp=v223?tempoReadPlay(observation,profile,lg!.action,insight?.tempo,random):null,gr=v213&&grudges?rivalryPlay(observation,profile,tp?.action??lg?.action??mr?.action??bf?.action??sv?.action??bu?.action??pp?.action??sb?.action??dy?.action??sm?.action??ex?.action??qk?.action??lk?.action??sd?.action??cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action,grudges.grudges,grudges.identityOf,random):null,sized=applySizingTell(observation,profile,gr?.action??tp?.action??lg?.action??mr?.action??bf?.action??sv?.action??bu?.action??pp?.action??sb?.action??dy?.action??sm?.action??ex?.action??qk?.action??lk?.action??sd?.action??cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action,random,regularSizingForProfile(profile));
  return {...decision,observationHash:`${hash}:${habit.habit??'-'}:${seen}:${iso.isolated?'iso':answer.play??'-'}:table:${tableReadFingerprint(tableReads)}:${mw.play??'-'}/${sized.tell??'-'}`+(v210?`:image-play:${ip?.play??'-'}:texture:${tx?.play??'-'}`:'')+(v211?`:wars:${tb?.play??'-'}:aggression:${ag?.play??'-'}`:'')+(v212?`:fights:${fg?.play??'-'}:river:${rv?.play??'-'}`:'')+(v213?`:calibration:${cb?.play??'-'}:rivalry:${gr?.play??'-'}`:'')+(v214?`:stage-play:${st?.play??'-'}:showdown:${sd?.play??'-'}`:'')+(v215?`:leak:${lk?.play??'-'}:quirk:${qk?.play??'-'}`:'')+(v216?`:insight:${insightDigest(insight)}:exploit:${ex?.play??'-'}:steam:${sm?.play??'-'}`:'')+(v217?`:dynamics:${dy?.play??'-'}`:'')+(v218?`:stab:${sb?.play??'-'}`:'')+(v219?`:passive:${pp?.play??'-'}:bubble:${bu?.play??'-'}`:'')+(v220?`:station-value:${sv?.play??'-'}:barrel:${bf?.play??'-'}`:'')+(v221?`:misread:${mr?.play??'-'}`:'')+(v222?`:late:${lg?.plays??'-'}:sizes:${sizeReadsDigest(insight?.sizes)}`:'')+(v223?`:tempo:${tp?.play??'-'}:${tempoDigest(insight?.tempo)}`:''),action:(()=>{const action=applyMinRaise(observation,humanSizing(observation,profile,sized.action,random,false),habits,random).action;return gr?.play?protectRivalryExposure(observation,action,tp?.action??lg?.action??mr?.action??bf?.action??sv?.action??bu?.action??pp?.action??sb?.action??dy?.action??sm?.action??ex?.action??qk?.action??lk?.action??sd?.action??cb?.action??rv?.action??fg?.action??ag?.action??tx?.action??mw.action):action;})()};}
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
