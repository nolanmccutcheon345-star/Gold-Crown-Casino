import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/contracts';
import { applyBlackjack, blackjackView, createBlackjackState, orderedBlackjackShoe } from '../../src/blackjack/engine';
import { liveAdvice, hintAsPlay } from '../../src/blackjack/live-coach';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { COUNT_SYSTEMS } from '../../src/blackjack/counting';

const table = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!;
function deal(faces: string[], balance = 200000) {
  const rest = orderedBlackjackShoe(6);
  const first = faces.map(face => {
    const at = rest.findIndex(card => card.endsWith(':' + face));
    if (at < 0) throw new Error('Invalid independent shoe fixture');
    return rest.splice(at, 1)[0];
  });
  return applyBlackjack(createBlackjackState(table, [...first, ...rest], { balance, ante: 0 }), { id: 'fixture-deal', revision: 0, type: 'deal', bet: 500 });
}
// Physically available exposures from six decks; these do not represent measured human play.
const lowCards = Array.from({ length: 6 }, () => [...'cdhs'].flatMap(suit => [...'23456'].map(rank => `${rank}${suit}` as Card))).flat();
const highCards = Array.from({ length: 6 }, () => [...'cdhs'].flatMap(suit => [...'TJQKA'].map(rank => `${rank}${suit}` as Card))).flat();
const cases = [
  ['Tc','Td','6h','7c'], ['9c','7d','3h','8c'], ['8c','6d','8h','Tc'],
  ['Ac','6d','6h','Tc'], ['Tc','Ad','9h','7c'], ['Ac','Ad','Th','7c'],
];

describe('independent live advice integration boundaries', () => {
  it.each(COUNT_SYSTEMS.map(s => s.id))('%s has no dependency on dealer hole or remaining shoe', system => {
    const a = blackjackView(deal(['Tc','6d','6h','7c']));
    const b = blackjackView(deal(['Tc','6d','6h','Ks']));
    expect(a.round?.dealer).toEqual(['6d', null]);
    expect(b.round?.dealer).toEqual(['6d', null]);
    const seen: Card[] = ['Tc','6d','6h'];
    expect(liveAdvice(a, table, seen, { system, reveal: true })).toEqual(liveAdvice(b, table, seen, { system, reveal: true }));
  });

  it.each(COUNT_SYSTEMS.map(s => s.id))('%s recommendations are legal under funded and constrained insurance', system => {
    for (const faces of cases) for (const balance of [500, 200000]) {
      const publicState = blackjackView(deal(faces, balance));
      const seen = faces.slice(0, 3) as Card[];
      for (const prefix of [[], lowCards.slice(0, 35), highCards.slice(0, 35)]) {
        const hint = liveAdvice(publicState, table, [...prefix, ...seen], { system, reveal: true });
        if (publicState.round?.phase === 'settled') expect(hint).toBeNull();
        else {
          expect(hint).not.toBeNull();
          expect(publicState.legalActions).toContain(hintAsPlay(hint!, publicState.legalActions));
        }
      }
    }
  });

  it('original and doubled Halves choose identical actions across hands and exposure depths', () => {
    for (const faces of cases) for (const count of [0, 1, 5, 10, 20, 35, 50]) for (const prefix of [lowCards, highCards]) {
      const state = blackjackView(deal(faces)), seen = [...prefix.slice(0, count), ...faces.slice(0, 3)] as Card[];
      const normal = liveAdvice(state, table, seen, { system: 'wong-halves', reveal: true });
      const doubled = liveAdvice(state, table, seen, { system: 'wong-halves-double', reveal: true });
      expect(doubled?.action).toBe(normal?.action);
    }
  });

  it('hiding count preserves advice while omitting its current numerical count', () => {
    for (const system of COUNT_SYSTEMS.map(s => s.id)) for (const faces of cases) {
      const state = blackjackView(deal(faces)), seen = [...lowCards.slice(0, 35), ...faces.slice(0, 3)] as Card[];
      const shown = liveAdvice(state, table, seen, { system, reveal: true });
      const hidden = liveAdvice(state, table, seen, { system, reveal: false });
      expect(hidden?.action).toBe(shown?.action);
      expect(hidden?.reason ?? '').not.toContain('True count now');
    }
  });

  it('does not mutate the engine projection or public exposure history', () => {
    const state = blackjackView(deal(cases[0])), seen = ['Tc','Td','6h'] as Card[];
    const before = JSON.stringify({ state, seen });
    for (const system of COUNT_SYSTEMS.map(s => s.id)) liveAdvice(state, table, seen, { system, reveal: false });
    expect(JSON.stringify({ state, seen })).toBe(before);
  });
});
