import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {regularConfig} from '../../src/bots/regulars';
import {chatterFor} from '../../src/ui/table-talk';
import {canonical,validateData} from '../../src/storage/integrity';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(_expected:number|null,next:AppData){this.value=structuredClone(next);}close(){}}
const c=new SessionController(new Port()),result=document.querySelector('#result')!;
async function run(){await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6,opponents:['vince','sal','frank','marco','big-earl'].map(regularConfig)});
 for(let n=0;n<60;n++){
  while(c.data!.active!.game.street!=='complete'){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}if(c.error)throw Error(c.error);}
  const a=c.data!.active!,talk=chatterFor(a.game,id=>a.profiles[id],false,true);
  if(talk.shows.length){await validateData(c.data!);const before=canonical(c.data);mountApp(document.querySelector<HTMLElement>('#app')!,c);await new Promise(r=>setTimeout(r,100));
   const toggle=document.querySelector<HTMLInputElement>('#table-talk')!;if(!toggle.checked)toggle.click();
   for(const line of document.querySelectorAll<HTMLElement>('.seat-talk')){const parent=line.parentElement!;if(getComputedStyle(parent).overflow==='hidden'&&line.getBoundingClientRect().bottom>parent.getBoundingClientRect().bottom)throw Error('Talk clipped by seat status');}const shows=document.querySelectorAll('.shown-hand').length,lines=document.querySelectorAll('.seat-talk').length;
   if(!shows||!lines)throw Error('Talk/show not rendered');document.querySelector<HTMLInputElement>('#table-talk')!.click();if(document.querySelector('.shown-hand,.seat-talk'))throw Error('Hidden talk still rendered');document.querySelector<HTMLInputElement>('#table-talk')!.click();
   if(canonical(c.data)!==before)throw Error('Toggle changed canonical save');
   result.textContent=JSON.stringify({status:'PASS',width:innerWidth,hands:n+1,shows,lines,saveUnchanged:true,overflow:document.documentElement.scrollWidth>innerWidth+1});return;}
  await c.nextHand();
 }throw Error('No shown-hand sample');}
void run().catch(e=>{result.textContent=JSON.stringify({status:'FAIL',error:String(e)});});
