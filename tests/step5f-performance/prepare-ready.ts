/** Create a native-format checkpoint in a separate fixture process, never timed as fresh startup. */
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DiskRecords} from './disk-records';
import {fileIDBReference} from './file-idb-reference';
import {totalHandCount} from '../../src/storage/verified';
const folder=process.argv[2],store=new DiskRecords(folder),port=fileIDBReference(store as unknown as Map<string,string>).attach();
const start=performance.now(),data=await port.load();assert(data);assert.equal(data.wallet,store.initial.expectedWallet);assert.equal(totalHandCount(data),store.initial.size);
port.close();await new Promise<void>(resolve=>setImmediate(resolve));
const index=JSON.parse(readFileSync(path.join(folder,'index.json'),'utf8'));
index.inputReadyCheckpoint=true;index.checkpointPreparationMs=performance.now()-start;index.entries=[...store.rows.values()];index.serializedBytes=store.bytes;
writeFileSync(path.join(folder,'index.json'),JSON.stringify(index));
console.log(JSON.stringify({inputReadyCheckpoint:true,preparationMs:index.checkpointPreparationMs,hands:totalHandCount(data),wallet:data.wallet,storedBytes:store.bytes}));
