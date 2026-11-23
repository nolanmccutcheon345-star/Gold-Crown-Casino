/** Asynchronous serializable IndexedDB transaction reference, not a browser.
 * Requests run FIFO, and clear/put/delete changes publish only at tx completion.
 * This exercises the production BrowserPersistence rather than a port mock. */
export function idbReference(initial:Map<string,unknown>=new Map()) {
 const records=new Map(structuredClone(initial));
 const fault={put:null as string|null,delete:null as string|null,clear:false};
 const transactions:Array<()=>void>=[];let running=false;
 const next=()=>{if(running)return;const start=transactions.shift();if(start){running=true;queueMicrotask(start);}};
 const db={close(){},transaction(_store:string,mode='readonly'){
  let draft:Map<string,unknown>,aborted=false,finished=false,started=false,scheduled=false;
  const requests:Array<()=>void>=[];
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;error:Error|null;abort:()=>void;objectStore:()=>unknown}={
   oncomplete:null,onabort:null,onerror:null,error:null,objectStore:()=>store,
   abort(){if(aborted||finished)return;aborted=true;if(started)queueMicrotask(finish);},
  };
  const finish=()=>{if(finished)return;finished=true;if(!aborted&&mode==='readwrite'){records.clear();for(const [key,value] of draft)records.set(key,value);}if(aborted)tx.onabort?.();else tx.oncomplete?.();running=false;next();};
  const pump=()=>{scheduled=false;if(finished)return;if(aborted){finish();return;}const request=requests.shift();if(request){request();schedule();}else finish();};
  const schedule=()=>{if(!started||scheduled||finished)return;scheduled=true;queueMicrotask(pump);};
  const request=(action:()=>unknown)=>{const req:{result:unknown;onsuccess:(()=>void)|null;onerror:(()=>void)|null;error:Error|null}={result:undefined,onsuccess:null,onerror:null,error:null};requests.push(()=>{try{req.result=action();if(!aborted)req.onsuccess?.();}catch(error){req.error=error as Error;tx.error=error as Error;req.onerror?.();tx.abort();}});schedule();return req;};
  const write=()=>{if(mode!=='readwrite')throw new Error('ReadOnlyError');};
  const store={
   count(){return request(()=>draft.size);},
   get(key:string){return request(()=>structuredClone(draft.get(key)));},
   put(value:unknown,key:string){write();const copy=structuredClone(value);return request(()=>{if(fault.put===key){fault.put=null;throw new Error('Injected put failure');}draft.set(key,copy);return key;});},
   delete(key:string){write();return request(()=>{if(fault.delete===key){fault.delete=null;throw new Error('Injected delete failure');}draft.delete(key);});},
   clear(){write();return request(()=>{if(fault.clear){fault.clear=false;throw new Error('Injected clear failure');}draft.clear();});},
  };
  // Transactions are serialized and every get/put already crosses its own
  // structured-clone boundary. Snapshot keys by reference rather than cloning
  // every unrequested archive/checkpoint body on every readonly transaction.
  // This models record-level IndexedDB reads while preserving abort atomicity.
  transactions.push(()=>{started=true;draft=new Map(records);schedule();});next();return tx;
 }};
 return {records,fault,db:db as unknown as IDBDatabase};
}
