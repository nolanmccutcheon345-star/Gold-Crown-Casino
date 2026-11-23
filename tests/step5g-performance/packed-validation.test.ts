import {describe,it,expect} from 'vitest';
import {packHandGraph,unpackHandGraph,unpackHandText,isPackedImmutableNode,type PackedGraph} from '../../src/storage/packed-hand';

function everyNode(value:unknown,visit:(node:object)=>void,seen=new Set<object>()):void {
 if(!value||typeof value!=='object'||seen.has(value))return;
 seen.add(value);visit(value);
 for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key)!;if('value'in descriptor)everyNode(descriptor.value,visit,seen);}
}

describe('packed write validation does not grant escaped trust',()=>{
 it('leaves the caller and returned encoding unbranded, with every public decoded descendant privately immutable',()=>{
  const input={frames:[{public:{board:['As','Kd'],pot:400}},{public:{board:['As','Kd'],pot:400}}],net:-200};
  const before=JSON.stringify(input),graph=packHandGraph(input);
  expect(JSON.stringify(input)).toBe(before);
  everyNode(input,node=>expect(isPackedImmutableNode(node)).toBe(false));
  everyNode(graph,node=>expect(isPackedImmutableNode(node)).toBe(false));
  for(const result of [unpackHandGraph(graph),unpackHandText(JSON.stringify(graph))]){
   expect(JSON.stringify(result)).toBe(before);
   everyNode(result,node=>{expect(Object.isFrozen(node)).toBe(true);expect(isPackedImmutableNode(node)).toBe(true);});
  }
 });
 it('still applies the decoder expansion bound during packing, including a primitive root',()=>{
  const oversized='x'.repeat(16_000_001);
  expect(()=>packHandGraph(oversized)).toThrow(/Invalid packed/);
  expect(()=>packHandGraph({field:oversized})).toThrow(/Invalid packed/);
 });
 it('validates an independently authored shared-node graph without trusting its frozen input',()=>{
  const graph:PackedGraph={format:'ai-texas-hand-graph',version:1,nodes:[['object',[['amount',123]]],['array',[{ref:0},{ref:0}]]],root:{ref:1}};
  Object.freeze(graph);expect(isPackedImmutableNode(graph)).toBe(false);
  const decoded=unpackHandGraph(graph) as Array<{amount:number}>;
  expect(decoded[0]).toBe(decoded[1]);expect(decoded).toEqual([{amount:123},{amount:123}]);
  everyNode(decoded,node=>{expect(Object.isFrozen(node)).toBe(true);expect(isPackedImmutableNode(node)).toBe(true);});
 });
});
