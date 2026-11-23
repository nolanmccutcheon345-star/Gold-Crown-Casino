import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {relative,resolve} from 'node:path';

export const ORACLE_FILES=['tests/oracle','tests/step5b-engine/pokerkit-trace.test.ts','tests/r1critical/evaluator-oracle.test.ts','tests/step5d-gates/river-reference-review.test.ts'];
export const HEAVY_FILES=['tests/verification/accounting-batch.test.ts'];
export const MODES=['critical','oracle','release','composition','probes','browser','gate'];
export function plan(mode,output,upstreamReceipt){
 assert(MODES.includes(mode),'Unknown CI mode');
 const tests=['node_modules/vitest/vitest.mjs','run','--reporter=json',`--outputFile=${resolve(output,'vitest.json')}`];
 // Full archive/oracle jobs retain large independent graphs. Bound concurrent
 // files so they do not compete with every available core for the same heap
 // budget; retain every test, assertion, seed and the existing timeout.
 if(mode==='release')tests.push('--maxWorkers=4');
 if(mode==='critical'||mode==='oracle')tests.push('--maxWorkers=2');
 if(mode==='critical')for(const path of [...ORACLE_FILES,...HEAVY_FILES])tests.push('--exclude',path==='tests/oracle'?'tests/oracle/**':path);
 if(mode==='oracle')tests.push(...ORACLE_FILES);
 if(mode==='composition')tests.push('tests/step5b-acceptance/composition.test.ts');
 if(mode==='probes')tests.push('tests/step4b/benchmark.test.ts','-t','runs every fixed exploit probe');
 const common=[['ci-contract','node',['--test','tests/step5d-ci/runner.test.mjs']],['specification','node',['scripts/check-spec-integrity.mjs']],['registry','node',['scripts/build-r1-dashboard.mjs','--check']]];
 if(mode==='composition'||mode==='probes')return [...common,['tests','node',tests]];
 if(mode==='gate')return [['qualified-evidence','node',['scripts/step5d-audit-execution-links.mjs','--enforce','--output',resolve(output,'qualified-evidence.json'),...(upstreamReceipt?['--receipt',upstreamReceipt]:[])]],['release-decision','node',['scripts/build-r1-dashboard.mjs','--check','--release-check']]];
 if(mode==='browser')return [['browser','node',['node_modules/@playwright/test/cli.js','test','--config=tests/browser/playwright.config.ts',`--output=${resolve(output,'artifacts')}`,'--reporter=list,json']]];
 return [...common,...(mode==='oracle'?[]:[['typecheck','npm',['run','typecheck']],['lint','npm',['run','lint']]]),['tests','node',tests],...(mode==='release'?[['paired-reference','node',['node_modules/vitest/vitest.mjs','run','tests/step5b-acceptance/current-benchmarks.test.ts','--reporter=json',`--outputFile=${resolve(output,'paired-reference','vitest.json')}`],{STEP5B_REFERENCE_PAIRED:'1',STEP5B_ACCEPTANCE_EVIDENCE_DIR:resolve(output,'paired-reference')}]]:[]),...(mode==='oracle'?[]:[['build','npm',['run','build']]])];
}
export function modeEnvironment(mode,output){
 const full=mode==='release';return {RUN_ORACLE:mode==='oracle'||full?'1':'0',RUN_ACCOUNTING_BATCH:full?'1':'0',STEP5C_ECOLOGY_FULL:full?'1':'0',STEP5B_COMPOSITION_FULL:full||mode==='composition'?'1':'0',STEP5B_REFERENCE_FULL:full?'1':'0',STEP5B_REFERENCE_PAIRED:'0',STEP4B_EVALUATE:mode==='probes'?'1':'0',STEP4B_PROBE_REPS:mode==='probes'?'32':'1',STEP4B_REPORT_DIR:resolve(output,'probes'),STEP5B_ACCEPTANCE_EVIDENCE_DIR:output,STEP5C_GATE_EVIDENCE_DIR:output,STEP5D_GATE_EVIDENCE_DIR:resolve(output,'river'),STEP5D_GATE_REVIEW_DIR:resolve(output,'river-reference-review'),STEP5D_GATES_EVIDENCE_DIR:resolve(output,'gates'),PLAYWRIGHT_JSON_OUTPUT_FILE:resolve(output,'playwright.json')};
}
export function safeOutput(root,path){
 const resolved=resolve(root,path),rel=relative(root,resolved).replaceAll('\\','/');
 assert(rel.startsWith('test-results/')||rel.startsWith('tests/step5d-ci/evidence/')||(rel.startsWith('TEST_EVIDENCE/step5d/')||rel.startsWith('TEST_EVIDENCE/step5e/')||rel.startsWith('TEST_EVIDENCE/step5f/')||rel.startsWith('TEST_EVIDENCE/step5g/')||rel.startsWith('TEST_EVIDENCE/step5h/')),'CI output must be a new test-results or approved CI evidence directory');
 return resolved;
}
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function buildHashes(root){
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
 return Object.fromEntries(walk(resolve(root,'dist')).sort().map(path=>[relative(root,path).replaceAll('\\','/'),sha(readFileSync(path))]));
}
export function assertCompiledReceipt(receipt,commit,actualHashes){
 assert.equal(receipt.format,'ai-texas-ci-execution');assert.equal(receipt.status,'PASS','Upstream build checks did not pass');
 assert.equal(receipt.sourceCommit,commit,'Compiled artifact belongs to a different commit');
 assert.equal(receipt.changedInputs.length,0,'Source changed during upstream build');
 assert(Array.isArray(receipt.dirtyInputs)&&receipt.dirtyInputs.length===0,'Upstream build was not executed from its exact committed inputs');
 assert(Object.hasOwn(receipt.buildHashes,'dist/index.html'),'Compiled entrypoint missing');
 assert.deepEqual(actualHashes,receipt.buildHashes,'Compiled bytes differ from the verified build artifact');
}

