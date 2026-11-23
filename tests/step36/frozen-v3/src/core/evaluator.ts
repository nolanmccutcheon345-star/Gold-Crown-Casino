import type { Card } from '../contracts';

export function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function five(cards: Card[]): number[] {
  const ranks = cards.map(c => '23456789TJQKA'.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach(r => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(c => c[1] === cards[0][1]);
  const unique = [...counts.keys()].sort((a, b) => b - a);
  let straight = unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : 0;
  if (unique.join(',') === '14,5,4,3,2') straight = 5;
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(g => g[0])];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...groups.map(g => g[0])];
  if (groups[0][1] === 2) return [1, ...groups.map(g => g[0])];
  return [0, ...ranks];
}

/** Lexicographic best five-card rank; larger wins. Suits never break a tie. */
export function evaluate(cards: Card[]): number[] {
  if (cards.length < 5 || cards.length > 7 || new Set(cards).size !== cards.length || cards.some(c => !/^[2-9TJQKA][cdhs]$/.test(c))) {
    throw new Error('Evaluator requires 5–7 unique valid cards');
  }
  let best: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const rank = five([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best.length || compareRanks(rank, best) > 0) best = rank;
          }
  return best;
}

/** Human-readable best-five label. Callers must enforce showdown visibility. */
export function handLabel(rank:number[]):string {
  const names=['','','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Jack','Queen','King','Ace'];
  const plurals=['','','twos','threes','fours','fives','sixes','sevens','eights','nines','tens','jacks','queens','kings','aces'];
  switch(rank[0]) {
    case 8: return rank[1]===14?'Royal flush':`${names[rank[1]]}-high straight flush`;
    case 7: return `Four ${plurals[rank[1]]}`;
    case 6: return `Full house, ${plurals[rank[1]]} over ${plurals[rank[2]]}`;
    case 5: return `${names[rank[1]]}-high flush`;
    case 4: return `${names[rank[1]]}-high straight`;
    case 3: return `Three ${plurals[rank[1]]}`;
    case 2: return `Two pair, ${plurals[rank[1]]} and ${plurals[rank[2]]}`;
    case 1: return `Pair of ${plurals[rank[1]]}`;
    default: return `${names[rank[1]]} high`;
  }
}
