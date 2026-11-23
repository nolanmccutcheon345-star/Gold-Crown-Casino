/** Adapt the strict Step5L per-ID review to the existing release-gate format. */
import {readFileSync,writeFileSync} from 'node:fs';
import {sha} from '../../scripts/step5d-ci-plan.mjs';
import {parseCsv,effectivePass} from '../../scripts/step5d-audit-execution-links.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),dir='tests/step5l-acceptance';
const summary=json(`${dir}/summary.json`),items=json(`${dir}/execution-qualification.json`),rows=parseCsv(read('ACCEPTANCE_STATUS.csv').toString());
const requirements=items.map(item=>{const row=rows.find(r=>r.id===item.id);return {...item,gateBasis:row.r1_gate_basis,cashComponentStatus:row.r1_cash_component_status??'',effectiveCriticalPass:effectivePass(row),qualification:effectivePass(row)?item.result:{status:'NOT_REQUIRED_FOR_CURRENT_NONPASS',errors:[]}};});
const audit={format:'step5l-current-execution-qualification',version:1,originalRequirements:302,deferredFeatures:86,verifyBuild:true,candidateErrors:[],receipt:{...summary.receipt,sourceCommit:summary.executionSource},originalStatusCounts:summary.originalStatusCounts,qualifiedCount:summary.qualifiedCount,requirements,inputs:{path:`${dir}/execution-qualification.json`,sha256:sha(read(`${dir}/execution-qualification.json`))},runtimeAgreement:summary.runtimeAgreement};
writeFileSync(`${dir}/compatible-qualification.json`,JSON.stringify(audit,null,2)+'\n');
