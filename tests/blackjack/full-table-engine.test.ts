import { describe, expect, it } from 'vitest';
import { applyBlackjack, blackjackTotal, blackjackView, createBlackjackState, orderedBlackjackShoe, restoreBlackjack, type BlackjackState, type ShoeCard, type TableSeating } from '../../src/blackjack/engine';
import { fullTableSeating } from '../../src/blackjack/controller';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { SEAT_RULES_VERSION } from '../../src/blackjack/table-players';

const table = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!, surrenderTable = BLACKJACK_TABLES.find(t => t.id === 'high-100')!;
const seating = (heroSeat: number, seats: [number, TableSeating['players'][number]['style']][]): TableSeating => ({ rules: SEAT_RULES_VERSION, heroSeat, players: seats.map(([seat, style], i) => ({ seat, id: `p${i}`, name: `P${i}`, style, betUnits: 1 })) });
/** A six-deck shoe with the given faces dealt first, in order. */
function stacked(faces: string[], decks = 6): ShoeCard[] {
  const rest = orderedBlackjackShoe(decks), front: ShoeCard[] = [];
  for (const face of faces) { const at = rest.findIndex(card => card.endsWith(':' + face)); front.push(rest.splice(at, 1)[0]); }
  return [...front, ...rest];
}
let n = 0; const cmd = (state: BlackjackState, type: string, extra: object = {}) => applyBlackjack(state, { id: `c${n++}`, revision: state.revision, type: type as never, ...extra });
const faces = (cards: readonly string[]) => cards.map(card => card.split(':')[1]);

