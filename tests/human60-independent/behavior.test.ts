import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {calibrationPlay} from '../../src/bots/calibration';
import {bigPot,grudgesFrom,grudge,rivalryPlay,rivalryProfile,protectRivalryExposure,type RivalryHand} from '../../src/bots/rivalry';
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const rules:RuleProfile={id:'review59',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:25,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:String(s.revision),action});
function flop(){let s=startHand({handId:'review59',button:0,profile:rules,seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Other',stack:20000}]});s=act(s,{type:'call'});return act(s,{type:'check'});}
function turn(){return act(act(flop(),{type:'check'}),{type:'check'});}
function river(){return act(act(turn(),{type:'check'}),{type:'check'});}
function view(s:GameState,cards:Card[],board:Card[]):BotObservation {const o=observeBot(s,s.actor!,hiro.policyVersion,'review');o.ownCards=cards;o.board=board;return o;}
const noDraw=()=>{throw Error('Inapplicable adjustment drew randomness');};
const identity=(seat:number)=>String(seat),g={'0':{'1':1},'1':{'0':1}};
describe('Version59 independent calibration and grudge boundaries',()=>{
 it('recognizes private two pair for value but not board-only strength',()=>{
  const s=act(turn(),{type:'check'}),o=view(s,['Kh','8d'],['Kc','8s','2h','3c']);
  const r=calibrationPlay(o,hiro,{type:'check'},()=>0);expect(r.play).toBe('value-floor');expect(()=>act(s,r.action)).not.toThrow();expect(r.action.type==='raise'&&r.action.to%25===0).toBe(true);
  const board=view(act(river(),{type:'check'}),['As','Kd'],['2c','2d','2h','2s','Qc']);
  expect(calibrationPlay(board,hiro,{type:'check'},noDraw).play).toBeNull();
 });
 it('requires unique checks from every actionable opponent and real last position for stabs',()=>{
  const o=view(act(turn(),{type:'check'}),['Qh','Jd'],['Ks','8c','2d','4h']);
  expect(calibrationPlay(o,hiro,{type:'check'},()=>0).play).toBe('last-stab');
  const out=structuredClone(o);out.button=1;expect(calibrationPlay(out,hiro,{type:'check'},noDraw).play).toBeNull();
  const wrong=structuredClone(o);wrong.publicEvents.find(e=>e.street==='turn'&&e.type==='action')!.seatId=99;
  expect(calibrationPlay(wrong,hiro,{type:'check'},noDraw).play).toBeNull();
 });
 it('keeps live straight draws and absolute nuts out of weak-fold adjustments',()=>{
  const o=view(act(turn(),{type:'raise',to:400}),['8h','7d'],['9s','6c','2d','Kh']);
  expect(calibrationPlay(o,hiro,{type:'call'},noDraw).play).toBeNull();
  const gut=structuredClone(o);gut.ownCards=['8h','5d'];expect(calibrationPlay(gut,hiro,{type:'call'},noDraw).play).toBeNull();
  const nuts=view(act(river(),{type:'raise',to:400}),['2d','3d'],['Ah','Kh','Qh','Jh','Th']);
  expect(calibrationPlay(nuts,hiro,{type:'call'},noDraw).play).toBeNull();
 });
 it('station calls require a private pair or live draw and less than half a remaining stack',()=>{
  const o=view(act(flop(),{type:'raise',to:400}),['8h','5d'],['9s','6c','2d']);
  expect(calibrationPlay(o,earl,{type:'fold'},()=>0).play).toBe('station-call');
  const board=structuredClone(o);board.ownCards=['Ah','Kd'];board.board=['9s','9c','2d'];expect(calibrationPlay(board,earl,{type:'fold'},noDraw).play).toBeNull();
  const pair=structuredClone(o);pair.ownCards=['9h','5d'];pair.legal.callAmount=pair.seats.find(s=>s.id===pair.actingSeat)!.stack/2;
  expect(calibrationPlay(pair,earl,{type:'fold'},noDraw).play).toBeNull();
 });
 it('does not invent a rivalry between unrelated side-pot winner and main-pot loser',()=>{
  const ambiguous:RivalryHand={identities:{0:'short',1:'main',2:'side'},committed:{0:6000,1:20000,2:20000},won:{1:18000,2:28000},bigBlind:200,pots:[{winners:[1]},{winners:[2]}]};
  expect(bigPot(ambiguous)).toBeNull();expect(grudgesFrom([ambiguous])).toEqual({});
  const split={...ambiguous,pots:[{winners:[1,2]}]};expect(bigPot(split)).toBeNull();
  const fallback={...ambiguous,pots:undefined};expect(bigPot(fallback)).toBeNull();
  const same={...ambiguous,won:{2:46000},pots:[{winners:[2]},{winners:[2]}]};expect(bigPot(same)).toEqual({loser:'main',winner:'side',lossBB:100});
 });
 it('builds and decays a public single-winner grudge without reading private fields',()=>{
  const hand:RivalryHand={identities:{0:'hero',1:'other'},committed:{0:20000,1:20000},won:{0:40000},bigBlind:200,pots:[{winners:[0]}]};
  Object.defineProperty(hand,'hole',{get(){throw Error('Private card access');}});
  expect(grudge(grudgesFrom([hand]),'other','hero')).toBe(1);
  expect(grudge(grudgesFrom([hand,...Array(300).fill({...hand,committed:{0:200,1:200},won:{0:400}})]),'other','hero')).toBeCloseTo(.5);
  expect(bigPot({...hand,bigBlind:0})).toBeNull();
 });
 it('guards profile effects where the base policy could commit half a stack',()=>{
  const o=view(act(flop(),{type:'raise',to:400}),['9h','5d'],['9s','6c','2d']);
  expect(rivalryProfile(o,earl,g,identity)).toEqual({profile:earl,effect:null});
  const capped=structuredClone(o);capped.legal.maxRaiseTo=1000;
  expect(rivalryProfile(capped,earl,g,identity).effect).not.toBeNull();
  capped.legal.callAmount=capped.seats.find(s=>s.id===capped.actingSeat)!.stack/2;
  expect(rivalryProfile(capped,earl,g,identity).effect).toBeNull();
 });
 it('caps grudge-only raises below half stack and protects against later resizing',()=>{
  const s=act(flop(),{type:'raise',to:4000}),o=view(s,['9h','9d'],['9s','6c','2d']),own=o.seats.find(x=>x.id===o.actingSeat)!;
  const r=rivalryPlay(o,hiro,{type:'call'},g,identity,()=>0);expect(r.play).toBe('grudge-raise');
  expect(r.action.type==='raise'&&r.action.to-own.streetCommitted<own.stack/2).toBe(true);expect(()=>act(s,r.action)).not.toThrow();
  expect(protectRivalryExposure(o,{type:'raise',to:own.streetCommitted+own.stack/2},{type:'call'})).toEqual({type:'call'});
  expect(protectRivalryExposure(o,r.action,{type:'call'})).toEqual(r.action);
 });
});
