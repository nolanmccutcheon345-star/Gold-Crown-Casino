import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';

const setup=String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {composeReleaseStatus,verifyCurrentCandidate} from './scripts/step5e-release-status.mjs';
import {parseCsv,effectivePass} from './scripts/step5d-audit-execution-links.mjs';
const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8')),original=JSON.parse(readFileSync('docs/specs/acceptance-source.json')),backlog=JSON.parse(readFileSync('docs/specs/backlog-source.json'));
// Explicit synthetic status fixture: do not make this contract depend on later
// real acceptance promotions such as an actually verified V513 tab closure.
for(const id of ['U10','U11','U16','Z02','Z12','V513','V518','V522','V620','V707'])rows.find(row=>row.id===id).status='NOT_EXECUTED';
const before=JSON.stringify(rows),hash=value=>createHash('sha256').update(value).digest('hex');
const files={'src/main.ts':'runtime','tests/example.test.ts':'actual assertions','dist/index.html':'compiled output'};
const sourceHashes=Object.fromEntries(['src/main.ts','tests/example.test.ts'].map(path=>[path,hash(files[path])]));
const candidate={format:'ai-texas-ci-execution',version:1,status:'PASS',sourceCommit:'a'.repeat(40),sourceCommitAtEnd:'a'.repeat(40),environment:{node:'contract',platform:'contract',arch:'contract'},sourceHashes,buildHashes:{'dist/index.html':hash(files['dist/index.html'])},engineVersion:'fixture',policyVersion:'fixture',dirtyInputs:[],changedInputs:[],checks:[{name:'tests',command:['synthetic fixture'],status:'PASS',exitCode:0},{name:'build',command:['synthetic fixture'],status:'PASS',exitCode:0}],testCounts:{total:999999,passed:999999,failed:0,skipped:0},testCases:[{file:'tests/example.test.ts',name:'contract',status:'passed',testSourceSHA256:sourceHashes['tests/example.test.ts'],failureMessages:[]}]};
const audit={originalRequirements:302,deferredFeatures:86,verifyBuild:true,receipt:{sourceCommit:candidate.sourceCommit},qualifiedCount:rows.filter(effectivePass).length,requirements:rows.map(row=>({id:row.id,criterion:row.acceptance,originalStatus:row.status,gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status??'',effectiveCriticalPass:effectivePass(row),qualification:{status:effectivePass(row)?'QUALIFIED':'NOT_REQUIRED_FOR_CURRENT_NONPASS',errors:[]}}))};
const options={read:path=>Buffer.from(files[path]),exists:path=>Object.hasOwn(files,path),sourceAtCommit:(_commit,path)=>Buffer.from(files[path])};
`;
function run(body:string){const result=spawnSync(process.execPath,['--input-type=module','-e',setup+'\n'+body],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);}
describe('Step5E release status distinguishes canonical IDs, actual candidate qualification and test counts',()=>{
 it('preserves302/86 and refuses release despite large synthetic suite count with ten explicitly unexecuted fixture gates',()=>{
  const r=run(`const result=composeReleaseStatus({rows,original,backlog,candidateReceipt:candidate,qualifiedAudit:audit,candidateVerified:true});console.log(JSON.stringify({result,unchanged:before===JSON.stringify(rows)}));`);
  expect(r.unchanged).toBe(true);expect(r.result.originalRequirements).toBe(302);expect(r.result.deferredFeatures).toBe(86);expect(r.result.currentCandidateQualifiedCount).toBe(227);expect(r.result.automatedTestCounts.passed).toBe(999999);expect(r.result.unresolvedOriginalIds).toEqual(['U10','U11','U16','Z02','Z12','V513','V518','V522','V620','V707']);expect(r.result.decision).toBe('NOT_READY_FOR_R1');
 });
 it('keeps whole V706 NOT_EXECUTED distinct from its explicitly allowed cash component',()=>{const r=run(`console.log(JSON.stringify(composeReleaseStatus({rows,original,backlog,candidateReceipt:candidate,qualifiedAudit:audit,candidateVerified:true}).requirements.find(r=>r.id==='V706')));`);expect(r.originalStatus).toBe('NOT_EXECUTED');expect(r.cashComponentStatus).toBe('PASS');expect(r.effectiveOriginalPass).toBe(true);});
 it('leaves every current-candidate check unexecuted when no executed candidate/audit is supplied',()=>{const r=run('console.log(JSON.stringify(composeReleaseStatus({rows,original,backlog})));');expect(r.currentCandidateQualifiedCount).toBe(0);expect(r.automatedTestCounts).toBeNull();expect(r.decision).toBe('NOT_READY_FOR_R1');});
 it.each([
  ['old audit source','audit.receipt.sourceCommit="b".repeat(40);','different source commit'],
  ['metadata-only audit','audit.verifyBuild=false;','did not verify compiled bytes'],
  ['missing original ID','audit.requirements.pop();','complete original-ID universe'],
  ['invented audit ID','audit.requirements[0].id="FAKE001";','differs from current original row'],
  ['changed criterion','audit.requirements[0].criterion="weakened";','differs from current original row'],
  ['inflated qualified count','audit.qualifiedCount++;','summary count differs'],
  ['stale canonical status','audit.requirements[0].originalStatus="FAIL";','differs from current original row'],
 ])('does not reuse %s',(_name,change,error)=>{const r=run(change+'console.log(JSON.stringify(composeReleaseStatus({rows,original,backlog,candidateReceipt:candidate,qualifiedAudit:audit,candidateVerified:true})));');expect(r.currentCandidateQualifiedCount).toBe(0);expect(r.qualificationErrors.join(' ')).toContain(error);expect(r.decision).toBe('NOT_READY_FOR_R1');});
 it('verifies a source-bound compiled execution contract',()=>{expect(run('console.log(JSON.stringify(verifyCurrentCandidate(candidate,options)));')).toEqual([]);});
 it.each([
  ['failed run','candidate.status="FAIL";','passing source-bound execution'],
  ['dirty inputs','candidate.dirtyInputs=["src/main.ts"];','dirty/changed'],
  ['missing environment','delete candidate.environment.node;','environment missing'],
  ['unexecuted build','candidate.checks=candidate.checks.filter(c=>c.name!=="build");','passing build and tests'],
  ['changed compiled bytes','files["dist/index.html"]="new bundle";','compiled artifact differs'],
  ['retagged current source','files["src/main.ts"]="new source";','source differs from Git object'],
  ['missing test source hash','delete candidate.testCases[0].testSourceSHA256;','assertion-source identity'],
  ['failed assertion','candidate.testCases[0].status="failed";','assertion-source identity'],
  ['changed source head','candidate.sourceCommitAtEnd="b".repeat(40);','final commit differs'],
 ])('rejects %s before attaching candidate evidence',(_name,change,error)=>{expect(run(change+'console.log(JSON.stringify(verifyCurrentCandidate(candidate,options)));').join(' ')).toContain(error);});
});
