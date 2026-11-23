/** Presentation projection from the engine's allow-listed public view only. */
import type { Card } from '../contracts';
import { blackjackCutAt, blackjackTotal, type blackjackView } from './engine';
import type { BlackjackTable } from './presets';
import type { BlackjackHandView, BlackjackSession, BlackjackView } from './view-model';
import type { FullTableState, SeatView } from './full-table';

export type PublicBlackjack = ReturnType<typeof blackjackView>;
const PLAY_WORDS: Record<string, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
/** Full table only: the other seats, from the engine's public view. Null for a heads-up game. */
export function liveFullTable(publicState: PublicBlackjack): FullTableState | null {
 const seating = publicState.seating; if (!seating) return null;
 const round = publicState.round, showHands = !!round;
 const seats: SeatView[] = seating.seats.map(seat => {
  if (seat.kind === 'hero') return { seat: seat.seat, kind: 'hero', name: 'You', style: null, hands: [], bet: 0, lastAction: null };
  if (seat.kind === 'empty') return { seat: seat.seat, kind: 'empty', name: '', style: null, hands: [], bet: 0, lastAction: null };
  const hands: BlackjackHandView[] = showHands ? seat.hands.map(h => ({
   cards: h.cards as Card[], total: h.total, soft: h.soft, bet: h.bet, doubled: h.doubled, freeBet: false,
   state: h.status === 'busted' ? 'bust' : h.status === 'surrendered' ? 'surrendered' : h.result === 'blackjack' || h.cards.length === 2 && h.total === 21 && seat.hands.length === 1 ? 'blackjack' : h.status === 'stood' ? 'stood' : 'waiting',
   result: round!.phase === 'settled' && h.result ? { outcome: h.result === 'loss' ? (h.status === 'busted' ? 'bust' : 'lose') : h.result, net: h.payout - h.bet } : null,
  })) : [];
  return { seat: seat.seat, kind: 'player', name: seat.name, style: seat.style, hands, bet: seat.bet, lastAction: seat.lastPlay ? PLAY_WORDS[seat.lastPlay] ?? null : null };
 });
 return { seats, actingSeat: round && round.phase === 'player' ? seating.heroSeat : null, pace: 'casino' };
}
export function liveBlackjackView(publicState: PublicBlackjack, table: BlackjackTable, session: BlackjackSession, seen: readonly Card[], draft: number, changeBet: boolean, hint: BlackjackView['hint'] = null, lastMistake: BlackjackView['lastMistake'] = null): BlackjackView {
 const round = publicState.round, betting = !round || round.phase === 'settled' && changeBet;
 const cards = (round?.dealer ?? []).filter((card): card is string => card !== null);
 const dealer = blackjackTotal(cards.map(card => `0:${card}` as const));
 const lastBet = round ? round.hands.reduce((smallest, hand) => Math.min(smallest, hand.bet / (hand.doubled ? 2 : 1)), Infinity) : 0;
 const bet = betting ? draft : lastBet;
 const nextBet = betting ? draft : lastBet;
 return {
  table, feePerRound: publicState.ante, balance: publicState.balance,
  phase: betting ? 'betting' : round!.phase, bet, lastBet, sideBets: [],
  dealer: { cards: betting ? [] : round!.dealer as (Card|null)[], total: betting ? 0 : dealer.total, soft: dealer.soft },
  hands: betting ? [] : round!.hands.map((hand, index) => ({
   cards: hand.cards as Card[], total: hand.total, soft: hand.soft, bet: hand.bet, doubled: hand.doubled, freeBet: false,
   state: hand.status === 'busted' ? 'bust' : hand.status === 'surrendered' ? 'surrendered' : hand.result === 'blackjack' ? 'blackjack' : hand.status === 'stood' ? 'stood' : index === round!.actor ? 'acting' : 'waiting',
   result: round!.phase === 'settled' ? { outcome: hand.result === 'loss' ? (hand.status === 'busted' ? 'bust' : 'lose') : hand.result!, net: hand.payout - hand.bet } : null,
  })), activeHand: betting ? -1 : round!.actor,
  legal: {
   deal: (!round || round.phase === 'settled') && Number.isSafeInteger(nextBet) && nextBet % 100 === 0 && nextBet >= table.minBet && nextBet <= table.maxBet && nextBet + publicState.ante <= publicState.balance,
   actions: publicState.legalActions.filter((action): action is BlackjackView['legal']['actions'][number] => ['hit','stand','double','split','surrender'].includes(action)),
   insurance: publicState.legalActions.includes('insurance'), evenMoney: publicState.legalActions.includes('even-money'),
  }, insuranceCost: round ? lastBet / 2 : 0,
  shoe: { cards: table.decks * 52, remaining: publicState.cardsRemaining, cutAt: blackjackCutAt(table, !!publicState.seating), lastRound: publicState.shuffleRequired },
  seen, roundNet: betting ? null : round?.net ?? null, hint, lastMistake, session,
 };
}
