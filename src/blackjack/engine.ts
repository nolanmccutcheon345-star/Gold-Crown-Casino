/** B1 classic blackjack reducer. No UI, persistence, strategy hints or real-money transactions.
 * Private state includes the shoe and dealer hole card; expose only blackjackView to consumers.
 */
import { secureIndex, standardDeck } from '../core/deck';
import { BLACKJACK_STARTING_BALANCE, type BlackjackTable } from './presets';
import { SEAT_RULES_VERSION, SEATS, seatPlay, seatTakesInsurance, type PlayerStyle } from './table-players';
import type { Play, Value } from './strategy';

export const BLACKJACK_ENGINE_VERSION = 'classic-blackjack-0.1.0';
export type ShoeCard = `${number}:${string}`;
export type BlackjackPlay = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insurance' | 'decline-insurance' | 'even-money';
export interface BlackjackCommand { id: string; revision: number; type: BlackjackPlay | 'deal' | 'shuffle'; bet?: number; shoe?: ShoeCard[]; sideBets?: unknown; }
export interface BlackjackHand { cards: ShoeCard[]; bet: number; split: boolean; splitAces: boolean; doubled: boolean; status: 'playing' | 'stood' | 'busted' | 'surrendered'; payout: number; result?: 'win' | 'loss' | 'push' | 'blackjack' | 'surrender'; }
export interface BlackjackRound { id: string; number: number; firstCardIndex: number; shoeNumber: number; openingBalance: number; ante: number; baseBet: number; insuranceBet: number; insuranceReturn: number; hands: BlackjackHand[]; dealer: ShoeCard[]; holeRevealed: boolean; phase: 'insurance' | 'player' | 'settled'; actor: number; net: number | null;
 /** Full table only: the other seated players' hands this round. Their chips are scenery and never reach the ledger. */
 others?: OtherSeatRound[];
 /** Full table only: Hero took even money; the round continues for the other seats. */
 evenMoney?: boolean; }
