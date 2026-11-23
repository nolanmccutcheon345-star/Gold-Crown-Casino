import type { LegalActionSet } from '../contracts';

/** Presentation proposals only. The engine remains the final legality authority. */
export const POT_PERCENT_PRESETS = [25, 33, 50, 75, 100, 150, 200] as const;
/** Preflop quick sizes. Opening an unraised pot is sized in big blinds; re-raising is sized as a
    multiple of the bet being faced. They sit beside the pot-percentage presets, which stay available. */
export const PREFLOP_OPEN_BIG_BLINDS = [2.5, 3, 4, 5] as const;
export const PREFLOP_RAISE_MULTIPLES = [2.5, 3, 4] as const;
export const POT_SIZING_BASIS = 'Raise-to = chips already committed this street + call amount + selected percentage of (current pot + call amount). The added fraction is rounded to the nearest configured chip unit (one cent by default); no minimum or stack-limit clipping.';
export interface SizingContext {
  pot: number;
  streetCommitted: number;
  bigBlind: number;
  chipUnit?: number;
  legal: LegalActionSet;
}
export interface SizingProposal {
  to: number;
  additional: number;
  minimum: number | null;
  maximum: number | null;
  legal: boolean;
  reason: 'legal' | 'unavailable' | 'below-minimum' | 'above-maximum' | 'invalid-amount' | 'invalid-denomination';
}
function nonnegative(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Sizing requires nonnegative integer cents.');
}
export function inspectSizing(context: SizingContext, to: number): SizingProposal {
  const { legal } = context;
  const minimum = legal.shortAllInTo ?? legal.minRaiseTo;
  const maximum = legal.maxRaiseTo ?? legal.shortAllInTo;
  let reason: SizingProposal['reason'] = 'legal';
  if (!Number.isSafeInteger(to) || to < 0) reason = 'invalid-amount';
  else if(to % (context.chipUnit ?? 1)!==0) reason='invalid-denomination';
  else if ((!legal.canRaise && legal.shortAllInTo === null) || minimum === null || maximum === null) reason = 'unavailable';
  else if (to < minimum) reason = 'below-minimum';
  else if (to > maximum) reason = 'above-maximum';
  return { to, additional: to - context.streetCommitted, minimum, maximum, legal: reason === 'legal', reason };
}
/** Inverse of potSizing: the whole pot percentage a raise-to total represents, or null when it has none. */
export function potPercentOf(context: SizingContext, to: number): number | null {
  const base = context.pot + context.legal.callAmount, added = to - context.streetCommitted - context.legal.callAmount;
  return base > 0 && Number.isFinite(added) && added >= 0 ? Math.round(added * 100 / base) : null;
}
export function potSizing(context: SizingContext, percent: number): SizingProposal {
  nonnegative(context.pot); nonnegative(context.streetCommitted); nonnegative(context.legal.callAmount);
  if (!Number.isFinite(percent) || percent < 0 || percent > 10000) throw new Error('Pot percentage must be between 0 and 10,000.');
  const unit=context.chipUnit??1;
  if(!Number.isSafeInteger(unit)||unit<1)throw new Error('Chip unit must be a positive integer number of cents.');
  const to = context.streetCommitted + context.legal.callAmount + Math.round((context.pot + context.legal.callAmount) * percent / 100 / unit)*unit;
  return inspectSizing(context, to);
}
export function bigBlindSizing(context: SizingContext, bigBlinds: number): SizingProposal {
  nonnegative(context.bigBlind);
  if (!Number.isFinite(bigBlinds) || bigBlinds < 0 || bigBlinds > 10000) throw new Error('Choose a nonnegative total of at most 10,000 BB.');
  return inspectSizing(context, Math.round(context.bigBlind * bigBlinds));
}
const toChipUnit = (context: SizingContext, amount: number): number => {
  const unit = context.chipUnit ?? 1;
  if (!Number.isSafeInteger(unit) || unit < 1) throw new Error('Chip unit must be a positive integer number of cents.');
  return Math.round(amount / unit) * unit;
};
/** Raise-to total of a number of big blinds, rounded to the configured chip unit. No minimum or stack clipping. */
export function openSizing(context: SizingContext, bigBlinds: number): SizingProposal {
  nonnegative(context.bigBlind);
  if (!Number.isFinite(bigBlinds) || bigBlinds < 0 || bigBlinds > 10000) throw new Error('Choose a nonnegative total of at most 10,000 BB.');
  return inspectSizing(context, toChipUnit(context, context.bigBlind * bigBlinds));
}
/** Raise-to total of a multiple of the bet Hero faces (chips already in this street plus the call),
    rounded to the configured chip unit. No minimum or stack clipping. */
export function raiseMultipleSizing(context: SizingContext, multiple: number): SizingProposal {
  nonnegative(context.streetCommitted); nonnegative(context.legal.callAmount);
  if (!Number.isFinite(multiple) || multiple < 1 || multiple > 1000) throw new Error('Choose a raise multiple between 1 and 1,000.');
  return inspectSizing(context, toChipUnit(context, (context.streetCommitted + context.legal.callAmount) * multiple));
}
export function incrementSizing(context: SizingContext, currentTo: number, incrementBB: number): SizingProposal {
  nonnegative(currentTo); nonnegative(context.bigBlind);
  if (!Number.isFinite(incrementBB) || incrementBB < 0 || incrementBB > 10000) throw new Error('Choose an increment between 0 and 10,000 BB.');
  return inspectSizing(context, currentTo + Math.round(context.bigBlind * incrementBB));
}
