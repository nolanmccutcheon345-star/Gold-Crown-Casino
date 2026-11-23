import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifyStep5EBrowser,step5eHarnessFiles} from './scripts/step5e-qualify-browser.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),commit='a'.repeat(40),files={},sources=Object.fromEntries(step5eHarnessFiles.map(file=>[file,'original assertion source:'+file]));
const receipt={sourceCommit:commit,status:'PASS',sourceHashes:{'src/main.ts':hash('runtime')},buildHashes:{'dist/index.html':hash('compiled')}};
files['base.json']=JSON.stringify(receipt);
const proof={format:'ai-texas-step5e-exact-compiled-fixture',version:1,status:'BUILD_BYTES_VERIFIED',sourceCommit:commit,executionReceipt:'base.json',executionReceiptSHA256:hash(files['base.json']),assets:[{source:'dist/index.html',sha256:hash('compiled')}]};
const raw={status:'PASS',actualUIHands:11,browser:'synthetic contract',at:'fixture',run:'fixture-run',width:320,reports:[...Array.from({length:9},(_,index)=>({kind:'step5e-compiled-result',run:'fixture-run',id:index+1,name:'start',status:'PASS',trace:[],result:{count:index+2,sourceCommit:commit}})),...['exact-raise','custom-three-seven','rerender-pending'].map((name,index)=>({kind:'step5e-compiled-result',run:'fixture-run',id:index+10,name,status:'PASS',trace:[],result:{sourceCommit:commit}})),{status:'PASS',check:'2–10 plus exact raise/custom-blind hands and exact single cashouts',actualUIHands:11,final:{hands:11,settlements:11,cashouts:11,active:false}}]};
const entry={format:'ai-texas-step5e-native-compiled-workflows',version:1,id:'synthetic-contract-only',sourceCommit:commit,harnessCommit:commit,command:['synthetic fixture; no actual browser here'],capture:{path:'capture.json'},proof:{path:'proof.json'},harnessHashes:Object.fromEntries(Object.entries(sources).map(([p,v])=>[p,hash(v)]))};
function seal(){files['capture.json']=JSON.stringify(raw);entry.capture.sha256=hash(files['capture.json']);files['proof.json']=JSON.stringify(proof);entry.proof.sha256=hash(files['proof.json']);}seal();
const options={read:path=>Buffer.from(files[path]),exists:path=>Object.hasOwn(files,path),sourceAtCommit:(head,path)=>{if(head!==commit||!Object.hasOwn(sources,path))throw Error('missing');return Buffer.from(sources[path]);}};
`;
function run(change=''){const r=spawnSync(process.execPath,['--input-type=module','-e',setup+change+'\nconsole.log(JSON.stringify(verifyStep5EBrowser(entry,receipt,options)));'],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);}
describe('Step5E exact compiled browser qualification contracts; no actual browser execution',()=>{
 it('accepts a complete synthetically constructed provenance contract',()=>{expect(run().status).toBe('QUALIFIED');});
 it.each([
  ['prepared-only artifacts','raw.status="NOT_EXECUTED";seal();','actual11-hand'],
  ['old nine-hand capture','raw.actualUIHands=9;seal();','actual11-hand'],
  ['other production source','entry.sourceCommit="b".repeat(40);','differs from candidate'],
  ['changed captured bytes','files["capture.json"]+=" ";','bytes absent or changed'],
  ['new assertions assigned to old capture','sources[step5eHarnessFiles[0]]="later assertions";','harness bytes differ'],
  ['missing actual procedure','entry.command=[];','procedure missing'],
  ['failed workflow','raw.reports[0].status="FAIL";seal();','failed or absent'],
  ['missing occupied count','raw.reports[0].result.count=3;seal();','2–10seat'],
  ['different compiled bundle','proof.assets[0].sha256="0".repeat(64);seal();','assets differ'],
  ['stale original build receipt','files["base.json"]+=" ";','receipt absent or changed'],
  ['duplicate command ID','raw.reports[1].id=raw.reports[0].id;seal();','identity/trace'],
  ['missing rerender case','raw.reports=raw.reports.filter(r=>r.name!=="rerender-pending");seal();','command absent:rerender-pending'],
  ['duplicate cashout','raw.reports.at(-1).final.cashouts=12;seal();','settlements/cashouts'],
  ['source-free command','delete raw.reports[0].result.sourceCommit;seal();','candidate identity:start'],
 ])('rejects %s',(_name,change,message)=>{const result=run(change);expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain(message);});
});
