/** Blackjack screens as markup strings, in the style of the rest of the interface.
    Pure functions of their inputs: no storage, engine or controller access. */
import type { Card } from '../contracts';
import { ANTE_OPTIONS, BLACKJACK_STARTING_BALANCE, BLACKJACK_TABLES, sideBet, strategyRules, tableCanAnte, tableRules, type BlackjackTable, type SideBetId, type TableGroup } from './presets';
import { deviations, strategyChart, UP_CARDS, wholeIndex, type Play, type StrategyRules } from './strategy';
import { sideBetLimits } from './side-bets';
import { dealerOdds } from './dealer-odds';
import type { TablePace } from './full-table';
import { drillActions, type DrillState } from './drills';
import { cardTag, COUNT_SYSTEMS, countState, countSystem, countScale, formatCount, type CountState, type CountSystem, type CountSystemId } from './counting';
import { trainerCount, trainerFinished, type TrainerState } from './trainer';
import type { BlackjackAction, BlackjackHandView, BlackjackSession, BlackjackView, HandOutcome } from './view-model';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Dollars from cents: whole dollars when exact, otherwise two decimals (a 3:2 blackjack on $5 pays $7.50). */
export const dollars = (cents: number) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) % 100 ? CENTS : WHOLE).format(Math.abs(cents) / 100)}`;
const signed = (cents: number) => `${cents > 0 ? '+' : ''}${dollars(cents)}`;
const chipLabel = (cents: number) => cents >= 100000 ? `$${cents / 100000}K` : `$${cents / 100}`;
const RANK_NAMES: Record<string, string> = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten' }, SUIT_NAMES: Record<string, string> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }, SUITS: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
export const cardName = (card: Card) => `${RANK_NAMES[card[0]] ?? card[0]} of ${SUIT_NAMES[card[1]]}`;
/* A card face: rank and suit in the top-left and (upside down) bottom-right corners, as printed on
   real cards, with a large centre pip; jacks, queens and kings get a framed court panel. */
function cardMarkup(card: Card | null, tag?: string): string {
  if (!card) return '<span class="playing-card card-back bj-card" role="img" aria-label="Hidden card"><span aria-hidden="true">♠</span></span>';
  const rank = card[0] === 'T' ? '10' : card[0], suit = SUITS[card[1]], court = 'JQK'.includes(card[0]), index = `${rank}<i>${suit}</i>`;
  return `<span class="playing-card bj-card${'dh'.includes(card[1]) ? ' red-card' : ''}${court ? ' bj-court' : card[0] === 'A' ? ' bj-ace' : ''}" role="img" aria-label="${cardName(card)}"><b aria-hidden="true">${index}</b><span aria-hidden="true">${court ? `${rank}<i>${suit}</i>` : suit}</span><b class="bj-index-low" aria-hidden="true">${index}</b>${tag === undefined ? '' : `<i class="bj-tag" aria-hidden="true">${tag}</i>`}</span>`;
}
/* Casino chip colours by value in cents: $1 white, $5 red, $25 green, $100 black, $500 purple, $1,000 orange. */
const CHIP_VALUES = [100000, 50000, 10000, 2500, 500, 100];
/** A stack of chips for an amount, largest at the bottom, at most `cap` shown. Decorative: the amount is always in text beside it. */
export function chipStackMarkup(cents: number, cap = 6): string {
  const discs: number[] = []; let left = Math.max(0, Math.round(cents));
  for (const value of CHIP_VALUES) while (left >= value && discs.length < cap) { discs.push(value); left -= value; }
  return discs.length ? `<span class="bj-stack" aria-hidden="true">${discs.map(value => `<i class="bj-disc" data-chip="${value}"></i>`).join('')}</span>` : '';
}
/* Printed felt: curved gold lettering laid glyph by glyph along concentric arcs (no ids, so any
   number of tables can share a page). Decorative; the same words are in .bj-felt-text for screen readers. */
const ARC_CENTRE = { x: 200, y: -246 };
/* Approximate glyph widths (in ems) of serif capitals, so letters sit evenly along the curve. */
const GLYPH: Record<string, number> = { ' ': 0.34, I: 0.42, J: 0.5, M: 0.96, W: 1, s: 0.46, '1': 0.56, '2': 0.62, '3': 0.62, '5': 0.62, '6': 0.62, '7': 0.6 };
function arcText(text: string, radius: number, size: number, spacing: number, cls: string): string {
  const widths = [...text].map(glyph => (GLYPH[glyph] ?? 0.74) * size * spacing), total = widths.reduce((sum, width) => sum + width, 0);
  const xs: string[] = [], ys: string[] = [], turns: string[] = []; let run = -total / 2;
  widths.forEach(width => { const angle = (run + width / 2) / radius; run += width; xs.push((ARC_CENTRE.x + radius * Math.sin(angle)).toFixed(1)); ys.push((ARC_CENTRE.y + radius * Math.cos(angle)).toFixed(1)); turns.push((-angle * 180 / Math.PI).toFixed(1)); });
  return `<text class="${cls}" x="${xs.join(' ')}" y="${ys.join(' ')}" rotate="${turns.join(' ')}" font-size="${size}" text-anchor="middle">${text}</text>`;
}
function arcLine(radius: number, half: number): string {
  const x = (sign: number) => (ARC_CENTRE.x + sign * radius * Math.sin(half)).toFixed(1), y = (ARC_CENTRE.y + radius * Math.cos(half)).toFixed(1);
  return `<path d="M${x(-1)} ${y} A${radius} ${radius} 0 0 0 ${x(1)} ${y}"/>`;
}
function feltPrintMarkup(table: BlackjackTable): string {
  const pays = `BLACKJACK PAYS ${table.blackjackPays === '3:2' ? '3 TO 2' : '6 TO 5'}`, rule = table.dealerHitsSoft17 ? 'DEALER MUST HIT SOFT 17' : 'DEALER MUST STAND ON ALL 17s';
  return `<svg class="bj-felt-print" viewBox="0 0 400 86" aria-hidden="true" focusable="false">${arcText(pays, 268, 19, 1.08, 'bj-print-main')}${arcText(rule, 290, 12, 1.12, 'bj-print-rule')}<g class="bj-print-band">${arcLine(300, 0.6)}${arcLine(326, 0.58)}</g>${arcText('INSURANCE PAYS 2 TO 1', 318, 12, 1.18, 'bj-print-rule')}</svg>`;
}
/* The dealer's side of the table: discard tray, chip rack and shoe. Decorative; the shoe's fill follows the cards left. */
function dealerRailMarkup(shoe: { cards: number; remaining: number }): string {
  const left = shoe.cards ? shoe.remaining / shoe.cards : 0;
  return `<div class="bj-dealer-rail" aria-hidden="true"><span class="bj-discard"><i style="height:${Math.round((1 - left) * 100)}%"></i></span><span class="bj-rack">${[100, 500, 2500, 10000, 50000, 100].map(value => `<i data-chip="${value}"></i>`).join('')}</span><span class="bj-shoe-box"><i style="width:${Math.round(left * 100)}%"></i></span></div>`;
}
const totalLabel = (total: number, soft: boolean) => `${soft && total <= 21 ? 'Soft ' : ''}${total}`;

export const GROUP_LABELS: Record<TableGroup, { label: string; short: string; blurb: string }> = {
  home: { label: 'Home game', short: 'Home', blurb: 'A relaxed game with friendly rules.' },
  casino: { label: 'Casino floor', short: 'Casino', blurb: 'Low and mid-limit tables with the rules and side bets a casino floor deals, including a 6-to-5 table and Free Bet Blackjack.' },
  high: { label: 'High limit', short: 'High limit', blurb: 'Bigger bets and the best rules.' },
};
export interface BlackjackLobbyState { group: TableGroup; tableId: string; /** House fee once per round in cents, including all splits. */ ante: number;
  /** Full table: how many computer players join (0, 2, 4 or 6), and Hero's seat (1 first base, 4 middle, 7 third base). */
  others: number; heroSeat: number;
  /** Full table: how fast the other players' and the dealer's cards are shown. */
  pace: TablePace; }
/** A valid lobby selection: unknown values fall back to the casino floor's $5 shoe. */
export function normalizeBlackjackLobby(state: Partial<BlackjackLobbyState>): BlackjackLobbyState {
  const group: TableGroup = state.group && Object.prototype.hasOwnProperty.call(GROUP_LABELS, state.group) ? state.group : 'casino';
  const inGroup = BLACKJACK_TABLES.filter(table => table.group === group);
  const table = inGroup.find(item => item.id === state.tableId) ?? inGroup.find(item => item.id === 'casino-5') ?? inGroup[0];
  return { group, tableId: table.id, ante: tableCanAnte(table) ? (ANTE_OPTIONS.includes(state.ante ?? -1) ? state.ante! : 50) : 0, others: [0, 2, 4, 6].includes(state.others ?? -1) ? state.others! : 0, heroSeat: [1, 4, 7].includes(state.heroSeat ?? -1) ? state.heroSeat! : 7, pace: state.pace === 'slow' || state.pace === 'fast' ? state.pace : 'casino' };
}

function tableCard(table: BlackjackTable, selected: boolean): string {
  return `<button type="button" class="event-card${selected ? ' selected' : ''}" data-blackjack-table="${table.id}" aria-pressed="${selected}"><span class="event-name">${escape(table.name)}</span><span class="event-stake">${table.blackjackPays === '6:5' ? 'Pays 6 to 5' : table.variant === 'free-bet' ? 'Free Bet' : `${table.decks} decks`}</span><span class="event-facts"><span><small>Limits</small><b>${dollars(table.minBet)} to ${dollars(table.maxBet)}</b></span><span><small>Soft 17</small><b>${table.dealerHitsSoft17 ? 'Dealer hits' : 'Dealer stands'}</b></span><span><small>Side bets</small><b>${table.sideBets.length || 'None'}</b></span></span></button>`;
}

/** The blackjack lobby. `seating` says whether sitting down is possible yet and why not. */
export function blackjackLobbyMarkup(input: Partial<BlackjackLobbyState>, seating: { available: boolean; reason: string; balance: number | null; /** Markup for choosing other players and a seat, placed above Sit down. */ company?: string }): string {
  const state = normalizeBlackjackLobby(input), table = BLACKJACK_TABLES.find(item => item.id === state.tableId)!;
  const groups = (Object.keys(GROUP_LABELS) as TableGroup[]).map(group => `<button type="button" class="segment${group === state.group ? ' selected' : ''}" data-blackjack-group="${group}" aria-pressed="${group === state.group}"><span class="nav-full">${GROUP_LABELS[group].label}</span><span class="nav-short">${GROUP_LABELS[group].short}</span></button>`).join('');
  const balance = seating.balance ?? BLACKJACK_STARTING_BALANCE;
  const sideBets = table.sideBets.map(sideBet).map(bet => `<details class="bj-side-info"><summary>${escape(bet.name)}<small>${escape(bet.blurb)}</small></summary><table class="payout-table"><caption>Pays ${bet.settles}</caption><thead><tr><th scope="col">Outcome</th><th scope="col">Pays</th></tr></thead><tbody>${bet.pays.map(row => `<tr><th scope="row">${escape(row.outcome)}</th><td>${WHOLE.format(row.to1)} to 1</td></tr>`).join('')}</tbody></table></details>`).join('');
  return `<div class="tournament-lobby blackjack-lobby" data-testid="blackjack-lobby">
    <section class="panel lobby-events" aria-labelledby="bj-tables-title"><h2 id="bj-tables-title">Choose a table</h2><p class="lobby-note">Virtual chips only. Tables and paytables are typical examples, not any casino's posted rules.</p><div class="segmented" role="group" aria-label="Kind of table">${groups}</div><p class="lobby-note">${GROUP_LABELS[state.group].blurb}</p><div class="event-list">${BLACKJACK_TABLES.filter(item => item.group === state.group).map(item => tableCard(item, item.id === table.id)).join('')}</div></section>
    <section class="panel lobby-detail" aria-labelledby="bj-detail-title"><span class="eyebrow">${GROUP_LABELS[table.group].label.toUpperCase()}</span><h2 id="bj-detail-title">${escape(table.name)}</h2><p class="lobby-note">${escape(table.blurb)}</p>
      <dl class="lobby-facts"><div><dt>Table limits</dt><dd>${dollars(table.minBet)} to ${dollars(table.maxBet)}</dd></div><div><dt>Blackjack pays</dt><dd>${table.blackjackPays === '3:2' ? '3 to 2' : '6 to 5'}<small>${dollars(table.blackjackPays === '3:2' ? 1500 : 1200)} on a $10 bet</small></dd></div><div><dt>Shoe</dt><dd>${table.decks} decks<small>${Math.round(table.penetration * 100)}% dealt before the shuffle</small></dd></div><div><dt>Your balance</dt><dd>${dollars(balance)}<small>${Math.floor(balance / table.minBet)} minimum bets</small></dd></div></dl>
      ${tableCanAnte(table) ? `<h3 id="bj-ante-title">House ante per round</h3><div class="segmented" role="group" aria-labelledby="bj-ante-title">${ANTE_OPTIONS.map(ante => `<button type="button" class="segment${ante === state.ante ? ' selected' : ''}" data-blackjack-ante="${ante}" aria-pressed="${ante === state.ante}">${ante ? dollars(ante) : 'No ante'}</button>`).join('')}</div><p class="lobby-note">${state.ante ? `One fee per round, including all split hands. At ${dollars(state.ante)} a round it is ${Math.round(state.ante / table.minBet * 1000) / 10}% of a ${dollars(table.minBet)} bet, paid win or lose.` : 'No-ante night: nothing is charged per round.'}</p>` : ''}
      <h3>Rules at this table</h3><ul class="bj-rules">${tableRules(table).map(rule => `<li>${escape(rule)}</li>`).join('')}</ul>
      <h3>Side bets</h3>${sideBets || '<p class="lobby-note">This table has no side bets.</p>'}${table.sideBets.length ? '<p class="lobby-note">Side bets are optional and cost more over time than the main game. Paytables vary between casinos.</p>' : ''}
      ${seating.company ?? ''}<div class="lobby-register"><button type="button" id="blackjack-sit" class="button primary" ${seating.available ? '' : 'disabled aria-describedby="blackjack-sit-note"'}>Sit down · ${dollars(table.minBet)} minimum</button><p id="blackjack-sit-note" class="lobby-note">${escape(seating.reason)}</p></div>
    </section></div>`;
}

const OUTCOME_LABELS: Record<HandOutcome, string> = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', surrender: 'Surrendered' };
const STATE_LABELS: Record<BlackjackHandView['state'], string> = { waiting: 'Waiting', acting: 'Your move', stood: 'Stand', bust: 'Bust', blackjack: 'Blackjack', surrendered: 'Surrendered' };
function handMarkup(hand: BlackjackHandView, index: number, count: number, active: boolean): string {
  const result = hand.result, tone = result ? (result.net > 0 ? ' won' : result.net < 0 ? ' lost' : ' pushed') : '';
  return `<article class="bj-hand${active ? ' acting' : ''}${tone}" data-bj-hand="${index}" aria-label="${count > 1 ? `Hand ${index + 1} of ${count}` : 'Your hand'}: ${hand.cards.length ? `${hand.cards.map(cardName).join(', ')}. ${totalLabel(hand.total, hand.soft)}.` : 'no cards yet.'}${result ? ` ${OUTCOME_LABELS[result.outcome]}, ${signed(result.net)}.` : ''}"><div class="bj-cards">${hand.cards.map(card => cardMarkup(card)).join('')}</div><div class="bj-hand-info">${hand.cards.length ? `<b class="bj-total">${totalLabel(hand.total, hand.soft)}</b>` : ''}${chipStackMarkup(hand.bet, 4)}<span class="bj-bet">${dollars(hand.bet)}${hand.doubled ? ' · doubled' : ''}${hand.freeBet ? ' · free' : ''}</span><span class="bj-hand-state">${result ? `${OUTCOME_LABELS[result.outcome]} ${signed(result.net)}` : STATE_LABELS[hand.state]}</span></div></article>`;
}

export interface BlackjackTableOptions { coach?: boolean; hintOnce?: boolean; liveClassic?: boolean;
  /** Markup placed on the felt between the dealer and Hero's hand: the other seats at a full table. */
  feltExtra?: string;
  /** Set when side bets can be wagered: which spot the chips currently go to. Leave undefined while side bets are previews only. */
  sideBetTarget?: 'main' | SideBetId;
  /** Full table: another seat is acting. Replaces the action title, for example "Lou is playing". */
  waitingFor?: string | null;
  /** Full table, paced dealing: offer Show all while cards are still being revealed. */
  skipReveal?: boolean;
  /** Extra controls for the table toolbar, before Leave table (the dealer pace at a full table). */
  toolbarExtra?: string; /** The coach stays silent and reports after each decision. */ testMe?: boolean; count?: { system: CountSystemId; reveal: boolean; answer?: { given: number; right: boolean; correct: number; acesGiven?: number; acesCorrect?: number; acesRight?: boolean; seenKey?: string } | null } | null; }

/** Every system has a separate ace tally. Ace-reckoned systems keep their main TC. */
function countFactsMarkup(system: CountSystem, state: CountState): string {
  const cell = (label: string, value: string, detail = '') => `<div><dt>${label}</dt><dd>${value}${detail ? `<small>${detail}</small>` : ''}</dd></div>`;
  const doubled = countScale(system) === 2;
  return `<dl class="lobby-facts bj-count-facts">${cell('Running count', formatCount(state.running), doubled ? 'doubled Halves units' : '')}${cell('Decks left', String(state.decksEstimate), 'nearest half deck; unexposed cards')}${cell(doubled ? 'True count ×2' : 'True count', formatCount(state.trueCount), 'running ÷ decks left')}${doubled ? cell('Original Halves true count', formatCount(state.standardTrueCount), 'doubled true count ÷ 2') : ''}</dl><h3>Ace side count</h3><dl class="lobby-facts bj-count-facts" data-testid="ace-side-count">${cell('Aces seen', String(state.acesSeen))}${cell('Aces unseen', String(state.acesRemaining), 'includes face-down cards')}${cell('Expected aces unseen', formatCount(state.expectedAcesRemaining).replace(/^\+/, ''), '4 per unseen deck')}${cell('Extra aces unseen', formatCount(state.excessAces), 'unseen minus expected')}${system.aceSideMultiplier ? cell('Betting count', formatCount(state.bettingTrueCount), `(running + ${system.aceSideMultiplier} × extra aces) ÷ decks`) : ''}</dl><p class="lobby-note">${system.aceSideMultiplier ? 'Ace-neutral method: the side tally adjusts the betting count only. Playing indices use the main true count.' : 'Aces already affect the main count. The side tally is separate; it is not added again to the betting count or used to alter these practice indices.'}</p>`;
}

/** Visible cards only. Hide both counts until the learner submits or reveals them. */
export function countPanelMarkup(seen: readonly Card[], decks: number, options: NonNullable<BlackjackTableOptions['count']>): string {
  const system = countSystem(options.system), state = countState(system, seen, decks);
  const answer = options.answer && (options.answer.seenKey === undefined || options.answer.seenKey === seen.join('|')) ? options.answer : null;
  const systems = COUNT_SYSTEMS.map(item => `<option value="${item.id}" ${item.id === system.id ? 'selected' : ''}>${escape(item.name)}</option>`).join('');
  const facts = options.reveal ? countFactsMarkup(system, state) : `<p class="lobby-note">The count is hidden, including the ace side count. Enter both, then check.</p><div class="bj-count-check"><label for="bj-count-answer">Your running count</label><input id="bj-count-answer" inputmode="text" autocomplete="off" value="${answer ? escape(answer.given) : ''}"><label for="bj-count-aces">Your aces seen</label><input id="bj-count-aces" inputmode="numeric" autocomplete="off" value="${answer?.acesGiven === undefined ? '' : answer.acesGiven}"><button type="button" id="bj-count-check" class="button secondary">Check</button></div>${answer ? `<p class="bj-count-result ${answer.right && answer.acesRight !== false ? 'right' : 'wrong'}" role="status">${answer.right ? `Correct: ${formatCount(answer.correct)}.` : `Not quite. You said ${formatCount(answer.given)}; the running count is ${formatCount(answer.correct)}.`}${answer.acesCorrect === undefined ? '' : ` Aces seen: ${answer.acesCorrect}. ${answer.acesRight ? 'Ace side count correct.' : `You entered ${answer.acesGiven}; keep counting aces separately.`}`}</p>` : ''}`;
  return `<section class="panel bj-count" aria-labelledby="bj-count-title" data-testid="blackjack-count"><div class="bj-count-head"><h2 id="bj-count-title">Count coach</h2><label class="sr-only" for="bj-count-system">Counting system</label><select id="bj-count-system">${systems}</select><button type="button" id="bj-count-reveal" class="button secondary" aria-pressed="${options.reveal}">${options.reveal ? 'Hide count' : 'Show count'}</button></div>${facts}<p class="lobby-note">${state.cardsSeen} card${state.cardsSeen === 1 ? '' : 's'} seen this shoe. ${escape(system.note)}</p></section>`;
}

const ACTION_LABELS: Record<BlackjackAction, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };

/** The table: dealer, Hero's hands, side-bet spots, and the action bar for the current phase. */
export function blackjackTableMarkup(view: BlackjackView, options: BlackjackTableOptions = {}): string {
  const table = view.table, betting = view.phase === 'betting', settled = view.phase === 'settled', legal = new Set(view.legal.actions);
  const shoeUsed = Math.round((1 - view.shoe.remaining / view.shoe.cards) * 100), cutMark = Math.round(view.shoe.cutAt / view.shoe.cards * 100);
  /* The count stays in view while playing; the full panel below keeps the detail and the self-test. */
  const counting = options.count ? countState(countSystem(options.count.system), view.seen, table.decks) : null, countName = options.count ? countSystem(options.count.system) : null;
  const stripCount = !counting ? '' : options.count!.reveal
    ? `<div class="strip-cell bj-strip-count" data-testid="blackjack-count-strip" aria-label="${escape(countName!.name)}: running count ${formatCount(counting.running)}, true count ${formatCount(counting.trueCount)}, ${counting.acesSeen} ace${counting.acesSeen === 1 ? '' : 's'} seen"><small>Running count</small><b>${formatCount(counting.running)}</b><span class="bj-strip-true">True ${formatCount(counting.trueCount)} · A ${counting.acesSeen}</span></div>`
    : `<div class="strip-cell bj-strip-count" data-testid="blackjack-count-strip"><small>Running count</small><b>Hidden</b><span class="bj-strip-true">${counting.cardsSeen} seen</span></div>`;
  const strip = `<section class="level-strip bj-strip" aria-label="Table status"><div class="strip-cell"><small>Table</small><b>${escape(table.name)}</b><span>${dollars(table.minBet)} to ${dollars(table.maxBet)}${view.feePerRound ? ` · ${dollars(view.feePerRound)} ante` : ''}</span></div><div class="strip-cell"><small>${options.skipReveal ? 'Balance before reveal' : 'Balance'}</small><b>${dollars(view.balance)}</b><span>${signed(view.session.net)} this session</span></div><div class="strip-cell bj-shoe"><small>Shoe</small><b>${view.shoe.remaining} left</b><span class="bj-shoe-bar" role="img" aria-label="${shoeUsed}% of the shoe dealt; shuffle at ${cutMark}%"><span style="width:${shoeUsed}%"></span><i style="left:${cutMark}%"></i></span></div>${stripCount}<div class="strip-cell strip-rules"><small>Rules</small><b>Pays ${table.blackjackPays === '3:2' ? '3 to 2' : '6 to 5'}</b><span>Dealer ${table.dealerHitsSoft17 ? 'hits' : 'stands on'} soft 17</span></div></section>`;
  const dealer = `<section class="bj-dealer" aria-label="Dealer: ${view.dealer.cards.length ? view.dealer.cards.map(card => card ? cardName(card) : 'hidden card').join(', ') : 'no cards'}">${dealerRailMarkup(view.shoe)}<span class="eyebrow">DEALER</span><div class="bj-cards">${view.dealer.cards.length ? view.dealer.cards.map(card => cardMarkup(card)).join('') : `<span class="bj-empty">${options.waitingFor ? 'Dealing…' : 'Place your bet'}</span>`}</div>${view.dealer.cards.length ? `<b class="bj-total">${view.dealer.cards.includes(null) ? `Showing ${view.dealer.total}` : totalLabel(view.dealer.total, view.dealer.soft)}</b>` : ''}</section>`;
  /* Every spot is offered while betting; once the cards are out only the bets actually placed stay on the felt. */
  const sideBetting = options.sideBetTarget !== undefined, target = options.sideBetTarget;
  const sideTotal = view.sideBets.reduce((sum, bet) => sum + bet.amount, 0), committed = view.bet + view.feePerRound + (sideBetting ? sideTotal : 0);
  const chipBlocked = (chip: number) => committed + chip > view.balance || (sideBetting && target !== 'main' ? (view.sideBets.find(bet => bet.id === target)?.amount ?? 0) + chip > sideBetLimits(table, view.bet).max : view.bet + chip > table.maxBet);
  const spots = options.liveClassic && !sideBetting ? [] : table.sideBets.filter(id => betting || view.sideBets.some(bet => bet.id === id && bet.amount));
  const sideSpots = spots.length ? `<div class="bj-side-spots" role="group" aria-label="Side bets">${spots.map(id => { const placed = view.sideBets.find(bet => bet.id === id), result = placed?.result; return `<button type="button" class="bj-side-spot${placed?.amount ? ' placed' : ''}${result ? (result.net > 0 ? ' won' : ' lost') : ''}${betting && target === id ? ' target' : ''}" data-blackjack-side="${id}" ${betting ? '' : 'disabled'} ${betting && sideBetting ? `aria-pressed="${target === id}"` : ''} aria-label="${escape(sideBet(id).name)} side bet${placed?.amount ? `: ${dollars(placed.amount)}` : ', no bet'}${result ? `. ${result.outcome ?? 'No win'}, ${signed(result.net)}` : ''}"><b>${escape(sideBet(id).name)}</b><span>${result ? `${escape(result.outcome ?? 'No win')} ${signed(result.net)}` : placed?.amount ? dollars(placed.amount) : betting ? 'Tap to bet' : '—'}</span></button>`; }).join('')}</div>` : '';
  const hands = `<section class="bj-hands${view.hands.length > 2 ? ' many' : ''}" aria-label="Your hands">${view.hands.length ? view.hands.map((hand, index) => handMarkup(hand, index, view.hands.length, index === view.activeHand && view.phase === 'player')).join('') : sideBetting ? `<button type="button" class="bj-bet-circle${view.bet ? ' placed' : ''}${target === 'main' ? ' target' : ''}" data-blackjack-side="main" aria-pressed="${target === 'main'}" aria-label="Main bet ${dollars(view.bet)}">${chipStackMarkup(view.bet)}<small>BET</small><b>${dollars(view.bet)}</b></button>` : `<div class="bj-bet-circle${view.bet ? ' placed' : ''}" role="img" aria-label="Main bet ${dollars(view.bet)}">${chipStackMarkup(view.bet)}<small>BET</small><b>${dollars(view.bet)}</b></div>`}</section>`;
  const hint = (options.coach || options.hintOnce) && view.hint ? `<p class="bj-hint" role="status" data-testid="blackjack-hint"><b>Coach:</b> ${escape(view.hint.action === 'insurance' ? 'Take insurance' : view.hint.action === 'no insurance' ? 'Decline insurance' : ACTION_LABELS[view.hint.action])}. ${escape(view.hint.reason)}</p>` : '';
  const mistake = view.lastMistake ? `<p class="bj-mistake" role="status" data-testid="blackjack-mistake">You chose ${escape(view.lastMistake.played)}. The approximate model suggests ${escape(view.lastMistake.better)}.</p>` : '';
  const controls = betting
    ? `<div class="t-action-title"><h2>Place your bet</h2><span>${dollars(view.bet)} of ${dollars(table.minBet)} to ${dollars(table.maxBet)}${view.feePerRound ? ` · ${dollars(view.feePerRound)} ante` : ''}</span></div>${options.liveClassic ? `<label class="bj-amount-label" for="bj-bet-amount">Bet amount ($)<input id="bj-bet-amount" type="number" inputmode="decimal" min="${table.minBet/100}" max="${table.maxBet/100}" step="1" value="${view.bet/100}" aria-describedby="bj-bet-help"></label><p id="bj-bet-help" class="lobby-note">Whole-dollar bets. Ante is charged once when Deal is committed.</p>` : ''}${sideBetting ? `<p class="bj-chip-target" role="status">Chips go to: <b>${target === 'main' ? 'Main bet' : escape(sideBet(target!).name)}</b>. Tap a spot on the table to change.</p>` : ''}<div class="bj-chips" role="group" aria-label="Add chips to ${sideBetting && target !== 'main' ? `the ${escape(sideBet(target!).name)} side bet` : 'the main bet'}">${table.chips.map(chip => `<button type="button" class="bj-chip" data-blackjack-chip="${chip}" ${chipBlocked(chip) ? 'disabled' : ''} aria-label="Add ${dollars(chip)}">${chipLabel(chip)}</button>`).join('')}</div><div class="bj-bet-tools"><button type="button" id="bj-clear" class="button secondary" ${view.bet || view.sideBets.some(bet => bet.amount) ? '' : 'disabled'}>Clear</button><button type="button" id="bj-rebet" class="button secondary" ${view.lastBet && view.lastBet + view.feePerRound <= view.balance ? '' : 'disabled'}>Rebet${view.lastBet ? ` ${dollars(view.lastBet)}` : ''}</button><button type="button" id="bj-deal" class="button primary" ${view.legal.deal ? '' : 'disabled'}>Deal</button></div>${view.shoe.lastRound ? '<p class="lobby-note">The cut card is out. The dealer shuffles before this hand.</p>' : ''}`
    : view.phase === 'insurance'
      ? `<div class="t-action-title"><h2>${view.legal.evenMoney ? 'Even money?' : 'Insurance?'}</h2><span>Dealer shows an ace</span></div><p class="lobby-note">${view.legal.evenMoney ? 'Take a sure 1 to 1 on your blackjack now, or play on for the full payout unless the dealer also has blackjack.' : `Costs ${dollars(view.insuranceCost)} and pays 2 to 1 if the dealer has blackjack.`}</p>${hint}<div class="action-buttons bj-two"><button type="button" id="bj-insurance-no" class="button secondary">No</button><button type="button" id="bj-insurance-yes" class="button primary" ${view.legal.insurance || view.legal.evenMoney ? '' : 'disabled'}>${view.legal.evenMoney ? 'Take even money' : `Insure ${dollars(view.insuranceCost)}`}</button></div>`
      : settled
        ? `<div class="t-action-title"><h2>${view.roundNet === null || view.roundNet === 0 ? 'Push' : view.roundNet > 0 ? `You win ${dollars(view.roundNet)}` : `You lose ${dollars(-view.roundNet)}`}</h2><span>${view.feePerRound ? `after ${dollars(view.feePerRound)} ante · ` : ''}Balance ${dollars(view.balance)}</span></div>${mistake}<div class="bj-bet-tools"><button type="button" id="bj-new-bet" class="button secondary">Change bet</button><button type="button" id="bj-rebet-deal" class="button primary" ${view.legal.deal ? '' : 'disabled'}>Rebet and deal${view.lastBet ? ` ${dollars(view.lastBet)}` : ''}</button></div>`
        : `<div class="t-action-title"><h2>${view.phase === 'dealer' ? 'Dealer plays' : options.waitingFor ? escape(options.waitingFor) : view.hands.length > 1 ? `Hand ${view.activeHand + 1} of ${view.hands.length}` : 'Your move'}</h2><span>${view.activeHand >= 0 && view.hands[view.activeHand] ? totalLabel(view.hands[view.activeHand].total, view.hands[view.activeHand].soft) + ` against ${view.dealer.total}` : ''}</span>${view.phase === 'player' && !view.hint && !options.waitingFor ? '<button type="button" id="bj-hint" class="button secondary t-pre">Hint</button>' : ''}${options.skipReveal ? '<button type="button" id="bj-skip" class="button secondary t-pre">Show all</button>' : ''}</div>${hint}${mistake}<div class="action-buttons bj-actions${table.surrender !== 'none' ? ' bj-five' : ''}">${(['surrender', 'split', 'double', 'stand', 'hit'] as BlackjackAction[]).filter(action => action !== 'surrender' || table.surrender !== 'none').map(action => `<button type="button" class="button ${action === 'hit' ? 'primary' : action === 'stand' ? 'call-button' : 'secondary'}" data-blackjack-action="${action}" ${legal.has(action) && view.phase === 'player' && !options.waitingFor ? '' : 'disabled'}>${ACTION_LABELS[action]}</button>`).join('')}</div>`;
  return `<div class="blackjack-play" data-testid="blackjack-table">${strip}<div class="t-play-grid bj-grid"><section class="table-panel bj-felt-panel"><div class="bj-felt${options.feltExtra ? ' bj-full' : ''}">${dealer}${feltPrintMarkup(table)}<p class="bj-felt-text">BLACKJACK PAYS ${table.blackjackPays === '3:2' ? '3 TO 2' : '6 TO 5'}<span> · ${table.dealerHitsSoft17 ? 'DEALER MUST HIT SOFT 17' : 'DEALER MUST STAND ON ALL 17s'} · INSURANCE PAYS 2 TO 1</span></p>${options.feltExtra ?? ''}${sideSpots}${hands}</div><div class="table-toolbar"><label class="t-watch-result"><input id="bj-coach" type="checkbox" ${options.coach ? 'checked' : ''}>Strategy coach</label>${options.liveClassic ? `<label class="t-watch-result"><input id="bj-test-me" type="checkbox" ${options.testMe ? 'checked' : ''}>Test me</label>` : ''}<label class="t-watch-result"><input id="bj-count-on" type="checkbox" ${options.count ? 'checked' : ''}>Count coach</label>${options.toolbarExtra ?? ''}<button type="button" id="bj-leave" class="button secondary" ${betting || settled ? '' : 'disabled'}>Leave table</button></div></section><section id="bj-actions" class="t-action-panel${view.phase === 'player' || view.phase === 'insurance' ? ' your-action' : ''}" aria-label="Blackjack controls" tabindex="-1">${controls}${handAids(view, !!options.coach && !options.testMe)}</section></div>${options.count ? countPanelMarkup(view.seen, table.decks, options.count) : ''}${sessionMarkup(view.session)}</div>`;
}

/** Patch 103: on your turn at a classic table, how the dealer's hand tends to finish from the card showing, and,
 * with the strategy coach on, your row of the strategy card with this dealer card marked. */
const cardValue = (c: Card) => c[0] === 'A' ? 1 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]);
const PLAY_SHORT: Record<Play, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const PLAY_WORD: Record<Play, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
export function handAids(view: BlackjackView, card: boolean): string {
  const up = view.dealer.cards[0], hand = view.hands[view.activeHand];
  if (view.phase !== 'player' || !up || !hand || view.table.variant !== 'classic') return '';
  const u = cardValue(up), odds = dealerOdds(u, view.table.dealerHitsSoft17, true), pct = (x: number) => `${Math.round(100 * x)}%`;
  const upName = u === 1 ? 'an ace' : u === 10 ? 'a ten' : `a ${u}`;
  const bust = `<p class="bj-dealer-odds" data-testid="dealer-odds">Dealer shows ${upName}: busts about <b>${pct(odds.bust)}</b> of the time · ends on 17 ${pct(odds.final[17])}, 18 ${pct(odds.final[18])}, 19 ${pct(odds.final[19])}, 20 ${pct(odds.final[20])}, 21 ${pct(odds.final[21])}${u === 1 || u === 10 ? ' (no blackjack, already checked)' : ''}.</p>`;
  if (!card) return bust;
  const values = hand.cards.map(cardValue), pair = values.length === 2 && values[0] === values[1] && view.legal.actions.includes('split');
  const kind = pair ? 'pair' : hand.soft && hand.total >= 13 && hand.total <= 20 ? 'soft' : 'hard', key = pair ? values[0] : hand.total;
  const rules = strategyRules(view.table); if (!rules) return bust;
  const row = strategyChart(rules).find(r => r.kind === kind && r.key === key);
  if (!row) return bust;
  const col = UP_CARDS.indexOf(u as never), here = row.plays[col], now = view.legal.actions.includes(here.play) ? here.play : here.fallback, cells = row.plays.map((p, i) => `<td class="bj-sc-${p.play}${i === col ? ' here' : ''}" title="${PLAY_WORD[p.play]}${p.play === 'double' || p.play === 'surrender' ? `, otherwise ${p.fallback}` : ''}">${PLAY_SHORT[p.play]}</td>`).join('');
  return `${bust}<details class="bj-strategy-card" data-testid="strategy-card" open><summary>Strategy card: <b>${escape(row.label)}</b> against ${upName}: <b>${PLAY_WORD[now]}</b>${now !== here.play ? ` <small>(${PLAY_WORD[here.play].toLowerCase()} is not allowed now)</small>` : ''}</summary><table class="bj-sc"><thead><tr><th>Dealer</th>${UP_CARDS.map((x, i) => `<th class="${i === col ? 'here' : ''}">${x === 1 ? 'A' : x}</th>`).join('')}</tr></thead><tbody><tr><th>${escape(row.label)}</th>${cells}</tr></tbody></table><small>H hit · S stand · D double (else hit or stand) · P split · R surrender (else hit). This table's rules, ${view.table.decks} deck${view.table.decks === 1 ? '' : 's'}.</small></details>`;
}

