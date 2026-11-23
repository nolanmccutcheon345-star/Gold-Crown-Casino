import {beforeAll,describe,expect,it,vi} from 'vitest';
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection,type CashProjectionCheckpoint} from '../../src/stats/projection';
import {auditSnapshot} from '../../src/storage/verified';
import {migrateData,seal,checkChain} from '../../src/storage/integrity';
import {fixture,profile,session,freeze} from '../step5b-statistics/fixtures';
import type {AppData,StoredHand,PersistencePort} from '../../src/session/types';
import {recordConfigurationBoundary} from '../../src/session/configuration-history';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
class MemoryPort implements PersistencePort {
 data:AppData|null=null;async load(){return this.data;}
 async commit(expected:number|null,data:AppData){if(expected!==(this.data?.revision??null))throw Error('Stale fixture revision');this.data=data;}
 close(){}
}

let trusted:AppData,checkpoint:CashProjectionCheckpoint;
beforeAll(async()=>{
 const input=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8'));
 trusted=await auditSnapshot(await migrateData(input.streets.flop));
 checkpoint=(await CashStatsProjection.prewarm(trusted.hands)).exportCheckpoint();
});
const restore=(value=checkpoint)=>CashStatsProjection.restoreCheckpoint(value,value.checkpoint);
const normalized=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

