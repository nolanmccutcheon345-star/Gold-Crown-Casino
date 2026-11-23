import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {applyCommand,legalActions,projectView,assertAccounting} from '../../src/core/engine';
import {appendMoney,GENESIS,seal,validateData} from '../../src/storage/integrity';
import {makeCashHandProvenance} from '../../src/session/hand-provenance';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
class MemoryPort implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_expected:number|null,d:AppData){this.data=structuredClone(d);}close(){}}
const count=9,phase:string='river';
const pause=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
async function execute(){
 assert(Number.isInteger(count)&&count>=2&&count<=10,'Invalid fixture seat count');assert(['preflop','river','complete'].includes(phase??''),'Invalid fixture phase');
 const port=new MemoryPort(),seed=new SessionController(port);await seed.init();await seed.startSession({...DEFAULT_SETTINGS,seats:count,buyIn:20000});assert(seed.data?.active,'Fixture failed to start');const data=structuredClone(seed.data);seed.close();const active=data.active!;
 for(let i=0;i<200&&active.game.street!=='complete';i++){
  if(phase==='preflop'&&active.game.street==='preflop'&&active.game.actor===0)break;
  if(phase==='river'&&active.game.street==='river'&&active.game.actor===0)break;
  const game=active.game;active.game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`patch1:${game.handId}:${game.revision}`,action:[1,3].includes(game.actor!)?{type:'fold'}:legalActions(game).check?{type:'check'}:{type:'call'}});active.frames.push(projectView(active.game,0));
 }
 assert(active.game.street===phase,'Fixture did not reach requested street');assertAccounting(active.game);
 if(active.game.street==='complete'){
  const view=projectView(active.game,0),hero=view.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
  const record=await seal<StoredHand>({id:active.game.handId,sessionId:active.sessionId,epoch:0,number:1,startedAt:active.startedAt,endedAt:new Date().toISOString(),view,frames:active.frames,net,provenance:makeCashHandProvenance(view.profile),...(active.configuration?{configuration:structuredClone(active.configuration)}:{}),privateProfiles:active.profiles,previousHash:GENESIS,hash:''});data.hands.push(record);data.sessions[0].handIds.push(record.id);await appendMoney(data,{id:`settle:${record.id}`,kind:'hand-net',at:record.endedAt,epoch:0,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:active.sessionId,handId:record.id,note:'Synthetic legal-hand patch layout fixture'});
 }
 await validateData(data); // Reject malformed fixture records before waiting on the UI.
 port.data=data;const controller=new SessionController(port);mountApp(document.querySelector<HTMLElement>('#app')!,controller);
 const start=performance.now();while(controller.status!=='ready'||!document.querySelector('.table-scene .seat')){assert(controller.status!=='error'&&!controller.error,controller.error);assert(performance.now()-start<15000,'Render timeout');await pause();}await pause();
 const folded=[...document.querySelectorAll<HTMLElement>('.seat.folded')];
 const rows=folded.map(seat=>{const label=seat.querySelector<HTMLElement>('.seat-label')!,cards=seat.querySelector<HTMLElement>('.seat-cards')!,name=label.querySelector<HTMLElement>('b')!,stack=label.querySelector<HTMLElement>('strong')!;return {seat:seat.dataset.seat,labelOpacity:getComputedStyle(label).opacity,cardsOpacity:getComputedStyle(cards).opacity,nameColor:getComputedStyle(name).color,stackColor:getComputedStyle(stack).color,background:getComputedStyle(label).backgroundColor,marker:seat.querySelector('[aria-label="Small blind"]')?.textContent??null};});
 assert(rows.length>=2,'Folded fixtures missing');assert(rows.every(r=>r.labelOpacity==='1'&&r.cardsOpacity==='1'),'Folded text or badges still dimmed');
 const result={status:'PASS',width:innerWidth,rows,scope:'Actual legal folded-seat fixture; computed text and badge opacity only, not full contrast conformance'};
 document.querySelector('#result')!.textContent=JSON.stringify(result,null,2);controller.close();return result;
}
void execute().catch(error=>{document.querySelector('#result')!.textContent=JSON.stringify({status:'FAIL',error:String(error)})});
