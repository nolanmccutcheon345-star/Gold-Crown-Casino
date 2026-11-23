import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import {prepareIsolatedCandidate} from '../../scripts/prepare-isolated-candidate.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
async function fixture(run){
 const base=await mkdtemp(path.join(tmpdir(),'poker-isolation-'));
 const sourceRoot=path.join(base,'source'),targetRoot=path.join(base,'test-site'),packageDirectory=path.join(sourceRoot,'package');
 await mkdir(path.join(sourceRoot,'.openai'),{recursive:true});await mkdir(path.join(targetRoot,'.openai'),{recursive:true});
 await writeFile(path.join(sourceRoot,'.openai/hosting.json'),JSON.stringify({project_id:'fixture-production-only'}));
 await writeFile(path.join(targetRoot,'.openai/hosting.json'),JSON.stringify({project_id:'fixture-testing-only',static:{directory:'dist'}}));
 await cp(path.join(root,'tests/browser/step5f-candidate-checkpoint'),packageDirectory,{recursive:true});
 try{await run({sourceRoot,targetRoot,packageDirectory,expectedOrigin:'https://isolated.example.invalid'});}finally{await rm(base,{recursive:true,force:true});}
}
test('copies exact frozen application bytes into the separate registered Site only',()=>fixture(async input=>{
 const original=await readFile(path.join(input.sourceRoot,'.openai/hosting.json'));
 const result=await prepareIsolatedCandidate(input);
 assert.equal(result.candidateSource,'0f25769de66acb229803293781ab3d6cb5a558da');
 assert.ok(result.scope.includes(result.candidateSource));
 assert.equal(result.scope.includes('Version 12'),false);
 for(const asset of result.applicationAssets){const name=path.basename(asset.source)+'.bin';assert.deepEqual(await readFile(path.join(input.targetRoot,'dist',name)),await readFile(path.join(input.packageDirectory,name)));}
 assert.deepEqual(await readFile(path.join(input.sourceRoot,'.openai/hosting.json')),original);
 await assert.rejects(prepareIsolatedCandidate(input),/overwrite/);
}));
test('rejects using the same project ID',()=>fixture(async input=>{await writeFile(path.join(input.targetRoot,'.openai/hosting.json'),JSON.stringify({project_id:'fixture-production-only',static:{directory:'dist'}}));await assert.rejects(prepareIsolatedCandidate(input),/separately registered/);}));
test('rejects application checkout as target',()=>fixture(async input=>{await assert.rejects(prepareIsolatedCandidate({...input,targetRoot:input.sourceRoot}),/outside/);}));
test('rejects a target nested in the application checkout',()=>fixture(async input=>{const targetRoot=path.join(input.sourceRoot,'nested');await mkdir(targetRoot);await assert.rejects(prepareIsolatedCandidate({...input,targetRoot}),/outside/);}));
for(const origin of ['https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site','http://isolated.example.invalid','https://isolated.example.invalid/path'])test('rejects unsafe origin '+origin,()=>fixture(async input=>{await assert.rejects(prepareIsolatedCandidate({...input,expectedOrigin:origin}),/origin/);}));
test('rejects modified wrapper or application bytes',()=>fixture(async input=>{await writeFile(path.join(input.packageDirectory,'manual.js'),'changed');await assert.rejects(prepareIsolatedCandidate(input),/hash mismatch/);}));
test('rejects unreceipted candidate files',()=>fixture(async input=>{await writeFile(path.join(input.packageDirectory,'extra.js'),'extra');await assert.rejects(prepareIsolatedCandidate(input),/unreceipted/);}));
test('rejects a candidate symlink before reading its target',()=>fixture(async input=>{await symlink('/etc/passwd',path.join(input.packageDirectory,'leak'));await assert.rejects(prepareIsolatedCandidate(input),/symlinks/);}));
test('rejects a target dist symlink',()=>fixture(async input=>{await symlink(input.packageDirectory,path.join(input.targetRoot,'dist'));await assert.rejects(prepareIsolatedCandidate(input),/symlink/);}));
test('rejects missing registration or redirected static directory',()=>fixture(async input=>{await writeFile(path.join(input.targetRoot,'.openai/hosting.json'),JSON.stringify({project_id:'fixture-testing-only',static:{directory:'../source'}}));await assert.rejects(prepareIsolatedCandidate(input),/own dist/);}));
