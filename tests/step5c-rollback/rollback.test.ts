import {describe,it,expect,afterEach,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {legalActions} from '../../src/core/engine';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {canonical,digest,migrateData,validateData} from '../../src/storage/integrity';
import {MIGRATION_RECEIPT_KEY,PRE_UPGRADE_KEY,verifyMigrationBackup,type MigrationReceipt} from '../../src/storage/rollback';
import {transactionReference} from '../step36/transaction-reference';
import type {AppData} from '../../src/session/types';
import type {LegacyEnvelope} from '../../src/storage/segments';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
const url='./generated/recovery.js';
const recovery=await import(url) as {BrowserPersistence:typeof BrowserPersistence;SessionController:typeof SessionController;supportedPolicy:(version:string)=>boolean};
const oldURL='../browser/step5b-published-v7.js';
const published=await import(oldURL) as typeof recovery;
function attach(Port:typeof BrowserPersistence,db:IDBDatabase){const port=new Port('ai-texas-step5c-rollback-test');Object.assign(port,{db,owner:'rollback-test',writable:true});return port;}
async function setup(){const data=await migrateData(fixture.streets.flop),prior:LegacyEnvelope={format:'ai-texas-hold-em-private-device',version:1,data,checksum:await digest(data)},fake=transactionReference(new Map<string,unknown>([['current',prior],['lease',{owner:'rollback-test',expires:Date.now()+12000}]]));return {...fake,prior,port:attach(BrowserPersistence,fake.db)};}
afterEach(()=>vi.unstubAllGlobals());
const bytes=(records:Map<string,unknown>)=>canonical([...records]);
describe('Step5C independently verified upgrade backup and atomic receipt',()=>{
 it('binds exact original populated save, revision, wallet, counts and tails; repeated load is inert',async()=>{
  const s=await setup(),loaded=await s.port.load(),verified=await s.port.inspectUpgradeBackup();expect(verified.snapshot).toEqual(s.prior.data);expect(verified.receipt.target.revision).toBe(s.prior.data.revision+1);expect(verified.receipt.preserved.wallet).toBe(loaded!.wallet);const disk=bytes(s.records);expect(await s.port.load()).toEqual(loaded);expect(bytes(s.records)).toBe(disk);
 });
 it.each([PRE_UPGRADE_KEY,MIGRATION_RECEIPT_KEY,'current'])('interruption at %s is atomic and retry migrates exactly once',async key=>{
  const s=await setup(),before=bytes(s.records);s.control.abortOnPutKey=key;await expect(s.port.load()).rejects.toThrow(/Storage write failed/);expect(bytes(s.records)).toBe(before);const saved=await s.port.load();expect(saved!.revision).toBe(s.prior.data.revision+1);expect(saved!.ledger).toEqual(s.prior.data.ledger);expect(saved!.hands).toEqual(s.prior.data.hands);expect((await s.port.inspectUpgradeBackup()).snapshot).toEqual(s.prior.data);await validateData(saved!);
 });
 it.each(['backup-bytes','receipt-bytes','receipt-counts-resealed','receipt-source-resealed','target-checksum-resealed','wallet-resealed'] as const)('rejects %s without altering current save or silently restoring old money',async fault=>{
  const s=await setup();await s.port.load();const backup=structuredClone(s.records.get(PRE_UPGRADE_KEY)) as LegacyEnvelope,receipt=structuredClone(s.records.get(MIGRATION_RECEIPT_KEY)) as MigrationReceipt;
  if(fault==='backup-bytes')backup.data.wallet++;
  if(fault==='receipt-bytes')receipt.preserved.wallet++;
  if(fault==='receipt-counts-resealed')receipt.preserved.ledger++;
  if(fault==='receipt-source-resealed')receipt.source.revision++;
  if(fault==='target-checksum-resealed')receipt.target.checksum='0'.repeat(64);
  if(fault==='wallet-resealed'){backup.data.wallet++;backup.checksum=await digest(backup.data);receipt.source.checksum=backup.checksum;receipt.preserved.wallet++;}
  if(fault.endsWith('resealed')){const body:Partial<MigrationReceipt>={...receipt};delete body.checksum;receipt.checksum=await digest(body);}
  const disk=bytes(s.records);await expect(verifyMigrationBackup(backup,receipt)).rejects.toThrow();expect(bytes(s.records)).toBe(disk);
 });
 it('never represents an already segmented Version8 save without a receipt as verified pre-upgrade backup',async()=>{
  const s=await setup();await s.port.load();s.records.delete(MIGRATION_RECEIPT_KEY);await expect(s.port.inspectUpgradeBackup()).rejects.toThrow(/unavailable/);expect((await s.port.load())!.wallet).toBe(s.prior.data.wallet);
 });
});
describe('Step5C V7-R emergency compatibility runtime (not unchanged V7)',()=>{
 it('pins all V7 UI files to actual published source and every runtime file to frozen tested Version8 source',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./generated/manifest.json',import.meta.url),'utf8')) as {previousUICommit:string;recoveryRuntimeCommit:string;sourceFiles:Record<string,{origin:string;sha256:string}>;bundleSHA256:string};const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
  expect(manifest.previousUICommit).toBe('a0bfc0950771a6dc1b786e00c13be7f3485b8dcb');expect(manifest.recoveryRuntimeCommit).toBe('f54cacfb0aa3c861313b691e773a6716379c50a0');expect(Object.values(manifest.sourceFiles).filter(x=>x.origin==='published-v7')).toHaveLength(8);
  for(const [path,entry] of Object.entries(manifest.sourceFiles)){const value=entry.origin==='published-v7'?execFileSync('git',['show',`${manifest.previousUICommit}:${path}`]):execFileSync('git',['show',`${manifest.recoveryRuntimeCommit}:${path}`]);expect(hash(value),path).toBe(entry.sha256);}
  expect(hash(readFileSync(new URL('./generated/recovery.js',import.meta.url)))).toBe(manifest.bundleSHA256);
 });
 it('retains version-dispatched policies through 1.6 without resampling older policies',()=>{for(const version of ['synthetic-phase0-0.1.0',...Array.from({length:7},(_,i)=>`synthetic-cash-1.${i}.0`)])expect(recovery.supportedPolicy(version)).toBe(true);expect(recovery.supportedPolicy('synthetic-cash-99.0.0')).toBe(false);expect(published.supportedPolicy('synthetic-cash-1.6.0')).toBe(false);});
 it('recovers latest post-upgrade records, allows real settlement/cashout, then current candidate reopens exact state',async()=>{
  const s=await setup(),c=new SessionController(s.port);await c.init();for(let i=0;i<100&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}await c.cashOut();expect(c.data!.active).toBe(null);await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();await c.adjustBankroll(c.data!.wallet+777,'post-upgrade adjustment');const latest=structuredClone(c.data!),disk=bytes(s.records);
  const old=new published.SessionController(attach(published.BrowserPersistence,s.db));await old.init();expect(old.status).toBe('error');expect(bytes(s.records)).toBe(disk);
  const fallback=new recovery.SessionController(attach(recovery.BrowserPersistence,s.db));await fallback.init();expect(fallback.status).toBe('ready');expect(canonical(fallback.data)).toBe(canonical(latest));await fallback.startSession({...DEFAULT_SETTINGS,seats:2});const next=fallback.data!.active!.game;await fallback.act({type:'fold'},next.handId,next.revision);await fallback.cashOut();const recovered=structuredClone(fallback.data!);expect(recovered.hands.slice(0,latest.hands.length)).toEqual(latest.hands);expect(recovered.ledger.slice(0,latest.ledger.length)).toEqual(latest.ledger);expect(recovered.hands.length).toBe(latest.hands.length+1);await validateData(recovered);
  const restored=new SessionController(attach(BrowserPersistence,s.db));await restored.init();expect(canonical(restored.data)).toBe(canonical(recovered));expect((await s.port.inspectUpgradeBackup()).snapshot).toEqual(s.prior.data);
 });
});
