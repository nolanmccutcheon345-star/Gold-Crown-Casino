import {describe,expect,it} from 'vitest';
import {applyCommand,assertAccounting,legalActions} from '../../src/core/engine';
import {potSizing,inspectSizing} from '../../src/ui/bet-sizing';
import {hand,act} from '../verification/helpers';
import type {GameState} from '../../src/contracts';

function flop(){let g=hand([100000,100000,100000]);g=act(g,{type:'raise',to:2000});g=act(g,{type:'call'});g=act(g,{type:'call'});expect(g.street).toBe('flop');expect(g.pot).toBe(6000);return g;}
function size(g:GameState,percent:number){const hero=g.seats.find(s=>s.id===g.actor)!;return potSizing({pot:g.pot,streetCommitted:hero.streetCommitted,bigBlind:g.profile.bigBlind,legal:legalActions(g),chipUnit:g.profile.chipUnit},percent);}
function apply(g:GameState,to:number){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`size:${to}`,action:{type:'raise',to}});}
describe('X01 / V408 / V505 independent legal postflop sizing with prior-street money',()=>{
 it.each([[50,9000],[100,15000],[150,21000]])('pot60, flop bet30: %s%% means cumulative total%s cents', (percent,expected)=>{
  let g=flop();g=act(g,{type:'raise',to:3000});g=act(g,{type:'fold'});expect(g.actor).toBe(0);expect(g.pot).toBe(9000);
  expect(g.seats[0].totalCommitted).toBe(2000);expect(g.seats[0].streetCommitted).toBe(0);expect(legalActions(g).callAmount).toBe(3000);
  const proposal=size(g,percent);expect(proposal.to).toBe(expected);expect(proposal.additional).toBe(expected);expect(proposal.minimum).toBe(6000);expect(proposal.maximum).toBe(98000);expect(proposal.legal).toBe(true);
  const after=apply(g,proposal.to);expect(after.seats[0].streetCommitted).toBe(expected);expect(after.seats[0].totalCommitted).toBe(2000+expected);expect(after.pot).toBe(9000+expected);assertAccounting(after);
  expect(()=>apply(g,3001)).toThrow();expect(()=>apply(g,expected+.5)).toThrow();expect(()=>apply(g,98001)).toThrow();
 });
 it.each([[50,17000],[100,27000],[150,37000],[200,47000]])('postflop reraised pot with6000 prior-street money and3000 current Hero commitment: %s%% means%s', (percent,expected)=>{
  let g=flop();g=act(g,{type:'check'});g=act(g,{type:'raise',to:1000});g=act(g,{type:'raise',to:3000});g=act(g,{type:'fold'});g=act(g,{type:'raise',to:7000});expect(g.actor).toBe(0);
  expect(g.pot).toBe(16000);expect(g.seats[0].streetCommitted).toBe(3000);expect(g.seats[0].totalCommitted).toBe(5000);expect(legalActions(g).callAmount).toBe(4000);
  // Independent arithmetic: after calling pot=20000, prior current-street
  // total=7000; previous-street2000 must never be added to raise-to a second time.
  const proposal=size(g,percent);expect(proposal.to).toBe(expected);expect(proposal.additional).toBe(expected-3000);expect(proposal.legal).toBe(true);
  expect(inspectSizing({pot:g.pot,streetCommitted:3000,bigBlind:200,legal:legalActions(g)},expected)).toEqual(proposal);
  const after=apply(g,proposal.to);expect(after.seats[0].streetCommitted).toBe(expected);expect(after.seats[0].totalCommitted).toBe(expected+2000);expect(after.pot).toBe(16000+expected-3000);assertAccounting(after);
 });
});
