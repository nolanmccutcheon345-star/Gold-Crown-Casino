import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';

// Independent CSV reader used only to inspect the generated/source registry.
function parseCsv(text:string):Record<string,string>[] {
 const lines:string[][]=[];let line:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(char===','||char==='\n')) {line.push(cell);cell='';if(char==='\n'){lines.push(line);line=[];}}
  else if(char!=='\r'||quoted)cell+=char;
 }
 if(cell||line.length){line.push(cell);lines.push(line);}
 const header=lines.shift()!;
 return lines.filter(line=>line.length>1).map(line=>Object.fromEntries(header.map((name,index)=>[name,line[index]])));
}
const source=()=>parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
const validate=(rows:Record<string,string>[])=>spawnSync(process.execPath,['scripts/build-r1-dashboard.mjs','--validate-stdin'],{input:JSON.stringify(rows),encoding:'utf8'});
const counts=(rows:Record<string,string>[])=>Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(status=>[status,rows.filter(row=>row.status===status).length]));

describe('Step5B original-ID acceptance accounting',()=>{
 it('has one unchanged criterion per original ID, preserves 302 requirements and 86 deferred features',()=>{
  const rows=source();const originals=JSON.parse(readFileSync('docs/specs/acceptance-source.json','utf8')) as Record<string,string>[];
  expect(rows).toHaveLength(302);expect(new Set(rows.map(row=>row.id)).size).toBe(302);
  for(const original of originals){const row=rows.find(row=>row.id===original.id)!;for(const key of ['id','scope','title','acceptance','source','source_status'])expect(row[key]).toBe(original[key]);}
  expect(execFileSync(process.execPath,['scripts/check-spec-integrity.mjs'],{encoding:'utf8'})).toContain('86 deferred features preserved');
 });
 it('derives every release-scope count from the exact same original status column',()=>{
  const rows=source();const result=validate(rows);expect(result.status,result.stderr).toBe(0);
  const summary=JSON.parse(result.stdout);expect(summary.status).toEqual(counts(rows));
  expect(summary.r1CriticalOriginalRequirements).toEqual(counts(rows.filter(row=>row.r1_blocking==='YES')));
  for(const status of Object.keys(summary.status))expect(summary.r1CriticalOriginalRequirements[status]).toBeLessThanOrEqual(summary.status[status]);
  expect(summary).not.toHaveProperty('r1CashGateStatus');
 });
 it('keeps six mixed criteria partial, without an alternate PASS status or changing original acceptance text',()=>{
  for(const row of source().filter(row=>['R11','M05','M11','X13','V407','V409'].includes(row.id))){
   expect(row.status).toBe('NOT_EXECUTED');expect(row.coverage_extent).toBe('PARTIAL_CASH_COMPONENT');
   expect(row.coverage_detail).toContain('Recorded cash-component evidence only');expect(row).not.toHaveProperty('r1_cash_gate_status');
  }
 });
 it('retains every one of the 18 original Step5A failures with its implementation dependency',()=>{
  const rows=source().filter(row=>row.step5a_status==='FAIL');
  expect(rows.map(row=>row.id).sort()).toEqual('D02 D08 D10 G04 U01 U04 U09 X09 X10 V408 V414 V421 V432 V505 V608 V612 V613 V706'.split(' ').sort());
  for(const row of rows){expect(row.dependencies).not.toBe('');expect(row.owner).not.toBe('');expect(row.next_action).not.toBe('');}
 });
 it('rejects duplicate IDs and rewritten original criteria instead of silently repairing them',()=>{
  const duplicate=source();duplicate[1]={...duplicate[0]};expect(validate(duplicate).status).not.toBe(0);
  const rewritten=source();rewritten[0].acceptance+=' waiver';const result=validate(rewritten);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Original acceptance changed');
 });
 it('rejects false PASS from partial coverage or missing evidence and forbids an alternate status universe',()=>{
  const partial=source();partial.find(row=>row.id==='R11')!.status='PASS';expect(validate(partial).stderr).toContain('Partial coverage is not whole-criterion PASS');
  const empty=source();empty.find(row=>row.status==='PASS')!.evidence='';expect(validate(empty).stderr).toContain('PASS needs executed evidence');
  const alternate=source();alternate[0].r1_cash_gate_status='PASS';expect(validate(alternate).stderr).toContain('Alternate status universe is forbidden');
 });
 it('generates byte-current derived views, with no active legacy JSON status overrides',()=>{
  expect(execFileSync(process.execPath,['scripts/build-r1-dashboard.mjs','--check'],{encoding:'utf8'})).toContain('r1CriticalOriginalRequirements');
  expect(readFileSync('R1_REQUIREMENTS.csv','utf8')).toBe(readFileSync('ACCEPTANCE_STATUS.csv','utf8'));
  const script=readFileSync('scripts/build-r1-dashboard.mjs','utf8');
  expect(script).not.toContain("json('tests/r1critical/coverage-updates.json')");
  expect(script).not.toContain("json('tests/r1critical/integration-updates.json')");
 });
});
