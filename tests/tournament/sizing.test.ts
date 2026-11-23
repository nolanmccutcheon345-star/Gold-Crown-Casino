import {describe,expect,it} from 'vitest';
import {applyCommand,projectView,startHand} from '../../src/core/engine';
import type {GameState,RuleProfile} from '../../src/contracts';
import {raiseBounds,sizingUnit,stepRaise,tournamentSizes} from '../../src/ui/tournament-sizing';

const profile=(smallBlind:number,bigBlind:number):RuleProfile=>({id:'sizing-fixture',version:'1',mode:'cash',chipUnit:1,smallBlind,bigBlind,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'});
const deal=(stacks:number[],button:number,sb=25,bb=50)=>startHand({handId:'sizing',profile:profile(sb,bb),button,seats:stacks.map((stack,id)=>({id,name:id?`P${id}`:'You',stack}))});
let step=0;
const act=(state:GameState,action:Parameters<typeof applyCommand>[1]['action'])=>applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:`d${step++}`,action});
/** Everyone before Hero does `first`, later seats fold, until Hero is to act. */
function untilHero(state:GameState,action:(state:GameState)=>Parameters<typeof applyCommand>[1]['action']):GameState {let guard=0;while(state.actor!==0&&state.street!=='complete'&&guard++<40)state=act(state,action(state));return state;}
const sizes=(state:GameState)=>tournamentSizes(projectView(state,0)).map(size=>[size.id,size.to]);

describe('tournament raise shortcuts',()=>{
 it('uses 25s until the 100/200 level, then 100s',()=>{expect([50,100,150,200,300,3000].map(sizingUnit)).toEqual([25,25,25,100,100,100]);});
 it('offers 2.5 and 3 big blinds for an unopened pot (2 BB is the minimum raise and has its own button)',()=>{
  const state=untilHero(deal([5000,5000,5000,5000,5000,5000],2),()=>({type:'fold'}));
  expect(state.actor).toBe(0);expect(raiseBounds(projectView(state,0))).toEqual({min:100,max:5000});expect(sizes(state)).toEqual([['bb-2.5',125],['bb-3',150]]);
 });
 it('rounds opens to 100s at 300/600',()=>{
  const state=untilHero(deal([30000,30000,30000,30000,30000,30000],2,300,600),()=>({type:'fold'}));
  expect(sizes(state)).toEqual([['bb-2.5',1500],['bb-3',1800]]);
 });
 it('offers multiples of a raise when facing one',()=>{
  let state=deal([5000,5000,5000,5000,5000,5000],2);let raised=false;
  state=untilHero(state,()=>raised?{type:'fold'}:(raised=true,{type:'raise',to:150}));
  expect(state.actor).toBe(0);expect(sizes(state)).toEqual([['x-2.5',375],['x-3',450],['x-4',600]]);
 });
 it('offers pot fractions after the flop and never the minimum or all-in',()=>{
  let state=deal([5000,5000],0);state=act(state,{type:'call'});state=act(state,{type:'check'});
  expect(state.street).toBe('flop');state=untilHero(state,()=>({type:'check'}));
  const view=projectView(state,0),list=tournamentSizes(view),bounds=raiseBounds(view)!;
  expect(view.pot).toBe(100);expect(list.map(size=>[size.id,size.to])).toEqual([['pot-33',25],['pot-75',75],['pot-100',100]].filter(([,to])=>(to as number)>bounds.min));
  expect(list.every(size=>size.to>bounds.min&&size.to<bounds.max&&size.to%25===0)).toBe(true);
 });
 it('drops shortcuts a short stack cannot make and offers none when Hero cannot raise',()=>{
  const short=untilHero(deal([130,5000,5000,5000,5000,5000],2),()=>({type:'fold'}));
  expect(sizes(short)).toEqual([['bb-2.5',125]]);
  const tiny=untilHero(deal([60,5000,5000,5000,5000,5000],2),()=>({type:'fold'}));
  expect(sizes(tiny)).toEqual([]);
  const waiting=deal([5000,5000,5000,5000,5000,5000],2);expect(waiting.actor).not.toBe(0);expect(tournamentSizes(projectView(waiting,0))).toEqual([]);
 });
 it('steps the draft one big blind at a time inside the legal range',()=>{
  const view=projectView(untilHero(deal([400,5000,5000,5000,5000,5000],2),()=>({type:'fold'})),0);
  expect(stepRaise(view,'',1)).toBe(150);expect(stepRaise(view,'150',-1)).toBe(100);expect(stepRaise(view,'100',-1)).toBe(100);expect(stepRaise(view,'380',1)).toBe(400);expect(stepRaise(view,'abc',1)).toBe(150);
 });
});
