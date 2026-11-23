import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseCsv} from '../../scripts/step5d-audit-execution-links.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const checks=[];
function check(name,run){run();checks.push({name,status:'PASS'});}
const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
const original=json('docs/specs/acceptance-source.json');
const criteria=json('tests/step5n-acceptance/original-criteria.json');
const report=json('tests/step5n-acceptance/owner-iphone-report.json');
const gates=json('tests/step5n-acceptance/gate-review.json');
check('302 exact original IDs and wording remain unchanged',()=>{
 assert.equal(rows.length,302);assert.equal(new Set(rows.map(x=>x.id)).size,302);
 for(const spec of original){const row=rows.find(x=>x.id===spec.id);for(const [key,value] of Object.entries(spec))assert.equal(row[key],value,`${spec.id}/${key}`);}
});
check('86 deferred entries remain intact and do not become extra acceptance IDs',()=>{
 const run=spawnSync(process.execPath,['scripts/check-spec-integrity.mjs'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(json('docs/specs/backlog-source.json').length,86);
});
check('Eight gate quotes exactly match governing source, not invented replacement descriptions',()=>{
 assert.deepEqual(criteria.map(x=>x.id),['U10','U11','U16','Z02','Z14','V518','V522','V707']);
 for(const criterion of criteria){assert.deepEqual(criterion,original.find(x=>x.id===criterion.id));assert.equal(gates.reviews.find(x=>x.id===criterion.id).acceptance,criterion.acceptance);}
});
check('Genuine owner PASS is retained without guessed device, candidate, export or screen-reader results',()=>{
 assert.equal(report.reportStatus,'PASS_REPORTED');assert.equal(report.verifiedByAgent,false);assert.match(report.reportedText,/physical iPhone Safari testing has PASSED/);
 for(const key of ['candidateApplicationCommit','candidateSiteURL','deviceModel','operatingSystemVersion','browserVersion','testDate'])assert.equal(report[key],null,key);
 assert.deepEqual(report.individualChecks,{});assert.deepEqual(report.qualifiesOriginalIDs,[]);
});
check('No automatic promotion of whole or candidate statuses from partial device/dependency evidence',()=>{
 const before=json('tests/step5n-acceptance/evidence/status-before.json');
 for(const row of rows)for(const key of ['status','candidate_qualification','r1_cash_component_status'])assert.equal(row[key],before[row.id][key],`${row.id}/${key}`);
 assert.equal(rows.filter(x=>x.r1_blocking==='YES').length,237);assert.equal(rows.filter(x=>x.r1_blocking==='YES'&&x.candidate_qualification==='QUALIFIED').length,229);
});
check('Current owner deferral leaves hosted CI mandatory and unqualified',()=>{
 const policy=json('tests/step5n-acceptance/hosted-ci-disposition.json');
 const row=rows.find(x=>x.id===policy.criterion);
 assert.equal(policy.integration,'DEFERRED_BY_OWNER');
 assert.equal(policy.hostedRunEvidence,'NOT_EXECUTED');
 assert.equal(row.status,'BLOCKED');
 assert.equal(row.r1_blocking,'YES');
 assert.equal(row.candidate_qualification,'NOT_QUALIFIED');
 assert.equal(row.dependencies,policy.dependency);
 assert.equal(row.next_action,policy.nextAction);
 assert.equal(row.candidate_next_action,policy.nextAction);
});
check('Historical equivalence is not silently promoted to all-write nonmutation proof',()=>{
 const audit=json('tests/step5n-acceptance/evidence/provenance-review.json');
 assert.equal(audit.hostingFileHistory.length,1);assert.equal(audit.otherProjectAccessed,false);assert.equal(audit.otherProjectMutated,false);
 for(const id of ['U16','Z02'])assert.equal(audit[id].status,'BLOCKED');
 for(const id of ['3ecea1c2b71c8e8b9963547da676171f91f21716','1805380'])assert.equal(audit.originalObjectAvailability[id].present,false);
 assert.equal(json('tests/step5n-acceptance/evidence/provider-capabilities.json').administrativeMutationAuditExposed,false);
});
check('External forms remain blank; no synthetic participant or screen-reader completion',()=>{
 for(const name of ['participants.csv','hand-observations.csv','device-reader-results.csv','physical-performance.csv','issues.csv']){
  const content=readFileSync(`tests/step5n-acceptance/external/${name}`,'utf8');
  assert(content.trim());assert.doesNotMatch(content,/\bPASS\b/);
 }
 assert.equal(json('tests/step5n-acceptance/evidence/screen-reader-environment.json').actualScreenReaderExecuted,false);
});
check('Mixed V706 and Z14 whole criteria remain unexecuted, with cash qualification separate',()=>{
 for(const id of ['V706','Z14']){const r=rows.find(x=>x.id===id);assert.equal(r.status,'NOT_EXECUTED');assert.equal(r.r1_gate_basis,'EXPLICIT_MIXED_CASH_COMPONENT');}
 assert.equal(rows.find(x=>x.id==='Z14').candidate_qualification,'NOT_QUALIFIED');
});
check('Actual release gate refuses all eight unresolved mandatory IDs with unchanged original counts',()=>{
 const run=spawnSync(process.execPath,['scripts/build-r1-dashboard.mjs','--check','--release-check'],{encoding:'utf8'});assert.equal(run.status,1,run.stderr);const result=JSON.parse(run.stdout);
 assert.deepEqual(result.status,{PASS:221,FAIL:0,BLOCKED:6,NOT_EXECUTED:75});assert.equal(result.candidateEvidenceGate.qualified,229);assert.equal(result.candidateEvidenceGate.totalCritical,237);
 assert.deepEqual([...result.candidateEvidenceGate.unqualifiedIds].sort(),criteria.map(x=>x.id).sort());assert.equal(result.candidateEvidenceGate.decision,'NOT_READY_FOR_R1');
});
const result={format:'step5n-acceptance-verification',status:'PASS',checksExecuted:checks.length,checks,limitation:'These checks verify evidence accounting and release refusal; they are not executed human/device/CI or newly passed V7 requirements.'};
writeFileSync('tests/step5n-acceptance/evidence/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
