/** Copy a verified test wrapper to an already registered, separate static Site. Never deploys. */
import {readFile,writeFile,mkdir,readdir,lstat,realpath,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const within=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
async function files(directory,prefix=''){
 const result=[];
 for(const entry of await readdir(path.join(directory,prefix),{withFileTypes:true})){
  const name=prefix?prefix+'/'+entry.name:entry.name;
  requireThat(!entry.isSymbolicLink(),'Candidate symlinks are forbidden');
  if(entry.isDirectory())result.push(...await files(directory,name));
  else{requireThat(entry.isFile(),'Candidate contains a non-regular file');result.push(name);}
 }
 return result.sort();
}
export async function prepareIsolatedCandidate({sourceRoot,packageDirectory,targetRoot,expectedOrigin}){
 sourceRoot=await realpath(sourceRoot);targetRoot=await realpath(targetRoot);packageDirectory=await realpath(packageDirectory);
 requireThat(!within(sourceRoot,targetRoot)&&!within(targetRoot,sourceRoot),'Testing Site must be outside the application checkout');
 requireThat(within(sourceRoot,packageDirectory),'Package must belong to the authoritative source checkout');
 const production=JSON.parse(await readFile(path.join(sourceRoot,'.openai/hosting.json'),'utf8'));
 const target=JSON.parse(await readFile(path.join(targetRoot,'.openai/hosting.json'),'utf8'));
 requireThat(typeof target.project_id==='string'&&target.project_id&&target.project_id!==production.project_id,'A separately registered testing Site is required');
 requireThat(target.static?.directory==='dist','Testing Site must use its own dist directory');
 const origin=new URL(expectedOrigin);
 requireThat(origin.protocol==='https:'&&origin.origin===expectedOrigin&&!origin.username&&!origin.password,'Use the exact HTTPS testing Site origin');
 requireThat(origin.origin!=='https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site','Production origin is forbidden');
 const packaged=JSON.parse(await readFile(path.join(packageDirectory,'PACKAGE_MANIFEST.json'),'utf8'));
 requireThat(packaged.format==='ai-texas-step5f-portable-package'&&packaged.status==='PACKAGE_BYTES_VERIFIED','Verified portable package required');
 const names=await files(packageDirectory),expected=[...Object.keys(packaged.files),'PACKAGE_MANIFEST.json'].sort();
 requireThat(JSON.stringify(names)===JSON.stringify(expected),'Package has missing or unreceipted files');
 const verified=new Map();
 for(const name of names){const bytes=await readFile(path.join(packageDirectory,name));if(name!=='PACKAGE_MANIFEST.json')requireThat(bytes.length===packaged.files[name].bytes&&hash(bytes)===packaged.files[name].sha256,'Package hash mismatch: '+name);verified.set(name,bytes);}
 const manifest=JSON.parse(verified.get('manifest.json').toString()),receipt=JSON.parse(verified.get('release-execution-receipt.json').toString());
 requireThat(receipt.status==='PASS'&&receipt.sourceCommit===packaged.candidateSource&&manifest.sourceCommit===receipt.sourceCommit,'Candidate execution identity disagrees');
 requireThat(hash(verified.get('release-execution-receipt.json'))===packaged.receiptSHA256&&packaged.receiptSHA256===manifest.executionReceiptSHA256,'Execution receipt hash disagrees');
 requireThat(manifest.assets.every(asset=>{const bytes=verified.get(asset.url.replace(/^\.\//,''));return bytes&&hash(bytes)===asset.sha256&&receipt.buildHashes[asset.source]===asset.sha256;}),'Compiled candidate bytes disagree with execution receipt');
 const dist=path.join(targetRoot,'dist');
 try{requireThat(!(await lstat(dist)).isSymbolicLink(),'Testing dist symlink forbidden');requireThat((await readdir(dist)).length===0,'Refusing to overwrite an existing testing deployment');}catch(error){if(error.code!=='ENOENT')throw error;}
 const staged=path.join(targetRoot,'.candidate-pending-'+process.pid);await mkdir(staged);
 try{
  for(const[name,bytes]of verified){await mkdir(path.dirname(path.join(staged,name)),{recursive:true});await writeFile(path.join(staged,name),bytes);}
  const provenance={format:'ai-texas-isolated-testing-site',version:1,projectId:target.project_id,expectedOrigin,candidateSource:manifest.sourceCommit,packageSHA256:hash(verified.get('PACKAGE_MANIFEST.json')),applicationAssets:manifest.assets.map(({source,sha256})=>({source,sha256})),productionProjectChanged:false,productionDataAccessed:false,access:'Owner-private at creation; hosting verification is separate.',scope:`Exact executed application bytes from ${manifest.sourceCommit} in an isolated review wrapper. No R1, physical-device, screen-reader or human-test PASS is inferred.`};
  await writeFile(path.join(staged,'ISOLATION.json'),JSON.stringify(provenance,null,2)+'\n');
  await rm(dist,{recursive:true,force:true});await rename(staged,dist);return provenance;
 }catch(error){await rm(staged,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const[sourceRoot,packageDirectory,targetRoot,expectedOrigin]=process.argv.slice(2);
 process.stdout.write(JSON.stringify(await prepareIsolatedCandidate({sourceRoot,packageDirectory,targetRoot,expectedOrigin}),null,2)+'\n');
}
