/** Count trainer: deals a practice shoe a few cards at a time and checks the player's count.
    No wagers, no balance and no saved data. State is replaced, never mutated. */
import type { Card } from '../contracts';
import { countState, countSystem, sameCount, type CountState, type CountSystemId } from './counting';

export type TrainerMode = 'learn' | 'test';
export interface TrainerSettings { system: CountSystemId; decks: 2 | 6; cardsPerDeal: 1 | 2 | 3; mode: TrainerMode; }
export interface TrainerCheck { answer: number; correct: number; runningRight: boolean; acesAnswer?: number; acesCorrect: number; acesRight?: boolean; right: boolean; atCard: number; }
export interface TrainerState {
  settings: TrainerSettings;
  shoe: readonly Card[];
  /** Cards dealt so far. */
  position: number;
  /** Where dealing stops, as in a real shoe. */
  cutAt: number;
  lastDeal: readonly Card[];
  checks: readonly TrainerCheck[];
  streak: number;
}

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'], SUITS = ['c', 'd', 'h', 's'];
/** Uniform integer in [0, limit) from the browser's secure generator, without modulo bias. */
export function secureIndex(limit: number): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness unavailable. Use a supported secure browser.');
  const word = new Uint32Array(1), ceiling = Math.floor(0x100000000 / limit) * limit;
  do { globalThis.crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return word[0] % limit;
}
/** A shuffled practice shoe. `index` is injectable so tests can fix the order. */
export function practiceShoe(decks: number, index: (limit: number) => number = secureIndex): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < decks; deck++) for (const suit of SUITS) for (const rank of RANKS) cards.push(`${rank}${suit}` as Card);
  for (let i = cards.length - 1; i > 0; i--) { const j = index(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
export const DEFAULT_TRAINER: TrainerSettings = { system: 'hi-lo', decks: 6, cardsPerDeal: 1, mode: 'learn' };
export function newTrainer(settings: TrainerSettings, index?: (limit: number) => number): TrainerState {
  const shoe = practiceShoe(settings.decks, index);
  return { settings, shoe, position: 0, cutAt: Math.round(shoe.length * (settings.decks === 2 ? 0.65 : 0.75)), lastDeal: [], checks: [], streak: 0 };
}
export const trainerSeen = (state: TrainerState): readonly Card[] => state.shoe.slice(0, state.position);
export const trainerCount = (state: TrainerState): CountState => countState(countSystem(state.settings.system), trainerSeen(state), state.settings.decks);
export const trainerFinished = (state: TrainerState): boolean => state.position >= state.cutAt;
/** Deal the next group of cards, stopping at the cut card. */
export function dealNext(state: TrainerState): TrainerState {
  if (trainerFinished(state)) return state;
  const next = Math.min(state.cutAt, state.position + state.settings.cardsPerDeal);
  return { ...state, position: next, lastDeal: state.shoe.slice(state.position, next) };
}
/** Compare the player's running count with the true running count. */
export function checkCount(state: TrainerState, answer: number, acesAnswer?: number): TrainerState {
  if (!Number.isFinite(answer)) throw new Error('Enter your running count as a number.');
  if (acesAnswer !== undefined && (!Number.isInteger(acesAnswer) || acesAnswer < 0 || acesAnswer > state.settings.decks * 4)) throw new Error('Enter aces seen as a whole number within this shoe.');
  const count = trainerCount(state), correct = count.running, runningRight = sameCount(answer, correct), acesRight = acesAnswer === undefined ? undefined : acesAnswer === count.acesSeen, right = runningRight && acesRight !== false;
  return { ...state, checks: [...state.checks, { answer, correct, runningRight, acesAnswer, acesCorrect: count.acesSeen, acesRight, right, atCard: state.position }], streak: right ? state.streak + 1 : 0 };
}
/** Change a setting. A new system or shoe size starts a new shoe; pace and mode do not. */
export function retune(state: TrainerState, change: Partial<TrainerSettings>, index?: (limit: number) => number): TrainerState {
  const settings = { ...state.settings, ...change };
  return settings.system !== state.settings.system || settings.decks !== state.settings.decks ? newTrainer(settings, index) : { ...state, settings };
}
