import {sha256} from '@noble/hashes/sha2.js';
import type {HeroViewModel,RuleProfile} from '../contracts';
import {assertPublicReplayVersion} from '../core/engine';
import {isPackedImmutableNode} from '../storage/packed-hand';

/** Public immutable origin descriptor; not authentication or human calibration. */
export interface HandProvenance {
 version:1;mode:'cash'|'lab';source:'csprng'|'fixed-deck';
 ruleset:{id:string;version:string;fingerprint:string};
}
export type HandNamespace='cash'|'imported'|'lab';
export interface ProvenanceCarrier {
 provenance?:unknown;
 view:{profile:RuleProfile};
 frames?:readonly {profile:RuleProfile}[];
}
export interface EffectiveHandProvenance {
 namespace:HandNamespace;
 mode:'cash'|'study'|'lab';
 source:'csprng'|'fixed-deck'|'replay-import'|'legacy-unknown';
 originStatus:'recorded'|'legacy-unknown';
 ruleset:HandProvenance['ruleset'];
 financiallyEligible:boolean;
}

function requireProvenance(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message);}
function canonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 const record=value as Record<string,unknown>;
 return `{${Object.keys(record).filter(key=>record[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
/** Pins every actual profile parameter, including the hand's resolved rake cap. */
export function ruleProfileFingerprint(profile:RuleProfile):string {
 requireProvenance(profile&&typeof profile.id==='string'&&profile.id.length>0&&typeof profile.version==='string'&&profile.version.length>0,'Missing ruleset identity for hand provenance.');
 return [...sha256(new TextEncoder().encode(canonical(profile)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function ruleTag(profile:RuleProfile):HandProvenance['ruleset'] {
 return {id:profile.id,version:profile.version,fingerprint:ruleProfileFingerprint(profile)};
}
/** Call only from the ordinary engine-created cash path, before sealing history.
 * No entropy, cards, fixture override or game mutation is available in this API. */
export function makeCashHandProvenance(profile:RuleProfile):HandProvenance {
 return Object.freeze({version:1,mode:'cash',source:'csprng',ruleset:Object.freeze(ruleTag(profile))});
}
function exactPlain(value:unknown,keys:string[]):value is Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const prototype=Object.getPrototypeOf(value);
 if(prototype!==Object.prototype&&prototype!==null)return false;
 const actual=Reflect.ownKeys(value);
 return actual.length===keys.length&&actual.every(key=>typeof key==='string'&&keys.includes(key)&&Object.getOwnPropertyDescriptor(value,key)?.get===undefined&&Object.getOwnPropertyDescriptor(value,key)?.set===undefined);
}
/** Missing tags are legacy, never guessed or retroactively added to old hashes. */
export function validateHandProvenance(hand:ProvenanceCarrier):HandProvenance|null {
 if(hand.provenance===undefined)return null;
 const value=hand.provenance;
 requireProvenance(exactPlain(value,['version','mode','source','ruleset']),'Invalid hand provenance structure.');
 requireProvenance(value.version===1,'Unsupported hand provenance version.');
 requireProvenance(value.mode==='cash'&&value.source==='csprng'||value.mode==='lab'&&value.source==='fixed-deck','Incoherent hand mode/source provenance.');
 requireProvenance(exactPlain(value.ruleset,['id','version','fingerprint']),'Invalid hand ruleset provenance structure.');
 const rules=value.ruleset,profile=hand.view.profile;
 requireProvenance(typeof rules.id==='string'&&rules.id===profile.id&&typeof rules.version==='string'&&rules.version===profile.version,'Hand provenance ruleset identity differs from recorded hand.');
 requireProvenance(typeof rules.fingerprint==='string'&&/^[0-9a-f]{64}$/.test(rules.fingerprint)&&rules.fingerprint===ruleProfileFingerprint(profile),'Hand provenance ruleset fingerprint differs from recorded hand.');
 const fingerprints=new WeakMap<object,string>();if(isPackedImmutableNode(profile))fingerprints.set(profile,rules.fingerprint as string);
 for(const frame of hand.frames??[]){
  const p=frame.profile,known=isPackedImmutableNode(p)?fingerprints.get(p):undefined;
  const fingerprint=known??ruleProfileFingerprint(p);if(known===undefined&&isPackedImmutableNode(p))fingerprints.set(p,fingerprint);
  requireProvenance(fingerprint===rules.fingerprint,'Hand provenance ruleset changed during replay.');
 }
 return value as unknown as HandProvenance;
}
/** Financial-history validation must call this in full AND incremental audits.
 * Legacy local cash remains compatible with its already verified money ledger. */
export function assertCashHandProvenance(hand:ProvenanceCarrier & {view:HeroViewModel;frames?:readonly HeroViewModel[]}):void {
 // New engine capabilities must be explicit even on untagged/resealed local records.
 // Preserve legacy public bytes: only straddle-capable hands carry an engine marker.
 assertPublicReplayVersion(hand.view);
 for(const frame of hand.frames??[])if(frame.profile.straddle!==undefined||frame.engineVersion!==undefined||frame.straddleSeat!==undefined)assertPublicReplayVersion(frame);
 const provenance=validateHandProvenance(hand);
 requireProvenance(provenance===null||provenance.mode==='cash'&&provenance.source==='csprng','Lab/fixed-deck hands cannot enter cash accounting or performance.');
}
/** Defense for ordinary cash projections. Namespace remains essential: a public
 * import's own cash/CSPRNG claim never authorizes a local bankroll or stat credit. */
export function isCashPerformanceHand(hand:ProvenanceCarrier,namespace:HandNamespace):boolean {
 requireProvenance(['cash','imported','lab'].includes(namespace),'Unknown hand provenance namespace.');
 const provenance=validateHandProvenance(hand);
 return namespace==='cash'&&(provenance===null||provenance.mode==='cash'&&provenance.source==='csprng');
}
/** Display/analysis wrapper only: never changes or reseals a historical record. */
export function describeHandProvenance(hand:ProvenanceCarrier,namespace:HandNamespace):EffectiveHandProvenance {
 requireProvenance(['cash','imported','lab'].includes(namespace),'Unknown hand provenance namespace.');
 const provenance=validateHandProvenance(hand),cash=provenance===null||provenance.mode==='cash';
 return {namespace,mode:namespace==='imported'?'study':namespace==='lab'?'lab':provenance?.mode??'cash',
  source:namespace==='imported'?'replay-import':provenance?.source??'legacy-unknown',originStatus:provenance?'recorded':'legacy-unknown',
  ruleset:provenance?{...provenance.ruleset}:ruleTag(hand.view.profile),financiallyEligible:namespace==='cash'&&cash};
}
