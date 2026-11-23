import {mountApp} from '../../src/ui/app';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {assertAccounting} from '../../src/core/engine';
import {ARCHETYPES,POLICY_VERSION} from '../../src/bots/policy';
import {canonical} from '../../src/storage/integrity';
import type {PopulationPreset} from '../../src/contracts';
import type {AppData,PersistencePort,PublicHand} from '../../src/session/types';
const query=new URLSearchParams(location.search),seats=Number(query.get('seats')),population=query.get('population') as PopulationPreset;
if(![2,6,9,10].includes(seats)||!['low','mid','high','neutral'].includes(population))throw Error('Unsupported isolated UI fixture');
const decisionMs:number[]=[];let reservedAt=0;
class MemoryPort implements PersistencePort{
 data:AppData|null=null;inject=false;failures=0;commits=0;preservedPending='';
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){
  if((this.data?.revision??null)!==expected)throw Error('Stale test port');
  const before=this.data?.active?.pending,after=data.active?.pending;
  if(after&&!after.decision&&!before)reservedAt=performance.now();
  if(after?.decision&&!before?.decision&&reservedAt)decisionMs.push(performance.now()-reservedAt);
  if(this.inject&&before?.decision&&!after){this.inject=false;this.failures++;this.preservedPending=canonical(before);throw Error('Step5A isolated interrupted pending write');}
  this.data=structuredClone(data);this.commits++;
 }
 close(){}
}
const port=new MemoryPort(),controller=new SessionController(port);await controller.init();
await controller.startSession({...DEFAULT_SETTINGS,seats,buyIn:100000,population,opponents:Array.from({length:seats-1},(_,i)=>({selection:ARCHETYPES[i%ARCHETYPES.length],personalitySeed:50001+i*101,skill:i%2?.75:.35}))});
if(controller.error)throw Error(controller.error);controller.close();
mountApp(document.querySelector('#app')!,controller);
let running=false,target=0,working=false;const hands:PublicHand[]=[];const seen=new Set<string>();let clicks=0,rapidPairs=0,retries=0,started=0,lastProgress=0,lastGameKey='';
const longTasks:number[]=[],heapTrend:{hand:number;used:number|null;elapsedMs:number}[]=[],fundedCounts:number[]=[];
const heap=()=>{const m=(performance as Performance & {memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;return m?{used:m.usedJSHeapSize,total:m.totalJSHeapSize,limit:m.jsHeapSizeLimit}:null;};
const heapAtStart=heap();let peakHeap=heapAtStart?.used??0;
try{new PerformanceObserver(list=>{if(running)longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:false});}catch{/* Explicit capability reporting below. */}
const quantile=(a:number[],p:number)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]??0;
function report(status:string,error?:string){const now=heap();peakHeap=Math.max(peakHeap,now?.used??0);const data=controller.data!;parent.postMessage({kind:'ui-hand-report',result:{status,error,seats,population,policyVersion:POLICY_VERSION,completed:hands.length,target,uiClicks:clicks,rapidDoubleClickPairs:rapidPairs,interruptedWrites:port.failures,retryClicks:retries,persistCommits:port.commits,memory:{available:!!now,scope:'Chromium process estimate including test records; not isolated allocation, leak proof or physical-device claim',start:heapAtStart,end:now,peakUsedBytes:now?peakHeap:null,trend:heapTrend},elapsedMs:started?performance.now()-started:0,decisionPreparation:{n:decisionMs.length,p50Ms:quantile(decisionMs,.5),p95Ms:quantile(decisionMs,.95),maxMs:Math.max(0,...decisionMs)},longTasks:{n:longTasks.length,maxMs:Math.max(0,...longTasks)},horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,walletCents:data.wallet,heroStackCents:data.active?.game.seats.find(s=>s.id===0)?.stack,settlements:data.ledger.filter(e=>e.kind==='hand-net').length,topUps:data.ledger.filter(e=>e.kind==='top-up').map(e=>({id:e.id,amount:e.tableDelta})),handIds:hands.map(h=>h.handId),fundedSeatCounts:fundedCounts,records:status==='PASS'||status==='FAIL'?{format:'ai-texas-hold-em-public-history',version:'0.3.0',hands:hands.map(({frames:_frames,...h})=>h)}:undefined}},location.origin);}
function click(selector:string,rapid=false){const b=document.querySelector<HTMLButtonElement>(selector);if(!b||b.disabled)return false;b.click();clicks++;if(rapid){b.click();clicks++;rapidPairs++;}return true;}
const readMoney=(text:string)=>Math.round(Number(text.replace(/[^0-9.]/g,''))*100);
function checkAccounting(){const d=controller.data!,a=d.active!;assertAccounting(a.game);if(new Set(d.ledger.map(e=>e.id)).size!==d.ledger.length)throw Error('Duplicate financial identity');if(new Set(d.hands.map(h=>h.id)).size!==d.hands.length)throw Error('Duplicate settled hand');if(d.ledger.filter(e=>e.kind==='hand-net').length!==d.hands.length)throw Error('Settlement count mismatch');const totals=d.ledger.reduce((v,e)=>({wallet:v.wallet+e.walletDelta,table:v.table+e.tableDelta}),{wallet:0,table:0});if(totals.wallet!==d.wallet||totals.table!==a.game.seats.find(s=>s.id===0)!.stack)throw Error('Wallet/table ledger mismatch at settlement');}
async function advance(){
 if(!running||working)return;working=true;
 try{
  if(controller.status==='error'&&port.failures===1&&retries===0&&controller.error.includes('Step5A isolated')){
   if(canonical(controller.data?.active?.pending)!==port.preservedPending)throw Error('Pending decision changed after failed save');
   if(click('#retry-save'))retries++;return;
  }
  if(controller.error)throw Error(controller.error);
  const a=controller.data!.active!;const gameKey=`${a.game.handId}:${a.game.revision}:${a.game.street}:${a.game.actor}:${a.pending?.decisionId}:${!!a.pending?.decision}`;if(gameKey!==lastGameKey){lastGameKey=gameKey;lastProgress=performance.now();}
  if(performance.now()-lastProgress>45000)throw Error('No authoritative progress for45seconds');
  if(controller.busy)return;
  const pace=document.querySelector<HTMLSelectElement>('#pace');if(pace&&pace.value!=='250'){pace.value='250';pace.dispatchEvent(new Event('change',{bubbles:true}));}
  const topup=document.querySelector<HTMLInputElement>('#topup-amount');
  if(topup){const own=controller.data!.active!.game.seats.find(s=>s.id===0)!;const amount=100000-own.stack;if(amount>0){topup.value=String(amount/100);topup.dispatchEvent(new Event('input',{bubbles:true}));click('#topup-submit');}click('[data-action="continue-session"]');return;}
  const complete=document.querySelector('.complete-action');
  if(complete){const last=(await controller.exportHistory()).hands.at(-1)!;if(!seen.has(last.handId)){seen.add(last.handId);hands.push(last);checkAccounting();fundedCounts.push(last.view.seats.filter(s=>s.startingStack>0).length);heapTrend.push({hand:hands.length,used:heap()?.used??null,elapsedMs:performance.now()-started});report('RUNNING');}
   if(hands.length>=target){running=false;report('PASS');return;}
   const game=controller.data!.active!.game;
   if(game.seats.filter(s=>s.stack>0).length<2)throw Error('Only one funded player remains; no opponent money invented.');
   if(game.seats.find(s=>s.id===0)!.stack<20000){if(!click('#open-cashier'))throw Error('Top-up navigation unavailable');return;}
   if(!click('#next-hand',true))throw Error('Next hand unavailable');return;
  }
  const call=document.querySelector<HTMLButtonElement>('#call');if(call&&!call.disabled){const stack=readMoney(document.querySelector('.hero-stack-label b')?.textContent??'0'),price=call.textContent?.includes('Check')?0:readMoney(call.textContent??'0');click(price>stack*.25?'#fold':'#call',true);}
 }catch(error){running=false;report('FAIL',(error as Error).message);}finally{working=false;}
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.kind!=='run-ui-hands'||running)return;target=Number(event.data.hands);if(![5,25,100].includes(target))return;port.inject=!!event.data.fault;running=true;started=performance.now();lastProgress=started;report('RUNNING');});
setInterval(()=>{void advance();},100);
controller.subscribe(()=>{if(!running&&controller.status==='ready'&&hands.length===0)report('READY');});
setTimeout(()=>report('READY'),500);
