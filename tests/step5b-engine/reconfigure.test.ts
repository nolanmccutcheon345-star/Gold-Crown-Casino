import {describe,expect,it} from 'vitest';
import {assertAccounting,nextHand,projectView,reconfigureTable,startHand,topUpTable,validatePublicReplay} from '../../src/core/engine';
import {act,checkDown,hand,practiceProfile} from '../verification/helpers';
import {pokerStarsProfile} from '../../src/rules/pokerstars';

const roster=(ids:number[],stack=20000)=>ids.map(id=>({id,name:id===0?'Hero':`Opponent${id}`,stack}));
describe('D02/D08 engine-owned completed-hand reconfiguration',()=>{
 it('deals exactly six occupied seats in a ten-position ring and never acts an empty seat',()=>{
  let state=startHand({handId:'sparse',button:0,seats:roster([0,2,4,6,8,9]),profile:practiceProfile()});
  expect(state.seats.map(s=>s.id)).toEqual([0,2,4,6,8,9]);expect(state.smallBlindSeat).toBe(2);expect(state.bigBlindSeat).toBe(4);expect(state.actor).toBe(6);
  const actors:number[]=[];while(state.street!=='complete'){actors.push(state.actor!);state=act(state,{type:state.seats.find(s=>s.id===state.actor)!.streetCommitted<state.currentBet?'call':'check'});}
  expect([...new Set(actors)].sort((a,b)=>a-b)).toEqual([0,2,4,6,8,9]);assertAccounting(state);
 });
 it('records signed additions, removals and adjustments without modifying the settled input or payouts',()=>{
  const previous=checkDown(hand([20000,20000,20000])),snapshot=structuredClone(previous),history=projectView(previous,0);
  const seats=roster([0,2,8],30000),profile=pokerStarsProfile(500,1000);
  const changed=reconfigureTable(previous,seats,profile,'change-1');
  expect(previous).toEqual(snapshot);expect(projectView(previous,0)).toEqual(history);expect(changed.events).toEqual(previous.events);expect(changed.payouts).toEqual(previous.payouts);
  for(const id of [0,1,2,8])expect(changed.tableTransfers!.find(t=>t.seatId===id)?.amount).toBe((seats.find(s=>s.id===id)?.stack??0)-(previous.seats.find(s=>s.id===id)?.stack??0));
  expect(changed.initialTotal).toBe(90000);assertAccounting(changed);
  const next=nextHand(changed,'configured-next');expect(next.seats.map(s=>s.startingStack)).toEqual([30000,30000,30000]);expect(next.seats.map(s=>s.id)).toEqual([0,2,8]);expect(next.profile.bigBlind).toBe(1000);expect(next.profile.rake.cap).toBe(150);
  expect(new Set(next.seats.flatMap(s=>s.hole)).size).toBe(6);assertAccounting(next);
 });
 it('supports removal of the old button and preserves heads-up next-BB obligation',()=>{
  const previous=checkDown(hand([20000,20000,20000,20000]));
  let next=nextHand(reconfigureTable(previous,roster([2,5,9]),practiceProfile(),'remove-button'),'multi-next');
  expect(next.button).toBe(2);expect(next.smallBlindSeat).toBe(5);expect(next.bigBlindSeat).toBe(9);
  next=nextHand(reconfigureTable(previous,roster([0,5]),practiceProfile(),'remove-bb'),'hu-next');
  expect(next.bigBlindSeat).toBe(5);expect(next.button).toBe(0);expect(next.smallBlindSeat).toBe(0);assertAccounting(next);
 });
 it('is inert for a matching latest request after reload and rejects conflicting/older ID reuse',()=>{
  const previous=checkDown(hand()),seats=roster([0,3,8]),profile=practiceProfile();
  const changed=reconfigureTable(previous,seats,profile,'once');
  expect(reconfigureTable(changed,[...seats].reverse(),profile,'once')).toBe(changed);
  const restored=JSON.parse(JSON.stringify(changed));expect(reconfigureTable(restored,seats,profile,'once')).toBe(restored);
  expect(()=>reconfigureTable(changed,roster([0,3,8],30000),profile,'once')).toThrow('Conflicting');
  const newer=reconfigureTable(changed,roster([0,4,8]),profile,'twice');expect(()=>reconfigureTable(newer,seats,profile,'once')).toThrow('already applied');
  const next=checkDown(nextHand(changed,'after-once'));expect(reconfigureTable(next,seats,profile,'once')).toBe(next);
 });
 it('rejects active-hand changes and invalid targets before any mutation',()=>{
  const active=hand(),previous=checkDown(active),snapshot=structuredClone(previous);
  expect(()=>reconfigureTable(active,roster([0,1]),practiceProfile(),'early')).toThrow('Finish');
  for(const seats of [roster([0]),roster([0,0]),roster([0,10]),roster([0,1],-1),roster([0,1],0),roster([0,1],Number.MAX_SAFE_INTEGER)])expect(()=>reconfigureTable(previous,seats,practiceProfile(),'bad')).toThrow();
  expect(()=>reconfigureTable(previous,roster([0,1]),practiceProfile(),'')).toThrow('Transfer ID');expect(previous).toEqual(snapshot);
 });
 it('keeps frozen rule profile and replay valid when a future rule change is requested during action',()=>{
  let state=hand();const frames=[projectView(state,0)];const future=pokerStarsProfile(500,1000);
  expect(()=>reconfigureTable(state,roster([0,1,2]),future,'early')).toThrow('Finish');
  while(state.street!=='complete'){state=act(state,{type:state.seats.find(s=>s.id===state.actor)!.streetCommitted<state.currentBet?'call':'check'});frames.push(projectView(state,0));}
  const before=JSON.stringify(frames);validatePublicReplay(frames);
  const next=nextHand(reconfigureTable(state,state.seats.map(({id,name,stack})=>({id,name,stack})),future,'after'),'fresh');
  expect(next.profile.bigBlind).toBe(1000);expect(state.profile.bigBlind).toBe(200);expect(JSON.stringify(frames)).toBe(before);validatePublicReplay(frames);
 });
 it('repeated 6/9 seat transitions preserve accounting and never repeat payouts',()=>{
  let state=checkDown(hand(Array(6).fill(20000)));let priorTotal=state.seats.reduce((n,s)=>n+s.stack,0);
  for(let i=0;i<20;i++){
   const count=i%2?6:9,seats=roster(Array.from({length:count},(_,id)=>id));const awards=structuredClone(state.payouts);
   const changed=reconfigureTable(state,seats,practiceProfile(),`cycle-${i}`);
   const deltas=changed.tableTransfers!.filter(t=>t.id.startsWith(`configuration:${`cycle-${i}`.length}:cycle-${i}:`)).reduce((n,t)=>n+t.amount,0);
   expect(priorTotal+deltas).toBe(count*20000);expect(changed.payouts).toEqual(awards);
   state=checkDown(nextHand(changed,`next-${i}`));assertAccounting(state);priorTotal=state.seats.reduce((n,s)=>n+s.stack,0);
  }
 });
 it('retains prior top-up receipts through reconfiguration so old cash transfers cannot recur',()=>{
  const topped=topUpTable(checkDown(hand()),0,100,'wallet-topup',100000);
  const next=checkDown(nextHand(reconfigureTable(topped,roster([0,2,8]),practiceProfile(),'config'),'after-topup'));
  expect(topUpTable(next,0,100,'wallet-topup',100000)).toBe(next);assertAccounting(next);
 });
});
