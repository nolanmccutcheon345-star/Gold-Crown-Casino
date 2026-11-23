import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifyStep5EMixedStatistics,mixedStatisticsHarnessFiles} from './scripts/step5e-qualify-mixed-statistics.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),head='a'.repeat(40),files={},sources=Object.fromEntries(mixedStatisticsHarnessFiles.map(p=>[p,'actual fixture source:'+p]));
const receipt={sourceCommit:head,status:'PASS',sourceHashes:{'src/main.ts':hash('actual runtime')},buildHashes:{'dist/index.html':hash('compiled')}};
files['base.json']=JSON.stringify(receipt);
const proof={format:'ai-texas-step5e-exact-compiled-fixture',version:1,status:'BUILD_BYTES_VERIFIED',sourceCommit:head,executionReceipt:'base.json',executionReceiptSHA256:hash(files['base.json']),assets:[{source:'dist/index.html',sha256:hash('compiled')}]};
const sourceReceipt={format:'step5e-populated-compiled-stats-source',version:1,status:'SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED',compiledSourceCommit:head,sourceHead:head,fixtureHandsPerCohort:200,actualUIPlayedHands:0,compiledBuildReceipt:'base.json',sourceHashes:receipt.sourceHashes,fixtureHashes:Object.fromEntries(mixedStatisticsHarnessFiles.filter(p=>!p.endsWith('.mjs')).map(p=>[p,hash(sources[p])]))};
let serial=0;const reports=[],command=(run,name,result)=>reports.push({kind:'compiled-stats-result',run,id:++serial,name,status:'PASS',result:{...result,sourceCommit:head},trace:[]});
for(const second of ['2/5','5/10']){
 const run='synthetic-'+second,expected={hands:'200',profit:second==='2/5'?'+$500':'+$900',bb100:second==='2/5'?'72.50':'75.00'},expectedGroups=[['$1/$2','100','+$150','75.0'],second==='2/5'?['$2/$5','100','+$350','70.0']:['$5/$10','100','+$750','75.0']];
 const result={fixtureHands:200,actualUIPlayedHands:0,manualAdjustmentExcluded:true,oldHistoryUnchanged:true,expected,actual:structuredClone(expected),expectedGroups,actualGroups:structuredClone(expectedGroups),metadata:{second,topups:2,cashouts:2,expected:{hands:200,profit:second==='2/5'?50000:90000,bb100:second==='2/5'?72.5:75,wallet:second==='2/5'?1062345:1102345}},sourceReceipt:structuredClone(sourceReceipt),filters:[1,2].map(()=>({count:100,unique:100,pages:4,pageLimit:25})),allPages:{count:200,unique:200,pages:8,pageLimit:25},handHistorySHA256:hash('actual cohort'+second),wallet:second==='2/5'?1062345:1102345};
 command(run,'statistics',result);reports.push({check:'actual compiled document reload',run,status:'PASS'});command(run,'statistics',structuredClone(result));command(run,'erase',{wrongConfirmationPreserved:true});reports.push({check:'actual compiled document reload',run,status:'PASS'});command(run,'deleted',{newBankrollCreated:false,fixtureHandsDeleted:200,keys:['erasure']});command(run,'fresh',{});reports.push({check:'actual compiled document reload',run,status:'PASS'});command(run,'fresh-snapshot',{wallet:1000000,financialEvents:1,hands:0,sessions:0,oldRecordsRestored:false});
}
const raw={format:'step5e-exact-compiled-populated-statistics',version:1,status:'PASS',at:'synthetic fixture',browser:'synthetic contract',width:390,productionDatabaseAccessed:false,fixtureHandsVerified:400,actualUIPlayedHands:0,reports};
const entry={format:'ai-texas-step5e-native-mixed-statistics',version:1,id:'synthetic-contract-only',sourceCommit:head,harnessCommit:head,command:['synthetic contract; no browser executed'],capture:{path:'capture.json'},proof:{path:'proof.json'},harnessHashes:Object.fromEntries(Object.entries(sources).map(([p,v])=>[p,hash(v)]))};
function seal(){files['capture.json']=JSON.stringify(raw);entry.capture.sha256=hash(files['capture.json']);files['proof.json']=JSON.stringify(proof);entry.proof.sha256=hash(files['proof.json']);}seal();
const options={read:p=>Buffer.from(files[p]),exists:p=>Object.hasOwn(files,p),sourceAtCommit:(commit,p)=>{if(commit!==head||!sources[p])throw Error('missing');return Buffer.from(sources[p]);}};
`;
function run(change=''){const r=spawnSync(process.execPath,['--input-type=module','-e',setup+change+'\nconsole.log(JSON.stringify(verifyStep5EMixedStatistics(entry,receipt,options)));'],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);}
describe('Step5E mixed display captures remain source-bound generated-fixture evidence',()=>{
 it('accepts a complete source/compiled/paging/reload/deletion arithmetic contract with zeroUIhands',()=>{const r=run();expect(r.status).toBe('QUALIFIED');expect(r.actualUIPlayedHands).toBe(0);expect(r.fixtureHands).toBe(400);});
 it.each([
  ['invented400UIhands','raw.actualUIPlayedHands=400;seal();','zeroUIhands'],
  ['prepared-only fixture','raw.status="NOT_EXECUTED";seal();','actual400'],
  ['wrong observed arithmetic','reports[0].result.actual.bb100="725.00";seal();','arithmetic'],
  ['rewritten expected and observed','reports[0].result.expected.bb100="725.00";reports[0].result.actual.bb100="725.00";seal();','arithmetic'],
  ['mutated history','reports[2].result.handHistorySHA256="changed";seal();','changed histories'],
  ['omitted old hands','reports[0].result.allPages.count=199;seal();','archive paging'],
  ['new assertions substituted','sources[mixedStatisticsHarnessFiles[0]]="new assertions";','assertion source differs'],
  ['wrong runtime','reports[0].result.sourceReceipt.sourceHashes={};seal();','fixture authority'],
  ['wrong fixture source','reports[0].result.sourceReceipt.fixtureHashes={};seal();','fixture assertion'],
  ['missing actual reload','raw.reports.splice(1,1);seal();','reload matrix'],
  ['production data access','raw.productionDatabaseAccessed=true;seal();','actual400'],
  ['surviving deleted backup','reports.find(r=>r.name==="deleted").result.keys.push("backup");seal();','deletion proof'],
  ['duplicate initial bankroll','reports.find(r=>r.name==="fresh-snapshot").result.financialEvents=2;seal();','fresh-start'],
 ])('rejects %s',(_name,change,error)=>{const r=run(change);expect(r.status).toBe('NOT_QUALIFIED');expect(r.errors.join(' ')).toContain(error);});
});
