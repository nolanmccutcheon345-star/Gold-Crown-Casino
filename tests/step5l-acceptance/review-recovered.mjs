/** Requalify recovered bytes and observations. This never invents a Git object,
 * rewrites a capture, or treats a packaged diagnostic as an executed check. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {Buffer} from 'node:buffer';
import {sha,isRuntimeInput} from '../../scripts/step5d-ci-plan.mjs';
import {verifyStep5EBrowser,step5eHarnessFiles} from '../../scripts/step5e-qualify-browser.mjs';
import {verifyStep5EStatistics,statisticsHarnessFiles} from '../../scripts/step5e-qualify-statistics.mjs';
import {verifyStep5EMixedStatistics,mixedStatisticsHarnessFiles} from '../../scripts/step5e-qualify-mixed-statistics.mjs';
import {verifyStep5EGateMatrix} from '../../scripts/step5e-qualify-gate-matrix.mjs';
import {sizingHarnessFiles} from '../../scripts/step5e-qualify-sizing.mjs';

export const directory='tests/step5l-acceptance';
export const candidate='3ecea1c2b71c8e8b9963547da676171f91f21716';
export const packaging='566f3b11032841c492e6e148bb9a1139e74247b7';
const packageRoot='/workspace/sites/ai-texas-hold-em-r1-test/dist';
const json=p=>JSON.parse(readFileSync(p));

export function recoverContext({transformCapture,sourceOverride}={}) {
 const receipt=json(`${directory}/recovered-release-receipt.json`);
 const qa=json(`${directory}/recovered-qa-packaging.json`);
 const aliases={
  'TEST_EVIDENCE/step5k/release-static-qa/manifest.json':`${directory}/recovered-release-receipt.json`,
  ...Object.fromEntries(Object.keys(receipt.buildHashes).map(p=>[p,join(packageRoot,p.split('/').at(-1)+'.bin')]))
 };
 const locate=p=>aliases[p]??(p.startsWith('tests/browser/step5e-fixtures/')?join(packageRoot,p):(existsSync(p)?p:join(packageRoot,p)));
 const read=p=>{
  const bytes=readFileSync(locate(p));
  return transformCapture&&p.includes('/recovered-browser/')?Buffer.from(JSON.stringify(transformCapture(JSON.parse(bytes),p))):bytes;
 };
 const exists=p=>existsSync(locate(p));
 const production=Object.entries(receipt.sourceHashes).filter(([p])=>isRuntimeInput(p));
 assert.equal(receipt.sourceCommit,candidate);assert.equal(receipt.status,'PASS');
 assert.equal(qa.sourceCommit,candidate);assert.equal(qa.executionReceipt.sha256,sha(read(`${directory}/recovered-release-receipt.json`)));
 for(const [p,h]of production)assert.equal(sha(readFileSync(p)),h,`Recovered production bytes differ:${p}`);
 for(const [p,h]of Object.entries(receipt.buildHashes))assert.equal(sha(read(p)),h,`Retained compiled bytes differ:${p}`);
 // The downstream verifier's callback name is historical. Here it supplies
 // independently hash-pinned recovered file bytes, NOT an invented git-show.
 const sourceAtCommit=(commit,p)=>{
  const h=commit===candidate?receipt.sourceHashes[p]:commit===qa.assertionSourceCommit?(qa.inputHashes[p]??receipt.sourceHashes[p]):null;
  assert(h,`No retained source proof:${commit}:${p}`);
  const b=sourceOverride?.(p)??readFileSync(p);
  assert.equal(sha(b),h,`Recovered assertion bytes differ:${p}`);return b;
 };
 return {receipt,qa,production,read,exists,sourceAtCommit};
}

export function reviewRecovered(options={}) {
 const ctx=recoverContext(options),{receipt,read,sourceAtCommit}=ctx;
 const ref=p=>({path:p,sha256:sha(readFileSync(p))});
 const entries=[];
 const add=(name,id,format,files,proof,verify)=>{
  const path=`${directory}/recovered-browser/${name}.json`;
  const entry={format,version:1,id,sourceCommit:candidate,harnessCommit:candidate,harnessHashes:Object.fromEntries(files.map(p=>[p,sha(sourceAtCommit(candidate,p))])),capture:ref(path),proof:ref(`${directory}/${proof}`),command:[`Requalify retained actual browser capture ${name}; no new browser execution in this review.`]};
  const result=verify(entry,receipt,ctx);entries.push({entry,result});
 };
 for(const [suffix,width]of [['320',320],['standard',390],['1280',1280]])add(`step5k-compiled-${suffix}`,`compiled-${width}`,'ai-texas-step5e-native-compiled-workflows',step5eHarnessFiles,'compiled-proof.json',verifyStep5EBrowser);
 for(const [suffix,id]of [['1h','exact-statistics-1h'],['10h','exact-statistics-10h'],['station','station-statistics']])add(`step5k-stats-${suffix}`,id,'ai-texas-step5e-native-exact-statistics',statisticsHarnessFiles,'compiled-proof.json',verifyStep5EStatistics);
 add('step5k-mixed-stats','compiled-mixed-stats','ai-texas-step5e-native-mixed-statistics',mixedStatisticsHarnessFiles,'compiled-proof.json',verifyStep5EMixedStatistics);
 add('step5k-gates','gate-matrix66','ai-texas-step5e-native-gate-matrix',sizingHarnessFiles,'runtime-proof.json',verifyStep5EGateMatrix);
 return {format:'step5l-recovered-evidence-review',version:1,reviewedAt:new Date().toISOString(),candidateSource:candidate,testPackagingSource:packaging,sourceBoundary:'Manifest-pinned recovered source bytes; original Git commit object not asserted recovered. Source recovery/build reproducibility separately reported by integration owner.',productionInputsMatched:ctx.production.length,receipt:{path:`${directory}/recovered-release-receipt.json`,sha256:sha(read(`${directory}/recovered-release-receipt.json`))},compiledHashes:receipt.buildHashes,newBrowserExecutions:0,records:entries,qualifiedBrowserGroups:entries.filter(e=>e.result.status==='QUALIFIED').length,limits:['Recorded 10-hour statistics fixtures are not ten hours of observed play.','Chromium CSS widths are not physical iPhone Safari or touch-performance evidence.','No screen-reader speech, new-user study or hosted CI is inferred.','Eight browser evidence groups are not eight original acceptance criteria.']};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=reviewRecovered();writeFileSync(`${directory}/browser-qualification.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({qualified:report.qualifiedBrowserGroups,total:report.records.length,errors:report.records.filter(r=>r.result.status!=='QUALIFIED').map(r=>({id:r.entry.id,errors:r.result.errors}))}));
 if(report.qualifiedBrowserGroups!==report.records.length)process.exitCode=1;
}