/** Session totals. Coach accuracy appears once at least one decision has been compared. */
export function sessionMarkup(session: BlackjackSession): string {
  const accuracy = session.decisions ? `${Math.round((1 - session.mistakes / session.decisions) * 100)}%` : '—';
  return `<details class="panel bj-session" data-testid="blackjack-session"><summary>This session · ${session.rounds} round${session.rounds === 1 ? '' : 's'} · ${signed(session.net)}</summary><dl class="lobby-facts"><div><dt>Rounds</dt><dd>${session.rounds}</dd></div><div><dt>Wagered</dt><dd>${dollars(session.wagered)}</dd></div><div><dt>Net</dt><dd class="${session.net > 0 ? 'positive' : session.net < 0 ? 'negative' : ''}">${signed(session.net)}</dd></div><div><dt>Blackjacks</dt><dd>${session.blackjacks}</dd></div>${session.fees ? `<div><dt>Antes paid</dt><dd class="negative">${dollars(-session.fees)}</dd></div>` : ''}<div><dt>Side bets</dt><dd class="${session.sideBetNet > 0 ? 'positive' : session.sideBetNet < 0 ? 'negative' : ''}">${signed(session.sideBetNet)}</dd></div><div><dt>Approximate model matches</dt><dd>${accuracy}<small>${session.mistakes} of ${session.decisions} decisions differed</small></dd></div></dl></details>`;
}

