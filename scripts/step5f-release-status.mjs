/** Read-only Step5F qualification boundary. A fresh test pass is not an original
 * acceptance pass. This snapshot never retags Step5E evidence or edits registers. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {sha} from './step5d-ci-plan.mjs';
import {parseCsv} from './step5d-audit-execution-links.mjs';
import {verifyCurrentCandidate} from './step5e-release-status.mjs';

export const GATE_NEXT_ACTIONS={
 U10:'Execute the original core-action workflow with a named real screen reader and browser; record spoken announcements and keyboard/focus results.',
 U11:'Execute declared physical phone/desktop performance measurements; emulation and controller-only timings remain separate.',
 U16:'Obtain provider historical write-call evidence proving the unique project and unchanged original sites; local identity files alone are incomplete.',
 Z02:'Retain project-isolation audit, then signed-off deployment SHA and actual smoke only after every mandatory release gate passes.',
 Z14:'Requalify the complete authorized cash conjunction: actual 2/6/10-seat notes/replay/session flows, privacy, keyboard/touch geometry, bounded storage and matched performance without an unexplained regression. Deferred favorites/bookmarks keep the whole original criterion NOT_EXECUTED.',
 V518:'Run the declared physical reference-device matrix and real screen reader; retain measured response/render/memory/action-error results separately from emulation.',
 V522:'BLOCKED pending the user’s future GitHub connection. Continue local development and tests now; after connection, execute the candidate on the hosted runner and retain provider run/log/artifact identities and blocking-check evidence.',
 V707:'Observe three independent new users completing25hands each; retain actual comprehension, misclick and ambiguity records.'
};

export function composeStep5FStatus({rows,original,backlog,baselineAudit,candidateReceipt=null,candidateVerified=false,candidateErrors=[],sourceCommit,artifactReferences={}}){
 assert.equal(rows.length,302);assert.equal(new Set(rows.map(r=>r.id)).size,302);
 assert.equal(original.length,302);assert.equal(new Set(original.map(r=>r.id)).size,302);
 assert.equal(backlog.length,86);assert.equal(new Set(backlog.map(r=>r.id)).size,86);
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const item of original)for(const [key,value]of Object.entries(item))assert.equal(byId.get(item.id)?.[key],value,`Original criterion changed:${item.id}.${key}`);
 assert.equal(baselineAudit.originalRequirements,302);assert.equal(baselineAudit.deferredFeatures,86);
 assert.equal(baselineAudit.requirements.length,302);assert.equal(new Set(baselineAudit.requirements.map(r=>r.id)).size,302);
 const baselineById=new Map(baselineAudit.requirements.map(r=>[r.id,r]));
 for(const row of rows){const old=baselineById.get(row.id);assert(old,`Missing historical ID:${row.id}`);assert.equal(old.criterion,row.acceptance);assert(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].includes(row.status),`Invalid current original status:${row.id}`);assert.equal(old.gateBasis,row.r1_gate_basis);assert.equal(old.cashComponentStatus,row.r1_cash_component_status??'');}
 const critical=rows.filter(r=>r.r1_blocking==='YES'),historicalQualified=critical.filter(r=>baselineById.get(r.id).qualification.status==='QUALIFIED');
 assert.equal(historicalQualified.length,baselineAudit.qualifiedCount,'Historical count is inconsistent with original IDs');
 const historicalUnresolved=critical.filter(r=>baselineById.get(r.id).qualification.status!=='QUALIFIED').map(r=>r.id);
 const receiptVerified=!!candidateReceipt&&candidateVerified&&candidateErrors.length===0;
 const requirements=rows.map(row=>({
  id:row.id,title:row.title,originalCriterion:row.acceptance,criterionSha256:sha(row.acceptance),originalStatus:row.status,
  releaseScope:row.release_scope,r1Critical:row.r1_blocking==='YES',gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status??'',
  historicalQualification:{status:baselineById.get(row.id).qualification.status,originalStatus:baselineById.get(row.id).originalStatus,sourceCommit:baselineAudit.receipt.sourceCommit,evidence:artifactReferences.baselineAudit??null},
  candidateQualification:row.r1_blocking==='YES'?'NOT_QUALIFIED':'NOT_REQUIRED_FOR_R1',
  candidateReason:row.r1_blocking==='YES'?'Fresh complete criterion-level qualification has not been produced. Executed suite results below do not automatically qualify this original requirement.':'Assigned later/nonblocking scope is retained.',
  nextAction:GATE_NEXT_ACTIONS[row.id]??(row.r1_blocking==='YES'?'Map fresh exact-source tests/browser/report evidence to the unchanged full criterion, review all clauses and applicable policy/rules inputs, then run the independent qualifier.':row.next_action),
  priorEvidence:row.evidence,supportingTestCases:row.supporting_test_cases,owner:row.owner??''
 }));
 return {
  format:'ai-texas-step5f-release-status',version:1,generatorSourceCommit:sourceCommit,originalRequirements:302,deferredFeatures:86,
  originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length])),
  statusChangesSinceHistoricalSnapshot:rows.filter(row=>baselineById.get(row.id).originalStatus!==row.status).map(row=>({id:row.id,from:baselineById.get(row.id).originalStatus,to:row.status,evidence:row.evidence,nextAction:row.next_action})),
  historicalSnapshot:{sourceCommit:baselineAudit.receipt.sourceCommit,evidence:artifactReferences.baselineAudit??null,r1CriticalOriginalCount:critical.length,qualifiedCount:historicalQualified.length,unresolvedOriginalIds:historicalUnresolved,currentCandidateClaim:false},
  currentCandidate:{sourceCommit:candidateReceipt?.sourceCommit??null,receipt:artifactReferences.candidateReceipt??null,receiptVerified,verificationErrors:candidateReceipt?(candidateErrors.length?candidateErrors:candidateVerified?[]:['Candidate receipt has not been independently verified']):['No fresh candidate execution receipt supplied'],executedTestCounts:receiptVerified?candidateReceipt.testCounts:null,executedCheckResults:receiptVerified?candidateReceipt.checks:null,supportingSuites:receiptVerified?(candidateReceipt.supportingSuites??[]).map(s=>({name:s.name,testCounts:s.testCounts??null,sourceCommit:s.sourceCommit??candidateReceipt.sourceCommit})):[],compiledArtifacts:receiptVerified?candidateReceipt.buildHashes:null,engineVersion:receiptVerified?candidateReceipt.engineVersion:null,availablePolicyVersion:receiptVerified?candidateReceipt.policyVersion:null,environment:receiptVerified?candidateReceipt.environment:null,qualifiedOriginalRequirementCount:0,unqualifiedCriticalOriginalIds:critical.map(r=>r.id),qualificationState:'PENDING_FRESH_CRITERION_LEVEL_REVIEW'},
  knownUnresolvedMandatoryGates:requirements.filter(r=>historicalUnresolved.includes(r.id)),requirements,
  deferredFeatureRegistry:{evidence:artifactReferences.backlog??null,ids:backlog.map(f=>f.id),count:86},
  decision:'NOT_READY_FOR_R1',publishedVersion:'NOT_QUERIED_BY_THIS_COMMAND',deploymentPerformed:false,
  limitations:['The original302-ID register remains the sole source of original statuses and release scope. No canonical record is edited.','Historical229/237 is shown only when verified from the frozen Step5E snapshot; it never describes Step5F runtime coverage.','The eight known baseline blockers are not a claim that every other new-candidate requirement has already been requalified. All fresh critical qualification remains pending.','Executed automated test counts are separate from original acceptance requirements. This generator executes no poker, browser, hostedCI, physical-device, screen-reader or human-user test.','Available current policy version is not a claim about every historical applied policy. Exact per-case provenance belongs in the future criterion-level audit.','Mixed whole criteria, including V706 and Z14, retain their original NOT_EXECUTED status even if an explicitly authorized cash component previously passed.','No publication or readiness is authorized by this snapshot.'],artifactReferences
 };
}

export function renderStep5FMarkdown(report){
 const cell=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' '),h=report.historicalSnapshot,c=report.currentCandidate;
 const lines=['# Step5F release evidence snapshot','','**NOT READY FOR R1.** This is a read-only evidence boundary, not a release approval.','','Original statuses: '+Object.entries(report.originalStatusCounts).map(([k,v])=>`${v} ${k}`).join(', ')+'. All302original IDs and86deferred IDs are preserved.','',`Historical Step5E qualification: **${h.qualifiedCount}/${h.r1CriticalOriginalCount}**, source \`${h.sourceCommit}\`. This is not Step5F coverage.`, '',`Fresh candidate source: \`${c.sourceCommit??'NOT_SUPPLIED'}\`; execution/build receipt ${c.receiptVerified?'VERIFIED':'NOT_VERIFIED'}. Fresh criterion-level mappings have not been imported into this snapshot. **${h.qualifiedCount}/${h.r1CriticalOriginalCount} historical qualifications remain preserved**; this generator does not carry them forward automatically or report ${c.unqualifiedCriticalOriginalIds.length} new failures.`,`Executed automated counts: \`${JSON.stringify(c.executedTestCounts)}\`. These are test cases, not passed original requirements.`,'','## Known unresolved mandatory gates retained from the historical audit','','| Original ID | Exact original criterion | Original status | Required evidence |','|---|---|---|---|',...report.knownUnresolvedMandatoryGates.map(r=>`| ${r.id} | ${cell(r.originalCriterion)} | ${r.originalStatus} | ${cell(r.nextAction)} |`),'','## All original302requirements','','| Original ID | Exact criterion | Original status | Release scope | Cash component | Step5E historical qualification | Step5F qualification |','|---|---|---|---|---|---|---|',...report.requirements.map(r=>`| ${r.id} | ${cell(r.originalCriterion)} | ${r.originalStatus} | ${cell(r.releaseScope)} | ${cell(r.cashComponentStatus)} | ${r.historicalQualification.status} | ${r.candidateQualification} |`),'','## Evidence boundaries','',...report.limitations.map(x=>'- '+x),'','Evidence references and full executed check receipts are retained in the adjacent JSON file. No site publication was attempted.',''];
 return lines.join('\n');
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const args=process.argv.slice(2),option=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];},root=process.cwd();
 const safe=p=>{assert(typeof p==='string'&&p&&!p.includes('\0'));const full=resolve(root,p),rel=relative(root,full).replaceAll('\\','/');assert(rel&&!rel.startsWith('../')&&!rel.startsWith('/'),'Path escapes repository');return{full,rel};};
 const read=p=>readFileSync(safe(p).full),json=p=>JSON.parse(read(p)),ref=p=>({path:safe(p).rel,sha256:sha(read(p))});
 const baselinePath=option('--baseline-audit','tests/step5e-gates/evidence/draftfix/current-qualification.json'),receiptPath=option('--candidate-receipt',null),receipt=receiptPath?json(receiptPath):null;
 const sourceAtCommit=(commit,path)=>{assert(/^[a-f0-9]{40}$/.test(commit));safe(path);return execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:64*1024*1024});};
 const errors=receipt?verifyCurrentCandidate(receipt,{read,exists:p=>existsSync(safe(p).full),sourceAtCommit}):[];
 const report=composeStep5FStatus({rows:parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),original:json('docs/specs/acceptance-source.json'),backlog:json('docs/specs/backlog-source.json'),baselineAudit:json(baselinePath),candidateReceipt:receipt,candidateVerified:!!receipt&&errors.length===0,candidateErrors:errors,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),artifactReferences:{register:ref('ACCEPTANCE_STATUS.csv'),original:ref('docs/specs/acceptance-source.json'),backlog:ref('docs/specs/backlog-source.json'),baselineAudit:ref(baselinePath),candidateReceipt:receiptPath?ref(receiptPath):null}});
 const output=safe(option('--output','tests/step5f-ci/evidence/release-status.json'));assert(output.rel.startsWith('tests/step5f-ci/evidence/')||output.rel.startsWith('TEST_EVIDENCE/step5f/'),'Use a Step5F evidence output');assert(output.rel.endsWith('.json'));
 const markdown=output.full.replace(/\.json$/,'.md');assert(!existsSync(output.full)&&!existsSync(markdown),'Never overwrite a retained evidence snapshot');mkdirSync(dirname(output.full),{recursive:true});
 writeFileSync(output.full,JSON.stringify(report,null,2)+'\n');writeFileSync(markdown,renderStep5FMarkdown(report));
 console.log(JSON.stringify({output:output.rel,originalStatusCounts:report.originalStatusCounts,historicalQualified:report.historicalSnapshot.qualifiedCount,knownUnresolved:report.historicalSnapshot.unresolvedOriginalIds,freshReceiptVerified:report.currentCandidate.receiptVerified,freshQualifiedOriginalRequirements:0,decision:report.decision},null,2));
 if(args.includes('--enforce'))process.exitCode=1;
}
