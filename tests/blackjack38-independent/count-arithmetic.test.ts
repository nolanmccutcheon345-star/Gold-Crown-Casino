import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/contracts';
import { countState, countSystem, COUNT_SYSTEMS, type CountSystemId } from '../../src/blackjack/counting';
import { checkCount, trainerCount, type TrainerState } from '../../src/blackjack/trainer';

// Independent reference rows, not derived from the implementation's tags.
const ranks = '23456789TJQKA';
const ordinaryDeck = [...'cdhs'].flatMap(suit => [...ranks].map(rank => `${rank}${suit}` as Card));
const reference: Record<CountSystemId, readonly number[]> = {
  'hi-lo': [1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, -1],
  'wong-halves': [.5, 1, 1, 1.5, 1, .5, 0, -.5, -1, -1, -1, -1, -1],
  'wong-halves-double': [1, 2, 2, 3, 2, 1, 0, -1, -2, -2, -2, -2, -2],
  zen: [1, 1, 2, 2, 2, 1, 0, 0, -2, -2, -2, -2, -1],
  'hi-opt-2': [1, 1, 2, 2, 1, 1, 0, 0, -2, -2, -2, -2, 0],
  'omega-2': [1, 1, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, 0],
};
const ids = Object.keys(reference) as CountSystemId[];
const referenceRunning = (id: CountSystemId, cards: readonly Card[]) => cards.reduce((sum, card) => sum + reference[id][ranks.indexOf(card[0])], 0);
// A physically possible six-deck prefix: 52 exposed cards, one exposed ace.
const aceRichRemainder = [...ordinaryDeck.filter(card => !['Ad', 'Ah', 'As'].includes(card)), '2c', '2d', '2h'] as Card[];
const negativePrefix = ['Ac', 'Ad', 'Ah', 'Tc', 'Jd', 'Qh', 'Ks', '9c', '8d', '7h', '2s', '5d'] as Card[];

function trainer(system: CountSystemId, seen = negativePrefix): TrainerState {
  return {
    settings: { system, decks: 6, mode: 'test', cardsPerDeal: 1 },
    shoe: [...seen, ...ordinaryDeck], position: seen.length, cutAt: seen.length + 20,
    lastDeal: seen.slice(-1), checks: [], streak: 2,
  };
}