/** The count trainer: works on its own, with no bets and nothing saved. */
export function countTrainerMarkup(state: TrainerState, answerDraft = '', acesDraft = ''): string {
  const settings = state.settings, system = countSystem(settings.system), count = trainerCount(state), learn = settings.mode === 'learn', finished = trainerFinished(state), last = state.checks.at(-1), fresh = last && last.atCard === state.position;
  const option = (value: string | number, label: string, selected: boolean) => `<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`;
  const right = state.checks.filter(check => check.right).length;
  const tags = (['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'] as const).map(rank => `<td>${formatCount(system.tags[rank])}</td>`).join('');
  return `<div class="tournament-lobby bj-trainer" data-testid="count-trainer">
    <section class="panel" aria-labelledby="trainer-setup-title"><h2 id="trainer-setup-title">Count trainer</h2><p class="lobby-note">Practice keeping a count through a shuffled shoe. No bets, nothing saved.</p>
      <div class="bj-trainer-settings"><label>System<select id="trainer-system">${COUNT_SYSTEMS.map(item => option(item.id, escape(item.name), item.id === settings.system)).join('')}</select></label><label>Shoe<select id="trainer-decks">${option(6, 'Six decks', settings.decks === 6)}${option(2, 'Two decks', settings.decks === 2)}</select></label><label>Cards at a time<select id="trainer-pace">${[1, 2, 3].map(n => option(n, String(n), settings.cardsPerDeal === n)).join('')}</select></label></div>
      <div class="segmented" role="group" aria-label="Mode"><button type="button" class="segment${learn ? ' selected' : ''}" data-trainer-mode="learn" aria-pressed="${learn}">Learn: count shown</button><button type="button" class="segment${learn ? '' : ' selected'}" data-trainer-mode="test" aria-pressed="${!learn}">Test: count hidden</button></div>
      <h3>${escape(system.name)}</h3><p class="lobby-note">${escape(system.level)}. ${escape(system.note)}</p>
      <div class="table-scroll"><table class="blind-table bj-tag-table"><caption>What each card adds to the count</caption><thead><tr>${['2', '3', '4', '5', '6', '7', '8', '9', '10–K', 'A'].map(rank => `<th scope="col">${rank}</th>`).join('')}</tr></thead><tbody><tr>${tags}</tr></tbody></table></div>
      <p class="lobby-note">This trainer checks count arithmetic. It does not establish a player edge or validate betting strategies.</p>
    </section>
    <section class="panel" aria-labelledby="trainer-deal-title"><h2 id="trainer-deal-title">${finished ? 'Shoe finished' : state.position ? 'Count these' : 'Ready'}</h2>
      <div class="bj-cards bj-trainer-cards" aria-live="polite">${state.lastDeal.length ? state.lastDeal.map(card => cardMarkup(card, learn ? formatCount(cardTag(system, card)) : undefined)).join('') : '<span class="bj-empty">Deal to begin</span>'}</div>
      <p class="lobby-note">${state.position} of ${state.cutAt} cards dealt before the cut card.</p>
      ${learn ? countFactsMarkup(system, count) : `<div class="bj-count-check"><label for="trainer-answer">Your running count</label><input id="trainer-answer" inputmode="text" autocomplete="off" value="${escape(answerDraft)}"><label for="trainer-aces">Your aces seen</label><input id="trainer-aces" inputmode="numeric" autocomplete="off" value="${escape(acesDraft)}"><button type="button" id="trainer-check" class="button secondary" ${state.position ? '' : 'disabled'}>Check</button></div>${fresh ? `<p class="bj-count-result ${last.right ? 'right' : 'wrong'}" role="status">${last.runningRight ? `Correct: ${formatCount(last.correct)} running count.` : `Not quite. You said ${formatCount(last.answer)}; the running count is ${formatCount(last.correct)}.`} Aces seen: ${last.acesCorrect}. ${last.acesAnswer === undefined ? 'Ace tally not tested.' : last.acesRight ? 'Ace side count correct.' : `You entered ${last.acesAnswer}; keep counting aces separately.`}</p>` : ''}<p class="lobby-note">Checks: ${right} of ${state.checks.length} correct · streak ${state.streak}</p>`}
      <div class="bj-bet-tools"><button type="button" id="trainer-new" class="button secondary">New shoe</button><button type="button" id="trainer-deal" class="button primary" ${finished ? 'disabled' : ''}>${state.position ? 'Next' : 'Deal'}</button></div>
    </section></div>`;
}

