import process from 'node:process';
import console from 'node:console';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const source=resolve(process.argv[2]??'.'),out=resolve(process.argv[3]??'/tmp/step5d-final-profile.mjs'),here=process.cwd(),instrument=process.argv[4]==='instrument';
const entryPoint=source.endsWith('-baseline')?resolve(source,'tests/step5c-recovery/profile.ts'):resolve(here,'tests/step5d-recovery/profile.ts');
const seen={};
await build({entryPoints:[entryPoint],bundle:true,platform:'node',format:'esm',outfile:out,sourcemap:'external',plugins:[{name:'pinned-production-source',setup(b){
 b.onResolve({filter:/^\.\.\/\.\.\/src\//},args=>({path:resolve(source,'src',args.path.slice('../../src/'.length))+'.ts'}));
 b.onLoad({filter:/\/src\/.*\.ts$/},async args=>{
  let contents=await readFile(args.path,'utf8');seen[relative(source,args.path)]=createHash('sha256').update(contents).digest('hex');
  if(instrument&&args.path.endsWith('/storage/packed-hand.ts'))contents="import {timed as recoveryProfileTime} from '../performance/timing';\n"+contents.replace('return decodeGraph(JSON.parse(text),true);',"const parsed=recoveryProfileTime('recovery.graphJSONparse',()=>JSON.parse(text));return recoveryProfileTime('recovery.graphHydrate',()=>decodeGraph(parsed,true));");
  if(instrument&&args.path.endsWith('/storage/integrity.ts')){
   contents=contents.replace("import {timedAsync} from '../performance/timing';","import {timedAsync,timed} from '../performance/timing';");
   contents=contents.replace('const outerText=write(record),innerText=write(body);',"const [outerText,innerText]=timed('recovery.canonicalPair',()=>[write(record),write(body)]);");
   const a=contents.indexOf(' if(data.active){',contents.indexOf('export async function validateData'));
   const z=contents.indexOf(' requireData([...financialSessions.keys()]',a);
   if(a<0||z<0)throw Error('Active-state profiling anchor changed');contents=contents.slice(0,a)+" timed('recovery.activeState',()=>{\n"+contents.slice(a,z)+' });\n'+contents.slice(z);
  }
  return {contents,loader:'ts'};
 });
}}]});
const folder=resolve('tests/step5d-recovery/evidence/final-matrix');await mkdir(folder,{recursive:true});const name=source.endsWith('-baseline')?'baseline':'candidate';const bytes=await readFile(out);
await writeFile(resolve(folder,`${name}.bundle.mjs.gz`),gzipSync(bytes));await writeFile(resolve(folder,`${name}.bundle.mjs.map.gz`),gzipSync(await readFile(out+'.map')));
await writeFile(resolve(folder,`${name}.source.json`),JSON.stringify({source,sourceCommit:execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:seen,bundleSHA256:createHash('sha256').update(bytes).digest('hex'),instrumentation:instrument?'Read-only stage timers for graph JSON parse/hydration, paired canonical encoding and active state checks. No condition, state, seed or verification changes.':'Existing production timing callbacks only',harnessSHA256:createHash('sha256').update(await readFile(entryPoint)).digest('hex')},null,2));
console.log(JSON.stringify({out,source,name}));
