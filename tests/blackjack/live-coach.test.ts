import { describe, expect, it } from 'vitest';
import { applyBlackjack, blackjackView, createBlackjackState, orderedBlackjackShoe, type BlackjackState } from '../../src/blackjack/engine';
import { hintAsPlay, liveAdvice, playWords } from '../../src/blackjack/live-coach';
import { liveBlackjackView } from '../../src/blackjack/live-view';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { emptySession } from '../../src/blackjack/runtime';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import type { Card } from '../../src/contracts';

const table = (id: string) => BLACKJACK_TABLES.find(item => item.id === id)!;
/** Deal order: player, dealer up, player, dealer hole, then draws. */
function dealt(id: string, faces: string[], bet = 500, ante = 0): BlackjackState {
  const rest = orderedBlackjackShoe(table(id).decks), first = faces.map(face => rest.splice(rest.findIndex(card => card.split(':')[1] === face), 1)[0]);
  return applyBlackjack(createBlackjackState(table(id), [...first, ...rest], { ante }), { id: 'deal', revision: 0, type: 'deal', bet });
}
/** Cards seen that put a six-deck Hi-Lo true count near `target`, on top of the cards in play. */
const lows = (n: number): Card[] => Array.from({ length: n }, (_, index) => ['2c', '3c', '4c', '5c', '6c'][index % 5]), highs = (n: number): Card[] => Array.from({ length: n }, (_, index) => ['Tc', 'Jc', 'Qc', 'Kc'][index % 4]);

describe('live coach', () => {
  it('gives the basic play with no count and says nothing when there is no decision', () => {
    const state = dealt('high-100', ['Ts', 'Td', '6h', '7c'], 10000), view = blackjackView(state);
    expect(liveAdvice(view, table('high-100'), ['Ts', 'Td', '6h'], null)).toMatchObject({ action: 'surrender' });
    expect(liveAdvice(null, table('casino-5'), [], null)).toBeNull(); expect(liveAdvice(blackjackView(createBlackjackState(table('casino-5'), orderedBlackjackShoe(6))), table('casino-5'), [], null)).toBeNull();
    expect(liveAdvice(view, table('casino-5-free-bet'), [], null)).toBeNull();
  });
  it('applies an index play only when Count coach is on and the count has reached it', () => {
    const state = dealt('casino-5', ['Ts', 'Td', '6h', '7c']), view = blackjackView(state), t = table('casino-5'), base: Card[] = ['Ts', 'Td', '6h'];
    expect(liveAdvice(view, t, base, null)).toEqual({ action: 'hit', reason: 'Hard 16 against 10.' });
    const rich = [...base, ...lows(30)], poor = [...base, ...highs(30)];
    const up = liveAdvice(view, t, rich, { system: 'hi-lo', reveal: true })!; expect(up.action).toBe('stand'); expect(up.reason).toContain('True count now +');
    expect(liveAdvice(view, t, rich, { system: 'hi-lo', reveal: false })!.reason).not.toContain('True count now');
    expect(liveAdvice(view, t, poor, { system: 'hi-lo', reveal: true })!.action).toBe('hit');
    for (const system of ['wong-halves', 'wong-halves-double', 'zen', 'hi-opt-2', 'omega-2'] as const) expect(liveAdvice(view, t, rich, { system, reveal: true })!.action, system).toBe('stand');
  });
  it('takes insurance only at the index, and never without a count', () => {
    const state = dealt('casino-5', ['Ts', 'Ad', '9h', '7c'], 1000), view = blackjackView(state), t = table('casino-5'), base: Card[] = ['Ts', 'Ad', '9h'];
    expect(view.round!.phase).toBe('insurance'); expect(liveAdvice(view, t, base, null)).toEqual({ action: 'no insurance', reason: 'Basic strategy never takes insurance or even money.' });
    const low = liveAdvice(view, t, base, { system: 'hi-lo', reveal: true })!; expect(low.action).toBe('no insurance'); expect(low.reason).toContain('approximate model recommends declining insurance below +3');
    const high = liveAdvice(view, t, [...base, ...lows(40)], { system: 'hi-lo', reveal: true })!; expect(high.action).toBe('insurance'); expect(hintAsPlay(high, view.legalActions)).toBe('insurance');
    expect(liveAdvice(view, t, [...base, ...lows(40)], { system: 'hi-lo', reveal: false })!.reason).not.toContain('now');
    const natural = blackjackView(dealt('casino-5', ['As', 'Ad', 'Kh', '7c'], 1000)); expect(natural.legalActions.includes('even-money')).toBe(true);
    const even = liveAdvice(natural, t, [...base, ...lows(40)], { system: 'hi-lo', reveal: true })!; expect(hintAsPlay(even, natural.legalActions)).toBe('even-money'); expect(natural.legalActions.includes(hintAsPlay(even, natural.legalActions))).toBe(true);
    const broke = blackjackView(applyBlackjack(createBlackjackState(t, (() => { const rest = orderedBlackjackShoe(6); return [...['9c', 'Ad', '7h', '6s'].map(face => rest.splice(rest.findIndex(card => card.split(':')[1] === face), 1)[0]), ...rest]; })(), { balance: 1000, ante: 0 }), { id: 'deal', revision: 0, type: 'deal', bet: 1000 }));
    expect(broke.legalActions).toEqual(['decline-insurance']); expect(liveAdvice(broke, t, [...base, ...lows(40)], { system: 'hi-lo', reveal: true })!.action).toBe('no insurance');
  });
  it('maps hints to engine actions and words', () => {
    expect(hintAsPlay({ action: 'no insurance', reason: '' }, ['decline-insurance', 'insurance'])).toBe('decline-insurance'); expect(hintAsPlay({ action: 'double', reason: '' }, ['hit', 'stand', 'double'])).toBe('double');
    expect(['hit', 'decline-insurance', 'even-money'].map(play => playWords(play as never))).toEqual(['hit', 'no insurance', 'even money']);
  });
});

