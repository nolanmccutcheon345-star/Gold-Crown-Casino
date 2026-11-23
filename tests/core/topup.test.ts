import {describe,it,expect} from 'vitest';
import type {RuleProfile} from '../../src/contracts';
import {applyCommand,assertAccounting,nextHand,projectView,startHand,topUpTable} from '../../src/core/engine';
const profile:RuleProfile={id:'practice',version:'0.2.0',mode:'cash',chipUnit:1,smallBlind:100,bigBlind:200,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function begin(){return startHand({handId:'topup',profile,button:0,seats:[{id:0,name:'Hero',stack:10000},{id:1,name:'Alex',stack:10000}]});}
function finish(){const s=begin();return applyCommand(s,{handId:s.handId,revision:s.revision,seatId:0,decisionId:'fold',action:{type:'fold'}});}
describe('engine-authoritative between-hand table transfers',()=>{
 it('adds only requested chips, preserves settled evidence, and next hand carries exact stacks',()=>{
  const ended=finish(),before=structuredClone(ended),record=projectView(ended,0);
  const topped=topUpTable(ended,0,5000,'transfer-1',20000);
  expect(ended).toEqual(before);expect(record.seats[0].stack).toBe(9900);expect(topped.seats[0].stack).toBe(14900);
  expect(topped.events).toEqual(ended.events);expect(topped.payouts).toEqual(ended.payouts);expect(topped.initialTotal).toBe(25000);assertAccounting(topped);
  const next=nextHand(topped,'next');expect(next.seats.map(s=>s.startingStack)).toEqual([14900,10100]);assertAccounting(next);
 });
 it('is idempotent for a matching transfer ID and rejects conflicting reuse',()=>{
  const topped=topUpTable(finish(),0,5000,'once',20000);
  expect(topUpTable(topped,0,5000,'once',20000)).toBe(topped);
  expect(()=>topUpTable(topped,0,4000,'once',20000)).toThrow('Conflicting');
  expect(()=>topUpTable(topped,1,5000,'once',20000)).toThrow('Conflicting');
 });
 it('enforces active-hand lock, exact table cap, positive integer amounts and known seat',()=>{
  expect(()=>topUpTable(begin(),0,100,'a',20000)).toThrow('Finish');
  const ended=finish();expect(topUpTable(ended,0,10100,'cap',20000).seats[0].stack).toBe(20000);
  expect(()=>topUpTable(ended,0,10101,'over',20000)).toThrow('maximum');
  for(const amount of [0,-1,0.5,NaN,Infinity])expect(()=>topUpTable(ended,0,amount,'bad',20000)).toThrow();
  expect(()=>topUpTable(ended,8,100,'bad',20000)).toThrow('Unknown seat');
  expect(()=>topUpTable(ended,0,100,'',20000)).toThrow('Transfer ID');
 });
 it('supports repeated topups without duplicate hand payouts',()=>{
  const ended=finish();let s=ended;
  for(let i=0;i<25;i++)s=topUpTable(s,0,10,`topup-${i}`,20000);
  expect(s.seats[0].stack).toBe(10150);expect(s.events.filter(e=>e.type==='award')).toEqual(ended.events.filter(e=>e.type==='award'));
  expect(s.tableTransfers).toHaveLength(25);expect(s.revision).toBe(ended.revision+25);assertAccounting(s);
  const next=nextHand(s,'after-topups');const done=applyCommand(next,{handId:next.handId,revision:next.revision,seatId:next.actor!,decisionId:'new-fold',action:{type:'fold'}});
  expect(topUpTable(done,0,10,'topup-0',20000)).toBe(done);
 });
 it('refuses aggregate unsafe integer overflow even if recipient cap is legal',()=>{
  const s=finish();s.initialTotal=Number.MAX_SAFE_INTEGER;s.seats[1].stack=Number.MAX_SAFE_INTEGER-s.seats[0].stack;
  expect(()=>topUpTable(s,0,1,'overflow',20000)).toThrow('precision');
 });
});
