import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,StoredHand} from '../../src/session/types';
import {publicMemoryHands,preparePublicMemoryCheckpoint,validatePublicMemoryCheckpoint,withPublicContext,type PublicMemoryCheckpoint} from '../../src/session/bot-observation';
import {observeBot} from '../../src/core/engine';

const saved=(JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>}).streets.flop;
const base=saved.hands.at(-1)!,session='memory-session';
function fixture(count=360):StoredHand[]{
 const result:StoredHand[]=[];let previous='0'.repeat(64);
 for(let i=0;i<count;i++){
  const h=structuredClone(base);h.id=`memory-hand-${i}`;h.sessionId=session;h.number=i+1;
  const ids=Array.from({length:10},(_,id)=>id).filter(id=>id<2||i%(id*4)===0);
  h.view.seats=ids.map(id=>({...structuredClone(base.view.seats[id===0?0:1]),id}));
  h.view.events=h.view.events.map(e=>({...e,id:`${h.id}:${e.id}`,handId:h.id}));
  h.hash=(i+1).toString(16).padStart(64,'0');h.previousHash=previous;previous=h.hash;result.push(h);
 }
 return result;
}
const hands=fixture();
const index=(rows:readonly StoredHand[])=>rows.map(h=>({id:h.id,sessionId:h.sessionId,hash:h.hash,seats:h.view.seats.map(s=>s.id)}));
function untrusted(){return structuredClone(preparePublicMemoryCheckpoint(hands,session));}

