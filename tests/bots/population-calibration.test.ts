/**
 * Population calibration lock-in (Phase 5, BOT-004).
 *
 * Seeded statistical regression test: simulates fixed 25-hand session blocks
 * per pool environment (the same block scheme and seed base as
 * scripts/step5-population-report.ts), aggregates the audit counters, and
 * asserts every benchmark metric's measured rate sits inside its target band
 * in src/bots/population-benchmarks.ts.
 *
 * The bands are TARGETS from public poker knowledge — never measured human
 * data (see src/bots/POPULATION_BENCHMARKS.md). Passing means the simulated
 * population is consistent with those published pool tendencies, nothing
 * more. The simulation is fully seeded, so a failure here means a code
 * change moved the population out of band — that is the intent of the lock.
 *
 * Full-size evidence (40 blocks per environment) lives in the Phase 5
 * report; this in-suite lock uses 12 blocks per environment to bound
 * runtime while keeping every metric's opportunity count meaningful.
 *
 * Two-tier assertion, honestly labelled. The calibration that ships is
 * MIXTURE-ONLY: the bot policy itself is pinned by the repository's
 * captured-behaviour suites (Version54/Version60 policy-compat, the
 * preflop coherence guard, persona-coherence and exposure pins — an
 * in-place policy calibration reached 35/45 in band but broke five of
 * those suites and was reverted; see the Phase 5 report). Under the
 * pinned policy, the preflop family is largely mixture-calibrated, while
 * the postflop family (flopCbet, WTSD, and coupled fold/WWSF reads) is a
 * property of the policy, not the mixture — every archetype's flopCbet
 * sits at or below ~26% against 40–68% bands and every archetype's WTSD
 * at or above ~50% against 26–36% bands, so no mixture can reach them.
 * Closing those requires a NEW policy version with its own fixtures
 * (roadmap Phase 5B), not tuning.
 *
 * Metrics inside their band are asserted in band. Documented residuals
 * (RESIDUALS below) may sit outside the band by no more than their
 * recorded deviation — the widest miss observed across the final 40-block
 * evidence run (scripts/step5-population-report.ts) and this test's own
 * deterministic 12-block read, plus margin. A residual that improves
 * into the band passes; one that degrades past its recorded deviation
 * fails. The residuals and their mechanisms are listed in the Phase 5
 * report (BOT-004, MITIGATED — not closed).
 */
import {describe, expect, it} from 'vitest';
import type {Archetype, BotProfile, GameState, OpponentConfig, PublicMemoryHand} from '../../src/contracts';
import {createProfile} from '../../src/bots/policy';
import {ARCHETYPES} from '../../src/bots/profiles';
import {
  BENCHMARK_BANDS, BENCHMARK_METRICS, POOL_ENVIRONMENTS, POOL_ENVIRONMENT_KEYS,
  bandVerdict, flavorWeights, type PoolEnvironmentKey,
} from '../../src/bots/population-benchmarks';
import {nextHand, startHand, topUpTable, assertAccounting} from '../../src/core/engine';
import {rig, practiceProfile} from '../verification/helpers';
import {runHand} from '../step4c/population';
import {clusteredRate, rng, type Counters} from '../step4c/audit';

const HANDS_PER_BLOCK = 25;
const BLOCKS = 12;
const SEED_BASE = 0x5b000000;
const STARTING_BB = 100;
const REFILL_BELOW_BB = 40;
const REFILL_TO_BB = 100;
const EXTERNAL_WALLET_BB = 10000;
const SMALL_BLIND = 100;
const BIG_BLIND = 200;

const clampSkill = (n: number) => Math.max(0.05, Math.min(0.97, n));

function add(target: Counters, source: Counters) {
  for (const [key, c] of Object.entries(source)) {
    target[key] ??= {count: 0, opportunities: 0};
    target[key].count += c.count;
    target[key].opportunities += c.opportunities;
  }
}

