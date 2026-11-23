/** Tournament event presets and pure structure maths. Presentation and configuration data only:
    no engine, ledger or storage code lives here.

    The presets are modelled on structures that are typical of home games, casino daily and
    weekend tournaments, and tournament-series events. They are not copies of any venue's
    structure sheet, and fee splits are estimates. Amounts are in cents; chips are whole chips. */

export type EventTier = 'home' | 'casino' | 'series' | 'sng' | 'satellite';
export type StakeBand = 'low' | 'mid' | 'high';
export type EventPace = 'real' | 'fast';

export interface EventPreset {
  id: string;
  tier: EventTier;
  name: string;
  /** Prize-pool part of the entry, in cents. */
  buyIn: number;
  /** House fee part of the entry, in cents. Zero for home games. */
  fee: number;
  startingStack: number;
  /** Big blind of level 1. */
  firstBigBlind: number;
  bigBlindAnte: boolean;
  /** Level length on a real clock; the app converts it to hands. */
  levelMinutes: number;
  /** Field sizes a real event of this kind usually draws. Shown for context only. */
  typicalField: readonly [number, number];
  /** Field sizes this app offers for the preset. */
  fields: readonly number[];
  blurb: string;
  /** Patch 72: a satellite pays seats into another event: each seat is worth that event's full entry. */
  satellite?: { target: string; seat: number };
}

const dollars = (amount: number) => amount * 100;

export const EVENT_PRESETS: readonly EventPreset[] = [
  // Home games: no fee, small stacks in 25-chip units, no ante, one to three tables.
  { id: 'home-20', tier: 'home', name: 'Kitchen-table $20', buyIn: dollars(20), fee: 0, startingStack: 5000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 15, typicalField: [6, 12], fields: [6, 9, 18], blurb: 'Quick home game. 100 big blinds, fast levels, winner-heavy payout.' },
  { id: 'home-50', tier: 'home', name: 'Garage game $50', buyIn: dollars(50), fee: 0, startingStack: 10000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 20, typicalField: [8, 20], fields: [9, 18, 27], blurb: 'The standard home tournament: 200 big blinds and 20-minute levels.' },
  { id: 'home-100', tier: 'home', name: 'Home deep stack $100', buyIn: dollars(100), fee: 0, startingStack: 20000, firstBigBlind: 100, bigBlindAnte: false, levelMinutes: 20, typicalField: [10, 30], fields: [9, 18, 27], blurb: 'A bigger home game with room to play after the flop.' },
  // Casino daily and weekly events: a real fee, big-blind ante, 15 to 30 minute levels.
  { id: 'daily-65', tier: 'casino', name: 'Morning daily $65', buyIn: dollars(45), fee: dollars(20), startingStack: 15000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 15, typicalField: [30, 80], fields: [18, 27, 45], blurb: 'Low buy-in casino daily. Fast: stacks get short within a couple of hours.' },
  { id: 'daily-125', tier: 'casino', name: 'Casino daily $125', buyIn: dollars(100), fee: dollars(25), startingStack: 20000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 20, typicalField: [40, 120], fields: [18, 27, 45], blurb: 'The everyday casino tournament: 20,000 chips, 20-minute levels.' },
  { id: 'nightly-200', tier: 'casino', name: 'Nightly deep stack $200', buyIn: dollars(170), fee: dollars(30), startingStack: 20000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 20, typicalField: [60, 200], fields: [27, 45, 90], blurb: 'Evening one-day event with a bigger prize pool.' },
  { id: 'weekly-300', tier: 'casino', name: 'Weekend special $300', buyIn: dollars(260), fee: dollars(40), startingStack: 30000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 30, typicalField: [80, 250], fields: [27, 45, 90], blurb: 'The weekly feature: 30,000 chips and 30-minute levels.' },
  // Series events: deeper stacks, longer levels, lower fee share.
  { id: 'series-400', tier: 'series', name: 'Series opener $400', buyIn: dollars(340), fee: dollars(60), startingStack: 25000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 30, typicalField: [300, 1500], fields: [45, 90], blurb: 'Large-field opening event of a tournament series.' },
  { id: 'series-600', tier: 'series', name: 'Deep stack $600', buyIn: dollars(520), fee: dollars(80), startingStack: 30000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 30, typicalField: [300, 1200], fields: [45, 90], blurb: 'Mid-stakes deep stack with 150 big blinds to start.' },
  { id: 'series-1100', tier: 'series', name: 'Championship event $1,100', buyIn: dollars(1000), fee: dollars(100), startingStack: 30000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 40, typicalField: [300, 2000], fields: [45, 90], blurb: 'The classic four-figure buy-in with 40-minute levels.' },
  { id: 'series-1700', tier: 'series', name: 'Regional main event $1,700', buyIn: dollars(1500), fee: dollars(200), startingStack: 30000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 40, typicalField: [400, 1500], fields: [45, 90], blurb: 'Regional-tour main event structure.' },
  { id: 'series-3500', tier: 'series', name: 'Tour main event $3,500', buyIn: dollars(3200), fee: dollars(300), startingStack: 40000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 60, typicalField: [500, 2000], fields: [45, 90], blurb: 'Major-tour main event: 200 big blinds and one-hour levels.' },
  { id: 'series-5000', tier: 'series', name: 'High stakes $5,000', buyIn: dollars(4700), fee: dollars(300), startingStack: 50000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 60, typicalField: [200, 900], fields: [27, 45, 90], blurb: 'Tough fields, deep stacks, one-hour levels.' },
  { id: 'series-10000', tier: 'series', name: 'World championship $10,000', buyIn: dollars(9400), fee: dollars(600), startingStack: 60000, firstBigBlind: 200, bigBlindAnte: true, levelMinutes: 120, typicalField: [1000, 10000], fields: [45, 90], blurb: 'Deepest starting stack in this catalogue: 300 big blinds and two-hour levels.' },
  { id: 'series-25000', tier: 'series', name: 'High roller $25,000', buyIn: dollars(24000), fee: dollars(1000), startingStack: 100000, firstBigBlind: 400, bigBlindAnte: true, levelMinutes: 60, typicalField: [50, 300], fields: [18, 27, 45], blurb: 'Small, elite field. Every pot is expensive.' },
];

