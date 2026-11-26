/** Phase 13.6: machine facts computed exactly from the reel strips and pay rules —
 * never estimated, never hand-typed. An independent audit of live V76 proved four
 * promoted top awards could never occur (a five-wild line on machines whose wild
 * never lands on reel one, five Zeus with Zeus on two reels, fifteen pearls on
 * reels that can show nine) and that Crown Wheel's feature is exactly 1 in 23,
 * not the advertised 1 in 22. This module is the antidote: reachability and the
 * floor-card figures (feature frequency for every machine, payback for every
 * machine whose return is a closed-form function of the strips, hit rate for the
 * three-reel machines by full stop enumeration) are derived here from
 * machines.ts data and the engine's own rules. The view reads the corrected
 * machines.ts values; tests/phase13-6 pins the two together so the published
 * figures can never drift from the computed ones again.
 *
 * What is deliberately NOT computed: cascade payback and hit rate (the tumble
 * chain makes the return a recursive process, not a closed form of the initial
 * grid) and hit rate on five-reel and ways machines (the no-win event couples
 * every line through shared reel windows). Those labels stay measured
 * estimates, and the Phase 13.6 report says which is which, machine by machine. */
import type {Machine, Sym} from './engine';
import {spin} from './engine';

/* ------------------------------------------------------------------ strips */

/** The symbols on a reel strip. */
export const stripHas = (strip: readonly Sym[], sym: Sym): boolean => strip.includes(sym);

/** How many of `sym` appear in the fullest window of `rows` consecutive stops
 * (cyclic) on one reel strip — the most of that symbol one reel can show. */
export function maxWindowCount(strip: readonly Sym[], rows: number, sym: Sym): number {
  let best = 0;
  for (let stop = 0; stop < strip.length; stop++) {
    let n = 0;
    for (let r = 0; r < rows; r++) if (strip[(stop + r) % strip.length] === sym) n++;
    if (n > best) best = n;
  }
  return best;
}

/** The most of `sym` a whole spin window can show: the per-reel maxima summed
 * (reels stop independently). Cascade machines draw every cell on its own, so
 * any count up to the whole grid is possible when the symbol has weight. */
export function maxCountAnywhere(m: Machine, sym: Sym): number {
  if (m.cascade) return (m.cascade.weights.some(w => w.sym === sym) ? m.reels.length * m.rows : 0);
  return m.reels.reduce((a, strip) => a + maxWindowCount(strip, m.rows, sym), 0);
}

/** Probability distribution of the total count of `sym` across the spin window,
 * as count → probability. Strip machines: the per-reel window-count
 * distributions convolved (each stop is equally likely). Cascade machines: a
 * binomial over the grid's cells at the symbol's draw weight. */
export function countDistribution(m: Machine, sym: Sym): Map<number, number> {
  if (m.cascade) {
    const total = m.cascade.weights.reduce((a, x) => a + x.w, 0) + m.cascade.bomb.w;
    const p = (m.cascade.weights.find(w => w.sym === sym)?.w ?? 0) / total;
    const cells = m.reels.length * m.rows, out = new Map<number, number>();
    // Binomial probabilities by recurrence from P(0).
    let pk = Math.pow(1 - p, cells);
    out.set(0, pk);
    for (let k = 0; k < cells; k++) { pk = pk * ((cells - k) / (k + 1)) * (p / (1 - p)); out.set(k + 1, pk); }
    return out;
  }
  let dist = new Map<number, number>([[0, 1]]);
  for (const strip of m.reels) {
    const per = new Map<number, number>();
    for (let stop = 0; stop < strip.length; stop++) {
      let n = 0;
      for (let r = 0; r < m.rows; r++) if (strip[(stop + r) % strip.length] === sym) n++;
      per.set(n, (per.get(n) ?? 0) + 1 / strip.length);
    }
    const next = new Map<number, number>();
    for (const [a, pa] of dist) for (const [b, pb] of per) next.set(a + b, (next.get(a + b) ?? 0) + pa * pb);
    dist = next;
  }
  return dist;
}

