import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const FORMAT='ai-texas-step5e-browser-recovery';
const SIZES=[0,100,500,1000,5000,10000];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const max=values=>values.reduce((largest,value)=>Math.max(largest,value),0);
const overlap=(start,end,window)=>window&&Math.max(0,Math.min(end,window.end)-Math.max(start,window.start));
const observedMax=(tasks,predicate,supported)=>supported?max(tasks.filter(predicate).map(task=>task.ms)):null;
const milliseconds=value=>finite(value)?value.toFixed(1):'NOT_EXECUTED';
const megabytes=value=>finite(value)?(value/1e6).toFixed(2):'—';
const seconds=value=>finite(value)?(value/1000).toFixed(3):'NOT_EXECUTED';
const escape=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');

/** Reconstruct absolute observation windows from raw navigation-relative task
 * times and mount-relative duration markers. No guessed causal attribution. */
export function taskWindows(raw){
 const start=raw.measurementStart,ready=finite(start)&&finite(raw.safeGameplayReadyMs)?start+raw.safeGameplayReadyMs:null;
 const interval=(end,duration)=>finite(start)&&finite(end)&&finite(duration)&&duration>=0?{start:start+end-duration,end:start+end}:null;
 return {navigation:ready!==null?{start:0,end:ready}:null,mount:ready!==null?{start,end:ready}:null,
  history:interval(raw.historyBrowse?.completedMs,raw.historyBrowse?.ms),audit:interval(raw.fullAudit?.completedMs,raw.fullAudit?.durationMs)};
}
export function classifyTasks(raw){
 const windows=taskWindows(raw),tasks=(raw.longTasks??[]).filter(task=>finite(task.start)&&finite(task.ms)&&task.ms>=0).map(task=>({...task,end:task.start+task.ms})),supported=raw.longTasksSupported===true;
 const ready=windows.navigation?.end,historyStart=windows.history?.start;
 const maxima={completedBeforeSafeReadyMs:observedMax(tasks,task=>finite(ready)&&task.end<=ready,supported&&finite(ready)),
  crossingSafeReadyMs:observedMax(tasks,task=>finite(ready)&&task.start<ready&&task.end>ready,supported&&finite(ready)),
  overlappingSafeRecoveryMs:observedMax(tasks,task=>overlap(task.start,task.end,windows.navigation)>0,supported&&!!windows.navigation),
  completedBeforeHistoryMs:observedMax(tasks,task=>finite(historyStart)&&task.end<=historyStart,supported&&finite(historyStart)),
  historyOverlapMs:observedMax(tasks,task=>overlap(task.start,task.end,windows.history)>0,supported&&!!windows.history),
  auditOverlapMs:observedMax(tasks,task=>overlap(task.start,task.end,windows.audit)>0,supported&&!!windows.audit)};
 const crossingHistory=tasks.filter(task=>finite(historyStart)&&task.start<historyStart&&task.end>historyStart).map(task=>({
  ...task,markerLeadMs:historyStart-task.start,historyOverlapMs:overlap(task.start,task.end,windows.history),
  overlappingRenderStages:(raw.stages??[]).filter(stage=>stage.name==='ui.render'&&overlap(stage.start,stage.end,{start:task.start,end:task.end})>0).map(stage=>({...stage,historyOverlapMs:overlap(stage.start,stage.end,windows.history)})),
 }));
 const sourceToCorrected={navigationMaximumBrowserTaskMs:'completedBeforeSafeReadyMs',maximumTaskCrossingSafeReadinessMs:'crossingSafeReadyMs',maximumStartupBrowserTaskMs:'completedBeforeHistoryMs',maximumHistoryBrowserTaskMs:'historyOverlapMs',maximumAuditBrowserTaskMs:'auditOverlapMs'};
 const reported=Object.fromEntries(Object.keys(sourceToCorrected).filter(key=>key in raw).map(key=>[key,raw[key]]));
 const corrections=Object.entries(sourceToCorrected).filter(([key,target])=>finite(raw[key])&&finite(maxima[target])&&Math.abs(raw[key]-maxima[target])>.01).map(([key,target])=>({field:key,reported:raw[key],recomputed:maxima[target],method:target}));
 return {windows,maxima,reported,corrections,crossingHistory,invalidTaskRows:(raw.longTasks??[]).length-tasks.length,
  method:'Whole observed Long Task duration; pre-ready/pre-history include completed tasks only. History and audit include every overlapping task, including a task starting just before the marker. Windows overlap and are not additive CPU attribution; Long Tasks are not INP.'};
}
function stageSummary(raw,window){
 if(!window)return [];
 const names=new Map();for(const stage of raw.stages??[]){if(!finite(stage.start)||!finite(stage.end)||!finite(stage.milliseconds))continue;const ms=overlap(stage.start,stage.end,window);if(!(ms>0))continue;
  const item=names.get(stage.name)??{name:stage.name,calls:0,overlapMs:0,maxReportedMs:0};item.calls++;item.overlapMs+=ms;item.maxReportedMs=Math.max(item.maxReportedMs,stage.milliseconds);names.set(stage.name,item);
 }return [...names.values()].sort((a,b)=>b.overlapMs-a.overlapMs);
}
function heapSummary(raw,windows){
 const used=value=>finite(value?.usedJSHeapSize)?value.usedJSHeapSize:null,samples=(raw.heapSamples??[]).filter(sample=>finite(sample.at)&&finite(used(sample.memory))),pre=samples.filter(sample=>windows.navigation&&sample.at<=windows.navigation.end);
 return {navigationModuleBytes:used(raw.navigationHeapAtModule),sampledBeforeSafeReadyBytes:pre.length?max(pre.map(sample=>used(sample.memory))):null,
  samplesBeforeSafeReady:pre.length,reportedReadyPhaseBytes:used(raw.heapAtReady),reportedAfterStatisticsBytes:used(raw.heapAfterStatistics),reportedAfterHistoryBytes:used(raw.heapAfterHistory),reportedAfterAuditBytes:used(raw.heapAfterAudit),
  fullObservedSamplePeakBytes:samples.length?max(samples.map(sample=>used(sample.memory))):null,totalSamples:samples.length,
  caveat:'Chromium usedJSHeapSize/coarse samples, not isolated process allocation, RSS, GC attribution or exact instantaneous peak. Reported ready-phase sample may be collected after a paint proxy. Preparation renderer residue is not forced cold.'};
}
export function summarizeCapture(raw,file,sha256){
 if(raw.format!==FORMAT||raw.version!==1)throw Error(`Unsupported recovery capture ${file}`);
 const tasks=classifyTasks(raw),p=raw.parameters??{},source=raw.runtimeSource??{},warnings=[];
 if(raw.productionDatabaseAccessed!==false)warnings.push('Production database isolation is not established.');
 if(raw.status!=='PASS')warnings.push(`Capture status is ${raw.status??'missing'}; no passing qualification inferred.`);
 if(raw.setupReceiptVerified!==true)warnings.push('Setup receipt was not verified.');
 if(source.productionDirty)warnings.push('Captured runtime source reports uncommitted production changes.');
 if(!source.sourceCommit)warnings.push('Runtime source commit missing.');
 if(!raw.secondaryStatisticsReadinessMethod)warnings.push('Legacy secondary-statistics marker includes polling/paint waiting; not comparable to MutationObserver readiness.');
 if(raw.statisticsDisplay?.hands!==undefined&&Number(String(raw.statisticsDisplay.hands).replaceAll(',',''))!==raw.accountingAtReady?.hands)warnings.push('Captured statistics display hand count differs from accounting-at-ready; selectors/meaning require separate inspection.');
 if(raw.longTasksSupported!==true)warnings.push('Long Tasks unsupported/unconfirmed; no zero-stall claim.');
 return {file,sha256,run:p.run??null,preliminary:/preliminary/i.test(basename(file)),reader:p.reader,storage:p.storage,scenario:p.scenario,hands:p.hands,status:raw.status,cleanup:raw.cleanup,
  source:{commit:source.sourceCommit,tree:source.gitTree,dirty:source.productionDirty,artifacts:source.artifacts,savedVersion:source.savedVersion},
  conditions:{browser:raw.browser,secureContext:raw.secureContext,nativeSHA256:raw.nativeSHA256,context:raw.browsingContext,viewport:raw.viewport,freshDocument:raw.freshDocument,isolation:raw.documentIsolationScope,timingMethod:raw.timingMethod},
  fixture:{sha256:raw.fixtureRawSHA256,manifestChecksum:raw.fixtureManifestChecksum,canonicalBytes:raw.canonicalStorageBytes,transferBytes:raw.fixtureTransferBytes,records:raw.records},
  timings:{fixtureSetupMs:raw.fixtureSetupMs,priorInstallationMs:raw.installation?.ms??null,installationSource:raw.installation?.source??null,importMs:raw.runtimeImportMs,shellSyncMs:raw.shellSynchronousRenderMs,shellPaintProxyMs:raw.shellFirstPaintMs,
   safeGameplayMs:raw.safeGameplayReadyMs,verifiedWalletMs:raw.verifiedWalletReadyMs,navigationSafeGameplayMs:raw.navigationToSafeGameplayReadyMs,readyPaintProxyMs:raw.actualReadyPaintMs,
   statisticsReadyMs:raw.secondaryStatisticsReadyMs,statisticsMethod:raw.secondaryStatisticsReadinessMethod??'legacy wait/paint proxy; not actual readiness timing',
   historyLoadMs:raw.historyBrowse?.ms??null,historyCompletedFromMountMs:raw.historyBrowse?.completedMs??null,fullAuditMs:raw.fullAudit?.durationMs??null,fullAuditCompletedFromMountMs:raw.fullAudit?.completedMs??null},
  accounting:raw.accountingAtReady,history:{loadedAtReady:raw.historyLoadedAtReady,archiveAuditAtReady:raw.archiveAuditStatusAtReady,validatedBodiesAfterBrowse:raw.historyBrowse?.validatedHandBodies,method:raw.historyBrowse?.method,fullAudit:raw.fullAudit,archiveAuditAtFinish:raw.archiveAuditStatusAtFinish},
  storageObserved:raw.storage,tasks,heap:heapSummary(raw,tasks.windows),stages:{safeRecovery:stageSummary(raw,tasks.windows.mount),history:stageSummary(raw,tasks.windows.history),audit:stageSummary(raw,tasks.windows.audit),caveat:'Stage intervals nest. Do not sum different names into total CPU or latency.'},warnings};
}
function comparable(left,right){return /^[a-f0-9]{64}$/.test(left.fixture.sha256??'')&&/^[a-f0-9]{64}$/.test(left.fixture.manifestChecksum??'')&&typeof left.conditions.browser==='string'&&typeof left.conditions.nativeSHA256==='boolean'&&left.fixture.sha256===right.fixture.sha256&&left.fixture.manifestChecksum===right.fixture.manifestChecksum&&left.conditions.browser===right.conditions.browser&&left.conditions.nativeSHA256===right.conditions.nativeSHA256&&JSON.stringify(left.conditions.viewport)===JSON.stringify(right.conditions.viewport)&&left.conditions.context===right.conditions.context;}
export function aggregateCaptures(captures,candidateSource=null){
 const excluded=captures.filter(c=>c.preliminary),excludedEarlierCandidates=captures.filter(c=>!c.preliminary&&candidateSource&&c.reader==='candidate'&&!c.source.commit?.startsWith(candidateSource)),selected=captures.filter(c=>!c.preliminary&&!excludedEarlierCandidates.includes(c)),seen=new Set(),duplicates=[];
 const runs=selected.filter(c=>{if(c.run&&seen.has(c.run)){duplicates.push(c.file);return false;}if(c.run)seen.add(c.run);return true;});
 const scenarios=[...new Set(['normal:closed',...runs.map(c=>`${c.storage}:${c.scenario}`)])];
 const comparisons=[];
 for(const group of scenarios)for(const hands of SIZES){const [storage,scenario]=group.split(':'),baseline=runs.filter(c=>c.reader==='baseline'&&c.storage===storage&&c.scenario===scenario&&c.hands===hands),candidate=runs.filter(c=>c.reader==='candidate'&&c.storage===storage&&c.scenario===scenario&&c.hands===hands),matched=baseline.length===1&&candidate.length===1&&comparable(baseline[0],candidate[0]);
  comparisons.push({storage,scenario,hands,baseline:baseline.map(c=>c.file),candidate:candidate.map(c=>c.file),baselineN:baseline.length,candidateN:candidate.length,
   matchedConditions:matched,baselineMs:baseline.length===1?baseline[0].timings.safeGameplayMs:null,candidateMs:candidate.length===1?candidate[0].timings.safeGameplayMs:null,
   improvementPercent:matched&&baseline[0].status==='PASS'&&candidate[0].status==='PASS'&&baseline[0].timings.safeGameplayMs>0?100*(1-candidate[0].timings.safeGameplayMs/baseline[0].timings.safeGameplayMs):null,
   status:!baseline.length||!candidate.length?'NOT_EXECUTED':baseline.length!==1||candidate.length!==1?'MULTIPLE_OBSERVATIONS_REVIEW':baseline[0].status!=='PASS'||candidate[0].status!=='PASS'?'FAILED_CAPTURE':matched?'MATCHED_SINGLE_OBSERVATION':'CONDITIONS_DIFFER'});
 }
 return {format:'ai-texas-step5e-browser-recovery-aggregation',version:1,generatedAt:new Date().toISOString(),candidateSourceFilter:candidateSource,method:'Raw input files are read-only and SHA256 pinned. One measurement per source/scenario/size is an observation, not a percentile or repeatability claim. Source captures remain authoritative.',runs,comparisons,excludedPreliminary:excluded,excludedEarlierCandidates,duplicateRunFilesExcluded:duplicates,
  caveats:['Prepared normal recovery excludes the separately recorded first installation; conversion runs include first recovery in their timed interval.','Full archive audit is explicitly invoked after history browsing and is not automatic/background completion. Completion timestamps include navigation/paint waits and user-flow ordering.','Double-requestAnimationFrame paint proxies can be throttled in the managed iframe; they do not establish physical screen-paint or recovery CPU latency.','Long Tasks are not INP; no actual device, expert/human calibration or hosted CI claims follow from these measurements.','No confidence intervals or p50/p95/p99 are inferred from n=1.']};
}
export function reportMarkdown(report){
 const lines=['# Step5E actual browser recovery observations','',report.method,'',...report.caveats.map(value=>`- ${value}`),'','## Matched recovery observations','','| Storage / scenario | Hands | Baseline n / seconds | Candidate n / seconds | Change | Comparison |','|---|---:|---:|---:|---:|---|'];
 for(const row of report.comparisons)lines.push(`| ${escape(row.storage)} / ${escape(row.scenario)} | ${row.hands} | ${row.baselineN} / ${seconds(row.baselineMs)} | ${row.candidateN} / ${seconds(row.candidateMs)} | ${finite(row.improvementPercent)?Math.abs(row.improvementPercent).toFixed(1)+(row.improvementPercent>=0?'% shorter':'% longer'):'—'} | ${row.status} |`);
 lines.push('','Candidate source filter: '+(report.candidateSourceFilter??'none; distinct source revisions are retained and duplicate cells require review')+'.','', 'Conditions observed:','',...[...new Set(report.runs.map(row=>`${row.conditions.browser}; ${row.conditions.context}; viewport ${row.conditions.viewport?.width}×${row.conditions.viewport?.height}; nativeSHA256=${row.conditions.nativeSHA256}; secureContext=${row.conditions.secureContext}; freshDocument=${row.conditions.freshDocument}`))].map(value=>'- '+value));
 lines.push('','## Individual measurements and provenance','','| Capture | Source | Install s (excluded from normal startup) | Ready s | Full audit duration / completion s | Resident bodies | Ready-phase heap / sampled peak MB | Serialized stored MB | Status |','|---|---|---:|---:|---:|---:|---:|---:|---|');
 for(const row of report.runs)lines.push(`| [${basename(row.file)}](${row.file}) | ${row.source.commit?.slice(0,12)??'MISSING'} | ${seconds(row.timings.priorInstallationMs)} | ${seconds(row.timings.safeGameplayMs)} | ${seconds(row.timings.fullAuditMs)} / ${seconds(row.timings.fullAuditCompletedFromMountMs)} | ${row.accounting?.loadedHandBodies??'—'} | ${megabytes(row.heap.reportedReadyPhaseBytes)} / ${megabytes(row.heap.fullObservedSamplePeakBytes)} | ${megabytes(row.storageObserved?.serializedBytes)} | ${row.status??'MISSING'} |`);
 lines.push('','Heap is coarse Chromium observation; serialized key/value bytes are not physical IndexedDB allocation. Full audit completion is mount-relative and includes prior waits/history navigation.','', '## Recomputed Long Task windows','','| Capture | Before ready ms | Crossing ready ms | Completed before history ms | History overlap ms | Full audit overlap ms |','|---|---:|---:|---:|---:|---:|');
 for(const row of report.runs){const task=row.tasks.maxima;lines.push(`| ${basename(row.file)} | ${milliseconds(task.completedBeforeSafeReadyMs)} | ${milliseconds(task.crossingSafeReadyMs)} | ${milliseconds(task.completedBeforeHistoryMs)} | ${milliseconds(task.historyOverlapMs)} | ${milliseconds(task.auditOverlapMs)} |`);}
 lines.push('','Whole tasks crossing markers retain their complete duration. No historical stall is removed: it appears in each overlapping interaction window. Windows are not additive.','', '## Raw-field corrections and limitations','');
 for(const row of report.runs){for(const c of row.tasks.corrections)lines.push(`- ${basename(row.file)}: raw ${c.field}=${milliseconds(c.reported)}ms; recomputed ${c.method}=${milliseconds(c.recomputed)}ms from task endpoints and event windows.`);for(const task of row.tasks.crossingHistory)lines.push(`- ${basename(row.file)}: ${milliseconds(task.ms)}ms task starts ${milliseconds(task.markerLeadMs)}ms before history marker; overlaps history by ${milliseconds(task.historyOverlapMs)}ms and contains ${task.overlappingRenderStages.length} measured UI render stage(s).`);for(const warning of row.warnings)lines.push(`- ${basename(row.file)}: ${warning}`);}
 lines.push('','## Preliminary and earlier-candidate observations retained separately','',...[...report.excludedPreliminary,...report.excludedEarlierCandidates].map(row=>`- [${basename(row.file)}](${row.file}), source ${row.source.commit}, ready ${seconds(row.timings.safeGameplayMs)}s. Excluded from the current paired matrix; raw file retained.`),'');
 return lines.join('\n');
}
export async function main(argv=process.argv.slice(2)){
 const input=resolve(argv[0]??'TEST_EVIDENCE/step5e/browser'),output=resolve(argv[1]??'TEST_EVIDENCE/step5e/recovery-summary'),captures=[],ignored=[];
 for(const file of (await readdir(input)).filter(name=>name.endsWith('.json')).sort()){
  const path=resolve(input,file),bytes=await readFile(path);let raw;try{raw=JSON.parse(bytes);}catch(error){throw Error(`Invalid raw JSON ${file}: ${error.message}`);}
  if(raw.format!==FORMAT){ignored.push(file);continue;}
  captures.push(summarizeCapture(raw,path,createHash('sha256').update(bytes).digest('hex')));
 }
 const report=aggregateCaptures(captures,argv[2]??null);report.inputDirectory=input;report.ignoredOtherFormats=ignored;
 await mkdir(dirname(output),{recursive:true});await writeFile(output+'.json',JSON.stringify(report,null,2)+'\n');await writeFile(output+'.md',reportMarkdown(report));
 process.stdout.write(JSON.stringify({captures:captures.length,selected:report.runs.length,preliminary:report.excludedPreliminary.length,matchedPairs:report.comparisons.filter(row=>row.matchedConditions).length,correctedCaptures:report.runs.filter(row=>row.tasks.corrections.length).length,output})+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
