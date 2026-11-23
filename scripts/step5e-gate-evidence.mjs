/** Execute narrow existing Y12/V601 checks with exact source, fixture and build provenance.
 * Existing browser evidence may be reused only after its own original proof and complete
 * production-input/build equality pass. This does not run or claim a new browser session. */
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {performance} from 'node:perf_hooks';
import process from 'node:process';
import console from 'node:console';
import {sha,buildHashes,isSourceInput,changedSourceInputs,assertCompatibleBuild} from './step5d-ci-plan.mjs';
import {parseCsv,qualify} from './step5d-audit-execution-links.mjs';
import {verifyBrowser} from './step5d-qualify-browser.mjs';

const root=process.cwd(),output=process.argv[2];
assert(output&&/^tests\/step5e-gates\/evidence\/[A-Za-z0-9_-]+$/.test(output),'Use a new tests/step5e-gates/evidence/NAME directory');
assert(!existsSync(`${output}/manifest.json`),'Never replace an executed receipt');mkdirSync(output,{recursive:true});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),tracked=git('ls-files').split('\n').filter(Boolean);
const inputs=()=>Object.fromEntries(tracked.filter(path=>isSourceInput(path)||path==='docs/specs/acceptance-source.json').filter(existsSync).sort().map(path=>[path,sha(readFileSync(path))]));
const commit=git('rev-parse','HEAD'),before=inputs();
const dirtyInputs=[...git('diff','HEAD','--name-only').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(isSourceInput);
assert.equal(dirtyInputs.length,0,'Commit source inputs before actual evidence execution');
const basePath='TEST_EVIDENCE/step5d/release-repaired/manifest.json',base=JSON.parse(readFileSync(basePath));
const receipt={format:'ai-texas-ci-execution',version:1,mode:'step5e-exact-gate-supplement',sourceCommit:commit,tree:git('rev-parse','HEAD^{tree}'),sourceHashes:before,dirtyInputs,changedInputs:[],environment:{node:process.version,platform:process.platform,arch:process.arch},engineVersion:readFileSync('src/core/engine.ts','utf8').match(/ENGINE_VERSION\s*=\s*'([^']+)'/)[1],policyVersion:readFileSync('src/bots/profiles.ts','utf8').match(/POLICY_VERSION\s*=\s*'([^']+)'/)[1],startedAt:new Date().toISOString(),checks:[],status:'RUNNING',hostedExecutionEvidence:'NOT_EXECUTED_LOCAL_ONLY',limitations:['No automated-test count is acceptance coverage.','Only the selected existing source/label and release-gate tests plus historical-qualification contracts execute.','The old browser runs retain original source/QA/build identity; no browser is run here.','No original acceptance status is edited, and no device/human/hosted-CI validation is claimed.']};
const save=()=>writeFileSync(`${output}/manifest.json`,JSON.stringify(receipt,null,2)+'\n');save();
const command=(name,program,args)=>{const started=performance.now(),r=spawnSync(program,args,{encoding:'utf8',env:{...process.env,STEP5B_ACCEPTANCE_EVIDENCE_DIR:resolve(output)},maxBuffer:32*1024*1024});writeFileSync(`${output}/${name}.log`,r.stdout+'\n'+r.stderr);receipt.checks.push({name,command:[program,...args],status:r.status===0?'PASS':'FAIL',exitCode:r.status,durationMs:performance.now()-started,log:`${output}/${name}.log`});save();assert.equal(r.status,0,`${name} failed: ${r.stderr}`);};
try{
 command('specification','node',['scripts/check-spec-integrity.mjs']);
 command('registry','node',['scripts/build-r1-dashboard.mjs','--check']);
 command('tests','node',['node_modules/vitest/vitest.mjs','run','tests/step5b-statistics/calibration-guards.test.ts','tests/step5b-acceptance/release-gate.test.ts','tests/step5e-gates/historical-source.test.ts','--reporter=json',`--outputFile=${resolve(output,'vitest.json')}`]);
 command('lint','node',['node_modules/eslint/bin/eslint.js','tests/step5e-gates']);
 command('build','npm',['run','build']);
 const result=JSON.parse(readFileSync(`${output}/vitest.json`));
 receipt.testCounts={total:result.numTotalTests,passed:result.numPassedTests,failed:result.numFailedTests,skipped:result.numPendingTests,files:result.testResults.length};
 assert(receipt.testCounts.total>0&&receipt.testCounts.failed===0&&receipt.testCounts.skipped===0);
 receipt.testCases=result.testResults.flatMap(file=>file.assertionResults.map(c=>({file:relative(root,file.name),name:c.fullName,status:c.status,durationMs:c.duration,testSourceSHA256:before[relative(root,file.name)],failureMessages:c.failureMessages})));
 receipt.buildHashes=buildHashes(root);
 receipt.qualificationBase={path:basePath,sha256:sha(readFileSync(basePath)),sourceCommit:base.sourceCommit,...assertCompatibleBuild(base,before,receipt.buildHashes)};
 receipt.changedInputs=changedSourceInputs(before,inputs());receipt.sourceCommitAtEnd=git('rev-parse','HEAD');assert.equal(receipt.changedInputs.length,0);assert.equal(receipt.sourceCommitAtEnd,commit);receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=String(error);}
receipt.finishedAt=new Date().toISOString();save();
if(receipt.status!=='PASS'){console.log(JSON.stringify({status:receipt.status,failure:receipt.failure,output}));process.exitCode=1;}
else{
 const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
 const records=['Y12','V601'].map(id=>{
  const row=rows.find(row=>row.id===id),y12=id==='Y12';
  const fixtureFiles=y12?['tests/step5b-statistics/calibration-guards.test.ts','TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md','src/stats/calibration.ts']:['tests/step5b-acceptance/release-gate.test.ts','scripts/build-r1-dashboard.mjs','ACCEPTANCE_STATUS.csv','docs/specs/acceptance-source.json'];
  // The governing source itself is immutable and not otherwise an execution input.
  for(const path of fixtureFiles)if(!before[path])throw Error(`Runner must hash the actual fixture before execution: ${path}`);
  return{id,criterionSha256:sha(row.acceptance),scope:row.r1_gate_basis,coverageReview:'COMPLETE',reviewRationale:y12?'Actual prior research citation is loaded from its original review, rejected as an action-opportunity calibration source, and all required missing dimensions are asserted. This is a source/label guard, not human calibration.':'Exact current 302-ID registry is exercised without editing it. Hypothetical gate fixtures prove all later tournament rows may remain NOT_EXECUTED only when every required cash gate passes. Actual retained 2–10-seat browser hands prove playable cash on byte-identical production runtime; hosted execution remains separately NOT_EXECUTED under V522.',roomVersions:y12?['NOT_APPLICABLE: documentary calibration-source guard; no cards or money']:['practice-cash@0.3.0+cfg.026af13db0a40309409b6ae5193ae5866f19e6fd894fa7f8ade798dae9b050b3: original compiled 2–10-seat cash workflows'],inputs:{description:y12?'Published performance research summary, deliberately without eligible action-level records; exact missing provenance/rights/population/strata/holdout/metric assertions are in the hashed fixture.':'Current real registry plus explicit synthetic copies that change only release-state inputs. Browser part is the retained actual CSPRNG 2–10-seat UI run at 320px, never presented as freshly executed.',seeds:[],fixtureFiles},fixtureHashes:Object.fromEntries(fixtureFiles.map(path=>[path,before[path]])),expected:y12?'Reject empirical action-frequency calibration; zero eligible opportunities and every missing evidence dimension named.':'Actual unresolved cash gates block; hypothetical fully verified cash gates allow later tournaments to remain unexecuted; 2–10 cash hands finish and cash out exactly once.',observed:y12?'Named assertion passes in this fresh source-bound execution.':'The named gate tests pass freshly; original browser capture has nine complete hands and nine exact cashouts. Its original build/source identity is retained.',cases:receipt.testCases.filter(c=>y12?c.name.includes('Y12 rejects cited published'):c.file==='tests/step5b-acceptance/release-gate.test.ts').map(({file,name})=>({file,name})),...(y12?{}:{browserCases:[{execution:'compiled-320',command:'start',occurrences:9,assertions:[{path:'result.layout.status',equals:'PASS'}]}]})};
 });
 const browsers=JSON.parse(readFileSync('TEST_EVIDENCE/step5d/browser/qualification-index.json')).map(entry=>verifyBrowser(entry,base,{read:path=>readFileSync(path),exists:existsSync,sourceAtCommit:(source,path)=>execFileSync('git',['show',`${source}:${path}`],{maxBuffer:64*1024*1024})}));
 const results=records.map(record=>({id:record.id,...qualify(rows.find(row=>row.id===record.id),record,receipt,{browsers})}));
 writeFileSync(`${output}/proposed-qualifications.json`,JSON.stringify({version:1,scope:'Freshly executed supplementary qualification only; canonical statuses untouched',requirements:records},null,2)+'\n');
 writeFileSync(`${output}/qualification-results.json`,JSON.stringify({format:'step5e-exact-gate-supplement',sourceCommit:commit,executedTests:receipt.testCounts,reusedBrowserSource:base.sourceCommit,browserExecutedHere:false,originalStatusChanged:false,results},null,2)+'\n');
 console.log(JSON.stringify({status:receipt.status,tests:receipt.testCounts,qualification:results.map(({id,status,errors})=>({id,status,errors})),output},null,2));if(results.some(r=>r.status!=='QUALIFIED'))process.exitCode=1;
}