export const entryCost = (preset: EventPreset): number => preset.buyIn + preset.fee;
export const stakeBand = (preset: EventPreset): StakeBand => entryCost(preset) < dollars(200) ? 'low' : entryCost(preset) < dollars(2000) ? 'mid' : 'high';
export const startingBigBlinds = (preset: EventPreset): number => preset.startingStack / preset.firstBigBlind;

/** A live nine-handed table deals roughly 30 hands an hour, so a level lasts about one hand
    per two minutes. 'fast' halves that. Never fewer than four hands. */
export function handsPerLevel(preset: EventPreset, pace: EventPace): number {
  return Math.max(4, Math.round(preset.levelMinutes / (pace === 'real' ? 2 : 4)));
}

export interface BlindLevel { level: number; smallBlind: number; bigBlind: number; ante: number; }

// Big blinds in use on real structure sheets. Above the table the ladder repeats ten times larger.
const LADDER_25 = [50, 100, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000];
const LADDER_100 = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000, 3000, 4000, 5000, 6000, 8000, 10000];
const DECADE_25 = [15000, 20000, 30000, 40000, 60000, 80000, 100000];
const DECADE_100 = [12000, 16000, 20000, 30000, 40000, 50000, 60000, 80000, 100000];

/** Blind levels from the preset's first big blind. Small blind is half the big blind rounded
    up to the chip unit (so 300 pairs with 200, and 500 with 300). The big-blind ante equals the
    big blind. `levels` is capped so nobody can ask for an unbounded schedule. */
