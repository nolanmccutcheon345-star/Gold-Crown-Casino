import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ARCHETYPES,defaultProfile,POLICY_VERSION} from '../../src/bots/profiles';
import {PREFLOP_CLASSES,PREFLOP_MODEL_VERSION,rangeWeights,type PreflopModifiers} from '../../src/bots/preflop';
import type {PreflopNode,PreflopPosition} from '../../src/bots/range-contract';
const positions:PreflopPosition[]=['UTG','MP','CO','BTN','SB','BB'];
const nodes:PreflopNode[]=['unopened','limped','facing-open','facing-3bet','facing-4bet'];
const depths=[20,40,60,100,150,200,250];
const round=(n:number)=>Number(n.toFixed(8));
/** All probabilities are unconditional within the stated synthetic class/context, not solved equity. */
export function buildPreflopRangeReport(archetypes:typeof ARCHETYPES=ARCHETYPES){
 const contexts=[];
 for(const archetype of archetypes)for(const position of positions)for(const node of nodes)for(const depthBB of depths){
  const callBB=Math.min(depthBB,node==='facing-4bet'?24:node==='facing-3bet'?10:node==='facing-open'?3:1);
  const modifiers:PreflopModifiers={seats:6,callBB,price:node==='unopened'?.4:node==='limped'?.2:.3,limpers:node==='limped'?2:0,coldCallers:0,squeeze:false,openerPosition:node.startsWith('facing')?'MP':null,rakeFraction:0};
  const rows=rangeWeights(defaultProfile(archetype),position,node,depthBB,modifiers);
  const mass=(key:'continueWeight'|'raiseWeight'|'callWeight')=>rows.reduce((sum,row)=>sum+row.comboCount*row[key],0)/1326;
  contexts.push({archetype,position,node,depthBB,modifiers,comboWeighted:{continue:round(mass('continueWeight')),raise:round(mass('raiseWeight')),call:round(mass('callWeight'))},classWeights:rows.map(r=>[round(r.continueWeight),round(r.raiseWeight),round(r.callWeight)])});
 }
 return {modelVersion:PREFLOP_MODEL_VERSION,policyVersion:POLICY_VERSION,evidence:'DESIGNED / SYNTHETIC / NOT HUMAN-VALIDATED',semantics:'classWeights[i] = [continueWeight, unconditionalRaiseWeight, unconditionalCallWeight]; each class is weighted by its 6/4/12 physical combinations. Advisory ranges before authoritative free-check/raise-closed constraints.',depthLimit:'20–300 BB interpolated; outside uses endpoint anchors.',classOrder:PREFLOP_CLASSES.map(c=>({handClass:c.handClass,comboCount:c.comboCount})),contexts};
}
describe('executable full169-class range matrix',()=>{
 const reports:ReturnType<typeof buildPreflopRangeReport>[]=[];
 // Each profile retains every position, node, depth and class assertion under the unchanged timeout.
 for(const archetype of ARCHETYPES)it(`${archetype}: all6positions×5nodes×7depths×169classes preserve weighted probability identities`,()=>{
  const report=buildPreflopRangeReport([archetype]);reports.push(report);expect(report.contexts).toHaveLength(210);
  for(const c of report.contexts){expect(c.classWeights).toHaveLength(169);for(const [continuation,raise,call] of c.classWeights){expect(continuation).toBeGreaterThanOrEqual(0);expect(continuation).toBeLessThanOrEqual(1);expect(raise).toBeGreaterThanOrEqual(0);expect(call).toBeGreaterThanOrEqual(0);expect(Math.abs(continuation-raise-call)).toBeLessThan(2e-8);}expect(Math.abs(c.comboWeighted.continue-c.comboWeighted.raise-c.comboWeighted.call)).toBeLessThan(2e-8);}
 });
 it('covers exactly every original context once and preserves the complete report',()=>{
  expect(reports).toHaveLength(8);
  const report={...reports[0],contexts:reports.flatMap(r=>r.contexts)};
  expect(report.contexts).toHaveLength(1680);
  const keys=report.contexts.map(c=>[c.archetype,c.position,c.node,c.depthBB].join('/'));
  expect(new Set(keys).size).toBe(1680);
  expect(keys).toEqual(ARCHETYPES.flatMap(a=>positions.flatMap(p=>nodes.flatMap(n=>depths.map(d=>[a,p,n,d].join('/'))))));
  expect(report.contexts.reduce((n,c)=>n+c.classWeights.length,0)).toBe(283920);
  const output=process.env.PREFLOP_RANGE_REPORT_DIR;
  if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,'preflop-169-depth-matrix.json'),JSON.stringify(report));
   const lines=['archetype,position,node,depth_bb,continue_probability,raise_probability,call_probability'];
   for(const c of report.contexts)lines.push([c.archetype,c.position,c.node,c.depthBB,c.comboWeighted.continue,c.comboWeighted.raise,c.comboWeighted.call].join(','));
   writeFileSync(join(output,'preflop-combo-weighted-summary.csv'),lines.join('\n')+'\n');
   console.log(`Recorded ${report.contexts.length} contexts and ${report.contexts.length*169} class rows in ${output}`);
  }
 });
});
