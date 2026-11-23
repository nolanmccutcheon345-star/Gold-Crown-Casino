import {beforeAll,describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AppData,PersistencePort,PublicHistory} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {assertAccounting} from '../../src/core/engine';
import {canonical,migrateData,publicHistory,seal,validateImportedRecords} from '../../src/storage/integrity';
import {auditSnapshot,freezeSnapshot,isVerifiedSnapshot,verifyTransition} from '../../src/storage/verified';
import {previewPublicStudyImport,type StudyImportPreview} from '../../src/storage/study-import';
import {describeHandProvenance} from '../../src/session/hand-provenance';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';

/** Independent copy/CAS boundary. No IndexedDB or production saves are touched. */
class Memory implements PersistencePort {
 data:AppData|null=null;failAfterCommit=false;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if((this.data?.revision??null)!==expected)throw Error('Revision changed');
  this.data=structuredClone(next);this.commits++;
  if(this.failAfterCommit){this.failAfterCommit=false;throw Error('Injected import acknowledgement loss');}
 }
 close(){}
}
function independentlyCanonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(independentlyCanonical).join(',')+']';
 const object=value as Record<string,unknown>;
 return '{'+Object.keys(object).filter(key=>object[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+independentlyCanonical(object[key])).join(',')+'}';
}
function independentHash(record:{hash:string}):string {
 const body={...record} as Record<string,unknown>;delete body.hash;
 return createHash('sha256').update(independentlyCanonical(body)).digest('hex');
}
function unchangedFinancialState(data:AppData):string {
 return canonical({wallet:data.wallet,initialBankroll:data.initialBankroll,epoch:data.epoch,ledger:data.ledger,hands:data.hands,sessions:data.sessions,active:data.active,stats:deriveCashStats(data.hands,data.sessions,0)});
}
async function open(data:AppData){const port=new Memory();port.data=structuredClone(data);const controller=new SessionController(port);await controller.init();expect(controller.error).toBe('');return{controller,port};}
async function errorOf(work:Promise<unknown>):Promise<string>{try{await work;return '';}catch(error){return (error as Error).message;}}
let completed:AppData,priorThirdSettlement:AppData,thirdSettlement:AppData,exported:PublicHistory;

beforeAll(async()=>{
 const port=new Memory(),controller=new SessionController(port);await controller.init();
 await controller.startSession({...DEFAULT_SETTINGS,seats:2,opponents:[{selection:'nit',personalitySeed:509017}]});
 for(let number=1;number<=3;number++){
  if(number>1)await controller.nextHand();expect(controller.error).toBe('');
  if(number===3){expect(controller.data!.active!.game.actor).toBe(0);priorThirdSettlement=controller.data!;}
  for(let action=0;controller.data!.active!.game.street!=='complete'&&action<20;action++){
   const game=controller.data!.active!.game;
   // Hero deliberately folds on a legal opportunity; bots are the actual
   // production policy, with no rigged deck or replacement decision service.
   if(game.actor===0)await controller.act({type:'fold'},game.handId,game.revision);
   else{await controller.prepareBot();await controller.commitBot(game.handId,game.revision);}
   expect(controller.error).toBe('');assertAccounting(controller.data!.active!.game);
  }
  expect(controller.data!.active!.game.street).toBe('complete');
 }
 thirdSettlement=controller.data!;expect(thirdSettlement.revision).toBe(priorThirdSettlement.revision+1);
 await controller.cashOut();expect(controller.error).toBe('');completed=controller.data!;exported=await controller.exportHistory();controller.close();
 expect(completed.hands).toHaveLength(3);expect(completed.active).toBeNull();
 await auditSnapshot(structuredClone(completed));
 const evidenceDirectory=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(evidenceDirectory,{recursive:true});
 writeFileSync(resolve(evidenceDirectory,'import-provenance-fixture.json'),JSON.stringify({
  sourceCheckpoint:'919ad82',method:'Three actual production-controller hands; Hero legal folds, real bot policy, CSPRNG deals; isolated memory port',
  handCount:3,handHashes:completed.hands.map(hand=>hand.hash),publicHashes:exported.hands.map(hand=>hand.hash),
  wallet:completed.wallet,pokerNet:completed.hands.reduce((sum,hand)=>sum+hand.net,0),
  ledgerPokerNet:completed.ledger.reduce((sum,event)=>sum+event.pokerNet,0),
  settlements:completed.ledger.filter(event=>event.kind==='hand-net').length,cashouts:completed.ledger.filter(event=>event.kind==='cash-out').length,
  hands:completed.hands.map(hand=>({id:hand.id,net:hand.net,provenance:hand.provenance,events:hand.view.events})),
 },null,2)+'\n');
});

