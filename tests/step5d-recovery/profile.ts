import {createReadStream,writeFileSync,mkdirSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {PerformanceObserver} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController} from '../../src/session/controller';
import {restoreSegments,SEGMENTS,segmentKey,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';
import {packHandGraph} from '../../src/storage/packed-hand';
import {packedHandKey} from '../../src/storage/segments';
import {digest,GENESIS} from '../../src/storage/integrity';
import {observeTimings} from '../../src/performance/timing';
const size=Number(process.argv[2]??10000),label=process.argv[3]??'baseline',repeats=Number(process.argv[4]??1),directory=`tests/step5d-recovery/evidence/${label}`;mkdirSync(directory,{recursive:true});
const records=new Map<string,string>(),extractionStart=performance.now();
for await(const line of createInterface({input:createReadStream('tests/step5b-resource/evidence/full/canonical-segments.jsonl.gz').pipe(createGunzip()),crlfDelay:Infinity})){if(!line)continue;const split=line.indexOf(',"value":');assert.ok(line.startsWith('{"key":')&&split>0&&line.endsWith('}'));const key=JSON.parse(line.slice(7,split)) as string;records.set(key,line.slice(split+9,-1));}
const current=JSON.parse(records.get('current')!) as SegmentedEnvelope;
const entry=(kind:typeof SEGMENTS[number],index:number)=>JSON.parse(records.get(segmentKey(kind,index))!) as StoredSegment;
const sessions=[];let handCount=0;
for(let i=0;i<current.segments.closedSessions.count;i++){const s=entry('closedSessions',i).value as AppData['sessions'][number];if(handCount+s.handIds.length>size)break;sessions.push(s);handCount+=s.handIds.length;if(handCount===size&&size!==10000)break;}
if(size===0)sessions.length=0;else assert.equal(handCount,size,'Fixture must end at exact closed-session boundary');
let ledgerCount=1,wallet=(entry('ledger',0).value as AppData['ledger'][number]).walletDelta,epoch=0;
if(size){wallet=0;for(let i=0;i<current.segments.ledger.count;i++){const e=entry('ledger',i).value as AppData['ledger'][number];wallet+=e.walletDelta;epoch=e.epoch;ledgerCount=i+1;if(e.kind==='cash-out'&&e.sessionId===sessions.at(-1)!.id)break;}}
const counts={ledger:ledgerCount,hands:size,closedSessions:sessions.length,importedHands:0},segments={} as SegmentedEnvelope['segments'];
for(const name of SEGMENTS)segments[name]={count:counts[name],tail:counts[name]?entry(name,counts[name]-1).hash:GENESIS};
const body={format:current.format,version:current.version,data:{...current.data,wallet,epoch,active:null,openSession:null},segments};
let manifest={...body,checksum:await digest(body)} as SegmentedEnvelope;
const fixtureEncodingStart=performance.now();
if(label.includes('packed')){
 for(let i=0;i<size;i++){const e=entry('hands',i);records.set(packedHandKey(i),JSON.stringify({format:'ai-texas-packed-hand',version:1,index:e.index,previousHash:e.previousHash,hash:e.hash,graph:JSON.stringify(packHandGraph(e.value))}));}
 const packedBody={...body,packedHands:{version:1 as const,count:segments.hands.count,tail:segments.hands.tail}};manifest={...packedBody,checksum:await digest(packedBody)};
}
const fixtureEncodingMs=performance.now()-fixtureEncodingStart;

const fixtureExtractionMs=performance.now()-extractionStart;
// Retain only selected serialized segments, exactly like the reference storage port.
for(const key of records.keys())if(!key.startsWith('packed-v1:')&&!SEGMENTS.some(name=>key.startsWith(`v2:${name}:`)&&Number(key.slice(key.lastIndexOf(':')+1))<counts[name]))records.delete(key);
global.gc?.();
const stages:{run:number;name:string;ms:number}[]=[],gc:{start:number;ms:number;detail:unknown}[]=[],runs:unknown[]=[];let run=0;
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({start:e.startTime,ms:e.duration,detail:(e as typeof e&{detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});
observeTimings(s=>stages.push({run,name:s.name,ms:s.milliseconds}));
class Port implements PersistencePort {writable=true;async load(){return restoreSegments(manifest,async keys=>{const t=performance.now();const result=keys.map(k=>JSON.parse(records.get(k)!));stages.push({run,name:'recovery.readParse',ms:performance.now()-t});return result;});}async commit(){throw new Error('Read-only profiling fixture');}close(){}}
for(run=0;run<repeats;run++){
 const before=process.memoryUsage(),start=performance.now(),c=new SessionController(new Port());await c.init();const ms=performance.now()-start;assert.equal(c.error,'');const data=c.data!;
 assert.equal(data.hands.length,size);assert.equal(data.wallet,wallet);assert.equal(data.active,null);assert.equal(data.ledger.reduce((n,e)=>n+e.walletDelta,0),wallet);assert.equal(data.ledger.reduce((n,e)=>n+e.tableDelta,0),0);assert.equal(data.hands.reduce((n,h)=>n+h.net,0),data.ledger.reduce((n,e)=>n+e.pokerNet,0));assert.equal(data.ledger.filter(e=>e.kind==='hand-net').length,size);
 runs.push({run,startMs:start,endMs:performance.now(),ms,before,after:process.memoryUsage()});c.close();c.data=null;await new Promise<void>(r=>setImmediate(r));global.gc?.();
}
observeTimings(null);await new Promise<void>(r=>setImmediate(r));observer.disconnect();
const selectedStorageBytes=[...records].filter(([key])=>!manifest.packedHands||!key.startsWith('v2:hands:')).reduce((n,[,value])=>n+Buffer.byteLength(value),0);
const report={size,label,fixtureEncodingMs,selectedStorageBytes,node:process.version,platform:process.platform,reference:'Node cold actual production restore + SessionController; in-memory JSON-string storage reference; not IndexedDB/browser/device timing',repeats,fixtureExtractionMs,storageBytes:[...records.values()].reduce((n,s)=>n+s.length,0),runs,stages,gc,after:process.memoryUsage(),integrity:'Every selected canonical segment retained with original hashes; fixture ends after closed session; exact hand/settlement count, wallet, zero table balance and poker delta independently reconciled.'};
writeFileSync(`${directory}/${size}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({size,label,runs:runs.map(r=>({ms:(r as {ms:number}).ms})),stages:stages.filter(s=>s.name!=='recovery.readParse')}));
