/** Qualifies captured native-browser evidence. This module never runs a browser. */
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const at=(value,path)=>String(path).split('.').reduce((v,key)=>v!==null&&typeof v==='object'&&Object.hasOwn(v,key)?v[key]:undefined,value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function assertion(actual,claim){
 if(Object.hasOwn(claim,'equals'))return equal(actual,claim.equals);
 if(Object.hasOwn(claim,'includes'))return (typeof actual==='string'||Array.isArray(actual))&&actual.includes(claim.includes);
 if(Object.hasOwn(claim,'minimum'))return Number.isFinite(actual)&&actual>=claim.minimum;
 if(Object.hasOwn(claim,'maximum'))return Number.isFinite(actual)&&actual<=claim.maximum;
 return false;
}
export const browserHarnessFiles=workflow=>workflow==='populated-statistics'?['tests/browser/step5d-compiled-stats.ts','tests/browser/step5d-compiled-stats-frame.ts','tests/step5d-browser/mixed-stats-fixture.ts','tests/step5d-browser/capture-mixed-stats-source.mjs']:['tests/browser/step5d-compiled.ts','tests/browser/step5d-compiled-frame.ts'];
export function verifyBrowser(entry,receipt,{read,exists,sourceAtCommit}){
 const errors=[],fail=message=>errors.push(message),load=ref=>{
  if(!ref?.path||!ref.sha256||!exists(ref.path)){fail('Missing captured browser/proof artifact');return null;}
  const bytes=read(ref.path);if(sha(bytes)!==ref.sha256){fail(`Browser/proof bytes changed: ${ref.path}`);return null;}
  try{return JSON.parse(bytes);}catch{fail(`Invalid captured JSON: ${ref.path}`);return null;}
 };
 if(entry.format!=='ai-texas-native-compiled-workflows'||entry.version!==1||!entry.id)fail('Unsupported native browser evidence');
 const workflow=entry.workflow??'cash',statistics=workflow==='populated-statistics';
 if(!['cash','populated-statistics'].includes(workflow))fail('Unknown compiled browser workflow');
 if(entry.sourceCommit!==receipt.sourceCommit)fail('Browser source differs from executed compiled candidate');
 if(!entry.command?.length)fail('Actual browser execution procedure missing');
 const harnessCommit=entry.harnessCommit??receipt.sourceCommit,separate=harnessCommit!==receipt.sourceCommit;
 if(separate&&(!/^[0-9a-f]{40}$/.test(harnessCommit)||typeof sourceAtCommit!=='function'))fail('Separate browser harness source proof missing');
 for(const file of browserHarnessFiles(workflow)){
  const claimed=entry.harnessHashes?.[file];let executed=receipt.sourceHashes?.[file];
  if(sourceAtCommit)try{executed=sha(sourceAtCommit(harnessCommit,file));}catch{executed=null;}
  // The raw execution stays bound to its actual QA commit. Later additional QA
  // assertions do not retroactively execute in that receipt; requested command
  // and occurrence checks below still refuse those absent later workflows.
  if(!claimed||claimed!==executed||!sourceAtCommit&&(!exists(file)||sha(read(file))!==claimed))fail(`Browser assertion source differs from pinned execution: ${file}`);
 }
 if(separate){
  const runtime=Object.entries(receipt.sourceHashes??{}).filter(([path])=>path.startsWith('src/'));
  if(!runtime.length)fail('No base runtime source proof for separate harness');
  for(const [path,hash]of runtime)try{if(!sourceAtCommit||sha(sourceAtCommit(harnessCommit,path))!==hash||!exists(path)||sha(read(path))!==hash)fail(`Separate harness changes tested runtime: ${path}`);}catch{fail(`Separate harness runtime proof missing: ${path}`);}
 }
 const raw=load(entry.capture),proof=load(entry.proof);
 if(proof?.format!=='ai-texas-step5d-exact-compiled-fixture'||proof.version!==1||proof.status!=='BUILD_BYTES_VERIFIED'||proof.sourceCommit!==receipt.sourceCommit)fail('Compiled browser fixture is not source-bound');
 if(proof){
  if(!proof.executionReceipt||!exists(proof.executionReceipt)||sha(read(proof.executionReceipt))!==proof.executionReceiptSHA256)fail('Compiled preparation receipt bytes missing or changed');
  else{const base=JSON.parse(read(proof.executionReceipt));if(base.status!=='PASS'||base.sourceCommit!==receipt.sourceCommit||!equal(base.buildHashes,receipt.buildHashes))fail('Browser fixture links a different compiled execution');}
  const assets=Object.fromEntries((proof.assets??[]).map(asset=>[asset.source,asset.sha256]));
  if(Object.keys(assets).length!==Object.keys(receipt.buildHashes??{}).length||Object.entries(receipt.buildHashes??{}).some(([path,hash])=>assets[path]!==hash))fail('Browser asset proof differs from tested build');
 }
 if(!raw||raw.status!=='PASS'||!raw.browser||!Number.isFinite(raw.width)||!raw.at||!Array.isArray(raw.reports))fail('No complete successful native browser execution');
 if(!statistics&&(raw?.actualUIHands!==9||!raw?.run))fail('No complete successful native 2–10 execution');
 if(statistics&&(raw?.format!=='step5d-exact-compiled-populated-statistics'||raw.version!==1||raw.fixtureHandsVerified!==400||raw.actualUIPlayedHands!==0||raw.productionDatabaseAccessed!==false))fail('No complete populated-display execution; fixture hands are not UI-played hands');
 const reports=raw?.reports??[];
 if(!reports.length||reports.some(report=>report.status!=='PASS'||report.error))fail('Browser workflow contains failed or absent records');
 const commands=reports.filter(report=>report.kind===(statistics?'compiled-stats-result':'step5d-compiled-result'));
 if(commands.some(report=>!report.run||!statistics&&report.run!==raw.run||!report.name||!report.id||!Array.isArray(report.trace)))fail('Browser command identity or trace missing');
 if(new Set(commands.map(report=>report.id)).size!==commands.length)fail('Duplicate browser command identity');
 if(!statistics){const starts=commands.filter(report=>report.name==='start');if(!equal(starts.map(report=>report.result?.count),[2,3,4,5,6,7,8,9,10]))fail('Browser did not execute every declared occupied count');}
 for(const command of commands){
  const states=[command.result,command.result?.before,command.result?.after].filter(value=>value?.sourceCommit);
  if(!states.length||states.some(value=>value.sourceCommit!==receipt.sourceCommit))fail(`Browser result missing candidate identity: ${command.name}`);
 }
 if(statistics){
  const displays=commands.filter(report=>report.name==='statistics');
  if(displays.length!==4||new Set(commands.map(report=>report.run)).size!==2||reports.filter(report=>report.check==='actual compiled document reload').length!==6)fail('Populated before/after reload matrix incomplete');
  for(const second of ['2/5','5/10']){
   const group=displays.filter(report=>report.result?.metadata?.second===second),expected={hands:200,profit:second==='2/5'?50000:90000,bb100:second==='2/5'?72.5:75,wallet:second==='2/5'?1062345:1102345};
   if(group.length!==2)fail(`Missing populated cohort: ${second}`);
   for(const item of group){const r=item.result,m=r?.metadata,s=r?.sourceReceipt;
    if(!m||Object.entries(expected).some(([key,value])=>m.expected?.[key]!==value)||r.fixtureHands!==200||r.actualUIPlayedHands!==0||r.manualAdjustmentExcluded!==true||r.oldHistoryUnchanged!==true||!equal(r.actual,r.expected)||!equal(r.actualGroups,r.expectedGroups))fail(`Populated statistics arithmetic or preservation failed: ${second}`);
    if(s?.status!=='SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED'||s.compiledSourceCommit!==receipt.sourceCommit||s.sourceHead!==harnessCommit||Object.entries(receipt.sourceHashes??{}).filter(([path])=>path.startsWith('src/')).some(([path,hash])=>s.sourceHashes?.[path]!==hash))fail('Populated fixture authority source proof differs');
   }
   if(group.length===2&&(group[0].result.handHistorySHA256!==group[1].result.handHistorySHA256||group[0].result.wallet!==group[1].result.wallet))fail('Populated reload changed histories or wallet');
  }
  const fresh=commands.filter(report=>report.name==='fresh-snapshot');
  if(fresh.length!==2||fresh.some(item=>item.result.wallet!==1000000||item.result.financialEvents!==1||item.result.hands!==0||item.result.sessions!==0||item.result.oldRecordsRestored!==false))fail('Populated deletion/fresh-start accounting incomplete');
 }else{
  const end=reports.find(report=>report.check==='all2–10 completed hands and exact single cashouts');
  if(!end||end.actualUIHands!==9||end.final?.hands!==9||end.final?.settlements!==9||end.final?.cashouts!==9||end.final?.active!==false)fail('Browser final settlement/cashout invariants missing');
 }
 return{status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,id:entry.id,workflow,sourceCommit:entry.sourceCommit,harnessCommit,width:raw?.width,browser:raw?.browser,capture:entry.capture,proof:entry.proof,command:entry.command,commands};
}
export function qualifyBrowserCases(requested,browsers){
 const errors=[],executed=[];
 for(const check of requested??[]){
  const matching=browsers.filter(browser=>browser.id===check.execution);
  if(matching.length!==1||matching[0].status!=='QUALIFIED'){errors.push(`Missing or invalid executed browser receipt: ${check.execution}`);continue;}
  const browser=matching[0];let cases=browser.commands.filter(item=>item.name===check.command);
  for(const [path,value]of Object.entries(check.where??{}))cases=cases.filter(item=>equal(at(item,path),value));
  if(!Number.isInteger(check.occurrences)||check.occurrences<1||cases.length!==check.occurrences){errors.push(`Browser occurrence mismatch: ${check.execution}/${check.command}`);continue;}
  if(!check.assertions?.length){errors.push(`Browser expected/observed assertions missing: ${check.command}`);continue;}
  for(const item of cases){
   const observed=[];
   for(const claim of check.assertions){const actual=at(item,claim.path);if(!claim.path||!assertion(actual,claim))errors.push(`Browser assertion failed: ${check.execution}/${check.command}/${claim.path}`);observed.push({claim,actual});}
   executed.push({execution:browser.id,sourceCommit:browser.sourceCommit,harnessCommit:browser.harnessCommit,browser:browser.browser,width:browser.width,capture:browser.capture,proof:browser.proof,command:item.name,commandId:item.id,observed});
  }
 }
 return{errors,executed};
}
