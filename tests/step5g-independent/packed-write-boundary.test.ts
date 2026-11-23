import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {packHandGraph,unpackHandGraph,unpackHandText,type PackedGraph} from '../../src/storage/packed-hand';

const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('independent aggregate expansion limits after discarded-decode optimization',()=>{
 it('rejects individually legal nodes whose shared expansion exceeds the write/read bound',()=>{
  // Every string and graph node is individually below16MB. Four repeated
  // strings exceed the expanded limit only after the root is reconstructed.
  const leaf='x'.repeat(4_000_000),input=[leaf,leaf,leaf,leaf];
  const graph:PackedGraph={format:'ai-texas-hand-graph',version:1,nodes:[['array',input]],root:{ref:0}};
  expect(()=>packHandGraph(input)).toThrow(/expands beyond safe limits/);
  expect(()=>unpackHandGraph(graph)).toThrow(/expands beyond safe limits/);
  expect(()=>unpackHandText(JSON.stringify(graph))).toThrow(/expands beyond safe limits/);
  expect(input).toHaveLength(4);expect(input.every(item=>item===leaf)).toBe(true);
 });
 it('preserves the independent canonical hash for an allowed shared expansion below the bound',()=>{
  const leaf='♥🎴'.repeat(500_000),input={first:[leaf,leaf],second:[leaf,leaf]};
  const before=sha(input),graph=packHandGraph(input);
  for(const restored of [unpackHandGraph(graph),unpackHandText(JSON.stringify(graph))]){
   expect(sha(restored)).toBe(before);
   expect((restored as typeof input).first).toBe((restored as typeof input).second);
  }
  expect(sha(input)).toBe(before);
 });
});
