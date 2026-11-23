import {describe,it,expect} from 'vitest';
import {startHand,applyCommand,projectView,observeBot} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import {appendHumanMemory,emptyHumanMemory,memoryReads,memoryFacts,validHumanMemory,assertHumanMemory,catchUpHumanMemory} from '../../src/session/human-memory';
import {chooseDecision} from '../../src/bots/policy';
import {seedStream} from '../../src/bots/profiles';
import {readsFromHands,readsProfile} from '../../src/bots/reads';
import type {StoredHand} from '../../src/session/types';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {heroReadsSnapshot,tournamentReadsFor} from '../../src/tournament/human-context';
const rules={id:'memory50',version:'1',mode:'cash' as const,smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative' as const,oddChipOrder:'clockwise-from-button' as const};
const p=regularProfile('priya','mid');
function state(i:number,name='Priya'){
 let g=startHand({handId:`memory50:${i}`,button:0,profile:rules,seats:[{id:0,name:'You',stack:2000},{id:1,name,stack:2000}]});
 g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'fold',action:{type:'fold'}});return g;
}
function hand(i:number,sessionId='session-a'):StoredHand{
 const g=state(i);return {id:g.handId,sessionId,epoch:0,number:i+1,startedAt:'2026-11-18T00:00:00Z',endedAt:'2026-11-18T00:00:01Z',view:projectView(g,0),frames:[],net:-50,privateProfiles:{1:p},previousHash:`hash:${i-1}`,hash:`hash:${i}`};
}
describe('independent compact public memory',()=>{
 it('retains cumulative session facts through 450 hands, hot-tail compaction and JSON reload',()=>{
  const hands=Array.from({length:450},(_,i)=>hand(i));let m=emptyHumanMemory();for(const h of hands)m=appendHumanMemory(m,h);
  const active={profiles:{1:p},sessionId:'session-a'},before=memoryReads(m,active,1),facts=memoryFacts(m,active,1);
  expect(before).toEqual(readsFromHands(hands.slice(-400).map(h=>h.view)));expect(before.hands).toBe(400);
  expect(facts).toEqual({hands:450,netBB:225});expect(m.recent).toHaveLength(400);
  const restored=JSON.parse(JSON.stringify(m)) as typeof m;expect(validHumanMemory(restored)).toBe(true);
  expect(()=>assertHumanMemory(restored,hands.slice(-120),330)).not.toThrow();expect(()=>assertHumanMemory(restored,hands)).not.toThrow();
  expect(memoryReads(restored,active,1)).toEqual(before);expect(memoryFacts(restored,active,1)).toEqual(facts);
  const live=startHand({handId:'memory50-decision',button:1,profile:rules,seats:[{id:0,name:'You',stack:2000},{id:1,name:'Priya',stack:2000}]});
  const obs=observeBot(live,1,p.policyVersion,'memory50-decision');
  expect(chooseDecision(obs,readsProfile(obs,p,memoryReads(restored,active,1)).profile,seedStream(50))).toEqual(chooseDecision(obs,readsProfile(obs,p,before).profile,seedStream(50)));
  const next=appendHumanMemory(restored,hand(450));expect(memoryFacts(next,active,1).hands).toBe(451);
  expect(appendHumanMemory(next,hand(450))).toBe(next);expect(()=>appendHumanMemory(next,{...hand(450),hash:'changed'})).toThrow();
  expect(()=>assertHumanMemory({...restored,facts:{[p.personalityId!]:{hands:1,netBB:0}}},hands)).toThrow();
 });
 it('keeps public reads across sessions while resetting session mood and excluding other personalities',()=>{
  let m=emptyHumanMemory();for(let i=0;i<210;i++)m=appendHumanMemory(m,hand(i));m=appendHumanMemory(m,hand(210,'session-b'));
  expect(memoryReads(m,{profiles:{1:p}},1).hands).toBe(211);expect(memoryFacts(m,{profiles:{1:p},sessionId:'session-b'},1)).toEqual({hands:1,netBB:.5});
  expect(memoryFacts(m,{profiles:{1:p},sessionId:'session-a'},1).hands).toBe(0);
  expect(memoryReads(m,{profiles:{1:regularProfile('sal','mid')}},1).hands).toBe(0);
 });
 it('never accesses private cards, frames or future deck to construct persisted projections',()=>{
  const h=hand(0);Object.defineProperty(h.view.seats[0],'hole',{get(){throw Error('private cards');}});Object.defineProperty(h,'frames',{get(){throw Error('private replay');}});Object.defineProperty(h.view,'deck',{get(){throw Error('future cards');}});
  const m=appendHumanMemory(emptyHumanMemory(),h);expect(m.recent[0].reads.hands).toBe(1);
  expect(JSON.stringify(m)).not.toMatch(/hole|deck|frames|privateProfiles/);
 });
 it('carries only each named regular’s witnessed hands from the last ten events',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',6,'fast');const base=structuredClone(c.data!.active!);c.close();
  const event=(id:string,name:string,regular:'priya'|'ana')=>{const e=structuredClone(base);e.id=id;e.field={...e.field!,regulars:{1:regular}};e.history=[{number:1,settledAt:'2026-11-18T00:00:01Z',state:state(1,name),frames:[]}];return e;};
  const a=event('a','Priya','priya'),b=event('b','Ana','ana');
  a.history.push({...a.history[0],number:2,state:state(2,'Someone else')});
  const snap=heroReadsSnapshot([a,b]);expect(snap.priya.hands).toBe(1);expect(snap.ana.hands).toBe(1);
  const next=event('next','Priya','priya');next.history=[];next.heroReads=snap;expect(tournamentReadsFor(next,'Priya')?.hands).toBe(1);expect(tournamentReadsFor(next,'Ana')?.hands).toBe(0);
  expect(heroReadsSnapshot([a,...Array.from({length:10},(_,i)=>event(`b:${i}`,'Ana','ana'))]).priya).toBeUndefined();
 });
});


