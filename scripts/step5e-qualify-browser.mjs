/** Qualify actual Step5E compiled-candidate captures. Never launches a browser,
 * never rewrites Step5D captures and never turns prepared assets into execution. */
import {sha,isRuntimeInput} from './step5d-ci-plan.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const step5eHarnessFiles=['tests/browser/step5e-compiled.ts','tests/browser/step5e-compiled-frame.ts','tests/browser/step5e-compiled.html','tests/browser/step5e-compiled-frame.html'];
export function verifyStep5EBrowser(entry,receipt,{read,exists,sourceAtCommit}){
 const errors=[],fail=value=>errors.push(value),load=ref=>{
  if(!ref?.path||!ref.sha256||!exists(ref.path)||sha(read(ref.path))!==ref.sha256){fail('Captured browser/proof bytes absent or changed');return null;}
  try{return JSON.parse(read(ref.path));}catch{fail('Invalid captured browser/proof JSON');return null;}
 };
 if(entry.format!=='ai-texas-step5e-native-compiled-workflows'||entry.version!==1||!entry.id)fail('Unsupported Step5E browser evidence entry');
 if(entry.sourceCommit!==receipt.sourceCommit)fail('Browser production source differs from candidate');
 if(!entry.command?.length)fail('Actual native browser procedure missing');
 const harnessCommit=entry.harnessCommit??receipt.sourceCommit;
 if(!/^[a-f0-9]{40}$/.test(harnessCommit??'')||typeof sourceAtCommit!=='function')fail('Actual harness source identity unavailable');
 for(const file of step5eHarnessFiles)try{if(entry.harnessHashes?.[file]!==sha(sourceAtCommit(harnessCommit,file)))fail(`Original executed harness bytes differ:${file}`);}catch{fail(`Original harness source missing:${file}`);}
 // Additional QA may follow a runtime freeze, but a new runtime may not be
 // silently certified by an older harness/runtime capture.
 if(harnessCommit!==receipt.sourceCommit)for(const [file,hash]of Object.entries(receipt.sourceHashes??{}).filter(([file])=>isRuntimeInput(file)))try{if(sha(sourceAtCommit(harnessCommit,file))!==hash)fail(`Separate harness changes production input:${file}`);}catch{fail(`Separate harness runtime proof missing:${file}`);}
 const raw=load(entry.capture),proof=load(entry.proof);
 if(proof?.format!=='ai-texas-step5e-exact-compiled-fixture'||proof.version!==1||proof.status!=='BUILD_BYTES_VERIFIED'||proof.sourceCommit!==receipt.sourceCommit)fail('Compiled preparation does not bind actual candidate');
 if(proof){
  if(!proof.executionReceipt||!exists(proof.executionReceipt)||sha(read(proof.executionReceipt))!==proof.executionReceiptSHA256)fail('Original compiled execution receipt absent or changed');
  else{const base=JSON.parse(read(proof.executionReceipt));if(base.status!=='PASS'||base.sourceCommit!==receipt.sourceCommit||!equal(base.buildHashes,receipt.buildHashes))fail('Compiled preparation references a different build');}
  const assets=Object.fromEntries((proof.assets??[]).map(asset=>[asset.source,asset.sha256]));
  if(!Object.keys(receipt.buildHashes??{}).length||!equal(Object.keys(assets).sort(),Object.keys(receipt.buildHashes??{}).sort())||Object.entries(receipt.buildHashes??{}).some(([file,hash])=>assets[file]!==hash))fail('Compiled capture assets differ from executed candidate');
 }
 if(!raw||raw.status!=='PASS'||raw.actualUIHands!==11||!raw.browser||!raw.at||!raw.run||!Number.isFinite(raw.width)||!Array.isArray(raw.reports))fail('Complete actual11-hand browser capture missing');
 const reports=raw?.reports??[];
 if(!reports.length||reports.some(item=>item.status!=='PASS'||item.error))fail('Captured workflow contains failed or absent records');
 const commands=reports.filter(item=>item.kind==='step5e-compiled-result');
 if(!commands.length||commands.some(item=>item.run!==raw.run||!item.name||!Number.isInteger(item.id)||!Array.isArray(item.trace))||new Set(commands.map(item=>item.id)).size!==commands.length)fail('Browser command identity/trace incomplete');
 if(!equal(commands.filter(item=>item.name==='start').map(item=>item.result?.count),[2,3,4,5,6,7,8,9,10]))fail('Actual2–10seat workflow incomplete');
 for(const item of commands){const states=[item.result,item.result?.before,item.result?.after].filter(state=>state?.sourceCommit);if(!states.length||states.some(state=>state.sourceCommit!==receipt.sourceCommit))fail(`Missing/wrong actual candidate identity:${item.name}`);}
 const last=reports.find(item=>item.check==='2–10 plus exact raise/custom-blind hands and exact single cashouts');
 if(!last||last.actualUIHands!==11||last.final?.hands!==11||last.final?.settlements!==11||last.final?.cashouts!==11||last.final?.active!==false)fail('Final exact11 settlements/cashouts invariant missing');
 for(const name of ['exact-raise','custom-three-seven','rerender-pending'])if(commands.filter(item=>item.name===name).length!==1)fail(`Required executed Step5E command absent:${name}`);
 return{id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,workflow:'cash',sourceCommit:entry.sourceCommit,harnessCommit,width:raw?.width,browser:raw?.browser,capture:entry.capture,proof:entry.proof,command:entry.command,commands};
}
