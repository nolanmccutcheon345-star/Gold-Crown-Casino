import { describe, expect, it } from 'vitest';
import { EVENT_PRESETS } from '../../src/tournament/presets';
import { levelStripMarkup, lobbyMarkup, moveNoticeMarkup, normalizeLobby, ordinal, resultMarkup, standingsMarkup, tournamentBannerMarkup, tournamentRecordMarkup } from '../../src/tournament/screens';
import { tournamentTotals } from '../../src/tournament/view-model';
import { SAMPLE_RECORDS, sampleView } from './fixtures';

const count = (text: string, part: string) => text.split(part).length - 1;
const closed = { available: false, reason: 'Not open yet <b>' };

describe('tournament lobby', () => {
  it('falls back to a valid selection', () => {
    expect(normalizeLobby({})).toEqual({ tier: 'casino', presetId: 'daily-125', entrants: 27, pace: 'real' });
    expect(normalizeLobby({ tier: 'home', presetId: 'series-10000', entrants: 999 })).toEqual({ tier: 'home', presetId: 'home-50', entrants: 18, pace: 'real' });
    expect(normalizeLobby({ tier: 'nope' as never, pace: 'fast' }).tier).toBe('casino');
  });
  it.each(EVENT_PRESETS.flatMap(preset => preset.fields.map(field => [preset.id, field] as const)))('renders %s with %s players', (presetId, entrants) => {
    const preset = EVENT_PRESETS.find(item => item.id === presetId)!, html = lobbyMarkup({ tier: preset.tier, presetId, entrants, pace: 'fast' }, closed);
    expect(count(html, 'data-tournament-event=')).toBe(EVENT_PRESETS.filter(item => item.tier === preset.tier).length);
    expect(count(html, 'aria-pressed="true"')).toBe(4);
    expect(html).toContain(`data-tournament-field="${entrants}" aria-pressed="true"`);
    expect(html.includes('<th scope="col">Ante</th>')).toBe(preset.bigBlindAnte);
    expect(html).not.toContain('NaN'); expect(html).not.toContain('undefined');
  });
  it.each(['constructor', 'toString', '__proto__'])('rejects inherited category %s', tier => {
    expect(normalizeLobby({tier: tier as never})).toEqual(normalizeLobby({}));
    expect(lobbyMarkup({tier: tier as never}, closed)).toContain('illustrative structures');
  });
  it('keeps registration closed with an escaped reason until the engine exists', () => {
    const html = lobbyMarkup({}, closed);
    expect(html).toContain('id="tournament-register" class="button primary" disabled aria-describedby="tournament-register-note"');
    expect(html).toContain('Not open yet &lt;b&gt;'); expect(html).toContain('Register · $125');
    expect(lobbyMarkup({}, { available: true, reason: '' })).not.toContain('disabled');
  });
});