export function assertBrowserReceipt(receipt,commit,actualHashes){
 assert.equal(receipt.mode,'browser','Expected actually executed compiled-browser evidence');
 assertCompiledReceipt(receipt,commit,actualHashes);
 assert(receipt.checks?.some(c=>c.name==='browser'&&c.status==='PASS'&&c.exitCode===0),'Compiled-browser command did not execute successfully');
}

export const isSourceInput=p=>/^(src|public|scripts|tests|\.github)\//.test(p)&&!p.includes('/evidence/')&&!/\.(gz|cpuprofile)$/.test(p)||['index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','eslint.config.js','.openai/hosting.json','ACCEPTANCE_STATUS.csv','docs/specs/acceptance-source.json','docs/specs/backlog-source.json','R1_REQUIREMENTS.csv','R1_DASHBOARD.md','tests/step5d-gates/evidence/river/F10-heldout.json.gz','TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md'].includes(p);
export const changedSourceInputs=(before,after)=>[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);

/** Hash the actual produced bytes; never infer a full-mode run from its filename. */
export function generatedReport(root,path,commit,fields){
 const location=resolve(root,path),relativePath=relative(root,location).replaceAll('\\','/');
 assert(relativePath&&!relativePath.startsWith('../')&&!relativePath.startsWith('/'),'Generated report must belong to this checkout');
 const bytes=readFileSync(location),report=JSON.parse(bytes.toString('utf8'));
 assert.equal(report.sourceCommit,commit,'Generated report belongs to a different source commit');
 const metadata={path:relativePath,sha256:sha(bytes),sourceCommit:report.sourceCommit};
 for(const field of fields){assert(Object.hasOwn(report,field),`Generated report omits ${field}`);metadata[field]=report[field];}
 return metadata;
}

export const isRuntimeInput=p=>/^(src|public)\//.test(p)||['index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','.openai/hosting.json'].includes(p);
/** A supplemental test may reuse a prior compiled build only after byte-for-byte
 * runtime and artifact comparison; it never claims a new build was executed. */
export function assertCompatibleBuild(receipt,currentHashes,actualBuildHashes){
 assert.match(receipt.sourceCommit,/^[a-f0-9]{40}$/);
 assertCompiledReceipt(receipt,receipt.sourceCommit,actualBuildHashes);
 const runtime=hashes=>Object.fromEntries(Object.entries(hashes).filter(([p])=>isRuntimeInput(p)).sort(([a],[b])=>a.localeCompare(b)));
 const expected=runtime(receipt.sourceHashes),current=runtime(currentHashes);
 assert(Object.keys(expected).length>0&&Object.hasOwn(expected,'index.html'),'Prior receipt lacks committed runtime inputs');
 assert.deepEqual(current,expected,'Runtime source differs from the qualified full-suite build');
 return {runtimeMatch:'EXACT',compiledAssetsMatch:'EXACT',runtimeInputCount:Object.keys(current).length};
}

/** Preserve the legacy report verbatim and attach observed policy versions to
 * its old comparison labels; the labels themselves are not version claims. */
export function probeReportProvenance(root,path,commit,policyVersion){
 const location=resolve(root,path),relativePath=relative(root,location).replaceAll('\\','/');
 assert(relativePath&&!relativePath.startsWith('../')&&!relativePath.startsWith('/'),'Probe report must belong to this checkout');
 const bytes=readFileSync(location),report=JSON.parse(bytes.toString('utf8'));
 assert.equal(report.repetitions,32);assert.equal(report.completedHands,3072);assert.equal(report.rows.length,96);assert.equal(report.paired.length,48);
 const observedVersions=Object.fromEntries(['frozen-1.0','candidate-1.1'].map(model=>{
  const versions=[...new Set(report.examples.filter(e=>e.model===model).flatMap(e=>e.traces.map(t=>t.observation.policyVersion)))];
  assert.equal(versions.length,1,`Missing or inconsistent observed policy versions for ${model}`);
  return[model,versions[0]];
 }));
 assert.equal(observedVersions['candidate-1.1'],policyVersion,'Candidate trace uses a different policy version');
 return{sourceCommit:commit,policyVersion,full:true,repetitions:report.repetitions,completedHands:report.completedHands,totalLegalDecisions:report.totalLegalDecisions,rawReport:{path:relativePath,sha256:sha(bytes)},observedVersions,labelBoundary:'frozen-1.0 and candidate-1.1 are retained historical comparison keys; observedVersions records the actual trace policy versions.'};
}
