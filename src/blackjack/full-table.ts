/** A full blackjack table: Hero plus other seated players. Presentation contract and markup for
    the other seats; Hero's own hand, the dealer and the controls are still drawn by
    `blackjackTableMarkup`, which receives this block through `feltExtra`. Pure functions. */
import type { Card } from '../contracts';
import { cardName, dollars } from './screens';
import { STYLE_LABELS, type PlayerStyle } from './table-players';
import type { BlackjackHandView } from './view-model';
import { facesFor, type TableFace } from '../ui/face-hook';

export type TablePace = 'slow' | 'casino' | 'fast';
export const PACE_LABELS: Record<TablePace, { label: string; note: string; cardMs: number }> = {
  slow: { label: 'Slow', note: 'About one card a second, for learning to count.', cardMs: 1000 },
  casino: { label: 'Casino', note: 'The pace of a real dealer.', cardMs: 550 },
  fast: { label: 'Fast', note: 'A quick dealer on a busy night.', cardMs: 300 },
};
export interface SeatView {
  /** 1 is the first seat to act (the dealer's left); 7 is the last. */
  seat: number;
  kind: 'hero' | 'player' | 'empty';
  name: string;
  style: PlayerStyle | null;
  /** Empty before the deal and for an empty seat. Hero's hands are drawn large elsewhere. */
  hands: readonly BlackjackHandView[];
  /** The seat's opening bet this round in cents; zero when sitting out. */
  bet: number;
  /** The seat's most recent action in words, for the label and the announcement. */
  lastAction: string | null;
  /** Patch 76: what this player just said, shown as a bubble. */
  say?: string;
}
export interface FullTableState { seats: readonly SeatView[]; /** Seat number whose turn it is, or null. */ actingSeat: number | null; pace: TablePace; }

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const SUITS: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const mini = (card: Card) => `<span class="bj-mini${'dh'.includes(card[1]) ? ' red' : ''}" aria-hidden="true"><b>${card[0] === 'T' ? '10' : card[0]}</b><i>${SUITS[card[1]]}</i></span>`;
const totalLabel = (hand: BlackjackHandView) => `${hand.soft && hand.total <= 21 ? 'Soft ' : ''}${hand.total}`;
const OUTCOMES: Record<string, string> = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', surrender: 'Surrender' };
const STATES: Record<BlackjackHandView['state'], string> = { waiting: '', acting: 'Thinking', stood: 'Stand', bust: 'Bust', blackjack: 'Blackjack', surrendered: 'Surrender' };
/** Short visible tags: seats are narrow on a phone. The full words are in each seat's label. */
const TAGS: Record<string, string> = { blackjack: 'BJ', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', surrender: 'Surr', surrendered: 'Surr', stood: '', waiting: '', acting: '' };

function seatMarkup(seat: SeatView, acting: boolean, faces: TableFace | null = null): string {
  if (seat.kind === 'hero') return `<div class="bj-seat hero${acting ? ' acting' : ''}" data-bj-seat="${seat.seat}" aria-label="Seat ${seat.seat}: you${acting ? ', your turn' : ''}">${faces ? `<span class="bj-face" aria-hidden="true">${faces('', true)}</span>` : ''}<span class="bj-seat-name">You</span><span class="bj-seat-note">Seat ${seat.seat}</span></div>`;
  if (seat.kind === 'empty') return `<div class="bj-seat empty" data-bj-seat="${seat.seat}" aria-label="Seat ${seat.seat}: empty"><span class="bj-seat-note">Open</span></div>`;
  const described = seat.hands.length ? seat.hands.map(hand => `${hand.cards.map(cardName).join(', ')}, ${totalLabel(hand)}${hand.result ? `, ${OUTCOMES[hand.result.outcome]}` : STATES[hand.state] ? `, ${STATES[hand.state]}` : ''}`).join('; ') : seat.bet ? `bet ${dollars(seat.bet)}` : 'sitting out';
  const hands = seat.hands.map(hand => { const tone = hand.result ? (hand.result.net > 0 ? ' won' : hand.result.net < 0 ? ' lost' : '') : ''; return `<div class="bj-seat-hand${tone}"><span class="bj-minis">${hand.cards.map(mini).join('')}</span><span class="bj-seat-total"><b>${totalLabel(hand)}</b>${hand.result ? ` ${TAGS[hand.result.outcome]}` : hand.doubled ? ' Dbl' : TAGS[hand.state] ? ` ${TAGS[hand.state]}` : ''}</span></div>`; }).join('');
  return `<article class="bj-seat${acting ? ' acting' : ''}" data-bj-seat="${seat.seat}" aria-label="Seat ${seat.seat}, ${escape(seat.name)}${seat.style ? ` (${STYLE_LABELS[seat.style].label.toLowerCase()})` : ''}: ${described}${acting ? '. Acting now' : ''}">${faces ? `<span class="bj-face" aria-hidden="true">${faces(seat.name, false, seat.hands.some(h => h.result && h.result.net > 0) ? 'happy' : seat.hands.some(h => h.result && h.result.net < 0) ? 'sigh' : 'neutral')}</span>` : ''}<span class="bj-seat-name">${escape(seat.name)}</span>${hands || `<span class="bj-seat-note">${seat.bet ? dollars(seat.bet) : 'Sitting out'}</span>`}${seat.say ? (/^\*.+\*$/.test(seat.say) ? `<span class="bj-say bj-gesture" data-testid="bj-say"><i>${escape(seat.say.slice(1, -1))}</i></span>` : `<span class="bj-say" data-testid="bj-say">“${escape(seat.say)}”</span>`) : ''}</article>`;
}
/** Who the table is waiting for, for the action title while another seat plays. */
export function waitingFor(state: FullTableState): string | null { const seat = state.seats.find(item => item.seat === state.actingSeat); return seat && seat.kind === 'player' ? `${seat.name} is playing` : null; }
const escapeText = (value: string) => value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!);
/** One sentence for screen readers: each other player who has finished, with their totals. Announced
    politely as it changes, so a listener hears the seats play without reading every seat. */
