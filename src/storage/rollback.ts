import type {AppData} from '../session/types';
import {canonical,digest,migrateData,requireData} from './integrity';
import {prepareSegments,type LegacyEnvelope,type SegmentedEnvelope} from './segments';

export const MIGRATION_RECEIPT_KEY='upgrade-v1-to-v2-receipt';
export const PRE_UPGRADE_KEY='pre-segment-v1';
export interface MigrationReceipt {
 format:'ai-texas-hold-em-migration-receipt';version:1;
 source:{envelopeVersion:1;schemaVersion:number;revision:number;checksum:string};
 target:{envelopeVersion:2;schemaVersion:number;revision:number;checksum:string};
 preserved:{wallet:number;hands:number;ledger:number;sessions:number;importedHands:number;handsTail:string|null;ledgerTail:string|null};
 checksum:string;
}
/** A small verifiable attestation is committed atomically with the exact legacy
 * envelope and first segmented checkpoint. It never substitutes for either full audit. */
export async function migrationReceipt(source:LegacyEnvelope,target:SegmentedEnvelope,data:AppData):Promise<MigrationReceipt>{
 requireData(source.format==='ai-texas-hold-em-private-device'&&source.version===1,'Unsupported pre-upgrade envelope.');
 requireData(source.checksum===await digest(source.data),'Pre-upgrade snapshot checksum failed. Upgrade was refused.');
 const before=await migrateData(source.data);
 requireData(canonical({...data,revision:before.revision})===canonical(before),'Migration changed canonical user data. Upgrade was refused.');
 requireData(target.data.revision===source.data.revision+1,'Migration revision must advance exactly once.');
 const body={format:'ai-texas-hold-em-migration-receipt' as const,version:1 as const,
  source:{envelopeVersion:1 as const,schemaVersion:source.data.schemaVersion,revision:source.data.revision,checksum:source.checksum},
  target:{envelopeVersion:2 as const,schemaVersion:target.data.schemaVersion,revision:target.data.revision,checksum:target.checksum},
  preserved:{wallet:data.wallet,hands:data.hands.length,ledger:data.ledger.length,sessions:data.sessions.length,importedHands:data.importedHands.length,handsTail:data.hands.at(-1)?.hash??null,ledgerTail:data.ledger.at(-1)?.hash??null}};
 return {...body,checksum:await digest(body)};
}
/** Explicit support/recovery audit. This is not a startup shortcut or a request to
 * restore stale balances. Returning an old backup never writes it over newer data. */
export async function verifyMigrationBackup(backup:unknown,receipt:unknown):Promise<{snapshot:AppData;receipt:MigrationReceipt}>{
 const prior=backup as LegacyEnvelope,r=receipt as MigrationReceipt;
 requireData(prior?.format==='ai-texas-hold-em-private-device'&&prior.version===1,'Verified pre-upgrade backup is unavailable. Current data was not changed.');
 requireData(r?.format==='ai-texas-hold-em-migration-receipt'&&r.version===1,'Migration receipt is unavailable or unsupported. Current data was not changed.');
 const {checksum,...body}=r;
 requireData(checksum===await digest(body),'Migration receipt integrity check failed.');
 requireData(prior.checksum===r.source.checksum&&prior.checksum===await digest(prior.data),'Pre-upgrade snapshot integrity check failed.');
 requireData(r.source.envelopeVersion===1&&prior.data.revision===r.source.revision&&prior.data.schemaVersion===r.source.schemaVersion&&r.target.revision===r.source.revision+1&&r.target.envelopeVersion===2&&r.target.schemaVersion===4,'Migration receipt source or target does not match.');
 const snapshot=await migrateData(prior.data);
 requireData(canonical(r.preserved)===canonical({wallet:snapshot.wallet,hands:snapshot.hands.length,ledger:snapshot.ledger.length,sessions:snapshot.sessions.length,importedHands:snapshot.importedHands.length,handsTail:snapshot.hands.at(-1)?.hash??null,ledgerTail:snapshot.ledger.at(-1)?.hash??null}),'Migration backup counts, balance or event tails differ.');
 const reconstructed=await prepareSegments({...snapshot,revision:r.target.revision},null,null);
 requireData(reconstructed.envelope.checksum===r.target.checksum,'Migration target checkpoint differs from the independently reconstructed backup.');
 return {snapshot,receipt:r};
}
