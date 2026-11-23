/** Asynchronous transaction reference, not a browser implementation. Every
 * readwrite transaction publishes its draft atomically or publishes nothing. */
export function transactionReference(initial:Map<string,unknown>){
 const records=new Map(structuredClone(initial));
 const control={abortOnPutKey:null as string|null};
 const db={transaction:(_store:string,mode='readonly')=>{
  const draft=new Map(structuredClone(records));let pending=0,aborted=false,completed=false;
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;error:Error|null;abort:()=>void;objectStore:()=>unknown}={
   oncomplete:null,onabort:null,onerror:null,error:null,
   abort(){if(aborted||completed)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:()=>store,
  };
  const complete=()=>{if(!pending&&!aborted&&!completed){completed=true;if(mode==='readwrite'){records.clear();for(const [key,value] of draft)records.set(key,value);}tx.oncomplete?.();}};
  const store={count(){
   pending++;const req:{result:number;onsuccess:(()=>void)|null;onerror:(()=>void)|null}={result:0,onsuccess:null,onerror:null};
   queueMicrotask(()=>{if(aborted)return;req.result=draft.size;req.onsuccess?.();pending--;queueMicrotask(complete);});return req;
  },get(key:string){
   pending++;const req:{result:unknown;onsuccess:(()=>void)|null;onerror:(()=>void)|null}={result:undefined,onsuccess:null,onerror:null};
   queueMicrotask(()=>{if(aborted)return;req.result=structuredClone(draft.get(key));req.onsuccess?.();pending--;queueMicrotask(complete);});return req;
  },put(value:unknown,key:string){
   if(mode!=='readwrite')throw new Error('Reference readonly transaction');
   draft.set(key,structuredClone(value));if(control.abortOnPutKey===key){control.abortOnPutKey=null;tx.abort();}
  },delete(key:string){draft.delete(key);}};
  return tx;
 }};
 return {records,control,db:db as unknown as IDBDatabase};
}
