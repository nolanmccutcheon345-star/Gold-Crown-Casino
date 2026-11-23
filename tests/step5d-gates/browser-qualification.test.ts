import {describe,expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';

// These are explicitly synthetic verifier contracts, never browser results.
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifyBrowser,qualifyBrowserCases} from './scripts/step5d-qualify-browser.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const files={'tests/browser/step5d-compiled.ts':'synthetic parent assertions','tests/browser/step5d-compiled-frame.ts':'synthetic iframe assertions','src/core/example.ts':'unchanged runtime','dist/index.html':'compiled synthetic fixture'};
const commit='a'.repeat(40),receipt={status:'PASS',sourceCommit:commit,sourceHashes:Object.fromEntries(Object.entries(files).map(([p,s])=>[p,hash(s)])),buildHashes:{'dist/index.html':hash(files['dist/index.html'])}};
files['test-results/base.json']=JSON.stringify(receipt);
const proof={format:'ai-texas-step5d-exact-compiled-fixture',version:1,status:'BUILD_BYTES_VERIFIED',sourceCommit:commit,executionReceipt:'test-results/base.json',executionReceiptSHA256:hash(files['test-results/base.json']),assets:[{source:'dist/index.html',sha256:receipt.buildHashes['dist/index.html']}]};
const raw={status:'PASS',actualUIHands:9,browser:'Synthetic browser contract only',run:'synthetic1',width:390,at:'2026-11-01T00:00:00Z',reports:[...Array.from({length:9},(_,i)=>({kind:'step5d-compiled-result',id:'command'+i,run:'synthetic1',name:'start',status:'PASS',result:{count:i+2,sourceCommit:commit},trace:[{action:'click',selector:'#setup-submit'}]})),{check:'all2–10 completed hands and exact single cashouts',status:'PASS',actualUIHands:9,final:{hands:9,settlements:9,cashouts:9,active:false}}]};
const entry={format:'ai-texas-native-compiled-workflows',version:1,id:'synthetic-mobile',sourceCommit:commit,command:['synthetic fixture only, never executed browser'],harnessHashes:receipt.sourceHashes,capture:{path:'test-results/browser.json',sha256:''},proof:{path:'test-results/proof.json',sha256:''}};
function seal(){files[entry.capture.path]=JSON.stringify(raw);entry.capture.sha256=hash(files[entry.capture.path]);files[entry.proof.path]=JSON.stringify(proof);entry.proof.sha256=hash(files[entry.proof.path]);}
seal();
const options={read:path=>Buffer.from(files[path]),exists:path=>Object.hasOwn(files,path)};
`;
function run(mutation='',tail='console.log(JSON.stringify(verifyBrowser(entry,receipt,options)));'){
 const result=spawnSync(process.execPath,['--input-type=module','-e',setup+mutation+'\n'+tail],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);
}
const populated=String.raw`
entry.workflow='populated-statistics';
for(const file of ['tests/browser/step5d-compiled-stats.ts','tests/browser/step5d-compiled-stats-frame.ts','tests/step5d-browser/mixed-stats-fixture.ts','tests/step5d-browser/capture-mixed-stats-source.mjs']){files[file]='synthetic '+file;receipt.sourceHashes[file]=hash(files[file]);}
files['test-results/base.json']=JSON.stringify(receipt);proof.executionReceiptSHA256=hash(files['test-results/base.json']);
Object.assign(raw,{format:'step5d-exact-compiled-populated-statistics',version:1,fixtureHandsVerified:400,actualUIPlayedHands:0,productionDatabaseAccessed:false,reports:[]});
let id=0;
for(const second of ['2/5','5/10']){
 const expected={hands:200,profit:second==='2/5'?50000:90000,bb100:second==='2/5'?72.5:75,wallet:second==='2/5'?1062345:1102345};
 const result={sourceCommit:commit,fixtureHands:200,actualUIPlayedHands:0,manualAdjustmentExcluded:true,oldHistoryUnchanged:true,actual:expected,expected,actualGroups:[],expectedGroups:[],handHistorySHA256:hash(second),wallet:expected.wallet,metadata:{second,expected},sourceReceipt:{status:'SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED',compiledSourceCommit:commit,sourceHead:commit,sourceHashes:receipt.sourceHashes}};
 for(let n=0;n<2;n++)raw.reports.push({kind:'compiled-stats-result',id:++id,run:second,name:'statistics',status:'PASS',trace:[],result:structuredClone(result)});
 raw.reports.push({kind:'compiled-stats-result',id:++id,run:second,name:'fresh-snapshot',status:'PASS',trace:[],result:{sourceCommit:commit,wallet:1000000,financialEvents:1,hands:0,sessions:0,oldRecordsRestored:false}});
 for(let n=0;n<3;n++)raw.reports.push({check:'actual compiled document reload',status:'PASS',run:second});
}
seal();
`;
describe('Native compiled-browser receipt qualification contracts',()=>{
 it('accepts a complete synthetic contract without claiming a real browser ran',()=>{expect(run().status).toBe('QUALIFIED');});
 const failures:[string,string,string][]=[
  ['failed capture','raw.status="FAIL";seal();','No complete successful'],
  ['unexecuted counts','raw.actualUIHands=0;seal();','No complete successful'],
  ['changed captured bytes','files[entry.capture.path]+=" ";','bytes changed'],
  ['wrong browser source','raw.reports[0].result.sourceCommit="b".repeat(40);seal();','candidate identity'],
  ['missing ten-seat game','raw.reports.splice(8,1);seal();','every declared occupied'],
  ['duplicate command','raw.reports[1].id=raw.reports[0].id;seal();','Duplicate browser command'],
  ['failed command','raw.reports[0].status="FAIL";seal();','failed or absent'],
  ['missing action trace','delete raw.reports[0].trace;seal();','trace missing'],
  ['duplicate settlement','raw.reports.at(-1).final.settlements=10;seal();','settlement/cashout'],
  ['changed assertion code','files["tests/browser/step5d-compiled-frame.ts"]+="different";','assertion source differs'],
  ['unproven later harness','entry.harnessCommit="b".repeat(40);','harness source proof missing'],
  ['changed compiled proof','proof.assets[0].sha256="0".repeat(64);seal();','asset proof differs'],
  ['missing execution procedure','entry.command=[];','execution procedure'],
 ];
 for(const [name,mutation,reason]of failures)it(`rejects ${name}`,()=>{const result=run(mutation);expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain(reason);});
 it('permits a separately pinned QA-only harness when git-source proof verifies unchanged runtime',()=>{const result=run('entry.harnessCommit="b".repeat(40);options.sourceAtCommit=(_commit,path)=>Buffer.from(files[path]);');expect(result.status).toBe('QUALIFIED');expect(result.harnessCommit).toBe('b'.repeat(40));});
 it('rejects later harness provenance if the tested runtime changed',()=>{const result=run('entry.harnessCommit="b".repeat(40);options.sourceAtCommit=(_commit,path)=>Buffer.from(path.startsWith("src/")?"changed runtime":files[path]);');expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain('changes tested runtime');});
 it('preserves a historical QA commit after additional QA assertions are authored without crediting an absent new workflow',()=>{
  const result=run('entry.harnessCommit="b".repeat(40);const pinned={...files};options.sourceAtCommit=(_commit,path)=>Buffer.from(pinned[path]);files["tests/browser/step5d-compiled-frame.ts"]="new additional unexecuted assertion";',String.raw`const browser=verifyBrowser(entry,receipt,options);console.log(JSON.stringify({status:browser.status,...qualifyBrowserCases([{execution:'synthetic-mobile',command:'new-unexecuted-workflow',occurrences:1,assertions:[{path:'status',equals:'PASS'}]}],[browser])}));`);
  expect(result.status).toBe('QUALIFIED');expect(result.errors.join(' ')).toContain('occurrence mismatch');
 });
 const select=String.raw`const browser=verifyBrowser(entry,receipt,options),checks=[{execution:'synthetic-mobile',command:'start',occurrences:1,where:{'result.count':9},assertions:[{path:'result.count',equals:9}]}];`;
 it('records actual matched assertions with exact occurrence and capture identity',()=>{const result=run('',select+'console.log(JSON.stringify(qualifyBrowserCases(checks,[browser])));');expect(result.errors).toEqual([]);expect(result.executed).toHaveLength(1);expect(result.executed[0].observed[0].actual).toBe(9);});
 it('rejects absent or false expected/observed assertions despite overall PASS',()=>{const result=run('',select+'checks[0].assertions[0].equals=10;console.log(JSON.stringify(qualifyBrowserCases(checks,[browser])));');expect(result.errors.join(' ')).toContain('Browser assertion failed');});
 it('rejects a missing or duplicated matching workflow instead of guessing its identity',()=>{const result=run('',select+'checks[0].occurrences=2;console.log(JSON.stringify(qualifyBrowserCases(checks,[browser])));');expect(result.errors.join(' ')).toContain('occurrence mismatch');});
 it('requires actual captured execution instead of a source filename or markup render',()=>{const result=run('',select+'console.log(JSON.stringify(qualifyBrowserCases(checks,[])));');expect(result.errors.join(' ')).toContain('Missing or invalid executed browser');});
 it('keeps independently prepared populated display fixtures separate from UI-played hands',()=>{const result=run(populated);expect(result.status).toBe('QUALIFIED');expect(result.workflow).toBe('populated-statistics');});
 it('rejects relabeling generated display fixtures as played browser hands',()=>{const result=run(populated+'raw.actualUIPlayedHands=400;seal();');expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain('fixture hands are not UI-played');});
 it('rejects wrong independent mixed-stake arithmetic despite a PASS label',()=>{const result=run(populated+'raw.reports[0].result.metadata.expected.bb100=100;seal();');expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain('arithmetic or preservation');});
 it('rejects changed populated history across an actual reload pair',()=>{const result=run(populated+'raw.reports[1].result.handHistorySHA256="changed";seal();');expect(result.status).toBe('NOT_QUALIFIED');expect(result.errors.join(' ')).toContain('reload changed histories');});
});
