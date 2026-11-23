import {describe,it,expect} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {reviewCalibrationSource,requireEmpiricalCalibration,syntheticCalibrationStatus} from '../../src/stats/calibration';
import {summarizeConditionalResponse} from '../../src/stats/conditional';
import {POLICY_VERSION} from '../../src/bots/policy';

/** Deliberately fabricated documentary fixture, not a real human dataset. Even
 * this apparently complete metadata must NOT authorize empirical activation. */
function completeMetadata(){return {
 kind:'human-action-opportunities',opportunityCount:4,
 actionRecords:[0,1,2,3].map(index=>({id:`opportunity-${index}`,playerId:`player-${index}`,sessionId:`session-${index}`,venueId:index<2?'train-venue':'test-venue',stratum:'river-small',street:'river',legalActions:['fold','call','raise'],action:index%2?'fold':'call'})),
 provenance:{citation:'FABRICATED TEST METADATA ONLY',collectionMethod:'Illustrative eligible legal-action opportunities',collectedAt:'2026-01-01T00:00:00Z',contentHash:'a'.repeat(64)},
 rights:{license:'Illustrative action-modeling permission',actionModelingPermitted:true,consentOrLawfulBasis:'Illustrative consent record',evidenceReference:'fixture-not-real-consent'},
 population:{observed:'fixture-low-stakes',target:'fixture-low-stakes',matchEvidence:'fixture-context-table'},
 stratification:[{id:'river-small',street:'river',betSize:'25% pot',board:'unpaired rainbow',stake:'1/2',opportunities:4}],
 holdout:{protocolReference:'fixture-preregistered-protocol',independent:true,train:{players:['player-0','player-1'],sessions:['session-0','session-1'],venues:['train-venue']},test:{players:['player-2','player-3'],sessions:['session-2','session-3'],venues:['test-venue']}},
 metrics:{protocolReference:'fixture-metrics',holdoutOpportunities:2,predictiveLoss:.6,baselineLoss:.7,uncertainty:'Illustrative uncertainty only',resultReference:'fixture-results'},
};}
const reviews:unknown[]=[];
function writeEvidence(){const out=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'calibration-guards.json'),JSON.stringify({
 sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),policyVersion:POLICY_VERSION,at:new Date().toISOString(),
 sourceSha256:Object.fromEntries(['src/stats/calibration.ts','src/stats/conditional.ts','tests/step5b-statistics/calibration-guards.test.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),
 claim:'Executable source/label guard only. No human data loaded, no rights verified, no calibration fit, expert assessment or solver validation.',reviews,
},null,2)+'\n');}

