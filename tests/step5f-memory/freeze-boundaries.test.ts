import {describe,it,expect,vi} from 'vitest';
import {freezeSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import type {AppData} from '../../src/session/types';

describe('Step5F graph-freezing provenance and structural sharing',()=>{
 it('independently freezes every descendant while retaining canonical bytes and aliases',()=>{
  const shared={cards:['As','Kd'],amount:200},root={hands:[{view:{players:[shared,shared]}}],ledger:[{walletDelta:-200}]};
  const before=JSON.stringify(root);freezeSnapshot(root);expect(JSON.stringify(root)).toBe(before);expect(root.hands[0].view.players[0]).toBe(root.hands[0].view.players[1]);
  const seen=new Set<object>();function audit(value:unknown){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);expect(Object.isFrozen(value)).toBe(true);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key)!;expect(d.get).toBeUndefined();expect(d.set).toBeUndefined();if('value'in d)audit(d.value);}}audit(root);
 });
 it.each([0,1,2,3,9])('rejects an untrusted pre-frozen accessor at depth%s without executing it',depth=>{
  let invoked=0;const leaf={};Object.defineProperty(leaf,Symbol('hidden'),{get(){invoked++;return 1;}});Object.freeze(leaf);let value:object=leaf;for(let i=0;i<depth;i++)value=Object.freeze({next:value});expect(()=>freezeSnapshot(value)).toThrow(/accessors/);expect(invoked).toBe(0);
 });
 it('does not promote a failed partial graph to trusted provenance',()=>{
  const inner={safe:{n:1}},bad={};Object.defineProperty(bad,'trap',{get(){throw Error('must not execute');}});const root={inner,bad};expect(()=>freezeSnapshot(root)).toThrow(/accessors/);expect(Object.isFrozen(root)).toBe(false);
  Object.defineProperty(root,'newTrap',{get(){throw Error('must not execute');}});expect(()=>freezeSnapshot(root)).toThrow(/accessors/);
 });
 it('keeps an old immutable prefix while independently freezing an appended record',()=>{
  const prior=freezeSnapshot({hands:[{view:{cards:['2s','3d']}}],ledger:[{amount:2}]});
  const next={hands:[...prior.hands,{view:{cards:['4s','5d']}}],ledger:prior.ledger};freezeSnapshot(next);expect(next.hands[0]).toBe(prior.hands[0]);expect(next.ledger).toBe(prior.ledger);expect(Object.isFrozen(next.hands[1].view.cards)).toBe(true);expect(()=>next.hands[1].view.cards.push('6h')).toThrow();
 });
 it('retains non-enumerable and symbol values in the independent freeze check',()=>{
  const hidden={value:{n:7}},symbol=Symbol('metadata'),root:{[key:symbol]:object}={};Object.defineProperty(root,'secret',{value:hidden,enumerable:false});root[symbol]={n:8};freezeSnapshot(root);expect(Object.isFrozen(hidden.value)).toBe(true);expect(Object.isFrozen(root[symbol])).toBe(true);
 });
 it('does not revisit the old canonical prefix for an ordinary appended-record snapshot',()=>{
  const old=freezeSnapshot({hands:Array.from({length:1000},(_,i)=>({view:{cards:[String(i)]}})),ledger:[]}),next={...old,hands:[...old.hands,{view:{cards:['new']}}]};
  const spy=vi.spyOn(Reflect,'ownKeys');try{freezeSnapshot(next);expect(spy.mock.calls.length).toBeLessThanOrEqual(6);}finally{spy.mockRestore();}
 });
 it('keeps a multiply shared deep DAG walk linear without retaining every node globally',()=>{
  let value:object={amount:2};for(let i=0;i<22;i++)value={left:value,right:value};
  const spy=vi.spyOn(Reflect,'ownKeys');try{freezeSnapshot(value);expect(spy.mock.calls.length).toBe(23);}finally{spy.mockRestore();}
 });
 it('immutability alone never grants financial verification',()=>{
  const fake=freezeSnapshot({schemaVersion:4,wallet:999999,ledger:[],hands:[]});expect(isVerifiedSnapshot(fake as unknown as AppData)).toBe(false);
 });
});
