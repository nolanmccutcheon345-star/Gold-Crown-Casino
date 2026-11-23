/** Test-only matched storage composition/maintenance measurement. Native usage is
 * measured by a separate browser harness, never inferred from these JSON sizes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,linkSync,existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DiskRecords} from '../step5f-performance/disk-records';
import {fileIDBReference} from '../step5f-performance/file-idb-reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';
import {publicHistory} from '../../src/storage/integrity';
import {totalHandCount} from '../../src/storage/verified';
import type {AppData} from '../../src/session/types';
const [source,folder,out]=process.argv.slice(2);assert(source&&folder&&out);assert(!existsSync(folder));mkdirSync(folder,{recursive:false});
const sourceIndex=JSON.parse(readFileSync(path.join(source,'index.json'),'utf8'));
for(const row of sourceIndex.entries)linkSync(path.join(source,row.name),path.join(folder,row.name));
writeFileSync(path.join(folder,'index.json'),JSON.stringify(sourceIndex));
const store=new DiskRecords(folder);sourceIndex.size=JSON.parse(store.get('current')!).segments.hands.count;const adapter=fileIDBReference(store as unknown as Map<string,string>),port=adapter.attach();
function hash(value:unknown){const h=createHash('sha256');const walk=(v:unknown):void=>{if(Array.isArray(v)){h.update('[');v.forEach((item,i)=>{if(i)h.update(',');walk(item);});h.update(']');}else if(v!==null&&typeof v==='object'){h.update('{');Object.entries(v).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).forEach(([k,item],i)=>{if(i)h.update(',');h.update(JSON.stringify(k)+':');walk(item);});h.update('}');}else h.update(JSON.stringify(v));};walk(value);return h.digest('hex');}
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
function composition(){
 const groups:Record<string,{records:number;bytes:number}>={},handFields:Record<string,number>={},checkpointFields:Record<string,number>={},digests:Record<string,string>={};
 const accum:Record<string,ReturnType<typeof createHash>>={};let logicalHands=0;
 for(const row of store.rows.values()){
  const key=row.key,family=key.startsWith('v2:hands:')?'canonicalHands':key.startsWith('packed-v1:hands:')?'packedReplicas':key.startsWith('v2:ledger:')?'financialLedger':key.startsWith('v2:closedSessions:')?'sessions':key.startsWith('v2:importedHands:')?'studyImports':key.startsWith('recovery-v1:checkpoint:')?'checkpoints':key.startsWith('recovery-v1:journal:')?'recoveryJournal':key.startsWith('pre-')?'backupManifests':key==='current'||key==='previous'?'currentPreviousManifests':key.includes('receipt')?'receipts':'other';
  const item=groups[family]??={records:0,bytes:0};item.records++;item.bytes+=row.bytes;
  const text=store.get(key)!;(accum[family]??=createHash('sha256')).update(key+'\n'+text+'\n');
  if(family==='canonicalHands'){const hand=JSON.parse(text).value;logicalHands+=bytes(hand);for(const[k,v]of Object.entries(hand))handFields[k]=(handFields[k]??0)+bytes(v);}
  if(family==='checkpoints'){const cp=JSON.parse(text);for(const[k,v]of Object.entries(cp.payload??{})){if(v&&typeof v==='object'){for(const[child,value]of Object.entries(v))checkpointFields[`${k}.${child}`]=(checkpointFields[`${k}.${child}`]??0)+bytes(value);}else checkpointFields[k]=(checkpointFields[k]??0)+bytes(v);}}
 }
 for(const[k,v]of Object.entries(accum))digests[k]=v.digest('hex');
 return{bytes:store.bytes,records:store.size,groups,canonicalHandFieldValueBytes:handFields,checkpointFieldValueBytes:checkpointFields,logicalHands,digests,perHandBytes:store.bytes/sourceIndex.size};
}
async function attest(data:AppData){
 const publicDigests=createHash('sha256');for(const hand of data.hands)publicDigests.update(hash(await publicHistory([hand]))+'\n');
 return{canonicalHash:hash(data),publicHistoryPerHandHash:publicDigests.digest('hex'),financial:replayAccounting(data),handHashes:hash(data.hands.map(h=>({id:h.id,hash:h.hash,previousHash:h.previousHash}))),policyVersions:[...new Set(data.hands.flatMap(h=>Object.values(h.privateProfiles).map(p=>p.policyVersion)))]};
}
const memory:Array<{phase:string;heapUsed:number;rss:number}>=[];
async function sample(phase:string){for(let i=0;i<3;i++){await new Promise<void>(r=>setImmediate(r));global.gc?.();}const m=process.memoryUsage();memory.push({phase,heapUsed:m.heapUsed,rss:m.rss});}
const times:Record<string,number>={};
async function measure<T>(key:string,work:()=>Promise<T>){const t=performance.now(),v=await work();times[key]=performance.now()-t;return v;}
const before=composition();let loaded=await measure('beforeRecoveryMs',()=>port.load());assert(loaded);assert.equal(totalHandCount(loaded),sourceIndex.size);loaded=null;await sample('beforeCompactReady');
async function fullAttestation(){const full=await port.loadFullHistory();return attest(full);}
const proofBefore=await measure('beforeFullHistoryAndIndependentProofMs',fullAttestation);
await sample('beforeProofReleased');
await measure('explicitCompactionIncludingFullCanonicalAuditMs',()=>port.optimizeStorage());
const after=composition();
for(const key of ['canonicalHands','financialLedger','sessions','studyImports'])assert.equal(before.digests[key],after.digests[key]);
const proofAfter=await measure('afterFullHistoryAndIndependentProofMs',fullAttestation);assert.deepEqual(proofAfter,proofBefore);
const reload=await measure('afterRecoveryMs',()=>port.load());assert(reload);assert.equal(totalHandCount(reload),sourceIndex.size);assert.equal(reload.wallet,proofBefore.financial.wallet);
await sample('afterCompactReady');
const audit=await measure('afterIndependentCanonicalAuditMs',()=>port.auditCanonicalArchive());assert(audit.current);assert.equal(audit.hands,sourceIndex.size);
const currentBefore=store.get('current');await port.optimizeStorage();assert.equal(store.get('current'),currentBefore);
const final=composition();assert.equal(final.bytes,after.bytes);port.close();
const report={format:'ai-texas-step5h-storage-composition',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'PASS',hands:sourceIndex.size,sourceFixtureSHA256:sourceIndex.sourceRawSHA256,before,after,bytesSaved:before.bytes-after.bytes,reductionPercent:100*(before.bytes-after.bytes)/before.bytes,proofBefore,proofAfter,audit,times,memory,adapterMetrics:adapter.metrics,scope:'Existing isolated full-packed baseline cloned via immutable hard links. Only clone paths are mutated. Sizes are exact serialized logical application payloads, not native IndexedDB disk usage or navigator.storage.estimate. Composition field subtotals exclude JSON key/punctuation overhead and are not additional records. Full history, every public per-hand export, financial replay and all canonical raw records agree before/after. Explicit full audits are separated from startup. Node forced-GC heap includes test adapters; no physical device claim.'};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,hands:report.hands,before:before.bytes,after:after.bytes,saved:report.bytesSaved,times}));
