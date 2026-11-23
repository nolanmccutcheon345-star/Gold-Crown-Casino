import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData} from '../../src/session/types';
import {migrateData} from '../../src/storage/integrity';
import {verifyMigrationBackup,type MigrationReceipt} from '../../src/storage/rollback';
import type {LegacyEnvelope,SegmentedEnvelope} from '../../src/storage/segments';
import {hash,encode} from './reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';

/** Recreate the exact pre-Step5D format algorithm independently, so changing the
 * current production writer cannot silently change this compatibility fixture. */
function legacyReceipt(data:AppData):{backup:LegacyEnvelope;receipt:MigrationReceipt}{
 const backup:LegacyEnvelope={format:'ai-texas-hold-em-private-device',version:1,data,checksum:hash(data)};
 const {hands,ledger,sessions,importedHands,...rest}=data,openSession=sessions.find(s=>s.endedAt===null)??null;
 const collections={ledger,hands,closedSessions:sessions.filter(s=>s.endedAt!==null),importedHands};
 const segments={} as SegmentedEnvelope['segments'];
 for(const name of ['ledger','hands','closedSessions','importedHands'] as const){let tail='0'.repeat(64);
  for(const [index,value] of collections[name].entries())tail=hash({index,previousHash:tail,value});
  segments[name]={count:collections[name].length,tail};
 }
 const targetBody={format:backup.format,version:2,data:{...rest,revision:data.revision+1,openSession},segments};
 const body:Omit<MigrationReceipt,'checksum'>={format:'ai-texas-hold-em-migration-receipt',version:1,
  source:{envelopeVersion:1,schemaVersion:data.schemaVersion,revision:data.revision,checksum:backup.checksum},
  target:{envelopeVersion:2,schemaVersion:data.schemaVersion,revision:data.revision+1,checksum:hash(targetBody)},
  preserved:{wallet:data.wallet,hands:hands.length,ledger:ledger.length,sessions:sessions.length,importedHands:importedHands.length,handsTail:hands.at(-1)?.hash??null,ledgerTail:ledger.at(-1)?.hash??null}};
 return {backup,receipt:{...body,checksum:hash(body)}};
}

describe('Step5D independent legacy migration receipt compatibility',()=>{
 it.each(['preflop','flop','turn','river'])('still verifies exact legacy receipt at %s after writer optimizations',async street=>{
  const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
  const source=await migrateData(fixture.streets[street]),{backup,receipt}=legacyReceipt(source),bytes=encode({backup,receipt});
  const result=await verifyMigrationBackup(backup,receipt);
  expect(encode(result.snapshot)).toBe(encode(source));expect(replayAccounting(result.snapshot)).toEqual(replayAccounting(source));
  expect(encode({backup,receipt})).toBe(bytes);expect(result.receipt.target.checksum).toBe(receipt.target.checksum);
 });
});
