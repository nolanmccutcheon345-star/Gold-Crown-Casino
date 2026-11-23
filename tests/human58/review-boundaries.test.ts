import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {threeBetPlay} from '../../src/bots/three-bet';
import {aggressionPlay,spotOf,aggressionFactor} from '../../src/bots/aggression';
const profile=regularProfile('hiro','high');
const rules:RuleProfile={id:'review57',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:String(s.revision),action});
function opened(openerStack=20000){let s=startHand({handId:'review57',button:0,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`S${id}`,stack:id===5?openerStack:20000}))});s=act(act(s,{type:'fold'}),{type:'fold'});return act(s,{type:'raise',to:500});}
function view(s:GameState):BotObservation {const o=observeBot(s,s.actor!,profile.policyVersion,'review');o.ownCards=['As','4s'];return o;}
function flop(){let s=opened();s=act(act(s,{type:'fold'}),{type:'fold'});return act(s,{type:'call'});}
const rngUnused=()=>{throw new Error('Inapplicable layer consumed random draw');};
describe('Version57 independent action boundaries',()=>{
 it('does not let a deep bystander override a short or exactly30BB opener',()=>{
  for(const stack of [4000,6000]){const o=view(opened(stack));expect(threeBetPlay(o,profile,{type:'fold'},rngUnused)).toEqual({action:{type:'fold'},play:null});}
  const o=view(opened(6000));o.seats.find(s=>s.id===5)!.totalCommitted+=2000;o.seats.find(s=>s.id===5)!.deadAnte=2000;
  expect(threeBetPlay(o,profile,{type:'fold'},rngUnused).play).toBeNull();
  expect(threeBetPlay(view(opened(6200)),profile,{type:'fold'},()=>0).play).toBe('light-3bet');
 });
 it('passive premium-only raises mean QQ+ and AK rather than an ordinal top-percent proxy',()=>{
  const o=view(opened()),earl=regularProfile('big-earl','low');
  for(const cards of [['Js','Jd'],['As','Qs'],['Ks','Qs']]){o.ownCards=cards;expect(threeBetPlay(o,earl,{type:'raise',to:1500},()=>0).play).toBe('flat-not-3bet');}
  for(const cards of [['Qs','Qd'],['As','Kd']]){o.ownCards=cards;expect(threeBetPlay(o,earl,{type:'raise',to:1500},rngUnused).play).toBeNull();}
 });
 it('leaves facing a deep all-in to the existing all-in policy',()=>{
  let s=opened();s=act(s,{type:'raise',to:20000});s=act(act(s,{type:'fold'}),{type:'fold'});
  const o=view(s);o.ownCards=['9c','9d'];expect(threeBetPlay(o,profile,{type:'fold'},rngUnused).play).toBeNull();
 });
 it('does not add speculative stack-off calls when a non-all-in 3bet covers the actor',()=>{
  let s=opened(12000);s=act(s,{type:'raise',to:15000});s=act(act(s,{type:'fold'}),{type:'fold'});
  const o=view(s);o.ownCards=['9c','9d'];expect(o.seats.find(x=>x.id===0)!.allIn).toBe(false);expect(o.legal.callAmount).toBe(o.seats.find(x=>x.id===5)!.stack);
  expect(threeBetPlay(o,profile,{type:'fold'},rngUnused).play).toBeNull();
 });
 it('uses physical postflop order within a collapsed early-position label',()=>{
  let s=startHand({handId:'physical57',button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`S${id}`,stack:40000}))});
  s=act(s,{type:'call'});s=act(s,{type:'raise',to:500});
  for(let i=0;i<7;i++)s=act(s,{type:'fold'});
  s=act(s,{type:'raise',to:1600});
  expect(s.actor).toBe(4); // Both seats3 and4 have the collapsed UTG label;4 is in position.
  const o=view(s),result=threeBetPlay(o,profile,{type:'fold'},()=>0);
  expect(result.play).toBe('4bet-bluff');expect(result.action).toEqual({type:'raise',to:3675});expect(()=>act(s,result.action)).not.toThrow();
 });
 it('does not call an earlier bettor a barreler after they called a check-raise',()=>{
  let s=act(flop(),{type:'check'});s=act(s,{type:'raise',to:500});s=act(s,{type:'raise',to:1500});s=act(s,{type:'call'});s=act(s,{type:'check'});
  expect(s.actor).toBe(5);expect(spotOf(view(s))).toBeNull();
 });
 it('classifies private two pair, weak pairs and eight-out draws separately from air',()=>{
  const s=act(flop(),{type:'check'}),o=view(s),factor=aggressionFactor(profile);
  o.board=['Kh','7d','2c'];o.ownCards=['Ks','7s'];
  expect(aggressionPlay(o,profile,{type:'check'},()=>.7*factor).play).toBe('cbet');
  o.ownCards=['2s','3s']; // weak made pair has medium rate .55, not air .6
  expect(aggressionPlay(o,profile,{type:'check'},()=>.57*factor).play).toBeNull();
  o.board=['9c','8d','2h'];o.ownCards=['7s','6s'];
  const result=aggressionPlay(o,profile,{type:'check'},()=>.65*factor);
  expect(result.play).toBe('cbet');expect(()=>act(s,result.action)).not.toThrow();
  if(result.action.type==='raise')expect(result.action.to%25).toBe(0);
 });
 it('does not fabricate a delayed opportunity without a completed prior street',()=>{
  const o=view(act(flop(),{type:'check'}));o.street='turn';o.board=['Kh','7d','2c','3s'];o.publicEvents=o.publicEvents.filter(e=>e.street!=='flop');
  expect(spotOf(o)).toBeNull();
 });
});
