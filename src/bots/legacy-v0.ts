import type { Action, Archetype, BotDecision, BotObservation, BotProfile, Card } from '../contracts';

/** Designed simulation policies only. No human data or solver calibration is claimed. */
export const POLICY_VERSION = 'synthetic-phase0-0.1.0';
export const ARCHETYPES: readonly Archetype[] = Object.freeze([
  'nit', 'station', 'tag', 'lag', 'fit-or-fold', 'maniac', 'passive-reg', 'stronger-reg',
]);
const TRAITS: Record<Archetype, readonly [number, number]> = {
  nit: [0.25, 0.12], station: [0.12, 0.9], tag: [0.62, 0.32], lag: [0.79, 0.67],
  'fit-or-fold': [0.29, 0.4], maniac: [0.94, 0.87], 'passive-reg': [0.24, 0.42],
  'stronger-reg': [0.66, 0.4],
};
export function defaultProfile(archetype: Archetype): BotProfile {
  if (!Object.hasOwn(TRAITS, archetype)) throw new Error('Unknown bot archetype.');
  const [aggression, looseness] = TRAITS[archetype];
  return { archetype, policyVersion: POLICY_VERSION, aggression, looseness };
}

function clamp(n: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, n)); }
function sigmoid(n: number): number { return 1 / (1 + Math.exp(-n)); }

/** This stream never shares a generator, seed, or state with card dealing. */
export function securePolicyRandom(): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness is unavailable. Bot play is paused.');
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
}
function draw(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Bot random draw must be in [0, 1).');
  return value;
}
function rank(card: Card): number { return '23456789TJQKA'.indexOf(card[0]) + 2; }

/** A coarse own-hand feature model, not an equity estimate or showdown authority. */
export function handFeatures(ownCards: Card[], board: Card[]): { strength: number; draw: number; made: boolean } {
  const ranks = ownCards.map(rank).sort((a, b) => b - a);
  const [high, low] = ranks;
  if (board.length === 0) {
    const paired = high === low;
    const suited = ownCards[0][1] === ownCards[1][1];
    const connected = high - low === 1;
    const strength = paired ? 0.5 + (high - 2) / 12 * 0.45
      : clamp(0.1 + (high - 2) / 12 * 0.39 + (low - 2) / 12 * 0.27
        + (suited ? 0.055 : 0) + (connected ? 0.045 : 0) - Math.max(0, high - low - 3) * 0.018);
    return { strength, draw: 0, made: paired };
  }
  const all = [...ownCards, ...board];
  const counts = new Map<number, number>();
  const suits = new Map<string, number>();
  for (const card of all) { counts.set(rank(card), (counts.get(rank(card)) ?? 0) + 1); suits.set(card[1], (suits.get(card[1]) ?? 0) + 1); }
  const values = new Set(all.map(rank));
  if (values.has(14)) values.add(1);
  let straight = false;
  let straightDraw = 0;
  for (let start = 1; start <= 10; start++) {
    const run = Array.from({length:5}, (_, i) => start + i);
    const present = run.filter(value => values.has(value)).length;
    if (present === 5) straight = true;
    if (present === 4 && ownCards.some(c => run.includes(rank(c)) || (rank(c) === 14 && run.includes(1)))) {
      const missing = run.find(value => !values.has(value));
      straightDraw = Math.max(straightDraw, missing === start || missing === start + 4 ? 0.28 : 0.15);
    }
  }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = [...suits.values()].some(count => count >= 5);
  const flushDraw = [...suits.entries()].some(([suit,count]) => count === 4 && ownCards.some(c => c[1] === suit));
  const trips = groups.some(([,count]) => count >= 3);
  const pairs = groups.filter(([,count]) => count >= 2).length;
  let strength = 0.11 + (high - 2) / 12 * 0.17;
  if (pairs) {
    const pairRank = groups.find(([, count]) => count >= 2)![0];
    const ownedPair = ownCards.some(card => (counts.get(rank(card)) ?? 0) >= 2);
    strength = ownedPair ? 0.43 + pairRank / 14 * 0.14 : strength + 0.025;
  }
  if (pairs >= 2) strength = 0.68;
  if (trips) strength = 0.77;
  if (straight) strength = 0.84;
  if (flush) strength = 0.89;
  if (trips && pairs >= 2) strength = 0.94;
  if (groups.some(([,count]) => count === 4)) strength = 0.98;
  // Common-board monsters are less informative about one's relative strength.
  const ownContribution = ownCards.some(card => (counts.get(rank(card)) ?? 0) >= 2)
    || (flush && ownCards.some(card => (suits.get(card[1]) ?? 0) >= 5))
    || (straight && ownCards.some(card => !board.some(b => rank(b) === rank(card))));
  if (!ownContribution && strength > 0.5) strength = 0.34 + high / 14 * 0.13;
  const drawStrength = board.length < 5 ? Math.min(0.5, straightDraw + (flushDraw ? 0.32 : 0)) : 0;
  return {strength:clamp(strength), draw:drawStrength, made:strength >= 0.43};
}

