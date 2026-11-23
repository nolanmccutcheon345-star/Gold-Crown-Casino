import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import {createHash} from 'node:crypto';
import {verifyStep5ESizing,sizingHarnessFiles} from './scripts/step5e-qualify-sizing.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),head='a'.repeat(40),files={'qa.js.bin':'actual bundle','qa.css.bin':'actual styles'},sources=Object.fromEntries([...sizingHarnessFiles.map(p=>[p,'actual assertion source:'+p]),['src/main.ts','actual runtime']]);
const receipt={sourceCommit:head,sourceHashes:{'src/main.ts':hash('actual runtime')}};
const proof={format:'ai-texas-step5e-runtime-provenance',version:1,name:'candidate',productionDirty:'',sourceCommit:head,sourceFiles:receipt.sourceHashes,artifacts:Object.entries(files).map(([path,bytes])=>({path,sha256:hash(bytes),bytes:bytes.length}))};
const selectors=['#fold','#call','#raise','#raise-to','#raise-additional','#raise-limits','.hero-stack-label','#pot-slider'];
const raw={status:'PASS',executedAt:'synthetic fixture',browser:'synthetic contract',nonTraining:true,actualUIPlayedHands:0,storage:'isolated memory only',candidateSource:proof,case:{kind:'mixed-granularity',width:360,height:844,seats:3,smallBlind:100,bigBlind:300,buyIn:30000},pot:6300,legal:{callAmount:1800},exact360Response:{width:360,previousStreetContribution:900,displayedRaiseTo:10800,additionalCommitment:9900,minimum:4500,maximum:30000,rapidClicks:2,staleClick:1,committedActions:1,engineAccounting:true},invalidAndMixed:{potAfterCall:8100,total100Percent:10800,additional:9900,authoritativeRevisionUnchanged:true,invalidRejected:['44','45.01','300.01','']},controls:selectors.map((selector,index)=>({selector,x:10,y:10+index*50,width:200,height:44,right:210,bottom:54+index*50,font:'16px'})),tableGeometry:{horizontalOverflow:false}};
const entry={format:'ai-texas-step5e-native-sizing',version:1,id:'synthetic-contract-only',sourceCommit:head,harnessCommit:head,command:['synthetic verifier contract; no browser executed'],capture:{path:'capture.json'},proof:{path:'proof.json'},harnessHashes:Object.fromEntries(sizingHarnessFiles.map(p=>[p,hash(sources[p])]))};
function seal(){files['capture.json']=JSON.stringify(raw);entry.capture.sha256=hash(files['capture.json']);files['proof.json']=JSON.stringify(proof);entry.proof.sha256=hash(files['proof.json']);}seal();
const options={read:p=>Buffer.from(files[p]),exists:p=>Object.hasOwn(files,p),sourceAtCommit:(commit,p)=>{if(commit!==head||!sources[p])throw Error('missing');return Buffer.from(sources[p]);}};
`;
function run(change=''){const r=spawnSync(process.execPath,['--input-type=module','-e',setup+change+'\nconsole.log(JSON.stringify(verifyStep5ESizing(entry,receipt,options)));'],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);}
describe('Step5E literal360 sizing evidence requires actual source/artifact and complete checks',()=>{
 it('accepts a complete contract while labeling QA bundle and physical-touch limits',()=>{const r=run();expect(r.status).toBe('QUALIFIED');expect(r.limitations.join(' ')).toContain('no physical');});
 it.each([
  ['prepared-only capture','raw.status="NOT_EXECUTED";seal();','actual sizing'],
  ['changed runtime','sources["src/main.ts"]="new runtime";','runtime differs'],
  ['changed bundle','files["qa.js.bin"]="changed bundle";','bundle bytes'],
  ['changed assertion','sources[sizingHarnessFiles[0]]="changed assertions";','assertion source differs'],
  ['different viewport','raw.case.width=390;seal();','Literal360'],
  ['wrong additional chips','raw.exact360Response.additionalCommitment=10800;seal();','cumulative raise'],
  ['duplicate action','raw.exact360Response.committedActions=2;seal();','idempotency'],
  ['unexecuted stale action','raw.exact360Response.staleClick=0;seal();','idempotency'],
  ['label clipped','raw.controls[0].right=362;seal();','hidden/clipped'],
  ['overlapping controls','raw.controls[1].y=11;raw.controls[1].bottom=55;seal();','overlap'],
  ['small touch target','raw.controls[0].height=30;seal();','not accessible'],
  ['invented UIhand','raw.actualUIPlayedHands=1;seal();','actual sizing'],
 ])('rejects %s',(_name,change,error)=>{const r=run(change);expect(r.status).toBe('NOT_QUALIFIED');expect(r.errors.join(' ')).toContain(error);});
});
