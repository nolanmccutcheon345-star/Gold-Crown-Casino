import { describe, expect, it } from 'vitest';
import { checkDailyBook, dailyObjectives, ensureDay, fixBjBaseline, freshDailyBook, handStreak, localDayKey, setSessionGoal, type DailyBaselines } from '../../src/stats/daily';
import type { StoredHand } from '../../src/session/types';

/* Phase 10 (fun #28/#2/#4): the daily card record. Objectives complete only when an
 * instrumented counter moves; the session goal is the player's own number; streaks
 * are counted from settled hand nets in order. */
const base: DailyBaselines = { cashHands: 100, slotsSpins: 500, slotsFeatures: 4, ladderBeaten: 2, bjRounds: 40 };
const hand = (number: number, net: number): StoredHand => ({ number, net } as StoredHand);

describe('daily record', () => {
  it('issues a day once, keeps baselines, and prunes to 14 days', () => {
    let book = freshDailyBook();
    book = ensureDay(book, '2026-11-25', base);
    const again = ensureDay(book, '2026-11-25', { ...base, cashHands: 999 });
    expect(again).toBe(book);
    expect(book.days['2026-11-25'].baselines.cashHands).toBe(100);
    for (let d = 1; d <= 20; d++) book = ensureDay(book, `2026-12-${String(d).padStart(2, '0')}`, base);
    expect(Object.keys(book.days).length).toBe(14);
  });

  it('round-trips through the strict checker and rejects damage', () => {
    let book = ensureDay(freshDailyBook(), '2026-11-25', base, true);
    book = setSessionGoal(book, { sessionId: 's1', targetCents: 5000 });
    const round = checkDailyBook(JSON.parse(JSON.stringify(book)));
    expect(round.days['2026-11-25'].bjPending).toBe(true);
    expect(round.sessionGoal).toEqual({ sessionId: 's1', targetCents: 5000 });
    expect(() => checkDailyBook({ version: 2, days: {}, sessionGoal: null })).toThrow();
    expect(() => checkDailyBook({ version: 1, days: { '2026-11-25': { date: '2026-11-26', baselines: base } }, sessionGoal: null })).toThrow();
  });

  it('fixBjBaseline only replaces a provisional baseline', () => {
    let book = ensureDay(freshDailyBook(), '2026-11-25', { ...base, bjRounds: 0 }, true);
    book = fixBjBaseline(book, '2026-11-25', 40);
    expect(book.days['2026-11-25'].baselines.bjRounds).toBe(40);
    expect(book.days['2026-11-25'].bjPending).toBeUndefined();
    expect(fixBjBaseline(book, '2026-11-25', 99)).toBe(book);
  });

  it('local day keys use the device timezone calendar day', () => {
    expect(localDayKey(new Date(2026, 10, 25, 23, 59))).toBe('2026-11-25');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('daily objectives', () => {
  it('picks a stable three for the date and completes them from counter movement only', () => {
    const counters = { ...base, handsToday: 0, showdownFreePotsToday: 0 };
    const a = dailyObjectives('2026-11-25', counters, base);
    expect(a).toHaveLength(3);
    expect(dailyObjectives('2026-11-25', counters, base).map(o => o.id)).toEqual(a.map(o => o.id));
    const moved = dailyObjectives('2026-11-25', { ...counters, handsToday: 10, showdownFreePotsToday: 3, slotsSpins: base.slotsSpins + 25, slotsFeatures: base.slotsFeatures + 1, bjRounds: base.bjRounds + 20, ladderBeaten: base.ladderBeaten + 1 }, base);
    for (const o of moved) expect(o.done, o.id).toBe(true);
    const none = dailyObjectives('2026-11-25', counters, base);
    for (const o of none) expect(o.done, o.id).toBe(false);
  });

  it('objective wording stays factual (events, never inferences)', async () => {
    const { OBJECTIVE_POOL } = await import('../../src/stats/daily');
    for (const o of OBJECTIVE_POOL) expect(o.label).not.toMatch(/bluff|tilt|lucky/i);
  });
});

describe('hand streaks (#4)', () => {
  it('counts the tail run of wins or losses in hand order; a push ends it', () => {
    expect(handStreak([hand(1, 100), hand(2, -50), hand(3, 200), hand(4, 300)])).toEqual({ kind: 'won', count: 2 });
    expect(handStreak([hand(1, 100), hand(2, -50), hand(3, -25)])).toEqual({ kind: 'lost', count: 2 });
    expect(handStreak([hand(1, 100), hand(2, 0)])).toBeNull();
    expect(handStreak([])).toBeNull();
  });
});

describe('heads-up pots exact net (fun #1 exact variant)', () => {
  it('counts only pots where hero and the named opponent were the sole contributors', async () => {
    const { headsUpPotsNet } = await import('../../src/ui/recap');
    const mk = (net: number, seats: { id: number; name: string; totalCommitted: number }[]) => ({ net, view: { seats } } as never);
    const hands = [
      mk(500, [{ id: 0, name: 'You', totalCommitted: 500 }, { id: 1, name: 'Marco', totalCommitted: 500 }]),
      mk(-300, [{ id: 0, name: 'You', totalCommitted: 300 }, { id: 1, name: 'Marco', totalCommitted: 300 }, { id: 2, name: 'Sal', totalCommitted: 100 }]),
      mk(200, [{ id: 0, name: 'You', totalCommitted: 200 }, { id: 2, name: 'Sal', totalCommitted: 200 }]),
      mk(-100, [{ id: 0, name: 'You', totalCommitted: 100 }, { id: 1, name: 'Marco', totalCommitted: 0 }]),
    ];
    expect(headsUpPotsNet(hands, 'Marco')).toEqual({ pots: 1, net: 500 });
    expect(headsUpPotsNet(hands, 'Sal')).toEqual({ pots: 1, net: 200 });
  });
});
