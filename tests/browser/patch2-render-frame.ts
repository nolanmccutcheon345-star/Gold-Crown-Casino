import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {GateMemoryPort} from './step5b-gates-fixtures';
import {canonical,validateData} from '../../src/storage/integrity';
import {assertAccounting} from '../../src/core/engine';
import type {AppData} from '../../src/session/types';
const ensure=(v:unknown,message:string)=>{if(!v)throw Error(message);};
const pause=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const quantiles=(samples:number[])=>{const s=[...samples].sort((a,b)=>a-b),q=(p:number)=>s[Math.max(0,Math.ceil(s.length*p)-1)];return{count:s.length,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:s.at(-1),samplesMs:samples};};
let started=false;
window.addEventListener('message',event=>{if(started||event.origin!==location.origin||event.source!==parent||event.data?.kind!=='patch2-render-start')return;started=true;void(async()=>{
 const {round,variant,fixtureSHA256}=event.data;const data=structuredClone(event.data.data) as AppData;await validateData(data);ensure(data.active?.game.actor===0,'Fixture not Hero turn');
 const port=new GateMemoryPort();port.data=data;const controller=new SessionController(port);mountApp(document.querySelector<HTMLElement>('#app')!,controller);
 try{
  const start=performance.now();while(controller.status!=='ready'||controller.busy||!document.querySelector<HTMLButtonElement>('[data-step="1"]')||document.querySelector<HTMLButtonElement>('[data-step="1"]')!.disabled){ensure(performance.now()-start<20000,'App ready timeout');ensure(!controller.error,controller.error);await pause();}
  await pause();ensure(!controller.data!.active!.paused,'Fixture unexpectedly paused');const initialGame=canonical(controller.data!.active!.game),initialLedger=canonical(controller.data!.ledger),initialWallet=controller.data!.wallet;
  const proposal:number[]=[],render:number[]=[];let stable=0,replaced=0;const firstFold=document.querySelector('#fold');
  for(let sample=-10;sample<100;sample++){
   const step=sample%2===0?'1':'-1',button=document.querySelector<HTMLButtonElement>(`[data-step="${step}"]`)!;ensure(button&&!button.disabled,'Proposal unavailable');
   let t=performance.now();button.click();document.querySelector('#raise')!.getBoundingClientRect();const proposalElapsed=performance.now()-t;
   const before=document.querySelector('#fold');const redraw=document.querySelector<HTMLButtonElement>('#continue-session')!;ensure(redraw&&!redraw.disabled,'Continue session unavailable');
   t=performance.now();redraw.click();document.querySelector('#raise')!.getBoundingClientRect();const renderElapsed=performance.now()-t;
   if(sample>=0){proposal.push(proposalElapsed);render.push(renderElapsed);if(before===document.querySelector('#fold'))stable++;else replaced++;}
  }
  assertAccounting(controller.data!.active!.game);const gameUnchanged=canonical(controller.data!.active!.game)===initialGame,ledgerUnchanged=canonical(controller.data!.ledger)===initialLedger,walletUnchanged=controller.data!.wallet===initialWallet;
  ensure(gameUnchanged&&ledgerUnchanged&&walletUnchanged,'Proposal/render altered financial/game state');
  parent.postMessage({kind:'patch2-render-result',result:{status:'PASS',round,variant,fixtureSHA256,proposal:quantiles(proposal),renderAndLayout:quantiles(render),buttonIdentity:{stable,replaced,initialStillPresent:firstFold===document.querySelector('#fold')},gameUnchanged,ledgerUnchanged,walletUnchanged,build:JSON.parse(document.querySelector('#build-proof')!.textContent!)}},location.origin);
 }finally{controller.close();}
 })().catch(error=>parent.postMessage({kind:'patch2-render-result',result:{status:'FAIL',error:String(error)}},location.origin));});
parent.postMessage({kind:'patch2-render-ready'},location.origin);
