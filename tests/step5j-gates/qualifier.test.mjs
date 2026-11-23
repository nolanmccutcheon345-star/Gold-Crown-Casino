/* global structuredClone */
import {test} from 'node:test';
import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyStep5JRetained5HBrowser} from './verify-retained-browser.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(readFileSync('TEST_EVIDENCE/step5h/release-bounded/manifest.json'));
const entry=JSON.parse(readFileSync('tests/step5j-gates/browser-index.json'))[0];
const sourceAtCommit=(c,p)=>execFileSync('git',['show',`${c}:${p}`]);
function run(change){
 const e=structuredClone(entry),overrides=new Map();
 const changeJSON=(path,fn)=>{const d=JSON.parse(readFileSync(path));fn(d);const b=Buffer.from(JSON.stringify(d));overrides.set(path,b);return sha(b);};
 change?.(e,changeJSON);
 return verifyStep5JRetained5HBrowser(e,receipt,{read:p=>overrides.get(p)??readFileSync(p),exists:()=>true,sourceAtCommit});
}
test('retained exact candidate browser capture qualifies with immutable source and compiled proof',()=>assert.equal(run().status,'QUALIFIED'));
test('rehashed browser record claiming another app commit is rejected',()=>{
 const result=run((e,edit)=>{e.capture.sha256=edit(e.capture.path,d=>{d.reports.find(r=>r.kind==='step5e-compiled-result').result.sourceCommit='0'.repeat(40);});});
 assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(x=>x.includes('candidate identity')));
});
test('rehashed capture missing a supported player count is rejected',()=>{
 const result=run((e,edit)=>{e.capture.sha256=edit(e.capture.path,d=>{d.reports=d.reports.filter(r=>r.name!=='start'||r.result.count!==10);});});
 assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(x=>x.includes('2–10')));
});
test('rehashed final duplicate cashout is rejected',()=>{
 const result=run((e,edit)=>{e.capture.sha256=edit(e.capture.path,d=>{d.reports.find(r=>r.check==='2–10 plus exact raise/custom-blind hands and exact single cashouts').final.cashouts=12;});});
 assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(x=>x.includes('cashouts')));
});
test('rehashed proof containing a different compiled JavaScript asset is rejected',()=>{
 const result=run((e,edit)=>{e.proof.sha256=edit(e.proof.path,d=>{d.assets[0].sha256='0'.repeat(64);});});
 assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(x=>x.includes('assets differ')));
});
test('unverified or changed harness bytes cannot certify an actual capture',()=>{
 const result=run(e=>{e.harnessHashes[Object.keys(e.harnessHashes)[0]]='0'.repeat(64);});
 assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(x=>x.includes('harness bytes differ')));
});