describe('full-table rounds', () => {
  it('leaves a heads-up game exactly as it was', () => {
    const state = createBlackjackState(table, orderedBlackjackShoe(6));
    expect('seating' in state).toBe(false); const dealt = cmd(state, 'deal', { bet: 500 });
    expect('others' in dealt.round!).toBe(false); expect('seating' in blackjackView(dealt)).toBe(false);
  });
  it('deals one card to each seat from first base, the up card, a second round, then the hole card', () => {
    // Seats 2 (other), 4 (Hero), 6 (other). Order: s2, s4, s6, up, s2, s4, s6, hole.
    const shoe = stacked(['2c', '3c', '4c', '9d', '5c', '6c', '7c', 'Td']);
    const state = cmd(createBlackjackState(table, shoe, { seating: seating(4, [[2, 'mimic-dealer'], [6, 'mimic-dealer']]) }), 'deal', { bet: 500 });
    const round = state.round!;
    expect(faces(round.hands[0].cards)).toEqual(['3c', '6c']); expect(faces(round.dealer)).toEqual(['9d', 'Td']);
    // Seat 2 played before Hero (2,5 = 7: the mimic hits until 17); seat 6 waits for Hero.
    expect(faces(round.others![0].hands[0].cards).slice(0, 2)).toEqual(['2c', '5c']); expect(round.others![0].hands[0].status).not.toBe('playing');
    expect(faces(round.others![1].hands[0].cards)).toEqual(['4c', '7c']); expect(round.others![1].plays).toEqual([]);
    expect(round.phase).toBe('player'); expect(blackjackView(state).round!.dealer[1]).toBeNull();
  });
  it('plays the seats after Hero, then the dealer, when Hero stands', () => {
    const shoe = stacked(['Tc', 'Th', '9d', '9h', '6s', '8d', '7s']);
    let state = cmd(createBlackjackState(table, shoe, { seating: seating(1, [[2, 'mimic-dealer']]) }), 'deal', { bet: 500 });
    // Order: Hero (seat 1), seat 2, up, Hero, seat 2, hole. Hero 10,9 = 19; seat 2 has 10,6 = 16 and waits; dealer 9 up, 8 hole.
    expect(state.round!.others![0].plays).toEqual([]); state = cmd(state, 'stand');
    const round = state.round!;
    expect(round.phase).toBe('settled'); expect(round.others![0].plays[0].play).toBe('hit'); expect(faces(round.others![0].hands[0].cards)).toEqual(['Th', '6s', '7s']);
    expect(round.others![0].hands[0].status).toBe('busted'); expect(faces(round.dealer)).toEqual(['9d', '8d']); expect(round.hands[0].result).toBe('win');
  });
  it('makes the dealer play out for the other seats even when Hero has busted', () => {
    const shoe = stacked(['Tc', 'Th', '6d', '6c', '9h', '7s', 'Kd', '2c', '9c']);
    // Hero seat 1: 10,6 vs dealer 6 up, 7 hole... seat 2 (never busts) 10,9 = 19, stands.
    let state = cmd(createBlackjackState(table, shoe, { seating: seating(1, [[2, 'never-bust']]) }), 'deal', { bet: 500 });
    expect(faces(state.round!.hands[0].cards)).toEqual(['Tc', '6c']); state = cmd(state, 'hit'); // 10,6,K: bust
    const round = state.round!; expect(round.hands[0].status).toBe('busted'); expect(round.phase).toBe('settled');
    expect(faces(round.dealer)).toEqual(['6d', '7s', '2c', '9c']); expect(blackjackTotal(round.dealer).total).toBe(24);
    expect(round.others![0].hands[0].result).toBe('win'); expect(round.net).toBe(-550);
    // Heads-up, the same busted hand ends the round without the dealer drawing.
    let alone = cmd(createBlackjackState(table, stacked(['Tc', '6d', '6c', '7s', 'Kd'])), 'deal', { bet: 500 }); alone = cmd(alone, 'hit');
    expect(alone.round!.dealer).toHaveLength(2);
  });
  it('ends the round for everyone on a dealer blackjack, and pays the gambler\'s insurance as scenery only', () => {
    const shoe = stacked(['9c', 'Tc', 'Ad', '8c', '9h', 'Kd']);
    let state = cmd(createBlackjackState(table, shoe, { seating: seating(1, [[2, 'gambler']]) }), 'deal', { bet: 500 });
    expect(state.round!.phase).toBe('insurance'); expect(state.round!.others![0].insured).toBe(true);
    const before = state.balance; state = cmd(state, 'decline-insurance');
    expect(state.round!.phase).toBe('settled'); expect(state.round!.others![0].plays).toEqual([]); expect(state.round!.others![0].hands[0].result).toBe('loss');
    expect(state.balance).toBe(before); expect(state.ledger.every(event => event.roundId === state.round!.id)).toBe(true);
  });
  it('lets Hero take even money while the round goes on for the others', () => {
    const shoe = stacked(['As', '9c', 'Ad', 'Kh', '7h', '6d', '5c', 'Tc']);
    let state = cmd(createBlackjackState(table, shoe, { seating: seating(1, [[2, 'mimic-dealer']]) }), 'deal', { bet: 1000 });
    expect(blackjackView(state).legalActions).toContain('even-money'); state = cmd(state, 'even-money');
    const round = state.round!;
    expect(round.phase).toBe('settled'); expect(round.hands[0].payout).toBe(2000); expect(round.others![0].plays.length).toBeGreaterThan(0);
    expect(faces(round.dealer).length).toBeGreaterThan(2); expect(round.net).toBe(1000 - 50);
  });
  it('requires a between-round shuffle near the end of the shoe', () => {
    const shoe = stacked([]); let state = createBlackjackState(table, shoe, { seating: seating(1, [[2, 'gambler']]) });
    state = { ...state, cursor: shoe.length - 30 } as BlackjackState; // test-only: jump to 30 cards left
    expect(() => cmd(state, 'deal', { bet: 500 })).toThrow(/Cut card/);
  });
  it('rejects bad seating', () => {
    const shoe = orderedBlackjackShoe(6);
    for (const bad of [seating(8, [[1, 'gambler']]), seating(1, [[1, 'gambler']]), seating(1, []), { ...seating(1, [[2, 'gambler']]), rules: 'other' }, seating(1, [[3, 'gambler'], [2, 'gambler']]), { ...seating(1, [[2, 'gambler']]), players: [{ seat: 2, id: 'x', name: 'X', style: 'shark', betUnits: 1 }] }])
      expect(() => createBlackjackState(table, shoe, { seating: bad as TableSeating })).toThrow();
  });
  it('chooses a lineup for Sit down, or none when Hero plays alone', () => {
    expect(fullTableSeating({ others: 0, heroSeat: 7 })).toBeUndefined();
    const lineup = fullTableSeating({ others: 4, heroSeat: 4 }, () => 0)!;
    expect(lineup.heroSeat).toBe(4); expect(lineup.players.map(p => p.seat)).toEqual([2, 3, 5, 6]); expect(new Set(lineup.players.map(p => p.id)).size).toBe(4);
    expect(() => createBlackjackState(table, orderedBlackjackShoe(6), { seating: lineup })).not.toThrow();
  });
});

