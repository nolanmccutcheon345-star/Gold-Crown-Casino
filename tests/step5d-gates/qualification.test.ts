import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const files={'tests/fixture.ts':'assert(actual).equals(expected)','tests/rules.ts':'practice@1; seed42','dist/index.html':'built candidate'},sourceHashes=Object.fromEntries(Object.entries(files).map(([p,v])=>[p,hash(v)]));
 return{files,row:{id:'A01',acceptance:'Unique cards',r1_gate_basis:'ORIGINAL_WHOLE_CRITERION'},record:{id:'A01',criterionSha256:hash('Unique cards'),scope:'ORIGINAL_WHOLE_CRITERION',coverageReview:'COMPLETE',reviewRationale:'Synthetic contract fixture only, never real acceptance.',roomVersions:['practice@1'],inputs:{description:'exact testfixture',seeds:[42],fixtureFiles:['tests/rules.ts']},fixtureHashes:{'tests/rules.ts':sourceHashes['tests/rules.ts']},expected:'unique cards',observed:'named assertion passed',cases:[{file:'tests/fixture.ts',name:'exact case'}]},receipt:{format:'ai-texas-executed-checks',version:1,status:'PASS',sourceCommit:'a'.repeat(40),environment:{node:'v24',platform:'linux',arch:'x64'},engineVersion:'0.4.0',policyVersion:'synthetic-cash-1.6.0',changedInputs:[],checks:[{name:'unit',status:'PASS',exitCode:0,command:['node','test']},{name:'build',status:'PASS',exitCode:0,command:['node','build']}],sourceHashes,testCases:[{file:'tests/fixture.ts',name:'exact case',status:'passed',failureMessages:[],assertionsSourceSHA256:sourceHashes['tests/fixture.ts']}],buildHashes:{'dist/index.html':sourceHashes['dist/index.html']}}};
}
function run(value:unknown){const script="import {qualify} from './scripts/step5d-audit-execution-links.mjs';let text='';for await(const chunk of process.stdin)text+=chunk;const x=JSON.parse(text);console.log(JSON.stringify(qualify(x.row,x.record,x.receipt,{read:p=>Buffer.from(x.files[p]),exists:p=>Object.hasOwn(x.files,p)})));";const result=spawnSync(process.execPath,['--input-type=module','-e',script],{input:JSON.stringify(value),encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);}
describe('V620 original-ID evidence qualification refuses unverified success',()=>{
 it('accepts a complete exact synthetic receipt only as a contract fixture',()=>{expect(run(fixture()).status).toBe('QUALIFIED');});
 it('accepts portable CI case-hash field without claiming hosted execution',()=>{const x=fixture();x.receipt.format='ai-texas-ci-execution';const c=x.receipt.testCases[0];Object.assign(c,{testSourceSHA256:c.assertionsSourceSHA256});Reflect.deleteProperty(c,'assertionsSourceSHA256');expect(run(x).status).toBe('QUALIFIED');});
 it('selects a distinct executed supporting suite instead of conflating repeated test names',()=>{
  const x=fixture();Object.assign(x.record.cases[0],{suite:'paired-reference'});
  Object.assign(x.receipt,{supportingSuites:[{name:'paired-reference',testCases:structuredClone(x.receipt.testCases)}]});
  x.receipt.testCases[0].status='failed';const result=run(x);expect(result.status).toBe('QUALIFIED');expect(result.executedCases[0].suite).toBe('paired-reference');
 });
 it('refuses a named supporting suite that was never executed',()=>{const x=fixture();Object.assign(x.record.cases[0],{suite:'invented-paired-run'});expect(run(x).errors.join(' ')).toContain('supporting suite');});
 const reportFixture=(hands=4032,commit='a'.repeat(40))=>{
  const x=fixture(),path='tests/actual-report.json',bytes=JSON.stringify({sourceCommit:commit,full:true,totalHands:hands});
  Object.assign(x.files,{[path]:bytes});Object.assign(x.record,{reports:[{path,sha256:hash(bytes),assertions:[{path:'full',equals:true},{path:'totalHands',equals:4032}]}]});return x;
 };
 it('requires a source-bound actual full report in addition to a passing case',()=>{const result=run(reportFixture());expect(result.status).toBe('QUALIFIED');expect(result.executedReports[0].observed[1].actual).toBe(4032);});
 it('refuses a same-name smoke run as full-cohort evidence',()=>{expect(run(reportFixture(42)).errors.join(' ')).toContain('Result report assertion failed');});
 it('refuses another source commit report even with valid artifact bytes and a passing case',()=>{expect(run(reportFixture(4032,'b'.repeat(40))).errors.join(' ')).toContain('Result report source differs');});
 it('refuses altered result bytes without rerunning the declared report',()=>{const x=reportFixture();Object.assign(x.files,{'tests/actual-report.json':'{}'});expect(run(x).errors.join(' ')).toContain('report bytes absent or changed');});
 it('validates an explicitly compressed source-bound result without dropping artifact integrity',()=>{
  const x=fixture(),path='tests/actual-report.json.gz',bytes=gzipSync(JSON.stringify({sourceCommit:'a'.repeat(40),legalDecisions:49152}));
  Object.assign(x.files,{[path]:Array.from(bytes)});Object.assign(x.record,{reports:[{path,sha256:createHash('sha256').update(bytes).digest('hex'),encoding:'gzip-json',assertions:[{path:'legalDecisions',equals:49152}]}]});
  expect(run(x).status).toBe('QUALIFIED');
 });
 const defects:[string,(x:ReturnType<typeof fixture>)=>void,string][]=[
  ['a missing qualification',x=>Reflect.deleteProperty(x,'record'),'MISSING_QUALIFICATION_RECORD'],
  ['a changed original criterion',x=>x.row.acceptance='Weakened criterion','criterion identity'],
  ['an unauthorized scope split',x=>x.record.scope='EXPLICIT_MIXED_CASH_COMPONENT','scope differs'],
  ['an unreviewed association',x=>x.record.coverageReview='CANDIDATE_FILE_ONLY','coverage review'],
  ['a failed execution',x=>x.receipt.status='FAIL','did not pass'],
  ['a missing environment',x=>x.receipt.environment.platform='','environment'],
  ['a missing policy version',x=>x.receipt.policyVersion='','policy version'],
  ['missing room metadata',x=>x.record.roomVersions=[],'rules/profile'],
  ['missing deterministic inputs',x=>x.record.inputs.description='','fixture/input'],
  ['missing expected outcome',x=>x.record.expected='','Expected/observed'],
  ['changed source bytes',x=>x.files['tests/fixture.ts']='changed after execution','Case source differs'],
  ['changed fixture bytes',x=>x.files['tests/rules.ts']='different seed','Fixture bytes changed'],
  ['changed built artifact',x=>x.files['dist/index.html']='different bundle','Compiled artifact bytes changed'],
  ['a missing executed case',x=>x.record.cases[0].name='invented','Missing or ambiguous'],
  ['a failed named case',x=>x.receipt.testCases[0].status='failed','Case did not pass'],
  ['a duplicate executed case',x=>x.receipt.testCases.push(x.receipt.testCases[0]),'Missing or ambiguous'],
 ];
 for(const [name,mutate,message] of defects)it(`refuses ${name}`,()=>{const x=fixture();mutate(x);const report=run(x);expect(report.status).toBe('NOT_QUALIFIED');expect(report.errors.join(' ')).toContain(message);});
 it('audits all302 original rows without promoting linked cases or altering status',()=>{
  const directory=mkdtempSync(join(tmpdir(),'holdem-qualified-evidence-')),output=join(directory,'report.json'),before=readFileSync('ACCEPTANCE_STATUS.csv','utf8');try{const result=spawnSync(process.execPath,['scripts/step5d-audit-execution-links.mjs','--no-build-bytes','--enforce','--output',output],{encoding:'utf8'});expect(result.status,result.stderr).toBe(1);const report=JSON.parse(readFileSync(output,'utf8'));expect(report.originalRequirements).toBe(302);expect(report.deferredFeatures).toBe(86);expect(report.requirements).toHaveLength(302);expect(report.qualifiedCount).toBeGreaterThan(0);expect(report.unqualifiedIds.length).toBeGreaterThan(0);expect(report.executionLinkedCount).toBeGreaterThan(report.qualifiedCount);expect(report.decision).toBe('NOT_READY_FOR_R1');expect(readFileSync('ACCEPTANCE_STATUS.csv','utf8')).toBe(before);}finally{rmSync(directory,{recursive:true,force:true});}
 });
});
