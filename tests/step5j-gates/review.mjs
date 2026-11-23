/** Step5J read-only evidence requalification. No original registry is changed. */
/* global structuredClone */
import console from 'node:console';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {parseCsv,qualify,effectivePass} from '../../scripts/step5d-audit-execution-links.mjs';
import {verifyCurrentCandidate} from '../../scripts/step5e-release-status.mjs';
import {verifyStep5JRetained5HBrowser,step5jHarnessFiles} from './verify-retained-browser.mjs';

const output='tests/step5j-gates',candidate='138cdcf325129c69f127d0e16bc94942abea752f';
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=p=>JSON.parse(readFileSync(p));
const receiptPath='TEST_EVIDENCE/step5h/release-bounded/manifest.json',receipt=json(receiptPath);
const original=json('docs/specs/acceptance-source.json'),backlog=json('docs/specs/backlog-source.json');
const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
const priorPath='tests/step5h-gates/current-repairedqualification/combined-reviewed-records.json';
const historicalPath='tests/step5e-gates/evidence/draftfix/current-qualification.records.json';
const prior=json(priorPath),historical=json(historicalPath),records=structuredClone(prior.requirements);
// Read the retained exact compiled app, not a newly generated substitute. The
// public test packaging carries precisely these three original artifact bytes.
const packed='tests/browser/step5f-candidate-step5h-final/';
const artifactPaths={
 'dist/assets/index-CLgU7smD.js':packed+'index-CLgU7smD.js.bin',
 'dist/assets/index-D_NKboRv.css':packed+'index-D_NKboRv.css.bin',
 'dist/index.html':packed+'index.html.bin',
};
const read=p=>readFileSync(artifactPaths[p]??p),exists=p=>existsSync(artifactPaths[p]??p);
const sourceAtCommit=(commit,path)=>execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:64*1024*1024});
const candidateErrors=verifyCurrentCandidate(receipt,{read,exists,sourceAtCommit});
if(receipt.sourceCommit!==candidate||candidateErrors.length)throw Error(JSON.stringify(candidateErrors));
if(rows.length!==302||new Set(rows.map(x=>x.id)).size!==302||backlog.length!==86)throw Error('Registry cardinality changed');
for(const spec of original)for(const[k,v]of Object.entries(spec))if(rows.find(x=>x.id===spec.id)?.[k]!==v)throw Error(`Original altered: ${spec.id}.${k}`);
const browserIndex=[390,1280].map(width=>{const capture=`TEST_EVIDENCE/step5h/browser/final-compiled-${width}.json`,proof=packed+'manifest.json';return{format:'ai-texas-step5j-retained-step5h-workflows',version:1,id:`step5h-final-${width}`,sourceCommit:candidate,harnessCommit:candidate,harnessHashes:Object.fromEntries(step5jHarnessFiles.map(p=>[p,sha(sourceAtCommit(candidate,p))])),capture:{path:capture,sha256:sha(readFileSync(capture))},proof:{path:proof,sha256:sha(readFileSync(proof))},command:[`Review retained actual compiled capture ${capture}; original Step5H execution, not new Step5J gameplay` ]};});
const browsers=browserIndex.map(entry=>verifyStep5JRetained5HBrowser(entry,receipt,{read,exists,sourceAtCommit}));
if(browsers.some(x=>x.status!=='QUALIFIED'))throw Error(JSON.stringify(browsers.map(x=>({id:x.id,errors:x.errors}))));

