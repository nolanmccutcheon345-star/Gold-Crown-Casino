import type {Archetype, PopulationPreset} from '../contracts';
import {ARCHETYPES, POPULATION_WEIGHTS} from './profiles';

/**
 * Population benchmark TARGET bands.
 *
 * These bands are TARGETS drawn from public poker knowledge (published pool
 * tendency summaries, training-site pool reports and widely cited public
 * ranges). They are NOT measured human data: no hand histories were collected,
 * fitted or claimed here, and no band is a precise citation of any single
 * study. They exist so the synthetic bot population can be compared against
 * defensible public expectations of how real pools tend to play, and so gaps
 * can be discussed honestly (see DEFECTS.csv BOT-004: uncalibrated population
 * realism remains open). A simulated rate inside a band means "consistent with
 * public pool tendencies", never "calibrated to humans".
 *
 * All rates are percents on a 0–100 scale, using the metric definitions in
 * tests/step4c/audit.ts (DEFINITIONS). Note those definitions are per
 * hand/player opportunity as implemented by the audit counters, which is the
 * same convention the population reporter uses.
 */

export type Venue = 'live' | 'online';
export type PoolEnvironmentKey = 'live-low' | 'live-mid' | 'online-low' | 'online-mid' | 'online-high';

export interface PoolEnvironment {
  preset: PopulationPreset;
  venue: Venue;
  /** Seats at the table: live games are modelled full-ring, online 6-max. */
  seats: number;
}

export const POOL_ENVIRONMENTS: Readonly<Record<PoolEnvironmentKey, PoolEnvironment>> = Object.freeze({
  'live-low': Object.freeze({preset: 'low', venue: 'live', seats: 9}),
  'live-mid': Object.freeze({preset: 'mid', venue: 'live', seats: 9}),
  'online-low': Object.freeze({preset: 'low', venue: 'online', seats: 6}),
  'online-mid': Object.freeze({preset: 'mid', venue: 'online', seats: 6}),
  'online-high': Object.freeze({preset: 'high', venue: 'online', seats: 6}),
});

export const POOL_ENVIRONMENT_KEYS: readonly PoolEnvironmentKey[] = Object.freeze(
  Object.keys(POOL_ENVIRONMENTS) as PoolEnvironmentKey[],
);

/** Metrics compared against bands by the population reporter. */
export const BENCHMARK_METRICS = Object.freeze([
  'vpip', 'pfr', 'threeBet', 'foldToThreeBet', 'limp', 'flopCbet', 'foldToCbet', 'WTSD', 'WWSF',
] as const);
export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number];

export interface BenchmarkBand {
  /** Inclusive lower bound, percent (0–100). */
  min: number;
  /** Inclusive upper bound, percent (0–100). */
  max: number;
  /** Kind of public source the band reflects. Deliberately not a precise citation. */
  basis: string;
}

const ONLINE_BASIS =
  'Published online pool database analyses (PokerTracker-style pool reports) and public training-site pool tendency summaries';
const LIVE_BASIS =
  'Published live-game pool observations and public training-site live full-ring tendency summaries';
const ONLINE_HIGH_BASIS =
  'Published online pool database analyses (PokerTracker-style pool reports) for tougher mid/high-stakes pools and public training-site summaries';

const band = (min: number, max: number, basis: string): BenchmarkBand => Object.freeze({min, max, basis});

/**
 * Target bands per environment and metric, in percent.
 *
 * Direction of the adjustments, per widely published pool tendencies:
 * - Live pools play looser and more passively than online pools at comparable
 *   stakes: higher VPIP and limp, lower PFR and 3-bet.
 * - Online pools are tighter and more aggressive; 6-max geometry also raises
 *   VPIP/PFR relative to full-ring at the same skill level.
 * - Higher stakes are tighter and more aggressive at every venue: VPIP and
 *   limp fall, PFR and 3-bet rise.
 */
