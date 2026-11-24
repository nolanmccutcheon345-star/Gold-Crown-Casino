/**
 * Population reporter (Phase 5, workstream 6B).
 *
 * For each POOL_ENVIRONMENT, simulates seeded 25-hand session blocks whose
 * lineups are drawn from flavorWeights(preset, venue), aggregates the audit
 * counters overall and per archetype, computes block-clustered rates, and
 * compares the benchmark metrics against BENCHMARK_BANDS (TARGET bands from
 * public poker knowledge — never measured human data; see
 * src/bots/POPULATION_BENCHMARKS.md and DEFECTS.csv BOT-004).
 *
 * The block loop is modelled on tests/step5a-release/population.ts
 * sessionBlock: persistent stacks, public memory and dealer within a block,
 * engine top-ups from an explicit simulation wallet, and the same
 * wallet/table/rake conservation assertion.
 *
 * Usage: npx tsx scripts/step5-population-report.ts [--blocks N]
 *        [--seed-base N] [--out path.json] [--label text] [--env key]
 */
import {writeFileSync} from 'node:fs';
import type {Archetype, BotProfile, GameState, OpponentConfig, PublicMemoryHand} from '../src/contracts';
import {createProfile, POLICY_VERSION} from '../src/bots/policy';
import {ARCHETYPES} from '../src/bots/profiles';
import {
  BENCHMARK_BANDS, BENCHMARK_METRICS, POOL_ENVIRONMENTS, POOL_ENVIRONMENT_KEYS,
  bandDirection, bandVerdict, flavorWeights, type PoolEnvironmentKey,
} from '../src/bots/population-benchmarks';
import {nextHand, startHand, topUpTable, assertAccounting} from '../src/core/engine';
import {rig, practiceProfile} from '../tests/verification/helpers';
import {runHand} from '../tests/step4c/population';
import {clusteredRate, rng, DEFINITIONS, type Counters} from '../tests/step4c/audit';

const HANDS_PER_BLOCK = 25;
const STARTING_BB = 100;
const REFILL_BELOW_BB = 40;
const REFILL_TO_BB = 100;
const EXTERNAL_WALLET_BB = 10000;
const SMALL_BLIND = 100;
const BIG_BLIND = 200;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const blocksPerEnv = Number(arg('blocks') ?? 8);
const seedBase = Number(arg('seed-base') ?? 0x5b000000);
const label = arg('label') ?? 'population-report';
const outPath = arg('out');
const envFilter = arg('env') as PoolEnvironmentKey | undefined;
if (!Number.isInteger(blocksPerEnv) || blocksPerEnv < 1) throw Error('--blocks must be a positive integer');
if (!Number.isInteger(seedBase) || seedBase < 0) throw Error('--seed-base must be a non-negative integer');
if (envFilter && !POOL_ENVIRONMENT_KEYS.includes(envFilter)) throw Error(`Unknown --env ${envFilter}`);
const envKeys = envFilter ? [envFilter] : [...POOL_ENVIRONMENT_KEYS];

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

interface BlockResult {
  metrics: Counters;
  archetypes: Record<string, Counters>;
  hands: number;
  lineup: Archetype[];
  skills: number[];
}

/** One 25-hand session block: lineup drawn from the environment flavour weights. */
function populationBlock(envKey: PoolEnvironmentKey, block: number, seed: number): BlockResult {
  const env = POOL_ENVIRONMENTS[envKey];
  const weights = flavorWeights(env.preset, env.venue);
  const draw = rng(seed ^ 0x11fe1a);
  const lineup: Archetype[] = [];
  const skills: number[] = [];
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
    // Archetype preset skill = the skill createProfile assigns by default,
    // jittered by a seeded ±0.15 and clamped, then passed explicitly.
    const baseSkill = createProfile({selection: archetype} satisfies OpponentConfig, profileSeed, env.preset).skill ?? 0.5;
    const skill = clampSkill(baseSkill + (draw() - 0.5) * 0.3);
    lineup.push(archetype);
    skills.push(skill);
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
    handId: `pop:${envKey}:${block}:0`,
    button: block % env.seats,
    profile,
    seats: profiles.map((_, id) => ({id, name: `Stable ${id}`, stack: STARTING_BB * BIG_BLIND})),
  });
  const out: BlockResult = {metrics: {}, archetypes: {}, hands: 0, lineup, skills};
  const history: PublicMemoryHand[] = [];
  const stable = JSON.stringify(profiles);
  for (let hand = 0; hand < HANDS_PER_BLOCK; hand++) {
    game = deal(game, seed + hand);
    const result = runHand(game, profiles, seed + hand, history);
    game = result.game;
    if (game.street !== 'complete') throw Error('Stalled simulation hand');
    if (JSON.stringify(profiles) !== stable) throw Error('Profile mutation');
    history.push(memory(game));
    out.hands++;
    rake += game.rake;
    for (const [id, m] of result.metrics) {
      add(out.metrics, m);
      out.archetypes[profiles[id].archetype] ??= {};
      add(out.archetypes[profiles[id].archetype], m);
    }
    if (hand < HANDS_PER_BLOCK - 1) {
      for (const seat of game.seats) {
        if (seat.stack < REFILL_BELOW_BB * BIG_BLIND) {
          const amount = REFILL_TO_BB * BIG_BLIND - seat.stack;
          const id = `pop-transfer:${envKey}:${block}:${hand}:${seat.id}`;
          if (wallet < amount) throw Error('Simulation wallet exhausted');
          game = topUpTable(game, seat.id, amount, id, REFILL_TO_BB * BIG_BLIND);
          wallet -= amount;
        }
      }
    }
    assertAccounting(game);
    const table = game.seats.reduce((n, s) => n + s.stack, 0);
    if (wallet + table + rake !== initialWallet + initialTable) throw Error('Population block wallet/table/rake conservation failed');
    if (hand < HANDS_PER_BLOCK - 1) game = nextHand(game, `pop:${envKey}:${block}:${hand + 1}`);
  }
  return out;
}

