import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {combos,seven} from '../step5c-gates/river-reference';
interface Situation {family:string;holding:number;depth:number;fraction:number;own:string[];board:string[];samples:{archetype:string;actions:Record<string,number>}[];}
const artifact='tests/step5d-gates/evidence/river/F10-heldout.json.gz';
const receipt=()=>JSON.parse(gunzipSync(readFileSync(artifact)).toString()) as {sourceCommit:string;situations:Situation[];};
const summaryPath=()=>process.env.STEP5D_GATE_REVIEW_DIR??'tests/step5d-gates/evidence/reference-review';
const save=(name:string,value:unknown)=>{mkdirSync(summaryPath(),{recursive:true});writeFileSync(`${summaryPath()}/${name}.json`,JSON.stringify(value,null,2));};
it('F10 independently enumerates unlosable river holdings and audits actual held-out fold counts',()=>{
 const r=receipt(),cache=new Map<string,boolean>(),rows=[];let opportunities=0,folds=0;
 for(const s of r.situations){const key=`${s.family}:${s.holding}`;let unlosable=cache.get(key);if(unlosable===undefined){unlosable=combos(s.board,s.own).every(c=>c.result>=0);cache.set(key,unlosable);}
  if(unlosable&&s.fraction){const profiles=s.samples.filter(x=>x.archetype==='stronger-reg'),count=profiles.reduce((n,p)=>n+Object.values(p.actions).reduce((a,b)=>a+b,0),0),foldCount=profiles.reduce((n,p)=>n+(p.actions['{"type":"fold"}']??0),0);opportunities+=count;folds+=foldCount;rows.push({family:s.family,holding:s.holding,depth:s.depth,fraction:s.fraction,opportunities:count,folds:foldCount});}
 }
 save('unlosable',{sourceCommit:r.sourceCommit,artifact,artifactSHA256:createHash('sha256').update(readFileSync(artifact)).digest('hex'),method:'All990 compatible opponent combinations independently ranked; actual recorded stronger-reg decisions counted only at priced nodes.',expected:'Zero folds with mathematically unlosable holdings, no rake, and positive existing pot.',observed:{opportunities,folds},rows});expect(opportunities).toBeGreaterThan(0);expect(folds).toBe(0);
});
const oracle=process.env.RUN_ORACLE==='1'?describe:describe.skip;
oracle('F10 independent reference versus pinned PokerKit0.7.7',()=>{
 it('cross-checks every compatible opponent comparison for all24held-out holdings',()=>{
  const r=receipt(),seen=new Set<string>(),cases:{a:string[];b:string[]}[]=[],expected:number[]=[],ranks=[];
  for(const s of r.situations){const key=`${s.family}:${s.holding}`;if(seen.has(key))continue;seen.add(key);ranks.push({family:s.family,holding:s.holding,independentRank:seven([...s.board,...s.own])});for(const c of combos(s.board,s.own)){cases.push({a:[...s.board,...s.own],b:[...s.board,...c.cards]});expected.push(c.result);}}
  const result=JSON.parse(execFileSync(process.env.ORACLE_PYTHON??'python3',['tests/oracle/pokerkit_oracle.py'],{input:JSON.stringify({mode:'compare',cases}),encoding:'utf8',maxBuffer:64*1024*1024}));
  save('pokerkit',{sourceCommit:r.sourceCommit,oracle:'PokerKit0.7.7',runtime:{node:process.version,platform:process.platform},artifact,artifactSHA256:createHash('sha256').update(readFileSync(artifact)).digest('hex'),expected:{holdings:24,comparisons:23760,mismatches:0},observed:{holdings:seen.size,comparisons:cases.length,mismatches:expected.reduce((n,e,i)=>n+Number(e!==result.comparisons[i]),0)},ranks});expect(result.version).toBe('0.7.7');expect(seen.size).toBe(24);expect(cases).toHaveLength(23760);expect(result.comparisons).toEqual(expected);
 },120000);
});
