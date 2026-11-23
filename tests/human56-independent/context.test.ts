import {describe,it,expect} from 'vitest';
import type {BotProfile,GameState} from '../../src/contracts';
import type {StoredHand} from '../../src/session/types';
import type {TournamentEvent,TournamentHand} from '../../src/tournament/runtime';
import {projectView} from '../../src/core/engine';
import {cashImages} from '../../src/session/human-context';
import {tournamentImagesFor} from '../../src/tournament/human-context';
import {hand,rig,checkDown} from '../verification/helpers';

// Full engine showdown supplies public views; the single river raise below is
// deliberate context evidence, not a claimed replay-valid hand history.
function showdown():GameState {
 const state=checkDown(rig(hand(),[['2c','3d'],['Qh','Qd'],['Jc','Td']],['As','Kh','9c','7d','5s']));
 state.events.push({id:'image-raise',handId:state.handId,revision:state.revision,type:'action',seatId:0,street:'river',action:{type:'raise',to:200}});
 return state;
}
const profiles={1:{personalityId:'observer'} as BotProfile,2:{personalityId:'target'} as BotProfile};
const active={sessionId:'session',profiles};
function saved(state=showdown()):StoredHand {
 return {id:'same-hand-id',sessionId:'session',epoch:1,number:1,startedAt:'',endedAt:'',view:projectView(state,0),frames:[],net:0,privateProfiles:structuredClone(profiles),previousHash:'',hash:''};
}
function archived(state:GameState):TournamentHand{return {number:1,settledAt:'',state,frames:[]};}
// These context-only event fixtures intentionally contain only fields read by
// the context adapter. They are never submitted to persistence or replay.
function event(states:GameState[],current=states.at(-1)!):TournamentEvent {
 return {id:'same-event-id',history:states.map(archived),game:structuredClone(current)} as TournamentEvent;
}
const zero={bluff:0,monster:0};
describe('independent public image witness boundaries',()=>{
 it('cash uses explicit public showdown labels, never Hero private cards',()=>{
  const h=saved();expect(cashImages([h],active,1)[0].bluff).toBe(1);
  h.view.handLabels={};expect(cashImages([h],active,1)[0]).toEqual(zero);
  h.view.street='river';expect(cashImages([h],active,1)[0]).toEqual(zero);
 });
 it('cash rejects absent observers, replacements and earlier sessions',()=>{
  const h=saved();expect(cashImages([h],active,99)[0]).toEqual(zero);
  expect(cashImages([h],{...active,profiles:{...profiles,1:{personalityId:'newcomer'} as BotProfile}},1)[0]).toEqual(zero);
  h.view.seats[1].startingStack=0;expect(cashImages([h],active,1)[0]).toEqual(zero);
  h.view.seats[1].startingStack=20000;h.sessionId='other';expect(cashImages([h],active,1)[0]).toEqual(zero);
 });
 it('cash rejoining observers cannot recover observations across their absence',()=>{
  const old=saved(),gap=saved(),recent=saved();gap.privateProfiles[1].personalityId='replacement';recent.view.handLabels={};
  expect(cashImages([old,gap,recent],active,1)[0]).toEqual(zero);
  expect(cashImages([old,gap,recent],active,2)[0].bluff).toBeGreaterThan(1);
 });
 it('cash same IDs and lengths cannot reuse stale evidence or mutable output',()=>{
  const h=saved(),copy=structuredClone(h);copy.view.payouts[0]=100;
  const first=cashImages([h],active,1);expect(first[0].bluff).toBe(1);first[0].bluff=999;
  expect(cashImages([copy],active,1)[0]).toEqual(zero);
  expect(cashImages([h],active,1)[0].bluff).toBe(1);
 });
 it('cash bounds history to latest sixty and ages observations',()=>{
  const first=saved(),quiet=saved();quiet.view.handLabels={};
  expect(cashImages([first,quiet],active,1)[0].bluff).toBeCloseTo(Math.exp(-1/30));
  expect(cashImages([first,...Array.from({length:60},()=>quiet)],active,1)[0]).toEqual(zero);
 });
 it('tournament follows unique event identity across changed local seat numbers',()=>{
  const history=showdown(),current=structuredClone(history);
  [current.seats[0].name,current.seats[2].name]=[current.seats[2].name,current.seats[0].name];
  expect(tournamentImagesFor(event([history],current),1)[2].bluff).toBe(1);
  expect(tournamentImagesFor(event([history],current),1)[0]).toEqual(zero);
 });
 it('tournament requires jointly witnessed hands, including for own image',()=>{
  const historical=showdown(),current=structuredClone(historical);current.seats[1].name='New arrival';
  expect(tournamentImagesFor(event([historical],current),1)[0]).toEqual(zero);
  expect(tournamentImagesFor(event([historical],current),0)[0].bluff).toBe(1);
  expect(tournamentImagesFor(event([historical],current),99)[0]).toEqual(zero);
 });
 it('tournament uses explicit revealed seats and complete hands only',()=>{
  const h=showdown();h.revealedSeats=[];
  expect(tournamentImagesFor(event([h]),1)[0]).toEqual(zero);
  h.revealedSeats=[0];h.street='river';expect(tournamentImagesFor(event([h]),1)[0]).toEqual(zero);
 });
 it('tournament restores divergent saves without contamination and bounds archived blocks',()=>{
  const h=showdown(),a=event([h]),b=structuredClone(a);b.history[0].state.payouts[0]=10;
  expect(tournamentImagesFor(a,1)[0].bluff).toBe(1);
  expect(tournamentImagesFor(b,1)[0]).toEqual(zero);
  const quiet=showdown();quiet.revealedSeats=[];
  const bounded=event(Array.from({length:60},()=>quiet));
  bounded.mtt={blocks:[{heroHands:[archived(h)]}]} as NonNullable<TournamentEvent['mtt']>;
  expect(tournamentImagesFor(bounded,1)[0]).toEqual(zero);
  expect(tournamentImagesFor(a,1)[0].bluff).toBe(1);
 });
});
