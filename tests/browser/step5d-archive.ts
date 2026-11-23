import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {mountApp} from '../../src/ui/app';
import {digest} from '../../src/storage/integrity';
import {segmentKey,type StoredSegment,type SegmentedEnvelope} from '../../src/storage/segments';
import {GateMemoryPort} from './step5b-gates-fixtures';
import type {AppData} from '../../src/session/types';

const prefix='ai-texas-step5d-archive-',root=document.querySelector<HTMLElement>('#archive-app')!,button=document.querySelector<HTMLButtonElement>('#archive-run')!,status=document.querySelector<HTMLElement>('#archive-status')!,result=document.querySelector<HTMLElement>('#archive-result')!,output=document.querySelector<HTMLTextAreaElement>('#archive-evidence')!;
const assert=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(test:()=>boolean,message:string){const deadline=performance.now()+20000;while(!test()){if(performance.now()>deadline)throw Error(message);await delay(10);}}
function get<T extends HTMLElement=HTMLElement>(selector:string):T {const value=root.querySelector<T>(selector);if(!value)throw Error('Missing '+selector);return value;}
function click(selector:string){const element=get<HTMLButtonElement>(selector);assert(!element.disabled,'Disabled '+selector);element.click();}
async function open(name:string):Promise<IDBDatabase>{
 assert(name.startsWith(prefix)&&name.length>prefix.length,'Only an explicitly named isolated QA database is allowed');
 return new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function entries(name:string):Promise<[string,unknown][]> {
 const db=await open(name);try{return await new Promise((resolve,reject)=>{const rows:[string,unknown][]=[],tx=db.transaction('kv','readonly'),request=tx.objectStore('kv').openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(cursor.key!=='lease')rows.push([String(cursor.key),cursor.value]);cursor.continue();}};tx.oncomplete=()=>resolve(rows);tx.onabort=()=>reject(tx.error??Error('QA read interrupted'));});}finally{db.close();}
}
async function replace(name:string,key:string,value:unknown):Promise<void>{
 const db=await open(name);try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('QA write interrupted'));});}finally{db.close();}
}
async function cleanup(name:string):Promise<void>{
 assert(name.startsWith(prefix)&&name.length>prefix.length,'Refusing unrelated cleanup');
 await new Promise<void>((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('Isolated database cleanup remained blocked')),5000),request=indexedDB.deleteDatabase(name);request.onsuccess=()=>{clearTimeout(deadline);resolve();};request.onerror=()=>{clearTimeout(deadline);reject(request.error);};request.onblocked=()=>{/* Await native close, never report requested deletion as completed. */};});
}
function summary(data:AppData){
 const table=data.ledger.reduce((sum,event)=>sum+event.tableDelta,0),poker=data.ledger.reduce((sum,event)=>sum+event.pokerNet,0);
 assert(data.wallet===data.ledger.reduce((sum,event)=>sum+event.walletDelta,0),'Wallet independent replay differs');
 assert(poker===data.hands.reduce((sum,hand)=>sum+hand.net,0),'Hand result/ledger replay differs');
 assert(data.hands.every(hand=>data.ledger.filter(event=>event.kind==='hand-net'&&event.handId===hand.id).length===1),'A hand has missing/duplicate settlement');
 return{revision:data.revision,wallet:data.wallet,table,poker,hands:data.hands.length,handIds:data.hands.map(hand=>hand.id),ledgerEvents:data.ledger.length,ledgerTail:data.ledger.at(-1)?.hash,active:!!data.active};
}

