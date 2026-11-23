import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const builderProject=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
// An explicit project path permits preparation from the integrator checkout.
// The manifest binds its current source and dirty status, never this lane's HEAD.
const project=process.argv[3]?resolve(process.argv[3]):builderProject;
const reference='c2de7f98518c8400ccdf58339abb1ba27f1f3f78';
const selected=process.argv[2]??'candidate';
if(!['all','baseline','candidate'].includes(selected))throw Error('Choose all, baseline or candidate');
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
const sha=value=>createHash('sha256').update(value).digest('hex');
const directory=join(project,'tests/browser/step5f-fixtures');
mkdirSync(directory,{recursive:true});
for(const name of ['baseline','candidate'].filter(name=>selected==='all'||selected===name)){
 const temporary=mkdtempSync(join(tmpdir(),`ai-texas-step5f-${name}-`));
 try{
  const commit=name==='baseline'?reference:git('rev-parse','HEAD');
  let archiveSHA256=null;
  if(name==='baseline'){
   const archive=execFileSync('git',['archive','--format=tar',commit,'src','package.json'],{cwd:project,maxBuffer:24*1024*1024});
   archiveSHA256=sha(archive);execFileSync('tar',['-xf','-','-C',temporary],{input:archive});
  }else{cpSync(join(project,'src'),join(temporary,'src'),{recursive:true});cpSync(join(project,'package.json'),join(temporary,'package.json'));}
  writeFileSync(join(temporary,'verification-entry.ts'),[
   "export {mountApp} from './src/ui/app';",
   "export {BrowserPersistence} from './src/storage/browser';",
   "export {SessionController,DEFAULT_SETTINGS} from './src/session/controller';",
   "export {canonical,digest,validateData,parsePublicHistory} from './src/storage/integrity';",
   "export {CashStatsProjection} from './src/stats/projection';",
   "export {deriveCashStats} from './src/stats/cash';",
   "export {observeTimings} from './src/performance/timing';",
   "export {POLICY_VERSION,supportedPolicy} from './src/bots/policy';",
   ...(name==='candidate'?["export {assertAccounting,legalActions,projectView} from './src/core/engine';"]:[]),
  ].join('\n'));
  const output=join(directory,`${name}.js`);
  const result=await build({absWorkingDir:temporary,entryPoints:['verification-entry.ts'],outfile:output,bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,write:false,nodePaths:[join(project,'node_modules')],banner:{js:`// Isolated QA exports of actual ${name} production modules; never imported by the application.\n// Recorded source commit ${commit}; working production hashes bind candidate inputs.`}});
  const artifacts=[];
  for(const file of result.outputFiles){const destination=file.path+'.bin';writeFileSync(destination,file.contents);artifacts.push({path:relative(project,destination),sha256:sha(file.contents),bytes:file.contents.length});}
  const sourceFiles=Object.fromEntries(Object.keys(result.metafile.inputs).filter(path=>path.startsWith('src/')).sort().map(path=>[path,sha(readFileSync(join(temporary,path)))]));
  // Candidate is a snapshot of current inputs. The receipt explicitly records dirty
  // inputs; it never relabels uncommitted code as the HEAD implementation.
  const manifest={format:'ai-texas-step5f-runtime-provenance',version:1,name,savedVersion:name==='baseline'?11:null,sourceCommit:commit,gitTree:git('rev-parse',`${commit}^{tree}`),productionDirty:name==='candidate'?git('status','--short','--','src'):'',builder:'tests/step5f-browser/build-runtimes.mjs',builderSHA256:sha(readFileSync(fileURLToPath(import.meta.url))),sourceProject:project,archiveSHA256,artifacts,sourceFiles,preparedAt:new Date().toISOString(),executionStatus:'NOT_EXECUTED',scope:'Byte-verified exports of production modules for isolated recovery profiling. Not the dist entry-point artifact; exact compiled application workflows require prepare-compiled.mjs.'};
  writeFileSync(join(directory,`${name}-manifest.json`),JSON.stringify(manifest,null,2)+'\n');
  process.stdout.write(JSON.stringify({name,sourceCommit:commit,productionDirty:manifest.productionDirty,sourceFiles:Object.keys(sourceFiles).length,artifacts})+'\n');
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
