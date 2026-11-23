import {describe,expect,it} from 'vitest';
import {assertErasureMarker,erasePracticeStore,ERASURE_KEY,PracticeDataDeletedError,type ErasureMarker} from '../../src/storage/erasure';

/** Asynchronous atomic transaction reference. Browser/IndexedDB multi-tab
 * verification is separate; this is not represented as a browser test. */
function reference(initial:Map<string,unknown>){
 const records=new Map(structuredClone(initial)),fault={put:''};
 const db={transaction(){const draft=new Map(structuredClone(records));let pending=0,aborted=false,done=false;
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;abort:()=>void;objectStore:()=>unknown}={oncomplete:null,onabort:null,onerror:null,abort(){if(aborted||done)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:()=>store};
  const finish=()=>{if(!pending&&!aborted&&!done){done=true;records.clear();for(const [key,value] of draft)records.set(key,value);tx.oncomplete?.();}};
  const store={get(key:string){pending++;const req:{result:unknown;onsuccess:(()=>void)|null}={result:undefined,onsuccess:null};queueMicrotask(()=>{if(aborted)return;req.result=structuredClone(draft.get(key));req.onsuccess?.();pending--;queueMicrotask(finish);});return req;},clear(){draft.clear();},put(value:unknown,key:string){draft.set(key,structuredClone(value));if(fault.put===key){fault.put='';tx.abort();}}};return tx;
 }};
 return{db:db as unknown as IDBDatabase,records,fault};
}
const marker=():ErasureMarker=>({format:'ai-texas-hold-em-erasure',version:1,id:'erasure-test-unique',erasedAt:'2026-11-01T00:00:00.000Z'});
function setup(){return reference(new Map<string,unknown>([['current',{checksum:'expected',data:{revision:42,active:null}}],['previous',{privateCards:['As','Ah']}],['pre-migration-v3',{privateCards:['Ks','Kh']}],['pre-segment-v1',{wallet:99999}],['segment:hands:0',{privateCards:['Qs','Qh']}],['segment:ledger:0',{amount:5555}],['lease',{owner:'current-tab',expires:Date.now()+12000}]]));}
const request=()=>({owner:'current-tab',expectedRevision:42,expectedChecksum:'expected',marker:marker()});
describe('Owned atomic deletion of all guest snapshots (M12)',()=>{
 it('removes current, previous, migration copies and segments, retaining only a nonpersonal marker and lease',async()=>{
  const store=setup();expect(await erasePracticeStore(store.db,request())).toEqual(marker());
  expect([...store.records.keys()].sort()).toEqual(['erasure','lease']);
  expect(store.records.get(ERASURE_KEY)).toEqual(marker());
  expect(JSON.stringify([...store.records])).not.toMatch(/privateCards|wallet|5555|99999/);
 });
 it.each(['erasure','lease'])('an abort while writing %s rolls back the preceding clear and every write',async key=>{
  const store=setup(),before=structuredClone(store.records);store.fault.put=key;
  await expect(erasePracticeStore(store.db,request())).rejects.toThrow('did not commit');expect(store.records).toEqual(before);
  await erasePracticeStore(store.db,request());expect(store.records.size).toBe(2);
 });
 it.each(['owner','revision','checksum','active'] as const)('refuses %s mismatch without changing any byte',async kind=>{
  const store=setup(),input=request();if(kind==='owner')input.owner='stale-tab';if(kind==='revision')input.expectedRevision--;if(kind==='checksum')input.expectedChecksum='different';
  if(kind==='active')store.records.set('current',{checksum:'expected',data:{revision:42,active:{game:{street:'complete'}}}});
  const before=structuredClone(store.records);await expect(erasePracticeStore(store.db,input)).rejects.toThrow();expect(store.records).toEqual(before);
 });
 it('treats a completed-but-seated table as active until legitimate cashout',async()=>{
  const store=setup();store.records.set('current',{checksum:'expected',data:{revision:42,active:{game:{street:'complete',stack:30000}}}});
  await expect(erasePracticeStore(store.db,request())).rejects.toThrow('End and cash out');
 });
 it('fences a repeated deletion attempt with an explicit typed deleted error',async()=>{
  const store=setup();await erasePracticeStore(store.db,request());const before=structuredClone(store.records);
  await expect(erasePracticeStore(store.db,request())).rejects.toBeInstanceOf(PracticeDataDeletedError);expect(store.records).toEqual(before);
 });
 it('does not overwrite an unknown future erasure format',async()=>{
  const store=setup();store.records.set(ERASURE_KEY,{...marker(),version:99});const before=structuredClone(store.records);
  await expect(erasePracticeStore(store.db,request())).rejects.toThrow('Unrecognized deletion marker');expect(store.records).toEqual(before);
 });
 it('rejects personal fields or malformed markers',()=>{
  expect(()=>assertErasureMarker({...marker(),cards:['As']})).toThrow();
  expect(()=>assertErasureMarker({...marker(),erasedAt:'not-a-date'})).toThrow();
  expect(()=>assertErasureMarker({...marker(),id:''})).toThrow();
 });
});