button.onclick=async()=>{
 button.disabled=true;const name=`${prefix}${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,checks:{name:string;status:'PASS'|'FAIL';evidence?:unknown;error?:string}[]=[],controllers:SessionController[]=[],opened=new Set<IDBDatabase>();
 const nativeOpen=indexedDB.open;indexedDB.open=function(databaseName,version){const request=nativeOpen.call(indexedDB,databaseName,version);if(databaseName===name)request.addEventListener('success',()=>opened.add(request.result));return request;};
 const record=async(label:string,work:()=>Promise<unknown>)=>{status.textContent=label;try{const evidence=await work();checks.push({name:label,status:'PASS',evidence});result.textContent=JSON.stringify(checks,null,2);}catch(error){checks.push({name:label,status:'FAIL',error:String(error)});throw error;}};
 let failed:unknown=null,cleaned=false;
 try{
  const seed=new SessionController(new GateMemoryPort());controllers.push(seed);await seed.init();
  const settings={...DEFAULT_SETTINGS,seats:2,capacity:2,buyIn:20000};
  await seed.startSession(settings);let game=seed.data!.active!.game;await seed.act({type:'fold'},game.handId,game.revision);await seed.cashOut();await seed.startSession(settings);assert(seed.error==='',seed.error);const seeded=structuredClone(seed.data!);seed.close();
  const port=new BrowserPersistence(name);await port.load();await port.commit(null,seeded);await port.optimizeStorage();
  const controller=new SessionController(port);controllers.push(controller);mountApp(root,controller);
  await waitFor(()=>controller.status==='ready'&&!controller.busy&&!!root.querySelector('#fold'),'Native fixture did not recover');
  await record('Packed recovery distinguishes verified current state from unaudited retained copy',async()=>{
   click('[data-view="cashier"]');const text=get('[data-testid="archive-audit-status"]').textContent??'';
   const rows=Object.fromEntries(await entries(name)),manifest=rows.current as SegmentedEnvelope;
   assert(!!manifest.packedHands&&controller.canAuditArchive,'Fixture has no actual packed representation/audit capability');
   assert(controller.archiveAuditStatus==='not-audited'&&text.includes('current save passed recovery verification')&&text.includes('not yet been checked'),'UI conflated current verification with separate retained-copy audit');
   return{...summary(controller.data!),status:controller.archiveAuditStatus,text,packedCount:manifest.packedHands!.count};
  });
  await record('Active table blocks full copy audit in both interface and public controller',async()=>{
   const before=await digest(controller.data),bytes=await digest(await entries(name));assert(get<HTMLButtonElement>('#audit-archive').disabled,'Active hand exposes audit button');
   let refusal='';try{await controller.auditSavedArchive();}catch(error){refusal=String(error);}
   assert(/End and cash out/.test(refusal),'Controller did not independently refuse active-table audit');
   assert(await digest(controller.data)===before&&await digest(await entries(name))===bytes,'Refused audit changed saved data');return{refusal,unchangedDataSHA256:before,unchangedStorageSHA256:bytes};
  });
  await record('Legal fold and ordinary cashier cashout enable the check exactly once',async()=>{
   click('[data-view="live"]');game=controller.data!.active!.game;const priorHands=controller.data!.hands.length;click('#fold');await waitFor(()=>controller.data?.active?.game.street==='complete'&&!controller.busy,'UI fold did not settle');
   click('[data-view="cashier"]');assert(get<HTMLButtonElement>('#audit-archive').disabled,'Completed but seated table must remain blocked');click('#cashout');await waitFor(()=>!controller.data?.active&&!controller.busy&&!!root.querySelector('#audit-archive')&&!get<HTMLButtonElement>('#audit-archive').disabled,'UI cashout did not enable retained check');
   assert(controller.data!.hands.length===priorHands+1,'Fold did not create exactly one hand');assert(controller.data!.ledger.filter(event=>event.kind==='cash-out').length===2,'Cashout count differs from two legal sessions');return summary(controller.data!);
  });
  await record('Actual full retained-copy audit preserves bankroll, revision and every non-lease durable byte',async()=>{
   const before=await digest(controller.data),bytes=await digest(await entries(name)),identity=summary(controller.data!);click('#audit-archive');
   await waitFor(()=>!controller.busy&&!get<HTMLButtonElement>('#audit-archive').disabled&&(get('#archive-audit-notice').textContent??'').startsWith('Verified '),'Full audit did not produce a completed UI result');
   assert(controller.archiveAuditStatus==='verified','Public audit result was not verified');assert(await digest(controller.data)===before&&await digest(await entries(name))===bytes,'Full audit changed canonical state or durable bytes');
   return{...identity,status:controller.archiveAuditStatus,notice:get('#archive-audit-notice').textContent,dataSHA256:before,storageSHA256:bytes};
  });
  const key=segmentKey('hands',0),original=Object.fromEntries(await entries(name))[key] as StoredSegment,damaged=structuredClone(original);(damaged.value as {net:number}).net+=1;await replace(name,key,damaged);
  await record('Valid packed state remains recoverable while redundant canonical copy is damaged',async()=>{
   const before=await digest(controller.data),bytes=await digest(await entries(name));await controller.retry();assert(controller.status==='ready'&&!controller.error,'Verified packed current save was incorrectly reset or blocked');
   assert(controller.archiveAuditStatus==='not-audited','Recovered packed current save was falsely labeled copy-audited');assert(await digest(controller.data)===before&&await digest(await entries(name))===bytes,'Reload silently repaired, reset or overwrote the damaged copy');
   return{...summary(controller.data!),status:controller.archiveAuditStatus,text:get('[data-testid="archive-audit-status"]').textContent,unchangedDataSHA256:before,damagedStorageSHA256:bytes};
  });
  await record('Full check detects retained-copy corruption without reset, payout or overwritten records',async()=>{
   const before=await digest(controller.data),bytes=await digest(await entries(name));click('#audit-archive');
   await waitFor(()=>!controller.busy&&!get<HTMLButtonElement>('#audit-archive').disabled&&(get('#archive-audit-notice').textContent??'').includes('did not complete'),'Corrupt archive did not produce a non-destructive failure message');
   assert(controller.archiveAuditStatus==='failed'&&controller.status==='ready','Copy failure must remain distinct from already-verified current wallet');
   assert((get('[data-testid="archive-audit-status"]').textContent??'').includes('failed verification'),'Visible copy-failure state missing');
   assert(await digest(controller.data)===before&&await digest(await entries(name))===bytes,'Audit failure reset or overwrote stored data');
   return{...summary(controller.data!),status:controller.archiveAuditStatus,notice:get('#archive-audit-notice').textContent,diagnostics:controller.recoveryDiagnostics,dataSHA256:before,damagedStorageSHA256:bytes};
  });
  await replace(name,key,original);
  await record('Explicit isolated-fixture repair can be independently rechecked without changing current state',async()=>{
   const before=await digest(controller.data),bytes=await digest(await entries(name));click('#audit-archive');await waitFor(()=>!controller.busy&&!get<HTMLButtonElement>('#audit-archive').disabled&&(get('#archive-audit-notice').textContent??'').startsWith('Verified '),'Restored exact retained record did not reverify');
   assert(controller.archiveAuditStatus==='verified'&&await digest(controller.data)===before&&await digest(await entries(name))===bytes,'Recheck changed current state');return{...summary(controller.data!),status:controller.archiveAuditStatus,dataSHA256:before,restoredStorageSHA256:bytes,repairScope:'Only this named synthetic QA copy was restored by the test; no production repair feature is claimed'};
  });
 }catch(error){failed=String(error);}finally{
  for(const controller of controllers)controller.close();for(const db of opened)db.close();indexedDB.open=nativeOpen;
  try{await cleanup(name);cleaned=true;}catch(error){failed??=String(error);}
  const report={status:failed?'FAIL':'PASS',at:new Date().toISOString(),browser:navigator.userAgent,database:name,productionDatabaseAccessed:false,storage:'Actual native IndexedDB; corruption confined to newly named synthetic QA save',checks,passed:checks.filter(check=>check.status==='PASS').length,total:checks.length,cleanupConfirmed:cleaned,error:failed,limitations:['Programmatic actual UI actions, not trusted keyboard or screen-reader evidence','Not a physical iPhone/OS interruption test','No real user save was migrated or repaired']};
  status.textContent=report.status;result.textContent=JSON.stringify(report,null,2);output.value=JSON.stringify(report,null,2);button.disabled=false;
 }
};
