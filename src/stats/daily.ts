/** Phase 10 (fun #28 daily card, #2 session goals, #4 streaks): a small versioned
 * daily record, following the StatsBook pattern (strict check on load, plain-language
 * notice instead of silent loss). It stores only baselines and the player's own goal:
 *
 *  - At the first render of a local day, the day's baselines snapshot the counters the
 *    objectives are measured from (cash hands from session records, slot spins and
 *    feature hits from the slots save, ladder regulars beaten, blackjack rounds).
 *    An objective completes when its counter has moved by the target amount since
 *    that baseline — every objective is an instrumented event, never an inference.
 *  - The session goal is the player's own target net (cents) for one cash session id.
 *    Your money, your goal: nothing about it is fabricated or judged.
 *  - Day boundaries use the player's local timezone (the Date on this device). */
import type { StoredHand } from '../session/types';

export const DAILY_KEY = 'poker-night-ai:daily-card';
export interface DailyBaselines { cashHands: number; slotsSpins: number; slotsFeatures: number; ladderBeaten: number; bjRounds: number }
export interface DailyDay { date: string; baselines: DailyBaselines;
 /** True when the day was issued before the blackjack round count could be read:
  * the bj baseline is provisional and is replaced by the true count when it loads
  * (see fixBjBaseline), so old rounds are never credited to today. */
 bjPending?: boolean }
export interface SessionGoal { sessionId: string; targetCents: number }
export interface DailyBook { version: 1; days: Record<string, DailyDay>; sessionGoal: SessionGoal | null }
export const freshDailyBook = (): DailyBook => ({ version: 1, days: {}, sessionGoal: null });

/** The player's local calendar day, YYYY-MM-DD. */
export function localDayKey(at: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
}

