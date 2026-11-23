import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
const folder=process.argv[2]??'tests/step5e-performance/hot-evidence',bytes=readFileSync(`${folder}/report.json`),r=JSON.parse(bytes),hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(r.status,'PASS');assert.equal(r.decisions,2000);assert.equal(r.preparation.samples,2000);assert.equal(r.initialHands,10000);assert.equal(r.finalHands,r.initialHands+r.completedHands);assert.equal(r.reloads.length,8);assert(r.reloads.every(row=>row.identityStable));
for(const seats of [2,6,10])assert(r.occupied[seats]>0);assert.equal(hash(readFileSync(r.source.bundle)),r.source.bundleSHA256);assert.equal(r.source.runtimeCommit,'398360f');
// Two retained generations (checkpoint + at most63 journal entries), current
// and previous heads, and the required pre-install backup: 2*64 + 3 =131 rows.
assert(r.checkpointPromotions>0&&r.prunedRecoveryRows>0);assert(r.memory.every(row=>row.recoveryRows<=131));assert.equal(r.initialFinancial.manual,r.finalFinancial.manual);
for(const stage of ['persistence.load','recovery.fastRestore','recovery.financialArchive','recovery.residentArchive','recovery.archiveInventory'])assert.equal(r.stageLatency[stage]?.samples,8,`Missing mandatory pending-reload stage: ${stage}`);
let boundRuntimeFiles=0;for(const [file,expected]of Object.entries(r.source.files))if(file.startsWith('src/')){assert.equal(hash(execFileSync('git',['show',`${r.source.runtimeCommit}:${file}`])),expected,`Runtime file differs: ${file}`);boundRuntimeFiles++;}
const summary={status:'PASS',runtimeCommit:r.source.runtimeCommit,sourceCommit:r.source.commit,boundRuntimeFiles,sourceBundleSHA256:r.source.bundleSHA256,reportSHA256:hash(bytes),environmentObservedAtQualification:{node:process.version,cpu:cpus()[0]?.model,platform:process.platform,architecture:process.arch},decisions:r.decisions,newCompletedHands:r.completedHands,canonicalHands:r.finalHands,preparation:r.preparation,stageLatency:r.stageLatency,actualOccupiedSeatDecisionCounts:r.occupied,streets:r.streets,pendingReloads:r.reloads.length,checkpointPromotions:r.checkpointPromotions,prunedRecoveryRows:r.prunedRecoveryRows,maximumRetainedRecoveryRows:Math.max(...r.memory.map(row=>row.recoveryRows)),elapsedMs:r.elapsedMs,nodeEventLoop:r.nodeEventLoop,initialFinancial:r.initialFinancial,finalFinancial:r.finalFinancial,fullCanonicalAuditAndStatisticsReplay:'PASS',originalCanonicalBytesUnchanged:'PASS',limitations:r.limitations};
writeFileSync(`${folder}/qualification.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
