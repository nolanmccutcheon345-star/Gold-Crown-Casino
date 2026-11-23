import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {auditSnapshot} from '../../src/storage/verified';
import {deriveCashStats} from '../../src/stats/cash';
import {digest} from '../../src/storage/integrity';
import {createStatsBrowserFixture,createStationBrowserFixture} from '../step5b-statistics/browser-fixture';
import type {AppData,PersistencePort} from '../../src/session/types';
const app=document.querySelector<HTMLElement>('#app')!,status=document.querySelector<HTMLElement>('#fixture-status')!,evidence=document.querySelector<HTMLElement>('#fixture-evidence')!;
const fast=document.querySelector<HTMLButtonElement>('#fast-fixture')!,live=document.querySelector<HTMLButtonElement>('#live-fixture')!,station=document.querySelector<HTMLButtonElement>('#station-fixture')!,verify=document.querySelector<HTMLButtonElement>('#verify-displayed-stats')!;
class FixturePort implements PersistencePort {
 constructor(private data:AppData){}async load(){return this.data;}async commit(expected:number|null,next:AppData){if(expected!==this.data.revision)throw Error('Fixture revision mismatch');this.data=next;}close(){}
}
let corpus:AppData,formulaCorpus:AppData,stationCorpus:AppData|null=null,fixtureMode:'formula'|'station'='formula',controller:SessionController|null=null,duration:1|10=1,canonicalHash='';const checks:unknown[]=[];
const displayed=(selector:string)=>app.querySelector(selector)?.textContent?.trim()??'';
function summary(label:string):string {const row=[...app.querySelectorAll('.stats-summary>div')].find(div=>div.querySelector('span')?.textContent===label);return row?.querySelector('b')?.textContent?.trim()??'';}
function verifyDisplay():void {
 const assumption=Number(app.querySelector<HTMLInputElement>('#assumed-live-pace')?.value);
 const count=fixtureMode==='formula'?300:100,profit=fixtureMode==='formula'?6000:corpus.hands.reduce((sum,h)=>sum+h.net,0),bb100=fixtureMode==='formula'?10:100*(profit/200)/count;
 const dollars=(cents:number)=>(cents>0?'+':cents<0?'−':'')+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:cents%100?2:0}).format(Math.abs(cents)/100);
 const projectedCents=Math.round(profit/count*assumption),expectedHours=(count/assumption).toFixed(2),expectedBB=(bb100*assumption/100).toFixed(2),expectedCash=dollars(projectedCents);
 const actual={hands:summary('Hands played'),bb100:summary('BB / 100'),profit:displayed('[data-testid="stats-profit"]'),perHour:summary('App-clock result / hour'),minutes:summary('Tracked playing time'),equivalent:displayed('[data-testid="live-equivalent-hours"]'),projectedBB:displayed('[data-testid="projected-bb-hour"]'),projectedCash:displayed('[data-testid="projected-profit-hour"]')};
 const expected={hands:String(count),bb100:bb100.toFixed(2),profit:dollars(profit),perHour:dollars(Math.round(profit/duration)),minutes:`${duration*60}.0 min`,equivalent:expectedHours,projectedBB:expectedBB,projectedCash:expectedCash};
 const errors=Object.entries(expected).filter(([key,value])=>actual[key as keyof typeof actual]!==value).map(([key,value])=>`${key}: expected ${value}, got ${actual[key as keyof typeof actual]}`);
 if(!app.querySelector('[data-testid="live-pace-projection"]')?.textContent?.includes('hypothetical'))errors.push('Hypothetical disclosure missing');
 if(displayed('[data-testid="ev-availability"]')!=='All-in-adjusted EV: NOT IMPLEMENTED. The amounts above are recorded simulator profits and losses. Full decision EV is not calculated.')errors.push('Explicit G10 unavailable EV disclosure missing');
 if(displayed('[data-testid="population-results-disclosure"]')!=='Results depend on this synthetic opponent population and do not predict real poker winnings.')errors.push('Explicit G05 population-dependent results warning missing');
 const result={mode:fixtureMode,status:errors.length?'FAIL':'PASS',fixture:`${count} real-engine canonical hands; populated UI verification, not${count}UI-played hands`,recordedHours:duration,assumedHandsPerHour:assumption,canonicalHandsHash:canonicalHash,actual,expected,errors};checks.push(result);evidence.textContent=JSON.stringify(checks,null,2);status.textContent=`${result.status}: ${duration} recorded fixture hour(s); ${assumption} assumed live hands/hour. ${errors.join('; ')}`;
 if(errors.length)throw Error(errors.join('; '));
}
async function show(hours:1|10,mode:'formula'|'station'='formula'):Promise<void> {
 fast.disabled=live.disabled=station.disabled=verify.disabled=true;controller?.close();duration=hours;fixtureMode=mode;
 if(mode==='station'&&!stationCorpus)stationCorpus=await createStationBrowserFixture(async hands=>{status.textContent=`Executing current station policy: ${hands}/100 real engine hands`;await new Promise(resolve=>setTimeout(resolve,0));});
 corpus=mode==='station'?stationCorpus!:formulaCorpus;canonicalHash=await digest(corpus.hands);
 const data:AppData={...corpus,sessions:corpus.sessions.map(s=>({...s,activeMs:hours*3600000,endedAt:new Date(Date.parse(s.startedAt)+hours*3600000).toISOString()}))};
 await auditSnapshot(data);controller=new SessionController(new FixturePort(data));
 const ready=new Promise<void>((resolve,reject)=>{const unsubscribe=controller!.subscribe(()=>{if(controller!.status==='ready'&&!controller!.busy){unsubscribe();resolve();}else if(controller!.status==='error'){unsubscribe();reject(Error(controller!.error));}});});
 mountApp(app,controller);await ready;
 app.querySelector<HTMLButtonElement>('[data-view="results"]')!.click();
 // Cold projections deliberately publish no partial totals. Observe completion
 // rather than assuming one animation frame is enough for a populated save.
 await new Promise<void>((resolve,reject)=>{
  const ready=()=>Boolean(app.querySelector('[data-testid="stats-profit"]'));
  if(ready()){resolve();return;}
  const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();clearTimeout(deadline);resolve();}});
  const deadline=setTimeout(()=>{observer.disconnect();reject(Error('Complete statistics projection did not render within the QA deadline'));},30000);
  observer.observe(app,{childList:true,subtree:true});
 });
 fast.disabled=live.disabled=station.disabled=verify.disabled=false;verifyDisplay();
}
function fail(error:unknown):void {status.textContent=`FAIL: ${(error as Error).message}`;evidence.textContent=JSON.stringify({checks,error:(error as Error).stack},null,2);}
fast.onclick=()=>{void show(1).catch(fail);};live.onclick=()=>{void show(10).catch(fail);};station.onclick=()=>{void show(1,'station').catch(fail);};verify.onclick=()=>{try{verifyDisplay();}catch(error){fail(error);}};
try {
 formulaCorpus=await createStatsBrowserFixture(async hands=>{status.textContent=`Building and sealing actual engine hands: ${hands}/300`;await new Promise(resolve=>setTimeout(resolve,0));});
 corpus=formulaCorpus;const stats=deriveCashStats(corpus.hands,corpus.sessions);if(stats.hands!==300||stats.profit!==6000||stats.bb100!==10)throw Error('Actual canonical fixture totals changed');
 canonicalHash=await digest(corpus.hands);await show(1);
}catch(error){fail(error);}
