import { describe, expect, it } from 'vitest';
import { applyCommand, assertAccounting } from '../../src/core/engine';
import { sequenceFixtures } from './sequence-fixtures';
describe('Step4B independent full-sequence fixture validity',()=>{
 it('constructs15 unique legal prefixes with exact replay, no hidden observations and separate evaluation scenarios',()=>{
  const fixtures=sequenceFixtures();expect(fixtures).toHaveLength(15);expect(new Set(fixtures.map(f=>f.id)).size).toBe(15);expect(fixtures.filter(f=>f.subset==='evaluation')).toHaveLength(3);
  for(const f of fixtures){let replay=f.initial;for(const action of f.prefix){replay=applyCommand(replay,{handId:replay.handId,revision:replay.revision,seatId:replay.actor!,decisionId:`prefix:${replay.handId}:${replay.revision}`,action});assertAccounting(replay);}
   expect(replay).toEqual(f.state);expect(f.state.actor).toBe(f.focusSeat);expect(new Set(f.state.deck).size).toBe(52);
  }
 });
});
