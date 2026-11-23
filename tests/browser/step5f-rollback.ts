import type {BrowserPersistence as PersistenceClass} from '../../src/storage/browser';
import type {SessionController as ControllerClass} from '../../src/session/controller';
import type {AppData,CashSettings} from '../../src/session/types';
import {sha256} from '@noble/hashes/sha2.js';
import {verifiedRuntime,evidenceDownload} from './step5f-support';
import {appliedProvenance} from './step5e-applied-provenance';
type SessionController=ControllerClass;
type Runtime={BrowserPersistence:typeof PersistenceClass;SessionController:typeof ControllerClass;DEFAULT_SETTINGS:CashSettings;assertAccounting:typeof import('../../src/core/engine').assertAccounting;legalActions:typeof import('../../src/core/engine').legalActions;canonical:typeof import('../../src/storage/integrity').canonical;digest:typeof import('../../src/storage/integrity').digest;validateData:typeof import('../../src/storage/integrity').validateData};
const verified=await verifiedRuntime<Runtime>('candidate',false),candidateSource=verified.manifest;
const {BrowserPersistence,SessionController,DEFAULT_SETTINGS,assertAccounting,legalActions,canonical,digest,validateData}=verified.runtime;

const prefix='ai-texas-step5f-rollback-',publishedCommit='a0bfc0950771a6dc1b786e00c13be7f3485b8dcb';
const button=document.getElementById('rollback-run') as HTMLButtonElement,status=document.getElementById('rollback-status')!,result=document.getElementById('rollback-result')!,output=document.getElementById('rollback-evidence') as HTMLTextAreaElement;
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const setting=(defaults:CashSettings)=>({...defaults,seats:2,buyIn:20000});
async function open(name:string){
 check(name.startsWith(prefix)&&name!==prefix,'An explicit isolated database name is required.');
 return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function entries(name:string){
 const database=await open(name);try{return await new Promise<[string,unknown][]>((resolve,reject)=>{const rows:[string,unknown][]=[],request=database.transaction('kv','readonly').objectStore('kv').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(rows);return;}if(cursor.key!=='lease')rows.push([String(cursor.key),cursor.value]);cursor.continue();};request.onerror=()=>reject(request.error);});}finally{database.close();}
}
async function put(name:string,key:string,value:unknown){
 const database=await open(name);try{await new Promise<void>((resolve,reject)=>{const tx=database.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{database.close();}
}
async function cleanup(name:string){
 check(name.startsWith(prefix),'Refusing unrelated database cleanup.');
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated database cleanup remained blocked after five seconds.')),5000),request=indexedDB.deleteDatabase(name);request.onsuccess=()=>{clearTimeout(timer);resolve();};request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{/* Wait for native connection closure; only success confirms deletion. */};});
}
function financial(data:AppData){
 const table=data.ledger.reduce((sum,event)=>sum+event.tableDelta,0),pokerNet=data.ledger.reduce((sum,event)=>sum+event.pokerNet,0);
 check(data.wallet===data.ledger.reduce((sum,event)=>sum+event.walletDelta,0),'Wallet does not reconcile.');
 check(pokerNet===data.hands.reduce((sum,hand)=>sum+hand.net,0),'Poker results do not reconcile.');
 check(new Set(data.ledger.map(event=>event.id)).size===data.ledger.length,'Duplicate financial identity.');
 check(new Set(data.hands.map(hand=>hand.id)).size===data.hands.length,'Duplicate hand identity.');
 for(const hand of data.hands)check(data.ledger.filter(event=>event.kind==='hand-net'&&event.handId===hand.id).length===1,'Missing or duplicate hand settlement.');
 if(data.active){const game=data.active.game,hero=game.seats.find(seat=>seat.id===0)!;assertAccounting(game);check(table===hero.stack+(game.street==='complete'?0:hero.totalCommitted),'Table money does not reconcile.');}else check(table===0,'Unseated chips remain.');
 return {wallet:data.wallet,table,pokerNet,hands:data.hands.length,events:data.ledger.length,sessions:data.sessions.length,revision:data.revision,handIds:data.hands.map(hand=>hand.id),settlementIds:data.ledger.filter(event=>event.kind==='hand-net').map(event=>event.id)};
}
async function ordinaryFoldSession(controller:SessionController,defaults:CashSettings){
 await controller.startSession(setting(defaults));check(controller.error==='',controller.error);const game=controller.data!.active!.game;check(game.actor===0,'Expected Hero to open a new heads-up hand.');
 await controller.act({type:'fold'},game.handId,game.revision);check(controller.data!.active!.game.street==='complete',controller.error||'Fold did not complete.');await controller.cashOut();check(controller.error==='',controller.error);
}
async function finishHand(controller:SessionController){
 for(let attempts=0;attempts<100&&controller.data!.active!.game.street!=='complete';attempts++){
  const game=controller.data!.active!.game;
  if(game.actor===0)await controller.act(legalActions(game).check?{type:'check'}:{type:'call'},game.handId,game.revision);
  else{await controller.prepareBot();check(controller.error==='',controller.error);await controller.commitBot(game.handId,game.revision);}
  check(controller.error==='',controller.error);
 }
 check(controller.data!.active!.game.street==='complete','Hand exceeded the verification action bound.');
}

button.onclick=async()=>{
 button.disabled=true;const owned:string[]=[],controllers:SessionController[]=[],checks:{name:string;status:'PASS'|'FAIL';evidence?:unknown;error?:string;appliedProvenance?:ReturnType<typeof appliedProvenance>;inputProvenance?:ReturnType<typeof appliedProvenance>|ReturnType<typeof appliedProvenance>[]}[]=[];let observedData:AppData|null=null,refusedInput:AppData|null=null;
 const name=`${prefix}${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,futureName=`${name}-future`;owned.push(name,futureName);
 // The actual frozen reader is untouched. Track only these exact QA database
 // handles so teardown can close a late/in-flight connection after controller.close.
 const opened=new Set<IDBDatabase>(),nativeOpen=indexedDB.open;
 indexedDB.open=function(databaseName,version){check(owned.includes(databaseName),'Rollback QA attempted non-isolated database');const request=nativeOpen.call(indexedDB,databaseName,version);if(owned.includes(databaseName))request.addEventListener('success',()=>opened.add(request.result));return request;};
 const record=async(label:string,work:()=>Promise<unknown>,options:{refusal?:boolean;input?:()=>AppData|null;description?:string}={})=>{status.textContent=label;const description=`Isolated ${name}; actual frozen V7/candidate/V7-R CSPRNG engine hands and unchanged test actions. ${options.description??''}`,inputProvenance=appliedProvenance(options.input?.()??observedData,label,description+' Actual verified input snapshot before check.','retained-input-only');const evidence=await work();checks.push({name:label,status:'PASS',evidence,inputProvenance,appliedProvenance:appliedProvenance(options.refusal?null:observedData,label,description+(options.refusal?' Expected refusal: reader applied no room state; retained input versions are separate.':' Actual successful observed state before controller/store cleanup.'))});result.textContent=JSON.stringify(checks,null,2);};
 let postMigrationSummary:ReturnType<typeof financial>|null=null;
 try{
  const manifest=await(await fetch('../step5b-rollback/published-v7-manifest.json')).json() as {sourceCommit:string;bundleSHA256:string;sourceFiles:Record<string,string>};
  check(manifest.sourceCommit===publishedCommit,'Frozen bundle does not identify the actual published V7 commit.');
  // Vite transforms executable .js responses. Its explicit raw-asset module
  // returns the archived file bytes as text, which must match the git-built hash.
  const rawURL='./step5b-published-v7.js?raw',raw=await import(/* @vite-ignore */rawURL) as {default:string};
  const hash=Array.from(sha256(new TextEncoder().encode(raw.default)),value=>value.toString(16).padStart(2,'0')).join('');
  check(hash===manifest.bundleSHA256,'Frozen V7 bundle differs from its source manifest.');
  const url='./step5b-published-v7.js',old=await import(/* @vite-ignore */url) as {BrowserPersistence:typeof BrowserPersistence;SessionController:typeof SessionController;DEFAULT_SETTINGS:CashSettings;POLICY_VERSION:string;supportedPolicy:(version:string)=>boolean};
  const seedPort=new old.BrowserPersistence(name),seed=new old.SessionController(seedPort);controllers.push(seed);let pre!:AppData;
  await record('Actual published V7 creates three settled hands and a pending fourth hand',async()=>{
   await seed.init();check(seed.status==='ready',seed.error);for(let hand=0;hand<3;hand++)await ordinaryFoldSession(seed,old.DEFAULT_SETTINGS);
   await seed.startSession(setting(old.DEFAULT_SETTINGS));check(seed.error==='',seed.error);const game=seed.data!.active!.game;await seed.act({type:'call'},game.handId,game.revision);await seed.prepareBot();await seed.setPaused(true);check(seed.error==='',seed.error);check(!!seed.data!.active!.pending?.decision,'Frozen published source did not create a pending decision.');
   pre=structuredClone(seed.data!);observedData=pre;const snapshot=Object.fromEntries(await entries(name));check((snapshot.current as {version:number}).version===1,'The actual V7 source did not write its original envelope.');const summary=financial(pre);seed.close();await entries(name);
   return {sourceCommit:publishedCommit,bundleSHA256:hash,compiledSourceFiles:Object.keys(manifest.sourceFiles).length,policyVersion:old.POLICY_VERSION,...summary,canonicalSHA256:await digest(pre),storageSHA256:await digest(snapshot)};
  });
  await record('Interrupted native migration rolls back backup, receipt and current atomically',async()=>{
   const originalPut=IDBObjectStore.prototype.put,before=await digest(await entries(name));let injected=false;
   IDBObjectStore.prototype.put=function(value,key){const request=originalPut.call(this,value,key);if(this.transaction.db.name===name&&key==='upgrade-v1-to-v2-receipt'&&!injected){injected=true;this.transaction.abort();}return request;};
   const interrupted=new SessionController(new BrowserPersistence(name));controllers.push(interrupted);
   try{await interrupted.init();check(injected&&interrupted.status==='error','Migration interruption did not fail closed.');check(await digest(await entries(name))===before,'Interrupted migration changed durable bytes.');}
   finally{IDBObjectStore.prototype.put=originalPut;interrupted.close();await entries(name);}
   return {injected,originalStorageSHA256:before,afterAbortSHA256:await digest(await entries(name)),noPartialBackupOrReceipt:true};
  },{refusal:true,description:'Transaction aborted during upgrade; no partial migrated game became ready.'});
  const currentPort=new BrowserPersistence(name),current=new SessionController(currentPort);controllers.push(current);
  await record('Current source migrates actual V7 data while preserving all pre-migration records and pending action',async()=>{
   await current.init();check(current.status==='ready',current.error);const data=current.data!;observedData=data;
   check(canonical(data.hands)===canonical(pre.hands),'Migration changed historical hands.');check(canonical(data.ledger)===canonical(pre.ledger),'Migration changed historical money.');check(canonical(data.active)===canonical(pre.active),'Migration changed active hand or pending decision.');check(data.wallet===pre.wallet&&data.revision===pre.revision+1,'Unexpected migration balance or revision.');
   const snapshot=Object.fromEntries(await entries(name));check((snapshot.current as {version:number}).version===2,'Migration did not write segmented format.');check(canonical((snapshot['pre-segment-v1'] as {data:AppData}).data)===canonical(pre),'Exact pre-segment backup was not retained.');await validateData(data);
   const verified=await currentPort.inspectUpgradeBackup();check(canonical(verified.snapshot)===canonical(pre),'Verified pre-upgrade backup differs.');return {migrationReceipt:verified.receipt,...financial(data),beforeHandsSHA256:await digest(pre.hands),afterHandsSHA256:await digest(data.hands),beforeLedgerSHA256:await digest(pre.ledger),afterLedgerSHA256:await digest(data.ledger)};
  });
  let post!:AppData,priorDisk!:string;
  await record('Current code appends three post-migration settlements, top-up, cashouts, adjustment and a new pending action',async()=>{
   await current.setPaused(false);await finishHand(current);await current.topUp(1000);check(current.error==='',current.error);await current.cashOut();check(current.error==='',current.error);
   for(let hand=0;hand<2;hand++)await ordinaryFoldSession(current,DEFAULT_SETTINGS);
   const profit=current.data!.ledger.reduce((sum,event)=>sum+event.pokerNet,0);await current.adjustBankroll(current.data!.wallet+777,'Isolated post-migration manual adjustment');check(current.data!.ledger.reduce((sum,event)=>sum+event.pokerNet,0)===profit,'Manual adjustment changed poker profit.');
   await current.startSession(setting(DEFAULT_SETTINGS));check(current.error==='',current.error);const game=current.data!.active!.game;await current.act({type:'call'},game.handId,game.revision);await current.prepareBot();await current.setPaused(true);check(current.error==='',current.error);
   post=structuredClone(current.data!);observedData=post;check(post.hands.length===pre.hands.length+3,'Post-migration hand count mismatch.');check(!!post.active!.pending?.decision,'Current pending decision missing.');
   check(canonical(post.hands.slice(0,pre.hands.length))===canonical(pre.hands),'New play rewrote earlier histories.');check(canonical(post.ledger.slice(0,pre.ledger.length))===canonical(pre.ledger),'New play rewrote earlier financial records.');
   await validateData(post);postMigrationSummary=financial(post);current.close();priorDisk=await digest(await entries(name));
   return {...postMigrationSummary,postMigrationHands:post.hands.length-pre.hands.length,postMigrationEvents:post.ledger.length-pre.ledger.length,canonicalSHA256:await digest(post),storageSHA256:priorDisk,pendingDecisionId:post.active!.pending!.decisionId,currentPolicy:post.active!.pending!.policyVersion,previousReleaseSupportsCurrentPolicy:old.supportedPolicy(post.active!.pending!.policyVersion)};
  });
  await record('Actual V7 downgrade refuses segmented data without deleting or resetting any record',async()=>{
   const downgrade=new old.SessionController(new old.BrowserPersistence(name));controllers.push(downgrade);await downgrade.init();check(downgrade.status==='error','Previous release unexpectedly accepted incompatible segmented storage.');check(/Unknown guest snapshot format/.test(downgrade.error),'Downgrade did not report its format incompatibility.');check(downgrade.data===null,'Downgrade invented or partially loaded guest data.');
   const after=await digest(await entries(name));check(after===priorDisk,'Previous release changed persisted current/history/segment/backup bytes.');const evidence={status:downgrade.status,reason:downgrade.error,storageBefore:priorDisk,storageAfter:after,wholeRollbackSupported:false,recordsPreserved:post.hands.length,postMigrationRecordsPreserved:post.hands.length-pre.hands.length};downgrade.close();await entries(name);return evidence;
  },{refusal:true,description:'Original V7 refuses the actual newer segmented saved state.'});
  const recoveryManifest=await(await fetch('../step5c-rollback/generated/manifest.json')).json() as {previousUICommit:string;recoveryRuntimeCommit:string;bundleSHA256:string;sourceFiles:Record<string,{origin:string;sha256:string}>};
  check(recoveryManifest.previousUICommit===publishedCommit,'Recovery UI is not pinned to published V7.');check(recoveryManifest.recoveryRuntimeCommit==='f54cacfb0aa3c861313b691e773a6716379c50a0','Recovery runtime is not pinned to tested Version8.');
  const recoveryRawURL='../step5c-rollback/generated/recovery.js?raw',recoveryRaw=await import(/* @vite-ignore */recoveryRawURL) as {default:string};
  const recoveryHash=Array.from(sha256(new TextEncoder().encode(recoveryRaw.default)),value=>value.toString(16).padStart(2,'0')).join('');check(recoveryHash===recoveryManifest.bundleSHA256,'Recovery executable differs from manifest.');
  const recoveryURL='../step5c-rollback/generated/recovery.js',compatible=await import(/* @vite-ignore */recoveryURL) as {BrowserPersistence:typeof BrowserPersistence;SessionController:typeof SessionController;mountApp:(root:HTMLElement,controller:SessionController)=>void};
  let recoveredLatest!:AppData;
  await record('V7-R compatibility release restores exact latest state and commits saved 1.6 decision once',async()=>{
   const recovery=new compatible.SessionController(new compatible.BrowserPersistence(name));controllers.push(recovery);await recovery.init();check(recovery.status==='ready',recovery.error);check(canonical(recovery.data)===canonical(post),'Current source did not restore the exact latest state.');check(await digest(await entries(name))===priorDisk,'Read-only recovery changed persisted bytes.');
   const canonicalRestored=await digest(recovery.data),pending=post.active!.pending!,g=post.active!.game;await recovery.setPaused(false);await recovery.prepareBot();check(canonical(recovery.data!.active!.pending)===canonical(pending),'Recovery resampled the pending decision.');await recovery.commitBot(g.handId,g.revision);check(recovery.error==='',recovery.error);const after=canonical(recovery.data);
   await recovery.commitBot(g.handId,g.revision);check(canonical(recovery.data)===after,'Duplicate callback changed the restored state.');check(recovery.data!.active!.game.events.filter(event=>event.decisionId===pending.decisionId).length===1,'Pending action committed more than once.');check(canonical(recovery.data!.hands.slice(0,post.hands.length))===canonical(post.hands),'Recovery changed or lost settled hands.');check(canonical(recovery.data!.ledger.slice(0,post.ledger.length))===canonical(post.ledger),'Recovery changed or lost financial records.');await validateData(recovery.data!);
   await finishHand(recovery);await recovery.cashOut();check(recovery.error==='',recovery.error);await recovery.startSession(setting(DEFAULT_SETTINGS));check(recovery.error==='',recovery.error);
   const app=document.getElementById('rollback-app')!;compatible.mountApp(app,recovery);
   const until=async(predicate:()=>boolean)=>{const end=performance.now()+10000;while(!predicate()){if(performance.now()>end)throw Error('Recovery UI did not reach expected state.');await new Promise(resolve=>setTimeout(resolve,25));}};
   await until(()=>!!app.querySelector<HTMLButtonElement>('#fold')&&!app.querySelector<HTMLButtonElement>('#fold')!.disabled);app.querySelector<HTMLButtonElement>('#fold')!.click();await until(()=>recovery.data!.active!.game.street==='complete');
   app.querySelector<HTMLButtonElement>('#new-session')!.click();await until(()=>!!app.querySelector('#end-complete'));app.querySelector<HTMLButtonElement>('#end-complete')!.click();await until(()=>recovery.data!.active===null);check(recovery.error==='',recovery.error);
   recoveredLatest=structuredClone(recovery.data!);observedData=recoveredLatest;await validateData(recoveredLatest);check(canonical(recoveredLatest.hands.slice(0,post.hands.length))===canonical(post.hands),'Recovery UI lost or modified prior histories.');check(canonical(recoveredLatest.ledger.slice(0,post.ledger.length))===canonical(post.ledger),'Recovery UI changed prior financial events.');
   const evidence={recoveryRelease:'V7-R',previousUICommit:publishedCommit,runtimeManifest:recoveryManifest,canonicalBefore:await digest(post),canonicalRestored,exactRestore:true,settlementAndActionIdempotence:true,actualUIActions:['Fold','New session','End session / cash out'],...financial(recoveredLatest)};recovery.close();await entries(name);return evidence;
  });
  await record('Candidate resumes after V7-R with all original and recovery-play records, backup still verified',async()=>{
   const port=new BrowserPersistence(name),resumed=new SessionController(port);controllers.push(resumed);await resumed.init();check(resumed.status==='ready',resumed.error);check(canonical(resumed.data)===canonical(recoveredLatest),'Candidate did not preserve recovery-play state.');const backup=await port.inspectUpgradeBackup();check(canonical(backup.snapshot)===canonical(pre),'Recovery changed the pre-upgrade backup.');const summary=financial(resumed.data!);observedData=resumed.data!;resumed.close();return {roundTripCanonicalSHA256:await digest(recoveredLatest),...summary};
  });
  await record('Actual V7 refuses unknown schema 99 without overwriting the isolated complete save',async()=>{
   const future={...structuredClone(post),schemaVersion:99};refusedInput=structuredClone(post);const envelope={format:'ai-texas-hold-em-private-device',version:1,data:future,checksum:await digest(future)};await put(futureName,'current',envelope);const before=await digest(await entries(futureName));
   const reader=new old.SessionController(new old.BrowserPersistence(futureName));controllers.push(reader);await reader.init();check(reader.status==='error'&&/Unknown saved-data version/.test(reader.error),'Unknown saved-data schema was not refused.');check(reader.data===null,'Unknown schema invented guest data.');const after=await digest(await entries(futureName));check(after===before,'Unknown-schema refusal changed durable data.');const reason=reader.error;reader.close();return {reason,storageBefore:before,storageAfter:after};
  },{refusal:true,input:()=>post,description:'Unknown schema99 fixture is the exact post-upgrade snapshot with only schemaVersion changed; reader applied no state.'});
 }catch(error){checks.push({name:status.textContent??'Suite setup',status:'FAIL',error:(error as Error).message});}
 finally{
  for(const controller of controllers)controller.close();indexedDB.open=nativeOpen;for(const database of opened)database.close();
  let deleted=0;for(const database of owned)try{await cleanup(database);deleted++;}catch(error){checks.push({name:'Isolated database cleanup',status:'FAIL',error:(error as Error).message});}
  if(deleted===owned.length)checks.push({name:'Isolated database cleanup',status:'PASS',evidence:{deletedDatabases:deleted,trackedNativeConnections:opened.size,productionDatabaseAccessed:false},appliedProvenance:appliedProvenance(null,'Isolated database cleanup','Native database cleanup executes no poker rules or bot policy.'),inputProvenance:[appliedProvenance(observedData,'Isolated database cleanup',`Verified retained state in ${name} before deletion.`,'retained-input-only'),appliedProvenance(refusedInput,'Isolated database cleanup',`Verified source snapshot for schema99 envelope in ${futureName} before deletion; schemaVersion alone was altered.`,'retained-input-only')]});
  const evidence={format:'ai-texas-step5f-native-rollback',at:new Date().toISOString(),userAgent:navigator.userAgent,candidateSource,actualPublishedSource:publishedCommit,productionDatabaseAccessed:false,actualSiteDeployment:false,checks,postMigrationSummary,z03WholeCriterion:checks.some(c=>c.status==='FAIL')?'FAIL':'COMPATIBILITY_ROLLBACK_VERIFIED',criterion:'Previous working release can be restored with preserved valid user histories and no duplicated money or orphaned event.',limitation:'Unchanged V7 remains incompatible. The verified controlled rollback is V7-R: exact V7 interface plus frozen tested Version8 reader, engine and versioned policies. It reverts Step5C runtime changes but is not unchanged Version7 or a schema downgrade and does not repair arbitrary corruption. No backup was restored over newer events.'};
  output.value=JSON.stringify(evidence,null,2);result.textContent=output.value;evidenceDownload('download','step5f-rollback.json',evidence);status.textContent=`${checks.filter(item=>item.status==='PASS').length} PASS, ${checks.filter(item=>item.status==='FAIL').length} FAIL. V7-R compatibility rollback results are above; unchanged V7 remains incompatible.`;button.disabled=false;
 }
};
