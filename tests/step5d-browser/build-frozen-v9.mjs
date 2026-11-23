import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const commit='104b9d64b60276866a25f8bf65827efa65e1df2a';
const temporary=mkdtempSync(join(tmpdir(),'ai-texas-saved-v9-'));
const sha256=value=>createHash('sha256').update(value).digest('hex');
try{
 const archive=execFileSync('git',['archive','--format=tar',commit,'src','package.json'],{cwd:project,maxBuffer:20*1024*1024});
 execFileSync('tar',['-xf','-','-C',temporary],{input:archive});
 writeFileSync(join(temporary,'published-entry.ts'),[
  "export {mountApp} from './src/ui/app';",
  "export {BrowserPersistence} from './src/storage/browser';",
  "export {SessionController,DEFAULT_SETTINGS} from './src/session/controller';",
  "export {canonical,digest,validateData} from './src/storage/integrity';",
  "export {CashStatsProjection} from './src/stats/projection';",
  "export {observeTimings} from './src/performance/timing';",
  "export {POLICY_VERSION,supportedPolicy} from './src/bots/policy';",
 ].join('\n'));
 const output=join(project,'tests/browser/step5d-recovery-fixtures/saved-v9.js');mkdirSync(dirname(output),{recursive:true});
 const result=await build({absWorkingDir:temporary,entryPoints:['published-entry.ts'],outfile:output,bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,write:false,nodePaths:[join(project,'node_modules')],banner:{js:`// Frozen actual saved Version 9 source ${commit}.\n// Generated verification artifact only; never imported by the application.`}});
 const artifacts=[];for(const file of result.outputFiles){const destination=file.path+'.bin';writeFileSync(destination,file.contents);artifacts.push({path:relative(project,destination),sha256:sha256(file.contents),bytes:file.contents.length});}
 const sourceFiles=Object.fromEntries(Object.keys(result.metafile.inputs).filter(path=>path.startsWith('src/')).sort().map(path=>[path,sha256(readFileSync(join(temporary,path)))]));
 const manifest={format:'ai-texas-frozen-release-evidence',version:1,savedVersion:9,sourceCommit:commit,gitTree:execFileSync('git',['rev-parse',`${commit}^{tree}`],{cwd:project,encoding:'utf8'}).trim(),builder:'tests/step5d-browser/build-frozen-v9.mjs',archiveSHA256:sha256(archive),artifacts,sourceFiles};
 writeFileSync(join(project,'tests/browser/step5d-recovery-fixtures/saved-v9-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 process.stdout.write(JSON.stringify({sourceCommit:commit,sourceFiles:Object.keys(sourceFiles).length,artifacts})+'\n');
}finally{rmSync(temporary,{recursive:true,force:true});}
