/** Side-bet settlement: which paytable row a side bet lands on, from cards only. Pure functions.
    Nothing here reads a shoe, moves money or records a wager; an engine calls `settleSideBet` with
    cards that are already public and applies the multiple to the stake itself.

    Paytables depend on the number of decks, as they do in casinos. They are commonly published
    versions, not any one casino's felt. `to1` is winnings per unit staked; a winning bet also
    keeps its stake, and a losing bet (`null`) loses it. */
import type { Card } from '../contracts';
import type { SideBetId } from './presets';

export interface SideBetRow { key: string; outcome: string; to1: number; }
export interface SideBetResult { key: string; outcome: string; /** Winnings per unit staked. */ to1: number; }
export type DeckBand = 1 | 2 | 6 | 8;

const RANKS = '23456789TJQKA';
const rank = (card: Card) => card[0], suit = (card: Card) => card[1];
const red = (card: Card) => suit(card) === 'h' || suit(card) === 'd';
const value = (card: Card) => rank(card) === 'A' ? 11 : 'TJQK'.includes(rank(card)) ? 10 : Number(rank(card));
const order = (card: Card) => RANKS.indexOf(rank(card));

/** Paytable rows for a side bet at a deck count, best outcome first. */
export function sideBetPaytable(id: SideBetId, decks: number): SideBetRow[] {
  switch (id) {
    case 'twenty-one-plus-three': return [{ key: 'any', outcome: 'Flush, straight, three of a kind or straight flush', to1: 9 }];
    case 'perfect-pairs': return [{ key: 'perfect', outcome: 'Perfect pair (same rank and suit)', to1: 25 }, { key: 'coloured', outcome: 'Coloured pair (same rank and colour)', to1: 12 }, { key: 'mixed', outcome: 'Mixed pair', to1: 6 }];
    case 'lucky-ladies': return [{ key: 'queens-blackjack', outcome: 'Queen of hearts pair with dealer blackjack', to1: 1000 }, { key: 'queens', outcome: 'Queen of hearts pair', to1: 200 }, { key: 'matched', outcome: 'Matched 20 (same rank and suit)', to1: 25 }, { key: 'suited', outcome: 'Suited 20', to1: 10 }, { key: 'any', outcome: 'Any 20', to1: 4 }];
    case 'match-the-dealer': return decks <= 2
      ? [{ key: 'suited', outcome: 'Suited match (each card)', to1: 19 }, { key: 'unsuited', outcome: 'Unsuited match (each card)', to1: 4 }]
      : decks >= 8 ? [{ key: 'suited', outcome: 'Suited match (each card)', to1: 14 }, { key: 'unsuited', outcome: 'Unsuited match (each card)', to1: 3 }]
      : [{ key: 'suited', outcome: 'Suited match (each card)', to1: 11 }, { key: 'unsuited', outcome: 'Unsuited match (each card)', to1: 4 }];
    case 'buster': return [{ key: 'bust-8', outcome: 'Bust with 8 or more cards', to1: 250 }, { key: 'bust-7', outcome: 'Bust with 7 cards', to1: 50 }, { key: 'bust-6', outcome: 'Bust with 6 cards', to1: 15 }, { key: 'bust-5', outcome: 'Bust with 5 cards', to1: 4 }, { key: 'bust-3-4', outcome: 'Bust with 3 or 4 cards', to1: 2 }];
    case 'push-22': return [{ key: 'twenty-two', outcome: 'Dealer 22', to1: 11 }];
  }
}
const row = (id: SideBetId, decks: number, key: string): SideBetResult => { const found = sideBetPaytable(id, decks).find(item => item.key === key)!; return { key, outcome: found.outcome, to1: found.to1 }; };

/** True when three cards are three consecutive ranks; the ace may be high (Q-K-A) or low (A-2-3). */
export function isStraight(cards: readonly Card[]): boolean {
  const sorted = cards.map(order).sort((a, b) => a - b);
  return sorted[0] + 1 === sorted[1] && sorted[1] + 1 === sorted[2] || sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 12;
}
export function dealerTotal(cards: readonly Card[]): number {
  let total = cards.reduce((sum, card) => sum + value(card), 0), aces = cards.filter(card => rank(card) === 'A').length;
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}