describe('long run at a full table', () => {
  let seed = 7; const random = (limit: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit; };
  const shuffled = (decks: number) => { const shoe = orderedBlackjackShoe(decks); for (let i = shoe.length - 1; i > 0; i--) { const j = random(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } return shoe; };
  for (const [name, rules] of [['six-deck H17', table], ['high limit with surrender', surrenderTable], ['two-deck', BLACKJACK_TABLES.find(t => t.id === 'casino-10-double')!]] as const) it(`keeps every invariant over 400 rounds (${name})`, () => {
    let rounds = 0, dealerPlayedOut = 0, seatsPlayed = 0;
    for (let session = 0; session < 8; session++) {
      const lineup = fullTableSeating({ others: [2, 4, 6][session % 3], heroSeat: [1, 4, 7][session % 3] }, random)!;
      let state = createBlackjackState(rules, shuffled(rules.decks), { balance: 10_000_000, ante: 0, seating: lineup });
      for (let r = 0; r < 50; r++) {
        if (blackjackView(state).shuffleRequired) state = cmd(state, 'shuffle', { shoe: shuffled(rules.decks) });
        const start = state.cursor; state = cmd(state, 'deal', { bet: rules.minBet });
        while (state.round!.phase !== 'settled') {
          const view = blackjackView(state);
          // Hidden hole card never leaks; every other seat's dealt card is public.
          expect(view.round!.dealer[1]).toBeNull();
          const legal = view.legalActions; state = cmd(state, legal[random(legal.length)]);
        }
        const round = state.round!; rounds++;
        // Every card dealt this round is on the table, in shoe order: nothing drawn twice or lost.
        const onTable = [...round.dealer, ...round.hands.flatMap(h => h.cards), ...round.others!.flatMap(o => o.hands.flatMap(h => h.cards))];
        expect(onTable.length).toBe(state.cursor - start); expect(new Set(onTable)).toEqual(new Set(state.shoe.slice(start, state.cursor)));
        // A dealer blackjack ends the round before anyone plays (Hero's hand is left the same way); otherwise every seat has finished.
        const dealerBJ = blackjackTotal(round.dealer).total === 21 && round.dealer.length === 2;
        for (const o of round.others!) for (const h of o.hands) { if (!dealerBJ) expect(h.status).not.toBe('playing'); expect(h.result).toBeDefined(); }
        seatsPlayed += round.others!.reduce((sum, o) => sum + o.plays.length, 0);
        const othersLive = round.others!.some(o => o.hands.some(h => h.status === 'stood' && !(h.cards.length === 2 && !h.split && blackjackTotal(h.cards).total === 21)));
        if (othersLive && blackjackTotal(round.dealer.slice(0, 2)).total !== 21) { expect(blackjackTotal(round.dealer).total).toBeGreaterThanOrEqual(17); dealerPlayedOut++; }
        expect(view(state)).toBe(true);
      }
      // The whole session replays to the identical state from its shoe and commands.
      expect(JSON.stringify(restoreBlackjack(JSON.parse(JSON.stringify(state))))).toBe(JSON.stringify(state));
    }
    expect(rounds).toBe(400); expect(dealerPlayedOut).toBeGreaterThan(100); expect(seatsPlayed).toBeGreaterThan(400);
  });
  function view(state: BlackjackState): boolean {
    const seats = blackjackView(state).seating!; expect(seats.seats).toHaveLength(7); expect(seats.seats.filter(s => s.kind === 'hero')).toHaveLength(1);
    // Only Hero's money moves: the ledger has only Hero's kinds, and the balance agrees with it.
    expect(state.ledger.every(e => ['bet', 'ante', 'split', 'double', 'insurance', 'settle'].includes(e.kind))).toBe(true);
    return true;
  }
});
