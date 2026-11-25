import { describe, expect, it } from 'vitest';
import { omahaPotential } from '../../src/plo/potential';
import { tournamentFlags, tournamentMoment } from '../../src/ui/moments';
import type { Card } from '../../src/contracts';

const hand = (s: string) => s.split(' ') as Card[];

describe('Omaha potential (fun #8)', () => {
  it('names the made hand and the nut flush draw with outs', () => {
    // A♠ K♠ in hand with two spades on board: one spade away, and it is the nut draw.
    const p = omahaPotential(hand('As Ks 7d 2c'), hand('Qs 4s 9d'));
    expect(p?.made).toContain('Ace');
    expect(p?.draws.some(d => d.startsWith('Nut flush draw (9 outs)'))).toBe(true);
  });
  it('spots a wrap: three ranks complete the straight', () => {
    // J-T-7-6 on a 9-8-2 board: Q, J and 6 each complete a straight for some combo.
    const p = omahaPotential(hand('Js Td 7c 6h'), hand('9s 8d 2c'));
    expect(p?.draws.some(d => d.startsWith('Wrap'))).toBe(true);
  });
  it('returns null preflop and on the river', () => {
    expect(omahaPotential(hand('As Ks 7d 2c'), [])).toBeNull();
    expect(omahaPotential(hand('As Ks 7d 2c'), hand('Qs 4s 9d 3h 5c'))).toBeNull();
  });
  it('a made flush is not also a flush draw', () => {
    const p = omahaPotential(hand('As Ks 7d 2c'), hand('Qs 4s 9s'));
    expect(p?.made).toContain('flush');
    expect(p?.draws.some(d => d.includes('flush draw'))).toBe(false);
  });
});

describe('tournament bubble moments (fun #6)', () => {
  const view = (over: Record<string, unknown>) => ({
    status: 'running', hero: {}, entrants: 45, placesPaid: 9, playersLeft: 10,
    finalTable: false, ladder: [], eventName: 'Series', registration: undefined, result: undefined, ...over,
  }) as never;
  it('flags the bubble at exactly one past the money', () => {
    expect(tournamentFlags(view({})).bubble).toBe(true);
    expect(tournamentFlags(view({ playersLeft: 11 })).bubble).toBe(false);
    expect(tournamentFlags(view({ playersLeft: 9 })).bubble).toBe(false);
  });
  it('fires the bubble moment once, and the bubble-bust moment on a bubble finish', () => {
    const before = tournamentFlags(view({ playersLeft: 11 }));
    const at = tournamentFlags(view({}));
    expect(tournamentMoment(before, at, view({}), String)?.title).toBe('On the bubble');
    const bustView = view({ status: 'complete', hero: undefined, result: { place: 10, prize: 0 } });
    const bust = tournamentMoment(at, tournamentFlags(bustView), bustView, String);
    expect(bust?.title).toBe('Out on the bubble');
  });
});
