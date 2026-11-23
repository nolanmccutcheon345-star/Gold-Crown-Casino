import {describe,it,expect} from 'vitest';
import type {BotProfile,GameState} from '../../src/contracts';
import type {StoredHand} from '../../src/session/types';
import type {TournamentEvent,TournamentHand} from '../../src/tournament/runtime';
import {projectView} from '../../src/core/engine';
import {cashGrudges,cashIdentity} from '../../src/session/human-context';
import {tournamentGrudgesFor} from '../../src/tournament/human-context';
import {grudge} from '../../src/bots/rivalry';
import {act,seededHand} from '../verification/helpers';
const profiles={1:{personalityId:'persistent-observer'} as BotProfile};
function bigLoss():GameState {
 let s=seededHand([20000,20000],59123);s.seats[0].name='You';s.seats[1].name='Observer';
 s=act(s,{type:'raise',to:6000});s=act(s,{type:'call'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:6000});
 s=act(s,{type:'fold'});expect(s.street).toBe('complete');return s;
}
function saved(state=bigLoss()):StoredHand {
 return {id:'same-id',sessionId:'session',epoch:1,number:1,startedAt:'',endedAt:'',view:projectView(state,0),frames:[],net:0,privateProfiles:structuredClone(profiles),previousHash:'',hash:''};
}
function quiet():StoredHand {const h=saved();h.view.payouts={};h.view.pots=[];for(const seat of h.view.seats)seat.totalCommitted=0;return h;}
function archived(state:GameState):TournamentHand{return {number:1,settledAt:'',state,frames:[]};}
// Context-only adapters read these exact public fields; these reduced event
// fixtures are never submitted as replay-valid saves.
function event(states:GameState[],current=states.at(-1)!):TournamentEvent {
 return {id:'same-event',history:states.map(archived),game:structuredClone(current)} as TournamentEvent;
}
describe('independent rivalry evidence boundaries',()=>{
 it('carries only a persistent cash personality own loss across sessions and changed seats',()=>{
  const h=saved(),g=cashGrudges([h]),current={profiles:{4:profiles[1]}},identity=cashIdentity(current);
  expect(identity(4)).toBe('persistent-observer');expect(identity(0)).toBe('hero');
  expect(grudge(g,identity(4),identity(0))).toBeCloseTo(.3);
  expect(grudge(g,'newcomer','hero')).toBe(0);expect(grudge(g,'hero','persistent-observer')).toBe(0);
  h.sessionId='earlier-session';expect(cashGrudges([h])).toEqual(g);
 });
 it('never uses a stale same-ID/same-length cache or shares mutable output',()=>{
  const h=saved(),g=cashGrudges([h]);g['persistent-observer'].hero=900;
  expect(grudge(cashGrudges([h]),'persistent-observer','hero')).toBeCloseTo(.3);
  const copy=structuredClone(h);copy.view.seats[1].totalCommitted=0;
  expect(cashGrudges([copy])).toEqual({});
 });
 it('uses the same latest120 canonical hands in full and compact histories',()=>{
  const h=saved(),q=quiet(),full=[h,...Array.from({length:100},()=>q),h,...Array.from({length:19},()=>q)];
  expect(cashGrudges(full)).toEqual(cashGrudges(full.slice(-120)));
  expect(grudge(cashGrudges([h,q]),'persistent-observer','hero')).toBeCloseTo(.3*Math.pow(.5,1/300));
  expect(cashGrudges([h,...Array.from({length:120},()=>q)])).toEqual({});
 });
 it('excludes unfinished hands, absent funded players and ambiguous duplicate personalities',()=>{
  const h=saved();h.view.street='river';expect(cashGrudges([h])).toEqual({});h.view.street='complete';
  h.view.seats[1].startingStack=0;expect(cashGrudges([h])).toEqual({});
  h.view.seats[1].startingStack=20000;h.privateProfiles[2]=profiles[1];
  expect(cashIdentity({profiles:h.privateProfiles})(1)).toBeUndefined();expect(cashGrudges([h])).toEqual({});
 });
 it('passes public pot winner attribution and never reads hidden cards',()=>{
  const h=saved();for(const seat of h.view.seats)Object.defineProperty(seat,'hole',{get(){throw Error('Private cards accessed');}});
  expect(grudge(cashGrudges([h]),'persistent-observer','hero')).toBeCloseTo(.3);
  h.view.pots.push({amount:100,eligible:[1],winners:[1]});
  expect(cashGrudges([h])).toEqual({});
 });
 it('follows a tournament holder across local seat moves without leaking another holder row',()=>{
  const state=bigLoss(),current=structuredClone(state);current.seats[1].id=7;
  const e=event([state],current),g=tournamentGrudgesFor(e,7);
  expect(g).toEqual({Observer:{You:.3}});expect(tournamentGrudgesFor(e,0)).toEqual({});
  current.seats[1].name='New arrival';expect(tournamentGrudgesFor(event([state],current),7)).toEqual({});
  expect(tournamentGrudgesFor(e,99)).toEqual({});
 });
 it('recomputes tournament public evidence for restored same-ID events and ignores hidden cards',()=>{
  const state=bigLoss(),e=event([state]);const first=tournamentGrudgesFor(e,1);first.Observer.You=999;
  for(const seat of state.seats)Object.defineProperty(seat,'hole',{get(){throw Error('Private cards accessed');}});
  Object.defineProperty(state,'deck',{get(){throw Error('Deck accessed');}});
  expect(tournamentGrudgesFor(e,1)).toEqual({Observer:{You:.3}});
  state.seats[1].totalCommitted=0;expect(tournamentGrudgesFor(e,1)).toEqual({});
 });
 it('bounds tournament evidence to300 Hero-table hands, aging only own witnessed losses',()=>{
  const state=bigLoss(),q=structuredClone(state);q.payouts={};q.pots=[];for(const seat of q.seats)seat.totalCommitted=0;
  const e=event([state,...Array.from({length:300},()=>q)],state);
  expect(tournamentGrudgesFor(e,1)).toEqual({});
  const unseen=structuredClone(q);unseen.seats[1].name='Someone else';
  expect(grudge(tournamentGrudgesFor(event([state,unseen],state),1),'Observer','You')).toBeCloseTo(.3*Math.pow(.5,1/300));
 });
});
