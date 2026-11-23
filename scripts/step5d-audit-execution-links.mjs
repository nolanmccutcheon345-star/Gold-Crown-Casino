/** Fail-closed qualification of effective original R1 acceptance evidence. Never edits statuses. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {at,assertion,verifyBrowser,qualifyBrowserCases} from './step5d-qualify-browser.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}if(quoted)throw Error('Unterminated CSV');const keys=rows.shift();return rows.filter(r=>r.some(Boolean)).map(r=>{if(r.length!==keys.length)throw Error('Bad CSV columns');return Object.fromEntries(keys.map((key,i)=>[key,r[i]]));});}
export function effectivePass(row){return row.r1_blocking==='YES'&&(row.status==='PASS'||(row.status==='NOT_EXECUTED'&&row.r1_gate_basis==='EXPLICIT_MIXED_CASH_COMPONENT'&&row.r1_cash_component_status==='PASS'));}
function safeFile(root,path){if(typeof path!=='string'||!path||path.includes('\0'))throw Error('Invalid evidence path');const full=resolve(root,path),rel=relative(root,full);if(rel.startsWith('..')||rel.startsWith('/'))throw Error('Evidence path escapes checkout');return full;}
export function verifySupplemental(entry,base,{read,exists}){
 const errors=[],fail=message=>errors.push(message);let receipt;
 if(!entry.id||!entry.path||!entry.sha256||!exists(entry.path)||sha(read(entry.path))!==entry.sha256)return{id:entry.id,status:'NOT_QUALIFIED',errors:['Supplemental receipt absent or changed']};
 try{receipt=JSON.parse(read(entry.path));}catch{return{id:entry.id,status:'NOT_QUALIFIED',errors:['Invalid supplemental receipt JSON']};}
 if(receipt.format!=='ai-texas-ci-execution'||receipt.version!==1||receipt.status!=='PASS'||!/^[0-9a-f]{40}$/.test(receipt.sourceCommit??''))fail('Supplemental execution did not pass with full source identity');
 const link=receipt.qualificationBase;
 if(!link?.path||!link.sha256||!exists(link.path)||sha(read(link.path))!==link.sha256)fail('Supplemental compiled base receipt absent or changed');
 else{const actual=JSON.parse(read(link.path));if(actual.status!=='PASS'||actual.sourceCommit!==base.sourceCommit||JSON.stringify(actual.buildHashes)!==JSON.stringify(base.buildHashes)||JSON.stringify(actual.sourceHashes)!==JSON.stringify(base.sourceHashes))fail('Supplemental refers to a different tested base');}
 if(link?.sourceCommit!==base.sourceCommit||link.runtimeMatch!=='EXACT'||link.compiledAssetsMatch!=='EXACT')fail('Supplemental runtime/build agreement not established');
 const runtime=Object.entries(base.sourceHashes??{}).filter(([path])=>path.startsWith('src/'));
 if(!runtime.length||runtime.some(([path,hash])=>receipt.sourceHashes?.[path]!==hash))fail('Supplemental production runtime bytes differ from compiled base');
 if(receipt.engineVersion!==base.engineVersion||receipt.policyVersion!==base.policyVersion)fail('Supplemental engine/policy versions differ');
 if(!receipt.environment?.node||!receipt.environment?.platform||!receipt.environment?.arch||receipt.changedInputs?.length||receipt.dirtyInputs?.length)fail('Supplemental environment or stable source verification missing');
 if(!receipt.checks?.length||receipt.checks.some(check=>check.status!=='PASS'||check.exitCode!==0)||!receipt.checks.some(check=>check.command?.length))fail('Supplemental passing runnable command missing');
 for(const [path,hash]of Object.entries(base.buildHashes??{}))if(!exists(path)||sha(read(path))!==hash)fail(`Supplemental compiled asset differs: ${path}`);
 return{id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,path:entry.path,sha256:entry.sha256,receipt};
}
export function qualify(row,record,receipt,{root=process.cwd(),read=path=>readFileSync(safeFile(root,path)),exists=path=>existsSync(safeFile(root,path)),verifyBuild=true,browsers=[],supplements=[]}={}){
 const errors=[],fail=message=>errors.push(message);
 if(!record)return{status:'NOT_QUALIFIED',errors:['MISSING_QUALIFICATION_RECORD'],executedCases:[]};
 if(record.id!==row.id||record.criterionSha256!==sha(Buffer.from(row.acceptance)))fail('Original criterion identity/hash mismatch');
 if(record.scope!==row.r1_gate_basis)fail('Qualification scope differs from original whole/cash gate basis');
 if(record.coverageReview!=='COMPLETE'||!record.reviewRationale)fail('Complete criterion coverage review is missing');
 if(!['ai-texas-executed-checks','ai-texas-ci-execution'].includes(receipt?.format)||receipt.version!==1)fail('Unsupported execution receipt');
 if(receipt.status!=='PASS')fail('Execution receipt did not pass');
 if(!/^[0-9a-f]{40}$/.test(receipt.sourceCommit??''))fail('Full executed source SHA missing');
 if(!receipt.environment?.node||!receipt.environment?.platform||!receipt.environment?.arch)fail('Execution environment missing');
 if(!receipt.engineVersion||!receipt.policyVersion)fail('Engine or policy version missing');
 if(receipt.changedInputs?.length)fail('Source inputs changed during execution');
 if(!Array.isArray(receipt.checks)||!receipt.checks.some(c=>c.status==='PASS'&&c.exitCode===0&&c.command?.length&&/unit|critical|oracle|release|test/.test(c.name??'')))fail('Passing runnable test command missing');
 if(!record.roomVersions?.length||record.roomVersions.some(x=>typeof x!=='string'||!x.trim()))fail('Explicit applicable rules/profile versions missing');
 if(!record.inputs?.description||!Array.isArray(record.inputs.seeds)||!record.inputs.fixtureFiles?.length)fail('Exact fixture/input/seed declaration missing');
 if(!record.expected||!record.observed)fail('Expected/observed interpretation missing');
 const fixtures=[];
 for(const path of record.inputs?.fixtureFiles??[]){const claimed=record.fixtureHashes?.[path],executed=receipt.sourceHashes?.[path];if(!claimed||claimed!==executed)fail(`Fixture does not match executed receipt: ${path}`);if(!exists(path)||sha(read(path))!==claimed)fail(`Fixture bytes changed or absent: ${path}`);else fixtures.push({path,sha256:claimed});}
 const cases=[];
 const executionFor=requested=>{if(!requested.receipt)return receipt;const selected=supplements.filter(item=>item.id===requested.receipt&&item.status==='QUALIFIED');if(selected.length!==1){fail(`Missing qualified supplemental execution: ${requested.receipt}`);return null;}return selected[0].receipt;};
 if(!record.cases?.length&&!record.browserCases?.length)fail('No explicit executed case identities');
 for(const requested of record.cases??[]){
  const executed=executionFor(requested);if(!executed)continue;
  const suites=requested.suite?(executed.supportingSuites??[]).filter(suite=>suite.name===requested.suite):[{testCases:executed.testCases}];
  if(suites.length!==1){fail(`Missing or ambiguous executed supporting suite: ${requested.suite}`);continue;}
  const matches=(suites[0].testCases??[]).filter(c=>c.file===requested.file&&c.name===requested.name);if(matches.length!==1){fail(`Missing or ambiguous executed case: ${requested.file} :: ${requested.name}`);continue;}const result=matches[0],hash=result.assertionsSourceSHA256??result.testSourceSHA256;
  if(result.status!=='passed'||result.failureMessages?.length)fail(`Case did not pass: ${requested.name}`);
  if(!hash||executed.sourceHashes?.[result.file]!==hash||!exists(result.file)||sha(read(result.file))!==hash)fail(`Case source differs from executed bytes: ${result.file}`);
  cases.push({file:result.file,name:result.name,status:result.status,testSourceSHA256:hash,durationMs:result.durationMs,sourceCommit:executed.sourceCommit,...(requested.suite?{suite:requested.suite}:{}),...(requested.receipt?{receipt:requested.receipt}:{})});
 }
 const reports=[];
 for(const required of record.reports??[]){
  const executed=executionFor(required);if(!executed)continue;
  const ref=required.receiptField?at(executed,required.receiptField):required;
  if(!ref?.path||!ref.sha256||!exists(ref.path)||sha(read(ref.path))!==ref.sha256){fail(`Executed result report bytes absent or changed: ${required.receiptField??required.path}`);continue;}
  let report;try{report=JSON.parse(required.encoding==='gzip-json'?gunzipSync(read(ref.path)):read(ref.path));}catch{fail(`Invalid executed result report: ${ref.path}`);continue;}
  if(report.sourceCommit!==executed.sourceCommit)fail(`Result report source differs from execution: ${ref.path}`);
  if(!required.assertions?.length)fail(`Result report expectations missing: ${ref.path}`);
  const observed=[];for(const claim of required.assertions??[]){const actual=at(report,claim.path);if(!claim.path||!assertion(actual,claim))fail(`Result report assertion failed: ${ref.path}/${claim.path}`);observed.push({claim,actual});}
  reports.push({path:ref.path,sha256:ref.sha256,sourceCommit:report.sourceCommit,observed});
 }
 const browserResult=qualifyBrowserCases(record.browserCases,browsers);browserResult.errors.forEach(fail);
 if(!Object.keys(receipt.buildHashes??{}).length||!receipt.checks?.some(c=>c.name==='build'&&c.status==='PASS'&&c.exitCode===0))fail('Executed compiled artifact receipt missing');
 if(verifyBuild)for(const [path,hash]of Object.entries(receipt.buildHashes??{}))if(!exists(path)||sha(read(path))!==hash)fail(`Compiled artifact bytes changed or absent: ${path}`);
 return{status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,sourceCommit:receipt.sourceCommit,engineVersion:receipt.engineVersion,policyVersion:receipt.policyVersion,roomVersions:record.roomVersions,inputs:record.inputs,expected:record.expected,observed:record.observed,environment:receipt.environment,fixtures,executedCases:cases,executedReports:reports,executedBrowserCases:browserResult.executed};
}
export function audit({root=process.cwd(),receiptPath='TEST_EVIDENCE/step5c/integrated-final-candidate/manifest.json',qualificationPath='tests/step5d-gates/qualifications.json',verifyBuild=true,browserEvidencePath,supplementalEvidencePath}={}){
 const read=p=>readFileSync(safeFile(root,p)),rows=parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),original=JSON.parse(read('docs/specs/acceptance-source.json')),backlog=JSON.parse(read('docs/specs/backlog-source.json')),receipt=JSON.parse(read(receiptPath)),records=JSON.parse(read(qualificationPath));
 const sourceAtCommit=(commit,path)=>{if(!/^[0-9a-f]{40}$/.test(commit))throw Error('Invalid harness commit');safeFile(root,path);return execFileSync('git',['show',`${commit}:${path}`],{cwd:root,maxBuffer:64*1024*1024});};
 const browserInputs=browserEvidencePath?JSON.parse(read(browserEvidencePath)):[],browsers=browserInputs.map(entry=>verifyBrowser(entry,receipt,{read,exists:path=>existsSync(safeFile(root,path)),sourceAtCommit}));
 const supplementalInputs=supplementalEvidencePath?JSON.parse(read(supplementalEvidencePath)):[],supplements=supplementalInputs.map(entry=>verifySupplemental(entry,receipt,{read,exists:path=>existsSync(safeFile(root,path))}));
 if(rows.length!==302||new Set(rows.map(r=>r.id)).size!==302||backlog.length!==86)throw Error('Original register cardinality changed');
 for(const spec of original){const row=rows.find(r=>r.id===spec.id);for(const[k,v]of Object.entries(spec))if(row?.[k]!==v)throw Error(`Original criterion changed: ${spec.id}.${k}`);}
 if(records.version!==1||!Array.isArray(records.requirements)||new Set(records.requirements.map(r=>r.id)).size!==records.requirements.length)throw Error('Invalid/duplicate qualification records');
 for(const record of records.requirements)if(!rows.some(r=>r.id===record.id))throw Error(`Invented qualification ID: ${record.id}`);
 const paths=text=>[...String(text).matchAll(/(?:tests|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|mjs|py)/g)].map(m=>m[0]);
 const resultRows=rows.map(row=>{
  const needed=effectivePass(row),record=records.requirements.find(r=>r.id===row.id),explicit=new Set(paths(row.supporting_test_cases+' '+row.candidate_test_files));
  for(const ref of row.evidence.split(';').map(p=>p.trim()).filter(Boolean)){if(existsSync(safeFile(root,ref))&&ref.endsWith('.json')){const bytes=read(ref);if(bytes.length<1_000_000)for(const p of paths(bytes.toString()))explicit.add(p);}}
  const token=new RegExp(`(^|[^A-Za-z0-9])${row.id}([^A-Za-z0-9]|$)`),linked=(receipt.testCases??[]).filter(c=>token.test(c.name)||explicit.has(c.file)).map(c=>({file:c.file,name:c.name,status:c.status,association:token.test(c.name)?'EXACT_ORIGINAL_ID_IN_EXECUTED_CASE':'EXISTING_EXPLICIT_SOURCE_REFERENCE'}));
  return{id:row.id,title:row.title,criterion:row.acceptance,originalStatus:row.status,gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status,effectiveCriticalPass:needed,linkedCases:linked,qualification:needed?qualify(row,record,receipt,{root,verifyBuild,browsers,supplements}):{status:'NOT_REQUIRED_FOR_CURRENT_NONPASS',errors:[]},nextAction:row.next_action};
 });
 const qualified=resultRows.filter(r=>r.effectiveCriticalPass&&r.qualification.status==='QUALIFIED'),unqualified=resultRows.filter(r=>r.effectiveCriticalPass&&r.qualification.status!=='QUALIFIED');
 return{format:'step5d-original-execution-qualification',version:1,at:new Date().toISOString(),receipt:{path:receiptPath,sha256:sha(read(receiptPath)),sourceCommit:receipt.sourceCommit,status:receipt.status},qualificationSource:{path:qualificationPath,sha256:sha(read(qualificationPath))},verifyBuild,originalRequirements:302,deferredFeatures:86,originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(status=>[status,rows.filter(r=>r.status===status).length])),effectiveCriticalPassCount:qualified.length+unqualified.length,executionLinkedCount:resultRows.filter(r=>r.effectiveCriticalPass&&r.linkedCases.length).length,qualifiedCount:qualified.length,unqualifiedIds:unqualified.map(r=>r.id),decision:unqualified.length||!verifyBuild?'NOT_READY_FOR_R1':'EVIDENCE_QUALIFICATION_PASSED_OTHER_RELEASE_GATES_STILL_REQUIRED',limitations:['An exact-ID/file association is an audit lead, not complete criterion qualification.','No status, original criterion or release scope is rewritten.','A qualifier references an actual executed receipt; current hashes cannot fabricate a past execution.','Missing room/input/expected-observed qualification blocks evidence release even if all tests pass.', 'If verifyBuild is false, qualifiedCount describes metadata only; release remains blocked regardless of count.','This command runs no poker, browser, physical-device, screen-reader, human or hosted-CI test.'],requirements:resultRows};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const args=process.argv.slice(2),option=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
 const output=option('--output','tests/step5d-gates/evidence/execution-links.json'),report=audit({receiptPath:option('--receipt',undefined),qualificationPath:option('--qualifications',undefined),browserEvidencePath:option('--browser-evidence',undefined),supplementalEvidencePath:option('--supplemental-evidence',undefined),verifyBuild:!args.includes('--no-build-bytes')});mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,requirements:report.originalRequirements,effectiveCriticalPassCount:report.effectiveCriticalPassCount,executionLinkedCount:report.executionLinkedCount,qualifiedCount:report.qualifiedCount,unqualifiedIds:report.unqualifiedIds,decision:report.decision},null,2));if(args.includes('--enforce')&&report.decision==='NOT_READY_FOR_R1')process.exitCode=1;
}
