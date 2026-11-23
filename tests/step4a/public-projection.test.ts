import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoredHand } from '../../src/session/types';
import { publicMemoryHands, withPublicContext } from '../../src/session/bot-observation';
import { createProfile, chooseDecision } from '../../src/bots/policy';
import { observeBot } from '../../src/core/engine';
import { scenarios, seededRandom } from './scenarios';

const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8'));
const records=()=>structuredClone(fixture.streets.preflop.hands) as StoredHand[];
function trap(object:object,key:string){Object.defineProperty(object,key,{enumerable:true,get(){throw new Error(`Forbidden history read: ${key}`);}});}
describe('Independent canonical-history to opponent-memory projection',()=>{
 it('never reads folded Hero cards, private profiles, deck or event card/detail annotations',()=>{
  const hands=records().slice(0,2);const expected=publicMemoryHands(hands,hands[0].sessionId,1);
  for(const hand of hands){trap(hand,'privateProfiles');trap(hand,'deck');for(const seat of hand.view.seats)trap(seat,'hole');
   for(const event of hand.view.events){trap(event,'cards');trap(event,'detail');trap(event,'latentPolicy');}}
  expect(publicMemoryHands(hands,hands[0].sessionId,1)).toEqual(expected);
  expect(expected.flatMap(h=>h.seats.flatMap(s=>s.revealedCards))).toEqual([]);
  const text=JSON.stringify(expected);for(const key of ['hole','privateProfiles','deck','cards','detail','latentPolicy'])expect(text).not.toContain(`"${key}"`);
 });
 it('includes hole cards only when the canonical completed board, nonfolded seat and reveal label all permit it',()=>{
  const showdown=records()[2];const expected=publicMemoryHands([showdown],showdown.sessionId,1)[0];
  expect(expected.seats.find(s=>s.id===0)!.revealedCards).toEqual(['As','Ah']);expect(expected.seats.find(s=>s.id===1)!.revealedCards).toEqual(['Ks','Kh']);
  for(const deny of ['not-complete','short-board','folded','unlabeled'] as const){
   const hand=structuredClone(showdown);
   if(deny==='not-complete')hand.view.street='river';if(deny==='short-board')hand.view.board.pop();
   if(deny==='folded')hand.view.seats[0].folded=true;if(deny==='unlabeled')delete hand.view.handLabels[0];
   trap(hand.view.seats[0],'hole');expect(publicMemoryHands([hand],hand.sessionId,1)[0].seats[0].revealedCards).toEqual([]);
  }
 });
 it('excludes prior sessions and missing observers before accessing their card-bearing records',()=>{
  const [first,,otherSession]=records();trap(otherSession,'view');
  expect(publicMemoryHands([first,otherSession],first.sessionId,1)).toHaveLength(1);
  const absent=structuredClone(first);absent.view.seats=absent.view.seats.filter(s=>s.id!==1);trap(absent.view.seats[0],'hole');
  expect(publicMemoryHands([absent],first.sessionId,1)).toEqual([]);
 });
 it('caps prior canonical hands at120 and keeps private historical objects unchanged',()=>{
  const prototype=records()[0];const hands=Array.from({length:130},(_,index)=>({...structuredClone(prototype),id:`historical-${index}`}));
  const before=JSON.stringify(hands);const projected=publicMemoryHands(hands,prototype.sessionId,1);
  expect(projected).toHaveLength(120);expect(projected[0].handId).toBe('historical-10');expect(projected.at(-1)!.handId).toBe('historical-129');
  expect(JSON.stringify(hands)).toBe(before);
 });
 it('restoring an identical permitted history produces the same memory, decision and fingerprint',()=>{
  const source=records().slice(0,2);const probe=scenarios().find(s=>s.id==='heads-up-air')!;
  const p=createProfile({selection:'stronger-reg'},811,'neutral');const base=observeBot(probe.state,1,p.policyVersion,'recover-public-context');
  const first=withPublicContext(base,probe.state.profile.rake,p,source,source[0].sessionId);
  const restored=withPublicContext(structuredClone(base),probe.state.profile.rake,structuredClone(p),structuredClone(source),source[0].sessionId);
  expect(restored).toEqual(first);expect(first.memory!.windowHands).toBe(2);
  expect(chooseDecision(restored,p,seededRandom(841))).toEqual(chooseDecision(first,p,seededRandom(841)));
 });
});
