import {beforeAll,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {prepareCompactSnapshot,verifyTransition,draftSnapshot,isVerifiedSnapshot,getArchiveContext} from '../../src/storage/verified';
import {referenceFinancial,financialInput} from '../step5e-independent/financial-reference';
class Memory implements PersistencePort {
 constructor(public data:AppData|null=null){}
 async load(){return this.data;}
 async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=next;}
 close(){}
}
let full:AppData;
beforeAll(async()=>{
 const c=new SessionController(new Memory());await c.init();
 try{for(let i=0;i<124;i++){await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;expect(g.actor).toBe(0);await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');}full=c.data!;}finally{c.close();}
},30000);
describe('compact private checkpoint financial metadata regression',()=>{
 it('promotes full audited history without altering independent accounting or canonical tail',async()=>{
  const original=JSON.stringify(full),small=await prepareCompactSnapshot(full);
  expect(small.data.hands).toHaveLength(120);expect(small.context.handOffset).toBe(4);expect(isVerifiedSnapshot(small.data)).toBe(true);
  expect(referenceFinancial({...small.data,handIndex:small.context.handIndex})).toEqual(referenceFinancial(financialInput(full)));
  expect(small.data.hands).toEqual(full.hands.slice(-120));expect(JSON.stringify(full)).toBe(original);
 });
 it('appends a real engine settlement once then cashes out against compact prior history',async()=>{
  const small=await prepareCompactSnapshot(full),port=new Memory(small.data),c=new SessionController(port);await c.init();
  try{const before=referenceFinancial({...small.data,handIndex:small.context.handIndex});await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);const settled=c.data!;await c.act({type:'fold'},g.handId,g.revision);expect(c.data).toBe(settled);await c.cashOut();expect(c.error).toBe('');
   const next=await prepareCompactSnapshot(c.data!),result=referenceFinancial({...next.data,handIndex:next.context.handIndex});
   expect(result.hands).toBe(before.hands+1);expect(result.table).toBe(0);expect(result.poker-before.poker).toBe(-DEFAULT_SETTINGS.smallBlind);expect(result.wallet-before.wallet).toBe(-DEFAULT_SETTINGS.smallBlind);
   expect(next.data.ledger.filter(e=>e.kind==='hand-net'&&e.handId===g.handId)).toHaveLength(1);expect(next.context.handIndex.slice(0,124)).toEqual(small.context.handIndex);
  }finally{c.close();}
 });
 it('does not let the smaller private index grant trust or accept corrupted transition balances',async()=>{
  const small=await prepareCompactSnapshot(full),copy=structuredClone(small.data);expect(isVerifiedSnapshot(copy)).toBe(false);await expect(prepareCompactSnapshot(copy)).rejects.toThrow(/verified/);
  const draft=draftSnapshot(small.data);draft.revision++;draft.wallet++;await expect(verifyTransition(small.data,draft)).rejects.toThrow(/Wallet/);expect(isVerifiedSnapshot(draft)).toBe(false);expect(getArchiveContext(small.data)?.handIndex).toHaveLength(124);
 });
});
