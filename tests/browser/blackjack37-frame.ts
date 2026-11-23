import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {BlackjackController} from '../../src/blackjack/controller';
class MemoryPort implements PersistencePort {data:AppData|null=null;async load(){return structuredClone(this.data)}async commit(_expected:number|null,data:AppData){this.data=structuredClone(data)}close(){}}
const id=new URLSearchParams(location.search).get('id')??'manual';
const blackjack=new BlackjackController('poker-night-ai-blackjack-test:browser37-'+id);
blackjack.subscribe(()=>{document.querySelector('#test-state')!.textContent=JSON.stringify({status:blackjack.status,busy:blackjack.busy,revision:blackjack.data?.revision,balance:blackjack.data?.balance,publicState:blackjack.publicState,session:blackjack.session,seen:blackjack.seen,error:blackjack.error});});
mountApp(document.querySelector<HTMLElement>('#app')!,new SessionController(new MemoryPort()),new TournamentController(new MemoryTournamentPersistence()),blackjack);
