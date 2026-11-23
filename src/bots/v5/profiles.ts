import type {Archetype,BotProfile,BotTraits,OpponentConfig,PopulationPreset} from '../../contracts';
import {normalizeDrawResponses} from './draw-responses';
export const POLICY_VERSION='synthetic-cash-1.4.0';
export const ARCHETYPES:readonly Archetype[]=Object.freeze(['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg']);
export const TRAIT_KEYS:readonly (keyof BotTraits)[]=Object.freeze(['positionAwareness','bluffFrequency','valueThreshold','drawCalling','sizeSensitivity','riskTolerance','riverCuriosity','slowPlay','multiwayCaution','adaptation','memoryRetention','mistakeRate','sizingAggression']);
export const clamp=(n:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
export const sigmoid=(n:number)=>1/(1+Math.exp(-n));
const traits=(values:number[]):BotTraits=>Object.fromEntries(TRAIT_KEYS.map((key,i)=>[key,values[i]])) as unknown as BotTraits;
const PRESETS:Record<Archetype,{aggression:number;looseness:number;skill:number;traits:BotTraits}>={
 nit:{aggression:.25,looseness:.13,skill:.52,traits:traits([.65,.12,.78,.25,.85,.24,.18,.3,.88,.35,.6,.12,.35])},
 station:{aggression:.12,looseness:.9,skill:.23,traits:traits([.15,.08,.62,.93,.2,.72,.92,.15,.12,.12,.45,.48,.25])},
 tag:{aggression:.62,looseness:.34,skill:.68,traits:traits([.8,.4,.59,.54,.68,.48,.42,.25,.68,.64,.72,.12,.55])},
 lag:{aggression:.8,looseness:.68,skill:.65,traits:traits([.84,.73,.5,.66,.46,.7,.62,.2,.48,.6,.65,.2,.76])},
 'fit-or-fold':{aggression:.3,looseness:.4,skill:.36,traits:traits([.42,.15,.7,.35,.78,.3,.18,.18,.7,.2,.4,.25,.35])},
 maniac:{aggression:.95,looseness:.89,skill:.28,traits:traits([.23,.97,.32,.83,.14,.95,.85,.05,.12,.15,.35,.55,.94])},
 // New-policy semantics: a designed loose/passive low-stakes recreational player.
 'passive-reg':{aggression:.25,looseness:.72,skill:.3,traits:traits([.28,.17,.65,.82,.32,.64,.75,.32,.3,.24,.55,.4,.32])},
 'stronger-reg':{aggression:.67,looseness:.4,skill:.86,traits:traits([.94,.52,.58,.56,.76,.52,.48,.36,.84,.9,.9,.05,.64])},
};
export const DEFAULT_CUSTOM_TRAITS:Readonly<BotTraits>=Object.freeze({...PRESETS.tag.traits});
/** Designed population priors, never empirical frequencies or stake-to-skill inference. */
export const POPULATION_WEIGHTS:Readonly<Record<PopulationPreset,readonly number[]>>=Object.freeze({
 low:Object.freeze([.1,.23,.1,.06,.13,.09,.25,.04]),mid:Object.freeze([.12,.12,.24,.16,.08,.06,.12,.1]),
 high:Object.freeze([.08,.05,.26,.23,.03,.04,.07,.24]),neutral:Object.freeze(Array(8).fill(.125)),
});
export function seedStream(seed:number):()=>number {
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid personality seed: expected uint32.');
 let n=seed>>>0;
 return ()=>{n=(n+0x6d2b79f5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function unit(value:number|undefined,name:string):number|undefined {if(value!==undefined&&(!Number.isFinite(value)||value<0||value>1))throw new Error(`${name} must be between 0 and 1.`);return value;}
export function resolveConfig(config:OpponentConfig,seed:number):OpponentConfig {
 seedStream(seed);
 if(!config||![...ARCHETYPES,'random','unknown','custom'].includes(config.selection))throw new Error('Unknown opponent selection.');
 if(config.baseArchetype!==undefined&&!ARCHETYPES.includes(config.baseArchetype))throw new Error('Unknown base archetype.');
 const normalized:OpponentConfig={selection:config.selection,personalitySeed:seed};
 if(config.baseArchetype!==undefined)normalized.baseArchetype=config.baseArchetype;
 for(const key of ['skill','aggression','looseness'] as const)if(config[key]!==undefined)normalized[key]=unit(config[key],key);
 if(config.traits){normalized.traits={};for(const key of TRAIT_KEYS)if(config.traits[key]!==undefined)normalized.traits[key]=unit(config.traits[key],key);}
 if(config.drawResponses)normalized.drawResponses=normalizeDrawResponses(config.drawResponses);
 return normalized;
}
export function createProfile(config:OpponentConfig,seed:number,environment:PopulationPreset):BotProfile {
 if(!Object.hasOwn(POPULATION_WEIGHTS,environment))throw new Error('Unknown population environment.');
 const c=resolveConfig(config,seed),random=seedStream(seed),selectionDraw=random();
 let archetype:Archetype;
 if(c.selection==='random'||c.selection==='unknown'){
  if(c.baseArchetype)archetype=c.baseArchetype;
  else{let cumulative=0;archetype=ARCHETYPES[7];for(let i=0;i<8;i++){cumulative+=POPULATION_WEIGHTS[environment][i];if(selectionDraw<cumulative){archetype=ARCHETYPES[i];break;}}}
 }else archetype=c.selection==='custom'?(c.baseArchetype??'tag'):c.selection;
 const base=PRESETS[archetype],activity=(random()-.5)*.09,caution=(random()-.5)*.08;
 const stableTraits={} as BotTraits;
 for(const key of TRAIT_KEYS){const jitter=(random()-.5)*.06;const correlated=['bluffFrequency','riskTolerance','sizingAggression'].includes(key)?activity:['sizeSensitivity','multiwayCaution','valueThreshold'].includes(key)?caution:0;stableTraits[key]=c.traits?.[key]??clamp(base.traits[key]+jitter+correlated);}
 return {...(c.drawResponses?{drawResponses:c.drawResponses}:{}),archetype,policyVersion:POLICY_VERSION,aggression:c.aggression??clamp(base.aggression+activity),looseness:c.looseness??clamp(base.looseness+activity-caution*.5),skill:c.skill??clamp(base.skill+(random()-.5)*.04),environment,unknown:c.selection==='unknown',traits:stableTraits,personalityId:`cash-v1.2:${seed.toString(16).padStart(8,'0')}:${archetype}`};
}
export function defaultProfile(archetype:Archetype):BotProfile {
 if(!ARCHETYPES.includes(archetype))throw new Error('Unknown bot archetype.');
 return createProfile({selection:archetype},0x5a170000+ARCHETYPES.indexOf(archetype),'neutral');
}
export function completeProfile(profile:BotProfile):BotProfile&{traits:BotTraits;skill:number;environment:PopulationPreset} {
 if(!ARCHETYPES.includes(profile.archetype)||profile.policyVersion!==POLICY_VERSION)throw new Error('Bot policy version mismatch.');
 unit(profile.aggression,'aggression');unit(profile.looseness,'looseness');
 if(profile.aggression===undefined||profile.looseness===undefined)throw new Error('Invalid bot profile.');
 const t={} as BotTraits;for(const key of TRAIT_KEYS)t[key]=unit(profile.traits?.[key],key)??PRESETS[profile.archetype].traits[key];
 const environment=profile.environment??'neutral';if(!Object.hasOwn(POPULATION_WEIGHTS,environment))throw new Error('Unknown population environment.');
 return {...(profile.drawResponses?{drawResponses:normalizeDrawResponses(profile.drawResponses)}:{}),archetype:profile.archetype,policyVersion:profile.policyVersion,aggression:profile.aggression,looseness:profile.looseness,skill:unit(profile.skill,'skill')??PRESETS[profile.archetype].skill,environment,traits:t,...(profile.personalityId!==undefined?{personalityId:profile.personalityId}:{}),...(profile.unknown!==undefined?{unknown:profile.unknown}:{})};
}
