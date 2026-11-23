import { describe, expect, it } from 'vitest';
import { bigBlindSizing, incrementSizing, inspectSizing, openSizing, POT_PERCENT_PRESETS, potPercentOf, potSizing, PREFLOP_OPEN_BIG_BLINDS, PREFLOP_RAISE_MULTIPLES, raiseMultipleSizing, type SizingContext } from '../../src/ui/bet-sizing';

const context: SizingContext = {
  pot: 4500, streetCommitted: 600, bigBlind: 200,
  legal: { actor: 0, fold: true, check: false, callAmount: 1800, minRaiseTo: 4200, maxRaiseTo: 30000, canRaise: true, shortAllInTo: null, reopened: true },
};
describe('R1 pot-after-call proposals (V408/U04/V505/V612)', () => {
  it.each([[25,3975],[33,4479],[50,5550],[75,7125],[100,8700],[150,11850],[200,15000]])('%s%% with a previous street commitment proposes exactly %s cents', (percent, expected) => {
    const result = potSizing(context, percent);
    expect(result.to).toBe(expected);
    expect(result.additional).toBe(expected - 600);
    expect(result.legal).toBe(expected >= 4200);
  });
  it('retains a below-minimum proposal without silently clipping', () => {
    expect(potSizing(context, 25)).toMatchObject({ to:3975, minimum:4200, legal:false, reason:'below-minimum' });
    expect(inspectSizing(context, 4200).legal).toBe(true);
  });
  it('retains above-stack proposals without silently substituting all-in', () => {
    expect(potSizing(context, 500)).toMatchObject({ to:33900, maximum:30000, legal:false, reason:'above-maximum' });
  });
  it('matches a numeric entry, BB total and increment to the same cumulative total', () => {
    const expected = potSizing(context, 100);
    expect(inspectSizing(context,8700)).toEqual(expected);
    expect(bigBlindSizing(context,43.5)).toEqual(expected);
    expect(incrementSizing(context,8500,1)).toEqual(expected);
  });
  it('uses free-check pot sizing with prior contribution once, not twice', () => {
    const free = {...context, legal:{...context.legal, callAmount:0, check:true, minRaiseTo:800}};
    expect(potSizing(free,50).to).toBe(2850);
  });
  it('rounds the added pot fraction to nearest cent', () => {
    expect(potSizing({...context,pot:4501},33).to).toBe(4479);
    expect(potSizing({...context,pot:4502},33).to).toBe(4480);
  });
  it('rounds a pot fraction to the explicit chip unit and rejects numeric residuals',()=>{
    expect(potSizing({...context,chipUnit:100},33).to).toBe(4500);
    expect(inspectSizing({...context,chipUnit:100},4479).reason).toBe('invalid-denomination');
    expect(potSizing({...context,chipUnit:25},33).to).toBe(4475);
  });
  it('allows only the exact short all-in total', () => {
    const short = {...context, legal:{...context.legal, canRaise:false,minRaiseTo:null,maxRaiseTo:3100,shortAllInTo:3100}};
    expect(inspectSizing(short,3100).legal).toBe(true);
    expect(inspectSizing(short,3099).reason).toBe('below-minimum');
    expect(inspectSizing(short,3101).reason).toBe('above-maximum');
  });
  it('does not offer raising when action has not reopened', () => {
    expect(potSizing({...context,legal:{...context.legal,canRaise:false,shortAllInTo:null,reopened:false}},100).reason).toBe('unavailable');
  });
  it('preserves all seven required percentages and rejects invalid inputs', () => {
    expect(POT_PERCENT_PRESETS).toEqual([25,33,50,75,100,150,200]);
    expect(()=>potSizing(context,NaN)).toThrow();
    expect(()=>potSizing(context,-1)).toThrow();
    expect(inspectSizing(context,Infinity).reason).toBe('invalid-amount');
  });
});

describe('Pot slider follows the raise amount (potPercentOf is the inverse of potSizing)', () => {
  it.each([[25,3975],[33,4479],[50,5550],[75,7125],[100,8700],[150,11850],[200,15000]])('%s%% is reported for a raise-to of %s cents', (percent, total) => {
    expect(potPercentOf(context, total)).toBe(percent);
    expect(potSizing(context, potPercentOf(context, total)!).to).toBe(total);
  });
  it('reports the minimum raise as its real share of the pot, not 100%', () => {
    expect(potPercentOf(context, 4200)).toBe(29);
  });
  it('has no percentage for an amount below the call or an unreadable amount', () => {
    expect(potPercentOf(context, 2000)).toBeNull();
    expect(potPercentOf(context, Number.NaN)).toBeNull();
    expect(potPercentOf({ ...context, pot: 0, legal: { ...context.legal, callAmount: 0 } }, 600)).toBeNull();
  });
});

describe('Preflop quick sizes: big blinds to open, multiples of the faced bet to re-raise', () => {
  const unopened: SizingContext = { pot: 300, streetCommitted: 0, bigBlind: 200, chipUnit: 100,
    legal: { actor: 0, fold: true, check: false, callAmount: 200, minRaiseTo: 400, maxRaiseTo: 30000, canRaise: true, shortAllInTo: null, reopened: true } };
  it.each([[2.5,500],[3,600],[4,800],[5,1000]])('%s BB opens a $1/$2 pot to %s cents', (bigBlinds, total) => {
    const result = openSizing(unopened, bigBlinds);
    expect(result.to).toBe(total); expect(result.additional).toBe(total); expect(result.legal).toBe(true);
  });
  it.each([[2.5,6000],[3,7200],[4,9600]])('%s times the faced bet counts chips already in: %s cents', (multiple, total) => {
    const result = raiseMultipleSizing(context, multiple);
    expect(result.to).toBe(total); expect(result.additional).toBe(total - 600); expect(result.legal).toBe(true);
  });
  it('rounds to the configured chip unit instead of proposing an unpayable amount', () => {
    expect(openSizing({ ...unopened, bigBlind: 300 }, 2.5).to).toBe(800);
    expect(raiseMultipleSizing({ ...unopened, legal: { ...unopened.legal, callAmount: 700 } }, 2.5).to).toBe(1800);
  });
  it('never clips to the minimum or the stack: an illegal size is reported, not changed', () => {
    expect(openSizing(context, 2.5)).toMatchObject({ to: 500, legal: false, reason: 'below-minimum' });
    expect(raiseMultipleSizing({ ...context, legal: { ...context.legal, maxRaiseTo: 7000 } }, 3)).toMatchObject({ to: 7200, legal: false, reason: 'above-maximum' });
  });
  it('rejects unusable inputs and keeps the published preset lists', () => {
    expect(() => raiseMultipleSizing(context, 0.5)).toThrow(); expect(() => openSizing(context, -1)).toThrow();
    expect([...PREFLOP_OPEN_BIG_BLINDS]).toEqual([2.5, 3, 4, 5]); expect([...PREFLOP_RAISE_MULTIPLES]).toEqual([2.5, 3, 4]);
  });
});
