import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import type {StoredHand} from '../../src/session/types';
import {assertCashHandProvenance,describeHandProvenance,isCashPerformanceHand,makeCashHandProvenance,ruleProfileFingerprint,validateHandProvenance,type HandProvenance} from '../../src/session/hand-provenance';
import {canonical,checkChain,digest,GENESIS,seal} from '../../src/storage/integrity';
import {applyCommand,projectView,startHand} from '../../src/core/engine';
import * as deck from '../../src/core/deck';
import {practiceProfile} from '../verification/helpers';

async function record(tagged=true):Promise<StoredHand&{provenance?:HandProvenance}>{
 let state=startHand({handId:'provenance-normal',profile:practiceProfile(),button:0,seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Bot',stack:20000}]});
 const frames=[projectView(state,0)];state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:'normal-fold',action:{type:'fold'}});frames.push(projectView(state,0));
 return seal({id:state.handId,sessionId:'session',epoch:0,number:1,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T00:00:01Z',view:projectView(state,0),frames,net:-100,privateProfiles:{},
  ...(tagged?{provenance:makeCashHandProvenance(state.profile)}:{}),previousHash:GENESIS,hash:''});
}
const lab=(hand:Awaited<ReturnType<typeof record>>)=>({...hand,provenance:{...makeCashHandProvenance(hand.view.profile),mode:'lab' as const,source:'fixed-deck' as const}});

