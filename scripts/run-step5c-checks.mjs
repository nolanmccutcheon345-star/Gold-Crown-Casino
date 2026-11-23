/** Executes the release-candidate checks; records current evidence without relabelling old runs. */
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import process from 'node:process';
const root=process.cwd(),output=resolve(process.argv[2]??'TEST_EVIDENCE/step5c/final-regression');
if(!relative(root,output).startsWith('TEST_EVIDENCE/step5c/'))throw Error('Evidence must use a new Step5C directory.');
if(existsSync(resolve(output,'manifest.json')))throw Error('Refusing to overwrite an earlier execution receipt.');
mkdirSync(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${directory}/${e.name}`):[`${directory}/${e.name}`]);
const source=()=>Object.fromEntries(['src','scripts','tests'].flatMap(files).filter(p=>!p.includes('/evidence/')&&!p.endsWith('.cpuprofile')&&!p.endsWith('.gz')).sort().map(p=>[p,hash(readFileSync(p))]));
const before=source();
const receipt={format:'ai-texas-executed-checks',version:1,sourceCommit:git('rev-parse','HEAD'),startedAt:new Date().toISOString(),sourceHashes:before,dirtyAtStart:git('status','--porcelain').split('\n').filter(Boolean),environment:{node:process.version,platform:process.platform,arch:process.arch},engineVersion:readFileSync('src/core/engine.ts','utf8').match(/ENGINE_VERSION\s*=\s*'([^']+)'/)[1],policyVersion:readFileSync('src/bots/profiles.ts','utf8').match(/POLICY_VERSION\s*=\s*'([^']+)'/)[1],checks:[],remoteCI:'NOT_EXECUTED',browser:'Recorded separately; this runner does not operate a browser.',limitations:['A test count is not a mapped acceptance-requirement count.','Fixture-specific rules, random seeds, expected assertions and historical policy dispatch are retained in each hashed test source.','This receipt describes only these executions, not any earlier evidence.']};
const save=()=>writeFileSync(resolve(output,'manifest.json'),JSON.stringify(receipt,null,2)+'\n');
const env={...process.env,RUN_ORACLE:'1',RUN_ACCOUNTING_BATCH:'1',STEP5B_ACCEPTANCE_EVIDENCE_DIR:output,STEP5C_GATE_EVIDENCE_DIR:output,STEP5C_ECOLOGY_FULL:'1'};
const commands=[['specification','node',['scripts/check-spec-integrity.mjs']],['typecheck','npm',['run','typecheck']],['lint','npm',['run','lint']],['unit-oracle-accounting','node',['node_modules/vitest/vitest.mjs','run','--reporter=json',`--outputFile=${resolve(output,'vitest.json')}`]],['build','node',['/root/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/scripts/build-site.mjs']]];
// A few retained tests write into their original evidence folders. Preserve those
// previous receipts, saving freshly generated output alongside this execution.
const preserved=new Map(git('ls-files').split('\n').filter(p=>p.includes('/evidence/')&&!p.endsWith('.gz')&&!p.endsWith('.cpuprofile')).map(p=>[p,readFileSync(p)]));
try{
 for(const [name,program,args] of commands){
  const started=Date.now(),log=resolve(output,`${name}.log`);writeFileSync(log,'');
  const record={name,command:[program,...args],startedAt:new Date(started).toISOString(),expected:'exit 0; executable assertions in hashed source',status:'RUNNING',log:relative(root,log)};receipt.checks.push(record);save();
  const result=await new Promise(resolveRun=>{const child=spawn(program,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',x=>{text+=x;});child.stderr.on('data',x=>{text+=x;});child.on('error',error=>resolveRun({exitCode:null,error:String(error),text}));child.on('close',(exitCode,signal)=>resolveRun({exitCode,signal,text}));});
  writeFileSync(log,result.text);Object.assign(record,{status:result.exitCode===0?'PASS':'FAIL',exitCode:result.exitCode,signal:result.signal??null,durationMs:Date.now()-started,error:result.error??null});save();console.log(`${record.status} ${name} (${record.durationMs} ms)`);
 }
 if(existsSync(resolve(output,'vitest.json'))){const v=JSON.parse(readFileSync(resolve(output,'vitest.json'),'utf8'));receipt.testCounts={total:v.numTotalTests,passed:v.numPassedTests,failed:v.numFailedTests,skipped:v.numPendingTests,files:v.testResults?.length};receipt.testCases=v.testResults.flatMap(file=>file.assertionResults.map(test=>({file:relative(root,file.name),name:test.fullName,status:test.status,durationMs:test.duration,assertionsSourceSHA256:before[relative(root,file.name)]??null,failureMessages:test.failureMessages})));}
 receipt.buildHashes=existsSync('dist')?Object.fromEntries(files('dist').map(p=>[p,hash(readFileSync(p))])):{};
}finally{
 for(const [path,bytes] of preserved)if(existsSync(path)&&hash(readFileSync(path))!==hash(bytes)){const rerun=resolve(output,'generated',path);mkdirSync(dirname(rerun),{recursive:true});writeFileSync(rerun,readFileSync(path));writeFileSync(path,bytes);}
 receipt.finishedAt=new Date().toISOString();receipt.changedInputs=Object.entries(source()).filter(([p,h])=>before[p]!==h).map(([p])=>p);receipt.status=receipt.checks.every(c=>c.status==='PASS')&&receipt.testCounts?.skipped===0&&receipt.changedInputs.length===0?'PASS':'FAIL';save();console.log(JSON.stringify({status:receipt.status,tests:receipt.testCounts,changedInputs:receipt.changedInputs,manifest:relative(root,resolve(output,'manifest.json'))}));process.exitCode=receipt.status==='PASS'?0:1;
}
