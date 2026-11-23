import {BrowserPersistence} from '../../src/storage/browser';
import {timed} from '../../src/performance/timing';

/** Asynchronous request/transaction reference backed by immutable JSON strings.
 * Calls the real BrowserPersistence methods, but is not a browser/IndexedDB
 * durability, scheduling, cross-tab, or disk-performance implementation. Reads
 * parse fresh objects; key inventory never reads/parses historical bodies. */
export function serializedIDB(records:Map<string,string>,read?:(bytes:number,records:number)=>void){
 const metrics={transactions:0,readRecords:0,readBytes:0,keyInventories:0,puts:0,deletes:0,recoveryDeletes:0};
 Object.defineProperty(globalThis,'IDBKeyRange',{configurable:true,value:{bound:(lower:string,upper:string)=>({lower,upper})}});
 const db={close(){},transaction:(_store:string,mode='readonly')=>{
  metrics.transactions++;const writes=new Map<string,string|undefined>();let pending=0,aborted=false,completed=false;
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;error:Error|null;abort:()=>void;objectStore:()=>unknown}={oncomplete:null,onabort:null,onerror:null,error:null,
   abort(){if(aborted||completed)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:()=>store};
  const complete=()=>{if(!pending&&!aborted&&!completed){completed=true;if(mode==='readwrite')for(const [key,value]of writes){if(value===undefined){records.delete(key);metrics.deletes++;if(key.startsWith('recovery-v1:'))metrics.recoveryDeletes++;}else{records.set(key,value);metrics.puts++;}}tx.oncomplete?.();}};
  const request=(work:()=>unknown)=>{pending++;const req:{result:unknown;error:Error|null;onsuccess:(()=>void)|null;onerror:(()=>void)|null}={result:undefined,error:null,onsuccess:null,onerror:null};
   queueMicrotask(()=>{if(aborted)return;try{req.result=work();req.onsuccess?.();}catch(error){req.error=error as Error;tx.error=error as Error;req.onerror?.();tx.abort();}finally{pending--;queueMicrotask(complete);}});return req;};
  const store={
   count(){return request(()=>{const keys=new Set(records.keys());for(const [key,value]of writes){if(value===undefined)keys.delete(key);else keys.add(key);}return keys.size;});},
   get(key:string){return request(()=>timed('profile.idbReadParse',()=>{const text=writes.has(key)?writes.get(key):records.get(key);metrics.readRecords++;const bytes=text===undefined?0:Buffer.byteLength(text);metrics.readBytes+=bytes;read?.(bytes,1);return text===undefined?undefined:JSON.parse(text);}));},
   getAllKeys(range?:{lower:string;upper:string}){return request(()=>timed('profile.idbKeyInventory',()=>{metrics.keyInventories++;const keys=new Set(records.keys());for(const [key,value]of writes){if(value===undefined)keys.delete(key);else keys.add(key);}return [...keys].filter(key=>!range||key>=range.lower&&key<=range.upper).sort();}));},
   put(value:unknown,key:string){if(mode!=='readwrite')throw Error('Readonly serialized reference');return timed('profile.idbSerializeWrite',()=>{writes.set(key,JSON.stringify(value));queueMicrotask(complete);return {} as IDBRequest;});},
   delete(key:string){if(mode!=='readwrite')throw Error('Readonly serialized reference');writes.set(key,undefined);queueMicrotask(complete);return {} as IDBRequest;},
  };
  queueMicrotask(complete);return tx;
 }};
 let instance=0;
 return{metrics,db:db as unknown as IDBDatabase,attach(){const owner=`step5e-profile-${++instance}`;records.set('lease',JSON.stringify({owner,expires:Date.now()+12000}));const port=new BrowserPersistence('ai-texas-step5e-profile');Object.assign(port,{db,owner,writable:true});return port;}};
}
