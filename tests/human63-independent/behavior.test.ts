import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {leakPlay,leaksOf} from '../../src/bots/leaks';
import {quirkPlay} from '../../src/bots/quirks';
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const rules:RuleProfile={id:'review60',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:String(s.revision),action});
function flop(){let s=startHand({handId:'review60',button:0,profile:rules,seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Other',stack:20000}]});s=act(s,{type:'call'});return act(s,{type:'check'});}
function turn(){return act(act(flop(),{type:'check'}),{type:'check'});}
function river(){return act(act(turn(),{type:'check'}),{type:'check'});}
function view(s:GameState,cards:Card[],board:Card[]):BotObservation {const o=observeBot(s,s.actor!,hiro.policyVersion,'review');o.ownCards=cards;o.board=board;return o;}

const noDraw=()=>{throw Error('Inapplicable behavior drew randomness');};
describe('Version61 independent signature boundaries',()=>{
 it('edited seed identities do not inherit authored leaks',()=>{
  const edited={...earl,skill:.9};expect(leaksOf(edited,'big-earl')).toEqual(leaksOf(edited));expect(leaksOf(earl,'big-earl')).toEqual(['pays-off-rivers','draw-chaser']);
 });
 it('river bluff requires a missed draw and actual checked-to position',()=>{
  const board:Card[]=['Kh','8h','2c','4d','7s'];
  const oop=view(river(),['Qh','Jh'],board);
  expect(leakPlay(oop,earl,{type:'check'},['river-bluffer'],noDraw).play).toBeNull();
  const ip=view(act(river(),{type:'check'}),['Qh','Jh'],board);
  const result=leakPlay(ip,earl,{type:'check'},['river-bluffer'],()=>0);
  expect(result.play).toBe('river-bluffer');expect(()=>act(act(river(),{type:'check'}),result.action)).not.toThrow();
  ip.ownCards=['Qc','Jd'];expect(leakPlay(ip,earl,{type:'check'},['river-bluffer'],noDraw).play).toBeNull();
 });
 it('board-only strength is neither a slowplay nor a blocker hand',()=>{
  const t=view(turn(),['Ah','Kd'],['2c','2d','2h','8s']);
  expect(leakPlay(t,earl,{type:'raise',to:400},['slowplays-monsters'],noDraw).play).toBeNull();
  const r=view(river(),['Ah','Kd'],['2c','2d','8h','8s','3c']);
  expect(quirkPlay(r,earl,{type:'check'},noDraw).play).toBeNull();
 });
 it('shared absolute nuts never become a scared-money fold',()=>{
  const o=view(act(river(),{type:'raise',to:1000}),['2d','3d'],['Ah','Kh','Qh','Jh','Th']);
  expect(leakPlay(o,earl,{type:'call'},['scared-money','one-and-done'],noDraw).action).toEqual({type:'call'});
 });
 it('skilled players cannot get the recreational limp-reraise',()=>{
  const s=startHand({handId:'pre',button:0,profile:rules,seats:[{id:0,name:'A',stack:20000},{id:1,name:'B',stack:20000}]});
  const o=view(act(act(s,{type:'call'}),{type:'raise',to:600}),['Ah','Ad'],[]);
  expect(quirkPlay(o,hiro,{type:'call'},noDraw).play).toBeNull();
  expect(quirkPlay(o,earl,{type:'call'},()=>0).play).toBe('limp-reraise');
  const own=o.seats.find(x=>x.id===o.actingSeat)!;own.stack=1000;
  expect(quirkPlay(o,earl,{type:'call'},noDraw).play).toBeNull();
 });
});
