import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ecologyBenchmark, exploitBenchmark, sequenceBenchmark } from './benchmark';
import { POLICY_VERSION } from '../../src/bots/policy';
const full=process.env.STEP4B_EVALUATE==='1';
const directory=resolve(process.env.STEP4B_REPORT_DIR??'tests/step4b/artifacts');
function save(name:string,value:unknown){if(full){mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n');}}
describe('Step4B independent paired complete-hand behavioral benchmarks',()=>{
 it('runs all fifteen complete sequence families with distinct development/evaluation cases',()=>{
  const result=sequenceBenchmark(full?Number(process.env.STEP4B_SEQUENCE_REPS??8):1);save('sequences.json',result);
  expect(result.completedHands).toBe(15*8*2*(full?Number(process.env.STEP4B_SEQUENCE_REPS??8):1));
  expect(result.rows.filter(r=>r.subset==='evaluation')).toHaveLength(3*8*2);
 },1800000);
 it('runs every fixed exploit probe against frozen and candidate policies with paired uncertainty',()=>{
  const result=exploitBenchmark(full?Number(process.env.STEP4B_PROBE_REPS??32):1);save('exploit-probes.json',result);expect(result.rows).toHaveLength(6*8*2);expect(result.paired).toHaveLength(6*8);
 },1800000);
 it('runs nine-handed all-bot ecology and records every actor contribution and opportunity',()=>{
  const result=ecologyBenchmark(full?Number(process.env.STEP4B_ECOLOGY_HANDS??100):2);save('ecology.json',result);
  expect(result.completedHands).toBe(2*(full?Number(process.env.STEP4B_ECOLOGY_HANDS??100):2));
  expect(result.rows.every(r=>r.actionsBySeat.length===9&&r.actionsBySeat.reduce((n,x)=>n+x,0)===r.decisions)).toBe(true);
  if(full)expect(result.rows.every(r=>r.actionsBySeat.every(n=>n>0))).toBe(true);
  const files=['src/bots/policy.ts','src/bots/profiles.ts','src/bots/preflop.ts','src/bots/features.ts','src/bots/strategy.ts','src/bots/ranges.ts','src/core/engine.ts'];
  save('run.json',{sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),node:process.version,policyVersion:POLICY_VERSION,protocol:'Step4B paired synthetic sequences/probes/ecology; not human calibration or solver validation',sourceSha256:Object.fromEntries(files.map(path=>{try{return[path,createHash('sha256').update(readFileSync(path)).digest('hex')];}catch{return[path,'NOT_PRESENT'];}}))});
 },1800000);
});
