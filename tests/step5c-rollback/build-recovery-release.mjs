import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),oldCommit='a0bfc0950771a6dc1b786e00c13be7f3485b8dcb',runtimeCommit='f54cacfb0aa3c861313b691e773a6716379c50a0';
const out=resolve(project,process.argv[2]??'tests/step5c-rollback/generated');
const temporary=mkdtempSync(join(tmpdir(),'ai-texas-v7-recovery-')),hash=value=>createHash('sha256').update(value).digest('hex');
try{
 const runtimeArchive=execFileSync('git',['archive','--format=tar',runtimeCommit,'src'],{cwd:project,maxBuffer:20*1024*1024});
 execFileSync('tar',['-xf','-','-C',temporary],{input:runtimeArchive});
 rmSync(join(temporary,'src/ui'),{recursive:true});
 const archive=execFileSync('git',['archive','--format=tar',oldCommit,'src/ui'],{cwd:project,maxBuffer:20*1024*1024});
 execFileSync('tar',['-xf','-','-C',temporary],{input:archive});
 writeFileSync(join(temporary,'recovery-entry.ts'),[
  "export {mountApp} from './src/ui/app';",
  "export {BrowserPersistence} from './src/storage/browser';",
  "export {SessionController,DEFAULT_SETTINGS} from './src/session/controller';",
  "export {canonical,digest,validateData} from './src/storage/integrity';",
  "export {POLICY_VERSION,supportedPolicy} from './src/bots/policy';",
 ].join('\n'));
 mkdirSync(out,{recursive:true});const output=join(out,'recovery.js');
 const built=await build({absWorkingDir:temporary,entryPoints:['recovery-entry.ts'],outfile:output,bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,nodePaths:[join(project,'node_modules')],banner:{js:`// V7-R emergency compatibility release: published V7 UI ${oldCommit}; frozen tested Version8 runtime ${runtimeCommit}.\n// Not the unchanged V7 release and not a data-schema downgrade.`}});
 const sourceFiles=Object.fromEntries(Object.keys(built.metafile.inputs).filter(path=>path.startsWith('src/')).sort().map(path=>[path,{origin:path.startsWith('src/ui/')?'published-v7':'saved-v8-runtime',sha256:hash(readFileSync(join(temporary,path)))}]));
 const manifest={format:'ai-texas-recovery-release',version:1,name:'V7-R',previousUICommit:oldCommit,recoveryRuntimeCommit:runtimeCommit,dataStrategy:'Frozen Version8 runtime supports latest schema4/envelope2 saves; no loss-producing downgrade and no restore over newer data.',builder:'tests/step5c-rollback/build-recovery-release.mjs',sourceFiles,bundleSHA256:hash(readFileSync(output)),cssSHA256:hash(readFileSync(join(out,'recovery.css')))};
 writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 writeFileSync(join(out,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Texas Hold Em — V7-R recovery</title><link rel="stylesheet" href="./recovery.css"></head><body><aside role="status" style="padding:12px;background:#fff2c8;color:#302000;font:16px system-ui">V7-R recovery release. Original Version 7 interface with the tested Version 8 save reader, engine and versioned policies. Existing history and current balances are preserved.</aside><div id="app"></div><script type="module">import {mountApp} from "./recovery.js";mountApp(document.getElementById("app"));</script></body></html>\n');
 mkdirSync(join(out,'.openai'),{recursive:true});const hosting=JSON.parse(readFileSync(join(project,'.openai/hosting.json'),'utf8'));hosting.static={directory:'.'};writeFileSync(join(out,'.openai/hosting.json'),JSON.stringify(hosting,null,2)+'\n');
 process.stdout.write(JSON.stringify({name:'V7-R',out:relative(project,out),sourceFiles:Object.keys(sourceFiles).length,v7UIFiles:Object.values(sourceFiles).filter(x=>x.origin==='published-v7').length,bundleSHA256:manifest.bundleSHA256,recoveryRuntimeCommit:manifest.recoveryRuntimeCommit})+'\n');
}finally{rmSync(temporary,{recursive:true,force:true});}
