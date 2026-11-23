/** Same portable command runner for local checks and a genuinely connected CI runner.
 * Environment variables describe a provider claim, never independent proof of hosted execution. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,createWriteStream} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {MODES,plan,modeEnvironment,safeOutput,sha,buildHashes,assertCompiledReceipt,assertBrowserReceipt,isSourceInput,changedSourceInputs,generatedReport,assertCompatibleBuild,probeReportProvenance} from './step5d-ci-plan.mjs';
const [mode,requestedOutput,upstreamPath,browserPath,...extra]=process.argv.slice(2);
assert(MODES.includes(mode)&&requestedOutput&&!extra.length,'Usage: node scripts/step5d-ci-runner.mjs critical|oracle|release|composition|probes|browser|gate OUTPUT [UPSTREAM_BUILD_RECEIPT] [BROWSER_RECEIPT]');
const root=process.cwd(),output=safeOutput(root,requestedOutput),manifest=resolve(output,'manifest.json');
assert(!existsSync(manifest),'Refusing to replace previous executed evidence');mkdirSync(output,{recursive:true});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const tracked=git('ls-files').split('\n').filter(Boolean),untracked=()=>git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean);
const inputs=()=>Object.fromEntries([...new Set([...tracked,...untracked()])].filter(isSourceInput).filter(existsSync).sort().map(p=>[p,sha(readFileSync(p))]));
const dirtyInputs=[...new Set([...git('diff','HEAD','--name-only').split('\n'),...untracked()].filter(isSourceInput))];
const before=inputs(),commit=git('rev-parse','HEAD'),providerClaim=process.env.GITHUB_ACTIONS==='true'?{provider:'github-actions',repository:process.env.GITHUB_REPOSITORY??null,sha:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,job:process.env.GITHUB_JOB??null}:null;
if(providerClaim)assert.equal(providerClaim.sha,commit,'CI checkout differs from provider commit');
const receipt={format:'ai-texas-ci-execution',version:1,mode,sourceCommit:commit,tree:git('rev-parse','HEAD^{tree}'),startedAt:new Date().toISOString(),sourceHashes:before,dirtyInputs,dirtyAtStart:git('status','--porcelain').split('\n').filter(Boolean),environment:{node:process.version,platform:process.platform,arch:process.arch},engineVersion:readFileSync('src/core/engine.ts','utf8').match(/ENGINE_VERSION\s*=\s*'([^']+)'/)[1],policyVersion:readFileSync('src/bots/profiles.ts','utf8').match(/POLICY_VERSION\s*=\s*'([^']+)'/)[1],providerClaim,hostedExecutionEvidence:providerClaim?'REQUIRES_PROVIDER_RUN_AND_ARTIFACT_VERIFICATION':'NOT_EXECUTED_LOCAL_ONLY',checks:[],limitations:['One automated test is not one original acceptance requirement.','Archived fixtures remain pinned by the source commit; per-case seed and rules definitions are in the hashed test sources.','No claim of physical device, actual screen reader, expert review or measured-human calibration.','No deployment is performed by this workflow.'],status:'RUNNING'};
const save=()=>writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');save();
const preserved=new Map(tracked.filter(p=>p.includes('/evidence/')&&!p.endsWith('.gz')&&!p.endsWith('.cpuprofile')).map(p=>[p,readFileSync(p)]));
const env={...process.env,...modeEnvironment(mode,output)};let failure=null;
try{
 if(mode==='composition'||mode==='probes'){
  assert(upstreamPath,'Supplemental mode requires the successful full-suite build receipt');
  const bytes=readFileSync(upstreamPath),base=JSON.parse(bytes.toString('utf8'));
  const comparison=assertCompatibleBuild(base,before,buildHashes(root));
  receipt.qualificationBase={path:relative(root,resolve(upstreamPath)),sha256:sha(bytes),sourceCommit:base.sourceCommit,...comparison};
 }
 if(mode==='browser'||mode==='gate'&&upstreamPath){
  assert(upstreamPath,'Browser mode requires the exact upstream compiled receipt');
  const upstream=JSON.parse(readFileSync(upstreamPath,'utf8'));assertCompiledReceipt(upstream,commit,buildHashes(root));receipt.upstreamBuild={receiptSHA256:sha(readFileSync(upstreamPath)),sourceCommit:upstream.sourceCommit};
 }
 if(mode==='gate'&&browserPath)assertBrowserReceipt(JSON.parse(readFileSync(browserPath,'utf8')),commit,buildHashes(root));
 for(const [name,program,args,environmentOverrides={}]of plan(mode,output,upstreamPath)){
  const log=resolve(output,`${name}.log`),started=Date.now(),record={name,command:[program,...args],environmentOverrides,startedAt:new Date().toISOString(),status:'RUNNING',log:relative(root,log)};receipt.checks.push(record);save();
  const stream=createWriteStream(log);const result=await new Promise(resolveRun=>{const child=spawn(program,args,{cwd:root,env:{...env,...environmentOverrides},stdio:['ignore','pipe','pipe']});child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});child.on('error',e=>resolveRun({exitCode:null,error:String(e)}));child.on('close',(exitCode,signal)=>resolveRun({exitCode,signal}));});await new Promise(resolveEnd=>stream.end(resolveEnd));
  Object.assign(record,{status:result.exitCode===0?'PASS':'FAIL',exitCode:result.exitCode,signal:result.signal??null,error:result.error??null,durationMs:Date.now()-started});save();console.log(`${record.status} ${name} (${record.durationMs} ms)`);
 }
 if(existsSync(resolve(output,'vitest.json'))){
  const v=JSON.parse(readFileSync(resolve(output,'vitest.json'),'utf8'));receipt.testCounts={total:v.numTotalTests,passed:v.numPassedTests,failed:v.numFailedTests,skipped:v.numPendingTests,files:v.testResults.length};
  receipt.testCases=v.testResults.flatMap(file=>file.assertionResults.map(t=>({file:relative(root,file.name),name:t.fullName,status:t.status,durationMs:t.duration,testSourceSHA256:before[relative(root,file.name)]??null,failureMessages:t.failureMessages})));
  if(mode==='probes'){assert.equal(receipt.testCounts.total,3);assert.equal(receipt.testCounts.passed,1);assert.equal(receipt.testCounts.skipped,2);receipt.selectionBoundary='Exactly one existing fixed-probe test selected by name; two unrelated benchmark tests intentionally not selected, never counted PASS.';}else assert.equal(receipt.testCounts.skipped,0,'Selected CI suite contained skipped tests');assert(receipt.testCounts.total>0,'No tests executed');
 }
 if(mode==='release'){
  const path=resolve(output,'paired-reference','vitest.json'),v=JSON.parse(readFileSync(path,'utf8'));
  const counts={total:v.numTotalTests,passed:v.numPassedTests,failed:v.numFailedTests,skipped:v.numPendingTests,files:v.testResults.length};
  assert.equal(counts.skipped,0,'Paired reference suite contained skipped tests');assert(counts.total>0,'Paired reference suite did not execute');
  receipt.supportingSuites=[{name:'paired-reference',report:relative(root,path),reportSHA256:sha(readFileSync(path)),environment:{...modeEnvironment(mode,output),STEP5B_REFERENCE_PAIRED:'1',STEP5B_ACCEPTANCE_EVIDENCE_DIR:resolve(output,'paired-reference')},testCounts:counts,testCases:v.testResults.flatMap(file=>file.assertionResults.map(t=>({file:relative(root,file.name),name:t.fullName,status:t.status,durationMs:t.duration,testSourceSHA256:before[relative(root,file.name)]??null,failureMessages:t.failureMessages})))}];
  const main=JSON.parse(readFileSync(resolve(output,'current-benchmark-summary.json'),'utf8')),paired=JSON.parse(readFileSync(resolve(output,'paired-reference','current-benchmark-summary.json'),'utf8'));
  assert.equal(main.full,true);assert.equal(main.paired,false);assert.equal(main.totalHands,4032,'Full six-cell reference matrix did not execute');
  assert.equal(paired.full,true);assert.equal(paired.paired,true);assert.equal(paired.totalHands,1344,'Paired rake/depth reference matrix did not execute');
  receipt.referenceBenchmarks={main:generatedReport(root,resolve(output,'current-benchmark-summary.json'),commit,['full','paired','totalHands']),paired:generatedReport(root,resolve(output,'paired-reference','current-benchmark-summary.json'),commit,['full','paired','totalHands']),testCountBoundary:'The paired run repeats one executable test with a distinct scenario; hand counts are not test or acceptance counts.'};
  receipt.generatedReports={composition:generatedReport(root,resolve(output,'composition-summary.json'),commit,['full','completedHands']),ecology:generatedReport(root,resolve(output,'Y10-ecology.json'),commit,['full','totalHands','blocks','handsPerBlock'])};
  assert.equal(receipt.generatedReports.composition.full,true);assert.equal(receipt.generatedReports.composition.completedHands,960,'Full table-composition matrix did not execute');
  assert.equal(receipt.generatedReports.ecology.full,true);assert.equal(receipt.generatedReports.ecology.totalHands,800,'Full continuous ecology did not execute');
 }
 if(mode==='composition'){
  receipt.generatedReports={composition:generatedReport(root,resolve(output,'composition-summary.json'),commit,['full','completedHands'])};
  assert.equal(receipt.generatedReports.composition.full,true);assert.equal(receipt.generatedReports.composition.completedHands,960,'Full supplemental composition matrix did not execute');
  assertCompatibleBuild(JSON.parse(readFileSync(upstreamPath,'utf8')),inputs(),buildHashes(root));
 }
 if(mode==='probes'){
  const provenance=probeReportProvenance(root,resolve(output,'probes','exploit-probes.json'),commit,receipt.policyVersion),path=resolve(output,'probes','execution-provenance.json');
  writeFileSync(path,JSON.stringify(provenance,null,2)+'\n');
  receipt.generatedReports={probes:generatedReport(root,path,commit,['full','repetitions','completedHands','totalLegalDecisions','policyVersion','observedVersions','rawReport'])};
  assertCompatibleBuild(JSON.parse(readFileSync(upstreamPath,'utf8')),inputs(),buildHashes(root));
 }
 if(existsSync('dist'))receipt.buildHashes=buildHashes(root);
 if(mode==='browser'||mode==='gate'&&upstreamPath)assertCompiledReceipt(JSON.parse(readFileSync(upstreamPath,'utf8')),commit,receipt.buildHashes);
}catch(e){failure=String(e);receipt.failure=failure;}
finally{
 for(const [p,bytes]of preserved)if(existsSync(p)&&sha(readFileSync(p))!==sha(bytes)){const generated=resolve(output,'generated',p);mkdirSync(dirname(generated),{recursive:true});writeFileSync(generated,readFileSync(p));writeFileSync(p,bytes);}
 receipt.finishedAt=new Date().toISOString();receipt.changedInputs=changedSourceInputs(before,inputs());receipt.sourceCommitAtEnd=git('rev-parse','HEAD');
 receipt.status=!failure&&receipt.checks.length>0&&receipt.checks.every(c=>c.status==='PASS')&&receipt.changedInputs.length===0&&receipt.dirtyInputs.length===0&&receipt.sourceCommitAtEnd===commit?'PASS':'FAIL';save();console.log(JSON.stringify({status:receipt.status,mode,counts:receipt.testCounts,hostedExecution:receipt.hostedExecutionEvidence,manifest:relative(root,manifest)}));process.exitCode=receipt.status==='PASS'?0:1;
}
