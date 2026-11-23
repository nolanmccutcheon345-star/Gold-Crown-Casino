import { describe, expect, it } from 'vitest';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { blackjackLobbyMarkup, blackjackTableMarkup, countPanelMarkup, countTrainerMarkup, deviationCoachMarkup, dollars, normalizeBlackjackLobby, sessionMarkup, strategyCoachMarkup } from '../../src/blackjack/screens';
import { deviationQuestion, gradeDrill, newDrill, strategyQuestion } from '../../src/blackjack/drills';
import { strategyRules } from '../../src/blackjack/presets';
import { dealNext, DEFAULT_TRAINER, newTrainer, checkCount, trainerCount } from '../../src/blackjack/trainer';
import { SAMPLE_BLACKJACK } from './fixtures';

const count = (text: string, part: string) => text.split(part).length - 1;
const closed = { available: false, reason: 'Not open yet <b>', balance: null };
const fixed = (seed = 7) => (limit: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit; };

describe('blackjack lobby', () => {
  it('falls back to a valid selection', () => {
    expect(normalizeBlackjackLobby({})).toEqual({ group: 'casino', tableId: 'casino-5', ante: 50, others: 0, heroSeat: 7, pace: 'casino' });
    expect(normalizeBlackjackLobby({ group: 'high', tableId: 'casino-5', ante: 50 })).toEqual({ group: 'high', tableId: 'high-100', ante: 50, others: 0, heroSeat: 7, pace: 'casino' });
    expect(normalizeBlackjackLobby({ others: 4, heroSeat: 1 })).toMatchObject({ others: 4, heroSeat: 1 }); expect(normalizeBlackjackLobby({ others: 5, heroSeat: 3 })).toMatchObject({ others: 0, heroSeat: 7 }); expect(normalizeBlackjackLobby({ pace: 'slow' }).pace).toBe('slow'); expect(normalizeBlackjackLobby({ pace: 'warp' as never }).pace).toBe('casino');
    expect(normalizeBlackjackLobby({ group: 'home', ante: 50 }).ante).toBe(0); expect(normalizeBlackjackLobby({ ante: 75 }).ante).toBe(50);
    expect(normalizeBlackjackLobby({ante: 0}).ante).toBe(0);
    expect(normalizeBlackjackLobby({ group: 'constructor' as never }).group).toBe('casino');
  });
  it.each(BLACKJACK_TABLES.map(table => [table.id, table] as const))('renders %s with its rules and side bets', (_id, table) => {
    const html = blackjackLobbyMarkup({ group: table.group, tableId: table.id }, closed);
    expect(count(html, 'data-blackjack-table=')).toBe(BLACKJACK_TABLES.filter(item => item.group === table.group).length);
    expect(count(html, 'class="bj-side-info"')).toBe(table.sideBets.length); expect(html).toContain(`Blackjack pays ${table.blackjackPays === '3:2' ? '3 to 2' : '6 to 5'}`);
    expect(html).toContain('$2,000'); expect(html).not.toContain('NaN'); expect(html).not.toContain('undefined');
  });
  it('keeps the table closed with an escaped reason until an engine exists', () => {
    const html = blackjackLobbyMarkup({}, closed);
    expect(html).toContain('id="blackjack-sit" class="button primary" disabled aria-describedby="blackjack-sit-note"'); expect(html).toContain('Not open yet &lt;b&gt;');
    expect(blackjackLobbyMarkup({}, { available: true, reason: '', balance: 150000 })).toContain('$1,500<small>300 minimum bets');
  });
});

