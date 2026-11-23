import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {fightPlay} from '../../src/bots/fights';
import {riverPlay} from '../../src/bots/river';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {contestablePricing} from '../../src/bots/pricing';
const hiro=regularProfile('hiro','high');
const rules:RuleProfile={id:'review58',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:String(s.revision),action});
function hu(stack=20000){let s=startHand({handId:'review58',button:0,profile:rules,seats:[{id:0,name:'Hero',stack},{id:1,name:'Other',stack:20000}]});s=act(s,{type:'call'});return act(s,{type:'check'});}
function view(s:GameState,cards:Card[],board:Card[]):BotObservation{const o=observeBot(s,s.actor!,hiro.policyVersion,'review');o.ownCards=cards;o.board=board;return o;}
function read(aggression:number){const r=emptyPlayerRead();r.hands=60;r.vpip={count:18,chances:60};r.pfr={count:12,chances:60};r.reads.aggression={count:aggression*60,chances:60};return r;}
const noDraw=()=>{throw Error('Inapplicable adjustment drew random');};
const board:Card[]=['Kd','8c','4h','2s','Jc'];
function river(stack=20000){let s=hu(stack);for(let i=0;i<4;i++)s=act(s,{type:'check'});return s;}
describe('Version58 independent postflop boundaries',()=>{
 it('recognizes private two pair and eight-out straight draws for check-raises, with legal units',()=>{
  const s=act(act(hu(),{type:'check'}),{type:'raise',to:225});
  const value=fightPlay(view(s,['Kh','8d'],['Kc','8s','2h']),hiro,{type:'call'},()=>0);
  expect(value.play).toBe('check-raise-value');expect(value.action).toEqual({type:'raise',to:675});expect(()=>act(s,value.action)).not.toThrow();
  const draw=fightPlay(view(s,['8h','7c'],['9s','6d','2c']),hiro,{type:'call'},()=>0);
  expect(draw.play).toBe('check-raise-draw');expect(()=>act(s,draw.action)).not.toThrow();
 });
 it('requires actual in-position order for float and raise-draw opportunities',()=>{
  const s=act(hu(),{type:'raise',to:200}),o=view(s,['Ad','Qc'],['9s','6d','2c']);
  expect(fightPlay(o,hiro,{type:'fold'},()=>0).play).toBe('float');
  const out=structuredClone(o);out.button=1;
  expect(fightPlay(out,hiro,{type:'fold'},noDraw).play).toBeNull();
  out.ownCards=['8h','7c'];expect(fightPlay(out,hiro,{type:'call'},noDraw).play).toBeNull();
 });
 it('does not float with the last chips and clamps value raises to a legal short all-in',()=>{
  const s=act(hu(500),{type:'raise',to:400}),o=view(s,['Ad','Qc'],['9s','6d','2c']);
  expect(o.legal.callAmount).toBe(o.seats.find(x=>x.id===o.actingSeat)!.stack);
  expect(fightPlay(o,hiro,{type:'fold'},noDraw).play).toBeNull();
  const value=view(s,['9d','9h'],['9s','6d','2c']),r=fightPlay(value,hiro,{type:'call'},()=>0);
  // Raising cannot reopen an actor who has only enough chips to call.
  expect(r.play).toBeNull();
  const short=act(hu(600),{type:'raise',to:225});
  const raised=fightPlay(view(short,['9d','9h'],['9s','6d','2c']),hiro,{type:'call'},()=>0);
  expect(raised.action).toEqual({type:'raise',to:400});
  expect(()=>act(short,raised.action)).not.toThrow();
 });
 it('requires the same previous bettor, no check-raise, and actual check-to order for take-aways',()=>{
  const flop=act(hu(),{type:'raise',to:200}),s=act(act(flop,{type:'call'}),{type:'check'}),o=view(s,['Ad','Qc'],['9s','6d','2c','3h']);
  expect(fightPlay(o,hiro,{type:'check'},()=>0).play).toBe('take-away');
  const wrong=structuredClone(o);const bet=wrong.publicEvents.find(e=>e.type==='action'&&e.street==='flop'&&e.action?.type==='raise')!;bet.seatId=99;
  expect(fightPlay(wrong,hiro,{type:'check'},noDraw).play).toBeNull();
  const raised=structuredClone(o);raised.publicEvents.push({...bet,seatId:0,revision:bet.revision-1});
  expect(fightPlay(raised,hiro,{type:'check'},noDraw).play).toBeNull();
  const out=structuredClone(o);out.button=1;expect(fightPlay(out,hiro,{type:'check'},noDraw).play).toBeNull();
 });
 it('never converts shared absolute nuts into a big fold or board-only ranks into thin value',()=>{
  const s=act(river(),{type:'raise',to:400}),nuts=view(s,['2c','3d'],['Ah','Kh','Qh','Jh','Th']);
  expect(riverPlay(nuts,hiro,{type:'call'},{1:read(0)},noDraw)).toEqual({action:{type:'call'},play:null});
  const check=act(river(),{type:'check'}),quads=view(check,['As','Kd'],['2c','2d','2h','2s','Qc']);
  expect(riverPlay(quads,hiro,{type:'check'},null,noDraw).play).toBeNull();
 });
 it('uses only the current river bettor public read, not another seat or an earlier street',()=>{
  const o=view(act(river(),{type:'raise',to:400}),['8d','5s'],board);
  expect(riverPlay(o,hiro,{type:'fold'},{1:read(.8),0:read(0)},()=>.15).play).toBe('hero-call');
  expect(riverPlay(o,hiro,{type:'fold'},{1:read(0),0:read(.8)},()=>.15).play).toBeNull();
  const missing=structuredClone(o);missing.publicEvents=missing.publicEvents.filter(e=>e.street!=='river');
  expect(riverPlay(missing,hiro,{type:'fold'},{1:read(.8)},noDraw).play).toBeNull();
 });
 it('prices capped river calls only against chips the actor can win',()=>{
  const s=act(river(2000),{type:'raise',to:10000}),o=view(s,['8d','5s'],board);
  expect(contestablePricing(o).price).toBeCloseTo(.45);
  expect(o.legal.callAmount/(o.pot+o.legal.callAmount)).toBeLessThan(.15);
  expect(riverPlay(o,hiro,{type:'fold'},{1:read(.65)},()=>.3).play).toBeNull();
 });
 it('leaves recreational hero calls and big folds to the existing policy',()=>{
  const o=view(act(river(),{type:'raise',to:400}),['8d','5s'],board);
  for(const id of ['big-earl','dot','vince','sal'])for(const action of [{type:'fold'},{type:'call'}] as Action[]){
   expect(riverPlay(o,regularProfile(id,'low'),action,{1:read(.8)},noDraw)).toEqual({action,play:null});
  }
 });
});
