import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPopulatedV3Fixture } from './fixture-builder';
import { migrateData as previousReader } from './frozen-v3/src/storage/integrity';

describe('Frozen previously published source and representative fixture provenance',()=>{
 it('retains exact SHA-256 and git blob identities for all 11 frozen runtime files',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./frozen-v3/manifest.json',import.meta.url),'utf8'));
  for(const file of manifest.files){
   const bytes=readFileSync(new URL(`./frozen-v3/${file.path}`,import.meta.url));
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
   expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(file.gitBlob);
  }
  expect(manifest.files).toHaveLength(11);
 });
 it('reproduces populated legacy snapshots through the actual old controller and validates them with the actual old reader',async()=>{
  const fixture=await buildPopulatedV3Fixture();
  if(process.env.WRITE_STEP36_FIXTURE==='1'){
   mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
   writeFileSync(new URL('./fixtures/populated-v3.json',import.meta.url),JSON.stringify(fixture,null,2)+'\n');
  }
  const saved=JSON.parse(readFileSync(new URL('./fixtures/populated-v3.json',import.meta.url),'utf8'));
  expect(fixture).toEqual(saved);
  for(const snapshot of Object.values(fixture.streets)){
   expect(await previousReader(snapshot)).toEqual(snapshot);
   expect(snapshot.wallet).toBe(190000);expect(snapshot.hands.map(h=>h.net)).toEqual([-100,-200,450]);
   expect(snapshot.hands.reduce((n,h)=>n+h.view.rake,0)).toBe(50);
   expect(snapshot.sessions).toHaveLength(3);expect(snapshot.importedHands).toHaveLength(3);
   expect(snapshot.ledger.filter(e=>e.kind==='adjustment')).toHaveLength(4);
   expect(snapshot.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(3);
   expect(snapshot.ledger.filter(e=>e.kind==='top-up')).toHaveLength(2);
   expect(snapshot.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(2);
   expect(snapshot.active!.pending!.decision).not.toBeNull();
  }
 });
});
