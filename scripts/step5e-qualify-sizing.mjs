/** Verifies actual isolated browser sizing evidence. The production-module QA
 * bundle is distinct from the ordinary dist application; both identities stay explicit. */
import {sha,isRuntimeInput} from './step5d-ci-plan.mjs';
export const sizingHarnessFiles=['tests/browser/step5e-gates.ts','tests/browser/step5e-gates-frame.ts','tests/browser/step5e-gates.html','tests/browser/step5e-gates-frame.html','tests/browser/step5b-gates-fixtures.ts','tests/browser/step5e-support.ts','tests/step5e-browser/build-runtimes.mjs'];
export function verifyStep5ESizing(entry,receipt,{read,exists,sourceAtCommit}){
 const errors=[],fail=message=>errors.push(message),load=ref=>{if(!ref?.path||!ref.sha256||!exists(ref.path)||sha(read(ref.path))!==ref.sha256){fail('Sizing capture/provenance missing or changed');return null;}try{return JSON.parse(read(ref.path));}catch{fail('Sizing capture/provenance is invalid JSON');return null;}};
 if(entry.format!=='ai-texas-step5e-native-sizing'||entry.version!==1||!entry.id||entry.sourceCommit!==receipt.sourceCommit)fail('Sizing entry is not bound to candidate');
 if(!entry.command?.length||!/^[a-f0-9]{40}$/.test(entry.harnessCommit??''))fail('Actual sizing procedure/harness source missing');
 for(const path of sizingHarnessFiles)try{if(entry.harnessHashes?.[path]!==sha(sourceAtCommit(entry.harnessCommit,path)))fail(`Sizing assertion source differs:${path}`);}catch{fail(`Sizing assertion source unavailable:${path}`);}
 const captured=load(entry.capture),manifest=load(entry.proof),raw=entry.resultIndex===undefined?captured:captured?.results?.[entry.resultIndex];
 if(entry.resultIndex!==undefined&&(!Number.isInteger(entry.resultIndex)||entry.resultIndex<0||captured?.format!=='step5e-native-gate-matrix'||captured.status!=='PASS'||!raw))fail('Sizing result is not an actual retained matrix row');
 if(manifest?.format!=='ai-texas-step5e-runtime-provenance'||manifest.version!==1||manifest.name!=='candidate'||manifest.productionDirty!==''||!/^[a-f0-9]{40}$/.test(manifest.sourceCommit??''))fail('Unverified or dirty production-module QA bundle');
 if(JSON.stringify(raw?.candidateSource)!==JSON.stringify(manifest))fail('Observed QA bundle identity differs from retained manifest');
 for(const commit of [entry.harnessCommit,manifest?.sourceCommit])for(const [path,hash]of Object.entries(receipt.sourceHashes??{}).filter(([path])=>isRuntimeInput(path)))try{if(sha(sourceAtCommit(commit,path))!==hash)fail(`Sizing runtime differs from compiled candidate:${commit}:${path}`);}catch{fail(`Sizing runtime source unavailable:${commit}:${path}`);}
 if(!Object.keys(manifest?.sourceFiles??{}).length)fail('QA bundle has no source inputs');
 for(const [path,hash]of Object.entries(manifest?.sourceFiles??{})){if(receipt.sourceHashes?.[path]!==hash)fail(`QA bundle imported source differs:${path}`);}
 const assets=manifest?.artifacts??[];
 if(assets.length!==2||!assets.some(a=>a.path.endsWith('.js.bin'))||!assets.some(a=>a.path.endsWith('.css.bin')))fail('QA bundle JS/CSS artifacts missing');
 for(const asset of assets)if(!exists(asset.path)||read(asset.path).length!==asset.bytes||sha(read(asset.path))!==asset.sha256)fail(`Actual QA bundle bytes changed:${asset.path}`);
 if(raw?.status!=='PASS'||raw.error||!raw.executedAt||!raw.browser||raw.nonTraining!==true||raw.actualUIPlayedHands!==0||raw.storage!=='isolated memory only')fail('No complete isolated actual sizing capture');
 const spec=raw?.case,exact=raw?.exact360Response,mixed=raw?.invalidAndMixed;
 if(spec?.kind!=='mixed-granularity'||spec.width!==360||spec.seats!==3||spec.smallBlind!==100||spec.bigBlind!==300||spec.buyIn!==30000)fail('Literal360px three-player1/3 fixture not executed');
 const required={width:360,previousStreetContribution:900,displayedRaiseTo:10800,additionalCommitment:9900,minimum:4500,maximum:30000,rapidClicks:2,staleClick:1,committedActions:1,engineAccounting:true};
 if(!exact||Object.entries(required).some(([key,value])=>exact[key]!==value))fail('Literal cumulative raise/min/max/idempotency assertions missing');
 if(raw?.pot!==6300||raw?.legal?.callAmount!==1800||mixed?.potAfterCall!==8100||mixed?.total100Percent!==10800||mixed?.additional!==9900||mixed?.authoritativeRevisionUnchanged!==true||JSON.stringify(mixed?.invalidRejected)!==JSON.stringify(['44','45.01','300.01','']))fail('Independent sizing arithmetic/invalid-action rejection differs');
 const controls=raw?.controls??[],selectors=['#fold','#call','#raise','#raise-to','#raise-additional','#raise-limits','.hero-stack-label','#pot-slider'];
 if(controls.length!==selectors.length||selectors.some(selector=>!controls.some(c=>c.selector===selector)))fail('Complete sizing-control geometry missing');
 for(const box of controls){if(!Number.isFinite(box.x)||!Number.isFinite(box.y)||!(box.width>0&&box.height>0)||box.x< -1||box.right>361)fail('Sizing control hidden/clipped');if(['#fold','#call','#raise'].includes(box.selector)&&(box.height<44||box.y<0||box.bottom>spec.height-55))fail('Action control not accessible in360viewport');if(box.selector!=='#pot-slider'&&box.selector!=='.hero-stack-label'&&Number.parseFloat(box.font)<(box.selector==='#raise-to'?16:12))fail('Sizing label too small');}
 for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)if(Math.min(controls[i].right,controls[j].right)-Math.max(controls[i].x,controls[j].x)>.5&&Math.min(controls[i].bottom,controls[j].bottom)-Math.max(controls[i].y,controls[j].y)>.5)fail('Sizing controls overlap');
 if(raw?.tableGeometry?.horizontalOverflow!==false)fail('Horizontal layout overflow');
 return{id:entry.id,status:errors.length?'NOT_QUALIFIED':'QUALIFIED',errors,workflow:'gate-sizing',sourceCommit:receipt.sourceCommit,harnessCommit:entry.harnessCommit,runtimeBundleCommit:manifest?.sourceCommit,width:360,browser:raw?.browser,capture:entry.capture,proof:entry.proof,command:entry.command,commands:[{id:1,name:'360-sizing',status:raw?.status,result:raw}],limitations:['Actual browser confirmation clicks; no physical touch-device claim.','Isolated production-module QA bundle, not the ordinary dist entry point.']};
}