/** Allowlist the observation. Extra properties, such as a future deck, are never inspected. */
function permittedObservation(o: BotObservation): BotObservation {
  return {
    handId:o.handId, revision:o.revision, actingSeat:o.actingSeat, decisionId:o.decisionId,
    policyVersion:o.policyVersion, ownCards:[...o.ownCards], board:[...o.board], street:o.street,
    button:o.button, pot:o.pot, bigBlind:o.bigBlind,
    seats:o.seats.map(s => ({id:s.id,stack:s.stack,streetCommitted:s.streetCommitted,totalCommitted:s.totalCommitted,folded:s.folded,allIn:s.allIn})),
    legal:{actor:o.legal.actor,fold:o.legal.fold,check:o.legal.check,callAmount:o.legal.callAmount,minRaiseTo:o.legal.minRaiseTo,maxRaiseTo:o.legal.maxRaiseTo,canRaise:o.legal.canRaise,shortAllInTo:o.legal.shortAllInTo,reopened:o.legal.reopened},
    // Card-bearing events are not needed by these memoryless policies. Only public actions enter the fingerprint.
    publicEvents:o.publicEvents.map(e => ({id:e.id,handId:e.handId,revision:e.revision,type:e.type,seatId:e.seatId,amount:e.amount,
      action:e.action ? (e.action.type === 'raise' ? {type:'raise' as const,to:e.action.to} : {type:e.action.type}) : undefined,
      street:e.street,decisionId:e.decisionId})),
  };
}
function validate(o: BotObservation, p: BotProfile): void {
  if (!Object.hasOwn(TRAITS, p.archetype) || ![p.aggression,p.looseness].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('Invalid bot profile.');
  if (p.policyVersion !== POLICY_VERSION || p.policyVersion !== o.policyVersion) throw new Error('Bot policy version mismatch.');
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error('Missing bot decision identity.');
  if (o.street === 'complete' || o.legal.actor !== o.actingSeat) throw new Error('Bot does not own the current turn.');
  if (o.ownCards.length !== 2 || ![0,3,4,5].includes(o.board.length)) throw new Error('Invalid visible card count.');
  const cards = [...o.ownCards,...o.board];
  if (cards.some(c => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error('Invalid visible cards.');
  const own = o.seats.find(s => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error('Bot seat cannot act.');
  if (![o.pot,o.bigBlind,o.legal.callAmount,own.streetCommitted].every(n => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error('Invalid chip amount.');
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error('Inconsistent legal actions.');
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error('Raise bounds supplied when raising is closed.');
  if (o.legal.canRaise && !o.legal.reopened) throw new Error('Raising is not reopened.');
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || (o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo) || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error('Invalid legal raise bounds.');
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error('Invalid short all-in bound.');
}
function fingerprint(o: BotObservation, p: BotProfile): string {
  // This is a replay consistency fingerprint, not a cryptographic authenticity guarantee.
  const text = JSON.stringify({observation:o,profile:{archetype:p.archetype,policyVersion:p.policyVersion,aggression:p.aggression,looseness:p.looseness}});
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) { h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ text.charCodeAt(i), 2246822519); }
  return `fnv-pair:${(h1 >>> 0).toString(16).padStart(8,'0')}${(h2 >>> 0).toString(16).padStart(8,'0')}`;
}

export interface PolicyDistribution {fold:number;check:number;call:number;raise:number;}
/** Designed conditional probabilities; exposed for finite-context policy tests, never as equity. */
export function policyDistribution(observation: BotObservation, profile: BotProfile): PolicyDistribution {
  const o = permittedObservation(observation); validate(o,profile);
  const own = o.seats.find(s => s.id === o.actingSeat)!;
  const {strength,draw:drawStrength,made} = handFeatures(o.ownCards,o.board);
  const active = o.seats.filter(s => !s.folded).length;
  const multiway = Math.max(0,active - 2);
  const call = o.legal.callAmount;
  const price = call / Math.max(1,o.pot + call);
  const stackExposure = call / Math.max(1,own.stack);
  const preflop = o.street === 'preflop';
  const buttonIndex = o.seats.findIndex(s => s.id === o.button);
  const seatIndex = o.seats.findIndex(s => s.id === o.actingSeat);
  const distance = (seatIndex - buttonIndex + o.seats.length) % o.seats.length;
  const latePosition = distance === 0 ? 0.06 : distance >= o.seats.length - 2 ? 0.025 : -0.02;
  const drawValue = drawStrength * (o.street === 'flop' ? 0.65 : 0.4);
  const quality = strength + drawValue + (preflop ? latePosition : 0) - multiway * 0.018;
  const fitPenalty = profile.archetype === 'fit-or-fold' && !preflop && !made && drawStrength < 0.2 ? 0.2 : 0;
  const threshold = (preflop ? 0.43 : 0.42) - (profile.looseness - 0.4) * 0.36 + price * 0.58 + stackExposure * 0.12 + fitPenalty;
  const continueChance = clamp(sigmoid((quality - threshold) * 8),0.015,0.995);
  const canRaise = o.legal.canRaise;
  const value = sigmoid((quality - 0.64) * 10);
  const bluff = profile.aggression * (preflop ? 0.12 : o.street === 'river' ? 0.08 : 0.06) / (1 + multiway * 0.5);
  const semiBluff = drawStrength * profile.aggression * 0.4;
  const raiseConditional = canRaise ? clamp(value * (0.35 + profile.aggression * 0.58) + bluff + semiBluff,0.015,0.94) : 0;
  if (call === 0 && o.legal.check) return {fold:0,check:1-raiseConditional,call:0,raise:raiseConditional};
  const fold = o.legal.fold ? 1-continueChance : 0;
  const remaining = 1-fold;
  return {fold,check:0,call:remaining*(1-raiseConditional),raise:remaining*raiseConditional};
}

function sampleRaise(o: BotObservation, p: BotProfile, value: number): Action {
  if (!o.legal.canRaise || (o.legal.minRaiseTo !== null && o.legal.maxRaiseTo !== null && o.legal.minRaiseTo > o.legal.maxRaiseTo)) {
    if (o.legal.shortAllInTo === null) throw new Error('No legal raise available.');
    return {type:'raise',to:o.legal.shortAllInTo};
  }
  const own = o.seats.find(s => s.id === o.actingSeat)!;
  const min = o.legal.minRaiseTo!;
  const max = o.legal.maxRaiseTo!;
  const fractions = [0.33,0.5,0.75,1,1.5];
  const index = Math.min(4, Math.floor(value * (p.aggression > 0.7 ? 5 : 4)));
  const base = own.streetCommitted + o.legal.callAmount;
  let target = base + Math.round((o.pot + o.legal.callAmount) * fractions[index]);
  if (o.street === 'preflop' && o.pot < 5 * o.bigBlind) target = Math.max(target, Math.round(o.bigBlind * (2.2 + p.aggression)));
  return {type:'raise',to:clamp(target,min,max)};
}
export function chooseDecision(observation: BotObservation, profile: BotProfile, random: () => number = securePolicyRandom): BotDecision {
  const o = permittedObservation(observation); validate(o,profile);
  const distribution = policyDistribution(o,profile);
  const sample = draw(random);
  let action: Action;
  if (sample < distribution.fold) action = {type:'fold'};
  else if (sample < distribution.fold + distribution.check) action = {type:'check'};
  else if (sample < distribution.fold + distribution.check + distribution.call) action = {type:'call'};
  else action = sampleRaise(o,profile,draw(random));
  return {handId:o.handId,revision:o.revision,seatId:o.actingSeat,decisionId:o.decisionId,policyVersion:profile.policyVersion,
    observationHash:fingerprint(o,profile),action};
}

/**
 * In-memory exactly-once planning for one hand. Create a new instance only after
 * the prior authoritative hand completes and a new hand starts successfully.
 * Never reset on pause, rerender, retries or an in-progress error. Durable crash
 * recovery remains a G3 dependency; no pending decision is evicted or re-sampled.
 */
export class DecisionCache {
  private readonly decisions = new Map<string, { identity:string; decision:BotDecision }>();
  private readonly revisionDecisions = new Map<number, string>();
  private readonly failedDecisions = new Set<string>();
  private handId: string | null = null;
  private highestRevision = -1;
  constructor(private readonly random: () => number = securePolicyRandom) {}
  getOrCreate(observation: BotObservation, profile: BotProfile): BotDecision {
    const o = permittedObservation(observation); validate(o,profile);
    if (this.handId !== null && o.handId !== this.handId) throw new Error('Decision cache belongs to another hand; create a new cache after completion.');
    // Compare full canonical identity, not only the non-cryptographic fingerprint.
    const identity = JSON.stringify({o,p:{archetype:profile.archetype,policyVersion:profile.policyVersion,aggression:profile.aggression,looseness:profile.looseness}});
    const existing = this.decisions.get(o.decisionId);
    if (existing) {
      if (existing.identity !== identity) throw new Error('Decision ID reused for a different observation or policy.');
      return structuredClone(existing.decision);
    }
    if (this.failedDecisions.has(o.decisionId)) throw new Error('This decision failed during sampling; pause safely rather than reroll it.');
    if (this.revisionDecisions.has(o.revision)) throw new Error('This hand revision already has a sampled decision; its ID cannot change.');
    if (o.revision < this.highestRevision) throw new Error('Cannot sample a new decision for a stale hand revision.');
    // Reserve the authority node before drawing. Partial entropy failure must not enable a reroll.
    this.handId = o.handId;
    this.highestRevision = o.revision;
    this.revisionDecisions.set(o.revision,o.decisionId);
    try {
      const decision = chooseDecision(o,profile,this.random);
      this.decisions.set(o.decisionId,{identity,decision:structuredClone(decision)});
      return structuredClone(decision);
    } catch (cause) {
      this.failedDecisions.add(o.decisionId);
      throw cause;
    }
  }
  get size(): number { return this.decisions.size; }
}
