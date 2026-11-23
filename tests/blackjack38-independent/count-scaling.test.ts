import { describe, expect, it } from 'vitest';
import { answerDrill, deviationQuestion } from '../../src/blackjack/drills';
import { deviationApplies, deviations, hintFor, mixAtTrueCount, playAtCount, shoeMix, wholeIndex, type Deviation, type StrategyRules, type Value } from '../../src/blackjack/strategy';

const rules: StrategyRules = { decks: 6, dealerHitsSoft17: true, doubleAfterSplit: true, surrender: true };
const counts = [-8.75, -3.5, -.75, -.5, -.25, 0, .25, .5, 1.75, 4.25, 9.5];

describe('independent doubled-Halves model invariance', () => {
  it.each(counts)('keeps the rank distribution and decisions unchanged at original TC %s', tc => {
    const mix = shoeMix(6, [10, 6, 10]);
    expect(mixAtTrueCount(mix, 'wong-halves-double', tc * 2)).toEqual(mixAtTrueCount(mix, 'wong-halves', tc));
    for (const [kind, total, up] of [['hard', 16, 10], ['hard', 12, 3], ['hard', 9, 2], ['soft', 18, 1], ['pair', 10, 6]] as const) {
      expect(playAtCount(kind, total, up, rules, 'wong-halves-double', tc * 2)).toBe(playAtCount(kind, total, up, rules, 'wong-halves', tc));
    }
  });
  it.each([-2.75, -1.5, -.75, -.5, -.25, 0, .25, .5, .75, 1.5, 2.75])('rounds an index at %s in original units, including negative half boundaries', index => {
    for (const direction of ['at or above', 'at or below'] as const) {
      const original: Deviation = { kind: 'hard', key: 16, up: 10, label: 'Independent boundary fixture', basic: 'hit', play: 'stand', index, direction };
      const doubled: Deviation = { ...original, index: index * 2, indexScale: 2 };
      const referenceThreshold = Math.round(index) || 0;
      expect(wholeIndex(original)).toBe(referenceThreshold);
      expect(wholeIndex(doubled)).toBe(referenceThreshold * 2);
      for (const tc of [referenceThreshold - .01, referenceThreshold, referenceThreshold + .01, -4.75, -.75, .75, 4.75]) {
        const expected = direction === 'at or above' ? tc >= referenceThreshold : tc <= referenceThreshold;
        expect(deviationApplies(original, tc)).toBe(expected);
        expect(deviationApplies(doubled, tc * 2)).toBe(expected);
      }
    }
  });
  it('converts the actual generated indices without changing modeled plays or decision boundaries', () => {
    const original = deviations(rules, 'wong-halves'), doubled = deviations(rules, 'wong-halves-double');
    expect(original.length).toBeGreaterThan(10);
    expect(doubled).toHaveLength(original.length);
    original.forEach((item, n) => {
      expect(doubled[n]).toEqual({ ...item, index: item.index * 2, indexScale: 2 });
      const boundary = wholeIndex(item);
      for (const tc of [boundary - .01, boundary, boundary + .01]) expect(deviationApplies(doubled[n], tc * 2)).toBe(deviationApplies(item, tc));
    });
  });
  it('identical random draws produce equivalent drill questions and grades in either count unit', () => {
    function generator(seed: number) {
      let value = seed;
      return (limit: number) => { value = (value * 1664525 + 1013904223) >>> 0; return value % limit; };
    }
    for (let seed = 1; seed <= 30; seed++) {
      const original = deviationQuestion(rules, 'wong-halves', generator(seed)), doubled = deviationQuestion(rules, 'wong-halves-double', generator(seed));
      expect(doubled.cards).toEqual(original.cards);
      expect(doubled.upCard).toBe(original.upCard);
      expect(doubled.trueCount).toBe(original.trueCount! * 2);
      for (const play of ['hit', 'stand', 'double', 'split', 'surrender'] as const) expect(answerDrill(doubled, play, rules)).toEqual(answerDrill(original, play, rules));
    }
  });
  it('live count hints stay equivalent across original and doubled positive and negative TCs', () => {
    const hands: [Value[], Value][] = [[[10, 6], 10], [[10, 2], 3], [[5, 4], 2], [[10, 3], 2], [[10, 10], 6]];
    for (const [cards, up] of hands) for (const tc of counts) {
      const original = hintFor(cards, up, rules, ['hit', 'stand', 'double', 'split', 'surrender'], { system: 'wong-halves', trueCount: tc });
      const doubled = hintFor(cards, up, rules, ['hit', 'stand', 'double', 'split', 'surrender'], { system: 'wong-halves-double', trueCount: tc * 2 });
      expect(doubled.play).toBe(original.play);
      expect(doubled.byCount).toBe(original.byCount);
    }
  });
});
