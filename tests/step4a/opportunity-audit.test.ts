import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/contracts';
import { legalActions } from '../../src/core/engine';
import { hand } from '../verification/helpers';
import { OpportunityAudit } from './evaluation';
import { step } from './scenarios';

function fixture(stacks:number[]){let game=hand(stacks,0);const audit=new OpportunityAudit(game.seats.map(s=>s.id));return{
 get game(){return game;},audit,act(action:Action){audit.record(game,action);game=step(game,action);},
};}
describe('Independent complete-hand opportunity denominators',()=>{
 it('excludes forced blind all-ins and a big-blind walk without voluntary decisions',()=>{
  const forced=fixture([100,100]);expect(forced.game.street).toBe('complete');
  for(const metrics of forced.audit.finish().values())expect([metrics.vpip,metrics.pfr,metrics.threeBet]).toEqual(Array(3).fill({count:0,opportunities:0}));
  const walk=fixture([20000,20000]);walk.act({type:'fold'});const metrics=walk.audit.finish();
  expect(metrics.get(0)!.vpip).toEqual({count:0,opportunities:1});expect(metrics.get(1)!.vpip).toEqual({count:0,opportunities:0});
  expect(metrics.get(1)!.pfr).toEqual({count:0,opportunities:0});
 });
 it('counts one legal 3-bet opportunity and excludes a response to the already-made 3-bet',()=>{
  const f=fixture([20000,20000,20000]);f.act({type:'raise',to:600});f.act({type:'raise',to:1800});f.act({type:'fold'});f.act({type:'call'});
  const m=f.audit.finish();expect(m.get(1)!.threeBet).toEqual({count:1,opportunities:1});
  expect(m.get(0)!.threeBet).toEqual({count:0,opportunities:0});expect(m.get(2)!.threeBet).toEqual({count:0,opportunities:0});
  expect(m.get(0)!.vpip).toEqual({count:1,opportunities:1});expect(m.get(0)!.pfr).toEqual({count:1,opportunities:1});
 });
 it('counts a legal short all-in 3-bet but excludes closed raising after it',()=>{
  const f=fixture([20000,20000,850]);f.act({type:'raise',to:600});f.act({type:'call'});f.act({type:'raise',to:850});
  expect(legalActions(f.game).canRaise).toBe(false);f.act({type:'call'});expect(legalActions(f.game).canRaise).toBe(false);f.act({type:'call'});
  const m=f.audit.finish();expect(m.get(2)!.threeBet).toEqual({count:1,opportunities:1});
  expect(m.get(0)!.threeBet).toEqual({count:0,opportunities:0});expect(m.get(1)!.threeBet).toEqual({count:0,opportunities:1});
 });
 it('separates flop cbet, per-street check-raise and positive-price decision denominators',()=>{
  const f=fixture([20000,20000]);f.act({type:'raise',to:600});f.act({type:'call'});
  f.act({type:'check'});f.act({type:'raise',to:600});f.act({type:'raise',to:1800});f.act({type:'call'});
  f.act({type:'check'});f.act({type:'check'});f.act({type:'check'});f.act({type:'raise',to:1000});f.act({type:'fold'});
  expect(f.game.street).toBe('complete');const m=f.audit.finish();
  expect(m.get(0)!.flopCbet).toEqual({count:1,opportunities:1});expect(m.get(1)!.flopCbet).toEqual({count:0,opportunities:0});
  expect(m.get(1)!.checkRaise).toEqual({count:1,opportunities:2});expect(m.get(0)!.checkRaise).toEqual({count:0,opportunities:0});
  expect(m.get(1)!.foldToPrice).toEqual({count:1,opportunities:3});expect(m.get(0)!.foldToPrice).toEqual({count:0,opportunities:2});
  expect(m.get(1)!.vpip).toEqual({count:1,opportunities:1});expect(m.get(1)!.pfr).toEqual({count:0,opportunities:1});
 });
});
