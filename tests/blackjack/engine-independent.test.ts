import { describe, expect, it } from 'vitest';
import { applyBlackjack, blackjackLegalActions, blackjackView, createBlackjackState, orderedBlackjackShoe, restoreBlackjack, type BlackjackCommand, type BlackjackState, type ShoeCard } from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';

const table = BLACKJACK_TABLES.find(item => item.id === 'casino-5')!;
function stacked(faces: string[]): ShoeCard[] {
  const remaining = orderedBlackjackShoe(6);
  return [...faces.map(face => {
    const index = remaining.findIndex(card => card.split(':')[1] === face);
    if (index < 0) throw new Error('Invalid independent fixture');
    return remaining.splice(index, 1)[0];
  }), ...remaining];
}
const act = (state: BlackjackState, type: BlackjackCommand['type'], bet?: number) => applyBlackjack(state, { id: `command-${state.revision}`, revision: state.revision, type, ...(bet === undefined ? {} : { bet }) });
function start(faces: string[]): BlackjackState {
  return act(createBlackjackState(table, stacked(faces)), 'deal', 500);
}
// Independent result arithmetic: no engine total/payout/settlement helpers.
function total(cards: readonly ShoeCard[]): number {
  const ranks = cards.map(card => card.split(':')[1][0]);
  const low = ranks.reduce((sum, rank) => sum + (rank === 'A' ? 1 : 'TJQK'.includes(rank) ? 10 : Number(rank)), 0);
  return ranks.includes('A') && low <= 11 ? low + 10 : low;
}
function expectedNet(state: BlackjackState): number {
  const round = state.round!, dealer = total(round.dealer), dealerNatural = dealer === 21 && round.dealer.length === 2;
  let net = -round.ante - round.insuranceBet + (dealerNatural ? 3 * round.insuranceBet : 0);
  for (const hand of round.hands) {
    const player = total(hand.cards), natural = !hand.split && hand.cards.length === 2 && player === 21;
    let returned = 0;
    if (hand.status === 'surrendered') returned = hand.bet / 2;
    else if (player > 21 || dealerNatural && !natural) returned = 0;
    else if (natural) returned = dealerNatural ? hand.bet : hand.bet + hand.bet * (state.rules.blackjackPays === '3:2' ? 3 / 2 : 6 / 5);
    else if (dealer > 21 || player > dealer) returned = hand.bet * 2;
    else if (player === dealer) returned = hand.bet;
    net += returned - hand.bet;
  }
  return net;
}

describe('independent B1 blackjack review', () => {
  it('settles split siblings independently when one busts and another wins', () => {
    let state = start(['8c', '6c', '8d', 'Tc', '9c', 'Th', '2c', '9s']);
    state = act(state, 'split');
    state = act(state, 'hit');
    expect(state.round!.hands[0].status).toBe('busted');
    expect(state.round!.actor).toBe(1);
    state = act(state, 'stand');
    expect(state.round!.hands.map(hand => hand.result)).toEqual(['loss', 'win']);
    expect(state.round!.net).toBe(-50);
    expect(state.round!.net).toBe(expectedNet(state));
    expect(restoreBlackjack(state)).toEqual(state);
  });

  it('keeps undealt cards and a non-peeked dealer hole change out of the view', () => {
    const first = start(['9c', '6c', '7d', 'Td']);
    const second = start(['9c', '6c', '7d', '2d']);
    expect(blackjackView(first)).toEqual(blackjackView(second));
  });

  it.each(BLACKJACK_TABLES.filter(profile => profile.variant === 'classic'))('independently reconciles 25 rounds for $id', profile => {
    let seed = 93721;
    const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
    const shoe = () => {
      const cards = orderedBlackjackShoe(profile.decks);
      for (let i = cards.length - 1; i > 0; i--) { const j = random(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
      return cards;
    };
    let state = createBlackjackState(profile, shoe(), { balance: 10_000_000 });
    let cumulative = 0;
    for (let round = 0; round < 25; round++) {
      if (blackjackView(state).shuffleRequired) state = applyBlackjack(state, { id: `command-${state.revision}`, revision: state.revision, type: 'shuffle', shoe: shoe() });
      state = act(state, 'deal', profile.minBet);
      let guard = 0;
      while (state.round!.phase !== 'settled') {
        expect(++guard).toBeLessThan(80);
        // Even money is tested separately in the reducer suite; this independent
        // settlement oracle evaluates ordinary wagers, insurance and split hands.
        const legal = blackjackLegalActions(state).filter(action => action !== 'even-money');
        const command: BlackjackCommand = { id: `command-${state.revision}`, revision: state.revision, type: legal[random(legal.length)] };
        state = applyBlackjack(state, command);
        expect(applyBlackjack(state, command)).toBe(state);
      }
      const expected = expectedNet(state);
      expect(state.round!.net).toBe(expected);
      cumulative += expected;
      expect(state.balance).toBe(state.initialBalance + cumulative);
      expect(state.ledger.filter(event => event.roundId === state.round!.id && event.kind === 'settle')).toHaveLength(1);
    }
    expect(state.completed).toHaveLength(25);
    expect(restoreBlackjack(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
