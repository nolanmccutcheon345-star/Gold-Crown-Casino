/** Separate transactional tournament database; never opens the cash save. */
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {canonical} from '../storage/integrity';
import {validateTournamentData,sealTournamentArchives,auditTournamentData,demand,type TournamentData,type TournamentEvent,type TournamentPort} from './runtime';
import {deepFreeze,type MttBlock} from './mtt-event';
interface Envelope {format:'tournament-checkpoint-1';revision:number;payload:TournamentData;hash:string;}
export interface TournamentArchive {format:'tournament-archive-1';id:string;hash:string;event:TournamentEvent;}
interface ArchiveRef {id:string;hash:string;}
export interface TournamentCheckpoint {format:'tournament-checkpoint-2';revision:number;payload:Omit<TournamentData,'completed'>&{completed:ArchiveRef[]};hash:string;}
const digest=(value:unknown)=>bytesToHex(sha256(new TextEncoder().encode(canonical(value))));
const archiveCache=new WeakMap<TournamentEvent,TournamentArchive>();
/** A sealed block of a running multi-table event's other-table hands: stored and hashed once, like an archive. */
export interface TournamentBlockRecord {format:'tournament-block-1';id:string;hash:string;block:MttBlock;}
const blockCache=new WeakMap<MttBlock,TournamentBlockRecord>();
function blockRecord(block:MttBlock):TournamentBlockRecord {let record=blockCache.get(block);if(!record){record=Object.freeze({format:'tournament-block-1' as const,id:block.id,hash:digest(block),block});blockCache.set(block,record);}return record;}
/* The active event as stored in the per-action checkpoint: sealed blocks replaced by references. */
function withBlockRefs(event:TournamentEvent|null):TournamentEvent|null {return event?.mtt?{...event,mtt:{...event.mtt,blocks:event.mtt.blocks.map(block=>{const {id,hash}=blockRecord(block);return {id,hash};}) as unknown as MttBlock[]}}:event;}
function withBlocks(event:TournamentEvent|null,blocks:ReadonlyMap<string,TournamentBlockRecord>):void {
 if(!event?.mtt)return;
 event.mtt.blocks=(event.mtt.blocks as unknown as {id:string;hash:string}[]).map(ref=>{const record=blocks.get(ref.id);demand(record&&record.format==='tournament-block-1'&&record.id===ref.id&&record.block.id===ref.id&&record.hash===ref.hash&&digest(record.block)===ref.hash,'Missing, corrupted or mismatched block of tournament hands');const block=deepFreeze(structuredClone(record!.block));blockCache.set(block,Object.freeze({...record!,block}));return block;});
}
export class TournamentConflictError extends Error {constructor(){super('Another tab changed this tournament. Reload to view its committed state.');}}
const integrityMessage='Tournament save integrity could not be verified. Data was preserved. A verified previous snapshot can be exported for repair; it is never silently restored because it may predate an acknowledged action or payout.';
/** Legacy standalone envelope remains available for migration fixtures and explicit portable backups. */
export function encodeTournament(data:TournamentData):Envelope {validateTournamentData(data);const payload=structuredClone(data);return{format:'tournament-checkpoint-1',revision:data.revision,payload,hash:digest(payload)};}
export function decodeTournament(value:unknown):TournamentData {
 const envelope=value as Envelope;if(!envelope||envelope.format!=='tournament-checkpoint-1'||envelope.revision!==envelope.payload?.revision||envelope.hash!==digest(envelope.payload))throw Error(integrityMessage);
 validateTournamentData(envelope.payload);return structuredClone(envelope.payload);
}
/** Full immutable event bodies are hashed once. Every financial ledger and active event remains in the per-action checkpoint. */
export function encodeTournamentCheckpoint(data:TournamentData):{checkpoint:TournamentCheckpoint;archives:TournamentArchive[];blocks:TournamentBlockRecord[]} {
 sealTournamentArchives(data);
 const archives=data.completed.map(event=>{let archive=archiveCache.get(event);if(!archive){archive=Object.freeze({format:'tournament-archive-1' as const,id:event.id,hash:digest(event),event});archiveCache.set(event,archive);}return archive;});
 const blocks=(data.active?.mtt?.blocks??[]).map(blockRecord);
 const payload={...structuredClone({...data,active:withBlockRefs(data.active),completed:[]}),completed:archives.map(({id,hash})=>({id,hash}))};
 return {checkpoint:{format:'tournament-checkpoint-2',revision:data.revision,payload,hash:digest(payload)},archives,blocks};
}
function checkedCheckpoint(value:unknown):TournamentCheckpoint {
 const c=value as TournamentCheckpoint;demand(c&&c.format==='tournament-checkpoint-2'&&c.revision===c.payload?.revision&&c.hash===digest(c.payload),integrityMessage);
 demand(Array.isArray(c.payload.completed)&&new Set(c.payload.completed.map(ref=>ref.id)).size===c.payload.completed.length,'Missing or duplicate tournament archive references');
 for(const ref of c.payload.completed)demand(typeof ref.id==='string'&&typeof ref.hash==='string'&&/^[a-f0-9]{64}$/.test(ref.hash),'Invalid tournament archive reference');return c;
}
export function restoreTournamentCheckpoint(value:unknown,archives:ReadonlyMap<string,TournamentArchive>,blocks:ReadonlyMap<string,TournamentBlockRecord>=new Map()):TournamentData {
 if((value as Envelope)?.format==='tournament-checkpoint-1'){const legacy=decodeTournament(value);sealTournamentArchives(legacy);return legacy;}
 const c=checkedCheckpoint(value),completed=c.payload.completed.map(ref=>{const record=archives.get(ref.id);demand(record&&record.format==='tournament-archive-1'&&record.id===ref.id&&record.event.id===ref.id&&record.hash===ref.hash&&digest(record.event)===ref.hash,'Missing, corrupted or mismatched tournament archive');return structuredClone(record.event);});
 const data={...structuredClone(c.payload),completed};withBlocks(data.active,blocks);sealTournamentArchives(data);return data;
}
function checkTransition(current:unknown,next:TournamentCheckpoint,expected:number|null):void {
 const c=current as Envelope|TournamentCheckpoint|undefined;demand(next.revision===(expected??-1)+1,'Invalid tournament commit sequence');
 if((c?.revision??null)!==expected)throw new TournamentConflictError();
 if(!c)return;
 const prior=c.format==='tournament-checkpoint-1'?decodeTournament(c).completed.map(event=>({id:event.id,hash:digest(event)})):checkedCheckpoint(c).payload.completed;
 demand(next.payload.completed.length>=prior.length&&prior.every((ref,index)=>ref.id===next.payload.completed[index].id&&ref.hash===next.payload.completed[index].hash),'Archived tournament removal, reordering or replacement is forbidden');
}
export class TournamentPersistence implements TournamentPort {
 private db:IDBDatabase|null=null;
 constructor(readonly databaseName='poker-night-ai-tournament-guest'){if(!databaseName||databaseName==='ai-texas-hold-em')throw Error('A separate tournament database is required.');}
 private async open(){if(this.db)return this.db;return await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(this.databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('committed');request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close the other tournament tab before opening this save.'));request.onsuccess=()=>{this.db=request.result;this.db.onversionchange=()=>{this.db?.close();this.db=null;};resolve(this.db);};});}
 private async read(key:'current'|'previous'):Promise<TournamentData|null>{const db=await this.open();return await new Promise((resolve,reject)=>{const tx=db.transaction('committed','readonly'),store=tx.objectStore('committed'),request=store.get(key),archives=new Map<string,TournamentArchive>(),blocks=new Map<string,TournamentBlockRecord>();let value:unknown;let failure:unknown;
 request.onsuccess=()=>{try{value=request.result;if(value&&(value as TournamentCheckpoint).format==='tournament-checkpoint-2'){const c=checkedCheckpoint(value);for(const ref of c.payload.completed){const read=store.get(`archive:${ref.id}`);read.onsuccess=()=>archives.set(ref.id,read.result);}for(const ref of (c.payload.active?.mtt?.blocks??[]) as unknown as {id:string}[]){const read=store.get(`block:${ref.id}`);read.onsuccess=()=>blocks.set(ref.id,read.result);}}}catch(error){failure=error;tx.abort();}};
 tx.oncomplete=()=>{try{resolve(value===undefined?null:restoreTournamentCheckpoint(value,archives,blocks));}catch(error){reject(error);}};tx.onabort=()=>reject(failure??tx.error);tx.onerror=()=>reject(tx.error);});}
 load(){return this.read('current');}
 async recoveryBackup(){const data=await this.read('previous');if(data)auditTournamentData(data);return data;}
 async commit(expected:number|null,data:TournamentData):Promise<void>{const {checkpoint:next,archives,blocks}=encodeTournamentCheckpoint(data),db=await this.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('committed','readwrite'),store=tx.objectStore('committed'),request=store.get('current');let failure:unknown;
 request.onsuccess=()=>{try{const current=request.result as Envelope|TournamentCheckpoint|undefined;checkTransition(current,next,expected);
  const priorIds=new Set(current?.format==='tournament-checkpoint-2'?current.payload.completed.map(ref=>ref.id):[]);
  for(const archive of archives)if(!priorIds.has(archive.id)){const lookup=store.get(`archive:${archive.id}`);lookup.onsuccess=()=>{try{const existing=lookup.result as TournamentArchive|undefined;demand(!existing||existing.hash===archive.hash&&digest(existing.event)===archive.hash,'Conflicting tournament archive record');if(!existing)store.put(archive,`archive:${archive.id}`);}catch(error){failure=error;tx.abort();}};}
  for(const record of blocks){const lookup=store.get(`block:${record.id}`);lookup.onsuccess=()=>{try{const existing=lookup.result as TournamentBlockRecord|undefined;demand(!existing||existing.hash===record.hash,'Conflicting block of tournament hands');if(!existing)store.put(record,`block:${record.id}`);}catch(error){failure=error;tx.abort();}};}
  if(current){store.put(current,'previous');if(current.format==='tournament-checkpoint-1')store.put(current,'pre-archive-migration');}store.put(next,'current');
 }catch(error){failure=error;tx.abort();}};
 tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??Error('Tournament storage write interrupted. The previous commitment is unchanged.'));tx.onerror=()=>{failure??=tx.error;};});}
 close(){this.db?.close();this.db=null;}
}
/** Deterministic memory adapter uses the same checkpoint/archive and CAS rules. */
export class MemoryTournamentPersistence implements TournamentPort {
 private envelope:Envelope|TournamentCheckpoint|null=null;private previous:Envelope|TournamentCheckpoint|null=null;private archives=new Map<string,TournamentArchive>();private blocks=new Map<string,TournamentBlockRecord>();
 async load(){return this.envelope?restoreTournamentCheckpoint(this.envelope,this.archives,this.blocks):null;}
 async recoveryBackup(){const data=this.previous?restoreTournamentCheckpoint(this.previous,this.archives,this.blocks):null;if(data)auditTournamentData(data);return data;}
 async commit(expected:number|null,data:TournamentData){const {checkpoint,archives,blocks}=encodeTournamentCheckpoint(data);for(const record of blocks){const existing=this.blocks.get(record.id);demand(!existing||existing.hash===record.hash,'Conflicting block of tournament hands');}for(const record of blocks)if(!this.blocks.has(record.id))this.blocks.set(record.id,record);checkTransition(this.envelope??undefined,checkpoint,expected);for(const archive of archives){const existing=this.archives.get(archive.id);demand(!existing||existing.hash===archive.hash,'Conflicting tournament archive record');if(!existing)this.archives.set(archive.id,archive);}this.previous=this.envelope;this.envelope=checkpoint;}
 close(){}
}
