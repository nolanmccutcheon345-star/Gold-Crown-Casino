/** Phase 14 (design review, crash/reload): settle exactly once. Each leg
 * interrupts a different game mid-flight — a slots feature, a blackjack
 * split, a tournament hand decision, a cash all-in — reloads from the
 * durable store, and proves the final balance is the one the uninterrupted
 * game produces, with the settlement recorded exactly once. */
import { describe, expect, it } from 'vitest';
import { freshSlots, playSpin, readSlots, saveSlots, type SlotsState } from '../../src/slots/state';
import { MACHINES } from '../../src/slots/machines';
import { BlackjackController } from '../../src/blackjack/controller';
import { MemoryBlackjackPersistence } from '../../src/blackjack/persistence';
import { emptySession, initialBlackjackData } from '../../src/blackjack/runtime';
import * as bjEngine from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { TournamentController } from '../../src/tournament/controller';
import { MemoryTournamentPersistence } from '../../src/tournament/persistence';
import { SessionController, DEFAULT_SETTINGS } from '../../src/session/controller';
import type { AppData, CashSettings, PersistencePort } from '../../src/session/types';
import { legalActions } from '../../src/core/engine';
import type { Action } from '../../src/contracts';

const lcg = (seed: number) => { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; }; };

describe('slots: reload mid-feature settles the feature exactly once', () => {
  it('a restored state continues to the identical balance trajectory', () => {
    /* Find a deterministic feature spin (free spins, hold & spin, wheel or
     * pick) by scanning seeds — the feature's money settles in the same
     * transition that starts its presentation, so the reload point is the
     * saved state right after that spin. */
    let found: { machine: (typeof MACHINES)[number]; seed: number } | null = null;
    outer: for (const machine of MACHINES) {
      for (let seed = 1; seed <= 4000; seed++) {
        const r = playSpin(freshSlots(), machine, machine.bets[0], lcg(seed));
        if (r.result.free || r.result.hold || r.result.wheel || r.result.pick) { found = { machine, seed }; break outer; }
      }
    }
    expect(found).not.toBeNull();
    const { machine, seed } = found!;
    const bet = machine.bets[0];
    const spinAt = (state: SlotsState, i: number) => playSpin(state, machine, bet, lcg(seed + i * 7919)).state;

    /* Uninterrupted run: five spins, the second being the feature. */
    let a = freshSlots(); a = spinAt(a, 0); a = playSpin(a, machine, bet, lcg(seed)).state;
    const aAfterFeature = structuredClone(a);
    a = spinAt(a, 2); a = spinAt(a, 3); a = spinAt(a, 4);

    /* Reload run: same spins, but the state is saved and re-read (a reload)
     * immediately after the feature spin, before the remaining spins. */
    const store = { map: new Map<string, string>(), getItem(k: string) { return this.map.get(k) ?? null; }, setItem(k: string, v: string) { this.map.set(k, v); } };
    let b = freshSlots(); b = spinAt(b, 0); b = playSpin(b, machine, bet, lcg(seed)).state;
    saveSlots(b, store);
    const restored = readSlots(store).state;
    expect(restored).toEqual(aAfterFeature); // the feature money is there, once
    b = spinAt(restored, 2); b = spinAt(b, 3); b = spinAt(b, 4);
    expect(b.balance).toBe(a.balance);
    expect(b.machines[machine.id]).toEqual(a.machines[machine.id]);
  }, 120000);
});

describe('blackjack: reload mid-split settles exactly once', () => {
  const table = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!;
  function stacked(faces: string[]) {
    const shoe = bjEngine.orderedBlackjackShoe(table.decks), first: bjEngine.ShoeCard[] = [];
    for (const face of faces) { const at = shoe.findIndex(c => c.split(':')[1] === face); if (at < 0) throw Error('Fixture face missing'); first.push(...shoe.splice(at, 1)); }
    return [...first, ...shoe];
  }
  async function setup() {
    const port = new MemoryBlackjackPersistence(), d = initialBlackjackData();
    d.active = { id: 'segment-1', sessionId: 'session-1', startedAt: '2026-11-16', prior: emptySession(), reviews: [], engine: bjEngine.createBlackjackState(table, stacked(['8c', '6c', '8d', 'Td', '3c', '2d', 'Tc', '9d', '5c']), { ante: 50 }) };
    await port.commit(null, d, []);
    const c = new BlackjackController(port); await c.init(); return { port, c };
  }
  async function playOut(c: BlackjackController) {
    for (let i = 0; i < 24; i++) {
      const round = c.publicState?.round; if (!round || round.phase === 'settled') return;
      const legal = c.publicState!.legalActions;
      const action = round.phase === 'insurance' ? 'decline-insurance' : legal.includes('stand') ? 'stand' : legal[0];
      await c.act(action as never, c.data!.revision);
    }
    throw Error('round did not settle');
  }
  it('the reloaded controller finishes the split to the control balance, one settlement', async () => {
    const control = await setup();
    await control.c.deal(500, control.c.data!.revision);
    await control.c.act('split', control.c.data!.revision);
    await playOut(control.c);
    const controlBalance = control.c.data!.balance;
    const controlSettles = control.c.data!.active!.engine.ledger.filter(l => l.kind === 'settle').length;
    expect(controlSettles).toBeGreaterThanOrEqual(1);

    const run = await setup();
    await run.c.deal(500, run.c.data!.revision);
    await run.c.act('split', run.c.data!.revision);
    const reloaded = new BlackjackController(run.port); await reloaded.init();
    expect(reloaded.publicState).toEqual(run.c.publicState); // mid-split state intact
    await playOut(reloaded);
    expect(reloaded.data!.balance).toBe(controlBalance);
    expect(reloaded.data!.active!.engine.ledger.filter(l => l.kind === 'settle')).toHaveLength(controlSettles);
    /* A stale repeat of the last action cannot settle anything twice. */
    const endBalance = reloaded.data!.balance;
    await reloaded.act('stand', reloaded.data!.revision - 1).catch(() => undefined);
    expect(reloaded.data!.balance).toBe(endBalance);
  }, 60000);
});

