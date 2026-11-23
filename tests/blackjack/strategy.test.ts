import { describe, expect, it } from 'vitest';
import { answerDrill, deviationQuestion, drillActions, gradeDrill, newDrill, nextDrill, strategyQuestion } from '../../src/blackjack/drills';
import { BLACKJACK_TABLES, strategyRules } from '../../src/blackjack/presets';
import { bestPlay, deviations, evaluate, evaluateTotal, hintFor, mixAtTrueCount, playAtCount, shoeMix, strategyChart, UP_CARDS, wholeIndex, type StrategyRules } from '../../src/blackjack/strategy';

const fixed = (seed = 11) => (limit: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit; };
const H17: StrategyRules = { decks: 6, dealerHitsSoft17: true, doubleAfterSplit: true, surrender: false }, S17: StrategyRules = { ...H17, dealerHitsSoft17: false };
const code = (cell: { play: string; fallback: string }) => cell.play === 'double' ? (cell.fallback === 'hit' ? 'D' : 'd') : cell.play === 'surrender' ? 'R' : cell.play === 'split' ? 'P' : cell.play === 'hit' ? 'H' : 'S';
const row = (rules: StrategyRules, label: string) => strategyChart(rules).find(item => item.label.startsWith(label))!.plays.map(code).join('');

describe('basic strategy from expected value', () => {
  // Columns are dealer 2 3 4 5 6 7 8 9 10 A. D doubles (else hit), d doubles (else stand).
  // Supplied Patch 18 reference fixtures. These regression comparisons do not
  // establish independent publication provenance or exact finite-deck accuracy.
  it('matches the supplied six-deck H17 reference rows', () => {
    const expected: Record<string, string> = { 'Hard 17': 'SSSSSSSSSS', 'Hard 16': 'SSSSSHHHHH', 'Hard 13': 'SSSSSHHHHH', 'Hard 12': 'HHSSSHHHHH', 'Hard 11': 'DDDDDDDDDD', 'Hard 10': 'DDDDDDDDHH', 'Hard 9': 'HDDDDHHHHH', 'Hard 8': 'HHHHHHHHHH',
      'Soft 20': 'SSSSSSSSSS', 'Soft 19': 'SSSSdSSSSS', 'Soft 18': 'dddddSSHHH', 'Soft 17': 'HDDDDHHHHH', 'Soft 16': 'HHDDDHHHHH', 'Soft 15': 'HHDDDHHHHH', 'Soft 14': 'HHHDDHHHHH', 'Soft 13': 'HHHDDHHHHH',
      'A,A': 'PPPPPPPPPP', '10,10': 'SSSSSSSSSS', '9,9': 'PPPPPSPPSS', '8,8': 'PPPPPPPPPP', '7,7': 'PPPPPPHHHH', '6,6': 'PPPPPHHHHH', '5,5': 'DDDDDDDDHH', '4,4': 'HHHPPHHHHH', '3,3': 'PPPPPPHHHH', '2,2': 'PPPPPPHHHH' };
    for (const [label, plays] of Object.entries(expected)) expect(row(H17, label), label).toBe(plays);
  });
  it('changes the known plays when the dealer stands on soft 17', () => {
    expect(row(S17, 'Hard 11')).toBe('DDDDDDDDDH'); expect(row(S17, 'Soft 18')).toBe('SddddSSHHH'); expect(row(S17, 'Soft 19')).toBe('SSSSSSSSSS');
  });
  it('matches the supplied late-surrender reference rows', () => {
    expect(row({ ...S17, surrender: true }, 'Hard 16')).toBe('SSSSSHHRRR'); expect(row({ ...S17, surrender: true }, 'Hard 15')).toBe('SSSSSHHHRH');
    const h17 = { ...H17, surrender: true }; expect(row(h17, 'Hard 17')).toBe('SSSSSSSSSR'); expect(row(h17, 'Hard 15')).toBe('SSSSSHHHRR'); expect(row(h17, '8,8')).toBe('PPPPPPPPPR');
  });
  it('doubles nine against a two and eleven against an ace in two-deck games', () => {
    expect(row({ ...S17, decks: 2 }, 'Hard 9')).toBe('DDDDDHHHHH'); expect(row({ ...H17, decks: 2 }, 'Hard 11')).toBe('DDDDDDDDDD');
  });
  it('gives every coach table a complete chart', () => {
    for (const table of BLACKJACK_TABLES) { const rules = strategyRules(table); if (!rules) { expect(table.variant).toBe('free-bet'); continue; } const chart = strategyChart(rules); expect(chart).toHaveLength(34); expect(chart.every(item => item.plays.length === 10)).toBe(true); expect(strategyChart(rules)).toBe(chart); }
  });
  it('values a blackjack-proof stand and a bust correctly', () => {
    const twenty = evaluate([10, 10], 6, H17); expect(twenty.stand).toBeGreaterThan(0.6); expect(bestPlay(twenty).play).toBe('stand');
    expect(evaluate([10, 6, 10], 10, H17).stand).toBe(-1); expect(evaluate([10, 6, 5], 10, H17).double).toBeNull();
    const mix = shoeMix(6, [1, 10]); expect(Math.abs(mix.reduce((sum, share) => sum + share, 0) - 1)).toBeLessThan(1e-12); expect(mix[10]).toBe(95 / 310);
  });
  it('removes double after a split when the rules prohibit it', () => {
    const rules = { ...H17, doubleAfterSplit: false, surrender: true };
    const splitHand = evaluate([6, 5], 6, rules, undefined, { afterSplit: true });
    expect(splitHand.double).toBeNull();
    expect(splitHand.split).toBeNull();
    expect(splitHand.surrender).toBeNull();
    expect(bestPlay(splitHand).play).toBe('hit');
    expect(evaluate([6, 5], 6, { ...rules, doubleAfterSplit: true }, undefined, { afterSplit: true }).double).toBeGreaterThan(0);
  });
  it('keeps initial-hand doubling and surrender in non-pair charts without DAS', () => {
    const rules = { ...H17, doubleAfterSplit: false, surrender: true };
    expect(bestPlay(evaluateTotal('hard', 11, 6, rules)).play).toBe('double');
    expect(bestPlay(evaluateTotal('soft', 18, 3, rules)).play).toBe('double');
    expect(bestPlay(evaluateTotal('hard', 16, 10, rules)).play).toBe('surrender');
  });
});

