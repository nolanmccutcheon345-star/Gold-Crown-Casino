/** Basic strategy and count-based deviations, computed from expected value rather than typed in.

    Model: after removing the cards on the table from the shoe, every further card is drawn with
    the remaining rank frequencies held fixed. That captures the number of decks and the cards in
    view, but omits further depletion. It is an approximation, not an exact combinatorial
    solution or a simulation. Splits are valued without resplitting. Count indices use a
    linear estimate of how each rank's frequency moves with the true count, so they are
    approximations to be confirmed by simulation before anyone relies on them at a real table. */
import { countSystem, type CountSystemId } from './counting';

/** Card values: 1 is an ace, 10 is any ten-value card. */
export type Value = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Play = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
export interface StrategyRules { decks: number; dealerHitsSoft17: boolean; doubleAfterSplit: boolean; surrender: boolean; }
/** Rank frequencies indexed by value; index 0 is unused. */
type Mix = number[];
const VALUES: Value[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Rank frequencies of a shoe after removing the given cards. */
export function shoeMix(decks: number, removed: readonly Value[] = []): Mix {
  const left = [0, ...VALUES.map(value => (value === 10 ? 16 : 4) * decks)];
  for (const value of removed) left[value] = Math.max(0, left[value] - 1);
  const total = left.reduce((sum, count) => sum + count, 0);
  return left.map(count => count / total);
}
/** Shift a mix to what a counter expects at a true count: each rank moves in proportion to its tag. */
export function mixAtTrueCount(mix: Mix, system: CountSystemId, trueCount: number): Mix {
  const tags = countSystem(system).tags, tag = (value: number) => tags[(value === 1 ? 'A' : value === 10 ? 'T' : String(value)) as keyof typeof tags];
  const spread = VALUES.reduce((sum, value) => sum + (value === 10 ? 4 : 1) / 13 * tag(value) ** 2, 0);
  const shifted = mix.map((share, value) => value ? Math.max(0, share * (1 - trueCount * tag(value) / (52 * spread))) : 0), total = shifted.reduce((sum, share) => sum + share, 0);
  return shifted.map(share => share / total);
}

const best = (total: number, ace: boolean) => ace && total + 10 <= 21 ? total + 10 : total;
/** Probability of each dealer result (17 to 21, and 22 for a bust), given no dealer blackjack. */
function dealerResults(up: Value, mix: Mix, hitsSoft17: boolean): number[] {
  const memo = new Map<number, number[]>();
  const play = (total: number, ace: boolean): number[] => {
    const value = best(total, ace), soft = ace && total + 10 <= 21;
    if (value > 21) return [0, 0, 0, 0, 0, 1];
    if (value > 17 || value === 17 && !(soft && hitsSoft17)) { const out = [0, 0, 0, 0, 0, 0]; out[value - 17] = 1; return out; }
    const key = total * 2 + (ace ? 1 : 0), known = memo.get(key); if (known) return known;
    const out = [0, 0, 0, 0, 0, 0];
    for (const card of VALUES) { const next = play(total + card, ace || card === 1); for (let i = 0; i < 6; i++) out[i] += mix[card] * next[i]; }
    memo.set(key, out); return out;
  };
  // The dealer has already checked for blackjack: an ace cannot hide a ten, nor a ten an ace.
  const blocked = up === 1 ? 10 : up === 10 ? 1 : 0, scale = 1 - (blocked ? mix[blocked] : 0), out = [0, 0, 0, 0, 0, 0];
  for (const card of VALUES) if (card !== blocked) { const next = play(up + card, up === 1 || card === 1); for (let i = 0; i < 6; i++) out[i] += mix[card] / scale * next[i]; }
  return out;
}

export interface Evaluation { stand: number; hit: number; double: number | null; split: number | null; surrender: number | null; }
/** Expected value, in bets, of each action for a starting hand against a dealer up card. */
export function evaluate(cards: readonly Value[], up: Value, rules: StrategyRules, mix: Mix = shoeMix(rules.decks, [...cards, up]), options: { afterSplit?: boolean; excludeSplit?: boolean } = {}): Evaluation {
  const dealer = dealerResults(up, mix, rules.dealerHitsSoft17);
  const stand = (value: number) => value > 21 ? -1 : dealer[5] + dealer.reduce((sum, chance, index) => index === 5 ? sum : sum + chance * Math.sign(value - (17 + index)), 0);
  const hitMemo = new Map<number, number>();
  const hit = (total: number, ace: boolean): number => {
    const key = total * 2 + (ace ? 1 : 0), known = hitMemo.get(key); if (known !== undefined) return known;
    let value = 0;
    for (const card of VALUES) { const next = total + card, nextAce = ace || card === 1; value += mix[card] * (next > 21 ? -1 : Math.max(stand(best(next, nextAce)), hit(next, nextAce))); }
    hitMemo.set(key, value); return value;
  };
  const oneCard = (total: number, ace: boolean) => VALUES.reduce((sum, card) => sum + mix[card] * stand(best(total + card, ace || card === 1)), 0);
  const total = cards.reduce((sum, card) => sum + card, 0), ace = cards.includes(1), two = cards.length === 2, pair = two && cards[0] === cards[1] && !options.afterSplit && !options.excludeSplit;
  let split: number | null = null;
  if (pair) {
    const card = cards[0];
    split = 2 * VALUES.reduce((sum, next) => { const t = card + next, a = card === 1 || next === 1; const play = card === 1 ? stand(best(t, a)) : Math.max(stand(best(t, a)), hit(t, a), rules.doubleAfterSplit ? 2 * oneCard(t, a) : -Infinity); return sum + mix[next] * play; }, 0);
  }
  return { stand: stand(best(total, ace)), hit: hit(total, ace), double: two && (!options.afterSplit || rules.doubleAfterSplit) ? 2 * oneCard(total, ace) : null, split, surrender: two && rules.surrender && !options.afterSplit ? -0.5 : null };
}
/** The highest-value action, and the best of hit or stand for when the first choice is not allowed. */
export function bestPlay(evaluation: Evaluation): { play: Play; fallback: 'hit' | 'stand'; value: number } {
  const fallback = evaluation.hit > evaluation.stand ? 'hit' : 'stand';
  const options: [Play, number | null][] = [[fallback, evaluation[fallback]], ['double', evaluation.double], ['split', evaluation.split], ['surrender', evaluation.surrender]];
  const [play, value] = options.filter((option): option is [Play, number] => option[1] !== null).reduce((top, option) => option[1] > top[1] + 1e-12 ? option : top);
  return { play, fallback, value };
}

export type ChartKind = 'hard' | 'soft' | 'pair';
export interface ChartRow { kind: ChartKind; label: string; /** Hard or soft total, or the pair's card value. */ key: number; plays: { play: Play; fallback: 'hit' | 'stand' }[]; }
export const UP_CARDS: Value[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
const valueLabel = (value: number) => value === 1 ? 'A' : String(value);

/** Two-card ways to hold a total, with their relative frequency, excluding pairs where another way exists. */
function compositions(kind: ChartKind, key: number): { cards: Value[]; weight: number }[] {
  if (kind === 'pair') return [{ cards: [key as Value, key as Value], weight: 1 }];
  if (kind === 'soft') return [{ cards: [1, (key - 11) as Value], weight: 1 }];
  const ways: { cards: Value[]; weight: number }[] = [];
  for (let low = 2; low <= 10; low++) { const high = key - low; if (high > low && high <= 10) ways.push({ cards: [low as Value, high as Value], weight: (low === 10 ? 4 : 1) * (high === 10 ? 4 : 1) }); }
  return ways.length ? ways : [{ cards: [(key / 2) as Value, (key / 2) as Value], weight: 1 }];
}
/** Average the action values over the ways of holding a total, as a strategy chart does. */
export function evaluateTotal(kind: ChartKind, key: number, up: Value, rules: StrategyRules, mixFor: (removed: Value[]) => Mix = removed => shoeMix(rules.decks, removed)): Evaluation {
  const ways = compositions(kind, key), weight = ways.reduce((sum, way) => sum + way.weight, 0), sum: Evaluation = { stand: 0, hit: 0, double: 0, split: kind === 'pair' ? 0 : null, surrender: rules.surrender ? -0.5 : null };
  for (const way of ways) { const one = evaluate(way.cards, up, rules, mixFor([...way.cards, up]), { excludeSplit: kind !== 'pair' }), share = way.weight / weight; sum.stand += share * one.stand; sum.hit += share * one.hit; sum.double! += share * one.double!; if (kind === 'pair') sum.split! += share * one.split!; }
  return sum;
}
const chartCache = new Map<string, ChartRow[]>();
/** The full basic-strategy chart for a rule set: hard 5 to 20, soft 13 to 20, and every pair. */
export function strategyChart(rules: StrategyRules): ChartRow[] {
  const id = `${rules.decks}|${rules.dealerHitsSoft17}|${rules.doubleAfterSplit}|${rules.surrender}`, known = chartCache.get(id); if (known) return known;
  const row = (kind: ChartKind, key: number, label: string): ChartRow => ({ kind, key, label, plays: UP_CARDS.map(up => { const { play, fallback } = bestPlay(evaluateTotal(kind, key, up, rules)); return { play, fallback }; }) });
  const rows = [...Array.from({ length: 16 }, (_, index) => row('hard', 20 - index, `Hard ${20 - index}`)), ...Array.from({ length: 8 }, (_, index) => row('soft', 20 - index, `Soft ${20 - index} (A,${9 - index})`)), ...[1, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(card => row('pair', card, `${valueLabel(card)},${valueLabel(card)}`))];
  chartCache.set(id, rows); return rows;
}

/** A count-based departure from basic strategy: play `play` when the true count is on the
    stated side of `index`, otherwise the basic play. */
export interface Deviation { kind: ChartKind | 'insurance'; key: number; up: Value; label: string; basic: Play | 'no insurance'; play: Play | 'insurance'; /** True count at which the better play changes, to one decimal. Coaches round it to a whole count. */ index: number; /** Round in original units before converting to doubled Halves. */ indexScale?: 1 | 2; direction: 'at or above' | 'at or below'; }

/** The well-known high-value departures (the "Illustrious 18" hands, plus the surrender hands). */
const DEVIATION_HANDS: readonly [ChartKind, number, Value][] = [['hard', 16, 10], ['hard', 15, 10], ['pair', 10, 5], ['pair', 10, 6], ['hard', 10, 10], ['hard', 12, 3], ['hard', 12, 2], ['hard', 11, 1], ['hard', 9, 2], ['hard', 10, 1], ['hard', 9, 7], ['hard', 16, 9], ['hard', 13, 2], ['hard', 12, 4], ['hard', 12, 5], ['hard', 12, 6], ['hard', 13, 3], ['hard', 14, 10], ['hard', 15, 9], ['hard', 15, 1]];
const handLabel = (kind: ChartKind, key: number) => kind === 'pair' ? `${valueLabel(key)},${valueLabel(key)}` : `${kind === 'soft' ? 'Soft' : 'Hard'} ${key}`;
const upLabel = (up: Value) => up === 1 ? 'ace' : String(up);
/** The best play for a chart cell at a true count under a counting system. */
export function playAtCount(kind: ChartKind, key: number, up: Value, rules: StrategyRules, system: CountSystemId, trueCount: number): Play {
  return bestPlay(evaluateTotal(kind, key, up, rules, removed => mixAtTrueCount(shoeMix(rules.decks, removed), system, trueCount))).play;
}
/** Narrow the change point between a count where the basic play holds and one where it does not. */
function refine(holds: number, changed: number, differs: (count: number) => boolean): number {
  for (let step = 0; step < 5; step++) { const middle = (holds + changed) / 2; if (differs(middle)) changed = middle; else holds = middle; }
  return Math.round((holds + changed) / 2 * 10) / 10;
}
const deviationCache = new Map<string, Deviation[]>();
/** Computed index plays for a counting system and rule set, most valuable first. */
export function deviations(rules: StrategyRules, system: CountSystemId): Deviation[] {
  const id = `${system}|${rules.decks}|${rules.dealerHitsSoft17}|${rules.doubleAfterSplit}|${rules.surrender}`, known = deviationCache.get(id); if (known) return known;
  if (system === 'wong-halves-double') {
    const scaled = deviations(rules, 'wong-halves').map(item => ({ ...item, index: item.index * 2, indexScale: 2 as const }));
    deviationCache.set(id, scaled); return scaled;
  }
  const out: Deviation[] = [];
  // Insurance is exact in this model: it pays when more than a third of the unseen cards are tens.
  const tens = (count: number) => mixAtTrueCount(shoeMix(rules.decks, [1]), system, count)[10] > 1 / 3;
  for (let count = -10; count <= 20; count += 0.5) if (tens(count)) { out.push({ kind: 'insurance', key: 0, up: 1, label: 'Insurance', basic: 'no insurance', play: 'insurance', index: refine(count - 0.5, count, tens), direction: 'at or above' }); break; }
  for (const [kind, key, up] of DEVIATION_HANDS) {
    const basic = playAtCount(kind, key, up, rules, system, 0), plays = Array.from({ length: 61 }, (_, step) => ({ count: -15 + step * 0.5, play: playAtCount(kind, key, up, rules, system, -15 + step * 0.5) }));
    // Nearest change of play on either side of zero.
    const above = plays.find(point => point.count > 0 && point.play !== basic), below = [...plays].reverse().find(point => point.count < 0 && point.play !== basic);
    for (const [point, direction] of [[above, 'at or above'], [below, 'at or below']] as const) if (point && Math.abs(point.count) <= 8) out.push({ kind, key, up, label: `${handLabel(kind, key)} against ${upLabel(up)}`, basic, play: point.play, index: refine(point.count + (direction === 'at or above' ? -0.5 : 0.5), point.count, count => playAtCount(kind, key, up, rules, system, count) !== basic), direction });
  }
  deviationCache.set(id, out); return out;
}

/** Whole-count form of an index, as a player uses it at the table. */
export const wholeIndex = (deviation: Deviation): number => (Math.round(deviation.index / (deviation.indexScale ?? 1)) || 0) * (deviation.indexScale ?? 1);
/** Whether a deviation applies at a true count, using its whole-count index. */
export const deviationApplies = (deviation: Deviation, trueCount: number): boolean => deviation.direction === 'at or above' ? trueCount >= wholeIndex(deviation) : trueCount <= wholeIndex(deviation);

export interface Hint { play: Play; /** Why, in a sentence a learner can use. */ reason: string; /** True when a count index changed the basic play. */ byCount: boolean; }
const PLAY_WORDS: Record<Play, string> = { hit: 'hit', stand: 'stand', double: 'double', split: 'split', surrender: 'surrender' };
/** The coach's play for a live hand. Uses the chart for two-card hands and hit-or-stand by total
    after that; with `count` it applies the computed index for that system when one exists.
    `allowed` lists what the table permits right now. */
export function hintFor(cards: readonly Value[], up: Value, rules: StrategyRules, allowed: readonly Play[], count?: { system: CountSystemId; trueCount: number }): Hint {
  const total = cards.reduce((sum, card) => sum + card, 0), soft = cards.includes(1) && total + 10 <= 21, pair = cards.length === 2 && cards[0] === cards[1] && allowed.includes('split');
  const kind: ChartKind = pair ? 'pair' : soft ? 'soft' : 'hard', key = pair ? cards[0] : soft ? total + 10 : total, can = (play: Play) => allowed.includes(play);
  if (kind === 'hard' && (key < 5 || key > 20) || kind === 'soft' && key > 20) return { play: key >= 17 ? 'stand' : 'hit', reason: key >= 17 ? `Always stand on ${soft ? 'soft ' : ''}${key}.` : 'You cannot bust, so take a card.', byCount: false };
  const evaluation = evaluateTotal(kind, key, up, rules), basic = bestPlay(evaluation), name = `${handLabel(kind, key)} against ${upLabel(up)}`;
  const legal = allowed.filter(play => evaluation[play] !== null && (cards.length === 2 || play === 'hit' || play === 'stand'));
  if (!legal.length) throw new Error('No supported legal action for this coach hint.');
  const play = legal.reduce((top, option) => evaluation[option]! > evaluation[top]! + 1e-12 ? option : top);
  if (count && cards.length === 2) {
    const found = deviations(rules, count.system).find(item => item.kind === kind && item.key === key && item.up === up && deviationApplies(item, count.trueCount) && can(item.play as Play));
    if (found) return { play: found.play as Play, reason: `${name}: the base model suggests ${PLAY_WORDS[play]}; its estimated index at a true count of ${wholeIndex(found) > 0 ? '+' : ''}${wholeIndex(found)} or ${found.direction === 'at or above' ? 'higher' : 'lower'} suggests ${PLAY_WORDS[found.play as Play]}.`, byCount: true };
  }
  return { play, reason: play === basic.play ? `${name}: the approximate model suggests ${PLAY_WORDS[play]}.` : `${name}: the model prefers ${PLAY_WORDS[basic.play]}; among the available actions it suggests ${PLAY_WORDS[play]}.`, byCount: false };
}
