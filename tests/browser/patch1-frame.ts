import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {applyCommand,legalActions,projectView,assertAccounting} from '../../src/core/engine';
import {appendMoney,GENESIS,seal,canonical,validateData} from '../../src/storage/integrity';
import {makeCashHandProvenance} from '../../src/session/hand-provenance';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
class MemoryPort implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_expected:number|null,d:AppData){this.data=structuredClone(d);}close(){}}
const query=new URLSearchParams(location.search),count=Number(query.get('seats')),phase=query.get('phase'),sequence=Number(query.get('sequence'));
const pause=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const rect=(el:Element)=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
const overlap=(a:ReturnType<typeof rect>,b:ReturnType<typeof rect>)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
async function execute(){
 assert(Number.isInteger(count)&&count>=2&&count<=10,'Invalid fixture seat count');assert(['preflop','river','complete'].includes(phase??''),'Invalid fixture phase');
 const port=new MemoryPort(),seed=new SessionController(port);await seed.init();await seed.startSession({...DEFAULT_SETTINGS,seats:count,buyIn:20000});assert(seed.data?.active,'Fixture failed to start');const data=structuredClone(seed.data);seed.close();const active=data.active!;
 for(let i=0;i<200&&active.game.street!=='complete';i++){
  if(phase==='preflop'&&active.game.street==='preflop'&&active.game.actor===0)break;
  if(phase==='river'&&active.game.street==='river'&&active.game.actor===0)break;
  const game=active.game;active.game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`patch1:${game.handId}:${game.revision}`,action:legalActions(game).check?{type:'check'}:{type:'call'}});active.frames.push(projectView(active.game,0));
 }
 assert(active.game.street===phase,'Fixture did not reach requested street');assertAccounting(active.game);
 if(active.game.street==='complete'){
  const view=projectView(active.game,0),hero=view.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
  const record=await seal<StoredHand>({id:active.game.handId,sessionId:active.sessionId,epoch:0,number:1,startedAt:active.startedAt,endedAt:new Date().toISOString(),view,frames:active.frames,net,provenance:makeCashHandProvenance(view.profile),...(active.configuration?{configuration:structuredClone(active.configuration)}:{}),privateProfiles:active.profiles,previousHash:GENESIS,hash:''});data.hands.push(record);data.sessions[0].handIds.push(record.id);await appendMoney(data,{id:`settle:${record.id}`,kind:'hand-net',at:record.endedAt,epoch:0,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:active.sessionId,handId:record.id,note:'Synthetic legal-hand patch layout fixture'});
 }
 await validateData(data); // Reject malformed fixture records before waiting on the UI.
 port.data=data;const controller=new SessionController(port);mountApp(document.querySelector<HTMLElement>('#app')!,controller);
 const start=performance.now();while(controller.status!=='ready'||!document.querySelector('.table-scene .seat')){assert(controller.status!=='error'&&!controller.error,controller.error);assert(performance.now()-start<15000,'Render timeout');await pause();}await pause();
 const failures:string[]=[],check=(ok:unknown,message:string)=>{if(!ok)failures.push(message);};
 const scene=document.querySelector('.table-scene')!,board=document.querySelector('.board-area')!,seats=[...document.querySelectorAll('.table-scene .seat')],bounds=rect(scene),boardBox=rect(board),boxes=seats.map(rect);
 check(seats.length===count,'Seat count incorrect');check(document.documentElement.scrollWidth<=innerWidth,'Horizontal page overflow');
 for(let i=0;i<seats.length;i++){
  const box=boxes[i],seat=seats[i];check(box.x>=bounds.x-.5&&box.right<=bounds.right+.5&&box.y>=bounds.y-.5&&box.bottom<=bounds.bottom+.5,`Seat ${i} outside table`);check(!overlap(box,boardBox),`Seat ${i} overlaps board`);
  for(let j=i+1;j<seats.length;j++)check(!overlap(box,boxes[j]),`Seats ${i}/${j} overlap`);
  check(!overlap(rect(seat.querySelector('.seat-cards')!),rect(seat.querySelector('.seat-label')!)),`Seat ${i} cards overlap label`);
  for(const el of seat.querySelectorAll<HTMLElement>('.seat-label strong,.seat-label b,.seat-status,.seat-bet'))if(el.offsetWidth&&el.offsetHeight)check(el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1,`Seat ${i} text overflows ${el.className||el.tagName}`);
 }
 check(boxes[0].bottom>=Math.max(...boxes.map(b=>b.bottom))-.5,'Hero not at bottom');
 check(Number(seats.find(s=>s.querySelector('.dealer-button'))?.getAttribute('data-seat'))===active.game.button,'Dealer marker incorrect');
 for(const [seatId,name]of[[active.game.smallBlindSeat,'Small blind'],[active.game.bigBlindSeat,'Big blind']] as const)check(!!document.querySelector(`[data-seat="${seatId}"] [aria-label="${name}"]`),`${name} marker incorrect`);
 if(phase!=='complete')check(!document.querySelector('.seat:not(.hero-seat) .playing-card:not(.card-back)'),'Hidden opponent cards exposed');
 const panel=document.querySelector<HTMLElement>('.action-panel')!,primary=[...panel.querySelectorAll<HTMLButtonElement>('#fold,#call,#raise,#next-hand')];check(primary.length=== (phase==='complete'?1:3),'Primary action controls missing');
 const initialActions=primary.map(el=>({id:el.id,disabled:el.disabled,box:rect(el)}));
 if(innerWidth<=700)for(const {id,box}of initialActions)check(box.height>=44&&box.x>=0&&box.right<=innerWidth&&box.y>=0&&box.bottom<=innerHeight,`${id} inaccessible in phone viewport`);
 for(let i=0;i<initialActions.length;i++)for(let j=i+1;j<initialActions.length;j++)check(!overlap(initialActions[i].box,initialActions[j].box),'Primary action controls overlap');
 const initialPanel=rect(panel),tableVisibleAboveBar=innerWidth>700||bounds.y>=0&&bounds.bottom<=initialPanel.y;
 if(phase==='complete'){
  if(innerWidth<=700&&innerHeight>=630)check(tableVisibleAboveBar,'Showdown summary covers table on supported-height phone');
  const shown=document.querySelector<HTMLElement>('.showdown-hands');
  check(!!shown&&shown.tabIndex===0&&!!shown.getAttribute('aria-label'),'Shown hands scroll region is not keyboard accessible');
  if(shown){shown.focus({preventScroll:true});check(document.activeElement===shown,'Cannot focus shown hands');shown.scrollTop=shown.scrollHeight;check(shown.scrollTop+shown.clientHeight>=shown.scrollHeight-1,'Final shown hand cannot be reached');}
 }
 let sizing:Record<string,unknown>|null=null;
 if(phase!=='complete'){
  const before=canonical(controller.data!.active!.game),input=document.querySelector<HTMLInputElement>('#raise-to')!,more=document.querySelector<HTMLDetailsElement>('#sizing-more')!,initial=Number(input.value),legal=legalActions(active.game),minimum=(legal.shortAllInTo??legal.minRaiseTo??0)/100,maximum=(legal.maxRaiseTo??legal.shortAllInTo??0)/100;
  check(Number(input.min)===minimum&&Number(input.max)===maximum,'Sizing input legal bounds mismatch');
  const increase=document.querySelector<HTMLButtonElement>('[data-step="1"]')!,decrease=document.querySelector<HTMLButtonElement>('[data-step="-1"]')!;
  check(!!increase.getAttribute('aria-label')&&!!decrease.getAttribute('aria-label'),'Stepper accessible name missing');
  if(!increase.disabled){increase.click();const increased=Number(input.value);check(increased===Math.min(maximum,initial+active.game.profile.bigBlind/100),'Increase step differs from one BB capped by engine');decrease.click();check(Number(input.value)===Math.max(minimum,increased-active.game.profile.bigBlind/100),'Decrease step differs from one BB bounded by engine');}
  const collapsedOnPhone=innerWidth<=700?!more.open:null;check(innerWidth>700||collapsedOnPhone,'Phone sizing disclosure initially open');
  more.open=true;await pause();
  // A session-clock render can replace nodes during the two awaited frames.
  // Resolve every target from the live DOM after the wait, without weakening
  // the requirement that the current enabled control actually receives focus.
  const currentMore=document.querySelector<HTMLDetailsElement>('#sizing-more')!,slider=document.querySelector<HTMLInputElement>('#pot-slider')!;
  check(currentMore.open,'Sizing disclosure closed during render');check(rect(slider).width>0&&rect(slider).height>0,'Open sizing disclosure hides slider');
  const focusTargets:string[]=[];
  for(const selector of ['#raise-to','#sizing-more>summary','#pot-slider','#fold','#call','#raise','[data-step="1"]','[data-step="-1"]']){
   const target=document.querySelector<HTMLElement>(selector);check(!!target,`Focus target missing ${selector}`);if(!target)continue;
   if((target instanceof HTMLButtonElement||target instanceof HTMLInputElement)&&target.disabled)continue;
   focusTargets.push(selector);target.focus({preventScroll:true});check(target.isConnected&&document.activeElement===target,`Cannot focus ${selector}`);
  } // Programmatic focus check only; real Tab/VoiceOver remain external.
  document.querySelector<HTMLDetailsElement>('#sizing-more')!.open=false;await pause();check(canonical(controller.data!.active!.game)===before,'Sizing proposals changed authoritative game');
  sizing={minimum,maximum,initial,collapsedOnPhone,focusTargets,gameUnchanged:canonical(controller.data!.active!.game)===before};
 }
 const result={status:failures.length?'FAIL':'PASS',failures,case:{width:innerWidth,height:innerHeight,seats:count,phase},table:bounds,board:boardBox,seats:seats.map((seat,i)=>({id:seat.getAttribute('data-seat'),box:boxes[i]})),initialActions,tableVisibleAboveBar,sizing,disclosure:'Synthetic legal-state fixture, real application DOM. Focus() is not a trusted keyboard or screen-reader test. Short-height full-table fit is reported separately from scrollable usability.'};
 controller.close();return result;
}
void execute().then(result=>parent.postMessage({kind:'patch1-layout-result',sequence,result},location.origin)).catch(error=>parent.postMessage({kind:'patch1-layout-result',sequence,result:{status:'FAIL',case:{width:innerWidth,height:innerHeight,seats:count,phase},error:String(error)}},location.origin));
