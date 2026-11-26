import { describe, expect, it } from 'vitest';
import { MACHINES, machineById } from '../../src/slots/machines';
import { spin, type Machine, type Sym } from '../../src/slots/engine';
import { freshSlots } from '../../src/slots/state';
import { freshSlotsUi, slotsMarkup, topAward, featureAwardsMarkup, moneyExact } from '../../src/slots/view';
import { lineWinReachable, maxCountAnywhere, exactRtp, exactHitRate, exactFeatureEvery } from '../../src/slots/exact';

/* Phase 13.6 — the paytable-truth guard. An independent audit of live V76
 * (CHATGPT-AUDIT-4-2026-11-26 §1–2) proved from the reel layouts that several
 * advertised awards could never occur: standalone wild lines on machines whose
 * wild never lands on reel one, four promoted "top awards" built on those
 * lines (and on fifteen pearls where nine can physically show), pearl tiers
 * above the reachable maximum, and ways awards rounded so the table's
 * arithmetic disagreed with settlement. Game math was NOT changed; the claims
 * were corrected to what the strips can actually produce.
 *
 * This suite is the permanent guard: for every machine it enumerates the
 * advertised awards and proves each one constructible from the reel strips
 * under the pay rules — line awards by driving the real engine with witness
 * stops, ways awards the same way, scatter-pay tiers by a max-count witness,
 * and the promoted top award against hand-verified reachable values. It also
 * pins the floor-card statistics that src/slots/exact.ts computes in closed
 * form, so the published figures can never drift from the strips again. */

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', cents % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
const lineMachines = MACHINES.filter(m => !m.ways && !m.cascade);

/** The window a stop shows on one reel, and the cell a line sees after
 * expansion (an expanding wild fills its reel, so any window containing it
 * reads as the wild on every row). */
function windowAt(m: Machine, reel: number, stop: number): Sym[] {
  const strip = m.reels[reel];
  return Array.from({ length: m.rows }, (_, r) => strip[(stop + r) % strip.length]);
}
function effectiveCell(m: Machine, reel: number, stop: number, row: number): Sym {
  const w = windowAt(m, reel, stop);
  if (m.expandWild && w.includes(m.expandWild)) return m.expandWild;
  return w[row];
}
function findStop(m: Machine, reel: number, row: number, accept: (cell: Sym) => boolean): number {
  for (let stop = 0; stop < m.reels[reel].length; stop++) if (accept(effectiveCell(m, reel, stop, row))) return stop;
  return -1;
}
/** Drive the real engine with queued stops (then 0 for any feature draws). */
function spinWithStops(m: Machine, bet: number, stops: number[]) {
  let n = 0;
  return spin(m, bet, () => stops[n++] ?? 0);
}

describe('advertised line awards are constructible (engine witnesses)', () => {
  for (const m of lineMachines) {
    it(`${m.id}: every reachable pays row is produced by the engine; every unreachable one is not advertised`, () => {
      const line = m.lines[0], lineIdx = 0, bet = m.lines.length * 100, lineBet = bet / m.lines.length;
      for (const [sym, p] of Object.entries(m.pays)) {
        for (let count = 3; count < p.length; count++) {
          if (!p[count]) continue;
          if (!lineWinReachable(m, sym, count)) continue; // asserted un-advertised by the rendered-table guard below
          // Witness: reels before `count` show sym (reel 0) or sym/wild;
          // the reel at `count`, if any, shows a breaker (not sym, not wild).
          const stops: number[] = [];
          for (let reel = 0; reel < m.reels.length; reel++) {
            const row = line[reel];
            let stop = -1;
            if (reel < count) {
              stop = findStop(m, reel, row, c => c === sym);
              if (stop < 0 && sym !== m.wild) stop = findStop(m, reel, row, c => c === m.wild);
              if (stop < 0 && reel === 0) stop = findStop(m, reel, row, c => c === sym || c === m.wild);
            } else if (reel === count) {
              stop = findStop(m, reel, row, c => c !== sym && c !== m.wild);
            } else {
              stop = 0;
            }
            expect(stop, `${m.id} ${sym} x${count}: no witness stop for reel ${reel + 1}`).toBeGreaterThanOrEqual(0);
            stops.push(stop);
          }
          const r = spinWithStops(m, bet, stops);
          const win = r.wins.find(w => w.line === lineIdx && w.sym === sym && w.count === count);
          expect(win, `${m.id} ${sym} x${count}: engine did not pay the advertised win`).toBeDefined();
          expect(win!.amount).toBe(p[count] * lineBet);
        }
      }
    });
  }

  it('the six audited machines have no reachable standalone wild line; Triple Diamond does', () => {
    for (const id of ['gold-rush', 'lucky-lightning', 'pirates-plunder', 'poseidons-bounty', 'crown-wheel', 'olympus-gold']) {
      const m = machineById(id)!;
      for (const count of [3, 4, 5]) expect(lineWinReachable(m, m.wild!, count), `${id} wild x${count}`).toBe(false);
    }
    const td = machineById('triple-diamond')!;
    expect(lineWinReachable(td, td.wild!, 3)).toBe(true); // DW is on reel 1: the 1000× line is real
  });
});

