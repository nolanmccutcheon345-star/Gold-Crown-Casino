import { describe, expect, it } from 'vitest';
import { applyBlackjack, blackjackView, createBlackjackState, orderedBlackjackShoe, type BlackjackState, type ShoeCard, type TableSeating } from '../../src/blackjack/engine';
import { BlackjackController } from '../../src/blackjack/controller';
import { emptySession, initialBlackjackData, type BlackjackPort } from '../../src/blackjack/runtime';
import { maskTable, revealDelay, revealFrom, revealLabel, type DealEntry } from '../../src/blackjack/deal-pace';
import { liveBlackjackView, liveFullTable } from '../../src/blackjack/live-view';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import { otherSeatsMarkup } from '../../src/blackjack/full-table';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { SEAT_RULES_VERSION } from '../../src/blackjack/table-players';
import type { Card } from '../../src/contracts';

const table = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!;
const port: BlackjackPort = { load: async () => null, commit: async () => undefined, snapshot: async () => null, close: () => undefined };
const seating = (heroSeat: number, seats: [number, TableSeating['players'][number]['style']][]): TableSeating => ({ rules: SEAT_RULES_VERSION, heroSeat, players: seats.map(([seat, style], i) => ({ seat, id: `p${i}`, name: ['Ann', 'Bo', 'Cy'][i], style, betUnits: 1 })) });
function stacked(faces: string[]): ShoeCard[] { const rest = orderedBlackjackShoe(6), front: ShoeCard[] = []; for (const face of faces) { const at = rest.findIndex(card => card.endsWith(':' + face)); front.push(rest.splice(at, 1)[0]); } return [...front, ...rest]; }
let n = 0; const cmd = (state: BlackjackState, type: string, extra: object = {}) => applyBlackjack(state, { id: `d${n++}`, revision: state.revision, type: type as never, ...extra });
function controllerFor(engine: BlackjackState): BlackjackController {
  const c = new BlackjackController(port);
  c.data = { ...initialBlackjackData(), balance: engine.balance, active: { id: 'a', sessionId: 's', startedAt: '', engine, reviews: [], prior: emptySession() } };
  return c;
}
const where = (entries: DealEntry[]) => entries.map(e => `${e.seat}${e.flip ? '!' : ''}:${e.hand}.${e.index}=${e.card ?? '?'}`);
// Seat 1 (Ann, mimics the dealer), Hero in seat 2, seat 3 (Bo, mimics the dealer). Dealer 9 up, 7 hole.
const shoe = () => stacked(['5c', 'Tc', '6h', '9d', '4c', '9h', 'Th', '7s', '8c', '2d', '3s']);
const engineAfterDeal = () => cmd(createBlackjackState(table, shoe(), { seating: seating(2, [[1, 'mimic-dealer'], [3, 'mimic-dealer']]) }), 'deal', { bet: 500 });

describe('the deal order the controller reports', () => {
  it('lists this round\'s cards as they left the shoe, with the hole card face down', () => {
    const order = controllerFor(engineAfterDeal()).dealOrder!;
    // Ann 5,4 = 9 takes 8 (17) before Hero acts. Bo waits.
    expect(where(order.entries)).toEqual(['1:0.0=5c', 'hero:0.0=Tc', '3:0.0=6h', 'dealer:0.0=9d', '1:0.1=4c', 'hero:0.1=9h', '3:0.1=Th', 'dealer:0.1=?', '1:0.2=8c']);
  });
  it('turns the hole card over just before the dealer draws, after everyone has played', () => {
    const order = controllerFor(cmd(engineAfterDeal(), 'stand')).dealOrder!;
    // Bo 6,10 = 16 hits 2 (18); dealer 9,7 = 16 hits 3 (19).
    expect(where(order.entries).slice(9)).toEqual(['3:0.2=2d', 'dealer!:0.1=7s', 'dealer:0.2=3s']);
    expect(order.entries.filter(e => e.card === null)).toHaveLength(1);
  });
  it('is empty without a round', () => { expect(controllerFor(createBlackjackState(table, shoe())).dealOrder).toBeNull(); });
});

