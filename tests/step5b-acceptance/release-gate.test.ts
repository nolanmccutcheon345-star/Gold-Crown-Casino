import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
function source(){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;const text=readFileSync('ACCEPTANCE_STATUS.csv','utf8');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)cell+=c;}const keys=rows.shift()!;return rows.filter(r=>r.length===keys.length).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));}
const run=(rows:Record<string,string>[])=>spawnSync(process.execPath,['scripts/build-r1-dashboard.mjs','--validate-stdin','--release-check'],{input:JSON.stringify(rows),encoding:'utf8'});
/** Hypothetical registry only, never persisted or used as real acceptance.
 * It isolates release logic from the candidate's genuine unresolved checks. */
function hypotheticalVerifiedCash(){return source().map(original=>{
 // Both independent gate layers must be hypothetically verified. Inheriting
 // the real candidate's missing evidence would no longer isolate this fixture.
 const row=original.r1_blocking==='YES'?{...original,candidate_qualification:'QUALIFIED',candidate_evidence:'TEST_FIXTURE_ONLY_NOT_REAL_EXECUTION',candidate_next_action:'Synthetic gate-input fixture only; never a real release claim.'}:original;
 if(row.r1_blocking==='YES'&&row.r1_gate_basis==='ORIGINAL_WHOLE_CRITERION')return{...row,status:'PASS',coverage_extent:'WHOLE_CRITERION',evidence:'TEST_FIXTURE_ONLY_NOT_REAL_EXECUTION',notes:'Synthetic gate-input fixture, never written into the canonical registry.'};
 if(row.r1_gate_basis==='EXPLICIT_MIXED_CASH_COMPONENT')return{...row,r1_cash_component_status:'PASS',r1_cash_component_evidence:'TEST_FIXTURE_ONLY_NOT_REAL_EXECUTION'};
 return row;
});}
describe('V601/V522 component-aware R1 gate without inflating original coverage',()=>{
 it('currently exits nonzero for real unresolved cash requirements, preserving exact original counts',()=>{
  const rows=source(),before=readFileSync('ACCEPTANCE_STATUS.csv','utf8'),result=run(rows);expect(result.status).toBe(1);const report=JSON.parse(result.stdout);expect(report.releaseGate.decision).toBe('NOT_READY_FOR_R1');expect(report.releaseGate.blockers.length).toBeGreaterThan(0);
  expect(report.status.PASS).toBe(rows.filter(r=>r.status==='PASS').length);expect(report.releaseGate.verifiedCashComponents).toBe(rows.filter(r=>r.r1_gate_basis==='EXPLICIT_MIXED_CASH_COMPONENT'&&r.r1_cash_component_status==='PASS').length);expect(report.releaseGate.componentChecks.every((r:{originalStatus:string})=>r.originalStatus==='NOT_EXECUTED')).toBe(true);expect(readFileSync('ACCEPTANCE_STATUS.csv','utf8')).toBe(before);
 });
 it('can allow R1 with all later tournament checks unexecuted and only explicit mixed cash components verified',()=>{
  const rows=hypotheticalVerifiedCash();for(const r of rows)if(r.release_scope==='R2 single-table tournament'||r.release_scope==='R3 multi-table tournament')r.status='NOT_EXECUTED';
  const result=run(rows);expect(result.status,result.stderr).toBe(0);const report=JSON.parse(result.stdout);expect(report.releaseGate.decision).toBe('READY_FOR_R1');expect(report.releaseGate.blockers).toEqual([]);expect(report.status.PASS).toBe(rows.filter(r=>r.status==='PASS').length);expect(report.r1CriticalOriginalRequirements.PASS).toBeLessThanOrEqual(report.status.PASS);expect(report.releaseGate.componentChecks).toHaveLength(9);
  expect(report.candidateEvidenceGate.decision).toBe('READY_FOR_R1');expect(report.candidateEvidenceGate.unqualifiedIds).toEqual([]);
 });
 it.each(['D02','U10','U11','U16','Z02','Z14','V518','V522','V707'])('blocks historical whole/cash PASS with current NOT_QUALIFIED evidence for %s',id=>{
  const before=readFileSync('ACCEPTANCE_STATUS.csv','utf8'),rows=hypotheticalVerifiedCash(),row=rows.find(r=>r.id===id)!;
  expect(row.r1_blocking).toBe('YES');if(id==='Z14'){expect(row.status).toBe('NOT_EXECUTED');expect(row.r1_cash_component_status).toBe('PASS');}else expect(row.status).toBe('PASS');
  row.candidate_qualification='NOT_QUALIFIED';row.candidate_next_action='Synthetic missing current execution; historical status must not bypass this gate.';
  const result=run(rows),report=JSON.parse(result.stdout);expect(result.status).toBe(1);expect(report.releaseGate.decision).toBe('READY_FOR_R1');expect(report.releaseGate.blockers).toEqual([]);
  expect(report.candidateEvidenceGate.decision).toBe('NOT_READY_FOR_R1');expect(report.candidateEvidenceGate.unqualifiedIds).toEqual([id]);expect(report.status.PASS).toBe(rows.filter(r=>r.status==='PASS').length);
  expect(readFileSync('ACCEPTANCE_STATUS.csv','utf8')).toBe(before);
 });
 it.each(['FAIL','BLOCKED','NOT_EXECUTED'])('blocks an ordinary required cash criterion with %s without treating suite counts as evidence',status=>{
  const rows=hypotheticalVerifiedCash(),row=rows.find(r=>r.id==='D02')!;row.status=status;row.observed_defect='Synthetic missing seat configuration';row.next_action='Execute the mandatory exact cash criterion';const result=run(rows);expect(result.status).toBe(1);expect(JSON.parse(result.stdout).releaseGate.blockers).toContainEqual(expect.objectContaining({id:'D02',status}));
 });
 it.each(['FAIL','BLOCKED','NOT_EXECUTED'])('blocks an explicit mixed row whose actual cash subcheck is %s',status=>{
  const rows=hypotheticalVerifiedCash();rows.find(r=>r.id==='V407')!.r1_cash_component_status=status;const result=run(rows);expect(result.status).toBe(1);expect(JSON.parse(result.stdout).releaseGate.blockers).toContainEqual(expect.objectContaining({id:'V407',status,basis:'EXPLICIT_MIXED_CASH_COMPONENT'}));
 });
 it('keeps full Y10 unexecuted while accepting only the independently verified cash component governed by FUT032',()=>{
  const rows=source(),row=rows.find(r=>r.id==='Y10')!;expect(row.status).toBe('NOT_EXECUTED');expect(row.r1_gate_basis).toBe('EXPLICIT_MIXED_CASH_COMPONENT');expect(row.r1_cash_component_status).toBe('PASS');expect(row.scope_split).toContain('FUT032');const actual=run(rows);expect(actual.status).toBe(1);expect(JSON.parse(actual.stdout).releaseGate.blockers.map((b:{id:string})=>b.id)).not.toContain('Y10');const missing=hypotheticalVerifiedCash();missing.find(r=>r.id==='Y10')!.r1_cash_component_status='NOT_EXECUTED';const refusal=run(missing);expect(refusal.status).toBe(1);expect(JSON.parse(refusal.stdout).releaseGate.blockers).toContainEqual(expect.objectContaining({id:'Y10'}));
 });
 it('cannot hide a new whole-row failure behind an earlier cash-component PASS',()=>{
  const rows=hypotheticalVerifiedCash(),row=rows.find(r=>r.id==='M11')!;row.status='FAIL';row.observed_defect='Synthetic duplicate cash top-up';const result=run(rows);expect(result.status).toBe(1);expect(JSON.parse(result.stdout).releaseGate.blockers).toContainEqual(expect.objectContaining({id:'M11',status:'FAIL'}));
 });
 it('blocks required external human/device checks even when every executable cash check passes',()=>{
  const rows=hypotheticalVerifiedCash();rows.find(r=>r.id==='V707')!.status='NOT_EXECUTED';const result=run(rows);expect(result.status).toBe(1);expect(JSON.parse(result.stdout).releaseGate.blockers).toContainEqual(expect.objectContaining({id:'V707'}));
 });
 it('rejects an undeclared cash scope split and missing component evidence rather than waiving a feature',()=>{
  const rows=hypotheticalVerifiedCash(),row=rows.find(r=>r.id==='D02')!;row.r1_gate_basis='EXPLICIT_MIXED_CASH_COMPONENT';row.r1_cash_component_status='PASS';row.r1_cash_component_evidence='invented waiver';let result=run(rows);expect(result.status).not.toBe(0);expect(result.stderr).toContain('No governing explicit deferred/cash scope split');
  const missing=hypotheticalVerifiedCash();missing.find(r=>r.id==='M05')!.r1_cash_component_evidence='';result=run(missing);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Cash component PASS needs separate executed evidence');
 });
});
