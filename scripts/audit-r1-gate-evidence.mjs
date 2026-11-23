/** Read-only current-registry audit. File presence is not a proof of execution. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {evaluateR1Release} from './r1-release-gate.mjs';
const root=process.cwd(),output=process.argv[2]??'tests/step5c-gates/evidence/gate-audit.json';
function csv(text){let row=[],cell='',quoted=false;const rows=[];for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}if(quoted)throw Error('Unterminated CSV');const keys=rows.shift();return rows.filter(r=>r.some(Boolean)).map(r=>{if(r.length!==keys.length)throw Error('Bad columns');return Object.fromEntries(keys.map((key,i)=>[key,r[i]]));});}
const read=p=>readFileSync(resolve(root,p)),hash=p=>createHash('sha256').update(read(p)).digest('hex'),rows=csv(read('ACCEPTANCE_STATUS.csv').toString()),original=JSON.parse(read('docs/specs/acceptance-source.json').toString()),backlog=JSON.parse(read('docs/specs/backlog-source.json').toString());
if(rows.length!==302||new Set(rows.map(r=>r.id)).size!==302||backlog.length!==86)throw Error('Original register cardinality changed');
for(const spec of original){const row=rows.find(r=>r.id===spec.id);for(const[k,v]of Object.entries(spec))if(row?.[k]!==v)throw Error(`Original criterion changed: ${spec.id}.${k}`);}
const boundary={
 F10:{kind:'EXECUTABLE_STRATEGIC_DIAGNOSTIC',needed:'Independent predeclared dangerous-river size/line utility comparison; retain sensitivity and negative cells.'},
 U10:{kind:'ACCESSIBILITY_EXECUTION',needed:'Keyboard-only actions and actual assistive-technology announcement session; DOM/ARIA checks alone are partial.'},
 U11:{kind:'PHYSICAL_DEVICE',needed:'Named physical phone/desktop compute, rendering and input-confirm measurements.'},
 U16:{kind:'HISTORICAL_PROVIDER_AUDIT',needed:'Complete historical all-write audit plus identity/deploy evidence; do not modify other sites to manufacture it.'},
 Y10:{kind:'EXECUTABLE_ECOLOGY_AND_SCOPE_REVIEW',needed:'Continuous six/nine-seat stack/rebuy dynamics and complete-hand inspection; FUT032 remains deferred and whole criterion unexecuted.'},
 Z02:{kind:'HISTORICAL_PROVIDER_AUDIT',needed:'Original-site nonmutation evidence plus signed-off deployment/source and actual smoke.'},
 Z03:{kind:'MIGRATION_ROLLBACK_IMPLEMENTATION',needed:'Test a usable prior-release recovery path preserving both pre- and post-upgrade events, not merely safe refusal.'},
 Z12:{kind:'PER_RESULT_PROVENANCE',needed:'Every status linked to real build/evidence; exact source/inputs/expected-observed retained.'},
 V436:{kind:'DISCLOSURE_AND_IMPORT_WORKFLOW',needed:'Practice/no-RTA/no-real-money declaration, rights-gated external ingestion, no live-poker integration.'},
 V513:{kind:'PHYSICAL_MOBILE_LIFECYCLE',needed:'Actual mobile OS suspend/tab kill while thinking and at settlement with exact committed-state recovery.'},
 V518:{kind:'DEVICE_AND_ASSISTIVE_TECHNOLOGY',needed:'Declared reference-device 2/6/10 timing/memory/errors and keyboard/screen-reader/color-independent labels.'},
 V522:{kind:'EXECUTED_CI_AND_PROVENANCE',needed:'Actual CI enforcement receipt plus runnable critical fixtures and exact build/seed/evidence; workflow YAML alone is not execution.'},
 V620:{kind:'PER_RESULT_PROVENANCE',needed:'Audit each passing critical result against its actual build, versions, input/seed, expected/observed, runtime and artifact; do not retroassign current hashes.'},
 V707:{kind:'THREE_NEW_HUMAN_USERS',needed:'Three actual new users, declared devices, 25 hands each, comprehension and actual misclick/ambiguity records.'},
};
const release=evaluateR1Release(rows),references=rows.map(row=>{const paths=[...new Set([row.evidence,row.r1_cash_component_evidence].flatMap(s=>s.split(';').map(p=>p.trim()).filter(Boolean)))];return{id:row.id,status:row.status,releaseScope:row.release_scope,critical:row.r1_blocking==='YES',references:paths.map(path=>({path,exists:existsSync(resolve(root,path)),sha256:existsSync(resolve(root,path))?hash(path):null}))};}),missing=references.flatMap(r=>r.references.filter(f=>!f.exists).map(f=>({id:r.id,status:r.status,path:f.path})));
const result={format:'step5c-original-requirement-audit-v1',capturedAt:new Date().toISOString(),auditSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),registrySha256:hash('ACCEPTANCE_STATUS.csv'),originalSha256:hash('docs/specs/acceptance-source.json'),requirements:302,deferredFeatures:86,statusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length])),releaseDecision:release.decision,unresolved:release.blockers.map(b=>{const row=rows.find(r=>r.id===b.id);return{...b,originalTitle:row.title,originalAcceptance:row.acceptance,...boundary[b.id],evidence:row.evidence,observedDefect:row.observed_defect,owner:row.owner,nextAction:row.next_action};}),references,missingReferences:missing,scopeLimitations:['This audit runs no poker, browser, physical-device, human or CI test.','Hashes capture currently available evidence bytes, not the source or runtime that originally produced an artifact.','PASS rows retain their recorded status; existing files alone do not fill a missing original provenance field.','Unexecuted physical iPhone Safari export remains AWAITING USER VERIFICATION.']};
mkdirSync(dirname(resolve(root,output)),{recursive:true});writeFileSync(resolve(root,output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,requirements:302,deferredFeatures:86,statusCounts:result.statusCounts,releaseDecision:result.releaseDecision,unresolved:result.unresolved.map(r=>r.id),missingReferences:missing},null,2));if(missing.some(r=>r.status==='PASS'))process.exitCode=1;
