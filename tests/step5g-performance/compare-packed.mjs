import {mkdirSync,readFileSync,writeFileSync,existsSync,cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import path from 'node:path';
import console from 'node:console';

const [before,after,out,mode]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
assert(before&&after&&out);assert(!existsSync(out),'Refusing to overwrite retained-memory evidence');mkdirSync(out,{recursive:true});
const builds={before,after},sources={};
for(const [side,folder]of Object.entries(builds)){
 sources[side]=JSON.parse(readFileSync(path.join(folder,'source.json')));
 assert.equal(sources[side].dirtyTrackedInputs,'');
 assert.equal(sha(readFileSync(path.join(folder,'bundle.mjs.bin'))),sources[side].bundleSHA256);
 cpSync(folder,path.join(out,`${side}-build`),{recursive:true});
}
const rows=[];
for(let repeat=1;repeat<=3;repeat++)for(const side of ['before','after']){
 const folder=path.join(out,`${side}-${repeat}`),bundle=path.join(out,`${side}-build`,'bundle.mjs.bin');
 const run=spawnSync(process.execPath,['--expose-gc','--input-type=module','-',folder,'1000'],{input:readFileSync(bundle),encoding:'utf8',maxBuffer:2000000});
 mkdirSync(folder,{recursive:true});writeFileSync(path.join(folder,'execution.log'),run.stdout+run.stderr);assert.equal(run.status,0,run.stderr);
 const analysis=spawnSync('python',['tests/step5f-memory/analyze-profile.py',folder,'immutableNodes'],{encoding:'utf8',maxBuffer:2000000});writeFileSync(path.join(folder,'analysis.log'),analysis.stdout+analysis.stderr);assert.equal(analysis.status,0,analysis.stderr);
 const report=JSON.parse(readFileSync(path.join(folder,'report.json'))),retainers=JSON.parse(readFileSync(path.join(folder,'heap-retainers.json')));
 assert.equal(report.status,'PASS');assert.equal(report.count,1000);assert.deepEqual(report.samples.at(-1).reachable,mode==='write-only'?{rows:false,encoded:false}:{rows:false,decoded:false});
 const tableBytes=retainers.modulePrivatePackedTables.map(r=>r.cacheToTable.to.selfBytes);assert.equal(tableBytes.length,1);
 rows.push({side,repeat,path:folder,canonicalSHA256:report.canonicalSHA256,sourceSHA256:report.sourceSHA256,canonicalBytes:report.canonicalBytes,packedBytes:report.packedBytes,graphNodes:report.graphNodes,decodedNodesConstructed:report.decodedNodesConstructed,tableBytes:tableBytes[0],initialHeap:report.baseline.heapUsed,afterUnwindHeap:report.samples.at(-1).memory.heapUsed,latency:report.latency,weakRefsCollected:report.samples.at(-1).reachable});
 console.log(JSON.stringify(rows.at(-1)));
}
for(const row of rows)for(const key of ['canonicalSHA256','sourceSHA256','canonicalBytes','packedBytes','graphNodes','decodedNodesConstructed'])assert.equal(row[key],rows[0][key],`Matched packed profile differs: ${key}`);
const result={format:'ai-texas-packed-validation-comparison',status:'PASS',sources,rows,scope:mode==='write-only'?'Three independent processes per side, same1000canonicalrecords. Production packing plus independent reference decode verifies exact canonical bytes; no production public decode runs. WeakSet capacity follows actual V8 module-context edges after all fixture and encoded-string roots are collected. Only discarded validation-graph provenance entries change, not bounds or freezing. Not browser/gameplay memory or originalstallattribution.':'Three independent Node processes per side, alternating before/after. Same real 1k canonical records, same public packed encoding, exact canonical JSON and every returned decoded descendant checked. Module-private WeakSet capacity measured through V8 heap edges after eight explicit-GC/event-loop cycles; source roots and returned decoded roots collected. This is codec capacity evidence, not ordinary bot or browser latency and not a cause of the original10.072s outlier. Both versions still construct and freeze the temporary validation graph; only its discarded private-provenance cache entries change.'};
writeFileSync(path.join(out,'comparison.json'),JSON.stringify(result,null,2)+'\n');
