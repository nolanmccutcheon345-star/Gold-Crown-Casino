import { describe, expect, it } from 'vitest';
import { cardTag, COUNT_SYSTEMS, countState, countSystem, formatCount, runningCount, sameCount } from '../../src/blackjack/counting';
import { checkCount, dealNext, DEFAULT_TRAINER, newTrainer, practiceShoe, retune, trainerCount, trainerFinished, trainerSeen } from '../../src/blackjack/trainer';

const DECK = ['c', 'd', 'h', 's'].flatMap(suit => ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map(rank => rank + suit));
/** A deterministic index source for tests (not for play). */
const fixed = (seed = 7) => (limit: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit; };

describe('counting systems', () => {
  it.each(COUNT_SYSTEMS.map(system => [system.id, system] as const))('%s is balanced: a full deck counts to zero', (_id, system) => {
    expect(runningCount(system, DECK)).toBe(0); expect(runningCount(system, [...DECK, ...DECK, ...DECK, ...DECK, ...DECK, ...DECK])).toBe(0);
    expect(cardTag(system, 'Kh')).toBe(system.tags.T); expect(cardTag(system, 'Jd')).toBe(cardTag(system, 'Ts'));
  });
  it('preserves the five supplied rank-tag tables', () => {
    const tags = (id: Parameters<typeof countSystem>[0]) => ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'].map(rank => cardTag(countSystem(id), rank + 's'));
    expect(tags('hi-lo')).toEqual([1, 1, 1, 1, 1, 0, 0, 0, -1, -1]);
    expect(tags('wong-halves')).toEqual([0.5, 1, 1, 1.5, 1, 0.5, 0, -0.5, -1, -1]);
    expect(tags('zen')).toEqual([1, 1, 2, 2, 2, 1, 0, 0, -2, -1]);
    expect(tags('hi-opt-2')).toEqual([1, 1, 2, 2, 1, 1, 0, 0, -2, 0]);
    expect(tags('omega-2')).toEqual([1, 1, 2, 2, 2, 1, 0, -1, -2, 0]);
  });
  it('converts a running count to a true count with half-deck estimation', () => {
    // 104 low cards seen from six decks: four decks remain.
    const seen = Array.from({ length: 104 }, (_, index) => ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s'][index % 8]);
    const state = countState(countSystem('hi-lo'), seen, 6);
    expect(state.running).toBe(65); expect(state.decksRemaining).toBe(4); expect(state.decksEstimate).toBe(4); expect(state.trueCount).toBe(16.25);
    expect(countState(countSystem('hi-lo'), DECK.slice(0, 20), 2).decksEstimate).toBe(1.5);
    expect(countState(countSystem('hi-lo'), [...DECK, ...DECK.slice(0, 45)], 2).decksEstimate).toBe(0.5);
    expect(() => countState(countSystem('hi-lo'), [...DECK, ...DECK, 'As'], 2)).toThrow();
  });
  it('adjusts the betting count for extra or missing aces in ace-neutral systems', () => {
    // Worked example: six decks, three dealt, fourteen aces seen, main running count +12.
    const seen = [...Array(14).fill('As'), ...Array(6).fill('4s'), ...Array(136).fill('8s')];
    const state = countState(countSystem('hi-opt-2'), seen, 6);
    expect(seen.length).toBe(156); expect(state.running).toBe(12); expect(state.acesSeen).toBe(14); expect(state.excessAces).toBe(-2);
    expect(state.trueCount).toBe(4); expect(Math.round(state.bettingTrueCount * 100) / 100).toBe(2.67);
    const hiLo = countState(countSystem('hi-lo'), seen, 6); expect(hiLo.bettingTrueCount).toBe(hiLo.trueCount);
    // Two decks dealt of six with five aces seen: three more aces remain than average.
    const rich = countState(countSystem('omega-2'), [...Array(5).fill('Ad'), ...Array(99).fill('8d')], 6);
    expect(rich.excessAces).toBe(3); expect(rich.bettingTrueCount).toBe((0 + 2 * 3) / 4);
  });
  it('formats and compares counts', () => {
    expect([0, 3, -2, 1.5, -0.5, 2.6667].map(formatCount)).toEqual(['0', '+3', '−2', '+1.5', '−0.5', '+2.7']);
    expect(sameCount(3, 3)).toBe(true); expect(sameCount(2.5, 3)).toBe(false); expect(sameCount(-1.5, -1.5)).toBe(true);
  });
});

describe('count trainer', () => {
  it('builds a full shuffled shoe', () => {
    for (const decks of [2, 6]) { const shoe = practiceShoe(decks, fixed()); expect(shoe).toHaveLength(decks * 52); expect(shoe.filter(card => card === 'As')).toHaveLength(decks); expect(new Set(shoe).size).toBe(52); }
    expect(practiceShoe(1, fixed(1)).join('')).not.toBe(DECK.join(''));
  });
  it('deals to the cut card and no further', () => {
    let state = newTrainer({ ...DEFAULT_TRAINER, decks: 2, cardsPerDeal: 3 }, fixed());
    expect(state.cutAt).toBe(68); let guard = 0;
    while (!trainerFinished(state) && guard++ < 100) { const before = state.position; state = dealNext(state); expect(state.lastDeal).toHaveLength(state.position - before); expect(state.lastDeal.length).toBeLessThanOrEqual(3); }
    expect(state.position).toBe(68); expect(dealNext(state)).toBe(state); expect(trainerSeen(state)).toHaveLength(68);
  });
  it('checks answers against the real running count and keeps a streak', () => {
    let state = dealNext(dealNext(newTrainer(DEFAULT_TRAINER, fixed())));
    const correct = trainerCount(state).running;
    state = checkCount(state, correct); expect(state.checks.at(-1)).toMatchObject({ right: true, correct, atCard: 2 }); expect(state.streak).toBe(1);
    state = checkCount(state, correct + 1); expect(state.checks.at(-1)!.right).toBe(false); expect(state.streak).toBe(0);
    expect(() => checkCount(state, Number.NaN)).toThrow();
  });
  it('keeps the shoe when pace or mode change and starts a new one for a new system or size', () => {
    const state = dealNext(newTrainer(DEFAULT_TRAINER, fixed()));
    expect(retune(state, { mode: 'test' }).shoe).toBe(state.shoe); expect(retune(state, { cardsPerDeal: 3 }).position).toBe(1);
    const changed = retune(state, { system: 'hi-opt-2' }, fixed(3)); expect(changed.position).toBe(0); expect(changed.settings.system).toBe('hi-opt-2');
    expect(retune(state, { decks: 2 }, fixed()).shoe).toHaveLength(104);
  });
});
