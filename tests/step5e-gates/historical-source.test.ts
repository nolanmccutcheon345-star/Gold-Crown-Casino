import {describe,expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';

const fixture=String.raw`
import {createHash} from 'node:crypto';
import {verifyHistoricalRequirement} from './scripts/step5e-historical-source.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const committed={'src/runtime.ts':'original runtime','tests/original.test.ts':'original assertions','fixture.json':'original fixture'};
const files={'old-build/index.html':'actual old compiled bytes','tests/original.test.ts':'new assertions are not original','fixture.json':'new fixture is not original'};
const row={id:'A01',acceptance:'Contract fixture only',r1_gate_basis:'ORIGINAL_WHOLE_CRITERION'};
const record={id:'A01',criterionSha256:hash(row.acceptance),scope:row.r1_gate_basis,coverageReview:'COMPLETE',reviewRationale:'Synthetic verifier contract, never original acceptance execution',roomVersions:['fixture@1'],inputs:{description:'Synthetic historical fixture only',seeds:[],fixtureFiles:['fixture.json']},fixtureHashes:{'fixture.json':hash(committed['fixture.json'])},expected:'original fixture assertion',observed:'original test passed',cases:[{file:'tests/original.test.ts',name:'original named case'}]};
const receipt={format:'ai-texas-ci-execution',version:1,status:'PASS',sourceCommit:'a'.repeat(40),sourceCommitAtEnd:'a'.repeat(40),sourceHashes:Object.fromEntries(Object.entries(committed).map(([p,v])=>[p,hash(v)])),buildHashes:{'dist/index.html':hash(files['old-build/index.html'])},environment:{node:'fixture',platform:'fixture',arch:'fixture'},engineVersion:'fixture@1',policyVersion:'fixture@1',changedInputs:[],dirtyInputs:[],checks:[{name:'tests',status:'PASS',exitCode:0,command:['fixture never actually run']},{name:'build',status:'PASS',exitCode:0,command:['fixture never actually built']}],testCases:[{file:'tests/original.test.ts',name:'original named case',status:'passed',failureMessages:[],testSourceSHA256:hash(committed['tests/original.test.ts'])}]};
const entry={sourceCommit:receipt.sourceCommit,receipt:{path:'receipt.json',sha256:''},buildArtifacts:{'dist/index.html':'old-build/index.html'}};
const candidateHashes={...receipt.sourceHashes};
function seal(){files['receipt.json']=JSON.stringify(receipt);entry.receipt.sha256=hash(files['receipt.json']);}seal();
const options={read:path=>Buffer.from(files[path]),exists:path=>Object.hasOwn(files,path),sourceAtCommit:(commit,path)=>{if(commit!==entry.sourceCommit||!Object.hasOwn(committed,path))throw Error('missing');return Buffer.from(committed[path]);},candidateHashes};
`;
function run(change=''){const result=spawnSync(process.execPath,['--input-type=module','-e',fixture+change+'\nconsole.log(JSON.stringify(verifyHistoricalRequirement(row,record,entry,options)));'],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);}
describe('Step5E immutable historical execution qualification, synthetic verifier fixtures only',()=>{
 it('uses original committed assertions and fixtures even when present checkout files differ',()=>{const result=run();expect(result.status).toBe('HISTORICAL_QUALIFIED');expect(result.qualification.executedCases[0].sourceCommit).toBe('a'.repeat(40));});
 it('does not certify a changed current runtime as regression tested',()=>{const result=run('candidateHashes["src/runtime.ts"]=hash("new runtime");');expect(result.status).toBe('HISTORICAL_QUALIFIED');expect(result.candidateStatus).toBe('NOT_EXECUTED');});
 it('refuses source promotion by hashing present checkout and adding it to an old receipt',()=>{const result=run('receipt.sourceHashes["fixture.json"]=hash(files["fixture.json"]);record.fixtureHashes["fixture.json"]=receipt.sourceHashes["fixture.json"];seal();');expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain('original Git bytes');});
 it.each([
  ['missing original build','delete files["old-build/index.html"];','Original compiled artifact'],
  ['rebuild with changed bytes','files["old-build/index.html"]="new build";','Original compiled artifact'],
  ['altered original fixture','committed["fixture.json"]="changed original";','original Git bytes'],
  ['unexecuted later case','record.cases[0].name="assertion added later";','Missing or ambiguous executed case'],
  ['failed executed case','receipt.testCases[0].status="failed";seal();','Case did not pass'],
  ['missing source inventory','receipt.sourceHashes={};seal();','source inventory absent'],
  ['changed execution source','entry.sourceCommit="b".repeat(40);','source identity differs'],
  ['changing inputs','receipt.changedInputs=["fixture.json"];seal();','changing or dirty inputs'],
  ['missing original source','delete committed["fixture.json"];','Git object unavailable'],
  ['criterion rewrite','row.acceptance="Changed to make it pass";','criterion identity/hash mismatch'],
  ['build path traversal','entry.buildArtifacts["dist/index.html"]="../outside";','Original compiled artifact'],
  ['unhashed altered receipt','files["receipt.json"]+=" ";','receipt absent or changed'],
 ])('refuses %s',(_name,change,message)=>{const result=run(change);expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain(message);});
});
