import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {TournamentController} from '../../src/tournament/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
class MemoryPort implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_expected:number|null,data:AppData){this.data=structuredClone(data);}close(){}}
const id=new URLSearchParams(location.search).get('id')??'manual';
const tournament=new TournamentController('tournament34-fixture:'+id);
mountApp(document.querySelector<HTMLElement>('#app')!,new SessionController(new MemoryPort()),tournament);

const diagnostics=document.querySelector('#diagnostics')!,exportButton=document.querySelector<HTMLButtonElement>('#export-fixture')!,fixture=document.querySelector<HTMLTextAreaElement>('#fixture')!;
setInterval(()=>{diagnostics.textContent=JSON.stringify({status:tournament.status,busy:tournament.busy,error:tournament.error,revision:tournament.data?.revision,hand:tournament.data?.active?.handNumber,pending:tournament.data?.active?.pending,actor:tournament.data?.active?.game.actor});},500);
exportButton.onclick=()=>{fixture.value=JSON.stringify(tournament.data);};