describe('tournaments: reload mid-event never re-charges or double-settles', () => {
  it('entry is charged once and a prepared decision survives reload, committed once', async () => {
    const port = new MemoryTournamentPersistence(), c = new TournamentController(port);
    await c.init();
    await c.startEvent('home-20', 6, 'fast');
    expect(c.error).toBe('');
    const balanceAfterEntry = c.data!.balance;
    expect(c.data!.ledger.filter(r => r.kind === 'entry')).toHaveLength(1);

    const reloaded = new TournamentController(port); await reloaded.init();
    expect(reloaded.data!.balance).toBe(balanceAfterEntry);
    await reloaded.startEvent('home-20', 6, 'fast'); // repeated registration attempt
    expect(reloaded.data!.ledger.filter(r => r.kind === 'entry')).toHaveLength(1);
    expect(reloaded.data!.balance).toBe(balanceAfterEntry);

    await reloaded.prepareBot();
    const pending = structuredClone(reloaded.data!.active!.pending);
    expect(pending?.decision).toBeTruthy();
    const again = new TournamentController(port); await again.init();
    expect(again.data!.active!.pending).toEqual(pending);
    await again.commitBot(pending!.handId, pending!.revision);
    const committed = JSON.stringify(again.data);
    await again.commitBot(pending!.handId, pending!.revision); // stale repeat: no-op
    expect(JSON.stringify(again.data)).toBe(committed);
  }, 60000);
});

describe('cash poker: reload mid-all-in settles the hand exactly once', () => {
  class Store implements PersistencePort {
    data: AppData | null = null;
    async load() { return structuredClone(this.data); }
    async commit(expected: number | null, next: AppData) {
      if ((this.data?.revision ?? null) !== expected) throw new Error('TEST revision changed');
      this.data = structuredClone(next);
    }
    close() { /* memory only */ }
  }
  const settings = (): CashSettings => ({ ...structuredClone(DEFAULT_SETTINGS), seats: 2, buyIn: 20000, archetypes: ['station'] });
  it('the hand is recorded once and the wallet identity holds to the cent', async () => {
    const store = new Store();
    const c = new SessionController(store); await c.init(); expect(c.status).toBe('ready');
    const walletAtStart = c.data!.wallet;
    await c.startSession(settings());
    expect(c.data!.wallet).toBe(walletAtStart - 20000); // buy-in: Available → In play

    let current = c, reloaded = false, allInLive = false;
    for (let i = 0; i < 300; i++) {
      const g = current.data?.active?.game;
      if (!g || g.street === 'complete') break;
      if (g.actor === 0) {
        const legal = legalActions(g);
        const action: Action = legal.canRaise ? { type: 'raise', to: legal.maxRaiseTo! } : legal.check ? { type: 'check' } : { type: 'call' };
        await current.act(action, g.handId, g.revision);
      } else {
        await current.prepareBot(); await current.commitBot(g.handId, g.revision);
      }
      expect(current.error).toBe('');
      const after = current.data?.active?.game;
      const hero = after?.seats.find(s => s.id === 0);
      if (after && after.street !== 'complete' && hero && !hero.folded && hero.stack === 0) allInLive = true;
      if (allInLive && !reloaded) {
        /* The hero is all-in and the hand is live: reload right here. */
        const snapshot = JSON.stringify(current.data);
        const fresh = new SessionController(store); await fresh.init();
        expect(JSON.stringify(fresh.data)).toBe(snapshot);
        current = fresh; reloaded = true;
      }
    }
    expect(allInLive).toBe(true);
    expect(reloaded).toBe(true);
    const hands = current.data!.hands.filter(h => h.sessionId === current.data!.active!.sessionId);
    expect(hands).toHaveLength(1); // settled and recorded exactly once
    await current.cashOut();
    expect(current.data!.wallet).toBe(walletAtStart + hands[0].net); // every cent explained
  }, 120000);
});
