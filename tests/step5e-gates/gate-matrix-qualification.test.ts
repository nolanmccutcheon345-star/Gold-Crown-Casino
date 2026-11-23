import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Reuse the synthetic evidence-verifier contract fixture, never browser output.
const base=readFileSync(new URL('./sizing-qualification.test.ts',import.meta.url),'utf8').match(/const setup=String.raw`([\s\S]*?)`;/)![1];
const setup=base+String.raw`
import {verifyStep5EGateMatrix} from './scripts/step5e-qualify-gate-matrix.mjs';
const specs=[];
for(const seats of [2,3,6,9,10])for(const width of [320,375,390,430,768,1280])specs.push({kind:'layout-preflop',seats,width,height:width===768?1024:width===1280?900:844});
for(const seats of [6,9,10])specs.push({kind:'layout-preflop',seats,width:844,height:390});
for(const kind of ['facing-raise','side-pot','short-jam','raise-closed'])for(const width of [320,360,430,1280])specs.push({kind,seats:kind==='short-jam'||kind==='raise-closed'?3:10,width,height:width===1280?900:844});
for(const [smallBlind,bigBlind,buyIn]of [[100,300,45000],[200,500,75000],[5000,10000,1500000],[300,700,35000]])for(const street of ['preflop','flop'])for(const width of [390,1280])specs.push({kind:'stake',seats:6,width,height:width===1280?900:844,smallBlind,bigBlind,buyIn,street});
specs.push(raw.case);
const original=structuredClone(raw),rows=specs.map(c=>{
 const row={...structuredClone(original),case:c,viewport:{width:c.width,height:c.height},legal:{callAmount:1800,check:false,minRaiseTo:4500,maxRaiseTo:30000,shortAllInTo:null},heroStack:30000};
 row.tableGeometry={horizontalOverflow:false,seats:Array(c.seats).fill({}),sidePots:c.kind==='side-pot'?2:0};
 if(c.kind==='stake'){row.legal.minRaiseTo=c.street==='flop'?c.bigBlind:c.bigBlind*2;row.stakes={smallBlind:c.smallBlind,bigBlind:c.bigBlind,startingStack:c.buyIn,startingBB:c.buyIn/c.bigBlind,minimum:row.legal.minRaiseTo,street:c.street,independentlySummedPot:row.pot};}
 row.actionValues={call:row.legal.callAmount,check:false,minimum:row.legal.minRaiseTo,maximum:30000,remainingStack:30000,raiseTo:10800,previousStreetContribution:900,additional:9900,labelsMatchEngine:true};
 if(c.kind==='short-jam')row.shortAllIn={actionsCommitted:1,heroStack:0,heroCommitted:700,confirmationClicks:2,staleDetachedClick:1,selectedWithoutCommit:true,engineAccounting:true};
 if(c.kind==='raise-closed')row.raiseClosed={call:100,allRaiseControlsDisabled:true,foldAndCallAvailable:true};
 if(c.kind==='facing-raise'||c.kind==='mixed-granularity'){
  const p={pot:6300,callAmount:1800,priorStreetContribution:900,potAfterCall:8100,chipUnit:100,bigBlind:300,authoritativeRevisionUnchanged:true},to=n=>2700+Math.round(8100*n/100/100)*100;
  const values=[...[25,33,50,75,100,150,200].map(n=>[n+'%',to(n)]),['custom50',to(50)],['numeric50',to(50)],['editedBB',to(50)],['editedIncrement1BB',to(50)+300],['custom1000',to(1000)],['minimum',4500],['maximum',30000],['slider100',to(100)]];
  p.checks=values.map(([control,value])=>({control,to:value,additional:value-900,legal:value>=4500&&value<=30000&&value%100===0}));row.potSizing=p;
 }
 return row;
});
Object.assign(raw,{format:'step5e-native-gate-matrix',version:1,status:'PASS',mode:'all',planned:66,completed:66,passed:66,failed:0,productionDatabaseAccessed:false,sourcePinned:true,results:rows});entry.format='ai-texas-step5e-native-gate-matrix';seal();
`;
function run(change=''){const r=spawnSync(process.execPath,['--input-type=module','-e',setup+change+'\nconsole.log(JSON.stringify(verifyStep5EGateMatrix(entry,receipt,options)));'],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);}
describe('Actual gate-matrix qualifier rejects incomplete or altered evidence contracts',()=>{
 it('accepts the complete66-case synthetic verifier contract without claiming a browser ran',()=>{const r=run();expect(r.status).toBe('QUALIFIED');expect(r.actualCases).toBe(66);expect(r.actualUIPlayedHands).toBe(0);});
 it.each([
  ['one failed case','rows[0].status="FAIL";seal();','row status'],
  ['missing landscape','rows.splice(30,1);seal();','66-case'],
  ['repeated viewport','rows[1].case=rows[0].case;seal();','required viewport'],
  ['different actual width','rows[0].viewport.width=375;seal();','actual viewport'],
  ['omitted sidepot','rows.find(r=>r.case.kind==="side-pot").tableGeometry.sidePots=0;seal();','Side-pot'],
  ['wrong call label','rows[0].actionValues.call=900;seal();','Displayed action'],
  ['two shortjam commits','rows.find(r=>r.case.kind==="short-jam").shortAllIn.actionsCommitted=2;seal();','Incomplete all-in'],
  ['wrong stake conversion','rows.find(r=>r.case.kind==="stake").stakes.startingBB=5;seal();','Literal stake'],
  ['missing percent button','rows.find(r=>r.case.kind==="facing-raise").potSizing.checks.pop();seal();','seven percentages'],
  ['clipped proposal','rows.find(r=>r.case.kind==="facing-raise").potSizing.checks[0].to=4500;seal();','seven percentages'],
  ['claims66playedhands','raw.actualUIPlayedHands=66;seal();','66-case'],
 ])('rejects %s',(_name,change,error)=>{const r=run(change);expect(r.status).toBe('NOT_QUALIFIED');expect(r.errors.join(' ')).toContain(error);});
});
