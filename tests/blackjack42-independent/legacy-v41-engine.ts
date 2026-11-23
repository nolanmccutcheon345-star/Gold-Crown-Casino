/** B1 classic blackjack reducer. No UI, persistence, strategy hints or real-money transactions.
 * Private state includes the shoe and dealer hole card; expose only blackjackView to consumers.
 */
import { secureIndex, standardDeck } from '../../src/core/deck';
import { BLACKJACK_STARTING_BALANCE, type BlackjackTable } from '../../src/blackjack/presets';

export const BLACKJACK_ENGINE_VERSION = 'classic-blackjack-0.1.0';
export type ShoeCard = `${number}:${string}`;
export type BlackjackPlay = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insurance' | 'decline-insurance' | 'even-money';
export interface BlackjackCommand { id: string; revision: number; type: BlackjackPlay | 'deal' | 'shuffle'; bet?: number; shoe?: ShoeCard[]; sideBets?: unknown; }
export interface BlackjackHand { cards: ShoeCard[]; bet: number; split: boolean; splitAces: boolean; doubled: boolean; status: 'playing' | 'stood' | 'busted' | 'surrendered'; payout: number; result?: 'win' | 'loss' | 'push' | 'blackjack' | 'surrender'; }
export interface BlackjackRound { id: string; number: number; firstCardIndex: number; shoeNumber: number; openingBalance: number; ante: number; baseBet: number; insuranceBet: number; insuranceReturn: number; hands: BlackjackHand[]; dealer: ShoeCard[]; holeRevealed: boolean; phase: 'insurance' | 'player' | 'settled'; actor: number; net: number | null; }
export interface BlackjackLedger { id: string; roundId: string; kind: 'bet' | 'ante' | 'split' | 'double' | 'insurance' | 'settle'; amount: number; }
export interface BlackjackState {
 version: typeof BLACKJACK_ENGINE_VERSION; rules: BlackjackTable; initialBalance: number; ante: number; initialShoe: ShoeCard[];
 revision: number; balance: number; shoe: ShoeCard[]; cursor: number; shoeNumber: number;
 round: BlackjackRound | null; completed: BlackjackRound[]; ledger: BlackjackLedger[]; commands: BlackjackCommand[];
}
const error = (message: string): never => { throw new Error(message); };
const assert = (value: unknown, message: string): void => { if (!value) error(message); };
const clone = <T>(value: T): T => structuredClone(value);
const cents = (amount: number): boolean => Number.isSafeInteger(amount) && amount >= 0;
const rank = (card: ShoeCard): string => card.split(':')[1][0];
const value = (card: ShoeCard): number => rank(card) === 'A' ? 1 : 'TJQK'.includes(rank(card)) ? 10 : Number(rank(card));
export function blackjackTotal(cards: readonly ShoeCard[]): { total: number; soft: boolean } {
 const low = cards.reduce((sum, card) => sum + value(card), 0), soft = cards.some(card => rank(card) === 'A') && low + 10 <= 21;
 return { total: low + (soft ? 10 : 0), soft };
}
const natural = (hand: BlackjackHand): boolean => !hand.split && hand.cards.length === 2 && blackjackTotal(hand.cards).total === 21;
const dealerNatural = (round: BlackjackRound): boolean => round.dealer.length === 2 && blackjackTotal(round.dealer).total === 21;
/** Unique physical card IDs distinguish copies of the same face in a multi-deck shoe. */
export function orderedBlackjackShoe(decks: number): ShoeCard[] {
 assert(Number.isInteger(decks) && [1, 2, 6, 8].includes(decks), 'Unsupported deck count');
 return Array.from({ length: decks }, (_, deck) => standardDeck().map(card => `${deck}:${card}` as ShoeCard)).flat();
}
export function secureBlackjackShoe(decks: number): ShoeCard[] {
 const shoe = orderedBlackjackShoe(decks);
 for (let i = shoe.length - 1; i > 0; i--) { const j = secureIndex(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
 return shoe;
}
function verifyShoe(shoe: ShoeCard[], decks: number): void {
 assert(Array.isArray(shoe), 'Missing shoe');
 const expected = new Set(orderedBlackjackShoe(decks));
 assert(shoe.length === expected.size && new Set(shoe).size === shoe.length && shoe.every(card => expected.has(card)), 'Invalid or duplicated shoe cards');
}
function verifyRules(rules: BlackjackTable): void {
 assert(rules.variant === 'classic', 'Free Bet blackjack is not supported by this engine');
 assert(rules.blackjackPays === '3:2' || rules.blackjackPays === '6:5', 'Invalid natural payout');
 assert(Number.isInteger(rules.maxHands) && rules.maxHands >= 2 && rules.maxHands <= 4, 'Invalid split limit');
 assert(cents(rules.minBet) && rules.minBet >= 100 && rules.minBet % 100 === 0 && cents(rules.maxBet) && rules.maxBet >= rules.minBet && rules.maxBet % 100 === 0, 'Invalid table limits');
 assert(rules.penetration > 0 && rules.penetration < 1, 'Invalid cut card');
 assert(typeof rules.dealerHitsSoft17 === 'boolean' && typeof rules.doubleAfterSplit === 'boolean' && typeof rules.resplitAces === 'boolean' && ['none', 'late'].includes(rules.surrender), 'Invalid rules');
}
export function createBlackjackState(rules: BlackjackTable, shoe: ShoeCard[], options: { balance?: number; ante?: number } = {}): BlackjackState {
 verifyRules(rules); verifyShoe(shoe, rules.decks);
 const initialBalance = options.balance ?? BLACKJACK_STARTING_BALANCE, ante = options.ante ?? (rules.group === 'home' ? 0 : 50);
 assert(cents(initialBalance), 'Invalid starting balance'); assert([0, 50, 100].includes(ante) && (rules.group !== 'home' || ante === 0), 'Invalid round ante');
 return { version: BLACKJACK_ENGINE_VERSION, rules: clone(rules), initialBalance, ante, initialShoe: [...shoe], revision: 0, balance: initialBalance, shoe: [...shoe], cursor: 0, shoeNumber: 1, round: null, completed: [], ledger: [], commands: [] };
}
const draw = (state: BlackjackState): ShoeCard => { assert(state.cursor < state.shoe.length, 'Shoe exhausted; state unchanged'); return state.shoe[state.cursor++]; };
const addLedger = (state: BlackjackState, cmd: BlackjackCommand, kind: BlackjackLedger['kind'], amount: number): void => {
 assert(Number.isSafeInteger(amount) && cents(state.balance + amount), 'Insufficient balance or invalid amount');
 const id = `${cmd.id}:${kind}`; assert(!state.ledger.some(event => event.id === id), 'Duplicate financial event');
 state.balance += amount; state.ledger.push({ id, roundId: state.round!.id, kind, amount });
};
const hand = (cards: ShoeCard[], bet: number, split = false, splitAces = false): BlackjackHand => ({ cards, bet, split, splitAces, doubled: false, status: 'playing', payout: 0 });
function settle(state: BlackjackState, cmd: BlackjackCommand, evenMoney = false): void {
 const round = state.round!; assert(round.phase !== 'settled', 'Already settled'); round.holeRevealed = true;
 const dealerBJ = dealerNatural(round), anyLive = round.hands.some(h => h.status !== 'busted' && h.status !== 'surrendered' && !natural(h));
 if (!evenMoney && !dealerBJ && anyLive) {
  for (;;) { const d = blackjackTotal(round.dealer); if (d.total > 17 || d.total === 17 && !(d.soft && state.rules.dealerHitsSoft17)) break; round.dealer.push(draw(state)); }
 }
 const dealerTotal = blackjackTotal(round.dealer).total;
 for (const h of round.hands) {
  const playerTotal = blackjackTotal(h.cards).total;
  if (evenMoney) { h.result = 'blackjack'; h.payout = h.bet * 2; }
  else if (h.status === 'surrendered') { h.result = 'surrender'; h.payout = h.bet / 2; }
  else if (h.status === 'busted' || dealerBJ && !natural(h)) { h.result = 'loss'; h.payout = 0; }
  else if (natural(h)) { h.result = dealerBJ ? 'push' : 'blackjack'; h.payout = dealerBJ ? h.bet : h.bet * (state.rules.blackjackPays === '3:2' ? 2.5 : 2.2); }
  else if (dealerTotal > 21 || playerTotal > dealerTotal) { h.result = 'win'; h.payout = h.bet * 2; }
  else if (playerTotal === dealerTotal) { h.result = 'push'; h.payout = h.bet; }
  else { h.result = 'loss'; h.payout = 0; }
  // Rational payout avoids a binary floating-point fraction of a cent at 6:5.
  if (h.result === 'blackjack' && !evenMoney) h.payout = h.bet + h.bet * (state.rules.blackjackPays === '3:2' ? 3 : 6) / (state.rules.blackjackPays === '3:2' ? 2 : 5);
 }
 round.insuranceReturn = dealerBJ ? round.insuranceBet * 3 : 0;
 addLedger(state, cmd, 'settle', round.hands.reduce((sum, h) => sum + h.payout, 0) + round.insuranceReturn);
 round.phase = 'settled'; round.net = state.balance - round.openingBalance; round.actor = -1;
 state.completed.push(clone(round));
}
function advance(state: BlackjackState, cmd: BlackjackCommand): void {
 const round = state.round!;
 while (round.actor < round.hands.length) {
  const h = round.hands[round.actor];
  if (h.cards.length === 1) h.cards.push(draw(state));
  if (h.status === 'playing') {
   const total = blackjackTotal(h.cards).total;
   if (total > 21) h.status = 'busted';
   else if (total === 21) h.status = 'stood';
   else if (h.splitAces && !(state.rules.resplitAces && value(h.cards[1]) === 1 && round.hands.length < state.rules.maxHands && state.balance >= h.bet)) h.status = 'stood';
  }
  if (h.status === 'playing') return;
  round.actor++;
 }
 settle(state, cmd);
}
function afterPeek(state: BlackjackState, cmd: BlackjackCommand): void {
 const round = state.round!;
 if (dealerNatural(round) || natural(round.hands[0])) settle(state, cmd);
 else { round.phase = 'player'; advance(state, cmd); }
}
export function blackjackLegalActions(state: BlackjackState): BlackjackPlay[] {
 const round = state.round; if (!round || round.phase === 'settled') return [];
 if (round.phase === 'insurance') return ['decline-insurance', ...(state.balance >= round.baseBet / 2 ? ['insurance' as const] : []), ...(natural(round.hands[0]) && state.rules.blackjackPays === '3:2' ? ['even-money' as const] : [])];
 const h = round.hands[round.actor], two = h.cards.length === 2;
 const split = two && value(h.cards[0]) === value(h.cards[1]) && round.hands.length < state.rules.maxHands && state.balance >= h.bet && (!h.splitAces || state.rules.resplitAces);
 if (h.splitAces) return ['stand', ...(split ? ['split' as const] : [])];
 return ['hit', 'stand', ...(two && state.balance >= h.bet && (!h.split || state.rules.doubleAfterSplit) ? ['double' as const] : []), ...(split ? ['split' as const] : []), ...(two && !h.split && state.rules.surrender === 'late' ? ['surrender' as const] : [])];
}
function step(state: BlackjackState, cmd: BlackjackCommand): BlackjackState {
 assert(cmd && typeof cmd.id === 'string' && cmd.id.length > 0 && cmd.id.length <= 160, 'Invalid command identity');
 const previous = state.commands.find(item => item.id === cmd.id);
 if (previous) { assert(JSON.stringify(previous) === JSON.stringify(cmd), 'Command identity reused with different content'); return state; }
 assert(cmd.revision === state.revision, 'Stale blackjack action');
 assert(cmd.sideBets === undefined, 'Side bets are not supported by this engine');
 const next = clone(state);
 if (cmd.type === 'shuffle') {
  assert(!next.round || next.round.phase === 'settled', 'Cannot shuffle an active round'); assert(next.cursor >= Math.floor(next.shoe.length * next.rules.penetration), 'Cut card not reached');
  assert(cmd.shoe && cmd.bet === undefined, 'Shuffle requires only a shoe'); verifyShoe(cmd.shoe!, next.rules.decks);
  next.shoe = [...cmd.shoe!]; next.cursor = 0; next.shoeNumber++;
 } else if (cmd.type === 'deal') {
  assert(!next.round || next.round.phase === 'settled', 'Round already active');
  assert(next.cursor < Math.floor(next.shoe.length * next.rules.penetration), 'Cut card reached; shuffle before dealing');
  assert(cmd.shoe === undefined && cents(cmd.bet!) && cmd.bet! % 100 === 0 && cmd.bet! >= next.rules.minBet && cmd.bet! <= next.rules.maxBet, 'Illegal bet');
  assert(next.balance >= cmd.bet! + next.ante, 'Insufficient balance for bet and ante');
  next.round = { id: `round:${cmd.id}`, number: next.completed.length + 1, firstCardIndex: next.cursor, shoeNumber: next.shoeNumber, openingBalance: next.balance, ante: next.ante, baseBet: cmd.bet!, insuranceBet: 0, insuranceReturn: 0, hands: [], dealer: [], holeRevealed: false, phase: 'player', actor: 0, net: null };
  addLedger(next, cmd, 'bet', -cmd.bet!); if (next.ante) addLedger(next, cmd, 'ante', -next.ante);
  const first = draw(next), up = draw(next), second = draw(next), hole = draw(next);
  next.round.hands = [hand([first, second], cmd.bet!)]; next.round.dealer = [up, hole];
  if (value(up) === 1) next.round.phase = 'insurance'; else afterPeek(next, cmd);
 } else {
  assert(cmd.bet === undefined && cmd.shoe === undefined, 'Unexpected action payload'); assert(blackjackLegalActions(next).includes(cmd.type), 'Illegal blackjack action');
  const round = next.round!, h = round.hands[round.actor];
  if (cmd.type === 'insurance' || cmd.type === 'decline-insurance' || cmd.type === 'even-money') {
   if (cmd.type === 'even-money') settle(next, cmd, true);
   else { if (cmd.type === 'insurance') { round.insuranceBet = round.baseBet / 2; addLedger(next, cmd, 'insurance', -round.insuranceBet); } afterPeek(next, cmd); }
  } else {
   if (cmd.type === 'hit') h.cards.push(draw(next));
   if (cmd.type === 'stand') h.status = 'stood';
   if (cmd.type === 'surrender') h.status = 'surrendered';
   if (cmd.type === 'double') { addLedger(next, cmd, 'double', -h.bet); h.bet *= 2; h.doubled = true; h.cards.push(draw(next)); h.status = blackjackTotal(h.cards).total > 21 ? 'busted' : 'stood'; }
   if (cmd.type === 'split') { addLedger(next, cmd, 'split', -h.bet); const aces = value(h.cards[0]) === 1; round.hands.splice(round.actor, 1, hand([h.cards[0]], h.bet, true, aces), hand([h.cards[1]], h.bet, true, aces)); }
   advance(next, cmd);
  }
 }
 next.revision++; next.commands.push(clone(cmd)); assertAccounting(next); return next;
}
export function assertAccounting(state: BlackjackState): void {
 assert(cents(state.balance) && new Set(state.ledger.map(item => item.id)).size === state.ledger.length, 'Invalid ledger');
 assert(state.initialBalance + state.ledger.reduce((sum, item) => sum + item.amount, 0) === state.balance, 'Ledger balance mismatch');
 for (const round of state.completed) {
  const entries = state.ledger.filter(item => item.roundId === round.id), settlements = entries.filter(item => item.kind === 'settle');
  assert(settlements.length === 1 && entries.reduce((sum, item) => sum + item.amount, 0) === round.net, 'Round accounting mismatch');
 }
 assert(state.revision === state.commands.length && new Set(state.commands.map(cmd => cmd.id)).size === state.commands.length, 'Invalid command sequence');
}
/** Only accepts a reducer-produced/validated state. For untrusted restored data call restoreBlackjack. */
export function applyBlackjack(state: BlackjackState, command: BlackjackCommand): BlackjackState { assertAccounting(state); return step(state, command); }
/** Full deterministic reconstruction catches altered cards, omitted/reordered commands and ledger corruption.
 * This is a B1 correctness boundary, not a scalable archive/persistence implementation. */
export function restoreBlackjack(saved: unknown): BlackjackState {
 const candidate = saved as BlackjackState;
 assert(candidate?.version === BLACKJACK_ENGINE_VERSION && Array.isArray(candidate.commands), 'Unsupported blackjack save');
 let replay = createBlackjackState(candidate.rules, candidate.initialShoe, { balance: candidate.initialBalance, ante: candidate.ante });
 for (const command of candidate.commands) replay = step(replay, command);
 assert(JSON.stringify(replay) === JSON.stringify(candidate), 'Blackjack replay mismatch'); return replay;
}
/** A strict allow-list. No shoe IDs/order, dealer hole face or private replay journal escapes. */
export function blackjackView(state: BlackjackState) {
 const round = state.round;
 return {
  version: state.version, revision: state.revision, table: state.rules.id, balance: state.balance, ante: state.ante,
  cardsRemaining: state.shoe.length - state.cursor, shuffleRequired: state.cursor >= Math.floor(state.shoe.length * state.rules.penetration),
  round: round ? { id: round.id, number: round.number, phase: round.phase, dealer: round.dealer.map((card, index) => index === 1 && !round.holeRevealed ? null : card.split(':')[1]), hands: round.hands.map(h => ({ ...h, cards: h.cards.map(card => card.split(':')[1]), ...blackjackTotal(h.cards) })), actor: round.actor, net: round.net, insuranceBet: round.insuranceBet, insuranceReturn: round.insuranceReturn } : null,
  legalActions: blackjackLegalActions(state),
 };
}
