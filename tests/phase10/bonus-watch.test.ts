import { describe, expect, it } from 'vitest';
import { machineById } from '../../src/slots/machines';
import { checkSlots, freshSlots, playSpin, type SlotsState } from '../../src/slots/state';
import { bonusWatchMarkup } from '../../src/slots/view';

/* Phase 10 (fun #15): the BONUS WATCH — spins since the last feature plus features
 * hit vs expected at the published rate, labelled as history. It is a counter, not
 * a meter: these tests pin the counting and the honest wording. */
const seq = (seed: number) => { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return Math.floor((s >>> 0) / 4294967296 * n); }; };

describe('bonus watch counters', () => {
  it('counts spins, resets "since" on a feature, and never touches the machine record shape', () => {
    const m = machineById('gold-rush')!;
    let s: SlotsState = { ...freshSlots(), balance: 100000000 };
    const r = seq(7);
    let sawFeature = false;
    for (let i = 0; i < 400 && !sawFeature; i++) {
      const before = s.watch?.[m.id] ?? { since: 0, hits: 0, spins: 0 };
      const p = playSpin(s, m, m.bets[0], r); s = p.state;
      const w = s.watch![m.id];
      const hit = !!(p.result.free || p.result.hold || p.result.wheel || p.result.pick);
      expect(w.spins).toBe(before.spins + 1);
      expect(w.hits).toBe(before.hits + (hit ? 1 : 0));
      expect(w.since).toBe(hit ? 0 : before.since + 1);
      if (hit) sawFeature = true;
    }
    expect(sawFeature).toBe(true);
    expect(Object.keys(s.machines[m.id]).sort()).toEqual(['biggest', 'features', 'spins', 'wagered', 'won']);
  });

  it('old saves without a watch field still validate, and watched saves round-trip', () => {
    const m = machineById('gold-rush')!;
    let s: SlotsState = { ...freshSlots(), balance: 100000000 };
    s = playSpin(s, m, m.bets[0], seq(3)).state;
    const round = checkSlots(JSON.parse(JSON.stringify(s)));
    expect(round.watch?.[m.id]?.spins).toBe(1);
    const legacy = checkSlots(JSON.parse(JSON.stringify(freshSlots())));
    expect(legacy.watch).toBeUndefined();
  });

  it('the display is labelled history and never says a feature is due', () => {
    const m = machineById('gold-rush')!;
    const s: SlotsState = { ...freshSlots(), watch: { [m.id]: { since: 41, hits: 2, spins: 150 } } };
    const html = bonusWatchMarkup(s, m);
    expect(html).toContain('<b>41 spins</b>');
    expect(html).toContain('History only');
    expect(html).toContain('no feature is ever due');
    expect(html).not.toMatch(/progress|almost there|getting closer/i);
  });

  it('machines with no feature show no watch', () => {
    const m = machineById('lucky-sevens')!;
    const s: SlotsState = { ...freshSlots(), watch: { [m.id]: { since: 9, hits: 0, spins: 9 } } };
    expect(bonusWatchMarkup(s, m)).toBe('');
  });
});
