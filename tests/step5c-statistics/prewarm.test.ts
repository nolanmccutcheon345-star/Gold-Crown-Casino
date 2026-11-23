import {beforeAll,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {auditSnapshot} from '../../src/storage/verified';
import {migrateData} from '../../src/storage/integrity';
import {CashStatsProjection} from '../../src/stats/projection';
import {deriveCashStats} from '../../src/stats/cash';
import {AsyncCashStats} from '../../src/ui/async-cash-stats';
import type {AppData,PersistencePort} from '../../src/session/types';

let forty:AppData,sixtyFour:AppData;
beforeAll(async()=>{
 let saved:AppData|null=null;const port:PersistencePort={load:async()=>saved,commit:async(expected,next)=>{if((saved?.revision??null)!==expected)throw Error('test revision conflict');saved=next;},close(){}};
 const controller=new SessionController(port);await controller.init();
 for(let n=0;n<64;n++){
  const bigBlind=n%2?200:600;
  await controller.startSession({...DEFAULT_SETTINGS,seats:2,smallBlind:bigBlind/2,bigBlind,buyIn:20000});
  const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);await controller.cashOut();
  expect(controller.error).toBe('');if(n===39)forty=controller.data!;
 }
 sixtyFour=controller.data!;controller.close();
});
const settle=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function gate(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return{promise,release};}

describe('cooperative statistics preparation with exact full-history agreement',()=>{
 it('prepares audited histories with the unchanged per-hand algorithm and full replay equivalence',async()=>{
  let yields=0;const before=JSON.stringify(forty);
  const projection=await CashStatsProjection.prewarm(forty.hands,{yieldControl:()=>{yields++;return Promise.resolve();}});
  expect(yields).toBe(40);expect(projection.derive(forty.hands,forty.sessions,0)).toEqual(deriveCashStats(forty.hands,forty.sessions,0));
  expect(projection.getDiagnostics().projectedHands).toBe(40);expect(JSON.stringify(forty)).toBe(before);
  expect(projection.derive(sixtyFour.hands,sixtyFour.sessions,0)).toEqual(deriveCashStats(sixtyFour.hands,sixtyFour.sessions,0));
  expect(projection.getDiagnostics().projectedHands).toBe(64);
 });
 it('matches full replay for populated historical opportunities, rake and active clocks',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8'));
  const data=await auditSnapshot(await migrateData(fixture.streets.flop));
  const projection=await CashStatsProjection.prewarm(data.hands,{yieldControl:()=>Promise.resolve()});
  expect(projection.derive(data.hands,data.sessions,5000)).toEqual(deriveCashStats(data.hands,data.sessions,5000));
 });
 it.each(['copied','missing','duplicate','reordered','corrupt'] as const)('refuses %s data without the independent audit capability',async kind=>{
  const copy=structuredClone(forty.hands);
  if(kind==='missing')copy.splice(2,1);if(kind==='duplicate')copy[2]=copy[1];if(kind==='reordered')[copy[1],copy[2]]=[copy[2],copy[1]];if(kind==='corrupt')copy[0].net++;
  Object.freeze(copy);await expect(CashStatsProjection.prewarm(copy)).rejects.toThrow('verified canonical history');
 });
 it('never publishes a projection if interrupted between records',async()=>{
  const wait=gate();let cancelled=false;
  const pending=CashStatsProjection.prewarm(forty.hands,{yieldControl:()=>wait.promise,cancelled:()=>cancelled});
  cancelled=true;wait.release();await expect(pending).rejects.toThrow('cancelled');
  const retried=await CashStatsProjection.prewarm(forty.hands);
  expect(retried.derive(forty.hands,forty.sessions,0)).toEqual(deriveCashStats(forty.hands,forty.sessions,0));
 });
 it('rejects an unaudited private-data accessor without invoking it',async()=>{
  let reads=0;const hostile=new Proxy(forty.hands,{get(){reads++;throw Error('private card read');}});
  await expect(CashStatsProjection.prewarm(hostile)).rejects.toThrow('verified canonical history');expect(reads).toBe(0);
 });
});

describe('UI statistics remain unavailable until a complete current projection is ready',()=>{
 it('withholds partial numbers and includes newly appended hands before showing a result',async()=>{
  const wait=gate();let updates=0;const ui=new AsyncCashStats(()=>updates++,()=>wait.promise);
  expect(ui.read(forty.hands,forty.sessions,0)).toBeNull();expect(ui.read(sixtyFour.hands,sixtyFour.sessions,0)).toBeNull();expect(updates).toBe(0);
  wait.release();await settle();expect(updates).toBe(1);
  expect(ui.read(sixtyFour.hands,sixtyFour.sessions,0)).toEqual(deriveCashStats(sixtyFour.hands,sixtyFour.sessions,0));
 });
 it('discards a replaced recovery source instead of showing the older result',async()=>{
  const wait=gate();let updates=0;const ui=new AsyncCashStats(()=>updates++,()=>wait.promise);
  expect(ui.read(sixtyFour.hands,sixtyFour.sessions,0)).toBeNull();expect(ui.read(forty.hands,forty.sessions,0)).toBeNull();
  wait.release();await settle();expect(updates).toBe(1);expect(ui.read(forty.hands,forty.sessions,0)).toEqual(deriveCashStats(forty.hands,forty.sessions,0));
 });
 it('cannot restore erased results when a background preparation completes',async()=>{
  const wait=gate();let updates=0;const ui=new AsyncCashStats(()=>updates++,()=>wait.promise);
  expect(ui.read(forty.hands,forty.sessions,0)).toBeNull();ui.reset();expect(ui.read([],[],0)?.hands).toBe(0);
  wait.release();await settle();expect(updates).toBe(0);expect(ui.read([],[],0)?.hands).toBe(0);
 });
 it('fails visibly for unverified imported/recovered history without returning partial totals',async()=>{
  let updates=0;const ui=new AsyncCashStats(()=>updates++);const unverified=structuredClone(forty.hands);
  expect(ui.read(unverified,forty.sessions,0)).toBeNull();await settle();expect(ui.error).toContain('verified canonical history');expect(updates).toBe(1);
  expect(ui.read(unverified,forty.sessions,0)).toBeNull();await settle();expect(updates).toBe(1);
  ui.reset();expect(ui.read(forty.hands,forty.sessions,0)).toBeNull();await settle();expect(ui.error).toBe('');expect(ui.read(forty.hands,forty.sessions,0)).toEqual(deriveCashStats(forty.hands,forty.sessions,0));
 });
});
