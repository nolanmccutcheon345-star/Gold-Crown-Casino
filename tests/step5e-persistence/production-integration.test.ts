import {beforeAll,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {getArchiveContext,totalHandCount,prepareCompactSnapshot,auditCompactSnapshot} from '../../src/storage/verified';
import {prepareSegments,type SegmentedEnvelope,type LegacyEnvelope} from '../../src/storage/segments';
import {FAST_HEAD_KEY,type FinancialCheckpoint,type RecoveryHead} from '../../src/storage/financial-checkpoint';
import type {CompactArchiveContext} from '../../src/storage/recovery-contracts';
import {canonical,digest,parsePublicHistory} from '../../src/storage/integrity';
import {CashStatsProjection} from '../../src/stats/projection';
import {transactionReference} from '../step36/transaction-reference';
import {financialInput,referenceFinancial,referenceFullHands} from '../step5e-independent/financial-reference';
import {observeTimings,type TimingSample} from '../../src/performance/timing';

class Memory implements PersistencePort {data:AppData|null=null;async load(){return this.data;}async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=next;}close(){}}
const owner='step5e-production-hooks';
function attach(db:IDBDatabase){Object.assign(db,{close:()=>{}});const port=new BrowserPersistence('ai-texas-step5e-production-integration');Object.assign(port,{db,owner,writable:true});return port;}
let original:AppData;
beforeAll(async()=>{
 const memory=new Memory(),controller=new SessionController(memory);await controller.init();
 for(let i=0;i<124;i++){
  await controller.startSession({...DEFAULT_SETTINGS,seats:2});const g=controller.data!.active!.game;await controller.act({type:'fold'},g.handId,g.revision);await controller.cashOut();expect(controller.error).toBe('');
 }
 original=controller.data!;controller.close();expect(original.hands).toHaveLength(124);
},30000);
async function fixture(packHands=true){
 const prepared=await prepareSegments(original,null,null,{packHands}),map=new Map<string,unknown>([['current',prepared.envelope],['lease',{owner,expires:Date.now()+12000}]]);
 for(const row of [...prepared.writes,...(prepared.replicas??[])])map.set(row.key,row.entry);
 const storage=transactionReference(map),port=attach(storage.db);await port.load();return{...storage,port,originalRecords:map};
}
async function reseal(record:{checksum:string}){const body={...record} as {checksum?:string};delete body.checksum;record.checksum=await digest(body);}
describe('Step5E real compact finance/statistics/bot-memory hooks beyond120 hands',()=>{
 it.each(['error','readonly'] as const)('exports the full verified archive in %s without committing money or enabling actions',async status=>{
  const s=await fixture(),controller=new SessionController(attach(s.db));await controller.init();
  expect(controller.data!.hands).toHaveLength(120);controller.status=status;controller.error='Injected unavailable writer';
  const before=canonical([...s.records]),ledger=canonical(controller.data!.ledger),wallet=controller.data!.wallet;
  const exported=await controller.exportHistory(),parsed=await parsePublicHistory(JSON.stringify(exported));
  expect(parsed.map(hand=>hand.handId)).toEqual(original.hands.map(hand=>hand.id));expect(parsed).toHaveLength(124);
  expect(JSON.stringify(exported)).not.toMatch(/privateProfiles|personalitySeed/);expect(controller.status).toBe(status);expect(controller.error).toBe('Injected unavailable writer');
  expect(controller.data!.wallet).toBe(wallet);expect(canonical(controller.data!.ledger)).toBe(ledger);expect(canonical([...s.records])).toBe(before);controller.close();
 });
 it('rejects an obsolete compact export after a different writer commits without adopting its financial state',async()=>{
  const s=await fixture(),old=new SessionController(attach(s.db)),other=new SessionController(attach(s.db));await old.init();await other.init();
  const expected=old.data;old.status='readonly';await other.adjustBankroll(other.data!.wallet+77,'newer committed writer');expect(other.error).toBe('');
  const before=canonical([...s.records]);await expect(old.exportHistory()).rejects.toThrow(/Saved state changed/);
  expect(old.data).toBe(expected);expect(old.status).toBe('readonly');expect(canonical([...s.records])).toBe(before);old.close();other.close();
 });
 it('first conversion of a large unpacked archive skips all-history replica encoding, preserves canonical rows, appends safely and remains V7-R readable',async()=>{
  const timings:TimingSample[]=[];let s:Awaited<ReturnType<typeof fixture>>;observeTimings(sample=>timings.push(sample));try{s=await fixture(false);}finally{observeTimings(null);}
  expect(timings.some(sample=>sample.name==='integrity.fullAudit')).toBe(true);expect(timings.some(sample=>sample.name==='persistence.installRecovery.prepare')).toBe(true);expect(timings.some(sample=>sample.name.startsWith('persistence.installPacked')||sample.name==='persistence.packHand')).toBe(false);
  expect([...s.records.keys()].some(key=>key.startsWith('packed-v1:hands:'))).toBe(false);expect(s.records.has(FAST_HEAD_KEY)).toBe(true);expect(s.records.get('current')).toEqual(s.originalRecords.get('current'));
  for(const [key,value] of s.originalRecords)if(key.startsWith('v2:'))expect(canonical(s.records.get(key))).toBe(canonical(value));
  const controller=new SessionController(attach(s.db));await controller.init();expect(totalHandCount(controller.data!)).toBe(124);expect(controller.data!.hands).toHaveLength(120);
  await controller.startSession({...DEFAULT_SETTINGS,seats:2});const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);await controller.cashOut();expect(controller.error).toBe('');expect(totalHandCount(controller.data!)).toBe(125);
  expect([...s.records.keys()].some(key=>key.startsWith('packed-v1:hands:'))).toBe(false);
  const moduleURL='../step5c-rollback/generated/recovery.js',legacy=await import(moduleURL) as {BrowserPersistence:typeof BrowserPersistence},legacyPort=new legacy.BrowserPersistence('ai-texas-step5e-v7r-conversion');Object.assign(legacyPort,{db:s.db,owner,writable:true});
  const old=await legacyPort.load();expect(old!.hands).toHaveLength(125);expect(old!.hands.slice(0,124)).toEqual(original.hands);expect(old!.wallet).toBe(controller.data!.wallet);expect(old!.ledger).toEqual(controller.data!.ledger);controller.close();
 });
 it('large v1 format migration retains its verified pre-upgrade backup without generating packed archive replicas',async()=>{
  const envelope:LegacyEnvelope={format:'ai-texas-hold-em-private-device',version:1,data:original,checksum:await digest(original)},storage=transactionReference(new Map<string,unknown>([['current',envelope],['lease',{owner,expires:Date.now()+12000}]])),port=attach(storage.db);
  const migrated=await port.load();expect(migrated!.revision).toBe(original.revision+1);expect(migrated!.wallet).toBe(original.wallet);expect(storage.records.has(FAST_HEAD_KEY)).toBe(true);expect([...storage.records.keys()].some(key=>key.startsWith('packed-v1:hands:'))).toBe(false);
  expect((await port.inspectUpgradeBackup()).snapshot).toEqual(original);expect(totalHandCount((await attach(storage.db).load())!)).toBe(124);
 });
 it('restores124 exact histories as120 resident bodies and agrees with independent full financial/action replay',async()=>{
  const s=await fixture(),data=(await attach(s.db).load())!,context=getArchiveContext(data)!;
  expect(data.hands).toHaveLength(120);expect(context.handOffset).toBe(4);expect(totalHandCount(data)).toBe(124);expect(data.hands.map(h=>h.hash)).toEqual(original.hands.slice(-120).map(h=>h.hash));
  const full=referenceFullHands(original.hands),expected=referenceFinancial(financialInput(original)),small=referenceFinancial({...financialInput(data),handIndex:context.handIndex});expect(small).toEqual(expected);expect(small.poker).toBe(full.poker);
  const stats=CashStatsProjection.restoreCheckpoint(context.statistics,{hands:context.statisticsHands,lastId:context.handIndex.at(-1)!.id,lastHash:context.handIndex.at(-1)!.hash}).readCheckpoint(data.sessions,0);
  expect(stats.hands).toBe(124);expect(stats.profit).toBe(full.poker);expect(data.wallet).toBe(original.wallet);
  for(const [key,value] of s.originalRecords)if(key.startsWith('packed-v1:hands:'))expect(s.records.get(key)).toEqual(value);
 });
 it('appends settlement after compact reload once, retains every original canonical row and returns complete audited history',async()=>{
  const s=await fixture(),port=attach(s.db),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});
  const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);await controller.cashOut();expect(controller.error).toBe('');
  expect(totalHandCount(controller.data!)).toBe(125);expect(controller.data!.hands.length).toBeLessThanOrEqual(121);const full=await port.loadFullHistory();expect(full.hands).toHaveLength(125);expect(full.hands.slice(0,124)).toEqual(original.hands);
  const restored=(await attach(s.db).load())!;expect(totalHandCount(restored)).toBe(125);expect(restored.ledger).toEqual(full.ledger);expect(restored.wallet).toBe(full.wallet);expect(referenceFinancial(financialInput(full)).poker).toBe(referenceFullHands(full.hands).poker);
  expect((s.records.get('current') as SegmentedEnvelope).segments.hands.count).toBe(125);controller.close();
 });
 it('restores a committed pending bot identity and applies it once across reload',async()=>{
  const s=await fixture(),port=attach(s.db),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:6});await controller.prepareBot();expect(controller.error).toBe('');
  const active=controller.data!.active!,pending=active.pending;expect(pending).not.toBe(null);
  const reopened=new SessionController(attach(s.db));await reopened.init();expect(reopened.data!.active!.pending).toEqual(pending);await reopened.prepareBot();expect(reopened.data!.active!.pending).toEqual(pending);
  await reopened.commitBot(active.game.handId,active.game.revision);expect(reopened.error).toBe('');const committed=reopened.data!;await reopened.commitBot(active.game.handId,active.game.revision);expect(reopened.data).toBe(committed);
  controller.close();reopened.close();
 });
 it.each(['net','missing','duplicate','policy','statistics'] as const)('rejects resealed checkpoint %s inconsistency with unchanged canonical save',async fault=>{
  const s=await fixture(),head=structuredClone(s.records.get(FAST_HEAD_KEY)) as RecoveryHead,checkpoint=structuredClone(s.records.get(head.checkpointKey)) as FinancialCheckpoint<CompactArchiveContext>;
  if(fault==='net')checkpoint.payload.context.handIndex[0].net++;
  if(fault==='missing')checkpoint.payload.context.handIndex.splice(0,1);
  if(fault==='duplicate')checkpoint.payload.context.handIndex[1]=checkpoint.payload.context.handIndex[0];
  if(fault==='policy')checkpoint.payload.context.handIndex[0].policyVersions=['synthetic-cash-99.0.0'];
  if(fault==='statistics')checkpoint.payload.context.statisticsHands--;
  await reseal(checkpoint);s.records.delete(head.checkpointKey);head.checkpointHash=checkpoint.checksum;head.checkpointKey=`recovery-v1:checkpoint:${checkpoint.revision}:${checkpoint.checksum}`;head.tail=checkpoint.checksum;await reseal(head);s.records.set(head.checkpointKey,checkpoint);s.records.set(FAST_HEAD_KEY,head);
  await expect(attach(s.db).load()).rejects.toThrow();expect((s.records.get('current') as SegmentedEnvelope).data.wallet).toBe(original.wallet);
 });
 it('does not grant financial trust to a direct caller of the compact audit with only a self-asserted checkpoint',async()=>{
  const payload=await prepareCompactSnapshot(original);await expect(auditCompactSnapshot(structuredClone(payload.data),structuredClone(payload.context))).rejects.toThrow(/envelope|verified|storage/i);
 });
});