describe('count-based plays', () => {
  it('moves the remaining cards the way the count says', () => {
    const base = shoeMix(6), rich = mixAtTrueCount(base, 'hi-lo', 4), poor = mixAtTrueCount(base, 'hi-lo', -4);
    expect(rich[10]).toBeGreaterThan(base[10]); expect(rich[5]).toBeLessThan(base[5]); expect(Math.abs(rich[8] - base[8])).toBeLessThan(0.001); expect(poor[10]).toBeLessThan(base[10]);
    expect(Math.abs(rich.reduce((sum, share) => sum + share, 0) - 1)).toBeLessThan(1e-12); const neutral = mixAtTrueCount(base, 'hi-opt-2', 6); expect(Math.abs(neutral[1] / neutral[8] - base[1] / base[8])).toBeLessThan(1e-9);
  });
  it('stays within one count of the supplied Hi-Lo reference indices, with at least fourteen exact matches', () => {
    const reference: [string, number][] = [['Insurance', 3], ['Hard 16 against 10', 0], ['Hard 15 against 10', 4], ['10,10 against 5', 5], ['10,10 against 6', 4], ['Hard 10 against 10', 4], ['Hard 12 against 3', 2], ['Hard 12 against 2', 3], ['Hard 11 against ace', 1], ['Hard 9 against 2', 1], ['Hard 10 against ace', 4], ['Hard 9 against 7', 3], ['Hard 16 against 9', 5], ['Hard 13 against 2', -1], ['Hard 12 against 4', 0], ['Hard 12 against 5', -2], ['Hard 12 against 6', -1], ['Hard 13 against 3', -2]];
    const mine = deviations(S17, 'hi-lo'); let exact = 0;
    for (const [label, index] of reference) { const found = mine.find(item => item.label === label); expect(!!found, label).toBe(true); expect(Math.abs(wholeIndex(found!) - index), label).toBeLessThanOrEqual(1); if (wholeIndex(found!) === index) exact++; }
    expect(exact).toBeGreaterThanOrEqual(14);
  });
  it('offers surrender plays only where the table has surrender, and index plays for every system', () => {
    expect(deviations(H17, 'hi-lo').some(item => item.play === 'surrender' || item.basic === 'surrender')).toBe(false);
    expect(deviations({ ...H17, surrender: true }, 'hi-lo').some(item => item.label === 'Hard 14 against 10' && item.play === 'surrender')).toBe(true);
    for (const system of ['hi-lo', 'wong-halves', 'zen', 'hi-opt-2', 'omega-2'] as const) { const list = deviations(H17, system); expect(list.length).toBeGreaterThan(12); expect(list[0].kind).toBe('insurance'); expect(list.every(item => Number.isFinite(item.index) && Math.abs(item.index) <= 8.1 || item.kind === 'insurance')).toBe(true); }
    expect(playAtCount('hard', 16, 10, S17, 'hi-lo', 3)).toBe('stand'); expect(playAtCount('hard', 16, 10, S17, 'hi-lo', -2)).toBe('hit');
  });
});

