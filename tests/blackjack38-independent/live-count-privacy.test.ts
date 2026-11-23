import { describe, expect, it } from 'vitest';
import { BlackjackController } from '../../src/blackjack/controller';
import { countState, COUNT_SYSTEMS } from '../../src/blackjack/counting';
import { applyBlackjack, createBlackjackState, orderedBlackjackShoe } from '../../src/blackjack/engine';
import { MemoryBlackjackPersistence } from '../../src/blackjack/persistence';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { anchorFor, checkpoint, emptySession, initialBlackjackData } from '../../src/blackjack/runtime';

function liveFixture(hole: string) {
  const table = BLACKJACK_TABLES.find(item => item.id === 'casino-5')!;
  const rest = orderedBlackjackShoe(6);
  const prefix = ['9c', '6c', '8d', hole, '2h', '4d'].map(face => rest.splice(rest.findIndex(card => card.slice(2) === face), 1)[0]);
  const engine = applyBlackjack(createBlackjackState(table, [...prefix, ...rest]), { id: 'initial-deal', revision: 0, type: 'deal', bet: 500 });
  const data = { ...initialBlackjackData(), revision: 2, balance: engine.balance, active: { id: 'independent-active', sessionId: 'independent-session', startedAt: '2026-11-16T00:00:00Z', engine, reviews: [], prior: emptySession() } };
  const port = new MemoryBlackjackPersistence();
  port.current = checkpoint(data); port.anchor = anchorFor(port.current);
  return port;
}

describe('independent live blackjack count privacy', () => {
  it('hidden dealer ace changes neither the public count nor ace tally in any method', async () => {
    const a = new BlackjackController(liveFixture('Ac')), b = new BlackjackController(liveFixture('Tc'));
    await a.init(); await b.init();
    expect(a.status).toBe('ready'); expect(b.status).toBe('ready');
    expect(a.publicState!.round!.phase).toBe('player');
    expect(a.publicState!.round!.dealer).toEqual(['6c', null]);
    expect(b.publicState!.round!.dealer).toEqual(['6c', null]);
    expect(a.seen).toEqual(['9c', '6c', '8d']);
    expect(a.seen).toEqual(b.seen);
    const original = JSON.stringify(a.data);
    for (const system of COUNT_SYSTEMS) {
      const count = countState(system, a.seen, 6);
      expect(count).toEqual(countState(system, b.seen, 6));
      expect(count.acesSeen).toBe(0);
      expect(count.acesRemaining).toBe(24);
    }
    expect(JSON.stringify(a.data)).toBe(original);
  });
  it('revealed dealer ace enters the tally once and remains stable across a reload', async () => {
    const port = liveFixture('Ac'), controller = new BlackjackController(port);
    await controller.init();
    await controller.act('stand', controller.data!.revision);
    expect(controller.publicState!.round!.phase).toBe('settled');
    expect(controller.seen).toEqual(['9c', '6c', '8d', 'Ac', '2h']);
    const recovered = new BlackjackController(port); await recovered.init();
    expect(recovered.seen).toEqual(controller.seen);
    expect(recovered.data!.balance).toBe(controller.data!.balance);
    for (const system of COUNT_SYSTEMS) {
      const count = countState(system, recovered.seen, 6);
      expect(count.acesSeen).toBe(1); expect(count.acesRemaining).toBe(23);
      expect(count).toEqual(countState(system, controller.seen, 6));
    }
    expect(controller.data!.active!.engine.ledger.filter(event => event.kind === 'settle')).toHaveLength(1);
  });
});
