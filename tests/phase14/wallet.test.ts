/** Phase 14 (CB-U03): hybrid-wallet reconciliation. Real sessions are played
 * through the games' own state modules (slots spins, casino stake/settle, an
 * Omaha sit-down and hand), the components are rebuilt after every step using
 * exactly the expressions the app uses, and the unified total must equal the
 * sum of the per-game balances at every single step. */
import { describe, expect, it } from 'vitest';
import { unifiedWallet, walletBreakdown, type WalletComponents } from '../../src/stats/wallet';
import { careerStats, type CareerSources } from '../../src/stats/career';
import { freshSlots, playSpin, type SlotsState } from '../../src/slots/state';
import { MACHINES } from '../../src/slots/machines';
import { freshCasino, stake, settle, type CasinoState } from '../../src/casino/wallet';
import { freshPlo, PloTable } from '../../src/plo/table';
import { legalPlo } from '../../src/plo/engine';

/** Deterministic slot randomness (LCG) so the played session is stable. */
const lcg = (seed: number) => { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; }; };

interface Rig {
  cashWallet: number; heroStack: number; tournamentBalance: number;
  bjBalance: number; bjActive: number;
  plo: PloTable; slots: SlotsState; casino: CasinoState;
}
const freshRig = (): Rig => ({
  cashWallet: 1_000_000, heroStack: 0, tournamentBalance: 500_000,
  bjBalance: 250_000, bjActive: 0,
  plo: new PloTable(freshPlo()), slots: freshSlots(), casino: freshCasino(),
});
/** The component expressions, copied from the app's walletComponents(). */
const components = (r: Rig): WalletComponents => ({
  cash: { available: r.cashWallet, inPlay: r.heroStack },
  tournaments: { available: r.tournamentBalance, inPlay: 0 },
  blackjack: { available: r.bjBalance, inPlay: r.bjActive },
  omaha: { available: r.plo.state.balance, inPlay: r.plo.state.active?.stacks[0] ?? 0 },
  slots: { available: r.slots.balance, inPlay: 0 },
  casino: { available: r.casino.balance, inPlay: 0 },
});
const sum = (c: WalletComponents): number => Object.values(c).reduce((a: number, b) => a + (b ? b.available + b.inPlay : 0), 0);
const expectReconciled = (r: Rig) => {
  const c = components(r);
  const w = unifiedWallet(c);
  expect(w.complete).toBe(true);
  expect(w.total).toBe(sum(c));
  expect(w.available).toBe(Object.values(c).reduce((a: number, b) => a + (b?.available ?? 0), 0));
  expect(w.inPlay).toBe(Object.values(c).reduce((a: number, b) => a + (b?.inPlay ?? 0), 0));
  expect(w.buckets.reduce((a, b) => a + b.total, 0)).toBe(w.total);
};

