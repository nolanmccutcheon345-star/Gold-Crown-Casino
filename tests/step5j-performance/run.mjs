import process from 'node:process';
import console from 'node:console';
import {build} from 'esbuild';
import {mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(process.argv[2]);
const fixtureRoot=path.resolve(process.argv[3]);
if(existsSync(root))throw Error('Refusing to overwrite prior evidence');
mkdirSync(root,{recursive:true});
mkdirSync(path.join(fixtureRoot,'build'),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const bundle=path.join(fixtureRoot,'build','profile.mjs');
const compiled=await build({entryPoints:['tests/step5j-performance/profile.ts'],outfile:bundle,bundle:true,platform:'node',format:'esm',sourcemap:'external',metafile:true});
const ready=path.join(fixtureRoot,'build','prepare-ready.mjs');
await build({entryPoints:['tests/step5f-performance/prepare-ready.ts'],outfile:ready,bundle:true,platform:'node',format:'esm'});
copyFileSync(bundle,path.join(root,'profile.mjs.bin'));copyFileSync(bundle+'.map',path.join(root,'profile.mjs.bin.map'));copyFileSync(ready,path.join(root,'prepare-ready.mjs.bin'));
const source={format:'step5j-performance-source',applicationCommit:'138cdcf325129c69f127d0e16bc94942abea752f',repositoryHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),files:Object.fromEntries(Object.keys(compiled.metafile.inputs).filter(p=>p.startsWith('src/')||p.startsWith('tests/')).map(p=>[p,hash(readFileSync(p))])),bundleSHA256:hash(readFileSync(bundle)),readySHA256:hash(readFileSync(ready))};
for(const file of Object.keys(source.files).filter(x=>x.startsWith('src/')))if(hash(execFileSync('git',['show',`${source.applicationCommit}:${file}`]))!==source.files[file])throw Error(`Source differs from candidate: ${file}`);
writeFileSync(path.join(root,'source.json'),JSON.stringify(source,null,2)+'\n');
const scenarios=[{name:'1000-natural-1',size:1000,goal:1200},{name:'1000-natural-2',size:1000,goal:1200},{name:'1000-natural-3',size:1000,goal:1200},{name:'100-natural',size:100,goal:800},{name:'10000-natural',size:10000,goal:1200},{name:'1000-profiled',size:1000,goal:1200,profile:true},{name:'1000-reload-stress',size:1000,goal:500,stress:true}];
const results=[];
for(const s of scenarios){
 const out=path.join(root,s.name),fixture=path.join(fixtureRoot,s.name);mkdirSync(out);writeFileSync(path.join(out,'source.json'),JSON.stringify({...source,scenario:s,profiled:!!s.profile},null,2)+'\n');
 const invoke=(name,args,env=process.env)=>{const started=new Date().toISOString(),r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:8e6,env});writeFileSync(path.join(out,name+'.log'),r.stdout+r.stderr);writeFileSync(path.join(out,name+'-receipt.json'),JSON.stringify({started,finished:new Date().toISOString(),command:[process.execPath,...args],status:r.status,signal:r.signal,error:r.error?.message},null,2)+'\n');if(r.status!==0)throw Error(`${s.name} ${name} failed: ${r.status}; inspect log`);return r;};
 invoke('fixture-preparation',['tests/step5f-performance/prepare-fixture.mjs',String(s.size),fixture]);
 invoke('checkpoint-installation',[ready,fixture]);
 const r=invoke('execution',['--expose-gc','--max-old-space-size=4096',bundle,String(s.size),fixture,out,String(s.goal)],{...process.env,STEP5G_SUSTAINED:s.stress?'0':'1',STEP5F_PROFILE:s.profile?'1':'0',STEP5F_READY_FIXTURE:'1'});
 console.log(r.stdout);results.push({scenario:s.name,status:'PASS',report:path.relative(root,path.join(out,`${s.size}-report.json`))});writeFileSync(path.join(root,'executions.json'),JSON.stringify(results,null,2)+'\n');
}
