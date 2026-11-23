import type {AppData,StoredHand} from '../session/types';
import type {CashProjectionCheckpoint} from '../stats/projection';
import type {PublicMemoryCheckpoint} from '../session/bot-observation';
import {auditCompactSnapshot,prepareCompactSnapshot} from './verified';
import {requireData} from './integrity';

/** Financial/archive descriptors are never StoredHand objects or a replay view.
 * The original canonical rows remain authoritative and independently auditable. */
export interface HandFinancialIndex extends Pick<StoredHand,'id'|'sessionId'|'epoch'|'number'|'startedAt'|'endedAt'|'net'|'hash'|'previousHash'> {
 viewHash:string;seats:number[];policyVersions:string[];
 rules:{id:string;version:string;fingerprint:string};
 configurationId:string|null;
}
export interface CompactArchiveContext {
 format:'ai-texas-compact-financial';version:1;
 handOffset:number;handIndex:HandFinancialIndex[];
 statistics:CashProjectionCheckpoint;statisticsHands:number;
 botMemory:PublicMemoryCheckpoint;
}
export interface CompactContextDelta {
 indexOffset:number;appendedIndex:HandFinancialIndex[];handOffset:number;
 statistics?:CashProjectionCheckpoint;statisticsHands:number;botMemory?:PublicMemoryCheckpoint;
}
/** Storage verifies its checkpoint/journal envelope and exact canonical manifest
 * before calling audit. No deserialized object gains provenance from a flag. */
export const compactRecoveryHooks={
 compact:prepareCompactSnapshot,
 audit:auditCompactSnapshot,
 contextDelta(before:CompactArchiveContext,after:CompactArchiveContext):CompactContextDelta {
  requireData(after.handIndex.length>=before.handIndex.length,'Financial index lost committed hands.');
  for(let i=0;i<before.handIndex.length;i++)requireData(before.handIndex[i].hash===after.handIndex[i].hash&&before.handIndex[i].id===after.handIndex[i].id,'Financial index prefix changed.');
  return {indexOffset:before.handIndex.length,appendedIndex:after.handIndex.slice(before.handIndex.length),handOffset:after.handOffset,
   ...(before.statistics!==after.statistics?{statistics:after.statistics}:{}),statisticsHands:after.statisticsHands,
   ...(before.botMemory!==after.botMemory?{botMemory:after.botMemory}:{})};
 },
 applyContext(before:CompactArchiveContext,delta:CompactContextDelta):CompactArchiveContext {
  requireData(delta.indexOffset===before.handIndex.length&&Array.isArray(delta.appendedIndex),'Financial index journal gap or duplicate.');
  return {...before,handOffset:delta.handOffset,handIndex:[...before.handIndex,...delta.appendedIndex],statistics:delta.statistics??before.statistics,statisticsHands:delta.statisticsHands,botMemory:delta.botMemory??before.botMemory};
 },
};
export type CompactSnapshot={data:AppData;context:CompactArchiveContext};
