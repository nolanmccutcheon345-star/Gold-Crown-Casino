/** Capture present source/artifact bytes. This is not a test runner or a CI receipt. */
import {createHash} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
const args=process.argv.slice(2),argument=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const root=resolve(argument('--repo')??process.cwd()),check=argument('--check'),output=argument('--output');
if((check&&output)||(!check&&!output))throw Error('Use --output <repo-relative.json> to capture, or --check <repo-relative.json> to verify captured bytes. Optional --repo <existing project>.');
const destination=resolve(root,check??output),local=relative(root,destination);
if(local.startsWith(`..${sep}`)||isAbsolute(local)||!local)throw Error('Inventory must be a file inside the specified project.');
const hash=value=>createHash('sha256').update(value).digest('hex');
const git=(...command)=>execFileSync('git',command,{cwd:root,encoding:'utf8'}).trim();
const read=path=>readFileSync(resolve(root,path),'utf8');
function paths(directory){if(!existsSync(resolve(root,directory)))return[];return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>{const path=`${directory}/${entry.name}`;return entry.isDirectory()?paths(path):entry.isFile()&&path!==local?[path]:[];});}
const sourcePaths=[...paths('src'),...paths('public'),...paths('scripts'),...paths('tests').filter(path=>!path.includes('/evidence/')),...paths('.github'),...paths('.openai'),...['index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','eslint.config.js','docs/specs/manifest.json','docs/specs/acceptance-source.json','docs/specs/backlog-source.json','BACKLOG_86.csv','ACCEPTANCE_STATUS.csv','R1_REQUIREMENTS.csv','R1_DASHBOARD.md','STEP5B_REPORT.md','IMPLEMENTATION_STATUS.md','IPHONE_VERIFICATION.md'].filter(path=>existsSync(resolve(root,path)))].sort();
const evidencePaths=[...paths('TEST_EVIDENCE'),...paths('tests').filter(path=>path.includes('/evidence/'))].sort();
function records(files){return [...new Set(files)].map(path=>{const bytes=readFileSync(resolve(root,path));return{path,bytes:bytes.byteLength,sha256:hash(bytes)};});}
function section(files){const entries=records(files);return{count:entries.length,totalBytes:entries.reduce((n,item)=>n+item.bytes,0),sha256:hash(JSON.stringify(entries)),files:entries};}
const observed={source:section(sourcePaths),evidence:section(evidencePaths),build:section(paths('dist'))};
if(check){
 const saved=JSON.parse(readFileSync(destination,'utf8')),differences=[];
 for(const name of ['source','evidence','build'])if(saved.snapshots?.[name]?.sha256!==hash(JSON.stringify(saved.snapshots?.[name]?.files??[]))||saved.snapshots?.[name]?.sha256!==observed[name].sha256){const before=new Map((saved.snapshots?.[name]?.files??[]).map(item=>[item.path,item.sha256])),after=new Map(observed[name].files.map(item=>[item.path,item.sha256]));differences.push({section:name,invalidManifestChecksum:saved.snapshots?.[name]?.sha256!==hash(JSON.stringify(saved.snapshots?.[name]?.files??[])),changedOrAdded:[...after].filter(([path,value])=>before.get(path)!==value).map(([path])=>path),missing:[...before.keys()].filter(path=>!after.has(path))});}
 console.log(JSON.stringify({status:differences.length?'FAIL':'PASS',scope:'Present source, evidence and existing build file hashes only; no tests/CI were run by this check.',capturedSourceCommit:saved.sourceSnapshot?.gitCommit,currentCommit:git('rev-parse','HEAD'),differences},null,2));process.exitCode=differences.length?1:0;
}else{
 const extract=(path,expression)=>read(path).match(expression)?.[1]??null;
 const result={format:'ai-texas-hold-em-qa-byte-inventory',version:1,capturedAt:new Date().toISOString(),sourceSnapshot:{gitCommit:git('rev-parse','HEAD'),gitTree:git('rev-parse','HEAD^{tree}'),branch:git('branch','--show-current'),dirtyPaths:git('status','--porcelain').split('\n').filter(Boolean),projectId:JSON.parse(read('.openai/hosting.json')).project_id},currentSourceVersions:{engine:extract('src/core/engine.ts',/ENGINE_VERSION\s*=\s*'([^']+)'/),policy:extract('src/bots/profiles.ts',/POLICY_VERSION\s*=\s*'([^']+)'/),practiceRuleBase:extract('src/session/controller.ts',/id:'practice-cash',version:'([^']+)'/),pokerStarsSourceProfile:extract('src/rules/pokerstars.ts',/POKERSTARS_PROFILE_VERSION\s*=\s*'([^']+)'/),note:'These are current source constants, not assignments to earlier test runs. Exact configured rule versions and frozen policy versions belong to their original hand/fixture evidence.'},environment:{node:process.version,platform:process.platform,arch:process.arch},snapshots:observed,limitations:['Artifact hashes prove the bytes captured now, not execution, accuracy, original creation time or completeness of the evidence.','This helper does not run tests, a build, a browser, CI or deployment.','An existing dist directory is only fingerprinted; correspondence to this source requires its executed build record.','Do not retroactively label older browser results with this source commit or current policy version.','Missing per-critical-test commit/build/seed/expected-observed/environment mappings remain release gaps.','This inventory cannot prove another Site was unchanged or replace a native publication/audit receipt.']};
 mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'CAPTURED',path:local,sourceFiles:observed.source.count,evidenceFiles:observed.evidence.count,existingBuildFiles:observed.build.count,sourceSha256:observed.source.sha256,evidenceSha256:observed.evidence.sha256,testsExecuted:false,remoteCIExecuted:false},null,2));
}
