import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import {projectView} from '../../src/core/engine';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {appendMoney,migrateData,publicHistory,parsePublicHistory,seal,digest} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,verifyTransition,isVerifiedSnapshot} from '../../src/storage/verified';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import {normalizeTableSettings,validateConfigurationData} from '../../src/session/configuration';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const state=async()=>auditSnapshot(await migrateData(fixture.streets.flop));
function candidate(prior:AppData):AppData {const next=draftSnapshot(prior);next.revision++;return next;}
async function rejected(work:Promise<unknown>):Promise<boolean>{try{await work;return false;}catch{return true;}}
async function rejectsBoth(prior:AppData,next:AppData):Promise<void>{expect(await Promise.all([rejected(auditSnapshot(structuredClone(next))),rejected(verifyTransition(prior,next))])).toEqual([true,true]);}
class Port implements PersistencePort {data:AppData|null=null;async load(){return this.data?structuredClone(this.data):null;}async commit(expected:number|null,data:AppData){expect(this.data?.revision??null).toBe(expected);this.data=structuredClone(data);}close(){}}

describe('Independent Step5B storage integrity review: adversarial restored and incremental state',()=>{
 it.each((['ledger','hands','importedHands'] as const).flatMap(field=>(['missing','duplicate','reordered','replaced'] as const).map(attack=>({field,attack}))))('rejects $attack immutable $field prefixes without trusting matching hashes',async({field,attack})=>{
  const prior=await state(),next=candidate(prior),changed=[...prior[field]];
  if(attack==='missing')changed.splice(0,1);
  if(attack==='duplicate')changed.splice(1,0,changed[0]);
  if(attack==='reordered')[changed[0],changed[1]]=[changed[1],changed[0]];
  if(attack==='replaced')changed[0]=structuredClone(changed[0]);
  next[field]=changed as never;
  expect(await rejected(verifyTransition(prior,next))).toBe(true);expect(isVerifiedSnapshot(next)).toBe(false);
 });
 it('does not poison the last verified checkpoint when validation fails partway through an appended financial tail',async()=>{
  const prior=await state(),bad=candidate(prior),entry={id:'review-retried-identity',at:'2026-11-01T00:00:00Z',epoch:prior.epoch,kind:'adjustment' as const,walletDelta:100,tableDelta:0,pokerNet:0,note:'Valid first appended event'};
  await appendMoney(bad,entry);await appendMoney(bad,{...entry,id:'review-invalid-second',kind:'top-up',walletDelta:100,tableDelta:0,sessionId:bad.active!.sessionId});
  expect(await rejected(verifyTransition(prior,bad))).toBe(true);expect(isVerifiedSnapshot(bad)).toBe(false);
  const retry=candidate(prior);await appendMoney(retry,entry);await expect(verifyTransition(prior,retry)).resolves.toBeDefined();await expect(auditSnapshot(structuredClone(retry))).resolves.toBeDefined();
 });
 it('rejects a table-adjustment that mints wallet money without a compensating table debit',async()=>{
  const prior=await state(),next=candidate(prior);
  await appendMoney(next,{id:'review-counterfeit-transfer',at:'2026-11-01T00:00:00Z',epoch:next.epoch,kind:'table-adjustment',walletDelta:100,tableDelta:0,pokerNet:0,sessionId:next.active!.sessionId,note:'Must not create virtual funds'});
  await rejectsBoth(prior,next);
 });
 it('rejects unknown financial kinds even when scalar wallet and table balances reconcile',async()=>{
  const prior=await state(),next=candidate(prior);
  await appendMoney(next,{id:'review-unknown-kind',at:'2026-11-01T00:00:00Z',epoch:next.epoch,kind:'unknown-event' as 'adjustment',walletDelta:100,tableDelta:0,pokerNet:0,note:'Invalid discriminator'});
  await rejectsBoth(prior,next);
 });
 it('rejects a negative table withdrawal total on full restore and incremental transition',async()=>{
  const prior=await state(),next=candidate(prior);next.sessions.find(s=>s.id===next.active!.sessionId)!.tableWithdrawals=-1;
  expect(()=>validateConfigurationData(next)).toThrow();await rejectsBoth(prior,next);
 });
 it.each(['buyIns','tableWithdrawals','cashOut'] as const)('reconciles positive session %s to financial events rather than merely checking nonnegative numbers',async field=>{
  const prior=await state(),next=candidate(prior),session=next.sessions.find(s=>s.id===next.active!.sessionId)!;session[field]=(session[field]??0)+100;
  await rejectsBoth(prior,next);
 });
 it('calls the existing configuration validator at both trust boundaries for invalid preset metadata',async()=>{
  const prior=await state(),next=candidate(prior);next.namedPresets=[{id:'review-preset',name:'invalid',version:99 as 1,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',settings:normalizeTableSettings(DEFAULT_SETTINGS,()=>1)}];
  expect(()=>validateConfigurationData(next)).toThrow();await rejectsBoth(prior,next);
 });
 it('rejects an obsolete queued hand identity at restore and incremental verification before a later UI action',async()=>{
  const prior=await state(),next=candidate(prior);next.active!.queuedConfiguration={id:'review-queue',sessionId:next.active!.sessionId,requestedHandId:'obsolete-hand',queuedAt:'2026-11-01T00:00:00Z',settings:normalizeTableSettings(DEFAULT_SETTINGS,()=>1)};
  expect(()=>validateConfigurationData(next)).toThrow();await rejectsBoth(prior,next);
 });
 it('rejects modified imported study history on full restore, including when the outer storage manifest is freshly checksummed',async()=>{
  const original=await state(),modified=structuredClone(original);modified.importedHands[0].net+=100;
  expect(await rejected(auditSnapshot(modified))).toBe(true);
  // Canonical transport hashes alone cannot establish semantic validity.
  const prepared=await prepareSegments(original,null,null),store=new Map(prepared.writes.map(w=>[w.key,structuredClone(w.entry)]));
  const key='v2:importedHands:000000000000',entry=store.get(key)!;(entry.value as {net:number}).net+=100;
  // Keep old wrapper hash: storage byte corruption must independently fail too.
  await expect(restoreSegments(prepared.envelope,async keys=>keys.map(k=>store.get(k)))).rejects.toThrow();
 });
 it('rejects appended study records with bad public replay/hash before granting a verified snapshot capability',async()=>{
  const prior=await state(),next=candidate(prior);const bad=structuredClone(prior.importedHands[0]);bad.handId='review-invalid-import';bad.net+=100;
  next.importedHands=[...prior.importedHands,bad];expect(await rejected(verifyTransition(prior,next))).toBe(true);expect(isVerifiedSnapshot(next)).toBe(false);
 });
 it('rejects premature imported hidden-card disclosure even if every public record hash is recomputed',async()=>{
  const next=structuredClone(await state());const bad=structuredClone(next.importedHands[0]);const frame=bad.frames.find(f=>f.street!=='complete')!;frame.seats.find(s=>s.id!==0)!.hole=['As','Ah'];
  next.importedHands=[await seal(bad)];expect(await rejected(auditSnapshot(next))).toBe(true);
 });
 it('allows independent valid import batches and deduplicated records without requiring one fictitious cross-file source chain',async()=>{
  const prior=await state(),next=candidate(prior);const first=await parsePublicHistory(JSON.stringify(await publicHistory(prior.hands.slice(0,1))));const second=await parsePublicHistory(JSON.stringify(await publicHistory(prior.hands.slice(1,3))));
  const restored=structuredClone(prior);restored.importedHands=[...first,...second];await expect(auditSnapshot(restored)).resolves.toBeDefined();
  // Import deduplication legitimately retains a later source record whose previous
  // hash references an already-known record from its independently verified file.
  next.importedHands=[...prior.importedHands];await expect(verifyTransition(prior,next)).resolves.toBeDefined();
 });
 it('does not waive active-hand replay equality merely because a historical top-up receipt remains on the engine',async()=>{
  const port=new Port(),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});
  const initial=controller.data!.active!.game;await controller.act({type:'fold'},initial.handId,initial.revision);await controller.topUp(100);await controller.nextHand();expect(controller.error).toBe('');
  const prior=controller.data!,next=candidate(prior);expect(next.active!.game.street).toBe('preflop');expect(next.active!.game.tableTransfers!.length).toBeGreaterThan(0);
  next.active!.frames=structuredClone(next.active!.frames);next.active!.frames.at(-1)!.pot+=1;
  await rejectsBoth(prior,next);controller.close();
 });
 it('revalidates closed-session financial summaries when new ledger events reference an unchanged closed session object',async()=>{
  const prior=await state(),next=candidate(prior),closed=prior.sessions.find(s=>s.endedAt!==null)!;
  await appendMoney(next,{id:'review-credit-closed-session',at:'2026-11-01T00:00:00Z',epoch:next.epoch,kind:'top-up',walletDelta:-100,tableDelta:100,pokerNet:0,sessionId:closed.id,note:'Wrong closed session reference'});
  next.active!.game=structuredClone(next.active!.game);next.active!.game.seats.find(s=>s.id===0)!.stack+=100;next.active!.game.initialTotal+=100;
  next.active!.frames=[...next.active!.frames.slice(0,-1),projectView(next.active!.game,0)];
  expect(next.sessions.find(s=>s.id===closed.id)).toBe(closed);await rejectsBoth(prior,next);
 });
 it('rechecks queued request context when the frozen queue is unchanged but its active hand identity changed',async()=>{
  const prepared=structuredClone(await state());prepared.active!.queuedConfiguration={id:'review-stable-queue',sessionId:prepared.active!.sessionId,requestedHandId:prepared.active!.game.handId,queuedAt:'2026-11-01T00:00:00Z',settings:normalizeTableSettings(DEFAULT_SETTINGS,()=>1)};
  const prior=await auditSnapshot(prepared),next=candidate(prior);next.active!.game=structuredClone(next.active!.game);next.active!.game.handId='review-changed-context';next.active!.frames=[projectView(next.active!.game,0)];next.active!.pending=null;
  expect(next.active!.queuedConfiguration).toBe(prior.active!.queuedConfiguration);await rejectsBoth(prior,next);
 });
 it('rejects an unknown segmented-envelope version directly, rather than reconstructing an unsupported protocol',async()=>{
  const original=await state(),prepared=await prepareSegments(original,null,null),store=new Map(prepared.writes.map(w=>[w.key,w.entry]));
  const body={...prepared.envelope,version:99};delete (body as {checksum?:string}).checksum;const changed={...body,checksum:await digest(body)};
  expect(await rejected(restoreSegments(changed as typeof prepared.envelope,async keys=>keys.map(k=>store.get(k))))).toBe(true);
 });
});