// These are complete software-only clauses. The exact assertion/fixture bytes
// and fresh source-bound reports are independently checked below. Browser and
// human clauses are NOT removed from other records to manufacture qualification.
const selected=new Set('B02 F10 F20 R10 R11 R20 R23 U05 U08 U09 M10 M11 X04 X09 X13 X14 Y10 Y13 Y15 Z13 V407 V409 V414 V418 V431 V432 V517 V608 V610 V706 A04 B10 B11 B12 B13 D01 D02 D05 D06 R22 U02 U03 U04 U06 U07 U13 M08 X01 X02 X05 X12 Z01 V408 V421 V428 V435 V505 V510 V614 V619 V701'.split(' '));
const changedInputReviews={
 'src/ui/app.ts':'Read complete37aa→138diff: export batching, cache release, archive maintenance and accessible status changes; table/raise/session/identity/statistics calculations remain unchanged. Actual exact138 compiled workflow covers selected UI clauses; this is not inferred from unchanged source alone.',
 'src/session/controller.ts':'Read complete37aa→138diff: stronger history-header/index equality, maintenance cache release, bounded export, and outer timing wrapper on prepareBot. Retry identity/mutate/commitBot semantics remain unchanged and named current tests plus100 actual compiled rerenders verify selected U13/V701.',
 'tests/step5b-acceptance/release-gate.test.ts':'Read exact added dual-gate assertions: hypothetical all-verified fixtures are labeled test-only; historical PASS cannot bypass current NOT_QUALIFIED for nine IDs. Existing undeclared-scope, whole-criterion and302-ID assertions remain; no live tracker is rewritten.',
};
const reviews=[];
for(const row of rows.filter(effectivePass)){
 if(prior.requirements.some(x=>x.id===row.id))continue;
 const old=historical.requirements.find(x=>x.id===row.id);
 const record=old?structuredClone(old):null;
 let selectedForQualification=selected.has(row.id);
 const changedFixtures=old?Object.entries(old.fixtureHashes).filter(([p,h])=>receipt.sourceHashes[p]!==h).map(([path,previousHash])=>({path,previousHash,currentHash:receipt.sourceHashes[path]??null})):[];
 const reportBindings=[];
 if(record){
  for(const r of record.reports??[]){
   if(!r.path?.startsWith('TEST_EVIDENCE/step5e/release-draftfix/')&&r.path!=='tests/step5e-gates/evidence/draftfix/candidate-independent-review.json')continue;
   const newPath=r.path==='tests/step5e-gates/evidence/draftfix/candidate-independent-review.json'?'tests/step5j-gates/candidate-independent-review.json':r.path.replace('TEST_EVIDENCE/step5e/release-draftfix/','TEST_EVIDENCE/step5h/release-bounded/');
   if(!existsSync(newPath))continue;
   const bytes=readFileSync(newPath),data=JSON.parse(r.encoding==='gzip-json'?gunzipSync(bytes):bytes);
   if(data.sourceCommit!==candidate)continue;
   reportBindings.push({priorPath:r.path,path:newPath,sha256:sha(bytes),sourceCommit:data.sourceCommit});
   r.path=newPath;r.sha256=sha(bytes);
   for(const assertion of r.assertions??[])if(assertion.path==='sourceCommit')assertion.equals=candidate;
  }
  record.executionBoundary={priorReviewSource:historicalPath,priorReviewSHA256:sha(readFileSync(historicalPath)),priorExecutionSource:old.executionBoundary?.newExecutionSource,newExecutionSource:candidate,newExecutionReceipt:receiptPath,newExecutionReceiptSHA256:sha(readFileSync(receiptPath)),oldExecutionRetagged:false};
  record.observed='Requalified only when every named case passed in the retained138cdcf execution, the assertion/input bytes match exactly, current result values satisfy unchanged expectations, and all full-criterion clauses have evidence. No new gameplay execution is claimed by this review.';
  for(const check of record.browserCases??[]){
   if(!/^compiled-(320|390|430|1280)$/.test(check.execution))continue;
   // These original criteria have no exact320px requirement.390 is a genuine
   // mobile CSS viewport inside the supported360–430 range. Exact360px V612
   // is not selected and cannot be certified by this substitution.
   check.execution=check.execution==='compiled-1280'?'step5h-final-1280':'step5h-final-390';
   const browser=browsers.find(x=>x.id===check.execution);
   const semantic=check.assertions?.find(x=>/^trace\.\d+\.check$/.test(x.path)&&typeof x.equals==='string');
   if(semantic){const commands=browser.commands.filter(x=>x.name===check.command);if(commands.length===1){const matches=commands[0].trace.map((x,i)=>({x,i})).filter(({x})=>x.check===semantic.equals);if(matches.length===1)for(const a of check.assertions)a.path=a.path.replace(/^trace\.\d+\./,`trace.${matches[0].i}.`);}}
  }
  for(const changed of changedFixtures){
   if(selectedForQualification&&changedInputReviews[changed.path]){
    record.fixtureHashes[changed.path]=changed.currentHash;
    record.changedInputReview??=[];
    record.changedInputReview.push({...changed,rationale:changedInputReviews[changed.path],diffPath:'tests/step5j-gates/reviewed-source-delta.patch',diffSHA256:sha(readFileSync('tests/step5j-gates/reviewed-source-delta.patch'))});
   }else selectedForQualification=false;
  }
 }
 const result=record?qualify(row,record,receipt,{read,exists,verifyBuild:true,browsers}):{status:'NOT_QUALIFIED',errors:['MISSING_QUALIFICATION_RECORD']};
 const accepted=selectedForQualification&&result.status==='QUALIFIED';
 if(accepted)records.push(record);
 const pendingBrowser=old?.browserCases?.map(x=>({command:x.command,execution:x.execution,assertions:x.assertions,occurrences:x.occurrences,where:x.where}))??[];
 const missingReports=(old?.reports??[]).filter(x=>!reportBindings.some(y=>y.priorPath===x.path)).map(x=>({path:x.path,assertions:x.assertions}));
 reviews.push({id:row.id,criterion:row.acceptance,criterionSHA256:sha(row.acceptance),gateBasis:row.r1_gate_basis,originalStatus:row.status,
  reviewStatus:'REVIEWED',candidateQualification:accepted?'QUALIFIED':'NOT_QUALIFIED',
  rationale:accepted?`Complete criterion supported by actual138cdcf execution and, when requested, exact390/1280 compiled captures independently verified in this review. Prior clause review: ${old.reviewRationale}`:
   row.id==='Z14'?'Conjunction remains open: current uninterrupted cash workflow, touch/keyboard, replay/notes privacy, bounded storage and no performance regression must all be established; historical10.07s tail remains unattributed.':
   'The historical complete-criterion mapping was inspected. Named current unit passes alone cannot replace required browser, resource, provenance or independent-report clauses. Retained old evidence is not relabeled as current.',
  currentPassedNamedCases:result.executedCases??[],currentReports:result.executedReports??[],freshReportBindings:reportBindings,changedFixtures,
  pendingBrowserClauses:pendingBrowser,pendingReportClauses:missingReports,mechanicalQualificationErrors:accepted?[]:result.errors,
  nextAction:accepted?'Retain unchanged exact source/build evidence. Whole mixed requirements remain NOT_EXECUTED for later portions.':row.id==='Z14'?'Finish current candidate performance and complete-flow conjunction; retain unexplained-stall limitation.':
    [...(pendingBrowser.length?['Execute or independently qualify exact current-candidate browser commands: '+[...new Set(pendingBrowser.map(x=>x.command))].join(', ')]:[]),...(missingReports.length?['Produce/currently qualify source-bound reports: '+[...new Set(missingReports.map(x=>x.path))].join(', ')]:[]),...(changedFixtures.length?['Review changed fixture inputs: '+changedFixtures.map(x=>x.path).join(', ')]:[]),...(!pendingBrowser.length&&!missingReports.length&&!changedFixtures.length?['Review exact full-criterion semantics and unresolved report expectations shown in this record.']:[])].join('. ')
 });
}

