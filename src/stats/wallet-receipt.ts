/** Phase 14 (CB-U03): the one-time combined-statement receipt. The unified
 * wallet moves nothing — every cent stays in the game's own wallet — but the
 * first time a save meets the combined view, the player gets a dated
 * statement of what each game held at that moment, so the new total can be
 * followed back to the old balances line by line.
 *
 * The receipt is written exactly once: if a record exists (even from a
 * restored backup of the same save), it is never re-issued, and it carries
 * no money with it — re-opening or restoring a save can never grant a
 * second opening balance, because the receipt is a statement, not a credit.
 * New players start with the same per-game starting balances the games have
 * always granted ($10,000 cash · $2,000 tournaments · $2,000 blackjack ·
 * $5,000 Omaha · $1,000 slots · $1,000 casino tables); the combined view
 * changes none of them. */
const demand = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };

export const WALLET_RECEIPT_KEY = 'poker-night-ai:wallet-receipt';
export interface WalletReceiptLine { id: string; label: string; available: number; inPlay: number }
export interface WalletReceipt { version: 1; at: string; lines: WalletReceiptLine[]; total: number }

export function checkWalletReceipt(value: unknown): WalletReceipt {
  demand(typeof value === 'object' && value !== null, 'Wallet receipt is damaged.');
  const r = value as WalletReceipt;
  demand(r.version === 1 && typeof r.at === 'string' && Array.isArray(r.lines) && r.lines.length > 0, 'Wallet receipt is damaged.');
  for (const line of r.lines) demand(typeof line?.id === 'string' && typeof line?.label === 'string' && Number.isSafeInteger(line?.available) && Number.isSafeInteger(line?.inPlay), 'Wallet receipt is damaged.');
  demand(Number.isSafeInteger(r.total) && r.total === r.lines.reduce((a, l) => a + l.available + l.inPlay, 0), 'Wallet receipt is damaged.');
  return { version: 1, at: r.at, lines: r.lines.map(l => ({ id: l.id, label: l.label, available: l.available, inPlay: l.inPlay })), total: r.total };
}

export function readWalletReceipt(store: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): { receipt: WalletReceipt | null; notice: string } {
  try {
    const raw = store?.getItem(WALLET_RECEIPT_KEY);
    if (!raw) return { receipt: null, notice: '' };
    return { receipt: checkWalletReceipt(JSON.parse(raw)), notice: '' };
  } catch { return { receipt: null, notice: 'Your saved combined-wallet statement could not be read, so a fresh one will be issued.' }; }
}

export function saveWalletReceipt(receipt: WalletReceipt, store: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null): void {
  try { store?.setItem(WALLET_RECEIPT_KEY, JSON.stringify(receipt)); } catch { /* the statement is informational; play is unaffected */ }
}

/** Issue the receipt if this save has never had one. Returns the receipt and
 * whether this call created it (the UI shows the statement only then). */
export function ensureWalletReceipt(lines: WalletReceiptLine[], store: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null, at = new Date()): { receipt: WalletReceipt; created: boolean } {
  const existing = readWalletReceipt(store).receipt;
  if (existing) return { receipt: existing, created: false };
  const receipt: WalletReceipt = { version: 1, at: at.toISOString(), lines, total: lines.reduce((a, l) => a + l.available + l.inPlay, 0) };
  saveWalletReceipt(receipt, store);
  return { receipt, created: true };
}
