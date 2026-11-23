import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {auditSnapshot,isVerifiedHistory} from '../../src/storage/verified';
import {migrateData} from '../../src/storage/integrity';
import {deriveCashStats,projectLivePace} from '../../src/stats/cash';
import {CashStatsProjection,CASH_PROJECTION_VERSION} from '../../src/stats/projection';
import {fixture,profile,session,freeze,chain} from './fixtures';
import type {StoredHand} from '../../src/session/types';

function folded(button=0,blind=2,sessionId='s1'):StoredHand {
 const f=fixture([10000,10000],button,{...profile,smallBlind:blind/2,bigBlind:blind});f.act({type:'fold'});return {...f.record(),sessionId};
}
function compare(projection:CashStatsProjection,hands:readonly StoredHand[],sessions=[session(hands)],now=0) {
 const projected=projection.derive(hands,sessions,now),reference=deriveCashStats([...hands],sessions,now);
 expect(projected).toEqual(reference);return projected;
}

describe('incremental statistics versus independent full-history aggregation',()=>{
 it('uses only the private audited-history capability to avoid redundant recursive immutability inspection',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8'));
  const data=await auditSnapshot(await migrateData(fixture.streets.flop));
  expect(isVerifiedHistory(data.hands)).toBe(true);
  expect(isVerifiedHistory(freeze(structuredClone(data.hands)))).toBe(false);
  const descriptors=vi.spyOn(Object,'getOwnPropertyDescriptors');
  let result;let calls;
  try {result=new CashStatsProjection().derive(data.hands,data.sessions,0);calls=descriptors.mock.calls.length;}
  finally {descriptors.mockRestore();}
  expect(calls).toBe(0);expect(result).toEqual(deriveCashStats(data.hands,data.sessions,0));
 });
 it('agrees exactly after every append including mixed stakes, rake, positions, sessions and closure',()=>{
  const r=fixture([100,100],1,{...profile,rake:{basisPoints:1000,cap:100,noFlopNoDrop:true}}).finish();
  const hands=freeze(chain([folded(0,2),folded(1,10),{...r,sessionId:'s2'},folded(1,4,'s2')]));
  const projection=new CashStatsProjection();
  for(let length=0;length<=hands.length;length++) {
   const prefix=freeze(hands.slice(0,length));const sessions=[session(prefix.filter(h=>h.sessionId==='s1')),
    session(prefix.filter(h=>h.sessionId==='s2'),{id:'s2',endedAt:null,activeMs:1234,lastActiveAt:4000})];
   compare(projection,prefix,sessions,5000);compare(projection,prefix,sessions.map(s=>({...s,endedAt:'2026-11-01T02:00:00Z',activeMs:9999,lastActiveAt:null})),99999);
  }
  expect(projection.getDiagnostics().projectedHands).toBe(4);
 });
 it('has independently hand-calculated money and normalized blind totals, independent of selected session stakes',()=>{
  // Two HU folds: Hero loses 1 cent at 1/2 and wins 5 cents at 5/10.
  const hands=freeze(chain([folded(0,2),folded(1,10)]));const projection=new CashStatsProjection();
  const result=compare(projection,hands,[session(hands,{profile:{...profile,smallBlind:500,bigBlind:1000},buyIns:999999,cashOut:888888})]);
  expect(result.profit).toBe(4);expect(result.bb100).toBe(0);expect(result.stakes.map(g=>[g.hands,g.profit,g.bb100])).toEqual([[1,-1,-50],[1,5,50]]);
  expect(result.winningSessions).toBe(1);expect(result.rake).toBe(0);
 });
 it('refreshes elapsed active time and session closure without reprocessing any settled hand',()=>{
  const hands=freeze(chain([folded(1,2)])),projection=new CashStatsProjection();
  const open=session(hands,{endedAt:null,activeMs:1000,lastActiveAt:5000});
  const first=compare(projection,hands,[open],6000),later=compare(projection,hands,[open],7000);
  expect(first.activeMs).toBe(2000);expect(later.activeMs).toBe(3000);expect(later.perHour).toBe(1200);
  const closed=compare(projection,hands,[{...open,endedAt:'2026-11-01T02:00:00Z',activeMs:3000,lastActiveAt:null}],99999);
  expect(closed.winningSessions).toBe(1);expect(closed.activeSession).toBeNull();expect(projection.getDiagnostics().projectedHands).toBe(1);
 });
 it('does not incorporate manual adjustments, rebuy, top-up, cashout, epoch reset or study imports into poker winnings',()=>{
  const hands=freeze(chain([folded(0,2)])),projection=new CashStatsProjection();
  const before=compare(projection,hands);const imports=[folded(1,100)];
  const data={hands,importedHands:imports,wallet:999999};
  const adjusted={...session(hands),buyIns:123456,cashOut:654321,epoch:8,tableWithdrawals:54321};
  const after=compare(projection,data.hands,[adjusted]);
  expect(after.profit).toBe(before.profit);expect(after.hands).toBe(1);expect(after.bb100).toBe(-50);expect(projection.getDiagnostics().projectedHands).toBe(1);
 });
 it('does not trust matching supplied hashes on mutable records or shallowly frozen arrays',()=>{
  const hands=chain([folded(0,2)]),projection=new CashStatsProjection();compare(projection,hands);
  // Deliberately changing a mutable input with an unchanged hash must be seen.
  hands[0].net=999;expect(compare(projection,hands).profit).toBe(999);
  Object.freeze(hands);hands[0].net=500;expect(compare(projection,hands).profit).toBe(500);
  expect(projection.getDiagnostics().mutableFallbacks).toBe(3);expect(projection.getDiagnostics().cachedSnapshotHits).toBe(0);
 });
 it('rejects duplicate, missing and out-of-order appended canonical records before mutating the last good checkpoint',()=>{
  const hands=freeze(chain([folded(),folded(),folded()])),projection=new CashStatsProjection();const prefix=freeze([hands[0]]);compare(projection,prefix);
  expect(()=>projection.derive(freeze([hands[0],hands[0]]),[])).toThrow('Duplicate');
  expect(()=>projection.derive(freeze([hands[0],hands[2]]),[])).toThrow('gap');
  expect(()=>projection.derive(freeze([hands[0],hands[2],hands[1]]),[])).toThrow('out-of-order');
  expect(projection.getDiagnostics().checkpoint.hands).toBe(1);compare(projection,prefix);compare(projection,hands);
  expect(projection.getDiagnostics().projectedHands).toBe(3);
 });
 it('rejects session sequence gaps even if caller supplies a superficially linked hash chain',()=>{
  const hands=chain([folded(),folded()]);hands[1].number=3;
  expect(()=>new CashStatsProjection().derive(freeze(hands),[])).toThrow('sequence');
 });
 it('detects removed or reordered prefixes rather than returning cached results',()=>{
  const hands=freeze(chain([folded(),folded(),folded()])),projection=new CashStatsProjection();compare(projection,hands);
  expect(()=>projection.derive(freeze([hands[0],hands[2]]),[])).toThrow('gap');
  expect(projection.getDiagnostics().lastInvalidation).toContain('prefix');
  compare(projection,hands);
  expect(()=>projection.derive(freeze([hands[1],hands[0],hands[2]]),[])).toThrow('out-of-order');
 });
 it('rebuilds after validated restoration, rule/policy versions or changed data identities without rewriting historical records',()=>{
  const hands=freeze(chain([folded()])),projection=new CashStatsProjection();const original=JSON.stringify(hands);compare(projection,hands);
  const restored=freeze(structuredClone(hands));compare(projection,restored);expect(projection.getDiagnostics().lastInvalidation).toContain('prefix');
  const updated=structuredClone(hands);updated[0].view.profile.version='2';updated[0].privateProfiles={1:{archetype:'tag',aggression:0.5,looseness:0.5,policyVersion:'version-2'}};
  const result=compare(projection,freeze(updated));expect(result.configurations[0].label).toContain('version-2');expect(result.configurations[0].label).toContain('@2');
  expect(JSON.stringify(hands)).toBe(original);expect(projection.getDiagnostics().version).toBe(CASH_PROJECTION_VERSION);
 });
 it('rebuilds explicitly after reset and handles an empty canonical history',()=>{
  const projection=new CashStatsProjection(),hands=freeze(chain([folded()]));compare(projection,hands);projection.reset();compare(projection,freeze([]));
  expect(projection.getDiagnostics().checkpoint).toEqual({hands:0,lastId:null,lastHash:null});
 });
 it('does not return mutable references that allow a UI edit to poison the next statistics result',()=>{
  const projection=new CashStatsProjection(),hands=freeze(chain([folded()]));const result=compare(projection,hands);result.stakes[0].profit=999;result.metrics.vpip.denominator=999;
  expect(compare(projection,hands).profit).toBe(-1);expect(projection.getDiagnostics().projectedHands).toBe(1);
 });
 it('never executes private accessors as part of cache eligibility or public statistics',()=>{
  const hand=folded();const privateProfile={policyVersion:'public-version'};
  Object.defineProperty(privateProfile,'archetype',{enumerable:true,get(){throw new Error('Private profile accessed');}});Object.freeze(privateProfile);
  hand.privateProfiles={1:privateProfile as StoredHand['privateProfiles'][number]};Object.freeze(hand.privateProfiles);Object.freeze(hand);
  const projection=new CashStatsProjection();expect(()=>projection.derive(Object.freeze([hand]),[])).not.toThrow();expect(projection.getDiagnostics().mutableFallbacks).toBe(1);
 });
});

