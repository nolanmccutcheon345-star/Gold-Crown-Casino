/** Phase 14 (CB-U01): all-in equity between tabled hands. Exact spots are
 * checked against hand-counted values; Monte Carlo spots against known
 * ranges, plus determinism (same cards, same number, every time). */
import { describe, expect, it } from 'vitest';
import { allInEquity } from '../../src/core/equity';
import type { Card } from '../../src/contracts';

const H = (s: string): Card[] => s.split(' ') as Card[];

describe('allInEquity — exact enumeration', () => {
  it('river: a made winner is 100%, the loser 0%', () => {
    const r = allInEquity([H('As Ad'), H('Kh Kd')], H('2c 7d 9h Ts 3c'));
    expect(r.exact).toBe(true);
    expect(r.runouts).toBe(1);
    expect(r.equities).toEqual([1, 0]);
  });

  it('river: a board everyone plays splits evenly', () => {
    const r = allInEquity([H('2d 3d'), H('4h 5h')], H('As Ks Qs Js Ts'));
    expect(r.equities).toEqual([0.5, 0.5]);
  });

  it('turn: pocket aces over one pair is exactly 39/44', () => {
    /* Hero AA vs KQ (pair of kings) on Kc 7d 2h 9s: the aces are already
     * ahead; villain wins only with a king (2) or a queen (3). Board-pairing
     * rivers give both two pair and the aces still win. */
    const r = allInEquity([H('As Ad'), H('Kh Qd')], H('Kc 7d 2h 9s'));
    expect(r.exact).toBe(true);
    expect(r.runouts).toBe(44);
    expect(r.equities[0]).toBeCloseTo(39 / 44, 10);
    expect(r.equities[0] + r.equities[1]).toBeCloseTo(1, 10);
  });

  it('turn: a two-outer is exactly 2/44', () => {
    /* Hero 55 against AK's pair of aces on Ac 7d 2h 9s: only the two
     * remaining fives win; board pairs and broadway rivers all leave the
     * aces (or aces-up) in front. */
    const r = allInEquity([H('5s 5d'), H('As Kd')], H('Ac 7d 2h 9s'));
    expect(r.exact).toBe(true);
    expect(r.equities[0]).toBeCloseTo(2 / 44, 10);
  });

  it('flop: enumerates all 990 runouts for a flush draw plus an overcard ace', () => {
    const r = allInEquity([H('Ah Kh'), H('Qd As')], H('Qh 7h 2c'));
    expect(r.exact).toBe(true);
    expect(r.runouts).toBe(990);
    /* Hand count: 438 winning runouts of 990 (any heart, an ace, or the
     * jack-ten runout) — allow a small margin for the count, not the method. */
    expect(r.equities[0]).toBeGreaterThan(0.42);
    expect(r.equities[0]).toBeLessThan(0.47);
    expect(r.equities[0] + r.equities[1]).toBeCloseTo(1, 10);
  });

  it('multiway on the turn is still exact and sums to one', () => {
    const r = allInEquity([H('As Ad'), H('Kh Kd'), H('Qc Qd')], H('2c 7d 9h Ts'));
    expect(r.exact).toBe(true);
    expect(r.equities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.equities[0]).toBeGreaterThan(r.equities[1]);
    /* Kings and queens are symmetric here: each holds a pair needing one of
     * its two remaining mates, so their equities are exactly equal. */
    expect(r.equities[1]).toBeCloseTo(r.equities[2], 10);
    expect(r.equities[1]).toBeCloseTo(2 / 42, 10);
  });
});

describe('allInEquity — deterministic Monte Carlo before the flop', () => {
  it('AA vs KK lands in the known band and is perfectly repeatable', () => {
    const a = allInEquity([H('As Ad'), H('Kh Kd')], []);
    const b = allInEquity([H('As Ad'), H('Kh Kd')], []);
    expect(a.exact).toBe(false);
    expect(a.equities).toEqual(b.equities);
    expect(a.equities[0]).toBeGreaterThan(0.79);
    expect(a.equities[0]).toBeLessThan(0.85);
    expect(a.equities[0] + a.equities[1]).toBeCloseTo(1, 10);
  });

  it('three-way preflop: shares sum to one and the aces lead', () => {
    const r = allInEquity([H('As Ad'), H('Kh Kd'), H('Qc Qd')], []);
    expect(r.exact).toBe(false);
    expect(r.equities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.equities[0]).toBeGreaterThan(0.55);
    expect(r.equities[0]).toBeGreaterThan(r.equities[1]);
    expect(r.equities[1]).toBeGreaterThan(r.equities[2]);
  });

  it('a dominated ace is priced like one', () => {
    const r = allInEquity([H('As Kd'), H('Ah Ad')], []);
    expect(r.equities[0]).toBeLessThan(0.15);
  });
});

describe('allInEquity — input discipline', () => {
  it('rejects a duplicated card, a short hand, and a single hand', () => {
    expect(() => allInEquity([H('As Ad'), H('As Kd')], [])).toThrow();
    expect(() => allInEquity([H('As'), H('Kh Kd')], [])).toThrow();
    expect(() => allInEquity([H('As Ad')], [])).toThrow();
    expect(() => allInEquity([H('As Ad'), H('Kh Kd')], H('As 2c 3d'))).toThrow();
  });
});
