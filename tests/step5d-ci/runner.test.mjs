import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {plan,modeEnvironment,safeOutput,assertCompiledReceipt,assertBrowserReceipt,isSourceInput,changedSourceInputs,generatedReport,sha,assertCompatibleBuild,probeReportProvenance,ORACLE_FILES,HEAVY_FILES} from '../../scripts/step5d-ci-plan.mjs';
const output='/workspace/test-results/example',commit='a'.repeat(40),hashes={'dist/index.html':'a'.repeat(64),'dist/assets/app.js':'b'.repeat(64)};
const receipt=()=>({format:'ai-texas-ci-execution',status:'PASS',sourceCommit:commit,dirtyInputs:[],changedInputs:[],buildHashes:{...hashes}});
test('ordinary checks execute typecheck, lint, unit checks and a production build',()=>{
 const commands=plan('critical',output);assert.deepEqual(commands.map(c=>c[0]),['ci-contract','specification','registry','typecheck','lint','tests','build']);
 assert(commands.find(c=>c[0]==='tests')[2].includes('--reporter=json'));
});
test('ordinary suite explicitly excludes only gated oracle/accounting files rather than pretending skipped tests passed',()=>{
 const args=plan('critical',output).find(c=>c[0]==='tests')[2];
 assert.deepEqual(args.filter((_,i)=>args[i-1]==='--exclude'),[...ORACLE_FILES.map(p=>p==='tests/oracle'?`${p}/**`:p),...HEAVY_FILES]);
});
test('release suite runs all tests with oracle, 20k accounting and full ecology enabled',()=>{
 assert(!plan('release',output).find(c=>c[0]==='tests')[2].includes('--exclude'));
 assert(plan('release',output).find(c=>c[0]==='tests')[2].includes('--maxWorkers=4'));
 const env=modeEnvironment('release',output);assert.equal(env.RUN_ORACLE,'1');assert.equal(env.RUN_ACCOUNTING_BATCH,'1');assert.equal(env.STEP5C_ECOLOGY_FULL,'1');assert.equal(env.STEP5B_COMPOSITION_FULL,'1');assert.equal(env.STEP5B_REFERENCE_FULL,'1');assert.equal(env.STEP5B_REFERENCE_PAIRED,'0');
});
test('oracle job includes every independent oracle test directory/file',()=>{
 assert.deepEqual(plan('oracle',output).find(c=>c[0]==='tests')[2].slice(-ORACLE_FILES.length),ORACLE_FILES);assert.equal(modeEnvironment('oracle',output).RUN_ORACLE,'1');
});
test('ordinary jobs do not inherit high-volume flags accidentally',()=>{
 const env=modeEnvironment('critical',output);assert.equal(env.RUN_ORACLE,'0');assert.equal(env.RUN_ACCOUNTING_BATCH,'0');assert.equal(env.STEP5C_ECOLOGY_FULL,'0');assert.equal(env.STEP5B_COMPOSITION_FULL,'0');assert.equal(env.STEP5B_REFERENCE_FULL,'0');assert.equal(env.STEP5B_REFERENCE_PAIRED,'0');
});
test('compiled-browser job never rebuilds the application it is supposed to test',()=>{
 const commands=plan('browser',output);assert.equal(commands.length,1);assert.equal(commands[0][0],'browser');assert(!JSON.stringify(commands).includes('build'));assert(commands[0][2].includes(`--output=${output}/artifacts`),'Browser runner must not clear its receipt or upstream artifact directory');
});
test('release decision executes the real fail-closed original-ID registry gate',()=>{
 const commands=plan('gate',output,'test-results/release/manifest.json');
 assert.deepEqual(commands[0],['qualified-evidence','node',['scripts/step5d-audit-execution-links.mjs','--enforce','--output',`${output}/qualified-evidence.json`,'--receipt','test-results/release/manifest.json']]);
 assert.deepEqual(commands[1],['release-decision','node',['scripts/build-r1-dashboard.mjs','--check','--release-check']]);
});
test('unknown suite selection is rejected',()=>{assert.throws(()=>plan('made-up',output));});
test('safe evidence outputs cannot replace source or traverse above their approved root',()=>{
 assert.equal(safeOutput('/tmp/repo','test-results/new'),'/tmp/repo/test-results/new');
 for(const path of ['src','test-results/../src','../test-results/out','tests/step5d-ci/evidence/../../../../src','TEST_EVIDENCE/step5f/../../src','TEST_EVIDENCE/step5f-other/new'])assert.throws(()=>safeOutput('/tmp/repo',path));
});
test('Step5F evidence root supports the unchanged full release plan and high-volume flags',()=>{
 const fresh=safeOutput('/tmp/repo','TEST_EVIDENCE/step5f/release-final');
 assert.equal(fresh,'/tmp/repo/TEST_EVIDENCE/step5f/release-final');
 assert.deepEqual(plan('release',fresh).map(c=>c[0]),plan('release',output).map(c=>c[0]));
 const env=modeEnvironment('release',fresh);
 for(const flag of ['RUN_ORACLE','RUN_ACCOUNTING_BATCH','STEP5C_ECOLOGY_FULL','STEP5B_COMPOSITION_FULL','STEP5B_REFERENCE_FULL'])assert.equal(env[flag],'1');
 assert.equal(env.STEP5D_GATE_EVIDENCE_DIR,`${fresh}/river`);
});
test('same-commit exact compiled bytes are accepted',()=>{assert.doesNotThrow(()=>assertCompiledReceipt(receipt(),commit,hashes));});
test('artifact from a different source commit is rejected',()=>{assert.throws(()=>assertCompiledReceipt(receipt(),'b'.repeat(40),hashes),/different commit/);});
test('failed upstream build or altered source cannot qualify compiled browser evidence',()=>{
 assert.throws(()=>assertCompiledReceipt({...receipt(),status:'FAIL'},commit,hashes),/did not pass/);
 assert.throws(()=>assertCompiledReceipt({...receipt(),changedInputs:['src/core/engine.ts']},commit,hashes),/Source changed/);
});
test('modified, missing and extra compiled assets are all detected',()=>{
 assert.throws(()=>assertCompiledReceipt(receipt(),commit,{...hashes,'dist/assets/app.js':'c'.repeat(64)}),/Compiled bytes/);
 assert.throws(()=>assertCompiledReceipt(receipt(),commit,{'dist/index.html':hashes['dist/index.html']}),/Compiled bytes/);
 assert.throws(()=>assertCompiledReceipt(receipt(),commit,{...hashes,'dist/extra.js':'d'.repeat(64)}),/Compiled bytes/);
});
test('missing entrypoint or unrelated receipt format cannot qualify a build',()=>{
 assert.throws(()=>assertCompiledReceipt({...receipt(),format:'generic-test'},commit,hashes));
 const missing={'dist/assets/app.js':hashes['dist/assets/app.js']};assert.throws(()=>assertCompiledReceipt({...receipt(),buildHashes:missing},commit,missing),/entrypoint missing/);
});

