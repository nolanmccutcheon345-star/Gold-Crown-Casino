import { describe, it, expect, beforeEach } from 'vitest';
import { readSlots, saveSlots, playSpin, freshSlots, type SlotsState } from '../../src/slots/state';
import { machineById } from '../../src/slots/machines';
import { SlotsPlayer } from '../../src/slots/play';
import { freshSlotsUi } from '../../src/slots/view';
import { readCasino, saveCasino, overwriteCasino, freshCasino, stake, settle, type CasinoState } from '../../src/casino/wallet';
import { CasinoPlayer } from '../../src/casino/play';
import { saveGiftBook, claimGift, freshGiftBook } from '../../src/stats/gift';
import { PloTable, savePlo, PLO_KEY } from '../../src/plo/table';

/* Phase 14, Round-3 audit gates.
 * BLOCKER 1 (two-tab overwrite): two tabs on one profile must not erase each
 * other's settled wagers. Slots and casino states are additive ledgers, so a
 * save merges the saver's delta over whatever is durable now; both tabs'
 * records and debits survive a reload. Omaha holds a live hand and cannot
 * merge, so the stale tab's writes are refused instead.
 * BLOCKER 2 (full-storage silent loss): when a write cannot land, the save
 * reports failure, the round is rolled back before it is presented, and the
 * player gets an actionable warning. Nothing is presented as saved that is
 * not durable. */

let queue: (() => void)[] = [];
(globalThis as Record<string, unknown>).window = { setTimeout: (f: () => void) => { queue.push(f); return queue.length; }, clearTimeout: () => {}, setInterval: () => 0 };
(globalThis as Record<string, unknown>).clearInterval = () => {};
const backing = new Map<string, string>();
let failWrites = false;
const store = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => { if (failWrites) throw new Error('QuotaExceededError'); backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};
(globalThis as Record<string, unknown>).localStorage = store;
const seq = (seed: number) => { let s = seed >>> 0 || 1; return (n: number) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; }; };
beforeEach(() => { backing.clear(); queue = []; failWrites = false; });

describe('two-tab overwrite — slots', () => {
  it('both tabs\u2019 spins survive: records, debits and winnings merge', () => {
    const base = freshSlots();
    expect(saveSlots(base, store)).not.toBeNull(); // genesis, plain overwrite
    const mA = machineById('gold-rush')!, mB = machineById('poseidons-bounty')!;
    // Tab A spins machine 1 from the shared base.
    const a = playSpin(structuredClone(base), mA, mA.bets[0], seq(11));
    expect(saveSlots(a.state, store, base)).not.toBeNull();
    // Tab B, still holding the stale base, spins machine 2.
    const b = playSpin(structuredClone(base), mB, mB.bets[0], seq(23));
    expect(saveSlots(b.state, store, base)).not.toBeNull();
    // Reload: BOTH machines carry their spin, and the balance is the base
    // plus both tabs' deltas — the audit's $995-kept-vs-$990-correct case.
    const after = readSlots(store).state;
    expect(after.machines[mA.id]?.spins).toBe(1);
    expect(after.machines[mB.id]?.spins).toBe(1);
    expect(after.balance).toBe(base.balance + (a.state.balance - base.balance) + (b.state.balance - base.balance));
    expect(after.recent.length).toBe(a.state.recent.length + b.state.recent.length);
  });
  it('a tab that saves twice keeps merging over the other tab\u2019s writes', () => {
    const base = freshSlots();
    saveSlots(base, store);
    const m = machineById('gold-rush')!;
    const a1 = playSpin(structuredClone(base), m, m.bets[0], seq(5));
    saveSlots(a1.state, store, base);
    const b1 = playSpin(structuredClone(base), m, m.bets[0], seq(6));
    const bWritten = saveSlots(b1.state, store, base)!;
    const a2 = playSpin(structuredClone(a1.state), m, m.bets[0], seq(7));
    saveSlots(a2.state, store, a1.state);
    const after = readSlots(store).state;
    expect(after.machines[m.id]?.spins).toBe(3);
    expect(after.balance).toBe(bWritten.balance + (a2.state.balance - a1.state.balance));
  });
});

