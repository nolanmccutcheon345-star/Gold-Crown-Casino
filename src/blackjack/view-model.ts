/** What the blackjack screens need from a blackjack controller. Presentation contract only: the
    screens never deal, total or settle anything themselves. Money is cents. A hidden card is null. */
import type { Card } from '../contracts';
import type { BlackjackTable, SideBetId } from './presets';

export type BlackjackPhase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled';
export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
export type HandOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';

export interface BlackjackHandView {
  cards: readonly Card[];
  total: number;
  soft: boolean;
  /** Amount at risk on this hand, including a paid double. */
  bet: number;
  doubled: boolean;
  /** Free Bet tables: the house paid for this hand's double or split. */
  freeBet: boolean;
  state: 'waiting' | 'acting' | 'stood' | 'bust' | 'blackjack' | 'surrendered';
  /** Set once the round is settled: the outcome and the net result for this hand. */
  result: { outcome: HandOutcome; net: number } | null;
}

export interface SideBetView { id: SideBetId; amount: number; /** Set once this bet is decided. */ result: { outcome: string | null; net: number } | null; }

export interface BlackjackView {
  table: BlackjackTable;
  /** House fee once per round in cents; zero on a no-ante night. */
  feePerRound: number;
  balance: number;
  phase: BlackjackPhase;
  /** Main bet being built during betting, or the opening bet of the round in play. */
  bet: number;
  /** The previous round's main bet, for Rebet; zero if none. */
  lastBet: number;
  sideBets: readonly SideBetView[];
  dealer: { cards: readonly (Card | null)[]; /** Total of the visible cards. */ total: number; soft: boolean };
  hands: readonly BlackjackHandView[];
  /** Index of the hand to act, or -1. */
  activeHand: number;
  legal: { deal: boolean; actions: readonly BlackjackAction[]; insurance: boolean; evenMoney: boolean };
  insuranceCost: number;
  shoe: { cards: number; remaining: number; cutAt: number; /** The cut card is out: this is the last round of the shoe. */ lastRound: boolean };
  /** Every card Hero has legitimately seen since the shuffle, in order. Drives the count coach. */
  seen: readonly Card[];
  /** Net result of the settled round across main and side bets; null until settled. */
  roundNet: number | null;
  /** Basic-strategy play for the hand to act, when the coach is on and the controller offers one. */
  hint: { action: BlackjackAction | 'insurance' | 'no insurance'; reason: string } | null;
  /** The last decision, compared with basic strategy; null when it matched or nothing to report. */
  lastMistake: { played: string; better: string } | null;
  session: BlackjackSession;
}

export interface BlackjackSession { rounds: number; wagered: number; /** Total house fees paid, included in `net`. */ fees: number; net: number; blackjacks: number; decisions: number; mistakes: number; sideBetNet: number; }
