/** Independent evidence-field review; this executes no poker or browser hands. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
import {recoverContext,candidate} from './review-recovered.mjs';
const dir='tests/step5l-acceptance',read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const auditPath=`${dir}/provenance-input-qualification.json`,recordsPath=`${dir}/provenance-input-records.json`,indexPath=`${dir}/per-case-provenance.json`;
const audit=json(auditPath),records=json(recordsPath).requirements,index=json(indexPath),base=json(audit.receipt.path),ctx=recoverContext();
assert.equal(base.status,'PASS');assert.equal(audit.verifyBuild,true);assert.deepEqual(audit.candidateErrors,[]);assert.equal(index.sourceCommit,base.sourceCommit);assert.deepEqual(index.remainingIDs,[]);
const originalGaps=json('tests/step5e-gates/evidence/draftfix/status-honesty-review.json').V620SpecificMetadataGaps;
const selectedIDs=new Set([...originalGaps.map(r=>r.id),'V429','V513']);
assert.deepEqual(new Set(index.rows.map(r=>r.id)),selectedIDs);assert.equal(index.resolvedIDs.length,selectedIDs.size);
let observerPasses=0;const captures=new Map();
for(const ref of index.observedSupplementManifests){
 assert.equal(sha(read(ref.path)),ref.sha256);const m=json(ref.path);assert.equal(m.status,'PASS');assert.equal(m.candidateSource,base.sourceCommit);assert.equal(m.sourceCommit,base.sourceCommit);assert.deepEqual(m.changedInputs,[]);
 observerPasses+=m.testCounts.passed;
 // index-provenance.py independently reconciles each named successful case
 // against exactly one observed metadata file, including repeated case names.
 assert.equal(Object.keys(m.metadataFiles).length,m.testCounts.passed);
}
for(const row of index.rows){
 assert.equal(row.status,'RESOLVED');assert.deepEqual(row.unresolved,[]);
 for(const b of row.browserCases)captures.set(b.capture.path,b.capture.sha256);
 for(const report of row.reportCases)for(const group of report.selectedGroups)captures.set(group.capture.path,group.capture.sha256);
}
for(const [p,h]of captures)assert.equal(sha(read(p)),h);
const current=audit.requirements.filter(r=>r.effectiveCriticalPass&&r.qualification.status==='QUALIFIED'&&r.id!=='V620');
assert.equal(new Set(current.map(r=>r.id)).size,current.length);
const missing=[],perRequirement=[];
for(const r of current){
 const rec=records.find(x=>x.id===r.id),q=r.qualification;assert(rec);assert.deepEqual(q.errors,[]);
 for(const key of ['expected','observed','reviewRationale'])if(!rec[key])missing.push(`${r.id}:${key}`);
 if(!rec.inputs?.description)missing.push(`${r.id}:test input descriptor`);
 if(!rec.roomVersions?.length||rec.roomVersions.some(v=>/<exact|UNRECORDED|MISSING/.test(v)))missing.push(`${r.id}:exact applied-room applicability`);
 for(const p of rec.inputs?.fixtureFiles??[])assert.equal(rec.fixtureHashes[p],base.sourceHashes[p]);
 const link=index.rows.find(x=>x.id===r.id);if(link)assert.equal(link.status,'RESOLVED');
 assert(q.executedCases.length+q.executedBrowserCases.length+q.executedReports.length>0);
 perRequirement.push({id:r.id,criterionSha256:rec.criterionSha256,sourceCommit:base.sourceCommit,observedHostedApplicationSource:candidate,buildHashes:base.buildHashes,engineVersion:base.engineVersion,availablePolicyVersion:base.policyVersion,policyApplicability:link?'Actual observed per-case policy versions and exact historical inputs retained in the linked index; a refused reader has no applied policy.':'Named immutable assertion/fixture inputs and actual report retain policy-specific inputs; metadata-only and engine-only checks do not apply a bot policy.',roomVersions:rec.roomVersions,perCaseRoomIndex:link?{path:indexPath,sha256:sha(read(indexPath)),id:r.id}:null,testInputs:rec.inputs,expected:rec.expected,observed:{unitCases:q.executedCases,browserCases:q.executedBrowserCases,reports:q.executedReports},runtimeEnvironment:base.environment,artifact:{qualification:auditPath,records:recordsPath}});
}
assert.deepEqual(missing,[]);assert(base.engineVersion&&base.policyVersion);for(const k of ['node','platform','arch'])assert(base.environment[k]);assert.deepEqual(base.buildHashes,ctx.receipt.buildHashes);
const report={format:'step5l-current-critical-provenance-review',version:1,sourceCommit:base.sourceCommit,observedHostedApplicationSource:candidate,receipt:audit.receipt,qualification:{path:auditPath,sha256:sha(read(auditPath))},records:{path:recordsPath,sha256:sha(read(recordsPath))},perCaseIndex:{path:indexPath,sha256:sha(read(indexPath))},captures:[...captures].map(([path,sha256])=>({path,sha256,actualApplicationSource:candidate})),checks:{allPassingCriticalEvidenceFieldsPresent:true,noUnrecordedAppliedRoomPlaceholders:true,perCaseMetadataRowsResolved:selectedIDs.size,originalPlaceholderRows:originalGaps.length,additionalCandidateRows:['V429','V513'],currentPassingCriticalRequirements:current.length,observationalUnitPasses:observerPasses,recoveredBrowserCaptures:captures.size,freshBrowserCaptures:0,missingEvidenceBlocksRelease:true},perRequirement,limitations:['Fresh 577-case metadata observer is an actual separate execution; retained browser captures remain original 3ece executions, never retagged as 791 or newly executed.','Index extraction follows only each specific observed command, report group or same-hand dataset. No global union substitutes for per-case inputs.','This is metadata review, not physical-device, human usability, hosted CI, full project-write audit or performance qualification. Unresolved gates remain release-blocking.']};
writeFileSync(`${dir}/provenance-qualified-review.json`,JSON.stringify(report,null,2)+'\n');
