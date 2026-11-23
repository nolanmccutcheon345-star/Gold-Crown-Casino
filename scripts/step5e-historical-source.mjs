/** Immutable historical proof, deliberately separate from current-candidate qualification.
 * A later checkout/hash never supplies a missing original execution input. */
import {createHash} from 'node:crypto';
import {qualify} from './step5d-audit-execution-links.mjs';
import {isRuntimeInput} from './step5d-ci-plan.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validPath=path=>typeof path==='string'&&path&&!path.startsWith('/')&&!path.split('/').includes('..')&&!path.includes('\\')&&!path.includes('\0');
export function verifyHistoricalRequirement(row,record,entry,{read,exists,sourceAtCommit,candidateHashes,browsers=[]}){
 const errors=[],fail=message=>errors.push(message);let receipt;
 if(!validPath(entry?.receipt?.path)||!entry.receipt.sha256||!exists(entry.receipt.path)||sha(read(entry.receipt.path))!==entry.receipt.sha256)return{status:'NOT_QUALIFIED',errors:['Historical receipt absent or changed'],candidateStatus:'NOT_EXECUTED'};
 try{receipt=JSON.parse(read(entry.receipt.path));}catch{return{status:'NOT_QUALIFIED',errors:['Invalid historical receipt JSON'],candidateStatus:'NOT_EXECUTED'};}
 const commit=receipt.sourceCommit;
 if(!/^[0-9a-f]{40}$/.test(commit??'')||entry.sourceCommit!==commit)fail('Historical receipt source identity differs');
 if(receipt.changedInputs?.length||receipt.dirtyInputs?.length||receipt.sourceCommitAtEnd&&receipt.sourceCommitAtEnd!==commit)fail('Historical execution had changing or dirty inputs');
 const historical=new Map();
 // Verify every recorded source input against its real Git object, not current bytes.
 for(const [path,hash]of Object.entries(receipt.sourceHashes??{})){
  if(!validPath(path)){fail(`Invalid historical source path: ${path}`);continue;}
  try{const bytes=sourceAtCommit(commit,path);if(sha(bytes)!==hash)fail(`Historical source hash differs from original Git bytes: ${path}`);else historical.set(path,bytes);}catch{fail(`Historical source Git object unavailable: ${path}`);}
 }
 if(!historical.size)fail('Historical source inventory absent');
 const archivedBuild=new Map();
 for(const [path,hash]of Object.entries(receipt.buildHashes??{})){
  const copy=entry.buildArtifacts?.[path];
  if(!validPath(copy)||!exists(copy)||sha(read(copy))!==hash)fail(`Original compiled artifact absent or changed: ${path}`);
  else archivedBuild.set(path,read(copy));
 }
 if(!archivedBuild.size)fail('Original compiled bytes are not retained; a rebuilt hash is not past execution');
 const result=qualify(row,record,receipt,{read:path=>historical.has(path)?historical.get(path):archivedBuild.has(path)?archivedBuild.get(path):read(path),exists:path=>historical.has(path)||archivedBuild.has(path)||exists(path),browsers});
 errors.push(...result.errors);
 const runtime=Object.entries(receipt.sourceHashes??{}).filter(([path])=>isRuntimeInput(path));
 const candidateRuntime=Object.entries(candidateHashes??{}).filter(([path])=>isRuntimeInput(path));
 const runtimeExact=runtime.length>0&&runtime.length===candidateRuntime.length&&runtime.every(([path,hash])=>candidateHashes?.[path]===hash);
 return{status:errors.length?'NOT_QUALIFIED':'HISTORICAL_QUALIFIED',errors,sourceCommit:commit,receipt:entry.receipt,qualification:result,candidateStatus:errors.length||!runtimeExact?'NOT_EXECUTED':'RUNTIME_BYTES_IDENTICAL_HISTORICAL_EVIDENCE_ONLY',candidateBoundary:'Historical execution remains attributed to its actual source. Identical production bytes permit reuse review; they do not execute new browser tests, newer assertion code, devices or current integration regressions.'};
}
