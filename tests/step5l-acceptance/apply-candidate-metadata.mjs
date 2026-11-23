/** Explicit final integration into the sole mutable original-ID register.
 * Dry-run by default. Original status and wording are never changed here. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import {parseCsv} from '../../scripts/step5d-audit-execution-links.mjs';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
const dir='tests/step5l-acceptance',read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const rows=parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),summary=json(`${dir}/summary.json`),qualification=json(`${dir}/execution-qualification.json`),original=json('docs/specs/acceptance-source.json'),receipt=json(summary.receipt.path);
assert.equal(rows.length,302);assert.equal(qualification.length,302);assert.equal(new Set(qualification.map(r=>r.id)).size,302);assert.equal(json('docs/specs/backlog-source.json').length,86);
assert.equal(sha(read(summary.receipt.path)),summary.receipt.sha256);assert.equal(receipt.status,'PASS');assert.equal(receipt.sourceCommit,summary.executionSource);
const outcomes=new Map(qualification.map(r=>[r.id,r]));
assert.equal(qualification.filter(r=>r.r1Critical&&r.result.status==='QUALIFIED').length,summary.qualifiedCount);
for(const o of original)for(const[k,v]of Object.entries(o))assert.equal(rows.find(r=>r.id===o.id)[k],v);
const before=Object.fromEntries(rows.map(r=>[r.id,{status:r.status,criterion:r.acceptance,cash:r.r1_cash_component_status}]));
const next=rows.map(r=>{
 const q=outcomes.get(r.id);assert(q);assert.equal(q.criterion,r.acceptance);assert.equal(q.originalStatus,r.status);
 const qualified=q.result.status==='QUALIFIED';
 return {...r,candidate_source:summary.applicationSource,candidate_qualification:r.r1_blocking!=='YES'?'NOT_REQUIRED_FOR_R1':qualified?'QUALIFIED':'NOT_QUALIFIED',candidate_basis:r.r1_gate_basis,candidate_evidence:`${dir}/execution-qualification.json; ${dir}/summary.json`,candidate_next_action:qualified?'Retain exact candidate regression and its stated scope; no human-calibration or release-readiness inference.':`${r.next_action} Current candidate evidence: ${q.result.errors.join('; ')}`,candidate_execution_register_sha256:receipt.sourceHashes['ACCEPTANCE_STATUS.csv'],candidate_annotation_basis:`POST_EXECUTION_METADATA; Step5L recovered deployed application ${summary.applicationSource}; fresh execution ${summary.executionSource}; exact runtime/build byte agreement. Original statuses and immutable execution inputs preserved.`};
});
for(const r of next)assert.deepEqual({status:r.status,criterion:r.acceptance,cash:r.r1_cash_component_status},before[r.id]);
execFileSync('node',['scripts/build-r1-dashboard.mjs','--validate-stdin'],{input:JSON.stringify(next),maxBuffer:8*1024*1024});
const columns=Object.keys(next[0]),csv=[columns,...next.map(r=>columns.map(k=>r[k]??''))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const write=process.argv.includes('--write');
if(write){const backup=`${dir}/canonical-before-annotation.csv`;if(!existsSync(backup)){assert.equal(sha(read('ACCEPTANCE_STATUS.csv')),receipt.sourceHashes['ACCEPTANCE_STATUS.csv']);writeFileSync(backup,read('ACCEPTANCE_STATUS.csv'));}assert.equal(sha(read(backup)),receipt.sourceHashes['ACCEPTANCE_STATUS.csv']);writeFileSync('ACCEPTANCE_STATUS.csv',csv);execFileSync('node',['scripts/build-r1-dashboard.mjs'],{maxBuffer:8*1024*1024});execFileSync('node',['scripts/build-r1-dashboard.mjs','--check'],{maxBuffer:8*1024*1024});}
console.log(JSON.stringify({mode:write?'APPLIED_CURRENT_CANDIDATE_ANNOTATIONS':'DRY_RUN_NO_FILES_CHANGED',originalRequirements:302,deferredFeatures:86,originalStatusCounts:summary.originalStatusCounts,qualified:summary.qualifiedCount,total:237,remaining:summary.unqualifiedIds,applicationSource:summary.applicationSource,executionSource:summary.executionSource,originalStatusesChanged:false},null,2));