describe('unified wallet reconciliation across played sessions', () => {
  it('holds after every step of a multi-game session', () => {
    const rig = freshRig();
    expectReconciled(rig);
    const startTotal = unifiedWallet(components(rig)).total;

    /* Slots: five real spins at the machine's smallest bet. */
    const machine = MACHINES[0], bet = machine.bets[0], random = lcg(42);
    for (let i = 0; i < 5; i++) { rig.slots = playSpin(rig.slots, machine, bet, random).state; expectReconciled(rig); }

    /* Casino tables: stake a roulette bet and settle it, then a baccarat loss. */
    rig.casino = stake(rig.casino, 2500); expectReconciled(rig);
    rig.casino = settle(rig.casino, 'roulette', 2500, 5000); expectReconciled(rig);
    rig.casino = stake(rig.casino, 1000); expectReconciled(rig);
    rig.casino = settle(rig.casino, 'baccarat', 1000, 0); expectReconciled(rig);

    /* Omaha: sitting down moves money Available → In play; the total must
     * not move and the move must never read as a loss. */
    const beforeSit = unifiedWallet(components(rig));
    rig.plo.sit('1-2', 40);
    expectReconciled(rig);
    const afterSit = unifiedWallet(components(rig));
    expect(afterSit.total).toBe(beforeSit.total);
    expect(afterSit.available).toBe((beforeSit.available ?? 0) - 8000);
    expect(afterSit.inPlay).toBe((beforeSit.inPlay ?? 0) + 8000);

    /* Play the Omaha hand out (hero folds at the first chance, bots finish). */
    let guard = 0;
    while (rig.plo.state.active && rig.plo.state.active.hand.street !== 'complete' && guard++ < 300) {
      if (rig.plo.heroTurn) {
        const legal = legalPlo(rig.plo.state.active.hand);
        rig.plo.act(legal?.check ? { type: 'check' } : { type: 'fold' });
      } else if (rig.plo.botTurn) { rig.plo.planBot(); rig.plo.botStep(); }
      else break;
      expectReconciled(rig);
    }
    expect(rig.plo.state.active?.hand.street).toBe('complete');
    expectReconciled(rig);

    /* Cash and tournament balances move on their own paths. */
    const beforeBuyIn = unifiedWallet(components(rig));
    rig.cashWallet -= 20_000; rig.heroStack += 20_000; expectReconciled(rig); // buy-in: transfer, total steady
    const afterBuyIn = unifiedWallet(components(rig));
    expect(afterBuyIn.total).toBe(beforeBuyIn.total);
    expect(afterBuyIn.available).toBe((beforeBuyIn.available ?? 0) - 20_000);
    expect(afterBuyIn.inPlay).toBe((beforeBuyIn.inPlay ?? 0) + 20_000);
    const afterTransfer = unifiedWallet(components(rig)).total;
    rig.heroStack -= 7_500; expectReconciled(rig); // a lost pot leaves the wallet
    expect(unifiedWallet(components(rig)).total).toBe((afterTransfer ?? 0) - 7_500);
    rig.tournamentBalance += 12_300; expectReconciled(rig); // a tournament prize lands

    /* Blackjack money parked at an open shoe still counts. */
    rig.bjBalance -= 5_000; rig.bjActive += 5_000; expectReconciled(rig);
    expect(unifiedWallet(components(rig)).total).not.toBe(startTotal); // the session really moved money
  });

  it('a component that has not loaded yet makes the total honestly unknown', () => {
    const share = (n: number) => ({ available: n, inPlay: 0 });
    const w = unifiedWallet({ cash: null, tournaments: share(1), blackjack: share(2), omaha: share(3), slots: share(4), casino: share(5) });
    expect(w.complete).toBe(false);
    expect(w.total).toBeNull();
    expect(w.available).toBeNull();
    expect(w.inPlay).toBeNull();
  });

  it('a gift credit raises the balance but never the results', () => {
    /* Career results come from settled play records only. Crediting the
     * daily gift to the cash bankroll (an adjustment, not a hand) must move
     * the unified total and leave every win/loss figure untouched. */
    const rig = freshRig();
    const sources: CareerSources = { cashHands: [], tournamentEvents: [], blackjackRounds: [], omahaHands: [], slots: rig.slots, casino: rig.casino };
    const before = walletBreakdown(components(rig), careerStats(sources), 0);
    rig.cashWallet += 10_000; // the gift lands, via the ledger adjustment path
    const after = walletBreakdown(components(rig), careerStats(sources), 0);
    expect(after.total).toBe((before.total ?? 0) + 10_000);
    expect(after.totalNet).toBe(before.totalNet);
    expect(after.rows.find(r => r.id === 'cash')?.net).toBe(before.rows.find(r => r.id === 'cash')?.net);
  });
});

describe('wallet breakdown rows', () => {
  const shares = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { available: v, inPlay: 0 }])) as WalletComponents;
  it('shows per-game nets, shared-wallet notes, and never double-counts heads-up', () => {
    const slots = freshSlots();
    slots.machines['test'] = { spins: 10, wagered: 1000, won: 1400, biggest: 500, features: 1 };
    const sources: CareerSources = { cashHands: [], tournamentEvents: [], blackjackRounds: [], omahaHands: [], slots, casino: freshCasino() };
    const career = careerStats(sources);
    const view = walletBreakdown(shares({ cash: 100, tournaments: 200, blackjack: 300, omaha: 400, slots: 500, casino: 600 }), career, 250);
    expect(view.total).toBe(2100);
    expect(view.rows.map(r => r.id)).toEqual(['cash', 'heads-up', 'tournaments', 'blackjack', 'omaha', 'slots', 'roulette', 'craps', 'baccarat', 'races']);
    expect(view.rows.find(r => r.id === 'slots')?.net).toBe(400);
    const hu = view.rows.find(r => r.id === 'heads-up')!;
    expect(hu.available).toBeNull();
    expect(hu.balanceNote).toMatch(/cash bankroll/);
    expect(hu.net).toBe(250);
    /* The four casino-table games keep separate results on one shared balance. */
    expect(view.rows.find(r => r.id === 'baccarat')?.balanceNote).toMatch(/casino tables balance/);
    expect(view.rows.find(r => r.id === 'baccarat')?.available).toBeNull();
    /* Tournament stacks inside a running event are never wealth. */
    expect(view.rows.find(r => r.id === 'tournaments')?.balanceNote).toMatch(/scoring units/);
    /* Heads-up is a view into the cash result, not an extra slice of money. */
    expect(view.totalNet).toBe(career.totalNet);
  });

  it('a pending game reports its net as unknown, not zero', () => {
    const sources: CareerSources = { cashHands: [], tournamentEvents: [], blackjackRounds: [{ net: -500, bet: 1000 }], omahaHands: [], slots: freshSlots(), casino: freshCasino() };
    const career = careerStats(sources);
    const zero = shares({ cash: 0, tournaments: 0, blackjack: 0, omaha: 0, slots: 0, casino: 0 });
    const view = walletBreakdown(zero, career, null, ['blackjack']);
    expect(view.rows.find(r => r.id === 'blackjack')?.net).toBeNull();
    const loaded = walletBreakdown(zero, career, null);
    expect(loaded.rows.find(r => r.id === 'blackjack')?.net).toBe(-500);
  });
});
