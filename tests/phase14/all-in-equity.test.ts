/** Phase 14 (CB-U01): the equity strip's gating. It may only appear for a
 * completed all-in showdown where every continuing hand is tabled in the
 * view — the helper reads the view model alone, so a hand the engine did not
 * reveal (empty hole in the view) can never produce a number. */
import { describe, expect, it } from 'vitest';
import { allInEquitySteps } from '../../src/ui/all-in-equity';
import type { Card, GameEvent, HeroViewModel } from '../../src/contracts';

const seat = (id: number, hole: string, over: Record<string, unknown> = {}) => ({
  id, name: id === 0 ? 'You' : `Bot ${id}`, stack: 0, startingStack: 10000,
  hole: (hole ? hole.split(' ') : []) as Card[], streetCommitted: 0, totalCommitted: 10000,
  folded: false, allIn: true, ...over,
});
const action = (seatId: number, street: string): GameEvent => ({ id: `${seatId}-${street}`, handId: 'h1', revision: 1, type: 'action', seatId, street: street as GameEvent['street'] });
const view = (over: Record<string, unknown> = {}): HeroViewModel => ({
  handId: 'h1', revision: 9, profile: {}, button: 0, smallBlindSeat: 0, bigBlindSeat: 1,
  seats: [seat(0, 'As Ad', { stack: 20000, allIn: false }), seat(1, 'Kh Kd')],
  street: 'complete', board: ['2c', '7d', '9h', 'Ts', '3c'] as Card[], actor: null,
  pot: 0, pots: [], rake: 0, payouts: { 0: 20000 }, legal: {}, events: [action(1, 'preflop'), action(0, 'flop')],
  uncalledBet: null, handLabels: { 0: 'Pair of Aces', 1: 'Pair of Kings' }, ...over,
} as unknown as HeroViewModel);

describe('allInEquitySteps', () => {
  it('reports equity from the street the money went in, ending at the result', () => {
    const steps = allInEquitySteps(view(), 0);
    expect(steps?.map(s => s.street)).toEqual(['Flop', 'Turn', 'River']);
    expect(steps?.at(-1)?.pct).toBe(100); // aces held on this board
    expect(steps?.[0]?.pct).toBeGreaterThan(80); // AA vs KK on a dry flop
  });

  it('starts preflop when the money went in preflop', () => {
    const steps = allInEquitySteps(view({ events: [action(0, 'preflop')] }), 0);
    expect(steps?.map(s => s.street)).toEqual(['Preflop', 'Flop', 'Turn', 'River']);
    expect(steps?.[0]?.pct).toBeGreaterThan(75);
    expect(steps?.[0]?.pct).toBeLessThan(88);
  });

  it('stays silent when a continuing hand was never tabled', () => {
    const v = view({ seats: [seat(0, 'As Ad', { stack: 20000, allIn: false }), seat(1, '')] });
    expect(allInEquitySteps(v, 0)).toBeNull();
  });

  it('stays silent when the hero folded, nobody was all-in, or the money went in on the river', () => {
    expect(allInEquitySteps(view({ seats: [seat(0, 'As Ad', { folded: true }), seat(1, 'Kh Kd')] }), 0)).toBeNull();
    const noAllIn = view({ seats: [seat(0, 'As Ad', { totalCommitted: 4000, allIn: false }), seat(1, 'Kh Kd', { totalCommitted: 4000, allIn: false })] });
    expect(allInEquitySteps(noAllIn, 0)).toBeNull();
    expect(allInEquitySteps(view({ events: [action(0, 'river')] }), 0)).toBeNull();
    expect(allInEquitySteps(view({ street: 'turn' }), 0)).toBeNull();
  });

  it('side pot: deeper stacks betting later streets do not move the hero\u2019s starting point', () => {
    /* Hero all-in on the flop; two deeper stacks keep betting the turn and
     * river for a side pot. The hero's steps still start where HIS money
     * went in — and nothing was shown while those decisions were live,
     * because the strip only exists on this completed, tabled frame. */
    const v = view({
      seats: [seat(0, 'As Ad', { stack: 30000 }), seat(1, 'Kh Kd'), seat(2, 'Qc Qd', { stack: 5000, allIn: false, totalCommitted: 15000, startingStack: 20000 })],
      events: [action(1, 'preflop'), action(0, 'flop'), action(1, 'turn'), action(2, 'turn'), action(1, 'river'), action(2, 'river')],
    });
    const steps = allInEquitySteps(v, 0);
    expect(steps?.map(s => s.street)).toEqual(['Flop', 'Turn', 'River']);
    expect(steps?.at(-1)?.pct).toBe(100);
  });

  it('a spectator seat (heroId -1) never gets a strip', () => {
    expect(allInEquitySteps(view(), -1)).toBeNull();
  });
});
