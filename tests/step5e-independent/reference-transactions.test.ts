import {describe,it,expect} from 'vitest';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';

const completed=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Aborted'));});
const result=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});

describe('Step5E record-level transaction reference isolation',()=>{
 it('clones requested read values so nested caller mutations cannot change a saved record',async()=>{
  const original={deep:{value:1}},s=idbReference(new Map([['account',original]]));original.deep.value=99;
  const tx=s.db.transaction('kv','readonly'),done=completed(tx),saved=await result(tx.objectStore('kv').get('account'));
  saved.deep.value=100;await done;expect(s.records.get('account')).toEqual({deep:{value:1}});
 });
 it('captures write bytes at the put boundary even if the caller changes its object before commit',async()=>{
  const s=idbReference(),tx=s.db.transaction('kv','readwrite'),done=completed(tx),value={deep:{value:7}};
  tx.objectStore('kv').put(value,'account');value.deep.value=80;await done;expect(s.records.get('account')).toEqual({deep:{value:7}});
 });
 it('aborts all earlier writes and deletions when a later requested write fails',async()=>{
  const s=idbReference(new Map([['account',{deep:{value:1}}],['prior',{keep:true}]]));s.fault.put='fail';
  const tx=s.db.transaction('kv','readwrite'),done=completed(tx),store=tx.objectStore('kv');store.put({deep:{value:2}},'account');store.delete('prior');store.put({value:3},'fail');
  await expect(done).rejects.toThrow(/Injected put/);expect(s.records.get('account')).toEqual({deep:{value:1}});expect(s.records.get('prior')).toEqual({keep:true});expect(s.records.has('fail')).toBe(false);
 });
 it('serializes queued readers after a committed write and rejects readonly writes',async()=>{
  const s=idbReference(new Map([['account',{value:1}]])),write=s.db.transaction('kv','readwrite'),written=completed(write);write.objectStore('kv').put({value:2},'account');
  const read=s.db.transaction('kv','readonly'),readDone=completed(read),observed=result(read.objectStore('kv').get('account'));
  expect(()=>read.objectStore('kv').put({value:999},'account')).toThrow(/ReadOnlyError/);await written;expect(await observed).toEqual({value:2});await readDone;expect(s.records.get('account')).toEqual({value:2});
 });
});
