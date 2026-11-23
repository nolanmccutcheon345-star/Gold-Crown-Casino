/** What the tournament screens need from the tournament controller. Presentation contract only.
    Chips are whole tournament chips; money is cents. The screens never compute results: every
    number shown comes from these fields. */
import type { BlindLevel } from './presets';

export type MoveReason = 'table-broke' | 'balance' | 'final-table';

export interface TournamentMove { reason: MoveReason; fromTable: number; toTable: number; toSeat: number; }

export interface StandingRow {
  name: string;
  isHero: boolean;
  /** Style label when this player is one of the named regulars. */
  regular?: string;
  /** Live chips; zero once eliminated. */
  stack: number;
  /** Table number while seated, null once eliminated. */
  table: number | null;
  /** Finishing place once eliminated (or 1 for the winner), otherwise null. */
  finished: number | null;
  /** Eliminated while registration is open; no final place or prize yet. */
  awaitingPlace?: boolean;
  /** Prize in cents once eliminated in the money, otherwise zero. */
  prize: number;
}

export interface TournamentResult { place: number; entrants: number; prize: number; cost: number; handsPlayed: number; }

export interface TournamentView {
  eventName: string;
  status: 'running' | 'hero-out' | 'complete';
  current: BlindLevel;
  next: BlindLevel | null;
  handsToNextLevel: number;
  entrants: number;
  /** Late registration and re-entry (patch 43), when the event has it. */
  registration?: { open: boolean; closesAfterLevel: number; entries: number; reEntries: number; late: number;
    /** Hero's re-entry (patch 46): offered after a knockout while registration is open; `pending` once paid. */
    heroReEntry?: { available: boolean; pending: boolean; cost: number; used: number } };
  playersLeft: number;
  tablesLeft: number;
  placesPaid: number;
  /** Patch 72: a satellite's target event and seat value. */
  seatTarget?: { id: string; name: string; seat: number };
  prizePool: number;
  /** Prize per place, first place first, in cents. */
  ladder: readonly number[];
  averageStack: number;
  hero: { stack: number; rank: number; table: number; seat: number } | null;
  handForHand: boolean;
  finalTable: boolean;
  /** Set when Hero has been reseated and has not yet acknowledged it. */
  pendingMove: TournamentMove | null;
  /** Live players by chips (largest first), then eliminated players by finishing place. */
  standings: readonly StandingRow[];
  /** Set only once Hero has a final place; null during deferred registration ranking. */
  result: TournamentResult | null;
}

/** One finished event, for the Results tab. */
export interface TournamentRecord { eventName: string; entrants: number; place: number; cost: number; prize: number; finishedAt: string; }

export interface TournamentTotals { events: number; cashes: number; cost: number; prizes: number; net: number; /** Null with no events. */ roi: number | null; /** Null with no events. */ inTheMoneyRate: number | null; bestPlace: number | null; }

/** Totals for the Results tab. ROI is net result divided by total cost. It is never expressed
    in big blinds, and is kept apart from cash-game results. */
export function tournamentTotals(records: readonly TournamentRecord[]): TournamentTotals {
  const cost = records.reduce((sum, record) => sum + record.cost, 0), prizes = records.reduce((sum, record) => sum + record.prize, 0);
  const cashes = records.filter(record => record.prize > 0).length;
  return { events: records.length, cashes, cost, prizes, net: prizes - cost, roi: cost > 0 ? (prizes - cost) / cost : null, inTheMoneyRate: records.length ? cashes / records.length : null, bestPlace: records.length ? Math.min(...records.map(record => record.place)) : null };
}
