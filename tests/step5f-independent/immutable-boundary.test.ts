import {describe,it,expect} from 'vitest';
import type {AppData,MoneyEvent} from '../../src/session/types';
import {auditSnapshot,freezeSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {isPackedImmutableNode,unpackHandGraph} from '../../src/storage/packed-hand';
import {referenceHash,referenceFinancial,financialInput} from '../step5e-independent/financial-reference';

function independentWallet():AppData{
 const event:Omit<MoneyEvent,'hash'>={id:'independent-initial',index:0,at:'2026-11-01T00:00:00.000Z',epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Independent raw event fixture',previousHash:'0'.repeat(64)};
 return {schemaVersion:4,revision:0,epoch:0,wallet:1000000,initialBankroll:1000000,ledger:[{...event,hash:referenceHash(event)}],sessions:[],hands:[],active:null,importedHands:[]};
}

describe('Step5F independent reduced freeze memoization boundary',()=>{
 it('descends through caller-frozen roots and deeply freezes uncached children',()=>{
  const child={value:{cards:['As','Kd']}},root=Object.freeze({child});freezeSnapshot(root);
  expect(Object.isFrozen(child.value.cards)).toBe(true);expect(()=>child.value.cards.push('Qc')).toThrow();expect(()=>{child.value={cards:[]};}).toThrow();
 });
 it('walks fresh mutable descendants of a shallow copy of a previously completed root',()=>{
  const original=freezeSnapshot({stable:{old:[{value:1}]}}),added={newer:[{value:2}]},copy=Object.freeze({...original,added});freezeSnapshot(copy);
  expect(()=>{added.newer[0].value=3;}).toThrow();expect(()=>added.newer.push({value:4})).toThrow();
 });
 for(const kind of ['visible','nonenumerable','symbol','array-index'] as const)it(`rejects a caller-frozen ${kind} accessor without executing it`,()=>{
  let calls=0;const value:object=kind==='array-index'?[]:{};
  Object.defineProperty(value,kind==='symbol'?Symbol('hidden'):kind==='array-index'?'0':'hidden',{get(){calls++;return {mutable:[]};},enumerable:kind!=='nonenumerable',configurable:true});Object.freeze(value);
  expect(()=>freezeSnapshot(value)).toThrow(/accessors/);expect(calls).toBe(0);
 });
 it('does not brand a partially failed root and checks newly inserted children on retry',()=>{
  let calls=0;const root:{accepted:{a:number};later?:{items:number[]};bad?:unknown}={accepted:{a:1}};
  Object.defineProperty(root,'bad',{get(){calls++;return 1;},configurable:true});expect(()=>freezeSnapshot(root)).toThrow(/accessors/);expect(calls).toBe(0);expect(Object.isFrozen(root)).toBe(false);
  delete root.bad;root.later={items:[1]};freezeSnapshot(root);expect(()=>root.later!.items.push(2)).toThrow();expect(()=>{root.accepted.a=2;}).toThrow();
 });
 it('preserves shared DAG identity and freezes nodes below the cached structural depths',()=>{
  const shared={deep:{items:[{money:1234}]}},root={a:{b:{c:shared}},z:{y:{x:shared}}};expect(freezeSnapshot(root)).toBe(root);expect(root.a.b.c).toBe(root.z.y.x);expect(()=>{shared.deep.items[0].money++;}).toThrow();freezeSnapshot({again:root.a.b.c});expect(Object.isFrozen(shared.deep.items[0])).toBe(true);
 });
 it('fails closed on cyclic untrusted input without granting a financial capability',async()=>{
  const data=independentWallet() as AppData&{cycle?:unknown};data.cycle=data;expect(()=>freezeSnapshot(data)).toThrow();expect(isVerifiedSnapshot(data)).toBe(false);expect(Object.isFrozen(data)).toBe(false);
  delete data.cycle;await auditSnapshot(data);expect(isVerifiedSnapshot(data)).toBe(true);expect(referenceFinancial(financialInput(data)).wallet).toBe(1000000);
 });
 it('requires fresh full financial audit after cloning and caller freezing a verified snapshot',async()=>{
  const original=await auditSnapshot(independentWallet()),copy=structuredClone(original);copy.wallet++;Object.freeze(copy);freezeSnapshot(copy);expect(isVerifiedSnapshot(copy)).toBe(false);
  await expect(auditSnapshot(copy)).rejects.toThrow(/reconcile/);expect(isVerifiedSnapshot(copy)).toBe(false);expect(original.wallet).toBe(1000000);
 });
 it('never treats an independently resealed duplicate money event as an immutable trusted account',async()=>{
  const original=await auditSnapshot(independentWallet()),copy=structuredClone(original),{hash:prior,...body}=copy.ledger[0];
  const repeated={...body,index:1,previousHash:prior};copy.ledger.push({...repeated,hash:referenceHash(repeated)});copy.wallet*=2;freezeSnapshot(copy);
  await expect(auditSnapshot(copy)).rejects.toThrow(/Duplicate financial event/);expect(isVerifiedSnapshot(copy)).toBe(false);
 });
 it('freezes nonenumerable and symbol-valued data descendants too',()=>{
  const symbol=Symbol('data'),child={items:[1]},other={items:[2]},root={[symbol]:child};Object.defineProperty(root,'privateData',{value:other});freezeSnapshot(root);expect(()=>child.items.push(3)).toThrow();expect(()=>other.items.push(3)).toThrow();
 });
});

describe('Step5F independent packed immutable capability boundary',()=>{
 it('constructs recursively frozen nodes from a hand-written backward-reference graph',()=>{
  const graph={format:'ai-texas-hand-graph',version:1,nodes:[['array',['As','Kd']],['object',[['hole',{ref:0}],['same',{ref:0}]]]],root:{ref:1}};
  const decoded=unpackHandGraph(graph) as {hole:string[];same:string[]};expect(isPackedImmutableNode(decoded)).toBe(true);expect(isPackedImmutableNode(decoded.hole)).toBe(true);expect(decoded.hole).toBe(decoded.same);expect(()=>decoded.hole.push('Qc')).toThrow();
  const clone=structuredClone(decoded);Object.freeze(clone);expect(isPackedImmutableNode(clone)).toBe(false);expect(isPackedImmutableNode(clone.hole)).toBe(false);freezeSnapshot(clone);expect(()=>clone.hole.push('Qc')).toThrow();
 });
 for(const ref of [0,1,-1])it(`rejects untrusted missing/forward/cyclic packed reference ${ref}`,()=>{
  const graph={format:'ai-texas-hand-graph',version:1,nodes:[['array',[{ref}]]],root:{ref:0}};expect(()=>unpackHandGraph(graph)).toThrow(/reference/);expect(isPackedImmutableNode(graph)).toBe(false);
 });
 it('rejects frozen executable packed descriptors without invoking them',()=>{
  let calls=0;const graph={format:'ai-texas-hand-graph',version:1,nodes:[],root:null};Object.defineProperty(graph,'root',{get(){calls++;return null;}});Object.freeze(graph);expect(()=>unpackHandGraph(graph)).toThrow();expect(calls).toBe(0);expect(isPackedImmutableNode(graph)).toBe(false);
 });
 it('does not let decoded __proto__ data alter the prototype or financial trust',()=>{
  const graph={format:'ai-texas-hand-graph',version:1,nodes:[['object',[['wallet',1234]]],['object',[['__proto__',{ref:0}]]]],root:{ref:1}};
  const decoded=unpackHandGraph(graph) as object;expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);expect(Object.hasOwn(decoded,'__proto__')).toBe(true);expect(isVerifiedSnapshot(decoded as AppData)).toBe(false);expect(Object.isFrozen(Object.getOwnPropertyDescriptor(decoded,'__proto__')!.value)).toBe(true);
 });
});
