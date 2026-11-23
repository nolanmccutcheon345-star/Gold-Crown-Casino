import {performance} from 'node:perf_hooks';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
/** Test-only disk fixture preparation. Runs in a separate process from profiling. */
import {createReadStream,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const size=Number(process.argv[2]),folder=path.resolve(process.argv[3]);
assert([100,1000,10000].includes(size));assert(!existsSync(folder));mkdirSync(folder,{recursive:true});
const fixture=JSON.parse(readFileSync('tests/browser/step5d-recovery-fixtures/manifest.json')).fixtures.find(x=>x.size===size);
const source=`tests/browser/step5d-recovery-fixtures/${size}.jsonl.gz`,hash=createHash('sha256'),entries=[],handFields={},start=performance.now();let bytes=0;
for await(const line of createInterface({input:createReadStream(source).pipe(createGunzip()),crlfDelay:Infinity})){
 hash.update(line+'\n');const split=line.indexOf(',"value":');assert(split>0);const key=JSON.parse(line.slice(7,split)),value=line.slice(split+9,-1),name=`${entries.length}.json`,length=Buffer.byteLength(value);writeFileSync(path.join(folder,name),value);entries.push({key,name,bytes:length});bytes+=length;if(key.startsWith('v2:hands:')){const hand=JSON.parse(value).value;for(const[k,v]of Object.entries(hand))handFields[k]=(handFields[k]??0)+Buffer.byteLength(JSON.stringify(v));}
}
assert.equal(hash.digest('hex'),fixture.rawSHA256);assert.equal(new Set(entries.map(x=>x.key)).size,entries.length);
const result={format:'step5f-disk-fixture',version:1,size,source,sourceRawSHA256:fixture.rawSHA256,expectedWallet:fixture.wallet,createdAt:new Date().toISOString(),preparationMs:performance.now()-start,serializedBytes:bytes,canonicalHandFieldValueBytes:handFields,entries};
writeFileSync(path.join(folder,'index.json'),JSON.stringify(result));console.log(JSON.stringify({...result,entries:entries.length}));
