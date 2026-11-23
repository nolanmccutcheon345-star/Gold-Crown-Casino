import {describe,it,expect} from 'vitest';
import {migrateData,publicHistory,parsePublicHistory,seal} from '../../src/storage/integrity';
import fixture from '../step36/fixtures/populated-v3.json';
describe('Step4B range diagnostics stay private in public history',()=>{
 it('exports no private policy, memory or advisory range data',async()=>{
  const d=await migrateData(fixture.streets.river),history=await publicHistory(d.hands);
  expect(JSON.stringify(history)).not.toMatch(/privateProfiles|ranges|diagnostics|distribution|personalitySeed|drawToken/);
  expect(await parsePublicHistory(JSON.stringify(history))).toEqual(history.hands);
 });
 it.each(['ranges','foldedOpponents','rangeAnalysis','weightedCombos','distribution','diagnostics','preflop'])('rejects injected private %s even with a valid hash',async key=>{
  const d=await migrateData(fixture.streets.river),history=await publicHistory(d.hands);
  Object.assign(history.hands[0],{[key]:{privateSignal:.5}});history.hands[0]=await seal(history.hands[0]);
  await expect(parsePublicHistory(JSON.stringify(history))).rejects.toThrow(/Private information/);
 });
});
