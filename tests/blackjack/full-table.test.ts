import { describe, expect, it } from 'vitest';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { fullTableSetupMarkup, otherSeatsMarkup, seatsPlayed, waitingFor } from '../../src/blackjack/full-table';
import { SEATS, TABLE_PLAYERS, seatLineup, seatPlay, seatTakesInsurance, type PlayerStyle } from '../../src/blackjack/table-players';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import type { Play, Value } from '../../src/blackjack/strategy';
import { SAMPLE_BLACKJACK } from './fixtures';
import { SAMPLE_FULL_TABLE } from './full-fixtures';

const table = BLACKJACK_TABLES.find(item => item.id === 'casino-5')!;
const ALL: Play[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const STYLES: PlayerStyle[] = ['by-the-book', 'never-bust', 'mimic-dealer', 'gambler'];

describe('seat players', () => {
  it('always returns a legal play, for every style, hand and up card', () => {
    const hands: Value[][] = []; for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) { hands.push([a as Value, b as Value]); hands.push([a as Value, b as Value, 2]); }
    const menus: Play[][] = [ALL, ['hit', 'stand'], ['hit', 'stand', 'double'], ['stand'], ['hit', 'stand', 'split']];
    let checked = 0;
    for (const style of STYLES) for (const cards of hands) for (let up = 1; up <= 10; up++) for (const legal of menus) { const usable = cards.length > 2 ? legal.filter(play => play === 'hit' || play === 'stand') : cards[0] !== cards[1] ? legal.filter(play => play !== 'split') : legal; expect(usable).toContain(seatPlay(style, cards, up as Value, table, usable)); checked++; }
    expect(checked).toBeGreaterThan(20000);
  });
  it('is the same decision every time for the same cards', () => { for (const style of STYLES) expect(seatPlay(style, [10, 6], 10, table, ALL)).toBe(seatPlay(style, [10, 6], 10, table, ALL)); });
  it('the dealer mimic hits to 17 and never doubles or splits', () => {
    expect(seatPlay('mimic-dealer', [5, 6], 6, table, ALL)).toBe('hit'); expect(seatPlay('mimic-dealer', [8, 8], 6, table, ALL)).toBe('hit');
    expect(seatPlay('mimic-dealer', [10, 7], 10, table, ALL)).toBe('stand'); expect(seatPlay('mimic-dealer', [1, 6], 10, table, ALL)).toBe('stand');
  });
  it('the never-bust player stands on hard 12 and up, hits soft 17, and still splits aces and eights', () => {
    expect(seatPlay('never-bust', [10, 2], 10, table, ALL)).toBe('stand'); expect(seatPlay('never-bust', [6, 5], 6, table, ALL)).toBe('hit');
    expect(seatPlay('never-bust', [1, 6], 6, table, ALL)).toBe('hit'); expect(seatPlay('never-bust', [1, 7], 10, table, ALL)).toBe('stand');
    expect(seatPlay('never-bust', [8, 8], 10, table, ALL)).toBe('split'); expect(seatPlay('never-bust', [1, 1], 10, table, ALL)).toBe('split'); expect(seatPlay('never-bust', [9, 9], 6, table, ALL)).toBe('stand');
  });
  it('the gambler splits every pair, doubles 9 to 11 and insures', () => {
    expect(seatPlay('gambler', [10, 10], 6, table, ALL)).toBe('split'); expect(seatPlay('gambler', [5, 4], 10, table, ALL)).toBe('double'); expect(seatPlay('gambler', [6, 5], 1, table, ALL)).toBe('double');
    expect(seatPlay('gambler', [10, 6], 10, table, ALL)).toBe('hit'); expect(seatPlay('gambler', [10, 4], 5, table, ALL)).toBe('stand');
    expect(seatTakesInsurance('gambler')).toBe(true); expect(STYLES.filter(seatTakesInsurance)).toEqual(['gambler']);
  });
  it('the by-the-book player follows the strategy coach', () => {
    expect(seatPlay('by-the-book', [8, 8], 10, table, ALL)).toBe('split'); expect(seatPlay('by-the-book', [6, 5], 6, table, ALL)).toBe('double');
    expect(seatPlay('by-the-book', [10, 2], 4, table, ALL)).toBe('stand'); expect(seatPlay('by-the-book', [10, 6], 7, table, ALL)).toBe('hit');
  });
});
describe('seat lineup', () => {
  const first = () => 0;
  it('puts Hero in the chosen seat and fills the requested number of others without repeats', () => {
    for (let heroSeat = 1; heroSeat <= SEATS; heroSeat++) for (let others = 0; others <= 6; others++) {
      const seats = seatLineup(heroSeat, others, first); expect(seats).toHaveLength(SEATS); expect(seats[heroSeat - 1]).toBe('hero');
      const players = seats.filter(seat => seat && seat !== 'hero'); expect(players).toHaveLength(others); expect(new Set(players).size).toBe(others);
    }
  });
  it('seats neighbours next to Hero first', () => { expect(seatLineup(4, 2, first).map(seat => seat ? 1 : 0)).toEqual([0, 0, 1, 1, 1, 0, 0]); expect(seatLineup(7, 2, first).map(seat => seat ? 1 : 0)).toEqual([0, 0, 0, 0, 1, 1, 1]); });
  it('uses the index function to choose who sits', () => { expect((seatLineup(1, 1, () => 3)[1] as { id: string }).id).toBe(TABLE_PLAYERS[3].id); });
  it('rejects impossible tables', () => { expect(() => seatLineup(0, 2, first)).toThrow(); expect(() => seatLineup(8, 2, first)).toThrow(); expect(() => seatLineup(1, 7, first)).toThrow(); expect(() => seatLineup(1.5, 2, first)).toThrow(); });
});
describe('full table screens', () => {
  it('draws seven seats in order with every card of every other player in the label', () => {
    const html = otherSeatsMarkup(SAMPLE_FULL_TABLE.others()); expect(html.match(/data-bj-seat="/g)).toHaveLength(7);
    expect(html.indexOf('data-bj-seat="1"')).toBeLessThan(html.indexOf('data-bj-seat="7"'));
    expect(html).toContain('Seat 1, Dana (by the book): Ten of hearts, 6 of clubs, 5 of diamonds, 21, Stand'); expect(html).toContain('Seat 5, Lou (gambler)'); expect(html).toContain('Acting now'); expect(html).toContain('Seat 4: you');
    expect(html.match(/class="bj-mini[ "]/g)).toHaveLength(16);
  });
  it('names who the table is waiting for only when another seat acts', () => { expect(waitingFor(SAMPLE_FULL_TABLE.others())).toBe('Lou is playing'); expect(waitingFor(SAMPLE_FULL_TABLE.player())).toBeNull(); expect(waitingFor(SAMPLE_FULL_TABLE.settled())).toBeNull(); });
  it('shows results, empty seats and bets before the deal', () => {
    expect(otherSeatsMarkup(SAMPLE_FULL_TABLE.settled())).toContain('Blackjack'); expect(otherSeatsMarkup(SAMPLE_FULL_TABLE.settled())).toContain('bj-seat-hand lost');
    expect(otherSeatsMarkup(SAMPLE_FULL_TABLE.short()).match(/Seat \d: empty/g)).toHaveLength(4); expect(otherSeatsMarkup(SAMPLE_FULL_TABLE.betting())).toContain('bet $10');
  });
  it('puts the seats on the felt and leaves the table unchanged without them', () => {
    const view = SAMPLE_BLACKJACK.player(), plain = blackjackTableMarkup(view), full = blackjackTableMarkup(view, { feltExtra: otherSeatsMarkup(SAMPLE_FULL_TABLE.player()) });
    expect(plain).not.toContain('bj-seats'); expect(full).toContain('data-testid="blackjack-seats"'); expect(full.replace(otherSeatsMarkup(SAMPLE_FULL_TABLE.player()), '').replace('class="bj-felt bj-full"', 'class="bj-felt"')).toBe(plain); expect(full).toContain('class="bj-felt bj-full"');
  });
  it('replaces the action title and hides Hint while another seat plays', () => { const html = blackjackTableMarkup(SAMPLE_BLACKJACK.player(), { waitingFor: 'Lou is playing' }); expect(html).toContain('<h2>Lou is playing</h2>'); expect(html).not.toContain('id="bj-hint"'); });
  it('setup offers seat, company and pace', () => { const html = fullTableSetupMarkup({ heroSeat: 7, others: 4, pace: 'slow' }); expect(html).toContain('data-blackjack-others="4" aria-pressed="true"'); expect(html).toContain('data-blackjack-seat="7" aria-pressed="true"'); expect(html).toContain('data-blackjack-pace="slow" aria-pressed="true"'); expect(html).toContain("after seeing everyone else's cards"); });
});
describe('side bets as chip targets', () => {
  const betting = () => ({ ...SAMPLE_BLACKJACK.betting(), bet: 1500, sideBets: [{ id: 'twenty-one-plus-three' as const, amount: 500, result: null }] });
  it('changes nothing unless a target is given', () => { expect(blackjackTableMarkup(betting())).not.toContain('Chips go to'); expect(blackjackTableMarkup(betting())).not.toContain('data-blackjack-side="main"'); });
  it('marks the target spot and says where chips go', () => {
    const html = blackjackTableMarkup(betting(), { sideBetTarget: 'twenty-one-plus-three' });
    expect(html).toContain('Chips go to: <b>21+3</b>'); expect(html).toMatch(/bj-side-spot placed target" data-blackjack-side="twenty-one-plus-three"[^>]*aria-pressed="true"/); expect(html).toContain('data-blackjack-side="main" aria-pressed="false"'); expect(html).toContain('aria-label="Add chips to the 21+3 side bet"');
    expect(blackjackTableMarkup(betting(), { sideBetTarget: 'main' })).toContain('Chips go to: <b>Main bet</b>');
  });
  it('stops chips that would pass the side-bet limit or the balance', () => {
    const disabled = (html: string) => [...html.matchAll(/data-blackjack-chip="(\d+)" (disabled)?/g)].filter(match => match[2]).map(match => Number(match[1]));
    expect(disabled(blackjackTableMarkup(betting(), { sideBetTarget: 'twenty-one-plus-three' }))).toEqual([2500, 10000]);
    expect(disabled(blackjackTableMarkup({ ...betting(), bet: 500 }, { sideBetTarget: 'twenty-one-plus-three' }))).toEqual([100, 500, 2500, 10000]);
    expect(disabled(blackjackTableMarkup({ ...betting(), balance: 2100 }, { sideBetTarget: 'main' }))).toEqual([100, 500, 2500, 10000]);
    expect(disabled(blackjackTableMarkup({ ...betting(), balance: 2150 }, { sideBetTarget: 'main' }))).toEqual([500, 2500, 10000]);
  });
});
describe('what screen readers hear', () => {
  it('names each finished seat with its totals, and nothing before anyone has played', () => {
    expect(seatsPlayed(SAMPLE_FULL_TABLE.betting())).toBe('');
    expect(seatsPlayed(SAMPLE_FULL_TABLE.others())).toBe('Played: Dana 21, Marcus 13, Priya 21 blackjack.');
    expect(seatsPlayed(SAMPLE_FULL_TABLE.settled())).toContain('Lou 21 and 17');
    expect(otherSeatsMarkup(SAMPLE_FULL_TABLE.others())).toContain('<p class="sr-only" role="status" data-testid="blackjack-seats-played">Played: Dana 21');
  });
});
describe('paced dealing controls', () => {
  it('offers Show all while cards are coming, and puts extra toolbar controls before Leave table', () => {
    const html = blackjackTableMarkup(SAMPLE_BLACKJACK.player(), { waitingFor: 'Dealing', skipReveal: true, toolbarExtra: '<label id="x">Pace</label>' });
    expect(html).toContain('<h2>Dealing</h2>'); expect(html).toContain('id="bj-skip"'); expect(html).not.toContain('id="bj-hint"');
    expect(html.indexOf('id="x"')).toBeLessThan(html.indexOf('id="bj-leave"')); expect(blackjackTableMarkup(SAMPLE_BLACKJACK.player())).not.toContain('id="bj-skip"');
  });
  it('asks for a dealer pace only when other players are seated', () => {
    expect(fullTableSetupMarkup({ heroSeat: 7, others: 0, pace: 'casino' })).not.toContain('data-blackjack-pace');
    expect(fullTableSetupMarkup({ heroSeat: 7, others: 2, pace: 'fast' })).toContain('data-blackjack-pace="fast" aria-pressed="true"');
  });
});