describe('independent frozen-writer memory catch-up',()=>{
 const build=(hands:StoredHand[])=>hands.reduce(appendHumanMemory,emptyHumanMemory());
 it('advances a stale validated prefix exactly to the canonical tip without mutating it',()=>{
  const hands=Array.from({length:450},(_,i)=>hand(i)),prefix=build(hands.slice(0,410)),before=JSON.stringify(prefix);
  const full=catchUpHumanMemory(prefix,hands),compact=catchUpHumanMemory(prefix,hands.slice(-120),330);
  expect(full).toEqual(build(hands));expect(compact).toEqual(full);expect(JSON.stringify(prefix)).toBe(before);
  expect(catchUpHumanMemory(full,hands)).toBe(full);expect(()=>assertHumanMemory(prefix,hands)).not.toThrow();
 });
 it('rejects altered prefix observations, current-session totals and a future cursor',()=>{
  const hands=Array.from({length:210},(_,i)=>hand(i)),prefix=build(hands.slice(0,200));
  const observation=structuredClone(prefix);observation.recent[0].reads.hands++;
  expect(()=>catchUpHumanMemory(observation,hands)).toThrow('differs from saved hand');
  const facts=structuredClone(prefix);facts.facts[p.personalityId!].netBB++;
  expect(()=>catchUpHumanMemory(facts,hands)).toThrow('Session mood facts');
  expect(()=>catchUpHumanMemory({...prefix,processed:211},hands)).toThrow('Invalid public opponent memory');
 });
 it('requires the full canonical prefix when a compact tail starts after the stale cursor',()=>{
  const hands=Array.from({length:450},(_,i)=>hand(i)),prefix=build(hands.slice(0,200));
  expect(()=>catchUpHumanMemory(prefix,hands.slice(-120),330)).toThrow('Invalid public opponent memory');
  expect(()=>assertHumanMemory(prefix,hands.slice(-120),330)).toThrow('Invalid public opponent memory');
  const caught=catchUpHumanMemory(prefix,hands);expect(caught).toEqual(build(hands));
  expect(()=>assertHumanMemory(caught,hands.slice(-120),330)).not.toThrow();
 });
});
