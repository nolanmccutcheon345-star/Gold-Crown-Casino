import process from 'node:process';
import {createHash} from 'node:crypto';
import console from 'node:console';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
const directory=process.argv[2],cpuPath=directory+'/run.cpuprofile';
if(!directory)throw new Error('Usage: node tests/step5c-stall/summarize-cpu.mjs <run-directory>');
const bundlePath=directory+'/run.bundle.mjs.gz',bundle=existsSync(bundlePath)?gunzipSync(readFileSync(bundlePath)):readFileSync('/tmp/step5c-stall-run.mjs');
if(!existsSync(bundlePath))writeFileSync(bundlePath,gzipSync(bundle));
const cpu=JSON.parse(existsSync(cpuPath)?readFileSync(cpuPath,'utf8'):gunzipSync(readFileSync(cpuPath+'.gz')).toString()),report=JSON.parse(readFileSync(directory+'/report.json','utf8')),lines=bundle.toString().split('\n');
let current='runtime';const modules=lines.map(line=>{if(/^\/\/ (src\/|tests\/|.*node_modules\/)/.test(line)){current=line.slice(3);if(current.includes('node_modules/'))current=current.slice(current.indexOf('node_modules/'));}return current;});
const nodes=new Map(cpu.nodes.map(node=>[node.id,node])),samples=[];let timestamp=cpu.startTime;const calibration=report.environment.clockCalibration;
for(let i=0;i<cpu.samples.length;i++){timestamp+=cpu.timeDeltas[i];const f=nodes.get(cpu.samples[i]).callFrame,module=f.url?.endsWith('step5c-stall-run.mjs')?modules[f.lineNumber]??'runtime':f.url??'runtime';samples.push({end:(timestamp-calibration.hrtimeMicroseconds)/1000+calibration.performanceNow,ms:cpu.timeDeltas[i]/1000,function:f.functionName||'(anonymous)',module});}
function top(list){const totals=new Map();for(const sample of list){const key=JSON.stringify([sample.function,sample.module]);totals.set(key,(totals.get(key)??0)+sample.ms);}return [...totals].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([key,ms])=>({function:JSON.parse(key)[0],module:JSON.parse(key)[1],ms}));}
const result={bundleSHA256:createHash('sha256').update(bundle).digest('hex'),cpuMilliseconds:cpu.timeDeltas.reduce((a,b)=>a+b,0)/1000,method:'Node --cpu-prof sampling (not instrumentation self-time); V8 monotonic microseconds aligned with process.hrtime and performance.now calibration. Boundary samples may straddle a measured window; errors bounded by sampling interval plus scheduler gaps. Function/module source map derived from retained esbuild bundle module markers.',firstSampleAtMs:samples[0]?.end,lastSampleAtMs:samples.at(-1)?.end,topSelfTime:top(samples),worstPreparations:report.worstPreparations.map(w=>({...w,cpuSamples:samples.filter(s=>s.end>=w.start&&s.end<=w.end).length,topSampledSelfTime:top(samples.filter(s=>s.end>=w.start&&s.end<=w.end))}))};
writeFileSync(directory+'/cpu-summary.json',JSON.stringify(result,null,2));if(existsSync(cpuPath))writeFileSync(cpuPath+'.gz',gzipSync(readFileSync(cpuPath)));console.log(JSON.stringify({cpuMilliseconds:result.cpuMilliseconds,topSelfTime:result.topSelfTime.slice(0,8),worst:result.worstPreparations.slice(0,3).map(w=>({ms:w.ms,gc:w.gcOverlapMs,samples:w.cpuSamples,top:w.topSampledSelfTime.slice(0,3)}))}));