test('ordinary or authored browser evidence cannot stand in for a successful compiled-browser run',()=>{
 assert.throws(()=>assertBrowserReceipt({...receipt(),mode:'critical'},commit,hashes),/compiled-browser/);
 assert.throws(()=>assertBrowserReceipt({...receipt(),mode:'browser',checks:[]},commit,hashes),/did not execute/);
});
test('compiled-browser receipt must match source and exact assets plus successful command exit',()=>{
 const browser={...receipt(),mode:'browser',checks:[{name:'browser',status:'PASS',exitCode:0}]};
 assert.doesNotThrow(()=>assertBrowserReceipt(browser,commit,hashes));
 assert.throws(()=>assertBrowserReceipt(browser,commit,{...hashes,'dist/extra.js':'x'}));
 assert.throws(()=>assertBrowserReceipt({...browser,checks:[{name:'browser',status:'PASS',exitCode:1}]},commit,hashes),/did not execute/);
});

test('uncommitted input changes or missing exact-source proof cannot qualify compiled evidence',()=>{
 assert.throws(()=>assertCompiledReceipt({...receipt(),dirtyInputs:['src/storage/browser.ts']},commit,hashes),/exact committed inputs/);
 const old=receipt();delete old.dirtyInputs;assert.throws(()=>assertCompiledReceipt(old,commit,hashes),/exact committed inputs/);
});

