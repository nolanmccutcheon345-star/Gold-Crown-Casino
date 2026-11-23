import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
import {migrateData,canonical} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,freezeSnapshot,isVerifiedSnapshot,verifyTransition} from '../../src/storage/verified';
import {prepareSegments,restoreSegments,segmentKey,type SegmentedEnvelope,type StoredSegment,SEGMENTS} from '../../src/storage/segments';
import {replayAccounting} from './accounting-reference';
import {act,rig} from '../verification/helpers';
import {legalActions,projectView} from '../../src/core/engine';

const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
// Independent stable JSON reference plus Node SHA-256. Do not call production
// digest/canonical when repairing transport wrappers for an inner-record probe.
function encode(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(encode).join(',')}]`;
 if(value!==null&&typeof value==='object')return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${encode(v)}`).join(',')}}`;
 return JSON.stringify(value);
}
const hash=(value:unknown)=>createHash('sha256').update(encode(value)).digest('hex');
async function archive(){
 const original=await migrateData(fixture.streets.flop),prepared=await prepareSegments(original,null,null);
 return{original,envelope:structuredClone(prepared.envelope),records:new Map(prepared.writes.map(write=>[write.key,structuredClone(write.entry)]))};
}
/** Repair only outer transport checksums; the independent canonical hand/ledger
 * chain MUST still be validated by recovery. This distinguishes verification
 * from trusting a successfully decoded or checksummed container. */
function transportReseal(envelope:SegmentedEnvelope,records:Map<string,StoredSegment>){
 for(const segment of SEGMENTS){let previous='0'.repeat(64);
  for(let i=0;i<envelope.segments[segment].count;i++){
   const entry=records.get(segmentKey(segment,i))!;
   entry.index=i;entry.previousHash=previous;entry.hash=hash({index:i,previousHash:previous,value:entry.value});previous=entry.hash;
  }envelope.segments[segment].tail=previous;
 }
 const body={...envelope} as Partial<SegmentedEnvelope>;delete body.checksum;envelope.checksum=hash(body);
}
class ClonePort implements PersistencePort {
 data:AppData|null=null;lostAck=false;failBefore=false;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if((this.data?.revision??null)!==expected)throw Error('revision changed');
  if(this.failBefore){this.failBefore=false;throw Error('interrupted before commit');}
  this.data=structuredClone(next);this.commits++;
  if(this.lostAck){this.lostAck=false;throw Error('acknowledgement interrupted');}
 }
 close(){}
}

describe('Step5C independently replayed finance and external recovery boundary',()=>{
 it.each(['preflop','flop','turn','river'])('reconstructs %s populated saves with independent hand-event, wallet and session reconciliation',async street=>{
  const original=await migrateData(fixture.streets[street]),expected=replayAccounting(original);
  const prepared=await prepareSegments(original,null,null),records=new Map(prepared.writes.map(w=>[w.key,JSON.stringify(w.entry)]));
  const restored=await restoreSegments(JSON.parse(JSON.stringify(prepared.envelope)),async keys=>keys.map(key=>JSON.parse(records.get(key)!)));
  expect(replayAccounting(restored)).toEqual(expected);expect(encode(restored)).toBe(encode(original));
  const cloned=structuredClone(restored);expect(isVerifiedSnapshot(cloned)).toBe(false);
  await auditSnapshot(cloned);expect(replayAccounting(cloned)).toEqual(expected);
 });
 it.each([0,1,2])('validates canonical hand %i even when the outer segment chain and manifest have valid fresh hashes',async index=>{
  const {envelope,records}=await archive();const hand=records.get(segmentKey('hands',index))!.value as StoredHand;
  hand.startedAt='2001-01-01T00:00:00.000Z';transportReseal(envelope,records);
  await expect(restoreSegments(envelope,async keys=>keys.map(key=>records.get(key)))).rejects.toThrow(/integrity|chain/i);
 });
 it.each([0,6,13])('validates canonical financial event %i rather than accepting the freshly sealed transport',async index=>{
  const {envelope,records}=await archive();(records.get(segmentKey('ledger',index))!.value as {note:string}).note='independent corrupted historical note';transportReseal(envelope,records);
  await expect(restoreSegments(envelope,async keys=>keys.map(key=>records.get(key)))).rejects.toThrow(/integrity|chain/i);
 });
 it.each(['duplicate','missing','reordered'] as const)('rejects %s financially rewrapped history',async attack=>{
  const {envelope,records}=await archive(),first=segmentKey('ledger',3),second=segmentKey('ledger',4);
  if(attack==='duplicate')records.get(second)!.value=structuredClone(records.get(first)!.value);
  if(attack==='missing')records.get(first)!.value=null;
  if(attack==='reordered')[records.get(first)!.value,records.get(second)!.value]=[records.get(second)!.value,records.get(first)!.value];
  transportReseal(envelope,records);
  await expect(restoreSegments(envelope,async keys=>keys.map(key=>records.get(key)))).rejects.toThrow();
 });
 it('does not trust a frozen object or a copied previously audited record after cold-load tampering',async()=>{
  const legitimate=await migrateData(fixture.streets.flop);await auditSnapshot(legitimate);
  const fake=structuredClone(legitimate);fake.wallet++;freezeSnapshot(fake);
  expect(Object.isFrozen(fake)).toBe(true);expect(isVerifiedSnapshot(fake)).toBe(false);
  const port=new ClonePort();port.data=fake;const controller=new SessionController(port);await controller.init();
  expect(controller.status).toBe('error');expect(controller.error).toMatch(/reconcile/);expect(port.commits).toBe(0);controller.close();
 });
 it.each(['own','non-enumerable','symbol','root-ledger','array-index','array-property'] as const)('rejects a %s accessor without executing it or granting trust',async location=>{
  const data=await migrateData(fixture.streets.flop);let reads=0;
  const getter=()=>{reads++;return'not persisted JSON';};
  const target=location.startsWith('array')?data.hands:data;
  const key=location==='symbol'?Symbol('unsafe'):location==='array-index'?'0':location==='root-ledger'?'ledger':'unsafe';
  Object.defineProperty(target,key,{get:getter,enumerable:location!=='non-enumerable',configurable:true});
  let error='';try{await auditSnapshot(data);}catch(reason){error=(reason as Error).message;}
  expect(error).toMatch(/accessor/);expect(reads).toBe(0);expect(isVerifiedSnapshot(data)).toBe(false);
 });
 it.each(['abort','lost-ack'] as const)('%s around settlement restores once, excludes subsequent manual edits from poker results, and cashes out once',async failure=>{
  const port=new ClonePort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});
  const before=structuredClone(c.data!),game=before.active!.game;
  if(failure==='abort')port.failBefore=true;else port.lostAck=true;
  await c.act({type:'fold'},game.handId,game.revision);expect(c.status).toBe('error');expect(c.data!.hands).toHaveLength(0);
  const recovered=new SessionController(port);await recovered.init();expect(recovered.status).toBe('ready');
  if(failure==='abort'){expect(replayAccounting(recovered.data!)).toEqual(replayAccounting(before));await recovered.act({type:'fold'},game.handId,game.revision);}
  else{const revision=recovered.data!.active!.game.revision;await recovered.act({type:'fold'},game.handId,game.revision);expect(recovered.data!.active!.game.revision).toBe(revision);}
  const actual=replayAccounting(recovered.data!);expect(actual.hands).toBe(1);
  await recovered.adjustBankroll(2000000,'Independent manual adjustment');expect(replayAccounting(recovered.data!).poker).toBe(actual.poker);
  await recovered.cashOut();const final=replayAccounting(recovered.data!);expect(final.table).toBe(0);
  const finalBytes=canonical(recovered.data);await c.retry();expect(canonical(c.data)).toBe(finalBytes);
  expect(c.data!.ledger.filter(e=>e.kind==='hand-net'&&e.handId===game.handId)).toHaveLength(1);
  expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);
  c.close();recovered.close();
 });
 it.each(['full','incremental'] as const)('%s verification refuses a completed zero-net hand whose canonical settlement and hand record are both missing',async boundary=>{
  const port=new ClonePort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});
  const original=c.data!,incomplete=draftSnapshot(original),active=incomplete.active!;incomplete.revision++;
  // A shared-board royal flush makes both players exactly break even. Scalar
  // table balance therefore cannot detect a missing zero-net settlement.
  active.game=rig(active.game,[['2c','3d'],['4c','5d']],['As','Ks','Qs','Js','Ts']);active.frames=[projectView(active.game,0)];
  while(active.game.street!=='complete'){
   active.game=act(active.game,{type:legalActions(active.game).check?'check':'call'});active.frames.push(projectView(active.game,0));
  }
  expect(active.game.seats[0].stack).toBe(active.game.seats[0].startingStack);
  expect(incomplete.hands).toHaveLength(0);expect(incomplete.ledger.filter(event=>event.kind==='hand-net')).toHaveLength(0);
  expect(()=>replayAccounting(incomplete)).toThrow(/settlement/);
  let error='';try{if(boundary==='full')await auditSnapshot(incomplete);else await verifyTransition(original,incomplete);}catch(reason){error=(reason as Error).message;}
  expect(error).toMatch(/settle|completed|record|history/i);expect(isVerifiedSnapshot(incomplete)).toBe(false);
  c.close();
 });
});
