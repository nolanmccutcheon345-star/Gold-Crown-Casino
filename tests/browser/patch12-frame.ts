import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {Action} from '../../src/contracts';
import {legalActions} from '../../src/core/engine';
import {validateData} from '../../src/storage/integrity';
class Memory implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data)}async commit(expected:number|null,d:AppData){if(expected!==(this.data?.revision??null))throw Error('revision conflict');this.data=structuredClone(d)}close(){}}
const actions:unknown[]=[];class Observed extends SessionController{override async act(action:Action,id:string,revision:number){actions.push({action,id,revision,legal:legalActions(this.data!.active!.game)});return super.act(action,id,revision)}}
const port=new Memory(),seed=new SessionController(port);await seed.init();const mode=new URLSearchParams(location.search).get('mode')!;await seed.startSession({...DEFAULT_SETTINGS,seats:mode==='auto'?2:3});if(mode==='auto'){const g=seed.data!.active!.game;await seed.act({type:'fold'},g.handId,g.revision)}seed.close();
localStorage.removeItem('ai-texas-hold-em:auto-deal');localStorage.setItem('ai-texas-hold-em:bot-pace','1800');const c=new Observed(port);mountApp(document.querySelector('#app')!,c);
const rows:string[]=[];const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));const wait=async(fn:()=>unknown,label:string)=>{const start=Date.now();while(!fn()){if(Date.now()-start>30000)throw Error('Timeout: '+label);await delay(20)}};
const el=(s:string)=>document.querySelector<HTMLElement>(s)!;const click=(s:string)=>{if(!el(s))throw Error('Missing '+s);el(s).click()};const check=(v:unknown,m:string)=>{if(!v)throw Error(m);rows.push(m)};
try{await wait(()=>el('#auto-deal')&&c.status==='ready','mounted');const initial=c.data!.active!.game.handId;
if(mode==='auto'){
 await delay(5500);check(c.data!.active!.game.handId===initial&&!el('#auto-deal-hold'),'Default off does not deal');
 click('#auto-deal');check(!!el('#auto-deal-hold'),'Auto-deal presents Hold');const hold=el('#auto-deal-hold').getBoundingClientRect();check(hold.height>=44&&hold.left>=0&&hold.right<=innerWidth,'Hold touch target fits viewport');click('#auto-deal-hold');await delay(5500);check(c.data!.active!.game.handId===initial&&!el('#auto-deal-count'),'Hold survives completed-hand updates');
 click('#auto-deal');click('#auto-deal');click('[data-view="study"]');await delay(5500);check(c.data!.active!.game.handId===initial,'History navigation cancels countdown');click('[data-view="live"]');await wait(()=>c.data!.active!.game.handId!==initial,'auto dealt');check(c.data!.active!.number===2,'Countdown deals exactly one next hand');check(localStorage.getItem('ai-texas-hold-em:auto-deal')==='1','Preference is saved');click('#auto-deal');await c.setPaused(true);
}else{
 click('#call');await wait(()=>el('#pre-check-fold'),'opponent turn');click('#pre-check-fold');check(el('#pre-check-fold').getAttribute('aria-pressed')==='true','Check/Fold arms');const target=el('#pre-check-fold').getBoundingClientRect();check(target.height>=44&&target.left>=0&&target.right<=innerWidth,'Check/Fold touch target fits viewport');
 const before=actions.length;await wait(()=>actions.length>before||c.data!.active!.game.street!=='preflop','pre-action or street expiry');if(actions.length>before){const last=actions.at(-1) as {action:Action;legal:ReturnType<typeof legalActions>};check(last.action.type===(last.legal.check?'check':'fold'),'Pre-action uses current legality and never calls or raises');check(actions.length===before+1,'Pre-action submits once');}else{check(el('#pre-check-fold')?.getAttribute('aria-pressed')!=='true','Pre-action expires when street ends without Hero action');}await c.setPaused(true);check(!el('#pre-check-fold'),'Paused game does not offer pre-action');
}
await validateData(c.data!);check(true,'Financial and canonical data validates');parent.postMessage({kind:'patch12',status:'PASS',mode,rows,actions,hands:c.data!.hands.length,wallet:c.data!.wallet},location.origin);
}catch(e){parent.postMessage({kind:'patch12',status:'FAIL',mode,rows,error:String(e)},location.origin)}