describe('advertised ways awards are constructible (engine witnesses)', () => {
  for (const m of MACHINES.filter(x => x.ways)) {
    it(`${m.id}: every pays row is produced by the engine at exactly one way`, () => {
      const bet = 5000, unitBet = bet / m.ways!.betUnit; // 100: per-way amounts stay whole cents
      for (const [sym, p] of Object.entries(m.pays)) {
        for (let count = 3; count < p.length; count++) {
          if (!p[count]) continue;
          const stops: number[] = [];
          for (let reel = 0; reel < m.reels.length; reel++) {
            let stop = -1;
            if (reel < count) {
              // exactly one sym in the window, and no wild to multiply the count
              for (let s = 0; s < m.reels[reel].length && stop < 0; s++) {
                const w = windowAt(m, reel, s);
                if (w.filter(c => c === sym).length === 1 && !w.includes(m.wild!)) stop = s;
              }
            } else if (reel === count) {
              // a clean break: no sym and no wild anywhere in the window
              for (let s = 0; s < m.reels[reel].length && stop < 0; s++) {
                const w = windowAt(m, reel, s);
                if (!w.includes(sym) && !w.includes(m.wild!)) stop = s;
              }
            } else stop = 0;
            expect(stop, `${m.id} ${sym} x${count}: no witness stop for reel ${reel + 1}`).toBeGreaterThanOrEqual(0);
            stops.push(stop);
          }
          const r = spinWithStops(m, bet, stops);
          const win = r.wins.find(w => w.sym === sym && w.count === count);
          expect(win, `${m.id} ${sym} x${count}: engine did not pay the advertised win`).toBeDefined();
          // amount = pay × unitBet × (ways product): equality at unitBet 100
          // proves the win occurred at exactly one way.
          expect(win!.amount).toBe(Math.round(p[count] * unitBet));
        }
      }
    });
  }
});

describe('scatter-pay tiers stop at the physical maximum', () => {
  it("Poseidon's reels can show nine pearls, never twelve or fifteen", () => {
    const m = machineById('poseidons-bounty')!;
    expect(maxCountAnywhere(m, m.scatterPay!.sym)).toBe(9);
    // Witness: the per-reel stops that maximise pearls show exactly nine,
    // and the engine pays the 9-pearl tier (12× bet) for them.
    const stops = m.reels.map((strip, reel) => {
      let best = 0, bestCount = -1;
      for (let s = 0; s < strip.length; s++) {
        const c = windowAt(m, reel, s).filter(x => x === m.scatterPay!.sym).length;
        if (c > bestCount) { bestCount = c; best = s; }
      }
      return best;
    });
    const r = spinWithStops(m, 100, stops);
    const pearls = r.grid.flat().filter(x => x === m.scatterPay!.sym).length;
    expect(pearls).toBe(9);
    expect(r.scatterWin).toBeGreaterThanOrEqual(12 * 100);
  });
});

