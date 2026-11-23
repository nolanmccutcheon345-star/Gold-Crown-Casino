/** Lossless device-storage encoding, never a new poker/history format. Decoding
 * creates only bounded, backward-referenced, recursively immutable JSON nodes.
 * Both original hash chains and full semantic verification remain mandatory. */
export type PackedValue=null|boolean|number|string|{ref:number};
export type PackedNode=['array',PackedValue[]]|['object',Array<[string,PackedValue]>];
export interface PackedGraph {format:'ai-texas-hand-graph';version:1;nodes:PackedNode[];root:PackedValue}
const immutableNodes=new WeakSet<object>();
export const isPackedImmutableNode=(value:object):boolean=>immutableNodes.has(value);
const MAX_NODES=100000,MAX_EDGES=1000000,MAX_EXPANDED_BYTES=16000000,MAX_DEPTH=128;
function requireGraph(ok:unknown,message='Invalid packed hand graph.'):asserts ok{if(!ok)throw Error(message);}
function own(value:unknown,keys:string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const actual=Reflect.ownKeys(value);return actual.length===keys.length&&actual.every(key=>typeof key==='string'&&keys.includes(key)&&!Object.getOwnPropertyDescriptor(value,key)?.get&&!Object.getOwnPropertyDescriptor(value,key)?.set);
}
function primitive(value:unknown):value is null|boolean|number|string{return value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0);}
function dense(value:unknown,length?:number):asserts value is unknown[] {
 requireGraph(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&(length===undefined||value.length===length)&&value.length<=MAX_EDGES);
 requireGraph(Reflect.ownKeys(value).length===value.length+1,'Packed arrays have extra or missing properties.');
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));requireGraph(d&&!d.get&&!d.set&&d.enumerable,'Packed arrays cannot contain accessors or holes.');}
}
/** Unsupported JavaScript-only values use the unchanged canonical storage path;
 * they are never silently normalized or discarded by this optional encoding. */
export function packHandGraph(value:unknown):PackedGraph {
 const nodes:PackedNode[]=[],intern=new Map<string,number>(),active=new WeakSet<object>();let edges=0;
 function encode(item:unknown,depth:number):PackedValue {
  requireGraph(depth<=MAX_DEPTH,'Packed hand exceeds supported nesting.');
  if(primitive(item))return item;
  requireGraph(item&&typeof item==='object','Packed hand requires lossless JSON values.');
  requireGraph(!active.has(item),'Packed hand contains a cycle.');active.add(item);
  const descriptors=Object.getOwnPropertyDescriptors(item);let node:PackedNode;
  if(Array.isArray(item)){
   requireGraph(Reflect.ownKeys(item).every(k=>k==='length'||typeof k==='string'&&/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<item.length),'Packed array has unsupported properties.');
   requireGraph(item.length<=MAX_EDGES-edges,'Packed hand exceeds the edge limit.');edges+=item.length;
   const values:PackedValue[]=[];for(let i=0;i<item.length;i++){const d=descriptors[String(i)];requireGraph(d&&!d.get&&!d.set,'Packed hand cannot normalize sparse arrays or accessors.');values.push(encode(d.value,depth+1));}node=['array',values];
  }else{
   requireGraph([Object.prototype,null].includes(Object.getPrototypeOf(item)),'Packed hand requires plain objects.');
   const keys=Reflect.ownKeys(item);requireGraph(keys.length<=MAX_EDGES-edges,'Packed hand exceeds the edge limit.');edges+=keys.length;
   const fields:Array<[string,PackedValue]>=[];for(const key of keys){requireGraph(typeof key==='string','Packed hand cannot normalize symbols.');const d=descriptors[key];requireGraph(d&&!d.get&&!d.set&&d.enumerable,'Packed hand cannot normalize accessors or nonenumerable properties.');fields.push([key,encode(d.value,depth+1)]);}node=['object',fields];
  }
  active.delete(item);const key=JSON.stringify(node),prior=intern.get(key);if(prior!==undefined)return {ref:prior};
  requireGraph(nodes.length<MAX_NODES,'Packed hand exceeds the node limit.');const index=nodes.length;nodes.push(node);intern.set(key,index);return {ref:index};
 }
 const root=encode(value,0),graph:PackedGraph={format:'ai-texas-hand-graph',version:1,nodes,root};
 // Exercise the same descriptor/reference/expansion checks at both boundaries.
 // This decoded graph never escapes. Do not fill the long-lived provenance
 // table with temporary nodes that are immediately discarded after validation.
 decodeGraph(graph,false,false);return graph;
}
/** Caller-supplied Object.freeze is not provenance. Only nodes constructed here
 * after complete descriptor/type/reference validation enter the private set. */
