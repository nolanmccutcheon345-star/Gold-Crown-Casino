/** Synthetic populated fixtures through the actual initial packed-save path. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {DiskRecords} from '../step5f-performance/disk-records';
import {fileIDBReference} from '../step5f-performance/file-idb-reference';
import {SessionController} from '../../src/session/controller';
import {restoreSegments,segmentKey,packedHandKey,type SegmentedEnvelope,type PackedHandSegment} from '../../src/storage/segments';
import {getArchiveContext,totalHandCount} from '../../src/storage/verified';
import type {PackedGraph,PackedValue} from '../../src/storage/packed-hand';
import type {AppData} from '../../src/session/types';
import {referenceFinancial,financialInput} from '../step5e-independent/financial-reference';
import {encode} from '../step5d-independent/reference';

const [fixturePath,freshPath,output]=process.argv.slice(2),turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
function decodeReference(graph:PackedGraph):unknown{
 const values:unknown[]=[],read=(value:PackedValue):unknown=>{if(value&&typeof value==='object'){assert(Number.isInteger(value.ref)&&value.ref>=0&&value.ref<values.length);return values[value.ref];}return value;};
 for(const [kind,items]of graph.nodes)values.push(kind==='array'?items.map(read):Object.fromEntries(items.map(([key,value])=>[key,read(value)])));
 return read(graph.root);
}
function storage(store:DiskRecords){const groups:Record<string,{records:number;bytes:number}>={};for(const row of store.rows.values()){const key=row.key,family=key.startsWith('v2:hands:')?'canonicalHands':key.startsWith('packed-v1:hands:')?'packedReplicas':key.startsWith('v2:ledger:')?'financialLedger':key.startsWith('v2:closedSessions:')?'sessions':key.startsWith('recovery-v1:checkpoint:')?'checkpoints':key.startsWith('recovery-v1:journal:')?'journals':key==='current'||key==='previous'?'manifests':'other';const item=groups[family]??={records:0,bytes:0};item.records++;item.bytes+=row.bytes;}return{bytes:store.bytes,records:store.size,groups};}
const memory:unknown[]=[];
async function sample(phase:string){for(let i=0;i<3;i++){await turn();global.gc?.();}await turn();const row={phase,memory:process.memoryUsage()};memory.push(row);return row;}
function financial(data:AppData){return referenceFinancial({...financialInput(data),handIndex:getArchiveContext(data)?.handIndex??data.hands});}
await sample('beforeFixtureRead');
async function install(){
 const original=new DiskRecords(fixturePath),manifest=JSON.parse(original.get('current')!) as SegmentedEnvelope;
 const data=await restoreSegments(manifest,async keys=>keys.map(key=>JSON.parse(original.get(key)!)),{canonicalOnly:true});
 const expected=financial(data),handCount=data.hands.length,canonicalSHA256=sha(encode(data)),handBytes=data.hands.reduce((sum,hand)=>sum+Buffer.byteLength(JSON.stringify(hand)),0);
 assert.equal(handCount,original.initial.size);
 mkdirSync(freshPath,{recursive:false});writeFileSync(`${freshPath}/index.json`,JSON.stringify({entries:[],size:0,sourceRawSHA256:original.initial.sourceRawSHA256,expectedWallet:data.wallet,serializedBytes:0,preparationMs:0,canonicalHandFieldValueBytes:{}}));
 const store=new DiskRecords(freshPath),adapter=fileIDBReference(store as unknown as Map<string,string>),port=adapter.attach();assert.equal(await port.load(),null);
 await port.commit(null,data);
 const current=JSON.parse(store.get('current')!) as SegmentedEnvelope;assert.equal(current.packedHands?.count,handCount);assert.equal(current.data.revision,data.revision);
 const pairHashes:string[]=[];
 for(let index=0;index<handCount;index++){
  const canonical=JSON.parse(store.get(segmentKey('hands',index))!),packed=JSON.parse(store.get(packedHandKey(index))!) as PackedHandSegment;
  assert.equal(packed.index,index);assert.equal(packed.hash,canonical.hash);assert.equal(packed.previousHash,canonical.previousHash);
  const independent=decodeReference(JSON.parse(packed.graph));assert.equal(encode(independent),encode(canonical.value));pairHashes.push(sha(encode(canonical)));
 }
 const installed=storage(store),index={...store.initial,entries:[...store.rows.values()]};port.close();await turn();
 // Reopen from the physical records without retaining the source AppData graph.
 writeFileSync(`${freshPath}/index.json`,JSON.stringify({...index,entries:[...store.rows.values()]}));
 return{expected,handCount,canonicalSHA256,logicalHandJSONBytes:handBytes,canonicalPairSHA256:sha(pairHashes.join('\n')),verifiedPairs:pairHashes.length,fixtureSHA256:original.initial.sourceRawSHA256,installed};
}
const result=await install();await sample('afterFixtureInstallationScope');
const store=new DiskRecords(freshPath),port=fileIDBReference(store as unknown as Map<string,string>).attach(),controller=new SessionController(port);
await controller.init();assert.equal(controller.status,'ready');assert.equal(controller.error,'');assert.equal(totalHandCount(controller.data!),result.handCount);assert.deepEqual(financial(controller.data!),result.expected);
await sample('verifiedCompactReady');
const full=await port.loadFullHistory();assert.equal(sha(encode(full)),result.canonicalSHA256);assert.deepEqual(financial(full),result.expected);
const audit=await controller.auditSavedArchive();assert.equal(audit.status,'verified');assert.equal(audit.hands,result.handCount);assert.equal(audit.wallet,result.expected.wallet);
await sample('fullHistoryAndAuditHeld');
const final=storage(store);assert.deepEqual(final.groups.canonicalHands,result.installed.groups.canonicalHands);assert.deepEqual(final.groups.packedReplicas,result.installed.groups.packedReplicas);
controller.close();
const report={status:'PASS',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),...result,audit,final,memory,scope:'Existing validated100/1000hand fixtures written into empty isolated disk-reference stores through BrowserPersistence.commit(null,data), the same packed representation chosen by a new guest save. Not1000new observed user/UI hands, not a production save migration, not native IndexedDB or actual quota/eviction evidence. Every canonical/replica pair checked with an independent decoder; checkpoint financial replay and full canonical reconstruction agree. Fixture installation is a separate function scope before three forced-GC cycles. Memory remains a warm Node process including storage-index/provenance capacity; not fresh-browser or physical-phone memory. Full-history sample intentionally retains the explicitly loaded full graph.'};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,hands:result.handCount,bytes:result.installed.bytes,groups:result.installed.groups,memory}));