export function seatsPlayed(state: FullTableState): string {
  const done = state.seats.filter(seat => seat.kind === 'player' && seat.hands.length && seat.hands.every(hand => hand.state !== 'waiting' && hand.state !== 'acting'));
  return done.length ? `Played: ${done.map(seat => `${seat.name} ${seat.hands.map(hand => `${hand.total}${hand.state === 'bust' ? ' bust' : hand.state === 'blackjack' ? ' blackjack' : hand.state === 'surrendered' ? ' surrendered' : ''}`).join(' and ')}`).join(', ')}.` : '';
}
/** The row of seats, in dealing order. Goes on the felt between the dealer and Hero's hand. */
export function otherSeatsMarkup(state: FullTableState): string {
  return `<section class="bj-seats" aria-label="Other players, in dealing order" data-testid="blackjack-seats">${((faces) => state.seats.map(seat => seatMarkup(seat, seat.seat === state.actingSeat, faces)))(facesFor(state.seats.filter(seat => seat.kind === 'player').map(seat => seat.name))).join('')}</section><p class="sr-only" role="status" data-testid="blackjack-seats-played">${escapeText(seatsPlayed(state))}</p>`;
}
/** Seat and pace choices for the lobby: where Hero sits and how many others join. */
export function fullTableSetupMarkup(setup: { heroSeat: number; others: number; pace?: TablePace }): string {
  const segment = (name: string, value: string | number, label: string, selected: boolean) => `<button type="button" class="segment${selected ? ' selected' : ''}" data-blackjack-${name}="${value}" aria-pressed="${selected}">${label}</button>`;
  return `<div class="bj-full-setup" data-testid="blackjack-full-setup"><h3 id="bj-others-title">Other players</h3><div class="segmented" role="group" aria-labelledby="bj-others-title">${[0, 2, 4, 6].map(count => segment('others', count, count ? String(count) : 'Just me', count === setup.others)).join('')}</div><p class="lobby-note">${setup.others ? 'They play their own hands with their own chips. More players means more cards to count each round and fewer rounds per shoe.' : 'Heads-up against the dealer.'}</p>
    ${setup.others ? `<h3 id="bj-seat-title">Your seat</h3><div class="segmented" role="group" aria-labelledby="bj-seat-title">${[[1, 'First base'], [4, 'Middle'], [7, 'Third base']].map(([seat, label]) => segment('seat', seat, String(label), seat === setup.heroSeat)).join('')}</div><p class="lobby-note">${setup.heroSeat === 1 ? 'You act first, with the fewest cards seen.' : setup.heroSeat === 7 ? "You act last, after seeing everyone else's cards." : 'You act in the middle of the round.'}</p>` : ''}
    ${setup.pace && setup.others ? `<h3 id="bj-pace-title">Dealer pace</h3><div class="segmented" role="group" aria-labelledby="bj-pace-title">${(Object.keys(PACE_LABELS) as TablePace[]).map(pace => segment('pace', pace, PACE_LABELS[pace].label, pace === setup.pace)).join('')}</div><p class="lobby-note">${PACE_LABELS[setup.pace!].note}</p>` : ''}</div>`;
}
