import process from 'node:process';
import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import console from 'node:console';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
const folder=process.argv[2],size=Number(process.argv[3]),output=process.argv[4];
const report=JSON.parse(readFileSync(path.join(folder,`${size}-report.json`)));
const trace=gunzipSync(readFileSync(path.join(folder,report.trace.path))).toString().trim().split('\n').map(JSON.parse);
const q=v=>{v.sort((a,b)=>a-b);const at=p=>v[Math.max(0,Math.ceil(v.length*p)-1)]??null;return{samples:v.length,p50:at(.5),p95:at(.95),p99:at(.99),max:v.at(-1)??null};};
const prep=report.windows.filter(x=>x.name==='ordinary.bot.prepare').sort((a,b)=>b.ms-a.ms);
const slow=prep.slice(0,10).map(w=>({...w,nestedStages:trace.filter(t=>t.phase===w.phase&&t.decision===w.decision&&t.start>=w.start-.1&&t.end<=w.end+.1).map(t=>({name:t.name,ms:t.ms})).sort((a,b)=>b.ms-a.ms)}));
const result={report:path.join(folder,`${size}-report.json`),status:report.status,ordinaryPolicy:q(trace.filter(x=>x.phase==='ordinary.bot.prepare'&&x.name==='bot.policy').map(x=>x.ms)),slowestPreparation:slow,profiler:report.profiled,profileClockAnchors:report.cpuAnchors};
function profileBytes(meta){if(meta.path)return readFileSync(path.join(folder,meta.path));const parts=meta.parts.map(part=>{const bytes=readFileSync(path.join(folder,part.path));assert.equal(bytes.length,part.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256);return bytes;});const bytes=Buffer.concat(parts);assert.equal(bytes.length,meta.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);return bytes;}
if(report.profiled){
 const cpu=JSON.parse(gunzipSync(profileBytes(report.profiles.cpu)));const nodes=new Map(cpu.nodes.map(n=>[n.id,n]));
 const total=new Map(),phaseTotals=new Map();const win=[...report.windows].sort((a,b)=>a.start-b.start);let elapsed=0;
 const frame=n=>{const f=n.callFrame;return`${f.functionName||'(anonymous)'} @ ${f.url}:${f.lineNumber+1}`;};
 const at=t=>{let l=0,h=win.length-1,b=-1;while(l<=h){const m=(l+h)>>1;if(win[m].start<=t){b=m;l=m+1;}else h=m-1;}return b>=0&&win[b].end>=t?win[b].name:'outside measured operations';};
 for(let i=0;i<cpu.samples.length;i++){const ms=cpu.timeDeltas[i]/1000;elapsed+=ms;const label=frame(nodes.get(cpu.samples[i]));total.set(label,(total.get(label)??0)+ms);const phase=at(report.cpuAnchors.startAfter+elapsed),m=phaseTotals.get(phase)??new Map();phaseTotals.set(phase,m);m.set(label,(m.get(label)??0)+ms);}
 const top=m=>[...m].map(([frame,selfSampleMs])=>({frame,selfSampleMs})).sort((a,b)=>b.selfSampleMs-a.selfSampleMs).slice(0,35);
 const allocation=JSON.parse(gunzipSync(profileBytes(report.profiles.allocation)));const alloc=new Map();let allocationNodes=0;
 function walk(n){allocationNodes++;const f=n.callFrame,label=`${f.functionName||'(anonymous)'} @ ${f.url}:${f.lineNumber+1}`;alloc.set(label,(alloc.get(label)??0)+n.selfSize);for(const child of n.children??[])walk(child);}walk(allocation.head);
 result.cpu={samples:cpu.samples.length,recordedDurationMs:elapsed,topSelfFrames:top(total),byPhase:Object.fromEntries([...phaseTotals].map(([phase,values])=>[phase,top(values)])),clockCaveat:'Phase alignment uses profiler start-response performance.now; uncertainty bracket retained in cpuAnchors. Sampling attribution is approximate, not an exact instruction trace.'};
 result.allocations={samplingBytes:32768,includesCollectedObjects:true,nodes:allocationNodes,topSelfAllocationEstimates:[...alloc].map(([frame,estimatedBytes])=>({frame,estimatedBytes})).sort((a,b)=>b.estimatedBytes-a.estimatedBytes).slice(0,40),caveat:'Inspector sampled allocation estimates are not retained heap or steady-state memory. Separate post-GC snapshots and freeze retainer evidence address retention.'};
}
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,ordinaryPolicy:result.ordinaryPolicy,slowest:result.slowestPreparation[0]?.ms,profiled:result.profiler}));
