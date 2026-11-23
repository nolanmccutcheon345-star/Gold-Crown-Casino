/** Blackjack table and side-bet catalogue. Configuration and display data only: no engine,
    ledger or storage code lives here, and nothing in this file settles a wager.

    Tables are modelled on common home, casino-floor and high-limit games. Side-bet paytables are
    commonly published versions; a real casino's felt may differ, and no house-edge figure is
    stated here because the project must measure its own. Money is in cents. */

export type TableGroup = 'home' | 'casino' | 'high';
export type BlackjackVariant = 'classic' | 'free-bet';
export type SideBetId = 'twenty-one-plus-three' | 'perfect-pairs' | 'lucky-ladies' | 'match-the-dealer' | 'buster' | 'push-22';

export interface BlackjackTable {
  id: string;
  group: TableGroup;
  variant: BlackjackVariant;
  name: string;
  decks: 1 | 2 | 6 | 8;
  blackjackPays: '3:2' | '6:5';
  dealerHitsSoft17: boolean;
  doubleAfterSplit: boolean;
  surrender: 'none' | 'late';
  resplitAces: boolean;
  /** Most hands one starting hand can be split into. */
  maxHands: number;
  minBet: number;
  maxBet: number;
  /** Fraction of the shoe dealt before the cut card. */
  penetration: number;
  /** Chip denominations offered at this table, in cents, smallest first. */
  chips: readonly number[];
  sideBets: readonly SideBetId[];
  blurb: string;
}

export interface SideBet { id: SideBetId; name: string; blurb: string; settles: 'on the deal' | 'when the dealer finishes'; pays: readonly { outcome: string; to1: number }[]; }

const dollars = (amount: number) => amount * 100;
const CHIPS_LOW = [100, 500, 2500, 10000].map(value => value) as readonly number[];
const CHIPS_MID = [500, 2500, 10000, 50000] as readonly number[];
const CHIPS_HIGH = [2500, 10000, 50000, 100000] as readonly number[];

/** Virtual blackjack balance a player starts with, in cents (owner decision). Separate from
    the cash-game bankroll and the tournament balance. */
export const BLACKJACK_STARTING_BALANCE = dollars(2000);

export const SIDE_BETS: readonly SideBet[] = [
  { id: 'twenty-one-plus-three', name: '21+3', settles: 'on the deal', blurb: 'Your two cards and the dealer\'s up card make a three-card poker hand.', pays: [{ outcome: 'Flush, straight, three of a kind or straight flush', to1: 9 }] },
  { id: 'perfect-pairs', name: 'Perfect Pairs', settles: 'on the deal', blurb: 'Your first two cards are a pair.', pays: [{ outcome: 'Perfect pair (same rank and suit)', to1: 25 }, { outcome: 'Coloured pair (same rank and colour)', to1: 12 }, { outcome: 'Mixed pair', to1: 6 }] },
  { id: 'lucky-ladies', name: 'Lucky Ladies', settles: 'on the deal', blurb: 'Your first two cards total 20.', pays: [{ outcome: 'Queen of hearts pair with dealer blackjack', to1: 1000 }, { outcome: 'Queen of hearts pair', to1: 200 }, { outcome: 'Matched 20 (same rank and suit)', to1: 25 }, { outcome: 'Suited 20', to1: 10 }, { outcome: 'Any 20', to1: 4 }] },
  { id: 'match-the-dealer', name: 'Match the Dealer', settles: 'on the deal', blurb: 'Either of your first two cards matches the rank of the dealer\'s up card. Each card is paid separately.', pays: [{ outcome: 'Suited match', to1: 11 }, { outcome: 'Unsuited match', to1: 4 }] },
  { id: 'buster', name: 'Buster Blackjack', settles: 'when the dealer finishes', blurb: 'The dealer busts. The more cards in the bust, the bigger the payout.', pays: [{ outcome: 'Bust with 8 or more cards', to1: 250 }, { outcome: 'Bust with 7 cards', to1: 50 }, { outcome: 'Bust with 6 cards', to1: 15 }, { outcome: 'Bust with 5 cards', to1: 4 }, { outcome: 'Bust with 3 or 4 cards', to1: 2 }] },
  { id: 'push-22', name: 'Push 22', settles: 'when the dealer finishes', blurb: 'The dealer finishes on exactly 22.', pays: [{ outcome: 'Dealer 22', to1: 7 }] },
];

