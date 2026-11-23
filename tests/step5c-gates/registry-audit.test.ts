import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
it('read-only evidence audit preserves all original criteria and does not equate file hashes with executed provenance',()=>{
 const directory=mkdtempSync(join(tmpdir(),'poker-gate-audit-')),path=join(directory,'audit.json'),before=readFileSync('ACCEPTANCE_STATUS.csv','utf8');try{execFileSync(process.execPath,['scripts/audit-r1-gate-evidence.mjs',path],{encoding:'utf8'});const report=JSON.parse(readFileSync(path,'utf8'));expect(report.requirements).toBe(302);expect(report.deferredFeatures).toBe(86);expect(report.references).toHaveLength(302);expect(report.missingReferences.filter((r:{status:string})=>r.status==='PASS')).toEqual([]);expect(report.unresolved).toContainEqual(expect.objectContaining({id:'V707',kind:'THREE_NEW_HUMAN_USERS'}));expect(report.scopeLimitations.join(' ')).toContain('not the source or runtime');expect(readFileSync('ACCEPTANCE_STATUS.csv','utf8')).toBe(before);}finally{rmSync(directory,{recursive:true,force:true});}
});
