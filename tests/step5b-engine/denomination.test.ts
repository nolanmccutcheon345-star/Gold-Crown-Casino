import {describe,expect,it} from 'vitest';
import type {RuleProfile} from '../../src/contracts';
import {assertAccounting,legalActions,nextHand,observeBot,projectView,reconfigureTable,topUpTable,validatePublicReplay} from '../../src/core/engine';
import {calculateRake} from '../../src/rules/rake';
import {pokerStarsProfile} from '../../src/rules/pokerstars';
import {act,checkDown,hand,practiceProfile,rig} from '../verification/helpers';
const dollars=():RuleProfile=>({...practiceProfile(),version:'denomination-1',chipUnit:100});

describe('R1 exact chip denomination / V706 freeze',()=>{
 it('rejects off-denomination blinds, initial stacks, raises and top-ups',()=>{
  expect(()=>hand([10001,10000],0,dollars())).toThrow('denomination');
  expect(()=>hand([10000,10000],0,{...dollars(),smallBlind:50})).toThrow('denomination');
  for(const unit of [0,-1,0.5,NaN,Infinity])expect(()=>hand([10000,10000],0,{...dollars(),chipUnit:unit})).toThrow();
  const active=hand([10000,10000],0,dollars());expect(()=>act(active,{type:'raise',to:450})).toThrow('Illegal raise');
  const ended=checkDown(active);expect(()=>topUpTable(ended,0,50,'bad',20000)).toThrow('denomination');
  expect(()=>topUpTable(ended,0,100,'bad-cap',20050)).toThrow('denomination');
 });
 it('exposes denomination and legal bounds without adding hidden information to bot observations',()=>{
  const state=hand([10000,10000],0,dollars()),legal=legalActions(state),observation=observeBot(state,state.actor!,'synthetic-cash-1.4.0','decision');
  expect(observation.chipUnit).toBe(100);expect(legal.minRaiseTo).toBe(400);expect(legal.maxRaiseTo).toBe(10000);
  expect('deck' in observation).toBe(false);expect(observation.seats.every(s=>!('hole' in s))).toBe(true);
 });
 it('settles an odd whole chip clockwise after the button, never fractional chips',()=>{
  let state=rig(hand([10000,10000,10000],0,dollars()),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
  state=act(state,{type:'raise',to:500});state=act(state,{type:'call'});state=act(state,{type:'call'});
  state=act(state,{type:'raise',to:200});state=act(state,{type:'call'});state=act(state,{type:'fold'});state=checkDown(state);
  expect(state.pots[0].amount).toBe(1900);expect(state.payouts).toEqual({1:1000,2:900});expect(state.seats.map(s=>s.stack)).toEqual([9500,10300,10200]);assertAccounting(state);
 });
 it('calculates practice rake in whole configured chips and preserves cent profiles',()=>{
  const rake={basisPoints:500,cap:1000,noFlopNoDrop:true};
  expect(calculateRake(3000,5,rake,100)).toBe(100);expect(calculateRake(3000,5,rake,1)).toBe(150);
  let state=hand([1500,1500],0,{...dollars(),rake});state=act(state,{type:'raise',to:1500});state=act(state,{type:'call'});
  expect(state.rake).toBe(100);expect(state.pots[0].amount).toBe(2900);expect(state.seats.every(s=>s.stack%100===0)).toBe(true);assertAccounting(state);
  expect(()=>hand([10000,10000],0,{...dollars(),rake:{...rake,cap:125}})).toThrow('denomination');
  expect(()=>hand([10000,10000],0,{...dollars(),rake:{...rake,capByDealtIn:{two:125,threeFour:200,fivePlus:500}}})).toThrow('denomination');
 });
 it('rejects mislabeling a sourced online rake profile with another chip denomination',()=>{
  expect(()=>hand([10000,10000],0,{...pokerStarsProfile(100,200),chipUnit:100})).toThrow();
 });
 it('freezes denomination/rake/blinds through active action and changes only the next hand, including explicit remainder return',()=>{
  const old={...practiceProfile(),smallBlind:1,bigBlind:2,rake:{basisPoints:500,cap:1000,noFlopNoDrop:true}};
  let state=rig(hand([3001,3001],0,old),[['As','Ad'],['Ks','Kd']],['2c','4h','7s','9d','Tc']);const frames=[projectView(state,0)];
  expect(()=>reconfigureTable(state,[{id:0,name:'Hero',stack:3000},{id:1,name:'Bot',stack:2900}],dollars(),'active-change')).toThrow('Finish');
  state=act(state,{type:'raise',to:15});frames.push(projectView(state,0));state=act(state,{type:'call'});frames.push(projectView(state,0));
  while(state.street!=='complete'){state=act(state,{type:'check'});frames.push(projectView(state,0));}
  expect(state.profile.chipUnit).toBe(1);expect(state.rake).toBe(1);const saved=JSON.stringify(frames);validatePublicReplay(frames);
  const targets=state.seats.map(({id,name,stack})=>({id,name,stack:Math.floor(stack/100)*100}));
  const changed=reconfigureTable(state,targets,dollars(),'next-unit');
  expect(changed.tableTransfers!.reduce((sum,t)=>sum+t.amount,0)).toBe(-101);assertAccounting(changed);
  const next=nextHand(changed,'dollar-hand');expect(next.profile.chipUnit).toBe(100);expect(next.profile.bigBlind).toBe(200);
  expect(next.seats.every(s=>s.stack%100===0&&s.startingStack%100===0)).toBe(true);expect(JSON.stringify(frames)).toBe(saved);validatePublicReplay(frames);assertAccounting(next);
 });
 it.each([1,5,25,100])('conserves denomination %i over repeated full hands and configurations',unit=>{
  const profile={...practiceProfile(),chipUnit:unit,smallBlind:unit,bigBlind:unit*2,rake:{basisPoints:500,cap:unit*10,noFlopNoDrop:true}};
  let state=hand(Array(6).fill(unit*1000),0,profile);
  for(let i=0;i<30;i++){
   state=checkDown(state);assertAccounting(state);expect(state.seats.every(s=>s.stack%unit===0)).toBe(true);expect(state.rake%unit).toBe(0);
   if(i<29)state=nextHand(state,`unit-${unit}-hand-${i}`);
  }
 });
});
