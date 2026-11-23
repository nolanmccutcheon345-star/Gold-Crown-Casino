import {beforeAll,describe,it,expect} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import type {Archetype,Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,projectView} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {summarizeConditionalResponse} from '../../src/stats/conditional';
import {syntheticCalibrationStatus} from '../../src/stats/calibration';
import {act,checkDown,hand,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';

type Line='flop-call-turn-bet'|'limp-call-river-call'|'limp-call-river-bet';
type Holding='missed-gutshot-bluff'|'weak-top-pair-thin-value';
type Node={state:GameState;target:'call'|'check'|'raise';label:string};
const drawsPerIdentity=512,identitySeeds=[0x710b1,0x720c3,0x730d5,0x740e7];
const archetypes:Archetype[]=['station','tag','lag'];
/** Test-only controlled boards. Each decision receives its own private cards
 * and the actual already-dealt public prefix, never the future runout. */
function nodes(line:Line,holding:Holding):Node[]{
 const own:Card[]=holding==='missed-gutshot-bluff'?['Tc','8c']:['Qd','Jc'];
 const board:Card[]=['Qh','9h','2d','3s',holding==='missed-gutshot-bluff'?'Ks':'8s'];
 let g=rig(hand([40000,40000],0),[own,['Ac','Ad']],board);const result:Node[]=[];
 const add=(label:string,target:'call'|'check'|'raise')=>{expect(g.actor).toBe(0);result.push({state:g,label,target});};
 add('preflop limp','call');g=act(g,{type:'call'});g=act(g,{type:'raise',to:600});add('preflop call after limp','call');g=act(g,{type:'call'});
 g=act(g,{type:'raise',to:400});add('flop call','call');g=act(g,{type:'call'});
 if(line==='flop-call-turn-bet'){g=act(g,{type:'check'});add('turn bet after flop call','raise');return result.slice(2);}
 if(line==='limp-call-river-bet'){g=act(g,{type:'check'});add('turn check','check');g=act(g,{type:'check'});}
 else{g=act(g,{type:'raise',to:600});add('turn call','call');g=act(g,{type:'call'});}
 g=act(g,line==='limp-call-river-call'?{type:'raise',to:800}:{type:'check'});add(line==='limp-call-river-call'?'river call':'river bet',line==='limp-call-river-call'?'call':'raise');return result;
}
function phi(pa:number,pb:number,pab:number):number|null{const variance=pa*(1-pa)*pb*(1-pb);return variance>0?(pab-pa*pb)/Math.sqrt(variance):null;}
function measure(line:Line,holding:Holding,archetype:Archetype){
 const states=nodes(line,holding),m=states.length,n=identitySeeds.length*drawsPerIdentity;
 const reached=Array(m).fill(0) as number[],succeeded=Array(m).fill(0) as number[],firstDeviation=Array(m+1).fill(0) as number[];
 const expectedPrefix=Array(m).fill(0) as number[],expectedVariance=Array(m).fill(0) as number[],expectedConditionalMarginals=Array(m).fill(0) as number[];
 const raiseSizes=new Map<number,number>(),expectedRaiseSizes=new Map<number,number>();let decisions=0,example:ReturnType<typeof projectView>|null=null;
 const blocks=[];
 for(let identity=0;identity<identitySeeds.length;identity++){
  const profile=createProfile({selection:archetype},identitySeeds[identity],'neutral');
  const observations=states.map(node=>{const o=observeBot(node.state,0,profile.policyVersion,`fixture-${node.state.revision}`);o.rake=node.state.profile.rake;return o;});
  const analyses=observations.map(o=>analyzeDecision(o,profile));
  const probabilities=analyses.map((analysis,index)=>analysis.distribution[states[index].target]),prefix:number[]=[];let product=1;
  probabilities.forEach((probability,index)=>{product*=probability;prefix.push(product);expectedPrefix[index]+=product/identitySeeds.length;expectedVariance[index]+=drawsPerIdentity*product*(1-product);expectedConditionalMarginals[index]+=probability/identitySeeds.length;});
  const final=analyses.at(-1)!;
  if(line==='limp-call-river-bet'){
   if(holding==='missed-gutshot-bluff'){expect(final.features.handClass).toBe('high-card');expect(final.features.drawClass).toBe('none');expect(final.families.bluff).toBeGreaterThan(0);}
   else{expect(final.features.handClass).toBe('top-pair');expect(final.features.absoluteNuts).toBe(false);}
  }
  const blockReached=Array(m).fill(0) as number[],blockSucceeded=Array(m).fill(0) as number[],verifiedExactCalls=new Set<number>();
  for(let draw=0;draw<drawsPerIdentity;draw++){
   let completed=true;
   for(let index=0;index<m;index++){
    reached[index]++;blockReached[index]++;
    const decision=chooseDecision(observations[index],profile,seededRandom(0x510c9^Math.imul(draw+1,7919)^Math.imul(identity+1,104729)^Math.imul(index+1,524287)));
    const after=applyCommand(states[index].state,decision);assertAccounting(after);decisions++;
    if(decision.action.type!==states[index].target){firstDeviation[index]++;completed=false;break;}
    succeeded[index]++;blockSucceeded[index]++;
    if(decision.action.type!=='raise'&&!verifiedExactCalls.has(index)){expect(after).toEqual(act(states[index].state,decision.action));verifiedExactCalls.add(index);}
    if(index===m-1){
     if(decision.action.type==='raise')raiseSizes.set(decision.action.to,(raiseSizes.get(decision.action.to)??0)+1);
     if(example===null){const end=checkDown(after);assertAccounting(end);example=projectView(end,0);}
    }
   }
   if(completed)firstDeviation[m]++;
  }
  if(states.at(-1)!.target==='raise')for(const size of final.sizing)expectedRaiseSizes.set(size.raiseTo,(expectedRaiseSizes.get(size.raiseTo)??0)+prefix.at(-1)!*size.weight/identitySeeds.length);
  blocks.push({identitySeed:identitySeeds[identity],profileId:profile.personalityId,policyVersion:profile.policyVersion,starts:drawsPerIdentity,probabilities,prefixJointProbabilities:prefix,
   conditional:states.map((node,index)=>({label:node.label,opportunities:blockReached[index],successes:blockSucceeded[index],observed:summarizeConditionalResponse(blockSucceeded[index],blockReached[index]),expectedModelProbability:probabilities[index]})),
   lastHandFeatures:final.features,lastFamilies:final.families,rangeModelUncertainty:final.ranges?.uncertainty??null});
 }
 const observedPrefixes=succeeded.map(count=>count/n),jointObserved=observedPrefixes.at(-1)!,jointExpected=expectedPrefix.at(-1)!;
 // Fixed before sampling: six conditional standard errors plus three counts.
 // This is a permissive sampler-versus-its-model engineering check, not a
 // human realism threshold, simultaneous confidence bound or strategic test.
 const tolerance=Math.min(1,(6*Math.sqrt(expectedVariance.at(-1)!)+3)/n);
 const correlations=[];
 for(let i=0;i<m;i++)for(let j=i+1;j<m;j++){
  const observed=phi(observedPrefixes[i],observedPrefixes[j],observedPrefixes[j]),expected=phi(expectedPrefix[i],expectedPrefix[j],expectedPrefix[j]);
  correlations.push({prefixA:states[i].label,prefixB:states[j].label,starts:n,jointSurvivals:succeeded[j],observedPhi:observed,syntheticModelPhi:expected,deviation:observed===null||expected===null?null:observed-expected});
 }
 const terminals=firstDeviation.map((count,index)=>{const expected=index===m?jointExpected:(index===0?1:expectedPrefix[index-1])-expectedPrefix[index];return {outcome:index===m?'complete-target-line':`first-deviation-at-${states[index].label}`,count,starts:n,expectedProbability:expected,observedProbability:count/n,deviation:count/n-expected,evidence:summarizeConditionalResponse(count,n)};});
 return {line,holding,archetype,policyVersion:POLICY_VERSION,starts:n,decisions,identityBlocks:blocks,
  joint:{count:succeeded.at(-1)!,starts:n,observedProbability:jointObserved,syntheticModelProbability:jointExpected,absoluteDeviation:Math.abs(jointObserved-jointExpected),tolerance,
   evidence:summarizeConditionalResponse(succeeded.at(-1)!,n),label:syntheticCalibrationStatus(n,100,{reference:`${POLICY_VERSION} conditional action model product within each fixed identity, then equal-weight identity mixture`,observedProbability:jointObserved,expectedProbability:jointExpected,maximumAbsoluteDeviation:tolerance}),
   pooledMarginalProduct:expectedConditionalMarginals.reduce((a,b)=>a*b,1),deviationFromPooledMarginalIndependence:jointExpected-expectedConditionalMarginals.reduce((a,b)=>a*b,1)},
  conditional:states.map((node,index)=>({label:node.label,street:node.state.street,target:node.target,opportunities:reached[index],successes:succeeded[index],observed:summarizeConditionalResponse(succeeded[index],reached[index]),
   syntheticConditionalProbability:expectedPrefix[index]/(index===0?1:expectedPrefix[index-1]),prefixJointProbability:expectedPrefix[index],observedPrefixProbability:observedPrefixes[index],absolutePrefixDeviation:Math.abs(observedPrefixes[index]-expectedPrefix[index]),prefixTolerance:Math.min(1,(6*Math.sqrt(expectedVariance[index])+3)/n)})),
  firstDeviationDistribution:terminals,prefixCorrelations:correlations,
  correlationDefinition:'Pearson/phi between nested target-prefix completion indicators among all seeded starts; this includes survival dependence, not unconditional psychological action correlation. Reference uses exact conditional model products, retaining the fixed identity mixture.',
  finalBetSizes:[...new Set([...raiseSizes.keys(),...expectedRaiseSizes.keys()])].sort((a,b)=>a-b).map(raiseTo=>({raiseTo,count:raiseSizes.get(raiseTo)??0,starts:n,observedJointProbability:(raiseSizes.get(raiseTo)??0)/n,syntheticJointProbability:expectedRaiseSizes.get(raiseTo)??0})),
  nodes:states.map(({state,target,label})=>({label,target,handId:state.handId,street:state.street,board:state.board,ownCards:state.seats[0].hole,pot:state.pot,stacks:state.seats.map(s=>({id:s.id,stack:s.stack,streetCommitted:s.streetCommitted,totalCommitted:s.totalCommitted})),legal:legalActions(state),publicEvents:state.events})),
  completedExample:example,
 };
}
type Row=ReturnType<typeof measure>;
const rows:Row[]=[];
beforeAll(()=>{
 for(const line of ['flop-call-turn-bet','limp-call-river-call','limp-call-river-bet'] as const)for(const holding of ['missed-gutshot-bluff','weak-top-pair-thin-value'] as const)for(const archetype of archetypes)rows.push(measure(line,holding,archetype));
 const out=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(out,{recursive:true});
 writeFileSync(resolve(out,`joint-lines-${POLICY_VERSION}.json`),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),policyVersion:POLICY_VERSION,at:new Date().toISOString(),
  sourceSha256:Object.fromEntries(['src/bots/policy.ts','src/bots/strategy.ts','src/stats/calibration.ts','tests/step5b-statistics/joint-lines.test.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),
  requirements:['R17','Y08'],humanBenchmark:'UNAVAILABLE: no licensed human action-level benchmark, independent expert assessment or solver reference used.',
  method:'18 matched legal conditional lines ×4 stable synthetic personalities ×512 independently salted seeded starts. Earlier exact calls/checks retain the canonical legal state; an actual sampled first deviation terminates that target-line trial. All sampled actions/sizes are applied to the authoritative engine and chip-audited. The final target bet accepts every legal sampled size. Opponent prefixes are controlled interventions, not natural population frequencies.',
  uncertainty:'95% Wilson intervals describe seeded trials conditional on fixed contexts/personality blocks. These 36,864 synthetic starts are not independent observed human opportunities. Sparse conditional nodes suppress percentages below N=100; exact counts remain. Model probabilities are the current declared policy, not independent strategic truth. Reported phi uses nested prefix survival; no human strategic plausibility or calibration is inferred.',
  completedExampleMethod:'One successful sampled target line per row, when observed, followed by deterministic legal check/call completion for payout inspection. Not a fully autonomous opponent-population game.',
  totalStarts:rows.reduce((sum,row)=>sum+row.starts,0),sampledLegalDecisions:rows.reduce((sum,row)=>sum+row.decisions,0),completedExamples:rows.filter(row=>row.completedExample!==null).length,rows,
 },null,2)+'\n');
},120000);

