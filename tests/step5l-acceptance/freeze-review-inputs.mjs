/** Freeze non-circular review inputs. A review cannot use its own prior PASS. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import process from 'node:process';
const dir='tests/step5l-acceptance',kind=process.argv[2];assert(['status','provenance'].includes(kind));
const read=p=>JSON.parse(readFileSync(p)),audit=read(`${dir}/compatible-qualification.json`),exclude=kind==='status'?['Z12','V620']:['V620'];
for(const r of audit.requirements)if(exclude.includes(r.id))r.qualification={status:'NOT_QUALIFIED',errors:['Self-review is deliberately excluded from its own immutable input; no circular proof.']};
audit.qualifiedCount=audit.requirements.filter(r=>r.effectiveCriticalPass&&r.qualification.status==='QUALIFIED').length;
audit.selfReviewExclusions=exclude;
writeFileSync(`${dir}/${kind}-input-qualification.json`,JSON.stringify(audit,null,2)+'\n');
if(kind==='provenance'){
 const records=read(`${dir}/combined-records.json`);
 for(const r of records.requirements)if(exclude.includes(r.id)){r.reports=[];r.selfReviewExcluded=true;}
 writeFileSync(`${dir}/provenance-input-records.json`,JSON.stringify(records,null,2)+'\n');
}
