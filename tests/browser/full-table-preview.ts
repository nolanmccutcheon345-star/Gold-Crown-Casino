/** Design preview of a full blackjack table and playable side bets, with sample data.
    No engine, no storage. ?state=<name> shows one state; &target=<main|side bet id> picks the chip target;
    &count=show|hide adds the count strip; ?state=setup shows the lobby controls and paytables. */
import '../../src/ui/styles.css';
import '../../src/ui/phone-play.css';
import '../../src/ui/tournament.css';
import '../../src/ui/tournament-play.css';
import '../../src/ui/blackjack.css';
import '../../src/ui/full-table.css';
import '../../src/ui/blackjack-table.css';
import '../../src/ui/blackjack-seats.css';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import { fullTableSetupMarkup, otherSeatsMarkup, waitingFor } from '../../src/blackjack/full-table';
import { sideBetPaytable } from '../../src/blackjack/side-bets';
import { sideBet, type SideBetId } from '../../src/blackjack/presets';
import { SAMPLE_BLACKJACK } from '../blackjack/fixtures';
import { SAMPLE_FULL_TABLE } from '../blackjack/full-fixtures';
import type { BlackjackView } from '../../src/blackjack/view-model';

const query = new URLSearchParams(location.search), only = query.get('state'), count = query.get('count'), target = (query.get('target') ?? 'main') as 'main' | SideBetId;
const sides = (view: BlackjackView, results: boolean): BlackjackView => ({ ...view, sideBets: [{ id: 'twenty-one-plus-three', amount: 500, result: results ? { outcome: 'Flush', net: 4500 } : null }, { id: 'perfect-pairs', amount: 0, result: null }, { id: 'buster', amount: 500, result: results && view.phase === 'settled' ? { outcome: null, net: -500 } : null }] });
const STATES: Record<string, [keyof typeof SAMPLE_BLACKJACK, boolean]> = { betting: ['betting', false], player: ['player', true], others: ['player', true], settled: ['win', true], short: ['player', true] };
const tables = Object.entries(STATES).filter(([key]) => !only || key === only).map(([key, [sample, results]]) => { const view = sides(SAMPLE_BLACKJACK[sample](), results), full = SAMPLE_FULL_TABLE[key](); const shown = key === 'others' ? { ...view, legal: { ...view.legal, actions: [] } } : view;
  return `<section data-state="${key}" style="margin-bottom:36px"><p class="eyebrow">SAMPLE DATA · ${key.toUpperCase()}</p>${blackjackTableMarkup(shown, { feltExtra: otherSeatsMarkup(full), waitingFor: waitingFor(full), sideBetTarget: target, count: count ? { system: 'hi-lo', reveal: count === 'show' } : null })}</section>`; }).join('');
const pay = (id: SideBetId, decks: number) => `<section class="panel" style="margin-bottom:12px"><h3>${sideBet(id).name} · ${decks} decks</h3><table class="bj-pay"><thead><tr><th scope="col">Result</th><th scope="col">Pays</th></tr></thead><tbody>${sideBetPaytable(id, decks).map(row => `<tr><td>${row.outcome}</td><td>${row.to1} to 1</td></tr>`).join('')}</tbody></table></section>`;
const setup = !only || only === 'setup' ? `<section data-state="setup"><p class="eyebrow">SAMPLE DATA · SETUP</p><section class="panel">${fullTableSetupMarkup({ heroSeat: 7, others: 4, pace: 'slow' })}</section>${(['twenty-one-plus-three', 'perfect-pairs', 'lucky-ladies', 'match-the-dealer', 'buster', 'push-22'] as SideBetId[]).map(id => pay(id, 6)).join('')}</section>` : '';
document.querySelector('#preview')!.innerHTML = `<div class="app-shell view-blackjack"><main id="main-content">${only === 'setup' ? '' : tables}${setup}</main></div>`;
