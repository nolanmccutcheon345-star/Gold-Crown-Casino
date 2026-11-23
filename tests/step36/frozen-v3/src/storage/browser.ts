import type { AppData, PersistencePort } from '../session/types';
import { digest, migrateData, requireData } from './integrity';
import { newHandId } from '../identity';
const DATABASE='ai-texas-hold-em-guest';
const LEASE_MS=12000;
function tabOwner():string{
 // Reuse only for a true reload of this browsing context. New/duplicated tabs
 // receive a fresh token; the transactional fence remains mandatory.
 const fresh=newHandId();
 try{
  const key='ai-texas-hold-em-writer';
  const reload=(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='reload';
  const prior=sessionStorage.getItem(key);const owner=reload&&prior?prior:fresh;
  sessionStorage.setItem(key,owner);return owner;
 }catch{return fresh;}
}
interface Envelope {format:'ai-texas-hold-em-private-device';version:1;data:AppData;checksum:string;}
interface Lease {owner:string;expires:number;}
/** Private device persistence, not an export format. No authentication or network. */
export class BrowserPersistence implements PersistencePort {
 private db:IDBDatabase|null=null;
 private owner=tabOwner();
 private release:(()=>void)|null=null;
 private closed=false;
 private heartbeat:ReturnType<typeof setInterval>|null=null;
 writable=false;
 persistent=false;
 async requestProtection():Promise<boolean>{
  this.persistent=await navigator.storage?.persist?.()??false;return this.persistent;
 }
 private async open():Promise<IDBDatabase>{
  if(this.db)return this.db;
  requireData(typeof indexedDB!=='undefined','Browser storage is unavailable. Enable site storage to play safely.');
  this.db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const req=indexedDB.open(DATABASE,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('kv'))req.result.createObjectStore('kv');};
   req.onerror=()=>reject(req.error??new Error('Cannot open saved guest data.'));
   req.onblocked=()=>reject(new Error('Another tab is blocking a storage upgrade. Close it and retry.'));
   req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();this.db=null;this.writable=false;};resolve(req.result);};
  });
  return this.db;
 }
 private transaction(db:IDBDatabase):IDBTransaction{
  try{return db.transaction('kv','readwrite',{durability:'strict'});}catch{return db.transaction('kv','readwrite');}
 }
 private async acquire(steal=false):Promise<void>{
  if(this.closed)throw new Error('Storage connection closed. Reload to continue.');
  if(this.writable&&!steal)return;
  if(navigator.locks){
   await new Promise<void>((resolve,reject)=>{
    void navigator.locks.request(DATABASE,steal?{steal:true}:{ifAvailable:true},async lock=>{
     this.writable=!!lock;resolve();
     if(lock)await new Promise<void>(release=>{this.release=release;});
    }).catch(reject);
   });
   if(this.writable)await this.renewLease(true,true);
  }else await this.renewLease(true,steal);
  if(this.writable&&!this.heartbeat)this.heartbeat=setInterval(()=>{void this.renewLease(false).catch(()=>{this.writable=false;});},3000);
 }
 async takeOver():Promise<void>{this.release?.();this.release=null;this.writable=false;await this.acquire(true);}
 private async renewLease(acquire:boolean,force=false):Promise<void>{
  const db=await this.open();await new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db);const store=tx.objectStore('kv');const req=store.get('lease');
   req.onsuccess=()=>{const lease=req.result as Lease|undefined;const now=Date.now();
    this.writable=force||lease?.owner===this.owner|| (!!acquire&&(!lease||lease.expires<=now));
    if(this.writable)store.put({owner:this.owner,expires:now+LEASE_MS} satisfies Lease,'lease');
   };tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Writer lease failed.'));tx.onerror=()=>{};
  });
 }
 async load():Promise<AppData|null>{
  const db=await this.open();await this.acquire();
  const result=await new Promise<Envelope|undefined>((resolve,reject)=>{const tx=db.transaction('kv','readonly');const req=tx.objectStore('kv').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  if(!result)return null;
  requireData(result.format==='ai-texas-hold-em-private-device'&&result.version===1,'Unknown guest snapshot format. Existing data was preserved.');
  requireData(result.checksum===await digest(result.data),'Saved snapshot failed its integrity check. Existing data was preserved; no bankroll was reset.');
  return migrateData(result.data);
 }
 async commit(expectedRevision:number|null,data:AppData):Promise<void>{
  requireData(this.writable,'Another tab owns this session. This tab is read-only; close the other tab and retry.');
  const envelope:Envelope={format:'ai-texas-hold-em-private-device',version:1,data:structuredClone(data),checksum:await digest(data)};
  const db=await this.open();await new Promise<void>((resolve,reject)=>{
   const tx=this.transaction(db);const store=tx.objectStore('kv');let reason='Storage write failed. The last committed game remains intact. Retry after making space.';
   const current=store.get('current');
   current.onsuccess=()=>{
    const prior=current.result as Envelope|undefined;
    if((prior?.data.revision??null)!==expectedRevision){reason='Saved revision changed in another tab. Reload the saved session before acting.';tx.abort();return;}
    const save=()=>{if(prior)store.put(prior,'previous');store.put(envelope,'current');};
    const req=store.get('lease');req.onsuccess=()=>{const lease=req.result as Lease|undefined;if(!this.writable||lease?.owner!==this.owner){this.writable=false;reason='Another tab owns this session. Retry or explicitly take over here.';tx.abort();return;}store.put({owner:this.owner,expires:Date.now()+LEASE_MS},'lease');save();};
   };
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error(reason+(tx.error?` (${tx.error.name})`:'')));tx.onerror=()=>{};
  });
 }
 close():void{
  this.closed=true;this.writable=false;if(this.heartbeat)clearInterval(this.heartbeat);
  this.release?.();this.release=null;
  if(this.db){try{const tx=this.transaction(this.db);const s=tx.objectStore('kv');const r=s.get('lease');r.onsuccess=()=>{if((r.result as Lease|undefined)?.owner===this.owner)s.delete('lease');};}catch{/* Lease expires if closing interrupted. */}}
  this.db?.close();this.db=null;
 }
}
