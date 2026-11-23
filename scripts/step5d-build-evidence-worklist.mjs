/** Review queue only. Never promotes an original acceptance status. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {parseCsv,effectivePass} from './step5d-audit-execution-links.mjs';

const source=readFileSync('ACCEPTANCE_STATUS.csv'),rows=parseCsv(source.toString());
const qualifications=JSON.parse(readFileSync('tests/step5d-gates/qualifications.json'));
const audit=JSON.parse(readFileSync('tests/step5d-gates/evidence/execution-links.json'));
const reviewed=new Set(qualifications.requirements.map(row=>row.id));
const missing=rows.filter(row=>effectivePass(row)&&!reviewed.has(row.id)).map(row=>{
 const linked=audit.requirements.find(item=>item.id===row.id)?.linkedCases??[];
 const refs=[row.supporting_test_cases,row.candidate_test_files].filter(Boolean).join('; ');
 const browserHint=refs.includes('tests/browser/')||/\bUI\b|on-screen|screen reader|visible|touch|browser|display/i.test(row.acceptance);
 const category=row.id==='D04'?'NEW_EXECUTED_FIXTURE_AWAITS_FINAL_RECEIPT':browserHint?'BROWSER_OR_DISPLAY_EVIDENCE_REVIEW':linked.length?'EXECUTED_CASE_SEMANTIC_REVIEW':'MISSING_EXECUTION_LINK';
 const nextAction=row.id==='D04'?'Use the final candidate receipt for tests/step5d-gates/mechanical-gaps.test.ts; the new exact fixture passed locally and is absent from the old integrated receipt.':browserHint?'Inspect actual browser/runtime assertions and receipt provenance against every clause. Node-only computation or generated markup cannot prove physical interaction/display. Do not infer PASS from a candidate filename.':linked.length?'Read the exact named test assertions and fixtures; establish complete original-criterion coverage and explicit rules/input/expected-observed provenance before adding a qualification.':'Locate an actual executed case and its source/build/environment receipt, or implement and execute the exact missing fixture. A stale or nonexistent candidate path is not evidence.';
 return {id:row.id,title:row.title,originalCriterion:row.acceptance,originalStatus:row.status,gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status,category,classificationBasis:'Triage based on explicit references and criterion wording; not a new acceptance outcome.',linkedCaseCount:linked.length,existingReferences:refs,owner:category==='BROWSER_OR_DISPLAY_EVIDENCE_REVIEW'?'Browser/evidence integration':'Original-criterion verification',nextAction};
});
const groups=Object.fromEntries([...new Set(missing.map(row=>row.category))].map(category=>[category,missing.filter(row=>row.category===category).map(row=>row.id)]));
const report={format:'step5d-unqualified-original-evidence-worklist',version:1,sourceRegisterSHA256:createHash('sha256').update(source).digest('hex'),originalRequirements:rows.length,deferredFeatures:JSON.parse(readFileSync('docs/specs/backlog-source.json')).length,reviewedQualificationRecords:reviewed.size,missingRecords:missing.length,sourceReceipt:audit.receipt,limitations:['This is an actionable review queue, not new original failures or a claim that every linked case fully covers its criterion.','The prior metadata audit omitted local compiled-byte verification; strict candidate audit is still required.','Runtime-generated room hashes are not enumerated per case in the prior global receipt.','Browser/device, screen-reader, hosted-CI and human evidence cannot be inferred from unit suite counts.'],groups,requirements:missing};
writeFileSync('tests/step5d-gates/REMAINING_EVIDENCE_WORK.json',JSON.stringify(report,null,2)+'\n');
const escape=text=>text.replaceAll('|','\\|').replaceAll('\n',' ');
writeFileSync('tests/step5d-gates/REMAINING_EVIDENCE_WORK.md',`# Step5D remaining original-ID evidence work\n\n${reviewed.size} original requirement records have reviewed metadata; ${missing.length} effective critical PASS rows still need qualification. These are evidence gaps under Z12/V620, not ${missing.length} newly failed product requirements. The canonical register is unchanged.\n\nThe categories below are triage hints. Each original criterion must still be reviewed in full. A filename or green suite count is not whole-criterion evidence. Runtime configuration hashes, exact build bytes and actual browser assertions remain necessary where applicable.\n\n| Category | IDs |\n|---|---|\n${Object.entries(groups).map(([category,ids])=>`| ${category} | ${ids.join(', ')} |`).join('\n')}\n\n| Original ID | Original criterion | Next action |\n|---|---|---|\n${missing.map(row=>`| ${row.id} | ${escape(row.originalCriterion)} | ${escape(row.nextAction)} |`).join('\n')}\n`);
console.log(JSON.stringify({reviewed:reviewed.size,missing:missing.length,groups:Object.fromEntries(Object.entries(groups).map(([key,value])=>[key,value.length]))}));
if(rows.length!==302||report.deferredFeatures!==86)process.exitCode=1;
