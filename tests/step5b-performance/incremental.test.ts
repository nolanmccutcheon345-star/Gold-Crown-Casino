import {describe,it,expect} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {appendMoney,canonical,seal,validateData} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,isVerifiedSnapshot,verifyTransition} from '../../src/storage/verified';
import {prepareSegments,restoreSegments,segmentKey,type SegmentedEnvelope} from '../../src/storage/segments';
import type {AppData,PersistencePort} from '../../src/session/types';
import {readFileSync} from 'node:fs';
import {migrateData} from '../../src/storage/integrity';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const state=async()=>auditSnapshot(await migrateData(fixture.streets.flop));
class Port implements PersistencePort {data:AppData|null=null;fail=false;async load(){return this.data?structuredClone(this.data):null;}async commit(expected:number|null,data:AppData){if(this.fail)throw Error('write interrupted');if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}close(){}}
describe('Step5B independent full audit versus incremental verified checkpoints',()=>{
 it('freezes all trusted leaves and preserves unchanged canonical arrays across controller actions',async()=>{
  const p=new Port(),c=new SessionController(p);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const before=c.data!;
  expect(isVerifiedSnapshot(before)).toBe(true);expect(()=>{before.ledger[0].walletDelta++;}).toThrow();expect(()=>{before.active!.game.seats[0].stack++;}).toThrow();
  await c.setPaused(true);expect(c.data!.hands).toBe(before.hands);expect(c.data!.ledger).toBe(before.ledger);expect(c.data!.active).not.toBe(before.active);expect(c.error).toBe('');await validateData(c.data!);c.close();
 });
 it('matches full replay over settlements, adjustments, cashout and repeated sessions; manual edits never credit poker P&L',async()=>{
  const p=new Port(),c=new SessionController(p);await c.init();
  for(let i=0;i<20;i++){
   await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await validateData(c.data!);
   const profit=c.data!.ledger.reduce((n,e)=>n+e.pokerNet,0);await c.adjustBankroll(1000000+i,'manual test');expect(c.data!.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(profit);await c.cashOut();expect(c.error).toBe('');await validateData(c.data!);
  }
  expect(c.data!.hands).toHaveLength(20);expect(new Set(c.data!.ledger.map(e=>e.id)).size).toBe(c.data!.ledger.length);c.close();
 });
 it.each(['missing','duplicate','reordered','replaced'] as const)('rejects %s immutable ledger prefixes even when attacker recomputes hashes',async attack=>{
  const original=await state(),next=draftSnapshot(original);next.revision++;
  const records=original.ledger.slice();if(attack==='missing')records.splice(0,1);if(attack==='duplicate')records.splice(1,0,records[0]);if(attack==='reordered')[records[0],records[1]]=[records[1],records[0]];if(attack==='replaced')records[0]=await seal({...records[0],note:'altered historical note'});next.ledger=records;
  await expect(verifyTransition(original,next)).rejects.toThrow(/prefix|lost/);
 });
 it('rejects stale checkpoint revision and unreconciled fresh money; independent full replay also rejects accounting corruption',async()=>{
  const original=await state(),stale=draftSnapshot(original);await expect(verifyTransition(original,stale)).rejects.toThrow(/revision/);
  const wrong=draftSnapshot(original);wrong.revision++;await appendMoney(wrong,{id:'wrong-money',at:new Date().toISOString(),epoch:0,kind:'adjustment',walletDelta:10,tableDelta:1,pokerNet:0,note:'bad'});
  await expect(validateData(wrong)).rejects.toThrow();await expect(verifyTransition(original,wrong)).rejects.toThrow();
 });
 it('rejects counterfeit frozen objects and stale record hashes on a full restore',async()=>{
  const original=await state(),counterfeit=structuredClone(original);counterfeit.hands[0].net++;Object.freeze(counterfeit);expect(isVerifiedSnapshot(counterfeit)).toBe(false);await expect(auditSnapshot(counterfeit)).rejects.toThrow();
 });
 it('detects session hand-ID corruption beyond count-only verification',async()=>{
  const bad=structuredClone(await state());bad.sessions[0].handIds[0]='wrong-but-same-count';await expect(auditSnapshot(bad)).rejects.toThrow(/Session hand/);
 });
 it('preserves lastcommitted state after failure, retries exactly once and survives full reload without duplicate settlement',async()=>{
  const p=new Port(),c=new SessionController(p);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const before=canonical(c.data),g=c.data!.active!.game;p.fail=true;await c.act({type:'fold'},g.handId,g.revision);expect(c.status).toBe('error');expect(canonical(c.data)).toBe(before);p.fail=false;await c.retry();expect(c.data!.hands).toHaveLength(1);c.close();const r=new SessionController(p);await r.init();expect(r.data!.hands).toHaveLength(1);expect(r.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);await validateData(r.data!);r.close();
 });
});
describe('Step5B segmented canonical persistence independent codec checks',()=>{
 it('reassembles populated canonical state exactly and writes no historical bytes on a clock-only transition',async()=>{
  const original=await state(),prepared=await prepareSegments(original,null,null),store=new Map(prepared.writes.map(w=>[w.key,w.entry]));
  const restored=await restoreSegments(prepared.envelope,async keys=>keys.map(k=>structuredClone(store.get(k))));expect(restored).toEqual(original);
  const next=draftSnapshot(original);next.revision++;next.sessions.find(s=>s.id===next.active!.sessionId)!.activeMs+=100;await verifyTransition(original,next);const delta=await prepareSegments(next,original,prepared.envelope);expect(delta.writes).toEqual([]);expect(delta.envelope.data.revision).toBe(original.revision+1);
 });
 it.each(['missing','reordered','modified','duplicate'] as const)('rejects %s segment bytes without a trusted cached assumption',async attack=>{
  const original=await state(),prepared=await prepareSegments(original,null,null),store=new Map(prepared.writes.map(w=>[w.key,structuredClone(w.entry)])),first=segmentKey('ledger',0),second=segmentKey('ledger',1);
  if(attack==='missing')store.delete(first);if(attack==='reordered'){const a=store.get(first)!;store.set(first,store.get(second)!);store.set(second,a);}if(attack==='modified')(store.get(first)!.value as {walletDelta:number}).walletDelta++;if(attack==='duplicate')store.set(second,store.get(first)!);
  await expect(restoreSegments(prepared.envelope,async keys=>keys.map(k=>store.get(k)))).rejects.toThrow();
 });
 it('detects manifest tampering and future schemas instead of resetting the bankroll',async()=>{
  const original=await state(),prepared=await prepareSegments(original,null,null);const altered=structuredClone(prepared.envelope) as SegmentedEnvelope;altered.data.wallet++;await expect(restoreSegments(altered,async()=>[])).rejects.toThrow(/integrity/);
 });
 it('retains exact previous snapshot reconstruction after appending a newly closed session',async()=>{
  const p=new Port(),c=new SessionController(p);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const before=c.data!,first=await prepareSegments(before,null,null),store=new Map(first.writes.map(w=>[w.key,w.entry]));const g=before.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();const after=await prepareSegments(c.data!,before,first.envelope);for(const w of after.writes)store.set(w.key,w.entry);
  expect(await restoreSegments(first.envelope,async keys=>keys.map(k=>store.get(k)))).toEqual(before);expect(await restoreSegments(after.envelope,async keys=>keys.map(k=>store.get(k)))).toEqual(c.data!);c.close();
 });
});
