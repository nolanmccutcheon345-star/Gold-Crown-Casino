import {describe,expect,it} from 'vitest';
import {contestablePricing} from '../../src/bots/pricing';
import {contestablePricing as historicalPricing} from '../../src/bots/v3/pricing';
import {decisionContext} from '../../src/bots/features';
import {analyzeDecision} from '../../src/bots/strategy';
import {defaultProfile} from '../../src/bots/profiles';
import {assertAccounting} from '../../src/core/engine';
import {action,observation,shortStackOverbet,multiwaySidePot} from './fixtures';
describe('independent short-call pricing audit',()=>{
 it('prices a legal 3800c call against its 8000c contestable pot, excluding16000c uncalled',()=>{
  const state=shortStackOverbet(),o=observation(state);
  expect(o.pot).toBe(20200);expect(o.legal.callAmount).toBe(3800);
  expect(decisionContext(o).price).toBe(.475);
  expect(analyzeDecision(o,defaultProfile('stronger-reg')).postflop).toMatchObject({modelVersion:'public-range-postflop-1.6.0',rakeAdjustedPrice:.475,contestableAfterCall:8000,excludedChips:16000});
 });
 it('distinguishes the actual49.5-pot overbet from the stack-capped call',()=>{
  expect(decisionContext(observation()).betToPot).toBe(49.5);
 });
 it('the existing engine independently returns the16000c excess and settles exactly8000c',()=>{
  const s=action(shortStackOverbet(),{type:'call'});assertAccounting(s);
  expect(s.street).toBe('complete');expect(s.events.filter(e=>e.type==='refund').map(e=>e.amount)).toEqual([16000]);
  expect(s.events.filter(e=>e.type==='award').reduce((sum,e)=>sum+(e.amount??0),0)).toBe(8000);
  expect(s.seats.map(s=>s.stack)).toEqual([8000,16000]);expect(s.pot).toBe(0);
 });
});

describe('contestable exposure and rake without chip authority',()=>{
 it('prices the short caller against6000c, not the inaccessible6000c side pot',()=>{
  const s=multiwaySidePot(),o=observation(s),pricing=contestablePricing(o);
  expect(o.pot).toBe(11000);expect(o.legal.callAmount).toBe(1000);
  expect(pricing).toEqual({callAmount:1000,contestableAfterCall:6000,excludedChips:6000,price:1/6,rakeAdjustedPrice:1/6,estimatedRake:0});
  const settled=action(s,{type:'call'});assertAccounting(settled);
  expect(settled.pots.map(p=>p.amount)).toEqual([6000,6000]);
  expect(settled.payouts).toEqual({0:6000,1:6000});
 });
 it('applies the capped practice rake once on all matched chips, from the main pot first',()=>{
  const s=multiwaySidePot(true),pricing=contestablePricing(observation(s));
  expect(pricing.estimatedRake).toBe(500);expect(pricing.rakeAdjustedPrice).toBe(1000/5500);
  const settled=action(s,{type:'call'});assertAccounting(settled);
  expect(settled.rake).toBe(500);expect(settled.payouts).toEqual({0:5500,1:6000});
 });
 it('excludes returned excess from uncapped rake and honors no-flop-no-drop',()=>{
  const o=observation();o.rake={basisPoints:500,cap:10000,noFlopNoDrop:true};
  expect(contestablePricing(o).estimatedRake).toBe(400);
  expect(contestablePricing(o).rakeAdjustedPrice).toBe(.5);
  o.board=[];o.street='preflop';
  // Step5A proves this call forces a flop: retain historical1.2 evidence and
  // require the corrected current forecast. Reachable fixtures live in step5a-pricing.
  expect(historicalPricing(o).estimatedRake).toBe(0);expect(contestablePricing(o).estimatedRake).toBe(400);
  o.rake.noFlopNoDrop=false;expect(contestablePricing(o).estimatedRake).toBe(400);
 });
 it('counts the own call once, retains equal-stack prices, and does not count dead money above the cap',()=>{
  const o=observation();o.seats[1].totalCommitted=600;o.seats[1].streetCommitted=400;
  o.pot=800;o.legal.callAmount=400;o.seats[0].stack=3800;
  expect(contestablePricing(o)).toMatchObject({contestableAfterCall:1200,price:1/3,excludedChips:0});
  const multi=observation(multiwaySidePot());multi.seats[2].folded=true;
  expect(contestablePricing(multi)).toMatchObject({contestableAfterCall:6000,excludedChips:6000,price:1/6});
 });
 it('is read-only and never reads hidden deck, hole cards, profiles, or outcomes',()=>{
  const o=observation(),copy=structuredClone(o);
  for(const key of ['deck','heroCards','privateProfiles','payouts'])Object.defineProperty(o,key,{get(){throw new Error('Forbidden'+key);}});
  for(const seat of o.seats)Object.defineProperty(seat,'hole',{get(){throw new Error('Forbidden hole');}});
  expect(contestablePricing(o)).toEqual(contestablePricing(copy));
  expect(JSON.stringify(o)).toBe(JSON.stringify(copy));
 });
});