const nonNeg = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const int = (n: unknown) => Number.isSafeInteger(n);
function checkBaselines(value: unknown): DailyBaselines {
  const b = value as DailyBaselines;
  if (!b || ![b.cashHands, b.slotsSpins, b.slotsFeatures, b.ladderBeaten, b.bjRounds].every(nonNeg)) throw new Error('Saved daily card is damaged.');
  return { cashHands: b.cashHands, slotsSpins: b.slotsSpins, slotsFeatures: b.slotsFeatures, ladderBeaten: b.ladderBeaten, bjRounds: b.bjRounds };
}
export function checkDailyBook(value: unknown): DailyBook {
  const v = value as DailyBook;
  if (!v || typeof v !== 'object' || v.version !== 1 || !v.days || typeof v.days !== 'object' || Array.isArray(v.days)) throw new Error('Saved daily card is damaged.');
  const days: Record<string, DailyDay> = {};
  for (const [key, day] of Object.entries(v.days)) {
    const d = day as DailyDay;
    if (!d || d.date !== key || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error('Saved daily card is damaged.');
    if (d.bjPending !== undefined && typeof d.bjPending !== 'boolean') throw new Error('Saved daily card is damaged.');
    days[key] = { date: d.date, baselines: checkBaselines(d.baselines), ...(d.bjPending ? { bjPending: true } : {}) };
  }
  const goal = v.sessionGoal === null || v.sessionGoal === undefined ? null : (() => {
    const g = v.sessionGoal as SessionGoal;
    if (!g || typeof g.sessionId !== 'string' || !g.sessionId || !int(g.targetCents)) throw new Error('Saved daily card is damaged.');
    return { sessionId: g.sessionId, targetCents: g.targetCents };
  })();
  return { version: 1, days, sessionGoal: goal };
}
export function readDailyBook(store: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): { book: DailyBook; notice: string } {
  try { const raw = store?.getItem(DAILY_KEY); return { book: raw ? checkDailyBook(JSON.parse(raw)) : freshDailyBook(), notice: '' }; }
  catch { return { book: freshDailyBook(), notice: 'Your daily card could not be read, so it starts fresh today. Your game records are stored separately and were not changed.' }; }
}
export function saveDailyBook(book: DailyBook, store: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null): void { try { store?.setItem(DAILY_KEY, JSON.stringify(book)); } catch { /* this visit only */ } }

/** Issue today's card if it has not been issued yet: the day's baselines are the
 * counters as they stand at first sight of the day. Returns the same book object
 * when the day already exists, so callers can tell whether anything changed. */
export function ensureDay(book: DailyBook, date: string, baselines: DailyBaselines, bjPending = false): DailyBook {
  if (book.days[date]) return book;
  const days: Record<string, DailyDay> = { ...book.days, [date]: { date, baselines, ...(bjPending ? { bjPending: true } : {}) } };
  /* Keep the record small: only the last 14 days are retained. */
  const keys = Object.keys(days).sort();
  while (keys.length > 14) delete days[keys.shift()!];
  return { ...book, days };
}
/** When the blackjack round count finishes loading, replace a provisional baseline
 * with the true count. Rounds played today before the count loaded are excluded
 * (an undercount, never an overcount). Returns the same book when nothing changes. */
export function fixBjBaseline(book: DailyBook, date: string, bjRounds: number): DailyBook {
  const day = book.days[date];
  if (!day?.bjPending) return book;
  const fixed: DailyDay = { date, baselines: { ...day.baselines, bjRounds } };
  return { ...book, days: { ...book.days, [date]: fixed } };
}
export function setSessionGoal(book: DailyBook, goal: SessionGoal | null): DailyBook {
  return { ...book, sessionGoal: goal };
}

export interface DailyObjective { id: string; label: string; have: number; need: number; done: boolean }
export interface DailyCounters extends DailyBaselines { handsToday: number; showdownFreePotsToday: number }
/** The objective pool. Every entry reads a counter that an instrumented record moves:
 * hand timestamps for the two cash lines, save counters for the rest. Wording stays
 * factual — a pot won without a showdown is an event, never a "bluff". */
export const OBJECTIVE_POOL: readonly { id: string; label: string; need: number; read: (c: DailyCounters, b: DailyBaselines) => number }[] = [
  { id: 'hands-10', label: 'Play 10 cash hands', need: 10, read: c => c.handsToday },
  { id: 'pots-3', label: 'Win 3 pots without a showdown', need: 3, read: c => c.showdownFreePotsToday },
  { id: 'slots-25', label: 'Spin the slots 25 times', need: 25, read: (c, b) => c.slotsSpins - b.slotsSpins },
  { id: 'feature-1', label: 'Hit a slot bonus feature', need: 1, read: (c, b) => c.slotsFeatures - b.slotsFeatures },
  { id: 'bj-20', label: 'Play 20 blackjack rounds', need: 20, read: (c, b) => c.bjRounds - b.bjRounds },
  { id: 'ladder-1', label: 'Beat a new heads-up ladder regular', need: 1, read: (c, b) => c.ladderBeaten - b.ladderBeaten },
];
/** Three objectives for the day, chosen by a stable hash of the date so the card does
 * not change between renders. */
export function dailyObjectives(date: string, counters: DailyCounters, baselines: DailyBaselines): DailyObjective[] {
  let h = 0; for (const ch of date) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const pool = [...OBJECTIVE_POOL];
  const picked: typeof pool = [];
  for (let i = 0; i < 3 && pool.length; i++) { h = (Math.imul(h ^ (h >>> 13), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; picked.push(pool.splice(h % pool.length, 1)[0]); }
  return picked.map(o => { const have = Math.max(0, o.read(counters, baselines)); return { id: o.id, label: o.label, have: Math.min(have, o.need), need: o.need, done: have >= o.need }; });
}
/** Today's cash facts from hand timestamps (local day): hands played, and pots the
 * hero won without a showdown (no hand label for hero = nobody saw the cards). */
export function cashToday(hands: readonly StoredHand[], date: string): { handsToday: number; showdownFreePotsToday: number } {
  let handsToday = 0, showdownFreePotsToday = 0;
  for (const hand of hands) {
    if (localDayKey(new Date(hand.startedAt)) !== date) continue;
    handsToday++;
    if (hand.view.handLabels[0] === undefined && (hand.view.payouts[0] ?? 0) > 0) showdownFreePotsToday++;
  }
  return { handsToday, showdownFreePotsToday };
}
/** The current session's hand streak: consecutive settled hands won (net > 0) or lost
 * (net < 0) at the tail of the session, in hand order. Pushes (net 0) end a streak. */
export function handStreak(hands: readonly StoredHand[]): { kind: 'won' | 'lost'; count: number } | null {
  const ordered = [...hands].sort((a, b) => a.number - b.number);
  const last = ordered.at(-1);
  if (!last || last.net === 0) return null;
  const kind = last.net > 0 ? 'won' : 'lost';
  let count = 0;
  for (let i = ordered.length - 1; i >= 0; i--) { if ((ordered[i].net > 0 ? 'won' : ordered[i].net < 0 ? 'lost' : '') === kind) count++; else break; }
  return { kind, count };
}
