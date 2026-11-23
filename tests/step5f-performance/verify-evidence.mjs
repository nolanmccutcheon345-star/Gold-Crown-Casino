import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import path from 'node:path';
import console from 'node:console';
const root='tests/step5f-performance',hash=b=>createHash('sha256').update(b).digest('hex'),records=[];
for(const folder of ['baseline','candidate','fresh-checkpoint-baseline-profile','fresh-checkpoint-profile']){
 const dir=path.join(root,folder),source=JSON.parse(readFileSync(path.join(dir,'source.json')));assert.equal(hash(readFileSync(path.join(dir,'profile.mjs.bin'))),source.bundleSHA256);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('-report.json'))){const report=JSON.parse(readFileSync(path.join(dir,file)));assert.equal(report.status,'PASS');assert(report.financialAndStatisticsFullReplayAgreement);const lines=gunzipSync(readFileSync(path.join(dir,report.trace.path))).toString().trim().split('\n');assert.equal(lines.length,report.trace.rows);for(const p of Object.values(report.profiles)){const bytes=readFileSync(path.join(dir,p.path));assert.equal(hash(bytes),p.sha256);JSON.parse(gunzipSync(bytes));}records.push({folder,file,decisions:report.decisions,hands:report.completedHands,traceRows:lines.length,profiled:report.profiled});}
}
let maxFile={path:'',bytes:0};function inspect(dir){for(const name of readdirSync(dir)){const file=path.join(dir,name),stat=statSync(file);if(stat.isDirectory())inspect(file);else{assert(stat.size<24*1024*1024,`Evidence file exceeds24MiB:${file}`);if(stat.size>maxFile.bytes)maxFile={path:file,bytes:stat.size};}}}inspect(root);
const result={status:'PASS',scenarioCount:records.length,preparations:records.reduce((n,x)=>n+x.decisions,0),hands:records.reduce((n,x)=>n+x.hands,0),records,maxFile,scope:'Artifact checks only; scenario execution is recorded in each report. Not additional V7 acceptance IDs.'};writeFileSync(path.join(root,'artifact-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
