/** Read-only original-ID/gate and local publication-evidence inventory. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {parseCsv} from '../../scripts/step5d-audit-execution-links.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
const output=process.argv[2];assert(output,'Supply a fresh output filename under tests/step5f-ci/evidence/');
assert(relative(process.cwd(),resolve(output)).startsWith('tests/step5f-ci/evidence/'));assert(!existsSync(output),'Do not overwrite prior evidence');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const rows=parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8')),original=json('docs/specs/acceptance-source.json'),future=json('docs/specs/backlog-source.json');
assert.equal(rows.length,302);assert.equal(new Set(rows.map(r=>r.id)).size,302);assert.equal(future.length,86);assert.equal(new Set(future.map(r=>r.id)).size,86);
for(const source of original){const row=rows.find(r=>r.id===source.id);assert(row);for(const[k,v]of Object.entries(source))assert.equal(row[k],v);}
const critical=rows.filter(r=>r.r1_blocking==='YES'),unqualified=critical.filter(r=>r.candidate_qualification!=='QUALIFIED');
const publications=['TEST_EVIDENCE/publication.json','TEST_EVIDENCE/step3/publication.json','TEST_EVIDENCE/step36/publication.json','TEST_EVIDENCE/step4a/publication.json','TEST_EVIDENCE/step4b/publication.json','TEST_EVIDENCE/step4c/publication.json','TEST_EVIDENCE/step5d/site-before-save.json','TEST_EVIDENCE/step5e/site-before-final-save.json','TEST_EVIDENCE/step5e/publication-before-final-save.json'].filter(existsSync);
const project=json('.openai/hosting.json').project_id;
const records=publications.map(path=>{const bytes=readFileSync(path),text=bytes.toString('utf8'),ids=[...new Set(text.match(/appgprj_[a-z0-9]+/g)??[])];return{path,sha256:hash(bytes),projectIds:ids,onlyExpectedProject:ids.length>0&&ids.every(id=>id===project)};});
assert(records.every(r=>r.onlyExpectedProject));
const report={format:'step5f-baseline-original-gate-audit',version:1,at:new Date().toISOString(),sourceCommit,registerSHA256:hash(readFileSync('ACCEPTANCE_STATUS.csv')),originalRequirements:302,deferredFeatures:86,originalStatusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length])),criticalCount:critical.length,currentQualificationCount:critical.filter(r=>r.candidate_qualification==='QUALIFIED').length,unqualifiedIds:unqualified.map(r=>r.id),unqualified:unqualified.map(r=>({id:r.id,criterion:r.acceptance,criterionSHA256:hash(r.acceptance),originalStatus:r.status,cashComponentStatus:r.r1_cash_component_status,candidateQualification:r.candidate_qualification,nextAction:r.candidate_next_action})),localProjectEvidence:{projectId:project,hostingConfigHistory:execFileSync('git',['log','--format=%H','--','.openai/hosting.json'],{encoding:'utf8'}).trim().split('\n'),publications:records},limitations:['This is the current register at the recorded source, not automatic qualification of later runtime edits.','Saved local publication records identify this project but are not a complete provider all-write audit.','No other project content was accessed to manufacture historical nonmutation evidence.','No hosted runner, device, human or browser test is performed by this audit.','U16/Z02 remain incomplete without provider historical write evidence; signed-off candidate deployment/smoke must follow release gates.']};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceCommit,originalRequirements:302,deferredFeatures:86,currentQualificationCount:report.currentQualificationCount,criticalCount:critical.length,unqualifiedIds:report.unqualifiedIds,localPublicationRecords:records.length,wholeU16Z02:'NOT_EXECUTED'}));
