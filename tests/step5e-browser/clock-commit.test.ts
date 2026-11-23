import {expect,it} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
class HeldPort implements PersistencePort {
 data:AppData|null=null;gate:Promise<void>|null=null;entered:(()=>void)|null=null;fail=false;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.entered?.();await this.gate;if(this.fail)throw Error('Injected write failure');this.data=structuredClone(next);}
 close(){}
}
async function fixture(){const port=new HeldPort(),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});return{port,controller};}
async function hold(port:HeldPort,controller:SessionController){let release!:()=>void;port.gate=new Promise(resolve=>release=resolve);const entered=new Promise<void>(resolve=>port.entered=resolve);const saving=controller.tick();await entered;return{saving,release:()=>{release();port.gate=null;port.entered=null;}};}
it('publishes the clock-save lock before any await, then restores ready without changing poker or money',async()=>{
 const {port,controller:c}=await fixture();try{const before=structuredClone(c.data!),seen:boolean[]=[];c.subscribe(()=>seen.push(c.busy));const held=await hold(port,c);
 expect(seen).toEqual([true]);expect(c.busy).toBe(true);expect(c.data).toEqual(before);held.release();await held.saving;
 expect(seen).toEqual([true,false]);expect(c.data!.active!.game).toEqual(before.active!.game);expect(c.data!.ledger).toEqual(before.ledger);expect(c.data!.wallet).toBe(before.wallet);expect(c.data!.revision).toBe(before.revision+1);
 }finally{c.close();}
});
it('keeps duplicate new-hand requests locked during a clock save and deals once after readiness',async()=>{
 const {port,controller:c}=await fixture();try{const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);const before=structuredClone(c.data!),published:boolean[]=[];c.subscribe(()=>published.push(c.busy));const held=await hold(port,c);
 expect(published[0]).toBe(true);await Promise.all([c.nextHand(),c.nextHand()]);expect(c.data!.active!.game.handId).toBe(before.active!.game.handId);expect(c.data!.hands).toEqual(before.hands);
 held.release();await held.saving;await Promise.all([c.nextHand(),c.nextHand()]);expect(c.error).toBe('');expect(c.data!.active!.game.handId).not.toBe(before.active!.game.handId);expect(c.data!.active!.number).toBe(2);expect(c.data!.hands).toEqual(before.hands);expect(c.data!.ledger).toEqual(before.ledger);
 }finally{c.close();}
});
it('publishes a failed clock write as non-ready and preserves its last committed hand and payout',async()=>{
 const {port,controller:c}=await fixture();try{const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);const before=structuredClone(c.data!),seen:{busy:boolean;status:string}[]=[];c.subscribe(()=>seen.push({busy:c.busy,status:c.status}));const held=await hold(port,c);port.fail=true;held.release();await held.saving;
 expect(seen).toEqual([{busy:true,status:'ready'},{busy:false,status:'error'}]);await c.nextHand();expect(c.data).toEqual(before);expect(port.data).toEqual(before);expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);
 }finally{c.close();}
});
