import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController} from '../../src/session/controller';
import {mountApp} from '../../src/ui/app';
import {digest} from '../../src/storage/integrity';
import type {AppData,PersistencePort} from '../../src/session/types';
const run=new URLSearchParams(location.search).get('run')??'manual';
if(!/^[a-zA-Z0-9.-]{1,80}$/.test(run))throw Error('Invalid isolated QA run name');
const databaseName=`ai-texas-hold-em-test-step5a-${run}`;
document.querySelector('#database-name')!.textContent=databaseName;
class FaultPort implements PersistencePort {
 base=new BrowserPersistence(databaseName);last:AppData|null=null;fault='';
 get writable(){return this.base.writable;}
 async load(){this.last=await this.base.load();return this.last;}
 async commit(expected:number|null,next:AppData){
  const payout=next.hands.length>(this.last?.hands.length??0);
  const bot=next.active?.pending?.decision&&!this.last?.active?.pending?.decision;
  const fault=this.fault;
  if((payout&&fault==='payout')||(bot&&fault==='bot')){this.fault='';document.querySelector('#fault-status')!.textContent='Injected write failure occurred';throw new Error('TEST: storage write interrupted before commit.');}
  await this.base.commit(expected,next);this.last=structuredClone(next);
  if(payout&&fault==='ack'){this.fault='';document.querySelector('#fault-status')!.textContent='Injected acknowledgement loss occurred';throw new Error('TEST: commit succeeded but acknowledgement was interrupted.');}
 }
 async takeOver(){await this.base.takeOver();}
 close(){this.base.close();}
}
const port=new FaultPort();const controller=new SessionController(port);
for(const [button,fault] of [['fail-payout','payout'],['lose-payout-ack','ack'],['fail-bot-save','bot']])document.getElementById(button)!.addEventListener('click',()=>{port.fault=fault;document.querySelector('#fault-status')!.textContent=`Armed: ${fault}`;});
controller.subscribe(()=>{const data=controller.data;if(!data)return;const a=data.active;void Promise.all([digest(a?.game??null),digest(a?.pending??null)]).then(([gameFingerprint,pendingFingerprint])=>{document.querySelector('#persistence-proof')!.textContent=JSON.stringify({databaseName,status:controller.status,wallet:data.wallet,revision:data.revision,ledgerEvents:data.ledger.length,uniqueLedgerEvents:new Set(data.ledger.map(e=>e.id)).size,walletReconciles:data.ledger.reduce((s,e)=>s+e.walletDelta,0)===data.wallet,settlementsMatchHistory:data.ledger.filter(e=>e.kind==='hand-net').length===data.hands.length,cashouts:data.ledger.filter(e=>e.kind==='cash-out').length,sessionCount:data.sessions.length,studyImports:data.importedHands.length,handId:a?.game.handId,gameRevision:a?.game.revision,street:a?.game.street,heroStack:a?.game.seats.find(s=>s.id===0)?.stack,handCount:data.hands.length,pokerNet:data.hands.reduce((n,h)=>n+h.net,0),settlements:data.ledger.filter(e=>e.kind==='hand-net').length,pendingDecisionId:a?.pending?.decisionId,gameFingerprint,pendingFingerprint});});});
mountApp(document.querySelector('#app')!,controller);
