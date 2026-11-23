import { describe, expect, it } from 'vitest';
import { blindSchedule, entryCost, EVENT_PRESETS, handsPerLevel, payoutLadder, placesPaid, stakeBand, startingBigBlinds, summarizeEvent } from '../../src/tournament/presets';

describe('tournament presets', () => {
  it('has unique ids and covers home, casino and series tiers at low, mid and high stakes', () => {
    expect(new Set(EVENT_PRESETS.map(preset => preset.id)).size).toBe(EVENT_PRESETS.length);
    expect(new Set(EVENT_PRESETS.map(preset => preset.tier))).toEqual(new Set(['home', 'casino', 'series']));
    expect(new Set(EVENT_PRESETS.map(stakeBand))).toEqual(new Set(['low', 'mid', 'high']));
  });
  it.each(EVENT_PRESETS.map(preset => [preset.id, preset] as const))('%s is internally consistent', (_id, preset) => {
    expect(preset.buyIn % 100).toBe(0); expect(preset.fee % 100).toBe(0); expect(entryCost(preset)).toBeGreaterThan(0);
    if (preset.tier === 'home') expect(preset.fee).toBe(0); else expect(preset.fee).toBeGreaterThan(0);
    expect(preset.fee).toBeLessThanOrEqual(preset.buyIn);
    expect(startingBigBlinds(preset)).toBeGreaterThanOrEqual(50); expect(startingBigBlinds(preset)).toBeLessThanOrEqual(300);
    expect(preset.fields.every(field => field >= 2 && field <= 90)).toBe(true);
    const levels = blindSchedule(preset);
    expect(levels).toHaveLength(40); expect(levels[0].bigBlind).toBe(preset.firstBigBlind);
    levels.forEach((level, index) => {
      expect(level.smallBlind).toBeGreaterThan(0); expect(level.smallBlind).toBeLessThan(level.bigBlind);
      expect(level.ante).toBe(preset.bigBlindAnte ? level.bigBlind : 0);
      if (index) { expect(level.bigBlind).toBeGreaterThan(levels[index - 1].bigBlind); expect(level.bigBlind / levels[index - 1].bigBlind).toBeLessThanOrEqual(2); }
    });
    for (const field of preset.fields) {
      const summary = summarizeEvent(preset, field, 'real');
      expect(summary.prizePool).toBe(preset.buyIn * field); expect(summary.fees).toBe(preset.fee * field);
      expect(summary.ladder.reduce((sum, prize) => sum + prize, 0)).toBe(summary.prizePool);
      expect(summary.tables).toBe(Math.ceil(field / 9));
    }
  });
  it('pairs the usual small blinds with their big blinds', () => {
    const daily = blindSchedule(EVENT_PRESETS.find(preset => preset.id === 'daily-125')!, 6);
    expect(daily.map(level => [level.smallBlind, level.bigBlind, level.ante])).toEqual([[100, 200, 200], [200, 300, 300], [200, 400, 400], [300, 500, 500], [300, 600, 600], [400, 800, 800]]);
    const home = blindSchedule(EVENT_PRESETS.find(preset => preset.id === 'home-50')!, 4);
    expect(home.map(level => [level.smallBlind, level.bigBlind, level.ante])).toEqual([[25, 50, 0], [50, 100, 0], [75, 150, 0], [100, 200, 0]]);
  });
  it('converts clock levels to hands at about 30 hands an hour', () => {
    const preset = (id: string) => EVENT_PRESETS.find(item => item.id === id)!;
    expect(handsPerLevel(preset('daily-125'), 'real')).toBe(10); expect(handsPerLevel(preset('daily-125'), 'fast')).toBe(5);
    expect(handsPerLevel(preset('series-10000'), 'real')).toBe(60); expect(handsPerLevel(preset('home-20'), 'fast')).toBe(4);
  });
});

describe('payout ladder', () => {
  it.each([[2, 1], [3, 1], [6, 2], [9, 3], [10, 3], [18, 3], [27, 4], [45, 7], [90, 14]])('%s entrants pay %s places', (entrants, places) => {
    expect(placesPaid(entrants)).toBe(places);
  });
  it.each([2, 6, 9, 18, 27, 45, 90])('pays the whole pool in whole dollars, never more for a lower place (%s entrants)', entrants => {
    for (const buyIn of [2000, 4500, 10000, 17000, 940000]) {
      const pool = buyIn * entrants, ladder = payoutLadder(pool, entrants);
      expect(ladder).toHaveLength(placesPaid(entrants)); expect(ladder.reduce((sum, prize) => sum + prize, 0)).toBe(pool);
      ladder.forEach((prize, index) => { expect(prize % 100).toBe(0); expect(prize).toBeGreaterThan(0); if (index) expect(prize).toBeLessThanOrEqual(ladder[index - 1]); });
    }
  });
  it('uses the familiar 50/30/20 split at one table', () => { expect(payoutLadder(45000, 9)).toEqual([22500, 13500, 9000]); });
  it('rejects unusable inputs', () => {
    expect(() => placesPaid(1)).toThrow(); expect(() => payoutLadder(12345, 9)).toThrow(); expect(() => blindSchedule(EVENT_PRESETS[0], 0)).toThrow();
    expect(() => summarizeEvent(EVENT_PRESETS[0], 45, 'real')).toThrow();
  });
});
