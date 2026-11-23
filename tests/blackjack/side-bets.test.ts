import { describe, expect, it } from 'vitest';
import { BLACKJACK_TABLES, SIDE_BETS } from '../../src/blackjack/presets';
import { dealerTotal, isStraight, settleSideBet, sideBetLimits, sideBetNet, sideBetPaytable, sideBetTiming, type SideBetContext } from '../../src/blackjack/side-bets';
import type { Card } from '../../src/contracts';

const at = (player: [Card, Card], up: Card, extra: Partial<SideBetContext> = {}): SideBetContext => ({ decks: 6, player, up, dealerBlackjack: null, dealerFinal: null, ...extra });
const pays = (id: Parameters<typeof settleSideBet>[0], context: SideBetContext) => { const result = settleSideBet(id, context); return result === undefined ? 'wait' : result === null ? 'lose' : result.to1; };

describe('side-bet paytables', () => {
  it('has a descending paytable for every catalogue side bet at two and six decks', () => {
    for (const bet of SIDE_BETS) for (const decks of [2, 6]) { const table = sideBetPaytable(bet.id, decks); expect(table.length).toBeGreaterThan(0); expect(new Set(table.map(item => item.key)).size).toBe(table.length); table.forEach((item, index) => { expect(item.to1).toBeGreaterThan(0); if (index) expect(item.to1).toBeLessThan(table[index - 1].to1); }); }
    expect(sideBetPaytable('match-the-dealer', 2).map(item => item.to1)).toEqual([19, 4]); expect(sideBetPaytable('match-the-dealer', 6).map(item => item.to1)).toEqual([11, 4]); expect(sideBetPaytable('match-the-dealer', 8).map(item => item.to1)).toEqual([14, 3]);
  });
});

describe('21+3', () => {
  it('pays 9 to 1 for a flush, straight, three of a kind or straight flush, and nothing else', () => {
    expect(pays('twenty-one-plus-three', at(['2h', '9h'], 'Kh'))).toBe(9); expect(pays('twenty-one-plus-three', at(['5c', '6d'], '7h'))).toBe(9); expect(pays('twenty-one-plus-three', at(['8c', '8d'], '8h'))).toBe(9); expect(pays('twenty-one-plus-three', at(['5s', '6s'], '7s'))).toBe(9);
    expect(pays('twenty-one-plus-three', at(['8c', '8d'], '9h'))).toBe('lose'); expect(pays('twenty-one-plus-three', at(['2h', '9h'], 'Ks'))).toBe('lose');
  });
  it('treats the ace as high or low in a straight but never in the middle', () => {
    expect(isStraight(['Ac', '2d', '3h'])).toBe(true); expect(isStraight(['Qc', 'Kd', 'Ah'])).toBe(true); expect(isStraight(['Kc', 'Ad', '2h'])).toBe(false); expect(isStraight(['9c', 'Jd', 'Th'])).toBe(true); expect(isStraight(['9c', '9d', 'Th'])).toBe(false);
  });
});

describe('Perfect Pairs', () => {
  it('grades a pair by suit and colour', () => {
    expect(pays('perfect-pairs', at(['7h', '7h'], '2c'))).toBe(25); expect(pays('perfect-pairs', at(['7h', '7d'], '2c'))).toBe(12); expect(pays('perfect-pairs', at(['7h', '7s'], '2c'))).toBe(6); expect(pays('perfect-pairs', at(['7c', '7s'], '2c'))).toBe(12);
    expect(pays('perfect-pairs', at(['Kh', 'Qh'], '2c'))).toBe('lose'); expect(pays('perfect-pairs', at(['Th', 'Td'], '2c'))).toBe(12);
  });
});

describe('Lucky Ladies', () => {
  it('pays any 20, more when suited or matched', () => {
    expect(pays('lucky-ladies', at(['Kh', 'Qs'], '2c'))).toBe(4); expect(pays('lucky-ladies', at(['Ah', '9s'], '2c'))).toBe(4); expect(pays('lucky-ladies', at(['Ks', 'Qs'], '2c'))).toBe(10); expect(pays('lucky-ladies', at(['As', '9s'], '2c'))).toBe(10); expect(pays('lucky-ladies', at(['Ks', 'Ks'], '2c'))).toBe(25);
    expect(pays('lucky-ladies', at(['Ks', '9s'], '2c'))).toBe('lose'); expect(pays('lucky-ladies', at(['As', 'Ks'], '2c'))).toBe('lose');
  });
  it('waits for the dealer check before paying a queen of hearts pair', () => {
    const queens: [Card, Card] = ['Qh', 'Qh'];
    expect(sideBetTiming('lucky-ladies', { player: queens })).toBe('dealer-check'); expect(sideBetTiming('lucky-ladies', { player: ['Kh', 'Qh'] })).toBe('deal');
    expect(pays('lucky-ladies', at(queens, 'Ac'))).toBe('wait'); expect(pays('lucky-ladies', at(queens, 'Ac', { dealerBlackjack: true }))).toBe(1000); expect(pays('lucky-ladies', at(queens, 'Ac', { dealerBlackjack: false }))).toBe(200);
    expect(pays('lucky-ladies', at(['Qh', 'Qd'], 'Ac'))).toBe(4);
  });
});

