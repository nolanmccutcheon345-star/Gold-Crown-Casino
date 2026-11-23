/** Package an executed candidate without rebuilding or altering application bytes. */
import {readFile,writeFile,mkdir,rename,rm,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import process from 'node:process';
import {build,version as esbuildVersion} from 'esbuild';

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const inside=(root,relative)=>{assert(typeof relative==='string'&&relative&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).some(p=>p==='..'||p===''),'Unsafe package path');return path.join(root,relative);};
const plainRead=async(root,relative)=>{const target=inside(root,relative);const segments=relative.split('/');for(let i=1;i<=segments.length;i++)assert(!(await lstat(path.join(root,...segments.slice(0,i)))).isSymbolicLink(),'Symlink forbidden: '+relative);return readFile(target);};
export async function verifyCandidate(root,receiptPath){
 assert(/^TEST_EVIDENCE\/[A-Za-z0-9_./-]+\/manifest\.json$/.test(receiptPath)&&!receiptPath.includes('..'),'Provide the executed release manifest under TEST_EVIDENCE.');
 const receiptBytes=await plainRead(root,receiptPath),receipt=JSON.parse(receiptBytes);
 assert(receipt.format==='ai-texas-ci-execution'&&receipt.mode==='release'&&receipt.status==='PASS','Executed successful release checks required');
 assert(/^[a-f0-9]{40}$/.test(receipt.sourceCommit)&&receipt.sourceCommitAtEnd===receipt.sourceCommit,'Unstable or invalid release source');
 assert(Array.isArray(receipt.changedInputs)&&!receipt.changedInputs.length&&Array.isArray(receipt.dirtyInputs)&&!receipt.dirtyInputs.length,'Release source inputs were not clean and stable');
 assert(['typecheck','lint','tests','paired-reference','build','specification','registry'].every(name=>receipt.checks?.some(check=>check.name===name&&check.status==='PASS'&&check.exitCode===0)),'Missing required executed release check');
 assert(receipt.testCounts?.total>0&&receipt.testCounts.passed===receipt.testCounts.total&&receipt.testCounts.failed===0&&receipt.testCounts.skipped===0,'Unsuccessful or incomplete automated release suite');
 const sourceHashes=Object.entries(receipt.sourceHashes??{}).filter(([name])=>name.startsWith('src/')||['index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json'].includes(name));
 assert(sourceHashes.some(([name])=>name==='src/main.ts')&&sourceHashes.some(([name])=>name==='package-lock.json'),'Missing production source provenance');
 for(const [source,expected]of sourceHashes)assert(sha(await plainRead(root,source))===expected,'Production input differs from executed source: '+source);
 const entries=Object.entries(receipt.buildHashes??{});assert(entries.some(([source])=>source==='dist/index.html'),'Missing compiled index');
 const assets=[];
 for(const[source,expected]of entries){assert(/^dist\/(?:index\.html|assets\/[A-Za-z0-9_.-]+\.(?:js|css))$/.test(source)&&/^[a-f0-9]{64}$/.test(expected),'Unsupported compiled artifact: '+source);const bytes=await plainRead(root,source);assert(sha(bytes)===expected,'Build changed after execution: '+source);assets.push({source,sha256:expected,bytes});}
 assert(assets.filter(a=>a.source.endsWith('.js')).length===1,'Expected one self-contained compiled application module');
 const html=assets.find(a=>a.source==='dist/index.html').bytes.toString();
 const references=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match=>'dist'+match[1]);
 assert(references.length===assets.length-1&&assets.filter(a=>a.source!=='dist/index.html').every(a=>references.includes(a.source)),'Compiled index and asset manifest disagree');
 const actualFiles=[];async function visit(dir){for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){const relative=dir+'/'+entry.name;assert(!entry.isSymbolicLink(),'Dist contains a symlink');if(entry.isDirectory())await visit(relative);else actualFiles.push(relative);}}await visit('dist');
 assert(actualFiles.length===entries.length&&actualFiles.every(name=>Object.hasOwn(receipt.buildHashes,name)),'Unreceipted or missing dist artifact');
 return{receipt,receiptBytes,assets};
}

