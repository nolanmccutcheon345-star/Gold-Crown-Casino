import type {Action,BotDecision,BotObservation,BotProfile} from '../../contracts';
import * as legacy from '../legacy-v0';
import * as versionOne from '../v1/policy';
import * as versionTwo from '../v2/policy';
import {completeProfile as completeV2} from '../v2/profiles';
import {permittedObservation as permittedV2,validate as validateV2} from '../v2/boundary';
import {completeProfile as completeV1} from '../v1/profiles';
import {permittedObservation as permittedV1,validate as validateV1} from '../v1/boundary';
import {permittedObservation,validate,fingerprint} from './boundary';
import {completeProfile,POLICY_VERSION} from './profiles';
import {analyzeDecision as analyzeCurrent,type DecisionAnalysis,type PolicyDistribution} from './strategy';
import {handFeatures,decisionContext} from './features';
export {POLICY_VERSION,ARCHETYPES,DEFAULT_CUSTOM_TRAITS,POPULATION_WEIGHTS,defaultProfile,createProfile,resolveConfig} from './profiles';
export {handFeatures} from './features';
export {buildOpponentMemory} from './memory';
export type {PolicyDistribution,DecisionAnalysis} from './strategy';
export const LEGACY_POLICY_VERSION=legacy.POLICY_VERSION;
export const VERSION_ONE_POLICY_VERSION=versionOne.POLICY_VERSION;
export const VERSION_TWO_POLICY_VERSION=versionTwo.POLICY_VERSION;
export const securePolicyRandom=legacy.securePolicyRandom;
export function supportedPolicy(version:string):boolean{return version===POLICY_VERSION||version===LEGACY_POLICY_VERSION||version===VERSION_ONE_POLICY_VERSION||version===VERSION_TWO_POLICY_VERSION;}
function draw(random:()=>number):number{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Bot random draw must be in [0, 1).');return n;}
export function analyzeDecision(o:BotObservation,p:BotProfile):DecisionAnalysis {
 if(p.policyVersion===VERSION_TWO_POLICY_VERSION)return versionTwo.analyzeDecision(o,p);
 if(p.policyVersion===VERSION_ONE_POLICY_VERSION)return versionOne.analyzeDecision(o,p);
 if(p.policyVersion===LEGACY_POLICY_VERSION){const clean=permittedObservation(o,false);return {version:LEGACY_POLICY_VERSION,label:'SYNTHETIC / NOT HUMAN-VALIDATED (legacy)',features:handFeatures(clean.ownCards,clean.board),context:decisionContext(clean),distribution:legacy.policyDistribution(o,p),families:{value:0,bluff:0,semiBluff:0,trap:0,checkRaise:0,delayedCbet:0},sizing:[],memoryAdjustment:{call:0,bluff:0}};}
 return analyzeCurrent(o,p);
}
export function policyDistribution(o:BotObservation,p:BotProfile):PolicyDistribution {
 return p.policyVersion===VERSION_TWO_POLICY_VERSION?versionTwo.policyDistribution(o,p):p.policyVersion===LEGACY_POLICY_VERSION?legacy.policyDistribution(o,p):p.policyVersion===VERSION_ONE_POLICY_VERSION?versionOne.policyDistribution(o,p):analyzeCurrent(o,p).distribution;
}
export function chooseDecision(observation:BotObservation,profile:BotProfile,random:()=>number=securePolicyRandom):BotDecision {
 // Historical snapshots retain their exact original policy, sampling and observation hash.
 if(profile.policyVersion===VERSION_TWO_POLICY_VERSION)return versionTwo.chooseDecision(observation,profile,random);
 if(profile.policyVersion===LEGACY_POLICY_VERSION)return legacy.chooseDecision(observation,profile,random);
 if(profile.policyVersion===VERSION_ONE_POLICY_VERSION)return versionOne.chooseDecision(observation,profile,random);
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);
 const analysis=analyzeCurrent(o,p),d=analysis.distribution,n=draw(random);let action:Action;
 if(n<d.fold)action={type:'fold'};
 else if(n<d.fold+d.check)action={type:'check'};
 else if(n<d.fold+d.check+d.call)action={type:'call'};
 else{const sizeDraw=draw(random);let total=0;const chosen=analysis.sizing.find(s=>{total+=s.weight;return sizeDraw<total;})??analysis.sizing.at(-1);if(!chosen)throw new Error('No legal raise available.');action={type:'raise',to:chosen.raiseTo};}
 return {handId:o.handId,revision:o.revision,seatId:o.actingSeat,decisionId:o.decisionId,policyVersion:p.policyVersion,observationHash:fingerprint(o,p),action};
}
/** One-hand advisory cache. Durable draw-token/pending persistence belongs to SessionController. */
export class DecisionCache {
 private readonly decisions=new Map<string,{identity:string;decision:BotDecision}>();
 private readonly revisionDecisions=new Map<number,string>();private readonly failedDecisions=new Set<string>();
 private handId:string|null=null;private highestRevision=-1;
 constructor(private readonly random:()=>number=securePolicyRandom){}
 getOrCreate(observation:BotObservation,profile:BotProfile):BotDecision {
  const isLegacy=profile.policyVersion===LEGACY_POLICY_VERSION,isV1=profile.policyVersion===VERSION_ONE_POLICY_VERSION,isV2=profile.policyVersion===VERSION_TWO_POLICY_VERSION;
  const o=isV2?permittedV2(observation):isV1?permittedV1(observation):permittedObservation(observation,!isLegacy);
  const p=isLegacy?{archetype:profile.archetype,policyVersion:profile.policyVersion,aggression:profile.aggression,looseness:profile.looseness}:isV2?completeV2(profile):isV1?completeV1(profile):completeProfile(profile);
  if(isLegacy)legacy.policyDistribution(o,p);else if(isV1)validateV1(o,p);else if(isV2)validateV2(o,p);else validate(o,p);
  if(this.handId!==null&&o.handId!==this.handId)throw new Error('Decision cache belongs to another hand; create a new cache after completion.');
  const identity=JSON.stringify({o,p}),existing=this.decisions.get(o.decisionId);
  if(existing){if(existing.identity!==identity)throw new Error('Decision ID reused for a different observation or policy.');return structuredClone(existing.decision);}
  if(this.failedDecisions.has(o.decisionId))throw new Error('This decision failed during sampling; pause safely rather than reroll it.');
  if(this.revisionDecisions.has(o.revision))throw new Error('This hand revision already has a sampled decision; its ID cannot change.');
  if(o.revision<this.highestRevision)throw new Error('Cannot sample a new decision for a stale hand revision.');
  this.handId=o.handId;this.highestRevision=o.revision;this.revisionDecisions.set(o.revision,o.decisionId);
  try{const decision=chooseDecision(o,p,this.random);this.decisions.set(o.decisionId,{identity,decision:structuredClone(decision)});return structuredClone(decision);}catch(cause){this.failedDecisions.add(o.decisionId);throw cause;}
 }
 get size():number{return this.decisions.size;}
}
