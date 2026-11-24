import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {StoredHand} from '../../src/session/types';
import type {EventResult} from '../../src/tournament/stats';
import {freshSlots} from '../../src/slots/state';
import {freshCasino} from '../../src/casino/wallet';
import {careerStats,slotsMachines,type CareerSources} from '../../src/stats/career';
import {slotsResult,casinoResult} from '../../src/stats/by-game';
import {checkStatsBook,cursorsFromSources,deleteSnapshot,freshStatsBook,periodArchives,periodStats,readStatsBook,resetCounters,saveStatsBook,takeSnapshot,clearBaseline,STATS_BOOK_KEY} from '../../src/stats/snapshots';

/* Phase 2: career aggregation across all games, snapshots, reset/compare. */
const hand=(id:string,net:number,at='2026-11-01T10:00:00.000Z',street='complete'):StoredHand=>({id,net,startedAt:at,view:{street,profile:{bigBlind:200}}}) as unknown as StoredHand;
const event=(id:string,cost:number,prize:number,at='2026-11-02T10:00:00.000Z'):EventResult=>({id,name:'Test',cost,prize,net:prize-cost,finishedAt:at}) as unknown as EventResult;
function sources(over:Partial<CareerSources>={}):CareerSources {
 const slots=freshSlots();slots.machines={'lucky-sevens':{spins:100,wagered:10000,won:9400,biggest:5000,features:3},'gem-cascade':{spins:50,wagered:5000,won:5300,biggest:9000,features:7}};
 slots.recent=[{machine:'lucky-sevens',bet:100,total:0,at:'2026-11-20T00:00:00.000Z'},{machine:'gem-cascade',bet:100,total:250,at:'2026-11-20T00:01:00.000Z'},{machine:'lucky-sevens',bet:100,total:100,at:'2026-11-20T00:02:00.000Z'}];
 const casino=freshCasino();casino.games={roulette:{rounds:40,wagered:4000,returned:3900,biggest:800},races:{rounds:10,wagered:2000,returned:2600,biggest:1500}};
 casino.recent=[{game:'roulette',wagered:100,returned:0,at:'2026-11-20T00:00:00.000Z'},{game:'roulette',wagered:100,returned:200,at:'2026-11-20T00:01:00.000Z'},{game:'races',wagered:200,returned:600,at:'2026-11-20T00:02:00.000Z'},{game:'races',wagered:200,returned:0,at:'2026-11-20T00:03:00.000Z'}];
 return {cashHands:[hand('h1',500),hand('h2',-300),hand('h3',1200,'2026-10-15T09:00:00.000Z')],tournamentEvents:[event('e1',1000,0),event('e2',1000,4500)],
  blackjackRounds:[{net:200,bet:100},{net:-100,bet:100},{net:0,bet:0}],omahaHands:[{net:700,stakes:'1-2'},{net:-100,stakes:'1-2'}],slots,casino,...over};
}

