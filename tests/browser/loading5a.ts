import {SessionController} from '../../src/session/controller';
import {mountApp} from '../../src/ui/app';
import type {AppData,PersistencePort} from '../../src/session/types';
class Port implements PersistencePort{
 data:AppData|null=null;delay=false;release:((d:AppData|null)=>void)|null=null;reject:((e:Error)=>void)|null=null;
 async load():Promise<AppData|null>{if(!this.delay)return structuredClone(this.data);return new Promise((resolve,reject)=>{this.release=resolve;this.reject=reject;});}
 async commit(_expected:number|null,data:AppData){this.data=structuredClone(data);}close(){}
}
const port=new Port(),seed=new SessionController(port);await seed.init();await seed.adjustBankroll(123456,'Isolated restore fixture');seed.close();port.delay=true;
const c=new SessionController(port);c.subscribe(()=>{document.querySelector('#proof')!.textContent=JSON.stringify({status:c.status,wallet:c.data?.wallet??null,revision:c.data?.revision??null,ledger:c.data?.ledger.length??null});});
document.querySelector('#resolve')!.addEventListener('click',()=>{port.delay=false;port.release?.(structuredClone(port.data));});
document.querySelector('#reject')!.addEventListener('click',()=>{port.delay=false;port.reject?.(new Error('TEST: unavailable storage read'));});
mountApp(document.querySelector('#app')!,c);