describe('blackjack table', () => {
  it('formats half-dollar payouts', () => { expect([750, 500, -1250, 222500, 0].map(dollars)).toEqual(['$7.50', '$5', '−$12.50', '$2,225', '$0']); });
  it('offers chips, side-bet spots and Deal while betting', () => {
    const html = blackjackTableMarkup(SAMPLE_BLACKJACK.betting());
    expect(count(html, 'data-blackjack-chip=')).toBe(4); expect(count(html, 'data-blackjack-side=')).toBe(5); expect(html).toContain('id="bj-deal" class="button primary" >Deal');
    expect(html).toContain('21+3 side bet: $5'); expect(html).not.toContain('data-blackjack-action=');
    const broke = { ...SAMPLE_BLACKJACK.betting(), balance: 300, bet: 0 };
    expect(count(blackjackTableMarkup(broke), 'data-blackjack-chip="500" disabled')).toBe(1); expect(blackjackTableMarkup(broke)).toMatch(/data-blackjack-chip="100"\s+aria-label/);
  });
  it('enables only legal actions, hides the dealer hole card and shows the coach only when asked', () => {
    const view = SAMPLE_BLACKJACK.player(), html = blackjackTableMarkup(view);
    for (const action of ['hit', 'stand', 'double']) expect(html).toContain(`data-blackjack-action="${action}" >`);
    expect(html).toContain('data-blackjack-action="split" disabled'); expect(html).not.toContain('data-blackjack-action="surrender"');
    expect(count(html, 'aria-label="Hidden card"')).toBe(1); expect(html).toContain('Showing 6'); expect(html).not.toContain('Coach:'); expect(html).not.toContain('id="bj-hint"');
    const coached = blackjackTableMarkup(view, { coach: true }); expect(coached).toContain('<b>Coach:</b> Double.');
    expect(blackjackTableMarkup({ ...view, hint: null }, { coach: true })).toContain('id="bj-hint"');
    expect(blackjackTableMarkup(SAMPLE_BLACKJACK.highLimit())).toContain('data-blackjack-action="surrender" >');
  });
  it('asks about insurance with its cost', () => {
    const html = blackjackTableMarkup(SAMPLE_BLACKJACK.insurance(), { coach: true });
    expect(html).toContain('Insurance?'); expect(html).toContain('Insure $12.50'); expect(html).toContain('Decline insurance'); expect(html).not.toContain('data-blackjack-action=');
    expect(blackjackTableMarkup({ ...SAMPLE_BLACKJACK.insurance(), legal: { deal: false, actions: [], insurance: true, evenMoney: true } })).toContain('Take even money');
  });
  it('shows split hands, the acting hand and a mistake note', () => {
    const html = blackjackTableMarkup(SAMPLE_BLACKJACK.split());
    expect(count(html, 'data-bj-hand=')).toBe(3); expect(count(html, 'class="bj-hand acting"')).toBe(1); expect(html).toContain('Hand 2 of 3'); expect(html).toContain('$30 · doubled'); expect(html).toContain('The approximate model suggests Double');
  });
  it('reports the round result and offers a rebet', () => {
    const win = blackjackTableMarkup(SAMPLE_BLACKJACK.win());
    expect(win).toContain('You win $17.50'); expect(win).toContain('Blackjack +$22.50'); expect(win).toContain('id="bj-rebet-deal"'); expect(win).toContain('No win −$5');
    expect(blackjackTableMarkup(SAMPLE_BLACKJACK.lose())).toContain('You lose $15'); expect(blackjackTableMarkup(SAMPLE_BLACKJACK.lose())).toContain('PAYS 6 TO 5');
    expect(blackjackTableMarkup({ ...SAMPLE_BLACKJACK.win(), roundNet: 0 })).toContain('<h2>Push</h2>');
  });
  it('totals the session', () => {
    const html = sessionMarkup(SAMPLE_BLACKJACK.betting().session);
    for (const part of ['14 rounds', '−$35', '$215', '87%', '4 of 31 decisions differed', '−$20']) expect(html, part).toContain(part);
    expect(sessionMarkup({ rounds: 1, wagered: 0, fees: 0, net: 0, blackjacks: 0, decisions: 0, mistakes: 0, sideBetNet: 0 })).toContain('1 round ·');
  });
});

describe('ante, strategy coach and count plays', () => {
  it('offers a per-round ante on casino tables and shows its cost', () => {
    const none = blackjackLobbyMarkup({ante: 0}, closed); expect(count(none, 'data-blackjack-ante=')).toBe(3); expect(none).toContain('No-ante night');
    const half = blackjackLobbyMarkup({ tableId: 'casino-2', ante: 50 }, closed); expect(half).toContain('data-blackjack-ante="50" aria-pressed="true"'); expect(half).toContain('One fee per round, including all split hands.'); expect(half).toContain('At $0.50 a round it is 25% of a $2 bet');
    expect(blackjackLobbyMarkup({ group: 'home' }, closed)).not.toContain('data-blackjack-ante');
    expect(blackjackTableMarkup(SAMPLE_BLACKJACK.betting())).toContain('$5 to $500 · $0.50 ante'); expect(sessionMarkup(SAMPLE_BLACKJACK.betting().session)).toContain('<dt>Antes paid</dt><dd class="negative">−$7</dd>');
  });
  it('teaches basic strategy with a drill and the full chart', () => {
    let drill = newDrill(strategyQuestion(fixed(9))); const html = strategyCoachMarkup('casino-5', drill);
    expect(count(html, '<table class="bj-chart">')).toBe(3); expect(count(html, 'data-coach-play=')).toBe(drill.question.kind === 'pair' ? 4 : 3); expect(html).toContain('id="coach-next" class="button secondary">Skip'); expect(html).not.toContain('bj-play-surrender');
    drill = gradeDrill(drill, 'hit', strategyRules(BLACKJACK_TABLES.find(table => table.id === 'casino-5')!)!); const marked = strategyCoachMarkup('casino-5', drill);
    expect(marked).toContain(drill.answer!.right ? 'Matches the model.' : 'Model suggests '); expect(marked).toContain('Model value per bet:'); expect(marked).toContain('>Next hand<'); expect(count(marked, 'data-coach-play="hit" disabled')).toBe(1);
    expect(strategyCoachMarkup('high-100', newDrill(strategyQuestion(fixed())))).toContain('bj-play-surrender'); expect(strategyCoachMarkup('casino-5-free-bet', newDrill(strategyQuestion(fixed())))).toContain('Kitchen table $1: 2 decks');
  });
  it('teaches count plays with a true count and an index table', () => {
    const rules = strategyRules(BLACKJACK_TABLES.find(table => table.id === 'casino-5')!)!; let drill = newDrill(deviationQuestion(rules, 'hi-lo', fixed(4)));
    const html = deviationCoachMarkup('casino-5', 'hi-lo', drill); expect(html).toContain('True count <b>'); expect(html).toContain('<th scope="row">Insurance</th><td>Decline</td><td>Take it</td><td>+3 or higher</td>'); expect(html).toContain('Hi-Lo: index plays'); expect(html).toContain('not verified casino-play indices'); expect(html).not.toContain('within one count of the published');
    drill = gradeDrill(drill, 'stand', rules); expect(deviationCoachMarkup('casino-5', 'hi-lo', drill)).toContain('the true count here is');
    expect(deviationCoachMarkup('high-100', 'omega-2', newDrill(deviationQuestion(strategyRules(BLACKJACK_TABLES.find(table => table.id === 'high-100')!)!, 'omega-2', fixed())))).toContain('Omega II + ace side count: index plays');
  });
});

