import type {GateFixtureSpec} from './step5b-gates-fixtures';
import {evidenceDownload} from './step5e-support';
const frame=document.querySelector<HTMLIFrameElement>('#frame')!,button=document.querySelector<HTMLButtonElement>('#run')!,mode=document.querySelector<HTMLSelectElement>('#matrix-mode')!,status=document.querySelector<HTMLElement>('#status')!,result=document.querySelector<HTMLElement>('#result')!,chunks=document.querySelector<HTMLSelectElement>('#evidence-chunk')!,evidence=document.querySelector<HTMLTextAreaElement>('#evidence')!;
type Case=GateFixtureSpec&{width:number;height:number};
type Row={case:Case;status:string;candidateSource:unknown;error?:string;[key:string]:unknown};
let serial=0,activeCase:Case|null=null,receive:((row:Row)=>void)|null=null,json='';
const exact:Case={kind:'mixed-granularity',seats:3,smallBlind:100,bigBlind:300,buyIn:30000,chipUnit:100,width:360,height:844};
function planned(selected:string):Case[]{
 if(selected==='exact')return[exact];
 const cases:Case[]=[];
 for(const seats of [2,3,6,9,10])for(const width of [320,375,390,430,768,1280])cases.push({kind:'layout-preflop',seats,width,height:width===768?1024:width===1280?900:844});
 // Explicit landscape cases are not inferred from portrait or physical-device claims.
 for(const seats of [6,9,10])cases.push({kind:'layout-preflop',seats,width:844,height:390});
 if(selected==='layout')return cases;
 for(const kind of ['facing-raise','side-pot','short-jam','raise-closed'] as const)for(const width of [320,360,430,1280])cases.push({kind,seats:kind==='short-jam'||kind==='raise-closed'?3:10,width,height:width===1280?900:844});
 for(const [smallBlind,bigBlind,buyIn]of [[100,300,45000],[200,500,75000],[5000,10000,1500000],[300,700,35000]])for(const street of ['preflop','flop'] as const)for(const width of [390,1280])cases.push({kind:'stake',seats:6,width,height:width===1280?900:844,smallBlind,bigBlind,buyIn,street});
 cases.push(exact);return cases;
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.kind!=='step5e-gate-result'||!receive)return;const row=event.data.result as Row;if(JSON.stringify(row.case)!==JSON.stringify(activeCase))return;receive({...row,executedAt:new Date().toISOString(),browser:navigator.userAgent});});
function show(test:Case):Promise<Row>{
 activeCase=test;frame.style.width=`${test.width}px`;frame.style.height=`${test.height}px`;frame.width=String(test.width);frame.height=String(test.height);
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{receive=null;reject(Error(`Actual browser case timed out: ${JSON.stringify(test)}`));},45000);receive=row=>{clearTimeout(timer);receive=null;resolve(row);};frame.src=`./step5e-gates-frame.html?spec=${encodeURIComponent(JSON.stringify(test))}&case=${++serial}`;});
}
chunks.onchange=()=>{const offset=Number(chunks.value)*40000;evidence.value=json.slice(offset,offset+40000);};
button.onclick=()=>{void(async()=>{
 button.disabled=true;mode.disabled=true;const selected=mode.value,cases=planned(selected),rows:Row[]=[],startedAt=new Date().toISOString();let pinnedSource:string|null=null;
 const publish=(state:string,error?:string)=>{const report={format:'step5e-native-gate-matrix',version:1,status:state,...(error?{error}:{}),startedAt,executedAt:new Date().toISOString(),browser:navigator.userAgent,mode:selected,plannedCases:cases,planned:cases.length,completed:rows.length,passed:rows.filter(row=>row.status==='PASS').length,failed:rows.filter(row=>row.status!=='PASS').length,actualUIPlayedHands:0,productionDatabaseAccessed:false,sourcePinned:pinnedSource!==null,screenReader:'NOT_EXECUTED',physicalDevice:'NOT_EXECUTED',results:rows};json=JSON.stringify(report,null,2);chunks.replaceChildren();for(let i=0;i<Math.ceil(json.length/40000);i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}/${Math.ceil(json.length/40000)}`;chunks.append(option);}evidence.value=json.slice(0,40000);evidenceDownload('download','step5e-cash-gates.json',report);result.textContent=JSON.stringify({...report,plannedCases:undefined,results:rows.map(row=>({case:row.case,status:row.status,error:row.error}))},null,2);};
 try{publish('RUNNING');for(const [index,test]of cases.entries()){status.textContent=`Running ${index+1}/${cases.length}: ${test.kind},${test.seats}seats,${test.width}×${test.height}`;const row=await show(test),source=JSON.stringify(row.candidateSource);if(pinnedSource===null)pinnedSource=source;else if(source!==pinnedSource)throw Error('Candidate production bundle changed during the matrix');rows.push(row);publish('RUNNING');}const passed=rows.every(row=>row.status==='PASS');publish(passed?'PASS':'FAIL');status.textContent=`${passed?'PASS':'FAIL'} · ${rows.filter(row=>row.status==='PASS').length}/${cases.length} actual browser cases;0UI-played complete hands`;}catch(error){publish('FAIL',String(error));status.textContent=`FAIL · ${String(error)}`;}finally{receive=null;activeCase=null;button.disabled=false;mode.disabled=false;}
 })();};
