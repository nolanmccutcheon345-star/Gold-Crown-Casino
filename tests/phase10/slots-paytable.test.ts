import { describe, expect, it } from 'vitest';
import { MACHINES, machineById } from '../../src/slots/machines';
import { freshSlots } from '../../src/slots/state';
import { freshSlotsUi, slotsMarkup, topAward, featureAwardsMarkup } from '../../src/slots/view';

/* Phase 10: P10-F05 (paytable bet-size switcher, view-only), P10-F06 (jackpot and
 * feature awards in dollars), P10-F09 (top-award callout data). All display math is
 * multipliers from machines.ts times a bet size — no engine behaviour is touched. */

describe('P10-F09 top award (from published machine data, at max bet)', () => {
  it('Lucky Lightning tops out at the Grand: 1000× the $5 max bet = $5,000', () => {
    expect(topAward(machineById('lucky-lightning')!)).toBe(500000);
  });
  it('Crown Wheel tops out at its 150× wheel segment, not its top line', () => {
    expect(topAward(machineById('crown-wheel')!)).toBe(150 * 500);
  });
  it('Olympus Gold tops out at the Zeus line: 3300× the $0.25 max-bet unit', () => {
    expect(topAward(machineById('olympus-gold')!)).toBe(3300 * 25);
  });
  it('every machine has a positive top award', () => {
    for (const m of MACHINES) expect(topAward(m), m.id).toBeGreaterThan(0);
  });
});

describe('P10-F06 feature & jackpot awards in dollars', () => {
  it('Lucky Lightning lists Mini/Minor/Major coin values and the Grand in dollars', () => {
    const html = featureAwardsMarkup(machineById('lucky-lightning')!, 500);
    expect(html).toContain('Mini coin');
    expect(html).toContain('$100'); // Mini 20× $5
    expect(html).toContain('$750'); // Major 150× $5
    expect(html).toContain('Grand');
    expect(html).toContain('$5,000'); // Grand 1000× $5
  });
  it('wheel machines list every segment as money', () => {
    const html = featureAwardsMarkup(machineById('wheel-of-riches')!, 1000);
    expect(html).toContain('$2,500'); // top segment 250× $10
    expect(html).toContain('$50'); // bottom segment 5× $10
  });
  it("Pirate's Plunder lists every chest prize tier", () => {
    const html = featureAwardsMarkup(machineById('pirates-plunder')!, 500);
    expect(html).toContain('$250'); // 50× $5
    expect(html).toContain('$10'); // 2× $5
  });
  it('scatter pays become rows with dollars and free-spin counts', () => {
    const html = featureAwardsMarkup(machineById('gold-rush')!, 500);
    expect(html).toContain('$300'); // 5 scatters pay 60× $5
    expect(html).toContain('20 free spins');
  });
  it('a machine with no feature awards renders no section', () => {
    expect(featureAwardsMarkup(machineById('lucky-sevens')!, 500)).toBe('');
  });
});

describe('P10-F05 paytable bet-size switcher (view-only)', () => {
  it('renders the paytable at the viewed size while the spin bet stays put', () => {
    const ui = freshSlotsUi();
    const m = machineById('lucky-lightning')!;
    ui.machine = m.id; ui.bet[m.id] = 20; ui.payBet[m.id] = 500;
    const html = slotsMarkup(freshSlots(), ui);
    expect(html).toContain('Paytable at $5 a spin');
    expect(html).toContain('Viewing only — your spin bet stays $0.20');
    expect(html).toContain('data-slot-paybet="500"');
    expect(html).toContain('$5,000'); // the Grand, at the viewed size
  });
  it('falls back to the active bet when no view size is chosen', () => {
    const ui = freshSlotsUi();
    const m = machineById('lucky-sevens')!;
    ui.machine = m.id; ui.bet[m.id] = 100;
    const html = slotsMarkup(freshSlots(), ui);
    expect(html).toContain('Paytable at $1 a spin');
    expect(html).not.toContain('Viewing only');
  });
  it('every machine paytable carries the switcher with all five bet sizes', () => {
    for (const m of MACHINES) {
      const ui = freshSlotsUi(); ui.machine = m.id;
      const html = slotsMarkup(freshSlots(), ui);
      for (const b of m.bets) expect(html, `${m.id} @ ${b}`).toContain(`data-slot-paybet="${b}"`);
    }
  });
});