export const BENCHMARK_BANDS: Readonly<Record<PoolEnvironmentKey, Readonly<Record<BenchmarkMetric, BenchmarkBand>>>> = Object.freeze({
  'live-low': Object.freeze({
    vpip: band(30, 42, LIVE_BASIS),
    pfr: band(8, 15, LIVE_BASIS),
    threeBet: band(2, 5, LIVE_BASIS),
    foldToThreeBet: band(45, 65, LIVE_BASIS),
    limp: band(14, 26, LIVE_BASIS),
    flopCbet: band(40, 58, LIVE_BASIS),
    foldToCbet: band(38, 52, LIVE_BASIS),
    WTSD: band(28, 36, LIVE_BASIS),
    WWSF: band(40, 46, LIVE_BASIS),
  }),
  'live-mid': Object.freeze({
    vpip: band(26, 36, LIVE_BASIS),
    pfr: band(10, 17, LIVE_BASIS),
    threeBet: band(3, 6, LIVE_BASIS),
    foldToThreeBet: band(48, 66, LIVE_BASIS),
    limp: band(9, 20, LIVE_BASIS),
    flopCbet: band(42, 60, LIVE_BASIS),
    foldToCbet: band(40, 54, LIVE_BASIS),
    WTSD: band(27, 34, LIVE_BASIS),
    WWSF: band(41, 47, LIVE_BASIS),
  }),
  'online-low': Object.freeze({
    vpip: band(24, 29, ONLINE_BASIS),
    pfr: band(19, 23, ONLINE_BASIS),
    threeBet: band(7, 10, ONLINE_BASIS),
    foldToThreeBet: band(55, 70, ONLINE_BASIS),
    limp: band(2, 8, ONLINE_BASIS),
    flopCbet: band(50, 65, ONLINE_BASIS),
    foldToCbet: band(45, 58, ONLINE_BASIS),
    WTSD: band(27, 33, ONLINE_BASIS),
    WWSF: band(43, 48, ONLINE_BASIS),
  }),
  'online-mid': Object.freeze({
    vpip: band(22, 27, ONLINE_BASIS),
    pfr: band(18, 23, ONLINE_BASIS),
    threeBet: band(7, 11, ONLINE_BASIS),
    foldToThreeBet: band(52, 66, ONLINE_BASIS),
    limp: band(1, 6, ONLINE_BASIS),
    flopCbet: band(52, 66, ONLINE_BASIS),
    foldToCbet: band(44, 57, ONLINE_BASIS),
    WTSD: band(27, 32, ONLINE_BASIS),
    WWSF: band(44, 49, ONLINE_BASIS),
  }),
  'online-high': Object.freeze({
    vpip: band(20, 25, ONLINE_HIGH_BASIS),
    pfr: band(17, 22, ONLINE_HIGH_BASIS),
    threeBet: band(8, 12, ONLINE_HIGH_BASIS),
    foldToThreeBet: band(50, 64, ONLINE_HIGH_BASIS),
    limp: band(0, 4, ONLINE_HIGH_BASIS),
    flopCbet: band(52, 68, ONLINE_HIGH_BASIS),
    foldToCbet: band(42, 56, ONLINE_HIGH_BASIS),
    WTSD: band(26, 32, ONLINE_HIGH_BASIS),
    WWSF: band(44, 50, ONLINE_HIGH_BASIS),
  }),
});

/**
 * Live-venue flavour adjustment, applied as per-archetype multipliers on the
 * preset's population weights before renormalisation. Rationale (public pool
 * knowledge, not measurement): live low/mid-stakes pools contain proportionally
 * more loose-passive recreational players (station, passive-reg, fit-or-fold)
 * and proportionally fewer studied regulars (stronger-reg, lag, tag) than the
 * online pools the base POPULATION_WEIGHTS describe.
 */
export const LIVE_FLAVOR_MULTIPLIERS: Readonly<Record<Archetype, number>> = Object.freeze({
  nit: 1.05,
  station: 2.2,
  tag: 0.62,
  lag: 0.5,
  'fit-or-fold': 1.35,
  maniac: 1.1,
  'passive-reg': 2.05,
  'stronger-reg': 0.3,
});

/**
 * Archetype weights for a population preset in a venue, as a record keyed by
 * archetype, normalised to sum 1. Online returns POPULATION_WEIGHTS[preset]
 * unchanged; live applies LIVE_FLAVOR_MULTIPLIERS and renormalises.
 */
export function flavorWeights(preset: PopulationPreset, venue: Venue): Record<Archetype, number> {
  const base = POPULATION_WEIGHTS[preset];
  const out = {} as Record<Archetype, number>;
  if (venue === 'online') {
    ARCHETYPES.forEach((archetype, i) => { out[archetype] = base[i]; });
    return out;
  }
  let total = 0;
  ARCHETYPES.forEach((archetype, i) => {
    out[archetype] = base[i] * LIVE_FLAVOR_MULTIPLIERS[archetype];
    total += out[archetype];
  });
  for (const archetype of ARCHETYPES) out[archetype] /= total;
  return out;
}

/** Convenience wrapper: venue defaults to 'online' (base weights unchanged). */
export function weightsFor(preset: PopulationPreset, venue: Venue = 'online'): Record<Archetype, number> {
  return flavorWeights(preset, venue);
}

/** Weights as an array in ARCHETYPES order, for createProfile's override parameter. */
export function weightsArrayFor(preset: PopulationPreset, venue: Venue = 'online'): readonly number[] {
  const record = flavorWeights(preset, venue);
  return ARCHETYPES.map((archetype) => record[archetype]);
}

/** Verdict for one measured rate (percent) against its target band. */
export function bandVerdict(percent: number | null, bandEntry: BenchmarkBand): 'PASS' | 'OUT' | 'NO-DATA' {
  if (percent === null) return 'NO-DATA';
  return percent >= bandEntry.min && percent <= bandEntry.max ? 'PASS' : 'OUT';
}

/** Direction of a miss: 'below' the band, 'above' it, or null when in band / no data. */
export function bandDirection(percent: number | null, bandEntry: BenchmarkBand): 'below' | 'above' | null {
  if (percent === null || (percent >= bandEntry.min && percent <= bandEntry.max)) return null;
  return percent < bandEntry.min ? 'below' : 'above';
}
