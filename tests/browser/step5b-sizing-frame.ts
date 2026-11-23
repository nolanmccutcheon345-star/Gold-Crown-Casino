import {mountApp} from '../../src/ui/app';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {applyCommand,assertAccounting,projectView} from '../../src/core/engine';
import {validateData} from '../../src/storage/integrity';
import type {Action} from '../../src/contracts';
import type {AppData,PersistencePort} from '../../src/session/types';

class IsolatedPort implements PersistencePort{
 data:AppData|null=null;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw Error('Isolated sizing revision conflict');this.data=structuredClone(next);this.commits++;}
 close(){}
}
const port=new IsolatedPort(),seed=new SessionController(port);await seed.init();
await seed.startSession({...DEFAULT_SETTINGS,seats:3,capacity:3,buyIn:30000,opponents:[{selection:'tag',personalitySeed:11},{selection:'station',personalitySeed:22}]});
if(seed.error)throw Error(seed.error);const data=structuredClone(seed.data!);seed.close();const active=data.active!;
const prefix:Action[]=[{type:'raise',to:600},{type:'raise',to:1800},{type:'fold'}];
for(const [index,action] of prefix.entries()){
 const game=active.game;if(game.actor!==index)throw Error('Unexpected engine action order while building fixture');
 active.game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:index,decisionId:`sizing-prefix:${index}`,action});active.frames.push(projectView(active.game,0));
}
await validateData(data);port.data=data;
const controller=new SessionController(port);mountApp(document.querySelector('#app')!,controller);
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(test:()=>boolean,message:string){for(let i=0;i<150;i++){if(test())return;await delay(20);}throw Error(message);}
function assert(test:unknown,message:string):asserts test {if(!test)throw Error(message);}
function button(selector:string){const element=document.querySelector<HTMLButtonElement>(selector);assert(element&&!element.disabled,`Enabled visible button missing: ${selector}`);assert(element.getBoundingClientRect().height>0,`Button is not displayed: ${selector}`);return element;}
function click(selector:string){button(selector).click();}
function input(selector:string,value:string,type='input'){const element=document.querySelector<HTMLInputElement>(selector);assert(element&&!element.disabled,`Editable input missing: ${selector}`);element.value=value;element.dispatchEvent(new Event(type,{bubbles:true}));}
const cents=(text:string)=>Math.round(Number(text.replace(/[^0-9.-]/g,''))*100);
function proposal(expected:number,legal=true){
 const field=document.querySelector<HTMLInputElement>('#raise-to')!,additional=document.querySelector('#raise-additional')!,commit=document.querySelector<HTMLButtonElement>('#raise')!;
 assert(Math.round(Number(field.value)*100)===expected,`Expected proposal ${expected}; saw ${field.value}`);
 assert(cents(additional.textContent??'')===expected-600,`Incorrect additional amount for ${expected}`);
 assert(commit.disabled===!legal,`Incorrect legal/disabled state for ${expected}`);
 return{to:expected,additional:expected-600,legal};
}
function report(phase:string,status:string,details:Record<string,unknown>={}){parent.postMessage({kind:'step5b-sizing-report',result:{phase,status,...details}},location.origin);}
function geometry(){
 const more=document.querySelector<HTMLDetailsElement>('#sizing-more');if(more)more.open=true;
 const selectors=['#raise-to','#raise-additional','#raise-limits','#pot-slider','#fold','#call','#raise'];
 const rects=selectors.map(selector=>{const el=document.querySelector<HTMLElement>(selector)!;const r=el.getBoundingClientRect();assert(r.width>0&&r.height>0,`${selector} is not visible`);assert(r.left>=-1&&r.right<=innerWidth+1,`${selector} is outside the ${innerWidth}px viewport`);const fontSize=getComputedStyle(el).fontSize;if(selector!=='#pot-slider')assert(Number.parseFloat(fontSize)>=(selector==='#raise-to'?16:12),`${selector} critical text is too small: ${fontSize}`);return{selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,fontSize};});
 const pair=rects.slice(-3);for(let i=0;i<pair.length;i++)for(let j=i+1;j<pair.length;j++)assert(Math.min(pair[i].right,pair[j].right)-Math.max(pair[i].left,pair[j].left)<=1||Math.min(pair[i].bottom,pair[j].bottom)-Math.max(pair[i].top,pair[j].top)<=1,'Action buttons overlap');
 const amountRects=rects.slice(0,4);for(let i=0;i<amountRects.length;i++)for(let j=i+1;j<amountRects.length;j++)assert(Math.min(amountRects[i].right,amountRects[j].right)-Math.max(amountRects[i].left,amountRects[j].left)<=1||Math.min(amountRects[i].bottom,amountRects[j].bottom)-Math.max(amountRects[i].top,amountRects[j].top)<=1,'Critical sizing amounts or slider overlap');
 assert(document.documentElement.scrollWidth<=innerWidth,'Unexpected horizontal scrolling');
 return{viewport:innerWidth,horizontalOverflow:false,rects,minimum:document.querySelector('#raise-limits')?.textContent};
}
let running=false;
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||running||!['step5b-sizing-run','step5b-sizing-rapid'].includes(event.data?.kind))return;
 running=true;const phase=event.data.kind==='step5b-sizing-run'?'sizing-controls':'double-tap';
 void(async()=>{
  await waitFor(()=>controller.status==='ready'&&!controller.busy,'Controller not ready');assert(!controller.error,controller.error);const game=controller.data!.active!.game;
  assert(game.actor===0&&game.street==='preflop'&&game.pot===2600&&game.seats[0].streetCommitted===600,'Fixture is no longer at Hero’s three-bet response');
  if(phase==='sizing-controls'){
   const checks:unknown[]=[];
   for(const [selector,expected,legal] of [['25',2750,false],['33',3054,true],['half',3700,true],['75',4650,true],['pot',5600,true],['150',7500,true],['200',9400,true]] as const){click(`[data-size="${selector}"]`);checks.push({control:selector,...proposal(expected,legal)});}
   document.querySelector<HTMLElement>('.sizing-shortcuts summary')!.click();
   input('#custom-pot-percent','50');click('#custom-pot-apply');checks.push({control:'custom50',...proposal(3700)});
   input('#raise-to','37');checks.push({control:'numeric37',...proposal(3700)});
   input('#shortcut-bb','18.5');click('#shortcut-bb-apply');checks.push({control:'BB18.5',...proposal(3700)});
   input('#increment-bb','1');click('#increment-bb-apply');checks.push({control:'increment1BB',...proposal(3900)});
   input('#custom-pot-percent','1000');click('#custom-pot-apply');checks.push({control:'above-stack1000%',...proposal(39800,false)});
   click('[data-size="min"]');checks.push({control:'minimum',...proposal(3000)});
   click('[data-size="all"]');checks.push({control:'maximum',...proposal(30000)});
   input('#pot-slider','100');checks.push({control:'slider100',...proposal(5600)});
   document.querySelector<HTMLElement>('.sizing-shortcuts summary')!.click();
   document.querySelector('.action-panel')!.scrollIntoView({block:'start'});await delay(50);
   const layout=geometry();assert(controller.data!.active!.game.revision===game.revision,'Sizing proposal changed authoritative game state');
   report(phase,'PASS',{checks,layout,authoritativeRevisionUnchanged:true,publicPrefix:game.events.filter(e=>e.type==='action').map(({seatId,action,amount})=>({seatId,action,amount})),pot:game.pot,callAmount:1200,priorStreetCommitment:600});
  }else{
   input('#pot-slider','100');proposal(5600);const pace=document.querySelector<HTMLSelectElement>('#pace')!;pace.value='1800';pace.dispatchEvent(new Event('change',{bubbles:true}));
   const beforeHeroActions=game.events.filter(e=>e.type==='action'&&e.seatId===0).length,revision=game.revision,beforeCommits=port.commits;
   const commit=button('#raise');commit.click();commit.click();
   await waitFor(()=>!!controller.data?.active&&controller.data.active.game.revision>revision&&!controller.busy,'Raise did not finish saving');
   click('#pause');await waitFor(()=>!!controller.data?.active?.paused&&!controller.busy,'Could not pause after the committed raise');
   const current=controller.data!.active!.game,hero=current.seats.find(seat=>seat.id===0)!;
   assert(current.events.filter(e=>e.type==='action'&&e.seatId===0).length===beforeHeroActions+1,'Rapid click committed more than one Hero action');
   assert(current.revision===revision+1,'Unexpected additional authoritative action before pause');
   assert(hero.streetCommitted===5600&&hero.stack===24400,'Incorrect Hero chips after one raise');assertAccounting(current);
   assert(new Set(current.committedDecisionIds).size===current.committedDecisionIds.length,'Duplicate decision identity');
   const financial=controller.data!.ledger.reduce((sum,event)=>sum+event.tableDelta,0);assert(financial===hero.stack+hero.totalCommitted,'Hero bankroll/table reconciliation failed');
   report(phase,'PASS',{clicks:2,heroActionsCommitted:1,revisionBefore:revision,revisionAfter:current.revision,heroStack:hero.stack,heroStreetCommitted:hero.streetCommitted,pot:current.pot,wallet:controller.data!.wallet,tableLedger:financial,persistenceCommitsIncludingPendingAndPause:port.commits-beforeCommits,engineAccounting:true,uniqueDecisions:true,paused:true});
  }
 })().catch(error=>report(phase,'FAIL',{error:(error as Error).message})).finally(()=>{running=false;});
});
await waitFor(()=>controller.status==='ready'&&!controller.busy,'Fixture could not load');assert(!controller.error,controller.error);
document.querySelector('.action-panel')!.scrollIntoView({block:'start'});
report('fixture','READY',{pot:2600,priorStreetCommitment:600,callAmount:1200,minimumRaiseTo:3000,maximumRaiseTo:30000,width:innerWidth,storage:'isolated memory only',publicPrefix:prefix});
