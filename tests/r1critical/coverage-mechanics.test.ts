import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Action} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,nextHand,observeBot,projectView,startHand} from '../../src/core/engine';
import * as deck from '../../src/core/deck';
import {chooseDecision,defaultProfile} from '../../src/bots/policy';
import {seedStream} from '../../src/bots/profiles';
import {act,checkDown,hand,practiceProfile,rig} from '../verification/helpers';

afterEach(()=>vi.restoreAllMocks());
describe('Exact previously unmapped R1 mechanics obligations',()=>{
 it('A04: consecutive ordinary production hands use fresh non-forced CSPRNG decks and preserve earlier state',()=>{
  let state=hand([100000,100000]);
  for(let i=0;i<12;i++){
   const old=act(state,{type:'fold'}),snapshot=structuredClone(old);
   state=nextHand(old,`ordinary-new-deal-${i}`);
   expect(state.deck).not.toEqual(old.deck);expect(new Set(state.deck).size).toBe(52);expect(old).toEqual(snapshot);
   expect(state.seats.flatMap(seat=>seat.hole).every(card=>state.deck.includes(card))).toBe(true);assertAccounting(state);
  }
 });

 it('V402: changing bot computation count and random stream never consumes the sealed test deck stream or changes remaining cards',()=>{
  const deckCall=vi.spyOn(deck,'secureDeck').mockImplementation(()=>deck.standardDeck());
  const run=(computations:number)=>{
   const state=hand([20000,20000,20000]),profile=defaultProfile('tag'),observation=observeBot(state,state.actor!,profile.policyVersion,'independent-stream');
   const before=structuredClone(state.deck);
   for(let i=0;i<computations;i++)chooseDecision(observation,profile,seedStream(83000+i));
   expect(state.deck).toEqual(before);return checkDown(state);
  };
  const first=run(0),busy=run(100);
  expect(deckCall).toHaveBeenCalledTimes(2);expect(busy.deck).toEqual(first.deck);expect(busy.board).toEqual(first.board);expect(busy.burned).toEqual(first.burned);expect(busy.payouts).toEqual(first.payouts);
 });

 it('A10: folding Hero preflop neither reveals private cards to another seat nor rewrites the already committed future board',()=>{
  let state=rig(hand([1000,1000,1000]),[['As','Ah'],['Ks','Kh'],['Qs','Qh']],['2c','3d','7s','8c','9h']);
  const originalDeck=[...state.deck];state=act(state,{type:'fold'});expect(state.seats[0].folded).toBe(true);
  while(state.street!=='complete'){
   const o=observeBot(state,state.actor!,defaultProfile('tag').policyVersion,`after-fold-${state.revision}`);
   expect(o).not.toHaveProperty('deck');expect(o.seats.every(seat=>!('hole' in seat))).toBe(true);
   expect(state.deck).toEqual(originalDeck);state=act(state,{type:legalActions(state).check?'check':'call'});
  }
  expect(state.board).toEqual(['2c','3d','7s','8c','9h']);expect(projectView(state,1).seats[0].hole).toEqual([]);
 });

 it('M04/V406: refunded excess precedes capped rake and three tied pot splits, and duplicate settlement returns exactly once',()=>{
  const profile={...practiceProfile(),smallBlind:1,bigBlind:2,rake:{basisPoints:500,cap:7,noFlopNoDrop:true}};
  let state=rig(startHand({handId:'raked-three-tied-pots',button:0,profile,seats:[50,120,300,500,100].map((stack,id)=>({id,name:String(id),stack}))}),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
  for(const action of [{type:'call'},{type:'call'},{type:'raise',to:50},{type:'raise',to:120},{type:'raise',to:300},{type:'raise',to:500}] as Action[])state=act(state,action);
  const command={handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:'settle-once',action:{type:'fold'} as Action};
  state=applyCommand(state,command);expect(state.street).toBe('complete');
  expect(state.pots.map(pot=>pot.amount)).toEqual([195,210,360]);expect(state.rake).toBe(7);
  expect(state.events.filter(event=>event.type==='refund').map(event=>({seat:event.seatId,amount:event.amount}))).toEqual([{seat:3,amount:200}]);
  expect(state.events.findIndex(event=>event.type==='refund')).toBeLessThan(state.events.findIndex(event=>event.type==='rake'));
  expect(state.seats.map(seat=>seat.stack)).toEqual([48,119,299,499,98]);expect(state.payouts).toEqual({0:48,1:119,2:299,3:299});
  expect(applyCommand(state,command)).toBe(state);assertAccounting(state);
 });

 it('X06/X07: cumulative short raises reopen only actors facing a full increment while a previously unacted player retains raise rights',()=>{
  for(const [first,second,reopen] of [[140,180,false],[150,200,true]] as const){
   const profile={...practiceProfile(),smallBlind:1,bigBlind:2};
   let state=hand([1000,1000,first+2,second+2],0,profile);
   while(state.street==='preflop')state=act(state,{type:legalActions(state).check?'check':'call'});
   state=act(state,{type:'raise',to:100});state=act(state,{type:'raise',to:first});state=act(state,{type:'raise',to:second});
   expect(state.actor).toBe(0);expect(legalActions(state).canRaise).toBe(true);expect(legalActions(state).minRaiseTo).toBe(second+100);
   state=act(state,{type:'call'});expect(state.actor).toBe(1);expect(legalActions(state).canRaise).toBe(reopen);
   if(!reopen)expect(()=>act(state,{type:'raise',to:second+100})).toThrow();
   state=checkDown(state);assertAccounting(state);
  }
 });
});
