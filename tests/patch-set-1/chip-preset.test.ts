import { describe, expect, it } from 'vitest';
import { assertAccounting, validatePublicReplay, projectView } from '../../src/core/engine';
import { DEFAULT_SETTINGS, rules, SessionController } from '../../src/session/controller';
import { syntheticLiveOneTwoPreset } from '../../src/session/configuration';
import type { AppData, CashSettings, PersistencePort } from '../../src/session/types';
import { canonical, parsePublicHistory, validateData } from '../../src/storage/integrity';
import { deriveCashStats } from '../../src/stats/cash';
import { act, hand, rig } from '../verification/helpers';

const seed = (seat: number) => 1000 + seat;
const settings = (changes: Partial<CashSettings> = {}) => ({ ...structuredClone(DEFAULT_SETTINGS), ...changes });
class MemoryStore implements PersistencePort {
  data: AppData | null = null;
  async load() { return structuredClone(this.data); }
  async commit(revision: number | null, next: AppData) {
    if ((this.data?.revision ?? null) !== revision) throw new Error('Stale write');
    this.data = structuredClone(next);
  }
  close() {}
}

describe('Patch set 1: live-dollar preset financial boundary', () => {
  it('uses whole dollars for the new no-rake preset without rewriting the input', () => {
    const base = settings({ chipUnit: 1 }), before = canonical(base);
    const preset = syntheticLiveOneTwoPreset(base, seed);
    expect(preset).toMatchObject({ chipUnit: 100, smallBlind: 100, bigBlind: 200, buyIn: 30000, seats: 9 });
    expect(canonical(base)).toBe(before);
    expect(rules(base).chipUnit).toBe(1);
    expect(rules(preset).version).not.toBe(rules(base).version);
  });

  it('whole-dollar custom rake uses the configured chip floor, not rounded display money', () => {
    const preset = syntheticLiveOneTwoPreset(settings({ chipUnit: 1, rakeMode: 'custom', rakeBasisPoints: 500, rakeCap: 300 }), seed);
    let game = rig(hand([1500,1500], 0, rules(preset)), [['As','Ad'],['Ks','Kd']], ['2c','4h','7s','9d','Tc']);
    game = act(game, { type: 'raise', to: 1500 });
    game = act(game, { type: 'call' });
    // $30 matched * 5% = $1.50, floored by the declared $1 chip rule to $1.
    expect(game.rake).toBe(100);
    expect(game.payouts).toEqual({ 0: 2900 });
    expect(game.seats.map(seat => seat.stack)).toEqual([2900,0]);
    assertAccounting(game);
  });

  it.each([{ unit: 1, cap: 125 }, { unit: 25, cap: 125 }, { unit: 50, cap: 150 }])('preserves a compatible finer unit for custom cap $cap cents: $unit', ({ unit, cap }) => {
    const base = settings({ chipUnit: unit, rakeMode: 'custom', rakeBasisPoints: 500, rakeCap: cap });
    const preset = syntheticLiveOneTwoPreset(base, seed);
    expect(preset.chipUnit).toBe(unit);
    let game = rig(hand([3000,3000], 0, rules(preset)), [['As','Ad'],['Ks','Kd']], ['2c','4h','7s','9d','Tc']);
    game = act(game, { type: 'raise', to: 3000 }); game = act(game, { type: 'call' });
    expect(game.rake).toBe(cap);
    expect(game.payouts).toEqual({ 0: 6000 - cap });
    assertAccounting(game);
  });

  it.each([undefined, 1])('retains sourced rake and one-cent semantics with legacy chip unit %s', chipUnit => {
    const base = settings({ chipUnit, rakeMode: 'pokerstars-usd-2026' });
    const oldProfile = rules(base), preset = syntheticLiveOneTwoPreset(base, seed);
    expect(rules(preset)).toEqual(oldProfile);
    expect(rules(preset).chipUnit).toBe(1);
    expect(rules(preset).rake.source).toBeDefined();
  });

  it.each([0, 500])('whole-dollar side pots, exact uncalled return and odd chips reconcile at %i basis points', basisPoints => {
    const preset = syntheticLiveOneTwoPreset(settings({ rakeMode: 'custom', rakeBasisPoints: basisPoints, rakeCap: 100 }), seed);
    let game = rig(hand([3000,1500,500], 0, rules(preset)), [['2c','3d'],['4c','5d'],['6c','7d']], ['As','Ks','Qs','Js','Ts']);
    const frames = [projectView(game, 0)];
    for (const action of [{ type: 'raise', to: 3000 }, { type: 'call' }, { type: 'call' }] as const) {
      game = act(game, action); frames.push(projectView(game, 0));
    }
    // $15 is unmatched and returned to seat 0. Main $15 / three winners;
    // side $20 / seats 0 and 1. $1 rake, when enabled, comes from the main pot;
    // its two odd $1 chips go to seats 1 and 2 clockwise after button 0.
    const rake = basisPoints ? 100 : 0;
    expect(game.events.filter(event => event.type === 'refund').map(event => ({ seat: event.seatId, amount: event.amount }))).toEqual([{ seat: 0, amount: 1500 }]);
    expect(game.pots.map(pot => ({ amount: pot.amount, eligible: pot.eligible }))).toEqual([{ amount: 1500 - rake, eligible: [0,1,2] }, { amount: 2000, eligible: [0,1] }]);
    expect(game.payouts).toEqual({ 0: 1500 - rake, 1: 1500, 2: 500 });
    expect(game.seats.map(seat => seat.stack)).toEqual([3000 - rake,1500,500]);
    expect(game.rake).toBe(rake);
    validatePublicReplay(frames); assertAccounting(game);
  });

  it('queues the dollar preset across a cent hand and reload, returning residual cents once without rewriting history', async () => {
    const store = new MemoryStore(), controller = new SessionController(store);
    await controller.init();
    await controller.startSession(settings({ seats: 2, chipUnit: 1, smallBlind: 1, bigBlind: 2, buyIn: 3002, maxBuyInBB: 10000 }));
    const active = controller.data!.active!, before = canonical(active.game);
    await controller.queueConfiguration(syntheticLiveOneTwoPreset(controller.data!.sessions[0].settings, seed), active.sessionId, active.game.handId);
    expect(canonical(controller.data!.active!.game)).toBe(before);
    await controller.act({ type: 'fold' }, active.game.handId, active.game.revision);
    expect(controller.error).toBe('');
    const history = canonical(controller.data!.hands), net = controller.data!.hands[0].net;
    expect(net).toBe(-1);
    const wallet = controller.data!.wallet;
    const restored = new SessionController(store); await restored.init(); await restored.nextHand();
    expect(restored.error).toBe('');
    const data = restored.data!;
    expect(data.active!.game.profile.chipUnit).toBe(100);
    expect(data.active!.game.seats[0].startingStack).toBe(3000);
    expect(data.wallet).toBe(wallet + 1);
    expect(data.ledger.filter(event => event.kind === 'table-adjustment')).toMatchObject([{ walletDelta: 1, tableDelta: -1, pokerNet: 0 }]);
    expect(canonical(data.hands)).toBe(history);
    expect(data.hands[0].view.profile.chipUnit).toBe(1);
    expect(deriveCashStats(data.hands, data.sessions).profit).toBe(-1);
    expect(data.wallet + data.active!.game.seats[0].stack + data.active!.game.seats[0].totalCommitted).toBe(1000000 - 1);
    await validateData(data);
    const roundTrip = await parsePublicHistory(JSON.stringify(await restored.exportHistory()));
    expect(roundTrip[0].net).toBe(-1);
    const reload = new SessionController(store); await reload.init();
    expect(canonical(reload.data!.ledger)).toBe(canonical(data.ledger));
    expect(reload.data!.wallet).toBe(data.wallet);
  });

  it('preserves fractional wallet cents through whole-dollar play, top-up and duplicate cashout requests', async () => {
    const store = new MemoryStore(), controller = new SessionController(store);
    await controller.init(); await controller.adjustBankroll(1000001, 'One-cent wallet precision fixture');
    const preset = syntheticLiveOneTwoPreset(settings(), seed);
    await controller.startSession({ ...preset, seats: 2, capacity: 2, occupiedSeatIds: [0,1] });
    const game = controller.data!.active!.game;
    await controller.act({ type: 'fold' }, game.handId, game.revision);
    await controller.topUp(100); await controller.cashOut(); await controller.cashOut();
    expect(controller.error).toBe('');
    const data = controller.data!;
    expect(data.wallet).toBe(999901);
    expect(data.active).toBeNull();
    expect(data.hands[0].net).toBe(-100);
    expect(data.ledger.filter(event => event.kind === 'cash-out')).toHaveLength(1);
    expect(data.ledger.filter(event => event.kind === 'top-up')).toMatchObject([{ walletDelta: -100, tableDelta: 100, pokerNet: 0 }]);
    expect(data.ledger.reduce((sum, event) => sum + event.walletDelta, 0)).toBe(data.wallet);
    expect(data.ledger.reduce((sum, event) => sum + event.tableDelta, 0)).toBe(0);
    expect(deriveCashStats(data.hands, data.sessions).profit).toBe(-100);
    await validateData(data);
  });
});
