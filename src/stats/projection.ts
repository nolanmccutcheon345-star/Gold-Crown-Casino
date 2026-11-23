import { CASH_STAT_FORMULAS, deriveCashStats, STAT_DEFINITIONS, type CashStats, type MetricKey, type RateStat, type ResultGroup } from './cash';
import type { CashSession, StoredHand } from '../session/types';
import { isVerifiedHistory } from '../storage/verified';
import {assertCashHandProvenance} from '../session/hand-provenance';
import {includeConfigurationBoundaries,type ConfigurationHistoryRow} from './configuration-history';
import {recoveryScheduler} from '../storage/recovery-scheduler';
import {validateRake} from '../rules/rake';

export const CASH_PROJECTION_VERSION='cash-projection-1';
export const CASH_CHECKPOINT_FORMAT='ai-texas-hold-em.cash-stats';
export interface ProjectionCheckpointBinding {hands:number;lastId:string|null;lastHash:string|null}
export interface CashAggregateCheckpoint {key:string;label:string;hands:number;profit:number;rake:number;byBlind:[number,number][]}
/** No cards, private profiles, frames, session clocks, or financial authority.
 * Version changes invalidate this disposable projection; canonical history remains
 * the independent source from which it can be rebuilt. */
export interface CashProjectionCheckpoint {
 format:typeof CASH_CHECKPOINT_FORMAT;version:1;projectionVersion:typeof CASH_PROJECTION_VERSION;
 checkpoint:ProjectionCheckpointBinding;handIds:string[];sessionNumbers:[string,number][];
 all:CashAggregateCheckpoint;sessions:CashAggregateCheckpoint[];positions:CashAggregateCheckpoint[];
 stakes:CashAggregateCheckpoint[];configurations:CashAggregateCheckpoint[];
 configurationHistory:{row:ConfigurationHistoryRow;aggregate:CashAggregateCheckpoint}[];
 counters:Record<MetricKey,[number,number]>;completeHands:number;
}
interface Aggregate {key:string;label:string;hands:number;profit:number;rake:number;byBlind:Map<number,number>}
const empty=(key:string,label:string):Aggregate=>({key,label,hands:0,profit:0,rake:0,byBlind:new Map()});
function append(group:Aggregate,hand:StoredHand,rake:number):void {
 group.hands++;group.profit+=hand.net;group.rake+=rake;
 const blind=hand.view.profile.bigBlind;group.byBlind.set(blind,(group.byBlind.get(blind)??0)+hand.net);
}
function result(group:Aggregate):ResultGroup {
 const bb=[...group.byBlind].reduce((sum,[blind,net])=>sum+net/blind,0);
 return {key:group.key,label:group.label,hands:group.hands,profit:group.profit,rake:group.rake,bb100:group.hands?100*bb/group.hands:null};
}
const metricKeys=Object.keys(STAT_DEFINITIONS) as MetricKey[];
function requireCheckpoint(ok:unknown,message:string):asserts ok {if(!ok)throw Error(`Invalid statistics checkpoint: ${message}`);}
const count=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
const identity=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
function exact(value:unknown,keys:string[]):value is Record<string,unknown> {
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
}
/** Inspect descriptors before cloning: restoration never executes caller getters.
 * This establishes JSON shape only. Neither a hash nor this check authenticates a
 * persisted checkpoint; the storage boundary must establish its committed origin. */
