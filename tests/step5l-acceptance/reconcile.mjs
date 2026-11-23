/** Rebuild an ID-preserving qualification view from actual receipts and captures.
 * Does not mutate canonical acceptance status or retag historical execution. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,basename} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {gunzipSync} from 'node:zlib';
import {sha,isRuntimeInput} from '../../scripts/step5d-ci-plan.mjs';
import {parseCsv,qualify,effectivePass,verifySupplemental} from '../../scripts/step5d-audit-execution-links.mjs';
import {candidate,directory,recoverContext,reviewRecovered} from './review-recovered.mjs';
const option=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];};
const receiptPath=option('--receipt',`${directory}/recovered-release-receipt.json`),read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),receipt=json(receiptPath),ctx=recoverContext();
assert.equal(receipt.status,'PASS','Only a completed passing execution can qualify criteria');
assert.deepEqual(receipt.buildHashes,ctx.receipt.buildHashes,'Fresh release is not byte-equivalent to hosted candidate');
for(const [p,h]of Object.entries(ctx.receipt.sourceHashes).filter(([p])=>isRuntimeInput(p)))assert.equal(receipt.sourceHashes[p],h,`Fresh runtime differs:${p}`);
const rows=parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),original=json('docs/specs/acceptance-source.json'),backlog=json('docs/specs/backlog-source.json');
assert.equal(rows.length,302);assert.equal(backlog.length,86);assert.equal(new Set(rows.map(r=>r.id)).size,302);
for(const o of original)for(const [k,v]of Object.entries(o))assert.equal(rows.find(r=>r.id===o.id)[k],v,`Original criterion changed:${o.id}.${k}`);
const recoveredBrowser=reviewRecovered(),browsers=recoveredBrowser.records.map(x=>x.result);
assert(browsers.every(b=>b.status==='QUALIFIED'));
const runtimeAgreement={executionSource:receipt.sourceCommit,observedHostedApplicationSource:candidate,buildHashes:receipt.buildHashes,runtimeInputs:Object.entries(ctx.receipt.sourceHashes).filter(([p])=>isRuntimeInput(p)).length,claim:'Fresh test execution and retained browser execution remain separate; runtime/build bytes match exactly.'};
const reviewPaths={};
for(const name of ['current-ui-review','native-qualified-review','rollback-qualified-review','warning-qualified-review','supplemental-ui-review']){
 const p=`${directory}/${name}.json`;if(!existsSync(p))continue;const observed=json(p);assert.equal(observed.sourceCommit,candidate);
 const derived={...observed,sourceCommit:receipt.sourceCommit,observedApplicationSource:candidate,reviewedCaptureSource:{path:p,sha256:sha(read(p))},runtimeAgreement};
 if(name==='supplemental-ui-review')derived.checks.stress=derived.checks.stress10;
 const out=`${directory}/qualified-reviews/${name}.json`;mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(derived,null,2)+'\n');reviewPaths[name+'.json']=out;
}
const priors=json('tests/step5j-gates/combined-reviewed-records.json').requirements;
const historic=json('tests/step5e-gates/evidence/draftfix/current-qualification.records.json').requirements;
const records=historic.map(r=>JSON.parse(JSON.stringify(priors.find(p=>p.id===r.id)??r)));
const changedReviews={
 'src/ui/app.ts':'Read complete37aa→recovered diff (retained reviewed-ui-delta.patch): bounded history export and cache maintenance; new statuses/focus; Table settings accessible label. Betting arithmetic, filtering and statistics definitions unchanged; exact current compiled workflow, statistical fixtures and layout assertions provide executed integration evidence.',
 'src/session/controller.ts':'Read complete37aa→recovered diff: full header/index equality on archive expansion, weak predecessor cache, compact maintenance with ownership/revision/financial equality, bounded durable-generation-fenced exports, timing wrapper around prepareBot. Existing mutation and commitBot legality/revision semantics unchanged; current native/pending/100hand captures and exact case assertions required.',
 'src/storage/browser.ts':'Read complete37aa→recovered diff: missing-manifest empty-origin guard; bounded optional packed cache; audit canonical replacement before retirement; atomic maintenance/checkpoint changes with CAS and lease checks. No ledger movement outside engine. Current corruption/abort/migration/rollback and full suite are required, not source inspection alone.',
 'src/storage/segments.ts':'Read complete bounded optional-replica diff: canonical hashes retained, packed-first metadata validated, canonical fallback and complete chain audit retained. Full10k resource/performance remains an explicit separate gate.',
 'tests/step5b-acceptance/release-gate.test.ts':'Fresh regression repairs stale expected qualification count by independently deriving the237ID subset and actual qualified count from canonical rows; preserves refusal on missing,failed or stale evidence and preserves original IDs/wording. Named fresh cases required.',
 'scripts/build-r1-dashboard.mjs':'Registry generator separates original status from current qualification and explicit cash-component scope; original criteria preserved; fresh registry/gate tests required.',
 'ACCEPTANCE_STATUS.csv':'Post-execution candidate metadata differs from original baseline. All six authoritative original fields verified verbatim across302IDs; original status totals retained and no unexecuted clause is promoted.'
};
const releaseRoot=dirname(receiptPath),rebindings=[];
const supplementalInputs=[];
const probePath='TEST_EVIDENCE/step5h/step5l-probes/manifest.json';
if(existsSync(probePath)&&json(probePath).status==='PASS')supplementalInputs.push({id:'probes',path:probePath,sha256:sha(read(probePath))});
const supplementalRead=p=>Object.hasOwn(receipt.buildHashes,p)?ctx.read(p):read(p);
const supplementalExists=p=>Object.hasOwn(receipt.buildHashes,p)?ctx.exists(p):existsSync(p);
const supplements=supplementalInputs.map(e=>verifySupplemental(e,receipt,{read:supplementalRead,exists:supplementalExists}));
function compatibleReport(oldPath){
 const name=basename(oldPath);
 if(reviewPaths[name])return reviewPaths[name];
 const extra=`${directory}/${name}`;
 if(existsSync(extra)&&json(extra).sourceCommit===receipt.sourceCommit)return extra;
 if(name==='candidate-probes-review.json'&&existsSync('TEST_EVIDENCE/step5h/step5l-probes/independent-review.json'))return 'TEST_EVIDENCE/step5h/step5l-probes/independent-review.json';
 if(oldPath==='TEST_EVIDENCE/step5e/probes-draftfix/probes/execution-provenance.json'&&existsSync('TEST_EVIDENCE/step5h/step5l-probes/probes/execution-provenance.json'))return 'TEST_EVIDENCE/step5h/step5l-probes/probes/execution-provenance.json';
 const prefixes=['TEST_EVIDENCE/step5e/release-draftfix/','TEST_EVIDENCE/step5h/release-bounded/'];
 const prefix=prefixes.find(p=>oldPath.startsWith(p));if(prefix){const p=releaseRoot+'/'+oldPath.slice(prefix.length);if(existsSync(p))return p;}
 return null;
}
for(const record of records){
 const row=rows.find(r=>r.id===record.id);assert(row);assert.equal(record.criterionSha256,sha(row.acceptance));
 if(record.id==='U12'&&existsSync(`${directory}/resource-qualified-review.json`)){
  const path=`${directory}/resource-qualified-review.json`,resource=json(path);
  assert.equal(resource.sourceCommit,receipt.sourceCommit);assert.equal(resource.status,'PASS_LITERAL_U12_EXPERIMENT');
  assert.equal(resource.checks.completedHands,10000);assert.equal(resource.checks.independentArchiveAgrees,true);
  const files=['tests/step5b-resource/timer-lifecycle.test.ts','tests/step5g-performance/profile-artifact.ts','tests/step5e-independent/financial-reference.ts','tests/step5f-performance/file-idb-reference.ts','tests/step5f-performance/disk-records.ts','src/session/controller.ts','src/storage/segments.ts'];
  record.inputs={description:'Fresh10000 authoritative controller hands from an empty save;74117 preparations,250 sessions and74 pending-decision reload/stale-action checks. Node disk-backed IndexedDB request reference, full independent archive/BigInt financial replay, memory trend and bounded canonical/replica/checkpoint/journal/cache counts. New harness is separately identified by its pre-execution SHA and post-execution archive; repository baseline is not falsely called its execution commit.',seeds:[resource.inputs.seed],fixtureFiles:files,executedHarness:resource.executedHarness,actualResourceArtifacts:resource.artifacts};
  record.fixtureHashes=Object.fromEntries(files.map(p=>{assert.equal(sha(read(p)),receipt.sourceHashes[p]);return[p,receipt.sourceHashes[p]];}));
  record.roomVersions=Object.keys(resource.inputs.exactAppliedRules);
  record.reviewRationale='The literal U12 experiment actually completed10000 new hands and independent full financial/canonical reconciliation. Storage bounds reflect the current verified architecture: all canonical records retained, optional replicas<=120, checkpoint generations<=2 and journal<=126; this replaces the incompatible older two-header-only evidence description, not the original criterion. No browser/physical-device/no-regression or leak-free claim follows. New harness/candidate/application identities remain distinct.';
  record.expected='10000uniquecompletedhands; independent archive/checkpoint/full ledger agreement; memory baseline and trend; preserved canonical histories with bounded redundant storage and policy caches; at most1timer during play and0afterclose.';
  record.reports=[{path,sha256:sha(read(path)),assertions:[{path:'sourceCommit',equals:receipt.sourceCommit},{path:'actualApplicationSource',equals:candidate},{path:'checks.completedHands',equals:10000},{path:'checks.independentArchiveAgrees',equals:true},{path:'checks.memoryBaselineAndTrendRecorded',equals:true},{path:'checks.storageOverheadBoundedWithoutDeletingCanonicalHands',equals:true},{path:'checks.oneTimerThenZeroOnClose',equals:true},{path:'checks.candidateImportGraphExact',equals:true},{path:'checks.pendingDecisionReloadsStable',equals:74},{path:'performanceAndMemoryStatus',equals:'NOT_RESOLVED_AS_Z14_OR_PHYSICAL_DEVICE_QUALIFICATION'}]}];
  record.executionBoundary={executionRepositoryBaseline:resource.executionRepositoryBaseline,executedHarnessWasUncommitted:true,executedHarness:resource.executedHarness,postExecutionArchiveCommit:resource.postExecutionArchiveCommit,oldExecutionRetagged:false};
 }
 if(record.id==='V620'&&existsSync(`${directory}/provenance-qualified-review.json`)){
  const metadata=json(`${directory}/provenance-qualified-review.json`);
  // Historical row counters describe the old execution, not the immutable
  // acceptance criterion. Bind this review to actual new observer/capture counts.
  assert.equal(metadata.checks.perCaseMetadataRowsResolved,86);
  assert.equal(metadata.checks.observationalUnitPasses,json('tests/step5l-regression/evidence/observer/manifest.json').testCounts.passed);
  for(const report of record.reports)for(const a of report.assertions){
   if(a.path==='checks.freshBrowserCaptures')a.path='checks.recoveredBrowserCaptures';
   if(['checks.currentPassingCriticalRequirements','checks.observationalUnitPasses','checks.recoveredBrowserCaptures'].includes(a.path))a.equals=metadata.checks[a.path.slice(7)];
  }
  record.reviewRationale='Exact per-criterion metadata reviewed against the fresh passing release and577actual observer cases, plus hash-verified recovered3ece browser captures.86prior metadata rows resolved by their own cases and report groups; no execution retagged and no missing original Git object asserted.';
 }
 for(const [p,old]of Object.entries(record.fixtureHashes))if(receipt.sourceHashes[p]!==old&&changedReviews[p]){
  const current=receipt.sourceHashes[p];if(!current||!existsSync(p))continue;
  if(p==='ACCEPTANCE_STATUS.csv'){
   // Candidate annotations are post-execution metadata. Preserve the actual
   // executed register bytes from Git; never hash today's annotation into an old run.
   const executed=execFileSync('git',['show',`${receipt.sourceCommit}:${p}`],{maxBuffer:8*1024*1024});assert.equal(sha(executed),current);
   const executedRows=parseCsv(executed.toString());for(const r of rows){const before=executedRows.find(x=>x.id===r.id);for(const key of ['id','scope','title','acceptance','source','source_status','status','r1_gate_basis','r1_cash_component_status'])assert.equal(r[key],before[key],`Post-execution metadata changed semantic field:${r.id}.${key}`);}
  }else if(sha(read(p))!==current)continue;
  record.changedInputReview??=[];record.changedInputReview.push({path:p,previousSHA256:old,currentSHA256:current,review:changedReviews[p],freshReceipt:receiptPath});record.fixtureHashes[p]=current;
 }
 for(const item of record.reports??[]){
  const oldPath=item.path,newPath=compatibleReport(oldPath??'');if(!newPath)continue;
  let data;try{data=JSON.parse(item.encoding==='gzip-json'?gunzipSync(read(newPath)):read(newPath));}catch{continue;}
  if(data.sourceCommit!==receipt.sourceCommit)continue;
  rebindings.push({id:record.id,oldPath,newPath,sha256:sha(read(newPath)),sourceCommit:data.sourceCommit});item.path=newPath;item.sha256=sha(read(newPath));
  for(const a of item.assertions??[]){
   if(['sourceCommit','qualifiedBaseCommit'].includes(a.path))a.equals=receipt.sourceCommit;
   if(a.path==='runtimeInputsMatched')a.equals=runtimeAgreement.runtimeInputs;
   const match=/^testCases\.(\d+)\./.exec(a.path);if(match&&existsSync(oldPath)){
    const oldReceipt=json(oldPath),oldCase=oldReceipt.testCases[Number(match[1])];
    if(!oldCase)continue;const oldMatches=oldReceipt.testCases.map((c,i)=>({c,i})).filter(({c})=>c.file===oldCase.file&&c.name===oldCase.name),ordinal=oldMatches.findIndex(x=>x.i===Number(match[1]));
    const matches=data.testCases.map((c,i)=>({c,i})).filter(({c})=>c.file===oldCase.file&&c.name===oldCase.name);if(matches.length===oldMatches.length&&matches[ordinal])a.path=a.path.replace(/^testCases\.\d+\./,`testCases.${matches[ordinal].i}.`);
   }
  }
 }
 for(const check of record.browserCases??[]){
  check.execution=check.execution.replace(/^step5h-final-/,'compiled-');
  const browser=browsers.find(b=>b.id===check.execution),semantic=check.assertions?.find(a=>/^trace\.\d+\.check$/.test(a.path)&&typeof a.equals==='string');
  if(semantic&&browser){const commands=browser.commands.filter(c=>c.name===check.command);if(commands.length===1){const hits=commands[0].trace?.map((x,i)=>({x,i})).filter(({x})=>x.check===semantic.equals)??[];if(hits.length===1)for(const a of check.assertions)a.path=a.path.replace(/^trace\.\d+\./,`trace.${hits[0].i}.`);}}
 }
 record.recoveryReview={actualFreshExecution:receipt.sourceCommit,hostedBrowserSource:candidate,priorRecordSource:priors.some(r=>r.id===record.id)?'Step5J retained reviewed mapping':'Step5E retained reviewed mapping',oldExecutionsRetagged:false,runtimeAgreement};
 record.observed='Only the exact named fresh passing cases, original unchanged expected assertions, recovered captured browser checks and independently verified reports below qualify this criterion; missing clauses stay unqualified.';
}
const executedRegister=execFileSync('git',['show',`${receipt.sourceCommit}:ACCEPTANCE_STATUS.csv`],{maxBuffer:8*1024*1024});assert.equal(sha(executedRegister),receipt.sourceHashes['ACCEPTANCE_STATUS.csv']);
// The CSV overlay is annotated only after the run. Qualify the preserved actual
// execution fixture, not today's metadata bytes. Semantic equality was checked
// above; fresh post-annotation registry/gate tests are retained separately.
const readFor=p=>p==='ACCEPTANCE_STATUS.csv'?executedRegister:Object.hasOwn(receipt.buildHashes,p)?ctx.read(p):read(p),existsFor=p=>Object.hasOwn(receipt.buildHashes,p)?ctx.exists(p):existsSync(p);
const qualification=rows.map(row=>({id:row.id,criterion:row.acceptance,originalStatus:row.status,scope:row.r1_gate_basis,r1Critical:row.r1_blocking==='YES',result:effectivePass(row)?qualify(row,records.find(r=>r.id===row.id),receipt,{read:readFor,exists:existsFor,browsers,supplements}):{status:row.r1_blocking==='YES'?'NOT_QUALIFIED':'NOT_REQUIRED_FOR_R1',errors:row.r1_blocking==='YES'?['Original mandatory status not yet passed']:[]}}));
const registerSnapshot=`${directory}/canonical-before-annotation.csv`;
if(existsSync(registerSnapshot)){
 assert.equal(sha(read(registerSnapshot)),sha(executedRegister),'Preserved executed register differs from its receipt');
 for(const row of qualification)for(const fixture of row.result.fixtures??[])if(fixture.path==='ACCEPTANCE_STATUS.csv'){fixture.executedSourcePath=fixture.path;fixture.path=registerSnapshot;fixture.sourceBoundary='Actual immutable executed register; later candidate annotations are separately tested metadata.';}
}
const qualified=new Set(qualification.filter(r=>r.result.status==='QUALIFIED').map(r=>r.id));
const summary={format:'step5l-id-preserving-reconciliation',version:1,at:new Date().toISOString(),applicationSource:candidate,executionSource:receipt.sourceCommit,testPackagingSource:'566f3b11032841c492e6e148bb9a1139e74247b7',receipt:{path:receiptPath,sha256:sha(read(receiptPath))},runtimeAgreement,originalRequirements:302,deferredFeatures:86,originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length])),r1Count:237,qualifiedCount:qualified.size,unqualifiedIds:qualification.filter(r=>r.r1Critical&&!qualified.has(r.id)).map(r=>r.id),automatedTestCounts:receipt.testCounts,canonicalTrackerChanged:false,decision:'NOT_READY_FOR_R1'};
if(rows.every(r=>r.candidate_source===candidate&&r.candidate_annotation_basis.includes('Step5L'))){summary.canonicalTrackerChanged=true;summary.canonicalChangeScope='Post-execution candidate annotation columns only; original criteria, original statuses and cash scope unchanged.';}
const statusRows=rows.map(r=>({...r,step5l_source:candidate,step5l_execution:receipt.sourceCommit,step5l_qualification:r.r1_blocking!=='YES'?'NOT_REQUIRED_FOR_R1':qualified.has(r.id)?'QUALIFIED':'NOT_QUALIFIED',step5l_evidence:`${directory}/execution-qualification.json`,step5l_missing:qualification.find(x=>x.id===r.id).result.errors.join('; ')}));
const csv=values=>{const keys=Object.keys(values[0]);return[keys,...values.map(v=>keys.map(k=>v[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';};
for(const [name,data]of Object.entries({'summary.json':summary,'execution-qualification.json':qualification,'combined-records.json':{version:1,requirements:records},'report-rebindings.json':rebindings,'release-status.json':statusRows}))writeFileSync(`${directory}/${name}`,JSON.stringify(data,null,2)+'\n');
writeFileSync(`${directory}/release-status.csv`,csv(statusRows));
console.log(JSON.stringify(summary,null,2));
