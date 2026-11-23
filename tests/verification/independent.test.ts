import { describe, expect, it, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { applyCommand, legalActions, observeBot, projectView } from '../../src/core/engine';
import { evaluate } from '../../src/core/evaluator';
import { secureDeck } from '../../src/core/deck';
import type { Action } from '../../src/contracts';
import { act, checkDown, hand, lexCompare, practiceProfile, rig, seededHand } from './helpers';

afterEach(()=>vi.unstubAllGlobals());
describe('Independent analytical fixtures (development tests; not complete V7 acceptance rows)',()=>{
 it('heads-up button posts SB and acts first preflop, BB first postflop',()=>{
   let s=hand([20000,20000]);
   expect([s.smallBlindSeat,s.bigBlindSeat,s.actor]).toEqual([0,1,0]);
   s=act(s,{type:'call'}); expect(s.actor).toBe(1);
   s=act(s,{type:'check'}); expect([s.street,s.actor]).toEqual(['flop',1]);
 });
 it.each([3,6,9,10])('%i seats use clockwise cash blinds and UTG first',n=>{
   const s=hand(Array(n).fill(20000)); expect([s.smallBlindSeat,s.bigBlindSeat,s.actor]).toEqual([1,2,3%n]);
 });
 it('raise-to retains full raise increment and reducer rejects invalid check/size/stale action',()=>{
   let s=hand(); expect(legalActions(s).minRaiseTo).toBe(400);
   const original=JSON.stringify(s);
   expect(()=>act(s,{type:'check'})).toThrow();
   expect(()=>act(s,{type:'raise',to:399})).toThrow();
   expect(()=>act(s,{type:'raise',to:400.5})).toThrow();
   expect(JSON.stringify(s)).toBe(original);
   s=act(s,{type:'raise',to:600});expect(legalActions(s).minRaiseTo).toBe(1000);
   expect(()=>applyCommand(s,{handId:s.handId,revision:s.revision-1,seatId:s.actor!,decisionId:'stale',action:{type:'call'}})).toThrow();
 });
 it('preflop fold returns uncalled blind and never takes no-flop rake',()=>{
   const p=practiceProfile();p.rake={basisPoints:500,cap:1000,noFlopNoDrop:true};
   const s=act(hand([10000,10000],0,p),{type:'fold'});
   expect(s.street).toBe('complete');expect(s.seats.map(x=>x.stack)).toEqual([9900,10100]);expect(s.rake).toBe(0);
 });
 it('independent AA/KK/QQ all-in fixture awards main and side pots exactly',()=>{
   let s=rig(hand([10000,20000,30000]),[['As','Ad'],['Ks','Kd'],['Qs','Qd']],['2c','4h','7s','9d','Jc']);
   s=act(s,{type:'raise',to:10000});s=act(s,{type:'raise',to:20000});s=act(s,{type:'call'});
   expect(s.street).toBe('complete');expect(s.seats.map(x=>x.stack)).toEqual([30000,20000,10000]);
   expect(s.pot).toBe(0);expect(s.rake).toBe(0);
 });
 it('unmatched overbet is refunded before pot eligibility',()=>{
   let s=rig(hand([30000,10000]),[['As','Ad'],['Ks','Kd']],['2c','4h','7s','9d','Jc']);
   s=act(s,{type:'raise',to:30000});s=act(s,{type:'call'});
   expect(s.street).toBe('complete');expect(s.seats.map(x=>x.stack)).toEqual([40000,0]);
   expect(s.events.filter(e=>e.type==='refund').reduce((t,e)=>t+(e.amount??0),0)).toBe(20000);
 });
 it('folded dead money belongs to the main pot while eligibility stays separate',()=>{
   let s=rig(hand([10000,20000,30000,30000]),[['As','Ad'],['Ks','Kd'],['Qs','Qd'],['6s','6d']],['2c','4h','7s','9d','Jc']);
   s=act(s,{type:'call'});s=act(s,{type:'raise',to:10000});s=act(s,{type:'call'});
   s=act(s,{type:'raise',to:20000});s=act(s,{type:'fold'});s=act(s,{type:'call'});
   expect(s.street).toBe('complete');expect(s.seats.map(x=>x.stack)).toEqual([30200,20000,10000,29800]);
 });
 it('board tie awards the odd chip to first eligible seat clockwise from button',()=>{
   const p=practiceProfile();p.smallBlind=1;p.bigBlind=2;
   let s=rig(hand([100,100,100],0,p),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
   s=act(s,{type:'call'});s=act(s,{type:'fold'});s=checkDown(s);
   expect(s.seats.map(x=>x.stack)).toEqual([100,99,101]);
 });
 it('DEF-003 consolidates folded contribution tiers before splitting odd chips',()=>{
   const p=practiceProfile();p.smallBlind=1;p.bigBlind=2;
   let s=rig(hand([100,100,100,100,100],0,p),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
   s=act(s,{type:'raise',to:5});s=act(s,{type:'call'});s=act(s,{type:'call'});
   s=act(s,{type:'fold'});s=act(s,{type:'fold'});
   s=act(s,{type:'raise',to:2});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=checkDown(s);
   // Folded totals 1,2,5 never create eligibility boundaries between two survivors.
   // Fragmenting the 22 into 5+4+9+4 incorrectly awards both odd cents to seat 3.
   expect(s.pots).toEqual([{amount:22,eligible:[0,3],winners:[0,3]}]);
   expect(s.payouts).toEqual({0:11,3:11});
   expect(s.seats.map(x=>x.stack)).toEqual([104,99,98,104,95]);
 });
 it('duplicate submitted decision cannot re-award or debit',()=>{
   const s=hand([10000,10000]);
   const cmd={handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:'one',action:{type:'fold'} as Action};
   const done=applyCommand(s,cmd);expect(applyCommand(done,cmd)).toEqual(done);
   expect(done.events.filter(e=>e.decisionId==='one'&&e.type==='action')).toHaveLength(1);
 });
 it('hand owns a nested copy of its rule profile',()=>{
   const p=practiceProfile();const s=hand([10000,10000],0,p);p.bigBlind=1000;p.rake.basisPoints=9000;
   expect(s.profile.bigBlind).toBe(200);expect(s.profile.rake.basisPoints).toBe(0);
 });
 it('counterfactual opponent/future cards never alter a bot observation',()=>{
   const s=hand();const other=structuredClone(s);other.seats[1].hole=['2c','3d'];other.deck.reverse();
   expect(observeBot(s,0,'test-v1','same')).toEqual(observeBot(other,0,'test-v1','same'));
   const view=projectView(s,0);expect(view.seats[1].hole).toEqual([]);expect(view.seats[2].hole).toEqual([]);
   expect(view).not.toHaveProperty('deck');expect(view).not.toHaveProperty('burned');
 });
 it('secure deck has 52 unique valid cards and fails closed when crypto is absent',()=>{
   const deck=secureDeck();expect(deck).toHaveLength(52);expect(new Set(deck).size).toBe(52);
   expect(deck.every(c=>/^[2-9TJQKA][cdhs]$/.test(c))).toBe(true);
   vi.stubGlobal('crypto',undefined);expect(()=>secureDeck()).toThrow();
 });
 it('independent category ladder and wheel high-card limit',()=>{
   const strongestToWeakest=['AsKsQsJsTs2d3c','AsAdAhAcKs2d3c','AsAdAhKsKd2d3c','AsQs9s7s3s2d4c','9s8d7h6c5s2d3c','AsAdAhKsQd2d3c','AsAdKsKdQh2d3c','AsAdKhQdJs2d3c','AsKdQh9c7s2d3c'].map(x=>x.match(/../g)!);
   for(let i=1;i<strongestToWeakest.length;i++)expect(lexCompare(evaluate(strongestToWeakest[i-1]),evaluate(strongestToWeakest[i]))).toBe(1);
   expect(lexCompare(evaluate(['As','2d','3h','4c','5s','Kd','Qc']),evaluate(['2s','3d','4h','5c','6s','Ad','Kc']))).toBe(-1);
 });
 it('seeded legal-state journeys conserve chips and terminate for 2–10 seats',()=>{
   fc.assert(fc.property(fc.integer({min:2,max:10}),fc.array(fc.integer({min:200,max:20000}),{minLength:10,maxLength:10}),fc.array(fc.nat(9999),{minLength:100,maxLength:100}), (n,stacks,choices)=>{
     let s=seededHand(stacks.slice(0,n),choices[0]); const initial=s.initialTotal;let count=0;
     while(s.street!=='complete'){
       expect(s.seats.reduce((t,p)=>t+p.stack,0)+s.pot+s.rake).toBe(initial);
       const l=legalActions(s);expect(l.actor).toBe(s.actor);const c=choices[count%choices.length];
       let action:Action=l.check?{type:'check'}:{type:'call'};
       if(c%5===0&&l.fold)action={type:'fold'};
       else if(c%5===1&&l.canRaise&&l.minRaiseTo!==null)action={type:'raise',to:l.shortAllInTo??l.minRaiseTo};
       else if(c%5===2&&l.canRaise&&l.maxRaiseTo!==null)action={type:'raise',to:l.maxRaiseTo};
       s=act(s,action);count++;expect(count).toBeLessThan(1000);
       expect(s.seats.every(p=>Number.isSafeInteger(p.stack)&&p.stack>=0)).toBe(true);
     }
     expect(s.seats.reduce((t,p)=>t+p.stack,0)+s.rake).toBe(initial);expect(s.actor).toBeNull();expect(s.pot).toBe(0);
   }),{seed:710302,numRuns:160});
 });
});
