import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=(path:string)=>readFileSync(path,'utf8');
const rows=()=>{const result=spawnSync(process.execPath,['--input-type=module','-e',"import {parseCsv} from './scripts/step5d-audit-execution-links.mjs';import {readFileSync} from 'node:fs';console.log(JSON.stringify(parseCsv(readFileSync('ACCEPTANCE_STATUS.csv','utf8'))));"],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout) as Record<string,string>[];};

describe('Step5G honest local-development and hosted-CI boundary',()=>{
 it('preserves V522 verbatim while recording the user-postponed hosted dependency as BLOCKED',()=>{
  const original=JSON.parse(read('docs/specs/acceptance-source.json')).find((r:{id:string})=>r.id==='V522');
  const current=rows().find(r=>r.id==='V522')!;
  const evidence=JSON.parse(read('tests/step5g-gates/hosted-ci-dependency.json'));
  expect(current.acceptance).toBe(original.acceptance);
  expect(current.status).toBe('BLOCKED');
  expect(current.r1_blocking).toBe('YES');
  expect(evidence.criterion).toBe(original.acceptance);
  expect(evidence.status).toBe(current.status);
  expect(evidence.hostedRunExecuted).toBe(false);
  expect(evidence.hostedRunUrl).toBeNull();
  expect(evidence.localDevelopmentBlocked).toBe(false);
  expect(evidence.releaseBlocked).toBe(true);
  expect(current.evidence).toContain('tests/step5g-gates/hosted-ci-dependency.json');
 });
 it('actually refuses release with the hosted dependency present without claiming a local regression failure',()=>{
  const run=spawnSync(process.execPath,['scripts/build-r1-dashboard.mjs','--check','--release-check'],{encoding:'utf8'});
  expect(run.status,run.stderr).toBe(1);
  const report=JSON.parse(run.stdout);
  expect(report.releaseGate.decision).toBe('NOT_READY_FOR_R1');
  expect(report.releaseGate.blockers.find((r:{id:string})=>r.id==='V522').status).toBe('BLOCKED');
  expect(report.status).toEqual({PASS:221,FAIL:0,BLOCKED:6,NOT_EXECUTED:75});
 });
 it('preserves historical source qualification and explicitly labels it as historical rather than current-runtime evidence',()=>{
  const dashboard=read('R1_DASHBOARD.md');
  expect(dashboard).toContain('Recorded source-bound candidate qualification (historical snapshot)');
  // The dashboard follows the canonical register's recorded snapshot. The
  // older229/237 audit remains separately asserted below; it cannot certify
  // a newer source merely because its historical count was higher.
  const current=rows();
  const critical=current.filter(row=>row.r1_blocking==='YES');
  const qualified=critical.filter(row=>row.candidate_qualification==='QUALIFIED');
  const sources=[...new Set(current.map(row=>row.candidate_source))];
  expect(critical).toHaveLength(237);
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatch(/^[a-f0-9]{40}$/);
  expect(dashboard).toContain(`${qualified.length}/${critical.length}`);
  expect(dashboard).toContain(sources[0]);
  expect(dashboard).toContain('not a claim about a newer candidate');
  expect(dashboard).not.toContain('mandatory original-ID gates have current qualified evidence');
  const historical=JSON.parse(read('tests/step5e-gates/evidence/draftfix/current-qualification.json'));
  expect(historical.requirements.find((r:{id:string})=>r.id==='V522').originalStatus).toBe('NOT_EXECUTED');
  expect(historical.qualifiedCount).toBe(229);
 });
 it('retains every original criterion and deferred feature while mixed V706 remains incomplete as a whole',()=>{
  const originals=JSON.parse(read('docs/specs/acceptance-source.json')) as Record<string,string>[];
  const current=rows();
  expect(current).toHaveLength(302);
  expect(new Set(current.map(r=>r.id)).size).toBe(302);
  for(const original of originals){const got=current.find(r=>r.id===original.id)!;for(const [key,value]of Object.entries(original))expect(got[key]).toBe(value);}
  const backlog=JSON.parse(read('docs/specs/backlog-source.json'));
  expect(backlog).toHaveLength(86);
  expect(new Set(backlog.map((r:{id:string})=>r.id)).size).toBe(86);
  const mixed=current.find(r=>r.id==='V706')!;
  expect(mixed.status).toBe('NOT_EXECUTED');
  expect(mixed.r1_cash_component_status).toBe('PASS');
 });
 it('allows fresh Step5G receipts but refuses path traversal and source-tree writes',()=>{
  const code=String.raw`import assert from 'node:assert/strict';import {safeOutput} from './scripts/step5d-ci-plan.mjs';assert.equal(safeOutput('/repo','TEST_EVIDENCE/step5g/release'),'/repo/TEST_EVIDENCE/step5g/release');for(const path of ['src/receipt','TEST_EVIDENCE/step5g/../../../outside','/outside/receipt'])assert.throws(()=>safeOutput('/repo',path));`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);
 });
});
