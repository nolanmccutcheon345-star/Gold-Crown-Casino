import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AppData} from '../../src/session/types';
import {auditSnapshot,isVerifiedHistory} from '../../src/storage/verified';
import {canonical,migrateData} from '../../src/storage/integrity';
import {publicMemoryHands,withPublicContext} from '../../src/session/bot-observation';
import * as policy from '../../src/bots/policy';
import {observeBot} from '../../src/core/engine';
import {scenarios,seededRandom} from '../step4a/scenarios';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const verified=async()=>auditSnapshot(await migrateData(structuredClone(fixture.streets.preflop)));
function assertDeeplyFrozen(value:unknown):void {if(value&&typeof value==='object'){expect(Object.isFrozen(value)).toBe(true);for(const child of Object.values(value))assertDeeplyFrozen(child);}}
afterEach(()=>vi.restoreAllMocks());
describe('bounded public-projection freezing preserves the canonical trust boundary',()=>{
 it('keeps cached public copies deeply immutable and equal to independently recomputed untrusted projections',async()=>{
  const data=await verified(),before=canonical(data),session=data.hands[0].sessionId,publicCopy=publicMemoryHands(data.hands,session,1),independent=publicMemoryHands(structuredClone(data.hands),session,1);
  expect(publicCopy).toEqual(independent);expect(publicMemoryHands(data.hands,session,1)).toBe(publicCopy);assertDeeplyFrozen(publicCopy);
  expect(()=>publicCopy[0].events.push(publicCopy[0].events[0])).toThrow();expect(()=>publicCopy[0].seats[0].revealedCards.push('Ac')).toThrow();expect(()=>{publicCopy[0].events[0].amount=987654;}).toThrow();expect(canonical(data)).toBe(before);
 });
 it('retains exact public memory and deterministic choices for every current archetype',async()=>{
  const data=await verified(),session=data.hands[0].sessionId,probe=scenarios().find(s=>s.id==='heads-up-air')!;
  for(const archetype of ['nit','tag','lag','station','passive-reg','maniac','fit-or-fold','stronger-reg'] as const){
   const profile=policy.createProfile({selection:archetype},811,'neutral'),base=observeBot(probe.state,1,profile.policyVersion,'freeze-equivalence'),cached=withPublicContext(base,probe.state.profile.rake,profile,data.hands,session),independent=withPublicContext(structuredClone(base),probe.state.profile.rake,structuredClone(profile),structuredClone(data.hands),session);
   expect(cached).toEqual(independent);assertDeeplyFrozen(cached.memory);expect(withPublicContext(base,probe.state.profile.rake,profile,data.hands,session).memory).toBe(cached.memory);
   expect(policy.chooseDecision(cached,profile,seededRandom(841))).toEqual(policy.chooseDecision(independent,profile,seededRandom(841)));
  }
 });
 it('does not grant cache trust to a counterfeit frozen history or reuse its altered public events',async()=>{
  const data=await verified(),untrusted=structuredClone(data.hands),session=untrusted[0].sessionId;Object.freeze(untrusted);expect(isVerifiedHistory(untrusted)).toBe(false);
  const before=publicMemoryHands(untrusted,session,1);untrusted[0].view.events.find(event=>event.id===before[0].events[0].id)!.amount=876543;const after=publicMemoryHands(untrusted,session,1);
  expect(after).not.toBe(before);expect(after[0].events[0].amount).toBe(876543);expect(before[0].events[0].amount).not.toBe(876543);expect(isVerifiedHistory(untrusted)).toBe(false);
 });
 it('rejects an accessor introduced by a faulty public-memory producer without evaluating it',async()=>{
  const data=await verified(),probe=scenarios().find(s=>s.id==='heads-up-air')!,profile=policy.createProfile({selection:'tag'},811,'neutral'),base=observeBot(probe.state,1,profile.policyVersion,'getter-trap'),get=vi.fn(()=>{throw Error('getter evaluated');});
  const counterfeit={windowHands:0,opponents:[]};Object.defineProperty(counterfeit,'unsafe',{enumerable:true,get});vi.spyOn(policy,'buildOpponentMemory').mockReturnValue(counterfeit);
  expect(()=>withPublicContext(base,probe.state.profile.rake,profile,data.hands,data.hands[0].sessionId)).toThrow('Public memory projection cannot contain accessors');expect(get).not.toHaveBeenCalled();
 });
});
