import {BoundedSamples,projectTimingSample,type TimingObservation} from '../step5f-external/contracts';

const MAX_RECORDS=2000,MAX_INTERACTIONS=500;
export interface PublicDisplay {view:string;street:string;pot:string;wallet:string;tableStack:string;sessionProfit:string;handCount:string;saveStatus:string;provenance:string;announcement:string;error:string}
export function readPublicDisplay(root:HTMLElement):PublicDisplay{
 const text=(selector:string,max=600)=>root.querySelector(selector)?.textContent?.trim().slice(0,max)??'';
 return{view:root.querySelector('#setup-form')?'setup':root.querySelector('[data-testid="session-manager"]')?'session':root.querySelector('#export-history')?'history':root.querySelector('#adjust-bankroll')?'cashier':root.querySelector('[data-testid="stats-profit"]')?'results':root.querySelector('[data-testid="poker-table"]')?'table':'loading',street:text('[data-testid="street"]',30),pot:text('[data-testid="pot"]',60),wallet:text('[data-testid="wallet-balance"]',60),tableStack:text('[data-testid="table-stack"]',60),sessionProfit:text('[data-testid="session-profit"]',60),handCount:text('[data-testid="hand-count"]',30),saveStatus:text('[data-testid="save-status"]',150),provenance:text('[data-testid="session-provenance"]',500),announcement:text('#table-announcement'),error:text('.error-banner,.storage-banner.error,.storage-banner.readonly',500)};
}
const signature=(value:PublicDisplay)=>JSON.stringify({...value,saveStatus:''});
interface Interaction {number:number;at:number;action:string;trusted:true;inputMethod:'keyboard-or-assistive-click'|'pointer-click';before:PublicDisplay;raiseProposal:string|null;outcome:'PENDING'|'VISIBLE_CHANGE_OBSERVED'|'UI_ERROR_OBSERVED'|'NO_CHANGE_OBSERVED_BEFORE_NEXT_INPUT';visibleAfterMs:number|null;nextFrameAfterMs:number|null;after:PublicDisplay|null;focusAfter:string|null}
export function installExternalObserver(root:HTMLElement){
 const startedAt=new Date().toISOString(),started=performance.now(),timings=new Map<string,BoundedSamples>(),timingTrace:TimingObservation[]=[],interactions:Interaction[]=[],longTasks:Array<{startTime:number;duration:number}>=[],eventTiming:Array<{name:string;startTime:number;duration:number;processingStart:number;processingEnd:number;interactionId:number|null}>=[],memory:Array<{at:number;usedJSHeapSize:number|null;totalJSHeapSize:number|null;jsHeapSizeLimit:number|null}>=[];
 let ignoredTimingEvents=0,droppedTimingTrace=0,droppedInteractions=0,droppedLongTasks=0,droppedEventTiming=0,memorySamples=0,closed=false,frame=0,pending:Interaction|null=null,firstPublicUI:number|null=null,savedIndicator:number|null=null;
 const recordMemory=()=>{memorySamples++;const current=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;memory.push({at:performance.now(),usedJSHeapSize:current?.usedJSHeapSize??null,totalJSHeapSize:current?.totalJSHeapSize??null,jsHeapSizeLimit:current?.jsHeapSizeLimit??null});if(memory.length>200)memory.shift();};
 const timing=(event:Event)=>{const sample=projectTimingSample((event as CustomEvent<unknown>).detail);if(!sample){ignoredTimingEvents++;return;}const bucket=timings.get(sample.name)??new BoundedSamples();bucket.add(sample.milliseconds);timings.set(sample.name,bucket);if(timingTrace.length<MAX_RECORDS)timingTrace.push(sample);else droppedTimingTrace++;};
 window.addEventListener('ai-texas-performance-sample',timing);
 const financialIds=new Set(['fold','call','raise','jam','next-hand','end-complete','end-fold','end-finish','adjust-bankroll','topup-submit','start-game','start-session','new-session']);
 const click=(event:MouseEvent)=>{
  if(!event.isTrusted||!(event.target instanceof Element))return;
  const target=event.target.closest<HTMLElement>('button,input[type="submit"],a,summary');if(!target||!root.contains(target))return;
  const action=target.id||(['data-view','data-action','data-size','data-replay'].find(k=>target.hasAttribute(k))??target.tagName);
  if(interactions.length>=MAX_INTERACTIONS){droppedInteractions++;return;}
  if(pending){pending.outcome='NO_CHANGE_OBSERVED_BEFORE_NEXT_INPUT';pending=null;}
  const proposal=root.querySelector<HTMLInputElement>('#raise-to')?.value??null;
  const row:Interaction={number:interactions.length+1,at:performance.now(),action:action.slice(0,100),trusted:true,inputMethod:event.detail===0?'keyboard-or-assistive-click':'pointer-click',before:readPublicDisplay(root),raiseProposal:financialIds.has(target.id)?proposal:null,outcome:'PENDING',visibleAfterMs:null,nextFrameAfterMs:null,after:null,focusAfter:null};
  interactions.push(row);pending=row;
 };
 root.addEventListener('click',click,true);
 const observeDisplay=()=>{
  frame=0;if(closed)return;
  const state=readPublicDisplay(root),now=performance.now();if(firstPublicUI===null&&state.view!=='loading')firstPublicUI=now-started;
  if(savedIndicator===null&&state.saveStatus.startsWith('Saved on this device'))savedIndicator=now-started;
  if(!pending||signature(state)===signature(pending.before))return;
  // Busy presentation alone is not confirmation. Even the resulting DOM is a
  // visible-state proxy, never independent proof of a committed ledger event.
  if(state.saveStatus&&!state.saveStatus.startsWith('Saved on this device')&&!state.error)return;
  const row=pending;pending=null;row.visibleAfterMs=now-row.at;row.after=state;row.outcome=state.error?'UI_ERROR_OBSERVED':'VISIBLE_CHANGE_OBSERVED';row.focusAfter=document.activeElement instanceof HTMLElement?(document.activeElement.id||document.activeElement.tagName):null;
  requestAnimationFrame(()=>{row.nextFrameAfterMs=performance.now()-row.at;});
 };
 const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(observeDisplay);});observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','class']});
 const supported=typeof PerformanceObserver==='undefined'?[]:PerformanceObserver.supportedEntryTypes;
 const performanceObservers:PerformanceObserver[]=[];
 if(supported.includes('longtask')){const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.startTime+entry.duration<started)continue;if(longTasks.length<MAX_RECORDS)longTasks.push({startTime:entry.startTime,duration:entry.duration});else droppedLongTasks++;}});observer.observe({type:'longtask',buffered:true});performanceObservers.push(observer);}
 if(supported.includes('event')){const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.startTime+entry.duration<started)continue;const event=entry as PerformanceEntry&{processingStart?:number;processingEnd?:number;interactionId?:number};if(eventTiming.length<MAX_RECORDS)eventTiming.push({name:event.name,startTime:event.startTime,duration:event.duration,processingStart:event.processingStart??0,processingEnd:event.processingEnd??0,interactionId:event.interactionId??null});else droppedEventTiming++;}});try{observer.observe({type:'event',buffered:true,durationThreshold:16} as PerformanceObserverInit);performanceObservers.push(observer);}catch{observer.disconnect();}}
 recordMemory();
 return{
  sampleMemory:recordMemory,
  capture:()=>{recordMemory();return{format:'step5f-manual-browser-observations',version:1,status:'OBSERVED',startedAt,capturedAt:new Date().toISOString(),browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},measurementStartTime:started,elapsedMs:performance.now()-started,firstPublicUIDOMMs:firstPublicUI,savedIndicatorDOMMs:savedIndicator,performanceOptIn:new URLSearchParams(location.search).get('measurePerformance')==='1',timings:Object.fromEntries([...timings].map(([name,samples])=>[name,samples.report()])),timingTrace,droppedTimingTrace,ignoredTimingEvents,interactions,droppedInteractions,longTasks,droppedLongTasks,eventTiming,droppedEventTiming,memory,droppedMemorySamples:memorySamples-memory.length,publicDisplay:readPublicDisplay(root),coverage:{botCompute:timings.has('bot.policy')?'OBSERVED timing-only bridge':'NOT_MEASURED',fullPreparation:timings.has('bot.prepare')?'OBSERVED timing-only bridge':'NOT_MEASURED',trustedInputToVisibleConfirmation:'DOM confirmation proxy; not durable commit, physical paint or INP',longTasks:supported.includes('longtask')?'SUPPORTED; record count is actual':'NOT_MEASURED: browser API unavailable',eventTiming:supported.includes('event')?'SUPPORTED; raw observed entries, not a complete INP calculation':'NOT_MEASURED: browser API unavailable',heap:memory.some(row=>row.usedJSHeapSize!==null)?'Coarse performance.memory; no forced GC; not retained-object attribution':'NOT_MEASURED: browser heap API unavailable',screenReaderSpeech:'NOT_EXECUTED: actual spoken output must be recorded by the human tester',physicalDevice:'NOT_VERIFIED_BY_AUTOMATION',newUserStudy:'NOT_EXECUTED: separate observed participant records required'},privacy:{controllerAccess:false,engineStateAccess:false,databaseReads:false,privateCardsOrPoliciesRead:false,networkSubmission:false},limits:['This records ordinary public UI and allowlisted numeric timings. It never supplies poker actions.','No automatically inferred PASS, screen-reader speech, device identity, independent commit timestamp or new-user outcome.','Capped raw records are disclosed. Quantiles become unavailable if a phase sample cap is reached.','Keep separate runs for initial restoration, gameplay, history browsing and full audit; record the chosen phase in the observer notes.']};},
  close:()=>{closed=true;observer.disconnect();performanceObservers.forEach(o=>o.disconnect());window.removeEventListener('ai-texas-performance-sample',timing);root.removeEventListener('click',click,true);if(frame)cancelAnimationFrame(frame);},
 };
}
