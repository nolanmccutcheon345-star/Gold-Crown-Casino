/** Source-bound populated-display evidence. This validates captures; it never
 * runs a browser or converts generated fixtures into UI-played hands. */
import {sha,isRuntimeInput} from './step5d-ci-plan.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const mixedStatisticsHarnessFiles=['tests/browser/step5e-mixed-stats.ts','tests/browser/step5e-mixed-stats-frame.ts','tests/browser/step5e-mixed-stats.html','tests/browser/step5e-mixed-stats-frame.html','tests/step5d-browser/mixed-stats-fixture.ts','tests/step5d-browser/mixed-stats-fixture.test.ts','tests/step5e-browser/capture-mixed-stats-source.mjs'];
export function verifyStep5EMixedStatistics(entry,receipt,{read,exists,sourceAtCommit}){
 const errors=[],fail=message=>errors.push(message),load=ref=>{if(!ref?.path||!ref.sha256||!exists(ref.path)||sha(read(ref.path))!==ref.sha256){fail('Actual mixed statistics capture/proof absent or changed');return null;}try{return JSON.parse(read(ref.path));}catch{fail('Invalid mixed statistics capture JSON');return null;}};
 if(entry.format!=='ai-texas-step5e-native-mixed-statistics'||entry.version!==1||!entry.id||entry.sourceCommit!==receipt.sourceCommit)fail('Mixed statistics entry is not bound to candidate');
 const head=entry.harnessCommit??receipt.sourceCommit;
 if(!entry.command?.length||!/^[a-f0-9]{40}$/.test(head??''))fail('Actual mixed statistics procedure/harness source missing');
 for(const path of mixedStatisticsHarnessFiles)try{if(entry.harnessHashes?.[path]!==sha(sourceAtCommit(head,path)))fail(`Actual mixed statistics assertion source differs:${path}`);}catch{fail(`Actual mixed statistics source unavailable:${path}`);}
 if(head!==receipt.sourceCommit)for(const [path,hash]of Object.entries(receipt.sourceHashes??{}).filter(([path])=>isRuntimeInput(path)))try{if(sha(sourceAtCommit(head,path))!==hash)fail(`Mixed statistics production source differs:${path}`);}catch{fail(`Mixed statistics production source unavailable:${path}`);}
 const raw=load(entry.capture),proof=load(entry.proof);
 if(proof?.format!=='ai-texas-step5e-exact-compiled-fixture'||proof.version!==1||proof.status!=='BUILD_BYTES_VERIFIED'||proof.sourceCommit!==receipt.sourceCommit)fail('Mixed statistics compiled preparation not candidate-bound');
 if(proof){
  if(!proof.executionReceipt||!exists(proof.executionReceipt)||sha(read(proof.executionReceipt))!==proof.executionReceiptSHA256)fail('Mixed statistics original build receipt absent or changed');
  else{const base=JSON.parse(read(proof.executionReceipt));if(base.status!=='PASS'||base.sourceCommit!==receipt.sourceCommit||!equal(base.buildHashes,receipt.buildHashes))fail('Mixed statistics build receipt differs');}
  const assets=Object.fromEntries((proof.assets??[]).map(a=>[a.source,a.sha256]));if(!Object.keys(receipt.buildHashes??{}).length||Object.keys(assets).length!==Object.keys(receipt.buildHashes).length||Object.entries(receipt.buildHashes).some(([path,hash])=>assets[path]!==hash))fail('Mixed statistics compiled assets differ');
 }
 if(!raw||raw.format!=='step5e-exact-compiled-populated-statistics'||raw.version!==1||raw.status!=='PASS'||!raw.at||!raw.browser||!Number.isFinite(raw.width)||raw.fixtureHandsVerified!==400||raw.actualUIPlayedHands!==0||raw.productionDatabaseAccessed!==false||!Array.isArray(raw.reports))fail('No complete actual400-fixture/zeroUIhands mixed statistics capture');
 const reports=raw?.reports??[],commands=reports.filter(r=>r.kind==='compiled-stats-result');
 if(!reports.length||reports.some(r=>r.status!=='PASS'||r.error)||commands.some(r=>!r.run||!r.id||!r.name||!Array.isArray(r.trace))||new Set(commands.map(r=>r.id)).size!==commands.length)fail('Actual mixed statistics records incomplete or duplicated');
 const displays=commands.filter(r=>r.name==='statistics');
 if(displays.length!==4||new Set(commands.map(r=>r.run)).size!==2||reports.filter(r=>r.check==='actual compiled document reload').length!==6)fail('Populated before/after reload matrix incomplete');
 for(const command of commands){const states=[command.result,command.result?.before,command.result?.after].filter(v=>v?.sourceCommit);if(!states.length||states.some(v=>v.sourceCommit!==receipt.sourceCommit))fail(`Mixed statistics result missing candidate identity:${command.name}`);}
 for(const second of ['2/5','5/10']){
  const group=displays.filter(r=>r.result?.metadata?.second===second),expected={hands:200,profit:second==='2/5'?50000:90000,bb100:second==='2/5'?72.5:75,wallet:second==='2/5'?1062345:1102345};
  if(group.length!==2)fail(`Missing populated cohort:${second}`);
  for(const item of group){const r=item.result,m=r?.metadata,s=r?.sourceReceipt;
   const display={hands:'200',profit:second==='2/5'?'+$500':'+$900',bb100:expected.bb100.toFixed(2)},groups=[['$1/$2','100','+$150','75.0'],second==='2/5'?['$2/$5','100','+$350','70.0']:['$5/$10','100','+$750','75.0']];
   if(!m||Object.entries(expected).some(([key,value])=>m.expected?.[key]!==value)||m.topups!==2||m.cashouts!==2||r.fixtureHands!==200||r.actualUIPlayedHands!==0||r.manualAdjustmentExcluded!==true||r.oldHistoryUnchanged!==true||!equal(r.actual,display)||!equal(r.expected,display)||!equal(r.actualGroups,groups)||!equal(r.expectedGroups,groups))fail(`Populated statistics arithmetic or preservation failed:${second}`);
   if(s?.format!=='step5e-populated-compiled-stats-source'||s.version!==1||s.status!=='SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED'||s.compiledSourceCommit!==receipt.sourceCommit||s.sourceHead!==head||s.fixtureHandsPerCohort!==200||s.actualUIPlayedHands!==0||s.compiledBuildReceipt!==proof?.executionReceipt)fail('Populated fixture source identity differs');
   for(const [path,hash]of Object.entries(receipt.sourceHashes??{}).filter(([path])=>path.startsWith('src/')))if(s?.sourceHashes?.[path]!==hash)fail(`Populated fixture authority differs:${path}`);
   for(const path of mixedStatisticsHarnessFiles.filter(p=>!p.endsWith('.mjs')))if(s?.fixtureHashes?.[path]!==entry.harnessHashes?.[path])fail(`Populated fixture assertion source differs:${path}`);
   if(!Array.isArray(r.filters)||r.filters.length!==2||r.filters.some(f=>f.count!==100||f.unique!==100||f.pages!==4||f.pageLimit!==25)||r.allPages?.count!==200||r.allPages?.unique!==200||r.allPages?.pages!==8||r.allPages?.pageLimit!==25)fail('Mixed statistics full bounded archive paging incomplete');
  }
  if(group.length===2&&(group[0].result.handHistorySHA256!==group[1].result.handHistorySHA256||group[0].result.wallet!==group[1].result.wallet))fail('Populated reload changed histories or wallet');
 }
 const erase=commands.filter(r=>r.name==='erase'),deleted=commands.filter(r=>r.name==='deleted'),fresh=commands.filter(r=>r.name==='fresh-snapshot');
 if(erase.length!==2||erase.some(r=>r.result.wrongConfirmationPreserved!==true)||deleted.length!==2||deleted.some(r=>r.result.newBankrollCreated!==false||r.result.fixtureHandsDeleted!==200||!Array.isArray(r.result.keys)||!r.result.keys.includes('erasure')||r.result.keys.some(k=>!['erasure','lease'].includes(k))))fail('Populated explicit deletion proof incomplete');
 if(fresh.length!==2||fresh.some(r=>r.result.wallet!==1000000||r.result.financialEvents!==1||r.result.hands!==0||r.result.sessions!==0||r.result.oldRecordsRestored!==false))fail('Populated deletion/fresh-start accounting incomplete');
 return{id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,workflow:'populated-statistics',sourceCommit:entry.sourceCommit,harnessCommit:head,width:raw?.width,browser:raw?.browser,capture:entry.capture,proof:entry.proof,command:entry.command,commands,actualUIPlayedHands:raw?.actualUIPlayedHands,fixtureHands:raw?.fixtureHandsVerified};
}
