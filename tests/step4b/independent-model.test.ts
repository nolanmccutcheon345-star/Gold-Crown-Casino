import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BotObservation, Card } from '../../src/contracts';
import { ARCHETYPES, createProfile } from '../../src/bots/policy';
import { analyzePreflop, classifyStartingHand, combosForClass, enumerateStartingCombos, rangeWeights } from '../../src/bots/preflop';
import { analyzeRanges, publicActionLikelihoods } from '../../src/bots/ranges';
import { observeBot } from '../../src/core/engine';
import { allHandClasses, firstIn } from './preflop-fixtures';
import { sequenceFixtures } from './sequence-fixtures';
const comboKey=(cards:readonly Card[])=>[...cards].sort().join('');
const p=()=>createProfile({selection:'stronger-reg'},1011,'neutral');
function observed(id:string):BotObservation{const f=sequenceFixtures().find(f=>f.id===id)!;const o=observeBot(f.state,f.focusSeat,p().policyVersion,`independent:${id}`);o.rake=f.state.profile.rake;return o;}

describe('Step4B independently enumerated class and public-range coherence',()=>{
 it('matches the independent 1326-combination enumerator exactly, including known dead cards',()=>{
  const independent=allHandClasses();
  for(const group of independent){
   expect(combosForClass(group.label).map(comboKey).sort()).toEqual(group.combos.map(comboKey).sort());
   for(const cards of group.combos)expect(classifyStartingHand(cards)).toBe(group.label);
  }
  for(const dead of [[],['As'],['As','Kh','2c','Td','9h']]){
   const actual=enumerateStartingCombos(dead).map(c=>comboKey(c.cards)).sort();
   const expected=independent.flatMap(c=>c.combos).filter(cards=>!cards.some(c=>dead.includes(c))).map(comboKey).sort();
   expect(actual).toEqual(expected);expect(new Set(actual).size).toBe((52-dead.length)*(51-dead.length)/2);
  }
 });
 it('combo-weighted published ranges equal actual legal UTG/BTN decision masses for all eight profiles',()=>{
  const groups=allHandClasses();
  for(const archetype of ARCHETYPES)for(const [position,expectedPosition]of [['early','UTG'],['button','BTN']] as const){
   const profile=createProfile({selection:archetype},1001+ARCHETYPES.indexOf(archetype),'neutral');
   const actual={raise:0,call:0,enter:0};
   for(const group of groups){
    const state=firstIn(group.combos[0],position);const o=observeBot(state,state.actor!,profile.policyVersion,group.label);const d=analyzePreflop(o,profile);
    expect(d.position).toBe(expectedPosition);expect(d.node).toBe('unopened');
    actual.raise+=group.weight*d.distribution.raise/1326;actual.call+=group.weight*d.distribution.call/1326;actual.enter+=group.weight*(1-d.distribution.fold)/1326;
   }
   // 1BB faced / (1.5BB existing pot + 1BB call), independently derived from posted blinds.
   const weights=rangeWeights(profile,expectedPosition,'unopened',100,{seats:6,callBB:1,price:.4});
   expect(actual.raise).toBeCloseTo(weights.reduce((n,w)=>n+w.comboCount*w.raiseWeight/1326,0),12);
   expect(actual.call).toBeCloseTo(weights.reduce((n,w)=>n+w.comboCount*w.callWeight/1326,0),12);
   expect(actual.enter).toBeCloseTo(weights.reduce((n,w)=>n+w.comboCount*w.continueWeight/1326,0),12);
  }
 });
 it('every actual legal sequence has compatible normalized positive active and folded posteriors and exact update IDs',()=>{
  for(const f of sequenceFixtures()){
   const o=observeBot(f.state,f.focusSeat,p().policyVersion,`range:${f.id}`),r=analyzeRanges(o,p());const known=[...o.ownCards,...o.board];
   for(const range of [...r.opponents,...(r.foldedOpponents??[])]){
    expect(range.combos).toHaveLength((52-known.length)*(51-known.length)/2);
    expect(new Set(range.combos.map(c=>comboKey(c.cards))).size).toBe(range.combos.length);
    expect(range.combos.every(c=>c.weight>0&&Number.isFinite(c.weight)&&c.cards.every(x=>!known.includes(x)))).toBe(true);
    expect(range.combos.reduce((n,c)=>n+c.weight,0)).toBeCloseTo(1,11);
    expect(range.updates.map(u=>u.eventId)).toEqual(o.publicEvents.filter(e=>e.type==='action'&&e.seatId===range.seatId).map(e=>e.id));
    for(const update of range.updates){const likelihood=publicActionLikelihoods(o,p(),range.seatId,update.eventId,range.combos[17].cards);expect(Object.values(likelihood).reduce((n,v)=>n+v,0)).toBeCloseTo(1,12);}
   }
   expect(r.equity).toBeGreaterThanOrEqual(0);expect(r.equity).toBeLessThanOrEqual(1);expect(r.uncertainty).toBeGreaterThan(0);
  }
 });
 it('range inference ignores hidden-card/profile getters and event payloads and is invariant to secret substitutions',()=>{
  const baseline=observed('deep-river-pressure'),poisoned=structuredClone(baseline);
  for(const key of ['deck','futureBoard','heroCards','privateProfiles'])Object.defineProperty(poisoned,key,{get(){throw Error(`Illegal secret read:${key}`);}});
  for(const s of poisoned.seats)Object.defineProperty(s,'hole',{get(){throw Error('Illegal hole-card read');}});
  for(const e of poisoned.publicEvents)Object.defineProperty(e,'private',{get(){throw Error('Illegal event metadata read');}});
  expect(analyzeRanges(poisoned,p())).toEqual(analyzeRanges(baseline,p()));
  const changed=structuredClone(baseline);Object.assign(changed,{deck:['Ac','Ad'],privateProfiles:[{archetype:'maniac'}],heroCards:['2c','3d']});
  expect(analyzeRanges(changed,p())).toEqual(analyzeRanges(baseline,p()));
 });
 it('two public observations retain substantial model uncertainty separately from finite Monte Carlo error',()=>{
  const o=observed('single-raised-headsup'),base=analyzeRanges(o,p());const id=o.seats.find(s=>s.id!==o.actingSeat)!.id;
  o.memory={windowHands:2,opponents:[{seatId:id,hands:2,vpip:{count:2,opportunities:2},pfr:{count:2,opportunities:2},aggression:{count:2,opportunities:2},foldToBet:{count:0,opportunities:2},showdowns:[]}]};
  const sparse=analyzeRanges(o,p());expect(sparse.uncertainty).toBeGreaterThan(.3);expect(base.uncertainty-sparse.uncertainty).toBeLessThan(.05);
  expect(sparse.equitySamples).toBeGreaterThan(0);expect(sparse.equityStdError).toBeGreaterThanOrEqual(0);expect(sparse.assumptions.join(' ')).toContain('excludes rake');
 });
 it('writes one reproducible full posterior vector rather than substituting private truth when requested',()=>{
  const o=observed('deep-river-pressure');const result=analyzeRanges(o,p());
  if(process.env.STEP4B_EVALUATE==='1'){const directory=resolve(process.env.STEP4B_REPORT_DIR??'tests/step4b/artifacts');mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'representative-full-range.json'),JSON.stringify({label:'Synthetic public posterior, not actual opponent cards or solved range',observation:o,profile:p(),result},null,2)+'\n');}
  // Opponent: preflop call; flop check/call; turn check/call; river lead.
  expect(result.opponents[0].observedActions).toBe(6);
 });
});
