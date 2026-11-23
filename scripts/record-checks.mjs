import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const commit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
const phase=process.env.EVIDENCE_PHASE??'PHASE0';
const engineVersion=readFileSync('src/core/engine.ts','utf8').match(/ENGINE_VERSION = '([^']+)'/)[1];
const policyVersion=readFileSync('src/bots/profiles.ts','utf8').match(/POLICY_VERSION\s*=\s*'([^']+)'/)[1];
const ruleProfileVersion='practice-cash/'+readFileSync('src/session/controller.ts','utf8').match(/id:'practice-cash',version:'([^']+)'/)[1];
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const directory=resolve('TEST_EVIDENCE',stamp);mkdirSync(directory,{recursive:true});
const commands=[['integrity','node',['scripts/check-spec-integrity.mjs']],['typecheck','npm',['run','typecheck']],['lint','npm',['run','lint']],['unit-and-oracle','npm',['test','--','--reporter=verbose']],['build','node',['/root/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/scripts/build-site.mjs']]];
const records=[];
for(const [id,program,args] of commands){
 const started=new Date().toISOString();
 const result=spawnSync(program,args,{encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});
 writeFileSync(resolve(directory,`${id}.log`),(result.stdout??'')+(result.stderr??''));
 const record={test_id:`${phase}-${id}`,commit,runner:program,command:[program,...args],timestamp:started,environment:{node:process.version,platform:process.platform,arch:process.arch},engineVersion,policyVersion,ruleProfileVersion,expected:'Exit 0 with all selected checks passing',observed:{exit_code:result.status,signal:result.signal},status:result.status===0?'PASS':'FAIL',log:`TEST_EVIDENCE/${stamp}/${id}.log`,accountingBatch:process.env.RUN_ACCOUNTING_BATCH==='1'?{handsPerProfile:10000,profiles:2}:null,independent_oracle_version:process.env.RUN_ORACLE==='1'?'PokerKit 0.7.7 (compatible fixtures only)':null};
 records.push(record);console.log(`${record.status} ${id}`);
 if(result.status!==0)console.log(result.stdout,result.stderr);
}
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(records,null,2)+'\n');
console.log(directory);process.exitCode=records.every(r=>r.status==='PASS')?0:1;
