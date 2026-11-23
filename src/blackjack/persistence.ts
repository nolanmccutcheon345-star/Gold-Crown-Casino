/** Isolated IndexedDB blackjack storage. All checkpoints, head anchors and new archives commit atomically. */
import {anchorFor,auditSnapshot,checkedCheckpoint,checkpoint,demand,digest,verifyTransition,type BlackjackAnchor,type BlackjackCheckpoint,type BlackjackData,type BlackjackPort,type BlackjackRecord,type BlackjackSnapshot} from './runtime';
export {BlackjackConflictError} from './runtime';
export const BLACKJACK_DATABASE='poker-night-ai-blackjack-guest';
const keyFor=(sequence:number)=>`record:${String(sequence).padStart(12,'0')}`;
export class BlackjackPersistence implements BlackjackPort {
 private db:IDBDatabase|null=null;
 constructor(readonly databaseName=BLACKJACK_DATABASE){demand(typeof databaseName==='string'&&databaseName.includes('blackjack')&&!['ai-texas-hold-em','poker-night-ai-tournament-guest'].includes(databaseName),'A separate blackjack database is required');}
 private async open():Promise<IDBDatabase>{if(this.db)return this.db;return await new Promise((resolve,reject)=>{const req=indexedDB.open(this.databaseName,1);req.onupgradeneeded=()=>req.result.createObjectStore('committed');req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Close the other blackjack tab before opening this save.'));req.onsuccess=()=>{this.db=req.result;this.db.onversionchange=()=>{this.db?.close();this.db=null;};resolve(this.db);};});}
 async snapshot(previous=false):Promise<BlackjackSnapshot|null>{const db=await this.open();const result=await new Promise<BlackjackSnapshot|null>((resolve,reject)=>{const tx=db.transaction('committed','readonly'),s=tx.objectStore('committed');let c:unknown,a:unknown,all:unknown[]=[];const cr=s.get(previous?'previous':'current'),ar=s.get(previous?'previous-anchor':'anchor'),rr=s.getAll(IDBKeyRange.bound('record:','record:\uffff'));
 cr.onsuccess=()=>{c=cr.result;};ar.onsuccess=()=>{a=ar.result;};rr.onsuccess=()=>{all=rr.result;};tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>{try{if(c===undefined){demand(a===undefined&&(previous||all.length===0),'Blackjack current checkpoint is missing. Existing records were preserved.');resolve(null);return;}demand(a!==undefined,'Blackjack committed head is missing. Data was preserved.');const checked=checkedCheckpoint(c,a);const records=all as BlackjackRecord[];resolve({checkpoint:checked,anchor:a as BlackjackAnchor,records:previous?records.filter(r=>r.sequence<=checked.payload.head.sequence):records});}catch(e){reject(e);}};});
 return result;}
 async load():Promise<BlackjackData|null>{const s=await this.snapshot();return s?auditSnapshot(s):null;}
 async commit(expected:number|null,data:BlackjackData,records:BlackjackRecord[]):Promise<void>{const next=checkpoint(data),anchor=anchorFor(next),db=await this.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('committed','readwrite'),s=tx.objectStore('committed');let failure:unknown,current:BlackjackCheckpoint|null=null,currentAnchor:unknown;const cr=s.get('current'),ar=s.get('anchor'),virgin=expected===null?s.count(IDBKeyRange.bound('record:','record:\uffff')):null;let got=0,recordCount=0;
 const ready=()=>{if(++got!==(virgin?3:2))return;try{if(current){demand(currentAnchor!==undefined,'Missing blackjack committed head');checkedCheckpoint(current,currentAnchor);}else demand(currentAnchor===undefined&&recordCount===0,'Missing blackjack current checkpoint; existing archives were preserved');verifyTransition(current,next,records,expected);
 for(const record of records){const req=s.get(keyFor(record.sequence));req.onsuccess=()=>{try{demand(req.result===undefined,'Existing blackjack archive cannot be overwritten');s.add(record,keyFor(record.sequence));}catch(e){failure=e;tx.abort();}};}
 if(current){s.put(current,'previous');s.put(currentAnchor,'previous-anchor');}s.put(next,'current');s.put(anchor,'anchor');
 }catch(e){failure=e;tx.abort();}};
 cr.onsuccess=()=>{current=cr.result??null;ready();};ar.onsuccess=()=>{currentAnchor=ar.result;ready();};if(virgin)virgin.onsuccess=()=>{recordCount=virgin.result;ready();};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??Error('Blackjack storage write interrupted. Previous committed state was preserved.'));tx.onerror=()=>{failure??=tx.error;};});}
 close(){this.db?.close();this.db=null;}
}
/** Test adapter: same hash, anchor, transition and replay boundaries without browser storage. */
export class MemoryBlackjackPersistence implements BlackjackPort {
 current:BlackjackCheckpoint|null=null;anchor:BlackjackAnchor|null=null;previous:BlackjackCheckpoint|null=null;previousAnchor:BlackjackAnchor|null=null;records=new Map<number,BlackjackRecord>();
 async snapshot(previous=false):Promise<BlackjackSnapshot|null>{const c=previous?this.previous:this.current,a=previous?this.previousAnchor:this.anchor;if(!c){demand(!a&&(previous||this.records.size===0),'Blackjack current checkpoint is missing. Existing records were preserved.');return null;}demand(a,'Blackjack committed head is missing. Data was preserved.');const snapshot={checkpoint:structuredClone(c),anchor:structuredClone(a!),records:[...this.records.values()].filter(r=>!previous||r.sequence<=c.payload.head.sequence).sort((x,y)=>x.sequence-y.sequence).map(r=>structuredClone(r))};return snapshot;}
 async load():Promise<BlackjackData|null>{const s=await this.snapshot();return s?auditSnapshot(s):null;}
 async commit(expected:number|null,data:BlackjackData,records:BlackjackRecord[]):Promise<void>{const next=checkpoint(data);if(this.current){demand(this.anchor,'Missing blackjack head');checkedCheckpoint(this.current,this.anchor);}else demand(!this.anchor&&this.records.size===0,'Missing blackjack checkpoint');verifyTransition(this.current,next,records,expected);for(const r of records)demand(!this.records.has(r.sequence),'Existing blackjack archive cannot be overwritten');this.previous=this.current;this.previousAnchor=this.anchor;for(const r of records)this.records.set(r.sequence,structuredClone(r));this.current=next;this.anchor=anchorFor(next);}
 close(){}
 /** Diagnostic payload sizes; logical JSON bytes, not browser origin usage. */
 sizes(){return{checkpoint:JSON.stringify(this.current).length,archives:[...this.records.values()].reduce((n,r)=>n+JSON.stringify(r).length,0),anchor:JSON.stringify(this.anchor).length};}
}
// Referencing digest here keeps hash implementation part of the storage module's explicit public fixture surface.
export const blackjackStorageDigest=digest;