const qualified=rows.filter(effectivePass).map(row=>({id:row.id,result:qualify(row,records.find(x=>x.id===row.id),receipt,{read,exists,verifyBuild:true,browsers})}));
const qualifiedIds=new Set(qualified.filter(x=>x.result.status==='QUALIFIED').map(x=>x.id));
const critical=rows.filter(x=>x.r1_blocking==='YES');
const known=['U10','U11','U16','Z02','Z14','V518','V522','V707'];
const next={
 U10:'Real named screen reader with keyboard/gesture interaction and actual announcements; automated labels are insufficient.',
 U11:'Declared actual phone/desktop P50/P95 compute,10-seat frame responsiveness and input-to-confirm measurements.',
 U16:'Provider-supported complete historical project-write audit. Local Git/receipts establish only recorded writes.',
 Z02:'Complete historical nonmutation proof plus final signed-off deployment SHA/smoke after mandatory gates pass.',
 Z14:'Current complete cash workflow, privacy, touch/keyboard, bounded storage and performance qualification; historical10.07s stall remains unattributed.',
 V518:'Repeated declared physical-reference2/6/10-seat measurements plus actual screen reader, render/memory/error observations.',
 V522:'BLOCKED pending user future GitHub repository/hosted CI runner connection; workflow file/local execution is not hosted run.',
 V707:'Three independent real new participants each25 observed hands; record actual sizing comprehension, ambiguities and misclicks.',
};
const register=rows.map(row=>({...row,step5j_candidate:candidate,step5j_qualification:row.r1_blocking!=='YES'?'NOT_REQUIRED_FOR_R1':qualifiedIds.has(row.id)?'QUALIFIED':'NOT_QUALIFIED',step5j_evidence:qualifiedIds.has(row.id)?output+'/execution-qualification.json':output+'/mapping-reviews.json',step5j_next_action:next[row.id]??reviews.find(x=>x.id===row.id)?.nextAction??row.next_action}));
const csv=values=>{const keys=Object.keys(values[0]);return [keys,...values.map(v=>keys.map(k=>v[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';};
const summary={format:'ai-texas-step5j-evidence-review',version:1,at:new Date().toISOString(),candidateSource:candidate,developmentSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidateErrors,
 receipt:{path:receiptPath,sha256:sha(readFileSync(receiptPath)),executedCounts:receipt.testCounts},artifactPaths,artifactHashes:Object.fromEntries(Object.entries(artifactPaths).map(([p,actual])=>[p,{actual,sha256:sha(readFileSync(actual))}])),
 originalRequirements:302,deferredFeatures:86,originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(x=>x.status===s).length])),
 r1CriticalOriginalCount:critical.length,historicalEffectiveCashPassCount:rows.filter(effectivePass).length,priorQualifiedCount:prior.requirements.length,newQualifiedCount:qualifiedIds.size-prior.requirements.length,qualifiedCount:qualifiedIds.size,
 completedAdditionalMappingReviews:reviews.filter(x=>x.id!=='Z14').length,additionalQualifiedIds:reviews.filter(x=>x.candidateQualification==='QUALIFIED').map(x=>x.id),
 unqualifiedCriticalIds:critical.filter(x=>!qualifiedIds.has(x.id)).map(x=>x.id),knownMandatoryConcerns:known,
 remainingAdditionalEvidenceIds:critical.filter(x=>!qualifiedIds.has(x.id)&&!known.includes(x.id)).map(x=>x.id),
 newPokerOrBrowserExecutions:0,canonicalTrackerChanged:false,decision:'NOT_READY_FOR_R1',
 limitations:['Reviewing every mapping is not the same as satisfying every criterion. Missing exact current browser/resource/provenance clauses stay NOT_QUALIFIED.','2114 retained automated passes are separate from original acceptance IDs. No retained execution was retagged.','Original302 statuses are unchanged; the237 R1 subset and230 historical effective cash components are different counts. Nine explicitly mixed cash components never promote whole original requirements.','This review invokes no browser, physical-device, screen-reader, human-study, hosted-CI, Site mutation or deployment operation.']};
mkdirSync(output,{recursive:true});
for(const[name,data]of Object.entries({'summary.json':summary,'browser-index.json':browserIndex,'retained-browser-qualification.json':browsers,'mapping-reviews.json':reviews,'combined-reviewed-records.json':{version:1,scope:'Step5J exact138cdcf retained execution requalification; no external evidence inferred',requirements:records},'execution-qualification.json':qualified,'release-status.json':register}))writeFileSync(`${output}/${name}`,JSON.stringify(data,null,2)+'\n');
writeFileSync(`${output}/release-status.csv`,csv(register));
console.log(JSON.stringify(summary,null,2));
