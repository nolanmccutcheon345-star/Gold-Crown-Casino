import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {canonical,digest,migrateData,validateData} from '../../src/storage/integrity';
import {SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
class Memory implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_rev:number|null,data:AppData){this.data=structuredClone(data);}close(){}}
describe('Versioned storage integrity',()=>{
 it('matches independent Node SHA-256 for empty, Unicode, nested and long canonical values',async()=>{for(const value of ['', '🎴 Texas ♥', {z:1,a:[null,true,2]},'a'.repeat(200000)])expect(await digest(value)).toBe(createHash('sha256').update(canonical(value)).digest('hex'));});
 it('migrates known v2 study shelf without resetting balances or immutable financial events',async()=>{const c=new SessionController(new Memory());await c.init();await c.adjustBankroll(123456,'baseline');const old={...structuredClone(c.data),schemaVersion:2};delete (old as {importedHands?:unknown}).importedHands;const migrated=await migrateData(old);expect(migrated.schemaVersion).toBe(4);expect(migrated.wallet).toBe(123456);expect(migrated.ledger).toEqual(c.data!.ledger);expect(migrated.importedHands).toEqual([]);});
 it('refuses unknown schema and corrupted wallet/chain instead of silently creating a bankroll',async()=>{const c=new SessionController(new Memory());await c.init();await expect(migrateData({...c.data,schemaVersion:999})).rejects.toThrow('Unknown');await expect(validateData({...c.data!,wallet:1})).rejects.toThrow('reconcile');const d=structuredClone(c.data!);d.ledger[0].walletDelta++;await expect(validateData(d)).rejects.toThrow('integrity');});
});
