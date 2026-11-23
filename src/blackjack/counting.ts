/** Card-counting systems and count arithmetic for the coach and the count trainer.
    Pure functions over the cards a player has legitimately seen; nothing here reads a shoe. */
import type { Card } from '../contracts';

export type CountSystemId = 'hi-lo' | 'wong-halves' | 'wong-halves-double' | 'zen' | 'hi-opt-2' | 'omega-2';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface CountSystem {
  id: CountSystemId;
  name: string;
  /** Tag for each rank; ten covers T, J, Q and K. */
  tags: Record<'2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'A', number>;
  /** For ace-neutral systems: count points added to the betting count per excess ace. Zero otherwise. */
  aceSideMultiplier: number;
  level: string;
  /** Reference figures supplied with Patch 18, not independently verified by this project.
      Retained as input metadata, not evidence of measured accuracy or player advantage. */
  published: { betting: number; playing: number; insurance: number };
  note: string;
}

export const COUNT_SYSTEMS: readonly CountSystem[] = [
  { id: 'hi-lo', name: 'Hi-Lo', tags: { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, T: -1, A: -1 }, aceSideMultiplier: 0, level: 'Level 1 · start here', published: { betting: 0.97, playing: 0.51, insurance: 0.76 }, note: 'Simple enough to keep perfectly, which matters more than a stronger count kept badly.' },
  { id: 'wong-halves', name: 'Wong Halves', tags: { 2: 0.5, 3: 1, 4: 1, 5: 1.5, 6: 1, 7: 0.5, 8: 0, 9: -0.5, T: -1, A: -1 }, aceSideMultiplier: 0, level: 'Level 3 · advanced', published: { betting: 0.99, playing: 0.56, insurance: 0.72 }, note: 'Original half-point tags. The doubled option removes fractions from the running count; it is the same method in different units.' },
  { id: 'wong-halves-double', name: 'Wong Halves ×2 · whole-number tags', tags: { 2: 1, 3: 2, 4: 2, 5: 3, 6: 2, 7: 1, 8: 0, 9: -1, T: -2, A: -2 }, aceSideMultiplier: 0, level: 'Doubled Halves scale · advanced', published: { betting: 0.99, playing: 0.56, insurance: 0.72 }, note: 'Every Halves tag, running count, true count and displayed index is doubled. Divide the doubled true count by two to compare with original Halves indices. Aces are still counted once each in the side tally.' },
  { id: 'zen', name: 'Zen Count', tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: 0, T: -2, A: -1 }, aceSideMultiplier: 0, level: 'Level 2 · intermediate', published: { betting: 0.96, playing: 0.63, insurance: 0.85 }, note: 'Uses both one-point and two-point tags, with aces included in the main count.' },
  { id: 'hi-opt-2', name: 'Hi-Opt II + ace side count', tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 0, 9: 0, T: -2, A: 0 }, aceSideMultiplier: 2, level: 'Level 2 with a side count · advanced', published: { betting: 0.91, playing: 0.67, insurance: 0.91 }, note: 'Aces count zero and are tracked separately. The main count guides playing decisions; the ace-adjusted count guides bet size.' },
  { id: 'omega-2', name: 'Omega II + ace side count', tags: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: -1, T: -2, A: 0 }, aceSideMultiplier: 2, level: 'Level 2 with a side count · advanced', published: { betting: 0.92, playing: 0.67, insurance: 0.85 }, note: 'Like Hi-Opt II, but the six counts +2 and the nine counts −1.' },
];

export const countSystem = (id: CountSystemId): CountSystem => COUNT_SYSTEMS.find(system => system.id === id)!;
/** Unit conversion only; doubling tags does not create a new strategy. */
export const countScale = (system: CountSystem): 1 | 2 => system.id === 'wong-halves-double' ? 2 : 1;
const rankOf = (card: Card): Rank => card[0] as Rank;
export const isAce = (card: Card): boolean => rankOf(card) === 'A';
/** The tag one card adds to the running count. */
export function cardTag(system: CountSystem, card: Card): number {
  const rank = rankOf(card);
  return system.tags[rank === 'J' || rank === 'Q' || rank === 'K' ? 'T' : rank];
}
export const runningCount = (system: CountSystem, seen: readonly Card[]): number => seen.reduce((sum, card) => sum + cardTag(system, card), 0);

export interface CountState {
  running: number;
  cardsSeen: number;
  /** Exact decks not yet seen. */
  decksRemaining: number;
  /** Decks remaining as a player estimates them: to the nearest half deck, never below half. */
  decksEstimate: number;
  /** Running count divided by the estimated decks remaining. */
  trueCount: number;
  /** Original-system units; half the displayed TC in doubled Halves. */
  standardTrueCount: number;
  acesSeen: number;
  /** All unexposed aces, including any hidden dealer card; not a deck lookup. */
  acesRemaining: number;
  expectedAcesRemaining: number;
  /** Aces still unseen beyond the average for this depth. Positive favours the player. */
  excessAces: number;
  /** True count for bet sizing. Differs from `trueCount` only for ace-neutral systems. */
  bettingTrueCount: number;
}

/** Everything the coach shows, from the cards seen since the shuffle. */
export function countState(system: CountSystem, seen: readonly Card[], decks: number): CountState {
  const total = decks * 52;
  if (!Number.isInteger(decks) || decks < 1 || seen.length > total) throw new Error('More cards seen than the shoe holds.');
  const running = runningCount(system, seen), acesSeen = seen.filter(isAce).length;
  const decksRemaining = (total - seen.length) / 52, decksEstimate = Math.max(0.5, Math.round(decksRemaining * 2) / 2);
  const excessAces = seen.length / 13 - acesSeen;
  return { running, cardsSeen: seen.length, decksRemaining, decksEstimate, trueCount: running / decksEstimate, standardTrueCount: running / decksEstimate / countScale(system), acesSeen, acesRemaining: decks * 4 - acesSeen, expectedAcesRemaining: (total - seen.length) / 13, excessAces, bettingTrueCount: (running + system.aceSideMultiplier * excessAces) / decksEstimate };
}

/** Counts are compared to the nearest half point, the finest step any listed system uses. */
export const sameCount = (a: number, b: number): boolean => Math.abs(a - b) < 0.25;
export const formatCount = (value: number): string => { const rounded = Math.round(value * 10) / 10; return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}`; };