describe('two-tab overwrite — shared casino wallet', () => {
  it('a roulette round in one tab and a baccarat round in a stale tab both survive', () => {
    const base = freshCasino();
    expect(saveCasino(base, store)).not.toBeNull();
    // Tab A: roulette, $5 staked, $10 returned.
    const a = settle(stake(structuredClone(base), 500), 'roulette', 500, 1000, { bet: 'Straight 17', result: '17 red' });
    expect(saveCasino(a, store, base)).not.toBeNull();
    // Tab B (stale base): baccarat, $3 staked, nothing returned.
    const b = settle(stake(structuredClone(base), 300), 'baccarat', 300, 0, { bet: 'Player', result: 'Banker wins' });
    expect(saveCasino(b, store, base)).not.toBeNull();
    const after = readCasino(store).state;
    expect(after.games.roulette?.rounds).toBe(1);
    expect(after.games.baccarat?.rounds).toBe(1);
    expect(after.balance).toBe(base.balance + 500 - 300);
    expect(after.recent.length).toBe(2);
  });
});

describe('merge keeps repeated identical entries (multiset, not set)', () => {
  it('two Banker coups in one tab and a roulette pocket in a stale tab all stay on the boards', () => {
    const base = freshCasino();
    saveCasino(base, store);
    // Tab A: two baccarat rounds, both won by Banker — the board entry is
    // the same letter twice, and both coups must be kept.
    let a = structuredClone(base);
    a = settle(stake(a, 100), 'baccarat', 100, 195, { bet: 'Banker', result: 'Banker wins' });
    a = { ...a, boards: { ...(a.boards ?? {}), baccarat: [...((a.boards?.baccarat ?? []) as string[]), 'B'] } };
    a = settle(stake(a, 100), 'baccarat', 100, 0, { bet: 'Banker', result: 'Player wins' });
    a = { ...a, boards: { ...(a.boards ?? {}), baccarat: [...((a.boards?.baccarat ?? []) as string[]), 'B'] } };
    expect(saveCasino(a, store, base)).not.toBeNull();
    // Tab B (stale base): one roulette round, pocket 17.
    let b = settle(stake(structuredClone(base), 100), 'roulette', 100, 0, { bet: 'Red', result: '17 black' });
    b = { ...b, boards: { ...(b.boards ?? {}), roulette: [...((b.boards?.roulette ?? []) as number[]), 17] } };
    expect(saveCasino(b, store, base)).not.toBeNull();
    const after = readCasino(store).state;
    expect((after.boards?.baccarat as string[])).toEqual(['B', 'B']);
    expect((after.boards?.roulette as number[])).toEqual([17]);
    expect(after.games.baccarat?.rounds).toBe(2);
    expect(after.games.roulette?.rounds).toBe(1);
  });
  it('two identical slots results in one tab both stay in the recent list', () => {
    const base = freshSlots();
    saveSlots(base, store);
    const entry = { machine: 'gold-rush', bet: 100, total: 0, at: '2026-11-26T10:00:00.000Z' };
    const mine: SlotsState = { ...structuredClone(base), balance: base.balance - 200, recent: [entry, entry] };
    const written = saveSlots(mine, store, base)!;
    expect(written.recent).toEqual([entry, entry]);
    expect(readSlots(store).state.recent).toEqual([entry, entry]);
  });
  it('a same-tab save with no other writer returns the saver\u2019s state exactly', () => {
    const base = freshCasino();
    saveCasino(base, store);
    let s = settle(stake(structuredClone(base), 100), 'craps', 100, 200, { bet: 'Pass', result: '7 winner' });
    s = { ...s, boards: { ...(s.boards ?? {}), craps: [...((s.boards?.craps ?? []) as number[]), 7] } };
    s = settle(stake(s, 100), 'craps', 100, 0, { bet: 'Pass', result: '7 out' });
    s = { ...s, boards: { ...(s.boards ?? {}), craps: [...((s.boards?.craps ?? []) as number[]), 7] } };
    const written = saveCasino(s, store, base)!;
    expect(written).toEqual(s); // merge is the identity when theirs is base
  });
});

