/** Phase 14 (CB-U03, hybrid wallet): one casino, one total — computed, never
 * stored. Play keeps flowing through the existing per-game wallet paths
 * (integer cents; those modules stay the authority). This module only adds
 * up what they hold, in the open, so the unified figure reconciles exactly
 * with the sum of the per-game balances by construction.
 *
 * Every bucket is split into Available (spendable right now) and In play
 * (committed at a table or in a shoe — still the player's money, never a
 * loss). A buy-in moves cents from Available to In play; the bucket total
 * does not move. Tournament money is the bankroll outside events only:
 * chips inside a running event are scoring units, never wealth, and are
 * never counted here. Casino-table rounds settle inside their own round
 * flow, so their In play reads zero — a placed stake leaves Available and
 * returns (or not) at that round's settlement, exactly as it always has.
 *
 * Career results ride along for the per-game win/loss breakdown. Heads-up
 * has no balance of its own (it plays from the cash bankroll) and its
 * result is a subset of the cash result — it is shown for visibility and
 * never added into any total. */
import type { CareerStats } from './career';

export type WalletBucketId = 'cash' | 'tournaments' | 'blackjack' | 'omaha' | 'slots' | 'casino';
export interface WalletShare { available: number; inPlay: number }
export type WalletComponents = Record<WalletBucketId, WalletShare | null>;

export interface WalletBucket extends WalletShare { id: WalletBucketId; label: string; total: number }
export interface UnifiedWallet {
  buckets: WalletBucket[];
  available: number | null; inPlay: number | null; total: number | null;
  complete: boolean;
}

export const WALLET_BUCKETS: readonly { id: WalletBucketId; label: string }[] = [
  { id: 'cash', label: 'Poker cash' },
  { id: 'tournaments', label: 'Tournaments' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'omaha', label: 'Omaha' },
  { id: 'slots', label: 'Slots' },
  { id: 'casino', label: 'Casino tables' },
];

/** The unified view. A component that has not loaded yet is null, and then
 * the totals are null too: a partial sum dressed up as the whole casino
 * would be a lie with good formatting. */
export function unifiedWallet(components: WalletComponents): UnifiedWallet {
  const buckets: WalletBucket[] = [];
  let available = 0, inPlay = 0, complete = true;
  for (const { id, label } of WALLET_BUCKETS) {
    const share = components[id];
    if (!share) { complete = false; buckets.push({ id, label, available: 0, inPlay: 0, total: 0 }); continue; }
    buckets.push({ id, label, available: share.available, inPlay: share.inPlay, total: share.available + share.inPlay });
    available += share.available; inPlay += share.inPlay;
  }
  return { buckets, available: complete ? available : null, inPlay: complete ? inPlay : null, total: complete ? available + inPlay : null, complete };
}

export interface WalletGameRow {
  id: string; label: string;
  /** Null when the game shares another bucket's balance (heads-up → cash;
   * the four casino-table games → the casino bucket). */
  available: number | null; inPlay: number | null;
  balanceNote?: string;
  /** Career net in cents; null while that game's records are still loading. */
  net: number | null;
}
export interface WalletBreakdown extends UnifiedWallet {
  rows: WalletGameRow[];
  /** Career net across every game (heads-up already inside cash). */
  totalNet: number;
}

/** `pending` lists career sections whose records have not loaded yet; their
 * nets report as unknown rather than as a flattering zero. */
export function walletBreakdown(components: WalletComponents, career: CareerStats, headsUpNet: number | null, pending: readonly string[] = []): WalletBreakdown {
  const unified = unifiedWallet(components);
  const net = (id: string, value: number) => pending.includes(id) ? null : value;
  const casinoShare = (id: string, label: string, value: number): WalletGameRow => ({
    id, label, available: null, inPlay: null, balanceNote: 'Shares the casino tables balance', net: net(id, value),
  });
  const rows: WalletGameRow[] = [
    { id: 'cash', label: 'Poker cash', available: components.cash?.available ?? null, inPlay: components.cash?.inPlay ?? null, net: net('cash', career.games.cash.net) },
    { id: 'heads-up', label: 'Heads-up', available: null, inPlay: null, balanceNote: 'Plays from the cash bankroll', net: pending.includes('cash') ? null : headsUpNet },
    { id: 'tournaments', label: 'Tournaments', available: components.tournaments?.available ?? null, inPlay: null, balanceNote: 'In-event stacks are scoring units, not wealth', net: net('tournaments', career.games.tournaments.net) },
    { id: 'blackjack', label: 'Blackjack', available: components.blackjack?.available ?? null, inPlay: components.blackjack?.inPlay ?? null, net: net('blackjack', career.games.blackjack.net) },
    { id: 'omaha', label: 'Omaha', available: components.omaha?.available ?? null, inPlay: components.omaha?.inPlay ?? null, net: net('omaha', career.games.omaha.net) },
    { id: 'slots', label: 'Slots', available: components.slots?.available ?? null, inPlay: null, net: net('slots', career.games.slots.net) },
    casinoShare('roulette', 'Roulette', career.games.roulette.net),
    casinoShare('craps', 'Craps', career.games.craps.net),
    casinoShare('baccarat', 'Baccarat', career.games.baccarat.net),
    casinoShare('races', 'Horse racing', career.games.races.net),
  ];
  return { ...unified, rows, totalNet: career.totalNet };
}