describe('R17/Y08 actual joint-line distributions versus explicit synthetic model',()=>{
 it('records both required R17 sequences with conditional rather than marginal denominators',()=>{
  for(const line of ['flop-call-turn-bet','limp-call-river-call']){
   const selected=rows.filter(row=>row.line===line);expect(selected).toHaveLength(6);
   for(const row of selected){expect(row.conditional[0].opportunities).toBe(row.starts);for(let i=1;i<row.conditional.length;i++)expect(row.conditional[i].opportunities).toBe(row.conditional[i-1].successes);}
  }
 });
 it('Y08 covers preflop through river for explicit missed-draw bluff and thin-value states',()=>{
  const selected=rows.filter(row=>row.line==='limp-call-river-bet');expect(selected).toHaveLength(6);
  for(const row of selected){expect(row.conditional.map(node=>node.street)).toEqual(['preflop','preflop','flop','turn','river']);expect(row.prefixCorrelations).toHaveLength(10);}
  expect(selected.filter(row=>row.holding==='weak-top-pair-thin-value').some(row=>row.identityBlocks.some(block=>(block.lastFamilies.thinValue??0)>0))).toBe(true);
  expect(selected.filter(row=>row.holding==='missed-gutshot-bluff').every(row=>row.identityBlocks.every(block=>block.lastFamilies.bluff>0))).toBe(true);
 });
 it('reports exact joint likelihood, first-deviation distribution, correlations and deviations from the conditional model for every row',()=>{
  for(const row of rows){
   expect(row.firstDeviationDistribution.reduce((sum,event)=>sum+event.count,0)).toBe(row.starts);expect(row.firstDeviationDistribution.reduce((sum,event)=>sum+event.expectedProbability,0)).toBeCloseTo(1,12);
   expect(row.joint.absoluteDeviation,`${row.line}/${row.holding}/${row.archetype}`).toBeLessThanOrEqual(row.joint.tolerance);
   for(const node of row.conditional)expect(node.absolutePrefixDeviation,`${row.line}/${row.holding}/${row.archetype}/${node.label}`).toBeLessThanOrEqual(node.prefixTolerance);
   expect(row.joint.label.status).toBe('SYNTHETIC_MODEL_MATCHED');expect(row.joint.label.humanCalibrated).toBe(false);
   for(const correlation of row.prefixCorrelations)if(correlation.observedPhi!==null)expect(Math.abs(correlation.observedPhi)).toBeLessThanOrEqual(1.000000000001);
  }
 });
 it('keeps full target-line probabilities separate from multiplying pooled action marginals',()=>{
  expect(rows.some(row=>Math.abs(row.joint.deviationFromPooledMarginalIndependence)>1e-8)).toBe(true);
  for(const row of rows){const expected=row.identityBlocks.reduce((sum,block)=>sum+block.probabilities.reduce((a,b)=>a*b,1)/identitySeeds.length,0);expect(row.joint.syntheticModelProbability).toBeCloseTo(expected,14);}
 });
 it('records actually completed examples, exact settlement and legal bet sizing without promoting synthetic evidence to human fit',()=>{
  const examples=rows.filter(row=>row.completedExample!==null);expect(examples.length).toBeGreaterThan(0);
  for(const row of rows){
   const end=row.completedExample;if(end){expect(end.street).toBe('complete');expect(end.pot).toBe(0);expect(end.seats.reduce((sum,seat)=>sum+seat.stack,0)+end.rake).toBe(80000);expect(Object.values(end.payouts).reduce((sum,value)=>sum+value,0)).toBe(end.pots.reduce((sum,pot)=>sum+pot.amount,0));}
   if(row.line!=='limp-call-river-call')expect(row.finalBetSizes.reduce((sum,size)=>sum+size.count,0)).toBe(row.joint.count);
   expect(row.joint.label).toMatchObject({humanCalibrated:false,expertReviewed:false,solverVerified:false});
  }
 });
});
