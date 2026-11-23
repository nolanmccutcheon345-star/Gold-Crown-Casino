/** Check the final review's immutable artifact links, including frozen inputs. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import console from 'node:console';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
import {recoverContext} from './review-recovered.mjs';
const dir='tests/step5l-acceptance',ctx=recoverContext(),seen=new Set(),failures=[];
const roots=['summary.json','execution-qualification.json','status-honesty-review.json','provenance-qualified-review.json','per-case-provenance.json','candidate-independent-review.json'];
if(existsSync(`${dir}/resource-qualified-review.json`)){
 execFileSync('python3',['tests/step5l-resource/artifacts.py','restore','tests/step5l-resource/evidence/full-10000'],{maxBuffer:1024*1024});
 roots.push('resource-qualified-review.json');
}
function check(value,location){
 if(!value||typeof value!=='object')return;
 if(typeof value.path==='string'&&/^[a-f0-9]{64}$/.test(value.sha256??'')){
  const key=value.path+':'+value.sha256;
  if(!seen.has(key)){seen.add(key);try{assert.equal(sha(ctx.read(value.path)),value.sha256);}catch(e){failures.push({location,path:value.path,error:e.message});}}
 }
 for(const [k,v]of Object.entries(value))check(v,location+'.'+k);
}
for(const name of roots)check(JSON.parse(readFileSync(`${dir}/${name}`)),name);
assert.deepEqual(failures,[],'Review contains changed/missing artifact references');
console.log(JSON.stringify({status:'PASS',rootReports:roots.length,verifiedUniqueArtifactReferences:seen.size,failures:0}));