describe('Step5E compact statistics checkpoint and storage boundary',()=>{
 it('round-trips an audited populated save with no historical hand reads',()=>{
  const serialized=JSON.stringify(checkpoint),projection=restore(JSON.parse(serialized));
  expect(projection.readCheckpoint(trusted.sessions,0)).toEqual(deriveCashStats(trusted.hands,trusted.sessions,0));
  expect(projection.getDiagnostics().projectedHands).toBe(0);
  expect(serialized).not.toMatch(/"(?:frames|view|hole|deck|privateProfiles|traits|personalitySeed)"/);
  expect(projection.exportCheckpoint()).toEqual(checkpoint);
 });
 it('requires the existing private canonical-history capability before export or prewarm',async()=>{
  const untrusted=freeze(structuredClone(trusted.hands)),p=new CashStatsProjection();p.derive(untrusted,trusted.sessions,0);
  expect(()=>p.exportCheckpoint()).toThrow(/audited canonical/);
  await expect(CashStatsProjection.prewarm(untrusted)).rejects.toThrow(/verified canonical/);
 });
 it('rejects an incompatible projection version or different outer storage sequence binding',()=>{
  expect(()=>restore({...checkpoint,projectionVersion:'future-stats'} as unknown as CashProjectionCheckpoint)).toThrow(/version/);
  expect(()=>CashStatsProjection.restoreCheckpoint(checkpoint,{...checkpoint.checkpoint,hands:checkpoint.checkpoint.hands+1})).toThrow(/binding/);
  expect(()=>CashStatsProjection.restoreCheckpoint(checkpoint,{...checkpoint.checkpoint,lastHash:'f'.repeat(64)})).toThrow(/binding/);
 });
 it.each(['duplicate-id','missing-id','last-id','session-number','aggregate-profit','blind-total','duplicate-group','metric-denominator','coverage','configuration-total'] as const)('rejects malformed %s without normalizing corruption',kind=>{
  const bad=structuredClone(checkpoint);
  if(kind==='duplicate-id')bad.handIds.push(bad.handIds[0]);
  if(kind==='missing-id')bad.handIds.pop();
  if(kind==='last-id')bad.handIds[bad.handIds.length-1]='wrong-tail';
  if(kind==='session-number')bad.sessionNumbers[0][1]++;
  if(kind==='aggregate-profit')bad.all.profit++;
  if(kind==='blind-total')bad.all.byBlind[0][1]++;
  if(kind==='duplicate-group')bad.positions.push(bad.positions[0]);
  if(kind==='metric-denominator')bad.counters.vpip=[2,1];
  if(kind==='coverage')bad.completeHands=bad.all.hands+1;
  if(kind==='configuration-total')bad.configurationHistory[0].row.profit++;
  expect(()=>restore(bad)).toThrow();
 });
 it('never executes checkpoint getters and rejects exotic/sparse data',()=>{
  const getter=vi.fn(()=>checkpoint.all),bad={...checkpoint};Object.defineProperty(bad,'all',{get:getter,enumerable:true});
  expect(()=>restore(bad)).toThrow(/accessor/);expect(getter).not.toHaveBeenCalled();
  expect(()=>restore({...checkpoint,all:new Date()} as unknown as CashProjectionCheckpoint)).toThrow(/plain/);
  const sparse=structuredClone(checkpoint);delete sparse.handIds[0];expect(()=>restore(sparse)).toThrow(/sparse/);
 });
 it('owns copies of its imported/exported counters and configuration metadata',()=>{
  const input=structuredClone(checkpoint),p=restore(input),expected=p.readCheckpoint(trusted.sessions,0);
  input.counters.vpip[0]++;input.all.byBlind[0][1]++;input.configurationHistory[0].row.policyVersions.push('altered');
  const output=p.exportCheckpoint();output.sessionNumbers[0][1]++;output.configurationHistory[0].row.rake.cap++;
  const display=p.readCheckpoint(trusted.sessions,0);display.configurationHistory[0].rake.cap++;display.configurationHistory[0].policyVersions.push('display-edit');
  expect(p.readCheckpoint(trusted.sessions,0)).toEqual(expected);
 });
 it('refreshes session time/closure and excludes external money edits without replay',()=>{
  const p=restore(),sessions=trusted.sessions.map((s,i)=>({...s,buyIns:s.buyIns+9876,cashOut:s.cashOut+12345,endedAt:i===0?null:s.endedAt,activeMs:2500,lastActiveAt:i===0?5000:null}));
  expect(p.readCheckpoint(sessions,6000)).toEqual(deriveCashStats(trusted.hands,sessions,6000));
  expect(p.readCheckpoint(sessions,7000)).toEqual(deriveCashStats(trusted.hands,sessions,7000));
  expect(p.getDiagnostics().projectedHands).toBe(0);
 });
 it('cannot silently discard an archived base by using the old full-history derive API',()=>{
  const p=restore();expect(()=>p.derive([],trusted.sessions)).toThrow(/appendVerifiedTail/);
  p.reset();expect(p.derive(freeze([]),[],0).hands).toBe(0);expect(()=>p.exportCheckpoint()).toThrow();
 });
 it('keeps a valid base unchanged after a duplicate/gapped/reordered tail, including an empty retry',async()=>{
  const records=await freshTail(trusted.hands.at(-1)!.hash,4),p=restore(),before=p.exportCheckpoint();
  for(const bad of [[trusted.hands[0]],[records[1]],[records[1],records[0]],[records[0],records[0]]])expect(()=>p.appendVerifiedTail(bad,trusted.sessions,0)).toThrow();
  expect(p.exportCheckpoint()).toEqual(before);expect(p.appendVerifiedTail([],trusted.sessions,0)).toEqual(deriveCashStats(trusted.hands,trusted.sessions,0));
  p.appendVerifiedTail(records,trusted.sessions,0);expect(p.getDiagnostics().projectedHands).toBe(4);
  expect(()=>p.appendVerifiedTail(records,trusted.sessions,0)).toThrow();expect(p.getDiagnostics().projectedHands).toBe(4);
 });
 it('prepares an entire tail before mutation if a later hand has invalid opportunity data',async()=>{
  const records=await freshTail(trusted.hands.at(-1)!.hash,2),p=restore(),before=p.exportCheckpoint();
  const broken=structuredClone(records);Object.defineProperty(broken[1],'frames',{get(){throw Error('broken frames');}});
  expect(()=>p.appendVerifiedTail(broken,[],0)).toThrow(/broken frames/);expect(p.exportCheckpoint()).toEqual(before);
 });
 it('includes committed configuration boundaries with no settled hand and preserves recorded rows',async()=>{
  const port=new MemoryPort(),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});
  const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);
  const saved=controller.data!;expect(saved.hands).toHaveLength(1);
  const p=await CashStatsProjection.prewarm(saved.hands),cp=p.exportCheckpoint(),restored=restore(cp);
  await controller.nextHand();
  const data=structuredClone(controller.data!);recordConfigurationBoundary(data,true);
  expect(restored.readCheckpoint(data.sessions,0)).toEqual(deriveCashStats(saved.hands,data.sessions,0));
  expect(restored.readCheckpoint(data.sessions,0).configurationHistory).toHaveLength(2);controller.close();
 });
});

