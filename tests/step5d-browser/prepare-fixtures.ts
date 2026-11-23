import {createReadStream,createWriteStream,mkdirSync,writeFileSync} from 'node:fs';
import {createGunzip,createGzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {digest,GENESIS} from '../../src/storage/integrity';
import {SEGMENTS,segmentKey,type SegmentedEnvelope,type StoredSegment} from '../../src/storage/segments';
import type {AppData} from '../../src/session/types';
const directory='tests/browser/step5d-recovery-fixtures',archive='tests/step5b-resource/evidence/full/canonical-segments.jsonl.gz';
const sizes=[0,100,500,1000,5000,10000];mkdirSync(directory,{recursive:true});
async function* lines(){for await(const line of createInterface({input:createReadStream(archive).pipe(createGunzip()),crlfDelay:Infinity}))if(line)yield line as string;}
function split(line:string){const at=line.indexOf(',"value":');assert(at>0&&line.startsWith('{"key":')&&line.endsWith('}'));return{key:JSON.parse(line.slice(7,at)) as string,value:line.slice(at+9,-1)};}
const small=new Map<string,StoredSegment>(),tails=new Map<number,string>();let current:SegmentedEnvelope|null=null;
for await(const line of lines()){const {key,value}=split(line);if(key==='current')current=JSON.parse(value);else if(key.startsWith('v2:hands:')){const index=Number(key.slice(key.lastIndexOf(':')+1));if(sizes.includes(index+1))tails.set(index+1,(JSON.parse(value) as StoredSegment).hash);}else if(key.startsWith('v2:'))small.set(key,JSON.parse(value));}
assert(current);const manifest=current as SegmentedEnvelope;
const fixtures=await Promise.all(sizes.map(async size=>{
 const sessions:AppData['sessions']=[];let count=0;
 if(size)for(let i=0;i<manifest.segments.closedSessions.count;i++){const s=small.get(segmentKey('closedSessions',i))!.value as AppData['sessions'][number];if(count+s.handIds.length>size)break;sessions.push(s);count+=s.handIds.length;if(count===size&&size!==10000)break;}
 assert.equal(count,size);let ledgerCount=1,wallet=(small.get(segmentKey('ledger',0))!.value as AppData['ledger'][number]).walletDelta,epoch=0;
 if(size){wallet=0;for(let i=0;i<manifest.segments.ledger.count;i++){const e=small.get(segmentKey('ledger',i))!.value as AppData['ledger'][number];wallet+=e.walletDelta;epoch=e.epoch;ledgerCount=i+1;if(e.kind==='cash-out'&&e.sessionId===sessions.at(-1)!.id)break;}}
 const counts={ledger:ledgerCount,hands:size,closedSessions:sessions.length,importedHands:0},segments={} as SegmentedEnvelope['segments'];
 for(const name of SEGMENTS)segments[name]={count:counts[name],tail:counts[name]?(name==='hands'?tails.get(size)!:small.get(segmentKey(name,counts[name]-1))!.hash):GENESIS};
 const body={format:manifest.format,version:manifest.version,data:{...manifest.data,wallet,epoch,active:null,openSession:null},segments},envelope={...body,checksum:await digest(body)},filename=`${size}.jsonl.gz`,gzip=createGzip(),file=createWriteStream(`${directory}/${filename}`);gzip.pipe(file);
 const rawHash=createHash('sha256');let bytes=0,records=0;
 const put=async(line:string)=>{const text=line+'\n';rawHash.update(text);bytes+=Buffer.byteLength(text);records++;if(!gzip.write(text))await once(gzip,'drain');};
 await put(JSON.stringify({key:'current',value:envelope}));
 return{size,wallet,counts,envelope,filename,gzip,file,put,finish:async()=>{gzip.end();await once(file,'close');return{size,wallet,counts,filename,canonicalUncompressedBytes:bytes,records,rawSHA256:rawHash.digest('hex'),manifestChecksum:envelope.checksum};}};
}));
for await(const line of lines()){const {key}=split(line);for(const f of fixtures)if(SEGMENTS.some(name=>key.startsWith(`v2:${name}:`)&&Number(key.slice(key.lastIndexOf(':')+1))<f.counts[name]))await f.put(line);}
const outputs=[];for(const fixture of fixtures)outputs.push(await fixture.finish());
writeFileSync(`${directory}/manifest.json`,JSON.stringify({sourceArchive:archive,method:'Exact stored segment bytes copied; subset manifest ends at closed-session boundary. Original segment/hand/ledger hashes unchanged. Synthetic private QA only.',fixtures:outputs},null,2)+'\n');console.log(JSON.stringify(outputs));