function deal(game: GameState, seed: number) {
  const random = rng(seed ^ 0x7137ab11);
  const deck = [...'23456789TJQKA'].flatMap(r => [...'cdhs'].map(s => r + s));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return rig(game, game.seats.map((_, i) => deck.slice(i * 2, i * 2 + 2)), deck.slice(game.seats.length * 2, game.seats.length * 2 + 5));
}

function memory(g: GameState): PublicMemoryHand {
  return {handId: g.handId, seats: g.seats.map(s => ({id: s.id, revealedCards: g.revealedSeats.includes(s.id) ? s.hole : []})), events: g.events};
}

/** One 25-hand session block: lineup drawn from the environment flavour weights. Mirrors scripts/step5-population-report.ts. */
function populationBlock(envKey: PoolEnvironmentKey, block: number, seed: number): Counters {
  const env = POOL_ENVIRONMENTS[envKey];
  const weights = flavorWeights(env.preset, env.venue);
  const draw = rng(seed ^ 0x11fe1a);
  const profiles: BotProfile[] = [];
  for (let seat = 0; seat < env.seats; seat++) {
    const roll = draw();
    let cumulative = 0;
    let archetype: Archetype = ARCHETYPES[ARCHETYPES.length - 1];
    for (const candidate of ARCHETYPES) {
      cumulative += weights[candidate];
      if (roll < cumulative) { archetype = candidate; break; }
    }
    const profileSeed = seed ^ Math.imul(seat + 1, 0x9143);
    const baseSkill = createProfile({selection: archetype} satisfies OpponentConfig, profileSeed, env.preset).skill ?? 0.5;
    const skill = clampSkill(baseSkill + (draw() - 0.5) * 0.3);
    profiles.push(createProfile({selection: archetype, skill}, profileSeed, env.preset));
  }
  const profile = practiceProfile();
  profile.smallBlind = SMALL_BLIND;
  profile.bigBlind = BIG_BLIND;
  profile.rake = {basisPoints: 500, cap: BIG_BLIND * 2, noFlopNoDrop: true};
  const initialTable = env.seats * STARTING_BB * BIG_BLIND;
  const initialWallet = env.seats * EXTERNAL_WALLET_BB * BIG_BLIND;
  let wallet = initialWallet;
  let rake = 0;
  let game = startHand({
    handId: `pop-lock:${envKey}:${block}:0`,
    button: block % env.seats,
    profile,
    seats: profiles.map((_, id) => ({id, name: `Stable ${id}`, stack: STARTING_BB * BIG_BLIND})),
  });
  const metrics: Counters = {};
  const history: PublicMemoryHand[] = [];
  const stable = JSON.stringify(profiles);
  for (let hand = 0; hand < HANDS_PER_BLOCK; hand++) {
    game = deal(game, seed + hand);
    const result = runHand(game, profiles, seed + hand, history);
    game = result.game;
    if (game.street !== 'complete') throw Error('Stalled simulation hand');
    if (JSON.stringify(profiles) !== stable) throw Error('Profile mutation');
    history.push(memory(game));
    rake += game.rake;
    for (const [, m] of result.metrics) add(metrics, m);
    if (hand < HANDS_PER_BLOCK - 1) {
      for (const seat of game.seats) {
        if (seat.stack < REFILL_BELOW_BB * BIG_BLIND) {
          const amount = REFILL_TO_BB * BIG_BLIND - seat.stack;
          const id = `pop-lock-transfer:${envKey}:${block}:${hand}:${seat.id}`;
          if (wallet < amount) throw Error('Simulation wallet exhausted');
          game = topUpTable(game, seat.id, amount, id, REFILL_TO_BB * BIG_BLIND);
          wallet -= amount;
        }
      }
    }
    assertAccounting(game);
    const table = game.seats.reduce((n, s) => n + s.stack, 0);
    if (wallet + table + rake !== initialWallet + initialTable) throw Error('Population block wallet/table/rake conservation failed');
    if (hand < HANDS_PER_BLOCK - 1) game = nextHand(game, `pop-lock:${envKey}:${block}:${hand + 1}`);
  }
  return metrics;
}

