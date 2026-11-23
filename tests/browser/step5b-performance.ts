import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {appendMoney,seal,GENESIS,validateData,digest} from '../../src/storage/integrity';
import {observeTimings,type TimingSample} from '../../src/performance/timing';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
const baselineURL='./step5b-baseline.js';const baseline=await import(/* @vite-ignore */baselineURL) as {SessionController:typeof SessionController;BrowserPersistence:typeof BrowserPersistence};
const input=(id:string)=>Number((document.getElementById(id) as HTMLInputElement).value),status=document.getElementById('status')!,result=document.getElementById('result')!;
const quantiles=(x:number[])=>{const a=x.slice().sort((a,b)=>a-b),q=(p:number)=>a[Math.max(0,Math.ceil(p*a.length)-1)]??null;return{samples:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)??null};};
class Port implements PersistencePort{constructor(public data:AppData){}async load(){return structuredClone(this.data);}async commit(_rev:number|null,data:AppData){this.data=structuredClone(data);}close(){}}
async function fixture(count:number,seats:number){
 const templates=await(await fetch('../step5b-performance/profile-templates.json')).json() as StoredHand[],at='2026-11-01T00:00:00.000Z';
 const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1e12,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};await appendMoney(data,{id:'profile-initial',at,epoch:0,kind:'adjustment',walletDelta:1e12,tableDelta:0,pokerNet:0,note:'Isolated profiling corpus'});
 for(let n=0;n<count;n++){
  const template=templates[n%templates.length],handId=`profile-hand-${n}`,sid=`profile-session-${n}`,row=JSON.parse(JSON.stringify(template).replaceAll(template.id,handId)) as StoredHand;row.id=handId;row.sessionId=sid;row.previousHash=data.hands.at(-1)?.hash??GENESIS;
  const hero=row.view.seats[0];data.hands.push(await seal(row));data.sessions.push({id:sid,epoch:0,startedAt:at,endedAt:at,settings:{...DEFAULT_SETTINGS,seats:6,buyIn:hero.startingStack},profile:row.view.profile,buyIns:hero.startingStack,cashOut:hero.stack,activeMs:10000,lastActiveAt:null,handIds:[handId]});
  await appendMoney(data,{id:`buy-in:${sid}`,kind:'buy-in',at,epoch:0,walletDelta:-hero.startingStack,tableDelta:hero.startingStack,pokerNet:0,sessionId:sid,note:'Corpus funding'});await appendMoney(data,{id:`settle:${handId}`,kind:'hand-net',at,epoch:0,walletDelta:0,tableDelta:row.net,pokerNet:row.net,sessionId:sid,handId,note:'Corpus settlement'});await appendMoney(data,{id:`cash-out:${sid}`,kind:'cash-out',at,epoch:0,walletDelta:hero.stack,tableDelta:-hero.stack,pokerNet:0,sessionId:sid,note:'Corpus cashout'});
  if(n%50===0){status.textContent=`Preparing isolated corpus ${n}/${count}`;await new Promise(resolve=>setTimeout(resolve,0));}
 }
 await validateData(data);const c=new baseline.SessionController(new Port(data));await c.init();await c.startSession({...DEFAULT_SETTINGS,seats,buyIn:100000});if(c.data!.active!.game.actor===0){const g=c.data!.active!.game;await c.act({type:'call'},g.handId,g.revision);}if(c.error)throw Error(c.error);const saved=structuredClone(c.data!);c.close();return saved;
}
(document.getElementById('run') as HTMLButtonElement).onclick=async()=>{
 const button=document.getElementById('run') as HTMLButtonElement;button.disabled=true;const rows:unknown[]=[];
 try{
  const n=input('hands'),seats=input('seats'),samples=input('samples');if(!Number.isInteger(n)||n<0||n>5000||![2,6,10].includes(seats)||samples<1||samples>30)throw Error('Choose0–5000 hands,2/6/10 seats,1–30 samples.');const data=await fixture(n,seats),fixtureHash=await digest(data);
  for(const phase of ['baseline','candidate'] as const){const times:number[]=[],longTaskEntries:{startTime:number;duration:number}[]=[],windows:{start:number;end:number}[]=[],segments:TimingSample[]=[];let measuredStart=0,measuredEnd=0;
   const observer=new PerformanceObserver(entries=>{for(const e of entries.getEntries())longTaskEntries.push({startTime:e.startTime,duration:e.duration});});try{observer.observe({type:'longtask',buffered:false});}catch{/* Unsupported is reported. */}
   for(let sample=0;sample<samples;sample++){
    status.textContent=`${phase}: ${n} saved hands, ${seats} seats, sample ${sample+1}/${samples}`;await new Promise(resolve=>setTimeout(resolve,30));
    const name=`ai-texas-step5b-profile-${phase}-${Date.now()}-${sample}`,PortClass=phase==='baseline'?baseline.BrowserPersistence:BrowserPersistence,Controller=phase==='baseline'?baseline.SessionController:SessionController,port=new PortClass(name);await port.load();await port.commit(null,structuredClone(data));const c=new Controller(port);await c.init();if(c.error)throw Error(c.error);
    observeTimings(s=>segments.push(s));await new Promise(resolve=>setTimeout(resolve,30));measuredStart=performance.now();await c.prepareBot();measuredEnd=performance.now();times.push(measuredEnd-measuredStart);windows.push({start:measuredStart,end:measuredEnd});observeTimings(null);if(c.error)throw Error(c.error);await new Promise(resolve=>setTimeout(resolve,100));c.close();await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Isolated profile database still open after 3 seconds; connection leak requires investigation')),3000),req=indexedDB.deleteDatabase(name);req.onsuccess=()=>{clearTimeout(timeout);resolve();};req.onerror=()=>{clearTimeout(timeout);reject(req.error);};req.onblocked=()=>{status.textContent='Waiting for isolated storage lease/transaction to close (maximum 3 seconds)';};});
   }
   for(const e of observer.takeRecords())longTaskEntries.push({startTime:e.startTime,duration:e.duration});observer.disconnect();const measuredLongTasks=longTaskEntries.filter(e=>windows.some(w=>e.startTime<w.end&&e.startTime+e.duration>w.start));rows.push({phase,prepareMs:quantiles(times),longTaskMs:quantiles(measuredLongTasks.map(e=>e.duration)),longTaskEntries:measuredLongTasks,measurementWindows:windows,segments:Object.fromEntries([...new Set(segments.map(s=>s.name))].map(name=>[name,quantiles(segments.filter(s=>s.name===name).map(s=>s.milliseconds))]))});result.textContent=JSON.stringify({fixtureHash,hands:n,seats,samples,bytes:JSON.stringify(data).length,userAgent:navigator.userAgent,longTaskSupported:PerformanceObserver.supportedEntryTypes.includes('longtask'),rows},null,2);
  }
  status.textContent='Completed. Baseline and candidate consumed the identical canonical active snapshot; isolated databases removed.';
 }catch(error){status.textContent=`FAIL: ${(error as Error).message}`;result.textContent=JSON.stringify(rows,null,2);}finally{observeTimings(null);button.disabled=false;}
};
