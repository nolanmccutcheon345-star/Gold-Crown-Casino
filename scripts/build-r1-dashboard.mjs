import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {MIXED_CASH_REQUIREMENTS,evaluateR1Release} from './r1-release-gate.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=path=>readFileSync(resolve(root,path),'utf8');
const json=path=>JSON.parse(read(path));
const sha=path=>createHash('sha256').update(read(path)).digest('hex');
const statuses=['PASS','FAIL','BLOCKED','NOT_EXECUTED'];
const scopes=['R1 cash-game release-critical','R1 desirable but nonblocking','R2 single-table tournament','R3 multi-table tournament','Deferred post-release enhancement','External validation dependency'];
const originalKeys=['id','scope','title','acceptance','source','source_status'];
const keys=[...originalKeys,'release_scope','priority','r1_blocking','r1_gate_basis','r1_cash_component_status','r1_cash_component_evidence','baseline_status','step5a_status','status','status_basis','coverage_extent','evidence','supporting_test_cases','coverage_detail','observed_defect','owner','dependencies','next_action','classification_rationale','classification_source','scope_split','candidate_test_files','mapping_audit','evidence_class','notes'];
function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}assert(!quoted,'Unterminated CSV cell');
 const header=rows.shift();assert(header?.length,'Missing CSV header');assert.equal(new Set(header).size,header.length,'Duplicate CSV columns');
 return rows.filter(row=>row.some(Boolean)).map(row=>{assert.equal(row.length,header.length,'CSV column count mismatch');return Object.fromEntries(header.map((key,index)=>[key,row[index]]));});
}
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv=(rows,columns)=>[columns,...rows.map(row=>columns.map(key=>row[key]))].map(row=>row.map(quote).join(',')).join('\n')+'\n';
const counts=rows=>Object.fromEntries(statuses.map(status=>[status,rows.filter(row=>row.status===status).length]));
const countLine=rows=>Object.entries(counts(rows)).map(([status,n])=>`${n} ${status}`).join(' / ');
const md=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const links=value=>String(value??'').split('; ').filter(Boolean).map(path=>existsSync(resolve(root,path))?`[${path}](${path})`:md(path)).join('<br>');
const specs=json('docs/specs/acceptance-source.json');
const backlog=json('docs/specs/backlog-source.json');
assert.equal(specs.length,302);assert.equal(backlog.length,86);assert.equal(new Set(backlog.map(row=>row.id)).size,86);
// This is the sole mutable requirement-status source. Previous audit update JSONs are
// historical artifacts, deliberately not read as competing status overrides.
async function readStdin(){let input='';for await(const chunk of process.stdin)input+=chunk;return input;}
const rows=process.argv.includes('--validate-stdin')?JSON.parse(await readStdin()):parseCsv(read('ACCEPTANCE_STATUS.csv'));
assert.equal(rows.length,302,'Expected exactly 302 original requirement rows');
assert.equal(new Set(rows.map(row=>row.id)).size,302,'Duplicate original requirement ID');
const byId=new Map(rows.map(row=>[row.id,row]));
for(const spec of specs){
 const row=byId.get(spec.id);assert(row,`Missing original ID ${spec.id}`);
 for(const key of keys)assert.equal(typeof row[key],'string',`${spec.id}: Missing column ${key}`);
 for(const key of originalKeys)assert.equal(row[key],spec[key],`${spec.id}: Original ${key} changed`);
 assert(statuses.includes(row.status),`${spec.id}: Invalid status`);
 assert(statuses.includes(row.step5a_status),`${spec.id}: Invalid historical Step5A status`);
 assert.equal(row.status_basis,'ORIGINAL_WHOLE_CRITERION',`${spec.id}: Status must use original whole criterion`);
 assert(scopes.includes(row.release_scope),`${spec.id}: Invalid release scope`);
 assert(['YES','NO'].includes(row.r1_blocking),`${spec.id}: Invalid blocking flag`);
 assert(row.classification_source&&row.classification_rationale,`${spec.id}: Scope needs source and rationale`);
 if(row.r1_blocking==='YES')assert.equal(row.priority,'RELEASE_CRITICAL',`${spec.id}: Blocking row needs release-critical priority`);
 if(row.status==='PASS'){
  assert(row.evidence&&row.notes,`${spec.id}: PASS needs executed evidence and boundaries`);
  assert.equal(row.coverage_extent,'WHOLE_CRITERION',`${spec.id}: Partial coverage is not whole-criterion PASS`);
 }
 if(row.status==='FAIL')assert(row.observed_defect&&row.next_action,`${spec.id}: FAIL needs defect and next action`);
 assert(['ORIGINAL_WHOLE_CRITERION','EXPLICIT_MIXED_CASH_COMPONENT'].includes(row.r1_gate_basis),`${spec.id}: Invalid release gate basis`);
 if(row.r1_gate_basis==='EXPLICIT_MIXED_CASH_COMPONENT'){
  assert(Object.hasOwn(MIXED_CASH_REQUIREMENTS,row.id),`${spec.id}: No governing explicit deferred/cash scope split`);
  assert.equal(row.r1_blocking,'YES',`${spec.id}: Cash component must remain an R1 requirement`);
  assert(row.scope_split&&row.classification_source,`${spec.id}: Component basis needs governing scope proof`);
  assert(statuses.includes(row.r1_cash_component_status),`${spec.id}: Invalid cash component check status`);
  if(row.r1_cash_component_status==='PASS')assert(row.r1_cash_component_evidence&&row.supporting_test_cases,`${spec.id}: Cash component PASS needs separate executed evidence and cases`);
 }else assert(!row.r1_cash_component_status&&!row.r1_cash_component_evidence,`${spec.id}: Whole criterion cannot have alternate component status`);
 assert(row.owner&&row.next_action,`${spec.id}: Missing owner or next action`);
 assert(!Object.hasOwn(row,'r1_cash_gate_status'),`${spec.id}: Alternate status universe is forbidden`);
}
// Preserve original source order, independently of spreadsheet sorting.
const ordered=specs.map(spec=>byId.get(spec.id));
const blockers=ordered.filter(row=>row.r1_blocking==='YES');
const totalCounts=counts(ordered),criticalCounts=counts(blockers);
for(const status of statuses)assert(criticalCounts[status]<=totalCounts[status],'Subset status exceeds original universe');
const releaseGate=evaluateR1Release(ordered);
const candidateColumns=['candidate_source','candidate_qualification','candidate_basis','candidate_evidence','candidate_next_action','candidate_execution_register_sha256','candidate_annotation_basis'];
const hasCandidate=ordered.some(row=>row.candidate_source),candidateUnqualified=hasCandidate?blockers.filter(row=>row.candidate_qualification!=='QUALIFIED'):[];
if(hasCandidate){for(const row of ordered){for(const key of candidateColumns)assert.equal(typeof row[key],'string',`${row.id}: Missing candidate annotation ${key}`);assert(/^[a-f0-9]{40}$/.test(row.candidate_source),`${row.id}: Invalid source identity`);assert(['QUALIFIED','NOT_QUALIFIED','NOT_EXECUTED','NOT_REQUIRED_FOR_R1'].includes(row.candidate_qualification),`${row.id}: Invalid candidate evidence status`);assert.equal(row.candidate_basis,row.r1_gate_basis);assert(row.candidate_annotation_basis.startsWith('POST_EXECUTION_METADATA'));}assert.equal(new Set(ordered.map(row=>row.candidate_source)).size,1,'Mixed candidate source annotations');}
const candidateEvidenceGate=hasCandidate?{sourceCommit:ordered[0].candidate_source,qualified:blockers.filter(row=>row.candidate_qualification==='QUALIFIED').length,totalCritical:blockers.length,unqualifiedIds:candidateUnqualified.map(row=>row.id),decision:candidateUnqualified.length||releaseGate.blockers.length?'NOT_READY_FOR_R1':'READY_FOR_R1',executionRegisterSHA256:ordered[0].candidate_execution_register_sha256}:null;
const summary={releaseGate,requirements:302,deferredFeatures:86,originalSpecSha256:sha('docs/specs/acceptance-source.json'),deferredRegisterSha256:sha('BACKLOG_86.csv'),status:totalCounts,r1CriticalOriginalRequirements:criticalCounts,scopeCounts:Object.fromEntries(scopes.map(scope=>[scope,ordered.filter(row=>row.release_scope===scope).length])),...(candidateEvidenceGate?{candidateEvidenceGate}:{})};
if(process.argv.includes('--validate-stdin')){console.log(JSON.stringify(summary));process.exit(process.argv.includes('--release-check')&&(releaseGate.blockers.length||candidateUnqualified.length)?1:0);}
let report=`# R1 release dashboard — one original requirement universe\n\n**${releaseGate.decision.replaceAll('_',' ')}.** All 302 original requirements: **${countLine(ordered)}**. Release-critical original-ID subset (${blockers.length} rows): **${countLine(blockers)}**. Both totals use the same \`status\` column; a subset cannot contain more PASS requirements than the whole. Automated-test totals are separate evidence, never added to mapped acceptance coverage.\n\n[ACCEPTANCE_STATUS.csv](ACCEPTANCE_STATUS.csv) is the sole mutable status registry. [R1_REQUIREMENTS.csv](R1_REQUIREMENTS.csv) and this dashboard are generated views. Update the canonical row only after observing evidence, then run \`node scripts/build-r1-dashboard.mjs\`. \`--check\` verifies generated output is current. Historical Step5A override JSONs and proposed-update CSVs are retained as evidence and are no longer status inputs. Original IDs, criterion text, source status, source order, and all 86 deferred features are preserved and validated.\n\n## Accounting reconciliation\n\nStep5A's 120 cash-component PASS total counted six partly verified mixed rows (R11, M05, M11, X13, V407, V409) as PASS even though their whole original requirements remained NOT_EXECUTED. There were no duplicate original IDs. At checkpoint9d937a3 the correct same-status figures were 114/18/5/165 overall and 114/18/0/105 for the237 release-critical original rows (PASS/FAIL/BLOCKED/NOT_EXECUTED). The six cash-component evidence records are retained in \`coverage_detail\`; they are not a second status tally. Their tournament portions belong to R2 and are not cash defects. V706 is an additional separately declared split: V7 permanent directive section9 explicitly makes straddles nonblocking for R1, while its supported cash freeze/version/ledger clauses remain mandatory. This is not inferred solely from FUT010/FUT011, whose entries concern straddle variants. The full original rows cannot be marked PASS until their complete criteria execute. The runnable R1 gate may separately use an explicit, evidence-backed cash-component check only for explicitly declared governing mixed rows; it never adds that result to original PASS counts.\n\nA row's \`status_basis\` is always ORIGINAL_WHOLE_CRITERION. \`coverage_extent\` distinguishes whole-criterion evidence from partial cash evidence and source gaps. \`supporting_test_cases\` links executed cases; \`candidate_test_files\` remains an audit lead, not proof of execution. \`step5a_status\` preserves the 18 previously failed criteria after repairs. Release scope, priority, evidence, defects, dependencies, owner and next action are separately recorded.\n\n## Scope and status\n\n| Release scope | Total | PASS | FAIL | BLOCKED | NOT_EXECUTED |\n|---|---:|---:|---:|---:|---:|\n`;
for(const scope of scopes){const subset=ordered.filter(row=>row.release_scope===scope),c=counts(subset);report+=`| ${scope} | ${subset.length} | ${c.PASS} | ${c.FAIL} | ${c.BLOCKED} | ${c.NOT_EXECUTED} |\n`;}
report+=`\n## Runnable R1 release decision\n\nRun \`node scripts/build-r1-dashboard.mjs --release-check\`. It exits nonzero for any unresolved required whole criterion or cash component, including external required checks. Current decision: **${releaseGate.decision.replaceAll('_',' ')}** with **${releaseGate.blockers.length} unresolved cash-release checks**. The ${releaseGate.verifiedCashComponents} verified cash components below are supporting checks, not additional passed original requirements. All other critical rows use whole-criterion status. A whole FAIL/BLOCKED always blocks, even if a stale component was previously PASS.\n\n| Original ID | Original status | Cash component check | Explicit later scope | Evidence |\n|---|---|---|---|---|\n`;
for(const component of releaseGate.componentChecks)report+=`| ${component.id} | ${component.originalStatus} | ${component.cashComponentStatus} | ${md(component.deferredScope)} | ${links(component.evidence)} |\n`;
report+='\nTournament requirements are retained for R2/R3. V7 explicitly defers straddles (FUT010/FUT011), missed-blind variants (FUT012), tells (FUT020/FUT024), advanced curve lab (FUT029), churn (FUT032) and bookmarks (FUT050). FUT029 does not waive the baseline draw-curve editor in V432/V608. No originally mandatory R1 feature was moved to desirable/deferred to improve counts.\n\n## All 18 Step5A failed criteria\n\nExact acceptance text is copied unchanged from the governing source. A code change alone does not close a row; its entire criterion needs actual evidence.\n\n| ID | Original acceptance criterion | Current status | Defect / dependency | Owner / next action | Evidence |\n|---|---|---|---|---|---|\n';
for(const row of ordered.filter(row=>row.step5a_status==='FAIL'))report+=`| ${row.id} | ${md(row.acceptance)} | ${row.status} | ${md(row.observed_defect+'; '+row.dependencies)} | ${md(row.owner+' — '+row.next_action)} | ${links(row.evidence)} |\n`;
report+='\n## External checks and boundaries\n\n| ID | Status | Evidence still required | R1 treatment |\n|---|---|---|---|\n';
for(const row of ordered.filter(row=>row.release_scope==='External validation dependency'))report+=`| ${row.id} | ${row.status} | ${md(row.notes+' '+row.next_action)} | ${row.r1_blocking==='YES'?'Release-critical; external execution required':'Human-calibration claim gate; honest synthetic R1 permitted by V7'} |\n`;
report+='\nThe owner reports physical iPhone Safari testing **PASSED** in Step5N. Candidate/device/browser and individual checks, including export-to-Files, still need attribution; no already valid check needs an unnecessary repeat. Actual VoiceOver and required physical timing/memory measurements are separate. Chromium emulation and Node transport tests do not establish physical Safari behavior. V707 requires three new human users and25 hands with recorded comprehension/misclicks; automated browser hands cannot fulfill it. The five inherited BLOCKED human-data/reviewer requirements remain distinct from mechanics correctness and synthetic functional evidence.\n\n## Remaining release-critical BLOCKED / NOT_EXECUTED original criteria\n\nThe exact wording and partial boundaries below identify what remains unverified. Whole mixed criteria retain NOT_EXECUTED when an explicitly deferred component is outstanding; their cash evidence is shown without relabeling the whole row.\n\n| ID | Original status | Exact original criterion | Existing partial boundary / next action |\n|---|---|---|---|\n';
for(const row of blockers.filter(row=>['BLOCKED','NOT_EXECUTED'].includes(row.status)))report+=`| ${row.id} | ${row.status} | ${md(row.acceptance)} | ${md([row.coverage_detail,row.scope_split,row.next_action].filter(Boolean).join(' '))} |\n`;
report+='\n## Evidence provenance\n\nStep5A recorded572/572 automated tests in73 files,212 new real UI hands (211 candidate,1 published),105 layout cases and4 populated migrations. Those historical runs are documented in [STEP5A_REPORT.md](STEP5A_REPORT.md) and [TEST_EVIDENCE/step5a/BROWSER.md](TEST_EVIDENCE/step5a/BROWSER.md); they are not claimed as Step5B reruns. New evidence belongs on the exact canonical requirement rows after execution. Mechanical, synthetic-bot, expert-review and measured-human-calibration evidence remain separate.\n\n## Complete original-ID dashboard\n\n| ID | Original title | Scope / priority | Original status | Coverage | Evidence | Defect | Owner / next action |\n|---|---|---|---|---|---|---|---|\n';
for(const row of ordered)report+=`| ${row.id} | ${md(row.title)} | ${md(row.release_scope+' / '+row.priority)} | ${row.status} | ${md(row.coverage_extent)} | ${links(row.evidence)} | ${md(row.observed_defect)} | ${md(row.owner+' — '+row.next_action)} |\n`;
if(hasCandidate){
 const qualified=blockers.filter(row=>row.candidate_qualification==='QUALIFIED'),priorCashPass=blockers.filter(row=>row.status==='PASS'||row.r1_cash_component_status==='PASS');
 let current=`\n## Recorded source-bound candidate qualification (historical snapshot)\n\n**${candidateEvidenceGate.decision.replaceAll('_',' ')}.** Frozen tested production source: \`${candidateEvidenceGate.sourceCommit}\`. **${qualified.length}/${blockers.length} mandatory original-ID gates were qualified for that recorded source**; ${priorCashPass.length} have original whole PASS or explicitly authorized cash-component PASS. These different denominators are displayed separately. This is a preserved qualification snapshot for the stated commit, not a claim about a newer candidate. Fresh source-bound regression and criterion mapping are required before release; missing new mappings are not newly observed product failures. Any unqualified mandatory gate blocks release even if historical original status remains PASS. The registry was annotated after execution; original executed register SHA256: \`${candidateEvidenceGate.executionRegisterSHA256}\`. The full test receipt is unchanged and no new CSV metadata is represented as an earlier executed input. Automated test totals remain separate.\n\n| Original ID | Recorded qualification | Required next action |\n|---|---|---|\n`;
 for(const row of candidateUnqualified)current+=`| ${row.id} | ${row.candidate_qualification} | ${md(row.candidate_next_action)} |\n`;
 current+='\n## Complete302-ID recorded qualification overlay\n\n| ID | Original whole status | Qualification scope | Recorded candidate evidence | Exact evidence |\n|---|---|---|---|---|\n';
 for(const row of ordered)current+=`| ${row.id} | ${row.status} | ${row.candidate_basis} | ${row.candidate_qualification} | ${links(row.candidate_evidence)} |\n`;
 report+=current;
}
const outputs={'R1_REQUIREMENTS.csv':csv(ordered,[...keys,...(hasCandidate?candidateColumns:[])]),'R1_DASHBOARD.md':report};
for(const [path,value] of Object.entries(outputs)){if(process.argv.includes('--check'))assert.equal(read(path),value,`Outdated generated ${path}`);else writeFileSync(resolve(root,path),value);}
console.log(JSON.stringify({...summary,outputs:Object.keys(outputs)},null,2));

if(process.argv.includes('--release-check')&&(releaseGate.blockers.length||candidateUnqualified.length))process.exitCode=1;
