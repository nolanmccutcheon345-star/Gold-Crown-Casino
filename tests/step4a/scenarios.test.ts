import { describe, expect, it } from 'vitest';
import { assertAccounting, legalActions } from '../../src/core/engine';
import { archetypeAssignment, scenarios, seededEngineHand, seededRandom } from './scenarios';
describe('Independent opponent evaluation fixture validity',()=>{
 it('constructs every controlled probe through legal engine transitions with unique sealed cards',()=>{
  const probes=scenarios();expect(probes).toHaveLength(32);expect(new Set(probes.map(p=>p.id)).size).toBe(probes.length);
  for(const {state} of probes){assertAccounting(state);expect(new Set(state.deck).size).toBe(52);expect(state.actor).not.toBeNull();expect(legalActions(state).actor).toBe(state.actor);expect(state.seats.find(s=>s.id===state.actor)!.stack).toBeGreaterThan(0);}
 });
 it('reproduces seeded cards independently of policy random streams across supported table sizes',()=>{
  for(const seats of [2,6,9,10]){const a=seededEngineHand(seats,237);const b=seededEngineHand(seats,237);expect(a).toEqual(b);assertAccounting(a);expect(new Set(a.deck).size).toBe(52);}
 });
 it('avoids correlated adjacent first draws and balances both heads-up positions for every archetype',()=>{
  const bins=Array(10).fill(0);for(let seed=0;seed<1000;seed++)bins[Math.floor(seededRandom(seed)()*10)]++;
  expect(bins.every(n=>n>60&&n<140)).toBe(true);
  const positions=Array.from({length:8},()=>new Set<number>());
  for(let hand=0;hand<128;hand++){const button=seededEngineHand(2,0x4a0000+20000+hand).button;
   for(let seat=0;seat<2;seat++)positions[archetypeAssignment(hand,2)[seat]].add((seat-button+2)%2);}
  expect(positions.every(p=>p.size===2)).toBe(true);
 });
});
