import {describe,expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifySupplemental} from './scripts/step5d-audit-execution-links.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const files={'src/core/example.ts':'unchanged runtime','dist/index.html':'actual compiled fixture'};
const base={status:'PASS',sourceCommit:'a'.repeat(40),sourceHashes:{'src/core/example.ts':hash(files['src/core/example.ts'])},buildHashes:{'dist/index.html':hash(files['dist/index.html'])},engineVersion:'0.4.0',policyVersion:'synthetic-cash-1.6.0'};
files['test-results/base.json']=JSON.stringify(base);
const supplementary={format:'ai-texas-ci-execution',version:1,status:'PASS',sourceCommit:'b'.repeat(40),sourceHashes:{...base.sourceHashes},engineVersion:base.engineVersion,policyVersion:base.policyVersion,environment:{node:'v24',platform:'linux',arch:'x64'},changedInputs:[],dirtyInputs:[],checks:[{name:'composition',status:'PASS',exitCode:0,command:['synthetic test fixture only']}],qualificationBase:{path:'test-results/base.json',sha256:hash(files['test-results/base.json']),sourceCommit:base.sourceCommit,runtimeMatch:'EXACT',compiledAssetsMatch:'EXACT'}};
const entry={id:'composition',path:'test-results/supplement.json',sha256:''};
function seal(){files[entry.path]=JSON.stringify(supplementary);entry.sha256=hash(files[entry.path]);}seal();
const options={read:path=>Buffer.from(files[path]),exists:path=>Object.hasOwn(files,path)};
`;
function run(mutation=''){
 const result=spawnSync(process.execPath,['--input-type=module','-e',setup+mutation+'\nconsole.log(JSON.stringify(verifySupplemental(entry,base,options)));'],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);
}
describe('Supplemental actual execution preserves original compiled provenance',()=>{
 it('accepts a separately source-pinned synthetic contract with exactly identical runtime and compiled bytes',()=>{expect(run().status).toBe('QUALIFIED');});
 const failures:[string,string,string][]=[
  ['changed production source','supplementary.sourceHashes["src/core/example.ts"]="0".repeat(64);seal();','production runtime bytes differ'],
  ['changed compiled asset','files["dist/index.html"]="different bundle";','compiled asset differs'],
  ['absent runtime equality proof','delete supplementary.qualificationBase.runtimeMatch;seal();','agreement not established'],
  ['unmatched prior build','supplementary.qualificationBase.sourceCommit="c".repeat(40);seal();','agreement not established'],
  ['changed prior receipt','files["test-results/base.json"]+=" ";','base receipt absent or changed'],
  ['failed supplemental tests','supplementary.checks[0].status="FAIL";seal();','passing runnable command missing'],
  ['source edits while running','supplementary.changedInputs=["src/core/example.ts"];seal();','stable source verification'],
  ['missing command execution','supplementary.checks=[];seal();','passing runnable command missing'],
  ['changed supplementary artifact','files[entry.path]+=" ";','receipt absent or changed'],
 ];
 for(const [name,change,message]of failures)it(`refuses ${name}`,()=>{const result=run(change);expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain(message);});
});
