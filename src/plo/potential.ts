/**
 * Phase 10 (fun #8): Omaha hand-potential display — what Hero holds now and what
 * Hero is drawing to, computed from Hero's four cards and the board only, under
 * Omaha's rule (exactly two hole cards, three board cards). Draw labels follow the
 * usual conventions (a wrap has three or more ranks that complete the straight);
 * out counts are the unseen cards that complete the draw, the standard way outs
 * are counted at a table. Nothing here reads another player's cards or the deck.
 */
import type { Card } from '../contracts';
import { compareRanks, evaluate, handLabel } from '../core/evaluator';

const RANK: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const rankOf = (c: Card) => RANK[c[0]];
const suitOf = (c: Card) => c[1];

export interface OmahaPotential { made: string; draws: string[] }

/** Every legal Omaha five-card combination from hole + board (board of 3 or 4). */
function combos(hole: Card[], board: Card[]): Card[][] {
  const out: Card[][] = [];
  for (let a = 0; a < hole.length; a++) for (let b = a + 1; b < hole.length; b++)
    for (let x = 0; x < board.length; x++) for (let y = x + 1; y < board.length; y++) for (let z = y + 1; z < board.length; z++)
      out.push([hole[a], hole[b], board[x], board[y], board[z]]);
  return out;
}

const hasStraight = (ranks: ReadonlySet<number>): boolean => {
  const withWheel = new Set(ranks); if (withWheel.has(14)) withWheel.add(1);
  for (let hi = 14; hi >= 5; hi--) if ([0, 1, 2, 3, 4].every(d => withWheel.has(hi - d))) return true;
  return false;
};

export function omahaPotential(hole: Card[], board: Card[]): OmahaPotential | null {
  if (hole.length !== 4 || hole.some(c => !c) || (board.length !== 3 && board.length !== 4)) return null;
  const sets = combos(hole, board);
  let best: number[] | null = null;
  for (const set of sets) { const r = evaluate(set); if (!best || compareRanks(r, best) > 0) best = r; }
  if (!best) return null;
  const category = best[0];
  const draws: string[] = [];
  const known = [...hole, ...board];

  /* Flush draw: exactly two of a suit in hand and two on board (one card away),
   * with at least two suited hole cards so the flush is legally makeable. */
  if (category < 5) {
    for (const suit of ['c', 'd', 'h', 's']) {
      const inHand = hole.filter(c => suitOf(c) === suit), onBoard = board.filter(c => suitOf(c) === suit);
      if (inHand.length >= 2 && onBoard.length >= 2 && inHand.length + onBoard.length === 4) {
        const outs = 13 - inHand.length - onBoard.length;
        /* The nut draw: no higher card of the suit is unseen — Hero holds it, or it
         * is already on the board where nobody can hold it against him. */
        const heroTop = Math.max(...inHand.map(rankOf));
        const higherAccounted = Array.from({ length: 14 - heroTop }, (_, i) => heroTop + 1 + i).every(r => onBoard.some(c => rankOf(c) === r) || inHand.some(c => rankOf(c) === r));
        draws.push(`${higherAccounted ? 'Nut flush draw' : 'Flush draw'} (${outs} outs)`);
      }
    }
  }

  /* Straight draws: ranks that would complete a straight for some legal combo. */
  if (category < 4) {
    const outRanks = new Set<number>();
    for (const set of sets) {
      const ranks = new Set(set.map(rankOf));
      for (let r = 2; r <= 14; r++) if (!ranks.has(r)) { const t = new Set(ranks); t.add(r); if (hasStraight(t)) outRanks.add(r); }
    }
    if (outRanks.size) {
      const outCards = [...outRanks].reduce((sum, r) => sum + (4 - known.filter(c => rankOf(c) === r).length), 0);
      const kind = outRanks.size >= 3 ? 'Wrap' : outRanks.size === 2 ? 'Open-ended straight draw' : 'Gutshot straight draw';
      draws.push(`${kind} (${outCards} outs)`);
    }
  }

  return { made: handLabel(best), draws };
}
