import { describe, expect, it } from 'vitest';
import { ARCHETYPES, analyzeDecision, createProfile, handFeatures } from '../../src/bots/policy';
import { observeBot } from '../../src/core/engine';
import { hand } from '../verification/helpers';
import { scenarios, step } from './scenarios';

describe('Independent regressions for observed policy degeneracy',()=>{
 it('unopened AA and the absolute royal-flush nuts do not acquire a personality-driven fold probability',()=>{
  for(const probe of scenarios().filter(s=>['unopened-aa','threebet-aa','river-nuts'].includes(s.id)))for(const archetype of ARCHETYPES){
   const profile=createProfile({selection:archetype},991,'neutral');const observation=observeBot(probe.state,probe.state.actor!,profile.policyVersion,`regression:${probe.id}`);
   expect(analyzeDecision(observation,profile).distribution.fold,`${probe.id}/${archetype}`).toBe(0);
  }
 });
 it('shared board trips, two pairs and quads with a weak private kicker are not treated as private monsters',()=>{
  const privateSet=handFeatures(['Ad','Ac'],['As','Kh','7d']);
  for(const board of [['As','Ah','Ac'],['As','Ah','Ks','Kh'],['As','Ah','Ac','Ad']]){
   const shared=handFeatures(['2d','3c'],board);expect(shared.strength).toBeLessThan(privateSet.strength);expect(shared.strength).toBeLessThan(.65);
  }
 });
 it('duplicating a public straight-draw rank does not create a private straight draw; river misses have no remaining outs',()=>{
  expect(handFeatures(['9c','2d'],['6h','7d','8s','9h']).draw).toBe(0);
  expect(handFeatures(['As','2d'],['Ac','2c','3h','4d']).draw).toBe(0);
  expect(handFeatures(['Ah','Kh'],['Qh','7h','2c','8d','3s']).draw).toBe(0);
 });
 it('effective callable stack remains positive when facing an opponent who has already shoved',()=>{
  let state=hand([20000,20000]);state=step(state,{type:'call'});state=step(state,{type:'raise',to:20000});
  const profile=createProfile({selection:'tag'},71,'neutral');const o=observeBot(state,0,profile.policyVersion,'all-in-exposure');
  expect(o.legal.callAmount).toBe(19800);expect(analyzeDecision(o,profile).context.effectiveStackBB).toBeGreaterThanOrEqual(99);
 });
 it('heads-up big blind and both three-handed blinds are labeled as blinds rather than late seats',()=>{
  const profile=createProfile({selection:'tag'},71,'neutral');let headsUp=hand([20000,20000]);headsUp=step(headsUp,{type:'call'});
  expect(analyzeDecision(observeBot(headsUp,1,profile.policyVersion,'HU-BB'),profile).context.position).toBe('blinds');
  let three=hand([20000,20000,20000]);three=step(three,{type:'call'});
  expect(analyzeDecision(observeBot(three,1,profile.policyVersion,'three-SB'),profile).context.position).toBe('blinds');three=step(three,{type:'call'});
  expect(analyzeDecision(observeBot(three,2,profile.policyVersion,'three-BB'),profile).context.position).toBe('blinds');
 });
 it('competent profiles use private AA opening value and terminal private nuts when a raise is legal',()=>{
  for(const archetype of ['tag','stronger-reg'] as const)for(const id of ['unopened-aa','river-nuts']){
   const probe=scenarios().find(s=>s.id===id)!;const profile=createProfile({selection:archetype},1001+(archetype==='tag'?2:7),'neutral');
   const observation=observeBot(probe.state,probe.state.actor!,profile.policyVersion,`value:${id}`);expect(observation.legal.canRaise).toBe(true);
   expect(analyzeDecision(observation,profile).distribution.raise).toBeGreaterThanOrEqual(id==='unopened-aa'?.9:.95);
  }
 });
 it('distinguishes weak four-suit flushes and shared board full houses from private nuts',()=>{
  const p=createProfile({selection:'stronger-reg'},1008,'neutral');const analysis=(id:string)=>{const s=scenarios().find(s=>s.id===id)!.state;return analyzeDecision(observeBot(s,s.actor!,p.policyVersion,id),p);};
  const dirty=analysis('river-dirty-flush'),nuts=analysis('river-nut-flush');expect(dirty.features.strength).toBeLessThan(nuts.features.strength);expect(dirty.distribution.fold).toBeGreaterThan(nuts.distribution.fold);
  const board=analysis('river-shared-fullhouse'),privateQuads=analysis('river-private-quads');expect(board.features.playsBoard).toBe(true);expect(privateQuads.features.playsBoard).toBe(false);
  expect(board.features.strength).toBeLessThan(privateQuads.features.strength);
 });
});