describe('promoted top award is the largest REACHABLE single award', () => {
  it('the four corrected machines', () => {
    // Gold Rush: five pickaxes 1350× the $0.25 unit (the $687.50 five-gold line can never land)
    expect(topAward(machineById('gold-rush')!)).toBe(1350 * 25);
    // Pirate's Plunder: five chests 1380× the unit (the $690 five-helm line can never land)
    expect(topAward(machineById('pirates-plunder')!)).toBe(1380 * 25);
    // Olympus Gold: five columns 1200× the unit (five Zeus can never land — Zeus is on two reels)
    expect(topAward(machineById('olympus-gold')!)).toBe(1200 * 25);
    // Poseidon's Bounty: five shells anywhere, 60× the $5 max bet (fifteen pearls can never show)
    expect(topAward(machineById('poseidons-bounty')!)).toBe(60 * 500);
  });
  it('machines whose old callout was already honest keep it', () => {
    expect(topAward(machineById('lucky-lightning')!)).toBe(500000); // the Grand
    expect(topAward(machineById('crown-wheel')!)).toBe(150 * 500); // top wheel segment
    expect(topAward(machineById('triple-diamond')!)).toBe(1000 * 100); // DW is on reel 1
    expect(topAward(machineById('lucky-sevens')!)).toBe(400 * 500);
    expect(topAward(machineById('wheel-of-riches')!)).toBe(250 * 1000);
    for (const m of MACHINES) expect(topAward(m), m.id).toBeGreaterThan(0);
  });
  it('the lobby no longer promotes any unreachable award', () => {
    const html = slotsMarkup(freshSlots(), freshSlotsUi());
    for (const gone of ['$687.50', '$690', '$825', '$900']) expect(html).not.toContain(gone);
    expect(html).toContain('$337.50'); // Gold Rush, corrected
    expect(html).toContain('$345'); // Pirate's Plunder, corrected
    expect(html).toContain('feature ~1 in 23'); // Crown Wheel, computed exactly
    expect(html).not.toContain('feature ~1 in 22');
  });
});

describe('rendered paytables advertise only reachable awards', () => {
  const render = (m: Machine, bet: number) => {
    const ui = freshSlotsUi(); ui.machine = m.id; ui.bet[m.id] = bet;
    return slotsMarkup(freshSlots(), ui);
  };
  it('every line-machine cell matches reachability at max bet', () => {
    for (const m of lineMachines) {
      const bet = m.bets.at(-1)!, unit = bet / m.lines.length, html = render(m, bet);
      for (const [sym, p] of Object.entries(m.pays)) {
        const label = (m.symbols[sym]?.label ?? sym).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
        const rowHtml = html.split('<tr>').find(r => r.includes(`pay-name">${label}<`)) ?? '';
        const cells = [...rowHtml.matchAll(/<td>([^<]*)<\/td>/g)].map(x => x[1]).filter(c => c === '—' || c.startsWith('$'));
        for (let count = 3; count < p.length; count++) {
          const expected = p[count] && lineWinReachable(m, sym, count) ? money(Math.round(p[count] * unit)) : '—';
          expect(cells[count - 3], `${m.id} ${sym} x${count}`).toBe(expected);
        }
      }
    }
  });
  it("Poseidon's paytable and feature awards stop at nine pearls", () => {
    const m = machineById('poseidons-bounty')!;
    const html = render(m, 500);
    expect(html).toContain('9 pay 12×');
    expect(html).not.toContain('12 pay 45×');
    expect(html).not.toContain('15 pay 180×');
    const awards = featureAwardsMarkup(m, 500);
    expect(awards).toContain('(12× bet)');
    expect(awards).not.toContain('(45× bet)');
    expect(awards).not.toContain('(180× bet)');
  });
  it("Gold Rush's paytable drops the wild line but keeps the reachable top line", () => {
    const html = render(machineById('gold-rush')!, 500);
    expect(html).not.toContain('<td>$35</td>'); // gold x3, 140 × $0.25
    expect(html).not.toContain('<td>$137.50</td>'); // gold x4
    expect(html).not.toContain('<td>$687.50</td>'); // gold x5
    expect(html).toContain('<td>$337.50</td>'); // pick x5 — the real top line
  });
  it("Northern Lights' intro matches its engine", () => {
    const html = render(machineById('northern-lights')!, 100);
    expect(html).toContain('6 or more of the same gem');
    expect(html).not.toContain('Eight or more');
    expect(html).toContain('4 pay 1.5× your bet and start 8 free spins');
    expect(html).toContain('6 pay 40× your bet and start 12 free spins');
  });
  it("Gem Cascade's intro still matches its engine", () => {
    const html = render(machineById('gem-cascade')!, 100);
    expect(html).toContain('8 or more of the same gem');
    expect(html).toContain('6 pay 100× your bet and start 10 free spins');
  });
  it('ways paytables show per-way awards exactly, so the arithmetic reproduces settlement', () => {
    const m = machineById('dust-devil')!;
    const html = render(m, 40); // unit = 40/50 = 0.8¢
    expect(html).toContain('units of $0.008');
    expect(html).toContain('<td>$0.176</td>'); // cactus x4: 22 × 0.8¢ — the audit's example
    expect(html).toContain('<td>$0.072</td>'); // cactus x3: 9 × 0.8¢
    expect(html).toContain('rounded once to the nearest cent');
    // the audit's worked example: 17.6¢ × 12 ways rounds once to $2.11, not $2.16
    expect(Math.round(17.6 * 12)).toBe(211);
    expect(moneyExact(17.6)).toBe('$0.176');
    expect(moneyExact(40)).toBe('$0.40');
  });
});

