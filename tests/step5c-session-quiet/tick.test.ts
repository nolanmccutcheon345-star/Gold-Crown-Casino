import {expect,it} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';

class DelayedPort implements PersistencePort {
 data:AppData|null=null;gate:Promise<void>|null=null;entered:(()=>void)|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){
  expect(this.data?.revision??null).toBe(expected);this.entered?.();await this.gate;this.data=structuredClone(data);
 }
 close(){}
}
it('quiet elapsed-time persistence publishes ready completion to unlock a view rendered during its write',async()=>{
 const port=new DelayedPort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});
 expect(c.error).toBe('');const prior=c.data!,game=structuredClone(prior.active!.game),ledger=structuredClone(prior.ledger);
 let release!:()=>void;port.gate=new Promise(resolve=>{release=resolve;});const entered=new Promise<void>(resolve=>{port.entered=resolve;});
 const observed:{busy:boolean;revision:number}[]=[];c.subscribe(()=>observed.push({busy:c.busy,revision:c.data!.revision}));
 const pending=c.tick();await entered;
 // The view can render in response to navigation/preview while the write is held.
 expect(c.busy).toBe(true);let disabled=c.busy;c.subscribe(()=>{disabled=c.busy;});
 release();await pending;expect(c.busy).toBe(false);expect(disabled).toBe(false);
 expect(observed.at(-1)).toEqual({busy:false,revision:prior.revision+1});
 expect(c.data!.active!.game).toEqual(game);expect(c.data!.ledger).toEqual(ledger);expect(c.data!.wallet).toBe(prior.wallet);c.close();
});