describe('Match the Dealer', () => {
  it('pays each matching card separately, by deck count', () => {
    expect(pays('match-the-dealer', at(['8c', '3d'], '8h'))).toBe(4); expect(pays('match-the-dealer', at(['8h', '3d'], '8h'))).toBe(11); expect(pays('match-the-dealer', at(['8h', '8c'], '8h'))).toBe(15); expect(pays('match-the-dealer', at(['8h', '8h'], '8h'))).toBe(22); expect(pays('match-the-dealer', at(['8c', '8d'], '8h'))).toBe(8);
    expect(pays('match-the-dealer', at(['9c', '3d'], '8h'))).toBe('lose'); expect(pays('match-the-dealer', at(['Kc', '3d'], 'Qh'))).toBe('lose');
    expect(pays('match-the-dealer', at(['8h', '8c'], '8h', { decks: 2 }))).toBe(23); expect(settleSideBet('match-the-dealer', at(['8h', '8c'], '8h'))!.outcome).toBe('1 suited match and 1 unsuited match');
  });
});

describe('Buster Blackjack and Push 22', () => {
  it('totals a dealer hand with soft aces', () => { expect(dealerTotal(['As', '6d'])).toBe(17); expect(dealerTotal(['As', '6d', 'Kc'])).toBe(17); expect(dealerTotal(['As', 'Ad', '9c'])).toBe(21); expect(dealerTotal(['Ts', '6d', '6c'])).toBe(22); });
  it('waits for the finished dealer hand and pays more for longer busts', () => {
    const context = (dealerFinal: Card[] | null) => at(['Ts', '7d'], '6c', { dealerFinal });
    expect(sideBetTiming('buster', { player: ['Ts', '7d'] })).toBe('dealer-final'); expect(pays('buster', context(null))).toBe('wait'); expect(pays('push-22', context(null))).toBe('wait');
    expect(pays('buster', context(['6c', 'Td', '8h']))).toBe(2); expect(pays('buster', context(['6c', '2d', '4h', 'Kc']))).toBe(2); expect(pays('buster', context(['6c', '2d', '2h', '3c', 'Kc']))).toBe(4); expect(pays('buster', context(['2c', '2d', '2h', '3c', '3d', 'Kc']))).toBe(15);
    expect(pays('buster', context(['Ac', '2d', '2h', '3c', '3d', '2s', 'Kc']))).toBe(50); expect(pays('buster', context(['Ac', 'Ad', '2h', '2c', '2d', '3s', '3c', 'Kc']))).toBe(250); expect(pays('buster', context(['6c', 'Td', '4h']))).toBe('lose'); expect(pays('buster', context(['Ac', 'Kd']))).toBe('lose');
    expect(pays('push-22', context(['6c', 'Td', '6h']))).toBe(11); expect(pays('push-22', context(['6c', 'Td', '7h']))).toBe('lose'); expect(pays('push-22', context(['6c', 'Td', '5h']))).toBe('lose');
  });
});

describe('side-bet money', () => {
  it('nets winnings or minus the stake, in whole cents for whole-dollar stakes', () => {
    expect(sideBetNet(500, { key: 'any', outcome: '', to1: 9 })).toBe(4500); expect(sideBetNet(500, null)).toBe(-500);
    for (const bet of SIDE_BETS) for (const decks of [2, 6]) for (const item of sideBetPaytable(bet.id, decks)) expect(Number.isInteger(sideBetNet(100, item))).toBe(true);
  });
  it('limits a side bet to the table band and never above the main bet', () => {
    const low = BLACKJACK_TABLES.find(table => table.id === 'casino-5')!, mid = BLACKJACK_TABLES.find(table => table.id === 'casino-25')!;
    expect(sideBetLimits(low, 500)).toEqual({ min: 100, max: 500 }); expect(sideBetLimits(low, 20000)).toEqual({ min: 100, max: 2500 }); expect(sideBetLimits(mid, 5000)).toEqual({ min: 500, max: 5000 }); expect(sideBetLimits(mid, 100000)).toEqual({ min: 500, max: 10000 }); expect(sideBetLimits(low, 0).max).toBe(0);
  });
});
