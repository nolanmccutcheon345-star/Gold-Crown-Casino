import {describe,it,expect} from 'vitest';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {summarizeConditionalResponse} from '../../src/stats/conditional';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import type {Action,Card,GameState} from '../../src/contracts';
function step(state:GameState,action:Action):GameState{return applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:`sparse-prefix:${state.handId}:${state.revision}`,action});}

describe('V705 conditional evidence cannot manufacture precision from sparse eligible nodes',()=>{
 it('reports nine actual legal gutshot-versus200%-pot opportunities as INSUFFICIENT_DATA with denominator and uncertainty',()=>{
  const rows=[];let calls=0;
  for(let seed=0;seed<9;seed++){
   const suits='cdhs',rotate=(c:Card)=>c[0]+suits[(suits.indexOf(c[1])+seed)%4];
   const own=['8c','7d'].map(rotate),board=['Jh','9s','2c','3d','Ks'].map(rotate),villain=['Ah','Ad'].map(rotate);
   let game=rig(startHand({handId:`V705-gutshot-${seed}`,button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`Seat ${id}`,stack:30000}))}),[own,villain],board);
   game=step(game,{type:'raise',to:1000});game=step(game,{type:'call'});expect(game.street).toBe('flop');const potBeforeBet=game.pot;expect(potBeforeBet).toBe(2000);
   game=step(game,{type:'raise',to:4000});expect(game.actor).toBe(0);expect(legalActions(game).callAmount/potBeforeBet).toBe(2);
   // Independently known ranks:7,8,9,J need a T only; four T cards remain
   // unseen in own+board, with no pair, flush draw or completed straight.
   expect([...own,...game.board].map(c=>c[0]).sort()).toEqual(['2','7','8','9','J']);expect([...own,...game.board].some(c=>c[0]==='T')).toBe(false);
   const profile=createProfile({selection:'stronger-reg'},1729,'neutral'),observation=observeBot(game,0,profile.policyVersion,`V705-decision-${seed}`),analysis=analyzeDecision(observation,profile);
   expect(analysis.features.drawClass).toBe('gutshot');expect(analysis.features.made).toBe(false);expect(analysis.context.betToPot).toBe(2);
   const decision=chooseDecision(observation,profile,seededRandom(0x70500+seed));calls+=Number(decision.action.type==='call');const after=applyCommand(game,decision);assertAccounting(after);
   rows.push({engineVersion:game.engineVersion,rules:game.profile,seed:0x70500+seed,opportunityId:observation.decisionId,ownCards:observation.ownCards,board:observation.board,potBeforeBet,potFacingBet:observation.pot,callCost:observation.legal.callAmount,betFraction:2,legal:observation.legal,publicActions:observation.publicEvents,action:decision.action,policyVersion:profile.policyVersion,independentStraightOutRanks:['T'],outCards:4});
  }
  const evidence=summarizeConditionalResponse(calls,rows.length);expect(evidence.status).toBe('INSUFFICIENT_DATA');expect(evidence.denominator).toBe(9);expect(evidence.numerator).toBe(calls);expect(evidence.observedPercent).toBeNull();expect(evidence.ci95Percent).not.toBeNull();expect(evidence.humanCalibrated).toBe(false);expect(evidence.uncertainty).toContain('not 0%');
  const evidenceDirectory=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(evidenceDirectory,{recursive:true});writeFileSync(resolve(evidenceDirectory,'V705-sparse.json'),JSON.stringify({requirement:'V705',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),executedAt:new Date().toISOString(),node:process.version,policyVersion:POLICY_VERSION,sourceSha256:Object.fromEntries(['src/stats/conditional.ts','src/bots/policy.ts','src/core/engine.ts','tests/step5b-statistics/conditional.test.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),expected:{status:'INSUFFICIENT_DATA',denominator:9,observedPercent:null,humanCalibrated:false},method:'Nine actual legal priced decision nodes, each with independently specified four-out gutshot and a bet equal to twice the pre-bet pot. One seeded policy sample per node. Controlled synthetic scenarios, not independently sampled human actions.',evidence,rows},null,2)+'\n');
 });
 it('reports zero observations as unknown, never a zero-frequency estimate',()=>{
  expect(summarizeConditionalResponse(0,0)).toMatchObject({status:'INSUFFICIENT_DATA',numerator:0,denominator:0,observedPercent:null,ci95Percent:null,humanCalibrated:false});
 });
 it('does not promote nine misses or nine successes to measured0%/100% or calibration',()=>{
  const zero=summarizeConditionalResponse(0,9,10),all=summarizeConditionalResponse(9,9,10);
  expect(zero.observedPercent).toBeNull();expect(all.observedPercent).toBeNull();expect(zero.ci95Percent![1]).toBeCloseTo(29.9145,3);expect(all.ci95Percent![0]).toBeCloseTo(70.0855,3);
  expect(zero.status).toBe('INSUFFICIENT_DATA');expect(all.status).toBe('INSUFFICIENT_DATA');
 });
 it('keeps well-sampled output descriptive and explicitly synthetic, without granting a calibrated badge',()=>{
  expect(summarizeConditionalResponse(50,100)).toMatchObject({status:'DESCRIPTIVE_SYNTHETIC',evidenceClass:'SYNTHETIC_FUNCTIONAL',observedPercent:50,minimumN:100,humanCalibrated:false});
  expect(summarizeConditionalResponse(50,100).ci95Percent![0]).toBeCloseTo(40.38315,4);
 });
 it.each([[0,9,0],[0,9,9],[0,9,9.5],[-1,9,10],[10,9,10],[1,2.5,10],[NaN,9,10],[0,Infinity,10]])('rejects invalid or weakened sparse evidence counts/thresholds %s/%s at%s',(count,n,minimum)=>{
  expect(()=>summarizeConditionalResponse(count,n,minimum)).toThrow();
 });
});
