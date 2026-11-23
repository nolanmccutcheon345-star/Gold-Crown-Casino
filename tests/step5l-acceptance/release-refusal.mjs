/** Executes the unchanged production qualification gate against recovered evidence.
 * Output is kept in the recovery lane; no status, deployment or source is changed. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
import {parseCsv} from '../../scripts/step5d-audit-execution-links.mjs';
import {composeReleaseStatus,verifyCurrentCandidate} from '../../scripts/step5e-release-status.mjs';
import {recoverContext} from './review-recovered.mjs';
const option=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];};
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),ctx=recoverContext();
const receiptPath=option('--candidate-receipt','TEST_EVIDENCE/step5h/step5l-release/manifest.json'),auditPath=option('--qualification-audit','tests/step5l-acceptance/compatible-qualification.json'),output=option('--output','tests/step5l-acceptance/status-honesty-release-refusal.json');
assert(output.startsWith('tests/step5l-acceptance/')&&!output.includes('..'));
const receipt=json(receiptPath),audit=json(auditPath);
const sourceAtCommit=(commit,path)=>{assert(/^[a-f0-9]{40}$/.test(commit)&&!path.startsWith('/')&&!path.split('/').includes('..'));return execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:64*1024*1024});};
const errors=verifyCurrentCandidate(receipt,{read:ctx.read,exists:ctx.exists,sourceAtCommit});
if(audit.receipt.sha256!==sha(read(receiptPath)))errors.push('Audit references different receipt bytes');
const result=composeReleaseStatus({rows:parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),original:json('docs/specs/acceptance-source.json'),backlog:json('docs/specs/backlog-source.json'),candidateReceipt:receipt,qualifiedAudit:audit,candidateVerified:errors.length===0});
Object.assign(result,{at:new Date().toISOString(),candidateVerificationErrors:errors,gateSource:{path:'scripts/step5e-release-status.mjs',sha256:sha(read('scripts/step5e-release-status.mjs'))},compiledEvidence:'Actual retained packaging bytes independently matched fresh build; original missing Git object is not claimed.'});
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({decision:result.decision,qualificationUsable:result.qualificationUsable,candidateVerificationErrors:errors,unqualified:result.unqualifiedCriticalIds}));
if(process.argv.includes('--enforce')&&result.decision!=='READY_FOR_R1')process.exitCode=1;