describe('revealing the cards one at a time', () => {
  const engine = cmd(engineAfterDeal(), 'stand'), c = controllerFor(engine), order = c.dealOrder!, state = blackjackView(engine);
  const view = liveBlackjackView(state, table, c.session, c.seen, 0, false), full = liveFullTable(state)!;
  it('starts a new round from its first card, and an action from where the table was', () => {
    expect(revealFrom(null, order)).toBe(0); expect(revealFrom({ roundId: 'old', length: 30 }, order)).toBe(0);
    expect(revealFrom({ roundId: order.roundId, length: 9 }, order)).toBe(9); expect(revealFrom({ roundId: order.roundId, length: 99 }, order)).toBe(order.entries.length);
  });
  it('shows nothing new before the first step and everything after the last', () => {
    const empty = maskTable(view, full, order.entries, 0);
    expect(empty.view.dealer.cards).toEqual([]); expect(empty.full!.seats.every(seat => seat.hands.length === 0)).toBe(true); expect(empty.view.hands[0].cards).toEqual([]); expect(empty.full!.seats.flatMap(s => s.hands.flatMap(h => h.cards))).toEqual([]);
    expect(empty.view.seen.length).toBe(c.seen.length - order.entries.filter(e => e.card !== null).length);
    expect(maskTable(view, full, order.entries, order.entries.length)).toEqual({ view, full });
  });
  it('keeps the hole card face down until its turn, and every result hidden until the end', () => {
    const beforeFlip = maskTable(view, full, order.entries, 10);
    expect(beforeFlip.view.dealer.cards).toEqual(['9d', null]); expect(beforeFlip.view.dealer.total).toBe(9);
    expect(beforeFlip.view.hands[0].result).toBeNull(); expect(beforeFlip.view.phase).toBe('player'); expect(beforeFlip.view.legal.actions).toEqual([]); expect(beforeFlip.view.roundNet).toBeNull();
    expect(beforeFlip.full!.seats.find(s => s.seat === 3)!.hands[0].cards).toEqual(['6h', 'Th', '2d']); expect(beforeFlip.full!.seats.every(s => s.hands.every(h => h.result === null))).toBe(true);
    const flipped = maskTable(view, full, order.entries, 11);
    expect(flipped.view.dealer.cards).toEqual(['9d', '7s']); expect(flipped.view.dealer.total).toBe(16);
  });
  it('counts only the cards already shown', () => {
    for (let shown = 0; shown <= order.entries.length; shown++) {
      const masked = maskTable(view, full, order.entries, shown), visible = order.entries.slice(shown).filter(e => e.card !== null).length;
      expect(masked.view.seen.length).toBe(c.seen.length - visible);
      const onTable = [...masked.view.dealer.cards, ...masked.view.hands.flatMap(h => h.cards), ...masked.full!.seats.flatMap(s => s.hands.flatMap(h => h.cards))].filter((x): x is Card => x !== null);
      for (const card of onTable) expect(masked.view.seen).toContain(card);
    }
  });
  it('totals each hand from the cards it shows', () => {
    const masked = maskTable(view, full, order.entries, 5);
    expect(masked.full!.seats.find(s => s.seat === 1)!.hands[0]).toMatchObject({ cards: ['5c', '4c'], total: 9, state: 'waiting' });
    expect(masked.view.hands[0]).toMatchObject({ cards: ['Tc'], total: 10 });
  });
  it('says who is acting, and waits longer when the action moves on', () => {
    const names = new Map([[1, 'Ann'], [3, 'Bo']]);
    expect(revealLabel(order.entries, 0, names)).toBe('Dealing'); expect(revealLabel(order.entries, 8, names)).toBe('Ann is playing');
    expect(revealLabel(order.entries, 9, names)).toBe('Bo is playing'); expect(revealLabel(order.entries, 10, names)).toBe('Dealer plays'); expect(revealLabel(order.entries, 12, names)).toBe('');
    expect(revealDelay(order.entries, 0, 0, 'casino')).toBe(0); expect(revealDelay(order.entries, 3, 0, 'casino')).toBe(550);
    expect(revealDelay(order.entries, 9, 9, 'slow')).toBe(0); expect(revealDelay(order.entries, 10, 9, 'slow')).toBe(1600); expect(revealDelay(order.entries, 11, 9, 'fast')).toBe(300);
  });
  it('shows a double only once its card is out', () => {
    // Seat 1 (Ann, a gambler) has 5,6 = 11 and doubles before Hero acts.
    const doubled = cmd(createBlackjackState(table, stacked(['5c', 'Tc', '9d', '6h', '9h', '7s', '8c']), { seating: seating(2, [[1, 'gambler']]) }), 'deal', { bet: 500 });
    const dc = controllerFor(doubled), dorder = dc.dealOrder!, dstate = blackjackView(doubled), dfull = liveFullTable(dstate)!, dview = liveBlackjackView(dstate, table, dc.session, dc.seen, 0, false);
    expect(dfull.seats.find(s => s.seat === 1)!.hands[0]).toMatchObject({ doubled: true, bet: 1000 });
    expect(maskTable(dview, dfull, dorder.entries, dorder.entries.length - 1).full!.seats.find(s => s.seat === 1)!.hands[0]).toMatchObject({ cards: ['5c', '6h'], doubled: false, bet: 500 });
  });
});
describe('before your cards arrive', () => {
  it('shows no total for a hand with no cards yet', () => {
    const engine = engineAfterDeal(), c = controllerFor(engine), state = blackjackView(engine);
    const view = liveBlackjackView(state, table, c.session, c.seen, 0, false), masked = maskTable(view, liveFullTable(state), c.dealOrder!.entries, 0);
    const html = blackjackTableMarkup(masked.view, { waitingFor: 'Dealing', skipReveal: true });
    expect(html).toContain('aria-label="Your hand: no cards yet.'); expect(html).toContain('<span class="bj-empty">Dealing…</span>'); expect(otherSeatsMarkup(masked.full!)).not.toMatch(/bj-seat-total/); expect(otherSeatsMarkup(masked.full!)).toContain('$5'); expect(html.split('data-bj-hand="0"')[1].split('</article>')[0]).not.toContain('class="bj-total"');
    expect(blackjackTableMarkup(view).split('data-bj-hand="0"')[1].split('</article>')[0]).toContain('class="bj-total"');
  });
});