export function unpackHandGraph(input:unknown):unknown{return decodeGraph(input,false,true);}
/** JSON.parse creates a fresh unaliased plain graph with no getters, symbols,
 * holes or custom prototypes. Validate every type/reference/expansion bound,
 * avoiding a second descriptor scan that cannot discover any of those values. */
export function unpackHandText(text:unknown):unknown {
 requireGraph(typeof text==='string'&&text.length<=32000000,'Packed hand text exceeds safe limits.');
 return decodeGraph(JSON.parse(text),true,true);
}
function decodeGraph(input:unknown,json:boolean,publish:boolean):unknown {
 const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>json?!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k)):own(v,keys);
 const array:(v:unknown,length?:number)=>asserts v is unknown[]=(v,length)=>{if(json)requireGraph(Array.isArray(v)&&(length===undefined||v.length===length)&&v.length<=MAX_EDGES);else dense(v,length);};
 requireGraph(exact(input,['format','version','nodes','root'])&&input.format==='ai-texas-hand-graph'&&input.version===1);
 const source=input.nodes;array(source);requireGraph(source.length<=MAX_NODES);
 const values:unknown[]=[],sizes:number[]=[],depths:number[]=[];let edges=0;
 function read(value:unknown,index:number):{value:unknown;size:number;depth:number}{
  if(primitive(value)){const size=JSON.stringify(value).length;requireGraph(size<=MAX_EXPANDED_BYTES);return {value,size,depth:0};}
  requireGraph(exact(value,['ref'])&&Number.isSafeInteger(value.ref)&&Number(value.ref)>=0&&Number(value.ref)<index,'Packed hand has a missing, forward or cyclic reference.');
  const ref=Number(value.ref);return {value:values[ref],size:sizes[ref],depth:depths[ref]};
 }
 for(let i=0;i<source.length;i++){
  const descriptor=json?{value:source[i]}:Object.getOwnPropertyDescriptor(source,String(i));requireGraph(descriptor&&!('get' in descriptor&&descriptor.get)&&!('set' in descriptor&&descriptor.set));
  const n=descriptor.value;array(n,2);requireGraph(n[0]==='array'||n[0]==='object');array(n[1]);
  requireGraph(n[1].length<=MAX_EDGES-edges);edges+=n[1].length;let size=2,depth=1;const result:unknown[]=[],fields:Array<[string,unknown]>=[];const seen=new Set<string>();
  for(let j=0;j<n[1].length;j++){
   const descriptor=json?{value:n[1][j]}:Object.getOwnPropertyDescriptor(n[1],String(j));requireGraph(descriptor&&!('get' in descriptor&&descriptor.get)&&!('set' in descriptor&&descriptor.set));const raw=descriptor.value;
   let parsed:{value:unknown;size:number;depth:number};
   if(n[0]==='array'){parsed=read(raw,i);(result as unknown[]).push(parsed.value);}
   else{
    array(raw,2);requireGraph(typeof raw[0]==='string'&&!seen.has(raw[0]),'Packed object has duplicate or invalid keys.');seen.add(raw[0]);parsed=read(raw[1],i);size+=JSON.stringify(raw[0]).length+1;
    fields.push([raw[0],parsed.value]);
   }
   size+=parsed.size+(j?1:0);depth=Math.max(depth,parsed.depth+1);requireGraph(size<=MAX_EXPANDED_BYTES&&depth<=MAX_DEPTH,'Packed hand expands beyond safe limits.');
  }
  const decoded=n[0]==='array'?result:Object.fromEntries(fields);Object.freeze(decoded);if(publish)immutableNodes.add(decoded);values.push(decoded);sizes.push(size);depths.push(depth);
 }
 return read(input.root,source.length).value;
}
