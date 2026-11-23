import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {packHandGraph,unpackHandGraph,unpackHandText,isPackedImmutableNode,type PackedGraph} from '../../src/storage/packed-hand';
import {canonical,digest,migrateData} from '../../src/storage/integrity';
import {freezeSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import type {AppData} from '../../src/session/types';
import {encode,hash} from './reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';

const plain=()=>({format:'ai-texas-hand-graph',version:1,nodes:[['object',[['key','value']]]],root:{ref:0}}) as PackedGraph;
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};

describe('Step5D independent packed canonical byte compatibility',()=>{
 it.each([null,false,true,0,Number.MAX_SAFE_INTEGER,42.125,'','🎴 ♥ \u0000 \ud800\udfff'])('preserves canonical primitive %j exactly',async value=>{
  const decoded=unpackHandGraph(JSON.parse(JSON.stringify(packHandGraph(value))));
  expect(unpackHandText(JSON.stringify(packHandGraph(value)))).toBe(value);expect(decoded).toBe(value);expect(canonical(decoded)).toBe(encode(value));expect(await digest(decoded)).toBe(hash(value));
 });
 it('preserves hostile property names as inert own fields without prototype pollution',async()=>{
  const value=JSON.parse('{"__proto__":{"pokerPolluted":true},"constructor":{"prototype":{"wallet":999}},"prototype":[0],"2":"two","10":"ten"}');
  const decoded=unpackHandGraph(JSON.parse(JSON.stringify(packHandGraph(value)))) as Record<string,unknown>;
  expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);expect(Object.hasOwn(decoded,'__proto__')).toBe(true);
  expect(({} as {pokerPolluted?:boolean}).pokerPolluted).toBeUndefined();expect(encode(decoded)).toBe(encode(value));expect(await digest(decoded)).toBe(hash(value));
 });
 it('shares repeated immutable nodes but does not confer financial snapshot trust',()=>{
  const input={one:{events:[{id:'public-action',amount:200}]},two:{events:[{id:'public-action',amount:200}]}};
  const decoded=unpackHandGraph(packHandGraph(input)) as typeof input;
  expect(decoded.one).toBe(decoded.two);expect(decoded.one.events[0]).toBe(decoded.two.events[0]);expect(Object.isFrozen(decoded.one.events[0])).toBe(true);
  expect(isPackedImmutableNode(decoded)).toBe(true);expect(isPackedImmutableNode(structuredClone(decoded))).toBe(false);expect(isPackedImmutableNode(Object.freeze(input))).toBe(false);
  expect(isVerifiedSnapshot(decoded as unknown as AppData)).toBe(false);expect(()=>{decoded.one.events[0].amount++;}).toThrow();
 });
 it.each(['preflop','flop','turn','river'])('roundtrips every %s stored record with independent original SHA and accounting',async street=>{
  const original=await migrateData(fixture.streets[street]),prepared=await prepareSegments(original,null,null);
  const records=new Map<string,unknown>();
  for(const item of prepared.writes){
   const decoded=unpackHandGraph(JSON.parse(JSON.stringify(packHandGraph(item.entry))));
   expect(encode(decoded)).toBe(encode(item.entry));expect(canonical(decoded)).toBe(encode(item.entry));expect(await digest(decoded)).toBe(hash(item.entry));
   records.set(item.key,decoded);
  }
  const restored=await restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(key=>records.get(key)));
  expect(encode(restored)).toBe(encode(original));expect(replayAccounting(restored)).toEqual(replayAccounting(original));
 });
 it('does not normalize a mutable plain object merely because it was caller-frozen',()=>{
  let reads=0;const x={};Object.defineProperty(x,'unexpected',{enumerable:true,get(){reads++;return 42;}});Object.freeze(x);
  expect(isPackedImmutableNode(x)).toBe(false);expect(()=>freezeSnapshot(x)).toThrow(/accessor/);expect(reads).toBe(0);
 });
});

