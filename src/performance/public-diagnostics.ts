import {observeTimings,type TimingSample} from './timing';

/** Explicit opt-in, timing-only measurement of the exact production bundle.
 * No cards, decisions, player identities, profiles or financial values cross
 * this boundary. There is no saved log, polling timer or growing buffer here.
 * The external test harness owns bounded collection and consent/UI labels. */
export const PERFORMANCE_SAMPLE_EVENT='ai-texas-performance-sample';
const allowed=new Set([
 'bot.prepare','bot.policy','bot.publicMemory','snapshot.draft','integrity.incremental','integrity.fullAudit',
 'persistence.commit','persistence.load','persistence.prepareSegments','persistence.prepareRecovery','persistence.transaction','persistence.packHand',
 'persistence.installRecovery.prepare','persistence.installRecovery.transaction','persistence.installPacked.prepare','persistence.installPacked.transaction',
 'recovery.fastRestore','recovery.financialArchive','recovery.residentArchive','recovery.archiveInventory','recovery.explicitFullHistory','recovery.canonicalArchiveAudit',
 'recovery.freeze','recovery.freezeTransport','recovery.unpackHand','recovery.prepareCheckpoint','recovery.verifyFinancialCheckpoint',
 'recovery.handChain','recovery.ledgerChain','recovery.handSemantics','recovery.financialSemantics','recovery.configurationSemantics','recovery.read.canonicalFallback',
 'statistics.aggregate','statistics.prewarm','ui.render','ui.sync','ui.historyProjection',
 ...['ledger','hands','closedSessions','importedHands'].flatMap(name=>[`recovery.read.${name}`,`recovery.segmentHash.${name}`]),
]);
export interface PublicTimingSample {version:1;name:string;milliseconds:number;startTime:number;endTime:number;sequence:number}
type Target=Pick<Window,'location'|'dispatchEvent'|'addEventListener'|'removeEventListener'>;
export function startPublicPerformanceDiagnostics(target:Target=window):()=>void{
 if(new URLSearchParams(target.location.search).get('measurePerformance')!=='1')return()=>{};
 let active=true,sequence=0;
 const publish=(sample:TimingSample)=>{
  if(!active||!allowed.has(sample.name)||!Number.isFinite(sample.milliseconds)||sample.milliseconds<0)return;
  const endTime=sample.endTime??performance.now(),startTime=sample.startTime??endTime-sample.milliseconds;
  if(!Number.isFinite(startTime)||!Number.isFinite(endTime)||startTime<0||endTime<startTime)return;
  const detail:PublicTimingSample=Object.freeze({version:1,name:sample.name,milliseconds:sample.milliseconds,startTime,endTime,sequence:++sequence});
  try{target.dispatchEvent(new CustomEvent<PublicTimingSample>(PERFORMANCE_SAMPLE_EVENT,{detail}));}catch{/* Diagnostics cannot fail a poker action or storage commitment. */}
 };
 observeTimings(publish);
 const stop=()=>{if(!active)return;active=false;observeTimings(null);target.removeEventListener('pagehide',stop);};
 target.addEventListener('pagehide',stop,{once:true});
 return stop;
}