describe('live table additions', () => {
  const state = dealt('casino-5', ['Ts', '6d', '6h', '7c'], 500, 50), seen: Card[] = ['Ts', '6d', '6h', '5c', '4c', 'Ac'];
  const view = (mistake: Parameters<typeof liveBlackjackView>[7] = null) => liveBlackjackView(blackjackView(state), table('casino-5'), emptySession(), seen, 500, false, null, mistake);
  it('keeps the count in the status strip while playing, or says it is hidden', () => {
    const shown = blackjackTableMarkup(view(), { liveClassic: true, count: { system: 'hi-lo', reveal: true } });
    expect(shown).toContain('data-testid="blackjack-count-strip"'); expect(shown).toContain('<small>Running count</small><b>+2</b><span class="bj-strip-true">True +0.3 · A 1</span>'); expect(shown).toContain('running count +2, true count +0.3, 1 ace seen');
    const hidden = blackjackTableMarkup(view(), { liveClassic: true, count: { system: 'hi-lo', reveal: false } });
    expect(hidden).toContain('<b>Hidden</b><span class="bj-strip-true">6 seen</span>'); expect(hidden.split('data-testid="blackjack-count-strip"')[1].split('</div>')[0]).not.toContain('+2');
    expect(blackjackTableMarkup(view(), { liveClassic: true })).not.toContain('blackjack-count-strip');
  });
  it('offers Test me beside the coach and shows the note it produces', () => {
    const html = blackjackTableMarkup(view({ played: 'stand', better: 'hit. Hard 16 against 6' }), { liveClassic: true, testMe: true });
    expect(html).toContain('id="bj-test-me" type="checkbox" checked'); expect(html).toContain('id="bj-coach" type="checkbox" >'); expect(html).toContain('You chose stand. The approximate model suggests hit. Hard 16 against 6.</p>'); expect(html).not.toContain('data-testid="blackjack-hint"');
    expect(blackjackTableMarkup(view(), {})).not.toContain('bj-test-me');
  });
  it('names the ante in the result headline', () => {
    const done = applyBlackjack(state, { id: 'stand', revision: state.revision, type: 'stand' }), vm = liveBlackjackView(blackjackView(done), table('casino-5'), emptySession(), seen, 500, false);
    const html = blackjackTableMarkup(vm, { liveClassic: true }); expect(html).toContain('after $0.50 ante · Balance ');
    const free = applyBlackjack(dealt('casino-5', ['Ts', '6d', '6h', '7c']), { id: 'stand', revision: 1, type: 'stand' }); expect(blackjackTableMarkup(liveBlackjackView(blackjackView(free), table('casino-5'), emptySession(), seen, 500, false), { liveClassic: true })).not.toContain('ante · Balance');
  });
});