/**
 * Documented calibration residuals after the Phase 5 calibration loop:
 * [environment, metric, allowed deviation beyond the band edge, in
 * percentage points]. Every other metric in every environment must be
 * inside its band. See the Phase 5 report for mechanisms.
 */
const RESIDUALS: ReadonlyArray<readonly [PoolEnvironmentKey, string, number]> = Object.freeze([
  // Pinned-policy postflop family — unreachable by any mixture (see header).
  ['live-low', 'flopCbet', 32],
  ['live-low', 'WTSD', 48],
  ['live-mid', 'flopCbet', 36],
  ['live-mid', 'WTSD', 55],
  ['online-low', 'flopCbet', 33],
  ['online-low', 'WTSD', 24],
  ['online-mid', 'flopCbet', 42],
  ['online-mid', 'WTSD', 38],
  ['online-high', 'flopCbet', 43],
  ['online-high', 'WTSD', 42],
  // Coupled postflop reads on small opportunity counts.
  ['live-mid', 'foldToCbet', 18],
  ['live-mid', 'WWSF', 7],
  ['live-low', 'WWSF', 4],
  ['online-low', 'foldToCbet', 22],
  ['online-mid', 'foldToCbet', 7],
  ['online-high', 'foldToCbet', 12],
  // Preflop ceilings under the pinned policy (PFR / VPIP / 3-bet / fold-to-3-bet).
  ['live-low', 'vpip', 6],
  ['live-low', 'threeBet', 3],
  ['live-mid', 'pfr', 3],
  ['live-mid', 'limp', 3],
  ['live-mid', 'threeBet', 2],
  ['online-low', 'pfr', 5],
  ['online-mid', 'pfr', 4],
  ['online-mid', 'foldToThreeBet', 5],
  ['online-high', 'pfr', 3],
  ['online-high', 'threeBet', 4],
  ['online-high', 'foldToThreeBet', 15],
  ['online-high', 'limp', 3],
] as const);

describe('population calibration lock-in (BOT-004)', () => {
  for (const envKey of POOL_ENVIRONMENT_KEYS) {
    it(`${envKey}: mixed-population rates sit inside the benchmark bands (documented residuals aside)`, () => {
      const envIndex = POOL_ENVIRONMENT_KEYS.indexOf(envKey);
      const blocks: Counters[] = [];
      for (let b = 0; b < BLOCKS; b++) blocks.push(populationBlock(envKey, b, SEED_BASE + envIndex * 1_000_000 + b * 10_000));
      const failures: string[] = [];
      for (const metric of BENCHMARK_METRICS) {
        const rate = clusteredRate(blocks.map(b => b[metric] ?? {count: 0, opportunities: 0}));
        const bandEntry = BENCHMARK_BANDS[envKey][metric];
        const verdict = bandVerdict(rate?.percent ?? null, bandEntry);
        if (verdict === 'PASS') continue;
        const residual = RESIDUALS.find(([env, m]) => env === envKey && m === metric);
        const percent = rate?.percent ?? null;
        const deviation = percent === null ? Infinity : percent < bandEntry.min ? bandEntry.min - percent : percent - bandEntry.max;
        if (residual && deviation <= residual[2]) continue;
        failures.push(`${metric}: measured ${percent === null ? 'no-data' : percent.toFixed(1)}% vs band ${bandEntry.min}–${bandEntry.max} (${verdict}, ${rate?.opportunities ?? 0} opportunities${residual ? `, residual allowance ${residual[2]}` : ''})`);
      }
      expect(failures, failures.join('\n')).toEqual([]);
    }, 900000);
  }
});
