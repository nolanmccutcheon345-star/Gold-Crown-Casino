import { describe, expect, it } from 'vitest';
import { applyCommand, assertAccounting, observeBot } from '../../src/core/engine';
import { sequenceFixtures } from './sequence-fixtures';
import { PROBES, probeAction } from './probes';
describe('Frozen independent exploit probe legality and secrecy',()=>{
 it('all six fixed opponents choose legal actions across all sequence fixtures',()=>{
  for(const f of sequenceFixtures())for(const probe of PROBES){const o=observeBot(f.state,f.state.actor!,'test-probe-v1',`probe:${probe}`);
   const before=JSON.stringify(o);const action=probeAction(probe,o);const after=applyCommand(f.state,{handId:o.handId,revision:o.revision,seatId:o.actingSeat,decisionId:o.decisionId,action});assertAccounting(after);expect(JSON.stringify(o)).toBe(before);
  }
 });
 it('probes cannot read hidden cards or invoke the tested policy to decide',()=>{
  const f=sequenceFixtures()[1],o=observeBot(f.state,f.state.actor!,'test-probe-v1','probe-privacy');
  for(const key of ['deck','heroCards','privateProfiles'])Object.defineProperty(o,key,{get(){throw new Error('Forbidden');}});
  for(const seat of o.seats)Object.defineProperty(seat,'hole',{get(){throw new Error('Forbidden');}});
  for(const probe of PROBES)expect(()=>probeAction(probe,o)).not.toThrow();
 });
});