const probAtLeast = (dist: Map<number, number>, k: number): number => {
  let p = 0;
  for (const [n, pn] of dist) if (n >= k) p += pn;
  return p;
};
const distExpectation = (dist: Map<number, number>, f: (n: number) => number): number => {
  let e = 0;
  for (const [n, pn] of dist) e += pn * f(n);
  return e;
};

/* ------------------------------------------------------------ reachability */

/** The effective cells one reel can show on a line: every symbol that can sit in
 * any row of its window, after an expanding wild fills its reel. A line uses one
 * cell per reel and reels stop independently, so a line award is constructible
 * exactly when its cells can be picked from these sets reel by reel. */
function achievableCells(m: Machine, reel: number): Set<Sym> {
  const strip = m.reels[reel], out = new Set<Sym>();
  for (let stop = 0; stop < strip.length; stop++) {
    const win = Array.from({length: m.rows}, (_, r) => strip[(stop + r) % strip.length]);
    const eff = m.expandWild && win.includes(m.expandWild) ? win.map(() => m.expandWild!) : win;
    for (const s of eff) out.add(s);
  }
  return out;
}

/** Can the engine ever pay `count` of a kind of `sym` on a line? Mirrors the
 * engine's left-to-right line rule: a run starts at reel one, wilds stand in,
 * and a run of pure wilds pays as wilds only when reel one can show the wild.
 * (That is the V76 defect: six machines advertised 3/4/5-wild line awards whose
 * wild never appears on reel one, so the run can never start.) */
export function lineWinReachable(m: Machine, sym: Sym, count: number): boolean {
  if (m.cascade || m.ways) return true; // cluster and ways awards are checked by their own rules
  if (m.reels.length === 3) {
    // Classic and wheel machines: three of a kind (or wilds standing in) on one line.
    if (sym === m.wild) return !!m.wild && m.reels.every(s => stripHas(s, m.wild!));
    const canShow = (strip: readonly Sym[]) => stripHas(strip, sym) || (!!m.wild && stripHas(strip, m.wild));
    return m.reels.every(canShow) && m.reels.some(s => stripHas(s, sym));
  }
  const cells = m.reels.map((_, i) => achievableCells(m, i));
  const breaker = (reel: number) => [...cells[reel]].some(s => s !== sym && s !== m.wild);
  if (sym === m.wild) {
    for (let i = 0; i < count; i++) if (!cells[i].has(sym)) return false;
    return count >= m.reels.length || breaker(count);
  }
  // Reel one shows the symbol itself, so the wild-run comparison can never
  // steal the award; later reels may show the symbol or the wild.
  if (!cells[0].has(sym)) return false;
  for (let i = 1; i < count; i++) if (!cells[i].has(sym) && !(m.wild && cells[i].has(m.wild))) return false;
  return count >= m.reels.length || breaker(count);
}

/* --------------------------------------------------------- feature frequency */

/** The exact probability that one paid spin starts the machine's feature:
 * free spins (scatter count at or past the lowest paying count), Hold & Spin
 * (coins at the trigger), the pick bonus (maps at the trigger), or the bonus
 * wheel (its symbol in its one cell — a count over that reel's strip, which is
 * why Crown Wheel is exactly 2 stops in 46 = 1 in 23). */
export function exactFeatureProbability(m: Machine): number | null {
  if (m.coin) return probAtLeast(countDistribution(m, m.coin.sym), m.coin.trigger);
  if (m.wheel) {
    const strip = m.reels[m.wheel.reel];
    return strip.filter(s => s === m.wheel!.sym).length / strip.length;
  }
  if (m.pick) return probAtLeast(countDistribution(m, m.pick.sym), m.pick.trigger);
  if (m.scatter) return probAtLeast(countDistribution(m, m.scatter.sym), Math.min(...Object.keys(m.scatter.freeSpins).map(Number)));
  return null;
}

