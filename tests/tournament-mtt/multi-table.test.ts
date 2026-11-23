import { describe, expect, it } from 'vitest';
import { applyCommand, nextTournamentTableHand, observeBot, replayTournamentHand, startTournamentTableHand } from '../../src/core/engine';
import { checkMtt, createMtt, heroTable, playerAt, mttProfile, mttSummary, playOtherTables, seatDecision, settleRound, TABLE_SIZE, tablesFor, type MttHandRecord, type MttState } from '../../src/tournament/multi-table';
import { ARCHETYPES, createProfile, seedStream } from '../../src/bots/profiles';
import { chooseTournamentDecision, TOURNAMENT_BOT_POLICY_VERSION } from '../../src/tournament/bot-policy';
import { blindSchedule, EVENT_PRESETS, payoutLadder } from '../../src/tournament/presets';
import type { BotProfile } from '../../src/contracts';

function deps(seed: number) { let s = seed >>> 0; const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; let id = 0; return { random: (n: number) => next() % n, handId: () => `mtt-${seed}-${++id}`, token: () => next() }; }
const preset = EVENT_PRESETS.find(p => p.id === 'daily-125')!;
function event(entrants: number, seed: number) {
  const d = deps(seed), names = Array.from({ length: entrants }, (_, i) => i === 0 ? 'You' : `Player ${i}`);
  const state = createMtt({ entrants, startingStack: preset.startingStack, levels: blindSchedule(preset), handsPerLevel: 4, ladder: payoutLadder(preset.buyIn * entrants, entrants), names }, d);
  const profiles: Record<number, BotProfile> = {}; for (let p = 0; p < entrants; p++) profiles[p] = createProfile({ selection: ARCHETYPES[(p + 1) % ARCHETYPES.length] }, d.token(), 'neutral');
  return { state, profiles, d };
}
/** Hero plays like a computer player, so whole events run without a person. */
function playHeroTable(state: MttState, profiles: Record<number, BotProfile>, token: number): MttHandRecord | null {
  const table = state.status === 'running' ? heroTable(state) : null; if (!table) return null;
  let game = table.game;
  while (game.street !== 'complete') {
    if (playerAt(table, game.actor!) === 0) game = applyCommand(game, chooseTournamentDecision(observeBot(game, game.actor!, profiles[0].policyVersion, `hero:${game.handId}:${game.revision}`), profiles[0], seedStream((token ^ game.revision) >>> 0), TOURNAMENT_BOT_POLICY_VERSION));
    else game = applyCommand(game, seatDecision(game, table, profiles, token, TOURNAMENT_BOT_POLICY_VERSION));
  }
  table.game = game; return { round: state.round, table: table.number, token, state: game };
}

describe('engine: tables whose players change', () => {
  const profile = mttProfile({ levels: blindSchedule(preset), handsPerLevel: 4 }, 1), seats = [1, 4, 6].map(id => ({ id, name: `S${id}`, stack: 20000 }));
  it('deals the first hand at a nine-seat table whatever seats are occupied', () => {
    const game = startTournamentTableHand({ handId: 'a', profile, button: 4, seats }, 9);
    expect(game.tournamentSeatCount).toBe(9); expect([game.button, game.smallBlindSeat, game.bigBlindSeat]).toEqual([4, 6, 1]);
    expect(() => startTournamentTableHand({ handId: 'b', profile, button: 5, seats }, 9)).toThrow(); expect(() => startTournamentTableHand({ handId: 'c', profile, button: 1, seats: [{ id: 9, name: 'X', stack: 1 }, ...seats] }, 9)).toThrow();
  });
  it('moves the blinds on over the seats now occupied, a newcomer included', () => {
    let game = startTournamentTableHand({ handId: 'a', profile, button: 4, seats }, 9);
    while (game.street !== 'complete') game = applyCommand(game, { handId: game.handId, revision: game.revision, seatId: game.actor!, decisionId: `f${game.revision}`, action: { type: 'fold' } });
    const now = game.seats.map(s => ({ id: s.id, name: s.name, stack: s.stack }));
    // Seat 1 posted the big blind; a newcomer sits in seat 8. Next: big blind seat 4, small blind seat 1, button seat 6.
    const next = nextTournamentTableHand(game, 'b', profile, [...now, { id: 8, name: 'New', stack: 20000 }], 9);
    expect([next.button, next.smallBlindSeat, next.bigBlindSeat]).toEqual([6, 1, 4]); expect(next.seats.map(s => s.id)).toEqual([1, 4, 6, 8]);
    // Seat 4 leaves instead: the big blind passes to seat 6.
    const after = nextTournamentTableHand(game, 'c', profile, now.filter(s => s.id !== 4), 9);
    expect(after.bigBlindSeat).toBe(6); expect(after.smallBlindSeat).toBe(1);
    expect(() => nextTournamentTableHand(game, 'd', profile, [{ id: 9, name: 'X', stack: 5 }, ...now], 9)).toThrow();
  });
});

describe('opening draw', () => {
  it.each([18, 27, 45, 90, 100])('%i players: fewest tables, sizes within one, every seat unique', entrants => {
    const { state } = event(entrants, entrants);
    expect(state.tables).toHaveLength(tablesFor(entrants)); checkMtt(state);
    const sizes = state.tables.map(t => t.seats.filter(p => p !== null).length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(entrants); expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(state.tables.every(t => t.game.tournamentSeatCount === TABLE_SIZE && t.game.street === 'preflop')).toBe(true);
  });
  it('rejects fields that fit one table', () => { expect(() => event(9, 1)).toThrow(); });
});

describe('a whole event', () => {
  for (const [entrants, seed] of [[18, 11], [27, 12]] as const) it(`${entrants} players, every round checked, every hand replayed`, () => {
    const { state, profiles, d } = event(entrants, seed), records: MttHandRecord[] = [];
    let rounds = 0, finalTableAt = 0;
    while (state.status !== 'complete') {
      const tablesBefore = state.tables.length;
      const hero = playHeroTable(state, profiles, d.token()); if (hero) records.push(hero);
      records.push(...playOtherTables(state, profiles, TOURNAMENT_BOT_POLICY_VERSION, d));
      expect(state.tables.every(t => t.game.street === 'complete')).toBe(true);
      const moves = settleRound(state, d); rounds++; checkMtt(state);
      for (const move of moves) expect((state.status as string) === 'complete' || state.players[move.player].table === move.to.table).toBe(true);
      if (tablesBefore > 1 && state.tables.length === 1 && (state.status as string) !== 'complete') { finalTableAt = rounds; expect(mttSummary(state).finalTable).toBe(true); expect(moves.every(m => m.reason === 'final-table')).toBe(true); }
      expect(rounds).toBeLessThan(1500);
    }
    expect(finalTableAt).toBeGreaterThan(0);
    const places = state.finishes.map(f => f.place).sort((a, b) => a - b);
    expect(state.finishes).toHaveLength(entrants); expect(places[0]).toBe(1); expect(state.finishes.filter(f => f.place === 1)).toHaveLength(1);
    expect(state.finishes.reduce((sum, f) => sum + f.prize, 0)).toBe(state.ladder.reduce((a, b) => a + b, 0));
    for (const f of state.finishes) if (f.ties === 1) expect(f.prize).toBe(state.ladder[f.place - 1] ?? 0);
    for (const record of records) expect(() => replayTournamentHand(record.state)).not.toThrow();
    expect(new Set(records.map(r => r.state.handId)).size).toBe(records.length);
  });
});
