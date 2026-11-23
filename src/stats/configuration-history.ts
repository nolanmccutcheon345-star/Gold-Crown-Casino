import type {OpponentConfig,PopulationPreset,RuleProfile} from '../contracts';
import type {CashSession,StoredHand} from '../session/types';
import type {ConfigurationChangeReason,RecordedCashConfiguration} from '../session/configuration-history';
export interface ConfigurationHistoryRow {
 key:string;sessionId:string;status:'RECORDED'|'LEGACY_UNKNOWN';startedAt:string;firstHandNumber:number;lastHandNumber:number|null;hands:number;profit:number;bb100:number|null;
 population:PopulationPreset|null;tableMode:'live'|'study'|null;occupiedSeats:number;capacity:number|null;selectionMix:{selection:OpponentConfig['selection'];count:number}[]|null;
 evidenceStatus:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED'|'LEGACY_UNRECORDED';ruleId:string;ruleVersion:string;smallBlind:number;bigBlind:number;rake:RuleProfile['rake'];policyVersions:string[];
 changeReason:ConfigurationChangeReason|'legacy-unknown';disclosure:string;
}
export function rowForRecordedConfiguration(entry:RecordedCashConfiguration):ConfigurationHistoryRow {
 return {key:entry.id,sessionId:entry.sessionId,status:'RECORDED',startedAt:entry.recordedAt,firstHandNumber:entry.effectiveHandNumber,lastHandNumber:null,hands:0,profit:0,bb100:null,
  population:entry.population,tableMode:entry.tableMode,occupiedSeats:entry.occupiedSeatIds.length,capacity:entry.capacity,selectionMix:entry.selectionMix.map(mix=>({...mix})),evidenceStatus:entry.evidenceStatus,
  ruleId:entry.rules.id,ruleVersion:entry.rules.version,smallBlind:entry.rules.smallBlind,bigBlind:entry.rules.bigBlind,rake:structuredClone(entry.rules.rake),policyVersions:[...entry.policyVersions],changeReason:entry.reason,
  disclosure:'Recorded Host Setup selections and synthetic environment, not observed or inferred opponent identities. Unknown/Random remain unresolved. No human calibration is claimed. Effective at the recorded safe hand boundary; prior hands remain unchanged.'};
}
export function rowForHandConfiguration(hand:StoredHand):ConfigurationHistoryRow {
 const p=hand.view.profile,versions=[...new Set(Object.values(hand.privateProfiles).map(profile=>profile.policyVersion).filter(version=>typeof version==='string'&&version.length>0))].sort();
 const row=hand.configuration?rowForRecordedConfiguration(hand.configuration):{
  key:JSON.stringify(['legacy-configuration',hand.sessionId,hand.view.seats.length,p.id,p.version,p.smallBlind,p.bigBlind,p.rake,versions]),sessionId:hand.sessionId,status:'LEGACY_UNKNOWN' as const,startedAt:hand.startedAt,firstHandNumber:hand.number,lastHandNumber:null,hands:0,profit:0,bb100:null,
  population:null,tableMode:null,occupiedSeats:hand.view.seats.length,capacity:null,selectionMix:null,evidenceStatus:'LEGACY_UNRECORDED' as const,ruleId:p.id,ruleVersion:p.version,smallBlind:p.smallBlind,bigBlind:p.bigBlind,rake:structuredClone(p.rake),policyVersions:versions,changeReason:'legacy-unknown' as const,
  disclosure:'Legacy population, original Host Setup selections, capacity and change boundaries were not recorded. Rules/rake/policy versions come only from this immutable hand. No current setting or hidden persona is used to invent missing history; grouped hand spans may be nonconsecutive.',
 };
 return {...row,hands:1,profit:hand.net,bb100:100*(hand.net/p.bigBlind),lastHandNumber:hand.number};
}
/** Include the latest committed boundary immediately, even before its first
 * payout. This projection never samples bots or reads current mutable settings. */
export function includeConfigurationBoundaries(rows:ConfigurationHistoryRow[],sessions:readonly CashSession[]):ConfigurationHistoryRow[] {
 const out=[...rows],known=new Set(out.map(row=>row.key));
 for(const session of sessions)for(const entry of session.configurationHistory??[])if(!known.has(entry.id)){known.add(entry.id);out.push(rowForRecordedConfiguration(entry));}
 return out.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.sessionId.localeCompare(b.sessionId)||a.firstHandNumber-b.firstHandNumber||a.key.localeCompare(b.key));
}
/** Independent full-history aggregation; no persisted summary is trusted. */
export function deriveConfigurationHistory(hands:StoredHand[],sessions:CashSession[]):ConfigurationHistoryRow[] {
 const groups=new Map<string,ConfigurationHistoryRow>();
 for(const hand of hands){
  const row=rowForHandConfiguration(hand),prior=groups.get(row.key);
  if(!prior)groups.set(row.key,row);
  else{prior.hands++;prior.profit+=hand.net;prior.lastHandNumber=Math.max(prior.lastHandNumber??0,hand.number);prior.firstHandNumber=Math.min(prior.firstHandNumber,hand.number);if(hand.startedAt<prior.startedAt)prior.startedAt=hand.startedAt;}
 }
 // Each immutable configuration key fixes the blind. Sum integer cents first to
 // avoid repeated fractional-BB rounding, then apply the common BB/100 formula.
 return includeConfigurationBoundaries([...groups.values()].map(row=>({...row,bb100:100*(row.profit/row.bigBlind)/row.hands})),sessions);
}