/** Which part of the blackjack area is showing. */
export type BlackjackTab = 'tables' | 'strategy' | 'trainer' | 'deviations';
export const blackjackTabsMarkup = (tab: BlackjackTab) => `<div class="segmented bj-tabs" role="group" aria-label="Blackjack area">${([['tables', 'Tables'], ['strategy', 'Strategy coach'], ['trainer', 'Count coach'], ['deviations', 'Count plays']] as const).map(([id, label]) => `<button type="button" class="segment${tab === id ? ' selected' : ''}" data-blackjack-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div>`;

const PLAY_LABELS: Record<Play, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
const PLAY_CODES: Record<Play, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const upHeading = (up: number) => up === 1 ? 'A' : String(up);
const signedCount = (count: number) => `${count > 0 ? '+' : count < 0 ? '−' : ''}${Math.abs(count)}`;
/** Tables the coaches can teach: every table except Free Bet, which has its own strategy. */
export const COACH_TABLES = BLACKJACK_TABLES.filter(table => strategyRules(table));
const tableSelect = (id: string, selected: string) => `<label>Table rules<select id="${id}">${COACH_TABLES.map(table => `<option value="${table.id}" ${table.id === selected ? 'selected' : ''}>${escape(table.name)}</option>`).join('')}</select></label>`;
const rulesLine = (rules: StrategyRules) => `${rules.decks} decks · dealer ${rules.dealerHitsSoft17 ? 'hits' : 'stands on'} soft 17 · ${rules.doubleAfterSplit ? 'double after split' : 'no double after split'} · ${rules.surrender ? 'late surrender' : 'no surrender'}`;

/** The basic-strategy chart for a rule set, as three small tables with a legend. */
export function strategyChartMarkup(rules: StrategyRules): string {
  const chart = strategyChart(rules), section = (kind: string, title: string) => `<div class="table-scroll"><table class="bj-chart"><caption>${title}</caption><thead><tr><th scope="col">You</th>${UP_CARDS.map(up => `<th scope="col">${upHeading(up)}</th>`).join('')}</tr></thead><tbody>${chart.filter(row => row.kind === kind && !(kind === 'hard' && (row.key > 17 || row.key < 8))).map(row => `<tr><th scope="row">${kind === 'hard' ? (row.key === 17 ? '17+' : row.key === 8 ? '8−' : row.key) : kind === 'soft' ? `A,${row.key - 11}` : row.key === 10 ? 'T,T' : row.label}</th>${row.plays.map(cell => `<td class="bj-play-${cell.play}" title="${PLAY_LABELS[cell.play]}${cell.play === 'hit' || cell.play === 'stand' ? '' : `, otherwise ${cell.fallback}`}">${PLAY_CODES[cell.play]}${cell.play === 'double' && cell.fallback === 'stand' ? 's' : cell.play === 'surrender' && cell.fallback === 'stand' ? 's' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="bj-charts">${section('hard', 'Hard totals')}${section('soft', 'Soft totals')}${section('pair', 'Pairs')}</div><p class="lobby-note bj-legend"><span class="bj-play-hit">H</span> hit <span class="bj-play-stand">S</span> stand <span class="bj-play-double">D</span> double, otherwise hit <span class="bj-play-double">Ds</span> double, otherwise stand <span class="bj-play-split">P</span> split${rules.surrender ? ' <span class="bj-play-surrender">R</span> surrender, otherwise hit <span class="bj-play-surrender">Rs</span> surrender, otherwise stand' : ''}</p>`;
}

function drillMarkup(drill: DrillState, rules: StrategyRules, prefix: string): string {
  const question = drill.question, answer = drill.answer, values = answer?.values;
  const value = (label: string, amount: number | null | undefined) => amount === null || amount === undefined ? '' : `<span>${label} ${amount > 0 ? '+' : amount < 0 ? '−' : ''}${Math.abs(amount).toFixed(2)}</span>`;
  const deviation = question.deviation, whole = deviation ? wholeIndex(deviation) : 0;
  const feedback = !answer ? '' : `<p class="bj-count-result ${answer.right ? 'right' : 'wrong'}" role="status">${answer.right ? 'Matches the model.' : `Model suggests ${PLAY_LABELS[answer.correct]}.`} ${deviation ? `The base-count model suggests ${PLAY_LABELS[answer.basic].toLowerCase()}. With this count, ${PLAY_LABELS[deviation.play as Play].toLowerCase()} at ${signedCount(whole)} or ${deviation.direction === 'at or above' ? 'higher' : 'lower'}; the true count here is ${signedCount(question.trueCount ?? 0)}.` : `The model suggestion for ${question.kind === 'pair' ? 'this pair' : question.kind === 'soft' ? `soft ${question.key}` : `hard ${question.key}`} against ${question.up === 1 ? 'an ace' : question.up === 8 ? 'an 8' : `a ${question.up}`} is to ${PLAY_LABELS[answer.basic].toLowerCase()}.`}</p>${deviation ? '' : `<p class="lobby-note bj-values">Model value per bet: ${value('stand', values!.stand)}${value('hit', values!.hit)}${value('double', values!.double)}${value('split', values!.split)}${value('surrender', values!.surrender)}</p>`}`;
  return `<div class="bj-drill"><div class="bj-drill-felt"><div class="bj-dealer"><span class="eyebrow">DEALER</span><div class="bj-cards">${cardMarkup(question.upCard)}${cardMarkup(null)}</div></div>${question.trueCount === null ? '' : `<p class="bj-drill-count">True count <b>${signedCount(question.trueCount)}</b></p>`}<div class="bj-dealer"><div class="bj-cards">${question.cards.map(card => cardMarkup(card)).join('')}</div><b class="bj-total">${question.kind === 'soft' ? `Soft ${question.key}` : question.kind === 'pair' ? `Pair of ${question.key === 1 ? 'aces' : question.key === 10 ? 'tens' : `${question.key}s`}` : question.key}</b></div></div>
    <div class="action-buttons bj-actions bj-drill-actions" role="group" aria-label="Your play">${drillActions(question, rules).map(play => `<button type="button" class="button ${answer?.correct === play ? 'primary' : 'secondary'}" data-${prefix}-play="${play}" ${answer ? 'disabled' : ''}>${PLAY_LABELS[play]}</button>`).join('')}</div>${feedback}
    <div class="bj-bet-tools"><span class="bj-drill-score">${drill.right} of ${drill.asked} model matches · streak ${drill.streak}</span><button type="button" id="${prefix}-next" class="button ${answer ? 'primary' : 'secondary'}">${answer ? 'Next hand' : 'Skip'}</button></div></div>`;
}

/** Strategy coach: a drill on starting hands plus the full chart for the chosen table's rules. */
export function strategyCoachMarkup(tableId: string, drill: DrillState): string {
  const table = COACH_TABLES.find(item => item.id === tableId) ?? COACH_TABLES[0], rules = strategyRules(table)!;
  return `<div class="tournament-lobby bj-coach" data-testid="strategy-coach"><section class="panel" aria-labelledby="coach-drill-title"><h2 id="coach-drill-title">What is the play?</h2><p class="lobby-note">Practice with approximate strategy advice for the selected rules. This model omits full finite-shoe depletion and resplits; close plays can differ from exact charts, especially with two decks. No bets, nothing saved.</p><div class="bj-trainer-settings">${tableSelect('coach-table', table.id)}</div>${drillMarkup(drill, rules, 'coach')}</section>
    <section class="panel" aria-labelledby="coach-chart-title"><h2 id="coach-chart-title">Approximate strategy chart</h2><p class="lobby-note">${escape(table.name)}: ${rulesLine(rules)}.</p>${strategyChartMarkup(rules)}<p class="lobby-note">Calculated by this app using fixed rank probabilities after removing the visible cards. This is not an exact finite-deck solver or independently verified basic-strategy chart.</p></section></div>`;
}

/** Count plays: when the count changes the basic play, for one counting system and one rule set. */
export function deviationCoachMarkup(tableId: string, system: CountSystemId, drill: DrillState): string {
  const table = COACH_TABLES.find(item => item.id === tableId) ?? COACH_TABLES[0], rules = strategyRules(table)!, list = deviations(rules, system), name = countSystem(system).name;
  return `<div class="tournament-lobby bj-coach" data-testid="deviation-coach"><section class="panel" aria-labelledby="deviation-drill-title"><h2 id="deviation-drill-title">Does the count change the play?</h2><p class="lobby-note">Experimental model estimates: the displayed threshold is where this approximation changes its advice. These are not verified casino-play indices for any counting system.</p><div class="bj-trainer-settings"><label>System<select id="deviation-system">${COUNT_SYSTEMS.map(item => `<option value="${item.id}" ${item.id === system ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label>${tableSelect('deviation-table', table.id)}</div>${drillMarkup(drill, rules, 'deviation')}</section>
    <section class="panel" aria-labelledby="deviation-table-title"><h2 id="deviation-table-title">${escape(name)}: index plays</h2><p class="lobby-note">${escape(table.name)}: ${rulesLine(rules)}. Use the main count for these, not the ace-adjusted betting count. ${system === 'wong-halves-double' ? 'These are doubled Halves indices: twice the original rounded threshold. Use True count ×2, or divide both count and index by two. The ace side tally does not change these estimates.' : 'The separate ace tally does not modify these model indices.'}</p><div class="table-scroll"><table class="standings-table bj-index-table"><thead><tr><th scope="col">Hand</th><th scope="col">Basic play</th><th scope="col">Count play</th><th scope="col">True count</th></tr></thead><tbody>${list.map(item => `<tr><th scope="row">${escape(item.label)}</th><td>${item.basic === 'no insurance' ? 'Decline' : PLAY_LABELS[item.basic]}</td><td>${item.play === 'insurance' ? 'Take it' : PLAY_LABELS[item.play]}</td><td>${signedCount(wholeIndex(item))} or ${item.direction === 'at or above' ? 'higher' : 'lower'}</td></tr>`).join('')}</tbody></table></div><p class="lobby-note">These index numbers are calculated by this app from a model of how the count shifts the remaining cards. They are estimates for practice, not verified tables for casino play.</p></section></div>`;
}
