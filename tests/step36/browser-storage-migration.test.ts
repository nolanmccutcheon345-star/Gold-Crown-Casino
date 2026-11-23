import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserPersistence } from '../../src/storage/browser';
import { digest, migrateData } from '../../src/storage/integrity';
import type { AppData } from '../../src/session/types';
import { BrowserPersistence as PreviousPersistence } from './frozen-v3/src/storage/browser';
import type { AppData as OldData } from './frozen-v3/src/session/types';
import { restoreSegments,type SegmentedEnvelope } from '../../src/storage/segments';
import { transactionReference } from './transaction-reference';
import type { PopulatedFixture } from './fixture-builder';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/populated-v3.json',import.meta.url),'utf8')) as PopulatedFixture;
type Envelope={format:string;version:number;data:OldData|AppData;checksum:string};
const envelope=async(data:OldData|AppData):Promise<Envelope>=>({format:'ai-texas-hold-em-private-device',version:1,data:structuredClone(data),checksum:await digest(data)});
async function setup(data:OldData|AppData=fixture.streets.flop){
 const prior=await envelope(data);const previous={retained:'previous snapshot sentinel'};
 const fake=transactionReference(new Map<string,unknown>([['current',prior],['previous',previous],['lease',{owner:'migration-test',expires:Date.now()+12000}]]));
 const port=new BrowserPersistence('ai-texas-hold-em-test-migration');attach(port,fake.db);
 return {port,...fake,prior,previous};
}
function attach(port:BrowserPersistence|PreviousPersistence,db:IDBDatabase){
 const internals=port as unknown as {db:IDBDatabase;owner:string};internals.db=db;internals.owner='migration-test';port.writable=true;
}
const bytes=(records:Map<string,unknown>)=>JSON.stringify([...records]);
afterEach(()=>{vi.unstubAllGlobals();});

