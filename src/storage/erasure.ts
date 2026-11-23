export const ERASURE_KEY='erasure';
export const DELETE_PRACTICE_CONFIRMATION='DELETE ALL PRACTICE DATA';
export interface ErasureMarker {format:'ai-texas-hold-em-erasure';version:1;id:string;erasedAt:string;}
export class PracticeDataDeletedError extends Error {
 readonly code='PRACTICE_DATA_DELETED';
 constructor(){super('Saved practice data was deleted. Start fresh explicitly; old pending writes cannot be resumed.');this.name='PracticeDataDeletedError';}
}
export function assertErasureMarker(value:unknown):asserts value is ErasureMarker {
 const marker=value as Partial<ErasureMarker>|null;
 if(!marker||typeof marker!=='object'||Array.isArray(marker)||marker.format!=='ai-texas-hold-em-erasure'||marker.version!==1||typeof marker.id!=='string'||!marker.id.length||marker.id.length>200||typeof marker.erasedAt!=='string'||!Number.isFinite(Date.parse(marker.erasedAt))||Object.keys(marker).some(key=>!['format','version','id','erasedAt'].includes(key)))throw new Error('Unrecognized deletion marker. Existing storage was preserved.');
}
export interface ErasureRequest {owner:string;expectedRevision:number;marker:ErasureMarker;expectedChecksum?:string;}

/** Atomically removes every snapshot, backup and segment. Caller still must
 * fence every subsequent writer against ERASURE_KEY and offer explicit restart.
 * No user records, balances, card data or history hashes survive in the marker. */
export async function erasePracticeStore(db:IDBDatabase,request:ErasureRequest):Promise<ErasureMarker> {
 assertErasureMarker(request.marker);
 if(!request.owner||!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)throw new Error('A current owned revision is required for deletion.');
 return new Promise((resolve,reject)=>{
  let tx:IDBTransaction;
  try{tx=db.transaction('kv','readwrite',{durability:'strict'});}catch{tx=db.transaction('kv','readwrite');}
  const store=tx.objectStore('kv');let reason:Error=new Error('Deletion did not commit. Existing saved data was preserved.');
  let complete=0,prior:unknown,lease:unknown,marker:unknown;
  const abort=(error:Error)=>{reason=error;tx.abort();};
  const inspect=()=>{
   if(++complete!==3)return;
   if(marker!==undefined&&marker!==null){try{assertErasureMarker(marker);}catch(error){abort(error as Error);return;}abort(new PracticeDataDeletedError());return;}
   const saved=prior as {checksum?:string;data?:{revision?:number;active?:unknown}}|undefined;
   if((lease as {owner?:string}|undefined)?.owner!==request.owner){abort(new Error('Another tab owns this session. Deletion was refused.'));return;}
   if(!saved||saved.data?.revision!==request.expectedRevision||(request.expectedChecksum!==undefined&&saved.checksum!==request.expectedChecksum)){abort(new Error('Saved revision changed in another tab. Reload before deleting data.'));return;}
   if(saved.data.active!==null){abort(new Error('End and cash out the table before deleting saved practice data.'));return;}
   store.clear();
   store.put(structuredClone(request.marker),ERASURE_KEY);
   store.put({owner:request.owner,expires:Date.now()+12000},'lease');
  };
  const current=store.get('current');current.onsuccess=()=>{prior=current.result;inspect();};
  const leaseRead=store.get('lease');leaseRead.onsuccess=()=>{lease=leaseRead.result;inspect();};
  const erased=store.get(ERASURE_KEY);erased.onsuccess=()=>{marker=erased.result;inspect();};
  tx.oncomplete=()=>resolve(structuredClone(request.marker));
  tx.onabort=()=>reject(reason);tx.onerror=()=>{};
 });
}