export function blindSchedule(preset: EventPreset, levels = 40): BlindLevel[] {
  if (!Number.isInteger(levels) || levels < 1 || levels > 80) throw new Error('Choose between 1 and 80 levels.');
  const unit = preset.firstBigBlind >= 200 ? 100 : 25;
  const base = unit === 100 ? LADDER_100 : LADDER_25, decade = unit === 100 ? DECADE_100 : DECADE_25;
  const bigBlinds = [...base];
  for (let scale = 1; bigBlinds.length < 200; scale *= 10) bigBlinds.push(...decade.map(value => value * scale));
  const start = bigBlinds.indexOf(preset.firstBigBlind);
  if (start < 0) throw new Error(`No blind ladder starts at ${preset.firstBigBlind}.`);
  return bigBlinds.slice(start, start + levels).map((bigBlind, index) => ({
    level: index + 1, bigBlind, smallBlind: Math.ceil(bigBlind / 2 / unit) * unit, ante: preset.bigBlindAnte ? bigBlind : 0,
  }));
}

/** Places paid: winner-take-all for three or fewer, two places up to six, three up to ten,
    then about 15% of the field. */
export function placesPaid(entrants: number): number {
  if (!Number.isInteger(entrants) || entrants < 2) throw new Error('A tournament needs at least two entrants.');
  return entrants <= 3 ? 1 : entrants <= 6 ? 2 : entrants <= 10 ? 3 : Math.max(3, Math.round(entrants * 0.15));
}

const FIXED_SHARES: Record<number, number[]> = { 1: [100], 2: [65, 35], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [37, 25, 17, 12, 9], 6: [35, 22, 15, 11, 9, 8] };

/** Prize for each paid place, first place first, in cents. Whole dollars; never increasing down
    the ladder; the amounts always sum exactly to the pool (the rounding remainder goes to
    first place). */
export function payoutLadder(prizePool: number, entrants: number): number[] {
  if (!Number.isInteger(prizePool) || prizePool < 0 || prizePool % 100 !== 0) throw new Error('Prize pool must be a whole number of dollars.');
  const places = placesPaid(entrants);
  const shares = FIXED_SHARES[places] ?? Array.from({ length: places }, (_, index) => 1 / Math.pow(index + 1, 0.85));
  const total = shares.reduce((sum, share) => sum + share, 0);
  const prizes = shares.map(share => Math.floor(prizePool * share / total / 100) * 100);
  prizes[0] += prizePool - prizes.reduce((sum, prize) => sum + prize, 0);
  return prizes;
}

export interface EventSummary { preset: EventPreset; entrants: number; tables: number; cost: number; prizePool: number; fees: number; ladder: number[]; handsPerLevel: number; startingBigBlinds: number; }

export function summarizeEvent(preset: EventPreset, entrants: number, pace: EventPace, seatsPerTable = 9): EventSummary {
  if (!preset.fields.includes(entrants)) throw new Error(`${preset.name} is offered with ${preset.fields.join(', ')} players.`);
  const prizePool = preset.buyIn * entrants;
  return { preset, entrants, tables: Math.ceil(entrants / seatsPerTable), cost: entryCost(preset), prizePool, fees: preset.fee * entrants, ladder: ladderFor(preset, prizePool, entrants), handsPerLevel: handsPerLevel(preset, pace), startingBigBlinds: startingBigBlinds(preset) };
}

/** Patch 72: sit & go events (one table, starts when it fills, top two or three paid) and satellites (every prize is a
    seat's worth for a bigger event; what is left over goes to the next place). Kept apart from the main catalogue so the
    long-standing catalogue and its checks stay exactly as they were. */
