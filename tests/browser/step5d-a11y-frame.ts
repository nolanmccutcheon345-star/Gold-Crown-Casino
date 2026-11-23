import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {buildGateFixture} from './step5b-gates-fixtures';
import {referenceProblems,contrastRatio,contrastThreshold,type RGB} from '../step5d-accessibility/audit-rules';

const root=document.querySelector<HTMLElement>('#app')!,seats=Number(new URLSearchParams(location.search).get('seats')??2);
const checks:{name:string;status:'PASS'|'FAIL';detail:unknown}[]=[];
const check=(name:string,pass:boolean,detail:unknown)=>checks.push({name,status:pass?'PASS':'FAIL',detail});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(test:()=>boolean){const deadline=performance.now()+15000;while(!test()){if(performance.now()>deadline)throw Error('QA waiting for verified ready state timed out');await delay(10);}}
function el<T extends HTMLElement=HTMLElement>(selector:string):T {const element=root.querySelector<T>(selector);if(!element)throw Error('Missing '+selector);return element;}
function visible(element:HTMLElement):boolean {if(!element.getClientRects().length)return false;const style=getComputedStyle(element);return style.visibility!=='hidden'&&style.display!=='none'&&style.clip==='auto'&&Number(style.opacity)>0;}
function name(element:HTMLElement):string {
 const labelledBy=element.getAttribute('aria-labelledby');if(labelledBy)return labelledBy.split(/\s+/).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim();
 const explicit=element.getAttribute('aria-label');if(explicit)return explicit.trim();
 if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement)return [...element.labels??[]].map(label=>label.textContent).join(' ').trim();
 return (element.textContent??'').trim();
}
function inspect(view:string):void {
 const nodes=[root,...root.querySelectorAll<HTMLElement>('*')];
 const references=referenceProblems(nodes.map(element=>({element:element.id||element.tagName,ids:element.id?[element.id]:[],labelledBy:(element.getAttribute('aria-labelledby')??'').split(/\s+/).filter(Boolean),describedBy:(element.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean)})));
 check(`${view}: unique IDs and complete ARIA references`,!references.length,references);
 const controls=[...root.querySelectorAll<HTMLElement>('button,a[href],input:not([type=hidden]),select,textarea,summary')].filter(visible);
 const unnamed=controls.filter(element=>!name(element)).map(element=>element.outerHTML.slice(0,300));
 check(`${view}: visible controls have explicit or native labels`,!unnamed.length,{controls:controls.length,unnamed});
 const positive=controls.filter(element=>element.tabIndex>0).map(element=>element.id||element.tagName);
 check(`${view}: native keyboard order without positive tabindex`,!positive.length,positive);
 const main=el('#main-content');check(`${view}: named landmarks and focusable skip destination`,root.querySelectorAll('main').length===1&&!!root.querySelector('nav[aria-label="Main navigation"]')&&main.tabIndex===-1,{mainCount:root.querySelectorAll('main').length,skipHref:root.querySelector('.skip-link')?.getAttribute('href')});
}
function rgb(color:string):[number,number,number,number]|null {const match=/^rgba?\(([^)]+)\)$/.exec(color);if(!match)return null;const parts=match[1].split(/[,\s/]+/).map(Number);return [parts[0],parts[1],parts[2],parts[3]??1];}
function controlContrast():unknown[] {
 return ['#fold','#call','#raise','#raise-to'].map(selector=>{
  const element=el(selector),style=getComputedStyle(element),foreground=rgb(style.color);let current:HTMLElement|null=element,background:RGB|null=null,reason='';
  while(current){const s=getComputedStyle(current);if(s.backgroundImage!=='none'){reason='Gradient/image requires rendered pixel verification';break;}const color=rgb(s.backgroundColor);if(color&&color[3]===1){background=[color[0],color[1],color[2]];break;}if(color&&color[3]>0){reason='Translucent layer requires compositing measurement';break;}current=current.parentElement;}
  if(!foreground||foreground[3]!==1||!background)return{selector,status:'NOT_MEASURED',reason:reason||'Non-opaque colors'};
  const ratio=contrastRatio([foreground[0],foreground[1],foreground[2]],background),required=contrastThreshold(Number.parseFloat(style.fontSize),Number.parseInt(style.fontWeight));
  check(`Core control contrast: ${selector}`,ratio>=required,{foreground,background,ratio,required});return{selector,ratio,required};
 });
}
let controller:SessionController|undefined;
try{
 const fixture=await buildGateFixture({kind:'layout-preflop',seats}),port=fixture.port,originalLoad=port.load.bind(port);let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});port.load=async()=>{await held;return originalLoad();};
 controller=new SessionController(port);mountApp(root,controller);
 check('Loading state does not expose unverified wallet or actionable poker',!controller.data&&!root.querySelector('#fold,#call,#raise,#save-bankroll,#cashout')&&el('#table-announcement').textContent?.includes('unavailable')===true,{announcement:el('#table-announcement').textContent,placeholder:root.querySelector('.restore-placeholder')?.textContent});
 release();await waitFor(()=>controller!.status==='ready'&&!controller!.busy&&!!root.querySelector('#raise'));
 const announcement=el('#table-announcement');inspect('live');const contrast=controlContrast();
 const targets=['#fold','#call','#raise'].map(selector=>{const r=el(selector).getBoundingClientRect();return{selector,width:r.width,height:r.height};});
 check('Core betting controls meet44CSSpx engineering touch target',targets.every(t=>t.width>=44&&t.height>=44),targets);
 const before={game:JSON.stringify(controller.data!.active!.game),wallet:controller.data!.wallet,ledger:JSON.stringify(controller.data!.ledger),hands:JSON.stringify(controller.data!.hands)};
 for(const selector of ['.sizing-more','.sizing-shortcuts','.sizing-basis']){
  const details=el<HTMLDetailsElement>(selector);details.open=true;el(`${selector}>summary`).focus();await controller.tick();
  check(`${selector}: open state survives ordinary clock save`,el<HTMLDetailsElement>(selector).open,{open:el<HTMLDetailsElement>(selector).open});
  check(`${selector}: focused summary survives ordinary clock save`,document.activeElement===el(`${selector}>summary`),{focused:document.activeElement?.outerHTML.slice(0,350)});
 }
 for(const [selector,value] of [['#custom-pot-percent','17.25'],['#shortcut-bb','7.5'],['#increment-bb','2.5']]){
  el<HTMLDetailsElement>('.sizing-shortcuts').open=true;const input=el<HTMLInputElement>(selector);input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await controller.tick();
  const updated=el<HTMLInputElement>(selector);check(`${selector}: unsubmitted draft/focus remains usable through clock save`,updated.value===value&&document.activeElement===updated&&el<HTMLDetailsElement>('.sizing-shortcuts').open,{expected:value,value:updated.value,focused:document.activeElement===updated,editorOpen:el<HTMLDetailsElement>('.sizing-shortcuts').open});
 }
 check('Inspection and clock saves do not change committed poker or money',JSON.stringify(controller.data!.active!.game)===before.game&&controller.data!.wallet===before.wallet&&JSON.stringify(controller.data!.ledger)===before.ledger&&JSON.stringify(controller.data!.hands)===before.hands,{gameUnchanged:JSON.stringify(controller.data!.active!.game)===before.game,walletUnchanged:controller.data!.wallet===before.wallet});
 for(const view of ['cashier','results','study','host','live']){el(`[data-view="${view}"]`).click();await delay(0);inspect(view);check(`${view}: public status node is persistent`,el('#table-announcement')===announcement,el('#table-announcement').textContent);}
 // Preserve a draft through a real held port boundary and busy-state render.
 // This is an isolated persistence fault fixture, not a native IndexedDB test.
 const originalCommit=port.commit.bind(port);let releaseClock!:()=>void,entered=false;
 const heldClock=new Promise<void>(resolve=>{releaseClock=resolve;});let holdNext=true;
 port.commit=async(expected,data)=>{if(holdNext){holdNext=false;entered=true;await heldClock;}await originalCommit(expected,data);};
 try{
  el<HTMLDetailsElement>('.sizing-shortcuts').open=true;el<HTMLInputElement>('#custom-pot-percent').value='31.75';
  const ticking=controller.tick();await waitFor(()=>entered);el('[data-view="live"]').click();
  check('Held clock disables committing while retaining open editor and unsubmitted draft',controller.busy&&el<HTMLButtonElement>('#raise').disabled&&el<HTMLDetailsElement>('.sizing-shortcuts').open&&el<HTMLInputElement>('#custom-pot-percent').value==='31.75',{busy:controller.busy,disabled:el<HTMLButtonElement>('#raise').disabled,open:el<HTMLDetailsElement>('.sizing-shortcuts').open,value:el<HTMLInputElement>('#custom-pot-percent').value});
  releaseClock();await ticking;
  check('Held clock completion unlocks same-decision actions without discarding draft',!controller.busy&&!el<HTMLButtonElement>('#call').disabled&&el<HTMLDetailsElement>('.sizing-shortcuts').open&&el<HTMLInputElement>('#custom-pot-percent').value==='31.75',{busy:controller.busy,callDisabled:el<HTMLButtonElement>('#call').disabled,open:el<HTMLDetailsElement>('.sizing-shortcuts').open,value:el<HTMLInputElement>('#custom-pot-percent').value});
 }finally{releaseClock();port.commit=originalCommit;}
 // The repair must not carry unsubmitted controls into another poker decision.
 const oldGame=controller.data!.active!.game,oldToken=`${oldGame.handId}:${oldGame.revision}`,oldHero=oldGame.seats.find(seat=>seat.id===0)!;
 const draftValues=[['#custom-pot-percent','17.25'],['#shortcut-bb','7.5'],['#increment-bb','2.5']];
 for(const [selector,value] of draftValues){el<HTMLInputElement>(selector).value=value;el<HTMLInputElement>(selector).dispatchEvent(new Event('input',{bubbles:true}));}
 el<HTMLInputElement>('#raise-to').value='37.23';el<HTMLInputElement>('#raise-to').dispatchEvent(new Event('input',{bubbles:true}));
 await controller.act({type:'call'},oldGame.handId,oldGame.revision);
 const nextGame=controller.data!.active!.game,newToken=`${nextGame.handId}:${nextGame.revision}`;
 const stale=draftValues.filter(([selector,value])=>root.querySelector<HTMLInputElement>(selector)?.value===value);
 check('A new committed poker decision invalidates old expanded sizing and unapplied drafts',newToken!==oldToken&&!stale.length&&root.querySelector<HTMLInputElement>('#raise-to')?.value!=='37.23'&&!root.querySelector<HTMLDetailsElement>('.sizing-shortcuts')?.open,{oldToken,newToken,stale,raiseValue:root.querySelector<HTMLInputElement>('#raise-to')?.value,editorOpen:root.querySelector<HTMLDetailsElement>('.sizing-shortcuts')?.open});
 const heroAction=nextGame.events.filter(event=>event.type==='action'&&event.seatId===0).at(-1),nextHero=nextGame.seats.find(seat=>seat.id===0)!;
 check('Draft invalidation never submits the old proposed raise',heroAction?.action?.type==='call'&&nextHero.stack<=oldHero.stack,{lastHeroAction:heroAction?.action,oldHeroStack:oldHero.stack,newHeroStack:nextHero.stack});
 parent.postMessage({kind:'step5d-a11y',result:{status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',at:new Date().toISOString(),seats,width:innerWidth,height:innerHeight,userAgent:navigator.userAgent,checks,contrast,limitations:['in-memory fixture; not native persistence verification','programmatic DOM focus/click; trusted keyboard NOT_EXECUTED here','physical screen reader NOT_EXECUTED','gradient/translucent text contrast NOT_MEASURED','not a complete WCAG audit']}},location.origin);
}catch(error){parent.postMessage({kind:'step5d-a11y',result:{status:'FAIL',seats,width:innerWidth,checks,error:String(error)}},location.origin);}finally{controller?.close();}
