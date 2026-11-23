/** Paced dealing at a full table. Presentation only: the engine has already resolved the round;
    this replays its cards one at a time, in the order they left the shoe, so a player can count
    them at a dealer's speed. Pure functions, no timers. */
import type { Card } from '../contracts';
import { blackjackTotal } from './engine';
import type { FullTableState, SeatView, TablePace } from './full-table';
import { PACE_LABELS } from './full-table';
import type { BlackjackHandView, BlackjackView } from './view-model';

/** One card dealt this round. `card` is null for the face-down hole card; `flip` marks the hole card turning over. */
export interface DealEntry { seat: number | 'hero' | 'dealer'; hand: number; index: number; card: string | null; flip?: boolean; layout?: {hand:number;index:number}[][]; }
export interface DealOrder { roundId: string; entries: DealEntry[]; }

/** Which entries are new since `before` and should be revealed one at a time. A new round starts from its first card. */
export function revealFrom(before: { roundId: string; length: number } | null, now: DealOrder | null): number {
  if (!now) return 0;
  return before && before.roundId === now.roundId ? Math.min(before.length, now.entries.length) : 0;
}

/** Milliseconds before showing entry `index`: one card's time, a little longer when the action moves to another
    player or the dealer, and none for the first card of a reveal so the table answers the tap at once. */
export function revealDelay(entries: readonly DealEntry[], index: number, start: number, pace: TablePace): number {
  if (index <= start) return 0;
  const card = PACE_LABELS[pace].cardMs, moved = actor(entries[index]) !== actor(entries[index - 1]) && !inOpeningDeal(entries, index);
  return Math.round(card * (moved ? 1.6 : 1));
}
const actor = (entry: DealEntry) => entry.seat === 'dealer' && (entry.index >= 2 || entry.flip) ? 'dealer-plays' : String(entry.seat);
/** The opening deal is two cards to each seat and the dealer; everything after is play. */
function openingLength(entries: readonly DealEntry[]): number {
  const seats = new Set(entries.filter(entry => entry.seat !== 'dealer' && entry.index < 2 && entry.hand === 0).map(entry => entry.seat)).size;
  return seats * 2 + 2;
}
const inOpeningDeal = (entries: readonly DealEntry[], index: number) => index < openingLength(entries);

/** What the action bar says while cards are still coming. */
export function revealLabel(entries: readonly DealEntry[], next: number, names: ReadonlyMap<number, string>): string {
  if (next >= entries.length) return '';
  if (inOpeningDeal(entries, next)) return 'Dealing';
  const entry = entries[next];
  if (entry.seat === 'dealer') return 'Dealer plays';
  if (entry.seat === 'hero') return 'Dealing';
  return `${names.get(entry.seat) ?? 'Another player'} is playing`;
}

const total = (cards: readonly string[]) => blackjackTotal(cards.map(card => `0:${card}` as `${number}:${string}`));
/* During a reveal no hand is acting and no result is shown yet; a hand still waiting for cards shows only what has been dealt. */
function layoutHands(hands: readonly BlackjackHandView[], layout: {hand:number;index:number}[][]): BlackjackHandView[] {
  return layout.filter(group => group.length).map(group => {
    const base = hands[group[0].hand], cards = group.map(at => hands[at.hand].cards[at.index]);
    const complete = cards.length === base.cards.length && cards.every((card, i) => card === base.cards[i]);
    const sum = total(cards);
    return { ...base, cards, total: sum.total, soft: sum.soft, result: null, state: complete && base.state !== 'acting' ? base.state : 'waiting', doubled: complete && base.doubled, bet: !complete && base.doubled ? base.bet / 2 : base.bet };
  });
}
function maskHands(hands: readonly BlackjackHandView[], hidden: ReadonlySet<string>, prefix: string): BlackjackHandView[] {
  return hands.map((hand, handIndex): BlackjackHandView => {
    const keep = hand.cards.filter((_, index) => !hidden.has(`${prefix}|${handIndex}|${index}`));
    if (keep.length === hand.cards.length) return { ...hand, state: hand.state === 'acting' ? 'waiting' : hand.state, result: null };
    const sum = total(keep);
    /* A double shows only once its card does. */
    return { ...hand, cards: keep, total: sum.total, soft: sum.soft, state: 'waiting', result: null, ...(hand.doubled ? { doubled: false, bet: hand.bet / 2 } : {}) };
  });
}
/** The table as it looked after the first `shown` entries: later cards removed, the hole card face down until its
    turn, results held back on any hand still waiting for a card, and the count without the cards not yet shown. */
export function maskTable(view: BlackjackView, full: FullTableState | null, entries: readonly DealEntry[], shown: number, before?: Pick<BlackjackView, 'balance' | 'session'>): { view: BlackjackView; full: FullTableState | null } {
  if (shown >= entries.length) return { view, full };
  const later = entries.slice(shown), hidden = new Set<string>(), unseen: string[] = [];
  let holeDown = false;
  for (const entry of later) {
    if (entry.flip) { holeDown = true; if (entry.card) unseen.push(entry.card); continue; }
    hidden.add(`${entry.seat}|${entry.hand}|${entry.index}`);
    if (entry.card) unseen.push(entry.card);
  }
  const dealerCards = view.dealer.cards.flatMap((card, index) => hidden.has(`dealer|0|${index}`) ? [] : [index === 1 && holeDown ? null : card]);
  const dealerTotal = total(dealerCards.filter((card): card is Card => card !== null));
  const seen = [...view.seen];
  for (const card of unseen) { const at = seen.lastIndexOf(card as Card); if (at >= 0) seen.splice(at, 1); }
  const masked: BlackjackView = {
    ...view, balance: before?.balance ?? view.balance - (view.roundNet ?? 0), session: before?.session ?? { ...view.session, rounds: Math.max(0, view.session.rounds - (view.roundNet === null ? 0 : 1)), net: view.session.net - (view.roundNet ?? 0) }, shoe: { ...view.shoe, remaining: view.shoe.remaining + later.filter(entry => !entry.flip).length, lastRound: view.shoe.cards - view.shoe.remaining - later.filter(entry => !entry.flip).length >= view.shoe.cutAt }, lastMistake: null, phase: 'player', hands: maskHands(view.hands, hidden, 'hero'),
    activeHand: -1, legal: { ...view.legal, deal: false, actions: [], insurance: false, evenMoney: false },
    dealer: { cards: dealerCards, total: dealerTotal.total, soft: dealerTotal.soft }, seen, roundNet: null, hint: null,
  };
  const frontier = later[0].seat;
  const frontierSeat = frontier === 'hero' ? full?.seats.find(seat => seat.kind === 'hero')?.seat ?? 0 : typeof frontier === 'number' ? frontier : Infinity;
  const seats: SeatView[] | null = full ? full.seats.map(seat => seat.kind !== 'player' ? seat : { ...seat, lastAction: null, hands: (() => { const layout = entries.slice(0, shown).filter(entry => entry.seat === seat.seat && entry.layout).at(-1)?.layout; return layout ? layoutHands(seat.hands, layout) : maskHands(seat.hands, hidden, String(seat.seat)).filter(hand => hand.cards.length); })().map(hand => shown < openingLength(entries) || seat.seat >= frontierSeat ? { ...hand, state: 'waiting' as const } : hand) }) : null;
  const nextSeat = later[0].seat;
  return { view: masked, full: full && seats ? { ...full, seats, actingSeat: typeof nextSeat === 'number' ? nextSeat : null } : null };
}
