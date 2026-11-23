import {describe,it,expect} from 'vitest';
import {createReadStream,mkdirSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import type {AppData,MoneyEvent,StoredHand} from '../../src/session/types';
import {referenceFinancial,referenceFullHands,referenceHash,type ReferenceHandIndex} from './financial-reference';

/** Stream the existing immutable 10k canonical fixture. Never retain full hand
 * bodies or call the checkpoint reader whose results this oracle will judge. */
describe('Step5E independent large-history financial/full-replay agreement',()=>{
 it('reconciles 0/100/500/1000/5000/10000 historical hands without trusting production summaries',async()=>{
  const sizes=[0,100,500,1000,5000,10000],genesis='0'.repeat(64),ledger:MoneyEvent[]=[],sessions:AppData['sessions']=[],index:ReferenceHandIndex[]=[];
  const totals=new Map<number,{poker:number;rake:number}>([[0,{poker:0,rake:0}]]),outer=new Map<string,{count:number;tail:string}>();
  let handPrevious=genesis,poker=0,rake=0,manifest: {segments:Record<string,{count:number;tail:string}>}|null=null;
  const conditions={seats:new Set<number>(),blinds:new Set<string>(),policies:new Set<string>(),rakeHands:0,topups:0,cashouts:0},start=performance.now();
  for await(const line of createInterface({input:createReadStream(new URL('../step5b-resource/evidence/full/canonical-segments.jsonl.gz',import.meta.url)).pipe(createGunzip()),crlfDelay:Infinity})){
   if(!line)continue;const row=JSON.parse(line) as {key:string;value:unknown};
   if(row.key==='current'){manifest=row.value as typeof manifest;continue;}
   if(!row.key.startsWith('v2:'))continue;
   const kind=row.key.split(':')[1],entry=row.value as {index:number;previousHash:string;hash:string;value:unknown};
   const prior=outer.get(kind)??{count:0,tail:genesis};expect(entry.index).toBe(prior.count);expect(entry.previousHash).toBe(prior.tail);
   expect(entry.hash).toBe(referenceHash({index:entry.index,previousHash:entry.previousHash,value:entry.value}));outer.set(kind,{count:prior.count+1,tail:entry.hash});
   if(kind==='ledger'){const e=entry.value as MoneyEvent;ledger.push(e);if(e.kind==='top-up')conditions.topups++;if(e.kind==='cash-out')conditions.cashouts++;}
   else if(kind==='closedSessions')sessions.push(entry.value as AppData['sessions'][number]);
   else if(kind==='hands'){
    const h=entry.value as StoredHand,audit=referenceFullHands([h],handPrevious);handPrevious=h.hash;poker+=audit.poker;rake+=audit.totalRake;
    index.push({id:h.id,sessionId:h.sessionId,epoch:h.epoch,net:h.net,hash:h.hash,previousHash:h.previousHash});
    conditions.seats.add(h.view.seats.length);conditions.blinds.add(`${h.view.profile.smallBlind}/${h.view.profile.bigBlind}`);for(const p of Object.values(h.privateProfiles))conditions.policies.add(p.policyVersion);if(h.view.rake>0)conditions.rakeHands++;
    if(sizes.includes(index.length))totals.set(index.length,{poker,rake});
   }
  }
  expect(manifest).not.toBe(null);for(const [kind,actual] of outer)expect(actual).toEqual(manifest!.segments[kind]);
  expect(index).toHaveLength(10000);const results=[];
  for(const size of sizes){
   const selectedSessions:AppData['sessions']=[];let hands=0;
   for(const s of sessions){if(hands+s.handIds.length>size)break;selectedSessions.push(s);hands+=s.handIds.length;if(hands===size)break;}
   if(size===0)selectedSessions.length=0;else expect(hands).toBe(size);
   const end=size?ledger.findIndex(e=>e.kind==='cash-out'&&e.sessionId===selectedSessions.at(-1)!.id):0;expect(end).toBeGreaterThanOrEqual(0);
   const selectedLedger=ledger.slice(0,end+1),wallet=Number(selectedLedger.reduce((n,e)=>n+BigInt(e.walletDelta),0n));
   const compact=referenceFinancial({wallet,ledger:selectedLedger,sessions:selectedSessions,active:null,handIndex:index.slice(0,size)}),full=totals.get(size)!;
   expect(compact.hands).toBe(size);expect(compact.poker).toBe(full.poker);expect(compact.table).toBe(0);results.push({size,...compact,fullReplayPoker:full.poker,fullReplayRake:full.rake});
  }
  const report={description:'Independent Node canonical fixture audit, not browser startup timing or checkpoint-reader timing',elapsedMs:performance.now()-start,results,conditions:{...conditions,seats:[...conditions.seats],blinds:[...conditions.blinds],policies:[...conditions.policies]},oracle:'Node crypto SHA256, BigInt raw-event financial replay and full public action/debit/refund/award replay; no production integrity/projection/checkpoint functions'};
  mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});writeFileSync(new URL('./evidence/canonical-replay-agreement.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 },120000);
});
