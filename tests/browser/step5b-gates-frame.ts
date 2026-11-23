import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {assertAccounting,legalActions,projectView} from '../../src/core/engine';
import {buildGateFixture,type GateFixtureSpec} from './step5b-gates-fixtures';

const spec=JSON.parse(new URLSearchParams(location.search).get('spec')??'{}') as GateFixtureSpec&{width:number;height:number};
const details:Record<string,unknown>={case:spec,storage:'isolated memory only'};
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw Error(message);}
async function waitFor(test:()=>boolean,message:string,attempts=250){for(let i=0;i<attempts;i++){if(test())return;await delay(20);}throw Error(message);}
function report(status:string,error?:string){parent.postMessage({kind:'step5b-gate-result',result:{...details,status,...(error?{error}:{})}},location.origin);}
function get<T extends HTMLElement=HTMLElement>(selector:string):T {const el=document.querySelector<T>(selector);assert(el,`Missing UI element ${selector}`);return el;}
function button(selector:string){const el=get<HTMLButtonElement>(selector);assert(!el.disabled,`Disabled button ${selector}`);return el;}
function click(selector:string){button(selector).click();}
function input(selector:string,value:string){const el=get<HTMLInputElement>(selector);assert(!el.disabled,`Disabled input ${selector}`);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
const amount=(text:string|null)=>Math.round(Number((text??'').replace(/[^0-9.-]/g,''))*100);
const rect=(el:Element)=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
const overlap=(a:ReturnType<typeof rect>,b:ReturnType<typeof rect>)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;

try{
 const fixture=await buildGateFixture(spec),controller=new SessionController(fixture.port);mountApp(get('#app'),controller);
 await waitFor(()=>controller.status==='ready'&&!controller.busy&&!!document.querySelector('#raise-to'),'Fixture did not mount');assert(!controller.error,controller.error);
 const game=controller.data!.active!.game,legal=legalActions(game),hero=game.seats.find(seat=>seat.id===0)!;
 const revision=game.revision,original=JSON.stringify(game);details.publicPrefix=fixture.prefix;details.pot=game.pot;details.heroStack=hero.stack;details.legal=legal;
 // Independent clockwise expectation from occupied physical seats, not engine output.
 if(spec.kind==='layout-preflop'||spec.kind==='layout-flop'){
  const all=Array.from({length:spec.seats},(_,i)=>i);
  const expectedPre=spec.seats===2?[0,1]:[...all.slice(3),0,1,2];
  const expectedPost=spec.seats===2?[1,0]:[...all.slice(1),0];
  const pre=fixture.prefix.filter(row=>row.street==='preflop').map(row=>row.seatId),post=fixture.prefix.filter(row=>row.street==='flop').map(row=>row.seatId);
  assert(fixture.starting.actor===expectedPre[0],'Initial action order differs from independent clockwise order');
  assert(JSON.stringify(pre)===JSON.stringify(spec.kind==='layout-flop'?expectedPre:expectedPre.slice(0,expectedPre.indexOf(0))),'Preflop action prefix differs from independent clockwise order');
  if(spec.kind==='layout-flop')assert(JSON.stringify(post)===JSON.stringify(expectedPost.slice(0,expectedPost.indexOf(0))),'Postflop action order is incorrect');
  details.actionOrder={pre,post,expectedPre,expectedPost};
 }
 const seats=[...document.querySelectorAll<HTMLElement>('.table-scene [data-seat]')],scene=rect(get('.table-scene')),board=rect(get('.board-area'));
 assert(seats.length===spec.seats,'Wrong number of visible occupied seats');
 const boxes=seats.map(rect);
 seats.forEach((seat,index)=>{
  const box=boxes[index],id=Number(seat.dataset.seat);
  assert(box.x>=scene.x-.5&&box.right<=scene.right+.5&&box.y>=scene.y-.5&&box.bottom<=scene.bottom+.5,`Seat ${id} escapes playing-table bounds`);
  assert(!overlap(box,board),`Seat ${id} overlaps central community board`);
  for(let next=index+1;next<seats.length;next++)assert(!overlap(box,boxes[next]),`Seats ${id}/${seats[next].dataset.seat} overlap`);
  assert(!overlap(rect(seat.querySelector('.seat-cards')!),rect(seat.querySelector('.seat-label')!)),`Seat ${id} cards overlap information`);
  assert(!!seat.querySelector('.dealer-button')===(game.button===id),`Dealer marker not associated with seat ${id}`);
  const blind=seat.querySelector('.blind-tag')?.textContent??'';assert(blind===(game.smallBlindSeat===id?'SB':game.bigBlindSeat===id?'BB':''),`Blind marker is wrong for seat ${id}`);
  assert(seat.classList.contains('acting')===(game.actor===id),`Acting marker is wrong for seat ${id}`);
  const actual=game.seats.find(s=>s.id===id)!;assert(amount(seat.querySelector('.seat-label strong')!.textContent)===actual.stack,`Seat ${id} stack display differs from integer cents`);
  for(const el of seat.querySelectorAll<HTMLElement>('.seat-label strong,.seat-label b,.seat-status,.seat-bet'))assert(el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1,`Seat ${id} text clips: ${el.className}`);
 });
 assert(boxes[0].bottom>=Math.max(...boxes.map(box=>box.bottom))-.5,'Hero is not at the bottom');
 assert(document.documentElement.scrollWidth<=innerWidth,'Unexpected horizontal page scroll');
 assert(amount(get('[data-testid=pot]').textContent)===game.pot,'Pot display does not match authoritative integer cents');
 const displayed=projectView(game,0),tiers=[...document.querySelectorAll('[data-testid=pot-tier]')];
 assert(tiers.length===displayed.pots.length,'Pot-tier count mismatch');
 tiers.forEach((tier,index)=>{assert(amount(tier.querySelector('b')!.textContent)===displayed.pots[index].amount,'Pot-tier amount mismatch');const box=rect(tier);assert(box.x>=0&&box.right<=innerWidth,'Pot tier clipped horizontally');});
 if(spec.kind==='side-pot')assert(tiers.length>=2&&get('[data-testid=pot-breakdown]').textContent!.includes('Side pot'),'Side-pot fixture failed to display side pots');
 details.tableGeometry={scene,board,seats:boxes,sidePots:Math.max(0,tiers.length-1),horizontalOverflow:false};

 // Automation covers native semantics, focusability and valid ARIA references.
 // It does not claim output from an actual screen reader or trusted keyboard.
 // Open the native disclosure before checking the controls it contains.
 const sizingDisclosure=document.querySelector<HTMLDetailsElement>('#sizing-more');
 if(sizingDisclosure&&!sizingDisclosure.open){sizingDisclosure.querySelector<HTMLElement>('summary')!.click();await delay(30);}
 const aria:string[]=[];
 for(const selector of ['#fold','#call','#raise','#raise-to','#pot-slider']){
  const el=get<HTMLInputElement|HTMLButtonElement>(selector);if(el.disabled)continue;
  el.focus({preventScroll:true});assert(document.activeElement===el,`${selector} is not keyboard-focusable`);
  const name=el.getAttribute('aria-label')??document.querySelector(`label[for="${el.id}"]`)?.textContent??el.textContent;
  assert(!!name?.trim(),`${selector} lacks an accessible label`);
  for(const id of (el.getAttribute('aria-describedby')??'').split(' ').filter(Boolean))assert(!!document.getElementById(id),`${selector} points to missing ARIA description ${id}`);
  aria.push(selector);
 }
 assert(get('#sizing-validation').getAttribute('role')==='status'&&get('#sizing-validation').getAttribute('aria-live')==='polite','Sizing validity has no live-status semantics');
 assert(get('[data-seat="0"]').getAttribute('aria-label')?.includes('current player'),'Current actor has no non-animation accessible state');
 details.accessibility={focusableNamedControls:aria,descriptionsExist:true,sizingStatus:'polite',screenReader:'NOT_EXECUTED',trustedKeyboard:'NOT_EXECUTED'};

 if(spec.kind==='stake'){
  const sb=spec.smallBlind!,bb=spec.bigBlind!,buyIn=spec.buyIn!,preflop=game.street==='preflop';
  const commits=fixture.starting.profile.smallBlind+fixture.starting.profile.bigBlind+fixture.prefix.reduce((sum,row)=>{const event=game.events.find(e=>e.type==='action'&&e.seatId===row.seatId&&e.street===row.street);return sum+(event?.amount??0);},0);
  assert(game.pot===commits,'Independent sum of blind/action money differs from pot');
  assert(game.profile.smallBlind===sb&&game.profile.bigBlind===bb&&hero.startingStack===buyIn,'Custom stake/stack was not preserved');
  assert(amount(get('.hero-stack-label b').textContent)===hero.stack,'Action panel stack differs from actual cents');
  assert(legal.minRaiseTo===(preflop?2*bb:bb),'Incorrect minimum raise / unopened postflop bet');
  assert(get('.room-details').textContent!.replace(/\s+/g,'').includes(`$${sb/100}/$${bb/100}`),'Header stake display mismatch');
  get<HTMLElement>('.sizing-shortcuts summary').click();input('#shortcut-bb','2');click('#shortcut-bb-apply');
  assert(Math.round(Number(get<HTMLInputElement>('#raise-to').value)*100)===bb*2,'BB total conversion is not exact');
  input('#shortcut-bb',String(buyIn/bb));click('#shortcut-bb-apply');assert(Math.round(Number(get<HTMLInputElement>('#raise-to').value)*100)===buyIn,'Starting stack / BB conversion is not exact');
  click('[data-size="min"]');get<HTMLElement>('.sizing-shortcuts summary').click();
  details.stakes={smallBlind:sb,bigBlind:bb,startingStack:buyIn,startingBB:buyIn/bb,minimum:legal.minRaiseTo,independentlySummedPot:commits,street:game.street};
 }

 if(spec.kind==='mixed-granularity'){
  assert(game.pot===6300&&legal.callAmount===1800&&legal.minRaiseTo===4500,'Unexpected mixed $1/$3 fixture');
  const invalid=[];for(const value of ['44','45.01','300.01','']){input('#raise-to',value);assert(get<HTMLButtonElement>('#raise').disabled,`Invalid amount ${value} can commit`);assert(get<HTMLInputElement>('#raise-to').getAttribute('aria-invalid')==='true','Invalid input has no ARIA indication');get<HTMLButtonElement>('#raise').click();invalid.push(value);}
  assert(JSON.stringify(controller.data!.active!.game)===original,'Invalid entries changed game state');
  click('[data-size="33"]');assert(get<HTMLInputElement>('#raise-to').value==='54','33% pot did not round to the explicitly configured $1 unit');
  input('#pot-slider','100');const sliderTotal=get<HTMLInputElement>('#raise-to').value;assert(sliderTotal==='108','Pot-after-call 100% is not $108');
  input('#raise-to','108');assert(!get<HTMLButtonElement>('#raise').disabled&&amount(get('#raise-button-value').textContent)===10800,'Numeric/slider proposals disagree');
  assert(amount(get('#raise-additional').textContent)===9900,'Existing $9 commitment was not excluded from additional chips');
  details.invalidAndMixed={invalidRejected:invalid,chipUnit:100,rounded33Percent:5400,potAfterCall:8100,total100Percent:10800,additional:9900,authoritativeRevisionUnchanged:true};
 }
 if(spec.kind==='raise-closed'){
  assert(!legal.reopened&&!legal.canRaise&&legal.shortAllInTo===null&&legal.callAmount===100,'Raise-closed fixture is incorrect');
  for(const selector of ['#raise','#raise-to','#pot-slider','[data-size="all"]','[data-size="min"]','[data-size="pot"]'])assert(get<HTMLInputElement|HTMLButtonElement>(selector).disabled,`Closed betting still enables ${selector}`);
  assert(!button('#call').disabled&&!button('#fold').disabled,'Legal closed-action call/fold unavailable');
  details.raiseClosed={call:100,allRaiseControlsDisabled:true,foldAndCallAvailable:true};
 }

 document.querySelector<HTMLElement>('#jump-action')?.click();const more=document.querySelector<HTMLDetailsElement>('#sizing-more');if(more)more.open=true;await delay(30);
 const controls=['#fold','#call','#raise','#raise-to','#raise-additional','#raise-limits','.hero-stack-label','#pot-slider'];
 const controlBoxes=controls.map(selector=>{const el=get(selector),box=rect(el);assert(box.width>0&&box.height>0&&box.x>=-1&&box.right<=innerWidth+1,`Control ${selector} is hidden or outside viewport`);const font=getComputedStyle(el).fontSize;if(selector!=='.hero-stack-label'&&selector!=='#pot-slider')assert(Number.parseFloat(font)>=(selector==='#raise-to'?16:12),`Critical control ${selector} font too small: ${font}`);return{selector,...box,font};});
 for(let i=0;i<controlBoxes.length;i++)for(let j=i+1;j<controlBoxes.length;j++)assert(!overlap(controlBoxes[i],controlBoxes[j]),`Controls ${controlBoxes[i].selector}/${controlBoxes[j].selector} overlap`);
 for(const box of controlBoxes.slice(0,3)){assert(box.height>=44,'Action touch target below 44 CSS pixels');if(innerWidth<=700)assert(box.y>=0&&box.bottom<=innerHeight-(document.querySelector('.mobile-table-nav')?55:0),'Action shortcut does not reach controls above mobile navigation');}
 assert(get('#raise-limits').textContent?.includes('Minimum')&&get('#raise-limits').textContent?.includes('Maximum'),'Missing min/max sizing labels');
 details.controls=controlBoxes;
 assert(controller.data!.active!.game.revision===revision,'Proposal/layout checks changed authoritative revision');

 if(spec.kind==='short-jam'){
  assert(legal.shortAllInTo===700&&legal.minRaiseTo===1000,'Fixture is not a genuine incomplete all-in');
  input('#raise-to','6.5');assert(get<HTMLButtonElement>('#raise').disabled,'Incomplete non-all-in raise accepted');
  click('[data-size="all"]');assert(get<HTMLInputElement>('#raise-to').value==='7'&&button('#raise').textContent?.includes('All-in'),'Short all-in not offered correctly');
  assert(controller.data!.active!.game.revision===revision,'All-in selection committed without confirmation');
  const pace=get<HTMLSelectElement>('#pace');pace.value='1800';pace.dispatchEvent(new Event('change',{bubbles:true}));
  const oldButton=button('#raise');oldButton.click();oldButton.click();
  await waitFor(()=>controller.data!.active!.game.revision===revision+1&&!controller.busy,'Short all-in did not save');
  await controller.setPaused(true);oldButton.click();await delay(30);
  const now=controller.data!.active!.game;assert(now.revision===revision+1,'Double or stale confirmation committed another action');
  assert(now.seats[0].stack===0&&now.seats[0].totalCommitted===700&&now.seats[0].allIn,'Short jam money is incorrect');assertAccounting(now);
  details.shortAllIn={selectedWithoutCommit:true,confirmationClicks:2,staleDetachedClick:1,actionsCommitted:1,heroStack:0,heroCommitted:700,pot:now.pot,engineAccounting:true};
 }
 if(spec.kind==='keyboard'){
  const pace=get<HTMLSelectElement>('#pace');pace.value='1800';pace.dispatchEvent(new Event('change',{bubbles:true}));
  const events:{type:string;key?:string;target:string;trusted:boolean;detail?:number}[]=[];
  document.addEventListener('keydown',event=>{events.push({type:'keydown',key:event.key,target:(event.target as HTMLElement).id,trusted:event.isTrusted});},true);
  document.addEventListener('focusin',event=>{events.push({type:'focusin',target:(event.target as HTMLElement).id,trusted:event.isTrusted});},true);
  document.addEventListener('click',event=>{if((event.target as HTMLElement).closest('#call'))events.push({type:'click',target:'call',trusted:event.isTrusted,detail:event.detail});},true);
  button('#fold').focus();details.keyboardInstructions='Focus starts on Fold. Send real browser Tab then Enter; expected one Call.';report('READY');
  void(async()=>{
   await waitFor(()=>controller.data!.active!.game.revision>revision,'No keyboard action received within 60 seconds',3000);
   await waitFor(()=>!controller.busy,'Keyboard action save did not finish');await controller.setPaused(true);
   const now=controller.data!.active!.game,heroActions=now.events.filter(event=>event.type==='action'&&event.seatId===0);
   assert(now.revision===revision+1&&heroActions.length===1&&heroActions[0].action?.type==='call','Keyboard committed the wrong action or more than one action');
   assert(events.some(event=>event.type==='keydown'&&event.key==='Tab'&&event.target==='fold'&&event.trusted),'No trusted Tab from Fold recorded');
   assert(events.some(event=>event.type==='keydown'&&event.key==='Enter'&&event.target==='call'&&event.trusted),'No trusted Enter on Call recorded');
   assert(events.some(event=>event.type==='click'&&event.target==='call'&&event.trusted&&event.detail===0),'No native keyboard activation of Call recorded');
   assertAccounting(now);details.keyboard={events,committedActions:1,action:'call',engineAccounting:true,screenReader:'NOT_EXECUTED'};report('PASS');
  })().catch(error=>{details.keyboardEvents=events;report('FAIL',(error as Error).message);});
 }else report('PASS');
}catch(error){report('FAIL',(error as Error).message);}
