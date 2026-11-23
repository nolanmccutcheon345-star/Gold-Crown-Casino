import { describe, expect, it } from 'vitest';
import type { BotObservation, PublicMemoryHand } from '../../src/contracts';
import { observeBot } from '../../src/core/engine';
import { ARCHETYPES, analyzeDecision, buildOpponentMemory, chooseDecision, createProfile, DecisionCache } from '../../src/bots/policy';
import { scenarios, seededRandom } from './scenarios';

function trap(object:object,key:string){Object.defineProperty(object,key,{enumerable:true,get(){throw new Error(`Forbidden read: ${key}`);}});}
function relabel(o:BotObservation):BotObservation{
 const copy=structuredClone(o),map=(id:number)=>(id+1)%o.seats.length;
 copy.actingSeat=map(o.actingSeat);copy.button=map(o.button);copy.legal.actor=map(o.legal.actor!);
 copy.seats.forEach(seat=>{seat.id=map(seat.id);});copy.publicEvents.forEach(event=>{if(event.seatId!==undefined)event.seatId=map(event.seatId);});
 copy.memory?.opponents.forEach(opponent=>{opponent.seatId=map(opponent.seatId);});return copy;
}
describe('Independent policy secrecy and identity invariants',()=>{
 it('never reads unknown hidden observation fields, seat cards or arbitrary event annotations',()=>{
  const probe=scenarios().find(s=>s.id==='flop-cbet-air')!;
  for(const [index,archetype]of ARCHETYPES.entries()){
   const p=createProfile({selection:archetype},600+index,'neutral');const observation=observeBot(probe.state,probe.state.actor!,p.policyVersion,'privacy');
   const clean=chooseDecision(observation,p,seededRandom(99));
   for(const key of ['heroCards','deck','burned','futureBoard','privateProfiles','winningSeat'])trap(observation,key);
   for(const seat of observation.seats)trap(seat,'hole');
   for(const event of observation.publicEvents)for(const key of ['cards','detail','privateCards','futureDeck'])trap(event,key);
   expect(chooseDecision(observation,p,seededRandom(99))).toEqual(clean);
  }
 });
 it('changing every unseen card and future deck cannot change the observed decision',()=>{
  const state=scenarios().find(s=>s.id==='early-jto')!.state;const p=createProfile({selection:'stronger-reg'},17,'neutral');
  const before=observeBot(state,state.actor!,p.policyVersion,'unseen');const privateVariant=structuredClone(state);
  for(const seat of privateVariant.seats)if(seat.id!==state.actor)trap(seat,'hole');
  for(const key of ['deck','deckCursor','burned'])trap(privateVariant,key);
  const after=observeBot(privateVariant,state.actor!,p.policyVersion,'unseen');expect(after).toEqual(before);
  expect(chooseDecision(after,p,seededRandom(1))).toEqual(chooseDecision(before,p,seededRandom(1)));
 });
 it('consistent seat relabeling, including Hero seat zero, preserves action distributions and sampled sizes',()=>{
  for(const probe of scenarios())for(const [index,archetype]of ARCHETYPES.entries()){
   const p=createProfile({selection:archetype},600+index,'neutral');const o=observeBot(probe.state,probe.state.actor!,p.policyVersion,'relabel');
   o.memory={windowHands:30,opponents:o.seats.filter(s=>s.id!==o.actingSeat).map(s=>({seatId:s.id,hands:30,vpip:{count:9,opportunities:30},pfr:{count:5,opportunities:28},aggression:{count:11,opportunities:40},foldToBet:{count:13,opportunities:21},showdowns:[]}))};
   const renamed=relabel(o);expect(analyzeDecision(renamed,p).distribution).toEqual(analyzeDecision(o,p).distribution);
   for(let seed=0;seed<10;seed++)expect(chooseDecision(renamed,p,seededRandom(seed)).action).toEqual(chooseDecision(o,p,seededRandom(seed)).action);
  }
 });
 it('decision caching returns the committed sample without drawing again and rejects context reuse',()=>{
  const probe=scenarios()[0],p=createProfile({selection:'lag'},11,'neutral');const o=observeBot(probe.state,probe.state.actor!,p.policyVersion,'cache');
  let draws=0;const cache=new DecisionCache(()=>{draws++;return .95;});const decision=cache.getOrCreate(o,p);const count=draws;
  for(let i=0;i<20;i++)expect(cache.getOrCreate(o,p)).toEqual(decision);expect(draws).toBe(count);
  const changed=structuredClone(o);changed.pot++;expect(()=>cache.getOrCreate(changed,p)).toThrow(/different observation/);
  expect(draws).toBe(count);expect(probe.state.committedDecisionIds).not.toContain(decision.decisionId);
 });
 it('public memory ignores observing-seat cards and folded private-card getters, deduplicates and bounds its window',()=>{
  const records:PublicMemoryHand[]=Array.from({length:130},(_,index)=>({handId:`memory-${index}`,seats:[{id:0,revealedCards:[]},{id:1,revealedCards:[]},{id:2,revealedCards:[]}],events:[{id:`event-${index}`,handId:`memory-${index}`,revision:1,type:'action',seatId:0,amount:0,street:'preflop',action:{type:'fold'}}]}));
  for(const hand of records){trap(hand.seats[0],'revealedCards');trap(hand.seats[1],'revealedCards');trap(hand,'privateProfiles');trap(hand,'deck');}
  const memory=buildOpponentMemory([...records,...records.slice(-5)],1,1);
  expect(memory.windowHands).toBe(120);expect(memory.opponents.find(p=>p.seatId===0)!.showdowns).toEqual([]);expect(memory.opponents.some(p=>p.seatId===1)).toBe(false);
  expect(memory.opponents.every(p=>p.hands===120)).toBe(true);expect(buildOpponentMemory(records,1,0)).toEqual({windowHands:0,opponents:[]});
 });
});
