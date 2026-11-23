/** Explicit forced-GC retention experiment only. No latency/browser claim. */
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SessionController} from '../../src/session/controller';
import {observeTimings} from '../../src/performance/timing';
import {totalHandCount,isVerifiedSnapshot} from '../../src/storage/verified';
import {DiskRecords} from '../step5f-performance/disk-records';
import {fileIDBReference} from '../step5f-performance/file-idb-reference';
const [directory,output,mode]=process.argv.slice(2),store=new DiskRecords(directory);
// Read-only base: owner leases and any installation metadata stay in a tiny
// overlay, never editing the shared immutable fixture or its index.
const writes=new Map<string,string>(),removed=new Set<string>();
const records={get:(key:string)=>writes.get(key)??(removed.has(key)?undefined:store.get(key)),set:(key:string,value:string)=>{removed.delete(key);writes.set(key,value);},delete:(key:string)=>{writes.delete(key);removed.add(key);return true;},keys:()=>new Set([...store.keys(),...writes.keys()].filter(key=>!removed.has(key))).keys()};
const adapter=fileIDBReference(records as unknown as Map<string,string>);
assert(global.gc,'Run this diagnostic with --expose-gc');assert(['baseline','candidate'].includes(mode));
const samples:unknown[]=[],turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function memory(label:string){for(let i=0;i<3;i++){await turn();global.gc!();}await turn();const row={label,...process.memoryUsage()};samples.push(row);return row;}
const port=adapter.attach(),c=new SessionController(port);await c.init();assert.equal(c.status,'ready',c.error);assert(c.data!.hands.length<=120);
const wallet=c.data!.wallet,count=totalHandCount(c.data!),ledgerHash=createHash('sha256').update(JSON.stringify(c.data!.ledger)).digest('hex');
const timings:Array<{name:string;milliseconds:number}>=[];let auditReturnHeap:ReturnType<typeof process.memoryUsage>|undefined;
observeTimings(sample=>{if(!sample.name.startsWith('profile.'))timings.push(sample);if(sample.name==='recovery.canonicalArchiveAudit'){global.gc!();auditReturnHeap=process.memoryUsage();}});
await memory('compact.initial');
await c.loadFullHistory();assert.equal(c.data!.hands.length,count);
const previous=new WeakRef(c.data!);await memory('full.beforeAudit');
let oldGraphAtAuditStart:boolean|undefined;const audit=port.auditCanonicalArchive.bind(port);
port.auditCanonicalArchive=async()=>{await memory('port.auditStart');oldGraphAtAuditStart=previous.deref()!==undefined;assert.equal(oldGraphAtAuditStart,mode==='baseline');assert.equal(c.data!.hands.length,mode==='baseline'?count:120);assert.equal(createHash('sha256').update(JSON.stringify(c.data!.ledger)).digest('hex'),ledgerHash);return audit();};
const receipt=await c.auditSavedArchive();observeTimings(null);assert.equal(receipt.wallet,wallet);assert.equal(receipt.hands,count);assert.equal(receipt.status,'verified');assert(isVerifiedSnapshot(c.data!));assert.equal(totalHandCount(c.data!),count);assert.equal(createHash('sha256').update(JSON.stringify(c.data!.ledger)).digest('hex'),ledgerHash);
await memory('after.audit');assert.equal(previous.deref()!==undefined,mode==='baseline');
c.close();c.data=null;await memory('after.controllerRelease');
const result={status:'PASS',mode,fixture:{directory,sourceRawSHA256:store.initial.sourceRawSHA256,count},receipt,oldGraphAtAuditStart,auditReturnHeap,samples,timings,methodology:'Matched actual controller and storage port against an isolated immutable disk fixture. Baseline controller frozen before this change; same current storage code. Fresh process per mode. Three forced-GC event-loop turns at labeled boundaries and one forced GC while audit return graph is live. WeakRef proves original graph reachability at storage audit boundary. Diagnostic retention only: these GC-instrumented times are not responsiveness or browser latency. No forced GC in production and no skipped audit.'};writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',mode,count,oldGraphAtAuditStart,auditReturnHeap,samples}));
