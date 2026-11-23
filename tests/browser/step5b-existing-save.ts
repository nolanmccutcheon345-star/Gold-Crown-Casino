import type { AppData, PersistencePort } from '../../src/session/types';
import { restoreSegments, type SegmentedEnvelope } from '../../src/storage/segments';

/** QA recovery reads one consistent IDB transaction. It never acquires a writer
 * lease, migrates, creates a bankroll, or opens a production namespace. */
export class ExistingQaReadOnlyPersistence implements PersistencePort {
 readonly writable=false;
 constructor(private namespace:string){
  if(!/^ai-texas-hold-em-step5b-qa-[A-Za-z0-9-]{8,100}$/.test(namespace))throw Error('Only an explicit isolated QA namespace may be recovered.');
 }
 async load():Promise<AppData>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open(this.namespace,1);
   request.onupgradeneeded=()=>{request.transaction?.abort();};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(Error('Existing QA database was not found or could not be opened. No fresh save was created.'));
   request.onblocked=()=>reject(Error('Existing QA database is blocked; no data was changed.'));
  });
  try{
   const values=await new Promise<Map<IDBValidKey,unknown>>((resolve,reject)=>{
    if(!db.objectStoreNames.contains('kv')){reject(Error('Existing QA database has no saved records.'));return;}
    const result=new Map<IDBValidKey,unknown>(),transaction=db.transaction('kv','readonly'),request=transaction.objectStore('kv').openCursor();
    request.onsuccess=()=>{const cursor=request.result;if(cursor){result.set(cursor.key,cursor.value);cursor.continue();}};
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(transaction.error??Error('Read-only QA recovery was interrupted.'));
    transaction.onerror=()=>{};
   });
   const current=values.get('current') as SegmentedEnvelope|undefined;
   if(!current||current.version!==2)throw Error('Recovery requires an existing segmented QA save. No initial bankroll or migration was performed.');
   return await restoreSegments(current,async keys=>keys.map(key=>values.get(key)));
  }finally{db.close();}
 }
 async commit():Promise<void>{throw Error('QA recovery is read-only; committing a change is forbidden.');}
 close():void{/* No persistent writer connection exists. */}
}
