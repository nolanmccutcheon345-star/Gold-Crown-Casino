/**
 * Phase 14 (CB-U01): all-in equity between KNOWN hands — the equity a tabled
 * hand has against the other tabled hands, from the board as it stands.
 *
 * This module only ever receives hands that have been legitimately tabled
 * under the game's reveal rules (the view model's revealed seats). It has no
 * access to hidden cards, the deck order, or any game state, so it cannot leak
 * anything: callers pass exactly the cards every player at the table can see.
 *
 * Method: when the number of possible runouts is small (any board from the
 * flop on, heads-up or multiway) every runout is enumerated exactly. Before
 * the flop the runout space is C(48,5) ≈ 1.7M boards, too many for a live
 * render with this evaluator, so a bounded, deterministic Monte Carlo is used
 * instead — the seed derives from the cards themselves, so the same spot
 * always reports the same number and re-renders never flicker.
 */
import type { Card } from '../contracts';
import { standardDeck } from './deck';
import { compareRanks, evaluate } from './evaluator';

export interface AllInEquity {
  /** Each hand's share of the pot if the hand ran out now (ties split), 0..1, summing to 1. */
  equities: number[];
  /** True when every possible runout was enumerated; false for the Monte Carlo estimate. */
  exact: boolean;
  /** Runouts enumerated or sampled. */
  runouts: number;
}

/** Enumerate exactly at or below this many runouts; sample above it. */
export const EXACT_RUNOUT_LIMIT = 6000;
/** Monte Carlo budget: generous heads-up, bounded multiway. */
export const mcTrials = (players: number): number => (players <= 2 ? 6000 : 4000);

/** Deterministic RNG (FNV-1a seed + mulberry-style step), matching the drills pattern. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Binomial coefficient, capped early once it passes `cap` (only the comparison matters). */
function combinations(n: number, k: number, cap: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let out = 1;
  for (let i = 0; i < k; i++) { out = (out * (n - i)) / (i + 1); if (out > cap) return out; }
  return out;
}

/**
 * Equity of each of `hands` (two cards each) against the others, given `board`
 * (0, 3, 4 or 5 cards — any prefix of a real board works). Throws on malformed
 * input: fewer than two hands, a hand that is not two cards, or a card that
 * appears twice. The result is a pure function of the cards shown.
 */
export function allInEquity(hands: readonly (readonly Card[])[], board: readonly Card[], seed = 'all-in'): AllInEquity {
  if (hands.length < 2) throw new Error('Equity needs at least two tabled hands.');
  const known = new Set<Card>();
  for (const hand of hands) {
    if (hand.length !== 2) throw new Error('Each tabled hand must be exactly two cards.');
    for (const c of hand) { if (known.has(c)) throw new Error(`Card ${c} appears twice.`); known.add(c); }
  }
  if (board.length > 5) throw new Error('Board cannot have more than five cards.');
  for (const c of board) { if (known.has(c)) throw new Error(`Card ${c} appears twice.`); known.add(c); }
  const rest = standardDeck().filter(c => !known.has(c));
  const need = 5 - board.length;
  const shares = hands.map(() => 0);
  const score = (extra: readonly Card[]): void => {
    const full = [...board, ...extra];
    const ranks = hands.map(h => evaluate([...h, ...full]));
    let best = ranks[0];
    for (const r of ranks) if (compareRanks(r, best) > 0) best = r;
    const winners = ranks.filter(r => compareRanks(r, best) === 0).length;
    ranks.forEach((r, i) => { if (compareRanks(r, best) === 0) shares[i] += 1 / winners; });
  };
  if (need === 0) { score([]); return { equities: shares, exact: true, runouts: 1 }; }
  const total = combinations(rest.length, need, EXACT_RUNOUT_LIMIT);
  if (total <= EXACT_RUNOUT_LIMIT) {
    let runouts = 0;
    const picked: Card[] = [];
    const walk = (start: number): void => {
      if (picked.length === need) { score(picked); runouts++; return; }
      for (let i = start; i <= rest.length - (need - picked.length); i++) { picked.push(rest[i]); walk(i + 1); picked.pop(); }
    };
    walk(0);
    return { equities: shares.map(s => s / runouts), exact: true, runouts };
  }
  const trials = mcTrials(hands.length);
  const random = rng(`${seed}|${hands.map(h => [...h].sort().join('')).join('|')}|${[...board].sort().join('')}`);
  for (let t = 0; t < trials; t++) {
    const pool = [...rest];
    const extra: Card[] = [];
    for (let k = 0; k < need; k++) { const i = k + Math.floor(random() * (pool.length - k)); [pool[k], pool[i]] = [pool[i], pool[k]]; extra.push(pool[k]); }
    score(extra);
  }
  return { equities: shares.map(s => s / trials), exact: false, runouts: trials };
}
