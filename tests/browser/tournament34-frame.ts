import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {TournamentController} from '../../src/tournament/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
class MemoryPort implements PersistencePort{data:AppData|null=null;async load(){return structuredClone(this.data);}async commit(_expected:number|null,data:AppData){this.data=structuredClone(data);}close(){}}
const id=new URLSearchParams(location.search).get('id')??'manual';
const tournament=new TournamentController('tournament34-fixture:'+id);
mountApp(document.querySelector<HTMLElement>('#app')!,new SessionController(new MemoryPort()),tournament);
