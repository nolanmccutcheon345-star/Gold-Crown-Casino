import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import type {DrawResponseKind,DrawResponseStreet,GameState} from '../../src/contracts';
import {DRAW_RESPONSE_POT_ANCHORS,normalizeDrawResponses,drawResponseOffset,drawResponseKind} from '../../src/bots/draw-responses';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION,supportedPolicy} from '../../src/bots/policy';
import * as frozen from '../../src/bots/v4/policy';
import * as frozen14 from '../../src/bots/v5/policy';
import * as frozen15 from '../../src/bots/v6/policy';
import {applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {hand,rig,act} from '../verification/helpers';
import {seededRandom,scenarios} from '../step4a/scenarios';
const cards:Record<DrawResponseKind,{own:string[];board:string[]}>= {
 gutshot:{own:['9c','8d'],board:['6h','2s','Tc','4d','Kh']},
 oesd:{own:['9c','8d'],board:['6h','7s','Kc','2d','Qh']},
 flush:{own:['Ah','3h'],board:['Qh','7h','2c','8d','Ks']},
 combo:{own:['9h','8h'],board:['6h','7h','Kc','2d','Qs']},
};
function fixture(kind:DrawResponseKind,street:DrawResponseStreet,fraction:number):GameState {
 const c=cards[kind],dead=[...c.own,...c.board];const available=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!dead.includes(c));
 let g=rig(hand([100000,100000]),[c.own,available.slice(0,2)],c.board);
 g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});
 while(g.street!==street)g=act(g,{type:'check'});
 return act(g,{type:'raise',to:Math.round(2000*fraction)});
}
function wilson(k:number,n:number){const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
describe('Versioned conditional draw response surfaces',()=>{
 it('preserves every historical1.5 source byte and its dispatched decisions',()=>{
  for(const name of ['policy','profiles','strategy','features','memory','boundary','preflop','ranges','range-contract','pricing','draw-responses']){
   const original=execFileSync('git',['show',`250d60a:src/bots/${name}.ts`],{encoding:'utf8'});
   let preserved=readFileSync(`src/bots/v6/${name}.ts`,'utf8').replaceAll("'../../contracts'","'../contracts'").replaceAll("'../../core/","'../core/");
   if(name==='policy'){preserved=preserved.replaceAll("'../legacy-v0'","'./legacy-v0'");for(const v of [1,2,3,4,5])preserved=preserved.replaceAll(`'../v${v}/`,`'./v${v}/`);}
   expect(preserved).toBe(original);
  }
  expect(supportedPolicy('synthetic-cash-1.5.0')).toBe(true);
  for(const s of scenarios()){
   const old=frozen15.createProfile({selection:'stronger-reg'},91,'neutral'),o=observeBot(s.state,s.state.actor!,old.policyVersion,'frozen15');
   expect(chooseDecision(o,old,seededRandom(9))).toEqual(frozen15.chooseDecision(o,old,seededRandom(9)));
   expect(analyzeDecision(o,old)).toEqual(frozen15.analyzeDecision(o,old));
  }
 });
 it('preserves every historical1.4 source byte except import relocation',()=>{
  for(const name of ['policy','profiles','strategy','features','memory','boundary','preflop','ranges','range-contract','pricing','draw-responses']){
   const original=execFileSync('git',['show',`7716a74:src/bots/${name}.ts`],{encoding:'utf8'});
   let preserved=readFileSync(`src/bots/v5/${name}.ts`,'utf8').replaceAll("'../../contracts'","'../contracts'").replaceAll("'../../core/","'../core/");
   if(name==='policy'){preserved=preserved.replaceAll("'../legacy-v0'","'./legacy-v0'");for(const v of [1,2,3,4])preserved=preserved.replaceAll(`'../v${v}/`,`'./v${v}/`);}
   expect(preserved).toBe(original);
  }
 });
 it('preserves every historical1.3 source byte except import relocation',()=>{
  for(const name of ['policy','profiles','strategy','features','memory','boundary','preflop','ranges','range-contract','pricing']){
   const original=execFileSync('git',['show',`9d937a3:src/bots/${name}.ts`],{encoding:'utf8'});
   let frozenSource=readFileSync(`src/bots/v4/${name}.ts`,'utf8').replaceAll("'../../contracts'","'../contracts'").replaceAll("'../../core/","'../core/");
   if(name==='policy'){frozenSource=frozenSource.replaceAll("'../legacy-v0'","'./legacy-v0'");for(const v of [1,2,3])frozenSource=frozenSource.replaceAll(`'../v${v}/`,`'./v${v}/`);}
   expect(frozenSource).toBe(original);
  }
 });
 it('validates all curve keys, dimensions and finite bounded offsets; input is copied',()=>{
  const points=Array(7).fill(0),clean=normalizeDrawResponses({oesd:{turn:points}});points[0]=1;expect(clean.oesd!.turn![0]).toBe(0);
  for(const value of [NaN,Infinity,-1.01,1.01])expect(()=>normalizeDrawResponses({oesd:{turn:Array(7).fill(value)}})).toThrow();
  expect(()=>normalizeDrawResponses({oesd:{turn:[0]}})).toThrow();
  expect(drawResponseOffset({oesd:{turn:[-1,-.5,0,.5,1,1,1]}},'oesd','turn',.375)).toBe(-.75);
 });
 it('keeps exact frozen1.3/1.4 decisions; historical1.4 trait changes remain scoped to unmade draws',()=>{
  expect(supportedPolicy('synthetic-cash-1.3.0')).toBe(true);
  for(const s of scenarios()){
   const old=frozen.createProfile({selection:'tag'},91,'neutral');const o=observeBot(s.state,s.state.actor!,old.policyVersion,'frozen');
   expect(chooseDecision(o,old,seededRandom(9))).toEqual(frozen.chooseDecision(o,old,seededRandom(9)));
   const current=frozen14.createProfile({selection:'tag'},91,'neutral');const now={...o,policyVersion:frozen14.POLICY_VERSION};
   expect(chooseDecision(now,current,seededRandom(9))).toEqual(frozen14.chooseDecision(now,current,seededRandom(9)));
   const a=analyzeDecision(now,current);if(!(now.street!=='river'&&a.features.draw>0&&!a.features.made))expect(a.distribution).toEqual(frozen.analyzeDecision(o,old).distribution);
   const neutral={...current,drawResponses:{gutshot:{flop:Array(7).fill(0),turn:Array(7).fill(0)}}};expect(analyzeDecision(now,neutral).distribution).toEqual(a.distribution);
  }
 });
 it('changes only specified draw class/street; preflop and unrelated conditions remain exact',()=>{
  const base=createProfile({selection:'tag'},92,'neutral'),changed={...base,drawResponses:{oesd:{turn:Array(7).fill(.8)}}};
  for(const s of scenarios()){
   const o=observeBot(s.state,s.state.actor!,base.policyVersion,'unchanged');const a=analyzeDecision(o,base),b=analyzeDecision(o,changed);
   if(o.street==='turn'&&drawResponseKind(a.features.drawClass)==='oesd')continue;
   expect(b.distribution,s.id).toEqual(a.distribution);
  }
  const g=fixture('oesd','turn',1),o=observeBot(g,0,base.policyVersion,'target');
  expect(analyzeDecision(o,changed).distribution.fold).toBeLessThan(analyzeDecision(o,base).distribution.fold);
 });
 it('executes100800 seeded conditional decisions across4draws×3streets×7prices×3curves with legal actions and uncertainty',()=>{
  const rows:unknown[]=[];let decisions=0;const totalContinued=[0,0,0];
  for(const kind of Object.keys(cards) as DrawResponseKind[])for(const street of ['flop','turn','river'] as DrawResponseStreet[])for(const fraction of DRAW_RESPONSE_POT_ANCHORS){
   const g=fixture(kind,street,fraction),profile=createProfile({selection:'tag'},555,'neutral'),o=observeBot(g,0,profile.policyVersion,`surface:${kind}:${street}:${fraction}`);
   const baseline=analyzeDecision(o,profile);expect(drawResponseKind(street==='river'?baseline.postflop!.runout.previousDrawClass:baseline.features.drawClass)).toBe(kind);
   if(street==='river'){expect(baseline.features.cleanOuts).toBe(0);expect(baseline.postflop!.runout.missedDraw).toBe(true);}
   const counts:number[]=[],probabilities:number[]=[];
   for(const offset of [-.75,0,.75]){
    const p={...profile,drawResponses:{[kind]:{[street]:Array(7).fill(offset)}}},countsByAction={fold:0,check:0,call:0,raise:0},seen=new Set<string>(),n=400;
    for(let seed=0;seed<n;seed++){
     const command=chooseDecision(o,p,seededRandom(17000+seed));countsByAction[command.action.type]++;decisions++;
     const a=command.action;if(a.type==='raise')expect(a.to>=o.legal.minRaiseTo!&&a.to<=o.legal.maxRaiseTo!).toBe(true);if(a.type==='check')expect(o.legal.check).toBe(true);
     const key=JSON.stringify(a);if(!seen.has(key)){seen.add(key);const next=applyCommand(g,command);assertAccounting(next);}
    }
    const continued=n-countsByAction.fold;totalContinued[counts.length]+=continued;counts.push(continued);probabilities.push(1-analyzeDecision(o,p).distribution.fold);
    rows.push({kind,street,potFraction:fraction,offset,opportunities:n,actions:countsByAction,continuation:continued/n,continuation95CI:wilson(continued,n),policyProbability:1-analyzeDecision(o,p).distribution.fold});
   }
   expect(probabilities[0],`${kind}/${street}/${fraction}`).toBeLessThan(probabilities[1]);expect(probabilities[1]).toBeLessThan(probabilities[2]);
   expect(counts[0]).toBeLessThanOrEqual(counts[1]);expect(counts[1]).toBeLessThanOrEqual(counts[2]);
  }
  expect(totalContinued[1]-totalContinued[0]).toBeGreaterThan(1000);expect(totalContinued[2]-totalContinued[1]).toBeGreaterThan(1000);expect(decisions).toBe(100800);mkdirSync('tests/step5b-bots/evidence',{recursive:true});writeFileSync(`tests/step5b-bots/evidence/draw-surfaces-${POLICY_VERSION}.json`,JSON.stringify({policy:POLICY_VERSION,decisions,method:'Matched seeded actual chooseDecision draws; denominator is decisions facing the stated priced bet with the stated private draw. Wilson95% conditional sampling intervals, not human calibration. Distinct action proposals also passed authoritative engine.',rows},null,2));
 },180000);
 it('negative curves never fold private nuts or misrepresent river draws as future equity',()=>{
  const s=scenarios().find(s=>s.id==='river-nuts')!,p=createProfile({selection:'stronger-reg',drawResponses:{combo:{river:Array(7).fill(-1)},flush:{river:Array(7).fill(-1)}}},82,'neutral');
  expect(analyzeDecision(observeBot(s.state,0,p.policyVersion,'nuts'),p).distribution.fold).toBe(0);
 });
});
