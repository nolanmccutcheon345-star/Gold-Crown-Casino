import {mountApp} from '../../src/ui/app';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {assertAccounting} from '../../src/core/engine';
import {ARCHETYPES,POLICY_VERSION} from '../../src/bots/policy';
import type {PopulationPreset} from '../../src/contracts';
import type {AppData,PersistencePort,PublicHand} from '../../src/session/types';
const query=new URLSearchParams(location.search),seats=Number(query.get('seats')),population=query.get('population') as PopulationPreset;
if(![2,6,9,10].includes(seats)||!['low','mid','high','neutral'].includes(population))throw Error('Unsupported isolated UI fixture');
const decisionMs:number[]=[];let reservedAt=0;
class MemoryPort implements PersistencePort{
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){
  if((this.data?.revision??null)!==expected)throw Error('Stale test port');
  const before=this.data?.active?.pending,after=data.active?.pending;
  if(after&&!after.decision&&!before)reservedAt=performance.now();
  if(after?.decision&&!before?.decision&&reservedAt)decisionMs.push(performance.now()-reservedAt);
  this.data=structuredClone(data);
 }
 close(){}
}
const controller=new SessionController(new MemoryPort());await controller.init();
await controller.startSession({...DEFAULT_SETTINGS,seats,buyIn:40000,population,opponents:Array.from({length:seats-1},(_,i)=>({selection:ARCHETYPES[i%ARCHETYPES.length],personalitySeed:40001+i*101,skill:i%2?.75:.35}))});
if(controller.error)throw Error(controller.error);controller.close();
// Mount the real application with this controller's already initialized persistence port.
mountApp(document.querySelector('#app')!,controller);
let running=false,target=0;const hands:PublicHand[]=[];const seen=new Set<string>();let clicks=0,started=0,lastMove=0;
const longTasks:number[]=[];
try{new PerformanceObserver(list=>{if(running)longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:false});}catch{/* Browser capability reported separately. */}
const quantile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]??0;
function report(status:string,error?:string){parent.postMessage({kind:'ui-hand-report',result:{status,error,seats,population,policyVersion:POLICY_VERSION,completed:hands.length,target,uiClicks:clicks,elapsedMs:started?performance.now()-started:0,decisionPreparation:{n:decisionMs.length,p50Ms:quantile(decisionMs,.5),p95Ms:quantile(decisionMs,.95),maxMs:Math.max(0,...decisionMs)},longTasks:{n:longTasks.length,maxMs:Math.max(0,...longTasks)},horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,walletCents:controller.data?.wallet,settlements:controller.data?.ledger.filter(e=>e.kind==='hand-net').length,handIds:hands.map(h=>h.handId),hands:status==='PASS'||status==='FAIL'?hands.map(({frames:_frames,...h})=>h):undefined}},location.origin);}
function click(selector:string){const button=document.querySelector<HTMLButtonElement>(selector);if(!button||button.disabled)return false;button.click();clicks++;lastMove=performance.now();return true;}
function readMoney(text:string){return Number(text.replace(/[^0-9.]/g,''))*100;}
async function advance(){
 if(!running)return;
 try{
  if(controller.error)throw Error(controller.error);
  if(performance.now()-lastMove>45000)throw Error('UI stopped making progress');
  if(controller.busy)return;
  const pace=document.querySelector<HTMLSelectElement>('#pace');if(pace&&pace.value!=='250'){pace.value='250';pace.dispatchEvent(new Event('change',{bubbles:true}));}
  const complete=document.querySelector('.complete-action');
  if(complete){const all=await controller.exportHistory(),last=all.hands.at(-1)!;if(!seen.has(last.handId)){seen.add(last.handId);hands.push(last);assertAccounting(controller.data!.active!.game);report('RUNNING');}
   if(hands.length>=target){running=false;report('PASS');return;}
   if(!click('#next-hand'))throw Error('Hero exhausted chips; completed hands retained. Run stopped rather than inventing funds.');
   return;
  }
  const call=document.querySelector<HTMLButtonElement>('#call');
  if(call&&!call.disabled){const stack=readMoney(document.querySelector('.hero-stack-label b')?.textContent??'0');const price=call.textContent?.includes('Check')?0:readMoney(call.textContent??'0');
   // Fixed public-information test Hero; no opponent cards or deck inspection.
   click(price>stack*.25?'#fold':'#call');
  }
 }catch(error){running=false;report('FAIL',(error as Error).message);}
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.kind!=='run-ui-hands'||running)return;target=Number(event.data.hands);if(![5,10].includes(target))return;running=true;started=performance.now();lastMove=started;report('RUNNING');});
setInterval(()=>{void advance();},100);
controller.subscribe(()=>{if(!running&&controller.status==='ready'&&hands.length===0)report('READY');});
setTimeout(()=>report('READY'),500);
