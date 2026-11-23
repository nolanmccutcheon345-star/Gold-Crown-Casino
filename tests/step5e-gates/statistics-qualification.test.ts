import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifyStep5EStatistics,statisticsHarnessFiles} from './scripts/step5e-qualify-statistics.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),head='a'.repeat(40),files={},sources=Object.fromEntries(statisticsHarnessFiles.map(p=>[p,'actual fixture source:'+p]));
const receipt={sourceCommit:head,status:'PASS',sourceHashes:{'src/main.ts':hash('actual runtime')},buildHashes:{'dist/index.html':hash('compiled')}};
files['base.json']=JSON.stringify(receipt);
const proof={format:'ai-texas-step5e-exact-compiled-fixture',version:1,status:'BUILD_BYTES_VERIFIED',sourceCommit:head,executionReceipt:'base.json',executionReceiptSHA256:hash(files['base.json']),assets:[{source:'dist/index.html',sha256:hash('compiled')}]};
const fixturePaths=['tests/step5b-statistics/browser-fixture.ts','tests/browser/step5e-exact-stats.ts','tests/browser/step5e-exact-stats.html'];
const raw={status:'PASS',at:'synthetic fixture',browser:'synthetic contract',productionDatabaseAccessed:false,fixtureHands:300,actualUIPlayedHands:0,recordedHours:1,compiledProof:{sourceCommit:head,executionReceipt:'base.json'},sourceReceipt:{format:'step5e-exact-compiled-stats-source',version:1,status:'SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED',compiledSourceCommit:head,sourceHead:head,fixtureHands:300,actualUIPlayedHands:0,sourceHashes:receipt.sourceHashes,fixtureHashes:Object.fromEntries(fixturePaths.map(p=>[p,hash(sources[p])]))},checks:[... [30,60].map(assumption=>{const expected={hands:'300',bb100:'10.00',profit:'+$60',actualPerHour:'+$60',tracked:'60.0 min',equivalent:(300/assumption).toFixed(2),projectedBB:(10*assumption/100).toFixed(2),projectedCash:assumption===30?'+$6':'+$12'};return{check:'G04/X10 exact observed10BB100 and hypothetical pace',status:'PASS',recordedHours:1,assumedHandsPerHour:assumption,actual:structuredClone(expected),expected,canonicalSnapshotUnchanged:true};}),{check:'Lazy full archive and bounded history pagination',status:'PASS',pages:12,records:300,unique:300,pageLimit:25,canonicalSnapshotUnchanged:true}]};
const entry={format:'ai-texas-step5e-native-exact-statistics',version:1,id:'synthetic-contract-only',sourceCommit:head,harnessCommit:head,command:['synthetic contract; no browser executed'],capture:{path:'capture.json'},proof:{path:'proof.json'},harnessHashes:Object.fromEntries(Object.entries(sources).map(([p,v])=>[p,hash(v)]))};
function seal(){files['capture.json']=JSON.stringify(raw);entry.capture.sha256=hash(files['capture.json']);files['proof.json']=JSON.stringify(proof);entry.proof.sha256=hash(files['proof.json']);}seal();
const options={read:p=>Buffer.from(files[p]),exists:p=>Object.hasOwn(files,p),sourceAtCommit:(commit,p)=>{if(commit!==head||!sources[p])throw Error('missing');return Buffer.from(sources[p]);}};
`;
function run(change=''){const result=spawnSync(process.execPath,['--input-type=module','-e',setup+change+'\nconsole.log(JSON.stringify(verifyStep5EStatistics(entry,receipt,options)));'],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);}
const station=String.raw`raw.mode='station';raw.fixtureHands=100;delete raw.sourceReceipt.fixtureHands;raw.sourceReceipt.supportedFixtureCounts=[100,300];for(const item of raw.checks.slice(0,2)){const n=item.assumedHandsPerHour;item.check='G05 measured station-policy fixture results and population warning';item.actual=item.expected={...item.expected,hands:'100',bb100:'30.00',equivalent:(100/n).toFixed(2),projectedBB:(30*n/100).toFixed(2),projectedCash:n===30?'+$18':'+$36'};}Object.assign(raw.checks[2],{pages:4,records:100,unique:100});seal();`;
describe('Step5E populated statistics evidence stays distinct from timed UI-played hands',()=>{
 it('accepts exact source/compiled/actual300-fixture arithmetic contract with zeroUIhands',()=>{const r=run();expect(r.status).toBe('QUALIFIED');expect(r.actualUIPlayedHands).toBe(0);expect(r.commands).toHaveLength(3);});
 it('accepts a separately identified100hand station fixture without promoting generated hands toUIhands',()=>{const r=run(station);expect(r.status).toBe('QUALIFIED');expect(r.workflow).toBe('station-statistics');expect(r.fixtureHands).toBe(100);expect(r.actualUIPlayedHands).toBe(0);});
 it('refuses a station capture whose source receipt still declares only the300hand formula factory',()=>{const r=run(station+'delete raw.sourceReceipt.supportedFixtureCounts;raw.sourceReceipt.fixtureHands=300;seal();');expect(r.status).toBe('NOT_QUALIFIED');expect(r.errors.join(' ')).toContain('fixture source proof');});
 it.each([
  ['invented300UIhands','raw.actualUIPlayedHands=300;seal();','zeroUIhands'],
  ['prepared-only fixture','raw.status="NOT_EXECUTED";seal();','complete actual300'],
  ['wrong observed arithmetic','raw.checks[0].actual.projectedBB="30.00";seal();','pace arithmetic'],
  ['rewritten expected arithmetic','raw.checks[0].expected.projectedBB="30.00";raw.checks[0].actual.projectedBB="30.00";seal();','pace arithmetic'],
  ['mutated canonical history','raw.checks[1].canonicalSnapshotUnchanged=false;seal();','pace arithmetic'],
  ['omitted old hands','raw.checks[2].records=299;seal();','history paging'],
  ['unbound later assertions','sources[statisticsHarnessFiles[0]]="new assertions";','assertion source differs'],
  ['old compiled runtime','raw.compiledProof.sourceCommit="b".repeat(40);seal();','bundle identity differs'],
  ['fixture/current runtime mismatch','raw.sourceReceipt.sourceHashes={};seal();','fixture authority differs'],
  ['wrong original source','raw.sourceReceipt.sourceHead="b".repeat(40);seal();','fixture source proof'],
  ['actualproduction access','raw.productionDatabaseAccessed=true;seal();','complete actual300'],
  ['missing30pace input','raw.checks[0].assumedHandsPerHour=29;seal();','30and60pace'],
 ])('rejects %s',(_name,change,message)=>{const r=run(change);expect(r.status).toBe('NOT_QUALIFIED');expect(r.errors.join(' ')).toContain(message);});
});