describe('tournament table screens', () => {
  it('shows level, next level, field, rank and stack in the strip', () => {
    const html = levelStripMarkup(sampleView({ playersLeft: 23, level: 5, heroRank: 9 }));
    for (const part of ['Level 5', '300 / 600', 'ante 600', '<i>in </i>7 hands', '400 / 800', '23 / 45', '16 from the money', '9th', 'id="open-standings"']) expect(html, part).toContain(part);
    expect(levelStripMarkup(sampleView({ playersLeft: 23, level: 5, heroRank: null }))).toContain('<b>Out</b>');
    expect(levelStripMarkup(sampleView({ playersLeft: 23, level: 5, handsToNextLevel: 1 }))).toContain('<i>in </i>1 hand<');
    const late = levelStripMarkup(sampleView({ playersLeft: 3, level: 20 }));
    expect(late).toContain('15K / 30K'); expect(late).toContain('ante 30K');
  });
  it('picks one banner for the stage of the event', () => {
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 23, level: 5 }))).toBe('');
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 8, level: 9 }))).toContain('On the bubble');
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 9, level: 9, handForHand: true }))).toContain('Hand for hand. 9 left, 7 get paid');
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 9, level: 9 }))).toContain('Final table');
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 5, level: 12 }))).toContain('Final table');
    expect(tournamentBannerMarkup(sampleView({ presetId: 'weekly-300', entrants: 90, playersLeft: 12, level: 12 }))).toContain('In the money');
    expect(tournamentBannerMarkup(sampleView({ playersLeft: 23, level: 5, heroRank: null }))).toBe('');
  });
  it('explains a table change and waits for acknowledgement', () => {
    expect(moveNoticeMarkup(sampleView({ playersLeft: 23, level: 5 }))).toBe('');
    const html = moveNoticeMarkup(sampleView({ playersLeft: 23, level: 5, pendingMove: { reason: 'table-broke', fromTable: 5, toTable: 3, toSeat: 6 } }));
    for (const part of ['role="alertdialog"', 'Your table broke', 'Table 5', 'Table 3, seat 6', 'id="tournament-move-ack"']) expect(html, part).toContain(part);
    expect(moveNoticeMarkup(sampleView({ playersLeft: 9, level: 9, pendingMove: { reason: 'final-table', fromTable: 2, toTable: 1, toSeat: 1 } }))).toContain('You made the final table');
  });
  it('lists every entrant once in the standings and marks paid places', () => {
    const view = sampleView({ playersLeft: 5, level: 12, heroRank: 2 }), html = standingsMarkup(view);
    expect(count(html, '<tr class="')).toBe(45 + 7); expect(count(html, 'hero-row')).toBe(1); expect(count(html, '>YOU<')).toBe(1);
    expect(count(html, '<td>Paid</td>')).toBe(2); expect(count(html, '<td>To play for</td>')).toBe(5);
    expect(view.standings.reduce((sum, row) => sum + row.stack, 0)).toBe(20000 * 45);
  });
  it('marks the completed winner correctly and accounts for every prize', () => {
    const view = sampleView({playersLeft:1,level:20,heroRank:1});
    expect(view.standings[0]).toMatchObject({finished:1,prize:view.ladder[0]});
    expect(view.standings.reduce((sum,row)=>sum+row.prize,0)).toBe(view.prizePool);
    const firstRow=standingsMarkup(view).split('<tbody>')[1].split('</tr>')[0];
    expect(firstRow).toContain('winner-row'); expect(firstRow).toContain('Winner'); expect(firstRow).not.toContain('>Out<');
  });
  it('renders named entrants for a ninety-player opening fixture', () => {
    const view=sampleView({presetId:'weekly-300',entrants:90,playersLeft:90,level:1});
    expect(view.standings).toHaveLength(90);
    expect(view.standings.every(row=>typeof row.name==='string'&&row.name.length>0)).toBe(true);
    expect(new Set(view.standings.map(row=>row.name)).size).toBe(90);
    expect(standingsMarkup(view)).not.toContain('undefined');
  });
  it('reports a bust, a bubble, a cash and a win', () => {
    expect(resultMarkup(sampleView({ playersLeft: 23, level: 5 }))).toBe('');
    const bust = resultMarkup(sampleView({ playersLeft: 23, level: 5, heroRank: null }));
    for (const part of ['You finished 24th.', '24th of 45', '−$125', 'id="tournament-skip"', 'id="tournament-new"']) expect(bust, part).toContain(part);
    expect(resultMarkup(sampleView({ playersLeft: 7, level: 9, heroRank: null }))).toContain('One place short of the money.');
    const cash = resultMarkup(sampleView({ playersLeft: 4, level: 12, heroRank: null }));
    expect(cash).toContain('You finished 5th, in the money.'); expect(cash).toContain('class="positive"');
    const win = resultMarkup(sampleView({ playersLeft: 1, level: 20, heroRank: 1 }));
    expect(win).toContain('You won the tournament.'); expect(win).not.toContain('tournament-skip');
  });
  it('totals tournament results as return on cost', () => {
    expect(tournamentTotals([])).toEqual({ events: 0, cashes: 0, cost: 0, prizes: 0, net: 0, roi: null, inTheMoneyRate: null, bestPlace: null });
    expect(tournamentTotals(SAMPLE_RECORDS)).toEqual({ events: 4, cashes: 2, cost: 60000, prizes: 132800, net: 72800, roi: 72800 / 60000, inTheMoneyRate: 0.5, bestPlace: 3 });
    const html = tournamentRecordMarkup(SAMPLE_RECORDS);
    for (const part of ['+$728', '+121.3%', '50% of events', '3rd of 45']) expect(html, part).toContain(part);
    expect(html).not.toContain('bb/100'); expect(tournamentRecordMarkup([])).toContain('No finished tournaments yet');
  });
  it('names places correctly', () => { expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']); });
});
