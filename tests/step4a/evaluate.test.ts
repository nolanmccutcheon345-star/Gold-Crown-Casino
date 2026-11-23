import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { completeHandEvaluation, controlledEvaluation, rate } from './evaluation';
const full=process.env.STEP4A_EVALUATE==='1';
describe('Independent synthetic opponent evaluation',()=>{
 it('Wilson bounds are independently recognizable at zero, half and all successes',()=>{
  expect(rate(0,0)).toEqual({count:0,opportunities:0,percent:null,ci95:null});
  expect(rate(0,100).ci95![1]).toBeCloseTo(3.69935,4);expect(rate(50,100).ci95![0]).toBeCloseTo(40.38315,4);expect(rate(100,100).ci95![0]).toBeCloseTo(96.30065,4);
 });
 it('samples all controlled contexts and completes legal seeded hands with explicit denominator evidence',()=>{
  const controlled=controlledEvaluation(full?1000:100);const hands=completeHandEvaluation(full?400:8);
  if(full){const directory=resolve(process.env.STEP4A_REPORT_DIR??'tests/step4a/artifacts');mkdirSync(directory,{recursive:true});
   const sourceFiles=['src/bots/policy.ts','src/bots/strategy.ts','src/bots/features.ts','src/bots/profiles.ts','src/bots/memory.ts','src/bots/boundary.ts','src/bots/legacy-v0.ts','src/core/engine.ts'];
   writeFileSync(resolve(directory,'run.json'),JSON.stringify({executedAt:new Date().toISOString(),gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),policyVersion:controlled.policyVersion,node:process.version,
    sourceSha256:Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),controlledDecisions:controlled.totalDecisions,completeHands:hands.totalHands},null,2)+'\n');
   writeFileSync(resolve(directory,'controlled-decisions.json'),JSON.stringify(controlled,null,2)+'\n');writeFileSync(resolve(directory,'complete-hands.json'),JSON.stringify(hands,null,2)+'\n');
   writeFileSync(resolve(directory,'SUMMARY.md'),`# Synthetic Step4A evaluation\n\nPolicy: ${controlled.policyVersion}. Not human-validated.\n\n${controlled.totalDecisions} controlled decisions (${controlled.contextCount} contexts ×8 profiles ×${controlled.samplesPerContext}).\n${hands.totalHands} complete hands, ${hands.totalDecisions} legal decisions.\n\n`+controlled.checks.map(check=>`- ${check.pass?'PASS':'FAIL'}: ${check.id}`).join('\n')+'\n\n'+hands.warnings.map(w=>`- WARNING: ${w}`).join('\n')+'\n');
  }
  expect(controlled.rows).toHaveLength(32*8);expect(hands.totalHands).toBe((full?400:8)*4);
  expect(controlled.rows.every(row=>Object.values(row.actions).reduce((n,x)=>n+x,0)===row.samples)).toBe(true);
  // Directional design checks are reported separately from legal/accounting
  // PASS. They are not calibrated real-player frequency targets.
 },120000);
});
