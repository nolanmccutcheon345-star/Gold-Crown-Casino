import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const commit='a0bfc0950771a6dc1b786e00c13be7f3485b8dcb';
const temporary=mkdtempSync(join(tmpdir(),'ai-texas-published-v7-'));
const sha256=value=>createHash('sha256').update(value).digest('hex');
try{
 const archive=execFileSync('git',['archive','--format=tar',commit,'src','package.json'],{cwd:project,maxBuffer:20*1024*1024});
 execFileSync('tar',['-xf','-','-C',temporary],{input:archive});
 writeFileSync(join(temporary,'published-entry.ts'),[
  "export {BrowserPersistence} from './src/storage/browser';",
  "export {SessionController,DEFAULT_SETTINGS} from './src/session/controller';",
  "export {canonical,digest,validateData} from './src/storage/integrity';",
  "export {POLICY_VERSION,supportedPolicy} from './src/bots/policy';",
 ].join('\n'));
 const output=join(project,'tests/browser/step5b-published-v7.js');mkdirSync(dirname(output),{recursive:true});
 const result=await build({absWorkingDir:temporary,entryPoints:['published-entry.ts'],outfile:output,bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,nodePaths:[join(project,'node_modules')],banner:{js:`// Frozen actual published Version 7 source ${commit}.\n// Generated verification artifact only; never imported by the application.`}});
 const sourceFiles=Object.fromEntries(Object.keys(result.metafile.inputs).filter(path=>path.startsWith('src/')).sort().map(path=>[path,sha256(readFileSync(join(temporary,path)))]));
 const manifest={format:'ai-texas-frozen-release-evidence',version:1,publishedVersion:7,sourceCommit:commit,gitTree:execFileSync('git',['rev-parse',`${commit}^{tree}`],{cwd:project,encoding:'utf8'}).trim(),builder:'tests/step5b-rollback/build-frozen-v7.mjs',archiveSHA256:sha256(archive),bundle:relative(project,output),bundleSHA256:sha256(readFileSync(output)),sourceFiles};
 writeFileSync(join(project,'tests/step5b-rollback/published-v7-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 process.stdout.write(JSON.stringify({sourceCommit:commit,sourceFiles:Object.keys(sourceFiles).length,bundleBytes:readFileSync(output).length,bundleSHA256:manifest.bundleSHA256})+'\n');
}finally{rmSync(temporary,{recursive:true,force:true});}