describe('career aggregation',()=>{
 it('totals every game from its own records, including the five previously invisible games',()=>{
  const c=careerStats(sources());
  expect(c.games.cash).toMatchObject({samples:3,net:1400,biggest:1200,wagered:null});
  expect(c.games.tournaments).toMatchObject({samples:2,wagered:2000,net:2500,biggest:4500});
  expect(c.games.blackjack).toMatchObject({samples:2,wagered:200,net:100,biggest:200});
  expect(c.games.omaha).toMatchObject({samples:2,net:600,biggest:700});
  expect(c.games.slots).toMatchObject({samples:150,wagered:15000,net:-300,biggest:9000});
  expect(c.games.roulette).toMatchObject({samples:40,wagered:4000,net:-100,biggest:800});
  expect(c.games.craps).toMatchObject({samples:0,net:0,biggest:null});
  expect(c.games.baccarat).toMatchObject({samples:0,net:0});
  expect(c.games.races).toMatchObject({samples:10,wagered:2000,net:600,biggest:1500});
  expect(c.totalSamples).toBe(3+2+2+2+150+40+0+0+10);
  expect(c.totalNet).toBe(1400+2500+100+600-300-100+0+0+600);
 });
 it('since is the earliest dated evidence, and null when no archive is dated',()=>{
  expect(careerStats(sources()).since).toBe('2026-10-15T09:00:00.000Z');
  const empty=careerStats(sources({cashHands:[],tournamentEvents:[],blackjackRounds:[],omahaHands:[]}));
  expect(empty.since).toBeNull();expect(empty.totalSamples).toBe(150+40+10);
 });
 it('incomplete cash hands do not count as played, matching the by-game card',()=>{
  const c=careerStats(sources({cashHands:[hand('h1',500),hand('h2',-300,'2026-11-01T10:00:00.000Z','flop')]}));
  expect(c.games.cash.samples).toBe(1);expect(c.games.cash.biggest).toBe(500);
 });
 it('per-machine slots detail carries payback and features',()=>{
  const lines=slotsMachines(sources().slots);
  expect(lines.map(l=>l.id)).toEqual(['lucky-sevens','gem-cascade']);
  expect(lines[0]).toMatchObject({spins:100,net:-600,payback:94,features:3});
  expect(lines[1]).toMatchObject({spins:50,net:300,biggest:9000});
 });
});

describe('by-game results for the new games',()=>{
 it('slots: all-time totals, rate from the recent spins only',()=>{
  const r=slotsResult(sources().slots);
  expect(r.game).toBe('slots');expect(r.samples).toBe(150);expect(r.net).toBe(-300);expect(r.rateSamples).toBe(3);
  expect(r.rate!.mean).toBeCloseTo(50/3);expect(r.detail).toContain('150 spins all-time');expect(r.detail).toContain('98.0% paid back');
  expect(r.verdict).toBe('too-early');expect(r.minimum).toBe(30);
 });
 it('casino games: totals from the game record, rate from that game\'s recent rounds',()=>{
  const s=sources().casino;
  const roulette=casinoResult('roulette',s);
  expect(roulette.samples).toBe(40);expect(roulette.net).toBe(-100);expect(roulette.rateSamples).toBe(2);expect(roulette.rate!.mean).toBe(0);
  expect(roulette.detail).toContain('97.5% of stakes returned');expect(roulette.detail).toContain('biggest round $8');
  const races=casinoResult('races',s);
  expect(races.samples).toBe(10);expect(races.net).toBe(600);expect(races.rateSamples).toBe(2);expect(races.rate!.mean).toBe(50);
  const craps=casinoResult('craps',s);
  expect(craps.samples).toBe(0);expect(craps.rate).toBeNull();expect(craps.detail).toBe('');
 });
});