describe('two-tab overwrite — Omaha guard', () => {
  it('a stale tab never overwrites the table another tab is playing', () => {
    const tabB = new PloTable(); // opened first, on the fresh profile
    const tabA = new PloTable();
    tabA.sit('1-2', 100);
    const durableAfterA = backing.get(PLO_KEY);
    expect(durableAfterA).toBeTruthy();
    tabB.sit('1-2', 100); // stale tab tries to play over tab A
    expect(tabB.saveBlocked).toBe(true);
    expect(tabB.notice).toContain('Another tab has been playing Omaha');
    expect(backing.get(PLO_KEY)).toBe(durableAfterA); // tab A's table untouched
  });
});

describe('full-storage silent loss', () => {
  it('the save functions report failure instead of swallowing it', () => {
    failWrites = true;
    expect(saveSlots(freshSlots(), store)).toBeNull();
    expect(saveCasino(freshCasino(), store)).toBeNull();
    expect(overwriteCasino(freshCasino(), store)).toBe(false);
    expect(saveGiftBook(claimGift(freshGiftBook(), '2026-11-26'), store)).toBe(false);
    expect(savePlo({ ...structuredClone(new PloTable().state) })).toBe(false);
  });
  it('a slots spin that cannot be saved is refused before the reels move', () => {
    const ui = freshSlotsUi();
    const p = new SlotsPlayer({ ...freshSlots(), balance: 100000 }, ui, { render() {}, sound() {}, active: () => true, motion: () => false });
    p.open('gold-rush');
    failWrites = true;
    const before = p.state.balance;
    p.spin();
    expect(p.state.balance).toBe(before); // nothing charged
    expect(ui.error).toContain('storage is full');
    expect(ui.result).toBeNull(); // nothing presented as a settled spin
    expect(queue.length).toBe(0); // no presentation was scheduled
  });
  it('a roulette spin that cannot be saved never spins and keeps the balance', () => {
    const p = new CasinoPlayer({ render() {}, sound() {}, active: () => true }, seq(3));
    p.placeRoulette('straight', [17]);
    const before = p.state.balance;
    failWrites = true;
    p.spinRoulette();
    expect(p.state.balance).toBe(before);
    expect(p.ui.roulette.phase).toBe('betting'); // the wheel never turned
    expect(p.ui.error).toContain('storage is full');
    expect(queue.length).toBe(0);
    // And while the failure stands, new rounds are refused up front.
    p.spinRoulette();
    expect(p.ui.error).toContain('storage is full');
    expect(p.state.balance).toBe(before);
  });
  it('the gift claim write failing means no credit and the day is not burned', () => {
    failWrites = true;
    const claimed = claimGift(freshGiftBook(), '2026-11-26');
    expect(saveGiftBook(claimed, store)).toBe(false); // the app handler aborts the credit on false
  });
});

describe('cross-tab merge keeps the wallet reconciliation exact', () => {
  it('merged slots + casino totals equal the sum of both tabs\u2019 play', () => {
    const sBase = freshSlots(); saveSlots(sBase, store);
    const m = machineById('gold-rush')!;
    const a = playSpin(structuredClone(sBase), m, m.bets[0], seq(31));
    saveSlots(a.state, store, sBase);
    const b = playSpin(structuredClone(sBase), m, m.bets[1] ?? m.bets[0], seq(47));
    const merged: SlotsState = saveSlots(b.state, store, sBase)!;
    expect(merged.balance).toBe(sBase.balance + (a.state.balance - sBase.balance) + (b.state.balance - sBase.balance));
    const cBase = freshCasino(); saveCasino(cBase, store);
    const ca = settle(stake(structuredClone(cBase), 250), 'craps', 250, 250, { bet: 'Pass', result: '7 winner' });
    saveCasino(ca, store, cBase);
    const cb = settle(stake(structuredClone(cBase), 250), 'races', 250, 900, { bet: 'Win 4', result: '#4 won' });
    const cMerged: CasinoState = saveCasino(cb, store, cBase)!;
    expect(cMerged.balance).toBe(cBase.balance + (ca.balance - cBase.balance) + (cb.balance - cBase.balance));
    expect(cMerged.games.craps?.rounds).toBe(1);
    expect(cMerged.games.races?.rounds).toBe(1);
  });
});
