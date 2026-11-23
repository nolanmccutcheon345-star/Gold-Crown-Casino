/** Test-only real IndexedDB staging. Not imported by the production application. */
import { BrowserPersistence } from '../../src/storage/browser';
import { SessionController } from '../../src/session/controller';
import { canonical, digest } from '../../src/storage/integrity';
import { newHandId } from '../../src/identity';
import type { AppData } from '../../src/session/types';
import type { AppData as OldData } from '../step36/frozen-v3/src/session/types';
import { migrateData as previousReader } from '../step36/frozen-v3/src/storage/integrity';
import { applyCommand as previousApplyCommand } from '../step36/frozen-v3/src/core/engine';

type Street='preflop'|'flop'|'turn'|'river';
type Envelope={format:'ai-texas-hold-em-private-device';version:1;data:OldData|AppData;checksum:string};
type Fixtures={sourceCommit:string;streets:Record<Street,OldData>};
type Records=Record<string,Envelope|undefined>;
type Result={street:Street;status:'PASS'|'FAIL';database:string;cloneDatabase:string;checks:Record<string,boolean>;proof:Record<string,unknown>;failure?:string};
const PREFIX='ai-texas-hold-em-test-migration-';
const streets:Street[]=['preflop','flop','turn','river'];
const keys=['current','previous','pre-migration-v3','staging-before'];
const output=document.querySelector<HTMLPreElement>('#migration-report')!;
const progress=document.querySelector<HTMLElement>('#migration-progress')!;
const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')];
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
function assertStaging(name:string){assert(name.startsWith(PREFIX)&&name.length>PREFIX.length,'Refused non-staging database name');}
function adapter(name:string){assertStaging(name);return new BrowserPersistence(name);}
async function openDatabase(name:string):Promise<IDBDatabase>{
 assertStaging(name);return new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('kv'))request.result.createObjectStore('kv');};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Staging database open failed'));
  request.onblocked=()=>reject(new Error('Staging database open blocked'));
 });
}
async function seed(name:string,envelope:Envelope){
 const db=await openDatabase(name);
 try{await new Promise<void>((resolve,reject)=>{
  const transaction=db.transaction('kv','readwrite');const store=transaction.objectStore('kv');const request=store.get('current');
  request.onsuccess=()=>{if(request.result){transaction.abort();return;}store.put(structuredClone(envelope),'current');store.put(structuredClone(envelope),'staging-before');};
  transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(new Error('Staging seed refused or interrupted'));transaction.onerror=()=>{};
 });}finally{db.close();}
}
async function read(name:string):Promise<Records>{
 const db=await openDatabase(name);
 try{return await new Promise<Records>((resolve,reject)=>{
  const transaction=db.transaction('kv','readonly');const store=transaction.objectStore('kv');const result:Records={};
  for(const key of keys){const request=store.get(key);request.onsuccess=()=>{result[key]=request.result;};}
  transaction.oncomplete=()=>resolve(result);transaction.onabort=()=>reject(new Error('Staging snapshot read interrupted'));transaction.onerror=()=>{};
 });}finally{db.close();}
}
async function release(port:BrowserPersistence,name:string){port.close();await read(name);}
function same(a:unknown,b:unknown){return canonical(a)===canonical(b);}
function check(result:Result,name:string,ok:unknown){result.checks[name]=!!ok;assert(ok,`Failed check: ${name}`);}
function summaries(data:AppData){
 const hero=data.active!.game.seats.find(s=>s.id===0)!;
 return {walletCents:data.wallet,tableAssetsCents:hero.stack+hero.totalCommitted,heroStackCents:hero.stack,
  handCount:data.hands.length,ledgerCount:data.ledger.length,sessionCount:data.sessions.length,studyCount:data.importedHands.length,
  settlements:data.ledger.filter(e=>e.kind==='hand-net').length,pokerNetCents:data.hands.reduce((n,h)=>n+h.net,0),rakeCents:data.hands.reduce((n,h)=>n+h.view.rake,0)};
}
async function runStreet(street:Street,runId:string,fixtures:Fixtures):Promise<Result>{
 const name=`${PREFIX}${runId}-${street}`;const cloneName=`${name}-restored-clone`;
 const result:Result={street,status:'FAIL',database:name,cloneDatabase:cloneName,checks:{},proof:{}};
 let port:BrowserPersistence|null=null;let clone:BrowserPersistence|null=null;let controller:SessionController|null=null;
 try{
  const source=structuredClone(fixtures.streets[street]);const sourceBytes=canonical(source);
  const before:Envelope={format:'ai-texas-hold-em-private-device',version:1,data:source,checksum:await digest(source)};
  await seed(name,before);const seeded=await read(name);
  check(result,'beforeSnapshotStored',same(seeded.current,before)&&same(seeded['staging-before'],before));
  check(result,'oldReaderAcceptsBefore',same(await previousReader(seeded.current!.data),source));
  port=adapter(name);const upgraded=await port.load();assert(upgraded,'No upgraded snapshot returned');
  check(result,'upgradeOwnedAndCommitted',port.writable&&upgraded.schemaVersion===4&&upgraded.revision===source.revision+1);
  check(result,'allFieldsPreserved',same(upgraded,{...source,schemaVersion:4,revision:source.revision+1,active:{...source.active!,exitMode:null}}));
  const migrated=await read(name);
  check(result,'atomicBackupMatchesBefore',same(migrated.previous,before)&&same(migrated['pre-migration-v3'],before)&&same(migrated['staging-before'],before));
  check(result,'currentChecksumValid',migrated.current!.checksum===await digest(migrated.current!.data));
  check(result,'walletAndRecordsReconcile',upgraded.wallet===190000&&upgraded.hands.length===3&&upgraded.ledger.reduce((n,e)=>n+e.pokerNet,0)===150);
  const beforeOldRead=canonical(migrated);let oldRejected=false;
  try{await previousReader(migrated.current!.data);}catch(error){oldRejected=/Unknown saved-data version/.test((error as Error).message);}
  check(result,'actualOldReaderRefusesVersion4',oldRejected);
  check(result,'oldReaderChangedNoSavedBytes',canonical(await read(name))===beforeOldRead);
  await release(port,name);port=adapter(name);const reopened=await port.load();
  check(result,'closeReopenRestoresExactState',port.writable&&same(reopened,upgraded));
  check(result,'noSecondMigration',same((await read(name)).current,migrated.current));

  const backup=migrated['pre-migration-v3']!;await seed(cloneName,backup);
  check(result,'clonedBackupOpensWithOldReader',same(await previousReader((await read(cloneName)).current!.data),source));
  clone=adapter(cloneName);const restored=await clone.load();
  check(result,'cloneRestorationReconcilesExactly',clone.writable&&same(restored,upgraded));
  await release(clone,cloneName);clone=null;

  controller=new SessionController(port);await controller.init();
  check(result,'controllerResumesMigration',controller.status==='ready'&&same(controller.data,upgraded));
  const pending=source.active!.pending!;assert(pending.decision,'Fixture has no sealed decision');
  const expected=previousApplyCommand(source.active!.game,pending.decision);
  await controller.commitBot(pending.handId,pending.revision);
  check(result,'pendingDecisionCommitsExactlyOnce',controller.status==='ready'&&!controller.error&&same(controller.data!.active!.game,expected)&&controller.data!.active!.game.events.filter(e=>e.decisionId===pending.decisionId).length===1);
  const afterAction=structuredClone(controller.data!);controller.close();controller=null;await read(name);
  port=adapter(name);controller=new SessionController(port);await controller.init();
  check(result,'actionReloadRestoresExactState',controller.status==='ready'&&same(controller.data,afterAction));
  await controller.commitBot(pending.handId,pending.revision);
  check(result,'staleActionCannotCommitAgain',same(controller.data,afterAction)&&same((await read(name)).current!.data,afterAction));
  check(result,'historicalMoneyAndHashesUnchanged',same(afterAction.ledger,source.ledger)&&same(afterAction.hands,source.hands)&&afterAction.wallet===source.wallet);
  check(result,'sourceFixtureNeverMutated',canonical(source)===sourceBytes);
  result.proof={sourceCommit:fixtures.sourceCommit,beforeChecksum:before.checksum,migratedChecksum:migrated.current!.checksum,
   backupChecksum:backup.checksum,restoredChecksum:(await read(cloneName)).current!.checksum,
   beforeGameHash:await digest(source.active!.game),resumedGameHash:await digest(upgraded.active!.game),
   pendingHash:await digest(source.active!.pending),resumedPendingHash:await digest(upgraded.active!.pending),
   afterActionGameHash:await digest(afterAction.active!.game),finalChecksum:(await read(name)).current!.checksum,
   fromVersion:3,toVersion:4,fromRevision:source.revision,toRevision:upgraded.revision,afterActionRevision:afterAction.revision,
   ...summaries(afterAction)};
  result.status='PASS';
 }catch(error){result.failure=(error as Error).message;}
 finally{controller?.close();port?.close();clone?.close();}
 return result;
}
async function run(selected:Street[]){
 buttons.forEach(button=>{button.disabled=true;});const runId=newHandId();const results:Result[]=[];
 const render=(status:string)=>{output.dataset.status=status;output.textContent=JSON.stringify({status,runId,completed:results.length,total:selected.length,results},null,2);};
 try{
  render('RUNNING');const response=await fetch(new URL('../step36/fixtures/populated-v3.json',import.meta.url));assert(response.ok,'Fixture fetch failed');
  const fixtures=await response.json() as Fixtures;
  for(const street of selected){progress.textContent=`Verifying ${street} in isolated staging databases…`;results.push(await runStreet(street,runId,fixtures));render('RUNNING');}
  const status=results.every(result=>result.status==='PASS')?'PASS':'FAIL';render(status);progress.textContent=`${status}: ${results.filter(result=>result.status==='PASS').length}/${selected.length} street scenarios. Production database untouched.`;
 }catch(error){output.dataset.status='FAIL';output.textContent=JSON.stringify({status:'FAIL',failure:(error as Error).message,results},null,2);progress.textContent='Staging run failed; inspect the report.';}
 finally{buttons.forEach(button=>{button.disabled=false;});}
}
document.querySelector('#run-migration-all')!.addEventListener('click',()=>{void run(streets);});
for(const button of buttons.filter(button=>button.dataset.street))button.addEventListener('click',()=>{void run([button.dataset.street as Street]);});
