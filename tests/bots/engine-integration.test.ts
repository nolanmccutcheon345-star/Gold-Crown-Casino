import {describe,it,expect,vi} from 'vitest';
import type {GameState,Action,RuleProfile} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand} from '../../src/core/engine';
import * as deck from '../../src/core/deck';
import {ARCHETYPES,defaultProfile,chooseDecision,DecisionCache} from '../../src/bots/policy';

const profile:RuleProfile={id:'practice',version:'0.1.0',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`setup:${s.handId}:${s.revision}`,action});
/** Deterministic generators are confined to this test. Card and policy streams stay separate. */
function testRandom(seed:number):()=>number {let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/0x1_0000_0000;};}
function testDeck(random:()=>number):string[] {const cards=deck.standardDeck();for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}

describe('bot decision adapter against authoritative engine',()=>{
 it('accepts engine short-all-in bounds where minimum exceeds maximum',()=>{
  let state=startHand({handId:'short-all-in-adapter',profile,button:0,seats:[200,14,200].map((stack,id)=>({id,name:`Seat ${id}`,stack}))});
  state=act(state,{type:'raise',to:10});
  expect(state.actor).toBe(1);
  const legal=legalActions(state);
  expect(legal.canRaise).toBe(true);
  expect(legal.minRaiseTo).toBe(18);expect(legal.maxRaiseTo).toBe(14);expect(legal.shortAllInTo).toBe(14);
  const bot=defaultProfile('maniac');
  const observation=observeBot(state,1,bot.policyVersion,'short-jam');
  const decision=chooseDecision(observation,bot,()=>0.999999);
  expect(decision.action).toEqual({type:'raise',to:14});
  const next=applyCommand(state,decision);
  expect(next.currentBet).toBe(14);expect(next.seats[1].stack).toBe(0);assertAccounting(next);
 });
 it.each([2,6,9,10])('terminates 40 seeded %i-seat bot hands with chip conservation and idempotent commits',count=>{
  const deckRandom=testRandom(107010+count);
  const policyRandom=testRandom(207010+count);
  const stackRandom=testRandom(307010+count);
  const mock=vi.spyOn(deck,'secureDeck').mockImplementation(()=>testDeck(deckRandom));
  try {
   for(let hand=0;hand<40;hand++) {
    let state=startHand({handId:`bots-seed-${count}-${hand}`,profile,button:hand%count,
      seats:Array.from({length:count},(_,id)=>({id,name:`Seat ${id}`,stack:2+Math.floor(stackRandom()*500)}))});
    const cache=new DecisionCache(policyRandom);
    let actions=0;
    while(state.street!=='complete'&&actions<1000) {
      const bot=defaultProfile(ARCHETYPES[state.actor!%ARCHETYPES.length]);
      const observation=observeBot(state,state.actor!,bot.policyVersion,`${state.handId}:${state.revision}:${state.actor}`);
      const decision=cache.getOrCreate(observation,bot);
      expect(cache.getOrCreate(structuredClone(observation),{...bot})).toEqual(decision);
      const next=applyCommand(state,decision);
      expect(applyCommand(next,decision)).toBe(next);
      state=next;actions++;assertAccounting(state);
    }
    expect(state.street,`hand ${state.handId} did not terminate after ${actions} actions`).toBe('complete');
    expect(state.pot).toBe(0);expect(state.actor).toBe(null);
    expect(state.seats.reduce((sum,s)=>sum+s.stack,0)+state.rake).toBe(state.initialTotal);
   }
  } finally {mock.mockRestore();}
 });
});
