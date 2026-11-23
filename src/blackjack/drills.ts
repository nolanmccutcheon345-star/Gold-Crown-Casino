/** Practice questions for the strategy coach and the count coach. No wagers, nothing saved. */
import type { Card } from '../contracts';
import type { CountSystemId } from './counting';
import { bestPlay, deviationApplies, deviations, evaluateTotal, UP_CARDS, wholeIndex, type ChartKind, type Deviation, type Evaluation, type Play, type StrategyRules, type Value } from './strategy';

export interface DrillQuestion { kind: ChartKind; key: number; up: Value; cards: readonly Card[]; upCard: Card; /** Count drills only. */ trueCount: number | null; deviation: Deviation | null; }
export interface DrillAnswer { given: Play; correct: Play; right: boolean; basic: Play; values: Evaluation; }
export interface DrillState { question: DrillQuestion; answer: DrillAnswer | null; asked: number; right: number; streak: number; }

const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'], TENS = ['T', 'J', 'Q', 'K'], SUITS = ['c', 'd', 'h', 's'];
type Index = (limit: number) => number;
const face = (value: Value, index: Index, avoidSuit = ''): Card => { const suits = SUITS.filter(suit => suit !== avoidSuit); return `${value === 10 ? TENS[index(4)] : RANKS[value]}${suits[index(suits.length)]}`; };
function cardsFor(kind: ChartKind, key: number, index: Index): Card[] {
  if (kind === 'pair') { const first = face(key as Value, index); return [first, face(key as Value, index, first[1]).replace(/^./, first[0])]; }
  if (kind === 'soft') return index(2) ? [face(1, index), face((key - 11) as Value, index)] : [face((key - 11) as Value, index), face(1, index)];
  const ways: [number, number][] = []; for (let low = 2; low <= 10; low++) { const high = key - low; if (high > low && high <= 10) ways.push([low, high]); }
  const [low, high] = ways.length ? ways[index(ways.length)] : [key / 2, key / 2];
  return [face(high as Value, index), face(low as Value, index)];
}
/** Actions a two-card hand may take at these rules. */
export const drillActions = (question: Pick<DrillQuestion, 'kind'>, rules: StrategyRules): Play[] => [...(rules.surrender ? ['surrender' as Play] : []), ...(question.kind === 'pair' ? ['split' as Play] : []), 'double', 'stand', 'hit'];
/** A random starting hand: mostly the totals where decisions are made. */
export function strategyQuestion(index: Index): DrillQuestion {
  const roll = index(20), kind: ChartKind = roll < 11 ? 'hard' : roll < 15 ? 'soft' : 'pair';
  const key = kind === 'hard' ? 8 + index(10) : kind === 'soft' ? 13 + index(8) : 1 + index(10), up = UP_CARDS[index(10)];
  return { kind, key, up, cards: cardsFor(kind, key, index), upCard: face(up, index), trueCount: null, deviation: null };
}
/** A hand with an index play for this system and rule set, at a true count on either side of the index. */
export function deviationQuestion(rules: StrategyRules, system: CountSystemId, index: Index): DrillQuestion {
  const list = deviations(rules, system).filter(item => item.kind !== 'insurance'), deviation = list[index(list.length)], whole = wholeIndex(deviation);
  const offset = [-3, -2, -1, 0, 1, 2, 3][index(7)] * (deviation.indexScale ?? 1);
  return { kind: deviation.kind as ChartKind, key: deviation.key, up: deviation.up, cards: cardsFor(deviation.kind as ChartKind, deviation.key, index), upCard: face(deviation.up, index), trueCount: whole + offset, deviation };
}
/** Mark an answer. With a count, the index play is correct when the count has reached it. */
export function answerDrill(question: DrillQuestion, given: Play, rules: StrategyRules): DrillAnswer {
  const values = evaluateTotal(question.kind, question.key, question.up, rules), basic = bestPlay(values).play;
  const correct = question.deviation && question.trueCount !== null && deviationApplies(question.deviation, question.trueCount) ? question.deviation.play as Play : basic;
  return { given, correct, right: given === correct, basic, values };
}
export const newDrill = (question: DrillQuestion): DrillState => ({ question, answer: null, asked: 0, right: 0, streak: 0 });
export function gradeDrill(state: DrillState, given: Play, rules: StrategyRules): DrillState {
  if (state.answer) return state;
  const answer = answerDrill(state.question, given, rules);
  return { ...state, answer, asked: state.asked + 1, right: state.right + (answer.right ? 1 : 0), streak: answer.right ? state.streak + 1 : 0 };
}
export const nextDrill = (state: DrillState, question: DrillQuestion): DrillState => ({ ...state, question, answer: null });