function ratesFor(blocks: BlockResult[], pick: (b: BlockResult) => Counters) {
  const metrics = [...new Set(blocks.flatMap(b => Object.keys(pick(b))))].sort();
  return Object.fromEntries(metrics.map(m => [m, clusteredRate(blocks.map(b => pick(b)[m] ?? {count: 0, opportunities: 0}))]));
}

const startedAt = Date.now();
const report: Record<string, unknown> = {
  label,
  generatedAt: new Date().toISOString(),
  policyVersion: POLICY_VERSION,
  seedBase,
  blocksPerEnvironment: blocksPerEnv,
  handsPerBlock: HANDS_PER_BLOCK,
  honesty: 'Simulated rates compared against TARGET bands from public poker knowledge (src/bots/POPULATION_BENCHMARKS.md). Not measured human data; not calibration. See DEFECTS.csv BOT-004.',
  definitions: Object.fromEntries(BENCHMARK_METRICS.map(m => [m, DEFINITIONS[m]])),
  environments: {} as Record<string, unknown>,
};
const environments = report.environments as Record<string, unknown>;

console.log(`Population report "${label}" — ${blocksPerEnv} blocks x ${HANDS_PER_BLOCK} hands per environment, seed base ${seedBase}`);
for (const envKey of envKeys) {
  const env = POOL_ENVIRONMENTS[envKey];
  const envIndex = POOL_ENVIRONMENT_KEYS.indexOf(envKey);
  const envStarted = Date.now();
  const blocks: BlockResult[] = [];
  for (let b = 0; b < blocksPerEnv; b++) blocks.push(populationBlock(envKey, b, seedBase + envIndex * 1_000_000 + b * 10_000));
  const overall = ratesFor(blocks, b => b.metrics);
  const perArchetype: Record<string, unknown> = {};
  for (const archetype of ARCHETYPES) {
    if (blocks.some(b => b.archetypes[archetype])) perArchetype[archetype] = ratesFor(blocks, b => b.archetypes[archetype] ?? {});
  }
  const benchmark = Object.fromEntries(BENCHMARK_METRICS.map(m => {
    const rate = overall[m];
    const bandEntry = BENCHMARK_BANDS[envKey][m];
    return [m, {
      percent: rate?.percent ?? null,
      count: rate?.count ?? 0,
      opportunities: rate?.opportunities ?? 0,
      band: {min: bandEntry.min, max: bandEntry.max},
      verdict: bandVerdict(rate?.percent ?? null, bandEntry),
      direction: bandDirection(rate?.percent ?? null, bandEntry),
    }];
  }));
  const hands = blocks.reduce((n, b) => n + b.hands, 0);
  environments[envKey] = {
    environment: env,
    weights: flavorWeights(env.preset, env.venue),
    blocks: blocks.length,
    hands,
    lineups: blocks.map(b => ({lineup: b.lineup, skills: b.skills.map(s => Number(s.toFixed(3)))})),
    rates: overall,
    perArchetype,
    benchmark,
  };
  const seconds = ((Date.now() - envStarted) / 1000).toFixed(1);
  console.log(`\n== ${envKey} (preset ${env.preset}, ${env.venue}, ${env.seats} seats) — ${hands} hands in ${seconds}s ==`);
  console.log('metric           rate%      opps   band        verdict');
  for (const m of BENCHMARK_METRICS) {
    const row = benchmark[m];
    const rateText = row.percent === null ? '     —' : row.percent.toFixed(1).padStart(6);
    const verdictText = row.verdict === 'OUT' ? `OUT (${row.direction})` : row.verdict;
    console.log(`${m.padEnd(16)} ${rateText} ${String(row.opportunities).padStart(8)}   ${`${row.band.min}–${row.band.max}`.padEnd(10)}  ${verdictText}`);
  }
}
console.log(`\nTotal elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
if (outPath) {
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
}