describe('Step 3.6 BrowserPersistence migration transactions (asynchronous reference DB)',()=>{
 it('commits populated upgrade once, increments CAS revision, and retains the exact checksummed pre-migration envelope',async()=>{
  const {port,records,prior}=await setup();const migrated=await port.load();
  expect(migrated!.schemaVersion).toBe(4);expect(migrated!.revision).toBe(prior.data.revision+1);
  expect(records.get('pre-migration-v3')).toEqual(prior);expect(records.get('previous')).toEqual(prior);
  const current=records.get('current') as SegmentedEnvelope;expect(current.version).toBe(2);expect(await restoreSegments(current,async keys=>keys.map(key=>records.get(key)))).toEqual(migrated);const {checksum,...body}=current;expect(checksum).toBe(await digest(body));
  const before=bytes(records);expect(await port.load()).toEqual(migrated);expect(bytes(records)).toBe(before);
 });
 it('migrates populated v2 directly to v4 and retains the v2 backup with no invented shelf records',async()=>{
  const old={...structuredClone(fixture.streets.turn),schemaVersion:2};delete (old as {importedHands?:unknown}).importedHands;
  const {port,records,prior}=await setup(old as unknown as OldData);const data=await port.load();
  expect(data!.schemaVersion).toBe(4);expect(data!.wallet).toBe(190000);expect(data!.importedHands).toEqual([]);
  expect(records.get('pre-migration-v2')).toEqual(prior);expect(data!.ledger).toEqual(prior.data.ledger);
 });
 it('aborting after backup write rolls back current, previous, backup and lease together, then retry migrates once',async()=>{
  const {port,records,control,prior}=await setup();const before=bytes(records);control.abortOnPutKey='pre-migration-v3';
  await expect(port.load()).rejects.toThrow(/Storage write failed/);expect(bytes(records)).toBe(before);expect(records.has('pre-migration-v3')).toBe(false);
  const retried=await port.load();expect(retried!.revision).toBe(prior.data.revision+1);expect(records.get('pre-migration-v3')).toEqual(prior);
  expect(retried!.ledger).toEqual(prior.data.ledger);expect(retried!.hands).toEqual(prior.data.hands);
 });
 it('aborting the new current snapshot write also leaves the prior bytes and backup records untouched',async()=>{
  const {port,records,control}=await setup();const before=bytes(records);control.abortOnPutKey='current';
  await expect(port.load()).rejects.toThrow(/Storage write failed/);expect(bytes(records)).toBe(before);
 });
 it('readonly load may inspect an in-memory migration but cannot publish it or change any persisted byte',async()=>{
  const {port,records,prior}=await setup();port.writable=false;
  vi.stubGlobal('navigator',{locks:{request:async(_name:string,_options:unknown,callback:(lock:null)=>Promise<void>)=>callback(null)}});
  const before=bytes(records);const result=await port.load();expect(result!.schemaVersion).toBe(4);expect(result!.revision).toBe(prior.data.revision);
  expect(port.writable).toBe(false);expect(bytes(records)).toBe(before);expect(records.has('pre-migration-v3')).toBe(false);
 });
 it('actual old storage reader rejects the upgraded database and cannot change current, previous, backup or lease bytes',async()=>{
  const {port,records,db}=await setup();await port.load();const old=new PreviousPersistence();attach(old,db);const before=bytes(records);
  await expect(old.load()).rejects.toThrow(/Unknown guest snapshot format/);expect(bytes(records)).toBe(before);
 });
 it('actual old writer holding a pre-upgrade cached revision is fenced even with the same lease-owner token',async()=>{
  const {port,records,db,prior}=await setup();const old=new PreviousPersistence();attach(old,db);
  const cached=await old.load();expect(cached!.schemaVersion).toBe(3);await port.load();const before=bytes(records);
  cached!.revision++;await expect(old.commit(prior.data.revision,cached!)).rejects.toThrow(/revision changed/);expect(bytes(records)).toBe(before);
 });
 it('current writer rejects an explicitly requested downgrade even with the exact current revision and ownership',async()=>{
  const {port,records,prior}=await setup();const migrated=await port.load();const before=bytes(records);
  const downgraded={...prior.data,revision:migrated!.revision+1};
  await expect(port.commit(migrated!.revision,downgraded as unknown as AppData)).rejects.toThrow(/downgrade refused/);expect(bytes(records)).toBe(before);
 });
 it('restores only an isolated cloned pre-migration backup, opens it with old code, and remigrates without financial changes',async()=>{
  const {port,records}=await setup();const migrated=await port.load();const backup=structuredClone(records.get('pre-migration-v3')) as Envelope;
  const restored=transactionReference(new Map<string,unknown>([['current',backup],['lease',{owner:'migration-test',expires:Date.now()+12000}]]));
  const old=new PreviousPersistence();attach(old,restored.db);expect(await old.load()).toEqual(fixture.streets.flop);
  const current=new BrowserPersistence('ai-texas-hold-em-test-restored-clone');attach(current,restored.db);expect(await current.load()).toEqual(migrated);
  expect(records.get('current')).toEqual(restored.records.get('current'));
 });
 it.each(['future-schema','broken-checksum','unreconciled-wallet'] as const)('refuses %s without overwriting any snapshot, backup or lease',async kind=>{
  const {port,records,prior}=await setup();const invalid=structuredClone(prior);
  if(kind==='future-schema')(invalid.data as unknown as {schemaVersion:number}).schemaVersion=99;
  if(kind==='unreconciled-wallet')invalid.data.wallet++;
  invalid.checksum=kind==='broken-checksum'?'0'.repeat(64):await digest(invalid.data);records.set('current',invalid);
  const before=bytes(records);await expect(port.load()).rejects.toThrow();expect(bytes(records)).toBe(before);
 });
 it('requires current version validation even when a checksum-valid v4 snapshot carries unknown exit intent',async()=>{
  const data=await migrateData(fixture.streets.river);(data.active as unknown as {exitMode:string}).exitMode='abandon-without-settlement';
  const {port,records}=await setup(data);const before=bytes(records);await expect(port.load()).rejects.toThrow(/exit intent/);expect(bytes(records)).toBe(before);
 });
});
