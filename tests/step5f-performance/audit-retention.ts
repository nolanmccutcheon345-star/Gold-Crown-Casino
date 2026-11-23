/** Focused retained-graph experiment. Forced GC is diagnostic, not latency evidence. */
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {SessionController} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {observeTimings} from '../../src/performance/timing';
import {totalHandCount} from '../../src/storage/verified';
import {DiskRecords} from './disk-records';
import {fileIDBReference} from './file-idb-reference';
const directory=process.argv[2],output=process.argv[3],store=new DiskRecords(directory),adapter=fileIDBReference(store as unknown as Map<string,string>),samples:unknown[]=[];
const turn=()=>new Promise<void>(r=>setImmediate(r));
async function memory(label:string){for(let n=0;n<3;n++){await turn();global.gc?.();}await turn();const row={label,memory:process.memoryUsage()};samples.push(row);return row;}
async function install(){const port=adapter.attach(),c=new SessionController(port);await c.init();assert.equal(c.status,'ready');assert.equal(c.data!.wallet,store.initial.expectedWallet);c.close();c.data=null;}
await install();await memory('afterSeparatedInstallationScope');
async function scenario(keepFull:boolean){
 const port:BrowserPersistence=adapter.attach(),c=new SessionController(port);await c.init();assert.equal(c.status,'ready');assert(c.data!.hands.length<=120);const wallet=c.data!.wallet,hands=totalHandCount(c.data!);
 if(keepFull)await c.loadFullHistory();const retained=c.data!;assert.equal(retained.hands.length,keepFull?hands:Math.min(120,hands));
 await memory(keepFull?'fullHistoryHeld.beforeAudit':'compact.beforeAudit');let peak:unknown=null;
 observeTimings(sample=>{if(sample.name==='recovery.canonicalArchiveAudit'){
  // The independent audited return value is still live in timedAsync's finally.
  global.gc?.();peak={label:keepFull?'fullHistoryHeld.auditReturnGraphLive':'compact.auditReturnGraphLive',memory:process.memoryUsage(),reportedAuditMs:sample.milliseconds,retainedControllerHands:c.data!.hands.length};samples.push(peak);
 }});
 const receipt=await c.auditSavedArchive();observeTimings(null);assert(peak);assert.equal(receipt.status,'verified');assert.equal(receipt.wallet,wallet);assert.equal(receipt.hands,hands);assert.equal(c.data,retained);assert.equal(c.data!.wallet,wallet);
 const after=await memory(keepFull?'fullHistoryHeld.afterAudit':'compact.afterAudit');c.close();c.data=null;return{keepFull,receipt,peak,after};
}
const compact=await scenario(false);await memory('afterCompactScenarioScope');const held=await scenario(true);await memory('afterHeldScenarioScope');
const sourceFiles=['src/session/controller.ts','src/storage/browser.ts','src/storage/segments.ts','src/storage/verified.ts','tests/step5f-performance/audit-retention.ts'];
const result={status:'PASS',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),hands:store.initial.size,fixture:store.initial.sourceRawSHA256,compact,held,samples,methodology:'Real controller audit through disk request reference. This is not browser or UI execution. Three forced-GC turns at phase boundaries; one GC inside the audit timing observer samples the independent returned graph while the controller retains its previous graph. Diagnostic memory experiment, not a latency benchmark. No production changes, skipped verification, mutation, or payout. UI review cache only references the existing history graph; DOM or diagnostic-array overhead is not measured here.'};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,hands:result.hands,compactPeak:compact.peak,fullHistoryHeldPeak:held.peak}));
