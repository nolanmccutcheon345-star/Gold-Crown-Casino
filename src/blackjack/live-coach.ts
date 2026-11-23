/** The coach's advice for the live table. Uses only what Hero can legitimately see: the public
    round, the table rules, and the cards exposed since the shuffle. Presentation only: nothing
    here deals, bets or settles. Strategy and indices come from the approximate model in
    strategy.ts and are not independently verified. */
import type { Card } from '../contracts';
import { countState, countSystem, formatCount, type CountSystemId } from './counting';
import type { BlackjackPlay } from './engine';
import type { PublicBlackjack } from './live-view';
import { strategyRules, type BlackjackTable } from './presets';
import { deviations, hintFor, wholeIndex, type Play, type Value } from './strategy';
import type { BlackjackView } from './view-model';

export type LiveHint = NonNullable<BlackjackView['hint']>;
export interface LiveCount { system: CountSystemId; /** False while the player is testing their own count: advice then never states the current count. */ reveal: boolean; }
const rankValue = (card: string): Value => (card[0] === 'A' ? 1 : 'TJQK'.includes(card[0]) ? 10 : Number(card[0])) as Value;
const PLAYS: readonly string[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const signedWhole = (count: number) => `${count > 0 ? '+' : count < 0 ? '−' : ''}${Math.abs(count)}`;

/** Advice for the decision in front of Hero, or null when there is none. With `count`, index plays
    for that counting system apply once the true count has reached them. */
export function liveAdvice(state: PublicBlackjack | null, table: BlackjackTable | null, seen: readonly Card[], count: LiveCount | null): LiveHint | null {
  const round = state?.round, rules = table ? strategyRules(table) : null;
  if (!state || !round || !table || !rules) return null;
  const counted = count ? { system: count.system, trueCount: countState(countSystem(count.system), seen, table.decks).trueCount } : undefined;
  const now = counted && count!.reveal ? ` True count now ${formatCount(counted.trueCount)}.` : '';
  if (round.phase === 'insurance') {
    if (!counted) return { action: 'no insurance', reason: 'Basic strategy never takes insurance or even money.' };
    const index = deviations(rules, counted.system).find(item => item.kind === 'insurance'), whole = index ? wholeIndex(index) : Infinity, can = state.legalActions.includes('insurance') || state.legalActions.includes('even-money');
    if (!can) return { action: 'no insurance', reason: 'Insurance is unavailable at this decision.' };
    return counted.trueCount >= whole
      ? { action: 'insurance', reason: `The approximate model recommends insurance at a true count of ${signedWhole(whole)} or higher.${now}` }
      : { action: 'no insurance', reason: `The approximate model recommends declining insurance below ${Number.isFinite(whole) ? signedWhole(whole) : 'its index'}.${now}` };
  }
  if (round.phase !== 'player') return null;
  const hand = round.hands[round.actor], up = round.dealer[0];
  if (!hand || !up) return null;
  const legal = state.legalActions.filter((play): play is Play => PLAYS.includes(play));
  const hint = hintFor(hand.cards.map(rankValue), rankValue(up), rules, legal, counted);
  /* A plain basic-strategy hint already names its play in the heading, so the reason is just the hand. */
  const plain = !hint.byCount && /^([^:]+): the approximate model suggests \w+\.$/.exec(hint.reason);
  return { action: hint.play, reason: plain ? `${plain[1]}.` : hint.reason + (hint.byCount ? now : '') };
}

/** The engine action a hint corresponds to, given what is legal right now. */
export function hintAsPlay(hint: LiveHint, legal: readonly BlackjackPlay[]): BlackjackPlay {
  if (hint.action === 'no insurance') return 'decline-insurance';
  if (hint.action === 'insurance') return legal.includes('even-money') ? 'even-money' : 'insurance';
  return hint.action;
}
const PLAY_WORDS: Record<BlackjackPlay, string> = { hit: 'hit', stand: 'stand', double: 'double', split: 'split', surrender: 'surrender', insurance: 'insurance', 'decline-insurance': 'no insurance', 'even-money': 'even money' };
export const playWords = (play: BlackjackPlay): string => PLAY_WORDS[play];