describe('snapshots and the reset point',()=>{
 const at='2026-11-23T12:00:00.000Z';
 it('a snapshot freezes the aggregates; later play does not change it',()=>{
  const before=careerStats(sources());
  let book=takeSnapshot(freshStatsBook(),before,'snap-1',at,'Before coaching');
  expect(book.snapshots).toHaveLength(1);expect(book.snapshots[0]).toMatchObject({name:'Before coaching',at});
  expect(book.snapshots[0].career.totalNet).toBe(before.totalNet);
  const after=careerStats(sources({cashHands:[...sources().cashHands,hand('h4',99999)]}));
  expect(after.totalNet).toBeGreaterThan(before.totalNet);
  expect(book.snapshots[0].career.totalNet).toBe(before.totalNet);
  book=deleteSnapshot(book,'snap-1');expect(book.snapshots).toHaveLength(0);
 });
 it('reset records a baseline only: period is career minus baseline, snapshots and career survive',()=>{
  const src=sources(),career=careerStats(src);
  let book=takeSnapshot(freshStatsBook(),career,'snap-1',at);
  book=resetCounters(book,career,cursorsFromSources(src),at);
  expect(book.baseline).not.toBeNull();expect(book.snapshots).toHaveLength(1);
  const zero=periodStats(career,book.baseline);
  expect(zero.totalSamples).toBe(0);expect(zero.totalNet).toBe(0);expect(zero.since).toBe(at);
  expect(zero.games.cash.biggest).toBeNull();// records are career-only, never derived for a period
  const grown=careerStats(sources({cashHands:[...src.cashHands,hand('h4',250)],casino:{...src.casino,games:{...src.casino.games,roulette:{rounds:45,wagered:4500,returned:4400,biggest:800}}}}));
  const period=periodStats(grown,book.baseline);
  expect(period.games.cash).toMatchObject({samples:1,net:250});
  expect(period.games.roulette).toMatchObject({samples:5,wagered:500,net:0});
  expect(period.totalNet).toBe(250);
  const cleared=clearBaseline(book);expect(periodStats(grown,cleared.baseline)).toBe(grown);
 });
 it('period archives slice at the reset cursors and report an unplaceable boundary honestly',()=>{
  const src=sources(),cursors=cursorsFromSources(src);
  const grown={...src,cashHands:[...src.cashHands,hand('h4',250),hand('h5',-50)],blackjackRounds:[...src.blackjackRounds,{net:50,bet:100}]};
  const arch=periodArchives(grown,cursors);
  expect(arch.cashHands.map(h=>h.id)).toEqual(['h4','h5']);expect(arch.blackjackRounds).toEqual([{net:50,bet:100}]);
  expect(arch.located).toEqual({cash:true,tournaments:true,blackjack:true,omaha:true});
  const partial=periodArchives({...grown,cashHands:[hand('hx',100)]},cursors);
  expect(partial.located.cash).toBe(false);expect(partial.cashHands).toEqual([]);
 });
 it('the book round-trips through storage and damaged records fall back with a notice',()=>{
  const store=new Map<string,string>();
  const fake={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
  const career=careerStats(sources());
  let book=takeSnapshot(freshStatsBook(),career,'snap-1',at,'Baseline');
  book=resetCounters(book,career,cursorsFromSources(sources()),at);
  saveStatsBook(book,fake);
  const read=readStatsBook(fake);
  expect(read.notice).toBe('');expect(read.book.snapshots).toHaveLength(1);expect(read.book.baseline?.cursors.cash).toBe(3);
  expect(checkStatsBook(JSON.parse(store.get(STATS_BOOK_KEY)!)).snapshots[0].career.games.slots.net).toBe(-300);
  store.set(STATS_BOOK_KEY,'{"version":1,"snapshots":[{"id":7}],"baseline":null}');
  const damaged=readStatsBook(fake);
  expect(damaged.book).toEqual(freshStatsBook());expect(damaged.notice).toContain('could not be read');
  expect(()=>checkStatsBook({version:2,snapshots:[],baseline:null})).toThrow();
  expect(()=>checkStatsBook({version:1,snapshots:[],baseline:{at,career:{games:{}},cursors:{cash:0,cashLastId:null,tournaments:0,blackjack:0,omaha:0}}})).toThrow();
 });
 it('snapshot names are trimmed, defaulted and capped',()=>{
  const career=careerStats(sources());
  const book=takeSnapshot(freshStatsBook(),career,'a',at,'   ');
  expect(book.snapshots[0].name).toBe('Snapshot 1');
  const named=takeSnapshot(book,career,'b',at,'  My run  ');
  expect(named.snapshots[1].name).toBe('My run');
 });
});

describe('app wiring',()=>{
 it('the by-game page renders career, all nine games, snapshots and the reset point',()=>{
  const app=readFileSync('src/ui/app.ts','utf8');
  for(const marker of ['data-testid="career-overview"','data-testid="stats-period"','data-testid="stats-snapshots"','data-testid="slots-result"','careerStats(careerSources())','casinoResult(g, sources.casino)','id="snapshot-save"','id="stats-reset"'])
   expect(app).toContain(marker);
 });
});
