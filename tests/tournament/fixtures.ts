/** Sample tournament states for screen tests and the preview page. Not produced by an engine:
    the stacks are invented, but every identity the screens rely on holds (chips are conserved,
    places and prizes come from the preset maths). */
import { blindSchedule, entryCost, EVENT_PRESETS, payoutLadder, placesPaid, type EventPreset } from '../../src/tournament/presets';
import type { StandingRow, TournamentMove, TournamentRecord, TournamentView } from '../../src/tournament/view-model';

const NAMES = ['Marisol', 'Dev', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Abara', 'Castellano', 'Yusuf', 'Brandt', 'Ito', 'Mbeki', 'Solheim', 'Varga', 'Quinn', 'Haddad', 'Petrov', 'Nakamura', 'Okoye', 'Lund', 'Ferreira', 'Kaplan', 'Osei', 'Dalgaard', 'Moreau', 'Singh', 'Larsen', 'Tran', 'Adeyemi', 'Kowalski', 'Bianchi', 'Hale', 'Zhou', 'Romero', 'Eze', 'Fischer', 'Amari', 'Stone', 'Park', 'Duarte', 'Wolfe', 'Ibarra', 'Chen'];

export interface SampleOptions { presetId?: string; entrants?: number; playersLeft: number; level: number; heroRank?: number | null; handForHand?: boolean; pendingMove?: TournamentMove | null; handsToNextLevel?: number; }

export function sampleView(options: SampleOptions): TournamentView {
  const preset: EventPreset = EVENT_PRESETS.find(item => item.id === (options.presetId ?? 'daily-125'))!, entrants = options.entrants ?? 45;
  const left = options.playersLeft, levels = blindSchedule(preset, 40), current = levels[options.level - 1], next = levels[options.level] ?? null;
  const prizePool = preset.buyIn * entrants, ladder = payoutLadder(prizePool, entrants), paid = placesPaid(entrants), totalChips = preset.startingStack * entrants;
  const heroRank = options.heroRank === undefined ? Math.min(left, 3) : options.heroRank;
  // Stacks fall off evenly from the leader; the last stack absorbs rounding so chips are conserved.
  const weights = Array.from({ length: left }, (_, index) => left * 2 - index), weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const stacks = weights.map(weight => Math.floor(totalChips * weight / weightTotal / 100) * 100);
  stacks[0] += totalChips - stacks.reduce((sum, stack) => sum + stack, 0);
  const tablesLeft = Math.ceil(left / 9), names = [...NAMES];
  const live: StandingRow[] = stacks.map((stack, index) => { const isHero = heroRank === index + 1; return { name: isHero ? 'You' : names.shift() ?? `Player ${index + 1}`, isHero, stack, table: index % tablesLeft + 1, finished: null, prize: 0 }; });
  const out: StandingRow[] = Array.from({ length: entrants - left }, (_, index) => { const place = left + index + 1, isHero = heroRank === null && index === 0; return { name: isHero ? 'You' : names.shift() ?? `Player ${place}`, isHero, stack: 0, table: null, finished: place, prize: ladder[place - 1] ?? 0 }; });
  const heroRow = live.find(row => row.isHero), heroOut = out.find(row => row.isHero), complete = left === 1;
  if (complete) { live[0].finished = 1; live[0].prize = ladder[0]; }
  return {
    eventName: preset.name, status: complete ? 'complete' : heroOut ? 'hero-out' : 'running', current, next, handsToNextLevel: options.handsToNextLevel ?? 7,
    entrants, playersLeft: left, tablesLeft, placesPaid: paid, prizePool, ladder, averageStack: Math.round(totalChips / left),
    hero: heroRow ? { stack: heroRow.stack, rank: heroRank!, table: options.pendingMove?.toTable ?? heroRow.table!, seat: options.pendingMove?.toSeat ?? 4 } : null,
    handForHand: !!options.handForHand, finalTable: left <= 9 && entrants > 9, pendingMove: options.pendingMove ?? null, standings: [...live, ...out],
    result: heroOut ? { place: heroOut.finished!, entrants, prize: heroOut.prize, cost: entryCost(preset), handsPlayed: 164 } : complete && heroRow ? { place: 1, entrants, prize: ladder[0], cost: entryCost(preset), handsPlayed: 311 } : null,
  };
}

export const SAMPLE_RECORDS: TournamentRecord[] = [
  { eventName: 'Casino daily $125', entrants: 45, place: 3, cost: 12500, prize: 71600, finishedAt: '2026-11-10T03:10:00Z' },
  { eventName: 'Casino daily $125', entrants: 45, place: 19, cost: 12500, prize: 0, finishedAt: '2026-11-11T02:40:00Z' },
  { eventName: 'Garage game $50', entrants: 18, place: 8, cost: 5000, prize: 0, finishedAt: '2026-11-12T01:05:00Z' },
  { eventName: 'Weekend special $300', entrants: 90, place: 11, cost: 30000, prize: 61200, finishedAt: '2026-11-14T05:30:00Z' },
];