async function freshTail(previousHash:string,total:number):Promise<StoredHand[]> {
 const f=fixture([100000,100000],0);f.act({type:'fold'});const template=f.record(),records:StoredHand[]=[];
 for(let i=0;i<total;i++){
  const id=`step5e-tail:${i+1}`,copy=rename(template,id);
  const record=await seal({...copy,sessionId:'step5e-tail-session',number:i+1,previousHash,hash:''});records.push(record);previousHash=record.hash;
 }
 return records;
}
function rename(template:StoredHand,id:string):StoredHand {
 const event=(e:StoredHand['view']['events'][number])=>({...e,id:e.id.replace(template.id,id),handId:id,...(e.decisionId?{decisionId:e.decisionId.replace(template.id,id)}:{})});
 const frame=(f:StoredHand['view'])=>({...f,handId:id,events:f.events.map(event)});
 return {...template,id,view:frame(template.view),frames:template.frames.map(frame)};
}

/** Repeated independent engine scenarios are aggregation fixtures, not empirical
 * opponent sessions or browser gameplay. Public frames are retained, identifiers
 * rewritten consistently, and the complete hash chain independently rechecked. */
async function mixedRecords(total:number):Promise<StoredHand[]> {
 const templates:StoredHand[]=[];
 for(const [i,blind]of [2,10,20].entries()){
  const p={...profile,id:`mixed-rules-${i}`,version:`${i+1}`,smallBlind:blind/2,bigBlind:blind,rake:{basisPoints:i===0?0:1000,cap:blind,noFlopNoDrop:true}};
  const f=fixture(Array(i===0?2:i===1?6:10).fill(10000),0,p);
  while(f.game.street!=='complete')f.act({type:'fold'});templates.push(f.record());
  templates.push(fixture(Array(i===0?2:i===1?6:10).fill(10000),1,p).finish());
 }
 let previousHash='0'.repeat(64);const numbers=new Map<string,number>(),records:StoredHand[]=[];
 for(let i=0;i<total;i++){
  // Include all three stakes/player counts, showdowns and rake at bounded cost.
  const kind=i%20===19?(Math.floor(i/20)%3)*2+1:(i%3)*2,template=templates[kind],sessionId=`mixed-session-${Math.floor(kind/2)}`;
  const number=(numbers.get(sessionId)??0)+1;numbers.set(sessionId,number);
  const policyVersion=kind<2?'synthetic-v0':kind<4?'synthetic-cash-1.1.0':'synthetic-cash-1.2.0';
  const record=await seal({...rename(template,`mixed-hand-${i+1}`),sessionId,number,privateProfiles:{1:{archetype:'tag' as const,aggression:0.4,looseness:0.5,policyVersion}},previousHash,hash:''});
  records.push(record);previousHash=record.hash;
 }
 await checkChain(records);return freeze(records);
}

describe('Step5E independent historical replay equivalence at scale',()=>{
 it.each([100,1000,5000,10000])('matches full replay at %i mixed-stakes/policy/rake hands without reopening old frames',async total=>{
  const hands=await mixedRecords(total),sessions=[0,1,2].map(i=>session(hands.filter(h=>h.sessionId===`mixed-session-${i}`),{id:`mixed-session-${i}`,activeMs:3600000*(i+1)}));
  const empty:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:0,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};await auditSnapshot(empty);
  const projection=await CashStatsProjection.prewarm(empty.hands),split=Math.floor(total*.9);
  projection.appendVerifiedTail(hands.slice(0,split),sessions,0);
  const encoded=JSON.stringify(projection.exportCheckpoint()),cp=JSON.parse(encoded) as CashProjectionCheckpoint;
  const start=performance.now(),restored=restore(cp),restoredMs=performance.now()-start;
  const appendStart=performance.now(),actual=restored.appendVerifiedTail(hands.slice(split),sessions,0),appendMs=performance.now()-appendStart;
  const fullStart=performance.now(),reference=deriveCashStats(hands,sessions,0),fullMs=performance.now()-fullStart;
  expect(actual).toEqual(reference);expect(actual.stakes).toHaveLength(3);expect(actual.rake).toBeGreaterThan(0);
  expect(restored.getDiagnostics().projectedHands).toBe(total-split);
  const again=restore(normalized(restored.exportCheckpoint()));expect(again.readCheckpoint(sessions,0)).toEqual(reference);expect(again.getDiagnostics().projectedHands).toBe(0);
  console.info(JSON.stringify({evidence:'step5e-statistics-full-replay',hands:total,checkpointHands:split,newHands:total-split,checkpointBytes:Buffer.byteLength(encoded),restoredMs,appendMs,fullMs,totals:{profit:actual.profit,rake:actual.rake,bb100:actual.bb100},equal:true,environment:'Node/Vitest; synthetic engine aggregation fixture, not browser timing'}));
 },180000);
});