describe('Step5E public bot-memory checkpoint continuity',()=>{
 it('preserves exact last120 matching hands for every seat, including sparsely seated opponents',()=>{
  const checkpoint=preparePublicMemoryCheckpoint(hands,session);validatePublicMemoryCheckpoint(checkpoint,index(hands),session);
  for(let seat=0;seat<10;seat++)expect(checkpoint.bySeat[seat]).toEqual(publicMemoryHands(hands,session,seat));
  expect(checkpoint.bySeat[0]).toHaveLength(120);expect(checkpoint.bySeat[9].length).toBeGreaterThan(publicMemoryHands(hands.slice(-120),session,9).length);
 });
 it('compares canonical seat membership without requiring a particular visual seat order',()=>{
  const rows=structuredClone(hands);for(const h of rows)h.view.seats.reverse();
  const checkpoint=preparePublicMemoryCheckpoint(rows,session);validatePublicMemoryCheckpoint(checkpoint,index(hands),session);
 });
 it.each([1,3,17,120])('incrementally merges overlapping tail with %i new hands without changing memory',step=>{
  let checkpoint=preparePublicMemoryCheckpoint(hands.slice(0,1),session);
  for(let end=1;end<hands.length;){const next=Math.min(hands.length,end+step);checkpoint=preparePublicMemoryCheckpoint(hands.slice(Math.max(0,end-120),next),session,checkpoint);end=next;}
  expect(checkpoint).toEqual(preparePublicMemoryCheckpoint(hands,session));validatePublicMemoryCheckpoint(checkpoint,index(hands),session);
 });
 it('accepts an immediate successor-only journal suffix with no overlapping body',()=>{
  const prior=preparePublicMemoryCheckpoint(hands.slice(0,300),session);
  expect(preparePublicMemoryCheckpoint(hands.slice(300),session,prior)).toEqual(preparePublicMemoryCheckpoint(hands,session));
 });
 it('rejects a partial tail as the initial memory checkpoint rather than silently forgetting absent seats',()=>{
  expect(()=>preparePublicMemoryCheckpoint(hands.slice(-120),session)).toThrow(/complete committed history/);
 });
 it('preserves cursor and resets memory for a new or ended session',()=>{
  const prior=preparePublicMemoryCheckpoint(hands,session),next=preparePublicMemoryCheckpoint(hands.slice(-120),'next-session',prior);
  validatePublicMemoryCheckpoint(next,index(hands),'next-session');expect(Object.values(next.bySeat).every(rows=>rows.length===0)).toBe(true);
  const ended=preparePublicMemoryCheckpoint(hands.slice(-120),null,prior);validatePublicMemoryCheckpoint(ended,index(hands),null);expect(ended.bySeat).toEqual({});expect(ended.processedLastHandHash).toBe(hands.at(-1)!.hash);
 });
 it('initializes an empty saved practice account and does not invent a cursor',()=>{
  const empty=preparePublicMemoryCheckpoint([],null);expect(empty).toEqual({version:1,activeSessionId:null,processedLastHandId:null,processedLastHandHash:'0'.repeat(64),bySeat:{}});validatePublicMemoryCheckpoint(empty,[],null);
 });
 it('stable checkpoint reuse does not rebuild or mutate public records',()=>{
  const prior=preparePublicMemoryCheckpoint(hands,session);expect(preparePublicMemoryCheckpoint(hands.slice(-120),session,prior)).toBe(prior);
  expect(Object.isFrozen(prior)).toBe(true);expect(Object.isFrozen(prior.bySeat[0][0].events)).toBe(true);
 });
 it.each(['gap','reorder','duplicate','cursor-hash'] as const)('refuses %s in newly committed tail instead of dropping older observations',kind=>{
  const prior=preparePublicMemoryCheckpoint(hands.slice(0,300),session),tail=structuredClone(hands.slice(299));
  if(kind==='gap')tail.splice(0,2);
  if(kind==='reorder')[tail[2],tail[3]]=[tail[3],tail[2]];
  if(kind==='duplicate')tail.splice(2,0,structuredClone(tail[2]));
  if(kind==='cursor-hash')tail[0].hash='f'.repeat(64);
  expect(()=>preparePublicMemoryCheckpoint(tail,session,prior)).toThrow(/Public memory checkpoint/);
 });
 it.each(['missing-seat','missing-hand','duplicate-hand','reordered-hand','wrong-session','wrong-cursor','wrong-seats'] as const)('validates %s against compact canonical index independently of a shape check',kind=>{
  const checkpoint=untrusted();
  if(kind==='missing-seat')delete checkpoint.bySeat[9];
  if(kind==='missing-hand')checkpoint.bySeat[9].pop();
  if(kind==='duplicate-hand')checkpoint.bySeat[9][1]=structuredClone(checkpoint.bySeat[9][0]);
  if(kind==='reordered-hand')[checkpoint.bySeat[9][0],checkpoint.bySeat[9][1]]=[checkpoint.bySeat[9][1],checkpoint.bySeat[9][0]];
  if(kind==='wrong-session')checkpoint.activeSessionId='wrong';
  if(kind==='wrong-cursor')checkpoint.processedLastHandId=hands[0].id;
  if(kind==='wrong-seats')checkpoint.bySeat[9][0].seats.pop();
  expect(()=>validatePublicMemoryCheckpoint(checkpoint,index(hands),session)).toThrow(/Public memory checkpoint/);
 });
 it.each(['deck','hole','privateProfiles','trait','event-detail','event-cards','action-data','array-data','getter'] as const)('rejects forbidden %s payload without observing an accessor',kind=>{
  const checkpoint=untrusted(),row=checkpoint.bySeat[0][0];let read=0;
  if(kind==='deck')Object.assign(checkpoint,{deck:['As','Kh']});
  if(kind==='hole')Object.assign(row.seats[0],{hole:['As','Kh']});
  if(kind==='privateProfiles')Object.assign(row,{privateProfiles:{}});
  if(kind==='trait')Object.assign(row.seats[0],{aggression:0.9});
  if(kind==='event-detail')Object.assign(row.events[0],{detail:'private policy'});
  if(kind==='event-cards')Object.assign(row.events[0],{cards:['As']});
  if(kind==='action-data')Object.assign(row.events.find(e=>e.action)!.action!,{secret:'As'});
  if(kind==='array-data')Object.assign(checkpoint.bySeat[0],{secret:'As'});
  if(kind==='getter')Object.defineProperty(checkpoint.bySeat,'9',{get(){read++;return[];},enumerable:true});
  expect(()=>validatePublicMemoryCheckpoint(checkpoint,index(hands),session)).toThrow(/Public memory checkpoint/);expect(read).toBe(0);
 });
 it('does not expose Hero private cards when no actual showdown reveal exists',()=>{
  const h=structuredClone(base);h.view.seats[0].hole=['As','Ah'];h.view.seats[0].folded=true;delete h.view.handLabels[0];h.previousHash='0'.repeat(64);
  const checkpoint=preparePublicMemoryCheckpoint([h],h.sessionId);for(const rows of Object.values(checkpoint.bySeat))for(const row of rows)expect(row.seats.find(s=>s.id===0)!.revealedCards).toEqual([]);
 });
 it('checkpoint and full-history bot observations agree for every retained-window threshold',()=>{
  const checkpoint=preparePublicMemoryCheckpoint(hands,session),g=saved.active!.game;
  const profile=saved.active!.profiles[g.actor!],observation=observeBot(g,g.actor!,profile.policyVersion,"independent-memory-comparison");
  for(const retention of [0,0.1,0.5,1]){
   const p={...profile,traits:{...profile.traits!,memoryRetention:retention}};
   const full=withPublicContext(observation,g.profile.rake,p,hands,session);
   const compact=withPublicContext(observation,g.profile.rake,p,hands.slice(-120),session,checkpoint);
   expect(compact).toEqual(full);
  }
 });
 it('serialized checkpoint restores the same records and rejects stale global history cursor',()=>{
  const checkpoint=JSON.parse(JSON.stringify(preparePublicMemoryCheckpoint(hands,session))) as PublicMemoryCheckpoint;
  validatePublicMemoryCheckpoint(checkpoint,index(hands),session);expect(()=>validatePublicMemoryCheckpoint(checkpoint,index(hands.slice(0,-1)),session)).toThrow(/cursor/);
 });
});