export interface SideBetContext {
  decks: number;
  /** Hero's first two cards. */
  player: readonly [Card, Card];
  /** Dealer's up card. */
  up: Card;
  /** Whether the dealer has blackjack. Needed only for Lucky Ladies' top prize; pass null until the dealer has checked. */
  dealerBlackjack: boolean | null;
  /** The dealer's finished hand. Needed only for Buster and Push 22; pass null until the dealer has played out. */
  dealerFinal: readonly Card[] | null;
}
/** When a side bet can be decided. */
export type SideBetTiming = 'deal' | 'dealer-check' | 'dealer-final';
export function sideBetTiming(id: SideBetId, context: Pick<SideBetContext, 'player'>): SideBetTiming {
  if (id === 'buster' || id === 'push-22') return 'dealer-final';
  return id === 'lucky-ladies' && context.player[0] === 'Qh' && context.player[1] === 'Qh' ? 'dealer-check' : 'deal';
}

/** The paytable row a side bet lands on, or null for a loss. Returns `undefined` when the bet
    cannot be decided yet because the dealer information it needs was not supplied. */
export function settleSideBet(id: SideBetId, context: SideBetContext): SideBetResult | null | undefined {
  const [first, second] = context.player, decks = context.decks;
  switch (id) {
    case 'twenty-one-plus-three': {
      const three = [first, second, context.up], flush = three.every(card => suit(card) === suit(first)), trips = three.every(card => rank(card) === rank(first));
      return flush || trips || isStraight(three) ? row(id, decks, 'any') : null;
    }
    case 'perfect-pairs':
      return rank(first) !== rank(second) ? null : row(id, decks, suit(first) === suit(second) ? 'perfect' : red(first) === red(second) ? 'coloured' : 'mixed');
    case 'lucky-ladies': {
      if (value(first) + value(second) !== 20) return null;
      if (first === 'Qh' && second === 'Qh') return context.dealerBlackjack === null ? undefined : row(id, decks, context.dealerBlackjack ? 'queens-blackjack' : 'queens');
      return row(id, decks, first === second ? 'matched' : suit(first) === suit(second) ? 'suited' : 'any');
    }
    case 'match-the-dealer': {
      const table = sideBetPaytable(id, decks), suited = table.find(item => item.key === 'suited')!.to1, unsuited = table.find(item => item.key === 'unsuited')!.to1;
      const matches = [first, second].filter(card => rank(card) === rank(context.up)), suitedCount = matches.filter(card => suit(card) === suit(context.up)).length, unsuitedCount = matches.length - suitedCount;
      if (!matches.length) return null;
      return { key: `${suitedCount}s${unsuitedCount}u`, outcome: [suitedCount ? `${suitedCount} suited match${suitedCount > 1 ? 'es' : ''}` : '', unsuitedCount ? `${unsuitedCount} unsuited match${unsuitedCount > 1 ? 'es' : ''}` : ''].filter(Boolean).join(' and '), to1: suitedCount * suited + unsuitedCount * unsuited };
    }
    case 'buster': {
      if (!context.dealerFinal) return undefined;
      if (dealerTotal(context.dealerFinal) <= 21) return null;
      const cards = context.dealerFinal.length;
      return row(id, decks, cards >= 8 ? 'bust-8' : cards === 7 ? 'bust-7' : cards === 6 ? 'bust-6' : cards === 5 ? 'bust-5' : 'bust-3-4');
    }
    case 'push-22':
      return !context.dealerFinal ? undefined : dealerTotal(context.dealerFinal) === 22 ? row(id, decks, 'twenty-two') : null;
  }
}
/** Net result of a side bet in cents: winnings when it wins, minus the stake when it loses. */
export const sideBetNet = (stake: number, result: SideBetResult | null): number => result ? stake * result.to1 : -stake;
/** A side bet may be from the table's side-bet minimum up to the smaller of its maximum and the main bet. */
export function sideBetLimits(table: { minBet: number }, mainBet: number): { min: number; max: number } {
  const high = table.minBet >= 2500, min = high ? 500 : 100;
  return { min, max: Math.max(0, Math.min(high ? 10000 : 2500, mainBet)) };
}