test('entrypoint and public/runtime inputs belong to source proof, while generated evidence does not',()=>{
 for(const p of ['index.html','src/storage/browser.ts','public/image.svg','.openai/hosting.json','tests/step36/fixtures/populated-v3.json','tests/step5d-gates/evidence/river/F10-heldout.json.gz','tests/step5d-gates/F10_PROTOCOL.md','tests/step5b-acceptance/DIVERSITY_PROTOCOL.md','TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md'])assert(isSourceInput(p),p);
 assert(!isSourceInput('tests/step5d-ci/evidence/new.json'));
});
test('source proof detects deletion and newly introduced runtime files as well as edits',()=>{
 assert.deepEqual(changedSourceInputs({'src/old.ts':'a','src/edit.ts':'a'},{'src/edit.ts':'b','src/new.ts':'c'}).sort(),['src/edit.ts','src/new.ts','src/old.ts']);
});

test('release executes paired rake/depth cells separately without replacing the six main reference cells',()=>{
 const paired=plan('release',output).find(c=>c[0]==='paired-reference');assert(paired);
 assert(paired[2].includes('tests/step5b-acceptance/current-benchmarks.test.ts'));
 assert(paired[2].includes(`--outputFile=${output}/paired-reference/vitest.json`));
 assert.deepEqual(paired[3],{STEP5B_REFERENCE_PAIRED:'1',STEP5B_ACCEPTANCE_EVIDENCE_DIR:`${output}/paired-reference`});
 assert(!plan('critical',output).some(c=>c[0]==='paired-reference'));
});
test('oracle and ordinary modes explicitly account for the conditional independent river-reference file',()=>{
 assert(ORACLE_FILES.includes('tests/step5d-gates/river-reference-review.test.ts'));
 assert(plan('critical',output).find(c=>c[0]==='tests')[2].includes('tests/step5d-gates/river-reference-review.test.ts'));
 assert(plan('oracle',output).find(c=>c[0]==='tests')[2].includes('tests/step5d-gates/river-reference-review.test.ts'));
});
test('fresh F10 and independent review outputs are isolated from frozen historical evidence',()=>{
 const env=modeEnvironment('release',output);assert.equal(env.STEP5D_GATE_EVIDENCE_DIR,`${output}/river`);assert.equal(env.STEP5D_GATE_REVIEW_DIR,`${output}/river-reference-review`);assert.equal(env.STEP5D_GATES_EVIDENCE_DIR,`${output}/gates`);
});