describe('floor-card statistics are computed from the strips where a closed form exists', () => {
  it('payback: computed for every non-cascade machine and pinned to machines.ts', () => {
    for (const m of MACHINES) {
      const computed = exactRtp(m);
      if (m.cascade) { expect(computed, m.id).toBeNull(); continue; } // tumble chain: still a measured estimate
      expect(computed, m.id).not.toBeNull();
      expect(Math.abs(computed! - m.rtp), `${m.id}: label ${m.rtp} vs computed ${computed}`).toBeLessThanOrEqual(0.051);
    }
  });
  it('hit rate: computed exactly for the three-reel machines', () => {
    for (const id of ['lucky-sevens', 'wheel-of-riches', 'triple-diamond']) {
      const m = machineById(id)!;
      const computed = exactHitRate(m);
      expect(computed).not.toBeNull();
      expect(Math.abs(computed! - m.stats.hitRate), `${id}: label ${m.stats.hitRate} vs computed ${computed}`).toBeLessThanOrEqual(0.051);
    }
  });
  it('feature frequency: computed for every machine that has one', () => {
    for (const m of MACHINES) {
      if (!m.stats.featureEvery) continue;
      const computed = exactFeatureEvery(m);
      expect(computed, m.id).not.toBeNull();
      expect(Math.abs(computed! - m.stats.featureEvery), `${m.id}: label ${m.stats.featureEvery} vs computed ${computed}`).toBeLessThanOrEqual(0.51);
    }
    expect(exactFeatureEvery(machineById('crown-wheel')!)).toBeCloseTo(23, 6); // 2 stops on a 46-stop reel
  });
  it('computed payback lands inside the independent audit\'s 6M-spin measurements', () => {
    // CHATGPT-AUDIT-4-2026-11-26 §1: measured RTP per machine; margins stated
    // for Olympus Gold, Stampede Run and Lucky Lightning, 0.35 allowed elsewhere.
    const audit: Record<string, { measured: number; margin: number }> = {
      'lucky-sevens': { measured: 94.50, margin: 0.35 },
      'wheel-of-riches': { measured: 94.61, margin: 0.35 },
      'gold-rush': { measured: 95.62, margin: 0.35 },
      'lucky-lightning': { measured: 95.08, margin: 1.34 },
      'triple-diamond': { measured: 94.52, margin: 0.35 },
      'dust-devil': { measured: 94.93, margin: 0.35 },
      'pirates-plunder': { measured: 95.40, margin: 0.35 },
      'stampede-run': { measured: 94.97, margin: 0.32 },
      'poseidons-bounty': { measured: 95.67, margin: 0.35 },
      'crown-wheel': { measured: 95.26, margin: 0.35 },
      'olympus-gold': { measured: 94.86, margin: 0.32 },
    };
    for (const [id, a] of Object.entries(audit)) {
      const computed = exactRtp(machineById(id)!)!;
      expect(Math.abs(computed - a.measured), `${id}: computed ${computed.toFixed(2)} vs audit ${a.measured} ±${a.margin}`).toBeLessThanOrEqual(a.margin);
    }
  });
});
