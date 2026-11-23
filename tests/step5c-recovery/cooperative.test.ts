import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {auditSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {canonical,migrateData,seal} from '../../src/storage/integrity';
import {recoveryScheduler} from '../../src/storage/recovery-scheduler';
import {observeTimings} from '../../src/performance/timing';
import type {AppData} from '../../src/session/types';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
afterEach(()=>{observeTimings(null);vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function browserScheduling(){
 vi.useFakeTimers();let tick=0;vi.spyOn(performance,'now').mockImplementation(()=>tick+=9);vi.stubGlobal('window',{});vi.stubGlobal('document',{});const prioritized=vi.fn(async()=>{});vi.stubGlobal('scheduler',{yield:prioritized});vi.stubGlobal('MessageChannel',undefined);vi.stubGlobal('crypto',{getRandomValues:globalThis.crypto.getRandomValues.bind(globalThis.crypto)});return prioritized;
}
describe('Step5C fair cold-audit scheduling retains every integrity check',()=>{
 it('yields to ordinary tasks instead of starving them with priority continuations',async()=>{
  const prioritized=browserScheduling(),yieldRecovery=recoveryScheduler(),order:string[]=[];setTimeout(()=>order.push('ordinary heartbeat'),0);
  const pending=yieldRecovery();expect(pending).toBeInstanceOf(Promise);expect(order).toEqual([]);await vi.runAllTimersAsync();await pending;order.push('verification continuation');expect(order).toEqual(['ordinary heartbeat','verification continuation']);expect(prioritized).not.toHaveBeenCalled();
 });
 it('keeps the checkpoint untrusted while yielding, then preserves every canonical byte and financial result',async()=>{
  const data=await migrateData(fixture.streets.flop),before=canonical(data),events=data.ledger.length,hands=data.hands.length,wallet=data.wallet,net=data.ledger.reduce((n,e)=>n+e.pokerNet,0),names:string[]=[];browserScheduling();observeTimings(s=>names.push(s.name));
  let observedUnverified=false;setTimeout(()=>{observedUnverified=!isVerifiedSnapshot(data);},0);const work=auditSnapshot(data);expect(isVerifiedSnapshot(data)).toBe(false);await vi.runAllTimersAsync();expect(await work).toBe(data);expect(observedUnverified).toBe(true);expect(isVerifiedSnapshot(data)).toBe(true);expect(canonical(data)).toBe(before);expect(data.wallet).toBe(wallet);expect(data.ledger).toHaveLength(events);expect(data.hands).toHaveLength(hands);expect(data.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(net);
  expect(names).toEqual(expect.arrayContaining(['recovery.ledgerChain','recovery.handChain','recovery.financialSemantics','recovery.handSemantics','recovery.configurationSemantics']));
 });
 it.each(['wallet','hand-result','duplicate-settlement'])('still rejects %s corruption after ordinary-task yields',async kind=>{
  const data=await migrateData(fixture.streets.flop);
  if(kind==='wallet')data.wallet++;
  else if(kind==='hand-result'){
   data.hands[0]={...data.hands[0],net:data.hands[0].net+1};let previous='0'.repeat(64);for(let i=0;i<data.hands.length;i++){data.hands[i]=await seal({...data.hands[i],previousHash:previous});previous=data.hands[i].hash;}
  }else{
   const settlement=data.ledger.find(e=>e.kind==='hand-net')!;data.ledger.push(await seal({...settlement,id:'independently-resealed-duplicate',index:data.ledger.length,previousHash:data.ledger.at(-1)!.hash}));
  }
  browserScheduling();const rejection=auditSnapshot(data).then(()=>null,e=>e as Error);await vi.runAllTimersAsync();expect(await rejection).toBeInstanceOf(Error);expect(isVerifiedSnapshot(data)).toBe(false);
 });
});