describe('count coach and trainer', () => {
  const seen = SAMPLE_BLACKJACK.betting().seen;
  it('shows the count only when revealed', () => {
    const hidden = countPanelMarkup(seen, 6, { system: 'hi-lo', reveal: false });
    expect(hidden).toContain('The count is hidden'); expect(hidden).toContain('id="bj-count-answer"'); expect(hidden).not.toContain('Running count</dt>');
    const shown = countPanelMarkup(seen, 6, { system: 'hi-lo', reveal: true });
    expect(shown).toContain('<dt>Running count</dt><dd>0'); expect(shown).toContain('<dd>6<small>nearest half deck'); expect(shown).toContain('<dt>Aces seen</dt><dd>1'); expect(shown).toContain('<dt>Aces unseen</dt><dd>23');
    expect(countPanelMarkup(seen, 6, { system: 'hi-opt-2', reveal: true })).toContain('<dt>Aces seen</dt><dd>1');
    expect(countPanelMarkup(seen, 6, { system: 'hi-lo', reveal: false, answer: { given: 2, right: false, correct: 0 } })).toContain('You said +2; the running count is 0.');
  });
  it('labels doubled Halves units and hides stale or unrevealed ace answers', () => {
    const shown = countPanelMarkup(seen, 6, { system: 'wong-halves-double', reveal: true });
    expect(shown).toContain('True count ×2'); expect(shown).toContain('Original Halves true count');
    expect(shown).toContain('Aces seen'); expect(shown).toContain('not added again');
    const hidden = countPanelMarkup(seen, 6, { system: 'wong-halves-double', reveal: false, answer: {given: 0, right: true, correct: 0, acesGiven: 1, acesCorrect: 1, acesRight: true, seenKey: 'stale'} });
    expect(hidden).toContain('id="bj-count-aces"'); expect(hidden).not.toContain('Aces seen</dt>'); expect(hidden).not.toContain('Ace side count correct.');
  });
  it('grades the ace tally independently of a correct running count', () => {
    const state = dealNext(newTrainer({ ...DEFAULT_TRAINER, mode: 'test' }, fixed()));
    const counted = trainerCount(state);
    const wrong = countTrainerMarkup(checkCount(state, counted.running, counted.acesSeen + 1));
    expect(wrong).toContain('Correct: '); expect(wrong).toContain('keep counting aces separately.'); expect(wrong).toContain('Checks: 0 of 1 correct');
    const right = countTrainerMarkup(checkCount(state, counted.running, counted.acesSeen));
    expect(right).toContain('Ace side count correct.'); expect(right).toContain('Checks: 1 of 1 correct');
  });
  it('teaches with tags in learn mode and hides them in test mode', () => {
    let state = dealNext(newTrainer({ ...DEFAULT_TRAINER, cardsPerDeal: 3 }, fixed()));
    const learn = countTrainerMarkup(state); expect(count(learn, 'class="bj-tag"')).toBe(3); expect(learn).toContain('<dt>Running count</dt>'); expect(learn).not.toContain('id="trainer-answer"');
    state = { ...state, settings: { ...state.settings, mode: 'test' } };
    const test = countTrainerMarkup(state, '4'); expect(test).not.toContain('class="bj-tag"'); expect(test).not.toContain('<dt>Running count</dt>'); expect(test).toContain('id="trainer-answer" inputmode="text" autocomplete="off" value="4"');
    const checked = countTrainerMarkup(checkCount(state, trainerCount(state).running)); expect(checked).toContain('Correct: '); expect(checked).toContain('Checks: 1 of 1 correct · streak 1');
    expect(countTrainerMarkup(dealNext(checkCount(state, 99)))).not.toContain('Not quite');
    expect(countTrainerMarkup({ ...state, settings: { ...state.settings, system: 'omega-2', mode: 'learn' } })).toContain('Betting count');
  });
});
