import {expect,it} from 'vitest';
import {mixedStatsFixture} from './mixed-stats-fixture';
import {deriveCashStats} from '../../src/stats/cash';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import {digest} from '../../src/storage/integrity';
import {getArchiveContext,totalHandCount} from '../../src/storage/verified';
import {CashStatsProjection} from '../../src/stats/projection';
import {serializedIDB} from '../step5e-performance/serialized-idb';
it.each([['2/5',50000,72.5],['5/10',90000,75]] as const)('populated compiled stats fixture %s preserves independent amounts and all canonical bytes',async(second,profit,bb100)=>{
 const {data,metadata}=await mixedStatsFixture(second),stats=deriveCashStats(data.hands,data.sessions);
 expect(metadata.actualUIPlayedHands).toBe(0);expect(stats.hands).toBe(200);expect(stats.profit).toBe(profit);expect(stats.bb100).toBe(bb100);expect(stats.mixedStakes).toBe(true);expect(stats.stakes.map(g=>g.hands)).toEqual([100,100]);
 expect(data.wallet).toBe(1000000+12345+profit);expect(data.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(200);expect(data.ledger.filter(e=>e.kind==='top-up')).toHaveLength(2);expect(data.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(2);expect(data.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
 const prepared=await prepareSegments(data,null,null),rows=new Map(prepared.writes.map(w=>[w.key,w.entry])),restored=await restoreSegments(prepared.envelope,async keys=>keys.map(key=>rows.get(key)));
 expect(await digest(restored)).toBe(metadata.snapshotSHA256);expect(await digest(restored.hands)).toBe(metadata.canonicalHandsSHA256);
 // Exercise the same checkpoint install/load path as the compiled browser fixture.
 // A reset advances the account epoch, but existing session hands stay in their
 // original epoch exactly as SessionController.settle records them.
 const records=new Map(prepared.writes.map(w=>[w.key,JSON.stringify(w.entry)]));records.set('current',JSON.stringify(prepared.envelope));
 const adapter=serializedIDB(records),first=adapter.attach();
 try{expect(await first.load()).not.toBeNull();}finally{first.close();}
 const secondLoad=adapter.attach();
 try{
  const recovered=await secondLoad.load();expect(recovered).not.toBeNull();const context=getArchiveContext(recovered!)!;expect(context).toBeDefined();
  expect(totalHandCount(recovered!)).toBe(200);expect(recovered!.wallet).toBe(data.wallet);
  expect(context.handIndex.every(hand=>hand.epoch===data.sessions.find(session=>session.id===hand.sessionId)?.epoch)).toBe(true);
  expect(context.handIndex.slice(0,100).every(hand=>hand.epoch===0)).toBe(true);expect(context.handIndex.slice(100).every(hand=>hand.epoch===1)).toBe(true);
  const projection=CashStatsProjection.restoreCheckpoint(context.statistics,context.statistics.checkpoint);
  expect(projection.appendVerifiedTail(recovered!.hands.slice(context.statisticsHands-context.handOffset),recovered!.sessions)).toEqual(stats);
  expect(recovered!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(200);
 }finally{secondLoad.close();}
},60000);
