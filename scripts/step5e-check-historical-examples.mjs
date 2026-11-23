/** Exercise the historical verifier against real retained records, including two
 * expected refusals. These refusals are proof gaps, not newly failed poker tests. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import {sha} from './step5d-ci-plan.mjs';
import {parseCsv} from './step5d-audit-execution-links.mjs';
import {verifyHistoricalRequirement} from './step5e-historical-source.mjs';
const receiptPath='TEST_EVIDENCE/step5d/release-repaired/manifest.json',receipt=JSON.parse(readFileSync(receiptPath));
const original=JSON.parse(readFileSync('tests/step5d-gates/qualifications.json'));
const fresh=JSON.parse(readFileSync('tests/step5e-gates/evidence/exact-source/proposed-qualifications.json'));
const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
const entry={sourceCommit:receipt.sourceCommit,receipt:{path:receiptPath,sha256:sha(readFileSync(receiptPath))},buildArtifacts:Object.fromEntries(Object.keys(receipt.buildHashes).map(path=>[path,path]))};
const sourceCache=new Map();
const sourceAtCommit=(commit,path)=>{const key=`${commit}:${path}`;if(!sourceCache.has(key))sourceCache.set(key,execFileSync('git',['show',key],{maxBuffer:64*1024*1024}));return sourceCache.get(key);};
const checks=['A01','Y12','V601'].map(id=>{
 const row=rows.find(r=>r.id===id),record=(id==='A01'?original:fresh).requirements.find(r=>r.id===id);
 const result=verifyHistoricalRequirement(row,record,entry,{read:readFileSync,exists:existsSync,sourceAtCommit});
 if(id==='A01')assert.equal(result.status,'HISTORICAL_QUALIFIED');
 else {assert.equal(result.status,'NOT_QUALIFIED');assert(result.errors.some(error=>error.includes('Fixture does not match executed receipt')));}
 return{id,expected:id==='A01'?'HISTORICAL_QUALIFIED':'NOT_QUALIFIED',observed:result.status,assertion:'PASS',qualification:result};
});
const output='tests/step5e-gates/evidence/historical-examples.json';mkdirSync('tests/step5e-gates/evidence',{recursive:true});
writeFileSync(output,JSON.stringify({format:'step5e-real-historical-proof-examples',version:1,at:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:process.version,checks,qualificationBoundary:'A01 was already qualified. These checks add no original acceptance PASS. Expected Y12/V601 refusals preserve missing original fixture evidence; their new supplement remains bound to its actual newer execution. No prior capture is retagged.'},null,2)+'\n');
console.log(JSON.stringify({output,checks:checks.map(({id,expected,observed,assertion})=>({id,expected,observed,assertion}))}));
