import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';
interface Row {key:string;name:string;bytes:number}
/** Test-only disk string store: old fixture bodies are not retained in JS memory.
 * Existing serialized-IDB reference supplies transaction/request semantics. Disk
 * writes here are not crash-atomic or a browser durability implementation. */
export class DiskRecords {
 readonly rows:Map<string,Row>;readonly initial:{size:number;sourceRawSHA256:string;expectedWallet:number;serializedBytes:number;preparationMs:number;canonicalHandFieldValueBytes:Record<string,number>};
 private next:number;
 constructor(readonly folder:string){const input=JSON.parse(readFileSync(path.join(folder,'index.json'),'utf8'));this.rows=new Map((input.entries as Row[]).map(row=>[row.key,row]));this.initial={size:input.size,sourceRawSHA256:input.sourceRawSHA256,expectedWallet:input.expectedWallet,serializedBytes:input.serializedBytes,preparationMs:input.preparationMs,canonicalHandFieldValueBytes:input.canonicalHandFieldValueBytes};this.next=Math.max(-1,...[...this.rows.values()].map(row=>Number(row.name.split('.')[0])))+1;}
 get size(){return this.rows.size;}
 get bytes(){let n=0;for(const row of this.rows.values())n+=row.bytes;return n;}
 get(key:string):string|undefined{const row=this.rows.get(key);return row?readFileSync(path.join(this.folder,row.name),'utf8'):undefined;}
 has(key:string){return this.rows.has(key);}
 keys(){return this.rows.keys();}
 set(key:string,value:string){
  const prior=this.rows.get(key);const row={key,name:`${this.next++}.json`,bytes:Buffer.byteLength(value)};
  // Each physical filename is write-once. Avoid rewriting a mutable host file
  // hundreds of times while its backing environment may synchronize snapshots.
  writeFileSync(path.join(this.folder,row.name),value,{flag:'wx'});
  this.rows.set(key,row);if(prior)unlinkSync(path.join(this.folder,prior.name));return this;
 }
 delete(key:string){const row=this.rows.get(key);if(!row)return false;unlinkSync(path.join(this.folder,row.name));return this.rows.delete(key);}
}
