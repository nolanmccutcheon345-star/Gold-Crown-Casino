import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {plan,populationBlock,summarizePopulation,probeBlock,summarizeProbes,type Model,type Cohort} from './population';
import {STYLES} from './audit';
import {PROBES} from './probes';
const run=process.env.STEP4C_EVALUATE==='1';
it('executes independent Step4C complete-hand population and exploit cohorts',async()=>{
 if(!run){for(const model of ['baseline-1.1','candidate-1.2'] as Model[])expect(populationBlock(plan('development')[1],model,2).hands).toHaveLength(2);return;}
 const model=(process.env.STEP4C_MODEL??'baseline-1.1') as Model,cohort=(process.env.STEP4C_COHORT??'development') as Cohort,dir=resolve(process.env.STEP4C_REPORT_DIR??'tests/step4c/evidence'),mode=process.env.STEP4C_MODE??'population';mkdirSync(dir,{recursive:true});
 const save=(name:string,data:unknown,compressed=false)=>{const raw=JSON.stringify(data);writeFileSync(resolve(dir,name+(compressed?'.json.gz':'.json')),compressed?gzipSync(raw):raw+'\n');};
 const hashes=Object.fromEntries(['src/bots/preflop.ts','src/bots/strategy.ts','src/bots/features.ts','src/bots/ranges.ts','src/bots/profiles.ts','src/bots/policy.ts','src/bots/v2/policy.ts','tests/step4c/audit.ts','tests/step4c/population.ts','tests/step4c/PROTOCOL.md'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
 const started=Date.now();
 if(mode==='population'){
  const blocks=[];for(const p of plan(cohort).slice(0,Number(process.env.STEP4C_BLOCKS??72))){const result=populationBlock(p,model,Number(process.env.STEP4C_HANDS??20));blocks.push(result);save(`${model}-${cohort}-population-block-${p.index}`,result,true);console.log(JSON.stringify({kind:'population',model,cohort,block:p.index,hands:result.hands.length,elapsedSeconds:(Date.now()-started)/1000}));await new Promise<void>(resolve=>setImmediate(resolve));}
  const summary=summarizePopulation(blocks);save(`${model}-${cohort}-population-summary`,summary);expect(summary.completedHands).toBe(blocks.reduce((n,b)=>n+b.hands.length,0));
 }else{
  const blocks=[];for(const probe of PROBES)for(const style of STYLES)for(let b=0;b<Number(process.env.STEP4C_PROBE_BLOCKS??4);b++){const result=probeBlock(model,cohort,probe,style,b,Number(process.env.STEP4C_PROBE_HANDS??12));blocks.push(result);save(`${model}-${cohort}-${probe}-${style}-${b}`,result,true);console.log(JSON.stringify({kind:'probe',model,cohort,probe,style,block:b,hands:result.hands.length,elapsedSeconds:(Date.now()-started)/1000}));await new Promise<void>(resolve=>setImmediate(resolve));}save(`${model}-${cohort}-probe-summary`,summarizeProbes(blocks));
 }
 save(`${model}-${cohort}-${mode}-run`,{model,cohort,mode,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,at:new Date().toISOString(),elapsedSeconds:(Date.now()-started)/1000,sourceSha256:hashes,heapUsed:process.memoryUsage().heapUsed,warning:'Measured Node process memory at end includes evaluation records; not live browser memory.'});
},3600000);