describe('M09/X14 independent controller import and immutable-origin integration',()=>{
 it('imports only explicitly selected valid rows from a mixed corrupt file, with original hashes and zero money/stat/history changes',async()=>{
  const {controller,port}=await open(completed),before=unchangedFinancialState(controller.data!),source=structuredClone(exported);source.hands[1].net+=1;
  const preview=await previewPublicStudyImport(JSON.stringify(source));expect(preview.rows.map(row=>row.status)).toEqual(['VALID','INVALID','VALID']);
  expect(controller.data!.importedHands).toEqual([]);expect(unchangedFinancialState(controller.data!)).toBe(before);
  await controller.importSelectedStudyHands(preview,[2,0]);expect(controller.error).toBe('');
  expect(controller.data!.importedHands).toEqual([exported.hands[0],exported.hands[2]]);expect(unchangedFinancialState(controller.data!)).toBe(before);
  expect(controller.data!.importedHands.map(hand=>hand.hash)).toEqual([exported.hands[0].hash,exported.hands[2].hash]);
  await validateImportedRecords(controller.data!.importedHands);await auditSnapshot(structuredClone(controller.data!));
  await controller.importSelectedStudyHands(preview,[0,2]);expect(controller.error).toBe('');expect(controller.data!.importedHands).toHaveLength(2);expect(unchangedFinancialState(controller.data!)).toBe(before);
  controller.close();const recovered=new SessionController(port);await recovered.init();expect(recovered.error).toBe('');
  const reviewedAgain=await previewPublicStudyImport(JSON.stringify(source));await recovered.importSelectedStudyHands(reviewedAgain,[0,2]);expect(recovered.error).toBe('');
  expect(recovered.data!.importedHands).toEqual([exported.hands[0],exported.hands[2]]);expect(unchangedFinancialState(recovered.data!)).toBe(before);recovered.close();
 });
 it('rejects unselected, invalid and forged preview rows without any commit or partial insertion',async()=>{
  const {controller,port}=await open(completed),source=structuredClone(exported);source.hands[1].net++;
  const preview=await previewPublicStudyImport(JSON.stringify(source)),before=canonical(controller.data),commits=port.commits;
  for(const [review,indices]of [[preview,[]],[preview,[0,1]],[preview,[0,0]],[structuredClone(preview),[0]],[{} as StudyImportPreview,[0]]] as const){
   await controller.importSelectedStudyHands(review,indices);expect(controller.error).not.toBe('');expect(canonical(controller.data)).toBe(before);expect(port.commits).toBe(commits);
  }
  controller.close();
 });
 it('rejects a same-ID different verified public record atomically and preserves the already imported bytes',async()=>{
  const {controller}=await open(completed),first=await previewPublicStudyImport(JSON.stringify(exported));await controller.importSelectedStudyHands(first,[0]);expect(controller.error).toBe('');
  const conflict=structuredClone(exported);conflict.hands[0]=await seal({...conflict.hands[0],policyVersions:['different-historical-99.0.0']});
  for(let i=1;i<conflict.hands.length;i++)conflict.hands[i]=await seal({...conflict.hands[i],previousHash:conflict.hands[i-1].hash});
  const conflicting=await previewPublicStudyImport(JSON.stringify(conflict));expect(conflicting.validCount).toBe(3);const before=canonical(controller.data);
  await controller.importSelectedStudyHands(conflicting,[0,1]);expect(controller.error).toContain('different imported record');expect(canonical(controller.data)).toBe(before);
  expect(controller.data!.importedHands).toEqual([exported.hands[0]]);controller.close();
 });
 it('reconciles a committed import with lost acknowledgement without duplicate shelf records or any financial event',async()=>{
  const {controller,port}=await open(completed),before=unchangedFinancialState(controller.data!),preview=await previewPublicStudyImport(JSON.stringify(exported));
  port.failAfterCommit=true;await controller.importSelectedStudyHands(preview,[0,2]);expect(controller.status).toBe('error');expect(controller.data!.importedHands).toHaveLength(0);expect(port.data!.importedHands).toHaveLength(2);
  await controller.retry();expect(controller.status).toBe('ready');expect(controller.error).toBe('');expect(controller.data!.importedHands).toHaveLength(2);expect(unchangedFinancialState(controller.data!)).toBe(before);
  await controller.importSelectedStudyHands(preview,[0,2]);expect(controller.error).toBe('');expect(controller.data!.importedHands).toHaveLength(2);expect(unchangedFinancialState(controller.data!)).toBe(before);controller.close();
 });
 it('preserves an active pending bot decision across study import and later commits that original decision exactly once',async()=>{
  // Fix the clock solely to compare every session statistic byte-for-byte;
  // production card entropy and the production policy are untouched.
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now());let controller:SessionController|undefined;
  try{
   ({controller}=await open(priorThirdSettlement));const initial=controller.data!.active!.game;
   await controller.act({type:'call'},initial.handId,initial.revision);expect(controller.error).toBe('');await controller.prepareBot();expect(controller.error).toBe('');
   const pending=structuredClone(controller.data!.active!.pending!),before=unchangedFinancialState(controller.data!),preview=await previewPublicStudyImport(JSON.stringify(exported));
   expect(pending.decision).not.toBeNull();await controller.importSelectedStudyHands(preview,[0]);expect(controller.error).toBe('');expect(unchangedFinancialState(controller.data!)).toBe(before);
   expect(controller.data!.active!.pending).toEqual(pending);await controller.commitBot(pending.handId,pending.revision);expect(controller.error).toBe('');
   const committed=canonical(controller.data!.active!.game);await controller.commitBot(pending.handId,pending.revision);
   expect(canonical(controller.data!.active!.game)).toBe(committed);expect(controller.data!.active!.game.events.filter(event=>event.decisionId===pending.decisionId)).toHaveLength(1);assertAccounting(controller.data!.active!.game);
  }finally{controller?.close();clock.mockRestore();}
 });
 it('seals new ordinary cash provenance with the exact resolved rules, exports it, and changes no source bytes',async()=>{
  const original=canonical(completed.hands);
  for(const [index,hand]of completed.hands.entries()){
   expect(hand.provenance).toEqual({version:1,mode:'cash',source:'csprng',ruleset:{id:hand.view.profile.id,version:hand.view.profile.version,fingerprint:createHash('sha256').update(independentlyCanonical(hand.view.profile)).digest('hex')}});
   expect(hand.hash).toBe(independentHash(hand));expect(exported.hands[index].hash).toBe(independentHash(exported.hands[index]));expect(exported.hands[index].provenance).toEqual(hand.provenance);
   expect(Object.isFrozen(hand.provenance)).toBe(true);expect(Object.isFrozen(hand.provenance!.ruleset)).toBe(true);
  }
  expect(canonical(completed.hands)).toBe(original);expect(completed.wallet).toBe(1000000+completed.hands.reduce((sum,hand)=>sum+hand.net,0));
  expect(new CashStatsProjection().derive(completed.hands,completed.sessions,0)).toEqual(deriveCashStats(completed.hands,completed.sessions,0));
 });
 it('leaves populated legacy records and hashes unchanged instead of fabricating historical CSPRNG provenance',async()=>{
  const saved=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>},before=canonical(saved.streets.flop.hands);
  const legacy=await migrateData(saved.streets.flop);await auditSnapshot(legacy);expect(canonical(legacy.hands)).toBe(before);
  for(const hand of legacy.hands){expect(hand.provenance).toBeUndefined();expect(describeHandProvenance(hand,'cash')).toMatchObject({originStatus:'legacy-unknown',source:'legacy-unknown'});}
  const history=await publicHistory(legacy.hands);expect(history.hands.every(hand=>hand.provenance===undefined)).toBe(true);expect(canonical(legacy.hands)).toBe(before);
 });
 it('accepts a validated lab-origin public replay only into study, never into bankroll or ordinary cash statistics',async()=>{
  const {controller}=await open(completed),before=unchangedFinancialState(controller.data!),source=structuredClone(exported);source.hands=source.hands.slice(0,1);
  source.hands[0]=await seal({...source.hands[0],provenance:{...source.hands[0].provenance!,mode:'lab',source:'fixed-deck'}});
  const preview=await previewPublicStudyImport(JSON.stringify(source));expect(preview.validCount).toBe(1);await controller.importSelectedStudyHands(preview,[0]);expect(controller.error).toBe('');
  expect(controller.data!.importedHands).toEqual(source.hands);expect(unchangedFinancialState(controller.data!)).toBe(before);
  expect(describeHandProvenance(controller.data!.importedHands[0],'imported')).toMatchObject({namespace:'imported',mode:'study',source:'replay-import',financiallyEligible:false});
  await auditSnapshot(structuredClone(controller.data!));controller.close();
 });
 it('rejects a freshly resealed lab-origin settlement in both full and actual appended-prefix incremental audits',async()=>{
  const last=thirdSettlement.hands.at(-1)!;
  const lab=await seal({...structuredClone(last),provenance:{...last.provenance!,mode:'lab' as const,source:'fixed-deck' as const}});
  expect(lab.hash).toBe(independentHash(lab));const malicious={...thirdSettlement,hands:[...thirdSettlement.hands.slice(0,-1),lab]};
  expect(malicious.hands[0]).toBe(priorThirdSettlement.hands[0]);expect(malicious.revision).toBe(priorThirdSettlement.revision+1);
  expect(await errorOf(auditSnapshot(structuredClone(malicious)))).toContain('Lab/fixed-deck');expect(await errorOf(verifyTransition(priorThirdSettlement,malicious))).toContain('Lab/fixed-deck');expect(isVerifiedSnapshot(malicious)).toBe(false);
  const projection=new CashStatsProjection(),before=projection.derive(priorThirdSettlement.hands,priorThirdSettlement.sessions,0);
  expect(()=>projection.derive(freezeSnapshot(malicious.hands),malicious.sessions,0)).toThrow('Lab/fixed-deck');expect(projection.derive(priorThirdSettlement.hands,priorThirdSettlement.sessions,0)).toEqual(before);
  const defensiveFull=deriveCashStats(malicious.hands,malicious.sessions,0);expect(defensiveFull.hands).toBe(2);expect(defensiveFull.profit).toBe(malicious.hands.slice(0,2).reduce((sum,hand)=>sum+hand.net,0));
  expect(new CashStatsProjection().derive(thirdSettlement.hands,thirdSettlement.sessions,0).hands).toBe(3);
 });
 it.each(['version','mode/source','rules-id','rules-fingerprint','replay-profile'] as const)('rejects resealed invalid provenance %s before public study admission',async attack=>{
  const source=structuredClone(exported);source.hands=source.hands.slice(0,1);const hand=source.hands[0],origin=hand.provenance!;
  if(attack==='version')origin.version=2 as 1;
  if(attack==='mode/source')origin.source='fixed-deck';
  if(attack==='rules-id')origin.ruleset.id='unrelated-rules';
  if(attack==='rules-fingerprint')origin.ruleset.fingerprint='0'.repeat(64);
  if(attack==='replay-profile')hand.frames[0].profile.rake.cap++;
  source.hands[0]=await seal(hand);const preview=await previewPublicStudyImport(JSON.stringify(source));expect(preview.validCount).toBe(0);expect(preview.rows[0].errors.join(' ')).toMatch(/provenance|ruleset/);
 });
});
