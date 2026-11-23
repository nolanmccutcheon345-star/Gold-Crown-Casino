/** Design preview of the blackjack table screens with sample data. No engine, no storage.
    Open with ?state=<name> for one state; add &coach=1 and &count=show or &count=hide. */
import '../../src/ui/styles.css';
import '../../src/ui/phone-play.css';
import '../../src/ui/tournament.css';
import '../../src/ui/tournament-play.css';
import '../../src/ui/blackjack.css';
import '../../src/ui/blackjack-table.css';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import { SAMPLE_BLACKJACK } from '../blackjack/fixtures';

const query = new URLSearchParams(location.search), only = query.get('state'), count = query.get('count');
const options = { coach: query.get('coach') === '1', count: count ? { system: (query.get('system') ?? 'hi-lo') as 'hi-lo', reveal: count === 'show' } : null };
document.querySelector('#preview')!.innerHTML = `<div class="app-shell view-blackjack"><main id="main-content">${Object.entries(SAMPLE_BLACKJACK).filter(([key]) => !only || key === only).map(([key, make]) => `<section data-state="${key}" style="margin-bottom:36px"><p class="eyebrow">SAMPLE DATA · ${key.toUpperCase()}</p>${blackjackTableMarkup(make(), options)}</section>`).join('')}</main></div>`;
