import type {PublicHand} from '../session/types';
import {digest,GENESIS,requireData,validateImportedRecords} from './integrity';

export interface StudyImportRow {
 readonly index:number;readonly handId:string|null;readonly status:'VALID'|'INVALID';
 readonly errors:readonly string[];readonly warnings:readonly string[];
}
export interface StudyImportPreview {
 readonly kind:'public-study-import-preview';readonly previewId:string;
 readonly format:'ai-texas-hold-em-public-history';readonly version:'0.3.0';
 readonly totalRows:number;readonly validCount:number;readonly invalidCount:number;
 readonly rows:readonly StudyImportRow[];readonly requiresExplicitSelection:true;
 readonly disclosure:string;
}
const previews=new WeakMap<StudyImportPreview,ReadonlyMap<number,PublicHand>>();
const rootKeys=new Set(['format','version','disclosure','hands']);
const handKeys=new Set(['version','kind','handId','sessionId','number','startedAt','endedAt','view','frames','net','policyVersions','provenance','configuration','previousHash','hash']);
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function displayText(text:string,limit:number):string {return [...text].map(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127?' ':character).join('').slice(0,limit);}
function message(error:unknown):string {return displayText(error instanceof Error?error.message:'Invalid public hand record',240);}
/** Preview only. Does not write storage, touch the active table, credit money or
 * import a private resumable save. Invalid records are rejected, never repaired
 * or rehashed. Every retained row passes the existing public-record validator. */
export async function previewPublicStudyImport(text:string):Promise<StudyImportPreview> {
 requireData(typeof text==='string'&&text.length<=10_000_000&&new TextEncoder().encode(text).byteLength<=10_000_000,'Public study import is limited to 10 MB.');
 let payload:unknown;try{payload=JSON.parse(text);}catch{throw Error('Invalid JSON. No records were imported or invented from a broken file.');}
 requireData(object(payload)&&payload.format==='ai-texas-hold-em-public-history'&&payload.version==='0.3.0'&&Array.isArray(payload.hands)&&payload.hands.length<=10000,'Unsupported public history format/version. Private financial saves cannot be imported as study history.');
 requireData(Object.keys(payload).every(key=>rootKeys.has(key))&&typeof payload.disclosure==='string','Unsupported public history envelope metadata. No records were imported.');
 const source=payload.hands as unknown[],counts=new Map<string,number>();
 for(const candidate of source)if(object(candidate)&&typeof candidate.handId==='string')counts.set(candidate.handId,(counts.get(candidate.handId)??0)+1);
 const accepted=new Map<number,PublicHand>(),rows:StudyImportRow[]=[];
 for(let index=0;index<source.length;index++) {
  const candidate=source[index],errors:string[]=[],warnings:string[]=[];
  const handId=object(candidate)&&typeof candidate.handId==='string'&&candidate.handId.length>0&&candidate.handId.length<=160?candidate.handId:null;
  if(!object(candidate))errors.push('A public hand must be an object.');
  else {
   if(!Object.keys(candidate).every(key=>handKeys.has(key)))errors.push('Unsupported or private fields are present in this public record.');
   if(handId!==null&&(counts.get(handId)??0)>1)errors.push('Duplicate hand identity in the source file; every ambiguous occurrence is excluded.');
   const predecessor=index===0?GENESIS:object(source[index-1])?(source[index-1] as Record<string,unknown>).hash:undefined;
   if(!hash(predecessor)||candidate.previousHash!==predecessor)errors.push('Source hash-chain link is missing or out of order. The original hash will not be rewritten.');
   try {
    // Same byte-integrity, private-field, policy-version and canonical public
    // replay validation used by the strict importer and persisted study shelf.
    await validateImportedRecords([candidate as unknown as PublicHand]);
   }catch(error){errors.push(message(error));}
   if(errors.length===0){
    if(index>0&&rows[index-1].status==='INVALID')warnings.push('The preceding source row was rejected. This independently verified hand retains its original link/hash; the study shelf is not a repaired source file.');
    accepted.set(index,structuredClone(candidate) as unknown as PublicHand);
   }
  }
  rows.push(Object.freeze({index,handId:handId===null?null:displayText(handId,160),status:errors.length?'INVALID':'VALID',errors:Object.freeze(errors),warnings:Object.freeze(warnings)}));
 }
 const preview:StudyImportPreview=Object.freeze({kind:'public-study-import-preview',previewId:await digest(text),format:'ai-texas-hold-em-public-history',version:'0.3.0',totalRows:rows.length,validCount:accepted.size,invalidCount:rows.length-accepted.size,rows:Object.freeze(rows),requiresExplicitSelection:true,
  disclosure:'Preview only: no records have been imported. Select verified public study hands and explicitly confirm import. Rejected rows remain excluded; original records and hashes are preserved. Study imports never credit bankroll, enter poker results, restore a table or expose private production saves.',
 });previews.set(preview,accepted);return preview;
}
/** Only an explicit selected set from this process-local, verified preview can
 * be returned. The caller owns the user confirmation and study-shelf transaction.
 * Reloads/serialized previews must be reviewed again; no cached flag is trusted. */
export function selectPublicStudyRows(preview:StudyImportPreview,indices:readonly number[]):PublicHand[] {
 const accepted=previews.get(preview);requireData(accepted,'Import preview is unavailable or unverified. Review the source file again.');
 requireData(Array.isArray(indices)&&indices.length>0&&new Set(indices).size===indices.length&&indices.every(index=>Number.isSafeInteger(index)&&accepted.has(index)),'Select one or more distinct verified study rows. Invalid or unknown rows cannot be imported.');
 return [...indices].sort((a,b)=>a-b).map(index=>structuredClone(accepted.get(index)!));
}
