/** Actual populated compiled statistics captures; generated fixture hands are
 * deliberately not counted as browser-played hands or timed human sessions. */
import {sha,isRuntimeInput} from './step5d-ci-plan.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const signed=cents=>(cents>0?'+':cents<0?'−':'')+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:cents%100?2:0}).format(Math.abs(cents)/100);
const cents=text=>{const match=/^([+−-]?)\$([0-9,]+)(?:\.([0-9]{2}))?$/.exec(text??'');return match?(match[1]==='−'||match[1]==='-'?-1:1)*(Number(match[2].replaceAll(',',''))*100+Number(match[3]??0)):NaN;};
export const statisticsHarnessFiles=['tests/browser/step5e-exact-stats.ts','tests/browser/step5e-exact-stats.html','tests/browser/step5e-support.ts','tests/step5b-statistics/browser-fixture.ts','tests/step5e-browser/capture-stats-source.mjs'];
export function verifyStep5EStatistics(entry,receipt,{read,exists,sourceAtCommit}){
 const errors=[],fail=value=>errors.push(value),load=ref=>{if(!ref?.path||!ref.sha256||!exists(ref.path)||sha(read(ref.path))!==ref.sha256){fail('Actual statistics capture/proof absent or changed');return null;}try{return JSON.parse(read(ref.path));}catch{fail('Invalid statistics capture JSON');return null;}};
 if(entry.format!=='ai-texas-step5e-native-exact-statistics'||entry.version!==1||!entry.id||entry.sourceCommit!==receipt.sourceCommit)fail('Statistics entry is not bound to candidate');
 const head=entry.harnessCommit??receipt.sourceCommit;
 if(!entry.command?.length||!/^[a-f0-9]{40}$/.test(head??''))fail('Actual statistics procedure/harness source missing');
 for(const path of statisticsHarnessFiles)try{if(entry.harnessHashes?.[path]!==sha(sourceAtCommit(head,path)))fail(`Actual statistics assertion source differs:${path}`);}catch{fail(`Actual statistics source unavailable:${path}`);}
 if(head!==receipt.sourceCommit)for(const [path,hash]of Object.entries(receipt.sourceHashes??{}).filter(([path])=>isRuntimeInput(path)))try{if(sha(sourceAtCommit(head,path))!==hash)fail(`Statistics harness production source differs:${path}`);}catch{fail(`Statistics production source unavailable:${path}`);}
 const raw=load(entry.capture),proof=load(entry.proof);
 if(proof?.format!=='ai-texas-step5e-exact-compiled-fixture'||proof.version!==1||proof.status!=='BUILD_BYTES_VERIFIED'||proof.sourceCommit!==receipt.sourceCommit)fail('Statistics compiled preparation not candidate-bound');
 if(proof){
  if(!proof.executionReceipt||!exists(proof.executionReceipt)||sha(read(proof.executionReceipt))!==proof.executionReceiptSHA256)fail('Statistics original build receipt absent or changed');
  else{const base=JSON.parse(read(proof.executionReceipt));if(base.status!=='PASS'||base.sourceCommit!==receipt.sourceCommit||!equal(base.buildHashes,receipt.buildHashes))fail('Statistics build receipt differs');}
  const assets=Object.fromEntries((proof.assets??[]).map(a=>[a.source,a.sha256]));if(!Object.keys(receipt.buildHashes??{}).length||Object.keys(assets).length!==Object.keys(receipt.buildHashes).length||Object.entries(receipt.buildHashes).some(([path,hash])=>assets[path]!==hash))fail('Statistics compiled assets differ');
 }
 const mode=raw?.mode??'formula',count=mode==='station'?100:300;
 if(!raw||!['formula','station'].includes(mode)||raw.status!=='PASS'||!raw.at||!raw.browser||raw.productionDatabaseAccessed!==false||raw.fixtureHands!==count||raw.actualUIPlayedHands!==0||![1,10].includes(raw.recordedHours)||!Array.isArray(raw.checks))fail('No complete actual300-fixture/100-station/zeroUIhands statistics capture');
 if(raw?.compiledProof?.sourceCommit!==receipt.sourceCommit||raw?.compiledProof?.executionReceipt!==proof?.executionReceipt)fail('Observed statistics bundle identity differs');
 const source=raw?.sourceReceipt;
 const declared=Array.isArray(source?.supportedFixtureCounts)&&source.supportedFixtureCounts.includes(count)||mode==='formula'&&source?.fixtureHands===300;
 if(source?.format!=='step5e-exact-compiled-stats-source'||source.version!==1||source.status!=='SOURCE_BYTES_VERIFIED_NOT_BROWSER_EXECUTED'||source.compiledSourceCommit!==receipt.sourceCommit||source.sourceHead!==head||!declared||source.actualUIPlayedHands!==0)fail('Observed fixture source proof missing');
 for(const [path,hash]of Object.entries(receipt.sourceHashes??{}).filter(([path])=>path.startsWith('src/')))if(source?.sourceHashes?.[path]!==hash)fail(`Observed fixture authority differs:${path}`);
 for(const path of ['tests/step5b-statistics/browser-fixture.ts','tests/browser/step5e-exact-stats.ts','tests/browser/step5e-exact-stats.html'])if(source?.fixtureHashes?.[path]!==entry.harnessHashes?.[path])fail(`Observed fixture/harness assertion mismatch:${path}`);
 const checks=raw?.checks??[];if(checks.length!==3||checks.some(c=>c.status!=='PASS'||c.error))fail('Exact statistics checks absent or failed');
 const pace=checks.filter(c=>c.check===(mode==='station'?'G05 measured station-policy fixture results and population warning':'G04/X10 exact observed10BB100 and hypothetical pace'));
 if(!equal(pace.map(c=>c.assumedHandsPerHour),[30,60]))fail('Actual30and60pace input checks missing');
 const profit=mode==='formula'?6000:cents(pace[0]?.actual?.profit),bb100=100*(profit/200)/count;
 if(!Number.isSafeInteger(profit))fail('Actual station result is not integer-cent money');
 for(const c of pace){const assumption=c.assumedHandsPerHour,expected={hands:String(count),bb100:bb100.toFixed(2),profit:signed(profit),actualPerHour:signed(Math.round(profit/raw.recordedHours)),tracked:`${raw.recordedHours*60}.0 min`,equivalent:(count/assumption).toFixed(2),projectedBB:(bb100*assumption/100).toFixed(2),projectedCash:signed(Math.round(profit/count*assumption))};if(c.recordedHours!==raw.recordedHours||!equal(c.expected,expected)||!equal(c.actual,expected)||c.canonicalSnapshotUnchanged!==true)fail('Actual expected/observed pace arithmetic or invariance differs');}
 const paging=checks.find(c=>c.check==='Lazy full archive and bounded history pagination');if(!paging||paging.pages!==Math.ceil(count/25)||paging.records!==count||paging.unique!==count||paging.pageLimit!==25||paging.canonicalSnapshotUnchanged!==true)fail('Actual complete bounded history paging not verified');
 const commands=checks.map((check,index)=>({id:index+1,name:check===paging?'paged-history':'pace-statistics',status:check.status,result:check,source:'Actual captured check array; not invented UI-played hands'}));
 return{id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,workflow:mode==='station'?'station-statistics':'exact-statistics',sourceCommit:entry.sourceCommit,harnessCommit:head,width:raw?.width??null,browser:raw?.browser,capture:entry.capture,proof:entry.proof,command:entry.command,commands,actualUIPlayedHands:raw?.actualUIPlayedHands,fixtureHands:raw?.fixtureHands,recordedHours:raw?.recordedHours};
}