export const BLACKJACK_TABLES: readonly BlackjackTable[] = [
  { id: 'home-1', group: 'home', variant: 'classic', name: 'Kitchen table $1', decks: 2, blackjackPays: '3:2', dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(1), maxBet: dollars(50), penetration: 0.65, chips: CHIPS_LOW, sideBets: [], blurb: 'Friendly two-deck game with player-friendly rules and no side bets.' },
  { id: 'casino-2', group: 'casino', variant: 'classic', name: '$2 six-deck', decks: 6, blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(2), maxBet: dollars(200), penetration: 0.75, chips: CHIPS_LOW, sideBets: ['twenty-one-plus-three', 'perfect-pairs'], blurb: 'The lowest-limit shoe on the floor. Good for learning at real speed.' },
  { id: 'casino-5', group: 'casino', variant: 'classic', name: '$5 six-deck', decks: 6, blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(5), maxBet: dollars(500), penetration: 0.75, chips: CHIPS_LOW, sideBets: ['twenty-one-plus-three', 'perfect-pairs', 'lucky-ladies', 'match-the-dealer', 'buster'], blurb: 'The everyday casino shoe, with the full row of side bets.' },
  { id: 'casino-10-double', group: 'casino', variant: 'classic', name: '$10 double deck', decks: 2, blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(10), maxBet: dollars(500), penetration: 0.65, chips: CHIPS_MID, sideBets: ['lucky-ladies', 'match-the-dealer'], blurb: 'Two decks: the count moves faster and playing decisions matter more.' },
  { id: 'casino-5-free-bet', group: 'casino', variant: 'free-bet', name: 'Free Bet Blackjack $5', decks: 6, blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(5), maxBet: dollars(500), penetration: 0.75, chips: CHIPS_LOW, sideBets: ['push-22'], blurb: 'The house pays for your doubles on 9, 10 and 11 and for your splits (not tens). The catch: a dealer 22 pushes instead of busting.' },
  { id: 'casino-15-six-five', group: 'casino', variant: 'classic', name: '$15 six-deck (6:5)', decks: 6, blackjackPays: '6:5', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(15), maxBet: dollars(500), penetration: 0.75, chips: CHIPS_MID, sideBets: ['twenty-one-plus-three', 'perfect-pairs'], blurb: 'Blackjack pays only 6 to 5. Here so you can see what that costs.' },
  { id: 'casino-25', group: 'casino', variant: 'classic', name: '$25 six-deck', decks: 6, blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(25), maxBet: dollars(1000), penetration: 0.75, chips: CHIPS_MID, sideBets: ['twenty-one-plus-three', 'lucky-ladies', 'buster'], blurb: 'Mid-limit shoe with standard casino rules.' },
  { id: 'high-100', group: 'high', variant: 'classic', name: 'High limit $100 six-deck', decks: 6, blackjackPays: '3:2', dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'late', resplitAces: true, maxHands: 4, minBet: dollars(100), maxBet: dollars(10000), penetration: 0.8, chips: CHIPS_HIGH, sideBets: [], blurb: 'The best rules in the room: dealer stands on soft 17, surrender, aces can be resplit.' },
  { id: 'high-100-double', group: 'high', variant: 'classic', name: 'High limit $100 double deck', decks: 2, blackjackPays: '3:2', dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', resplitAces: false, maxHands: 4, minBet: dollars(100), maxBet: dollars(5000), penetration: 0.7, chips: CHIPS_HIGH, sideBets: [], blurb: 'Two decks, dealer stands on soft 17. Double after split allowed; no late surrender.' },
];

/** House fee charged once per round, including all splits at some casinos ("ante"), in cents. Zero is a no-ante night.
    The fee is paid on top of the bet and is never returned. Home games never charge one. */
export const ANTE_OPTIONS: readonly number[] = [0, 50, 100];
export const tableCanAnte = (table: Pick<BlackjackTable, 'group'>): boolean => table.group !== 'home';
/** The rules that decide how a hand should be played. Free Bet tables have their own strategy and return null. */
export function strategyRules(table: BlackjackTable): { decks: number; dealerHitsSoft17: boolean; doubleAfterSplit: boolean; surrender: boolean } | null {
  return table.variant === 'free-bet' ? null : { decks: table.decks, dealerHitsSoft17: table.dealerHitsSoft17, doubleAfterSplit: table.doubleAfterSplit, surrender: table.surrender === 'late' };
}

export const sideBet = (id: SideBetId): SideBet => SIDE_BETS.find(bet => bet.id === id)!;

/** The table's rules as short plain-language lines, in a fixed order. */
export function tableRules(table: BlackjackTable): string[] {
  const freeBet = table.variant === 'free-bet';
  return [
    `${table.decks} deck${table.decks === 1 ? '' : 's'}`,
    `Blackjack pays ${table.blackjackPays === '3:2' ? '3 to 2' : '6 to 5'}`,
    `Dealer ${table.dealerHitsSoft17 ? 'hits' : 'stands on'} soft 17`,
    freeBet ? 'Free double on hard 9, 10 and 11' : 'Double on any two cards',
    freeBet ? 'Free splits on every pair except tens' : table.doubleAfterSplit ? 'Double after split' : 'No double after split',
    ...(freeBet ? ['Dealer 22 pushes'] : []),
    table.surrender === 'late' ? 'Late surrender' : 'No surrender',
    table.resplitAces ? 'Aces can be resplit' : 'Split aces get one card each',
    `Split up to ${table.maxHands} hands`,
  ];
}

/** Winnings for a blackjack on `bet` cents, excluding the returned bet. Whole cents for every
    whole-dollar bet at either payout. */
export function blackjackPayout(table: Pick<BlackjackTable, 'blackjackPays'>, bet: number): number {
  if (!Number.isInteger(bet) || bet <= 0 || bet % 100 !== 0) throw new Error('Bets are whole dollars.');
  return table.blackjackPays === '3:2' ? bet * 3 / 2 : bet * 6 / 5;
}