/** Expected spins per feature, exactly (null: the machine has no feature). */
export function exactFeatureEvery(m: Machine): number | null {
  const p = exactFeatureProbability(m);
  return p ? 1 / p : null;
}

/* ---------------------------------------------------------------- payback */

/** The distribution of the effective symbol in one cell of a line: uniform over
 * the reel's stops, with an expanding wild filling the reel when it lands. */
export function cellDistribution(m: Machine, reel: number, row: number): Map<Sym, number> {
  const strip = m.reels[reel], out = new Map<Sym, number>();
  for (let stop = 0; stop < strip.length; stop++) {
    let cell = strip[(stop + row) % strip.length];
    if (m.expandWild && cell !== m.expandWild) {
      for (let r = 0; r < m.rows; r++) if (strip[(stop + r) % strip.length] === m.expandWild) { cell = m.expandWild; break; }
    }
    out.set(cell, (out.get(cell) ?? 0) + 1 / strip.length);
  }
  return out;
}

/** Expected pay of one line, in multiples of the line bet, by dynamic
 * programming over the reels. The state is exactly what the engine's line rule
 * looks at: the leading wild run, the first ordinary symbol, and how far its
 * run has travelled before a breaker ends it. */
export function lineExpectedPay(m: Machine, line: readonly number[]): number {
  interface St { run: boolean; first: Sym | null; n: number; w: number; p: number }
  let states: St[] = [{run: true, first: null, n: 0, w: 0, p: 1}];
  for (let reel = 0; reel < m.reels.length; reel++) {
    const dist = cellDistribution(m, reel, line[reel]);
    const next = new Map<string, St>();
    const add = (s: St) => {
      const k = `${s.run}|${s.first}|${s.n}|${s.w}`;
      const e = next.get(k);
      if (e) e.p += s.p; else next.set(k, s);
    };
    for (const st of states) for (const [sym, ps] of dist) {
      const ns: St = {...st, p: st.p * ps};
      if (!st.run) { add(ns); continue; }
      if (sym === m.wild) { if (st.first === null) ns.w = st.w + 1; else ns.n = st.n + 1; add(ns); continue; }
      if (st.first === null) { ns.first = sym; ns.n = st.w + 1; add(ns); continue; }
      if (sym === st.first) { ns.n = st.n + 1; add(ns); continue; }
      ns.run = false; add(ns);
    }
    states = [...next.values()];
  }
  let ev = 0;
  for (const st of states) {
    if (!st.p) continue;
    if (st.first === null) { ev += st.p * (m.wild ? (m.pays[m.wild]?.[m.reels.length] ?? 0) : 0); continue; }
    if (st.first === m.scatter?.sym || st.first === m.coin?.sym || st.first === m.wheel?.sym || st.first === m.scatterPay?.sym) continue;
    ev += st.p * Math.max(m.pays[st.first]?.[st.n] ?? 0, m.wild ? (m.pays[m.wild]?.[st.w] ?? 0) : 0);
  }
  return ev;
}

/** Expected scatter cash of one spin, in multiples of the total bet. */
export function scatterExpectedPay(m: Machine): number {
  if (!m.scatter) return 0;
  const cap = m.cascade ? 6 : 5;
  return distExpectation(countDistribution(m, m.scatter.sym), n => m.scatter!.pays[Math.min(n, cap)] ?? 0);
}

/** Expected scatter-pay (Poseidon's pearls) of one spin, in multiples of the bet. */
export function scatterPayExpectedPay(m: Machine): number {
  if (!m.scatterPay) return 0;
  const tiers = Object.keys(m.scatterPay.pays).map(Number).sort((a, b) => a - b);
  return distExpectation(countDistribution(m, m.scatterPay.sym), n => {
    let pay = 0;
    for (const t of tiers) if (n >= t) pay = m.scatterPay!.pays[t];
    return pay;
  });
}

/** Expected free-spin return of one paid spin, in multiples of the bet, given
 * the expected return of one free spin itself. Each spin grants an expected
 * `granted` further spins, so the chain sums geometrically (the engine's
 * 50-spin cap trims a tail far below float precision at these rates). */
