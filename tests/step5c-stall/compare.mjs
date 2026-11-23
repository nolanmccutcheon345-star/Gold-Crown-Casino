import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const labels=['baseline','optimized','public-freeze'];
const result={status:'PASS',method:'Three matched5000-decision runs with initial10000-hand canonical archive, sameentropy0x51c57a11 and SHA fallback capability. Comparisons assert exact financial endpoint, commitcount, completedhands and decisionstreet/seatcounts; this is not a retained full action-by-action transcript comparison. Walltime and garbage collection are measured, not normalized.',runs:{}};
let expected;
for(const label of labels){
 const directory=`tests/step5c-stall/evidence/${label}`,r=JSON.parse(readFileSync(directory+'/report.json','utf8')),trace=JSON.parse(gunzipSync(readFileSync(directory+'/trace.json.gz'))),start=r.recoveryWindows.find(x=>x.name==='initial.stats').end,end=r.recoveryWindows.find(x=>x.name==='pending.reload').start;
 const endpoint={final:r.final,occupied:r.occupied,streets:r.streets,completed:r.completedDuringWorkload,policyVersions:r.policyVersions};if(!expected)expected=endpoint;else assert.deepEqual(endpoint,expected);assert.equal(r.pendingRecoveryPassed,true);assert.equal(r.status,'PASS');
 result.runs[label]={sourceCommit:r.sourceCommit,preparation:r.preparation,publicMemory:r.stageLatency['bot.publicMemory'],eventLoop:r.gameplayLoop,cold:r.recoveryWindows.filter(w=>/controller.init|pending.reload/.test(w.name)),...endpoint};
 const worst=trace.heartbeats.filter(w=>w.start>=start&&w.end<=end).sort((a,b)=>b.ms-a.ms).slice(0,10).map(beat=>({...beat,operations:trace.windows.filter(w=>w.start<beat.end&&w.end>beat.start),gc:trace.gc.filter(w=>w.start<beat.end&&w.end>beat.start)}));
 writeFileSync(directory+'/responsiveness.json',JSON.stringify({method:'10ms Node heartbeat callback intervals; includes allgameplay operations andGC, not browserINP. Cold and finalfullaudit excluded.',worst},null,2));
}
writeFileSync('tests/step5c-stall/evidence/final-comparison.json',JSON.stringify(result,null,2));
