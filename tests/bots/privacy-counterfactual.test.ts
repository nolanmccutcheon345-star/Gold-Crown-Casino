import {afterEach,describe,it,expect,vi} from 'vitest';
import type {Action,BotObservation,GameState,RuleProfile,Street} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot,projectView,startHand,legalActions} from '../../src/core/engine';
import * as deck from '../../src/core/deck';
import {ARCHETYPES,defaultProfile,chooseDecision,DecisionCache,policyDistribution} from '../../src/bots/policy';

const profile:RuleProfile={id:'privacy-practice',version:'0.1.0',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,action:Action,id=`test:${s.handId}:${s.revision}`)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:id,action});
const passive=(s:GameState)=>act(s,legalActions(s).check?{type:'check'}:{type:'call'});
function make(street:Street='preflop'):GameState {
 const mock=vi.spyOn(deck,'secureDeck').mockImplementation(()=>deck.standardDeck());
 let state=startHand({handId:'counterfactual-v1',profile,button:0,seats:Array.from({length:6},(_,id)=>({id,name:`Seat ${id}`,stack:200}))});
 mock.mockRestore();
 while(state.street!==street) state=passive(state);
 expect(state.actor).not.toBe(0);return state;
}
/** Change hidden Hero cards by swapping with unused future cards, retaining a valid 52-card deck. */
function replaceHeroCards(state:GameState):GameState {
 const changed=structuredClone(state);const hero=changed.seats.find(s=>s.id===0)!;
 const replacement=changed.deck.slice(-2);
 hero.hole.forEach((old,index)=>{
  const before=changed.deck.indexOf(old),after=changed.deck.indexOf(replacement[index]);
  [changed.deck[before],changed.deck[after]]=[changed.deck[after],changed.deck[before]];
 });
 hero.hole=replacement;
 expect(new Set(changed.deck).size).toBe(52);
 expect(changed.seats.find(s=>s.id===state.actor)!.hole).toEqual(state.seats.find(s=>s.id===state.actor)!.hole);
 return changed;
}
function permuteFuture(state:GameState):GameState {
 const changed=structuredClone(state);
 changed.deck=[...changed.deck.slice(0,changed.deckCursor),...changed.deck.slice(changed.deckCursor).reverse()];
 expect(changed.deck).not.toEqual(state.deck);expect(new Set(changed.deck).size).toBe(52);return changed;
}
function random(seed:number):()=>number {let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/0x1_0000_0000;};}
function observation(state:GameState):BotObservation {
 const p=defaultProfile('tag');return observeBot(state,state.actor!,p.policyVersion,`decision:${state.handId}:${state.revision}`);
}
function assertSamePolicies(before:GameState,after:GameState):void {
 const a=observation(before),b=observation(after);expect(a).toEqual(b);
 for(const archetype of ARCHETYPES) {
  const p=defaultProfile(archetype);
  expect(policyDistribution(a,p)).toEqual(policyDistribution(b,p));
  // Matching inputs, stream and exact joint action+size are stronger than merely comparing average counts.
  for(let seed=1;seed<=64;seed++) expect(chooseDecision(a,p,random(Math.imul(seed,2654435761)))).toEqual(chooseDecision(b,p,random(Math.imul(seed,2654435761))));
 }
}
afterEach(()=>vi.restoreAllMocks());