describe('V417/Y12 numerical and prospective-source calibration label guards',()=>{
 it('Y12 rejects cited published performance research as action-frequency calibration without importing or inventing action records',()=>{
  const qualitative=readFileSync('TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md','utf8');expect(qualitative).toContain('Beyond Chance? The Persistence of Performance in Online Poker');
  const source={kind:'performance-research',citation:'Beyond Chance? The Persistence of Performance in Online Poker (2015)',projectReview:'TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md',aggregateMetrics:{pokerPerformance:'research outcome summary only'},claimedLabel:'EMPIRICAL_CALIBRATED'};
  const before=JSON.stringify(source),review=reviewCalibrationSource(source);expect(review.status).toBe('REJECTED');expect(review.empiricalLabelAllowed).toBe(false);expect(review.recordedOpportunities).toBe(0);
  for(const phrase of ['action-level','legal opportunity denominators','provenance','license/permission','population','stratification','holdout','metrics'])expect(review.missing.join(' ')).toContain(phrase);
  expect(()=>requireEmpiricalCalibration(source)).toThrow('rejected');expect(JSON.stringify(source)).toBe(before);reviews.push({criterion:'Y12',source,review});
 });
 it.each(['kind','records','duplicate-record','illegal-action','counts','provenance','license','consent','population','strata','stratum-street','holdout','holdout-overlap','metrics','metrics-nan'] as const)('V417 rejects empirical activation with missing or inconsistent %s',problem=>{
  const source=completeMetadata();
  if(problem==='kind')source.kind='synthetic';if(problem==='records')source.actionRecords=[];if(problem==='counts')source.opportunityCount++;
  if(problem==='duplicate-record')source.actionRecords[1]=source.actionRecords[0];if(problem==='illegal-action'){source.actionRecords[0].action='reported-profit';source.actionRecords[0].legalActions=['reported-profit'];}
  if(problem==='provenance')source.provenance.contentHash='missing';if(problem==='license')source.rights.actionModelingPermitted=false;if(problem==='consent')source.rights.consentOrLawfulBasis='';
  if(problem==='population')source.population.target='different-population';if(problem==='strata')source.stratification[0].opportunities++;
  if(problem==='stratum-street')source.stratification[0].street='flop';
  if(problem==='holdout')source.holdout.independent=false;if(problem==='holdout-overlap')source.holdout.test.players.push(source.holdout.train.players[0]);
  if(problem==='metrics')source.metrics.uncertainty='';if(problem==='metrics-nan')source.metrics.predictiveLoss=NaN;
  const review=reviewCalibrationSource(source);expect(review.status).toBe('REJECTED');expect(review.missing.length).toBeGreaterThan(0);expect(()=>requireEmpiricalCalibration(source)).toThrow('rejected');reviews.push({criterion:'V417',problem,review});
 });
 it('complete-looking claims require independent review and never grant a forged empirical capability',()=>{
  const metadata=completeMetadata(),review=reviewCalibrationSource({...metadata,humanValidated:true,empiricalLabelAllowed:true});
  expect(review).toMatchObject({status:'REQUIRES_INDEPENDENT_REVIEW',empiricalLabelAllowed:false,eligibleForActionFrequencyCalibration:false,missing:[]});expect(()=>requireEmpiricalCalibration(metadata)).toThrow('not enabled');
  expect(()=>requireEmpiricalCalibration(structuredClone(review))).toThrow('rejected');reviews.push({criterion:'V417',problem:'complete-looking metadata is not proof',review});
 });
 it('a large synthetic sample can earn only explicitly named synthetic model agreement, never human/expert/solver labels',()=>{
  for(const n of [100,10000,2_000_000_000]){
   const status=syntheticCalibrationStatus(n,100,{reference:'TEST synthetic expected action probability',observedProbability:.25,expectedProbability:.25,maximumAbsoluteDeviation:.01});
   expect(status).toMatchObject({status:'SYNTHETIC_MODEL_MATCHED',humanCalibrated:false,expertReviewed:false,solverVerified:false,source:'SYNTHETIC'});
   const reporter=summarizeConditionalResponse(n/4,n);expect(reporter.calibration).toMatchObject({status:'DESCRIPTIVE_SYNTHETIC',humanCalibrated:false});reviews.push({criterion:'V417',n,status,reporter});
  }
 });
 it('keeps sparse/model-mismatch outcomes explicit and refuses invalid numerical or missing-reference promotions',()=>{
  expect(syntheticCalibrationStatus(9,100,{reference:'test',observedProbability:1,expectedProbability:1,maximumAbsoluteDeviation:0}).status).toBe('INSUFFICIENT_DATA');
  expect(syntheticCalibrationStatus(1000,100,{reference:'test',observedProbability:.9,expectedProbability:.1,maximumAbsoluteDeviation:.01}).status).toBe('SYNTHETIC_MODEL_MISMATCH');
  for(const n of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>syntheticCalibrationStatus(n)).toThrow();
  for(const value of [-1,1.1,NaN,Infinity])expect(()=>syntheticCalibrationStatus(100,100,{reference:'test',observedProbability:value,expectedProbability:0,maximumAbsoluteDeviation:.1})).toThrow();
  expect(()=>syntheticCalibrationStatus(100,1)).toThrow();expect(()=>syntheticCalibrationStatus(100,100,{reference:'',observedProbability:0,expectedProbability:0,maximumAbsoluteDeviation:.1})).toThrow();writeEvidence();
 });
});