export function freeSpinsExpectedPay(m: Machine, oneFreeSpin: number): number {
  if (!m.scatter) return 0;
  const cap = m.cascade ? 6 : 5;
  const granted = distExpectation(countDistribution(m, m.scatter.sym), n => m.scatter!.freeSpins[Math.min(n, cap)] ?? 0);
  if (!granted) return 0;
  return granted / (1 - granted) * oneFreeSpin;
}

const weightedMean = (list: readonly {x: number; w: number}[]): number =>
  list.reduce((a, v) => a + v.x * v.w, 0) / list.reduce((a, v) => a + v.w, 0);

/** Expected Hold & Spin return of one paid spin, in multiples of the bet. The
 * respin process is a small Markov chain over (coins filled, respins left):
 * each empty cell lands a coin with the machine's land chance, a landing resets
 * the respins to three, and filling the board adds the Grand. */
export function holdExpectedPay(m: Machine): number {
  if (!m.coin) return 0;
  const c = m.coin;
  const cells = m.reels.length * m.rows;
  const dist = countDistribution(m, c.sym);
  const pTrig = probAtLeast(dist, c.trigger);
  if (!pTrig) return 0;
  const binom = (n: number, p: number): Map<number, number> => {
    const out = new Map<number, number>();
    let pk = Math.pow(1 - p, n);
    out.set(0, pk);
    for (let k = 0; k < n; k++) { pk = pk * ((n - k) / (k + 1)) * (p / (1 - p)); out.set(k + 1, pk); }
    return out;
  };
  const memo = new Map<string, {f: number; full: number}>();
  const step = (filled: number, respins: number): {f: number; full: number} => {
    if (filled >= cells) return {f: cells, full: 1};
    if (respins <= 0) return {f: filled, full: 0};
    const key = `${filled}|${respins}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let f = 0, full = 0;
    for (const [j, pj] of binom(cells - filled, c.land)) {
      const s = j === 0 ? step(filled, respins - 1) : step(filled + j, 3);
      f += pj * s.f; full += pj * s.full;
    }
    const out = {f, full};
    memo.set(key, out);
    return out;
  };
  let eFinal = 0, pFull = 0;
  for (const [n, pn] of dist) {
    if (n < c.trigger) continue;
    const s = step(n, 3);
    eFinal += pn / pTrig * s.f; pFull += pn / pTrig * s.full;
  }
  return pTrig * (eFinal * weightedMean(c.values) + pFull * c.grand);
}

/** Expected bonus-wheel return of one paid spin, in multiples of the bet. */
export function wheelExpectedPay(m: Machine): number {
  if (!m.wheel) return 0;
  const strip = m.reels[m.wheel.reel];
  return strip.filter(s => s === m.wheel!.sym).length / strip.length * weightedMean(m.wheel.segments);
}

/** Expected pick-bonus return of one paid spin, in multiples of the bet. */
export function pickExpectedPay(m: Machine): number {
  if (!m.pick) return 0;
  return probAtLeast(countDistribution(m, m.pick.sym), m.pick.trigger) * m.pick.picks * weightedMean(m.pick.prizes);
}

/** The c-value distribution of one reel for a ways symbol: how many cells of
 * the window count toward the way (the symbol itself, plus wilds beyond reel
 * one — in free spins each wild cell carries its own drawn multiplier). */
function waysCDistribution(m: Machine, sym: Sym, reel: number, free: boolean): Map<number, number> {
  const strip = m.reels[reel], out = new Map<number, number>();
  const fw = free ? m.ways?.freeWild : undefined;
  for (let stop = 0; stop < strip.length; stop++) {
    let dist = new Map<number, number>([[0, 1]]);
    for (let r = 0; r < m.rows; r++) {
      const s = strip[(stop + r) % strip.length];
      const add = new Map<number, number>();
      if (s === sym) add.set(1, 1);
      else if (s === m.wild && reel > 0) {
        if (fw) for (const v of fw) add.set(v.x, (add.get(v.x) ?? 0) + v.w / fw.reduce((a, x) => a + x.w, 0));
        else add.set(1, 1);
      } else add.set(0, 1);
      const next = new Map<number, number>();
      for (const [a, pa] of dist) for (const [b, pb] of add) next.set(a + b, (next.get(a + b) ?? 0) + pa * pb);
      dist = next;
    }
    for (const [c, pc] of dist) out.set(c, (out.get(c) ?? 0) + pc / strip.length);
  }
  return out;
}

/** Expected ways return of one spin, in multiples of the total bet. A symbol
 * pays its count tier times the product of its per-reel c-values over the
 * reels its run survives; reels are independent, so the expectation factors. */
export function waysExpectedPay(m: Machine, free: boolean): number {
  let total = 0;
  for (const sym of Object.keys(m.pays).filter(s => s !== m.wild)) {
    const dists = m.reels.map((_, reel) => waysCDistribution(m, sym, reel, free));
    const mean = dists.map(d => distExpectation(d, c => c));
    const pZero = dists.map(d => d.get(0) ?? 0);
    let prefix = 1; // E[product of c over the reels so far] — a zero anywhere zeroes the product
    for (let n = 1; n <= m.reels.length; n++) {
      prefix *= mean[n - 1];
      if (n >= 3) total += (m.pays[sym]?.[n] ?? 0) * prefix * (n === m.reels.length ? 1 : pZero[n]);
    }
  }
  return total / m.ways!.betUnit;
}

/** The three-reel machines (both classics and Wheel of Riches) by full
 * enumeration of reel stops through the engine itself — the same protocol as
 * tests/ux90's exactClassic. The wheel's segment is replaced by its exact
 * expectation (the enumeration's stubbed draw always lands the first segment). */
function exactThreeReel(m: Machine): {rtp: number; hitRate: number} {
  const bet = m.bets[1];
  const wheelAdj = m.wheel ? weightedMean(m.wheel.segments) - m.wheel.segments[0].x : 0;
  let won = 0, hits = 0, total = 0;
  const [a, b, c] = m.reels;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) for (let k = 0; k < c.length; k++) {
    const seq = [i, j, k];
    let n = 0;
    const r = spin(m, bet, () => seq[n++] ?? 0);
    won += r.total + (r.wheel ? wheelAdj * bet : 0);
    if (r.total > 0) hits++;
    total++;
  }
  return {rtp: 100 * won / (total * bet), hitRate: 100 * hits / total};
}

/** The machine's exact payback, percent — or null where the return is not a
 * closed-form function of the strips (cascade machines: the tumble chain). */
export function exactRtp(m: Machine): number | null {
  if (m.cascade) return null;
  if (m.reels.length === 3) return exactThreeReel(m).rtp;
  let base: number; // expected return of one spin before free spins, in multiples of the bet
  let oneFree: number; // expected return of one free spin, same units
  if (m.ways) {
    base = waysExpectedPay(m, false) + scatterExpectedPay(m);
    oneFree = waysExpectedPay(m, true) + scatterExpectedPay(m);
  } else {
    base = m.lines.reduce((a, line) => a + lineExpectedPay(m, line), 0) / m.lines.length
      + scatterExpectedPay(m) + scatterPayExpectedPay(m);
    oneFree = base * (m.scatter?.freeMultiplier ?? 1);
  }
  return 100 * (base + freeSpinsExpectedPay(m, oneFree) + holdExpectedPay(m) + wheelExpectedPay(m) + pickExpectedPay(m));
}

/** The machine's exact hit rate, percent of paid spins that pay anything — by
 * full enumeration on the three-reel machines; null elsewhere (the no-win
 * event on five-reel and ways machines couples every line through shared
 * windows, and a cascade's hit can arrive on any tumble). */
export function exactHitRate(m: Machine): number | null {
  if (m.cascade || m.reels.length !== 3) return null;
  return exactThreeReel(m).hitRate;
}
