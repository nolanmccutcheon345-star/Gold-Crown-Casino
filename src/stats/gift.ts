/**
 * Phase 14 (CB-U05): the daily chip gift — a flat, transparent $100 of virtual
 * chips, claimable once per local calendar day. No wheel, no random amount, no
 * countdown theatre: the card says the amount, whether today's is claimed, and
 * the date the next one becomes available. That is the whole mechanic.
 *
 * The amount: $100 is one full buy-in at the starter $1/$2 table's 50bb floor
 * and 1% of the $10,000 starting bankroll — a real seat's worth of chips, not
 * a token drip, and small enough that claiming every day for a month ($3,000)
 * still leaves the bankroll meaningful.
 *
 * The gift is credited to the cash bankroll through the session controller's
 * existing bankroll-adjustment path (a ledger entry, like any manual
 * adjustment), so it is ordinary money in an existing wallet: the hybrid
 * wallet's cash line includes it and the unified total reconciles exactly.
 * This record only remembers the claim state; it never holds money itself.
 * It follows the DailyBook pattern — strict check on load, a plain-language
 * notice instead of silent loss.
 */
import { localDayKey } from './daily';

export const GIFT_KEY = 'poker-night-ai:daily-gift';
export const DAILY_GIFT_CENTS = 10000;

export interface GiftBook { version: 1; lastClaimDate: string | null; claims: number; totalClaimed: number }
export const freshGiftBook = (): GiftBook => ({ version: 1, lastClaimDate: null, claims: 0, totalClaimed: 0 });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const nonNeg = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
export function checkGiftBook(value: unknown): GiftBook {
  const v = value as GiftBook;
  if (!v || typeof v !== 'object' || v.version !== 1) throw new Error('Saved daily gift is damaged.');
  if (!(v.lastClaimDate === null || (typeof v.lastClaimDate === 'string' && DAY.test(v.lastClaimDate)))) throw new Error('Saved daily gift is damaged.');
  if (!nonNeg(v.claims) || !nonNeg(v.totalClaimed)) throw new Error('Saved daily gift is damaged.');
  return { version: 1, lastClaimDate: v.lastClaimDate, claims: v.claims, totalClaimed: v.totalClaimed };
}
export function readGiftBook(store: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): { book: GiftBook; notice: string } {
  try { const raw = store?.getItem(GIFT_KEY); return { book: raw ? checkGiftBook(JSON.parse(raw)) : freshGiftBook(), notice: '' }; }
  catch { return { book: freshGiftBook(), notice: 'Your daily gift record could not be read, so it starts fresh. Your balances and game records are stored separately and were not changed.' }; }
}
export function saveGiftBook(book: GiftBook, store: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null): void { try { store?.setItem(GIFT_KEY, JSON.stringify(book)); } catch { /* this visit only */ } }

/** Today's gift can be claimed when the last claim was on an earlier local day. */
export const giftAvailable = (book: GiftBook, date: string = localDayKey()): boolean => book.lastClaimDate !== date;

/** Record a claim for `date`. Throws when today's gift was already claimed —
 * the once-a-day rule lives here, not just in the button. */
export function claimGift(book: GiftBook, date: string = localDayKey()): GiftBook {
  if (!DAY.test(date)) throw new Error('Invalid claim date.');
  if (book.lastClaimDate === date) throw new Error('Today’s gift has already been claimed.');
  return { version: 1, lastClaimDate: date, claims: book.claims + 1, totalClaimed: book.totalClaimed + DAILY_GIFT_CENTS };
}

/** The local calendar date after `date` (YYYY-MM-DD), for "next gift" wording. */
export function nextDayKey(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return localDayKey(d);
}