describe('coach hints and drills', () => {
  it('chooses the best remaining legal play when surrender is unavailable', () => {
    const rules = { ...H17, surrender: true };
    // H17 eight-eight against an ace is a surrender in the model, but the next
    // best legal action is split. Falling back directly to hit/stand loses that option.
    expect(hintFor([8, 8], 1, rules, ['hit', 'stand', 'double', 'split']).play).toBe('split');
  });
  it('follows the chart, respects what is allowed, and applies an index only with a count', () => {
    expect(hintFor([6, 5], 6, H17, ['hit', 'stand', 'double'])).toMatchObject({ play: 'double', byCount: false });
    expect(hintFor([6, 5], 6, H17, ['hit', 'stand']).play).toBe('hit'); expect(hintFor([6, 3, 2], 6, H17, ['hit', 'stand', 'double']).play).toBe('hit');
    expect(hintFor([1, 7], 3, H17, ['hit', 'stand']).play).toBe('stand'); expect(hintFor([8, 8], 10, H17, ['hit', 'stand', 'double', 'split']).play).toBe('split'); expect(hintFor([8, 8], 10, H17, ['hit', 'stand']).play).toBe('hit');
    expect(hintFor([10, 6], 10, S17, ['hit', 'stand']).play).toBe('hit');
    const counted = hintFor([10, 6], 10, S17, ['hit', 'stand'], { system: 'hi-lo', trueCount: 3 }); expect(counted).toMatchObject({ play: 'stand', byCount: true }); expect(counted.reason).toContain('true count of +1 or higher');
    expect(hintFor([10, 6], 10, S17, ['hit', 'stand'], { system: 'hi-lo', trueCount: -1 }).byCount).toBe(false);
    expect(hintFor([10, 10, 2], 6, H17, ['hit', 'stand']).play).toBe('stand'); expect(hintFor([2, 2], 2, H17, ['hit', 'stand']).play).toBe('hit');
  });
  it('asks about real hands and marks answers against the chart', () => {
    const index = fixed();
    for (let i = 0; i < 60; i++) { const q = strategyQuestion(index); expect(q.cards).toHaveLength(2); expect(UP_CARDS.includes(q.up)).toBe(true); expect(q.trueCount).toBeNull();
      const value = (card: string) => card[0] === 'A' ? 1 : 'TJQK'.includes(card[0]) ? 10 : Number(card[0]), total = value(q.cards[0]) + value(q.cards[1]);
      if (q.kind === 'hard') expect(total).toBe(q.key); if (q.kind === 'soft') expect(total + 10).toBe(q.key); if (q.kind === 'pair') { expect(value(q.cards[0])).toBe(q.key); expect(q.cards[0]).not.toBe(q.cards[1]); }
      expect(value(q.upCard)).toBe(q.up); expect(drillActions(q, H17).includes('split')).toBe(q.kind === 'pair');
      const answer = answerDrill(q, 'hit', H17); expect(answer.correct).toBe(answer.basic); expect(answer.right).toBe(answer.correct === 'hit'); }
    expect(drillActions({ kind: 'hard' }, { ...H17, surrender: true })).toEqual(['surrender', 'double', 'stand', 'hit']);
  });
  it('makes the count play correct only once the count reaches the index', () => {
    const index = fixed(5);
    for (let i = 0; i < 80; i++) { const q = deviationQuestion(S17, 'hi-lo', index), d = q.deviation!, whole = wholeIndex(d), reached = d.direction === 'at or above' ? q.trueCount! >= whole : q.trueCount! <= whole;
      const answer = answerDrill(q, 'stand', S17); expect(answer.correct).toBe(reached ? d.play : answer.basic); expect(Math.abs(q.trueCount! - whole)).toBeLessThanOrEqual(3); }
  });
  it('scores a drill once per question', () => {
    let drill = newDrill(strategyQuestion(fixed()));
    const correct = answerDrill(drill.question, 'hit', H17).correct;
    drill = gradeDrill(drill, correct, H17); expect(drill).toMatchObject({ asked: 1, right: 1, streak: 1 }); expect(gradeDrill(drill, 'hit', H17)).toBe(drill);
    drill = nextDrill(drill, strategyQuestion(fixed(3))); expect(drill.answer).toBeNull(); expect(drill.asked).toBe(1);
  });
});
