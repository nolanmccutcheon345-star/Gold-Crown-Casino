/** Phase 14 (CB-U05): the daily chip gift — once per local calendar day,
 * flat amount, honest state. The record never holds money; it only remembers
 * claims, so these tests pin the claim rules themselves. */
import { describe, expect, it } from 'vitest';
import { DAILY_GIFT_CENTS, checkGiftBook, claimGift, freshGiftBook, giftAvailable, nextDayKey, readGiftBook, saveGiftBook, GIFT_KEY } from '../../src/stats/gift';

const store = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map };
};

describe('daily gift claims', () => {
  it('is a flat $100, claimable once per local day', () => {
    expect(DAILY_GIFT_CENTS).toBe(10000);
    let book = freshGiftBook();
    expect(giftAvailable(book, '2026-11-26')).toBe(true);
    book = claimGift(book, '2026-11-26');
    expect(book).toMatchObject({ lastClaimDate: '2026-11-26', claims: 1, totalClaimed: 10000 });
    expect(giftAvailable(book, '2026-11-26')).toBe(false);
    expect(() => claimGift(book, '2026-11-26')).toThrow(/already been claimed/);
    expect(giftAvailable(book, '2026-11-27')).toBe(true);
    book = claimGift(book, '2026-11-27');
    expect(book).toMatchObject({ claims: 2, totalClaimed: 20000 });
  });

  it('next day rolls over month and year ends', () => {
    expect(nextDayKey('2026-11-26')).toBe('2026-11-27');
    expect(nextDayKey('2026-11-30')).toBe('2026-12-01');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
  });

  it('survives a reload between claim and re-render: exactly one gift per day', () => {
    /* The claim flow re-reads the durable record at claim time. Simulate the
     * double-tap / second tab / reload cases at that level: after the claim
     * is saved, any fresh reader sees the day as claimed and a second claim
     * is refused by the module itself. */
    const s = store();
    saveGiftBook(claimGift(readGiftBook(s).book, '2026-11-26'), s);
    const reread = readGiftBook(s).book;
    expect(giftAvailable(reread, '2026-11-26')).toBe(false);
    expect(() => claimGift(reread, '2026-11-26')).toThrow(/already been claimed/);
    expect(reread.totalClaimed).toBe(DAILY_GIFT_CENTS);
    /* Restoring yesterday's backup on a later day restores yesterday's
     * balance with it — the new day's gift is legitimately claimable, and
     * yesterday's cannot be claimed twice. */
    expect(giftAvailable(reread, '2026-11-27')).toBe(true);
  });

  it('round-trips through storage, and a damaged record starts fresh with a notice', () => {
    const s = store();
    saveGiftBook(claimGift(freshGiftBook(), '2026-11-26'), s);
    const back = readGiftBook(s);
    expect(back.notice).toBe('');
    expect(back.book.lastClaimDate).toBe('2026-11-26');
    s.map.set(GIFT_KEY, '{"version":2}');
    const damaged = readGiftBook(s);
    expect(damaged.book).toEqual(freshGiftBook());
    expect(damaged.notice).toMatch(/starts fresh/);
    expect(() => checkGiftBook({ version: 1, lastClaimDate: '26/11/2026', claims: 0, totalClaimed: 0 })).toThrow();
    expect(() => checkGiftBook({ version: 1, lastClaimDate: null, claims: -1, totalClaimed: 0 })).toThrow();
  });
});
