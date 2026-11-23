import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {getPlayerNote} from '../../src/session/notes';
import {GateMemoryPort} from './step5b-gates-fixtures';
import type {AppData} from '../../src/session/types';
class FaultPort extends GateMemoryPort {failNext=false;async commit(expected:number|null,next:AppData){if(this.failNext){this.failNext=false;throw Error('Deliberate isolated notes write failure');}await super.commit(expected,next);}}
const count=Number(new URLSearchParams(location.search).get('seats')??3);if(![2,3,6,10].includes(count))throw Error('Unsupported note fixture count');
const port=new FaultPort();let controller=new SessionController(port);const checks:string[]=[];
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message);}
async function ready(test=()=>controller.status==='ready'){for(let i=0;i<500;i++){if(test()&&!controller.busy&&!document.querySelector('.save-status')?.textContent?.includes('Saving'))return;await delay(20);}throw Error('Notes UI readiness timeout');}
function get<T extends HTMLElement=HTMLElement>(selector:string):T{const el=document.querySelector<T>(selector);assert(el,`Missing ${selector}`);return el;}
function click(selector:string){const el=get<HTMLButtonElement>(selector);assert(!el.disabled,`Disabled ${selector}`);el.click();}
function type(text:string){const el=get<HTMLTextAreaElement>('#player-note-text');el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));return el;}
async function openNotes(){const details=get<HTMLDetailsElement>('#player-notes-details');if(!details.open)details.querySelector<HTMLElement>('summary')!.click();await ready(()=>!!document.querySelector('#player-note-text'));}
try{
 await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:count,opponents:Array.from({length:count-1},(_,index)=>({selection:index===0?'unknown':'random',personalitySeed:123451+index}))});
 mountApp(get('#app'),controller);await ready();const sessionId=controller.data!.active!.sessionId;
 let pace=get<HTMLSelectElement>('#pace');pace.value='250';pace.dispatchEvent(new Event('change',{bubbles:true}));await ready(()=>controller.data!.active!.game.actor===0);pace=get<HTMLSelectElement>('#pace');pace.value='1800';pace.dispatchEvent(new Event('change',{bubbles:true}));await openNotes();
 for(const selector of ['#save-player-note','#delete-player-note','#reload-player-note']){const control=get<HTMLButtonElement>(selector),box=control.getBoundingClientRect();assert(box.height>=44&&box.width>0&&box.left>=0&&box.right<=innerWidth,`Notes control ${selector} is not touch accessible`);if(!control.disabled){control.focus();assert(document.activeElement===control,`Notes control ${selector} is not keyboard focusable`);}assert(!!control.textContent?.trim(),'Unnamed notes control');}
 assert(get<HTMLTextAreaElement>('#player-note-text').labels?.length,'Notes editor is not labelled');checks.push('Manual-note controls named, keyboard-focusable and >=44px touch targets');
 assert(get<HTMLTextAreaElement>('#player-note-text').value==='','Notes were auto-prefilled from a private profile');
 const first='Called a small flop bet; manual public observation.';type(first);click('#save-player-note');await ready(()=>!!getPlayerNote(controller.data!,sessionId,1));
 assert(getPlayerNote(controller.data!,sessionId,1)?.text===first,'Manual note did not persist');checks.push('Create explicit manual note; no auto-prefill');
 click('#call');await ready(()=>!!controller.data!.active!.pending?.decision);const before=controller.data!.active!,pending=JSON.stringify(before.pending),game=JSON.stringify(before.game);
 type('Updated while an opponent decision was pending.');click('#save-player-note');await ready(()=>getPlayerNote(controller.data!,sessionId,1)?.text==='Updated while an opponent decision was pending.');
 assert(JSON.stringify(controller.data!.active!.pending)===pending&&JSON.stringify(controller.data!.active!.game)===game,'Note write changed pending decision or authoritative game');
 const draft='Unsaved draft survives the actual bot action.';const textarea=type(draft);textarea.focus();textarea.setSelectionRange(4,12);const revision=controller.data!.active!.game.revision;
 await ready(()=>controller.data!.active!.game.revision>revision);
 assert(get<HTMLTextAreaElement>('#player-note-text').value===draft&&document.activeElement===get('#player-note-text'),'Bot commit lost note text or focus');
 assert(get<HTMLTextAreaElement>('#player-note-text').selectionStart===4&&get<HTMLTextAreaElement>('#player-note-text').selectionEnd===12,'Bot commit lost note caret selection');
 checks.push('Save during pending bot preserves its exact decision/game; actual bot action preserves draft, focus and caret');
 click('#pause');await ready(()=>!!controller.data!.active!.paused);
 // Fail one real UI save at the persistence boundary; retain the user's draft.
 port.failNext=true;click('#save-player-note');await ready(()=>controller.status==='error');
 assert(get<HTMLTextAreaElement>('#player-note-text').value===draft,'Failed write discarded note draft');assert(get('#player-note-notice').textContent!.length>0,'Failed note save has no notice');
 click('#retry-save');await ready();click('#reload-player-note');
 assert(getPlayerNote(controller.data!,sessionId,1)?.text===draft&&controller.data!.userNotes!.entries.length===1,'Recovered note duplicated or lost');checks.push('Interrupted write keeps draft; explicit storage retry persists one note');
 const hostile='</textarea><script>window.noteLeak=1</script>';type(hostile);click('#save-player-note');await ready(()=>getPlayerNote(controller.data!,sessionId,1)?.text===hostile);
 assert(!document.querySelector('#app script'),'Manual note executed as HTML');
 controller.close();controller=new SessionController(port);mountApp(get('#app'),controller);await ready();await openNotes();assert(get<HTMLTextAreaElement>('#player-note-text').value===hostile,'Reload did not restore exact plain note');
 const exported=JSON.stringify(await controller.exportHistory());assert(!exported.includes('noteLeak')&&!exported.includes('userNotes'),'Manual note entered public history export');
 click('#delete-player-note');await ready(()=>!getPlayerNote(controller.data!,sessionId,1));assert(get<HTMLTextAreaElement>('#player-note-text').value==='','Deleted note remains in editor');assert(Number(controller.data!.userNotes!.entries.length)===0,'Delete did not remove the saved note');
 checks.push('Plain-text XSS protection, committed reload, public-export exclusion, exact deletion');
 click('#pause');await ready(()=>!controller.data!.active!.paused);pace=get<HTMLSelectElement>('#pace');pace.value='250';pace.dispatchEvent(new Event('change',{bubbles:true}));
 for(let i=0;i<2500&&controller.data!.active!.game.street!=='complete';i++){if(controller.data!.active!.game.actor===0&&!controller.busy&&!get<HTMLButtonElement>('#fold').disabled)click('#fold');await delay(25);}
 await ready(()=>controller.data!.active!.game.street==='complete');
 click('[data-view="study"]');click('[data-replay]');if(!get<HTMLButtonElement>('#replay-first').disabled)click('#replay-first');
 const firstFrame=controller.data!.hands[0].frames[0];assert(document.querySelectorAll('.replay-seats .card-back').length===firstFrame.seats.filter(seat=>seat.id!==0).length*2,'First-frame replay exposed hidden opponent cards');
 assert(get('[data-testid="replay-step"]').textContent!.includes('Step 1'),'Replay did not start at initial frame');
 click('#replay-last');assert(!!document.querySelector('[data-testid="hand-replay"]'),'Settlement replay is unavailable');
 const publicHistory=JSON.stringify(await controller.exportHistory());assert(!publicHistory.includes('noteLeak')&&!publicHistory.includes('userNotes'),'Completed-hand export contains private notes');
 click('#new-session');click('#end-complete');await ready(()=>!controller.data!.active);
 checks.push('Full actual cash hand, first-frame replay privacy, settlement replay, redacted export and cashout');
 parent.postMessage({kind:'step5b-notes-result',result:{status:'PASS',seats:count,width:innerWidth,checks,storage:'isolated memory with deliberate write fault',userAgent:navigator.userAgent,productionDataTouched:false}},location.origin);
}catch(error){parent.postMessage({kind:'step5b-notes-result',result:{status:'FAIL',seats:count,width:innerWidth,checks,error:(error as Error).message}},location.origin);}
