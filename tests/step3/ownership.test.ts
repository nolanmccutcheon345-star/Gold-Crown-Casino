import { describe, expect, it } from 'vitest';
import { BrowserPersistence } from '../../src/storage/browser';
import type { AppData } from '../../src/session/types';
import {digest} from '../../src/storage/integrity';

/** Minimal asynchronous IndexedDB transaction reference; writes publish only on
 * completion, abort discards all candidate writes. Actual IndexedDB stays browser QA. */
function transactionalStore(initial:Map<string,unknown>){
 const records=new Map(initial);
 const db={transaction:()=>{
  const draft=new Map(records);let pending=0,aborted=false,completed=false;
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;error:Error|null;abort:()=>void;objectStore:()=>unknown}={
   oncomplete:null,onabort:null,onerror:null,error:null,
   abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:()=>store,
  };
  const complete=()=>{if(!pending&&!aborted&&!completed){completed=true;records.clear();for(const [key,value] of draft)records.set(key,value);tx.oncomplete?.();}};
  const store={get(key:string){
   pending++;const req:{result:unknown;onsuccess:(()=>void)|null}={result:undefined,onsuccess:null};
   queueMicrotask(()=>{if(aborted)return;req.result=draft.get(key);req.onsuccess?.();pending--;queueMicrotask(complete);});return req;
  },put(value:unknown,key:string){draft.set(key,structuredClone(value));}};
  return tx;
 }};
 return {records,db:db as unknown as IDBDatabase};
}
function data(revision:number):AppData{return {schemaVersion:4,revision,epoch:0,wallet:0,initialBankroll:0,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};}
async function setup(owner='writer-A',expires=Date.now()+12000){
 // Ownership assertions require a valid legacy envelope now that migration
 // authenticates its preserved backup before any transactional publication.
 const saved=data(0),prior={format:'ai-texas-hold-em-private-device',version:1,data:saved,checksum:await digest(saved)};
 const fake=transactionalStore(new Map<string,unknown>([['current',prior],['lease',{owner,expires}]]));
 const port=new BrowserPersistence();const internals=port as unknown as {db:IDBDatabase;owner:string};internals.db=fake.db;internals.owner='writer-A';port.writable=true;
 return {port,...fake,prior};
}
describe('Step 3 asynchronous writer fencing',()=>{
 it('renews its own expired lease in the commit transaction when no other writer acquired it',async()=>{
  const {port,records}=await setup('writer-A',Date.now()-60000);await port.commit(0,data(1));
  expect((records.get('current') as {data:AppData}).data.revision).toBe(1);
  expect(records.get('lease')).toMatchObject({owner:'writer-A'});expect((records.get('lease') as {expires:number}).expires).toBeGreaterThan(Date.now());
 });
 it('rejects a stale writer after another owner acquired the lease, even if its in-memory writable flag is stale',async()=>{
  const {port,records,prior}=await setup('writer-B');await expect(port.commit(0,data(1))).rejects.toThrow(/another tab|ownership/i);
  expect(records.get('current')).toEqual(prior);expect(port.writable).toBe(false);expect(records.has('previous')).toBe(false);
 });
 it('rejects a stale revision before changing either snapshot or writer lease',async()=>{
  const {port,records,prior}=await setup();const lease=structuredClone(records.get('lease'));await expect(port.commit(99,data(100))).rejects.toThrow(/revision changed/i);
  expect(records.get('current')).toEqual(prior);expect(records.get('lease')).toEqual(lease);expect(records.has('previous')).toBe(false);
 });
});