const seatFor = (id: string) => entryCost(EVENT_PRESETS.find(preset => preset.id === id)!);
export const SPECIAL_PRESETS: readonly EventPreset[] = [
  { id: 'sng-hyper-30', tier: 'sng', name: 'Hyper sit & go $30', buyIn: dollars(27), fee: dollars(3), startingStack: 2500, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 3, typicalField: [6, 9], fields: [6, 9], blurb: 'Fifty big blinds and very fast blinds: decisions come quickly.' },
  { id: 'sng-turbo-55', tier: 'sng', name: 'Turbo sit & go $55', buyIn: dollars(50), fee: dollars(5), startingStack: 3000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 6, typicalField: [6, 9], fields: [6, 9], blurb: 'The classic turbo: one table, the top three of nine paid 50/30/20.' },
  { id: 'sng-regular-110', tier: 'sng', name: 'Sit & go $110', buyIn: dollars(100), fee: dollars(10), startingStack: 5000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 10, typicalField: [6, 9], fields: [6, 9], blurb: 'One hundred big blinds and ten-minute levels: room to play.' },
  { id: 'sng-high-530', tier: 'sng', name: 'High-stakes sit & go $530', buyIn: dollars(500), fee: dollars(30), startingStack: 5000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 10, typicalField: [6, 9], fields: [6, 9], blurb: 'Tougher players, same one-table format.' },
  { id: 'sat-daily-125', tier: 'satellite', name: 'Satellite to the $125 daily', buyIn: dollars(15), fee: dollars(2), startingStack: 3000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 6, typicalField: [9, 30], fields: [9, 18, 27], blurb: 'Nine players, one seat in the Casino daily $125.', satellite: { target: 'daily-125', seat: seatFor('daily-125') } },
  { id: 'sat-series-400', tier: 'satellite', name: 'Satellite to the $400 series opener', buyIn: dollars(45), fee: dollars(5), startingStack: 5000, firstBigBlind: 50, bigBlindAnte: false, levelMinutes: 8, typicalField: [9, 45], fields: [9, 18, 27, 45], blurb: 'One $400 seat for every nine players.', satellite: { target: 'series-400', seat: seatFor('series-400') } },
  { id: 'sat-main-1700', tier: 'satellite', name: 'Mega satellite to the $1,700 main event', buyIn: dollars(190), fee: dollars(20), startingStack: 10000, firstBigBlind: 100, bigBlindAnte: false, levelMinutes: 10, typicalField: [18, 90], fields: [9, 18, 27, 45], blurb: 'One main-event seat for every nine players.', satellite: { target: 'series-1700', seat: seatFor('series-1700') } },
  { id: 'sat-wc-10000', tier: 'satellite', name: 'Satellite to the $10,000 championship', buyIn: dollars(1120), fee: dollars(80), startingStack: 10000, firstBigBlind: 100, bigBlindAnte: false, levelMinutes: 12, typicalField: [9, 45], fields: [9, 18, 27], blurb: 'Win your way into the championship: one seat per nine players.', satellite: { target: 'series-10000', seat: seatFor('series-10000') } },
];
export const ALL_PRESETS: readonly EventPreset[] = [...EVENT_PRESETS, ...SPECIAL_PRESETS];
export const findPreset = (id: string): EventPreset | undefined => ALL_PRESETS.find(preset => preset.id === id);

/** Seats for a satellite: as many full seats as the pool buys, then the remainder (whole dollars) to the next place. */
export function satelliteLadder(prizePool: number, seat: number): number[] {
  if (!Number.isInteger(prizePool) || prizePool < 0 || prizePool % 100 !== 0 || !Number.isInteger(seat) || seat <= 0) throw new Error('Invalid satellite prize pool.');
  const seats = Math.floor(prizePool / seat), rest = prizePool - seats * seat;
  if (seats < 1) throw new Error('A satellite needs at least one seat.');
  return [...Array.from({ length: seats }, () => seat), ...(rest > 0 ? [rest] : [])];
}
/** The ladder an event pays: seats for satellites, the usual ladder otherwise. */
export function ladderFor(preset: EventPreset, prizePool: number, entrants: number): number[] {
  return preset.satellite ? satelliteLadder(prizePool, preset.satellite.seat) : payoutLadder(prizePool, entrants);
}
/** View field for a satellite: where its seats go. Absent for other events. */
export function seatTargetOf(preset: EventPreset): { seatTarget?: { id: string; name: string; seat: number } } {
  if (!preset.satellite) return {};
  const target = findPreset(preset.satellite.target);
  return target ? { seatTarget: { id: target.id, name: target.name, seat: preset.satellite.seat } } : {};
}
