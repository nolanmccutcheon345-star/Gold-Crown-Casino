import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {reviewRecovered,recoverContext} from './review-recovered.mjs';
import {verifyStep5EBrowser} from '../../scripts/step5e-qualify-browser.mjs';
import {verifyStep5EStatistics} from '../../scripts/step5e-qualify-statistics.mjs';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const full=reviewRecovered();

test('eight original strict browser verifiers accept unchanged recovered captures and pinned bytes',()=>{
 assert.equal(full.qualifiedBrowserGroups,8);assert.equal(full.newBrowserExecutions,0);
 assert.equal(full.records.filter(x=>x.result.workflow==='cash').length,3);
 assert.equal(full.records.find(x=>x.entry.id==='gate-matrix66').result.actualCases,66);
});
test('a lost source commit is not claimed recovered by the evidence adapter',()=>{
 assert.match(full.sourceBoundary,/original Git commit object not asserted recovered/);
 assert.throws(()=>recoverContext().sourceAtCommit('0'.repeat(40),'src/engine/index.ts'),/No retained source proof/);
});
test('modified runtime bytes fail closed before qualification',()=>{
 assert.throws(()=>recoverContext({sourceOverride:p=>p==='tests/browser/step5e-compiled.ts'?Buffer.from('changed'):undefined}).sourceAtCommit(full.candidateSource,'tests/browser/step5e-compiled.ts'),/Recovered assertion bytes differ/);
});

function mutate(id,change,verify=verifyStep5EBrowser){
 const entry=clone(full.records.find(x=>x.entry.id===id).entry),ctx=recoverContext();
 const d=JSON.parse(readFileSync(entry.capture.path));change(d);
 const bytes=Buffer.from(JSON.stringify(d));entry.capture.sha256=sha(bytes);
 return verify(entry,ctx.receipt,{...ctx,read:p=>p===entry.capture.path?bytes:ctx.read(p)});
}
for(const [name,change]of [
 ['missing ten-seat workflow',d=>{d.reports=d.reports.filter(r=>r.name!=='start'||r.result.count!==10);}],
 ['duplicate cashout count',d=>{d.reports.find(r=>r.check==='2–10 plus exact raise/custom-blind hands and exact single cashouts').final.cashouts++;}],
 ['missing complete-hand evidence',d=>{d.actualUIHands=10;}],
 ['failed action record',d=>{d.reports.find(r=>r.kind==='step5e-compiled-result').status='FAIL';}],
 ['wrong application source',d=>{const x=d.reports.find(r=>r.result?.sourceCommit);x.result.sourceCommit='0'.repeat(40);}]
])test(`rehashed capture cannot hide ${name}`,()=>assert.equal(mutate('compiled-390',change).status,'NOT_QUALIFIED'));

test('constructed statistics hours cannot masquerade as human-played hands',()=>{
 const r=mutate('exact-statistics-10h',d=>{d.actualUIPlayedHands=300;},verifyStep5EStatistics);assert.equal(r.status,'NOT_QUALIFIED');
});
test('statistics projection arithmetic independently rejects corrupted values',()=>{
 const r=mutate('exact-statistics-1h',d=>{d.checks[0].actual.projectedBB='30.00';},verifyStep5EStatistics);assert.equal(r.status,'NOT_QUALIFIED');
});
test('altering the exact compiled asset identity fails qualification',()=>{
 const ctx=recoverContext(),entry=full.records[0].entry,receipt=clone(ctx.receipt);
 receipt.buildHashes['dist/assets/index-DPmGgl-n.js']='0'.repeat(64);
 assert.equal(verifyStep5EBrowser(entry,receipt,ctx).status,'NOT_QUALIFIED');
});
test('truncated capture without refreshed checksum fails before inspecting its self-reported PASS',()=>{
 const entry=clone(full.records[0].entry);entry.capture.sha256='0'.repeat(64);const ctx=recoverContext();
 assert.equal(verifyStep5EBrowser(entry,ctx.receipt,ctx).status,'NOT_QUALIFIED');
});
