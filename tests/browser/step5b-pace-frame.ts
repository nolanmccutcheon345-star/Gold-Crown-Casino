import { mountApp } from '../../src/ui/app';
import { SessionController } from '../../src/session/controller';
import { BrowserPersistence } from '../../src/storage/browser';
import { canonical, digest, validateData } from '../../src/storage/integrity';
import { deriveCashStats } from '../../src/stats/cash';
import { assertAccounting } from '../../src/core/engine';
const query=new URLSearchParams(location.search),run=query.get('run')??'',pace=Number(query.get('pace'));
if(!/^[A-Za-z0-9-]{8,100}$/.test(run)||![250,1800].includes(pace))throw Error('Explicit isolated laboratory run required');
const namespace=`ai-texas-hold-em-step5b-pace-lab-${run}`,seed=0x5713;
const nativeCrypto=globalThis.crypto,descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
if(!descriptor?.configurable||!nativeCrypto?.getRandomValues)throw Error('Laboratory entropy fixture unsupported');
let stream=seed,randomBytes=0;const randomCalls:{index:number;bytes:number}[]=[];
function labRandom<T extends ArrayBufferView>(array:T):T {if(array.byteLength>65536)throw Error('Lab quota exceeded');const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);randomCalls.push({index:randomCalls.length,bytes:bytes.length});for(let i=0;i<bytes.length;i++){stream^=stream<<13;stream^=stream>>>17;stream^=stream<<5;bytes[i]=stream&255;}randomBytes+=bytes.length;return array;}
// Explicit test-only provider in this fixture's own Window. Every production
// source function and every other browsing context retains its normal provider.
Object.defineProperty(globalThis,'crypto',{configurable:true,value:new Proxy(nativeCrypto,{get(target,key){if(key==='getRandomValues')return labRandom;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}})});
const controller=new SessionController(new BrowserPersistence(namespace));
mountApp(document.querySelector<HTMLElement>('#app')!,controller);
const start=performance.now(),trace:{selector:string;value?:string}[]=[];let botTurns=0;
const delay=(ms=20)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function check(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message);}
async function ready(){const begin=performance.now();while(controller.status!=='ready'||controller.busy){if(controller.status==='error')throw Error(controller.error);if(performance.now()-begin>15000)throw Error('UI ready timeout');await delay();}await delay();}
function el<T extends HTMLElement>(selector:string):T {const found=document.querySelector<T>(selector);check(found,`Missing ${selector}`);return found;}
// Clock persistence may begin during ready()'s paint delay. Wait for the live
// control (bounded), then click without an intervening await. Never force a
// disabled action or bypass the application's committed-state guard.
async function click(selector:string){const begin=performance.now();for(;;){await ready();const button=el<HTMLButtonElement>(selector);if(!button.disabled&&!controller.busy){trace.push({selector});button.click();await ready();return;}check(performance.now()-begin<15000,`Disabled ${selector} after readiness deadline`);await delay();}}
async function value(selector:string,text:string,event='change'){await ready();const input=el<HTMLInputElement|HTMLSelectElement>(selector);input.value=text;trace.push({selector,value:text});input.dispatchEvent(new Event(event,{bubbles:true}));await ready();}
function money(text:string){const negative=text.includes('−')||text.includes('-');return Math.round(Number(text.replace(/[^0-9.]/g,''))*100)*(negative?-1:1);}
function stat(label:string){const row=[...document.querySelectorAll('.stats-summary>div')].find(div=>div.querySelector('span')?.textContent===label);check(row,`Missing displayed statistic ${label}`);return row.querySelector('b')!.textContent!;}
async function execute(){
 await ready();check(document.visibilityState==='visible','Pace test must run in visible foreground');await click('#open-setup');await value('#seat-count','2');await value('[data-opponent-selection="1"]','station');await value('#buy-in','300','input');await click('#setup-form button[type="submit"]');await value('#pace',String(pace));
 const firstStarted=performance.now(),firstWall=Date.now();
 for(let number=1;number<=3;number++){
  if(number>1)await click('#next-hand');const id=controller.data!.active!.game.handId,handBegin=performance.now();
  while(controller.data!.active!.game.street!=='complete'){
   await ready();const game=controller.data!.active!.game,hero=game.seats.find(seat=>seat.id===0)!;
   if(game.actor===0&&document.querySelector<HTMLButtonElement>('#call')?.disabled===false)await click(Math.max(0,game.currentBet-hero.streetCommitted)>hero.stack*.25?'#fold':'#call');
   if(performance.now()-handBegin>45000)throw Error('A matched pace hand stalled');await delay(20);
  }
  const hand=controller.data!.hands.at(-1)!;check(hand.id===id,'Completed hand not persisted');assertAccounting(controller.data!.active!.game);botTurns+=hand.view.events.filter(event=>event.type==='action'&&event.seatId!==0).length;
  parent.postMessage({kind:'pace-progress',pace,completed:number,target:3,elapsedMs:performance.now()-firstStarted},location.origin);
 }
 const completedElapsedMs=performance.now()-firstStarted,completedWallMs=Date.now()-firstWall;
 await click('#new-session');await click('#end-complete');check(!controller.data!.active,'Pace session did not cash out');await validateData(controller.data!);
 const data=controller.data!,session=data.sessions[0],profit=data.hands.reduce((sum,hand)=>sum+hand.net,0),bb100=100*data.hands.reduce((sum,hand)=>sum+hand.net/hand.view.profile.bigBlind,0)/data.hands.length,activeMs=session.activeMs,actualPerHour=profit*3600000/activeMs,expectedProjection=profit/data.hands.length*30;
 const stats=deriveCashStats(data.hands,data.sessions),bb100Tolerance=8*Number.EPSILON*Math.max(1,Math.abs(bb100));check(stats.profit===profit&&stats.bb100!==null&&Math.abs(stats.bb100-bb100)<=bb100Tolerance&&stats.activeMs===activeMs&&stats.perHour===actualPerHour,`Statistics disagree with independent formulas: ${JSON.stringify({expected:{profit,bb100,activeMs,perHour:actualPerHour},observed:{profit:stats.profit,bb100:stats.bb100,activeMs:stats.activeMs,perHour:stats.perHour},handNets:data.hands.map(h=>({net:h.net,bigBlind:h.view.profile.bigBlind})),delta:{bb100:(stats.bb100??0)-bb100,perHour:(stats.perHour??0)-actualPerHour}})}`);check(activeMs>0&&activeMs>=completedWallMs*.9&&activeMs<=Date.parse(session.endedAt!)-Date.parse(session.startedAt)+100,'Recorded active time disagrees with real foreground session');
 await click('[data-view="results"]');const rendered={profit:stat('Total poker result'),bb100:stat('BB / 100'),actualPerHour:stat('App-clock result / hour'),activeTime:stat('Tracked playing time'),projection:el<HTMLElement>('[data-testid="projected-profit-hour"]').textContent!,projectedBB:el<HTMLElement>('[data-testid="projected-bb-hour"]').textContent!,liveHours:el<HTMLElement>('[data-testid="live-equivalent-hours"]').textContent!};
 check(money(rendered.profit)===profit&&Number(rendered.bb100)===Number(bb100.toFixed(2))&&money(rendered.actualPerHour)===Math.round(actualPerHour),'Actual rendered outcome/hour statistics disagree');check(money(rendered.projection)===Math.round(expectedProjection)&&Number(rendered.projectedBB)===Number((bb100*30/100).toFixed(2))&&Number(rendered.liveHours)===.1,'Rendered live projection incorrectly depends on actual speed');
 const outcomes=data.hands.map(hand=>({number:hand.number,net:hand.net,board:hand.view.board,rake:hand.view.rake,button:hand.view.button,profile:hand.view.profile,seats:hand.view.seats.map(({id,startingStack,stack,hole,folded})=>({id,startingStack,stack,hole,folded})),pots:hand.view.pots,payouts:hand.view.payouts,events:hand.view.events.map(({type,street,seatId,amount,action,detail})=>({type,street,seatId,amount,action,detail})),profiles:hand.privateProfiles}));
 return{status:'PASS',criterion:'V613',scope:'Actual UI matched-state pace test',paceMs:pace,seed,namespace,completedHands:data.hands.length,botTurns,completedElapsedMs,completedWallMs,sessionWallMs:Date.parse(session.endedAt!)-Date.parse(session.startedAt),foregroundActiveMs:activeMs,profitCents:profit,bb100,bb100Comparison:{observed:stats.bb100,independent:bb100,absoluteDifference:Math.abs((stats.bb100??0)-bb100),tolerance:bb100Tolerance,basis:'Eight scaled machine epsilons for observed grouping/summation roundoff only; monetary and time equality remain exact'},actualProfitPerHourCents:actualPerHour,hypotheticalProjectedProfitPerHourCents:expectedProjection,rendered,canonicalOutcomesDigest:await digest(outcomes),canonicalOutcomes:canonical(outcomes),randomCalls,randomBytes,trace,wholeFixtureElapsedMs:performance.now()-start,disclosure:'Laboratory deterministic getRandomValues provider installed only in this isolated QA iframe before app construction. Normal-play CSPRNG and production source are unchanged. Both paces use identical cards, profile seed stream and legal UI action driver; rate uses measured foreground session time, not authored duration.'};
}
void execute().then(result=>parent.postMessage({kind:'pace-result',pace,result},location.origin)).catch(error=>parent.postMessage({kind:'pace-result',pace,result:{status:'FAIL',error:String(error),trace,randomCalls}},location.origin)).finally(()=>Object.defineProperty(globalThis,'crypto',descriptor));