function assertPlainData(value:unknown,path=new WeakSet<object>()):void {
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){requireCheckpoint(Number.isFinite(value),'non-finite value');return;}
 requireCheckpoint(!!value&&typeof value==='object','non-JSON value');
 const proto=Object.getPrototypeOf(value);requireCheckpoint(proto===Object.prototype||proto===null||Array.isArray(value)&&proto===Array.prototype,'non-plain data');
 requireCheckpoint(!path.has(value),'cyclic data');path.add(value);
 for(const key of Reflect.ownKeys(value)){
  requireCheckpoint(typeof key==='string','symbol data');
  if(Array.isArray(value)&&key==='length')continue;
  const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
  requireCheckpoint('value'in descriptor&&descriptor.enumerable,'accessor or hidden property');assertPlainData(descriptor.value,path);
 }
 if(Array.isArray(value))requireCheckpoint(Object.keys(value).length===value.length,'sparse or decorated array');
 path.delete(value);
}
const encodeAggregate=(group:Aggregate):CashAggregateCheckpoint=>({...group,byBlind:[...group.byBlind].map(([blind,net])=>[blind,net])});
function decodeAggregate(value:unknown,allowEmpty=false):Aggregate {
 requireCheckpoint(exact(value,['key','label','hands','profit','rake','byBlind']),'aggregate shape');
 const {key,label,hands,profit,rake,byBlind}=value;
 requireCheckpoint(identity(key)&&typeof label==='string'&&count(hands)&&(allowEmpty||hands>0)&&Number.isSafeInteger(profit)&&count(rake)&&Array.isArray(byBlind),'aggregate values');
 const blindTotals=new Map<number,number>();let sum=0;
 for(const pair of byBlind){
  requireCheckpoint(Array.isArray(pair)&&pair.length===2&&count(pair[0])&&pair[0]>0&&Number.isSafeInteger(pair[1])&&!blindTotals.has(pair[0]),'blind totals');
  blindTotals.set(pair[0],pair[1]);sum+=pair[1];requireCheckpoint(Number.isSafeInteger(sum),'unsafe blind total');
 }
 requireCheckpoint(sum===profit&&(hands>0?blindTotals.size>0:blindTotals.size===0&&profit===0&&rake===0),'blind/profit reconciliation');
 return {key,label,hands,profit:profit as number,rake,byBlind:blindTotals};
}
function decodeGroups(value:unknown,all:Aggregate):Map<string,Aggregate> {
 requireCheckpoint(Array.isArray(value),'group collection');const groups=new Map<string,Aggregate>();
 for(const item of value){const group=decodeAggregate(item);requireCheckpoint(!groups.has(group.key),'duplicate group');groups.set(group.key,group);}
 reconcileGroups([...groups.values()],all);return groups;
}
function reconcileGroups(groups:Aggregate[],all:Aggregate):void {
 let hands=0,profit=0,rake=0;const blinds=new Map<number,number>();
 for(const group of groups){hands+=group.hands;profit+=group.profit;rake+=group.rake;requireCheckpoint([hands,profit,rake].every(Number.isSafeInteger),'unsafe group totals');for(const [blind,net]of group.byBlind)blinds.set(blind,(blinds.get(blind)??0)+net);}
 requireCheckpoint(hands===all.hands&&profit===all.profit&&rake===all.rake&&blinds.size===all.byBlind.size&&[...blinds].every(([blind,net])=>Number.isSafeInteger(net)&&net===all.byBlind.get(blind)),'group reconciliation');
}
function validateConfigurationRow(row:unknown,aggregate:Aggregate,sessionNumbers:Map<string,number>):asserts row is ConfigurationHistoryRow {
 requireCheckpoint(exact(row,['key','sessionId','status','startedAt','firstHandNumber','lastHandNumber','hands','profit','bb100','population','tableMode','occupiedSeats','capacity','selectionMix','evidenceStatus','ruleId','ruleVersion','smallBlind','bigBlind','rake','policyVersions','changeReason','disclosure']),'configuration row shape');
 requireCheckpoint(row.key===aggregate.key&&identity(row.sessionId)&&sessionNumbers.has(row.sessionId)&&identity(row.startedAt)&&Number.isFinite(Date.parse(row.startedAt))&&count(row.firstHandNumber)&&row.firstHandNumber>0&&count(row.lastHandNumber)&&row.lastHandNumber>=row.firstHandNumber&&row.lastHandNumber<=sessionNumbers.get(row.sessionId)!,'configuration sequence');
 requireCheckpoint(row.hands===aggregate.hands&&row.profit===aggregate.profit&&row.bb100===result(aggregate).bb100&&count(row.occupiedSeats)&&row.occupiedSeats>=2&&row.occupiedSeats<=10&&(row.capacity===null||count(row.capacity)&&row.capacity>=row.occupiedSeats&&row.capacity<=10),'configuration totals/seats');
 requireCheckpoint(identity(row.ruleId)&&identity(row.ruleVersion)&&count(row.smallBlind)&&row.smallBlind>0&&count(row.bigBlind)&&row.bigBlind>=row.smallBlind&&aggregate.byBlind.size===1&&aggregate.byBlind.has(row.bigBlind)&&typeof row.disclosure==='string','configuration rules');
 requireCheckpoint(Array.isArray(row.policyVersions)&&row.policyVersions.every(identity)&&new Set(row.policyVersions).size===row.policyVersions.length,'configuration policies');
 requireCheckpoint(!!row.rake&&typeof row.rake==='object','configuration rake');validateRake(row.rake as ConfigurationHistoryRow['rake']);
 const recorded=row.status==='RECORDED';requireCheckpoint(recorded||row.status==='LEGACY_UNKNOWN','configuration status');
 if(recorded){
  requireCheckpoint(['low','mid','high','neutral'].includes(String(row.population))&&['live','study'].includes(String(row.tableMode))&&row.capacity!==null&&row.evidenceStatus==='DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED'&&['session-start','next-hand-configuration','next-hand-table-change','first-recorded-boundary'].includes(String(row.changeReason))&&Array.isArray(row.selectionMix),'recorded configuration metadata');
  const selections=new Set<string>();let seats=1;for(const mix of row.selectionMix){requireCheckpoint(exact(mix,['selection','count'])&&identity(mix.selection)&&['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg','random','unknown','custom'].includes(mix.selection)&&!selections.has(mix.selection)&&count(mix.count)&&mix.count>0,'configuration selections');selections.add(mix.selection);seats+=mix.count;}requireCheckpoint(seats===row.occupiedSeats,'configuration selection count');
 }else requireCheckpoint(row.population===null&&row.tableMode===null&&row.capacity===null&&row.selectionMix===null&&row.evidenceStatus==='LEGACY_UNRECORDED'&&row.changeReason==='legacy-unknown','legacy configuration metadata');
}
function rate(numerator:number,denominator:number):RateStat {
 if(denominator===0)return {numerator,denominator,percent:null,ci95:null,status:'NO_OPPORTUNITIES'};
 const p=numerator/denominator,z=1.959963984540054,scale=1+z*z/denominator;
 const center=(p+z*z/(2*denominator))/scale;
 const radius=z*Math.sqrt((p*(1-p)+z*z/(4*denominator))/denominator)/scale;
 return {numerator,denominator,percent:100*p,ci95:[100*Math.max(0,center-radius),100*Math.min(1,center+radius)],status:denominator<100?'INSUFFICIENT_SAMPLE':'DESCRIPTIVE'};
}
export interface ProjectionDiagnostics {
 version:string;projectedHands:number;cachedSnapshotHits:number;mutableFallbacks:number;
 rebuilds:number;lastInvalidation:string|null;checkpoint:{hands:number;lastId:string|null;lastHash:string|null};
}
/**
 * Read-only, disposable statistics projection. The controller/storage boundary must
 * still cryptographically validate canonical history and financial reconciliation.
 * Frozen references are an immutability guarantee, NOT proof that a hash is valid.
 * The private storage audit capability can avoid duplicate immutability inspection;
 * caller-provided hashes and merely frozen objects cannot grant that capability.
 * Mutable input is replayed in full on every call. Imports stay in importedHands,
 * outside this canonical StoredHand API. Persisted projections may enter only via
 * restoreCheckpoint after storage has verified the checkpoint and its binding.
 */
