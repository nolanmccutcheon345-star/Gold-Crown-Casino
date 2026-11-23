import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,MoneyEvent,StoredHand} from '../../src/session/types';
import {migrateData} from '../../src/storage/integrity';
import {auditSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {prepareSegments,restoreSegments,segmentKey,type SegmentedEnvelope,type StoredSegment,SEGMENTS} from '../../src/storage/segments';
import {projectView} from '../../src/core/engine';
import {rig,act} from '../verification/helpers';
import {replayAccounting} from '../step5c-independent/accounting-reference';
import {encode,hash,resealManifest,resealTransport,AtomicPort} from './reference';

const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
let original:AppData,source:SegmentedEnvelope,sourceRecords:Map<string,StoredSegment>;
beforeAll(async()=>{original=await migrateData(fixture.streets.flop);const prepared=await prepareSegments(original,null,null);source=prepared.envelope;sourceRecords=new Map(prepared.writes.map(w=>[w.key,w.entry]));});
const archive=()=>({envelope:structuredClone(source),records:structuredClone(sourceRecords)});
const read=(records:Map<string,StoredSegment>)=>async(keys:string[])=>keys.map(key=>structuredClone(records.get(key)));

describe('Step5D independent cold recovery adversarial boundary',()=>{
 it('replays exact canonical financial records independently after cold reconstruction',async()=>{
  const {envelope,records}=archive();const restored=await restoreSegments(envelope,read(records));
  expect(encode(restored)).toBe(encode(original));expect(replayAccounting(restored)).toEqual(replayAccounting(original));
  expect(isVerifiedSnapshot(restored)).toBe(true);expect(isVerifiedSnapshot(structuredClone(restored))).toBe(false);
 });
 it.each(SEGMENTS)('fails closed when a referenced %s segment is absent without resetting data',async segment=>{
  const {envelope,records}=archive();expect(envelope.segments[segment].count).toBeGreaterThan(0);
  records.delete(segmentKey(segment,0));const before=encode([...records]);
  await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/missing|reordered|mismatch/i);expect(encode([...records])).toBe(before);
 });
 it.each(['count','tail','revision'] as const)('rejects corrupt checkpoint %s without granting snapshot trust',async field=>{
  const {envelope,records}=archive();
  if(field==='count')envelope.segments.ledger.count--;
  if(field==='tail')envelope.segments.ledger.tail='f'.repeat(64);
  if(field==='revision')envelope.data.revision++;
  await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/integrity/);
 });
 it.each(['stale-tail','future-count','negative-count'] as const)('rejects independently checksummed %s checkpoint disagreement',async attack=>{
  const {envelope,records}=archive();
  if(attack==='stale-tail')envelope.segments.ledger.tail=records.get(segmentKey('ledger',envelope.segments.ledger.count-2))!.hash;
  if(attack==='future-count')envelope.segments.ledger.count++;
  if(attack==='negative-count')envelope.segments.ledger.count=-1;
  resealManifest(envelope);await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/checkpoint|missing|reordered|size/i);
 });
 it.each(['duplicate','reorder','sequence'] as const)('rejects %s events inside independently valid transport hashes',async attack=>{
  const {envelope,records}=archive();const a=records.get(segmentKey('ledger',2))!,b=records.get(segmentKey('ledger',3))!;
  if(attack==='duplicate')b.value=structuredClone(a.value);
  if(attack==='reorder')[a.value,b.value]=[b.value,a.value];
  if(attack==='sequence'){
   const e=a.value as MoneyEvent;e.index+=1;const body={...e} as Partial<MoneyEvent>;delete body.hash;e.hash=hash(body);
  }
  resealTransport(envelope,records);await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/chain|integrity|financial|Duplicate/);
 });
 it('rejects historical policy corruption even when all transport wrappers were independently recomputed',async()=>{
  const {envelope,records}=archive(),hand=records.get(segmentKey('hands',0))!.value as StoredHand;
  const profile=Object.values(hand.privateProfiles)[0];expect(profile).toBeTruthy();profile.policyVersion='corrupted-unavailable-policy';
  resealTransport(envelope,records);await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/integrity/);
 });
 it.each(['read-rejection','truncated-response','getter'] as const)('keeps controller non-playable for %s storage failures',async attack=>{
  const {envelope,records}=archive();let invoked=0,commits=0;
  const port={load:()=>restoreSegments(envelope,async keys=>{
   if(attack==='read-rejection')throw Error('Interrupted browser read');
   const values=keys.map(key=>structuredClone(records.get(key)));
   if(attack==='truncated-response')return values.slice(1);
   Object.defineProperty(values,'0',{get(){invoked++;return records.get(keys[0]);},enumerable:true});return values;
  }),commit:async()=>{commits++;},close(){}};
  const c=new SessionController(port);await c.init();expect(c.status).toBe('error');expect(c.data).toBe(null);expect(commits).toBe(0);expect(invoked).toBe(0);c.close();
 });
 it('refuses future schema without rewriting archive contents',async()=>{
  const {envelope,records}=archive();(envelope.data as {schemaVersion:number}).schemaVersion=99;resealManifest(envelope);
  const before=encode([...records]);await expect(restoreSegments(envelope,read(records))).rejects.toThrow(/Unsupported|invalid saved/);expect(encode([...records])).toBe(before);
 });
});

