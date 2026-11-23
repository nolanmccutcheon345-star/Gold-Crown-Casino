import {describe,it,expect} from 'vitest';
import {deriveCashStats,STAT_DEFINITIONS} from '../../src/stats/cash';
import {fixture} from './fixtures';

const counts=(hand:ReturnType<ReturnType<typeof fixture>['record']>)=>{
 const {metrics}=deriveCashStats([hand],[],0);
 return Object.fromEntries(['raise','checkRaise','foldToCbet'].map(key=>[key,[metrics[key as keyof typeof metrics].numerator,metrics[key as keyof typeof metrics].denominator]]));
};
function raisedFlop(stacks=[100,100]) {
 const f=fixture(stacks);f.step(1,{type:'raise',to:6});f.step(0,{type:'call'});return f;
}

describe('V421 independently scripted legal postflop node histories',()=>{
 it('counts a check-raise only after checking, with independent raising and cbet response nodes',()=>{
  const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});f.step(0,{type:'raise',to:12});f.step(1,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[1,1],checkRaise:[1,1],foldToCbet:[0,1]});
 });
 it('records missed check-raise opportunity when Hero calls, and does not classify later raise after call as check-raise',()=>{
  const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});f.step(0,{type:'call'});
  f.step(0,{type:'raise',to:4});f.step(1,{type:'raise',to:12});f.step(0,{type:'raise',to:24});f.step(1,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[1,2],checkRaise:[0,1],foldToCbet:[0,1]});
 });
 it('consumes the check-raise opportunity on a call even when a later player reopens the same street',()=>{
  const f=fixture([100,100,100,100],2);f.step(1,{type:'call'});f.step(2,{type:'call'});f.step(3,{type:'call'});f.step(0,{type:'check'});
  f.step(3,{type:'check'});f.step(0,{type:'check'});f.step(1,{type:'check'});f.step(2,{type:'raise',to:4});f.step(3,{type:'call'});f.step(0,{type:'call'});
  f.step(1,{type:'raise',to:12});f.step(2,{type:'call'});f.step(3,{type:'call'});f.step(0,{type:'raise',to:24});f.step(1,{type:'call'});f.step(2,{type:'call'});f.step(3,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[1,2],checkRaise:[0,1],foldToCbet:[0,0]});
 });
 it('a fold after checking is a missed check-raise and an observed fold-to-cbet',()=>{
  const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});f.step(0,{type:'fold'});
  expect(counts(f.record())).toEqual({raise:[0,1],checkRaise:[0,1],foldToCbet:[1,1]});
 });
 it('does not count opening bets, checked-through streets, forced blinds or absent cbet as raise nodes',()=>{
  const f=fixture();f.step(1,{type:'call'});f.step(0,{type:'check'});f.step(0,{type:'raise',to:4});f.step(1,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[0,0],checkRaise:[0,0],foldToCbet:[0,0]});
 });
 it('excludes delayed turn continuation bets from the explicitly flop-only cbet denominator',()=>{
  const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'check'});f.step(0,{type:'check'});f.step(1,{type:'raise',to:8});f.step(0,{type:'fold'});
  expect(counts(f.record())).toEqual({raise:[0,1],checkRaise:[0,1],foldToCbet:[0,0]});
 });
 it('excludes donk bets and a subsequent aggressor raise from cbet responses',()=>{
  const f=raisedFlop();f.step(0,{type:'raise',to:4});f.step(1,{type:'raise',to:12});f.step(0,{type:'fold'});
  expect(counts(f.record())).toEqual({raise:[0,1],checkRaise:[0,0],foldToCbet:[0,0]});
 });
 it('uses the final preflop aggressor after a three-bet, not the original opener',()=>{
  const f=fixture();f.step(1,{type:'raise',to:6});f.step(0,{type:'raise',to:18});f.step(1,{type:'call'});
  f.step(0,{type:'check'});f.step(1,{type:'raise',to:8});f.step(0,{type:'fold'});
  expect(counts(f.record())).toEqual({raise:[0,1],checkRaise:[0,1],foldToCbet:[0,0]});
 });
 it('supports multiway check-raising after two checks and the button cbet',()=>{
  const f=fixture([100,100,100],2);f.step(2,{type:'raise',to:6});f.step(0,{type:'call'});f.step(1,{type:'call'});
  f.step(0,{type:'check'});f.step(1,{type:'check'});f.step(2,{type:'raise',to:8});f.step(0,{type:'raise',to:24});f.step(1,{type:'fold'});f.step(2,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[1,1],checkRaise:[1,1],foldToCbet:[0,1]});
 });
 it('allows intervening calls before Hero faces a cbet in a multiway pot',()=>{
  const f=fixture([100,100,100],0);f.step(0,{type:'call'});f.step(1,{type:'raise',to:6});f.step(2,{type:'call'});f.step(0,{type:'call'});
  f.step(1,{type:'raise',to:8});f.step(2,{type:'call'});f.step(0,{type:'fold'});
  expect(counts(f.finish())).toEqual({raise:[0,1],checkRaise:[0,0],foldToCbet:[1,1]});
 });
 it('excludes a cbet that is raised before Hero gets to respond',()=>{
  const f=fixture([100,100,100],0);f.step(0,{type:'call'});f.step(1,{type:'raise',to:6});f.step(2,{type:'call'});f.step(0,{type:'call'});
  f.step(1,{type:'raise',to:8});f.step(2,{type:'raise',to:24});f.step(0,{type:'fold'});
  expect(counts(f.finish())).toEqual({raise:[0,1],checkRaise:[0,0],foldToCbet:[0,0]});
 });
 it('counts a legal short all-in check-raise but not an all-in-only call as a raise opportunity',()=>{
  const f=raisedFlop([12,100]);f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});expect(f.game.actor).toBe(0);
  f.step(0,{type:'raise',to:6});
  expect(counts(f.finish())).toEqual({raise:[1,1],checkRaise:[1,1],foldToCbet:[0,1]});
  const g=raisedFlop([10,100]);g.step(0,{type:'check'});g.step(1,{type:'raise',to:4});g.step(0,{type:'call'});
  expect(counts(g.finish())).toEqual({raise:[0,0],checkRaise:[0,0],foldToCbet:[0,1]});
 });
 it('does not count closed raising after Hero bet and a short all-in increase',()=>{
  const f=fixture([100,14,100],2);f.step(2,{type:'call'});f.step(0,{type:'call'});f.step(1,{type:'check'});
  f.step(0,{type:'raise',to:10});f.step(1,{type:'raise',to:12});f.step(2,{type:'call'});f.step(0,{type:'call'});
  expect(counts(f.finish())).toEqual({raise:[0,0],checkRaise:[0,0],foldToCbet:[0,0]});
 });
 it('does not invent denominators when a required postflop pre-action frame is missing, while preserving known preflop metrics',()=>{
  const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});const revision=f.game.revision;f.step(0,{type:'fold'});
  const h=f.record();h.frames=h.frames.filter(frame=>frame.revision!==revision);const stats=deriveCashStats([h],[]);
  expect(counts(h)).toEqual({raise:[0,0],checkRaise:[0,0],foldToCbet:[0,0]});expect(stats.metrics.vpip.denominator).toBe(1);expect(stats.opportunityCoverage.missingFrames).toBe(1);
 });
 it('reports opportunity counts, descriptive Wilson interval and the exact minimum sample boundary',()=>{
  const hands=Array.from({length:100},()=>{const f=raisedFlop();f.step(0,{type:'check'});f.step(1,{type:'raise',to:4});f.step(0,{type:'fold'});return f.record();});
  const small=deriveCashStats(hands.slice(0,99),[]),large=deriveCashStats(hands,[]);
  expect(small.metrics.checkRaise.status).toBe('INSUFFICIENT_SAMPLE');expect(large.metrics.checkRaise).toMatchObject({numerator:0,denominator:100,percent:0,status:'DESCRIPTIVE'});
  expect(large.metrics.checkRaise.ci95![1]).toBeCloseTo(3.69935,4);expect(large.metrics.foldToCbet.numerator).toBe(100);
  expect(STAT_DEFINITIONS.foldToCbet).toContain('delayed turn bets');
 });
});
