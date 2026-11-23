import process from 'node:process';
import console from 'node:console';
import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out=process.argv[2],fixtureRoot=process.argv[3],sizes=(process.argv[4]??'100,1000,10000').split(',').map(Number),decisions=Number(process.argv[5]??1000);mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),bundle=path.resolve(out,'profile.mjs');
const built=await build({entryPoints:['tests/step5f-performance/profile.ts'],outfile:bundle,bundle:true,platform:'node',format:'esm',sourcemap:'external',metafile:true});
copyFileSync(bundle,bundle+'.bin');copyFileSync(bundle+'.map',bundle+'.map.bin');
const source={format:'step5f-profile-source',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),files:Object.fromEntries(Object.keys(built.metafile.inputs).filter(p=>p.startsWith('src/')||p.startsWith('tests/')).map(p=>[p,hash(readFileSync(p))])),bundleSHA256:hash(readFileSync(bundle)),profiled:process.env.STEP5F_PROFILE==='1',profiling:'Optional Node Inspector CPU1000us and allocation sampling32768bytes when STEP5F_PROFILE=1. Full timing/GC traces written outside measured ordinary-action windows. No production rewrites.'};
writeFileSync(path.join(out,'source.json'),JSON.stringify(source,null,2)+'\n');
const readyBundle=path.resolve(out,'prepare-ready.mjs');
if(process.env.STEP5F_READY_FIXTURE==='1'){await build({entryPoints:['tests/step5f-performance/prepare-ready.ts'],outfile:readyBundle,bundle:true,platform:'node',format:'esm'});copyFileSync(readyBundle,readyBundle+'.bin');source.readyBuilder={sha256:hash(readFileSync(readyBundle)),sourceSHA256:hash(readFileSync('tests/step5f-performance/prepare-ready.ts'))};writeFileSync(path.join(out,'source.json'),JSON.stringify(source,null,2)+'\n');}
for(const size of sizes){
 const dir=path.join(fixtureRoot,String(size));
 const prepare=spawnSync(process.execPath,['tests/step5f-performance/prepare-fixture.mjs',String(size),dir],{encoding:'utf8',maxBuffer:2e6});writeFileSync(path.join(out,`${size}-prepare.log`),prepare.stdout+prepare.stderr);if(prepare.status!==0)throw Error(prepare.stderr);
 if(process.env.STEP5F_READY_FIXTURE==='1'){const ready=spawnSync(process.execPath,[readyBundle,dir],{encoding:'utf8',maxBuffer:2e6});writeFileSync(path.join(out,`${size}-ready.log`),ready.stdout+ready.stderr);if(ready.status!==0)throw Error(ready.stderr);}
 const args=['--expose-gc','--max-old-space-size=6144',bundle,String(size),dir,path.resolve(out),String(decisions)],run=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:5e6});writeFileSync(path.join(out,`${size}-execution.log`),run.stdout+run.stderr);console.log(run.stdout);if(run.status!==0)throw Error(`size${size} exit${run.status}\n${run.stderr}`);
}
