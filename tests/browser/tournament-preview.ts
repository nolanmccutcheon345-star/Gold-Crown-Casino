/** Design preview of the in-event tournament screens with sample data. No engine, no storage.
    Open with ?state=<name> to show one state; with no query every state is listed. */
import '../../src/ui/styles.css';
import '../../src/ui/phone-play.css';
import '../../src/ui/tournament.css';
import { levelStripMarkup, moveNoticeMarkup, resultMarkup, standingsMarkup, tournamentBannerMarkup, tournamentRecordMarkup } from '../../src/tournament/screens';
import type { TournamentView } from '../../src/tournament/view-model';
import { SAMPLE_RECORDS, sampleView } from '../tournament/fixtures';

const table = '<div class="panel" style="height:220px;display:grid;place-items:center;color:#93a19f;font-size:13px;border-style:dashed">The table and action bar go here</div>';
const play = (view: TournamentView) => levelStripMarkup(view) + tournamentBannerMarkup(view) + (view.pendingMove ? moveNoticeMarkup(view) : table);
const STATES: Record<string, { title: string; html: () => string }> = {
  early: { title: 'Mid-event: level 5, 23 of 45 left', html: () => play(sampleView({ playersLeft: 23, level: 5, heroRank: 9 })) },
  move: { title: 'Table change notice', html: () => play(sampleView({ playersLeft: 27, level: 4, heroRank: 12, pendingMove: { reason: 'table-broke', fromTable: 5, toTable: 3, toSeat: 6 } })) },
  bubble: { title: 'Bubble, hand for hand', html: () => play(sampleView({ playersLeft: 8, level: 9, heroRank: 6, handForHand: true, handsToNextLevel: 2 })) },
  final: { title: 'Final table, in the money', html: () => play(sampleView({ playersLeft: 6, level: 11, heroRank: 2 })) },
  standings: { title: 'Standings', html: () => standingsMarkup(sampleView({ playersLeft: 12, level: 8, heroRank: 4 })) },
  bust: { title: 'Result: out before the money', html: () => resultMarkup(sampleView({ playersLeft: 23, level: 5, heroRank: null })) },
  cash: { title: 'Result: in the money', html: () => resultMarkup(sampleView({ playersLeft: 2, level: 14, heroRank: null })) },
  win: { title: 'Result: winner', html: () => resultMarkup(sampleView({ playersLeft: 1, level: 16, heroRank: 1 })) },
  record: { title: 'Results tab: tournament record', html: () => tournamentRecordMarkup(SAMPLE_RECORDS) },
};
const only = new URLSearchParams(location.search).get('state');
document.querySelector('#preview')!.innerHTML = `<div class="app-shell view-tournaments"><main id="main-content" style="padding-bottom:40px">${Object.entries(STATES).filter(([key]) => !only || key === only).map(([key, state]) => `<section data-state="${key}" style="margin-bottom:36px"><p class="eyebrow">SAMPLE DATA · ${state.title.toUpperCase()}</p>${state.html()}</section>`).join('')}</main></div>`;
