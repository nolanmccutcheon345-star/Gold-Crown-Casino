import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {canonical,validateData} from '../../src/storage/integrity';
const q=new URLSearchParams(location.search),run=q.get('run')??'',phase=q.get('phase');
if(!/^[a-f0-9-]{36}$/.test(run)||!['play','reload'].includes(phase??''))throw Error('Explicit isolated test required');
const c=new SessionController(new BrowserPersistence('cash-straddle54-'+run));mountApp(document.querySelector<HTMLElement>('#app')!,c);
const wait=()=>new Promise(r=>setTimeout(r,20)),check=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg);};
async function until(test:()=>unknown){const start=performance.now();while(!test()){check(c.status!=='error',c.error);check(performance.now()-start<60000,'UI timeout');await wait();}}
async function click(s:string){await until(()=>c.status==='ready'&&!c.busy&&!!document.querySelector<HTMLButtonElement>(s)&&!document.querySelector<HTMLButtonElement>(s)!.disabled);document.querySelector<HTMLButtonElement>(s)!.click();await until(()=>!c.busy);}
function snap(){const d=c.data!;return {game:d.active?.game,profiles:d.active?.profiles,news:d.active?.churnNews,wallet:d.wallet,ledger:d.ledger,hands:d.hands.map(h=>({id:h.id,hash:h.hash})),memory:d.humanMemory,heroStraddle:d.active?.heroStraddle};}
void(async()=>{const news:string[]=[],widths=new Set<number>(),straddles:{hand:number;seat:number;minRaise:number|null}[]=[];try{
 await until(()=>c.status==='ready'&&!c.busy);
 if(phase==='reload'){const expected=JSON.parse(decodeURIComponent(location.hash.slice(1)));check(canonical(snap())===canonical(expected),'Reload changed cards, profiles, news, memory or money');await validateData(c.data!);parent.postMessage({kind:'straddle54',status:'PASS',phase,hands:c.data!.hands.length},location.origin);return;}
 await click('[data-view="host"]');
 const allow=document.querySelector<HTMLInputElement>('#allow-straddle')!;allow.checked=true;allow.dispatchEvent(new Event('change',{bubbles:true}));await click('#setup-submit');await until(()=>!!c.data?.active);
 const hero=document.querySelector<HTMLInputElement>('#hero-straddle')!;hero.checked=true;hero.dispatchEvent(new Event('change',{bubbles:true}));await until(()=>!c.busy&&c.data!.active!.heroStraddle===true);const openingStacks=c.data!.active!.game.seats.map(s=>({name:s.name,stack:s.startingStack}));const pace=document.querySelector<HTMLSelectElement>('#pace')!;pace.value='250';pace.dispatchEvent(new Event('change',{bubbles:true}));
 for(let h=0;h<30;h++){
  const fresh=c.data!.active!.game;if(fresh.straddleSeat!==undefined){check(fresh.engineVersion==='0.6.0','Missing straddle engine version');check(!!document.querySelector(`[data-seat="${fresh.straddleSeat}"] .straddle-tag`),'Missing STR marker');straddles.push({hand:h+1,seat:fresh.straddleSeat,minRaise:document.querySelector<HTMLInputElement>('#raise-to')?Number(document.querySelector<HTMLInputElement>('#raise-to')!.value):null});}
  const started=performance.now();while(c.data!.active!.game.street!=='complete'){if(c.data!.active!.game.actor===0&&!c.busy)await click('#fold');check(performance.now()-started<60000,'Hand stalled');await wait();}
  await until(()=>!c.busy);check(!c.error,c.error);check(!c.data!.policyViolations?.length,'Illegal bot proposal');
  widths.add(window.innerWidth);check(document.documentElement.scrollWidth<=window.innerWidth+1,'Horizontal overflow');
  const a=c.data!.active!,line=document.querySelector('.table-news')?.textContent;if(line){news.push(line);check(a.churnNews?.handId===a.game.handId,'Stale table news');}
  check(new Set(a.game.seats.map(s=>s.name)).size===a.game.seats.length,'Duplicate names');
  parent.postMessage({kind:'straddle54',status:'RUNNING',hands:h+1,news:news.length,width:h<9?320:h<19?390:1366},location.origin);
  if(h<29)await click('#next-hand');
 }
 check(straddles.some(s=>s.seat===0),'Hero never straddled');await validateData(c.data!);const d=c.data!,sums=d.ledger.reduce((n,e)=>n+e.walletDelta,0);check(sums===d.wallet,'Wallet replay mismatch');
 check(d.ledger.filter(e=>e.kind==='hand-net').length===d.hands.length,'Settlement count mismatch');
 parent.postMessage({kind:'straddle54',status:'PASS',phase,hands:d.hands.length,openingStacks,straddles,news,widths:[...widths],snapshot:snap()},location.origin);
 }catch(error){parent.postMessage({kind:'straddle54',status:'FAIL',phase,error:String(error),news},location.origin);}})();
