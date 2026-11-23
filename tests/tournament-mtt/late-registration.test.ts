import { describe, expect, it } from 'vitest';
import { applyCommand, observeBot } from '../../src/core/engine';
import { checkMtt, closeRegistrationPlaces, createMtt, heroTable, playerAt, playOtherTables, seatDecision, settleRound } from '../../src/tournament/multi-table';
import { ARCHETYPES, createProfile, seedStream } from '../../src/bots/profiles';
import { chooseTournamentDecision, TOURNAMENT_BOT_POLICY_VERSION } from '../../src/tournament/bot-policy';
import { blindSchedule, EVENT_PRESETS, payoutLadder } from '../../src/tournament/presets';
import { createMttEvent, lateReserve, reEntryChance, LATE_REG_LEVELS, MAX_ENTRIES_PER_PERSON } from '../../src/tournament/mtt-event';
import type { BotProfile } from '../../src/contracts';

/* Patch 43: late registration and re-entry in multi-table events (spec T09, T12). */
function deps(seed: number) { let s = seed >>> 0; const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; }; let id = 0; return { random: (n: number) => next() % n, handId: () => `lr-${seed}-${++id}`, token: () => next() }; }
const preset = EVENT_PRESETS.find(p => p.id === 'daily-125')!;
const person = (n: string) => n.replace(/ \(\d+\)$/, '');

function run(entrants: number, seed: number, closesAfterRound = 12) {
  const d = deps(seed), names = Array.from({ length: entrants }, (_, i) => i === 0 ? 'You' : `Player ${i}`);
  const reserve = lateReserve(names, closesAfterRound, d.random);
  const state = createMtt({ entrants, startingStack: preset.startingStack, levels: blindSchedule(preset), handsPerLevel: 3, ladder: payoutLadder(preset.buyIn * entrants, entrants), names, registration: { closesAfterRound, maxEntriesPerPerson: 2, reserve } }, d);
  const profiles: Record<number, BotProfile> = {}; for (let p = 0; p < entrants; p++) profiles[p] = createProfile({ selection: ARCHETYPES[(p + 1) % ARCHETYPES.length] }, d.token(), 'neutral');
  const chips: number[] = [], hooks = { reEnters: (p: number) => d.random(1000) < 1000 * reEntryChance(profiles[p]), ladderFor: (n: number) => payoutLadder(preset.buyIn * n, n) };
  let guard = 0;
  while (state.status !== 'complete' && guard++ < 3000) {
    const table = state.status === 'running' ? heroTable(state) : null;
    if (table) { let game = table.game; const token = d.token();
      while (game.street !== 'complete') game = applyCommand(game, playerAt(table, game.actor!) === 0 ? chooseTournamentDecision(observeBot(game, game.actor!, profiles[0].policyVersion, `h:${game.handId}:${game.revision}`), profiles[0], seedStream((token ^ game.revision) >>> 0), TOURNAMENT_BOT_POLICY_VERSION) : seatDecision(game, table, profiles, token, TOURNAMENT_BOT_POLICY_VERSION));
      table.game = game; }
    playOtherTables(state, profiles, TOURNAMENT_BOT_POLICY_VERSION, d);
    settleRound(state, d, hooks);
    for (const e of state.registration!.entries) if (!profiles[e.player]) profiles[e.player] = e.kind === 're-entry' ? structuredClone(profiles[e.parent!]) : createProfile({ selection: 'random' }, d.token(), 'neutral');
    if (String(state.status) !== 'complete') { checkMtt(state); chips.push(state.players.reduce((s, p) => s + p.stack, 0)); }
  }
  return { state, chips, reserve };
}

