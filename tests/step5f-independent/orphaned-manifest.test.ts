import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
import {referenceEncode,referenceFinancial,financialInput} from '../step5e-independent/financial-reference';
import {PRE_UPGRADE_KEY} from '../../src/storage/rollback';

const owner='independent-step5f-orphan';
function attach(db:IDBDatabase){const port=new BrowserPersistence('ai-texas-step5f-independent');Object.assign(port,{db,owner,writable:true});return port;}
function evidence(name:string,value:unknown){const output=process.env.STEP5F_INDEPENDENT_EVIDENCE;if(!output)return;mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`${name}.json`),JSON.stringify(value,null,2)+'\n');}
async function deleteCurrent(db:IDBDatabase){await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite'),store=tx.objectStore('kv');store.delete('current');store.put({owner,expires:Date.now()+12000},'lease');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}
async function transaction(db:IDBDatabase,action:(store:IDBObjectStore)=>void){await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');action(tx.objectStore('kv'));tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}
async function populated(){
 const store=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]]));
 const c=new SessionController(attach(store.db));await c.init();await c.adjustBankroll(12345678,'Distinct independent baseline');
 await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();
 expect(c.error).toBe('');expect(c.data!.hands).toHaveLength(1);const expected=referenceFinancial(financialInput(c.data!));c.close();
 return{...store,expected};
}

describe('Step5F independent partial-storage deletion boundary',()=>{
 it('refuses a missing current manifest while canonical financial/history records remain',async()=>{
  const s=await populated();await deleteCurrent(s.db);const before=referenceEncode([...s.records]);const port=attach(s.db);
  let observed:unknown=null,error:string|null=null;try{observed=await port.load();}catch(e){error=String(e);}
  evidence('missing-current-load',{expected:'Error, preserve all remaining records; never report an orphaned account as a new guest',observed:{returnedNull:observed===null,error,remainingRecords:s.records.size,storageChanged:referenceEncode([...s.records])!==before},priorFinancial:s.expected});
  try{expect(error).not.toBeNull();expect(referenceEncode([...s.records])).toBe(before);}finally{port.close();}
 });
 it('never initializes a new bankroll over an orphaned existing account',async()=>{
  const s=await populated();await deleteCurrent(s.db);const before=referenceEncode([...s.records]);const c=new SessionController(attach(s.db));
  try{await c.init();evidence('missing-current-controller',{expected:'Error state with no initialized bankroll and unchanged surviving records',observed:{status:c.status,error:c.error,wallet:c.data?.wallet??null,hands:c.data?.hands.length??null,storageChanged:referenceEncode([...s.records])!==before},priorFinancial:s.expected});
   expect(c.status).toBe('error');expect(c.data).toBeNull();expect(referenceEncode([...s.records])).toBe(before);
  }finally{c.close();}
 });
 for(const key of [PRE_UPGRADE_KEY,'unrecognized-future-checkpoint'])it(`preserves an orphaned ${key} even without recognizable current financial segments`,async()=>{
  const s=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}],[key,{opaque:'retain exactly; no automatic rollback'}]]));const before=referenceEncode([...s.records]);const c=new SessionController(attach(s.db));
  try{await c.init();expect(c.status).toBe('error');expect(c.data).toBeNull();expect(c.error).toMatch(/manifest.*missing/i);expect(referenceEncode([...s.records])).toBe(before);}finally{c.close();}
 });
 for(const badCurrent of [null,false,0,'',undefined])it(`rejects a present but invalid current value ${String(badCurrent)} without replacing it`,async()=>{
  const s=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}],['current',badCurrent]]));const before=referenceEncode([...s.records]);const c=new SessionController(attach(s.db));
  try{await c.init();expect(c.status).toBe('error');expect(c.data).toBeNull();expect(referenceEncode([...s.records])).toBe(before);}finally{c.close();}
 });
 it('rechecks emptiness atomically if a surviving record appears after the initial empty load',async()=>{
  const s=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]]));let afterInjection='';
  class RacedPersistence extends BrowserPersistence{
   override async load(){const value=await super.load();expect(value).toBeNull();await transaction(s.db,store=>store.put({opaque:'not owned by this fresh account'},PRE_UPGRADE_KEY));afterInjection=referenceEncode([...s.records]);return value;}
  }
  const port=new RacedPersistence('ai-texas-step5f-race');Object.assign(port,{db:s.db,owner,writable:true});const c=new SessionController(port);
  try{await c.init();expect(c.status).toBe('error');expect(c.data).toBeNull();expect(c.error).toMatch(/manifest.*missing/i);expect(referenceEncode([...s.records])).toBe(afterInjection);expect(s.records.has('current')).toBe(false);}finally{c.close();}
 });
 it('documents complete origin deletion as absent local recovery, never recovery of the previous wallet',async()=>{
  const s=await populated();await transaction(s.db,store=>{store.clear();store.put({owner,expires:Date.now()+12000},'lease');});const port=attach(s.db),c=new SessionController(port);
  try{
   await expect(port.inspectUpgradeBackup()).rejects.toThrow(/backup.*unavailable/i);await c.init();expect(c.status).toBe('ready');expect(c.data!.wallet).toBe(1000000);expect(c.data!.hands).toHaveLength(0);expect(c.data!.wallet).not.toBe(s.expected.wallet);
   evidence('whole-origin-deletion',{priorFinancial:s.expected,afterDeletion:referenceFinancial(financialInput(c.data!)),limitation:'With every canonical record, checkpoint, erasure marker and same-origin backup removed, the application cannot reconstruct the prior account. This is a fresh account, not data recovery. Ordinary study import cannot credit or restore a wallet.'});
  }finally{c.close();}
 });
});
