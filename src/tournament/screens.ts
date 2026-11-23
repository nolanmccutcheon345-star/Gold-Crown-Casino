/** Tournament screens as markup strings, in the same style as the rest of the interface.
    Pure functions of their inputs: no storage, engine or controller access. */
import { blindSchedule, ALL_PRESETS, findPreset, stakeBand, summarizeEvent, type BlindLevel, type EventPace, type EventPreset, type EventTier } from './presets';
import { tournamentTotals, type StandingRow, type TournamentRecord, type TournamentView } from './view-model';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
export const chips = (amount: number) => WHOLE.format(amount);
export const dollars = (cents: number) => `${cents < 0 ? '−' : ''}$${WHOLE.format(Math.abs(cents) / 100)}`;
export function ordinal(place: number): string {
  const tens = place % 100, ones = place % 10;
  return `${place}${tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
}
const blinds = (level: BlindLevel) => `${chips(level.smallBlind)} / ${chips(level.bigBlind)}`;
/** Clock-style chip amounts for tight spaces: 12,000 is 12K and 1,500,000 is 1.5M. Exact below 10,000. */
export const compactChips = (amount: number) => amount >= 1_000_000 ? `${ONE_DECIMAL.format(amount / 1_000_000)}M` : amount >= 10_000 ? `${ONE_DECIMAL.format(amount / 1000)}K` : chips(amount);
const compactBlinds = (level: BlindLevel) => `${compactChips(level.smallBlind)} / ${compactChips(level.bigBlind)}`;
const hands = (count: number) => `${count} hand${count === 1 ? '' : 's'}`;
export const bigBlinds = (stack: number, level: BlindLevel) => ONE_DECIMAL.format(stack / level.bigBlind);

export const TIER_LABELS: Record<EventTier, { label: string; short: string; blurb: string }> = {
  home: { label: 'Home games', short: 'Home', blurb: 'Friendly buy-ins, no house fee, one to three tables.' },
  casino: { label: 'Casino dailies', short: 'Casino', blurb: 'Daily and weekend casino tournaments with a house fee and a big-blind ante.' },
  series: { label: 'Series events', short: 'Series', blurb: 'Deep stacks and long levels, from series openers to the $10,000 championship and high rollers.' },
  sng: { label: 'Sit & go', short: 'SNG', blurb: 'One table that starts when it fills. The top two or three are paid.' },
  satellite: { label: 'Satellites', short: 'Satellite', blurb: 'Win a seat in a bigger event. Every prize is a full seat; the leftover goes to the next place.' },
};
const STAKE_LABELS = { low: 'Low stakes', mid: 'Mid stakes', high: 'High stakes' } as const;
const PACE_LABELS: Record<EventPace, { label: string; note: string }> = {
  real: { label: 'Live pace', note: 'Illustrative pace: hands per level use an assumed 30 hands an hour, not a live clock.' },
  fast: { label: 'Faster', note: 'Half as many hands per level. Same blinds, shorter event.' },
};

export interface LobbyState { tier: EventTier; presetId: string; entrants: number; pace: EventPace; }

/** A valid lobby selection: unknown ids and field sizes fall back to the nearest valid choice. */
export function normalizeLobby(state: Partial<LobbyState>): LobbyState {
  const tier: EventTier = state.tier && Object.prototype.hasOwnProperty.call(TIER_LABELS, state.tier) ? state.tier : 'casino';
  const inTier = ALL_PRESETS.filter(preset => preset.tier === tier);
  const preset = inTier.find(item => item.id === state.presetId) ?? inTier[Math.min(1, inTier.length - 1)];
  const entrants = preset.fields.includes(state.entrants ?? -1) ? state.entrants! : preset.fields[Math.min(1, preset.fields.length - 1)];
  return { tier, presetId: preset.id, entrants, pace: state.pace === 'fast' ? 'fast' : 'real' };
}

const entryLabel = (preset: EventPreset) => preset.fee ? `${dollars(preset.buyIn)} + ${dollars(preset.fee)}` : dollars(preset.buyIn);

function eventCard(preset: EventPreset, selected: boolean): string {
  return `<button type="button" class="event-card${selected ? ' selected' : ''}" data-tournament-event="${preset.id}" aria-pressed="${selected}"><span class="event-name">${escape(preset.name)}</span><span class="event-stake">${STAKE_LABELS[stakeBand(preset)]}</span><span class="event-facts"><span><small>Entry</small><b>${entryLabel(preset)}</b></span><span><small>Stack</small><b>${chips(preset.startingStack)}</b></span><span><small>Levels</small><b>${preset.levelMinutes} min</b></span></span></button>`;
}

/** The tournament lobby. `registration` says whether entering is possible yet and why not. */
export function lobbyMarkup(input: Partial<LobbyState>, registration: { available: boolean; reason: string }): string {
  const state = normalizeLobby(input), preset = findPreset(state.presetId)!;
  const summary = summarizeEvent(preset, state.entrants, state.pace), levels = blindSchedule(preset, 12);
  const tiers = (Object.keys(TIER_LABELS) as EventTier[]).map(tier => `<button type="button" class="segment${tier === state.tier ? ' selected' : ''}" data-tournament-tier="${tier}" aria-pressed="${tier === state.tier}"><span class="nav-full">${TIER_LABELS[tier].label}</span><span class="nav-short">${TIER_LABELS[tier].short}</span></button>`).join('');
  const fields = preset.fields.map(field => `<button type="button" class="segment${field === state.entrants ? ' selected' : ''}" data-tournament-field="${field}" aria-pressed="${field === state.entrants}">${field} players</button>`).join('');
  const paces = (Object.keys(PACE_LABELS) as EventPace[]).map(pace => `<button type="button" class="segment${pace === state.pace ? ' selected' : ''}" data-tournament-pace="${pace}" aria-pressed="${pace === state.pace}">${PACE_LABELS[pace].label}</button>`).join('');
  return `<div class="tournament-lobby" data-testid="tournament-lobby">
    <section class="panel lobby-events" aria-labelledby="lobby-events-title"><h2 id="lobby-events-title">Choose an event</h2><p class="lobby-note">${registration.available?`Playable ${state.entrants>9?'multi-table':'single-table'} event · virtual chips.`:'Preview only · virtual chips.'} These are illustrative structures with estimated fees and field ranges, not verified venue offerings.</p><div class="segmented" role="group" aria-label="Kind of tournament">${tiers}</div><p class="lobby-note">${TIER_LABELS[state.tier].blurb}</p><div class="event-list">${ALL_PRESETS.filter(item => item.tier === state.tier).map(item => eventCard(item, item.id === preset.id)).join('')}</div></section>
    <section class="panel lobby-detail" aria-labelledby="lobby-detail-title"><span class="eyebrow">${STAKE_LABELS[stakeBand(preset)].toUpperCase()} · ${TIER_LABELS[preset.tier].label.toUpperCase()}</span><h2 id="lobby-detail-title">${escape(preset.name)}</h2><p class="lobby-note">${escape(preset.blurb)}</p>${preset.satellite ? satelliteNote(preset, summary.ladder) : ''}
      <h3 id="lobby-field-title">Field size</h3><div class="segmented" role="group" aria-labelledby="lobby-field-title">${fields}</div><p class="lobby-note">Illustrative full-size field range: ${chips(preset.typicalField[0])} to ${chips(preset.typicalField[1])} players. ${state.entrants>9?`Played on ${Math.ceil(state.entrants/9)} tables of nine that break down to a final table.`:'One table.'}</p>
      <h3 id="lobby-pace-title">Level length</h3><div class="segmented" role="group" aria-labelledby="lobby-pace-title">${paces}</div><p class="lobby-note">${PACE_LABELS[state.pace].note} Here: ${hands(summary.handsPerLevel)} per level.</p>
      <dl class="lobby-facts"><div><dt>Entry</dt><dd>${dollars(summary.cost)}${preset.fee ? `<small>${dollars(preset.buyIn)} to prizes + ${dollars(preset.fee)} fee</small>` : '<small>All of it goes to prizes</small>'}</dd></div><div><dt>Starting stack</dt><dd>${chips(preset.startingStack)}<small>${chips(summary.startingBigBlinds)} big blinds</small></dd></div><div><dt>Tables</dt><dd>${summary.tables}<small>9 seats each</small></dd></div><div><dt>${state.entrants>9?'Opening prize pool':'Prize pool'}</dt><dd>${dollars(summary.prizePool)}<small>${summary.ladder.length} of ${summary.entrants} paid</small></dd></div></dl>
      <div class="lobby-tables"><table class="payout-table"><caption>${state.entrants>9?'Opening payouts · may grow until registration closes':'Payouts'}</caption><thead><tr><th scope="col">Place</th><th scope="col">Prize</th></tr></thead><tbody>${summary.ladder.map((prize, index) => `<tr><th scope="row">${ordinal(index + 1)}</th><td>${dollars(prize)}</td></tr>`).join('')}</tbody></table>
      <table class="blind-table"><caption>First ${levels.length} levels</caption><thead><tr><th scope="col">Level</th><th scope="col">Blinds</th>${preset.bigBlindAnte ? '<th scope="col">Ante</th>' : ''}</tr></thead><tbody>${levels.map(level => `<tr><th scope="row">${level.level}</th><td>${blinds(level)}</td>${preset.bigBlindAnte ? `<td>${chips(level.ante)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="lobby-note">${preset.bigBlindAnte ? 'Big-blind ante: the big blind posts one ante for the whole table.' : 'No ante.'} ${state.entrants > 9 ? 'Late registration and re-entry through level 4, so the field and prizes can grow; you get one entry.' : 'Freezeout: one entry, no rebuys.'}</p>
      <div class="lobby-register"><button type="button" id="tournament-register" class="button primary" ${registration.available ? '' : 'disabled aria-describedby="tournament-register-note"'}>Register · ${dollars(summary.cost)}</button><p id="tournament-register-note" class="lobby-note">${escape(registration.reason)}</p></div>
    </section></div>`;
}

/** The strip above the table during an event. */
export function levelStripMarkup(view: TournamentView): string {
  const hero = view.hero, toMoney = view.playersLeft - view.placesPaid;
  const cell = (key: string, label: string, value: string, detail = '') => `<div class="strip-cell strip-${key}"><small>${label}</small><b>${value}</b>${detail ? `<span>${detail}</span>` : ''}</div>`;
  return `<section class="level-strip" aria-label="Tournament status" data-testid="level-strip">
    ${cell('level', `Level ${view.current.level}`, compactBlinds(view.current), view.current.ante ? `ante ${compactChips(view.current.ante)}` : 'no ante')}
    ${cell('next', 'Next level', view.next ? `<i>in </i>${hands(view.handsToNextLevel)}` : 'Last level', view.next ? compactBlinds(view.next) : '')}
    ${cell('players', 'Players', `${chips(view.playersLeft)} / ${chips(view.entrants)}`, view.registration?.open ? `late reg to level ${view.registration.closesAfterLevel}` : toMoney > 0 ? `${toMoney} from the money` : 'in the money')}
    ${cell('rank', 'Your rank', hero ? ordinal(hero.rank) : 'Out', hero ? `Table ${hero.table}` : '')}
    ${cell('stack', '<i>Your </i>stack', hero ? `${bigBlinds(hero.stack, view.current)} BB` : '—', hero ? chips(hero.stack) : '')}
    ${cell('average', 'Average', `${bigBlinds(view.averageStack, view.current)} BB`, chips(view.averageStack))}
    <button type="button" id="open-standings" class="button secondary strip-button">Standings</button>
  </section>`;
}

/** Bubble, hand-for-hand, in-the-money and final-table banners. Empty when none applies. */
export function tournamentBannerMarkup(view: TournamentView): string {
  if (view.status === 'complete') return '';
  if (view.registration?.open) return `<p class="tournament-banner" role="status" data-testid="tournament-banner">Late registration and re-entry are open through level ${view.registration.closesAfterLevel}. ${view.registration.entries} entries so far${view.registration.reEntries ? `, ${view.registration.reEntries} of them re-entries` : ''}. Players knocked out now are placed when registration closes.</p>`;
  if (view.status !== 'running') return '';
  const toMoney = view.playersLeft - view.placesPaid;
  const text = view.handForHand ? `Hand for hand. ${view.playersLeft} left, ${view.placesPaid} get paid. Every table finishes its hand before the next deal.`
    : toMoney === 1 ? `On the bubble. The next player out misses the money.`
    : view.finalTable ? `Final table. ${view.playersLeft} left, ${dollars(view.ladder[0] ?? 0)} to the winner.`
    : toMoney <= 0 ? `In the money. Every player left is guaranteed at least ${dollars(view.ladder[Math.min(view.playersLeft, view.ladder.length) - 1] ?? 0)}.`
    : '';
  const bubble = view.handForHand && toMoney === 1 ? ' On the bubble.' : '';
  const money = view.finalTable && toMoney <= 0 ? ' In the money.' : '';
  return text ? `<p class="tournament-banner${view.handForHand || toMoney === 1 ? ' bubble' : ''}" role="status" data-testid="tournament-banner">${text}${bubble}${money}</p>` : '';
}

const MOVE_TITLES = { 'table-broke': 'Your table broke', 'balance': 'You have been moved', 'final-table': 'You made the final table' } as const;
const MOVE_REASONS = { 'table-broke': 'There are few enough players left to close a table, so its players were redrawn into open seats.', 'balance': 'Tables are kept within one player of each other. You were next in line to move.', 'final-table': 'Seats and the button were redrawn for the last table.' } as const;

/** Shown instead of the next deal until Hero acknowledges the move. Empty with no pending move. */
export function moveNoticeMarkup(view: TournamentView): string {
  const move = view.pendingMove;
  if (!move) return '';
  return `<section class="panel move-notice" role="alertdialog" aria-labelledby="move-notice-title" aria-describedby="move-notice-text" data-testid="move-notice"><span class="eyebrow">TABLE CHANGE</span><h2 id="move-notice-title">${MOVE_TITLES[move.reason]}</h2><p class="move-route"><span>Table ${move.fromTable}</span><span aria-hidden="true">→</span><b>Table ${move.toTable}, seat ${move.toSeat}</b></p><p id="move-notice-text">${MOVE_REASONS[move.reason]} Your chips move with you: ${view.hero ? chips(view.hero.stack) : '0'}.</p><button type="button" id="tournament-move-ack" class="button primary">Take my seat</button></section>`;
}

function standingRow(row: StandingRow, rank: number | null, view: TournamentView): string {
  const live = row.finished === null&&!row.awaitingPlace, winner = row.finished === 1;
  return `<tr class="${row.isHero ? 'hero-row' : ''}${live ? '' : winner ? ' winner-row' : ' out-row'}"><th scope="row">${live ? rank : row.awaitingPlace ? 'Pending' : ordinal(row.finished!)}</th><td class="standing-name">${escape(row.name)}${row.isHero ? ' <span class="outline-tag">YOU</span>' : ''}${row.regular ? `<small class="regular-tag">Regular · ${escape(row.regular)}</small>` : ''}</td><td>${live ? chips(row.stack) : winner ? 'Winner' : row.awaitingPlace ? '<span class="muted">Out · place pending</span>' : '<span class="muted">Out</span>'}</td><td>${live ? bigBlinds(row.stack, view.current) : row.prize ? dollars(row.prize) : '<span class="muted">—</span>'}</td><td>${row.table === null ? '<span class="muted">—</span>' : row.table}</td></tr>`;
}

/** Chip counts for live players, finishing places for the rest, and the payout ladder. */
export function standingsMarkup(view: TournamentView): string {
  let rank = 0;
  const eliminated = view.entrants > view.playersLeft || view.standings.some(row=>row.awaitingPlace);
  return `<div class="tournament-standings" data-testid="tournament-standings"><section class="panel" aria-labelledby="standings-title"><h2 id="standings-title">Standings</h2><p class="lobby-note">${chips(view.playersLeft)} of ${chips(view.entrants)} left on ${view.tablesLeft} table${view.tablesLeft === 1 ? '' : 's'}. Average stack ${chips(view.averageStack)}.</p><div class="table-scroll"><table class="standings-table"><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Chips</th><th scope="col">BB / prize</th><th scope="col">Table</th></tr></thead><tbody>${view.standings.map(row => standingRow(row, row.finished === null&&!row.awaitingPlace ? ++rank : null, view)).join('')}</tbody></table></div></section>
    <section class="panel" aria-labelledby="ladder-title"><h2 id="ladder-title">Payouts</h2><p class="lobby-note">Prize pool ${dollars(view.prizePool)}. ${view.placesPaid} places paid.${view.registration?.open?' Provisional until registration closes.':''}</p><table class="payout-table"><thead><tr><th scope="col">Place</th><th scope="col">Prize</th><th scope="col">Status</th></tr></thead><tbody>${view.ladder.map((prize, index) => { const place = index + 1, decided = !view.registration?.open&&(place > view.playersLeft || (view.status === 'complete' && place === 1)); return `<tr class="${decided ? 'out-row' : ''}"><th scope="row">${ordinal(place)}</th><td>${dollars(prize)}</td><td>${decided ? 'Paid' : view.registration?.open ? 'Provisional' : 'To play for'}</td></tr>`; }).join('')}</tbody></table>${eliminated ? '' : '<p class="lobby-note">Nobody has been eliminated yet.</p>'}</section></div>`;
}

/** Hero's bust-out or win screen. Empty until there is a result. */
export function resultMarkup(view: TournamentView): string {
  const result = view.result;
  if (!result) return '';
  const net = result.prize - result.cost, won = result.place === 1, cashed = result.prize > 0;
  const seat = !!view.seatTarget && result.prize === view.seatTarget.seat;
  const title = seat ? `You won a seat in ${escape(view.seatTarget!.name)}.` : won ? 'You won the tournament.' : cashed ? `You finished ${ordinal(result.place)}, in the money.` : `You finished ${ordinal(result.place)}.`;
  const bubble = !cashed && result.place === view.placesPaid + 1;
  return `<section class="panel tournament-result${cashed ? ' cashed' : ''}" aria-labelledby="result-title" data-testid="tournament-result"><span class="eyebrow">${escape(view.eventName).toUpperCase()}</span><h2 id="result-title">${title}</h2><p class="lobby-note">${ordinal(result.place)} of ${chips(result.entrants)} after ${hands(result.handsPlayed)}.${bubble ? ' One place short of the money.' : ''}</p><dl class="lobby-facts"><div><dt>Prize</dt><dd>${dollars(result.prize)}</dd></div><div><dt>Entry cost</dt><dd>${dollars(result.cost)}</dd></div><div><dt>Net</dt><dd class="${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}">${net > 0 ? '+' : ''}${dollars(net)}</dd></div></dl>${seat ? `<p class="lobby-note seat-won" data-testid="seat-won">Your seat (${dollars(view.seatTarget!.seat)}) is in your tournament balance.</p>` : ''}<div class="result-actions">${seat ? `<button type="button" class="button primary" data-seat-target="${escape(view.seatTarget!.id)}">Register for ${escape(view.seatTarget!.name)}</button>` : ''}<button type="button" id="open-standings" class="button secondary">Standings</button>${view.status === 'hero-out' ? '<button type="button" id="tournament-skip" class="button secondary">Play out the event</button>' : ''}<button type="button" id="tournament-new" class="button primary">New tournament</button></div></section>`;
}

/** Tournament section for the Results tab: return on entry costs, never bb/100. */
export function tournamentRecordMarkup(records: readonly TournamentRecord[]): string {
  const totals = tournamentTotals(records), percent = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${ONE_DECIMAL.format(value * 100)}%`;
  if (!totals.events) return `<section class="panel tournament-record" aria-labelledby="record-title" data-testid="tournament-record"><h2 id="record-title">Tournaments</h2><p class="lobby-note">No finished tournaments yet. Results appear here after your first event.</p></section>`;
  return `<section class="panel tournament-record" aria-labelledby="record-title" data-testid="tournament-record"><h2 id="record-title">Tournaments</h2><p class="lobby-note">Tournament results are counted as return on entry costs and kept apart from cash-game results.</p><dl class="lobby-facts"><div><dt>Events</dt><dd>${totals.events}</dd></div><div><dt>In the money</dt><dd>${totals.cashes}<small>${totals.inTheMoneyRate === null ? '' : `${ONE_DECIMAL.format(totals.inTheMoneyRate * 100)}% of events`}</small></dd></div><div><dt>Entry costs</dt><dd>${dollars(totals.cost)}</dd></div><div><dt>Prizes</dt><dd>${dollars(totals.prizes)}</dd></div><div><dt>Net</dt><dd class="${totals.net > 0 ? 'positive' : totals.net < 0 ? 'negative' : ''}">${totals.net > 0 ? '+' : ''}${dollars(totals.net)}</dd></div><div><dt>Return</dt><dd>${percent(totals.roi)}</dd></div></dl><div class="table-scroll"><table class="standings-table"><thead><tr><th scope="col">Event</th><th scope="col">Finish</th><th scope="col">Cost</th><th scope="col">Prize</th></tr></thead><tbody>${records.map(record => `<tr><th scope="row">${escape(record.eventName)}</th><td>${ordinal(record.place)} of ${chips(record.entrants)}</td><td>${dollars(record.cost)}</td><td>${record.prize ? dollars(record.prize) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/** Patch 72: what a satellite awards at the chosen field size. */
export function satelliteNote(preset: EventPreset, ladder: number[]): string {
  const target = findPreset(preset.satellite!.target), seat = preset.satellite!.seat, seats = ladder.filter(prize => prize === seat).length, rest = ladder.find(prize => prize !== seat);
  return `<p class="lobby-note satellite-note" data-testid="satellite-note"><b>${seats} seat${seats === 1 ? '' : 's'}</b> in ${escape(target?.name ?? 'the target event')} (${dollars(seat)} each)${rest ? `, then ${dollars(rest)} to the next place` : ''}. A seat is paid as its entry value to your tournament balance, ready to register.</p>`;
}
