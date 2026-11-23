import {sha256} from '@noble/hashes/sha2.js';
import type {RuleProfile} from '../contracts';

const SUFFIX=/\+cfg\.[0-9a-f]{64}$/;
/** Deterministic finite JSON. Deliberately independent of storage/engine imports. */
function ordered(value:unknown):string {
 if(value===null)return 'null';
 if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Rule configuration contains a non-finite number.');return JSON.stringify(value);}
 if(Array.isArray(value))return `[${value.map(ordered).join(',')}]`;
 if(typeof value==='object'){
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).filter(key=>record[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${ordered(record[key])}`).join(',')}}`;
 }
 throw new Error('Rule configuration contains a non-JSON value.');
}

/**
 * Configuration identity, not a policy/code version or a per-hand state hash.
 * Includes all profile fields except the existing version, normalizes the
 * legacy floor-rounding default, and hashes the complete occupancy cap schedule.
 * A schedule's resolved `cap` and `dealtIn` are derived hand data: the frozen
 * hand still records them, but resolving the same schedule must not re-version it.
 * The full SHA-256 is retained. This is provenance, not an authorization check.
 */
export function ruleProfileConfigVersion(profile:RuleProfile,baseVersion=profile.version):string {
 if(typeof baseVersion!=='string'||!baseVersion.length)throw new Error('A base rule version is required.');
 const base=baseVersion.replace(SUFFIX,'');
 if(!base)throw new Error('A base rule version is required.');
 const rules:Partial<RuleProfile>={...profile};delete rules.version;
 const rake=profile.rake,{cap,rounding}=rake;
 const rakeSettings:Partial<RuleProfile['rake']>={...rake};delete rakeSettings.dealtIn;delete rakeSettings.cap;delete rakeSettings.rounding;
 const configuration={schema:'cash-rule-configuration/1',rules:{...rules,rake:{...rakeSettings,rounding:rounding??'floor',...(rake.capByDealtIn?{}:{cap})}}};
 const fingerprint=[...sha256(new TextEncoder().encode(ordered(configuration)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return `${base}+cfg.${fingerprint}`;
}

/** Call only when constructing a new current rule configuration. Never migrate
 * historical profiles merely to attach this label. The argument is untouched. */
export function withRuleProfileConfigVersion(profile:RuleProfile):RuleProfile {
 return {...structuredClone(profile),version:ruleProfileConfigVersion(profile)};
}
