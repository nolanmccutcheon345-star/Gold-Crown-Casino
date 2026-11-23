import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {assertAccounting} from '../../src/core/engine';
import {validateData} from '../../src/storage/integrity';
import {buildGateFixture} from './step5b-gates-fixtures';
import {cardName} from '../../src/ui/accessibility';
import {newHandId} from '../../src/identity';

const seats=Number(new URLSearchParams(location.search).get('seats')??'2');
const evidence:Record<string,unknown>={seats,width:innerWidth,storage:'isolated native IndexedDB',screenReader:'NOT_EXECUTED',trustedKeyboard:'NOT_EXECUTED'};
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
async function waitFor(test:()=>boolean,message:string,ms=60000){const end=performance.now()+ms;while(performance.now()<end){if(test())return;await delay(20);}throw Error(message);}
function get<T extends HTMLElement=HTMLElement>(selector:string):T{const el=document.querySelector<T>(selector);assert(el,`Missing ${selector}`);return el;}
function click(selector:string){const el=get<HTMLButtonElement>(selector);assert(!el.disabled,`Disabled ${selector}`);el.click();}
function input(selector:string,text:string){const el=get<HTMLInputElement|HTMLTextAreaElement>(selector);el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));}
let controller:SessionController|undefined;
function importDiagnostic(){return{
 status:controller?.status,busy:controller?.busy,error:controller?.error,revision:controller?.data?.revision,
 preview:document.querySelector('[data-testid=study-import-preview]')?.textContent?.trim().slice(0,12000)??null,
 selectedRows:[...document.querySelectorAll<HTMLInputElement>('[data-import-selection]')].map(input=>({row:input.dataset.importSelection,checked:input.checked,disabled:input.disabled})),
 buttons:['#study-import-select-all','#confirm-study-import','#import-pasted'].map(selector=>{const button=document.querySelector<HTMLButtonElement>(selector);return{selector,present:!!button,disabled:button?.disabled,label:button?.textContent};}),
 notice:document.querySelector('.error-banner')?.textContent??null,
};}
try{
 const database=`step5c-accessibility-${seats}-${newHandId()}`;evidence.database=database;
 const fixture=await buildGateFixture({kind:'layout-preflop',seats}),port=new BrowserPersistence(database);
 await port.load();await port.commit(null,fixture.data);controller=new SessionController(port);mountApp(get('#app'),controller);
 await waitFor(()=>controller!.status==='ready'&&!controller!.busy&&!!document.querySelector('#call'),'Application failed to recover isolated fixture');assert(!controller.error,controller.error);
 const status=get('#table-announcement'),firstText=status.textContent,initial=controller.data!.active!.game,initialRevision=initial.revision;
 assert(status.getAttribute('role')==='status'&&status.getAttribute('aria-live')==='polite'&&status.getAttribute('aria-atomic')==='true','Missing persistent announcement semantics');
 assert(firstText?.includes('Your turn'),'Initial Hero turn is not announced');
 const cardLabels=[...document.querySelectorAll('.playing-card')].map(el=>({role:el.getAttribute('role'),label:el.getAttribute('aria-label')}));
 assert(cardLabels.every(card=>card.role==='img'&&!!card.label),'Card lacks image semantics or readable label');
 const own=initial.seats.find(seat=>seat.id===0)!;for(const card of own.hole)assert(cardLabels.some(label=>label.label===cardName(card)),'Hero card lacks full rank/suit name');
 for(const other of initial.seats.filter(seat=>seat.id!==0))for(const card of other.hole)assert(!cardLabels.some(label=>label.label===cardName(card)),'Hidden opponent card leaked into accessible labels');
 // Deterministic reproduction of a UI render during a quiet clock write.
 // Hold the actual port boundary, never private controller internals or data.
 const originalCommit=port.commit.bind(port);let hold=true,entered=false;
 let releaseWrite!:()=>void;const writeGate=new Promise<void>(resolve=>{releaseWrite=resolve;});
 const beforeTick={wallet:controller.data!.wallet,game:JSON.stringify(controller.data!.active!.game),ledger:JSON.stringify(controller.data!.ledger),hands:JSON.stringify(controller.data!.hands)};
 port.commit=async(expected,data)=>{if(hold){hold=false;entered=true;await writeGate;}await originalCommit(expected,data);};
 try{
  const tick=controller.tick();await waitFor(()=>entered,'Quiet clock did not enter held persistence write',10000);
  get('[data-view="cashier"]').focus();click('[data-view="cashier"]');
  const during={busy:controller.busy,bankrollDisabled:get<HTMLButtonElement>('#save-bankroll').disabled,focus:document.activeElement?.getAttribute('data-view')};
  evidence.quietTick={during};assert(during.busy&&during.bankrollDisabled,'Held clock write did not safely disable financial controls');
  releaseWrite();await tick;
  const after={busy:controller.busy,bankrollDisabled:get<HTMLButtonElement>('#save-bankroll').disabled,focus:document.activeElement?.getAttribute('data-view')};
  evidence.quietTick={during,after,gameUnchanged:JSON.stringify(controller.data!.active!.game)===beforeTick.game,walletUnchanged:controller.data!.wallet===beforeTick.wallet,ledgerUnchanged:JSON.stringify(controller.data!.ledger)===beforeTick.ledger,handsUnchanged:JSON.stringify(controller.data!.hands)===beforeTick.hands};
  assert(!after.busy&&!after.bankrollDisabled,'Quiet clock completion left rendered financial controls disabled');
  assert(after.focus==='cashier','Quiet clock completion lost navigation focus');
  assert(JSON.stringify(controller.data!.active!.game)===beforeTick.game&&controller.data!.wallet===beforeTick.wallet&&JSON.stringify(controller.data!.ledger)===beforeTick.ledger&&JSON.stringify(controller.data!.hands)===beforeTick.hands,'Quiet clock altered poker or financial history');
 }finally{releaseWrite();port.commit=originalCommit;}
 const focusChecks=[];
 for(const destination of ['cashier','results','study','live']){
  const selector=`[data-view="${destination}"]`;get(selector).focus();click(selector);
  assert(document.activeElement===get(selector),`Navigation lost keyboard focus: ${destination}`);
  assert(get('#table-announcement')===status,'Live region was replaced during navigation');focusChecks.push(destination);
 }
 assert(get('[data-testid=practice-disclosure]').textContent?.includes('No real-money gambling or real-time assistance'),'Missing practice restriction disclosure');
 const pace=get<HTMLSelectElement>('#pace');pace.value='1800';pace.dispatchEvent(new Event('change',{bubbles:true}));
 get('#call').focus();click('#call');
 await waitFor(()=>controller!.data!.active!.game.revision>initialRevision&&!controller!.busy,'Hero action did not commit');
 assert(document.activeElement===get('#table-actions'),'Committed action reset focus instead of moving to action region');
 assert(get('#table-announcement')===status,'Live region replaced after action');assert(status.textContent!==firstText,'Committed action did not update live text');
 await controller.setPaused(true);await waitFor(()=>!controller!.busy,'Pause did not commit');
 evidence.focus={navigation:focusChecks,afterAction:'table-actions',persistentStatus:true,initial:firstText,afterActionText:status.textContent};
 const fast=get<HTMLSelectElement>('#pace');fast.value='250';fast.dispatchEvent(new Event('change',{bubbles:true}));click('#pause');
 const deadline=performance.now()+90000;let heroActions=1;
 while(controller.data!.active!.game.street!=='complete'&&performance.now()<deadline){
  if(controller.data!.active!.game.actor===0&&!controller.busy){const call=document.querySelector<HTMLButtonElement>('#call');if(call&&!call.disabled){call.click();heroActions++;}}
  await delay(25);
 }
 await waitFor(()=>controller!.data!.active!.game.street==='complete'&&!controller!.busy&&!!document.querySelector('#next-hand'),'Full hand failed to settle');
 const done=controller.data!.active!.game;assertAccounting(done);await validateData(controller.data!);
 assert(status.textContent?.includes('Hand settled')&&status.textContent.includes('awarded'),'Settlement and payout not announced');
 assert(get('#table-announcement')===status,'Settlement replaced live region');
 evidence.completedHand={id:done.handId,heroActions,events:done.events,board:done.board,payouts:done.payouts,rake:done.rake,endingStacks:done.seats.map(seat=>({id:seat.id,stack:seat.stack})),announcement:status.textContent};
 const wallet=controller.data!.wallet,canonical=JSON.stringify(controller.data!.hands),ledger=JSON.stringify(controller.data!.ledger);
 click('[data-view="study"]');click('#export-history');await waitFor(()=>!!document.querySelector('#download-history'),'Export did not prepare');click('#view-export');
 const text=get<HTMLTextAreaElement>('#export-json').value,parsed=JSON.parse(text);assert(!text.includes('privateProfiles')&&!text.includes('personalityId')&&!text.includes('deckCursor'),'Export exposes private metadata');
 // A persistent file-input node must allow same-file retries after rejection or cancellation.
 const importFile=new File([text],'same-history.json',{type:'application/json'});
 const selectFile=()=>{const picker=get<HTMLInputElement>('#import-history'),transfer=new DataTransfer();transfer.items.add(importFile);picker.files=transfer.files;picker.dispatchEvent(new Event('change',{bubbles:true}));assert(picker.value==='','File picker was not cleared for same-file retry');};
 selectFile();assert(!!document.querySelector('.error-banner')?.textContent?.includes('right to use'),'File rights check did not reject');
 const fileRights=get<HTMLInputElement>('#import-rights');fileRights.checked=true;fileRights.dispatchEvent(new Event('change',{bubbles:true}));
 for(let retry=0;retry<2;retry++){selectFile();await waitFor(()=>!!document.querySelector('[data-testid=study-import-preview]'),'Same file retry did not produce preview');click('#cancel-study-import');}
 const resetRights=get<HTMLInputElement>('#import-rights');resetRights.checked=false;resetRights.dispatchEvent(new Event('change',{bubbles:true}));
 evidence.fileRetry={rightsRejectionCleared:true,previewsAfterSameFileSelection:2,cancelledWithoutImport:true,method:'Native File/DataTransfer and change events; not a physical file-picker test'};
 click('#show-import-text');input('#import-json',text);evidence.phase='unconfirmed-rights-preview';
 await waitFor(()=>!controller!.busy&&!get<HTMLButtonElement>('#import-pasted').disabled,'Pasted import stayed unavailable before rights-denial check',10000);click('#import-pasted');
 assert(!!document.querySelector('.error-banner')?.textContent?.includes('right to use'),'Unconfirmed import did not fail closed');assert(!document.querySelector('[data-testid=study-import-preview]'),'Unconfirmed file was ingested');assert(get<HTMLTextAreaElement>('#import-json').value===text,'Rights denial discarded pasted JSON draft');
 const rights=get<HTMLInputElement>('#import-rights');rights.checked=true;rights.dispatchEvent(new Event('change',{bubbles:true}));input('#import-json',text);evidence.phase='confirmed-rights-preview';
 await waitFor(()=>!controller!.busy&&!get<HTMLButtonElement>('#import-pasted').disabled,'Pasted import stayed unavailable after rights confirmation',10000);click('#import-pasted');
 await waitFor(()=>!!document.querySelector('[data-testid=study-import-preview]'),'Confirmed rights did not allow preview');
 evidence.previewBeforeSelection=importDiagnostic();
 assert(document.querySelectorAll('.import-preview-row').length===1,'Export did not contain exactly one hand row');
 assert(document.querySelectorAll('.import-preview-row.invalid').length===0,'Exported canonical hand was rejected by public import validation');
 await waitFor(()=>!controller!.busy&&!get<HTMLButtonElement>('#study-import-select-all').disabled,'Select verified rows stayed unavailable after persistence completed',10000);
 evidence.phase='select-verified-import';click('#study-import-select-all');evidence.previewAfterSelection=importDiagnostic();
 assert(get<HTMLInputElement>('[data-import-selection]').checked,'Select all did not select the verified hand');
 await waitFor(()=>!controller!.busy&&!get<HTMLButtonElement>('#confirm-study-import').disabled,'Import confirmation stayed unavailable after selecting a valid hand',10000);
 evidence.phase='commit-study-import';click('#confirm-study-import');
 await waitFor(()=>controller!.data!.importedHands.length===1&&!controller!.busy,'Study import failed');
 assert(controller.data!.wallet===wallet&&JSON.stringify(controller.data!.hands)===canonical&&JSON.stringify(controller.data!.ledger)===ledger,'Study import changed money or canonical history');
 await validateData(controller.data!);evidence.import={exportSchema:parsed.version??parsed.schemaVersion,bytes:text.length,rightsDeniedBeforePreview:true,confirmedImport:1,walletUnchanged:true,canonicalUnchanged:true,ledgerUnchanged:true};
 assert(document.documentElement.scrollWidth<=innerWidth,'Horizontal overflow');
 evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.failureState=importDiagnostic();}finally{controller?.close();parent.postMessage({kind:'step5c-accessibility-result',result:evidence},location.origin);}
