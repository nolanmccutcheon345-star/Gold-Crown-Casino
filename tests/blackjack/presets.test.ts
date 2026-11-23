import { describe, expect, it } from 'vitest';
import { BLACKJACK_STARTING_BALANCE, BLACKJACK_TABLES, blackjackPayout, SIDE_BETS, sideBet, tableRules } from '../../src/blackjack/presets';

describe('blackjack catalogue', () => {
  it('starts every player with $2,000 and offers $2 and $5 tables, two-deck and six-deck games', () => {
    expect(BLACKJACK_STARTING_BALANCE).toBe(200000);
    expect(new Set(BLACKJACK_TABLES.map(table => table.id)).size).toBe(BLACKJACK_TABLES.length);
    const mins = BLACKJACK_TABLES.map(table => table.minBet);
    expect(mins.includes(200)).toBe(true); expect(mins.includes(500)).toBe(true);
    expect(new Set(BLACKJACK_TABLES.map(table => table.decks))).toEqual(new Set([2, 6]));
    expect(new Set(BLACKJACK_TABLES.map(table => table.group))).toEqual(new Set(['home', 'casino', 'high']));
    expect(BLACKJACK_TABLES.some(table => table.blackjackPays === '6:5')).toBe(true); expect(BLACKJACK_TABLES.some(table => table.variant === 'free-bet')).toBe(true);
  });
  it.each(BLACKJACK_TABLES.map(table => [table.id, table] as const))('%s is internally consistent', (_id, table) => {
    expect(table.minBet % 100).toBe(0); expect(table.maxBet).toBeGreaterThan(table.minBet); expect(table.minBet).toBeLessThanOrEqual(BLACKJACK_STARTING_BALANCE);
    expect(table.penetration).toBeGreaterThan(0.5); expect(table.penetration).toBeLessThan(0.9); expect(table.maxHands).toBe(4);
    expect(table.chips.length).toBe(4); expect(table.chips[0]).toBeLessThanOrEqual(Math.max(table.minBet, 2500));
    table.chips.forEach((chip, index) => { expect(chip % 100).toBe(0); if (index) expect(chip).toBeGreaterThan(table.chips[index - 1]); });
    // Every legal bet can be built from the chips: the minimum is a multiple of the smallest chip.
    expect(table.minBet % table.chips[0]).toBe(0);
    table.sideBets.forEach(id => expect(sideBet(id).name.length).toBeGreaterThan(0));
    expect(new Set(table.sideBets).size).toBe(table.sideBets.length);
    const rules = tableRules(table); expect(rules[0]).toBe(`${table.decks} decks`); expect(rules.includes('Dealer 22 pushes')).toBe(table.variant === 'free-bet');
    if (table.variant === 'free-bet') expect(table.sideBets).toEqual(['push-22']);
  });
  it('lists every side bet with a descending paytable', () => {
    expect(SIDE_BETS.map(bet => bet.id)).toEqual(['twenty-one-plus-three', 'perfect-pairs', 'lucky-ladies', 'match-the-dealer', 'buster', 'push-22']);
    for (const bet of SIDE_BETS) bet.pays.forEach((row, index) => { expect(row.to1).toBeGreaterThan(0); if (index) expect(row.to1).toBeLessThan(bet.pays[index - 1].to1); });
    expect(BLACKJACK_TABLES.flatMap(table => table.sideBets).every(id => SIDE_BETS.some(bet => bet.id === id))).toBe(true);
  });
  it('pays a blackjack in whole cents at 3 to 2 and 6 to 5', () => {
    expect(blackjackPayout({ blackjackPays: '3:2' }, 500)).toBe(750); expect(blackjackPayout({ blackjackPays: '6:5' }, 500)).toBe(600);
    expect(blackjackPayout({ blackjackPays: '3:2' }, 200)).toBe(300); expect(blackjackPayout({ blackjackPays: '6:5' }, 200)).toBe(240);
    for (const table of BLACKJACK_TABLES) for (let bet = table.minBet; bet <= Math.min(table.maxBet, table.minBet + 5000); bet += 100) expect(Number.isInteger(blackjackPayout(table, bet))).toBe(true);
    expect(() => blackjackPayout({ blackjackPays: '3:2' }, 250)).toThrow(); expect(() => blackjackPayout({ blackjackPays: '3:2' }, 0)).toThrow();
  });
});
