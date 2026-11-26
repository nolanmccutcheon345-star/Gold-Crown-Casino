/**
 * Phase 14 (CB-U01): the all-in equity strip for a completed all-in showdown.
 *
 * The engine settles an all-in runout in one transition, so by the time a
 * frame reaches this module the hand is complete and every continuing hand
 * has been tabled under the reveal rules (`revealedSeats`). This module reads
 * ONLY the view model the table already shows — hero's cards and the tabled
 * hands, never a hidden card — and works out the hero's equity at each board
 * prefix from the street the money went in: what you had when the chips went
 * in, and how it moved on the flop, turn and river. Values are memoized per
 * hand so the app's re-renders never recompute them.
 */
import type { HeroViewModel } from '../contracts';
import { allInEquity } from '../core/equity';

const STREETS = [
  { id: 'preflop', label: 'Preflop', board: 0 },
  { id: 'flop', label: 'Flop', board: 3 },
  { id: 'turn', label: 'Turn', board: 4 },
  { id: 'river', label: 'River', board: 5 },
] as const;

export interface AllInEquityStep { street: string; pct: number; exact: boolean }
const memo = new Map<string, AllInEquityStep[] | null>();

/** The hero's equity steps for a completed all-in showdown, or null when this
 * frame is not one: hand not complete, hero folded or not in it, a continuing
 * hand was not tabled, nobody was all-in, or the money only went in on the
 * river (no runout left to measure). */
export function allInEquitySteps(view: HeroViewModel | null | undefined, heroId: number): AllInEquityStep[] | null {
  if (!view || view.street !== 'complete' || view.board.length !== 5) return null;
  const hero = view.seats.find(s => s.id === heroId);
  if (!hero || hero.folded || hero.hole.length !== 2) return null;
  const live = view.seats.filter(s => !s.folded);
  if (live.length < 2 || live.some(s => s.hole.length !== 2)) return null;
  /* Somebody's whole stack went in: flagged all-in in the frame, or their
   * total commitment equals everything they started the hand with. */
  const anyAllIn = live.some(s => s.allIn || (s.startingStack > 0 && s.totalCommitted >= s.startingStack));
  if (!anyAllIn) return null;
  /* The street the hero's money went in: the hero's own last action. Deeper
   * stacks may keep betting a side pot after the hero is all-in — their
   * later actions must not move the hero's starting point, and while such a
   * decision is still live (any frame before this completed one) no equity
   * is shown at all. An all-in first made on the river has no runout. */
  const actions = view.events.filter(e => e.type === 'action');
  const heroLastAction = actions.filter(e => e.seatId === heroId).at(-1) ?? actions.at(-1);
  const from = STREETS.findIndex(s => s.id === (heroLastAction?.street ?? 'preflop'));
  if (from < 0 || from >= STREETS.length - 1) return null;
  const key = `${view.handId}:${heroId}:${from}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const heroIndex = live.indexOf(hero);
  const hands = live.map(s => s.hole);
  const steps: AllInEquityStep[] = [];
  for (const street of STREETS.slice(from)) {
    const r = allInEquity(hands, view.board.slice(0, street.board), view.handId);
    steps.push({ street: street.label, pct: Math.round(100 * r.equities[heroIndex]), exact: r.exact });
  }
  if (memo.size > 64) memo.clear();
  memo.set(key, steps);
  return steps;
}

/** The strip markup, styled to fade each street in behind the previous one so
 * it reads as the runout arriving. Empty string when there is nothing honest
 * to show. */
export function allInEquityMarkup(view: HeroViewModel | null | undefined, heroId: number): string {
  const steps = allInEquitySteps(view, heroId);
  if (!steps) return '';
  const summary = steps.map(s => `${s.street} ${s.exact ? '' : 'about '}${s.pct}%`).join(', ');
  return `<div class="allin-equity" data-testid="allin-equity" role="status" aria-label="Your expected share of the pot as the board ran out: ${summary}"><span class="allin-equity-title">All-in · your expected share of the pot</span>${steps.map((s, i) => `<span class="allin-equity-step" style="--eq-i:${i}"><small>${s.street}</small><b>${s.exact ? '' : '≈'}${s.pct}%</b></span>`).join('<span class="allin-equity-arrow" aria-hidden="true">→</span>')}</div>`;
}
