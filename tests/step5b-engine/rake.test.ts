import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {assertAccounting,nextHand,startHand} from '../../src/core/engine';
import {calculateRake,resolveRake,type VersionedRake} from '../../src/rules/rake';
import {pokerStarsProfile,POKERSTARS_PROFILE_VERSION,POKERSTARS_SOURCE} from '../../src/rules/pokerstars';
import {act,checkDown,hand,practiceProfile,rig} from '../verification/helpers';

const source=JSON.parse(readFileSync(new URL('./pokerstars-source.json',import.meta.url),'utf8')) as {source:string;retrievedAt:string;rows:number[][]};
/** Independent decimal oracle; fixtures stay below Number integer precision. */
function reference(pot:number,bp:number,cap:number):number{
 const decimal=pot*bp/10000,nearest=Math.round(decimal);
 return Math.min(cap,Math.abs(decimal-nearest)===0.5?(Math.floor(decimal)%2===0?Math.floor(decimal):Math.ceil(decimal)):nearest);
}

describe('X09 / V414 pinned official USD regular NLHE rake',()=>{
 it('pins the actually retrieved official source and snapshot date',()=>{
  expect(POKERSTARS_SOURCE.url).toBe(source.source);expect(POKERSTARS_PROFILE_VERSION).toBe(source.retrievedAt);
 });
 it.each(source.rows)('uses source row %i/%i, %i bp and exact occupied caps', (sb,bb,bp,two,threeFour,fivePlus)=>{
  const profile=pokerStarsProfile(sb,bb),rake=profile.rake as VersionedRake;
  expect(rake.basisPoints).toBe(bp);expect(rake.noFlopNoDrop).toBe(true);expect(rake.rounding).toBe('half-even');
  for(let count=2;count<=10;count++){
   const resolved=resolveRake(rake,count),expected=count===2?two:count<=4?threeFour:fivePlus;
   expect(resolved.cap).toBe(expected);expect(resolved.dealtIn).toBe(count);
   for(const pot of [0,1,10,30,50,70,90,111,1000,10000,1000000])expect(calculateRake(pot,5,resolved)).toBe(reference(pot,bp,expected));
  }
 });
 it('does not label unsupported USD stake pairs or currencies as sourced presets',()=>{
  for(const stakes of [[100,300],[200,500],[1.5,2],[20000,40000],[0,0]])expect(()=>pokerStarsProfile(stakes[0],stakes[1])).toThrow('listed USD');
  expect(POKERSTARS_SOURCE.currency).toBe('USD');expect(POKERSTARS_SOURCE.format).toBe('regular-nlhe');
 });
 it.each([[5,0],[15,2],[25,2],[35,4],[45,4]])('settles a %i-cent all-in with half-even rake %i', (stack,rake)=>{
  let state=hand([stack,stack],0,pokerStarsProfile(1,2));
  state=act(state,{type:'raise',to:stack});state=act(state,{type:'call'});
  expect(state.street).toBe('complete');expect(state.rake).toBe(rake);expect(state.pots[0].amount).toBe(stack*2-rake);assertAccounting(state);
 });
 it.each([2,3,4,5,6,9,10])('caps a complete %i-player hand using initial dealt-in count', count=>{
  let state=hand(Array(count).fill(20000),0,pokerStarsProfile(100,200));
  state=act(state,{type:'raise',to:20000});while(state.street!=='complete')state=act(state,{type:'call'});
  expect(state.rake).toBe(count<=4?125:275);expect((state.profile.rake as VersionedRake).dealtIn).toBe(count);
  expect(state.seats.reduce((sum,s)=>sum+s.stack,0)+state.rake).toBe(count*20000);assertAccounting(state);
 });
 it('counts sparse occupied seats, freezes source and caps through folds, and resolves each subsequent hand',()=>{
  const profile=pokerStarsProfile(100,200);let state=startHand({handId:'sparse',button:0,profile,seats:[0,2,4,6,9].map(id=>({id,name:`P${id}`,stack:20000}))});
  expect((state.profile.rake as VersionedRake).dealtIn).toBe(5);expect(state.profile.rake.cap).toBe(275);
  (profile.rake as VersionedRake).capByDealtIn!.fivePlus=999;profile.bigBlind=400;
  state=act(state,{type:'fold'});state=act(state,{type:'fold'});state=checkDown(state);
  expect(state.profile.rake.cap).toBe(275);expect(state.profile.bigBlind).toBe(200);
  const next=nextHand(state,'next');expect((next.profile.rake as VersionedRake).dealtIn).toBe(5);
 });
 it('selects the new cap when busted players are no longer dealt into the following hand',()=>{
  let state=rig(hand([100,100,1000,1000,1000],0,pokerStarsProfile(10,25)),[['2c','2d'],['3c','3d'],['As','Ad'],['Ks','Kd'],['Qs','Qd']],['4c','6h','8s','9d','Tc']);
  state=act(state,{type:'raise',to:100});for(let i=0;i<4;i++)state=act(state,{type:'call'});state=checkDown(state);
  expect(state.seats.filter(s=>s.stack>0)).toHaveLength(3);expect(state.profile.rake.cap).toBe(200);expect((state.profile.rake as VersionedRake).dealtIn).toBe(5);
  const next=nextHand(state,'fewer-dealt');expect(next.profile.rake.cap).toBe(100);expect((next.profile.rake as VersionedRake).dealtIn).toBe(3);expect(state.profile.rake.cap).toBe(200);assertAccounting(next);
 });
 it('returns unmatched bets before applying percentage/cap and preserves no-flop-no-drop',()=>{
  let folded=hand([20000,20000,20000,20000,20000],0,pokerStarsProfile(100,200));while(folded.street!=='complete')folded=act(folded,{type:'fold'});
  expect(folded.rake).toBe(0);assertAccounting(folded);
  let state=rig(hand([20000,1000],0,pokerStarsProfile(100,200)),[['As','Ad'],['Ks','Kd']],['2c','4h','7s','9d','Tc']);
  state=act(state,{type:'raise',to:20000});state=act(state,{type:'call'});
  expect(state.events.find(e=>e.type==='refund')?.amount).toBe(19000);expect(state.rake).toBe(100);expect(state.pots[0].amount).toBe(1900);
  expect(state.seats.map(s=>s.stack)).toEqual([20900,0]);assertAccounting(state);
 });
 it('takes one capped rake from a multiway side-pot hand and reconciles split settlement',()=>{
  let state=rig(hand([1000,2000,3000],0,pokerStarsProfile(100,200)),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
  state=act(state,{type:'raise',to:1000});state=act(state,{type:'raise',to:2000});state=act(state,{type:'call'});
  expect(state.rake).toBe(125);expect(state.pots.map(p=>p.amount)).toEqual([2875,2000]);
  expect(state.payouts).toEqual({0:958,1:1959,2:1958});expect(state.seats.map(s=>s.stack)).toEqual([958,1959,2958]);assertAccounting(state);
 });
 it('preserves archived practice floor semantics and exact large-integer multiplication',()=>{
  const legacy={basisPoints:500,cap:100,noFlopNoDrop:true};
  expect(calculateRake(30,5,legacy)).toBe(1);expect(calculateRake(30,5,{...legacy,rounding:'half-even'})).toBe(2);
  expect(calculateRake(Number.MAX_SAFE_INTEGER,5,{basisPoints:10000,cap:Number.MAX_SAFE_INTEGER,noFlopNoDrop:false,rounding:'half-even'})).toBe(Number.MAX_SAFE_INTEGER);
  let state=hand([15,15],0,{...practiceProfile(),smallBlind:1,bigBlind:2,rake:legacy});state=act(state,{type:'raise',to:15});state=act(state,{type:'call'});expect(state.rake).toBe(1);assertAccounting(state);
 });
 it('rejects invalid rounding/cap schedules rather than silently selecting rules',()=>{
  expect(()=>resolveRake({...pokerStarsProfile(100,200).rake,rounding:'bad' as 'floor'},5)).toThrow('rounding');
  expect(()=>resolveRake({...pokerStarsProfile(100,200).rake,capByDealtIn:{two:-1,threeFour:1,fivePlus:2}},5)).toThrow('caps');
  expect(()=>calculateRake(1.5,5,practiceProfile().rake)).toThrow('pot');
 });
});
