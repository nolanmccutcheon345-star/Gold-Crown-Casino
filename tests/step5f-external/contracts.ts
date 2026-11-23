/** External observations only. This module never imports engine or session state. */
export const ORIGINAL_CRITERIA = {
 U10:'Core actions operable and properly announced without animation-only meaning',
 U11:'Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop',
 V518:'Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels.',
 V707:'Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion.',
} as const;
export type Outcome='NOT_EXECUTED'|'PASS'|'FAIL'|'BLOCKED';
export interface DeviceRecord {kind:'physical'|'emulated'|'unknown';model:string;os:string;osVersion:string;browser:string;browserVersion:string;declaredReference:boolean;viewport:string;orientation:string;powerMode:string;storageHands:number|null}
export interface CandidateRecord {sourceCommit:string;buildId:string;bundleSHA256:string;url:string;isolatedOrigin:boolean;isolatedSave:boolean}
export interface ScreenReaderRecord {name:string;version:string;browser:string;spokenEvidence:Array<{task:string;expected:string;actuallyHeard:string;outcome:Outcome}>}
export interface StudyHand {ordinal:number;handReference:string;completed:boolean;observed:boolean;intendedAction:string;actualAction:string;minRaiseShown:string;raiseToShown:string;additionalShown:string;callShown:string;misclicks:Array<{intended:string;actual:string;severity:'critical'|'major'|'minor';steps:string;artifact:string}>;ambiguity:string;artifact:string}
export interface ParticipantRecord {anonymousId:string;newToApp:boolean;device:DeviceRecord;candidate:CandidateRecord;coachedBeforeComprehension:boolean;comprehension:{minimumRaise:string;raiseToTotal:string;additionalAmount:string;callAmount:string};hands:StudyHand[];observer:string}
export function validateCandidate(value:CandidateRecord):string[]{
 const errors:string[]=[];
 if(!/^[a-f0-9]{40}$/.test(value.sourceCommit))errors.push('Exact candidate source commit is missing.');
 if(!value.buildId.trim()||!/^[a-f0-9]{64}$/.test(value.bundleSHA256))errors.push('Build identity or bundle SHA-256 is missing.');
 if(!/^https?:\/\//.test(value.url)||!value.isolatedOrigin||!value.isolatedSave)errors.push('An identified isolated candidate origin/save is required.');
 return errors;
}
export function validatePhysicalDevice(value:DeviceRecord):string[]{
 const errors:string[]=[];
 if(value.kind!=='physical')errors.push('Emulation or an unknown device cannot verify physical-device checks.');
 for(const field of ['model','os','osVersion','browser','browserVersion','viewport','orientation','powerMode'] as const)if(!value[field].trim())errors.push(`Record actual ${field}.`);
 if(!value.declaredReference)errors.push('Declare this reference device before comparing measurements.');
 if(value.storageHands!==null&&(!Number.isSafeInteger(value.storageHands)||value.storageHands<0))errors.push('Saved-hand count is invalid.');
 return errors;
}
export function validateScreenReader(value:ScreenReaderRecord):string[]{
 const errors:string[]=[];
 if(!value.name.trim()||!value.version.trim()||!value.browser.trim())errors.push('Name the actual screen reader, version and browser.');
 const required=['turn','betting','payout','errors','cashier','history','recovery'];
 for(const task of required){const row=value.spokenEvidence.find(r=>r.task===task);if(!row||!row.actuallyHeard.trim()||row.outcome==='NOT_EXECUTED'||row.outcome==='BLOCKED')errors.push(`Actual spoken evidence is missing for ${task}.`);}
 return errors;
}
export function validateParticipant(value:ParticipantRecord):string[]{
 const errors=[...validateCandidate(value.candidate),...validatePhysicalDevice(value.device)];
 if(!value.anonymousId.trim()||!value.observer.trim())errors.push('Record the anonymous participant and real observer.');
 if(!value.newToApp)errors.push('The participant must actually be new to this app.');
 if(value.coachedBeforeComprehension)errors.push('Coached answers cannot establish first-time discovery.');
 for(const answer of Object.values(value.comprehension))if(!answer.trim())errors.push('Record each sizing-comprehension answer verbatim.');
 if(value.hands.length!==25)errors.push('Exactly25 observed completed hand records are required for this study record.');
 if(new Set(value.hands.map(h=>h.handReference)).size!==value.hands.length)errors.push('Hand references must be distinct.');
 for(let index=0;index<value.hands.length;index++){
  const hand=value.hands[index];
  if(hand.ordinal!==index+1||!hand.completed||!hand.observed||!hand.handReference.trim()||!hand.artifact.trim())errors.push(`Hand${index+1} needs actual completion, observation and evidence.`);
  if(!hand.intendedAction.trim()||!hand.actualAction.trim())errors.push(`Hand${index+1} needs intended and actual action notes.`);
  for(const issue of hand.misclicks)if(!issue.intended.trim()||!issue.actual.trim()||!issue.steps.trim()||!issue.artifact.trim())errors.push(`Hand${index+1} has an incomplete misclick record.`);
 }
 return errors;
}
export function validateThreeNewUsers(values:ParticipantRecord[]):string[]{
 const errors:string[]=[];
 if(values.length!==3)errors.push('Three actual independent new users are required.');
 if(new Set(values.map(v=>v.anonymousId)).size!==values.length)errors.push('Participant labels must identify three distinct people.');
 values.forEach((v,i)=>errors.push(...validateParticipant(v).map(error=>`Participant${i+1}: ${error}`)));
 return errors;
}

export const TIMING_NAMES = new Set([
 'bot.prepare','bot.policy','bot.publicMemory','persistence.commit','persistence.installPacked.prepare','persistence.installPacked.transaction',
 'persistence.installRecovery.prepare','persistence.installRecovery.transaction','persistence.load','persistence.prepareRecovery','persistence.prepareSegments','persistence.transaction','persistence.packHand',
 'recovery.archiveInventory','recovery.canonicalArchiveAudit','recovery.explicitFullHistory','recovery.fastRestore','recovery.financialArchive','recovery.residentArchive','recovery.configurationSemantics','recovery.financialSemantics','recovery.handChain','recovery.handSemantics','recovery.ledgerChain','recovery.freezeTransport','recovery.unpackHand','recovery.read.canonicalFallback','recovery.freeze','recovery.prepareCheckpoint','recovery.verifyFinancialCheckpoint',
 'snapshot.draft','integrity.fullAudit','integrity.incremental','statistics.aggregate','statistics.prewarm','ui.historyProjection','ui.render','ui.sync',
 ...['ledger','hands','closedSessions','importedHands'].flatMap(name=>[`recovery.read.${name}`,`recovery.segmentHash.${name}`]),
]);
export interface TimingObservation {version:1;name:string;milliseconds:number;startTime?:number;endTime?:number;sequence?:number}
/** Copy only known data descriptors. Do not spread event payloads or invoke getters. */
export function projectTimingSample(input:unknown):TimingObservation|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const descriptors=Object.getOwnPropertyDescriptors(input),allowed=new Set(['version','name','milliseconds','startTime','endTime','sequence']);
 if(Object.keys(descriptors).some(key=>!allowed.has(key)||!('value'in descriptors[key])))return null;
 const value=(key:string)=>descriptors[key]?.value;
 if(value('version')!==1||typeof value('name')!=='string'||!TIMING_NAMES.has(value('name'))||!Number.isFinite(value('milliseconds'))||value('milliseconds')<0)return null;
 const result:TimingObservation={version:1,name:value('name'),milliseconds:value('milliseconds')};
 for(const key of ['startTime','endTime','sequence'] as const){const entry=value(key);if(entry!==undefined){if(!Number.isFinite(entry)||entry<0)return null;result[key]=entry;}}
 if(result.startTime!==undefined&&result.endTime!==undefined&&result.endTime<result.startTime)return null;
 return result;
}
export class BoundedSamples {
 readonly retained:number[]=[];count=0;sum=0;minimum=Infinity;maximum=0;
 constructor(readonly limit=5000){if(!Number.isInteger(limit)||limit<1)throw Error('Positive sample limit required');}
 add(value:number):void{if(!Number.isFinite(value)||value<0)throw Error('Finite nonnegative duration required');this.count++;this.sum+=value;this.minimum=Math.min(this.minimum,value);this.maximum=Math.max(this.maximum,value);if(this.retained.length<this.limit)this.retained.push(value);}
 report(){const sorted=this.retained.slice().sort((a,b)=>a-b),dropped=this.count-sorted.length,q=(p:number)=>!this.count||dropped?null:sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];return{count:this.count,retained:sorted.length,dropped,p50:q(.5),p95:q(.95),p99:q(.99),maximum:this.count?this.maximum:null,minimum:this.count?this.minimum:null,mean:this.count?this.sum/this.count:null,quantileScope:dropped?'NOT_MEASURED: raw retention cap reached; maximum/count/mean still include every observed event.':'All observed samples; nearest-rank quantiles.'};}
}
