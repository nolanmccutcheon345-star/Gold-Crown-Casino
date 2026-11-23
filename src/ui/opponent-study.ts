import type { BotMemory, ObservedRate } from '../contracts';

const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]!);
function rate(label:string,value:ObservedRate):string {
  return `<div><dt>${label}</dt><dd>${value.opportunities?`${(100*value.count/value.opportunities).toFixed(1)}%`:'—'}<small>${value.count} / ${value.opportunities} opportunities</small></dd></div>`;
}

/** Consumes only a public-memory projection, never profiles or live game state. */
export function observedOpponentCards(memory:BotMemory,names:readonly string[]):string {
  return `<p data-testid="opponent-study-window">Observed window: ${memory.windowHands} completed hands in this session (maximum 120). Samples are descriptive and uncertain, especially with few opportunities. Frequencies are observations, not known styles or predictions of real players. VPIP and preflop raise use hands with an observed preflop decision; this observed raise rate is not the legal-raise-opportunity PFR shown in your statistics. Aggressive actions use postflop decisions; fold facing a bet uses postflop decisions facing an outstanding wager.</p><div class="opponent-study-grid">${memory.opponents.filter(opponent=>opponent.seatId!==0).map(opponent=>`<article class="observed-opponent" data-observed-seat="${opponent.seatId}"><h3>${escape(names[opponent.seatId] ?? `Seat ${opponent.seatId+1}`)}</h3><p>${opponent.hands} observed hands · style not disclosed</p><dl class="observed-rates">${rate('VPIP',opponent.vpip)}${rate('Preflop raise',opponent.pfr)}${rate('Aggressive actions',opponent.aggression)}${rate('Fold facing a bet',opponent.foldToBet)}</dl><div class="observed-reveals">${opponent.showdowns.length?`Public showdown samples only: ${opponent.showdowns.slice(-3).map(cards=>`<code>${cards.map(escape).join(' ')}</code>`).join('')}`:'No publicly revealed showdown cards in this window.'}</div></article>`).join('')}</div>`;
}
