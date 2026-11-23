import type {GateFixtureSpec} from './step5b-gates-fixtures';
const frame=document.querySelector<HTMLIFrameElement>('#gate-table')!,status=document.querySelector('#status')!,output=document.querySelector('#result')!;
const run=document.querySelector<HTMLButtonElement>('#run-gates')!,keyboard=document.querySelector<HTMLButtonElement>('#prepare-keyboard')!;
type Case=GateFixtureSpec&{width:number;height:number};
let counter=0,receive:((row:Record<string,unknown>)=>void)|null=null;
const evidence:Record<string,unknown>[]=[];
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.kind!=='step5b-gate-result')return;const row=event.data.result;if(receive)receive(row);else{evidence.push(row);output.textContent=JSON.stringify({status:row.status,scope:'Keyboard automation, not a screen-reader or physical-device claim',userAgent:navigator.userAgent,results:evidence},null,2);status.textContent=String(row.status)+' · '+String(row.case?.kind??'keyboard');}});
function show(test:Case):Promise<Record<string,unknown>>{
 const id=++counter;frame.width=String(test.width);frame.height=String(test.height);
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{receive=null;reject(Error(`Browser fixture timed out: ${JSON.stringify(test)}`));},25000);receive=row=>{clearTimeout(timer);receive=null;resolve(row);};frame.src=`./step5b-gates-frame.html?spec=${encodeURIComponent(JSON.stringify(test))}&id=${id}`;});
}
run.onclick=()=>{void(async()=>{
 run.disabled=true;keyboard.disabled=true;evidence.length=0;
 const cases:Case[]=[];
 for(let seats=2;seats<=10;seats++)for(const [width,kind] of [[390,'layout-preflop'],[390,'layout-flop'],[1440,'layout-preflop']] as const)cases.push({kind,seats,width,height:850});
 for(const width of [320,390,1440])cases.push({kind:'facing-raise',seats:10,width,height:850});
 for(const [smallBlind,bigBlind,buyIn] of [[100,300,45000],[200,500,75000],[5000,10000,1500000],[300,700,35000]])cases.push({kind:'stake',seats:6,width:390,height:850,smallBlind,bigBlind,buyIn});
 cases.push({kind:'stake',seats:6,width:390,height:850,smallBlind:300,bigBlind:700,buyIn:35000,street:'flop'});
 for(const width of [390,1440])cases.push({kind:'side-pot',seats:10,width,height:850});
 for(const kind of ['short-jam','raise-closed','mixed-granularity'] as const)cases.push({kind,seats:3,width:390,height:850,...(kind==='mixed-granularity'?{smallBlind:100,bigBlind:300,chipUnit:100}:{})});
 for(const [index,test] of cases.entries()){status.textContent=`Running ${index+1}/${cases.length}: ${test.kind}, ${test.seats} seats, ${test.width}px`;const row=await show(test);evidence.push(row);output.textContent=JSON.stringify({status:'RUNNING',total:cases.length,completed:evidence.length,userAgent:navigator.userAgent,results:evidence},null,2);}
 const passed=evidence.filter(row=>row.status==='PASS').length;status.textContent=`${passed===cases.length?'PASS':'FAIL'} · ${passed}/${cases.length} actual interface cases`;
 output.textContent=JSON.stringify({status:passed===cases.length?'PASS':'FAIL',total:cases.length,passed,failed:cases.length-passed,userAgent:navigator.userAgent,screenReader:'NOT_EXECUTED',physicalDevice:'NOT_EXECUTED',results:evidence},null,2);
 })().catch(error=>{status.textContent='FAIL';output.textContent=JSON.stringify({status:'FAIL',error:String(error),results:evidence},null,2);}).finally(()=>{run.disabled=false;keyboard.disabled=false;});};
keyboard.onclick=()=>{void(async()=>{status.textContent='Preparing trusted keyboard check…';const row=await show({kind:'keyboard',seats:10,width:390,height:850});evidence.length=0;evidence.push(row);output.textContent=JSON.stringify({status:row.status,results:evidence},null,2);status.textContent=`${row.status} · Press Tab then Enter in the browser; Fold has focus inside the frame.`;})().catch(error=>{status.textContent=String(error);});};