export class CashStatsProjection {
 private history:readonly StoredHand[]|null=null;
 private immutable=new WeakSet<object>();
 private ids=new Set<string>();
 private sessionNumbers=new Map<string,number>();
 private all=empty('cash','All cash hands');
 private sessionGroups=new Map<string,Aggregate>();
 private positions=new Map<string,Aggregate>();
 private stakes=new Map<string,Aggregate>();
 private configurations=new Map<string,Aggregate>();
 private configurationHistory=new Map<string,{row:ConfigurationHistoryRow;aggregate:Aggregate}>();
 private counters=Object.fromEntries(metricKeys.map(k=>[k,[0,0]])) as Record<MetricKey,[number,number]>;
 private complete=0;
 private checkpointMode=false;
 private exportable=false;
 private diagnostics:ProjectionDiagnostics={version:CASH_PROJECTION_VERSION,projectedHands:0,cachedSnapshotHits:0,mutableFallbacks:0,rebuilds:0,lastInvalidation:null,checkpoint:{hands:0,lastId:null,lastHash:null}};
 getDiagnostics():ProjectionDiagnostics {return {...this.diagnostics,checkpoint:{...this.diagnostics.checkpoint}};}
 /** Build a disposable projection cooperatively from an already audited, immutable
  * canonical history. The caller receives nothing until every record succeeds.
  * No persisted summary, partial result, or caller-provided hash is trusted. */
 static async prewarm(records:readonly StoredHand[],options:{yieldControl?:()=>Promise<void>|undefined;cancelled?:()=>boolean}={}):Promise<CashStatsProjection> {
  if(!isVerifiedHistory(records))throw new Error('Statistics preparation requires verified canonical history');
  const projection=new CashStatsProjection(),ids=new Set<string>(),numbers=new Map<string,number>();
  const cooperate=options.yieldControl??recoveryScheduler();let previous='0'.repeat(64);
  for(const hand of records){
   if(options.cancelled?.())throw new Error('Statistics preparation cancelled');
   projection.validateHand(hand,previous,ids,numbers);projection.add(hand);previous=hand.hash;
   const pause=cooperate();if(pause)await pause;
  }
  if(options.cancelled?.())throw new Error('Statistics preparation cancelled');
  projection.history=records;const last=records.at(-1);
  projection.exportable=true;
  projection.diagnostics.checkpoint={hands:records.length,lastId:last?.id??null,lastHash:last?.hash??null};
  return projection;
 }
 /** Export only after the canonical history audit, or an explicitly authorized
  * storage restore. The outer transaction must hash/pin this exact payload with
  * its financial checkpoint; this module does not confer that storage capability. */
 exportCheckpoint():CashProjectionCheckpoint {
  requireCheckpoint(this.exportable,'export requires audited canonical history or a storage-authorized restore');
  return {
   format:CASH_CHECKPOINT_FORMAT,version:1,projectionVersion:CASH_PROJECTION_VERSION,
   checkpoint:{...this.diagnostics.checkpoint},handIds:[...this.ids],sessionNumbers:[...this.sessionNumbers],all:encodeAggregate(this.all),
   sessions:[...this.sessionGroups.values()].map(encodeAggregate),positions:[...this.positions.values()].map(encodeAggregate),stakes:[...this.stakes.values()].map(encodeAggregate),configurations:[...this.configurations.values()].map(encodeAggregate),
   configurationHistory:[...this.configurationHistory.values()].map(({row,aggregate})=>({row:structuredClone({...row,hands:aggregate.hands,profit:aggregate.profit,bb100:result(aggregate).bb100}),aggregate:encodeAggregate(aggregate)})),
   counters:Object.fromEntries(metricKeys.map(key=>[key,[...this.counters[key]]])) as Record<MetricKey,[number,number]>,completeHands:this.complete,
  };
 }
 /** STORAGE-ONLY TRUST BOUNDARY: the caller must first verify the committed outer
  * checkpoint and supply its independently obtained hand sequence binding. This
  * validates structure and internal arithmetic, not authenticity or historical
  * truth. A caller-supplied matching hash cannot prove aggregate correctness.
  * Full deriveCashStats replay remains the independent historical audit. */
 static restoreCheckpoint(input:unknown,expected:ProjectionCheckpointBinding):CashStatsProjection {
  assertPlainData(input);assertPlainData(expected);
  requireCheckpoint(exact(input,['format','version','projectionVersion','checkpoint','handIds','sessionNumbers','all','sessions','positions','stakes','configurations','configurationHistory','counters','completeHands']),'root shape');
  requireCheckpoint(input.format===CASH_CHECKPOINT_FORMAT&&input.version===1&&input.projectionVersion===CASH_PROJECTION_VERSION,'unsupported format or policy/statistics version');
  const checkpoint=input.checkpoint;
  requireCheckpoint(exact(expected,['hands','lastId','lastHash'])&&exact(checkpoint,['hands','lastId','lastHash'])&&count(checkpoint.hands),'sequence binding shape');
  requireCheckpoint(checkpoint.hands===expected.hands&&checkpoint.lastId===expected.lastId&&checkpoint.lastHash===expected.lastHash,'storage sequence binding mismatch');
  requireCheckpoint(checkpoint.hands===0?checkpoint.lastId===null&&checkpoint.lastHash===null:identity(checkpoint.lastId)&&typeof checkpoint.lastHash==='string'&&/^[0-9a-f]{64}$/.test(checkpoint.lastHash),'sequence tail');
  requireCheckpoint(Array.isArray(input.handIds)&&input.handIds.length===checkpoint.hands&&input.handIds.every(identity),'hand identities');
  const ids=new Set<string>(input.handIds);requireCheckpoint(ids.size===checkpoint.hands&&(input.handIds.at(-1)??null)===checkpoint.lastId,'duplicate IDs or incorrect last hand');
  const projection=new CashStatsProjection(),all=decodeAggregate(input.all,true);
  requireCheckpoint(all.key==='cash'&&all.label==='All cash hands'&&all.hands===checkpoint.hands,'all-hand count');
  const sessions=decodeGroups(input.sessions,all),numbers=new Map<string,number>();
  requireCheckpoint(Array.isArray(input.sessionNumbers),'session sequences');
  for(const pair of input.sessionNumbers){requireCheckpoint(Array.isArray(pair)&&pair.length===2&&identity(pair[0])&&count(pair[1])&&pair[1]>0&&!numbers.has(pair[0])&&sessions.get(pair[0])?.hands===pair[1],'session sequence reconciliation');numbers.set(pair[0],pair[1]);}
  requireCheckpoint(numbers.size===sessions.size,'missing session sequence');
  projection.positions=decodeGroups(input.positions,all);projection.stakes=decodeGroups(input.stakes,all);projection.configurations=decodeGroups(input.configurations,all);
  requireCheckpoint(Array.isArray(input.configurationHistory),'configuration history');
  for(const item of input.configurationHistory){
   requireCheckpoint(exact(item,['row','aggregate']),'configuration entry');const aggregate=decodeAggregate(item.aggregate);
   validateConfigurationRow(item.row,aggregate,numbers);requireCheckpoint(!projection.configurationHistory.has(aggregate.key),'duplicate configuration boundary');
   projection.configurationHistory.set(aggregate.key,{row:structuredClone(item.row),aggregate});
  }
  reconcileGroups([...projection.configurationHistory.values()].map(item=>item.aggregate),all);
  requireCheckpoint(exact(input.counters,metricKeys),'opportunity counter keys');
  for(const key of metricKeys){const pair=input.counters[key];requireCheckpoint(Array.isArray(pair)&&pair.length===2&&pair.every(count)&&pair[0]<=pair[1],'opportunity numerator/denominator');projection.counters[key]=[pair[0],pair[1]];}
  requireCheckpoint(count(input.completeHands)&&input.completeHands<=all.hands,'opportunity coverage');
  for(const key of ['vpip','pfr','threeBet','foldToThreeBet','wtsd','wsd','wwsf'] as MetricKey[])requireCheckpoint(projection.counters[key][1]<=all.hands,'per-hand opportunity count');
  projection.ids=ids;projection.sessionNumbers=numbers;projection.all=all;projection.sessionGroups=sessions;projection.complete=input.completeHands;
  projection.checkpointMode=true;projection.exportable=true;projection.diagnostics.checkpoint={hands:checkpoint.hands,lastId:checkpoint.lastId as string|null,lastHash:checkpoint.lastHash as string|null};
  return projection;
 }
 /** STORAGE-ONLY: append newly verified canonical records strictly AFTER the
  * stored binding, never a recent-history window containing older hands. Hash,
  * financial, and frame verification belongs to the storage transaction before
  * this call. Duplicate/gapped/out-of-order tails fail before changing totals. */
 appendVerifiedTail(records:readonly StoredHand[],sessions:readonly CashSession[],now=Date.now()):CashStats {
  requireCheckpoint(this.exportable,'tail requires an audited projection or storage-authorized checkpoint');
  if(records.length===0)return this.readCheckpoint(sessions,now);
  const ids=new Set(this.ids),numbers=new Map(this.sessionNumbers);let previous=this.diagnostics.checkpoint.lastHash??'0'.repeat(64);
  for(const hand of records){this.validateHand(hand,previous,ids,numbers);previous=hand.hash;}
  // Opportunity/provenance processing may reject data; finish it for the entire
  // tail before changing counters so a rejected batch leaves a usable checkpoint.
  const prepared=records.map(hand=>deriveCashStats([hand],[],0));
  for(let i=0;i<records.length;i++)this.add(records[i],prepared[i]);
  const last=records.at(-1)!;this.diagnostics.checkpoint={hands:this.all.hands,lastId:last.id,lastHash:last.hash};
  this.history=null;this.checkpointMode=true;return this.readCheckpoint(sessions,now);
 }
 /** Recompute current clocks/closure using compact historical counters only. */
 readCheckpoint(sessions:readonly CashSession[],now=Date.now()):CashStats {
  requireCheckpoint(this.exportable,'read requires an audited projection or storage-authorized checkpoint');return this.render(sessions,now);
 }
 reset(reason='explicit recovery or data/rules/policy version change'):void {
  this.history=null;this.ids.clear();this.sessionNumbers.clear();this.all=empty('cash','All cash hands');
  this.sessionGroups.clear();this.positions.clear();this.stakes.clear();this.configurations.clear();this.configurationHistory.clear();
  this.counters=Object.fromEntries(metricKeys.map(k=>[k,[0,0]])) as Record<MetricKey,[number,number]>;this.complete=0;
  this.checkpointMode=false;this.exportable=false;
  this.diagnostics.rebuilds++;this.diagnostics.lastInvalidation=reason;
  this.diagnostics.checkpoint={hands:0,lastId:null,lastHash:null};
 }
 private isImmutable(value:unknown,visiting=new WeakSet<object>()):boolean {
  if(value===null||typeof value!=='object')return true;
  if(this.immutable.has(value))return true;
  if(!Object.isFrozen(value))return false;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==Array.prototype&&prototype!==null)return false;
  if(visiting.has(value))return false; // canonical JSON must be acyclic
  visiting.add(value);
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
   // Do not execute accessors, including private profile getters.
   if(!('value' in descriptor)||!this.isImmutable(descriptor.value,visiting)){visiting.delete(value);return false;}
  }
  visiting.delete(value);this.immutable.add(value);return true;
 }
 private validateSequence(records:readonly StoredHand[],start:number):void {
  // Validate the whole candidate tail before touching any aggregate. A rejected
  // append leaves the last good checkpoint usable, including after retry.
  const ids=new Set(this.ids),numbers=new Map(this.sessionNumbers);
  let previous=start?records[start-1].hash:'0'.repeat(64);
  for(let i=start;i<records.length;i++) {
   const hand=records[i];this.validateHand(hand,previous,ids,numbers);previous=hand.hash;
  }
 }
 private validateHand(hand:StoredHand,previous:string,ids:Set<string>,numbers:Map<string,number>):void {
  assertCashHandProvenance(hand);
  if(typeof hand.id!=='string'||!hand.id||ids.has(hand.id))throw new Error('Duplicate or missing canonical hand ID');
  if(hand.previousHash!==previous)throw new Error('Statistics history gap or out-of-order chain');
  if(hand.number!==(numbers.get(hand.sessionId)??0)+1)throw new Error('Statistics session hand sequence has a gap or is out of order');
  if(hand.view.street!=='complete'||hand.view.profile.mode!=='cash')throw new Error('Statistics projection requires canonical settled cash hands');
  ids.add(hand.id);numbers.set(hand.sessionId,hand.number);
 }
 private add(hand:StoredHand,one=deriveCashStats([hand],[],0)):void {
  // Per-hand legal-opportunity analysis is shared, but aggregation below is
  // independently implemented from the full-history reference deriveCashStats.
  const row=one.configurationHistory[0],history=this.configurationHistory.get(row.key)??{row:{...row,hands:0,profit:0,bb100:null},aggregate:empty(row.key,'')};
  append(history.aggregate,hand,one.rake);history.row.firstHandNumber=Math.min(history.row.firstHandNumber,hand.number);history.row.lastHandNumber=Math.max(history.row.lastHandNumber??0,hand.number);if(hand.startedAt<history.row.startedAt)history.row.startedAt=hand.startedAt;this.configurationHistory.set(row.key,history);
  append(this.all,hand,one.rake);
  const session=this.sessionGroups.get(hand.sessionId)??empty(hand.sessionId,'');append(session,hand,one.rake);this.sessionGroups.set(hand.sessionId,session);
  for(const [map,groups] of [[this.positions,one.positions],[this.stakes,one.stakes],[this.configurations,one.configurations]] as const) {
   for(const group of groups){const aggregate=map.get(group.key)??empty(group.key,group.label);append(aggregate,hand,one.rake);map.set(group.key,aggregate);}
  }
  for(const key of metricKeys){this.counters[key][0]+=one.metrics[key].numerator;this.counters[key][1]+=one.metrics[key].denominator;}
  this.complete+=one.opportunityCoverage.completeHands;this.ids.add(hand.id);this.sessionNumbers.set(hand.sessionId,hand.number);this.diagnostics.projectedHands++;
 }
 derive(records:readonly StoredHand[],sessions:readonly CashSession[],now=Date.now()):CashStats {
  if(this.checkpointMode)throw Error('Restored statistics require appendVerifiedTail/readCheckpoint; reset before a full history derive');
  if(records===this.history)this.diagnostics.cachedSnapshotHits++;
  else {
   if(!isVerifiedHistory(records)&&!this.isImmutable(records)) {
    this.reset('mutable history requires independent full replay');this.diagnostics.mutableFallbacks++;
    return deriveCashStats([...records],[...sessions],now);
   }
   if(this.history&&(records.length<this.history.length||this.history.some((record,index)=>records[index]!==record)))this.reset('history prefix replaced, removed, reordered or version changed');
   const start=this.history?.length??0;
   this.validateSequence(records,start);
   try {for(let i=start;i<records.length;i++)this.add(records[i]);}
   catch(error){this.reset('projection failed; next call must rebuild');throw error;}
   this.history=records;const last=records.at(-1);
   this.exportable=isVerifiedHistory(records);
   this.diagnostics.checkpoint={hands:records.length,lastId:last?.id??null,lastHash:last?.hash??null};
  }
  return this.render(sessions,now);
 }
 private render(sessions:readonly CashSession[],now:number):CashStats {
  // Session clocks/closure are read afresh: they are not historical-hand work and
  // must change even while no new hand is committed.
  const sessionResults=sessions.map(session=>{
   const activeMs=session.activeMs+(session.endedAt===null&&session.lastActiveAt!==null?Math.max(0,now-session.lastActiveAt):0);
   const group=result(this.sessionGroups.get(session.id)??empty(session.id,session.startedAt));
   return {...group,label:session.startedAt,id:session.id,startedAt:session.startedAt,endedAt:session.endedAt,activeMs,perHour:activeMs>0?group.profit*3600000/activeMs:null};
  });
  const all=result(this.all),activeMs=sessionResults.reduce((sum,session)=>sum+session.activeMs,0);
  const stakes=[...this.stakes.values()].map(result);
  return {...all,namespace:'cash',activeMs,perHour:activeMs>0?all.profit*3600000/activeMs:null,
   winningSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit>0).length,losingSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit<0).length,evenSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit===0).length,
   activeSession:sessionResults.find(s=>s.endedAt===null)??null,sessions:sessionResults,mixedStakes:stakes.length>1,
   metrics:Object.fromEntries(metricKeys.map(key=>[key,rate(...this.counters[key])])) as Record<MetricKey,RateStat>,
   positions:[...this.positions.values()].map(result),stakes,configurations:[...this.configurations.values()].map(result),configurationHistory:includeConfigurationBoundaries([...this.configurationHistory.values()].map(({row,aggregate})=>{const total=result(aggregate);return {...structuredClone(row),hands:total.hands,profit:total.profit,bb100:total.bb100};}),sessions),
   disclosure:`Observed virtual cash simulation only. ${all.hands} settled hands; ${sessionResults.length} sessions. ${CASH_STAT_FORMULAS.uncertainty} ${CASH_STAT_FORMULAS.rake}`,
   opportunityCoverage:{completeHands:this.complete,missingFrames:all.hands-this.complete},
  };
 }
}
