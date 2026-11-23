/** Recovered immutable bytes adapter around unchanged Step5E native assertions. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import {sha,isRuntimeInput} from '../../scripts/step5d-ci-plan.mjs';
import {recoverContext,candidate,directory} from './review-recovered.mjs';
const ctx=recoverContext(),root=process.cwd(),receiptPath=`${directory}/recovered-release-receipt.json`,browserDirectory=`${directory}/recovered-browser`,outputDirectory=directory,read=ctx.read,json=p=>JSON.parse(read(p)),base=ctx.receipt,runtimeInputs=Object.entries(base.sourceHashes).filter(([p])=>isRuntimeInput(p));
assert.equal(base.status,'PASS');const sourceAt=(commit,path)=>commit===candidate?ctx.sourceAtCommit(commit,path):execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:32*1024*1024});
const assertionCommit=candidate;
function sourceProof(manifest,harnessPaths){
 assert.equal(manifest.format,'ai-texas-step5e-runtime-provenance');assert.equal(manifest.name,'candidate');assert.equal(manifest.productionDirty,'');
 for(const [path,hash]of runtimeInputs){assert.equal(sha(sourceAt(manifest.sourceCommit,path)),hash);assert.equal(sha(sourceAt(assertionCommit,path)),hash);}
 for(const [path,hash]of Object.entries(manifest.sourceFiles))assert.equal(base.sourceHashes[path],hash);
 for(const asset of manifest.artifacts){assert.equal(read(asset.path).length,asset.bytes);assert.equal(sha(read(asset.path)),asset.sha256);}
 const assertionHashes=Object.fromEntries(harnessPaths.map(path=>{const actual=sha(read(path));assert.equal(actual,sha(sourceAt(assertionCommit,path)));return[path,actual];}));
 return{runtimeBundleSource:manifest.sourceCommit,matchedProductionInputs:runtimeInputs.length,artifacts:manifest.artifacts,assertionSourceCommit:assertionCommit,assertionHashes,executionHeadClaim:'Exact-byte assertion-source proof; no independently recorded execution HEAD is invented.'};
}
const captureFiles=[`${browserDirectory}/step5k-native.json`,`${browserDirectory}/step5k-rollback.json`];
for(const capturePath of captureFiles){
 const raw=json(capturePath),rollback=raw.format==='ai-texas-step5e-native-rollback',source=sourceProof(rollback?raw.candidateSource:raw.source,[`tests/browser/step5e-${rollback?'rollback':'native'}.ts`,`tests/browser/step5e-${rollback?'rollback':'native'}.html`,'tests/browser/step5e-support.ts','tests/step5e-browser/build-runtimes.mjs']);
 assert.equal(raw.productionDatabaseAccessed,false);assert(raw.browser??raw.userAgent);assert(raw.executedAt??raw.at);
 assert.equal(raw.checks.length,rollback?9:6);assert(raw.checks.every(c=>c.status==='PASS'&&!c.error));
 const find=fragment=>{const matches=raw.checks.filter(c=>c.name.includes(fragment));assert.equal(matches.length,1,fragment);return matches[0].evidence;};
 let outcome;
 if(!rollback){
  assert.equal(raw.status,'PASS');assert.equal(raw.passed,6);assert.equal(raw.failed,0);assert.equal(raw.cleanupConfirmed,true);
  const recovery=find('Normal checkpoint reload');assert.equal(recovery.before.wallet,recovery.after.wallet);assert.equal(recovery.before.hands,recovery.after.hands);assert.equal(recovery.before.net,recovery.after.net);
  for(const fault of ['abort','quota']){const e=find(`Actual native commit ${fault}`);assert.equal(e.injected,true);assert.equal(e.recoveryControlsVisible,true);assert.equal(e.recoveredExportedHands,e.after.hands);assert(e.visibleError.includes('last committed state'));assert(e.nonLeaseRowsSHA256);}
  const takeover=find('Two independent native connections');assert.deepEqual(takeover.accepted,takeover.reloaded);assert(takeover.staleError);
  const paid=find('Payout and cashout');assert.equal(paid.settlementCount,1);assert.equal(paid.cashoutCount,1);
  outcome={checksPassed:6,transactionAbortAndQuotaRollback:true,visibleSafeRecovery:true,recoveryExport:true,payoutAndCashoutOnce:true,separateBrowserTabs:false,physicalPowerLoss:false,actualQuotaExhaustion:false};
 }else{
  const published='a0bfc0950771a6dc1b786e00c13be7f3485b8dcb',savedV8='f54cacfb0aa3c861313b691e773a6716379c50a0';
  assert.equal(raw.actualPublishedSource,published);assert.equal(raw.actualSiteDeployment,false);assert.equal(raw.z03WholeCriterion,'COMPATIBILITY_ROLLBACK_VERIFIED');
  const frozen=json('tests/step5b-rollback/published-v7-manifest.json');assert.equal(frozen.sourceCommit,published);assert.equal(sha(read('tests/browser/step5b-published-v7.js')),frozen.bundleSHA256);
  for(const [path,hash]of Object.entries(frozen.sourceFiles))assert.equal(sha(sourceAt(published,path)),hash);
  const aborted=find('Interrupted native migration');assert.equal(aborted.originalStorageSHA256,aborted.afterAbortSHA256);assert.equal(aborted.noPartialBackupOrReceipt,true);
  const migrated=find('Current source migrates');assert.equal(migrated.beforeHandsSHA256,migrated.afterHandsSHA256);assert.equal(migrated.beforeLedgerSHA256,migrated.afterLedgerSHA256);
  const refused=find('Actual V7 downgrade refuses');assert.equal(refused.storageBefore,refused.storageAfter);assert.equal(refused.wholeRollbackSupported,false);assert.equal(refused.recordsPreserved,6);assert.equal(refused.postMigrationRecordsPreserved,3);
  const recovered=find('V7-R compatibility release'),manifest=json('tests/step5c-rollback/generated/manifest.json');assert.deepEqual(recovered.runtimeManifest,manifest);assert.equal(manifest.previousUICommit,published);assert.equal(manifest.recoveryRuntimeCommit,savedV8);assert.equal(sha(read('tests/step5c-rollback/generated/recovery.js')),manifest.bundleSHA256);assert.equal(sha(read('tests/step5c-rollback/generated/recovery.css')),manifest.cssSHA256);
  for(const [path,record]of Object.entries(manifest.sourceFiles))assert.equal(sha(sourceAt(record.origin==='published-v7'?published:savedV8,path)),record.sha256);
  assert.equal(recovered.canonicalBefore,recovered.canonicalRestored);assert.equal(recovered.exactRestore,true);assert.equal(recovered.settlementAndActionIdempotence,true);
  const roundtrip=find('Candidate resumes after V7-R');for(const key of ['wallet','table','pokerNet','hands','events','sessions','revision','handIds','settlementIds'])assert.deepEqual(roundtrip[key],recovered[key]);
  const unknown=find('Actual V7 refuses unknown');assert.equal(unknown.storageBefore,unknown.storageAfter);
  outcome={checksPassed:9,verifiedPreUpgradeSnapshot:true,interruptedMigrationAtomic:true,existingAndNewRecordsPreserved:true,compatibilityRollback:'V7-R',exactLatestStateRestored:true,postMigrationHands:3,roundTripHands:8,savedDecisionAndPayoutOnce:true,unchangedV7Supported:false,actualSiteDeployment:false,frozenPublishedSource:published,frozenRecoveryRuntime:savedV8};
 }
 const report={format:'step5e-source-bound-native-review',version:1,sourceCommit:base.sourceCommit,sourceReceipt:{path:receiptPath,sha256:sha(read(receiptPath))},sourceBoundary:'Recovered manifest-pinned bytes; original Git candidate object is not claimed recovered',capture:{path:capturePath,sha256:sha(read(capturePath)),originalFormat:raw.format,browser:raw.browser??raw.userAgent,executedAt:raw.executedAt??raw.at},sourceProof:source,outcome,reviewerSource:'scripts/step5e-review-native.mjs',reviewerSHA256:sha(read('scripts/step5e-review-native.mjs')),reviewerCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reviewedAt:new Date().toISOString(),limitations:['This independent review verifies existing actual native browser evidence; it executes no new browser check.','Runtime module bundle identity is separate from ordinary compiled dist.','No physical device, unchangedV7 downgrade, new production deployment or arbitrary corruption repair is claimed.']};
 const output=`${outputDirectory}/${rollback?'rollback':'native'}-qualified-review.json`;writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,candidate:base.sourceCommit,checksVerified:outcome.checksPassed}));
}
void root;