export async function prepareCandidate(root,receiptPath,destination='tests/browser/step5f-candidate'){
 assert(destination.startsWith('tests/browser/step5f-candidate'),'Candidate output must use the dedicated test namespace');inside(root,destination);
 const verified=await verifyCandidate(root,receiptPath),{receipt,receiptBytes,assets}=verified;
 const output=inside(root,destination);try{await lstat(output);throw Error('Refusing to overwrite a previously prepared candidate');}catch(error){if(error.code!=='ENOENT')throw error;}
 const staging=output+`.pending-${process.pid}`;await mkdir(staging,{recursive:false});
 try{
  const lock=JSON.parse(await plainRead(root,'package-lock.json'));assert(lock.packages?.['node_modules/esbuild']?.version===esbuildVersion,'Wrapper builder differs from pinned lockfile');
  const buildResult=await build({absWorkingDir:root,entryPoints:['tests/browser/step5f-external.ts'],bundle:true,format:'esm',write:false,metafile:true});assert(buildResult.outputFiles.length===1,'Unexpected wrapper output');
  assert(Object.keys(buildResult.metafile.inputs).every(name=>!name.startsWith('src/')),'Manual observer must not import production internals');
  await writeFile(path.join(staging,'manual.js'),buildResult.outputFiles[0].contents);
  const wrapperHTML=(await plainRead(root,'tests/browser/step5f-external.html')).toString();assert(wrapperHTML.includes('src="./step5f-external.ts"'),'Wrapper entry mismatch');await writeFile(path.join(staging,'index.html'),wrapperHTML.replace('src="./step5f-external.ts"','src="./manual.js"').replace('id="app"','id="app" data-external-manifest="./manifest.json"'));
  const manifestAssets=[];
  for(const asset of assets){const name=path.basename(asset.source)+'.bin';await writeFile(path.join(staging,name),asset.bytes);manifestAssets.push({source:asset.source,url:'./'+name,sha256:asset.sha256,bytes:asset.bytes.length});}
  const manifest={format:'ai-texas-step5f-exact-compiled-candidate',version:1,status:'BUILD_BYTES_VERIFIED',sourceCommit:receipt.sourceCommit,executionReceipt:receiptPath,executionReceiptSHA256:sha(receiptBytes),preparedAt:new Date().toISOString(),assets:manifestAssets,scope:'Exact executed dist bytes; candidate packaging is not deployment, human testing or release approval.'};
  await writeFile(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(path.join(staging,'release-execution-receipt.json'),receiptBytes);
  for(const name of ['QUICK_START.md','PHONE_CHECKLIST.md','SCREEN_READER.md','NEW_USER_STUDY.md','INVITATION.md','FEEDBACK_FORM.md','three-user-results-template.json','device-reader-results-template.json','hand-observation-form.csv','serve_candidate.py','PORTABLE_CANDIDATE.md'])await writeFile(path.join(staging,name),await plainRead(root,'tests/step5f-external/'+name));
  const files={};async function record(dir=''){for(const entry of await readdir(path.join(staging,dir),{withFileTypes:true})){const relative=dir?dir+'/'+entry.name:entry.name;if(entry.isDirectory())await record(relative);else{const bytes=await readFile(path.join(staging,relative));files[relative]={sha256:sha(bytes),bytes:bytes.length};}}}await record();
  const provenance={format:'ai-texas-step5f-portable-package',version:1,status:'PACKAGE_BYTES_VERIFIED',candidateSource:receipt.sourceCommit,packagingSource:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),receiptSHA256:sha(receiptBytes),builder:{name:'esbuild',version:esbuildVersion,lockSHA256:sha(await plainRead(root,'package-lock.json'))},wrapperInputs:Object.fromEntries(await Promise.all(Object.keys(buildResult.metafile.inputs).filter(name=>name.startsWith('tests/')).map(async name=>[name,sha(await plainRead(root,name))]))),files,access:'No hosted URL has been created. Serve separately from production; see PORTABLE_CANDIDATE.md.',physicalDeviceTests:'NOT_EXECUTED',screenReaderTests:'NOT_EXECUTED',humanParticipants:0};
  await writeFile(path.join(staging,'PACKAGE_MANIFEST.json'),JSON.stringify(provenance,null,2)+'\n');
  await rename(staging,output);
  const zip=output+'.zip';try{await lstat(zip);throw Error('Refusing to overwrite an existing ZIP');}catch(error){if(error.code!=='ENOENT')throw error;}
  execFileSync('python',['-c',"import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); archive=zipfile.ZipFile(sys.argv[2],'x',zipfile.ZIP_DEFLATED); [archive.write(p,p.relative_to(root)) for p in sorted(root.rglob('*')) if p.is_file()]; archive.close()",output,zip]);
  const zipBytes=await readFile(zip);const result={status:'PACKAGE_BYTES_VERIFIED',sourceCommit:receipt.sourceCommit,packageDirectory:destination,zip:destination+'.zip',zipSHA256:sha(zipBytes),zipBytes:zipBytes.length,manifestSHA256:sha(await readFile(path.join(output,'PACKAGE_MANIFEST.json'))),browserExecution:'NOT_EXECUTED by packaging'};await writeFile(output+'.receipt.json',JSON.stringify(result,null,2)+'\n');return result;
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.stdout.write(JSON.stringify(await prepareCandidate(root,process.argv[2],process.argv[3]),null,2)+'\n');}
