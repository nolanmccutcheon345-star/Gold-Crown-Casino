import type {PublicHistory,StoredHand} from '../session/types';
import {GENESIS,publicHistory,requireData,seal} from './integrity';

/** Keep each mobile download comfortably below both study import byte limits.
 * This bounds one export file, not the total recoverable canonical archive. */
export const PUBLIC_HISTORY_BATCH_BYTES=2_000_000;
export interface PublicHistoryBatchOptions {
 readonly startIndex:number;readonly total:number;
 readonly maxBytes?:number;readonly maxHands?:number;
}
export interface PublicHistoryBatch {
 readonly history:PublicHistory;readonly text:string;
 /** Zero-based half-open range in the source archive. */
 readonly startIndex:number;readonly nextIndex:number;readonly total:number;
 readonly bytes:number;
}

/** Read a verified canonical archive sequentially without loading it in full.
 * Each file is an independent, strictly importable public hash chain. Only the
 * redacted export copy is resealed; canonical records and financial state are
 * never modified. The caller pins/validates the source revision while reading.
 * At most one extra source record is read to discover a byte boundary. */
export async function createPublicHistoryBatch(
 readHand:(index:number)=>Promise<StoredHand>,options:PublicHistoryBatchOptions,
):Promise<PublicHistoryBatch> {
 const {startIndex,total}=options,maxBytes=options.maxBytes??PUBLIC_HISTORY_BATCH_BYTES,maxHands=options.maxHands??100;
 requireData(Number.isSafeInteger(total)&&total>=0&&Number.isSafeInteger(startIndex)&&startIndex>=0&&startIndex<=total,'Invalid history export range.');
 requireData(Number.isSafeInteger(maxBytes)&&maxBytes>=256&&maxBytes<=PUBLIC_HISTORY_BATCH_BYTES,'Invalid history export byte limit.');
 requireData(Number.isSafeInteger(maxHands)&&maxHands>0&&maxHands<=10000,'Invalid history export hand limit.');
 const history=await publicHistory([]),encoder=new TextEncoder();
 const {hands:_,...envelope}=history;void _;
 const prefix=JSON.stringify(envelope).slice(0,-1)+',"hands":[',suffix=']}',parts:string[]=[];
 let bytes=encoder.encode(prefix+suffix).byteLength,nextIndex=startIndex,previousHash=GENESIS;
 requireData(bytes<=maxBytes,'History export byte limit is too small for its public envelope.');
 while(nextIndex<total&&history.hands.length<maxHands){
  const source=await readHand(nextIndex),single=await publicHistory([source]);
  // publicHistory owns redaction and version provenance; only the chain link
  // differs for subsequent hands in this bounded independent public file.
  const hand=previousHash===GENESIS?single.hands[0]:await seal({...single.hands[0],previousHash});
  const text=JSON.stringify(hand),size=encoder.encode(text).byteLength+(parts.length?1:0);
  if(bytes+size>maxBytes){
   requireData(parts.length>0,`Hand ${nextIndex+1} is too large for one ${maxBytes.toLocaleString('en-US')}-byte study export file. No hand was omitted or changed. Contact support for archive recovery.`);
   break;
  }
  history.hands.push(hand);parts.push(text);bytes+=size;previousHash=hand.hash;nextIndex++;
 }
 const text=prefix+parts.join(',')+suffix;
 // UTF-8 bytes are at least the UTF-16 character count for JSON; this guards
 // both importers while retaining their unchanged 10 MB limits.
 requireData(bytes===encoder.encode(text).byteLength&&text.length<=maxBytes,'History export size validation failed.');
 return {history,text,startIndex,nextIndex,total,bytes};
}