describe('late registration and re-entry', () => {
  const events = [run(27, 11), run(36, 29), run(45, 47)];
  it('grows the field while registration is open, then closes it', () => {
    for (const { state, reserve } of events) {
      const reg = state.registration!;
      expect(state.status).toBe('complete');
      expect(reg.entries.filter(e => e.kind === 'late').length).toBe(reserve.length);
      expect(state.players.length).toBe(state.entrants + reg.entries.filter(e => e.kind !== 'initial').length);
      for (const e of reg.entries.filter(e => e.kind !== 'initial')) expect(e.round).toBeLessThanOrEqual(reg.closesAfterRound + 1);
    }
  });
  it('sees knocked-out regulars buy back in', () => {
    expect(events.reduce((n, { state }) => n + state.registration!.entries.filter(e => e.kind === 're-entry').length, 0)).toBeGreaterThan(0);
  });
  it('keeps every chip: the total is always one starting stack per entry so far', () => {
    for (const { state, chips } of events) {
      chips.forEach((total, i) => { const entered = state.registration!.entries.filter(e => e.round <= i + 2).length; expect(total).toBe(entered * state.startingStack); });
    }
  });
  it('limits entries per person, never re-enters Hero, and re-enters only after a knockout', () => {
    for (const { state } of events) {
      const reg = state.registration!, counts = new Map<string, number>();
      for (const e of reg.entries) counts.set(person(e.name), (counts.get(person(e.name)) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
      expect(counts.get('You')).toBe(1);
      for (const e of reg.entries.filter(e => e.kind === 're-entry')) {
        const out = reg.out.find(o => o.player === e.parent)!; expect(out.round).toBe(e.round - 1);
        expect(person(state.players[e.player].name)).toBe(person(state.players[e.parent!].name));
      }
    }
  });
  it('places everyone once, defers early knockouts to the close, and pays the grown prize pool', () => {
    for (const { state } of events) {
      const n = state.players.length, places = state.finishes.map(f => f.place).sort((a, b) => a - b);
      expect(state.finishes).toHaveLength(n); expect(new Set(state.finishes.map(f => f.player)).size).toBe(n);
      expect(places[0]).toBe(1); expect(places.at(-1)!).toBeLessThanOrEqual(n);
      expect(state.ladder).toEqual(payoutLadder(preset.buyIn * n, n));
      expect(state.finishes.reduce((s, f) => s + f.prize, 0)).toBe(preset.buyIn * n);
      const reg = state.registration!, early = state.finishes.filter(f => reg.out.some(o => o.player === f.player));
      const later = state.finishes.filter(f => !reg.out.some(o => o.player === f.player));
      if (!early.length) continue;
      expect(Math.max(...early.map(f => f.place))).toBe(n);
      expect(Math.min(...early.map(f => f.place))).toBeGreaterThan(Math.max(...later.map(f => f.place)));
    }
  });
  it('orders deferred places by round: a later knockout finishes higher', () => {
    const out = [{ player: 3, start: 100, round: 1 }, { player: 4, start: 100, round: 2 }, { player: 5, start: 300, round: 2 }];
    const f = closeRegistrationPlaces(out, 10, payoutLadder(1000, 13), Array.from({ length: 13 }, (_, i) => `P${i}`));
    expect(f.map(r => [r.player, r.place])).toEqual([[5, 11], [4, 12], [3, 13]]);
  });
  it('re-entry chance follows the player: gamblers come back more than disciplined regulars', () => {
    const loose = createProfile({ selection: 'maniac' }, 1, 'neutral'), tight = createProfile({ selection: 'nit' }, 1, 'neutral');
    expect(reEntryChance(loose)).toBeGreaterThan(reEntryChance(tight));
    expect(MAX_ENTRIES_PER_PERSON).toBe(2); expect(LATE_REG_LEVELS).toBe(4);
  });
  it('leaves events created without late registration exactly as before', () => {
    const a = createMttEvent({ id: 'e', preset, entrants: 27, pace: 'fast', startedAt: 't' }, deps(5));
    expect(a.mtt!.state.registration).toBeUndefined();
    const b = createMttEvent({ id: 'e', preset, entrants: 27, pace: 'fast', startedAt: 't', lateRegistration: true }, deps(5));
    expect(b.mtt!.state.registration!.reserve.length).toBe(Math.round(27 * .12));
    expect(b.mtt!.state.players.map(p => p.name)).toEqual(a.mtt!.state.players.map(p => p.name));
  });
});

describe('late registration on screen', () => {
  it('tells the player registration is open, how long for and what happens to early knockouts', async () => {
    const { tournamentBannerMarkup, levelStripMarkup } = await import('../../src/tournament/screens');
    const { mttTournamentView } = await import('../../src/tournament/mtt-event');
    const e = createMttEvent({ id: 'e', preset, entrants: 27, pace: 'fast', startedAt: 't', lateRegistration: true }, deps(9));
    const view = mttTournamentView(e);
    expect(view.registration).toMatchObject({ open: true, closesAfterLevel: 4, entries: 27, reEntries: 0, late: 0, heroReEntry: { available: false, pending: false, used: 0 } });
    expect(tournamentBannerMarkup(view)).toContain('Late registration and re-entry are open through level 4');
    expect(levelStripMarkup(view)).toContain('late reg to level 4');
    const plain = mttTournamentView(createMttEvent({ id: 'e', preset, entrants: 27, pace: 'fast', startedAt: 't' }, deps(9)));
    expect(plain.registration).toBeUndefined(); expect(tournamentBannerMarkup(plain)).not.toContain('Late registration');
  });
});