describe('acceptance privacy boundary: actual authoritative observations',()=>{
 it('E01: exposes only own cards and the declared public fields',()=>{
  const state=make('flop'),o=observation(state);
  expect(Object.keys(o).sort()).toEqual(['handId','revision','actingSeat','decisionId','policyVersion','ownCards','board','street','button','pot','bigBlind','seats','legal','publicEvents'].sort());
  expect(o.ownCards).toEqual(state.seats.find(s=>s.id===state.actor)!.hole);
  expect(o.board).toEqual(state.board);
  for(const seat of o.seats) expect(Object.keys(seat).sort()).toEqual(['id','stack','streetCommitted','totalCommitted','folded','allIn'].sort());
  for(const event of o.publicEvents) if(event.cards) {expect(event.type).toBe('street');expect(event.cards.every(c=>state.board.includes(c))).toBe(true);}
  for(const secret of ['deck','deckCursor','burned','heroCards','profiles','privateRanges','rngState']) expect(Reflect.get(o,secret)).toBeUndefined();
  o.board[0]='XX';o.ownCards[0]='XX';expect(state.board).not.toContain('XX');expect(state.seats.find(s=>s.id===state.actor)!.hole).not.toContain('XX');
 });
 it.each(['preflop','flop','turn','river'] as const)('E02/R13: hidden Hero replacement cannot change %s conditional policy or sampled size',street=>{
  const state=make(street);const changed=replaceHeroCards(state);
  expect(changed.seats[0].hole).not.toEqual(state.seats[0].hole);assertSamePolicies(state,changed);
 });
 it.each(['preflop','flop','turn','river'] as const)('E03/R14: future deck permutation cannot change %s conditional policy or sampled size',street=>{
  const state=make(street);assertSamePolicies(state,permuteFuture(state));
 });
 it('E04: access to deck or another player’s hole cards is absent, even with throwing authority getters',()=>{
  const state=make('flop');
  Object.defineProperty(state,'deck',{get(){throw new Error('Forbidden authority deck read');}});
  for(const seat of state.seats) if(seat.id!==state.actor) Object.defineProperty(seat,'hole',{get(){throw new Error('Forbidden opponent hole read');}});
  const o=observation(state);
  expect(Reflect.get(o,'deck')).toBeUndefined();expect(o.seats.every(s=>Reflect.get(s,'hole')===undefined)).toBe(true);
  Object.defineProperty(o,'deck',{get(){throw new Error('Forbidden leaked property read');}});
  expect(()=>chooseDecision(o,defaultProfile('tag'),()=>.5)).not.toThrow();
 });
 it('E05: folded Hero cards remain unavailable during later action and after showdown',()=>{
  let state=make();while(state.actor!==0)state=passive(state);
  state=act(state,{type:'fold'});expect(state.seats[0].folded).toBe(true);
  const heroCards=[...state.seats[0].hole];assertSamePolicies(state,replaceHeroCards(state));
  let moves=0;while(state.street!=='complete'&&moves++<100)state=passive(state);
  expect(state.street).toBe('complete');
  const publicHistory=projectView(state,1);
  expect(publicHistory.seats[0].hole).toEqual([]);
  for(const card of heroCards) {expect(publicHistory.board).not.toContain(card);expect(publicHistory.events.some(e=>e.cards?.includes(card))).toBe(false);}
  // These policies have no adaptive opponent memory. A new hand has no prior-hand events or decisions.
  const next=startHand({handId:'next-privacy-hand',profile,button:1,seats:state.seats.filter(s=>s.stack>0).map(({id,name,stack})=>({id,name,stack}))});
  expect(observation(next).publicEvents.every(e=>e.handId===next.handId)).toBe(true);expect(new DecisionCache().size).toBe(0);
 });
});

describe('cached advisory decisions never bypass authoritative revision guards',()=>{
 it('duplicate callback commits once; a stale unsent callback has no chip effect',()=>{
  const state=make(),o=observation(state),cache=new DecisionCache(()=>.99),p=defaultProfile('tag');
  const decision=cache.getOrCreate(o,p),next=applyCommand(state,decision);
  const oneEvent=next.events.filter(e=>e.type==='action'&&e.decisionId===decision.decisionId);
  expect(oneEvent).toHaveLength(1);expect(applyCommand(next,decision)).toBe(next);assertAccounting(next);
  const advanced=passive(state),snapshot=structuredClone(advanced);
  expect(()=>applyCommand(advanced,decision)).toThrow(/Stale revision/);expect(advanced).toEqual(snapshot);
 });
 it('a late reply from hand A cannot mutate hand B or cause a second policy sample',()=>{
  const a=make(),p=defaultProfile('tag'),draw=vi.fn(()=>.99),cache=new DecisionCache(draw);
  const old=cache.getOrCreate(observation(a),p),samples=draw.mock.calls.length;
  const b=startHand({handId:'different-hand',profile,button:0,seats:a.seats.map(({id,name,startingStack})=>({id,name,stack:startingStack}))});
  const snapshot=structuredClone(b);
  expect(()=>applyCommand(b,old)).toThrow(/Stale hand/);expect(b).toEqual(snapshot);assertAccounting(b);
  expect(()=>cache.getOrCreate(observation(b),p)).toThrow(/another hand/);expect(draw).toHaveBeenCalledTimes(samples);
 });
});
