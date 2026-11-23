import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {completeProfile} from '../../src/bots/profiles';
import {showdownPlay} from '../../src/bots/showdown';
import {stageOf,stageProfile,stagePlay} from '../../src/tournament/stages';
import {contestablePricing} from '../../src/bots/pricing';
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const rules:RuleProfile={id:'review60',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:String(s.revision),action});
function flop(){let s=startHand({handId:'review60',button:0,profile:rules,seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Other',stack:20000}]});s=act(s,{type:'call'});return act(s,{type:'check'});}
function turn(){return act(act(flop(),{type:'check'}),{type:'check'});}
function river(){return act(act(turn(),{type:'check'}),{type:'check'});}
function view(s:GameState,cards:Card[],board:Card[]):BotObservation {const o=observeBot(s,s.actor!,hiro.policyVersion,'review');o.ownCards=cards;o.board=board;return o;}
const noDraw=()=>{throw Error('Inapplicable overlay drew randomness');};
const ctx=(bb:number,left=90,paid=12)=>({playersLeft:left,paid,stacks:Array(left).fill(bb*200)});
function pre(seats=9,depth=100,ante=0,actor=3){let s=startHand({handId:'stage-review',button:0,profile:{...rules,mode:'tournament',tournament:{bigBlindAnte:ante,antePriority:'blind-first',buttonRule:'dead-button'}},seats:Array.from({length:seats},(_,id)=>({id,name:String(id),stack:depth*200}))});while(s.actor!==actor)s=act(s,{type:'fold'});return s;}
describe('Version60 independent initiative and stage boundaries',()=>{
 it('stabs only after actual unique opponent checks in real final position',()=>{
  const s=act(flop(),{type:'check'}),o=view(s,['Qh','Jd'],['Ks','8c','2d']);
  expect(showdownPlay(o,hiro,{type:'check'},()=>0).play).toBe('flop-stab');
  const wrong=structuredClone(o);wrong.publicEvents.find(e=>e.type==='action'&&e.street==='flop')!.seatId=99;
  expect(showdownPlay(wrong,hiro,{type:'check'},noDraw).play).toBeNull();
  const oop=structuredClone(o);oop.button=1;expect(showdownPlay(oop,hiro,{type:'check'},noDraw).play).toBeNull();
  expect(showdownPlay(view(turn(),['Qh','Jd'],['Ks','8c','2d','4h']),hiro,{type:'check'},noDraw).play).toBeNull();
  expect(showdownPlay(view(act(turn(),{type:'check'}),['Qh','Jd'],['Ks','8c','2d','4h']),hiro,{type:'check'},()=>0).play).toBe('turn-river-stab');
 });
 it('value can lead but board-only ranks cannot masquerade as private value',()=>{
  const s=turn(),value=view(s,['Kh','8d'],['Kc','8s','2h','3c']);
  const r=showdownPlay(value,hiro,{type:'check'},()=>0);expect(r.play).toBe('turn-river-value');expect(()=>act(s,r.action)).not.toThrow();expect(r.action.type==='raise'&&r.action.to%25===0).toBe(true);
  const board=view(s,['Ah','Kd'],['2c','2d','2h','8s']);expect(showdownPlay(board,hiro,{type:'check'},noDraw).play).toBeNull();
 });
 it('preserves shared and private absolute nuts against price-folds',()=>{
  const s=act(river(),{type:'raise',to:400});
  expect(showdownPlay(view(river(),['Ah','Kh'],['Qh','Jh','Th','2d','3d']),hiro,{type:'check'},()=>0).play).toBe('turn-river-value');
  for(const [cards,board] of [[['2d','3d'],['Ah','Kh','Qh','Jh','Th']],[['Ah','Kh'],['Qh','Jh','Th','2d','3d']]])expect(showdownPlay(view(s,cards,board),hiro,{type:'call'},noDraw)).toEqual({action:{type:'call'},play:null});
 });
 it('prices a capped call only against chips the actor can win',()=>{
  const o=view(act(turn(),{type:'raise',to:400}),['Qh','9d'],['Ks','8c','2d','4h']);
  const own=o.seats.find(s=>s.id===o.actingSeat)!,other=o.seats.find(s=>s.id!==o.actingSeat)!;
  own.stack=2000;own.streetCommitted=0;own.totalCommitted=200;
  other.stack=10000;other.streetCommitted=10000;other.totalCommitted=10200;
  o.seats.push({...other,id:2});o.pot=20600;o.legal.callAmount=2000;o.legal.canRaise=false;
  expect(contestablePricing(o).price).toBeCloseTo(2000/6600);
  const disciplined={...hiro,traits:{...completeProfile(hiro).traits,riverCuriosity:0}};
  expect(showdownPlay(o,disciplined,{type:'call'},()=>0).play).toBe('price-fold');
  expect(showdownPlay(o,earl,{type:'call'},noDraw).play).toBeNull();
 });
 it('does not rewrite an existing bet and reads only public/own card data',()=>{
  const o=view(act(turn(),{type:'check'}),['Kh','8d'],['Kc','8s','2h','3c']);
  Object.defineProperty(o,'deck',{get(){throw Error('Hidden deck');}});Object.defineProperty(o.seats[1],'hole',{get(){throw Error('Hidden opponent cards');}});
  const action:Action={type:'raise',to:400};expect(showdownPlay(o,hiro,action,noDraw)).toEqual({action,play:null});
  expect(showdownPlay(o,hiro,{type:'check'},()=>0).play).toBe('turn-river-value');
 });
 it('field-average depth cannot reopen speculative play for a short actor',()=>{
  const o=view(pre(),['Jd','8d'],[]),own=o.seats.find(s=>s.id===o.actingSeat)!;own.stack=2000;own.totalCommitted=10000;own.deadAnte=10000;own.streetCommitted=0;
  expect(stageOf(o,ctx(150))).toBe('early');
  expect(stageProfile(o,earl,ctx(150))).toEqual({profile:earl,effect:null});
  expect(stagePlay(o,earl,{type:'fold'},ctx(150),noDraw).play).toBeNull();
  expect(stagePlay(o,hiro,{type:'fold'},ctx(40),noDraw).play).toBeNull();
 });
 it('late/bubble stages and short effective raises stay with push/fold and ICM',()=>{
  let s=pre();s=act(s,{type:'raise',to:600});const o=view(s,['6h','6d'],[]);
  const raiser=o.seats.find(x=>x.id===3)!;raiser.stack=1400;
  expect(stagePlay(o,hiro,{type:'fold'},ctx(150),noDraw).play).toBeNull();expect(stageProfile(o,earl,ctx(150)).effect).toBeNull();
  expect(stageProfile(view(pre(5,100,0,3),['Ah','Td'],[]),hiro,ctx(100,14,12)).effect).toBeNull();
  expect(stagePlay(view(pre(5,100,0,3),['Ah','Td'],[]),hiro,{type:'fold'},ctx(100,14,12),noDraw).play).toBeNull();
 });
 it('full-ring middle-stage steals require ante money while short-handed opens remain available',()=>{
  const noAnte=view(pre(9,40,0,0),['Kd','9c'],[]);expect(stagePlay(noAnte,hiro,{type:'fold'},ctx(40),noDraw).play).toBeNull();
  const anteState=pre(9,40,200,0),ante=view(anteState,['Kd','9c'],[]),r=stagePlay(ante,hiro,{type:'fold'},ctx(40),()=>0);
  expect(r.play).toBe('steal');expect(()=>act(anteState,r.action)).not.toThrow();
  expect(stagePlay(view(pre(5,40,0,3),['Ah','Td'],[]),hiro,{type:'fold'},ctx(40),()=>0).play).toBe('steal');
 });
});