describe('Step5D independent packed input rejection',()=>{
 it.each(['undefined','NaN','Infinity','negative-zero','bigint','function','symbol','date','typed-array','sparse','cycle','nonenumerable','symbol-key'] as const)('rejects unsupported %s rather than silently changing canonical data',async kind=>{
  let input:unknown;
  if(kind==='undefined')input={x:undefined};if(kind==='NaN')input=NaN;if(kind==='Infinity')input=Infinity;if(kind==='negative-zero')input=-0;
  if(kind==='bigint')input=1n;if(kind==='function')input=()=>1;if(kind==='symbol')input=Symbol('private');if(kind==='date')input=new Date(0);if(kind==='typed-array')input=new Uint8Array([1]);
  if(kind==='sparse')input=Array(1);if(kind==='cycle'){const o:{self?:unknown}={};o.self=o;input=o;}
  if(kind==='nonenumerable'){input={};Object.defineProperty(input,'hidden',{value:1});}
  if(kind==='symbol-key')input={[Symbol('private')]:1};
  expect(()=>packHandGraph(input)).toThrow();
 });
 it.each(['forward-ref','self-ref','negative-ref','fractional-ref','string-ref','duplicate-key','future-version','extra-root','extra-ref','unknown-node'] as const)('rejects malformed graph %s',kind=>{
  const graph=plain() as unknown as {format:string;version:number;nodes:unknown[];root:unknown;extra?:boolean};
  if(kind==='forward-ref')graph.nodes=[['array',[{ref:1}]],['object',[]]];
  if(kind==='self-ref')graph.nodes=[['array',[{ref:0}]]];
  if(kind==='negative-ref')graph.root={ref:-1};if(kind==='fractional-ref')graph.root={ref:0.5};if(kind==='string-ref')graph.root={ref:'0'};
  if(kind==='duplicate-key')graph.nodes=[['object',[['x',1],['x',2]]]];
  if(kind==='future-version')graph.version=2;if(kind==='extra-root')graph.extra=true;if(kind==='extra-ref')graph.root={ref:0,secret:'unexpected'};if(kind==='unknown-node')graph.nodes=[['unknown',[]]];
  expect(()=>unpackHandGraph(graph)).toThrow();expect(()=>unpackHandText(JSON.stringify(graph))).toThrow();
 });
 it.each(['root','source-index','node-tag','node-items','field-index','field-name','field-value','reference'] as const)('rejects %s accessor without invoking it',location=>{
  const graph=plain();let reads=0,target:object=graph,key='root';const getter=()=>{reads++;return location==='node-tag'?'object':location==='field-name'?'key':location==='reference'?0:'value';};
  if(location==='source-index'){target=graph.nodes;key='0';}
  if(location==='node-tag'){target=graph.nodes[0];key='0';}
  if(location==='node-items'){target=graph.nodes[0];key='1';}
  if(location==='field-index'){target=graph.nodes[0][1];key='0';}
  if(location==='field-name'){target=(graph.nodes[0][1] as unknown[][])[0];key='0';}
  if(location==='field-value'){target=(graph.nodes[0][1] as unknown[][])[0];key='1';}
  if(location==='reference'){target=graph.root as object;key='ref';}
  Object.defineProperty(target,key,{get:getter,enumerable:true,configurable:true});
  expect(()=>unpackHandGraph(graph)).toThrow();expect(reads).toBe(0);
 });
 it('rejects an exponential backward-reference expansion before canonical allocation',()=>{
  const nodes:PackedGraph['nodes']=[['array',['x']]];
  for(let i=1;i<30;i++)nodes.push(['array',[{ref:i-1},{ref:i-1}]]);
  expect(()=>unpackHandGraph({...plain(),nodes,root:{ref:29}})).toThrow(/expand|limit/);expect(()=>unpackHandText(JSON.stringify({...plain(),nodes,root:{ref:29}}))).toThrow(/expand|limit/);
 });
 it('rejects excessive depth in a linear reference graph',()=>{
  const nodes:PackedGraph['nodes']=[['array',[]]];for(let i=1;i<140;i++)nodes.push(['array',[{ref:i-1}]]);
  expect(()=>unpackHandGraph({...plain(),nodes,root:{ref:139}})).toThrow(/expand|nest|limit/);expect(()=>unpackHandText(JSON.stringify({...plain(),nodes,root:{ref:139}}))).toThrow(/expand|nest|limit/);
 });
 it('rejects excessive node count before visiting the supplied nodes',()=>{
  let reads=0;const nodes=Array(100001);Object.defineProperty(nodes,'0',{get(){reads++;throw Error('Must not visit excess input');}});
  expect(()=>unpackHandGraph({...plain(),nodes,root:{ref:0}})).toThrow();expect(reads).toBe(0);
 });
});

describe('Step5D independent parsed-text trust boundary',()=>{
 it.each(['{','null','[]','true','{"format":"ai-texas-hand-graph","version":1,"nodes":[],"root":1e309}','{"format":"ai-texas-hand-graph","version":1,"nodes":[],"root":-0}'])('rejects malformed/nonfinite packed text %s',text=>{expect(()=>unpackHandText(text)).toThrow();});
 it('requires a primitive string and never invokes an external coercion hook',()=>{
  let invoked=0;const external={toString(){invoked++;return JSON.stringify(plain());}};
  expect(()=>unpackHandText(external)).toThrow();expect(invoked).toBe(0);
 });
 it('enforces text length before parsing and leaves no partial trusted object',()=>{expect(()=>unpackHandText(' '.repeat(32000001))).toThrow(/limit/);});
 it('preserves hostile names and canonical SHA through the native parsed-text path',async()=>{
  const original=JSON.parse('{"__proto__":{"pollutedByText":true},"constructor":{},"x":["🎴",0,null]}');
  const restored=unpackHandText(JSON.stringify(packHandGraph(original))) as Record<string,unknown>;
  expect(Object.hasOwn(restored,'__proto__')).toBe(true);expect(({} as {pollutedByText?:boolean}).pollutedByText).toBeUndefined();expect(encode(restored)).toBe(encode(original));expect(await digest(restored)).toBe(hash(original));expect(Object.isFrozen(restored.x)).toBe(true);
 });
});