test('generated metadata preserves actual counts and false full-mode flag while hashing exact result bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'poker-ci-report-'));
 try{const bytes=JSON.stringify({sourceCommit:commit,full:false,totalHands:42});writeFileSync(join(root,'report.json'),bytes);
 const result=generatedReport(root,'report.json',commit,['full','totalHands']);assert.deepEqual(result,{path:'report.json',sha256:sha(bytes),sourceCommit:commit,full:false,totalHands:42});
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('generated evidence refuses wrong-source, missing-field and outside-checkout reports',()=>{
 const root=mkdtempSync(join(tmpdir(),'poker-ci-report-'));
 try{writeFileSync(join(root,'report.json'),JSON.stringify({sourceCommit:commit,full:true}));
 assert.throws(()=>generatedReport(root,'report.json','b'.repeat(40),['full']),/different source/);
 assert.throws(()=>generatedReport(root,'report.json',commit,['totalHands']),/omits totalHands/);
 assert.throws(()=>generatedReport(root,'../report.json',commit,['full']),/belong to this checkout/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('supplemental composition mode executes only its full two-case composition file and never rebuilds',()=>{
 const commands=plan('composition',output);assert.deepEqual(commands.map(c=>c[0]),['ci-contract','specification','registry','tests']);
 assert(commands.at(-1)[2].includes('tests/step5b-acceptance/composition.test.ts'));
 const env=modeEnvironment('composition',output);assert.equal(env.STEP5B_COMPOSITION_FULL,'1');assert.equal(env.STEP5B_REFERENCE_FULL,'0');assert.equal(env.RUN_ACCOUNTING_BATCH,'0');
});
test('supplemental qualification permits runner-only changes but rejects changed/missing/new runtime bytes',()=>{
 const runtime={'index.html':'entry','src/core/engine.ts':'engine','package-lock.json':'lock'},base={...receipt(),sourceHashes:{...runtime,'scripts/runner.mjs':'old'}};
 assert.deepEqual(assertCompatibleBuild(base,{...runtime,'scripts/runner.mjs':'new'},hashes),{runtimeMatch:'EXACT',compiledAssetsMatch:'EXACT',runtimeInputCount:3});
 assert.throws(()=>assertCompatibleBuild(base,{...runtime,'src/core/engine.ts':'changed'},hashes),/Runtime source differs/);
 assert.throws(()=>assertCompatibleBuild(base,{'index.html':'entry','package-lock.json':'lock'},hashes),/Runtime source differs/);
 assert.throws(()=>assertCompatibleBuild(base,{...runtime,'src/new.ts':'new'},hashes),/Runtime source differs/);
 assert.throws(()=>assertCompatibleBuild(base,runtime,{...hashes,'dist/assets/app.js':'changed'}),/Compiled bytes/);
});

test('supplemental probe mode selects only the existing fixed exploit test with 32 repetitions and isolated outputs',()=>{
 const commands=plan('probes',output);assert.deepEqual(commands.map(c=>c[0]),['ci-contract','specification','registry','tests']);
 assert.deepEqual(commands.at(-1)[2].slice(-3),['tests/step4b/benchmark.test.ts','-t','runs every fixed exploit probe']);
 const env=modeEnvironment('probes',output);assert.equal(env.STEP4B_EVALUATE,'1');assert.equal(env.STEP4B_PROBE_REPS,'32');assert.equal(env.STEP4B_REPORT_DIR,`${output}/probes`);
 assert.equal(modeEnvironment('critical',output).STEP4B_EVALUATE,'0');assert.equal(env.STEP5B_COMPOSITION_FULL,'0');
});
test('probe provenance preserves raw report bytes and uses actual observed versions rather than legacy model labels',()=>{
 const root=mkdtempSync(join(tmpdir(),'poker-ci-probe-'));
 const report={repetitions:32,completedHands:3072,totalLegalDecisions:10000,rows:Array(96).fill({}),paired:Array(48).fill({}),examples:[{model:'frozen-1.0',traces:[{observation:{policyVersion:'cash-v1.0'}}]},{model:'candidate-1.1',traces:[{observation:{policyVersion:'cash-v1.6'}}]}]};
 try{const bytes=JSON.stringify(report);writeFileSync(join(root,'probes.json'),bytes);
 const result=probeReportProvenance(root,'probes.json',commit,'cash-v1.6');
 assert.equal(result.sourceCommit,commit);assert.equal(result.rawReport.sha256,sha(bytes));assert.equal(result.observedVersions['candidate-1.1'],'cash-v1.6');assert.equal(result.completedHands,3072);
 assert.throws(()=>probeReportProvenance(root,'probes.json',commit,'cash-v1.1'),/different policy/);
 writeFileSync(join(root,'probes.json'),JSON.stringify({...report,repetitions:1,completedHands:96}));assert.throws(()=>probeReportProvenance(root,'probes.json',commit,'cash-v1.6'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
