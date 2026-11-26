/** Phase 14 (CB-U03): the one-time combined-statement receipt. It is issued
 * exactly once per save, carries no money, and can never be re-issued by
 * reopening or restoring the same save — so it can never act as a second
 * opening balance. */
import { describe, expect, it } from 'vitest';
import { checkWalletReceipt, ensureWalletReceipt, readWalletReceipt, WALLET_RECEIPT_KEY, type WalletReceiptLine } from '../../src/stats/wallet-receipt';

const store = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map };
};
const lines = (cash: number): WalletReceiptLine[] => [
  { id: 'cash', label: 'Poker cash', available: cash, inPlay: 0 },
  { id: 'slots', label: 'Slots', available: 100_00, inPlay: 0 },
];

describe('wallet receipt', () => {
  it('is issued once, with the total reconciling to its lines', () => {
    const s = store();
    const first = ensureWalletReceipt(lines(1_000_000), s, new Date('2026-11-26T12:00:00Z'));
    expect(first.created).toBe(true);
    expect(first.receipt.total).toBe(1_010_000);
    /* A later visit — even with different balances — gets the same receipt. */
    const second = ensureWalletReceipt(lines(5), s, new Date('2026-11-27T12:00:00Z'));
    expect(second.created).toBe(false);
    expect(second.receipt).toEqual(first.receipt);
    expect(readWalletReceipt(s).receipt?.total).toBe(1_010_000);
  });

  it('a restored backup carrying a receipt never earns a second one', () => {
    const s = store();
    const issued = ensureWalletReceipt(lines(1_000_000), s).receipt;
    /* Simulate restoring the same save into a fresh store: the receipt comes
     * with it, so nothing new is issued and nothing is credited. */
    const restored = store();
    restored.map.set(WALLET_RECEIPT_KEY, JSON.stringify(issued));
    const again = ensureWalletReceipt(lines(999), restored);
    expect(again.created).toBe(false);
    expect(again.receipt.total).toBe(issued.total);
  });

  it('a damaged receipt is rejected, and a tampered total fails validation', () => {
    expect(() => checkWalletReceipt({ version: 1, at: 'x', lines: lines(100), total: 42 })).toThrow();
    expect(() => checkWalletReceipt({ version: 2, at: 'x', lines: lines(100), total: 100 + 100_00 })).toThrow();
    const s = store();
    s.map.set(WALLET_RECEIPT_KEY, '{not json');
    const read = readWalletReceipt(s);
    expect(read.receipt).toBeNull();
    expect(read.notice).toMatch(/fresh one will be issued/);
  });
});
