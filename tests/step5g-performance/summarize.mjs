import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {Buffer} from 'node:buffer';

const output=process.argv[2],folders=process.argv.slice(3),hash=b=>createHash('sha256').update(b).digest('hex');
const quantiles=values=>{const rows=[...values].sort((a,b)=>a-b),at=p=>rows[Math.max(0,Math.ceil(rows.length*p)-1)]??null;return{samples:rows.length,p50:at(.5),p95:at(.95),p99:at(.99),max:rows.at(-1)??null};};
const scenarios=[];
for(const spec of folders){
 const split=spec.lastIndexOf(':'),folder=spec.slice(0,split),size=Number(spec.slice(split+1)),file=path.join(folder,`${size}-report.json`),report=JSON.parse(readFileSync(file));
 const source=JSON.parse(readFileSync(path.join(folder,'source.json')));assert.deepEqual(report.source,source);
 assert.equal(hash(readFileSync(path.join(folder,'profile.mjs.bin'))),source.bundleSHA256);
 assert.equal(report.status,'PASS');assert(report.financialAndStatisticsFullReplayAgreement);
 for(const artifact of Object.values(report.profiles)){
  const bytes=artifact.parts?Buffer.concat(artifact.parts.map(part=>{const value=readFileSync(path.join(folder,part.path));assert.equal(value.length,part.bytes);assert.equal(hash(value),part.sha256);return value;})):readFileSync(path.join(folder,artifact.path));
  assert.equal(bytes.length,artifact.bytes);assert.equal(hash(bytes),artifact.sha256);
 }
 const trace=gunzipSync(readFileSync(path.join(folder,report.trace.path))).toString().trim().split('\n').map(JSON.parse);assert.equal(trace.length,report.trace.rows);
 const preps=report.windows.filter(w=>w.name==='ordinary.bot.prepare');assert.equal(preps.length,report.decisions);
 assert.equal(trace.filter(w=>w.phase==='ordinary.bot.prepare'&&w.name==='bot.prepare').length,preps.length);
 assert.equal(report.finalStorage.groups.canonicalHands.records,size+report.completedHands);
 if(report.sustained){assert.equal(report.forcedGCCalls,0);assert.deepEqual(report.reloads,[]);}
 const stages=Object.fromEntries([...new Set(report.windows.map(w=>w.name))].filter(n=>!n.startsWith('ordinary.')&&!n.startsWith('hero.')&&!n.startsWith('session.')&&!n.startsWith('hand.')).map(name=>[name,quantiles(report.windows.filter(w=>w.name===name).map(w=>w.ms))]));
 const batches=[];for(let start=0;start<preps.length;start+=1000){const batch=preps.slice(start,start+1000);batches.push({firstDecision:batch[0].decision,lastDecision:batch.at(-1).decision,preparation:quantiles(batch.map(w=>w.ms)),over250ms:batch.filter(w=>w.ms>250).length,over1000ms:batch.filter(w=>w.ms>1000).length});}
 const slowest=[...preps].sort((a,b)=>b.ms-a.ms).slice(0,10).map(w=>({...w,nestedStages:trace.filter(t=>t.phase===w.phase&&t.decision===w.decision&&t.start>=w.start-.1&&t.end<=w.end+.1).map(t=>({name:t.name,ms:t.ms})).sort((a,b)=>b.ms-a.ms)}));
 scenarios.push({file,reportSHA256:hash(readFileSync(file)),sourceCommit:source.commit,source,initialHands:size,finalHands:size+report.completedHands,status:report.status,profiled:report.profiled,sustained:report.sustained??false,forcedGCCalls:report.forcedGCCalls??'Legacy recovery-stress mode: three forced GC calls per memory sample plus explicit reload GC',decisions:report.decisions,completedHands:report.completedHands,sessions:report.sessions,preparation:quantiles(preps.map(w=>w.ms)),policies:report.policies,seatDecisionCounts:report.seatDecisionCounts,streetCounts:report.streetCounts,over1000ms:preps.filter(w=>w.ms>1000).length,batches,slowest,separateWindows:stages,pendingReloads:report.reloads.length,independentFinancialAndStatisticsAgreement:report.financialAndStatisticsFullReplayAgreement,firstAccount:report.firstAccount,finalAccount:report.finalCompactAccount,initialStorage:report.initialStorage,finalStorage:report.finalStorage,memory:report.memory,environment:report.environment,methodology:report.methodology});
}
const result={format:'ai-texas-step5g-performance-evidence',status:'PASS',scenarios,scope:'Executed production-controller scenarios through a disk-backed IDB request reference, not native IndexedDB or browser/device/INP evidence. Profiled and unprofiled or forced-GC and sustained samples are not pooled. Original 10.072-second historical aggregate remains UNATTRIBUTED absent its missing per-decision trace. Nested phase durations must not be summed.',scenarioCount:scenarios.length,preparations:scenarios.reduce((n,s)=>n+s.decisions,0),completedHands:scenarios.reduce((n,s)=>n+s.completedHands,0),requirementsPassedByThisArtifact:0};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,scenarios:scenarios.length,preparations:result.preparations,hands:result.completedHands}));