describe('X14 immutable hand origin and financial namespace boundary',()=>{
 it('tags an actual normal engine CSPRNG hand without overriding cards or entropy',async()=>{
  const spy=vi.spyOn(deck,'secureDeck');try{
   const hand=await record();expect(spy).toHaveBeenCalledTimes(1);expect(hand.provenance).toMatchObject({version:1,mode:'cash',source:'csprng',ruleset:{id:hand.view.profile.id,version:hand.view.profile.version}});
   expect(new Set(hand.frames[0].seats.flatMap(s=>s.hole)).size).toBe(2);expect(validateHandProvenance(hand)).toEqual(hand.provenance);assertCashHandProvenance(hand);
   await checkChain([hand]);expect(describeHandProvenance(hand,'cash').financiallyEligible).toBe(true);
  }finally{spy.mockRestore();}
 });
 it('uses exactly the full canonical rules fingerprint, preserving property-order independence',async()=>{
  const profile=practiceProfile(),reordered={...profile,rake:{cap:profile.rake.cap,noFlopNoDrop:profile.rake.noFlopNoDrop,basisPoints:profile.rake.basisPoints}};
  expect(ruleProfileFingerprint(profile)).toBe(await digest(profile));expect(ruleProfileFingerprint(reordered)).toBe(ruleProfileFingerprint(profile));
  const changed=structuredClone(profile);changed.bigBlind++;expect(ruleProfileFingerprint(changed)).not.toBe(ruleProfileFingerprint(profile));
  const tag=makeCashHandProvenance(profile);expect(Object.isFrozen(tag)).toBe(true);expect(Object.isFrozen(tag.ruleset)).toBe(true);
  const before=canonical(tag);profile.rake.cap=999;expect(canonical(tag)).toBe(before);
 });
 it('seal detects tag mutation, and a resealed lab record still cannot claim cash performance',async()=>{
  const hand=await record(),modified=lab(hand);await expect(checkChain([modified])).rejects.toThrow('integrity');
  const resealed=await seal(modified);await checkChain([resealed]);expect(validateHandProvenance(resealed)?.mode).toBe('lab');
  expect(()=>assertCashHandProvenance(resealed)).toThrow('cannot enter cash');expect(isCashPerformanceHand(resealed,'cash')).toBe(false);
  expect(describeHandProvenance(resealed,'lab')).toMatchObject({mode:'lab',source:'fixed-deck',financiallyEligible:false});
 });
 it('treats imported source claims as study only, without mutating or resealing their original provenance',async()=>{
  const hand=await record(),before=canonical(hand),hash=hand.hash;
  const view=describeHandProvenance(hand,'imported');expect(view).toMatchObject({namespace:'imported',mode:'study',source:'replay-import',originStatus:'recorded',financiallyEligible:false});
  expect(isCashPerformanceHand(hand,'imported')).toBe(false);expect(isCashPerformanceHand(hand,'lab')).toBe(false);expect(isCashPerformanceHand(hand,'cash')).toBe(true);
  view.ruleset.id='display-copy-only';expect(canonical(hand)).toBe(before);expect(hand.hash).toBe(hash);await checkChain([hand]);
  expect(describeHandProvenance(lab(hand),'imported').financiallyEligible).toBe(false);
 });
 it('classifies legacy source as unknown without retroactively changing hashes or existing cash eligibility',async()=>{
  const hand=await record(false),before=canonical(hand);expect(validateHandProvenance(hand)).toBeNull();assertCashHandProvenance(hand);
  expect(describeHandProvenance(hand,'cash')).toMatchObject({source:'legacy-unknown',originStatus:'legacy-unknown',financiallyEligible:true});
  expect(describeHandProvenance(hand,'imported')).toMatchObject({source:'replay-import',originStatus:'legacy-unknown',financiallyEligible:false});
  expect('provenance' in hand).toBe(false);expect(canonical(hand)).toBe(before);await checkChain([hand]);
 });
 it('keeps populated legacy fixture records byte-for-byte and hash-for-hash unchanged',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,{hands:StoredHand[]}>};
  let checked=0;
  for(const saved of Object.values(fixture.streets)){
   const before=canonical(saved.hands),hashes=saved.hands.map(h=>h.hash);await checkChain(saved.hands);
   for(const hand of saved.hands){expect(describeHandProvenance(hand,'cash').originStatus).toBe('legacy-unknown');assertCashHandProvenance(hand);checked++;}
   expect(canonical(saved.hands)).toBe(before);expect(saved.hands.map(h=>h.hash)).toEqual(hashes);await checkChain(saved.hands);
  }
  expect(checked).toBeGreaterThan(0);
 });
 it('refuses a matching ID/version whose actual rake or denomination profile was changed',async()=>{
  const hand=await record(),rake=structuredClone(hand);rake.view.profile.rake.cap=500;expect(()=>validateHandProvenance(rake)).toThrow('fingerprint');
  const unit=structuredClone(hand);unit.view.profile.chipUnit=100;expect(()=>validateHandProvenance(unit)).toThrow('fingerprint');
  const replay=structuredClone(hand);replay.frames[0].profile.smallBlind=50;expect(()=>validateHandProvenance(replay)).toThrow('changed during replay');
 });
 it.each([null,{}, {version:2,mode:'cash',source:'csprng',ruleset:{}},{version:1,mode:'cash',source:'fixed-deck',ruleset:{}},{version:1,mode:'lab',source:'csprng',ruleset:{}}])('fails closed on malformed or unsupported provenance %#',async provenance=>{
  const hand=await record();expect(()=>validateHandProvenance({...hand,provenance})).toThrow();
 });
 it('rejects extra keys, prototype-bearing objects, accessors and nested metadata',async()=>{
  const hand=await record(),tag=hand.provenance!;
  for(const provenance of [{...tag,privateSeed:123},{...tag,ruleset:{...tag.ruleset,extra:'hidden'}},Object.assign(Object.create({inherited:true}),tag),{...tag,ruleset:Object.assign(Object.create({inherited:true}),tag.ruleset)},JSON.parse(JSON.stringify(tag).replace('"version":1','"version":1,"__proto__":{}'))])expect(()=>validateHandProvenance({...hand,provenance})).toThrow('structure');
  const getter={...tag};Object.defineProperty(getter,'source',{enumerable:true,get(){throw new Error('Getter must not execute');}});expect(()=>validateHandProvenance({...hand,provenance:getter})).toThrow('structure');
 });
 it('survives JSON persistence without changing the rules fingerprint or tagged hash',async()=>{
  const hand=await record(),restored=JSON.parse(JSON.stringify(hand));expect(validateHandProvenance(restored)).toEqual(hand.provenance);
  expect(restored.hash).toBe(hand.hash);await checkChain([restored]);expect(describeHandProvenance(restored,'cash')).toEqual(describeHandProvenance(hand,'cash'));
 });
});
