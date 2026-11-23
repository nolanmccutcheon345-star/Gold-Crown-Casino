import {mountApp} from '../../src/ui/app';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {applyCommand,legalActions,projectView} from '../../src/core/engine';
import {appendMoney,GENESIS,seal,validateData} from '../../src/storage/integrity';
import {makeCashHandProvenance} from '../../src/session/hand-provenance';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';
class MemoryPort implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_expected:number|null,d:AppData){this.data=structuredClone(d);}close(){}}
const params=new URLSearchParams(location.search);const count=Number(params.get('seats'));if(!Number.isInteger(count)||count<2||count>10)throw Error('Unsupported fixture');
const port=new MemoryPort();const seed=new SessionController(port);await seed.init();await seed.startSession({...DEFAULT_SETTINGS,seats:count,buyIn:20000});const data=structuredClone(seed.data!);seed.close();const a=data.active!;
for(let i=0;i<200&&a.game.street!=='complete';i++){
 if(params.get('phase')==='preflop'&&a.game.street==='preflop'&&a.game.actor===0)break;
 if(params.get('phase')!=='complete'&&a.game.street==='river'&&a.game.actor===0)break;
 const game=a.game;a.game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`layout:${game.handId}:${game.revision}`,action:legalActions(game).check?{type:'check'}:{type:'call'}});a.frames.push(projectView(a.game,0));
}
if(a.game.street==='complete'){
 const view=projectView(a.game,0),hero=view.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack;
 const record=await seal<StoredHand>({id:a.game.handId,sessionId:a.sessionId,epoch:0,number:1,startedAt:a.startedAt,endedAt:new Date().toISOString(),view,frames:a.frames,net,provenance:makeCashHandProvenance(view.profile),...(a.configuration?{configuration:structuredClone(a.configuration)}:{}),privateProfiles:a.profiles,previousHash:GENESIS,hash:''});data.hands.push(record);data.sessions[0].handIds.push(record.id);await appendMoney(data,{id:`settle:${record.id}`,kind:'hand-net',at:record.endedAt,epoch:0,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:a.sessionId,handId:record.id,note:'Synthetic legal-hand layout fixture'});
}
await validateData(data);port.data=data;mountApp(document.querySelector('#app')!,new SessionController(port));
