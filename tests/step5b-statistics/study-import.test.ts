import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PublicHistory} from '../../src/session/types';
import {canonical,migrateData,publicHistory,seal,validateImportedRecords} from '../../src/storage/integrity';
import {previewPublicStudyImport,selectPublicStudyRows,type StudyImportPreview} from '../../src/storage/study-import';
const saved=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
async function source():Promise<PublicHistory>{return publicHistory((await migrateData(saved.streets.flop)).hands);}

describe('M09 explicit partial recovery of public study imports only',()=>{
 it('previews a valid versioned export and preserves selected original records/hashes without financial effects',async()=>{
  const data=await migrateData(saved.streets.flop),before=canonical(data),history=await publicHistory(data.hands),original=canonical(history);
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview).toMatchObject({validCount:3,invalidCount:0,totalRows:3,requiresExplicitSelection:true});
  const chosen=selectPublicStudyRows(preview,[2,0]);expect(chosen).toEqual([history.hands[0],history.hands[2]]);expect(chosen[1].previousHash).toBe(history.hands[2].previousHash);await validateImportedRecords(chosen);
  expect(canonical(data)).toBe(before);expect(canonical(history)).toBe(original);expect(preview.disclosure).toContain('never credit bankroll');
 });
 it('recovers two independently valid rows around one corrupted result and reports the rejected row and missing predecessor explicitly',async()=>{
  const history=await source(),original=structuredClone(history.hands);history.hands[1].net+=1;
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview.rows.map(row=>row.status)).toEqual(['VALID','INVALID','VALID']);expect(preview).toMatchObject({validCount:2,invalidCount:1});
  expect(preview.rows[1].errors.join(' ')).toContain('integrity');expect(preview.rows[2].warnings.join(' ')).toContain('preceding source row was rejected');
  expect(selectPublicStudyRows(preview,[0,2])).toEqual([original[0],original[2]]);expect(()=>selectPublicStudyRows(preview,[1])).toThrow('verified');
 });
 it('does not rewrite a broken source chain or silently accept reordered records',async()=>{
  const history=await source();[history.hands[0],history.hands[1]]=[history.hands[1],history.hands[0]];
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview.validCount).toBe(0);expect(preview.rows.every(row=>row.errors.some(error=>error.includes('chain')))).toBe(true);
  expect(()=>selectPublicStudyRows(preview,[0])).toThrow();
 });
 it('excludes every duplicate identity, while allowing unrelated verified rows to be explicitly selected',async()=>{
  const history=await source();history.hands.push(structuredClone(history.hands[0]));
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview.rows.map(row=>row.status)).toEqual(['INVALID','VALID','VALID','INVALID']);
  expect(preview.rows[0].errors.join(' ')).toContain('Duplicate');expect(preview.rows[3].errors.join(' ')).toContain('Duplicate');expect(selectPublicStudyRows(preview,[1,2])).toEqual(history.hands.slice(1,3));
 });
 it('rejects privately annotated or prematurely revealing rows even when an author recomputes hashes',async()=>{
  for(const attack of ['private-key','premature-hole','invalid-policy','unknown-field'] as const){
   const history=await source(),row=history.hands[1];
   if(attack==='private-key')Object.assign(row,{privateProfiles:{secret:'AsKh'}});
   if(attack==='premature-hole')row.frames.find(frame=>frame.street!=='complete')!.seats.find(seat=>seat.id!==0)!.hole=['As','Kh'];
   if(attack==='invalid-policy')row.policyVersions=['<script>alert(1)</script>'];
   if(attack==='unknown-field')Object.assign(row,{html:'<img onerror=alert(1)>'});
   history.hands[1]=await seal(row);history.hands[2]=await seal({...history.hands[2],previousHash:history.hands[1].hash});
   const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview.rows[1].status,attack).toBe('INVALID');expect(preview.rows[2].status,attack).toBe('VALID');
   expect(JSON.stringify(preview)).not.toMatch(/AsKh|alert\(1\)|privateProfiles|onerror/);expect(()=>selectPublicStudyRows(preview,[1])).toThrow();
  }
 });
 it('rejects malformed rows and a dependent broken link, without inventing data from them',async()=>{
  const history=await source();history.hands[1]=null as unknown as typeof history.hands[number];
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(preview.rows.map(row=>row.status)).toEqual(['VALID','INVALID','INVALID']);expect(preview.rows[1].handId).toBeNull();expect(preview.rows[1].errors).toEqual(['A public hand must be an object.']);
 });
 it.each(['{broken','{"format":"ai-texas-hold-em-public-history","version":"0.3.0","hands":['])('fails closed on broken JSON instead of speculative salvage: %s',async text=>{
  await expect(previewPublicStudyImport(text)).rejects.toThrow('Invalid JSON');
 });
 it.each([
  {format:'ai-texas-hold-em-private-device',version:2,data:saved.streets.flop},
  {format:'ai-texas-hold-em-public-history',version:'99',disclosure:'future',hands:[]},
  {format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'masquerade',hands:[],schemaVersion:4,ledger:[]},
  {format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'private-envelope',hands:[],deck:['As']},
 ])('refuses private financial saves, future versions and unsupported envelope metadata',async payload=>{
  await expect(previewPublicStudyImport(JSON.stringify(payload))).rejects.toThrow(/Unsupported public history/);
 });
 it('never auto-imports an empty or entirely invalid file and requires explicit nonempty unique valid selections',async()=>{
  const empty=await previewPublicStudyImport(JSON.stringify({format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'empty',hands:[]}));expect(empty.validCount).toBe(0);expect(()=>selectPublicStudyRows(empty,[])).toThrow();
  const preview=await previewPublicStudyImport(JSON.stringify(await source()));for(const indices of [[],[0,0],[-1],[3],[0.5]])expect(()=>selectPublicStudyRows(preview,indices)).toThrow();
 });
 it('cannot trust a forged/serialized preview or mutate a prior review through returned selections',async()=>{
  const history=await source(),preview=await previewPublicStudyImport(JSON.stringify(history));expect(Object.isFrozen(preview)).toBe(true);expect(Object.isFrozen(preview.rows[0].errors)).toBe(true);
  expect(()=>selectPublicStudyRows(structuredClone(preview),[0])).toThrow('Review');expect(()=>selectPublicStudyRows({} as StudyImportPreview,[0])).toThrow('unverified');
  const first=selectPublicStudyRows(preview,[0]);first[0].net=999;first[0].frames=[];expect(selectPublicStudyRows(preview,[0])).toEqual([history.hands[0]]);
 });
 it('retains legitimate unknown policy-version labels as historical text and never loads a policy from an import',async()=>{
  const history=await source();history.hands=[await seal({...history.hands[0],policyVersions:['synthetic-cash-99.0.0']})];
  const preview=await previewPublicStudyImport(JSON.stringify(history));expect(selectPublicStudyRows(preview,[0])[0].policyVersions).toEqual(['synthetic-cash-99.0.0']);
 });
 it('enforces byte/file and row limits before expensive validation',async()=>{
  await expect(previewPublicStudyImport('x'.repeat(10_000_001))).rejects.toThrow('10 MB');
  await expect(previewPublicStudyImport(JSON.stringify({format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'large',hands:Array(10001).fill(null)}))).rejects.toThrow('Unsupported');
 });
});