describe('independent arithmetic: ace side tallies and count units', () => {
  it('retains the five existing methods and adds exactly one doubled Halves option', () => {
    expect(COUNT_SYSTEMS.map(system => system.id).sort()).toEqual([...ids].sort());
  });
  it.each(ids)('%s matches an independent rank table at every prefix of a six-deck shoe', id => {
    const shoe = Array.from({ length: 6 }, (_, deck) => ordinaryDeck.map((_, n) => ordinaryDeck[(n * 17 + deck * 5) % 52])).flat();
    for (let exposed = 0; exposed <= shoe.length; exposed++) {
      const seen = shoe.slice(0, exposed), state = countState(countSystem(id), seen, 6);
      const aces = seen.filter(card => card[0] === 'A').length;
      const remainingDecks = (312 - exposed) / 52, divisor = Math.max(.5, Math.round(remainingDecks * 2) / 2);
      expect(state.running).toBe(referenceRunning(id, seen));
      expect(state.trueCount).toBe(state.running / divisor);
      expect(state.standardTrueCount).toBe(state.trueCount / (id === 'wong-halves-double' ? 2 : 1));
      expect(state.acesSeen).toBe(aces);
      expect(state.acesRemaining).toBe(24 - aces);
      expect(state.expectedAcesRemaining).toBeCloseTo((312 - exposed) / 13, 12);
      expect(state.excessAces).toBeCloseTo(state.acesRemaining - state.expectedAcesRemaining, 12);
      expect(state.acesSeen + state.acesRemaining).toBe(24);
    }
  });
  it.each([
    ['hi-lo', 6, 1.2, 1.2], ['wong-halves', 4.5, .9, .9], ['wong-halves-double', 9, 1.8, 1.8],
    ['zen', 6, 1.2, 1.2], ['hi-opt-2', 3, .6, 1.8], ['omega-2', 3, .6, 1.8],
  ] as const)('%s preserves the correct betting adjustment with three excess unseen aces', (id, running, playing, betting) => {
    const state = countState(countSystem(id), aceRichRemainder, 6);
    expect(state.cardsSeen).toBe(52);
    expect(state.running).toBe(running);
    expect(state.decksRemaining).toBe(5);
    expect(state.decksEstimate).toBe(5);
    expect(state.acesSeen).toBe(1);
    expect(state.acesRemaining).toBe(23);
    expect(state.expectedAcesRemaining).toBe(20);
    expect(state.excessAces).toBe(3);
    expect(state.trueCount).toBeCloseTo(playing, 12);
    expect(state.bettingTrueCount).toBeCloseTo(betting, 12);
  });
  it.each([
    ['hi-lo', -5], ['wong-halves', -5], ['wong-halves-double', -10],
    ['zen', -7], ['hi-opt-2', -4], ['omega-2', -5],
  ] as const)('%s handles ace deficits and negative fractional counts without rounding the arithmetic', (id, running) => {
    const state = countState(countSystem(id), negativePrefix, 6);
    expect(state.running).toBe(running);
    expect(state.trueCount).toBe(running / 6);
    expect(state.acesSeen).toBe(3);
    expect(state.acesRemaining).toBe(21);
    expect(state.expectedAcesRemaining).toBeCloseTo(300 / 13, 12);
    expect(state.excessAces).toBeCloseTo(-27 / 13, 12);
    const correction = id === 'hi-opt-2' || id === 'omega-2' ? -54 / 13 : 0;
    expect(state.bettingTrueCount).toBeCloseTo((running + correction) / 6, 12);
  });
  it.each(ids)('%s finishes a complete six-deck shoe with zero count and no unseen aces', id => {
    const state = countState(countSystem(id), Array.from({ length: 6 }, () => ordinaryDeck).flat(), 6);
    expect(state).toMatchObject({ running: 0, trueCount: 0, standardTrueCount: 0, bettingTrueCount: 0, acesSeen: 24, acesRemaining: 0, expectedAcesRemaining: 0, excessAces: 0, decksRemaining: 0, decksEstimate: .5 });
  });
  it('doubled Halves changes count units while ace quantities remain identical at every exposed card', () => {
    for (let n = 0; n <= ordinaryDeck.length; n++) {
      const seen = ordinaryDeck.slice(0, n), original = countState(countSystem('wong-halves'), seen, 2), doubled = countState(countSystem('wong-halves-double'), seen, 2);
      expect(doubled.running).toBe(2 * original.running);
      expect(doubled.trueCount).toBe(2 * original.trueCount);
      expect(doubled.bettingTrueCount).toBe(2 * original.bettingTrueCount);
      expect(doubled.standardTrueCount).toBe(original.trueCount);
      for (const key of ['acesSeen', 'acesRemaining', 'expectedAcesRemaining', 'excessAces', 'decksEstimate'] as const) expect(doubled[key]).toBe(original[key]);
    }
  });
});

describe('independent trainer grading and observation isolation', () => {
  it.each(ids)('%s rejects correct running count paired with an incorrect ace tally', id => {
    const state = trainer(id), graded = checkCount(state, referenceRunning(id, negativePrefix), 2);
    expect(graded.checks.at(-1)).toMatchObject({ runningRight: true, acesRight: false, acesCorrect: 3, right: false });
    expect(graded.streak).toBe(0);
    expect(state.checks).toEqual([]);
    expect(state.streak).toBe(2);
  });
  it.each(ids)('%s accepts correct counts and rejects wrong running count even with correct aces', id => {
    const state = trainer(id), expected = referenceRunning(id, negativePrefix);
    expect(checkCount(state, expected, 3).checks.at(-1)).toMatchObject({ runningRight: true, acesRight: true, right: true });
    expect(checkCount(state, expected, 3).streak).toBe(3);
    expect(checkCount(state, expected + 1, 3).checks.at(-1)).toMatchObject({ runningRight: false, acesRight: true, right: false });
  });
  it('retains compatibility for callers that request running-count-only grading', () => {
    const graded = checkCount(trainer('wong-halves'), -5);
    expect(graded.checks.at(-1)).toMatchObject({ runningRight: true, acesRight: undefined, right: true });
  });
  it.each([NaN, Infinity, -1, .5, 25])('rejects invalid ace answer %s before adding a result', answer => {
    const state = trainer('hi-lo');
    expect(() => checkCount(state, -5, answer)).toThrow();
    expect(state.checks).toHaveLength(0);
  });
  it.each(ids)('%s neither reads future aces nor changes its answer when the unseen order changes', id => {
    const state = trainer(id), unseen = state.shoe.slice(state.position);
    const differentFuture: TrainerState = { ...state, shoe: [...negativePrefix, ...unseen.slice().reverse()] };
    expect(trainerCount(differentFuture)).toEqual(trainerCount(state));
    expect(checkCount(differentFuture, referenceRunning(id, negativePrefix), 3).checks).toEqual(checkCount(state, referenceRunning(id, negativePrefix), 3).checks);
  });
});
