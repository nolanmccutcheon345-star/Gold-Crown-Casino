/** Read-only release view. Original status, current qualified evidence and automated
 * test counts remain separate universes. This command never runs a test or edits CSV. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {sha,isRuntimeInput} from './step5d-ci-plan.mjs';
import {parseCsv,effectivePass} from './step5d-audit-execution-links.mjs';

export const mandatoryIds=['U10','U11','U16','Z02','Z12','V513','V518','V522','V620','V707'];
export function composeReleaseStatus({rows,original,backlog,candidateReceipt,qualifiedAudit,candidateVerified=false}){
 assert.equal(rows.length,302,'Original register must contain302 IDs');assert.equal(new Set(rows.map(r=>r.id)).size,302,'Duplicate original requirement ID');assert.equal(original.length,302);assert.equal(backlog.length,86,'All86 deferred features required');assert.equal(new Set(backlog.map(item=>item.id)).size,86,'Duplicate deferred feature ID');
 const byId=new Map(rows.map(row=>[row.id,row]));
 for(const source of original)for(const [key,value]of Object.entries(source))assert.equal(byId.get(source.id)?.[key],value,`Original criterion changed: ${source.id}.${key}`);
 const errors=[];
 if(!candidateReceipt||!candidateVerified)errors.push('No verified current candidate execution/build receipt');
 if(!qualifiedAudit)errors.push('No current per-criterion qualification audit');
 else{
  if(qualifiedAudit.originalRequirements!==302||qualifiedAudit.deferredFeatures!==86)errors.push('Qualification audit cardinality differs');
  if(!qualifiedAudit.verifyBuild)errors.push('Qualification audit did not verify compiled bytes');
  if(!candidateReceipt||qualifiedAudit.receipt?.sourceCommit!==candidateReceipt.sourceCommit)errors.push('Qualification audit is for a different source commit');
  if(qualifiedAudit.requirements?.length!==302||new Set((qualifiedAudit.requirements??[]).map(r=>r.id)).size!==302)errors.push('Qualification audit does not cover the complete original-ID universe');
  for(const item of qualifiedAudit.requirements??[]){const row=byId.get(item.id);if(!row||item.criterion!==row.acceptance||item.originalStatus!==row.status||item.gateBasis!==row.r1_gate_basis||item.cashComponentStatus!==(row.r1_cash_component_status??''))errors.push(`Qualification audit differs from current original row: ${item.id}`);}
  const actualQualified=(qualifiedAudit.requirements??[]).filter(r=>r.effectiveCriticalPass&&r.qualification?.status==='QUALIFIED');
  if(actualQualified.length!==qualifiedAudit.qualifiedCount)errors.push('Qualification summary count differs from actual per-ID results');
 }
 const usable=errors.length===0,records=rows.map(row=>{
  const evidence=usable?qualifiedAudit.requirements.find(r=>r.id===row.id):null;
  const required=row.r1_blocking==='YES';
  return{id:row.id,title:row.title,originalCriterion:row.acceptance,criterionSha256:sha(row.acceptance),originalStatus:row.status,releaseScope:row.release_scope,priority:row.release_priority??row.priority??'',r1Critical:required,gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status??'',effectiveOriginalPass:effectivePass(row),candidateQualification:required?(evidence?.qualification?.status??'NOT_EXECUTED'):'NOT_REQUIRED_FOR_R1',candidateErrors:evidence?.qualification?.errors??[],candidateEvidence:usable?{receipt:qualifiedAudit.receipt,sourceCommit:qualifiedAudit.receipt.sourceCommit,cases:evidence?.qualification?.executedCases??[],browserCases:evidence?.qualification?.executedBrowserCases??[]}:null,priorEvidence:row.evidence,observedDefect:row.observed_defect??'',owner:row.owner??'',nextAction:row.next_action??'',mandatoryOpenAtStep5D:mandatoryIds.includes(row.id)};
 });
 const critical=records.filter(r=>r.r1Critical),unresolvedOriginal=critical.filter(r=>!r.effectiveOriginalPass),unqualified=critical.filter(r=>r.candidateQualification!=='QUALIFIED');
 const decision=errors.length||unresolvedOriginal.length||unqualified.length?'NOT_READY_FOR_R1':'READY_FOR_R1';
 return{format:'step5e-id-preserving-release-status',version:1,originalRequirements:302,deferredFeatures:86,originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(row=>row.status===s).length])),r1CriticalOriginalCount:critical.length,effectiveOriginalPassCount:critical.filter(r=>r.effectiveOriginalPass).length,currentCandidateQualifiedCount:critical.filter(r=>r.candidateQualification==='QUALIFIED').length,automatedTestCounts:candidateVerified?candidateReceipt?.testCounts??null:null,candidateSource:candidateVerified?candidateReceipt?.sourceCommit??null:null,qualificationUsable:usable,qualificationErrors:errors,unresolvedOriginalIds:unresolvedOriginal.map(r=>r.id),unqualifiedCriticalIds:unqualified.map(r=>r.id),mandatoryGateOutcomes:records.filter(r=>mandatoryIds.includes(r.id)),requirements:records,decision,limitations:['No acceptance status is changed by this read-only generator.','No test/browser/device/human/hosted-CI/deployment runs in this command.','Unmapped automated cases are never promoted to original acceptance PASS.','An old source audit cannot certify a new candidate. Missing/partial proof blocks release.','A whole mixed criterion remains NOT_EXECUTED while only an explicitly authorized cash component passes.']};
}

export function verifyCurrentCandidate(receipt,{read,exists,sourceAtCommit}){
 const errors=[];
 if(receipt?.format!=='ai-texas-ci-execution'||receipt.version!==1||receipt.status!=='PASS'||!/^[a-f0-9]{40}$/.test(receipt.sourceCommit??''))return['Candidate receipt is not a passing source-bound execution'];
 if(receipt.dirtyInputs?.length||receipt.changedInputs?.length||receipt.sourceCommitAtEnd!==receipt.sourceCommit)errors.push('Candidate source was dirty/changed or final commit differs');
 for(const field of ['node','platform','arch'])if(!receipt.environment?.[field])errors.push(`Candidate environment missing:${field}`);
 if(!receipt.engineVersion||!receipt.policyVersion)errors.push('Candidate engine/policy version missing');
 if(!receipt.checks?.some(c=>c.name==='build'&&c.status==='PASS'&&c.exitCode===0&&c.command?.length)||!receipt.checks?.some(c=>/tests|unit|critical|release/.test(c.name??'')&&c.status==='PASS'&&c.exitCode===0&&c.command?.length))errors.push('Candidate did not execute passing build and tests');
 if(receipt.checks?.some(c=>c.status!=='PASS'||c.exitCode!==0))errors.push('Candidate has failed execution checks');
 if(!Object.keys(receipt.sourceHashes??{}).length)errors.push('Candidate source inventory missing');
 for(const [path,hash]of Object.entries(receipt.sourceHashes??{})){
  try{if(sha(sourceAtCommit(receipt.sourceCommit,path))!==hash)errors.push(`Executed source differs from Git object:${path}`);}catch{errors.push(`Executed source unavailable:${path}`);}
  // Later QA/source-qualification may legitimately follow a frozen runtime.
  // Its original inputs still must match Git; explicit criterion assertion
  // files are checked separately by qualify(), never retroactively executed.
  if(isRuntimeInput(path)&&(!exists(path)||sha(read(path))!==hash))errors.push(`Current candidate runtime input differs:${path}`);
 }
 if(!Object.keys(receipt.buildHashes??{}).length)errors.push('Candidate compiled artifact inventory missing');
 for(const [path,hash]of Object.entries(receipt.buildHashes??{}))if(!exists(path)||sha(read(path))!==hash)errors.push(`Current compiled artifact differs:${path}`);
 if(!receipt.testCases?.length||receipt.testCases.some(c=>{const actual=c.testSourceSHA256??c.assertionsSourceSHA256;return c.status!=='passed'||c.failureMessages?.length||!/^[a-f0-9]{64}$/.test(actual??'')||receipt.sourceHashes?.[c.file]!==actual;}))errors.push('Candidate test cases lack passed exact assertion-source identity');
 return errors;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const args=process.argv.slice(2),option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
 const root=process.cwd(),read=path=>{const full=resolve(root,path),rel=relative(root,full);assert(rel&&!rel.startsWith('..')&&!rel.startsWith('/'),'Evidence path escapes checkout');return readFileSync(full);};
 const receiptPath=option('--candidate-receipt',null),auditPath=option('--qualification-audit',null),receipt=receiptPath?JSON.parse(read(receiptPath)):null,audit=auditPath?JSON.parse(read(auditPath)):null;
 const sourceAtCommit=(commit,path)=>{assert(/^[a-f0-9]{40}$/.test(commit)&&!path.startsWith('/')&&!path.split('/').includes('..'));return execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:64*1024*1024});};
 const verification=receipt?verifyCurrentCandidate(receipt,{read,exists:existsSync,sourceAtCommit}):['No candidate receipt supplied'];
 if(audit&&receiptPath&&audit.receipt?.sha256!==sha(read(receiptPath)))verification.push('Audit references different receipt bytes');
 const report=composeReleaseStatus({rows:parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),original:JSON.parse(read('docs/specs/acceptance-source.json')),backlog:JSON.parse(read('docs/specs/backlog-source.json')),candidateReceipt:receipt,qualifiedAudit:audit,candidateVerified:verification.length===0});
 Object.assign(report,{at:new Date().toISOString(),generatorSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),registerSHA256:sha(read('ACCEPTANCE_STATUS.csv')),candidateReceipt:receiptPath?{path:receiptPath,sha256:sha(read(receiptPath))}:null,qualificationAudit:auditPath?{path:auditPath,sha256:sha(read(auditPath))}:null,candidateVerificationErrors:verification});
 const output=option('--output','tests/step5e-gates/evidence/current-status.json');assert(output.startsWith('tests/step5e-gates/evidence/')&&!output.includes('..'),'Use Step5E evidence output');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const columns=['id','originalStatus','releaseScope','r1Critical','gateBasis','cashComponentStatus','candidateQualification','nextAction'],csv=value=>'"'+String(value??'').replaceAll('"','""')+'"';writeFileSync(output.replace(/\.json$/,'.csv'),[columns.map(csv).join(','),...report.requirements.map(row=>columns.map(key=>csv(row[key])).join(','))].join('\n')+'\n');
 console.log(JSON.stringify({output,originalRequirements:302,deferredFeatures:86,originalStatusCounts:report.originalStatusCounts,candidateQualified:report.currentCandidateQualifiedCount,unresolvedOriginalIds:report.unresolvedOriginalIds,candidateVerificationErrors:verification,decision:report.decision},null,2));if(args.includes('--enforce')&&report.decision!=='READY_FOR_R1')process.exitCode=1;
}