describe('G04 / X10 / V613 actual results and hypothetical live pace remain separate',()=>{
 it('projects +10 BB/100 at 30 hands/hour to +3 BB/hour without creating earnings',()=>{
  const stats={hands:300,profit:6000,bb100:10,activeMs:3600000,perHour:6000,mixedStakes:false};const copy=JSON.stringify(stats);
  const result=projectLivePace(stats,30);expect(result.projectedBBPerHour).toBe(3);expect(result.projectedProfitPerHour).toBe(600);expect(JSON.stringify(stats)).toBe(copy);
  expect(result.disclosure).toContain('not measured live earnings');
 });
 it('shows 300 fast hands as one actual active hour and ten hypothetical live-equivalent hours',()=>{
  const result=projectLivePace({hands:300,profit:6000,bb100:10,activeMs:3600000,perHour:6000},30);
  expect(result.actualActiveMs/3600000).toBe(1);expect(result.liveEquivalentHours).toBe(10);expect(result.actualProfitPerHour).toBe(6000);expect(result.projectedProfitPerHour).toBe(600);
 });
 it('changing animation/actual elapsed duration changes measured hourly rate but not normalized results or assumed projection',()=>{
  const hands=chain([folded(1,2),folded(0,2),folded(1,2)]);
  const fast=deriveCashStats(hands,[session(hands,{activeMs:60000})]);const slow=deriveCashStats(hands,[session(hands,{activeMs:3600000})]);
  expect(fast.bb100).toBe(slow.bb100);expect(fast.perHour).toBe(60*slow.perHour!);
  expect(projectLivePace(fast).projectedBBPerHour).toBe(projectLivePace(slow).projectedBBPerHour);expect(projectLivePace(fast).liveEquivalentHours).toBe(0.1);
 });
 it('uses observed cash per hand and weighted BB independently for mixed stakes, never a selected current blind',()=>{
  const stats=deriveCashStats(chain([folded(0,2),folded(1,10)]),[]);const result=projectLivePace(stats);
  expect(result.mixedStakes).toBe(true);expect(result.projectedBBPerHour).toBe(0);expect(result.projectedProfitPerHour).toBe(60);expect(result.actualProfitPerHour).toBeNull();
 });
 it('has no fabricated rate when no hands or actual elapsed time exist',()=>{
  const result=projectLivePace(deriveCashStats([],[]));expect(result.projectedBBPerHour).toBeNull();expect(result.projectedProfitPerHour).toBeNull();expect(result.actualProfitPerHour).toBeNull();expect(result.liveEquivalentHours).toBe(0);
 });
 it.each([0,-30,NaN,Infinity])('rejects an invalid hands/hour assumption: %s',pace=>{
  expect(()=>projectLivePace(deriveCashStats([],[]),pace)).toThrow('positive and finite');
 });
});
