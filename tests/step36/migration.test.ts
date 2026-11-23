import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateData, validateData } from '../../src/storage/integrity';
import { SessionController } from '../../src/session/controller';
import type { AppData, PersistencePort } from '../../src/session/types';
import * as currentPolicy from '../../src/bots/policy';
import { applyCommand as previousApplyCommand } from './frozen-v3/src/core/engine';
import { migrateData as previousReader } from './frozen-v3/src/storage/integrity';
import type { PopulatedFixture, Street } from './fixture-builder';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/populated-v3.json',import.meta.url),'utf8')) as PopulatedFixture;
const streets:Street[]=['preflop','flop','turn','river'];
class Memory implements PersistencePort {
 constructor(public data:AppData){}
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if(this.data.revision!==expected)throw new Error('stale revision');this.data=structuredClone(next);}
 close(){}
}
function independentMoney(data:AppData){
 expect(data.wallet).toBe(190000);
 expect(data.ledger.reduce((n,e)=>n+e.walletDelta,0)).toBe(190000);
 expect(data.ledger.reduce((n,e)=>n+e.tableDelta,0)).toBe(10000);
 expect(data.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(150);
 expect(data.hands.map(h=>h.net)).toEqual([-100,-200,450]);
 expect(data.sessions.map(s=>s.buyIns)).toEqual([20100,50550,10000]);
 expect(data.sessions.map(s=>s.cashOut)).toEqual([19800,51000,0]);
 expect(data.hands.reduce((n,h)=>n+h.view.rake,0)).toBe(50);
 expect(data.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
}

describe('Step 3.6 populated legacy migrations and exact restoration',()=>{
 it.each(streets)('v3 → v4 preserves populated money, immutable records and exact %s pending state',async street=>{
  const old=structuredClone(fixture.streets[street]);const originalBytes=JSON.stringify(old);
  const migrated=await migrateData(old);expect(JSON.stringify(old)).toBe(originalBytes);
  expect(migrated).toEqual({...old,schemaVersion:4,active:{...old.active!,exitMode:null}});
  expect(migrated.ledger.map(e=>[e.id,e.hash])).toEqual(old.ledger.map(e=>[e.id,e.hash]));
  expect(migrated.hands.map(h=>[h.id,h.hash])).toEqual(old.hands.map(h=>[h.id,h.hash]));
  independentMoney(migrated);expect(migrated.importedHands).toEqual(old.importedHands);
  const port=new Memory(migrated);const c=new SessionController(port);await c.init();expect(c.error).toBe('');
  expect(c.data!.active!.game).toEqual(old.active!.game);expect(c.data!.active!.pending).toEqual(old.active!.pending);
  expect(c.data!.active!.profiles).toEqual(old.active!.profiles);expect(c.data!.active!.frames).toEqual(old.active!.frames);
  const sample=vi.spyOn(currentPolicy,'chooseDecision');
  try{
   await c.prepareBot();expect(sample).not.toHaveBeenCalled();
   const pending=old.active!.pending!;const expectedGame=previousApplyCommand(old.active!.game,pending.decision!);
   await c.commitBot(pending.handId,pending.revision);expect(c.error).toBe('');expect(c.data!.active!.game).toEqual(expectedGame);
   const committed=structuredClone(c.data);await c.commitBot(pending.handId,pending.revision);
   expect(c.data).toEqual(committed);expect(c.data!.active!.game.events.filter(e=>e.decisionId===pending.decisionId)).toHaveLength(1);
  }finally{sample.mockRestore();c.close();}
 });
 it.each(streets)('v2 → v4 only adds the study shelf and explicit null exit mode to populated %s snapshot',async street=>{
  const old:Record<string,unknown>={...structuredClone(fixture.streets[street]),schemaVersion:2};delete old.importedHands;
  const originalBytes=JSON.stringify(old);const migrated=await migrateData(old);
  expect(JSON.stringify(old)).toBe(originalBytes);expect(migrated.schemaVersion).toBe(4);expect(migrated.importedHands).toEqual([]);
  expect(migrated.ledger).toEqual(old.ledger);expect(migrated.hands).toEqual(old.hands);expect(migrated.sessions).toEqual(old.sessions);
  expect(migrated.active).toEqual({...fixture.streets[street].active!,exitMode:null});independentMoney(migrated);
 });
 it('v4 migration is idempotent, deep-cloned, and preserves a durable exit intent',async()=>{
  const source=await migrateData(fixture.streets.turn);source.active!.exitMode='fold';const originalBytes=JSON.stringify(source);
  const result=await migrateData(source);expect(result).toEqual(source);expect(result).not.toBe(source);
  result.active!.game.seats[0].name='changed only in clone';expect(JSON.stringify(source)).toBe(originalBytes);
 });
 it.each([0,1,5,999])('unknown schema %s fails closed without altering even one input byte',async version=>{
  const old={...structuredClone(fixture.streets.river),schemaVersion:version};const bytes=JSON.stringify(old);
  await expect(migrateData(old)).rejects.toThrow(/Unknown saved-data version/);expect(JSON.stringify(old)).toBe(bytes);
 });
 it('corrupt financial data fails migration without resetting or repairing the original snapshot',async()=>{
  const old=structuredClone(fixture.streets.turn);old.wallet++;
  const bytes=JSON.stringify(old);await expect(migrateData(old)).rejects.toThrow(/reconcile/);expect(JSON.stringify(old)).toBe(bytes);
 });
 it.each([undefined,'cashout',true])('v4 rejects malformed or missing exitMode %s rather than guessing',async mode=>{
  const migrated=await migrateData(fixture.streets.preflop);(migrated.active as unknown as {exitMode:unknown}).exitMode=mode;
  await expect(validateData(migrated)).rejects.toThrow(/exit intent/);
 });
});

describe('True previously shipped v3 reader downgrade compatibility',()=>{
 it.each(streets)('old reader accepts the exact prior %s snapshot but rejects v4 without changing input bytes',async street=>{
  const before=structuredClone(fixture.streets[street]);expect(await previousReader(before)).toEqual(before);
  const upgraded=await migrateData(before);upgraded.active!.exitMode='fold';const bytes=JSON.stringify(upgraded);
  await expect(previousReader(upgraded)).rejects.toThrow(/Unknown saved-data version/);expect(JSON.stringify(upgraded)).toBe(bytes);
  // A deliberately restored isolated backup still opens in the old reader;
  // remigration reaches the same v4 data, with no new bankroll or history entries.
  const restored=await previousReader(JSON.parse(JSON.stringify(before)));
  expect(await migrateData(restored)).toEqual({...upgraded,active:{...upgraded.active!,exitMode:null}});
 });
 it('documents why an optional semantic extension under v3 is unsafe: the actual old reader accepts and ignores its meaning',async()=>{
  const unsupportedV3={...structuredClone(fixture.streets.preflop),active:{...fixture.streets.preflop.active!,exitMode:'fold'}};
  await expect(previousReader(unsupportedV3)).resolves.toEqual(unsupportedV3);
  // Production writes schema4 instead; the preceding cases prove the real old
  // reader refuses it. A new minReaderVersion field alone would not help v3.
 });
});
