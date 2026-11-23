import {createReadStream,readFileSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {referenceHash,referenceFullHands,referenceFinancial} from '../step5e-independent/financial-reference';
import type {AppData,MoneyEvent} from '../../src/session/types';
import type {ReferenceHandIndex} from '../step5e-independent/financial-reference';

const directory=process.argv[2];
const report=JSON.parse(readFileSync(`${directory}/0-report.json`,'utf8'));
assert.equal(report.status,'PASS');assert.equal(report.completedHands,report.goalHands);
const started=performance.now(),hash=createHash('sha256'),genesis='0'.repeat(64);
const chains:Record<string,{count:number;tail:string}>=Object.fromEntries(['ledger','hands','closedSessions','importedHands'].map(name=>[name,{count:0,tail:genesis}]));
const ledger:MoneyEvent[]=[],sessions:AppData['sessions']=[],handIndex:ReferenceHandIndex[]=[];
const keys=new Set<string>();let previousHandHash=genesis,profit=0,rake=0,records=0;
let header:null|{data:{active:unknown;openSession:unknown;wallet:number};segments:typeof chains}=null;
for await(const line of createInterface({input:createReadStream(`${directory}/canonical-segments.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity})){
 hash.update(line+'\n');const {key,value}=JSON.parse(line);assert(!keys.has(key),'Duplicate archived key');keys.add(key);records++;
 if(key==='current'){header=value;const{checksum,...body}=value;assert.equal(checksum,referenceHash(body));continue;}
 const match=/^v2:(ledger|hands|closedSessions|importedHands):(\d+)$/.exec(key);if(!match)continue;
 const family=match[1],chain=chains[family],{hash:actual,...body}=value;assert.equal(Number(match[2]),chain.count);assert.equal(value.index,chain.count);assert.equal(value.previousHash,chain.tail);assert.equal(actual,referenceHash(body));chain.count++;chain.tail=actual;
 if(family==='ledger')ledger.push(value.value);else if(family==='closedSessions')sessions.push(value.value);else if(family==='hands'){
  const hand=value.value,result=referenceFullHands([hand],previousHandHash);previousHandHash=hand.hash;profit+=result.poker;rake+=result.totalRake;handIndex.push({id:hand.id,sessionId:hand.sessionId,epoch:hand.epoch,net:hand.net,hash:hand.hash,previousHash:hand.previousHash});
 }
}
assert(header);assert.equal(header.data.active,null);assert.equal(header.data.openSession,null);assert.deepEqual(chains,header.segments);assert.equal(hash.digest('hex'),report.archive.sha256Uncompressed);assert.equal(chains.hands.count,report.goalHands);
const financial=referenceFinancial({wallet:header.data.wallet,ledger,sessions,active:null,handIndex});assert.deepEqual(financial,report.finalCompactAccount);assert.equal(financial.poker,profit);assert.equal(financial.wallet,financial.manual+profit);assert.equal(records,report.finalStorage.records);
const result={status:'PASS',applicationCommit:report.source.applicationCommit,verifierSourceSHA256:createHash('sha256').update(readFileSync('tests/step5l-resource/verify-archive.ts')).digest('hex'),oracleSourceSHA256:createHash('sha256').update(readFileSync('tests/step5e-independent/financial-reference.ts')).digest('hex'),executedBundleSHA256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),archiveSHA256Uncompressed:report.archive.sha256Uncompressed,canonicalHands:chains.hands.count,storageRecords:records,financial,pokerEventReplayProfit:profit,pokerEventReplayRake:rake,independentCanonicalHashChains:true,independentBigIntEventReplay:true,exactCheckpointAndFullArchiveAgreement:true,elapsedMs:performance.now()-started,methodology:'Separate process streaming every canonical segment and hand. Independent BigInt replay of every blind, action, refund, award and rake reconciles all ending stacks. Independent canonical ledger hashing verifies every unique settlement and session exactly once. No production engine, checkpoint, statistics or integrity implementation is imported by this oracle.'};
writeFileSync(`${directory}/independent-archive-verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
