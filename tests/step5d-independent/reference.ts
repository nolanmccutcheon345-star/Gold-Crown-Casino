import {createHash} from 'node:crypto';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SEGMENTS,segmentKey,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';

/** Independent serialization/hash oracle: no production digest/canonical imports. */
export function encode(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(encode).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+encode(v)).join(',')+'}';
 return JSON.stringify(value);
}
export const hash=(value:unknown)=>createHash('sha256').update(encode(value)).digest('hex');
export function resealManifest(envelope:SegmentedEnvelope):void {
 const body={...envelope} as Partial<SegmentedEnvelope>;delete body.checksum;envelope.checksum=hash(body);
}
/** Outer wrappers may be valid while an inner canonical financial event is not. */
export function resealTransport(envelope:SegmentedEnvelope,records:Map<string,StoredSegment>):void {
 for(const name of SEGMENTS){let previous='0'.repeat(64);
  for(let i=0;i<envelope.segments[name].count;i++){
   const entry=records.get(segmentKey(name,i))!;entry.index=i;entry.previousHash=previous;
   entry.hash=hash({index:i,previousHash:previous,value:entry.value});previous=entry.hash;
  }envelope.segments[name].tail=previous;
 }resealManifest(envelope);
}
/** Copying persistence reference supports a torn acknowledgement, never a torn commit. */
export class AtomicPort implements PersistencePort {
 data:AppData|null=null;failBefore=false;lostAck=false;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if((this.data?.revision??null)!==expected)throw Error('Saved revision changed in another tab');
  if(this.failBefore){this.failBefore=false;throw Error('Interrupted storage transaction');}
  this.data=structuredClone(next);this.commits++;
  if(this.lostAck){this.lostAck=false;throw Error('Interrupted storage acknowledgement');}
 }
 close(){}
}