/** A computer player at a full table. Decisions follow the frozen rules named by `TableSeating.rules`. */
export interface SeatSpec { seat: number; id: string; name: string; style: PlayerStyle; betUnits: number; }
export interface TableSeating { rules: typeof SEAT_RULES_VERSION; heroSeat: number; players: SeatSpec[]; }
export interface OtherSeatRound { seat: number; bet: number; insured: boolean; hands: BlackjackHand[]; plays: { hand: number; play: BlackjackPlay }[]; }
export interface BlackjackLedger { id: string; roundId: string; kind: 'bet' | 'ante' | 'split' | 'double' | 'insurance' | 'settle'; amount: number; }
export interface BlackjackState {
 version: typeof BLACKJACK_ENGINE_VERSION; rules: BlackjackTable; initialBalance: number; ante: number; initialShoe: ShoeCard[];
 revision: number; balance: number; shoe: ShoeCard[]; cursor: number; shoeNumber: number;
 round: BlackjackRound | null; completed: BlackjackRound[]; ledger: BlackjackLedger[]; commands: BlackjackCommand[];
 /** Present only at a full table. A heads-up state has no such key, so its saves and replays are unchanged. */
 seating?: TableSeating;
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
const STYLES: readonly PlayerStyle[] = ['by-the-book', 'never-bust', 'mimic-dealer', 'gambler'];
function verifySeating(seating: TableSeating): void {
 assert(seating && seating.rules === SEAT_RULES_VERSION, 'Unsupported table seating rules');
 assert(Number.isInteger(seating.heroSeat) && seating.heroSeat >= 1 && seating.heroSeat <= SEATS, 'Invalid hero seat');
 assert(Array.isArray(seating.players) && seating.players.length >= 1 && seating.players.length < SEATS, 'A full table seats one to six other players');
 const taken = new Set([seating.heroSeat]), ids = new Set<string>();
 for (const player of seating.players) {
  assert(Number.isInteger(player.seat) && player.seat >= 1 && player.seat <= SEATS && !taken.has(player.seat), 'Invalid or shared seat');
  assert(typeof player.id === 'string' && /^[a-z0-9-]{1,24}$/.test(player.id) && !ids.has(player.id) && typeof player.name === 'string' && player.name.length >= 1 && player.name.length <= 24, 'Invalid seated player');
  assert(STYLES.includes(player.style) && Number.isInteger(player.betUnits) && player.betUnits >= 1 && player.betUnits <= 5, 'Invalid seated player style or bet');
  taken.add(player.seat); ids.add(player.id);
 }
 for (let i = 1; i < seating.players.length; i++) assert(seating.players[i - 1].seat < seating.players[i].seat, 'Seated players must be listed in seat order');
}
export function createBlackjackState(rules: BlackjackTable, shoe: ShoeCard[], options: { balance?: number; ante?: number; seating?: TableSeating } = {}): BlackjackState {
 verifyRules(rules); verifyShoe(shoe, rules.decks);
 const initialBalance = options.balance ?? BLACKJACK_STARTING_BALANCE, ante = options.ante ?? (rules.group === 'home' ? 0 : 50);
 assert(cents(initialBalance), 'Invalid starting balance'); assert([0, 50, 100].includes(ante) && (rules.group !== 'home' || ante === 0), 'Invalid round ante');
 const state: BlackjackState = { version: BLACKJACK_ENGINE_VERSION, rules: clone(rules), initialBalance, ante, initialShoe: [...shoe], revision: 0, balance: initialBalance, shoe: [...shoe], cursor: 0, shoeNumber: 1, round: null, completed: [], ledger: [], commands: [] };
 if (options.seating !== undefined) { verifySeating(options.seating); state.seating = clone(options.seating); }
 return state;
}
const draw = (state: BlackjackState): ShoeCard => { assert(state.cursor < state.shoe.length, 'Shoe exhausted; state unchanged'); return state.shoe[state.cursor++]; };
const addLedger = (state: BlackjackState, cmd: BlackjackCommand, kind: BlackjackLedger['kind'], amount: number): void => {
 assert(Number.isSafeInteger(amount) && cents(state.balance + amount), 'Insufficient balance or invalid amount');
 const id = `${cmd.id}:${kind}`; assert(!state.ledger.some(event => event.id === id), 'Duplicate financial event');
 state.balance += amount; state.ledger.push({ id, roundId: state.round!.id, kind, amount });
};
const hand = (cards: ShoeCard[], bet: number, split = false, splitAces = false): BlackjackHand => ({ cards, bet, split, splitAces, doubled: false, status: 'playing', payout: 0 });
const live = (h: BlackjackHand): boolean => h.status !== 'busted' && h.status !== 'surrendered' && !natural(h);
function settle(state: BlackjackState, cmd: BlackjackCommand, evenMoney = false): void {
 const round = state.round!; assert(round.phase !== 'settled', 'Already settled'); round.holeRevealed = true;
 const dealerBJ = dealerNatural(round), anyLive = round.hands.some(live);
 /* Heads-up: exactly as before. Full table: the dealer draws if any hand at the table is still live. */
 const dealerDraws = round.others ? !dealerBJ && (!evenMoney && anyLive || round.others.some(o => o.hands.some(live))) : !evenMoney && !dealerBJ && anyLive;
 if (dealerDraws) {
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
 if (round.others) for (const o of round.others) for (const h of o.hands) settleOther(h, dealerBJ, dealerTotal, state.rules);
 addLedger(state, cmd, 'settle', round.hands.reduce((sum, h) => sum + h.payout, 0) + round.insuranceReturn);
 round.phase = 'settled'; round.net = state.balance - round.openingBalance; round.actor = -1;
 state.completed.push(clone(round));
}
/* Other seats are settled for display only, by the same rules as Hero's hands. */
function settleOther(h: BlackjackHand, dealerBJ: boolean, dealerTotal: number, rules: BlackjackTable): void {
 const playerTotal = blackjackTotal(h.cards).total;
 if (h.status === 'surrendered') { h.result = 'surrender'; h.payout = h.bet / 2; }
 else if (h.status === 'busted' || dealerBJ && !natural(h)) { h.result = 'loss'; h.payout = 0; }
 else if (natural(h)) { h.result = dealerBJ ? 'push' : 'blackjack'; h.payout = dealerBJ ? h.bet : h.bet + h.bet * (rules.blackjackPays === '3:2' ? 3 : 6) / (rules.blackjackPays === '3:2' ? 2 : 5); }
 else if (dealerTotal > 21 || playerTotal > dealerTotal) { h.result = 'win'; h.payout = h.bet * 2; }
 else if (playerTotal === dealerTotal) { h.result = 'push'; h.payout = h.bet; }
 else { h.result = 'loss'; h.payout = 0; }
}
/** Seated tables shuffle between rounds earlier to allow for several players drawing.
 * This is a practical reserve, not an absolute bound for adversarial split sequences.
 * Exhaustion still rejects an action atomically; it must never alter a player's policy. */
export const blackjackCutAt = (rules: BlackjackTable, seated = false): number => Math.min(Math.floor(rules.decks * 52 * rules.penetration), seated ? rules.decks * 52 - 64 : Infinity);
const seatedShuffleRequired = (state: BlackjackState): boolean => state.cursor >= blackjackCutAt(state.rules, !!state.seating);
function seatLegal(state: BlackjackState, hands: BlackjackHand[], h: BlackjackHand): Play[] {
 const rules = state.rules, two = h.cards.length === 2, split = two && value(h.cards[0]) === value(h.cards[1]) && hands.length < rules.maxHands && (!h.splitAces || rules.resplitAces);
 if (h.splitAces) return ['stand', ...(split ? ['split' as const] : [])];
 return ['hit', 'stand', ...(two && (!h.split || rules.doubleAfterSplit) ? ['double' as const] : []), ...(split ? ['split' as const] : []), ...(two && !h.split && rules.surrender === 'late' ? ['surrender' as const] : [])];
}
/* One other seat plays all its hands, in order, by its style. Cards come off the same shoe Hero's do. */
function playSeat(state: BlackjackState, o: OtherSeatRound): void {
 const round = state.round!, spec = state.seating!.players.find(player => player.seat === o.seat)!, up = value(round.dealer[0]) as Value;
 for (let index = 0; index < o.hands.length;) {
  const h = o.hands[index];
  if (h.cards.length === 1) h.cards.push(draw(state));
  if (h.status === 'playing') {
   const total = blackjackTotal(h.cards).total;
   if (total > 21) h.status = 'busted';
   else if (total === 21) h.status = 'stood';
   else if (h.splitAces && !(state.rules.resplitAces && value(h.cards[1]) === 1 && o.hands.length < state.rules.maxHands)) h.status = 'stood';
  }
  if (h.status !== 'playing') { index++; continue; }
  const legal = seatLegal(state, o.hands, h), play = seatPlay(spec.style, h.cards.map(value) as Value[], up, state.rules, legal) as BlackjackPlay;
  assert(legal.includes(play as Play), 'Seat decision outside its legal actions'); o.plays.push({ hand: index, play });
  if (play === 'hit') h.cards.push(draw(state));
  else if (play === 'stand') h.status = 'stood';
  else if (play === 'surrender') h.status = 'surrendered';
  else if (play === 'double') { h.bet *= 2; h.doubled = true; h.cards.push(draw(state)); h.status = blackjackTotal(h.cards).total > 21 ? 'busted' : 'stood'; }
  else if (play === 'split') { const aces = value(h.cards[0]) === 1; o.hands.splice(index, 1, hand([h.cards[0]], h.bet, true, aces), hand([h.cards[1]], h.bet, true, aces)); }
 }
}
function playOthers(state: BlackjackState, side: 'before' | 'after'): void {
 const round = state.round!, heroSeat = state.seating!.heroSeat;
 for (const o of round.others!) if (side === 'before' ? o.seat < heroSeat : o.seat > heroSeat) playSeat(state, o);
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
 if (round.others) playOthers(state, 'after');
 settle(state, cmd);
}
function afterPeek(state: BlackjackState, cmd: BlackjackCommand): void {
 const round = state.round!;
 if (round.others) {
  /* Full table: a dealer blackjack ends the round for everyone; otherwise seats to Hero's right play first. */
  if (dealerNatural(round)) { settle(state, cmd, round.evenMoney === true); return; }
  round.phase = 'player'; playOthers(state, 'before');
  if (round.evenMoney || natural(round.hands[0])) { round.actor = round.hands.length; playOthers(state, 'after'); settle(state, cmd, round.evenMoney === true); return; }
  advance(state, cmd); return;
 }
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
  assert(!next.round || next.round.phase === 'settled', 'Cannot shuffle an active round'); assert(seatedShuffleRequired(next), 'Cut card not reached');
  assert(cmd.shoe && cmd.bet === undefined, 'Shuffle requires only a shoe'); verifyShoe(cmd.shoe!, next.rules.decks);
  next.shoe = [...cmd.shoe!]; next.cursor = 0; next.shoeNumber++;
 } else if (cmd.type === 'deal') {
  assert(!next.round || next.round.phase === 'settled', 'Round already active');
  assert(!seatedShuffleRequired(next), 'Cut card reached; shuffle before dealing');
  assert(cmd.shoe === undefined && cents(cmd.bet!) && cmd.bet! % 100 === 0 && cmd.bet! >= next.rules.minBet && cmd.bet! <= next.rules.maxBet, 'Illegal bet');
  assert(next.balance >= cmd.bet! + next.ante, 'Insufficient balance for bet and ante');
  next.round = { id: `round:${cmd.id}`, number: next.completed.length + 1, firstCardIndex: next.cursor, shoeNumber: next.shoeNumber, openingBalance: next.balance, ante: next.ante, baseBet: cmd.bet!, insuranceBet: 0, insuranceReturn: 0, hands: [], dealer: [], holeRevealed: false, phase: 'player', actor: 0, net: null };
  addLedger(next, cmd, 'bet', -cmd.bet!); if (next.ante) addLedger(next, cmd, 'ante', -next.ante);
  if (next.seating) {
   /* Casino order: one card to each seat from first base (seat 1) round to third base, the dealer's up card,
      a second card to each seat, then the hole card. Hero's cards come in Hero's seat's turn. */
   const seating = next.seating, minBet = next.rules.minBet, order = [...seating.players.map(p => p.seat), seating.heroSeat].sort((a, b) => a - b);
   const firsts = new Map<number, ShoeCard>(); for (const seat of order) firsts.set(seat, draw(next)); const up = draw(next);
   const seconds = new Map<number, ShoeCard>(); for (const seat of order) seconds.set(seat, draw(next)); const hole = draw(next);
   next.round.hands = [hand([firsts.get(seating.heroSeat)!, seconds.get(seating.heroSeat)!], cmd.bet!)]; next.round.dealer = [up, hole];
   next.round.others = seating.players.map(p => { const bet = Math.min(p.betUnits * minBet, next.rules.maxBet); return { seat: p.seat, bet, insured: value(up) === 1 && seatTakesInsurance(p.style), hands: [hand([firsts.get(p.seat)!, seconds.get(p.seat)!], bet)], plays: [] }; });
  } else {
  const first = draw(next), up = draw(next), second = draw(next), hole = draw(next);
  next.round.hands = [hand([first, second], cmd.bet!)]; next.round.dealer = [up, hole];
  }
  if (value(next.round.dealer[0]) === 1) next.round.phase = 'insurance'; else afterPeek(next, cmd);
 } else {
  assert(cmd.bet === undefined && cmd.shoe === undefined, 'Unexpected action payload'); assert(blackjackLegalActions(next).includes(cmd.type), 'Illegal blackjack action');
  const round = next.round!, h = round.hands[round.actor];
  if (cmd.type === 'insurance' || cmd.type === 'decline-insurance' || cmd.type === 'even-money') {
   if (cmd.type === 'even-money' && round.others) { round.evenMoney = true; afterPeek(next, cmd); }
   else if (cmd.type === 'even-money') settle(next, cmd, true);
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
 let replay = createBlackjackState(candidate.rules, candidate.initialShoe, { balance: candidate.initialBalance, ante: candidate.ante, ...(candidate.seating === undefined ? {} : { seating: candidate.seating }) });
 for (const command of candidate.commands) replay = step(replay, command);
 assert(JSON.stringify(replay) === JSON.stringify(candidate), 'Blackjack replay mismatch'); return replay;
}
/** A strict allow-list. No shoe IDs/order, dealer hole face or private replay journal escapes. */
export function blackjackView(state: BlackjackState) {
 const round = state.round;
 return {
  version: state.version, revision: state.revision, table: state.rules.id, balance: state.balance, ante: state.ante,
  cardsRemaining: state.shoe.length - state.cursor, shuffleRequired: seatedShuffleRequired(state),
  round: round ? { id: round.id, number: round.number, phase: round.phase, dealer: round.dealer.map((card, index) => index === 1 && !round.holeRevealed ? null : card.split(':')[1]), hands: round.hands.map(h => ({ ...h, cards: h.cards.map(card => card.split(':')[1]), ...blackjackTotal(h.cards) })), actor: round.actor, net: round.net, insuranceBet: round.insuranceBet, insuranceReturn: round.insuranceReturn } : null,
  legalActions: blackjackLegalActions(state),
  ...(state.seating ? { seating: seatingView(state) } : {}),
 };
}
/** Full table only: every seat in order. Other players' cards are all face up at a real table, so all of them are public. */
function seatingView(state: BlackjackState) {
 const seating = state.seating!, round = state.round;
 return {
  heroSeat: seating.heroSeat,
  seats: Array.from({ length: SEATS }, (_, i) => {
   const seat = i + 1, player = seating.players.find(p => p.seat === seat), played = round?.others?.find(o => o.seat === seat);
   if (seat === seating.heroSeat) return { seat, kind: 'hero' as const };
   if (!player) return { seat, kind: 'empty' as const };
   return { seat, kind: 'player' as const, id: player.id, name: player.name, style: player.style, bet: played?.bet ?? Math.min(player.betUnits * state.rules.minBet, state.rules.maxBet), insured: played?.insured ?? false, hands: (played?.hands ?? []).map(h => ({ cards: h.cards.map(card => card.split(':')[1]), ...blackjackTotal(h.cards), bet: h.bet, doubled: h.doubled, status: h.status, result: h.result ?? null, payout: h.payout })), lastPlay: played?.plays.at(-1)?.play ?? null };
  }),
 };
}
