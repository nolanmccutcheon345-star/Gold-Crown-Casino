import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Action} from '../../src/contracts';
import {assertAccounting} from '../../src/core/engine';
import * as habits from '../../src/bots/habits';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
class Memory implements PersistencePort{
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw Error('Revision changed');this.data=structuredClone(next);}
 close(){}
}
afterEach(()=>vi.restoreAllMocks());
describe('E07 illegal bot proposal safe-continuation requirement',()=>{
 it.each([['three-times-stack',{type:'raise',to:60000}],['illegal-check',{type:'check'}]] as [string,Action][])('%s is rejected, a legal fallback advances once, and chips remain conserved',async(_name,action)=>{
  // Inject at the final sizing boundary. An invalid base proposal can be
  // replaced by later legal human-layer actions, so it does not reliably
  // exercise commitBot's rejection/recovery contract.
  vi.spyOn(habits,'applyMinRaise').mockReturnValue({action,habit:null});
  const port=new Memory(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,buyIn:20000,opponents:[{selection:'station',personalitySeed:71211}]});
  let g=c.data!.active!.game;await c.act({type:'raise',to:600},g.handId,g.revision);g=structuredClone(c.data!.active!.game);
  await c.prepareBot();expect(c.data!.active!.pending!.decision!.action).toEqual(action);const decisionId=c.data!.active!.pending!.decisionId;await c.commitBot(g.handId,g.revision);
  const actual=c.data!.active!.game;assertAccounting(actual);
  // A rejected proposal must not become a permanent stale pending decision.
  // Safe fallback can check when free or fold when facing a bet; engine alone
  // applies it. Retrying must still produce only one action event.
  expect(actual.revision,'E07: illegal pending policy currently stalls the hand instead of safely falling back').toBeGreaterThan(g.revision);
  expect(c.data!.active!.pending).toBeNull();
  expect(c.data!.policyViolations).toHaveLength(1);expect(c.data!.policyViolations![0]).toMatchObject({id:`violation:${decisionId}`,handId:g.handId,revision:g.revision,seatId:1,policyVersion:c.data!.active!.profiles[1].policyVersion,proposedAction:action,fallback:{type:'fold'}});
  expect(c.data!.policyViolations![0].reason).toMatch(/legal bounds/);expect(JSON.stringify(c.data!.policyViolations)).not.toMatch(/hole|deck|traits|personality|observationHash/);
  expect(actual.events.filter(e=>e.decisionId===decisionId)).toHaveLength(1);
  const snapshot=structuredClone(c.data);await c.commitBot(g.handId,g.revision);expect(c.data).toEqual(snapshot);c.close();
  const restored=new SessionController(port);await restored.init();expect(restored.error).toBe('');expect(restored.data!.policyViolations).toEqual(snapshot!.policyViolations);
  await restored.commitBot(g.handId,g.revision);await restored.retry();expect(restored.data!.policyViolations).toEqual(snapshot!.policyViolations);expect(restored.data!.active!.game).toEqual(actual);expect(restored.data!.ledger).toEqual(snapshot!.ledger);expect(restored.data!.hands).toEqual(snapshot!.hands);expect(restored.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);restored.close();
 });
});
