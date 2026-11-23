import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,unlinkSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
const folder=process.env.STEP5E_PROFILE_OUT??'tests/step5e-performance/evidence',sizes=(process.env.STEP5E_PROFILE_SIZES??'0,100,500,1000,5000,10000').split(',').map(Number),repeats=Number(process.env.STEP5E_PROFILE_REPEATS??3);
mkdirSync(folder,{recursive:true});const bundle=`${folder}/profile.bundle.mjs`,instrumentation=[];
function replace(source,from,to,label){if(source.split(from).length!==2)throw Error(`Profiling marker changed: ${label}`);instrumentation.push({file:'src/storage/verified.ts',label,from,to});return source.replace(from,to);}
const built=await build({entryPoints:['tests/step5e-performance/profile.ts'],outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,sourcemap:'external',plugins:[{name:'timing-only-checkpoint-stages',setup(build){build.onLoad({filter:/src\/storage\/verified\.ts$/},async args=>{
 let source=readFileSync(args.path,'utf8');
 source=replace(source,'  for(let i=0;i<data.ledger.length;i++){','  await timedAsync(\'profile.checkpoint.ledgerHashAndReplay\',async()=>{for(let i=0;i<data.ledger.length;i++){','ledger-stage-open');
 source=replace(source,"  requireData(cp.wallet===data.wallet,'Financial checkpoint wallet differs from independent ledger replay.');","  });\n  requireData(cp.wallet===data.wallet,'Financial checkpoint wallet differs from independent ledger replay.');",'ledger-stage-close');
 source=replace(source,'  for(const hand of context.handIndex){',"  await timedAsync('profile.checkpoint.financialIndex',async()=>{for(const hand of context.handIndex){",'index-stage-open');
 source=replace(source,"  requireData(cp.hands.size===cp.settlements.size,'Financial checkpoint settlement/history count differs.');","  });\n  requireData(cp.hands.size===cp.settlements.size,'Financial checkpoint settlement/history count differs.');",'index-stage-close');
 source=replace(source,'  for(let i=0;i<data.hands.length;i++){',"  await timedAsync('profile.checkpoint.residentHandHashAndValidation',async()=>{for(let i=0;i<data.hands.length;i++){",'resident-stage-open');
 source=replace(source,'  checkSessions(data,cp);validateConfigurationData(data);',"  });\n  checkSessions(data,cp);validateConfigurationData(data);",'resident-stage-close');
 source=replace(source,'  validatePublicMemoryCheckpoint(context.botMemory,context.handIndex,data.active?.sessionId??null);',"  timed('profile.checkpoint.botMemoryValidation',()=>validatePublicMemoryCheckpoint(context.botMemory,context.handIndex,data.active?.sessionId??null));\n  const statisticsStarted=performance.now();",'memory-and-stats-stage');
 source=replace(source,"  archiveContexts.set(data,context);checkpoints.set(data,cp);return data;","  timed('profile.checkpoint.statisticsMarker',()=>undefined);\n  (globalThis as typeof globalThis&{__step5eStatisticsTiming?:(ms:number)=>void}).__step5eStatisticsTiming?.(performance.now()-statisticsStarted);\n  archiveContexts.set(data,context);checkpoints.set(data,cp);return data;",'stats-stage-close');
 return{contents:source,loader:'ts'};
});}}]});
const hash=data=>createHash('sha256').update(data).digest('hex');
const inputs=Object.keys(built.metafile.inputs).filter(file=>file.startsWith('src/')||file.startsWith('tests/step5e-performance/'));
copyFileSync(bundle,bundle+'.bin');copyFileSync(bundle+'.map',bundle+'.map.bin');
const source={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAt:new Date().toISOString(),bundle:bundle+'.bin',runtimeBundlePath:bundle,bundleSHA256:hash(readFileSync(bundle)),files:Object.fromEntries(inputs.sort().map(file=>[file,hash(readFileSync(file))])),instrumentation,semantics:'Only stage timers added to copied bundle source; source files and all verification branches unchanged. Production recovery entry points execute without stubs or skipped verification. Exact compiled bundle retained as .bin; transient executable removed after profiling.'};writeFileSync(`${folder}/source.json`,JSON.stringify(source,null,2)+'\n');
const rows=[];
for(const size of sizes){
 const start=new Date().toISOString();const child=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=6144',path.resolve(bundle),String(size),String(repeats),folder],{encoding:'utf8',maxBuffer:50_000_000});
 writeFileSync(`${folder}/${size}.log`,child.stdout+child.stderr);if(child.status!==0)throw Error(`Profile ${size} failed: ${child.status}\n${child.stderr}\n${child.stdout}`);
 const report=JSON.parse(readFileSync(`${folder}/${size}.json`,'utf8'));rows.push({size,startedAt:start,finishedAt:new Date().toISOString(),...report.summary});writeFileSync(`${folder}/summary.json`,JSON.stringify({sourceCommit:source.commit,bundleSHA256:source.bundleSHA256,method:'Sequential actual production recovery paths, exact existing Step5D archives, native Node JSON-string reference, first10k sample CPU-profiled. Small-n quantiles are descriptive, not tail guarantees.',rows},null,2)+'\n');console.log(JSON.stringify(rows.at(-1)));
}
unlinkSync(bundle);unlinkSync(bundle+'.map');