async function beforeAllInSettlement(){
 const port=new AtomicPort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:3,seatStacks:{0:5000,1:10000,2:20000}});expect(c.error).toBe('');
 const data=structuredClone(c.data!),a=data.active!;
 a.game=rig(a.game,[['As','Ah'],['Ks','Kh'],['Qs','Qh']],['2d','3d','7c','8c','9h']);a.frames=[projectView(a.game,0)];
 for(const action of [{type:'raise',to:5000},{type:'call'},{type:'raise',to:20000}] as const){a.game=act(a.game,action);a.frames.push(projectView(a.game,0));}
 expect(a.game.actor).toBe(1);const policyVersion=a.profiles[1].policyVersion,decisionId=`independent-allin:${a.game.handId}:${a.game.revision}`;
 a.pending={decisionId,handId:a.game.handId,revision:a.game.revision,seatId:1,policyVersion,drawToken:171,
  decision:{decisionId,handId:a.game.handId,revision:a.game.revision,seatId:1,policyVersion,observationHash:'independent-test-only-observation',action:{type:'call'}}};
 await auditSnapshot(data);port.data=structuredClone(data);c.close();return{port,data};
}

describe('Step5D independent all-in settlement interruption',()=>{
 it.each(['before-commit','lost-ack'] as const)('%s preserves multiple pot tiers and pays exactly once after reopen',async interruption=>{
  const {port,data}=await beforeAllInSettlement(),before=replayAccounting(data),c=new SessionController(port);await c.init();
  const pending=c.data!.active!.pending!;
  if(interruption==='before-commit')port.failBefore=true;else port.lostAck=true;
  await c.commitBot(pending.handId,pending.revision);expect(c.status).toBe('error');expect(c.data!.hands.length).toBe(data.hands.length);
  const recovered=new SessionController(port);await recovered.init();expect(recovered.status).toBe('ready');
  if(interruption==='before-commit'){expect(replayAccounting(recovered.data!)).toEqual(before);await recovered.commitBot(pending.handId,pending.revision);}
  const settled=recovered.data!,last=settled.hands.at(-1)!;
  expect(last.view.pots.map(p=>p.amount)).toEqual([15000,10000]);expect(last.view.payouts).toEqual({0:15000,1:10000});
  expect(last.view.events.filter(e=>e.type==='refund').map(e=>({seat:e.seatId,amount:e.amount}))).toEqual([{seat:2,amount:10000}]);
  expect(last.view.seats.map(s=>s.stack)).toEqual([15000,10000,10000]);expect(replayAccounting(settled).poker-before.poker).toBe(10000);
  await recovered.commitBot(pending.handId,pending.revision);expect(recovered.data!.ledger.filter(e=>e.kind==='hand-net'&&e.handId===pending.handId)).toHaveLength(1);
  await recovered.cashOut();expect(recovered.error).toBe('');const final=replayAccounting(recovered.data!);expect(final.wallet).toBe(1010000);expect(final.table).toBe(0);
  const again=new SessionController(port);await again.init();expect(replayAccounting(again.data!)).toEqual(final);expect(again.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);
  c.close();recovered.close();again.close();
 });
});
