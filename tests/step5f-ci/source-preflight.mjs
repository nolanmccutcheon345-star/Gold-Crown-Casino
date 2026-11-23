/** Source bootstrap only; a successful local run is never hosted CI evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function inspectHistory(root,{providerSHA,requiredCommits=[]}={}){
 const commit=git(root,'rev-parse','HEAD'),tree=git(root,'rev-parse','HEAD^{tree}');
 assert.match(commit,/^[a-f0-9]{40}$/);
 assert.equal(git(root,'rev-parse','--is-shallow-repository'),'false','Historical provenance requires complete Git history; checkout fetch-depth must be0');
 if(providerSHA)assert.equal(commit,providerSHA,'Provider commit differs from checked-out source');
 for(const value of requiredCommits){assert.match(value,/^[a-f0-9]{40}$/);git(root,'cat-file','-e',`${value}^{commit}`);}
 return{commit,tree,history:'COMPLETE',requiredCommits};
}
export function sourcePreflight(root,output,{python='python3',providerSHA=process.env.GITHUB_SHA}={}){
 const target=resolve(root,output),rel=relative(root,target);
 assert(rel.startsWith('test-results/')&&!rel.split('/').includes('..'),'Output must be a new test-results path');
 assert(!existsSync(target),'Refusing to overwrite source-preflight evidence');
 const before=inspectHistory(root,{providerSHA}),statusBefore=git(root,'status','--porcelain');
 const manifestPath='tests/step5e-performance/source-preservation/manifest.json';
 const scriptPath='tests/step5e-performance/source-preservation/restore.py';
 const manifest=JSON.parse(readFileSync(resolve(root,manifestPath),'utf8'));
 inspectHistory(root,{providerSHA,requiredCommits:[manifest.unchangedRemoteAncestor]});
 const restored=JSON.parse(execFileSync(python,[scriptPath,'--git-dir',git(root,'rev-parse','--absolute-git-dir')],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
 assert.equal(restored.status,'PASS');assert.equal(restored.originalGitObjectsRestored,true);assert.equal(restored.branchOrWorkingTreeChanged,false);
 assert.equal(restored.originalHead,manifest.originalHead);
 const after=inspectHistory(root,{providerSHA,requiredCommits:[manifest.unchangedRemoteAncestor,manifest.originalHead]});
 assert.equal(before.commit,after.commit);assert.equal(before.tree,after.tree);assert.equal(statusBefore,git(root,'status','--porcelain'),'Historical bootstrap changed source files');
 const report={format:'step5f-source-bootstrap',version:1,status:'PASS',at:new Date().toISOString(),sourceCommit:after.commit,tree:after.tree,environment:{node:process.version,platform:process.platform,arch:process.arch},providerClaim:process.env.GITHUB_ACTIONS==='true'?{repository:process.env.GITHUB_REPOSITORY??null,sha:providerSHA,runId:process.env.GITHUB_RUN_ID??null,job:process.env.GITHUB_JOB??null}:null,history:after.history,restoration:restored,inputs:{[manifestPath]:hash(readFileSync(resolve(root,manifestPath))),[scriptPath]:hash(readFileSync(resolve(root,scriptPath)))},branchOrWorkingTreeChanged:false,hostedEvidence:'NOT_ESTABLISHED_BY_ENVIRONMENT; verify the actual provider run and artifacts separately'};
 mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const output=process.argv[2];assert(output,'Usage: node tests/step5f-ci/source-preflight.mjs test-results/bootstrap-JOB/manifest.json');const result=sourcePreflight(process.cwd(),output);console.log(JSON.stringify({status:result.status,sourceCommit:result.sourceCommit,history:result.history,originalGitObjectsRestored:result.restoration.originalGitObjectsRestored,hostedEvidence:result.hostedEvidence}));}
 catch(error){console.error(String(error));process.exitCode=1;}
}
