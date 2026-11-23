/** Other players at a full blackjack table. Proposal data and decision rules for seat bots:
    every decision is a pure function of the player's style and the cards on the table, with no
    randomness, so a round can be replayed from the shoe and the styles alone. These players'
    chips are scenery: only Hero's wagers ever reach a ledger. */
import type { BlackjackTable } from './presets';
import type { Play, Value } from './strategy';

/** Seat decisions are replayed from saved rounds, so the rules below are frozen. A change to how
    any style plays needs a new version here and in the engine, never an edit to this one. */
export const SEAT_RULES_VERSION = 'seat-styles-2';

export type PlayerStyle = 'by-the-book' | 'never-bust' | 'mimic-dealer' | 'gambler';
export const STYLE_LABELS: Record<PlayerStyle, { label: string; note: string }> = {
  'by-the-book': { label: 'By the book', note: 'Plays a standard multi-deck basic-strategy chart.' },
  'never-bust': { label: 'Never busts', note: 'Stands on any hard 12 or more and never doubles or splits, except to split aces and eights.' },
  'mimic-dealer': { label: 'Plays like the dealer', note: 'Hits until 17, then stands. Never doubles, splits or surrenders.' },
  'gambler': { label: 'Gambler', note: 'Doubles any 9, 10 or 11, splits every pair, and takes insurance.' },
};
export interface TablePlayer { id: string; name: string; style: PlayerStyle; /** Bet as a multiple of the table minimum. */ betUnits: number; }
export const TABLE_PLAYERS: readonly TablePlayer[] = [
  { id: 'dana', name: 'Dana', style: 'by-the-book', betUnits: 2 }, { id: 'max', name: 'Max', style: 'never-bust', betUnits: 1 }, { id: 'priya', name: 'Priya', style: 'by-the-book', betUnits: 1 },
  { id: 'lou', name: 'Lou', style: 'gambler', betUnits: 3 }, { id: 'sam', name: 'Sam', style: 'mimic-dealer', betUnits: 1 }, { id: 'inez', name: 'Inez', style: 'never-bust', betUnits: 2 },
  { id: 'theo', name: 'Theo', style: 'gambler', betUnits: 1 }, { id: 'ruth', name: 'Ruth', style: 'mimic-dealer', betUnits: 2 },
];
export const SEATS = 7;

const total = (cards: readonly Value[]) => { const hard = cards.reduce((sum, card) => sum + card, 0), soft = cards.includes(1) && hard + 10 <= 21; return { value: soft ? hard + 10 : hard, soft }; };
/** What a seat bot does with a hand. `legal` is what the table allows right now; the result is always one of them. */
export function seatPlay(style: PlayerStyle, cards: readonly Value[], up: Value, _table: BlackjackTable, legal: readonly Play[]): Play {
  if (!legal.length) throw new Error('A seat decision requires at least one legal action.');
  const can = (play: Play) => legal.includes(play), hand = total(cards), pair = cards.length === 2 && cards[0] === cards[1];
  const fallback = (want: 'hit' | 'stand'): Play => can(want) ? want : can('stand') ? 'stand' : legal[0];
  if (style === 'by-the-book') { const play = bookPlay(cards, up, can); return can(play) ? play : fallback(play === 'stand' ? 'stand' : 'hit'); }
  if (style === 'mimic-dealer') return fallback(hand.value >= 17 ? 'stand' : 'hit');
  if (style === 'never-bust') {
    if (pair && (cards[0] === 1 || cards[0] === 8) && can('split')) return 'split';
    return fallback(hand.soft ? (hand.value >= 18 ? 'stand' : 'hit') : hand.value >= 12 ? 'stand' : 'hit');
  }
  if (pair && can('split')) return 'split';
  if (cards.length === 2 && !hand.soft && hand.value >= 9 && hand.value <= 11 && can('double')) return 'double';
  return fallback(hand.value >= 17 || !hand.soft && hand.value >= 13 && up <= 6 && up !== 1 ? 'stand' : 'hit');
}
/* A fixed multi-deck chart (double after split): the by-the-book player's whole brain. It does not
   follow the coach's approximate model, so a model change can never alter a saved round. */
function bookPlay(cards: readonly Value[], up: Value, can: (play: Play) => boolean): Play {
  const hand = total(cards), dealer = up === 1 ? 11 : up, wantDouble = (otherwise: Play): Play => can('double') ? 'double' : otherwise;
  if (cards.length === 2 && cards[0] === cards[1] && can('split')) {
    const card = cards[0];
    if (card === 1 || card === 8 || card === 9 && dealer !== 7 && dealer <= 9 || card === 7 && dealer <= 7 || card === 6 && dealer <= 6 || (card === 2 || card === 3) && dealer <= 7 || card === 4 && (dealer === 5 || dealer === 6)) return 'split';
  }
  if (can('surrender') && !hand.soft && (hand.value === 16 && dealer >= 9 || hand.value === 15 && dealer === 10)) return 'surrender';
  if (hand.soft) {
    if (hand.value >= 19) return 'stand';
    if (hand.value === 18) return dealer >= 3 && dealer <= 6 ? wantDouble('stand') : dealer <= 8 ? 'stand' : 'hit';
    if (hand.value === 17) return dealer >= 3 && dealer <= 6 ? wantDouble('hit') : 'hit';
    if (hand.value >= 15) return dealer >= 4 && dealer <= 6 ? wantDouble('hit') : 'hit';
    if (hand.value >= 13) return dealer === 5 || dealer === 6 ? wantDouble('hit') : 'hit';
    return 'hit';
  }
  if (hand.value >= 17) return 'stand';
  if (hand.value >= 13) return dealer <= 6 ? 'stand' : 'hit';
  if (hand.value === 12) return dealer >= 4 && dealer <= 6 ? 'stand' : 'hit';
  if (hand.value === 11) return dealer <= 10 ? wantDouble('hit') : 'hit';
  if (hand.value === 10) return dealer <= 9 ? wantDouble('hit') : 'hit';
  if (hand.value === 9) return dealer >= 3 && dealer <= 6 ? wantDouble('hit') : 'hit';
  return 'hit';
}
export const seatTakesInsurance = (style: PlayerStyle): boolean => style === 'gambler';

/** Who sits where. Hero takes `heroSeat` (1 is first to act, 7 last); `others` of the remaining
    seats are filled, spread evenly, from the lineup in an order chosen by `index`. */
export function seatLineup(heroSeat: number, others: number, index: (limit: number) => number): (TablePlayer | 'hero' | null)[] {
  if (!Number.isInteger(heroSeat) || heroSeat < 1 || heroSeat > SEATS || !Number.isInteger(others) || others < 0 || others > SEATS - 1) throw new Error('Choose a seat from 1 to 7 and up to six other players.');
  const pool = [...TABLE_PLAYERS], seats: (TablePlayer | 'hero' | null)[] = Array(SEATS).fill(null); seats[heroSeat - 1] = 'hero';
  const free = seats.map((seat, i) => seat === null ? i : -1).filter(i => i >= 0);
  // Fill outward from Hero so a short-handed table still has neighbours on both sides.
  free.sort((a, b) => Math.abs(a - (heroSeat - 1)) - Math.abs(b - (heroSeat - 1)) || a - b);
  for (const seat of free.slice(0, others)) {
    const chosen = index(pool.length);
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= pool.length) throw new Error('Invalid lineup random index.');
    seats[seat] = pool.splice(chosen, 1)[0];
  }
  return seats;
}
