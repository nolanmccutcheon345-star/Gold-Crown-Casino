// Frozen actual saved Version 8 source f54cacfb0aa3c861313b691e773a6716379c50a0.
// Generated verification artifact only; never imported by the application.

// src/core/deck.ts
function standardDeck() {
  return [..."23456789TJQKA"].flatMap((rank21) => [..."cdhs"].map((suit) => rank21 + suit));
}
function secureIndex(bound) {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 4294967296) throw new Error("Invalid random bound");
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure randomness unavailable. Use a supported secure browser.");
  const limit = Math.floor(4294967296 / bound) * bound;
  const word = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(word);
  } while (word[0] >= limit);
  return word[0] % bound;
}
function secureDeck() {
  const deck = standardDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// src/core/evaluator.ts
function compareRanks(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
function five(cards) {
  const ranks = cards.map((c) => "23456789TJQKA".indexOf(c[0]) + 2).sort((a, b) => b - a);
  const counts8 = /* @__PURE__ */ new Map();
  ranks.forEach((r) => counts8.set(r, (counts8.get(r) ?? 0) + 1));
  const groups = [...counts8].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const unique = [...counts8.keys()].sort((a, b) => b - a);
  let straight = unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : 0;
  if (unique.join(",") === "14,5,4,3,2") straight = 5;
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map((g) => g[0])];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...groups.map((g) => g[0])];
  if (groups[0][1] === 2) return [1, ...groups.map((g) => g[0])];
  return [0, ...ranks];
}
function evaluate(cards) {
  if (cards.length < 5 || cards.length > 7 || new Set(cards).size !== cards.length || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c))) {
    throw new Error("Evaluator requires 5\u20137 unique valid cards");
  }
  let best = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const rank21 = five([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best.length || compareRanks(rank21, best) > 0) best = rank21;
          }
  return best;
}
function handLabel(rank21) {
  const names = ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
  const plurals = ["", "", "twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings", "aces"];
  switch (rank21[0]) {
    case 8:
      return rank21[1] === 14 ? "Royal flush" : `${names[rank21[1]]}-high straight flush`;
    case 7:
      return `Four ${plurals[rank21[1]]}`;
    case 6:
      return `Full house, ${plurals[rank21[1]]} over ${plurals[rank21[2]]}`;
    case 5:
      return `${names[rank21[1]]}-high flush`;
    case 4:
      return `${names[rank21[1]]}-high straight`;
    case 3:
      return `Three ${plurals[rank21[1]]}`;
    case 2:
      return `Two pair, ${plurals[rank21[1]]} and ${plurals[rank21[2]]}`;
    case 1:
      return `Pair of ${plurals[rank21[1]]}`;
    default:
      return `${names[rank21[1]]} high`;
  }
}

// src/rules/rake.ts
var validInteger = (n) => Number.isSafeInteger(n) && n >= 0;
function validateRake(rake) {
  if (!rake || !validInteger(rake.basisPoints) || rake.basisPoints > 1e4 || !validInteger(rake.cap) || typeof rake.noFlopNoDrop !== "boolean") throw new Error("Invalid rake");
  if (rake.rounding !== void 0 && rake.rounding !== "floor" && rake.rounding !== "half-even") throw new Error("Unsupported rake rounding");
  if (rake.capByDealtIn && !["two", "threeFour", "fivePlus"].every((key) => validInteger(rake.capByDealtIn[key]))) throw new Error("Invalid dealt-in rake caps");
  if (rake.dealtIn !== void 0 && (!Number.isInteger(rake.dealtIn) || rake.dealtIn < 2 || rake.dealtIn > 10)) throw new Error("Invalid rake dealt-in count");
}
function resolveRake(rake, dealtIn) {
  validateRake(rake);
  if (!Number.isInteger(dealtIn) || dealtIn < 2 || dealtIn > 10) throw new Error("Invalid rake dealt-in count");
  const copy = structuredClone(rake);
  if (copy.capByDealtIn) {
    copy.cap = dealtIn === 2 ? copy.capByDealtIn.two : dealtIn <= 4 ? copy.capByDealtIn.threeFour : copy.capByDealtIn.fivePlus;
    copy.dealtIn = dealtIn;
  }
  return copy;
}
function calculateRake(contestedPot, boardLength, rake, chipUnit = 1) {
  validateRake(rake);
  if (!validInteger(chipUnit) || chipUnit === 0) throw new Error("Invalid chip denomination");
  if (!validInteger(contestedPot) || contestedPot % chipUnit !== 0 || rake.cap % chipUnit !== 0) throw new Error("Invalid rake pot or denomination");
  if (rake.noFlopNoDrop && boardLength < 3) return 0;
  const product = BigInt(contestedPot) * BigInt(rake.basisPoints), unit8 = 10000n * BigInt(chipUnit);
  let rounded = product / unit8;
  if (rake.rounding === "half-even") {
    const remainder = product % unit8;
    if (remainder * 2n > unit8 || remainder * 2n === unit8 && rounded % 2n === 1n) rounded += 1n;
  }
  const cents2 = rounded * BigInt(chipUnit);
  return Number(cents2 > BigInt(rake.cap) ? BigInt(rake.cap) : cents2);
}

// src/session/release-scope.ts
var UNAVAILABLE_FEATURES = Object.freeze([
  { id: "run-it-twice", label: "Run it twice", phase: "Optional after R1", reason: "Not implemented. Each hand uses one board and one settlement.", backlog: "FUT001" },
  { id: "bomb-pots", label: "Bomb pots", phase: "Optional after R1", reason: "Not implemented. Normal preflop betting and a single board remain required.", backlog: "FUT004/FUT005" },
  { id: "extra-games", label: "Other poker games", phase: "Optional after R1", reason: "Not implemented. Only No-Limit Texas Hold\u2019em cash games are supported.", backlog: "" },
  { id: "tournaments", label: "Tournament modes", phase: "Later releases R2 / R3", reason: "Unavailable in cash R1. Single-table and multi-table tournament work remains scheduled separately.", backlog: "" },
  { id: "multiplayer", label: "Peer multiplayer", phase: "Optional after R1", reason: "Not implemented. Current opponents are local synthetic policies.", backlog: "FUT055" },
  { id: "table-chat", label: "Table chat", phase: "Optional after R1", reason: "Not implemented. No player messaging service is connected.", backlog: "" },
  { id: "dealer-errors", label: "Dealer errors and floor rulings", phase: "Optional after R1", reason: "Not implemented. No dealer-error or discretionary floor-rule simulation is enabled.", backlog: "" },
  { id: "real-time-assistance", label: "Real-time assistance", phase: "Unsupported", reason: "This standalone practice simulator does not connect to live poker clients or provide in-game assistance.", backlog: "" }
].map((feature) => Object.freeze({ ...feature, available: false })));
var disabled = (value) => value === void 0 || value === null || value === false || value === 0 || value === "" || typeof value === "string" && ["0", "false", "off", "none", "disabled"].includes(value.toLowerCase());
var normalize = (key) => key.toLowerCase().replace(/[-_\s]/g, "");
var unavailableKeys = /* @__PURE__ */ new Set(["runittwice", "runitthrice", "runittimes", "bombpot", "bombpots", "doubleboard", "multiplayer", "peerplay", "tablechat", "chat", "dealererrors", "floorrulings", "realtimeassistance", "rta", "tournament", "tournaments", "straddle", "straddles", "ante", "antes"]);
var flagContainers = /* @__PURE__ */ new Set(["featureflags", "features", "experimentalflags", "experimental", "variants"]);
function assertSupportedCashScope(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Cash settings or rule profile required.");
  for (const [key, value] of Object.entries(candidate)) {
    const normalized = normalize(key);
    const featureKey = normalized.replace(/^enable/, "").replace(/enabled$/, "");
    if (unavailableKeys.has(featureKey) && !disabled(value)) throw new Error(`${key} is unsupported in cash R1 and cannot be enabled.`);
    if (["mode", "gamemode"].includes(normalized) && !disabled(value) && value !== "cash") throw new Error("Only cash mode is supported in R1. Tournament and alternative modes remain unavailable.");
    if (["variant", "gametype", "game"].includes(normalized) && !disabled(value) && !(typeof value === "string" && ["nlhe", "nolimittexasholdem", "texasholdem", "holdem"].includes(normalize(value).replace(/[’']/g, "")))) throw new Error("Only No-Limit Texas Hold\u2019em is supported in cash R1.");
    if (["boardcount", "runoutcount", "runouts"].includes(normalized) && !disabled(value) && value !== 1 && value !== "1") throw new Error("Multiple boards or runouts are unsupported in cash R1.");
    if (flagContainers.has(normalized) && !disabled(value)) {
      if (typeof value !== "object" || value === null || Array.isArray(value) || Object.values(value).some((flag) => !disabled(flag))) throw new Error("Optional feature flags cannot enable unsupported cash formats in R1.");
    }
  }
}

// src/core/engine.ts
var ENGINE_VERSION = "0.4.0";
var integer = (value) => Number.isSafeInteger(value) && value >= 0;
function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}
function clone(value) {
  return structuredClone(value);
}
function seatById(state, id2) {
  const seat = state.seats.find((s) => s.id === id2);
  requireCondition(seat, "Unknown seat");
  return seat;
}
function after(state, id2) {
  const i = state.seats.findIndex((s) => s.id === id2);
  return [...state.seats.slice(i + 1), ...state.seats.slice(0, i + 1)];
}
function clockwise(seats, id2) {
  const ordered2 = [...seats].sort((a, b) => a.id - b.id);
  return [...ordered2.filter((s) => s.id > id2), ...ordered2.filter((s) => s.id <= id2)];
}
function canAct(seat) {
  return !seat.folded && !seat.allIn && seat.stack > 0;
}
function event(state, data) {
  state.events.push({ id: `${state.handId}:${state.events.length}`, handId: state.handId, revision: state.revision, ...data });
}
function transferToPot(state, seat, amount) {
  requireCondition(integer(amount) && amount % state.profile.chipUnit === 0 && amount <= seat.stack, "Invalid chip transfer");
  seat.stack -= amount;
  seat.streetCommitted += amount;
  seat.totalCommitted += amount;
  state.pot += amount;
  seat.allIn = seat.stack === 0;
}
function validateProfile(profile) {
  assertSupportedCashScope(profile);
  requireCondition(profile && profile.mode === "cash" && integer(profile.chipUnit) && profile.chipUnit > 0, "Only integer-cent cash denominations are supported");
  requireCondition(typeof profile.id === "string" && profile.id.length > 0 && typeof profile.version === "string" && profile.version.length > 0, "Rule profile ID/version required");
  requireCondition(integer(profile.smallBlind) && profile.smallBlind > 0 && integer(profile.bigBlind) && profile.bigBlind >= profile.smallBlind, "Invalid blinds");
  requireCondition(profile.smallBlind % profile.chipUnit === 0 && profile.bigBlind % profile.chipUnit === 0, "Blinds must match chip denomination");
  requireCondition(profile.shortRaiseReopens === "cumulative" && profile.oddChipOrder === "clockwise-from-button", "Unsupported rule profile");
  validateRake(profile.rake);
  requireCondition(profile.rake.cap % profile.chipUnit === 0, "Rake cap must match chip denomination");
  const sourced = profile.rake;
  requireCondition(!sourced.capByDealtIn || Object.values(sourced.capByDealtIn).every((cap) => cap % profile.chipUnit === 0), "Rake caps must match chip denomination");
  requireCondition(!sourced.source || profile.chipUnit === 1, "Sourced online rake requires one-cent denomination");
}
function startHand(input) {
  return initializeHand(input);
}
function initializeHand(input, validationDeck) {
  requireCondition(input && typeof input.handId === "string" && input.handId.length > 0, "Hand ID required");
  validateProfile(input.profile);
  requireCondition(Array.isArray(input.seats) && input.seats.length >= 2 && input.seats.length <= 10, "Use 2\u201310 funded seats");
  requireCondition(new Set(input.seats.map((s) => s.id)).size === input.seats.length, "Duplicate seat ID");
  requireCondition(input.seats.every((s) => integer(s.id) && s.id < 10 && integer(s.stack) && s.stack > 0 && typeof s.name === "string"), "Invalid seat or stack");
  requireCondition(input.seats.every((s) => s.stack % input.profile.chipUnit === 0), "Stacks must match chip denomination");
  const initialTotal = input.seats.reduce((n, s) => n + s.stack, 0);
  requireCondition(Number.isSafeInteger(initialTotal), "Total chips exceed safe integer precision");
  const seats = input.seats.map((s) => ({ ...s, startingStack: s.stack, hole: [], streetCommitted: 0, totalCommitted: 0, folded: false, allIn: false, lastActedBet: null })).sort((a, b) => a.id - b.id);
  requireCondition(seats.some((s) => s.id === input.button), "Button must be a participating seat");
  const state = { schemaVersion: "0.1.0", engineVersion: ENGINE_VERSION, handId: input.handId, revision: 0, profile: clone(input.profile), seats, button: input.button, smallBlindSeat: 0, bigBlindSeat: 0, street: "preflop", board: [], deck: validationDeck ?? secureDeck(), deckCursor: 0, burned: [], actor: null, currentBet: input.profile.bigBlind, minFullRaiseIncrement: input.profile.bigBlind, pending: [], pot: 0, pots: [], rake: 0, initialTotal, events: [], committedDecisionIds: [], payouts: {}, revealedSeats: [] };
  state.profile.rake = resolveRake(state.profile.rake, seats.length);
  state.smallBlindSeat = seats.length === 2 ? state.button : after(state, state.button)[0].id;
  state.bigBlindSeat = after(state, state.smallBlindSeat)[0].id;
  event(state, { type: "start", detail: `${state.profile.id}@${state.profile.version}` });
  for (let round = 0; round < 2; round++) for (const seat of after(state, state.button)) seat.hole.push(state.deck[state.deckCursor++]);
  for (const [id2, blind] of [[state.smallBlindSeat, state.profile.smallBlind], [state.bigBlindSeat, state.profile.bigBlind]]) {
    const seat = seatById(state, id2);
    const amount = Math.min(seat.stack, blind);
    transferToPot(state, seat, amount);
    event(state, { type: "blind", seatId: id2, amount });
  }
  state.pending = after(state, state.bigBlindSeat).filter(canAct).map((s) => s.id);
  progress(state);
  assertAccounting(state);
  return state;
}
function nextHand(previous, handId) {
  requireCondition(previous.street === "complete" && previous.actor === null, "Finish the current hand before dealing again");
  requireCondition(typeof handId === "string" && handId.length > 0 && handId !== previous.handId, "A fresh hand ID is required");
  assertAccounting(previous);
  const funded = previous.seats.filter((s) => s.stack > 0);
  requireCondition(funded.length >= 2, "At least two funded seats are required for the next hand");
  let button;
  if (funded.length === 2) {
    const bigBlind = clockwise(funded, previous.bigBlindSeat)[0].id;
    button = funded.find((s) => s.id !== bigBlind).id;
  } else button = clockwise(funded, previous.button)[0].id;
  const state = startHand({ handId, profile: previous.profile, button, seats: funded.map(({ id: id2, name, stack }) => ({ id: id2, name, stack })) });
  if (previous.tableTransfers) state.tableTransfers = clone(previous.tableTransfers);
  const configured = previous;
  if (configured.lastTableConfiguration) state.lastTableConfiguration = clone(configured.lastTableConfiguration);
  return state;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function reconfigureTable(previous, seats, profile, transferId) {
  requireCondition(previous.street === "complete" && previous.actor === null, "Finish the current hand before reconfiguring");
  requireCondition(typeof transferId === "string" && transferId.length > 0, "Transfer ID required");
  validateProfile(profile);
  requireCondition(Array.isArray(seats) && seats.length >= 2 && seats.length <= 10, "Use 2\u201310 occupied seats");
  requireCondition(new Set(seats.map((s) => s.id)).size === seats.length, "Duplicate seat ID");
  requireCondition(seats.every((s) => integer(s.id) && s.id < 10 && integer(s.stack) && typeof s.name === "string"), "Invalid seat or stack");
  requireCondition(seats.every((s) => s.stack % profile.chipUnit === 0), "Stacks must match chip denomination");
  requireCondition(seats.filter((s) => s.stack > 0).length >= 2, "At least two funded seats are required for the next hand");
  const request = { id: transferId, seats: seats.map(({ id: id2, name, stack }) => ({ id: id2, name, stack })).sort((a, b) => a.id - b.id), profile: clone(profile) };
  const prior = previous.lastTableConfiguration;
  if (prior?.id === transferId) {
    requireCondition(canonical(prior) === canonical(request), "Conflicting table configuration ID");
    return previous;
  }
  const receiptPrefix = `configuration:${transferId.length}:${transferId}:seat:`;
  requireCondition(!previous.tableTransfers?.some((t) => t.id.startsWith(receiptPrefix)), "Table configuration ID already applied");
  assertAccounting(previous);
  const before = new Map(previous.seats.map((s) => [s.id, s]));
  const target = new Map(request.seats.map((s) => [s.id, s]));
  const ids = [.../* @__PURE__ */ new Set([...before.keys(), ...target.keys()])].sort((a, b) => a - b);
  const transfers = ids.map((seatId) => ({ id: `${receiptPrefix}${seatId}`, seatId, amount: (target.get(seatId)?.stack ?? 0) - (before.get(seatId)?.stack ?? 0) }));
  const initialTotal = previous.initialTotal + transfers.reduce((sum, t) => sum + t.amount, 0);
  requireCondition(integer(initialTotal) && Number.isSafeInteger(request.seats.reduce((sum, s) => sum + s.stack, 0)), "Total chips exceed safe integer precision");
  const state = clone(previous);
  state.seats = request.seats.map((seat) => {
    const existing = before.get(seat.id);
    return existing ? { ...clone(existing), name: seat.name, stack: seat.stack, allIn: seat.stack === 0 } : { ...seat, startingStack: 0, hole: [], streetCommitted: 0, totalCommitted: 0, folded: true, allIn: seat.stack === 0, lastActedBet: null };
  });
  state.profile = clone(profile);
  state.initialTotal = initialTotal;
  state.revision++;
  state.tableTransfers = [...state.tableTransfers ?? [], ...transfers];
  state.lastTableConfiguration = request;
  assertAccounting(state);
  return state;
}
function topUpTable(previous, seatId, amount, transferId, maxStack) {
  requireCondition(previous.street === "complete" && previous.actor === null, "Finish the current hand before adding chips");
  requireCondition(typeof transferId === "string" && transferId.length > 0, "Transfer ID required");
  requireCondition(integer(amount) && amount > 0 && integer(maxStack) && maxStack > 0, "Invalid table transfer");
  requireCondition(amount % previous.profile.chipUnit === 0 && maxStack % previous.profile.chipUnit === 0, "Transfer must match chip denomination");
  const prior = previous.tableTransfers?.find((t) => t.id === transferId);
  if (prior) {
    requireCondition(prior.seatId === seatId && prior.amount === amount, "Conflicting transfer ID");
    return previous;
  }
  assertAccounting(previous);
  const seat = seatById(previous, seatId);
  requireCondition(Number.isSafeInteger(seat.stack + amount) && seat.stack + amount <= maxStack, "Top-up exceeds the table maximum");
  requireCondition(Number.isSafeInteger(previous.initialTotal + amount), "Total chips exceed safe integer precision");
  const state = clone(previous);
  const recipient = seatById(state, seatId);
  recipient.stack += amount;
  recipient.allIn = false;
  state.initialTotal += amount;
  state.revision += 1;
  state.tableTransfers = [...state.tableTransfers ?? [], { id: transferId, seatId, amount }];
  assertAccounting(state);
  return state;
}
function legalActions(state) {
  const none = { actor: null, fold: false, check: false, callAmount: 0, minRaiseTo: null, maxRaiseTo: null, canRaise: false, shortAllInTo: null, reopened: false };
  if (state.street === "complete" || state.actor === null) return none;
  const seat = seatById(state, state.actor);
  const owed = Math.max(0, state.currentBet - seat.streetCommitted);
  const reopened = seat.lastActedBet === null || seat.lastActedBet === 0 || state.currentBet - seat.lastActedBet >= state.minFullRaiseIncrement;
  const minRaiseTo = state.currentBet === 0 ? state.profile.bigBlind : state.currentBet + state.minFullRaiseIncrement;
  const maxRaiseTo = seat.streetCommitted + seat.stack;
  const opponentCanRespond = state.seats.some((s) => s.id !== seat.id && canAct(s));
  const canRaise = reopened && maxRaiseTo > state.currentBet && opponentCanRespond;
  return { actor: seat.id, fold: true, check: owed === 0, callAmount: Math.min(owed, seat.stack), minRaiseTo: canRaise ? minRaiseTo : null, maxRaiseTo: canRaise ? maxRaiseTo : null, canRaise, shortAllInTo: canRaise && maxRaiseTo < minRaiseTo ? maxRaiseTo : null, reopened };
}
function applyCommand(previous, command) {
  requireCondition(command && command.handId === previous.handId, "Stale hand");
  requireCondition(typeof command.decisionId === "string" && command.decisionId.length > 0, "Decision ID required");
  if (previous.committedDecisionIds.includes(command.decisionId)) return previous;
  requireCondition(command.revision === previous.revision, "Stale revision");
  requireCondition(previous.street !== "complete" && command.seatId === previous.actor, "Not the acting seat");
  const legal = legalActions(previous);
  requireCondition(command.action && typeof command.action.type === "string", "Invalid action");
  const type = command.action.type;
  requireCondition(["fold", "check", "call", "raise"].includes(type), "Unknown action");
  if (type === "check") requireCondition(legal.check, "Cannot check facing a bet");
  if (type === "call") requireCondition(legal.callAmount > 0, "Nothing to call");
  if (type === "raise") {
    const to = command.action.to;
    requireCondition(legal.canRaise && integer(to) && to % previous.profile.chipUnit === 0 && to > previous.currentBet && to <= legal.maxRaiseTo, "Illegal raise");
    requireCondition(to >= legal.minRaiseTo || to === legal.shortAllInTo, "Raise below minimum unless all-in");
  }
  const state = clone(previous);
  state.revision++;
  const seat = seatById(state, command.seatId);
  let amount = 0;
  if (type === "fold") seat.folded = true;
  if (type === "call") {
    amount = legal.callAmount;
    transferToPot(state, seat, amount);
  }
  if (type === "raise" && command.action.type === "raise") {
    amount = command.action.to - seat.streetCommitted;
    const increment = command.action.to - state.currentBet;
    transferToPot(state, seat, amount);
    if (increment >= state.minFullRaiseIncrement) state.minFullRaiseIncrement = increment;
    state.currentBet = command.action.to;
    state.pending = after(state, seat.id).filter((s) => s.id !== seat.id && canAct(s)).map((s) => s.id);
  } else state.pending = state.pending.filter((id2) => id2 !== seat.id);
  seat.lastActedBet = state.currentBet;
  state.committedDecisionIds.push(command.decisionId);
  event(state, { type: "action", seatId: seat.id, amount, action: clone(command.action), decisionId: command.decisionId, street: state.street });
  progress(state);
  assertAccounting(state);
  return state;
}
function progress(state) {
  for (; ; ) {
    const contenders = state.seats.filter((s) => !s.folded);
    if (contenders.length === 1) {
      settle(state, false);
      return;
    }
    const actors = state.seats.filter(canAct);
    state.pending = state.pending.filter((id2) => canAct(seatById(state, id2)));
    if (actors.length === 1) {
      const only = actors[0];
      const opponentBet = Math.max(...contenders.filter((s) => s.id !== only.id).map((s) => s.streetCommitted));
      if (only.streetCommitted >= opponentBet) state.pending = [];
      else {
        state.currentBet = opponentBet;
        state.pending = [only.id];
      }
    }
    if (state.pending.length) {
      state.actor = state.pending[0];
      return;
    }
    state.actor = null;
    if (state.street === "river") {
      settle(state, true);
      return;
    }
    const next = state.street === "preflop" ? "flop" : state.street === "flop" ? "turn" : "river";
    state.burned.push(state.deck[state.deckCursor++]);
    const cards = state.deck.slice(state.deckCursor, state.deckCursor + (next === "flop" ? 3 : 1));
    state.deckCursor += cards.length;
    state.board.push(...cards);
    state.street = next;
    requireCondition(state.board.every(Boolean) && state.deckCursor <= 52, "Deck exhausted");
    event(state, { type: "street", street: next, cards: [...cards] });
    state.currentBet = 0;
    state.minFullRaiseIncrement = state.profile.bigBlind;
    state.seats.forEach((s) => {
      s.streetCommitted = 0;
      s.lastActedBet = null;
    });
    state.pending = after(state, state.button).filter(canAct).map((s) => s.id);
  }
}
function derivePots(state) {
  const ordered2 = [...state.seats].sort((a, b) => b.totalCommitted - a.totalCommitted);
  const excess = ordered2[0].totalCommitted - ordered2[1].totalCommitted;
  const uncalledBet = excess > 0 ? { seatId: ordered2[0].id, amount: excess } : null;
  const contributions = state.seats.map((seat) => ({ seat, amount: seat.totalCommitted - (uncalledBet?.seatId === seat.id ? uncalledBet.amount : 0) }));
  const levels = [...new Set(contributions.map((c) => c.amount).filter((n) => n > 0))].sort((a, b) => a - b);
  const pots = [];
  let before = 0;
  for (const level of levels) {
    const contributors = contributions.filter((c) => c.amount >= level);
    const eligible = contributors.filter((c) => !c.seat.folded).map((c) => c.seat.id);
    requireCondition(eligible.length > 0, "Pot has no eligible winner");
    const amount = (level - before) * contributors.length;
    const previous = pots[pots.length - 1];
    if (previous && previous.eligible.length === eligible.length && previous.eligible.every((id2, i) => id2 === eligible[i])) previous.amount += amount;
    else pots.push({ amount, eligible, winners: [] });
    before = level;
  }
  return { pots, uncalledBet };
}
function settle(state, showdown) {
  if (state.street === "complete") return;
  const { pots, uncalledBet } = derivePots(state);
  if (uncalledBet) {
    const winner = seatById(state, uncalledBet.seatId);
    const refund = uncalledBet.amount;
    winner.totalCommitted -= refund;
    winner.streetCommitted = Math.max(0, winner.streetCommitted - refund);
    winner.stack += refund;
    winner.allIn = winner.stack === 0;
    state.pot -= refund;
    event(state, { type: "refund", seatId: winner.id, amount: refund });
  }
  state.rake = calculateRake(state.pot, state.board.length, state.profile.rake, state.profile.chipUnit);
  let rakeRemaining = state.rake;
  if (state.rake) event(state, { type: "rake", amount: state.rake });
  if (showdown) state.revealedSeats = state.seats.filter((s) => !s.folded).map((s) => s.id);
  const ranks = new Map(state.revealedSeats.map((id2) => [id2, evaluate([...seatById(state, id2).hole, ...state.board])]));
  for (const pot of pots) {
    const taken = Math.min(rakeRemaining, pot.amount);
    pot.amount -= taken;
    rakeRemaining -= taken;
    let winners = [pot.eligible[0]];
    if (showdown) for (const id2 of pot.eligible.slice(1)) {
      const c = compareRanks(ranks.get(id2), ranks.get(winners[0]));
      if (c > 0) winners = [id2];
      else if (c === 0) winners.push(id2);
    }
    pot.winners = winners;
    const order = after(state, state.button).filter((s) => winners.includes(s.id));
    const chipUnit = state.profile.chipUnit;
    const share = Math.floor(pot.amount / chipUnit / winners.length) * chipUnit;
    const odd = (pot.amount - share * winners.length) / chipUnit;
    order.forEach((s, i) => {
      const amount = share + (i < odd ? chipUnit : 0);
      s.stack += amount;
      s.allIn = s.stack === 0;
      state.payouts[s.id] = (state.payouts[s.id] ?? 0) + amount;
      event(state, { type: "award", seatId: s.id, amount, detail: showdown ? "Showdown" : "Uncontested" });
    });
  }
  state.pots = pots;
  state.pot = 0;
  state.street = "complete";
  state.actor = null;
  state.pending = [];
}
function assertAccounting(state) {
  requireCondition(state.seats.every((s) => integer(s.stack) && integer(s.totalCommitted) && integer(s.streetCommitted)), "Invalid chip state");
  requireCondition(state.seats.reduce((n, s) => n + s.stack, 0) + state.pot + state.rake === state.initialTotal, "Chip conservation failure");
}
function projectView(state, heroSeat) {
  requireCondition(state.seats.some((s) => s.id === heroSeat), "Unknown viewer seat");
  const seats = state.seats.map(({ lastActedBet: _lastActedBet, hole, ...seat }) => ({ ...seat, hole: seat.id === heroSeat || state.revealedSeats.includes(seat.id) ? [...hole] : [] }));
  const { pots, uncalledBet } = state.street === "complete" ? { pots: state.pots, uncalledBet: null } : derivePots(state);
  const handLabels = {};
  if (state.street === "complete" && state.board.length === 5) {
    for (const seat of state.seats) if (!seat.folded && state.revealedSeats.includes(seat.id)) handLabels[seat.id] = handLabel(evaluate([...seat.hole, ...state.board]));
  }
  return clone({ handId: state.handId, revision: state.revision, profile: state.profile, seats, button: state.button, smallBlindSeat: state.smallBlindSeat, bigBlindSeat: state.bigBlindSeat, street: state.street, board: state.board, actor: state.actor, pot: state.pot, pots, rake: state.rake, payouts: state.payouts, legal: legalActions(state), events: state.events, uncalledBet, handLabels });
}
function observeBot(state, seatId, policyVersion, decisionId) {
  requireCondition(state.actor === seatId && state.street !== "complete", "Observation requires current actor");
  requireCondition(typeof policyVersion === "string" && policyVersion.length > 0 && typeof decisionId === "string" && decisionId.length > 0, "Decision identity required");
  return clone({ handId: state.handId, revision: state.revision, actingSeat: seatId, decisionId, policyVersion, ownCards: seatById(state, seatId).hole, board: state.board, street: state.street, button: state.button, pot: state.pot, bigBlind: state.profile.bigBlind, ...state.profile.chipUnit === 1 ? {} : { chipUnit: state.profile.chipUnit }, seats: state.seats.map(({ id: id2, stack, streetCommitted, totalCommitted, folded, allIn }) => ({ id: id2, stack, streetCommitted, totalCommitted, folded, allIn })), legal: legalActions(state), publicEvents: state.events });
}
function validatePublicReplay(frames) {
  requireCondition(Array.isArray(frames) && frames.length > 0, "Replay frames required");
  const first = frames[0], last = frames[frames.length - 1];
  requireCondition(first && last && first.revision === 0 && last.street === "complete", "Replay must start at revision zero and finish settled");
  requireCondition(first.seats.some((seat) => seat.id === 0), "Replay must contain Hero");
  const seats = [...first.seats].sort((a, b) => a.id - b.id);
  const lastById = new Map(last.seats.map((seat) => [seat.id, seat]));
  const knownHoles = /* @__PURE__ */ new Map();
  for (const seat of seats) {
    const final = lastById.get(seat.id);
    requireCondition(final && Array.isArray(final.hole) && (final.hole.length === 0 || final.hole.length === 2), "Invalid replay hole cards");
    const known2 = seat.id === 0 ? first.seats.find((s) => s.id === 0).hole : final.hole;
    requireCondition(Array.isArray(known2) && (known2.length === 0 || known2.length === 2), "Invalid replay hole cards");
    if (seat.id === 0) requireCondition(known2.length === 2, "Hero cards required");
    knownHoles.set(seat.id, [...known2]);
  }
  requireCondition(Array.isArray(last.board) && [0, 3, 4, 5].includes(last.board.length), "Invalid replay board");
  const known = [...knownHoles.values()].flat().concat(last.board);
  requireCondition(known.every((card) => typeof card === "string" && /^[2-9TJQKA][cdhs]$/.test(card)) && new Set(known).size === known.length, "Repeated or invalid replay cards");
  const unused = standardDeck().filter((card) => !known.includes(card));
  const take = () => {
    const card = unused.shift();
    requireCondition(card, "Replay deck exhausted");
    return card;
  };
  for (const seat of seats) if (knownHoles.get(seat.id).length === 0) knownHoles.set(seat.id, [take(), take()]);
  const buttonIndex = seats.findIndex((seat) => seat.id === first.button);
  requireCondition(buttonIndex >= 0, "Replay button missing");
  const order = [...seats.slice(buttonIndex + 1), ...seats.slice(0, buttonIndex + 1)];
  const deck = [];
  for (let round = 0; round < 2; round++) for (const seat of order) deck.push(knownHoles.get(seat.id)[round]);
  const board = Array.from({ length: 5 }, (_, i) => last.board[i] ?? take());
  deck.push(take(), ...board.slice(0, 3), take(), board[3], take(), board[4], ...unused);
  requireCondition(deck.length === 52 && new Set(deck).size === 52, "Invalid replay deck");
  let state = initializeHand({ handId: first.handId, button: first.button, profile: first.profile, seats: seats.map((seat) => ({ id: seat.id, name: seat.name, stack: seat.startingStack })) }, deck);
  const canonical10 = (value) => JSON.stringify(normalize2(value));
  function normalize2(value) {
    if (Array.isArray(value)) return value.map(normalize2);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalize2(entry)]));
    return value;
  }
  requireCondition(canonical10(projectView(state, 0)) === canonical10(first), "Initial replay frame differs from authoritative deal");
  for (let index2 = 1; index2 < frames.length; index2++) {
    requireCondition(state.street !== "complete", "Replay continues after settlement");
    const frame = frames[index2];
    requireCondition(frame && frame.handId === state.handId && frame.revision === state.revision + 1, "Replay revision discontinuity");
    requireCondition(Array.isArray(frame.events), "Replay events required");
    const additions = frame.events.slice(state.events.length), actions = additions.filter((event2) => event2.type === "action");
    requireCondition(actions.length === 1, "One authoritative action per replay revision required");
    const action = actions[0];
    requireCondition(action.action && action.decisionId && action.seatId === state.actor && action.revision === frame.revision && action.handId === state.handId, "Replay action identity mismatch");
    state = applyCommand(state, { handId: state.handId, revision: state.revision, seatId: action.seatId, decisionId: action.decisionId, action: action.action });
    requireCondition(canonical10(projectView(state, 0)) === canonical10(frame), "Replay frame differs from authoritative action");
  }
  requireCondition(state.street === "complete", "Replay did not settle");
}

// ../../workspace/sites/ai-texas-hold-em/node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// ../../workspace/sites/ai-texas-hold-em/node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// ../../workspace/sites/ai-texas-hold-em/node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// src/session/hand-provenance.ts
function requireProvenance(ok, message) {
  if (!ok) throw new Error(message);
}
function canonical2(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical2).join(",")}]`;
  const record = value;
  return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonical2(record[key])}`).join(",")}}`;
}
function ruleProfileFingerprint(profile) {
  requireProvenance(profile && typeof profile.id === "string" && profile.id.length > 0 && typeof profile.version === "string" && profile.version.length > 0, "Missing ruleset identity for hand provenance.");
  return [...sha256(new TextEncoder().encode(canonical2(profile)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function ruleTag(profile) {
  return { id: profile.id, version: profile.version, fingerprint: ruleProfileFingerprint(profile) };
}
function makeCashHandProvenance(profile) {
  return Object.freeze({ version: 1, mode: "cash", source: "csprng", ruleset: Object.freeze(ruleTag(profile)) });
}
function exactPlain(value, keys4) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys4.length && actual.every((key) => typeof key === "string" && keys4.includes(key) && Object.getOwnPropertyDescriptor(value, key)?.get === void 0 && Object.getOwnPropertyDescriptor(value, key)?.set === void 0);
}
function validateHandProvenance(hand) {
  if (hand.provenance === void 0) return null;
  const value = hand.provenance;
  requireProvenance(exactPlain(value, ["version", "mode", "source", "ruleset"]), "Invalid hand provenance structure.");
  requireProvenance(value.version === 1, "Unsupported hand provenance version.");
  requireProvenance(value.mode === "cash" && value.source === "csprng" || value.mode === "lab" && value.source === "fixed-deck", "Incoherent hand mode/source provenance.");
  requireProvenance(exactPlain(value.ruleset, ["id", "version", "fingerprint"]), "Invalid hand ruleset provenance structure.");
  const rules2 = value.ruleset, profile = hand.view.profile;
  requireProvenance(typeof rules2.id === "string" && rules2.id === profile.id && typeof rules2.version === "string" && rules2.version === profile.version, "Hand provenance ruleset identity differs from recorded hand.");
  requireProvenance(typeof rules2.fingerprint === "string" && /^[0-9a-f]{64}$/.test(rules2.fingerprint) && rules2.fingerprint === ruleProfileFingerprint(profile), "Hand provenance ruleset fingerprint differs from recorded hand.");
  for (const frame of hand.frames ?? []) requireProvenance(ruleProfileFingerprint(frame.profile) === rules2.fingerprint, "Hand provenance ruleset changed during replay.");
  return value;
}
function assertCashHandProvenance(hand) {
  const provenance = validateHandProvenance(hand);
  requireProvenance(provenance === null || provenance.mode === "cash" && provenance.source === "csprng", "Lab/fixed-deck hands cannot enter cash accounting or performance.");
}
function isCashPerformanceHand(hand, namespace) {
  requireProvenance(["cash", "imported", "lab"].includes(namespace), "Unknown hand provenance namespace.");
  const provenance = validateHandProvenance(hand);
  return namespace === "cash" && (provenance === null || provenance.mode === "cash" && provenance.source === "csprng");
}

// src/session/notes.ts
var MAX_PLAYER_NOTES = 200;
var MAX_PLAYER_NOTE_LENGTH = 500;
var keys = ["id", "sessionId", "seatId", "text", "revision", "createdAt", "updatedAt"];
function requireNote(ok, message) {
  if (!ok) throw Error(message);
}
var sequence = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
var timestamp = (value) => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
var noteId = (sessionId, seatId) => `player-note:${sessionId}:${seatId}`;
function plain(value, fields) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key) => fields.includes(key));
}
function knownPlayer(data, sessionId, seatId) {
  if (!data.sessions.some((session) => session.id === sessionId)) return false;
  if (data.active?.sessionId === sessionId && data.active.game.seats.some((seat) => seat.id === seatId)) return true;
  return data.hands.some((hand) => hand.sessionId === sessionId && hand.view.seats.some((seat) => seat.id === seatId));
}
function getPlayerNote(data, sessionId, seatId) {
  return data.userNotes?.entries.find((note) => note.sessionId === sessionId && note.seatId === seatId);
}
function validateText(text) {
  requireNote(typeof text === "string" && text.trim().length > 0 && text.length <= MAX_PLAYER_NOTE_LENGTH, `Enter a player note between 1 and ${MAX_PLAYER_NOTE_LENGTH} characters.`);
  requireNote(![...text].some((character) => {
    const code = character.charCodeAt(0);
    return code === 127 || code < 32 && ![9, 10, 13].includes(code);
  }), "Player notes must be plain text without control characters.");
}
function validateUserNotes(data, prior) {
  const notes = data.userNotes;
  if (prior && notes === prior.userNotes) return;
  if (notes === void 0) {
    requireNote(!prior?.userNotes, "Remove player notes individually or use explicit all-data deletion.");
    return;
  }
  requireNote(plain(notes, ["version", "revision", "entries"]) && notes.version === 1 && sequence(notes.revision) && Array.isArray(notes.entries), "Unsupported or invalid player-note data. Existing notes were preserved.");
  requireNote(notes.entries.length <= MAX_PLAYER_NOTES, `At most ${MAX_PLAYER_NOTES} player notes can be stored. Delete a note before adding another.`);
  const ids = /* @__PURE__ */ new Set(), revisions = /* @__PURE__ */ new Set(), previous = new Map((prior?.userNotes?.entries ?? []).map((note) => [note.id, note]));
  let changes = 0;
  for (const note of notes.entries) {
    requireNote(plain(note, keys) && typeof note.sessionId === "string" && note.sessionId.length > 0 && note.sessionId.length <= 160 && Number.isInteger(note.seatId) && note.seatId >= 0 && note.seatId <= 9 && note.id === noteId(note.sessionId, note.seatId) && !ids.has(note.id), "Invalid or duplicate player-note identity.");
    ids.add(note.id);
    requireNote(sequence(note.revision) && note.revision > 0 && note.revision <= notes.revision && !revisions.has(note.revision), "Invalid player-note revision.");
    revisions.add(note.revision);
    const old = previous.get(note.id);
    previous.delete(note.id);
    if (old === note) continue;
    validateText(note.text);
    requireNote(note.text === note.text.trim(), "Saved player notes must not have surrounding whitespace.");
    requireNote(timestamp(note.createdAt) && timestamp(note.updatedAt) && Date.parse(note.updatedAt) >= Date.parse(note.createdAt), "Invalid player-note timestamps.");
    requireNote(knownPlayer(data, note.sessionId, note.seatId), "Player note must refer to a publicly seated player in an existing session.");
    if (prior) {
      changes++;
      requireNote(note.revision === notes.revision && (!old || old.createdAt === note.createdAt), "A changed note must use the current note revision and preserve its creation time.");
    }
  }
  if (prior) {
    changes += previous.size;
    requireNote(notes.revision === (prior.userNotes?.revision ?? 0) + 1 && changes === 1, "Player-note update must change exactly one note with the next revision.");
  }
}
function savePlayerNote(data, sessionId, seatId, text, expectedNoteRevision = 0, at = (/* @__PURE__ */ new Date()).toISOString()) {
  validateText(text);
  const normalized = text.trim();
  requireNote(sequence(expectedNoteRevision), "Invalid expected player-note revision.");
  requireNote(knownPlayer(data, sessionId, seatId), "Choose a publicly seated player in this session.");
  const existing = getPlayerNote(data, sessionId, seatId), notes = data.userNotes ?? { version: 1, revision: 0, entries: [] };
  if (existing?.text === normalized) return notes;
  requireNote((existing?.revision ?? 0) === expectedNoteRevision, "This player note changed. Reload the saved note before editing; your draft was not saved.");
  requireNote(existing || notes.entries.length < MAX_PLAYER_NOTES, `At most ${MAX_PLAYER_NOTES} player notes can be stored. Delete a note before adding another.`);
  const revision = notes.revision + 1;
  requireNote(sequence(revision), "Player-note revision limit reached.");
  requireNote(timestamp(at), "Invalid player-note time.");
  const updatedAt = existing && Date.parse(at) < Date.parse(existing.updatedAt) ? existing.updatedAt : at;
  const note = { id: noteId(sessionId, seatId), sessionId, seatId, text: normalized, revision, createdAt: existing?.createdAt ?? at, updatedAt };
  return { version: 1, revision, entries: existing ? notes.entries.map((previous) => previous.id === note.id ? note : previous) : [...notes.entries, note] };
}
function deletePlayerNote(data, sessionId, seatId, expectedNoteRevision) {
  requireNote(sequence(expectedNoteRevision), "Invalid expected player-note revision.");
  const existing = getPlayerNote(data, sessionId, seatId);
  if (!existing) return data.userNotes;
  requireNote(existing.revision === expectedNoteRevision, "This player note changed. Reload the saved note before deleting it.");
  const notes = data.userNotes, revision = notes.revision + 1;
  requireNote(sequence(revision), "Player-note revision limit reached.");
  return { version: 1, revision, entries: notes.entries.filter((note) => note.id !== existing.id) };
}

// src/session/configuration-history.ts
var selections = ["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg", "random", "unknown", "custom"];
var reasons = ["session-start", "next-hand-configuration", "next-hand-table-change", "first-recorded-boundary"];
var keys2 = ["version", "id", "sequence", "sessionId", "effectiveHandNumber", "effectiveHandId", "recordedAt", "reason", "evidenceStatus", "population", "tableMode", "capacity", "occupiedSeatIds", "selectionMix", "rules", "policyVersions"];
function requireHistory(ok, message) {
  if (!ok) throw Error(message);
}
var integer2 = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
var identity = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function exact(value, expected) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key));
}
function description(settings, game, profiles) {
  const occupiedSeatIds2 = game.seats.map((seat) => seat.id).sort((a, b) => a - b), counts8 = /* @__PURE__ */ new Map();
  for (const seat of occupiedSeatIds2.filter((id2) => id2 !== 0)) {
    const selection = settings.opponents?.[seat - 1]?.selection ?? settings.archetypes[seat - 1] ?? "tag";
    counts8.set(selection, (counts8.get(selection) ?? 0) + 1);
  }
  const p = game.profile;
  return {
    evidenceStatus: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED",
    population: settings.population ?? "neutral",
    tableMode: settings.tableMode ?? "live",
    capacity: settings.capacity ?? settings.seats,
    occupiedSeatIds: occupiedSeatIds2,
    selectionMix: [...counts8].sort(([a], [b]) => a.localeCompare(b)).map(([selection, count]) => ({ selection, count })),
    rules: { id: p.id, version: p.version, fingerprint: ruleProfileFingerprint(p), smallBlind: p.smallBlind, bigBlind: p.bigBlind, chipUnit: p.chipUnit, rake: structuredClone(p.rake) },
    policyVersions: [...new Set(occupiedSeatIds2.filter((id2) => id2 !== 0).map((id2) => profiles[id2]?.policyVersion).filter((version) => typeof version === "string"))].sort()
  };
}
function facts(entry) {
  return { evidenceStatus: entry.evidenceStatus, population: entry.population, tableMode: entry.tableMode, capacity: entry.capacity, occupiedSeatIds: entry.occupiedSeatIds, selectionMix: entry.selectionMix, rules: entry.rules, policyVersions: entry.policyVersions };
}
function recordConfigurationBoundary(data, explicitChange = false) {
  const active = data.active;
  requireHistory(active && active.frames.length === 1 && active.frames[0].handId === active.game.handId, "Configuration provenance requires a newly started hand.");
  const session = data.sessions.find((s) => s.id === active.sessionId);
  requireHistory(session, "Configuration session is missing.");
  const previous = session.configurationHistory?.at(-1), current = description(session.settings, active.game, active.profiles);
  if (previous && !explicitChange && same(facts(previous), current)) {
    active.configuration = previous;
    return;
  }
  const sequence2 = (previous?.sequence ?? 0) + 1;
  const entry = {
    version: 1,
    id: `${session.id}:configuration:${sequence2}`,
    sequence: sequence2,
    sessionId: session.id,
    effectiveHandNumber: active.number,
    effectiveHandId: active.game.handId,
    recordedAt: active.startedAt,
    reason: previous ? explicitChange ? "next-hand-configuration" : "next-hand-table-change" : active.number === 1 ? "session-start" : "first-recorded-boundary",
    ...current
  };
  session.configurationHistory = [...session.configurationHistory ?? [], entry];
  active.configuration = entry;
}
function validateRecordedConfiguration(entry) {
  requireHistory(exact(entry, keys2) && entry.version === 1 && identity(entry.id) && identity(entry.sessionId) && identity(entry.effectiveHandId) && integer2(entry.sequence) && entry.sequence > 0 && integer2(entry.effectiveHandNumber) && entry.effectiveHandNumber > 0, "Invalid recorded configuration identity/version.");
  requireHistory(entry.id === `${entry.sessionId}:configuration:${entry.sequence}` && typeof entry.recordedAt === "string" && entry.recordedAt.length <= 40 && Number.isFinite(Date.parse(entry.recordedAt)) && reasons.includes(entry.reason), "Invalid recorded configuration boundary.");
  requireHistory(entry.evidenceStatus === "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" && ["low", "mid", "high", "neutral"].includes(entry.population) && ["live", "study"].includes(entry.tableMode), "Configuration evidence/population status is invalid.");
  requireHistory(integer2(entry.capacity) && entry.capacity >= 2 && entry.capacity <= 10 && Array.isArray(entry.occupiedSeatIds) && entry.occupiedSeatIds.length >= 2 && entry.occupiedSeatIds.length <= entry.capacity && entry.occupiedSeatIds.includes(0) && entry.occupiedSeatIds.every((id2, i) => integer2(id2) && id2 < entry.capacity && (i === 0 || entry.occupiedSeatIds[i - 1] < id2)), "Invalid recorded seat layout.");
  requireHistory(Array.isArray(entry.selectionMix) && entry.selectionMix.length <= 9 && entry.selectionMix.every((mix, i) => exact(mix, ["selection", "count"]) && selections.includes(mix.selection) && integer2(mix.count) && mix.count > 0 && (i === 0 || entry.selectionMix[i - 1].selection.localeCompare(mix.selection) < 0)) && entry.selectionMix.reduce((sum, mix) => sum + mix.count, 0) === entry.occupiedSeatIds.length - 1, "Invalid recorded public selection mix.");
  const r = entry.rules;
  requireHistory(exact(r, ["id", "version", "fingerprint", "smallBlind", "bigBlind", "chipUnit", "rake"]) && identity(r.id) && identity(r.version) && typeof r.fingerprint === "string" && /^[0-9a-f]{64}$/.test(r.fingerprint) && integer2(r.smallBlind) && r.smallBlind > 0 && integer2(r.bigBlind) && r.bigBlind >= r.smallBlind && integer2(r.chipUnit) && r.chipUnit > 0, "Invalid recorded rule provenance.");
  requireHistory(r.rake && typeof r.rake === "object" && Object.keys(r.rake).every((key) => ["basisPoints", "cap", "noFlopNoDrop", "rounding", "capByDealtIn", "dealtIn", "source"].includes(key)), "Invalid recorded rake assumptions.");
  validateRake(r.rake);
  if (r.rake.capByDealtIn) requireHistory(exact(r.rake.capByDealtIn, ["two", "threeFour", "fivePlus"]), "Invalid recorded rake cap metadata.");
  if (r.rake.source) requireHistory(exact(r.rake.source, ["url", "retrievedAt", "currency", "format"]) && typeof r.rake.source.url === "string" && r.rake.source.url.length <= 500 && typeof r.rake.source.retrievedAt === "string" && r.rake.source.retrievedAt.length <= 40 && r.rake.source.currency === "USD" && r.rake.source.format === "regular-nlhe", "Invalid recorded rake source.");
  requireHistory(Array.isArray(entry.policyVersions) && entry.policyVersions.length <= 9 && entry.policyVersions.every((version, i) => typeof version === "string" && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(version) && (i === 0 || entry.policyVersions[i - 1] < version)), "Invalid recorded policy-version metadata.");
}
function validateHandConfiguration(hand) {
  const entry = hand.configuration;
  if (entry === void 0) return;
  validateRecordedConfiguration(entry);
  const p = hand.view.profile;
  requireHistory(entry.sessionId === hand.sessionId && entry.effectiveHandNumber <= hand.number && entry.rules.id === p.id && entry.rules.version === p.version && entry.rules.fingerprint === ruleProfileFingerprint(p) && entry.rules.smallBlind === p.smallBlind && entry.rules.bigBlind === p.bigBlind && entry.rules.chipUnit === p.chipUnit && same(entry.rules.rake, p.rake) && same(entry.occupiedSeatIds, hand.view.seats.map((s) => s.id).sort((a, b) => a - b)), "Recorded configuration differs from the actual hand.");
}
function validateConfigurationHistory(data, prior) {
  const bySession = new Map(data.sessions.map((session) => [session.id, session]));
  for (let i = 0; i < data.sessions.length; i++) {
    const session = data.sessions[i], entries = session.configurationHistory ?? [], old = prior?.sessions[i]?.configurationHistory ?? [];
    requireHistory(Array.isArray(entries), "Invalid session configuration history.");
    if (prior && entries !== old) {
      requireHistory(entries.length >= old.length, "Configuration history lost boundaries.");
      for (let j = 0; j < old.length; j++) requireHistory(entries[j] === old[j], "Configuration history prefix changed.");
    }
    for (let j = prior ? old.length : 0; j < entries.length; j++) {
      const entry = entries[j];
      validateRecordedConfiguration(entry);
      requireHistory(entry.sessionId === session.id && entry.sequence === j + 1 && (j === 0 || entries[j - 1].effectiveHandNumber < entry.effectiveHandNumber), "Configuration boundaries are missing, duplicated or out of order.");
      const expected = session.handIds[entry.effectiveHandNumber - 1] ?? (data.active?.sessionId === session.id && data.active.number === entry.effectiveHandNumber ? data.active.game.handId : void 0);
      requireHistory(expected === entry.effectiveHandId, "Configuration boundary has no matching actual hand.");
    }
  }
  for (let i = prior?.hands.length ?? 0; i < data.hands.length; i++) {
    const hand = data.hands[i], entries = bySession.get(hand.sessionId)?.configurationHistory ?? [], expected = [...entries].reverse().find((entry) => entry.effectiveHandNumber <= hand.number);
    validateHandConfiguration(hand);
    requireHistory(expected ? hand.configuration !== void 0 && same(hand.configuration, expected) : hand.configuration === void 0, "Hand configuration does not match its immutable session boundary.");
  }
  const active = data.active;
  if (active) {
    const session = bySession.get(active.sessionId), last = session?.configurationHistory?.at(-1);
    requireHistory(last ? active.configuration !== void 0 && same(active.configuration, last) : active.configuration === void 0, "Active hand configuration boundary is missing or changed.");
    if (last) requireHistory(same(facts(last), description(session.settings, active.game, active.profiles)), "Active configuration differs from its recorded boundary.");
  }
}

// src/bots/draw-responses.ts
var DRAW_RESPONSE_POT_ANCHORS = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
var DRAW_RESPONSE_KINDS = Object.freeze(["gutshot", "oesd", "flush", "combo"]);
var DRAW_RESPONSE_STREETS = Object.freeze(["flop", "turn", "river"]);
function normalizeDrawResponses(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid draw response curves.");
  const out = {};
  for (const key of Object.keys(input)) if (!DRAW_RESPONSE_KINDS.includes(key)) throw new Error("Unknown draw response kind.");
  for (const kind of DRAW_RESPONSE_KINDS) {
    const streets = input[kind];
    if (streets === void 0) continue;
    if (!streets || typeof streets !== "object" || Array.isArray(streets)) throw new Error("Invalid draw response streets.");
    out[kind] = {};
    for (const street of Object.keys(streets)) if (!DRAW_RESPONSE_STREETS.includes(street)) throw new Error("Unknown draw response street.");
    for (const street of DRAW_RESPONSE_STREETS) {
      const points = streets[street];
      if (points === void 0) continue;
      if (!Array.isArray(points) || points.length !== 7 || points.some((n) => !Number.isFinite(n) || n < -1 || n > 1)) throw new Error("Draw response needs seven values between -1 and 1.");
      out[kind][street] = [...points];
    }
  }
  return out;
}
function drawResponseKind(drawClass) {
  if (drawClass === "combo") return "combo";
  if (drawClass === "nut-flush" || drawClass === "flush") return "flush";
  if (drawClass === "open-ended" || drawClass === "double-gutshot") return "oesd";
  return drawClass === "gutshot" ? "gutshot" : null;
}
function drawResponseOffset(curves, kind, street, betToPot) {
  if (!curves || !kind || !DRAW_RESPONSE_STREETS.includes(street)) return 0;
  const points = curves[kind]?.[street];
  if (!points) return 0;
  if (betToPot <= DRAW_RESPONSE_POT_ANCHORS[0]) return points[0];
  for (let i = 1; i < 7; i++) if (betToPot <= DRAW_RESPONSE_POT_ANCHORS[i]) {
    const t = (betToPot - DRAW_RESPONSE_POT_ANCHORS[i - 1]) / (DRAW_RESPONSE_POT_ANCHORS[i] - DRAW_RESPONSE_POT_ANCHORS[i - 1]);
    return points[i - 1] + t * (points[i] - points[i - 1]);
  }
  return points[6];
}
function adjustDrawContinuation(chance, offset) {
  if (offset === 0) return chance;
  const bounded = Math.max(1e-6, Math.min(0.999999, chance));
  return 1 / (1 + Math.exp(-(Math.log(bounded / (1 - bounded)) + 4 * offset)));
}

// src/bots/profiles.ts
var POLICY_VERSION = "synthetic-cash-1.6.0";
var ARCHETYPES = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid = (n) => 1 / (1 + Math.exp(-n));
var traits = (values) => Object.fromEntries(TRAIT_KEYS.map((key, i) => [key, values[i]]));
var PRESETS = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS = Object.freeze({ ...PRESETS.tag.traits });
var POPULATION_WEIGHTS = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function seedStream(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Invalid personality seed: expected uint32.");
  let n = seed >>> 0;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function unit(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function resolveConfig(config, seed) {
  seedStream(seed);
  if (!config || ![...ARCHETYPES, "random", "unknown", "custom"].includes(config.selection)) throw new Error("Unknown opponent selection.");
  if (config.baseArchetype !== void 0 && !ARCHETYPES.includes(config.baseArchetype)) throw new Error("Unknown base archetype.");
  const normalized = { selection: config.selection, personalitySeed: seed };
  if (config.baseArchetype !== void 0) normalized.baseArchetype = config.baseArchetype;
  for (const key of ["skill", "aggression", "looseness"]) if (config[key] !== void 0) normalized[key] = unit(config[key], key);
  if (config.traits) {
    normalized.traits = {};
    for (const key of TRAIT_KEYS) if (config.traits[key] !== void 0) normalized.traits[key] = unit(config.traits[key], key);
  }
  if (config.drawResponses) normalized.drawResponses = normalizeDrawResponses(config.drawResponses);
  return normalized;
}
function createProfile(config, seed, environment) {
  if (!Object.hasOwn(POPULATION_WEIGHTS, environment)) throw new Error("Unknown population environment.");
  const c = resolveConfig(config, seed), random = seedStream(seed), selectionDraw = random();
  let archetype;
  if (c.selection === "random" || c.selection === "unknown") {
    if (c.baseArchetype) archetype = c.baseArchetype;
    else {
      let cumulative7 = 0;
      archetype = ARCHETYPES[7];
      for (let i = 0; i < 8; i++) {
        cumulative7 += POPULATION_WEIGHTS[environment][i];
        if (selectionDraw < cumulative7) {
          archetype = ARCHETYPES[i];
          break;
        }
      }
    }
  } else archetype = c.selection === "custom" ? c.baseArchetype ?? "tag" : c.selection;
  const base = PRESETS[archetype], activity = (random() - 0.5) * 0.09, caution = (random() - 0.5) * 0.08;
  const stableTraits = {};
  for (const key of TRAIT_KEYS) {
    const jitter = (random() - 0.5) * 0.06;
    const correlated = ["bluffFrequency", "riskTolerance", "sizingAggression"].includes(key) ? activity : ["sizeSensitivity", "multiwayCaution", "valueThreshold"].includes(key) ? caution : 0;
    stableTraits[key] = c.traits?.[key] ?? clamp(base.traits[key] + jitter + correlated);
  }
  return { ...c.drawResponses ? { drawResponses: c.drawResponses } : {}, archetype, policyVersion: POLICY_VERSION, aggression: c.aggression ?? clamp(base.aggression + activity), looseness: c.looseness ?? clamp(base.looseness + activity - caution * 0.5), skill: c.skill ?? clamp(base.skill + (random() - 0.5) * 0.04), environment, unknown: c.selection === "unknown", traits: stableTraits, personalityId: `cash-v1.2:${seed.toString(16).padStart(8, "0")}:${archetype}` };
}
function completeProfile(profile) {
  if (!ARCHETYPES.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION) throw new Error("Bot policy version mismatch.");
  unit(profile.aggression, "aggression");
  unit(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS) t[key] = unit(profile.traits?.[key], key) ?? PRESETS[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS, environment)) throw new Error("Unknown population environment.");
  return { ...profile.drawResponses ? { drawResponses: normalizeDrawResponses(profile.drawResponses) } : {}, archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit(profile.skill, "skill") ?? PRESETS[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/rules/pokerstars.ts
var POKERSTARS_SOURCE = {
  url: "https://www.pokerstars.com/poker/room/rake/?no_redirect=1",
  retrievedAt: "2026-11-01",
  currency: "USD",
  format: "regular-nlhe"
};
var POKERSTARS_PROFILE_VERSION = "2026-11-01";
var POKERSTARS_USD_SCHEDULE = [
  [1, 2, 500, 100, 100, 100],
  [2, 5, 500, 100, 100, 100],
  [5, 10, 500, 100, 100, 100],
  [10, 25, 450, 50, 100, 200],
  [25, 50, 500, 75, 75, 200],
  [50, 100, 500, 100, 100, 250],
  [100, 200, 500, 125, 125, 275],
  [200, 400, 500, 150, 150, 300],
  [250, 500, 500, 150, 150, 300],
  [300, 600, 500, 150, 150, 350],
  [500, 1e3, 450, 150, 150, 300],
  [1e3, 2e3, 450, 175, 175, 300],
  [2500, 5e3, 450, 225, 200, 300],
  [5e3, 1e4, 450, 250, 300, 500],
  [1e4, 2e4, 450, 300, 500, 500]
];
function pokerStarsProfile(smallBlind, bigBlind) {
  const row = POKERSTARS_USD_SCHEDULE.find(([small, big]) => small === smallBlind && big === bigBlind);
  if (!row) throw new Error("PokerStars snapshot supports only its listed USD regular NLHE stakes");
  const rake = {
    basisPoints: row[2],
    cap: row[5],
    noFlopNoDrop: true,
    rounding: "half-even",
    capByDealtIn: { two: row[3], threeFour: row[4], fivePlus: row[5] },
    source: { ...POKERSTARS_SOURCE }
  };
  return {
    id: "pokerstars-com-usd-regular-nlhe",
    version: POKERSTARS_PROFILE_VERSION,
    mode: "cash",
    smallBlind,
    bigBlind,
    chipUnit: 1,
    rake,
    shortRaiseReopens: "cumulative",
    oddChipOrder: "clockwise-from-button"
  };
}

// src/session/configuration.ts
var seedForSeat = () => crypto.getRandomValues(new Uint32Array(1))[0];
var NAMES = ["You", "Alex", "Morgan", "Jordan", "Riley", "Casey", "Taylor", "Drew", "Quinn", "Sam"];
var textId = (value) => typeof value === "string" && value.length > 0 && value.length <= 160;
function timestamp2(value) {
  requireData(typeof value === "string" && Number.isFinite(Date.parse(value)), "Invalid configuration timestamp.");
}
function occupiedSeatIds(settings) {
  const capacity = settings.capacity ?? settings.seats;
  requireData(Number.isInteger(capacity) && capacity >= 2 && capacity <= 10, "Choose a table capacity from 2 to 10.");
  requireData(Number.isInteger(settings.seats) && settings.seats >= 2 && settings.seats <= capacity, "Choose 2 or more occupied seats within the table capacity.");
  const ids = settings.occupiedSeatIds ?? Array.from({ length: settings.seats }, (_, id2) => id2);
  requireData(Array.isArray(ids) && ids.length === settings.seats && new Set(ids).size === ids.length && ids.includes(0) && ids.every((id2) => Number.isInteger(id2) && id2 >= 0 && id2 < capacity), "Occupied seat IDs must be unique, include Hero, and fit the capacity.");
  return [...ids].sort((a, b) => a - b);
}
function normalizeTableSettings(settings, randomSeed = seedForSeat) {
  assertSupportedCashScope(settings);
  requireData(settings && typeof settings === "object", "Table settings are required.");
  const occupied = occupiedSeatIds(settings), capacity = settings.capacity ?? settings.seats, chipUnit = settings.chipUnit ?? 1;
  requireData(cents(chipUnit) && chipUnit > 0, "Chip denomination must be a positive integer number of cents.");
  requireData(cents(settings.smallBlind) && settings.smallBlind > 0 && cents(settings.bigBlind) && settings.bigBlind >= settings.smallBlind, "Invalid blinds.");
  requireData(cents(settings.minBuyInBB) && settings.minBuyInBB >= 1 && cents(settings.maxBuyInBB) && settings.maxBuyInBB >= settings.minBuyInBB && settings.maxBuyInBB <= 1e4, "Invalid table buy-in limits.");
  const minimum = settings.minBuyInBB * settings.bigBlind, maximum = settings.maxBuyInBB * settings.bigBlind;
  requireData(Number.isSafeInteger(maximum) && cents(settings.buyIn) && settings.buyIn >= minimum && settings.buyIn <= maximum, "Buy-in is outside the configured table limits.");
  requireData(settings.smallBlind % chipUnit === 0 && settings.bigBlind % chipUnit === 0 && settings.buyIn % chipUnit === 0, "Blinds and buy-in must use whole chip denominations.");
  requireData(["none", "custom", "pokerstars-usd-2026"].includes(settings.rakeMode), "Unsupported rake mode.");
  if (settings.rakeMode === "pokerstars-usd-2026") {
    requireData(chipUnit === 1, "The sourced USD rake profile requires one-cent chips.");
    pokerStarsProfile(settings.smallBlind, settings.bigBlind);
  }
  requireData(cents(settings.rakeBasisPoints) && settings.rakeBasisPoints <= 1e4 && cents(settings.rakeCap) && typeof settings.noFlopNoDrop === "boolean", "Invalid rake settings.");
  requireData(settings.rakeMode !== "custom" || settings.rakeCap % chipUnit === 0, "Custom rake cap must use whole chip denominations.");
  requireData(typeof settings.allowTopUp === "boolean" && typeof settings.stake === "string" && settings.stake.length <= 160, "Invalid table settings.");
  requireData(Array.isArray(settings.archetypes) && settings.archetypes.length <= 9, "Invalid archetype settings.");
  requireData(settings.opponents === void 0 || Array.isArray(settings.opponents) && settings.opponents.length <= 9, "Invalid opponent settings.");
  const population = settings.population ?? "neutral", tableMode = settings.tableMode ?? "live";
  requireData(["low", "mid", "high", "neutral"].includes(population), "Unknown synthetic population preset.");
  requireData(tableMode === "live" || tableMode === "study", "Unknown table mode.");
  if (settings.seatStacks !== void 0) {
    requireData(settings.seatStacks !== null && typeof settings.seatStacks === "object" && !Array.isArray(settings.seatStacks), "Invalid seat stack settings.");
    for (const [key, stack] of Object.entries(settings.seatStacks)) requireData(/^[0-9]$/.test(key) && occupied.includes(Number(key)) && cents(stack) && stack >= minimum && stack <= maximum && stack % chipUnit === 0, "An explicit seat stack must belong to an occupied seat and satisfy buy-in limits and chip denomination.");
  }
  const opponents = Array.from({ length: capacity - 1 }, (_, index2) => {
    const config = settings.opponents?.[index2] ?? { selection: settings.archetypes[index2] ?? "tag" };
    return resolveConfig(config, config.personalitySeed ?? randomSeed(index2 + 1));
  });
  return { ...structuredClone(settings), capacity, occupiedSeatIds: occupied, population, tableMode, opponents };
}
function tableParticipants(settings, previous) {
  const unit8 = settings.chipUnit ?? 1;
  return occupiedSeatIds(settings).map((id2) => {
    const old = previous?.seats.find((seat) => seat.id === id2);
    return { id: id2, name: old?.name ?? NAMES[id2], stack: settings.seatStacks?.[id2] ?? (old ? Math.floor(old.stack / unit8) * unit8 : settings.buyIn) };
  });
}
function tableProfiles(settings, previousSettings, previousProfiles) {
  const profiles = {};
  for (const id2 of occupiedSeatIds(settings).filter((id3) => id3 !== 0)) {
    const config = settings.opponents?.[id2 - 1];
    requireData(config && config.personalitySeed !== void 0, "Resolve opponent identities before creating a table.");
    const unchanged = previousProfiles?.[id2] && ((settings.chipUnit ?? 1) === 1 || previousProfiles[id2].policyVersion === POLICY_VERSION) && (previousSettings?.population ?? "neutral") === (settings.population ?? "neutral") && canonical3(previousSettings?.opponents?.[id2 - 1]) === canonical3(config);
    profiles[id2] = unchanged ? structuredClone(previousProfiles[id2]) : createProfile(config, config.personalitySeed, settings.population ?? "neutral");
  }
  return profiles;
}
function queueTableConfiguration(data, request, randomSeed = seedForSeat) {
  const active = data.active;
  requireData(active && active.sessionId === request.expectedSessionId && active.game.handId === request.expectedHandId, "This session or hand has changed. Review the current table before configuring it.");
  requireData(!active.exitMode, "This session is ending; finish it before configuring another session.");
  requireData(textId(request.id), "Configuration identity required.");
  timestamp2(request.at);
  if (active.lastAppliedConfigurationId === request.id) return false;
  const prior = active.queuedConfiguration;
  const currentSettings = data.sessions.find((session) => session.id === active.sessionId)?.settings;
  const normalized = normalizeTableSettings(request.settings, (id2) => (prior?.id === request.id ? prior.settings.opponents?.[id2 - 1]?.personalitySeed : currentSettings?.opponents?.[id2 - 1]?.personalitySeed) ?? randomSeed(id2));
  if (prior?.id === request.id) {
    requireData(canonical3(prior.settings) === canonical3(normalized), "Conflicting configuration identity.");
    return false;
  }
  active.queuedConfiguration = { id: request.id, sessionId: active.sessionId, requestedHandId: active.game.handId, settings: normalized, queuedAt: request.at };
  return true;
}
function cancelQueuedConfiguration(data, expectedSessionId, requestId) {
  requireData(data.active?.sessionId === expectedSessionId, "The session changed before cancelling its configuration.");
  const queued = data.active.queuedConfiguration;
  if (!queued) return false;
  requireData(queued.id === requestId, "The queued configuration changed. Review it before cancelling.");
  delete data.active.queuedConfiguration;
  return true;
}
async function applyQueuedConfiguration(data, boundary) {
  const active = data.active, queued = active?.queuedConfiguration;
  if (!active || !queued) return false;
  requireData(active.game.street === "complete" && active.game.actor === null, "Finish and settle the current hand before applying its queued configuration.");
  requireData(!active.exitMode && queued.sessionId === active.sessionId && queued.requestedHandId === active.game.handId, "Queued configuration is obsolete.");
  requireData(data.hands.some((hand) => hand.id === active.game.handId && hand.sessionId === active.sessionId), "Record the completed hand before reconfiguring the table.");
  requireData(active.lastAppliedConfigurationId !== queued.id, "Configuration was already applied.");
  timestamp2(boundary.at);
  const session = data.sessions.find((session2) => session2.id === active.sessionId && session2.endedAt === null);
  requireData(session, "Active session is missing.");
  const settings = normalizeTableSettings(queued.settings, () => {
    throw new Error("Queued opponent identity is missing.");
  });
  const seats = tableParticipants(settings, active.game), hero = active.game.seats.find((seat) => seat.id === 0);
  const heroTarget = seats.find((seat) => seat.id === 0).stack, delta = heroTarget - hero.stack;
  requireData(Number.isSafeInteger(delta) && data.wallet >= delta, "Insufficient wallet funds for the queued Hero stack. Adjust or cancel the queued configuration.");
  requireData(seats.filter((seat) => seat.stack > 0).length >= 2 && heroTarget > 0, "At least two funded seats including Hero are required. Set a new stack for a busted seat.");
  const profiles = tableProfiles(settings, session.settings, active.profiles), profile = boundary.rules(settings), transferId = `configuration:${queued.id}`;
  requireData(!data.ledger.some((event2) => event2.id === transferId), "Configuration transfer was already recorded.");
  const game = boundary.reconfigure(active.game, seats, profile, transferId);
  if (delta !== 0) {
    await appendMoney(data, { id: transferId, at: boundary.at, epoch: data.epoch, kind: "table-adjustment", walletDelta: -delta, tableDelta: delta, pokerNet: 0, sessionId: session.id, note: "Next-hand Hero stack adjustment; external transfer, not poker winnings" });
    if (delta > 0) session.buyIns += delta;
    else session.tableWithdrawals = (session.tableWithdrawals ?? 0) - delta;
  }
  active.game = game;
  active.profiles = profiles;
  active.pending = null;
  session.settings = structuredClone(settings);
  session.profile = structuredClone(profile);
  delete session.settings.seatStacks;
  active.lastAppliedConfigurationId = queued.id;
  delete active.queuedConfiguration;
  return true;
}
function presetName(name) {
  requireData(typeof name === "string" && name.trim().length > 0 && name.trim().length <= 80, "Enter a preset name of 1\u201380 characters.");
  return name.trim();
}
function saveNamedPreset(data, input, randomSeed = seedForSeat) {
  requireData(textId(input.id), "Preset identity required.");
  timestamp2(input.at);
  const name = presetName(input.name), presets = data.namedPresets ?? [];
  requireData(!presets.some((preset) => preset.id !== input.id && preset.name.toLowerCase() === name.toLowerCase()), "A preset with this name already exists.");
  const prior = presets.find((preset) => preset.id === input.id), settings = normalizeTableSettings(input.settings, (id2) => prior?.settings.opponents?.[id2 - 1]?.personalitySeed ?? randomSeed(id2));
  const saved = { id: input.id, name, version: 1, createdAt: prior?.createdAt ?? input.at, updatedAt: input.at, settings };
  data.namedPresets = [...presets.filter((preset) => preset.id !== input.id), saved];
  return structuredClone(saved);
}
function loadNamedPreset(data, presetId) {
  const preset = data.namedPresets?.find((preset2) => preset2.id === presetId);
  requireData(preset, "Saved preset was not found.");
  return structuredClone(preset.settings);
}
function cloneNamedPreset(data, sourceId, input) {
  requireData(input.id !== sourceId && !data.namedPresets?.some((preset) => preset.id === input.id), "A cloned preset needs a fresh identity.");
  return saveNamedPreset(data, { ...input, settings: loadNamedPreset(data, sourceId) });
}
function validateConfigurationData(data, prior) {
  if (data.namedPresets !== void 0 && data.namedPresets !== prior?.namedPresets) {
    requireData(Array.isArray(data.namedPresets) && new Set(data.namedPresets.map((preset) => preset.id)).size === data.namedPresets.length, "Duplicate or invalid saved preset identities.");
    requireData(new Set(data.namedPresets.map((preset) => preset.name?.trim().toLowerCase())).size === data.namedPresets.length, "Duplicate saved preset names.");
    for (const preset of data.namedPresets) {
      requireData(preset.version === 1 && textId(preset.id), "Unsupported saved preset.");
      presetName(preset.name);
      timestamp2(preset.createdAt);
      timestamp2(preset.updatedAt);
      normalizeTableSettings(preset.settings, () => {
        throw new Error("Saved preset identity is missing.");
      });
    }
  }
  for (let i = 0; i < data.sessions.length; i++) {
    const session = data.sessions[i];
    if (prior?.sessions[i] === session) continue;
    const settings = session.settings;
    if (settings !== prior?.sessions[i]?.settings) assertSupportedCashScope(settings);
    if (settings !== prior?.sessions[i]?.settings && (settings.capacity !== void 0 || settings.occupiedSeatIds !== void 0 || settings.seatStacks !== void 0)) normalizeTableSettings(settings, () => 0);
    requireData(session.tableWithdrawals === void 0 || cents(session.tableWithdrawals), "Invalid table withdrawal total.");
  }
  const queued = data.active?.queuedConfiguration;
  if (queued) {
    requireData(textId(queued.id) && queued.sessionId === data.active.sessionId && queued.requestedHandId === data.active.game.handId, "Obsolete or invalid queued configuration.");
    timestamp2(queued.queuedAt);
    if (queued !== prior?.active?.queuedConfiguration) normalizeTableSettings(queued.settings, () => {
      throw new Error("Queued opponent identity is missing.");
    });
  }
  requireData(data.active?.lastAppliedConfigurationId === void 0 || textId(data.active.lastAppliedConfigurationId), "Invalid applied configuration identity.");
}

// src/stats/configuration-history.ts
function rowForRecordedConfiguration(entry) {
  return {
    key: entry.id,
    sessionId: entry.sessionId,
    status: "RECORDED",
    startedAt: entry.recordedAt,
    firstHandNumber: entry.effectiveHandNumber,
    lastHandNumber: null,
    hands: 0,
    profit: 0,
    bb100: null,
    population: entry.population,
    tableMode: entry.tableMode,
    occupiedSeats: entry.occupiedSeatIds.length,
    capacity: entry.capacity,
    selectionMix: entry.selectionMix.map((mix) => ({ ...mix })),
    evidenceStatus: entry.evidenceStatus,
    ruleId: entry.rules.id,
    ruleVersion: entry.rules.version,
    smallBlind: entry.rules.smallBlind,
    bigBlind: entry.rules.bigBlind,
    rake: structuredClone(entry.rules.rake),
    policyVersions: [...entry.policyVersions],
    changeReason: entry.reason,
    disclosure: "Recorded Host Setup selections and synthetic environment, not observed or inferred opponent identities. Unknown/Random remain unresolved. No human calibration is claimed. Effective at the recorded safe hand boundary; prior hands remain unchanged."
  };
}
function rowForHandConfiguration(hand) {
  const p = hand.view.profile, versions = [...new Set(Object.values(hand.privateProfiles).map((profile) => profile.policyVersion).filter((version) => typeof version === "string" && version.length > 0))].sort();
  const row = hand.configuration ? rowForRecordedConfiguration(hand.configuration) : {
    key: JSON.stringify(["legacy-configuration", hand.sessionId, hand.view.seats.length, p.id, p.version, p.smallBlind, p.bigBlind, p.rake, versions]),
    sessionId: hand.sessionId,
    status: "LEGACY_UNKNOWN",
    startedAt: hand.startedAt,
    firstHandNumber: hand.number,
    lastHandNumber: null,
    hands: 0,
    profit: 0,
    bb100: null,
    population: null,
    tableMode: null,
    occupiedSeats: hand.view.seats.length,
    capacity: null,
    selectionMix: null,
    evidenceStatus: "LEGACY_UNRECORDED",
    ruleId: p.id,
    ruleVersion: p.version,
    smallBlind: p.smallBlind,
    bigBlind: p.bigBlind,
    rake: structuredClone(p.rake),
    policyVersions: versions,
    changeReason: "legacy-unknown",
    disclosure: "Legacy population, original Host Setup selections, capacity and change boundaries were not recorded. Rules/rake/policy versions come only from this immutable hand. No current setting or hidden persona is used to invent missing history; grouped hand spans may be nonconsecutive."
  };
  return { ...row, hands: 1, profit: hand.net, bb100: 100 * (hand.net / p.bigBlind), lastHandNumber: hand.number };
}
function includeConfigurationBoundaries(rows, sessions) {
  const out = [...rows], known = new Set(out.map((row) => row.key));
  for (const session of sessions) for (const entry of session.configurationHistory ?? []) if (!known.has(entry.id)) {
    known.add(entry.id);
    out.push(rowForRecordedConfiguration(entry));
  }
  return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.sessionId.localeCompare(b.sessionId) || a.firstHandNumber - b.firstHandNumber || a.key.localeCompare(b.key));
}
function deriveConfigurationHistory(hands, sessions) {
  const groups = /* @__PURE__ */ new Map();
  for (const hand of hands) {
    const row = rowForHandConfiguration(hand), prior = groups.get(row.key);
    if (!prior) groups.set(row.key, row);
    else {
      prior.hands++;
      prior.profit += hand.net;
      prior.lastHandNumber = Math.max(prior.lastHandNumber ?? 0, hand.number);
      prior.firstHandNumber = Math.min(prior.firstHandNumber, hand.number);
      if (hand.startedAt < prior.startedAt) prior.startedAt = hand.startedAt;
    }
  }
  return includeConfigurationBoundaries([...groups.values()].map((row) => ({ ...row, bb100: 100 * (row.profit / row.bigBlind) / row.hands })), sessions);
}

// src/stats/cash.ts
var STAT_DEFINITIONS = {
  vpip: "Hands with a voluntary preflop call or raise / hands with at least one voluntary preflop decision. Forced blinds, forced all-ins and walks without a decision are excluded.",
  pfr: "Hands with a preflop raise / hands with at least one legal preflop raise opportunity. A legal short all-in raise counts; all-in-only calls and closed raising do not create a raise opportunity.",
  threeBet: "Hands raising after exactly one prior preflop raise / hands where Hero faces exactly one prior preflop raise and can legally raise. Count each eligible hand once; forced all-in/no-raise situations are excluded.",
  foldToThreeBet: "Hands folding to the first re-raise after Hero opened / hands where Hero is the original preflop opener and must respond to that re-raise before a fourth bet. No response opportunity when already all-in.",
  raise: "Postflop decisions raising / postflop decisions facing a bet with legal raising rights. Includes legal short all-in raises; excludes opening bets, all-in-only calls and betting not reopened.",
  checkRaise: "Postflop first responses to a bet after Hero checked on that street that raise / such responses with legal raising rights. Calling or folding consumes that opportunity; a later re-raise after calling is not a check-raise. Multiple opponents do not remove an otherwise legal opportunity.",
  foldToCbet: "Flops folding to the first bet by the last preflop raiser / flops with a legal Hero response to that bet before an intervening raise. Earlier donk bets, delayed turn bets, already-all-in players and absent preflop raises are excluded; intervening calls are allowed.",
  wtsd: "Hands reaching showdown with Hero still eligible / hands in which Hero saw the flop. Preflop folds are excluded even if other players subsequently run out the board.",
  wsd: "Showdowns where Hero receives any positive pot award / showdowns reached by Hero. A split pot counts as a win; this is not positive-net-hand frequency.",
  wwsf: "Hands where Hero receives any positive pot award after seeing the flop / hands where Hero saw the flop. Includes uncontested postflop wins and splits."
};
function frozenPolicyVersions(profiles) {
  return [...new Set(Object.values(profiles).map((profile) => profile.policyVersion).filter((version) => typeof version === "string" && version.length > 0))].sort();
}
var CASH_STAT_FORMULAS = {
  profit: "Sum of completed hand (ending Hero stack \u2212 starting Hero stack); excludes deposits, top-ups, cashouts, manual edits/resets and unfinished hands.",
  bb100: "100 \xD7 sum(each completed hand net / that hand's big blind) / completed hands. Mixed-stake result is hand-weighted big blinds, not total cash divided by one blind.",
  perHour: "Settled profit \xD7 3,600,000 / recorded active milliseconds. Explicit pauses/hidden/closed time are excluded by the session clock; playback speed affects this simulator rate.",
  rake: "Contributed attribution: each seat gets floor(hand rake \xD7 post-refund commitment / total post-refund commitment); remaining cents go clockwise after button among contributors. This attribution is not an extra wallet debit; poker net already includes rake.",
  uncertainty: "Rate intervals are descriptive 95% Wilson intervals, not a calibrated skill estimate. Hands in a session are correlated; intervals may be too narrow. Fewer than 100 opportunities are labeled insufficient sample. Financial results have no invented EV or profitability confidence claim."
};
var keys3 = ["vpip", "pfr", "threeBet", "foldToThreeBet", "raise", "checkRaise", "foldToCbet", "wtsd", "wsd", "wwsf"];
var ratio = (numerator, denominator) => {
  if (!denominator) return { numerator, denominator, percent: null, ci95: null, status: "NO_OPPORTUNITIES" };
  const p = numerator / denominator, z = 1.959963984540054, d = 1 + z * z / denominator;
  const center = (p + z * z / (2 * denominator)) / d, margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * denominator)) / denominator) / d;
  return { numerator, denominator, percent: p * 100, ci95: [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100], status: denominator < 100 ? "INSUFFICIENT_SAMPLE" : "DESCRIPTIVE" };
};
function contributedRake(view) {
  const shares = {};
  const total = view.seats.reduce((sum, s) => sum + s.totalCommitted, 0);
  for (const seat of view.seats) shares[seat.id] = total ? Number(BigInt(view.rake) * BigInt(seat.totalCommitted) / BigInt(total)) : 0;
  let remainder = view.rake - Object.values(shares).reduce((a, b) => a + b, 0);
  const seats = [...view.seats].sort((a, b) => a.id - b.id), i = seats.findIndex((s) => s.id === view.button);
  for (const seat of [...seats.slice(i + 1), ...seats.slice(0, i + 1)]) if (remainder > 0 && seat.totalCommitted > 0) {
    shares[seat.id]++;
    remainder--;
  }
  if (remainder !== 0) throw new Error("Rake attribution cannot reconcile");
  return shares;
}
function heroPosition(view) {
  if (view.seats.length === 2) return view.button === 0 ? "BTN/SB" : "BB";
  if (view.button === 0) return "BTN";
  if (view.smallBlindSeat === 0) return "SB";
  if (view.bigBlindSeat === 0) return "BB";
  const ids = view.seats.map((s) => s.id).sort((a, b) => a - b), i = ids.indexOf(view.bigBlindSeat);
  const others = [...ids.slice(i + 1), ...ids.slice(0, i + 1)].filter((id2) => ![view.button, view.smallBlindSeat, view.bigBlindSeat].includes(id2));
  const index2 = others.indexOf(0), fromEnd = others.length - index2;
  if (fromEnd === 1) return "CO";
  if (fromEnd === 2) return "HJ";
  if (fromEnd === 3) return "LJ";
  return index2 === 0 ? "UTG" : `UTG+${index2}`;
}
function handOpportunities(hand) {
  const values = Object.fromEntries(keys3.map((key) => [key, [0, 0]]));
  const frames = new Map(hand.frames.map((frame) => [`${frame.revision}:${frame.actor}`, frame]));
  const actions = hand.view.events.filter((e) => e.type === "action");
  let raises = 0, opener, lastPreflopRaiser;
  let vpip = false, pfr = false, voluntaryOpportunity = false, raiseOpportunity = false, threeOpportunity = false, threeSuccess = false, foldThreeOpportunity = false, foldThreeSuccess = false, preflopComplete = true, postflopComplete = true;
  for (const event2 of actions.filter((e) => e.street === "preflop")) {
    if (event2.seatId === 0) {
      const frame = frames.get(`${event2.revision - 1}:0`);
      if (!frame) preflopComplete = false;
      if (frame) {
        voluntaryOpportunity = true;
        if (frame.legal.canRaise || frame.legal.shortAllInTo !== null) raiseOpportunity = true;
        if (raises === 1 && (frame.legal.canRaise || frame.legal.shortAllInTo !== null)) {
          threeOpportunity = true;
          if (event2.action?.type === "raise") threeSuccess = true;
        }
        if (raises === 2 && opener === 0 && frame.legal.callAmount > 0) {
          foldThreeOpportunity = true;
          if (event2.action?.type === "fold") foldThreeSuccess = true;
        }
      }
      if ((event2.action?.type === "call" || event2.action?.type === "raise") && (event2.amount ?? 0) > 0) vpip = true;
      if (event2.action?.type === "raise") pfr = true;
    }
    if (event2.action?.type === "raise") {
      if (raises === 0) opener = event2.seatId;
      lastPreflopRaiser = event2.seatId;
      raises++;
    }
  }
  if (preflopComplete) {
    values.vpip = [Number(vpip && voluntaryOpportunity), Number(voluntaryOpportunity)];
    values.pfr = [Number(pfr && raiseOpportunity), Number(raiseOpportunity)];
    values.threeBet = [Number(threeSuccess), Number(threeOpportunity)];
    values.foldToThreeBet = [Number(foldThreeSuccess), Number(foldThreeOpportunity)];
  }
  let street, checked = false, streetWagered = false, facingCbet = false;
  for (const event2 of actions.filter((e) => e.street !== "preflop")) {
    if (event2.street !== street) {
      street = event2.street;
      checked = false;
      streetWagered = false;
      facingCbet = false;
    }
    if (event2.seatId === 0) {
      const frame = frames.get(`${event2.revision - 1}:0`);
      if (!frame) postflopComplete = false;
      if (frame && frame.legal.callAmount > 0) {
        const canRaise = frame.legal.canRaise || frame.legal.shortAllInTo !== null;
        if (canRaise) {
          values.raise[1]++;
          if (event2.action?.type === "raise") values.raise[0]++;
        }
        if (checked && canRaise) {
          values.checkRaise[1]++;
          if (event2.action?.type === "raise") values.checkRaise[0]++;
        }
        if (facingCbet) {
          values.foldToCbet[1]++;
          if (event2.action?.type === "fold") values.foldToCbet[0]++;
        }
        checked = false;
        facingCbet = false;
      }
      if (event2.action?.type === "check") checked = true;
    }
    if (event2.action?.type === "raise") {
      facingCbet = street === "flop" && !streetWagered && event2.seatId === lastPreflopRaiser && event2.seatId !== 0;
      streetWagered = true;
    }
  }
  if (!postflopComplete) for (const key of ["raise", "checkRaise", "foldToCbet"]) values[key] = [0, 0];
  const preflopFold = actions.some((e) => e.seatId === 0 && e.street === "preflop" && e.action?.type === "fold");
  const sawFlop = hand.view.board.length >= 3 && !preflopFold;
  const showdown = Object.hasOwn(hand.view.handLabels, 0), won = (hand.view.payouts[0] ?? 0) > 0;
  values.wtsd = [Number(sawFlop && showdown), Number(sawFlop)];
  values.wsd = [Number(showdown && won), Number(showdown)];
  values.wwsf = [Number(sawFlop && won), Number(sawFlop)];
  return { values, complete: preflopComplete && postflopComplete };
}
function totals(hands, key, label) {
  const byBlind = /* @__PURE__ */ new Map();
  for (const hand of hands) byBlind.set(hand.view.profile.bigBlind, (byBlind.get(hand.view.profile.bigBlind) ?? 0) + hand.net);
  const bbWon = [...byBlind].reduce((sum, [blind, net]) => sum + net / blind, 0);
  return { key, label, hands: hands.length, profit: hands.reduce((sum, h) => sum + h.net, 0), bb100: hands.length ? 100 * bbWon / hands.length : null, rake: hands.reduce((sum, h) => sum + (contributedRake(h.view)[0] ?? 0), 0) };
}
function grouped(hands, getKey) {
  const groups = /* @__PURE__ */ new Map();
  for (const hand of hands) {
    const [key, label] = getKey(hand);
    const group = groups.get(key) ?? { label, hands: [] };
    group.hands.push(hand);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => totals(group.hands, key, group.label));
}
function deriveCashStats(records, sessions, now2 = Date.now()) {
  const seen = /* @__PURE__ */ new Set();
  const hands = records.filter((h) => h.view.street === "complete" && h.view.profile.mode === "cash" && isCashPerformanceHand(h, "cash")).filter((h) => {
    if (seen.has(h.id)) throw new Error("Duplicate canonical hand ID");
    seen.add(h.id);
    return true;
  });
  const opportunities = hands.map(handOpportunities);
  const metrics = Object.fromEntries(keys3.map((key) => [key, ratio(opportunities.reduce((sum, h) => sum + h.values[key][0], 0), opportunities.reduce((sum, h) => sum + h.values[key][1], 0))]));
  const sessionResults = sessions.map((s) => {
    const activeMs2 = s.activeMs + (s.endedAt === null && s.lastActiveAt !== null ? Math.max(0, now2 - s.lastActiveAt) : 0);
    const result2 = totals(hands.filter((h) => h.sessionId === s.id), s.id, s.startedAt);
    return { ...result2, id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, activeMs: activeMs2, perHour: activeMs2 > 0 ? result2.profit * 36e5 / activeMs2 : null };
  });
  const activeMs = sessionResults.reduce((sum, s) => sum + s.activeMs, 0), all = totals(hands, "cash", "All cash hands");
  const stakes = grouped(hands, (h) => [`${h.view.profile.smallBlind}/${h.view.profile.bigBlind}`, `$${h.view.profile.smallBlind / 100}/$${h.view.profile.bigBlind / 100}`]);
  return {
    ...all,
    namespace: "cash",
    activeMs,
    perHour: activeMs > 0 ? all.profit * 36e5 / activeMs : null,
    metrics,
    sessions: sessionResults,
    winningSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit > 0).length,
    losingSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit < 0).length,
    evenSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit === 0).length,
    activeSession: sessionResults.find((s) => s.endedAt === null) ?? null,
    mixedStakes: stakes.length > 1,
    stakes,
    positions: grouped(hands, (h) => [heroPosition(h.view), heroPosition(h.view)]),
    configurationHistory: deriveConfigurationHistory(hands, sessions),
    configurations: grouped(hands, (h) => {
      const p = h.view.profile, policies = frozenPolicyVersions(h.privateProfiles);
      const key = JSON.stringify([h.view.seats.length, p.smallBlind, p.bigBlind, p.id, p.version, p.rake, policies]);
      return [key, `${h.view.seats.length} seats \xB7 $${p.smallBlind / 100}/$${p.bigBlind / 100} \xB7 Rules ${p.id}@${p.version} \xB7 Policies ${policies.join(", ") || "unrecorded"} \xB7 ${p.rake.basisPoints / 100}% rake / $${p.rake.cap / 100} cap${p.rake.noFlopNoDrop ? " / no flop no drop" : ""}`];
    }),
    disclosure: `Observed virtual cash simulation only. ${hands.length} settled hands; ${sessionResults.length} sessions. ${CASH_STAT_FORMULAS.uncertainty} ${CASH_STAT_FORMULAS.rake}`,
    opportunityCoverage: { completeHands: opportunities.filter((h) => h.complete).length, missingFrames: opportunities.filter((h) => !h.complete).length }
  };
}

// src/storage/integrity.ts
var GENESIS = "0".repeat(64);
function requireData(ok, message) {
  if (!ok) throw new Error(message);
}
var cents = (n) => Number.isSafeInteger(n) && n >= 0;
function canonical3(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical3).join(",") + "]";
  const record = value;
  return "{" + Object.keys(record).filter((k) => record[k] !== void 0).sort().map((k) => JSON.stringify(k) + ":" + canonical3(record[k])).join(",") + "}";
}
async function digest(value) {
  const bytes = sha256(new TextEncoder().encode(canonical3(value)));
  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
}
async function seal(record) {
  const body = { ...record };
  delete body.hash;
  return { ...record, hash: await digest(body) };
}
async function checkChain(records) {
  let previous = GENESIS;
  for (const item of records) {
    requireData(item.previousHash === previous, "History chain is broken.");
    const { hash, ...body } = item;
    requireData(hash === await digest(body), "Saved record integrity check failed.");
    previous = hash;
  }
}
var emptySessionMoney = () => ({ buyIns: 0, withdrawals: 0, cashOut: 0, net: 0, balance: 0, buyInEvents: 0, cashOutEvents: 0 });
function validateMoneyEvent(event2, index2) {
  requireData(["adjustment", "reset", "buy-in", "top-up", "hand-net", "cash-out", "table-adjustment"].includes(event2.kind), "Unknown financial event kind.");
  requireData(event2.index === index2 && Number.isSafeInteger(event2.walletDelta) && Number.isSafeInteger(event2.tableDelta) && Number.isSafeInteger(event2.pokerNet), "Invalid financial amount.");
  if (event2.kind === "hand-net") requireData(event2.walletDelta === 0 && event2.pokerNet === event2.tableDelta && !!event2.handId, "Invalid settlement ledger.");
  else requireData(event2.pokerNet === 0, "Manual adjustments/transfers cannot count as poker profit.");
  if (["buy-in", "top-up", "cash-out", "table-adjustment"].includes(event2.kind)) requireData(event2.walletDelta + event2.tableDelta === 0, "Transfer does not conserve funds.");
  if (event2.kind === "buy-in" || event2.kind === "top-up") requireData(event2.tableDelta >= 0, "Funding cannot withdraw table chips.");
  if (event2.kind === "cash-out") requireData(event2.tableDelta <= 0, "Cashout cannot buy table chips.");
  if (event2.kind === "adjustment" || event2.kind === "reset") requireData(event2.tableDelta === 0, "Wallet adjustment cannot change table chips.");
  else requireData(typeof event2.sessionId === "string" && event2.sessionId.length > 0, "Financial session identity is required.");
}
function addSessionMoney(prior, event2) {
  requireData(prior.cashOutEvents === 0, "Financial event appended after session cashout.");
  const out = { ...prior };
  out.balance += event2.tableDelta;
  if (event2.kind === "buy-in" || event2.kind === "top-up" || event2.kind === "table-adjustment" && event2.tableDelta > 0) out.buyIns += event2.tableDelta;
  if (event2.kind === "table-adjustment" && event2.tableDelta < 0) out.withdrawals -= event2.tableDelta;
  if (event2.kind === "cash-out") {
    out.cashOut -= event2.tableDelta;
    out.cashOutEvents++;
  }
  if (event2.kind === "hand-net") out.net += event2.pokerNet;
  if (event2.kind === "buy-in") out.buyInEvents++;
  requireData(cents(out.balance), "Session chips do not reconcile.");
  return out;
}
function validateSessionMoney(session, money) {
  requireData(cents(session.buyIns) && cents(session.cashOut) && cents(session.tableWithdrawals ?? 0), "Invalid session financial totals.");
  requireData(session.buyIns === money.buyIns && (session.tableWithdrawals ?? 0) === money.withdrawals && session.cashOut === money.cashOut, "Session financial totals do not reconcile to ledger.");
  requireData(money.buyInEvents === 1 && money.cashOutEvents === (session.endedAt === null ? 0 : 1), "Session funding/cashout count mismatch.");
  requireData(session.endedAt === null || money.balance === 0, "Closed session retains table chips.");
}
function validatePolicyViolations(data, prior) {
  const records = data.policyViolations;
  if (records === void 0 || records === prior?.policyViolations) return;
  requireData(Array.isArray(records), "Invalid policy violation log.");
  const ids = /* @__PURE__ */ new Set();
  const action = (value) => {
    if (!value || typeof value !== "object") return false;
    const a = value;
    return a.type === "raise" ? Object.keys(a).length === 2 && Number.isSafeInteger(a.to) : ["fold", "check", "call"].includes(String(a.type)) && Object.keys(a).length === 1;
  };
  for (let i = 0; i < records.length; i++) {
    const v = records[i];
    requireData(v && typeof v.id === "string" && v.id.length > 0 && !ids.has(v.id), "Duplicate or invalid policy violation identity.");
    ids.add(v.id);
    if (prior?.policyViolations?.[i] === v) continue;
    requireData(Object.keys(v).every((key) => ["id", "at", "handId", "revision", "seatId", "policyVersion", "proposedAction", "fallback", "reason"].includes(key)), "Unexpected private payload in policy violation.");
    requireData(typeof v.at === "string" && Number.isFinite(Date.parse(v.at)) && typeof v.handId === "string" && v.handId.length > 0 && cents(v.revision) && Number.isInteger(v.seatId) && v.seatId >= 1 && v.seatId <= 9, "Invalid policy violation context.");
    requireData(typeof v.policyVersion === "string" && v.policyVersion.length > 0 && typeof v.reason === "string" && v.reason.length > 0 && v.reason.length <= 500, "Invalid policy violation metadata.");
    requireData((v.proposedAction === null || action(v.proposedAction)) && action(v.fallback) && ["check", "fold"].includes(v.fallback.type), "Invalid policy violation action.");
  }
}
function assertLatestPublicFrame(data) {
  const active = data.active;
  if (!active) return;
  const frame = active.frames.at(-1), actual = projectView(active.game, 0);
  if (canonical3(frame) === canonical3(actual)) return;
  requireData(frame && active.game.street === "complete" && frame.street === "complete", "Latest public frame differs from game.");
  const record = data.hands.find((h) => h.id === active.game.handId && h.sessionId === active.sessionId), settled = data.ledger.findIndex((e) => e.kind === "hand-net" && e.handId === active.game.handId);
  requireData(record && settled >= 0 && canonical3(frame) === canonical3(record.view), "Latest public frame differs from saved settlement.");
  const transfers = data.ledger.slice(settled + 1).filter((e) => e.sessionId === active.sessionId && e.kind === "top-up");
  requireData(transfers.length > 0 && transfers.every((e) => active.game.tableTransfers?.some((t) => t.id === e.id && t.seatId === 0 && t.amount === e.tableDelta)), "Latest public frame has no matching table transfer.");
  const expected = structuredClone(frame), hero = expected.seats.find((s) => s.id === 0);
  hero.stack += transfers.reduce((n, e) => n + e.tableDelta, 0);
  hero.allIn = hero.stack === 0;
  expected.revision += transfers.length;
  requireData(canonical3(expected) === canonical3(actual), "Latest public frame differs from exact top-up result.");
}
async function validateImportedRecords(records, start = 0) {
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < records.length; i++) {
    const hand = records[i];
    requireData(!ids.has(hand.handId), "Duplicate imported hand.");
    ids.add(hand.handId);
    if (i < start) continue;
    checkPrivate(hand);
    const { hash, ...body } = hand;
    requireData(typeof hand.previousHash === "string" && /^[0-9a-f]{64}$/.test(hand.previousHash) && hash === await digest(body), "Imported record integrity check failed.");
    validatePublicHand(hand);
  }
}
async function validateData(data) {
  requireData(data?.schemaVersion === 4 && cents(data.revision) && cents(data.epoch) && cents(data.wallet), "Unsupported or invalid saved data. No reset was performed.");
  requireData(Array.isArray(data.ledger) && Array.isArray(data.sessions) && Array.isArray(data.hands) && Array.isArray(data.importedHands), "Incomplete saved data.");
  validateUserNotes(data);
  await checkChain(data.ledger);
  await checkChain(data.hands);
  requireData(new Set(data.ledger.map((e) => e.id)).size === data.ledger.length, "Duplicate financial event.");
  requireData(new Set(data.hands.map((h) => h.id)).size === data.hands.length, "Duplicate settled hand.");
  const knownSessions = new Set(data.sessions.map((s) => s.id));
  requireData(knownSessions.size === data.sessions.length, "Duplicate session.");
  let wallet = 0;
  let table = 0;
  const financialSessions = /* @__PURE__ */ new Map();
  for (const [index2, event2] of data.ledger.entries()) {
    validateMoneyEvent(event2, index2);
    if (event2.sessionId && event2.kind !== "adjustment" && event2.kind !== "reset") financialSessions.set(event2.sessionId, addSessionMoney(financialSessions.get(event2.sessionId) ?? emptySessionMoney(), event2));
    wallet += event2.walletDelta;
    table += event2.tableDelta;
    requireData(cents(wallet) && cents(table), "Negative or unsafe account balance.");
  }
  requireData(wallet === data.wallet, "Wallet does not reconcile to ledger.");
  const settlements = data.ledger.filter((e) => e.kind === "hand-net");
  const settlementByHand = new Map(settlements.map((e) => [e.handId, e]));
  requireData(settlementByHand.size === settlements.length, "Duplicate hand settlement.");
  const handsBySession = /* @__PURE__ */ new Map();
  for (const hand of data.hands) {
    const ids = handsBySession.get(hand.sessionId) ?? [];
    ids.push(hand.id);
    handsBySession.set(hand.sessionId, ids);
  }
  requireData(settlements.length === data.hands.length, "Settlement/history count mismatch.");
  for (const hand of data.hands) {
    assertCashHandProvenance(hand);
    const hero = hand.view.seats.find((s) => s.id === 0);
    requireData(hero && hand.view.street === "complete" && hand.net === hero.stack - hero.startingStack, "Invalid completed hand.");
    const entry = settlementByHand.get(hand.id);
    requireData(entry?.pokerNet === hand.net && entry.sessionId === hand.sessionId, "Hand result does not reconcile.");
  }
  if (data.active) {
    const active = data.active;
    assertAccounting(active.game);
    assertSupportedCashScope(active.game.profile);
    requireData(active.exitMode === null || active.exitMode === "finish" || active.exitMode === "fold", "Invalid saved session exit intent.");
    requireData(data.sessions.some((s) => s.id === active.sessionId && s.endedAt === null), "Active session missing.");
    const hero = active.game.seats.find((s) => s.id === 0);
    requireData(hero, "Hero seat missing.");
    const funds = hero.stack + (active.game.street === "complete" ? 0 : hero.totalCommitted);
    requireData(table === funds, "Seated chips do not reconcile to ledger.");
    assertLatestPublicFrame(data);
    if (active.pending) requireData(active.pending.handId === active.game.handId && active.pending.revision === active.game.revision && active.pending.seatId === active.game.actor, "Obsolete pending decision.");
  } else requireData(table === 0, "Unseated table funds remain.");
  requireData([...financialSessions.keys()].every((id2) => knownSessions.has(id2)), "Financial event references missing session.");
  for (const session of data.sessions) {
    validateSessionMoney(session, financialSessions.get(session.id) ?? emptySessionMoney());
    requireData(cents(session.activeMs) && cents(session.buyIns) && cents(session.cashOut), "Invalid session totals.");
    requireData(canonical3(session.handIds) === canonical3(handsBySession.get(session.id) ?? []), "Session hand count mismatch.");
  }
  validateConfigurationData(data);
  validatePolicyViolations(data);
  validateConfigurationHistory(data);
  await validateImportedRecords(data.importedHands);
}
async function publicHistory(hands) {
  let previousHash = GENESIS;
  const output = [];
  for (const h of hands) {
    const versions = frozenPolicyVersions(h.privateProfiles);
    validatePolicyVersions(versions);
    const item = await seal({ version: "0.3.0", kind: "public-redacted", handId: h.id, sessionId: h.sessionId, number: h.number, startedAt: h.startedAt, endedAt: h.endedAt, view: structuredClone(h.view), frames: structuredClone(h.frames), net: h.net, ...h.provenance ? { provenance: structuredClone(h.provenance) } : {}, ...h.configuration ? { configuration: structuredClone(h.configuration) } : {}, ...versions.length ? { policyVersions: versions } : {}, previousHash, hash: "" });
    output.push(item);
    previousHash = item.hash;
  }
  return { format: "ai-texas-hold-em-public-history", version: "0.3.0", disclosure: "Public redacted study history. Not a resumable save or financial import. Never credits bankroll or results.", hands: output };
}
var privateKeys = /* @__PURE__ */ new Set(["deck", "deckCursor", "burned", "privateProfiles", "profiles", "drawToken", "pending", "ownCards", "seed", "policyVersion", "archetype", "observationHash", "lastActedBet", "personalityId", "personalitySeed", "traits", "memory", "opponents", "skill", "aggression", "looseness", "ranges", "foldedOpponents", "rangeAnalysis", "weightedCombos", "distribution", "diagnostics", "preflop"]);
function checkPrivate(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    requireData(!privateKeys.has(key), "Private information is not permitted in a public history import.");
    checkPrivate(item);
  }
}
function validatePolicyVersions(value) {
  if (value === void 0) return;
  requireData(Array.isArray(value) && value.length <= 10 && value.every((version, index2) => typeof version === "string" && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(version) && (index2 === 0 || value[index2 - 1] < version)), "Invalid public policy version metadata.");
}
function validatePublicHand(hand) {
  validateHandConfiguration(hand);
  validateHandProvenance(hand);
  requireData(hand.version === "0.3.0" && hand.kind === "public-redacted", "Unsupported public hand record.");
  validatePolicyVersions(hand.policyVersions);
  requireData(typeof hand.handId === "string" && hand.handId.length > 0 && hand.handId.length <= 160 && typeof hand.sessionId === "string" && hand.sessionId.length > 0 && hand.sessionId.length <= 160, "Invalid hand/session identity.");
  requireData(Number.isSafeInteger(hand.number) && hand.number > 0 && Number.isSafeInteger(hand.net), "Invalid hand metadata.");
  requireData(typeof hand.startedAt === "string" && typeof hand.endedAt === "string" && Number.isFinite(Date.parse(hand.startedAt)) && Number.isFinite(Date.parse(hand.endedAt)) && Date.parse(hand.endedAt) >= Date.parse(hand.startedAt), "Invalid hand timestamps.");
  const view = hand.view;
  requireData(view?.street === "complete" && view.handId === hand.handId && Array.isArray(hand.frames) && hand.frames.length > 0, "Only completed public hand records can be imported.");
  validatePublicReplay(hand.frames);
  requireData(view.seats.length >= 2 && view.seats.length <= 10 && view.actor === null && view.pot === 0, "Invalid settled table.");
  const ids = new Set(view.seats.map((s) => s.id));
  requireData(ids.size === view.seats.length && ids.has(0), "Invalid public seats.");
  const cards = [...view.board, ...view.seats.flatMap((s) => s.hole)];
  requireData(new Set(cards).size === cards.length && cards.every((c) => /^[2-9TJQKA][cdhs]$/.test(c)), "Invalid public cards.");
  const sums = new Map(view.seats.map((s) => [s.id, s.startingStack]));
  let paid = 0, refund = 0, award = 0, rake = 0;
  const events = /* @__PURE__ */ new Set();
  const decisions = /* @__PURE__ */ new Set();
  for (const e of view.events) {
    requireData(e.handId === hand.handId && !events.has(e.id), "Invalid event identity.");
    events.add(e.id);
    if (e.type === "action") {
      requireData(e.decisionId && !decisions.has(e.decisionId), "Duplicate action.");
      decisions.add(e.decisionId);
    }
    if (["blind", "action", "refund", "award", "rake"].includes(e.type)) {
      requireData(cents(e.amount), "Invalid event amount.");
      const amount = e.amount;
      if (e.type === "rake") {
        rake += amount;
        continue;
      }
      requireData(e.seatId !== void 0 && sums.has(e.seatId), "Unknown event seat.");
      const debit = e.type === "blind" || e.type === "action";
      const next = sums.get(e.seatId) + (debit ? -amount : amount);
      requireData(cents(next), "Event creates invalid stack.");
      sums.set(e.seatId, next);
      if (debit) paid += amount;
      else if (e.type === "refund") refund += amount;
      else award += amount;
    }
  }
  requireData(paid - refund === award + rake && rake === view.rake, "Imported pot does not reconcile.");
  requireData(view.seats.every((s) => cents(s.stack) && cents(s.startingStack) && sums.get(s.id) === s.stack), "Imported final stacks differ from events.");
  requireData(view.pots.reduce((n, p) => n + p.amount, 0) === award && Object.values(view.payouts).reduce((n, x) => n + x, 0) === award, "Imported awards differ from pots.");
  const hero = view.seats.find((s) => s.id === 0);
  requireData(hand.net === hero.stack - hero.startingStack, "Imported net result is invalid.");
  requireData(canonical3(hand.frames.at(-1)) === canonical3(view), "Replay final frame mismatch.");
  let revision = -1;
  let eventCount = 0;
  for (const frame of hand.frames) {
    requireData(frame.handId === hand.handId && frame.revision > revision && frame.events.length >= eventCount, "Replay revisions are not increasing.");
    requireData(canonical3(frame.profile) === canonical3(view.profile) && frame.button === view.button, "Replay rules changed.");
    requireData(canonical3(frame.events) === canonical3(view.events.slice(0, frame.events.length)), "Replay event prefix changed.");
    requireData(canonical3(frame.board) === canonical3(view.board.slice(0, frame.board.length)), "Replay board changed.");
    for (const seat of frame.seats) if (seat.id !== 0 && frame.street !== "complete") requireData(seat.hole.length === 0, "Replay reveals private cards prematurely.");
    revision = frame.revision;
    eventCount = frame.events.length;
  }
}
async function parsePublicHistory(text) {
  requireData(text.length <= 1e7, "Import is limited to 10 MB.");
  const payload = JSON.parse(text);
  requireData(payload.format === "ai-texas-hold-em-public-history" && payload.version === "0.3.0" && Array.isArray(payload.hands) && payload.hands.length <= 1e4, "Unsupported history format/version.");
  checkPrivate(payload);
  await checkChain(payload.hands);
  const ids = /* @__PURE__ */ new Set();
  for (const hand of payload.hands) {
    requireData(!ids.has(hand.handId), "Duplicate imported hand.");
    ids.add(hand.handId);
    validatePublicHand(hand);
  }
  return structuredClone(payload.hands);
}
async function appendMoney(data, entry) {
  requireData(!data.ledger.some((e) => e.id === entry.id), "Duplicate financial event.");
  const record = await seal({ ...entry, index: data.ledger.length, previousHash: data.ledger.at(-1)?.hash ?? GENESIS, hash: "" });
  data.ledger = [...data.ledger, record];
  data.wallet += entry.walletDelta;
}
async function migrateData(input) {
  requireData(input && typeof input === "object", "Saved data is invalid.");
  const source = input;
  requireData(source.schemaVersion === 2 || source.schemaVersion === 3 || source.schemaVersion === 4, "Unknown saved-data version. Existing data was preserved; use a compatible application version.");
  const data = structuredClone(source);
  if (source.schemaVersion === 2) data.importedHands = [];
  if (source.schemaVersion === 2 || source.schemaVersion === 3) {
    data.schemaVersion = 4;
    if (data.active) data.active.exitMode = null;
  }
  await validateData(data);
  return data;
}

// src/performance/timing.ts
var observer = null;
function observeTimings(next) {
  observer = next;
}
function timed(name, work) {
  if (!observer) return work();
  const start = performance.now();
  try {
    return work();
  } finally {
    observer?.({ name, milliseconds: performance.now() - start });
  }
}
async function timedAsync(name, work) {
  if (!observer) return work();
  const start = performance.now();
  try {
    return await work();
  } finally {
    observer?.({ name, milliseconds: performance.now() - start });
  }
}

// src/storage/verified.ts
var verifiedHistories = /* @__PURE__ */ new WeakSet();
var checkpoints = /* @__PURE__ */ new WeakMap();
var frozen = /* @__PURE__ */ new WeakSet();
function freezeSnapshot(value) {
  if (!value || typeof value !== "object" || frozen.has(value)) return value;
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    requireData(!descriptor.get && !descriptor.set, "Saved data cannot contain accessors.");
    if ("value" in descriptor) freezeSnapshot(descriptor.value);
  }
  Object.freeze(value);
  frozen.add(value);
  return value;
}
function isVerifiedHistory(hands) {
  return verifiedHistories.has(hands);
}
function isVerifiedSnapshot(data) {
  return checkpoints.has(data);
}
function index(data) {
  const result2 = { wallet: 0, table: 0, ledgerIds: /* @__PURE__ */ new Set(), hands: /* @__PURE__ */ new Map(), settlements: /* @__PURE__ */ new Map(), sessionHands: /* @__PURE__ */ new Map(), financialSessions: /* @__PURE__ */ new Map() };
  for (const e of data.ledger) {
    result2.wallet += e.walletDelta;
    result2.table += e.tableDelta;
    result2.ledgerIds.add(e.id);
    if (e.kind === "hand-net") result2.settlements.set(e.handId, e);
    if (e.sessionId && e.kind !== "adjustment" && e.kind !== "reset") result2.financialSessions.set(e.sessionId, addSessionMoney(result2.financialSessions.get(e.sessionId) ?? emptySessionMoney(), e));
  }
  for (const h of data.hands) {
    result2.hands.set(h.id, h);
    const ids = result2.sessionHands.get(h.sessionId) ?? [];
    ids.push(h.id);
    result2.sessionHands.set(h.sessionId, ids);
  }
  return result2;
}
async function auditSnapshot(data) {
  freezeSnapshot(data);
  await timedAsync("integrity.fullAudit", () => validateData(data));
  const cp = index(data);
  checkSessions(data, cp);
  checkpoints.set(data, cp);
  verifiedHistories.add(data.hands);
  return data;
}
function orderedPrefix(prior, next, kind) {
  if (prior === next) return;
  requireData(next.length >= prior.length, `${kind} checkpoint lost records.`);
  for (let i = 0; i < prior.length; i++) requireData(prior[i] === next[i], `${kind} checkpoint prefix was replaced or reordered.`);
}
function checkSessions(data, cp, prior) {
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < data.sessions.length; i++) {
    const s = data.sessions[i];
    requireData(!ids.has(s.id), "Duplicate session.");
    ids.add(s.id);
    if (prior?.sessions[i] === s) continue;
    validateSessionMoney(s, cp.financialSessions.get(s.id) ?? emptySessionMoney());
    requireData(cents(s.activeMs) && cents(s.buyIns) && cents(s.cashOut), "Invalid session totals.");
    const priorSession = prior?.sessions[i], priorIndex = prior ? checkpoints.get(prior) : void 0;
    if (s.handIds !== priorSession?.handIds || cp.sessionHands.get(s.id) !== priorIndex?.sessionHands.get(s.id)) requireData(canonical3(s.handIds) === canonical3(cp.sessionHands.get(s.id) ?? []), "Session hand identities do not reconcile.");
  }
  requireData([...cp.sessionHands.keys(), ...cp.financialSessions.keys()].every((id2) => ids.has(id2)), "Hand or financial event references missing session.");
}
function activeIntegrity(data, cp) {
  if (!data.active) {
    requireData(cp.table === 0, "Unseated table funds remain.");
    return;
  }
  const active = data.active;
  assertAccounting(active.game);
  assertSupportedCashScope(active.game.profile);
  requireData(active.exitMode === null || active.exitMode === "finish" || active.exitMode === "fold", "Invalid saved session exit intent.");
  requireData(data.sessions.some((s) => s.id === active.sessionId && s.endedAt === null), "Active session missing.");
  const hero = active.game.seats.find((s) => s.id === 0);
  requireData(hero, "Hero seat missing.");
  requireData(cp.table === hero.stack + (active.game.street === "complete" ? 0 : hero.totalCommitted), "Seated chips do not reconcile to ledger.");
  assertLatestPublicFrame(data);
  if (active.pending) requireData(active.pending.handId === active.game.handId && active.pending.revision === active.game.revision && active.pending.seatId === active.game.actor, "Obsolete pending decision.");
}
async function verifyTransition(prior, next) {
  if (!prior || !checkpoints.has(prior)) return auditSnapshot(next);
  return timedAsync("integrity.incremental", async () => {
    freezeSnapshot(next);
    requireData(next.schemaVersion === 4 && next.revision === prior.revision + 1 && cents(next.epoch) && cents(next.wallet), "Invalid checkpoint revision or header.");
    orderedPrefix(prior.ledger, next.ledger, "Financial");
    orderedPrefix(prior.hands, next.hands, "Hand");
    orderedPrefix(prior.importedHands, next.importedHands, "Imported hand");
    orderedPrefix(prior.policyViolations ?? [], next.policyViolations ?? [], "Policy violation");
    requireData(next.sessions.length >= prior.sessions.length, "Session checkpoint lost records.");
    for (let i = 0; i < prior.sessions.length; i++) requireData(prior.sessions[i].id === next.sessions[i].id && (!prior.sessions[i].endedAt || prior.sessions[i] === next.sessions[i]), "Closed session checkpoint changed.");
    const old = checkpoints.get(prior), ledgerChanged = next.ledger.length !== prior.ledger.length, handsChanged = next.hands.length !== prior.hands.length;
    const cp = { ...old, ledgerIds: ledgerChanged ? new Set(old.ledgerIds) : old.ledgerIds, settlements: ledgerChanged ? new Map(old.settlements) : old.settlements, hands: handsChanged ? new Map(old.hands) : old.hands, sessionHands: handsChanged ? new Map(old.sessionHands) : old.sessionHands, financialSessions: ledgerChanged ? new Map(old.financialSessions) : old.financialSessions };
    let previous = prior.ledger.at(-1)?.hash ?? GENESIS;
    for (let i = prior.ledger.length; i < next.ledger.length; i++) {
      const e = next.ledger[i], { hash, ...body } = e;
      requireData(e.previousHash === previous && hash === await digest(body), "Saved financial record integrity check failed.");
      previous = hash;
      requireData(!cp.ledgerIds.has(e.id), "Duplicate financial event.");
      cp.ledgerIds.add(e.id);
      validateMoneyEvent(e, i);
      if (e.kind === "hand-net") {
        requireData(!cp.settlements.has(e.handId), "Duplicate settlement ledger.");
        cp.settlements.set(e.handId, e);
      }
      if (e.sessionId && e.kind !== "adjustment" && e.kind !== "reset") cp.financialSessions.set(e.sessionId, addSessionMoney(cp.financialSessions.get(e.sessionId) ?? emptySessionMoney(), e));
      cp.wallet += e.walletDelta;
      cp.table += e.tableDelta;
      requireData(cents(cp.wallet) && cents(cp.table), "Negative or unsafe account balance.");
    }
    requireData(cp.wallet === next.wallet, "Wallet does not reconcile to ledger.");
    previous = prior.hands.at(-1)?.hash ?? GENESIS;
    for (let i = prior.hands.length; i < next.hands.length; i++) {
      const h = next.hands[i], { hash, ...body } = h;
      requireData(h.previousHash === previous && hash === await digest(body), "Saved hand integrity check failed.");
      previous = hash;
      assertCashHandProvenance(h);
      requireData(!cp.hands.has(h.id), "Duplicate settled hand.");
      cp.hands.set(h.id, h);
      const hero = h.view.seats.find((s) => s.id === 0), entry = cp.settlements.get(h.id);
      requireData(hero && h.view.street === "complete" && h.net === hero.stack - hero.startingStack, "Invalid completed hand.");
      requireData(entry?.pokerNet === h.net && entry.sessionId === h.sessionId, "Hand result does not reconcile.");
      cp.sessionHands.set(h.sessionId, [...cp.sessionHands.get(h.sessionId) ?? [], h.id]);
    }
    if (next.importedHands.length > prior.importedHands.length) await validateImportedRecords(next.importedHands, prior.importedHands.length);
    requireData(cp.settlements.size === cp.hands.size, "Settlement/history count mismatch.");
    checkSessions(next, cp, prior);
    validateConfigurationData(next, prior);
    validatePolicyViolations(next, prior);
    validateUserNotes(next, prior);
    activeIntegrity(next, cp);
    validateConfigurationHistory(next, prior);
    checkpoints.set(next, cp);
    verifiedHistories.add(next.hands);
    return next;
  });
}
function draftSnapshot(prior) {
  requireData(checkpoints.has(prior), "A full audit is required before a mutable draft.");
  return timed("snapshot.draft", () => {
    const { hands, ledger, sessions, importedHands, namedPresets, policyViolations, userNotes, active, ...header } = prior;
    return { ...structuredClone(header), ...namedPresets ? { namedPresets } : {}, ...policyViolations ? { policyViolations } : {}, ...userNotes ? { userNotes } : {}, hands, ledger, importedHands, sessions: sessions.map((s) => s.endedAt ? s : { ...s }), active: active ? { ...active, frames: active.frames.slice(), pending: active.pending ? structuredClone(active.pending) : null } : null };
  });
}

// src/storage/segments.ts
var SEGMENTS = ["ledger", "hands", "closedSessions", "importedHands"];
var segmentKey = (segment, index2) => `v2:${segment}:${String(index2).padStart(12, "0")}`;
function parts(data) {
  const { ledger, hands, sessions, importedHands, ...rest } = data, open = sessions.filter((s) => s.endedAt === null);
  requireData(open.length <= 1 && (!open.length || sessions.at(-1) === open[0]), "Invalid open session ordering.");
  return { header: { ...rest, openSession: open[0] ?? null }, values: { ledger, hands, closedSessions: open.length ? sessions.slice(0, -1) : sessions, importedHands } };
}
async function prepareSegments(data, priorData, prior) {
  if (!isVerifiedSnapshot(data)) await auditSnapshot(data);
  const next = parts(data), before = priorData ? parts(priorData) : null, writes = [], segments = {};
  for (const name of SEGMENTS) {
    const previous = prior?.version === 2 ? prior.segments[name] : { count: 0, tail: GENESIS };
    const values = next.values[name], prefix = before?.values[name] ?? [];
    requireData(values.length >= previous.count, "Storage segment checkpoint lost records.");
    if (prior?.version === 2) {
      requireData(prefix.length === previous.count, "Storage checkpoint count mismatch.");
      if (values !== prefix) for (let i = 0; i < previous.count; i++) requireData(values[i] === prefix[i] || canonical3(values[i]) === canonical3(prefix[i]), "Storage immutable prefix was replaced.");
    }
    let hash = previous.tail;
    for (let i = previous.count; i < values.length; i++) {
      const body2 = { index: i, previousHash: hash, value: values[i] }, entry = { ...body2, hash: await digest(body2) };
      writes.push({ key: segmentKey(name, i), entry });
      hash = entry.hash;
    }
    segments[name] = { count: values.length, tail: hash };
  }
  const body = { format: "ai-texas-hold-em-private-device", version: 2, data: next.header, segments };
  return { envelope: { ...body, checksum: await digest(body) }, writes };
}
async function restoreSegments(envelope, read) {
  requireData(envelope?.format === "ai-texas-hold-em-private-device" && envelope.version === 2, "Unsupported segmented snapshot format.");
  const { checksum, ...body } = envelope;
  requireData(checksum === await digest(body), "Saved snapshot failed its integrity check. Existing data was preserved; no bankroll was reset.");
  const values = {};
  for (const name of SEGMENTS) {
    const descriptor = envelope.segments[name];
    requireData(descriptor && Number.isSafeInteger(descriptor.count) && descriptor.count >= 0 && descriptor.count <= 1e6, "Invalid storage segment size.");
    const records = await read(Array.from({ length: descriptor.count }, (_, i) => segmentKey(name, i)));
    let hash = GENESIS;
    values[name] = [];
    for (let i = 0; i < records.length; i++) {
      const entry = records[i];
      requireData(entry && entry.index === i && entry.previousHash === hash, "Storage segment missing or reordered.");
      const { hash: claimed, ...record } = entry;
      requireData(claimed === await digest(record), "Saved storage segment integrity check failed.");
      hash = claimed;
      values[name].push(entry.value);
    }
    requireData(records.length === descriptor.count && hash === descriptor.tail, "Storage segment checkpoint mismatch.");
  }
  const { openSession, ...header } = envelope.data;
  const data = { ...header, ledger: values.ledger, hands: values.hands, importedHands: values.importedHands, sessions: [...values.closedSessions, ...openSession ? [openSession] : []] };
  return auditSnapshot(data);
}
function sameManifest(left, right) {
  return canonical3(left ?? null) === canonical3(right ?? null);
}

// src/identity.ts
function newHandId() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure randomness unavailable. The table cannot start.");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `hand-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// src/storage/erasure.ts
var ERASURE_KEY = "erasure";
var DELETE_PRACTICE_CONFIRMATION = "DELETE ALL PRACTICE DATA";
var PracticeDataDeletedError = class extends Error {
  code = "PRACTICE_DATA_DELETED";
  constructor() {
    super("Saved practice data was deleted. Start fresh explicitly; old pending writes cannot be resumed.");
    this.name = "PracticeDataDeletedError";
  }
};
function assertErasureMarker(value) {
  const marker = value;
  if (!marker || typeof marker !== "object" || Array.isArray(marker) || marker.format !== "ai-texas-hold-em-erasure" || marker.version !== 1 || typeof marker.id !== "string" || !marker.id.length || marker.id.length > 200 || typeof marker.erasedAt !== "string" || !Number.isFinite(Date.parse(marker.erasedAt)) || Object.keys(marker).some((key) => !["format", "version", "id", "erasedAt"].includes(key))) throw new Error("Unrecognized deletion marker. Existing storage was preserved.");
}
async function erasePracticeStore(db, request) {
  assertErasureMarker(request.marker);
  if (!request.owner || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) throw new Error("A current owned revision is required for deletion.");
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction("kv", "readwrite", { durability: "strict" });
    } catch {
      tx = db.transaction("kv", "readwrite");
    }
    const store = tx.objectStore("kv");
    let reason = new Error("Deletion did not commit. Existing saved data was preserved.");
    let complete = 0, prior, lease, marker;
    const abort = (error) => {
      reason = error;
      tx.abort();
    };
    const inspect = () => {
      if (++complete !== 3) return;
      if (marker !== void 0 && marker !== null) {
        try {
          assertErasureMarker(marker);
        } catch (error) {
          abort(error);
          return;
        }
        abort(new PracticeDataDeletedError());
        return;
      }
      const saved = prior;
      if (lease?.owner !== request.owner) {
        abort(new Error("Another tab owns this session. Deletion was refused."));
        return;
      }
      if (!saved || saved.data?.revision !== request.expectedRevision || request.expectedChecksum !== void 0 && saved.checksum !== request.expectedChecksum) {
        abort(new Error("Saved revision changed in another tab. Reload before deleting data."));
        return;
      }
      if (saved.data.active !== null) {
        abort(new Error("End and cash out the table before deleting saved practice data."));
        return;
      }
      store.clear();
      store.put(structuredClone(request.marker), ERASURE_KEY);
      store.put({ owner: request.owner, expires: Date.now() + 12e3 }, "lease");
    };
    const current = store.get("current");
    current.onsuccess = () => {
      prior = current.result;
      inspect();
    };
    const leaseRead = store.get("lease");
    leaseRead.onsuccess = () => {
      lease = leaseRead.result;
      inspect();
    };
    const erased = store.get(ERASURE_KEY);
    erased.onsuccess = () => {
      marker = erased.result;
      inspect();
    };
    tx.oncomplete = () => resolve(structuredClone(request.marker));
    tx.onabort = () => reject(reason);
    tx.onerror = () => {
    };
  });
}

// src/storage/browser.ts
var DATABASE = "ai-texas-hold-em-guest";
var LEASE_MS = 12e3;
function tabOwner(databaseName) {
  const fresh = newHandId();
  try {
    const key = `${databaseName}-writer`;
    const reload = performance.getEntriesByType("navigation")[0]?.type === "reload";
    const prior = sessionStorage.getItem(key);
    const owner = reload && prior ? prior : fresh;
    sessionStorage.setItem(key, owner);
    return owner;
  } catch {
    return fresh;
  }
}
var BrowserPersistence = class {
  constructor(databaseName = DATABASE) {
    this.databaseName = databaseName;
    this.owner = tabOwner(databaseName);
  }
  db = null;
  saved = null;
  manifest = null;
  owner;
  release = null;
  closed = false;
  heartbeat = null;
  writable = false;
  persistent = false;
  deleted = false;
  async requestProtection() {
    this.persistent = await navigator.storage?.persist?.() ?? false;
    return this.persistent;
  }
  async open() {
    if (this.db) return this.db;
    requireData(typeof indexedDB !== "undefined", "Browser storage is unavailable. Enable site storage to play safely.");
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.databaseName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      };
      req.onerror = () => reject(req.error ?? new Error("Cannot open saved guest data."));
      req.onblocked = () => reject(new Error("Another tab is blocking a storage upgrade. Close it and retry."));
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          this.db = null;
          this.writable = false;
        };
        resolve(req.result);
      };
    });
    return this.db;
  }
  transaction(db) {
    try {
      return db.transaction("kv", "readwrite", { durability: "strict" });
    } catch {
      return db.transaction("kv", "readwrite");
    }
  }
  async acquire(steal = false) {
    if (this.closed) throw new Error("Storage connection closed. Reload to continue.");
    if (this.writable && !steal) return;
    if (navigator.locks) {
      await new Promise((resolve, reject) => {
        void navigator.locks.request(this.databaseName, steal ? { steal: true } : { ifAvailable: true }, async (lock) => {
          this.writable = !!lock;
          resolve();
          if (lock) await new Promise((release) => {
            this.release = release;
          });
        }).catch(reject);
      });
      if (this.writable) await this.renewLease(true, true);
    } else await this.renewLease(true, steal);
    if (this.writable && !this.heartbeat) this.heartbeat = setInterval(() => {
      void this.renewLease(false).catch(() => {
        this.writable = false;
      });
    }, 3e3);
  }
  async takeOver() {
    this.release?.();
    this.release = null;
    this.writable = false;
    await this.acquire(true);
  }
  async renewLease(acquire, force = false) {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = this.transaction(db);
      const store = tx.objectStore("kv");
      const req = store.get("lease");
      req.onsuccess = () => {
        const lease = req.result;
        const now2 = Date.now();
        this.writable = force || lease?.owner === this.owner || !!acquire && (!lease || lease.expires <= now2);
        if (this.writable) store.put({ owner: this.owner, expires: now2 + LEASE_MS }, "lease");
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Writer lease failed."));
      tx.onerror = () => {
      };
    });
  }
  async readCurrent(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get("current");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async readKeys(db, keys4) {
    if (!keys4.length) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readonly"), store = tx.objectStore("kv"), values = new Array(keys4.length);
      let count = 0;
      keys4.forEach((key, index2) => {
        const request = store.get(key);
        request.onsuccess = () => {
          values[index2] = request.result;
          if (++count === keys4.length) resolve(values);
        };
        request.onerror = () => reject(request.error);
      });
      tx.onabort = () => reject(tx.error ?? new Error("Snapshot read interrupted."));
    });
  }
  async load() {
    return timedAsync("persistence.load", async () => {
      const db = await this.open();
      await this.acquire();
      const [marker] = await this.readKeys(db, [ERASURE_KEY]);
      if (marker !== void 0 && marker !== null) {
        assertErasureMarker(marker);
        this.deleted = true;
        this.saved = null;
        this.manifest = null;
        throw new PracticeDataDeletedError();
      }
      const result2 = await this.readCurrent(db);
      this.deleted = false;
      if (!result2) {
        this.saved = null;
        this.manifest = null;
        return null;
      }
      requireData(result2.format === "ai-texas-hold-em-private-device" && (result2.version === 1 || result2.version === 2), "Unknown guest snapshot format. Existing data was preserved.");
      if (result2.version === 2) {
        this.saved = await restoreSegments(result2, (keys4) => this.readKeys(db, keys4));
        this.manifest = result2;
        return this.saved;
      }
      requireData(result2.checksum === await digest(result2.data), "Saved snapshot failed its integrity check. Existing data was preserved; no bankroll was reset.");
      const migrated = await migrateData(result2.data);
      this.manifest = result2;
      this.saved = null;
      if (this.writable) {
        migrated.revision = result2.data.revision + 1;
        await this.commit(result2.data.revision, migrated);
      } else this.saved = await auditSnapshot(migrated);
      return this.saved;
    });
  }
  async commit(expectedRevision, data) {
    if (this.deleted) throw new PracticeDataDeletedError();
    requireData(this.writable, "Another tab owns this session. This tab is read-only; close the other tab and retry.");
    const db = await this.open();
    if (!this.manifest && expectedRevision !== null) this.manifest = await this.readCurrent(db);
    requireData(!this.manifest || this.manifest.data.schemaVersion <= data.schemaVersion, "Saved-data downgrade refused. Use a compatible application version.");
    const prepared = await timedAsync("persistence.prepareSegments", () => prepareSegments(data, this.saved, this.manifest));
    await timedAsync("persistence.transaction", () => new Promise((resolve, reject) => {
      const tx = this.transaction(db);
      const store = tx.objectStore("kv");
      let reason = "Storage write failed. The last committed game remains intact. Retry after making space.";
      const current = store.get("current");
      const erased = store.get(ERASURE_KEY);
      let reads = 0;
      let erasedValue;
      const proceed = () => {
        if (++reads !== 2) return;
        if (erasedValue !== void 0 && erasedValue !== null) {
          this.deleted = true;
          reason = new PracticeDataDeletedError().message;
          tx.abort();
          return;
        }
        const prior = current.result;
        if (prior && prior.data.schemaVersion > data.schemaVersion) {
          reason = "Saved-data downgrade refused. Use a compatible application version.";
          tx.abort();
          return;
        }
        if ((prior?.data.revision ?? null) !== expectedRevision || !sameManifest(prior, this.manifest)) {
          reason = "Saved revision changed in another tab. Reload the saved session before acting.";
          tx.abort();
          return;
        }
        const save = () => {
          if (prior) {
            store.put(prior, "previous");
            if (prior.version === 1) store.put(prior, "pre-segment-v1");
            if (prior.data.schemaVersion !== data.schemaVersion) store.put(prior, `pre-migration-v${prior.data.schemaVersion}`);
          }
          for (const write of prepared.writes) store.put(write.entry, write.key);
          store.put(prepared.envelope, "current");
        };
        const req = store.get("lease");
        req.onsuccess = () => {
          const lease = req.result;
          if (!this.writable || lease?.owner !== this.owner) {
            this.writable = false;
            reason = "Another tab owns this session. Retry or explicitly take over here.";
            tx.abort();
            return;
          }
          store.put({ owner: this.owner, expires: Date.now() + LEASE_MS }, "lease");
          save();
        };
      };
      current.onsuccess = proceed;
      erased.onsuccess = () => {
        erasedValue = erased.result;
        proceed();
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(this.deleted ? new PracticeDataDeletedError() : new Error(reason + (tx.error ? ` (${tx.error.name})` : "")));
      tx.onerror = () => {
      };
    }));
    this.saved = data;
    this.manifest = prepared.envelope;
  }
  async erase(expectedRevision) {
    requireData(this.writable, "Another tab owns this session. Deletion was refused.");
    const marker = { format: "ai-texas-hold-em-erasure", version: 1, id: newHandId(), erasedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await erasePracticeStore(await this.open(), { owner: this.owner, expectedRevision, marker, ...this.manifest ? { expectedChecksum: this.manifest.checksum } : {} });
    this.deleted = true;
    this.saved = null;
    this.manifest = null;
  }
  async startFresh(initial) {
    requireData(this.writable, "Another tab owns this session. Close it before starting fresh.");
    requireData(initial && initial.revision === 0 && initial.active === null && initial.hands.length === 0 && initial.importedHands.length === 0 && initial.sessions.length === 0 && initial.ledger.length === 1 && initial.ledger[0].kind === "adjustment", "An empty explicitly initialized guest save is required.");
    const prepared = await prepareSegments(initial, null, null);
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = this.transaction(db), store = tx.objectStore("kv");
      let reason = "Fresh start did not commit. Saved deletion remains in effect.";
      const erased = store.get(ERASURE_KEY);
      erased.onsuccess = () => {
        try {
          assertErasureMarker(erased.result);
        } catch (e) {
          reason = e.message;
          tx.abort();
          return;
        }
        const current = store.get("current");
        current.onsuccess = () => {
          if (current.result) {
            reason = "Saved revision changed. Reload before starting fresh.";
            tx.abort();
            return;
          }
          const lease = store.get("lease");
          lease.onsuccess = () => {
            if (lease.result?.owner !== this.owner) {
              this.writable = false;
              reason = "Another tab owns this session. Fresh start was refused.";
              tx.abort();
              return;
            }
            for (const write of prepared.writes) store.put(write.entry, write.key);
            store.put(prepared.envelope, "current");
            store.delete(ERASURE_KEY);
            store.put({ owner: this.owner, expires: Date.now() + LEASE_MS }, "lease");
          };
        };
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error(reason));
      tx.onerror = () => {
      };
    });
    this.deleted = false;
    this.saved = initial;
    this.manifest = prepared.envelope;
  }
  close() {
    this.closed = true;
    this.writable = false;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.release?.();
    this.release = null;
    if (this.db) {
      try {
        const tx = this.transaction(this.db);
        const s = tx.objectStore("kv");
        const r = s.get("lease");
        r.onsuccess = () => {
          if (r.result?.owner === this.owner) s.delete("lease");
        };
      } catch {
      }
    }
    this.db?.close();
    this.db = null;
  }
};

// src/bots/legacy-v0.ts
var POLICY_VERSION2 = "synthetic-phase0-0.1.0";
var ARCHETYPES2 = Object.freeze([
  "nit",
  "station",
  "tag",
  "lag",
  "fit-or-fold",
  "maniac",
  "passive-reg",
  "stronger-reg"
]);
var TRAITS = {
  nit: [0.25, 0.12],
  station: [0.12, 0.9],
  tag: [0.62, 0.32],
  lag: [0.79, 0.67],
  "fit-or-fold": [0.29, 0.4],
  maniac: [0.94, 0.87],
  "passive-reg": [0.24, 0.42],
  "stronger-reg": [0.66, 0.4]
};
function clamp2(n, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}
function sigmoid2(n) {
  return 1 / (1 + Math.exp(-n));
}
function securePolicyRandom() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure randomness is unavailable. Bot play is paused.");
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
function draw(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return value;
}
function rank(card) {
  return "23456789TJQKA".indexOf(card[0]) + 2;
}
function handFeatures(ownCards, board) {
  const ranks = ownCards.map(rank).sort((a, b) => b - a);
  const [high, low] = ranks;
  if (board.length === 0) {
    const paired = high === low;
    const suited = ownCards[0][1] === ownCards[1][1];
    const connected = high - low === 1;
    const strength2 = paired ? 0.5 + (high - 2) / 12 * 0.45 : clamp2(0.1 + (high - 2) / 12 * 0.39 + (low - 2) / 12 * 0.27 + (suited ? 0.055 : 0) + (connected ? 0.045 : 0) - Math.max(0, high - low - 3) * 0.018);
    return { strength: strength2, draw: 0, made: paired };
  }
  const all = [...ownCards, ...board];
  const counts8 = /* @__PURE__ */ new Map();
  const suits = /* @__PURE__ */ new Map();
  for (const card of all) {
    counts8.set(rank(card), (counts8.get(rank(card)) ?? 0) + 1);
    suits.set(card[1], (suits.get(card[1]) ?? 0) + 1);
  }
  const values = new Set(all.map(rank));
  if (values.has(14)) values.add(1);
  let straight = false;
  let straightDraw = 0;
  for (let start = 1; start <= 10; start++) {
    const run = Array.from({ length: 5 }, (_, i) => start + i);
    const present = run.filter((value) => values.has(value)).length;
    if (present === 5) straight = true;
    if (present === 4 && ownCards.some((c) => run.includes(rank(c)) || rank(c) === 14 && run.includes(1))) {
      const missing = run.find((value) => !values.has(value));
      straightDraw = Math.max(straightDraw, missing === start || missing === start + 4 ? 0.28 : 0.15);
    }
  }
  const groups = [...counts8.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = [...suits.values()].some((count) => count >= 5);
  const flushDraw = [...suits.entries()].some(([suit, count]) => count === 4 && ownCards.some((c) => c[1] === suit));
  const trips = groups.some(([, count]) => count >= 3);
  const pairs = groups.filter(([, count]) => count >= 2).length;
  let strength = 0.11 + (high - 2) / 12 * 0.17;
  if (pairs) {
    const pairRank = groups.find(([, count]) => count >= 2)[0];
    const ownedPair = ownCards.some((card) => (counts8.get(rank(card)) ?? 0) >= 2);
    strength = ownedPair ? 0.43 + pairRank / 14 * 0.14 : strength + 0.025;
  }
  if (pairs >= 2) strength = 0.68;
  if (trips) strength = 0.77;
  if (straight) strength = 0.84;
  if (flush) strength = 0.89;
  if (trips && pairs >= 2) strength = 0.94;
  if (groups.some(([, count]) => count === 4)) strength = 0.98;
  const ownContribution = ownCards.some((card) => (counts8.get(rank(card)) ?? 0) >= 2) || flush && ownCards.some((card) => (suits.get(card[1]) ?? 0) >= 5) || straight && ownCards.some((card) => !board.some((b) => rank(b) === rank(card)));
  if (!ownContribution && strength > 0.5) strength = 0.34 + high / 14 * 0.13;
  const drawStrength = board.length < 5 ? Math.min(0.5, straightDraw + (flushDraw ? 0.32 : 0)) : 0;
  return { strength: clamp2(strength), draw: drawStrength, made: strength >= 0.43 };
}
function permittedObservation(o) {
  return {
    handId: o.handId,
    revision: o.revision,
    actingSeat: o.actingSeat,
    decisionId: o.decisionId,
    policyVersion: o.policyVersion,
    ownCards: [...o.ownCards],
    board: [...o.board],
    street: o.street,
    button: o.button,
    pot: o.pot,
    bigBlind: o.bigBlind,
    seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })),
    legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened },
    // Card-bearing events are not needed by these memoryless policies. Only public actions enter the fingerprint.
    publicEvents: o.publicEvents.map((e) => ({
      id: e.id,
      handId: e.handId,
      revision: e.revision,
      type: e.type,
      seatId: e.seatId,
      amount: e.amount,
      action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0,
      street: e.street,
      decisionId: e.decisionId
    }))
  };
}
function validate(o, p) {
  if (!Object.hasOwn(TRAITS, p.archetype) || ![p.aggression, p.looseness].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error("Invalid bot profile.");
  if (p.policyVersion !== POLICY_VERSION2 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint(o, p) {
  const text = JSON.stringify({ observation: o, profile: { archetype: p.archetype, policyVersion: p.policyVersion, aggression: p.aggression, looseness: p.looseness } });
  let h1 = 2166136261, h2 = 2654435769;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 2246822519);
  }
  return `fnv-pair:${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
function policyDistribution(observation, profile) {
  const o = permittedObservation(observation);
  validate(o, profile);
  const own = o.seats.find((s) => s.id === o.actingSeat);
  const { strength, draw: drawStrength, made } = handFeatures(o.ownCards, o.board);
  const active = o.seats.filter((s) => !s.folded).length;
  const multiway = Math.max(0, active - 2);
  const call = o.legal.callAmount;
  const price = call / Math.max(1, o.pot + call);
  const stackExposure = call / Math.max(1, own.stack);
  const preflop = o.street === "preflop";
  const buttonIndex = o.seats.findIndex((s) => s.id === o.button);
  const seatIndex = o.seats.findIndex((s) => s.id === o.actingSeat);
  const distance = (seatIndex - buttonIndex + o.seats.length) % o.seats.length;
  const latePosition = distance === 0 ? 0.06 : distance >= o.seats.length - 2 ? 0.025 : -0.02;
  const drawValue = drawStrength * (o.street === "flop" ? 0.65 : 0.4);
  const quality = strength + drawValue + (preflop ? latePosition : 0) - multiway * 0.018;
  const fitPenalty = profile.archetype === "fit-or-fold" && !preflop && !made && drawStrength < 0.2 ? 0.2 : 0;
  const threshold = (preflop ? 0.43 : 0.42) - (profile.looseness - 0.4) * 0.36 + price * 0.58 + stackExposure * 0.12 + fitPenalty;
  const continueChance = clamp2(sigmoid2((quality - threshold) * 8), 0.015, 0.995);
  const canRaise = o.legal.canRaise;
  const value = sigmoid2((quality - 0.64) * 10);
  const bluff = profile.aggression * (preflop ? 0.12 : o.street === "river" ? 0.08 : 0.06) / (1 + multiway * 0.5);
  const semiBluff = drawStrength * profile.aggression * 0.4;
  const raiseConditional = canRaise ? clamp2(value * (0.35 + profile.aggression * 0.58) + bluff + semiBluff, 0.015, 0.94) : 0;
  if (call === 0 && o.legal.check) return { fold: 0, check: 1 - raiseConditional, call: 0, raise: raiseConditional };
  const fold = o.legal.fold ? 1 - continueChance : 0;
  const remaining = 1 - fold;
  return { fold, check: 0, call: remaining * (1 - raiseConditional), raise: remaining * raiseConditional };
}
function sampleRaise(o, p, value) {
  if (!o.legal.canRaise || o.legal.minRaiseTo !== null && o.legal.maxRaiseTo !== null && o.legal.minRaiseTo > o.legal.maxRaiseTo) {
    if (o.legal.shortAllInTo === null) throw new Error("No legal raise available.");
    return { type: "raise", to: o.legal.shortAllInTo };
  }
  const own = o.seats.find((s) => s.id === o.actingSeat);
  const min = o.legal.minRaiseTo;
  const max = o.legal.maxRaiseTo;
  const fractions = [0.33, 0.5, 0.75, 1, 1.5];
  const index2 = Math.min(4, Math.floor(value * (p.aggression > 0.7 ? 5 : 4)));
  const base = own.streetCommitted + o.legal.callAmount;
  let target = base + Math.round((o.pot + o.legal.callAmount) * fractions[index2]);
  if (o.street === "preflop" && o.pot < 5 * o.bigBlind) target = Math.max(target, Math.round(o.bigBlind * (2.2 + p.aggression)));
  return { type: "raise", to: clamp2(target, min, max) };
}
function chooseDecision(observation, profile, random = securePolicyRandom) {
  const o = permittedObservation(observation);
  validate(o, profile);
  const distribution = policyDistribution(o, profile);
  const sample = draw(random);
  let action;
  if (sample < distribution.fold) action = { type: "fold" };
  else if (sample < distribution.fold + distribution.check) action = { type: "check" };
  else if (sample < distribution.fold + distribution.check + distribution.call) action = { type: "call" };
  else action = sampleRaise(o, profile, draw(random));
  return {
    handId: o.handId,
    revision: o.revision,
    seatId: o.actingSeat,
    decisionId: o.decisionId,
    policyVersion: profile.policyVersion,
    observationHash: fingerprint(o, profile),
    action
  };
}

// src/bots/v1/profiles.ts
var POLICY_VERSION3 = "synthetic-cash-1.0.0";
var ARCHETYPES3 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS2 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp3 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid3 = (n) => 1 / (1 + Math.exp(-n));
var traits2 = (values) => Object.fromEntries(TRAIT_KEYS2.map((key, i) => [key, values[i]]));
var PRESETS2 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits2([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits2([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits2([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits2([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits2([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits2([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits2([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits2([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS2 = Object.freeze({ ...PRESETS2.tag.traits });
var POPULATION_WEIGHTS2 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit2(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile2(profile) {
  if (!ARCHETYPES3.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION3) throw new Error("Bot policy version mismatch.");
  unit2(profile.aggression, "aggression");
  unit2(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS2) t[key] = unit2(profile.traits?.[key], key) ?? PRESETS2[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS2, environment)) throw new Error("Unknown population environment.");
  return { archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit2(profile.skill, "skill") ?? PRESETS2[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v1/memory.ts
function publicActionEvents(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v1/boundary.ts
var rate = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate(p.vpip), pfr: rate(p.pfr), aggression: rate(p.aggression), foldToBet: rate(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation2(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents(o.publicEvents) };
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    result2.rake = { basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory(o.memory);
  return result2;
}
function validate2(o, p) {
  completeProfile2(p);
  if (o.policyVersion !== POLICY_VERSION3 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint2(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v1/features.ts
var rank2 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey = "";
var lastNutsResult = false;
function unbeatableRiver(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey) return lastNutsResult;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey = key;
  lastNutsResult = unbeatable;
  return unbeatable;
}
function handFeatures2(ownCards, board) {
  const ownRanks = ownCards.map(rank2).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp3(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp3((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank2), boardRanks = board.map(rank2), groups = counts(allRanks), boardGroups = counts(boardRanks), suits = counts(all.map((c) => c[1])), boardSuits = counts(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp3((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank2);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank2(c) === r)).length;
    const privateQuality = clamp3(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank2(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank2(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank2(c) === r));
      nutDraw = ownInSuit.some((c) => rank2(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp3((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp3(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp3(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function decisionContext(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), index2 = o.seats.findIndex((s) => s.id === o.actingSeat), distance = (index2 - button + total) % total;
  const position = distance === 0 ? "late" : distance === 1 || total > 2 && distance === 2 ? "blinds" : distance >= total - 2 ? "late" : distance <= Math.ceil(total / 2) ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: o.legal.callAmount / Math.max(1, o.pot + o.legal.callAmount), betToPot: o.legal.callAmount / Math.max(o.bigBlind, o.pot - o.legal.callAmount), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v1/strategy.ts
function memoryAdjustment(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp3(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp3(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function sizing(o, p, f, c) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp3(Math.round(to), min, max);
    const prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  if (o.street === "preflop") {
    if (c.preflopNode === "unopened" || c.preflopNode === "limped") {
      const isolation = c.limpers * (0.7 + p.traits.sizingAggression * 0.6), offset = p.environment === "low" ? 0.4 : p.environment === "high" ? -0.15 : 0;
      for (const [bb, w] of [[2.2, 0.25], [2.7, 0.45], [3.5, 0.3]]) add(c.limpers ? "Isolation raise" : "Open raise", (bb + isolation + offset) * o.bigBlind, w * (bb > 3 ? 0.6 + p.traits.sizingAggression : 1));
    } else {
      const multiple = c.preflopNode === "facing-open" ? c.inPosition ? 2.7 : 3.25 : 2.2;
      for (const [delta, w] of [[-0.3, 0.25], [0, 0.5], [0.6, 0.25]]) add(c.squeeze ? "Squeeze" : c.preflopNode === "facing-open" ? "3-bet" : "4-bet+", base * (multiple + delta) + c.limpers * 0.25 * o.bigBlind, w);
    }
  } else {
    const polarized = o.street === "river" && (f.strength > 0.8 || f.strength < 0.35), target = 0.4 + p.traits.sizingAggression * 0.65 + (f.wetness > 0.55 ? 0.15 : 0) + (polarized ? 0.35 : 0);
    for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
      let weight = Math.exp(-Math.abs(fraction - target) * 2.7);
      if (fraction >= 1.5) weight *= polarized ? 0.35 + p.traits.sizingAggression * 0.65 : 0.04 + p.traits.sizingAggression * 0.12;
      add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
    }
  }
  if (c.spr < 1.7 && (f.strength > 0.66 || p.traits.riskTolerance > 0.8)) add("All-in", max, 0.35 + p.traits.riskTolerance * 0.4);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function analyzeDecision(observation, profile) {
  const o = permittedObservation2(observation), p = completeProfile2(profile);
  validate2(o, p);
  const t = p.traits, f = handFeatures2(o.ownCards, o.board), c = decisionContext(o), pre = o.street === "preflop", call = o.legal.callAmount;
  const multi = Math.max(0, c.activePlayers - 2), memory8 = memoryAdjustment(o, p, c.lastAggressor);
  const awareness = t.positionAwareness * (0.4 + 0.6 * p.skill), position = c.position === "late" ? 0.085 * awareness : c.position === "early" ? -0.07 * awareness : c.position === "blinds" ? -0.025 * awareness : 0;
  const environment = p.environment === "low" ? -0.022 : p.environment === "high" ? 0.018 : 0;
  const rakeCost = (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0;
  const callBB = call / o.bigBlind;
  const pricePenalty = pre ? Math.max(0, callBB - 1) / (callBB + 2) * (0.18 + t.sizeSensitivity * 0.28) + c.price * 0.1 : c.price * (0.3 + t.sizeSensitivity * 0.55) + Math.min(3, c.betToPot) * 0.035 * t.sizeSensitivity;
  const shallow = c.effectiveStackBB < 20, deep = c.effectiveStackBB > 150;
  const drawValue = f.draw * t.drawCalling * (o.street === "flop" ? 0.9 : 0.56) * (1 + (deep ? 0.16 : 0)) * (1 - f.wetness * t.multiwayCaution * 0.12) + (f.nutDraw ? 0.025 * t.drawCalling : 0);
  const raisesPenalty = c.preflopNode === "facing-4bet" ? 0.29 : c.preflopNode === "facing-3bet" ? 0.18 : c.preflopNode === "facing-open" ? 0.07 : 0;
  const fitPenalty = p.archetype === "fit-or-fold" && !pre && !f.made && f.draw < 0.2 ? 0.23 : 0;
  const speculative = pre && (f.handClass === "suited-connector" || f.handClass === "pocket-pair" && f.pairRank < 10);
  const strength = f.strength + (pre ? position : 0) + drawValue - (pre ? raisesPenalty * (0.7 + 0.3 * p.skill) : f.vulnerability * t.riskTolerance * 0.025) + (speculative && deep ? 0.035 : 0) - (speculative && shallow ? 0.045 : 0);
  const behindPressure = pre ? Math.max(0, c.playersBehind - 1) * t.positionAwareness * (6e-3 + 5e-3 * p.skill) : 0;
  const ownStack = o.seats.find((s) => s.id === o.actingSeat).stack;
  const stackPressure = call / Math.max(1, ownStack) * (1 - t.riskTolerance) * 0.12;
  const threshold = behindPressure + stackPressure + (pre ? 0.37 : 0.24) - (p.looseness - 0.4) * 0.34 + pricePenalty + multi * 0.025 * t.multiwayCaution + fitPenalty + environment + rakeCost * 0.3;
  const riverCatch = o.street === "river" && f.made && f.strength < 0.75 ? t.riverCuriosity * 0.065 + memory8.call : 0;
  let continueChance = clamp3(sigmoid3((strength - threshold + riverCatch) * 9), 8e-3, 0.997);
  if (!pre && o.street !== "river" && f.draw > 0) {
    const futureClosed = call >= ownStack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
    const remaining = 52 - o.ownCards.length - o.board.length;
    const clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining;
    const twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const realization = futureClosed ? 1 : clamp3(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * realization : oneCard;
    const drawContinue = sigmoid3((drawProxy - c.price) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const value = sigmoid3((f.strength - (0.49 + t.valueThreshold * 0.27) + drawValue * 0.18) * 11);
  const air = 1 - sigmoid3((f.strength - 0.46) * 11);
  const rangeAdvantage = (c.ownPreflopAggressor && (f.wetness < 0.5 || o.board.some((card) => card[0] === "A" || card[0] === "K")) ? 0.04 : 0) * p.skill;
  const blockerBluff = f.blockerStrength * t.bluffFrequency * p.aggression * 0.065 * air / (1 + multi * t.multiwayCaution);
  const bluff = clamp3(t.bluffFrequency * p.aggression * (pre ? 0.21 : 0.19) * air / (1 + multi * t.multiwayCaution * 1.5) + memory8.bluff * air + rangeAdvantage * air + blockerBluff, 0, 0.38);
  const semiBluff = !pre && o.street !== "river" ? f.draw * p.aggression * (0.25 + t.riskTolerance * 0.35) / (1 + multi * t.multiwayCaution * 0.7) : 0;
  const trap = !pre && call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.7) * 0.5 : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.13 + semiBluff * 0.4) * p.aggression : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + bluff * 0.5) * p.aggression : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet - trap;
  if (pre) {
    if (c.preflopNode === "unopened") {
      const openingPreference = sigmoid3((p.aggression + p.skill * 0.65 - 0.55) * 8);
      raising = Math.max(raising, openingPreference) + position * p.aggression * 0.5;
    }
    if (c.preflopNode === "limped") raising += p.aggression * (0.05 + c.limpers * 0.015) * Math.max(0, f.strength - 0.4);
    if (c.squeeze) raising += p.aggression * t.bluffFrequency * 0.07 / (1 + multi * 0.2);
    if (c.preflopNode === "facing-3bet" || c.preflopNode === "facing-4bet") raising *= 0.6 + f.strength * 0.4;
  } else if (c.raisesThisStreet > 1) raising *= 0.65 + f.strength * 0.25;
  if (c.spr < 1.3 && f.made && f.strength > 0.55) raising += 0.1 * t.riskTolerance;
  raising = clamp3(raising, 6e-3, 0.965);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.18;
  continueChance = clamp3(continueChance * (1 - mistakes) + (0.3 + p.looseness * 0.5) * mistakes, 5e-3, 0.998);
  raising = clamp3(raising * (1 - mistakes) + (0.08 + p.aggression * 0.4) * mistakes, 5e-3, 0.97);
  if (pre && f.pairRank === 14 || f.absoluteNuts) continueChance = 1;
  else if (pre && f.pairRank === 13) continueChance = Math.max(continueChance, c.preflopNode === "facing-4bet" ? 0.975 : 0.998);
  if (o.street === "river" && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return { version: POLICY_VERSION3, label: "SYNTHETIC / NOT HUMAN-VALIDATED", features: f, context: c, distribution, families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet }, sizing: sizing(o, p, f, c), memoryAdjustment: memory8 };
}

// src/bots/v1/policy.ts
var LEGACY_POLICY_VERSION = POLICY_VERSION2;
var securePolicyRandom2 = securePolicyRandom;
function draw2(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision2(observation, profile, random = securePolicyRandom2) {
  if (profile.policyVersion === LEGACY_POLICY_VERSION) return chooseDecision(observation, profile, random);
  const o = permittedObservation2(observation), p = completeProfile2(profile);
  validate2(o, p);
  const analysis = analyzeDecision(o, p), d = analysis.distribution, n = draw2(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw2(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint2(o, p), action };
}

// src/bots/v2/profiles.ts
var POLICY_VERSION4 = "synthetic-cash-1.1.0";
var ARCHETYPES4 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS3 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp4 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid4 = (n) => 1 / (1 + Math.exp(-n));
var traits3 = (values) => Object.fromEntries(TRAIT_KEYS3.map((key, i) => [key, values[i]]));
var PRESETS3 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits3([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits3([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits3([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits3([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits3([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits3([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits3([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits3([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS3 = Object.freeze({ ...PRESETS3.tag.traits });
var POPULATION_WEIGHTS3 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit3(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile3(profile) {
  if (!ARCHETYPES4.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION4) throw new Error("Bot policy version mismatch.");
  unit3(profile.aggression, "aggression");
  unit3(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS3) t[key] = unit3(profile.traits?.[key], key) ?? PRESETS3[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS3, environment)) throw new Error("Unknown population environment.");
  return { archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit3(profile.skill, "skill") ?? PRESETS3[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v2/memory.ts
function publicActionEvents2(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v2/boundary.ts
var rate2 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory2(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate2(p.vpip), pfr: rate2(p.pfr), aggression: rate2(p.aggression), foldToBet: rate2(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation3(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents2(o.publicEvents) };
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    result2.rake = { basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory2(o.memory);
  return result2;
}
function validate3(o, p) {
  completeProfile3(p);
  if (o.policyVersion !== POLICY_VERSION4 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint3(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.1:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v2/preflop.ts
var PREFLOP_MODEL_VERSION = "preflop-designed-1.1.0";
var RANKS = "23456789TJQKA";
var SUITS = "cdhs";
var CLASS_ROWS = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank3 = (card) => RANKS.indexOf(card[0]) + 2;
var PREFLOP_CLASSES = Object.freeze(CLASS_ROWS.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank3(handClass), lowRank = rank3(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp4((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp4((14 - highRank) / 7) * clamp4((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp4((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES = new Map(PREFLOP_CLASSES.map((c) => [c.handClass, c]));
function getClass(handClass) {
  const c = CLASSES.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards(cards);
  const [a, b] = [...cards].sort((x, y) => rank3(y) - rank3(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass(handClass, deadCards = []) {
  const c = getClass(handClass);
  checkCards(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS[c.highRank - 2] + SUITS[a], RANKS[c.lowRank - 2] + SUITS[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos(deadCards = []) {
  checkCards(deadCards);
  return PREFLOP_CLASSES.flatMap((c) => combosForClass(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
var DEPTH_ANCHORS = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp4(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS[0], upper = lower;
  for (const point of DEPTH_ANCHORS) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth = (n) => {
  const x = clamp4(n);
  return x * x * (3 - 2 * x);
};
function classWeight(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES[p.archetype], b = depthBracket(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const positional = base.cutoffs[1] + (base.cutoffs[POSITIONS.indexOf(position)] - base.cutoffs[1]) * awareness;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp4((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp4((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = m.callBB > 0 ? Math.log2(clamp4(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid4((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp4((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp4(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp4(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid4((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp4((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp4(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp4(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability };
}
function context(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId;
  return { position: preflopPosition(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: o.legal.callAmount / Math.max(1, o.pot + o.legal.callAmount), limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp4(Math.round(to), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp4((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop(observation, profile) {
  const o = permittedObservation3(observation), p = completeProfile3(profile);
  validate3(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand(o.ownCards), c = context(o), w = classWeight(getClass(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes(o, p, c, w), diagnostics: { baseScore: getClass(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/v2/features.ts
var rank4 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts2(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh2(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey2 = "";
var lastNutsResult2 = false;
function unbeatableRiver2(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey2) return lastNutsResult2;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey2 = key;
  lastNutsResult2 = unbeatable;
  return unbeatable;
}
function handFeatures3(ownCards, board) {
  const ownRanks = ownCards.map(rank4).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp4(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp4((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank4), boardRanks = board.map(rank4), groups = counts2(allRanks), boardGroups = counts2(boardRanks), suits = counts2(all.map((c) => c[1])), boardSuits = counts2(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp4((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank4);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank4(c) === r)).length;
    const privateQuality = clamp4(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank4(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank4(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank4(c) === r));
      nutDraw = ownInSuit.some((c) => rank4(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh2(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh2([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp4((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp4(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp4(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver2(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures3(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank4), newRank = rank4(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank4).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext2(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: o.legal.callAmount / Math.max(1, o.pot + o.legal.callAmount), betToPot: o.legal.callAmount / Math.max(o.bigBlind, o.pot - o.legal.callAmount), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v2/ranges.ts
var RANGE_MODEL_VERSION = "public-action-ranges-1.1.0";
var clamp5 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid5 = (x) => 1 / (1 + Math.exp(-x));
var DECK = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank5 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes = new Map(PREFLOP_CLASSES.map((c) => [c.handClass, c]));
var combos = enumerateStartingCombos().map((c) => ({ ...c, meta: classes.get(c.handClass) }));
var shapeCache = /* @__PURE__ */ new Map();
var analysisCache = /* @__PURE__ */ new Map();
var MAX_CACHE = 8;
function putBounded(cache, key, value, max = MAX_CACHE) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape(cards, board) {
  const hi = Math.max(...cards.map(rank5));
  if (!board.length) {
    const m = classes.get(className(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank5(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank5(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank5));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank5));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank5(c) === 14 && top2 === 5 ? 1 : rank5(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank5)), ownRanks = cards.map(rank5), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank5));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank5(c) === r)).length;
    const quality = clamp5(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank5(c) === r));
    if (cards.some((c) => c[1] === suit && rank5(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp5(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className(cards) {
  const sorted = [...cards].sort((a2, b2) => rank5(b2) - rank5(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes(board) {
  const key = board.join("");
  const hit = shapeCache.get(key);
  if (hit) return hit;
  return putBounded(shapeCache, key, combos.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape(c.cards, board)), 4);
}
function observed(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp5(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed(known?.vpip, priors.vpip, adapt), r = observed(known?.pfr, priors.pfr, adapt), a = observed(known?.aggression, priors.aggression, adapt), f = observed(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp5(v.value, 0.08, 0.82), pfr: clamp5(r.value, 0.03, 0.7), aggression: clamp5(a.value, 0.08, 0.85), fold: clamp5(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods(o, seatId, b, e, comboIndex) {
  const m = combos[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp5((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp5((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid5((score - threshold) * 12), premium = sigmoid5((score - 0.88) * 24);
    const aggressive = sigmoid5((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp5(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp5(enter * (1 - clamp5(aggressive * 0.65)) + 0.12 * m.speculative * clamp5((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp5(1 - enter, 0.015, 0.98), clamp5(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp5(observedPrice / 2), value = sigmoid5((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp5((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp5(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp5(sigmoid5((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp5(1 - sigmoid5((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp5(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer(o, p, seatId, dead, events) {
  const b = belief(o, p, seatId), indices = combos.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp5((1 - sigmoid5((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp5(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream(seed), cdfs = ranges.map(cumulative);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical4(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  return { seedKey: JSON.stringify(publicKey), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical4(o, p), hit = analysisCache.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer(o, p, s.id, dead, events).range);
  const ownPublic = infer(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity(o, ranges, hashSeed(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp5(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp5(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded(analysisCache, keys4.cacheKey, freeze(result2));
}

// src/bots/v2/strategy.ts
function memoryAdjustment2(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp4(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp4(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp4(Math.round(to), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision2(observation, profile) {
  const o = permittedObservation3(observation), p = completeProfile3(profile);
  validate3(o, p);
  const t = p.traits, f = handFeatures3(o.ownCards, o.board), c = decisionContext2(o), memory8 = memoryAdjustment2(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop(o, p);
    return {
      version: POLICY_VERSION4,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures(o.ownCards, o.board), line = lineContext(o, c);
  const futureClosed = terminal || call >= own.stack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
  const sampleSupport = clamp4(ranges.equitySamples / 48), samplePrecision = clamp4(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp4((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp4((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp4(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const realization = futureClosed ? 1 : clamp4(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureClosed ? 0 : streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = futureClosed || f.draw === 0 ? 0 : Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureClosed ? 0 : (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp4(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const grossPot = o.pot + call, expectedRake = o.rake ? Math.min(o.rake.cap, Math.floor(grossPot * o.rake.basisPoints / 1e4)) : 0;
  const rakeAdjustedPrice = call / Math.max(1, grossPot - expectedRake);
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp4(sigmoid4((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const secondCardRealization = futureClosed ? 1 : clamp4(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid4((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp4(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid4((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid4((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp4(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp4(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid4((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp4(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp4(continueChance + mistakeAdjustment, 5e-3, 0.998);
  raising = clamp4(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  if (f.absoluteNuts) continueChance = 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION4,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.1.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment }
  };
}

// src/bots/v2/policy.ts
var LEGACY_POLICY_VERSION2 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION = POLICY_VERSION3;
var securePolicyRandom3 = securePolicyRandom;
function draw3(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision3(observation, profile, random = securePolicyRandom3) {
  if (profile.policyVersion === LEGACY_POLICY_VERSION2) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION) return chooseDecision2(observation, profile, random);
  const o = permittedObservation3(observation), p = completeProfile3(profile);
  validate3(o, p);
  const analysis = analyzeDecision2(o, p), d = analysis.distribution, n = draw3(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw3(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint3(o, p), action };
}

// src/bots/v3/profiles.ts
var POLICY_VERSION5 = "synthetic-cash-1.2.0";
var ARCHETYPES5 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS4 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp6 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid6 = (n) => 1 / (1 + Math.exp(-n));
var traits4 = (values) => Object.fromEntries(TRAIT_KEYS4.map((key, i) => [key, values[i]]));
var PRESETS4 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits4([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits4([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits4([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits4([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits4([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits4([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits4([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits4([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS4 = Object.freeze({ ...PRESETS4.tag.traits });
var POPULATION_WEIGHTS4 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit4(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile4(profile) {
  if (!ARCHETYPES5.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION5) throw new Error("Bot policy version mismatch.");
  unit4(profile.aggression, "aggression");
  unit4(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS4) t[key] = unit4(profile.traits?.[key], key) ?? PRESETS4[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS4, environment)) throw new Error("Unknown population environment.");
  return { archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit4(profile.skill, "skill") ?? PRESETS4[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v3/memory.ts
function publicActionEvents3(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v3/boundary.ts
var rate3 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory3(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate3(p.vpip), pfr: rate3(p.pfr), aggression: rate3(p.aggression), foldToBet: rate3(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation4(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents3(o.publicEvents) };
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    result2.rake = { basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory3(o.memory);
  return result2;
}
function validate4(o, p) {
  completeProfile4(p);
  if (o.policyVersion !== POLICY_VERSION5 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint4(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.2:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v3/pricing.ts
function contestablePricing(o) {
  const callAmount = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || !Number.isSafeInteger(callAmount) || callAmount < 0) throw new Error("Invalid call exposure.");
  const contributions = o.seats.map((s) => ({ id: s.id, amount: s.totalCommitted + (s.id === own.id ? callAmount : 0) }));
  if (contributions.some((s) => !Number.isSafeInteger(s.amount) || s.amount < 0)) throw new Error("Invalid contribution exposure.");
  const ordered2 = [...contributions].sort((a, b) => b.amount - a.amount);
  const unmatched = ordered2.length > 1 ? Math.max(0, ordered2[0].amount - ordered2[1].amount) : 0;
  const adjusted = contributions.map((s) => ({ ...s, amount: s.amount - (s.id === ordered2[0]?.id ? unmatched : 0) }));
  const ownCap = adjusted.find((s) => s.id === own.id).amount;
  const totalAfterRefund = adjusted.reduce((n, s) => n + s.amount, 0);
  const contestableAfterCall = adjusted.reduce((n, s) => n + Math.min(s.amount, ownCap), 0);
  const excludedChips = contributions.reduce((n, s) => n + s.amount, 0) - contestableAfterCall;
  const rakeApplies = o.rake && (!o.rake.noFlopNoDrop || o.board.length >= 3);
  const estimatedRake = rakeApplies ? Math.min(o.rake.cap, Number(BigInt(totalAfterRefund) * BigInt(o.rake.basisPoints) / 10000n)) : 0;
  const price = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall);
  const rakeAdjustedPrice = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall - Math.min(contestableAfterCall, estimatedRake));
  return { callAmount, contestableAfterCall, excludedChips, price, rakeAdjustedPrice, estimatedRake };
}

// src/bots/v3/preflop.ts
var PREFLOP_MODEL_VERSION2 = "preflop-designed-1.2.0";
var RANKS2 = "23456789TJQKA";
var SUITS2 = "cdhs";
var CLASS_ROWS2 = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank6 = (card) => RANKS2.indexOf(card[0]) + 2;
var PREFLOP_CLASSES2 = Object.freeze(CLASS_ROWS2.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank6(handClass), lowRank = rank6(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp6((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp6((14 - highRank) / 7) * clamp6((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp6((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES2 = new Map(PREFLOP_CLASSES2.map((c) => [c.handClass, c]));
function getClass2(handClass) {
  const c = CLASSES2.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards2(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand2(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards2(cards);
  const [a, b] = [...cards].sort((x, y) => rank6(y) - rank6(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass2(handClass, deadCards = []) {
  const c = getClass2(handClass);
  checkCards2(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS2[c.highRank - 2] + SUITS2[a], RANKS2[c.lowRank - 2] + SUITS2[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos2(deadCards = []) {
  checkCards2(deadCards);
  return PREFLOP_CLASSES2.flatMap((c) => combosForClass2(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition2(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
function physicalPosition(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b2) => a.id - b2.id), n = order.length, b = order.findIndex((s) => s.id === o.button), i = order.findIndex((s) => s.id === seatId), d = (i - b + n) % n;
  if (i < 0 || b < 0 || n < 2 || n > 10) throw new Error("Invalid seat position.");
  if (d === 0) return n === 2 ? "BTN/SB" : "BTN";
  if (n === 2 || d === 2) return "BB";
  if (d === 1) return "SB";
  const behind = n - d + 2;
  if (behind === 3) return "CO";
  if (behind === 4) return "HJ";
  if (behind === 5) return n === 6 ? "UTG/LJ" : "LJ";
  return d === 3 ? "UTG" : `UTG+${d - 3}`;
}
var DEPTH_ANCHORS2 = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket2(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp6(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS2[0], upper = lower;
  for (const point of DEPTH_ANCHORS2) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS2 = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES2 = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth2 = (n) => {
  const x = clamp6(n);
  return x * x * (3 - 2 * x);
};
function classWeight2(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES2[p.archetype], b = depthBracket2(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const playersBehind = m.playersBehind ?? (position === "UTG" ? m.seats - 1 : position === "MP" ? 4 : position === "CO" ? 3 : position === "BTN" ? m.seats === 2 ? 1 : 2 : position === "SB" ? 1 : 0);
  const openingIndex = playersBehind <= 1 ? position === "BTN" ? 3 : 4 : playersBehind === 2 ? 3 : playersBehind === 3 ? 2 : playersBehind === 4 ? 1 : 0;
  const rawCutoff = node === "unopened" ? base.cutoffs[openingIndex] + Math.max(0, playersBehind - 5) * 2.5 : base.cutoffs[POSITIONS2.indexOf(position)];
  const positional = base.cutoffs[1] + (rawCutoff - base.cutoffs[1]) * awareness;
  const openingInitiativeCredit = node === "unopened" ? (4 + 8 * p.skill) * (0.55 + 0.45 * t.positionAwareness) + Math.max(0, 5 - playersBehind) * 2 * t.positionAwareness * p.skill + (m.seats === 2 ? 8 * (0.5 + 0.5 * p.skill) : 0) : 0;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp6((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp6((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = node !== "unopened" && m.callBB > 0 ? Math.log2(clamp6(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = node === "unopened" ? 0 : Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = node === "unopened" ? 0 : Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - openingInitiativeCredit - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid6((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth2((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth2((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp6((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp6(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth2((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp6(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid6((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp6((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp6(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp6(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability, openingInitiativeCredit, playersBehind };
}
function context2(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId, pricing = contestablePricing(o);
  const ordered2 = [...o.seats].sort((a, b) => a.id - b.id), actorIndex = ordered2.findIndex((s) => s.id === own.id), buttonIndex = ordered2.findIndex((s) => s.id === o.button), bbIndex = (buttonIndex + (ordered2.length === 2 ? 1 : 2)) % ordered2.length;
  let playersBehind = 0;
  for (let step = 1; step < ordered2.length; step++) {
    const index2 = (actorIndex + step) % ordered2.length, seat = ordered2[index2];
    if (!seat.folded && !seat.allIn) playersBehind++;
    if (index2 === bbIndex) break;
  }
  return { position: preflopPosition2(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: pricing.price, playersBehind, limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition2(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes2(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp6(Math.round(to), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp6((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop2(observation, profile) {
  const o = permittedObservation4(observation), p = completeProfile4(profile);
  validate4(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand2(o.ownCards), c = context2(o), w = classWeight2(getClass2(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket2(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION2, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes2(o, p, c, w), diagnostics: { baseScore: getClass2(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, openingInitiativeCredit: w.openingInitiativeCredit, playersBehind: w.playersBehind, physicalPosition: physicalPosition(o), contestableAfterCall: contestablePricing(o).contestableAfterCall, excludedChips: contestablePricing(o).excludedChips, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES2.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/v3/features.ts
var rank7 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts3(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh3(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey3 = "";
var lastNutsResult3 = false;
function unbeatableRiver3(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey3) return lastNutsResult3;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey3 = key;
  lastNutsResult3 = unbeatable;
  return unbeatable;
}
function handFeatures4(ownCards, board) {
  const ownRanks = ownCards.map(rank7).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp6(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp6((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank7), boardRanks = board.map(rank7), groups = counts3(allRanks), boardGroups = counts3(boardRanks), suits = counts3(all.map((c) => c[1])), boardSuits = counts3(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp6((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank7);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank7(c) === r)).length;
    const privateQuality = clamp6(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank7(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank7(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank7(c) === r));
      nutDraw = ownInSuit.some((c) => rank7(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh3(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh3([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp6((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp6(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp6(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver3(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures2(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures4(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank7), newRank = rank7(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank7).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext3(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition2(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const outstandingWager = Math.max(0, ...opponents.map((s) => s.streetCommitted)) - own.streetCommitted;
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: contestablePricing(o).price, betToPot: Math.max(0, outstandingWager) / Math.max(o.bigBlind, o.pot - Math.max(0, outstandingWager)), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v3/ranges.ts
var RANGE_MODEL_VERSION2 = "public-action-ranges-1.1.0";
var clamp7 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid7 = (x) => 1 / (1 + Math.exp(-x));
var DECK2 = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank8 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes2 = new Map(PREFLOP_CLASSES2.map((c) => [c.handClass, c]));
var combos2 = enumerateStartingCombos2().map((c) => ({ ...c, meta: classes2.get(c.handClass) }));
var shapeCache2 = /* @__PURE__ */ new Map();
var analysisCache2 = /* @__PURE__ */ new Map();
var MAX_CACHE2 = 8;
function putBounded2(cache, key, value, max = MAX_CACHE2) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape2(cards, board) {
  const hi = Math.max(...cards.map(rank8));
  if (!board.length) {
    const m = classes2.get(className2(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank8(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank8(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank8));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank8));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank8(c) === 14 && top2 === 5 ? 1 : rank8(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank8)), ownRanks = cards.map(rank8), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank8));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank8(c) === r)).length;
    const quality = clamp7(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank8(c) === r));
    if (cards.some((c) => c[1] === suit && rank8(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp7(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className2(cards) {
  const sorted = [...cards].sort((a2, b2) => rank8(b2) - rank8(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes2(board) {
  const key = board.join("");
  const hit = shapeCache2.get(key);
  if (hit) return hit;
  return putBounded2(shapeCache2, key, combos2.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape2(c.cards, board)), 4);
}
function observed2(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp7(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief2(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed2(known?.vpip, priors.vpip, adapt), r = observed2(known?.pfr, priors.pfr, adapt), a = observed2(known?.aggression, priors.aggression, adapt), f = observed2(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp7(v.value, 0.08, 0.82), pfr: clamp7(r.value, 0.03, 0.7), aggression: clamp7(a.value, 0.08, 0.85), fold: clamp7(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence2(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods2(o, seatId, b, e, comboIndex) {
  const m = combos2[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition2(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp7((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp7((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid7((score - threshold) * 12), premium = sigmoid7((score - 0.88) * 24);
    const aggressive = sigmoid7((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp7(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp7(enter * (1 - clamp7(aggressive * 0.65)) + 0.12 * m.speculative * clamp7((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp7(1 - enter, 0.015, 0.98), clamp7(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes2(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp7(observedPrice / 2), value = sigmoid7((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp7((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp7(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp7(sigmoid7((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp7(1 - sigmoid7((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp7(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer2(o, p, seatId, dead, events) {
  const b = belief2(o, p, seatId), indices = combos2.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods2(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos2[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes2(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos2[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp7((1 - sigmoid7((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp7(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed2(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream2(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative2(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick2(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity2(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream2(seed), cdfs = ranges.map(cumulative2);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick2(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK2.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical5(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  return { seedKey: JSON.stringify(publicKey), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze2(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges2(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical5(o, p), hit = analysisCache2.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence2(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer2(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer2(o, p, s.id, dead, events).range);
  const ownPublic = infer2(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity2(o, ranges, hashSeed2(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION2, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp7(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp7(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded2(analysisCache2, keys4.cacheKey, freeze2(result2));
}

// src/bots/v3/strategy.ts
function memoryAdjustment3(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp6(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp6(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing2(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp6(Math.round(to), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext2(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision4(observation, profile) {
  const o = permittedObservation4(observation), p = completeProfile4(profile);
  validate4(o, p);
  const t = p.traits, f = handFeatures4(o.ownCards, o.board), c = decisionContext3(o), memory8 = memoryAdjustment3(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop2(o, p);
    return {
      version: POLICY_VERSION5,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges2(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures2(o.ownCards, o.board), line = lineContext2(o, c);
  const futureClosed = terminal || call >= own.stack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
  const sampleSupport = clamp6(ranges.equitySamples / 48), samplePrecision = clamp6(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp6((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp6((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp6(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const realization = futureClosed ? 1 : clamp6(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureClosed ? 0 : streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = futureClosed || f.draw === 0 ? 0 : Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureClosed ? 0 : (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp6(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const pricing = contestablePricing(o), rakeAdjustedPrice = pricing.rakeAdjustedPrice;
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp6(sigmoid6((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const secondCardRealization = futureClosed ? 1 : clamp6(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid6((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp6(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid6((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid6((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp6(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp6(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid6((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp6(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp6(continueChance + mistakeAdjustment, 5e-3, 0.998);
  raising = clamp6(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  if (f.absoluteNuts) continueChance = 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION5,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing2(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.2.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment, contestableAfterCall: pricing.contestableAfterCall, excludedChips: pricing.excludedChips, estimatedRake: pricing.estimatedRake }
  };
}

// src/bots/v3/policy.ts
var LEGACY_POLICY_VERSION3 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION2 = POLICY_VERSION3;
var VERSION_TWO_POLICY_VERSION = POLICY_VERSION4;
var securePolicyRandom4 = securePolicyRandom;
function draw4(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision4(observation, profile, random = securePolicyRandom4) {
  if (profile.policyVersion === VERSION_TWO_POLICY_VERSION) return chooseDecision3(observation, profile, random);
  if (profile.policyVersion === LEGACY_POLICY_VERSION3) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION2) return chooseDecision2(observation, profile, random);
  const o = permittedObservation4(observation), p = completeProfile4(profile);
  validate4(o, p);
  const analysis = analyzeDecision4(o, p), d = analysis.distribution, n = draw4(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw4(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint4(o, p), action };
}

// src/bots/v4/profiles.ts
var POLICY_VERSION6 = "synthetic-cash-1.3.0";
var ARCHETYPES6 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS5 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp8 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid8 = (n) => 1 / (1 + Math.exp(-n));
var traits5 = (values) => Object.fromEntries(TRAIT_KEYS5.map((key, i) => [key, values[i]]));
var PRESETS5 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits5([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits5([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits5([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits5([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits5([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits5([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits5([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits5([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS5 = Object.freeze({ ...PRESETS5.tag.traits });
var POPULATION_WEIGHTS5 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit5(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile5(profile) {
  if (!ARCHETYPES6.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION6) throw new Error("Bot policy version mismatch.");
  unit5(profile.aggression, "aggression");
  unit5(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS5) t[key] = unit5(profile.traits?.[key], key) ?? PRESETS5[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS5, environment)) throw new Error("Unknown population environment.");
  return { archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit5(profile.skill, "skill") ?? PRESETS5[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v4/memory.ts
function publicActionEvents4(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v4/boundary.ts
var rate4 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory4(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate4(p.vpip), pfr: rate4(p.pfr), aggression: rate4(p.aggression), foldToBet: rate4(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation5(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents4(o.publicEvents) };
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    result2.rake = { basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory4(o.memory);
  return result2;
}
function validate5(o, p) {
  completeProfile5(p);
  if (o.policyVersion !== POLICY_VERSION6 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint5(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.2:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v4/pricing.ts
function contestablePricing2(o) {
  const callAmount = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || !Number.isSafeInteger(callAmount) || callAmount < 0) throw new Error("Invalid call exposure.");
  const contributions = o.seats.map((s) => ({ id: s.id, amount: s.totalCommitted + (s.id === own.id ? callAmount : 0) }));
  if (contributions.some((s) => !Number.isSafeInteger(s.amount) || s.amount < 0)) throw new Error("Invalid contribution exposure.");
  const ordered2 = [...contributions].sort((a, b) => b.amount - a.amount);
  const unmatched = ordered2.length > 1 ? Math.max(0, ordered2[0].amount - ordered2[1].amount) : 0;
  const adjusted = contributions.map((s) => ({ ...s, amount: s.amount - (s.id === ordered2[0]?.id ? unmatched : 0) }));
  const ownCap = adjusted.find((s) => s.id === own.id).amount;
  const totalAfterRefund = adjusted.reduce((n, s) => n + s.amount, 0);
  const contestableAfterCall = adjusted.reduce((n, s) => n + Math.min(s.amount, ownCap), 0);
  const excludedChips = contributions.reduce((n, s) => n + s.amount, 0) - contestableAfterCall;
  const afterCall = o.seats.filter((s) => !s.folded).map((s) => ({
    stack: s.stack - (s.id === own.id ? callAmount : 0),
    streetCommitted: s.streetCommitted + (s.id === own.id ? callAmount : 0)
  }));
  const ableToAct = afterCall.filter((s) => s.stack > 0);
  const knownRunout = o.street === "preflop" && afterCall.length >= 2 && (ableToAct.length === 0 || ableToAct.length === 1 && afterCall.every((s) => s.streetCommitted <= ableToAct[0].streetCommitted));
  const rakeApplies = o.rake && (!o.rake.noFlopNoDrop || o.board.length >= 3 || knownRunout);
  const estimatedRake = rakeApplies ? Math.min(o.rake.cap, Number(BigInt(totalAfterRefund) * BigInt(o.rake.basisPoints) / 10000n)) : 0;
  const price = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall);
  const rakeAdjustedPrice = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall - Math.min(contestableAfterCall, estimatedRake));
  return { callAmount, contestableAfterCall, excludedChips, price, rakeAdjustedPrice, estimatedRake };
}

// src/bots/v4/preflop.ts
var PREFLOP_MODEL_VERSION3 = "preflop-designed-1.2.0";
var RANKS3 = "23456789TJQKA";
var SUITS3 = "cdhs";
var CLASS_ROWS3 = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank9 = (card) => RANKS3.indexOf(card[0]) + 2;
var PREFLOP_CLASSES3 = Object.freeze(CLASS_ROWS3.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank9(handClass), lowRank = rank9(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp8((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp8((14 - highRank) / 7) * clamp8((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp8((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES3 = new Map(PREFLOP_CLASSES3.map((c) => [c.handClass, c]));
function getClass3(handClass) {
  const c = CLASSES3.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards3(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand3(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards3(cards);
  const [a, b] = [...cards].sort((x, y) => rank9(y) - rank9(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass3(handClass, deadCards = []) {
  const c = getClass3(handClass);
  checkCards3(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS3[c.highRank - 2] + SUITS3[a], RANKS3[c.lowRank - 2] + SUITS3[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos3(deadCards = []) {
  checkCards3(deadCards);
  return PREFLOP_CLASSES3.flatMap((c) => combosForClass3(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition3(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
function physicalPosition2(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b2) => a.id - b2.id), n = order.length, b = order.findIndex((s) => s.id === o.button), i = order.findIndex((s) => s.id === seatId), d = (i - b + n) % n;
  if (i < 0 || b < 0 || n < 2 || n > 10) throw new Error("Invalid seat position.");
  if (d === 0) return n === 2 ? "BTN/SB" : "BTN";
  if (n === 2 || d === 2) return "BB";
  if (d === 1) return "SB";
  const behind = n - d + 2;
  if (behind === 3) return "CO";
  if (behind === 4) return "HJ";
  if (behind === 5) return n === 6 ? "UTG/LJ" : "LJ";
  return d === 3 ? "UTG" : `UTG+${d - 3}`;
}
var DEPTH_ANCHORS3 = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket3(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp8(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS3[0], upper = lower;
  for (const point of DEPTH_ANCHORS3) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS3 = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES3 = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth3 = (n) => {
  const x = clamp8(n);
  return x * x * (3 - 2 * x);
};
function classWeight3(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES3[p.archetype], b = depthBracket3(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const playersBehind = m.playersBehind ?? (position === "UTG" ? m.seats - 1 : position === "MP" ? 4 : position === "CO" ? 3 : position === "BTN" ? m.seats === 2 ? 1 : 2 : position === "SB" ? 1 : 0);
  const openingIndex = playersBehind <= 1 ? position === "BTN" ? 3 : 4 : playersBehind === 2 ? 3 : playersBehind === 3 ? 2 : playersBehind === 4 ? 1 : 0;
  const rawCutoff = node === "unopened" ? base.cutoffs[openingIndex] + Math.max(0, playersBehind - 5) * 2.5 : base.cutoffs[POSITIONS3.indexOf(position)];
  const positional = base.cutoffs[1] + (rawCutoff - base.cutoffs[1]) * awareness;
  const openingInitiativeCredit = node === "unopened" ? (4 + 8 * p.skill) * (0.55 + 0.45 * t.positionAwareness) + Math.max(0, 5 - playersBehind) * 2 * t.positionAwareness * p.skill + (m.seats === 2 ? 8 * (0.5 + 0.5 * p.skill) : 0) : 0;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp8((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp8((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = node !== "unopened" && m.callBB > 0 ? Math.log2(clamp8(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = node === "unopened" ? 0 : Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = node === "unopened" ? 0 : Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - openingInitiativeCredit - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid8((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth3((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth3((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp8((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp8(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth3((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp8(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid8((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp8((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp8(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp8(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability, openingInitiativeCredit, playersBehind };
}
function context3(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId, pricing = contestablePricing2(o);
  const ordered2 = [...o.seats].sort((a, b) => a.id - b.id), actorIndex = ordered2.findIndex((s) => s.id === own.id), buttonIndex = ordered2.findIndex((s) => s.id === o.button), bbIndex = (buttonIndex + (ordered2.length === 2 ? 1 : 2)) % ordered2.length;
  let playersBehind = 0;
  for (let step = 1; step < ordered2.length; step++) {
    const index2 = (actorIndex + step) % ordered2.length, seat = ordered2[index2];
    if (!seat.folded && !seat.allIn) playersBehind++;
    if (index2 === bbIndex) break;
  }
  return { position: preflopPosition3(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: pricing.price, playersBehind, limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition3(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes3(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp8(Math.round(to), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp8((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop3(observation, profile) {
  const o = permittedObservation5(observation), p = completeProfile5(profile);
  validate5(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand3(o.ownCards), c = context3(o), w = classWeight3(getClass3(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket3(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION3, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes3(o, p, c, w), diagnostics: { baseScore: getClass3(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, openingInitiativeCredit: w.openingInitiativeCredit, playersBehind: w.playersBehind, physicalPosition: physicalPosition2(o), contestableAfterCall: contestablePricing2(o).contestableAfterCall, excludedChips: contestablePricing2(o).excludedChips, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES3.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/v4/features.ts
var rank10 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts4(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh4(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey4 = "";
var lastNutsResult4 = false;
function unbeatableRiver4(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey4) return lastNutsResult4;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey4 = key;
  lastNutsResult4 = unbeatable;
  return unbeatable;
}
function handFeatures5(ownCards, board) {
  const ownRanks = ownCards.map(rank10).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp8(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp8((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank10), boardRanks = board.map(rank10), groups = counts4(allRanks), boardGroups = counts4(boardRanks), suits = counts4(all.map((c) => c[1])), boardSuits = counts4(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp8((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank10);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank10(c) === r)).length;
    const privateQuality = clamp8(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank10(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank10(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank10(c) === r));
      nutDraw = ownInSuit.some((c) => rank10(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh4(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh4([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp8((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp8(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp8(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver4(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures3(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures5(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank10), newRank = rank10(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank10).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext4(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition3(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const outstandingWager = Math.max(0, ...opponents.map((s) => s.streetCommitted)) - own.streetCommitted;
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: contestablePricing2(o).price, betToPot: Math.max(0, outstandingWager) / Math.max(o.bigBlind, o.pot - Math.max(0, outstandingWager)), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v4/ranges.ts
var RANGE_MODEL_VERSION3 = "public-action-ranges-1.1.0";
var clamp9 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid9 = (x) => 1 / (1 + Math.exp(-x));
var DECK3 = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank11 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes3 = new Map(PREFLOP_CLASSES3.map((c) => [c.handClass, c]));
var combos3 = enumerateStartingCombos3().map((c) => ({ ...c, meta: classes3.get(c.handClass) }));
var shapeCache3 = /* @__PURE__ */ new Map();
var analysisCache3 = /* @__PURE__ */ new Map();
var MAX_CACHE3 = 8;
function putBounded3(cache, key, value, max = MAX_CACHE3) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape3(cards, board) {
  const hi = Math.max(...cards.map(rank11));
  if (!board.length) {
    const m = classes3.get(className3(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank11(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank11(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank11));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank11));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank11(c) === 14 && top2 === 5 ? 1 : rank11(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank11)), ownRanks = cards.map(rank11), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank11));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank11(c) === r)).length;
    const quality = clamp9(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank11(c) === r));
    if (cards.some((c) => c[1] === suit && rank11(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp9(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className3(cards) {
  const sorted = [...cards].sort((a2, b2) => rank11(b2) - rank11(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes3(board) {
  const key = board.join("");
  const hit = shapeCache3.get(key);
  if (hit) return hit;
  return putBounded3(shapeCache3, key, combos3.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape3(c.cards, board)), 4);
}
function observed3(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp9(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief3(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed3(known?.vpip, priors.vpip, adapt), r = observed3(known?.pfr, priors.pfr, adapt), a = observed3(known?.aggression, priors.aggression, adapt), f = observed3(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp9(v.value, 0.08, 0.82), pfr: clamp9(r.value, 0.03, 0.7), aggression: clamp9(a.value, 0.08, 0.85), fold: clamp9(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence3(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods3(o, seatId, b, e, comboIndex) {
  const m = combos3[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition3(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp9((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp9((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid9((score - threshold) * 12), premium = sigmoid9((score - 0.88) * 24);
    const aggressive = sigmoid9((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp9(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp9(enter * (1 - clamp9(aggressive * 0.65)) + 0.12 * m.speculative * clamp9((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp9(1 - enter, 0.015, 0.98), clamp9(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes3(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp9(observedPrice / 2), value = sigmoid9((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp9((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp9(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp9(sigmoid9((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp9(1 - sigmoid9((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp9(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer3(o, p, seatId, dead, events) {
  const b = belief3(o, p, seatId), indices = combos3.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods3(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos3[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes3(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos3[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp9((1 - sigmoid9((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp9(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed3(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream3(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative3(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick3(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity3(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream3(seed), cdfs = ranges.map(cumulative3);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick3(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK3.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical6(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  return { seedKey: JSON.stringify(publicKey), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze3(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges3(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical6(o, p), hit = analysisCache3.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence3(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer3(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer3(o, p, s.id, dead, events).range);
  const ownPublic = infer3(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity3(o, ranges, hashSeed3(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION3, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp9(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp9(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded3(analysisCache3, keys4.cacheKey, freeze3(result2));
}

// src/bots/v4/strategy.ts
function memoryAdjustment4(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp8(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp8(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing3(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp8(Math.round(to), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext3(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision6(observation, profile) {
  const o = permittedObservation5(observation), p = completeProfile5(profile);
  validate5(o, p);
  const t = p.traits, f = handFeatures5(o.ownCards, o.board), c = decisionContext4(o), memory8 = memoryAdjustment4(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop3(o, p);
    return {
      version: POLICY_VERSION6,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges3(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures3(o.ownCards, o.board), line = lineContext3(o, c);
  const futureClosed = terminal || call >= own.stack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
  const sampleSupport = clamp8(ranges.equitySamples / 48), samplePrecision = clamp8(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp8((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp8((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp8(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const realization = futureClosed ? 1 : clamp8(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureClosed ? 0 : streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = futureClosed || f.draw === 0 ? 0 : Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureClosed ? 0 : (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp8(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const pricing = contestablePricing2(o), rakeAdjustedPrice = pricing.rakeAdjustedPrice;
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp8(sigmoid8((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const secondCardRealization = futureClosed ? 1 : clamp8(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid8((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp8(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid8((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid8((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp8(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp8(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid8((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp8(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp8(continueChance + mistakeAdjustment, 5e-3, 0.998);
  raising = clamp8(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  let guaranteedChopCallEV = null;
  if (terminal && f.absoluteNuts && f.playsBoard && o.seats.length === 2 && c.activePlayers === 2 && call > 0 && !o.legal.canRaise) {
    const net = Math.max(0, pricing.contestableAfterCall - pricing.estimatedRake);
    const share = Math.floor(net / 2) + (net % 2 !== 0 && o.actingSeat !== o.button ? 1 : 0);
    guaranteedChopCallEV = share - call;
  }
  if (f.absoluteNuts) continueChance = guaranteedChopCallEV !== null && guaranteedChopCallEV < 0 ? 0 : 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION6,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing3(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.3.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment, contestableAfterCall: pricing.contestableAfterCall, excludedChips: pricing.excludedChips, estimatedRake: pricing.estimatedRake, guaranteedChopCallEV }
  };
}

// src/bots/v4/policy.ts
var LEGACY_POLICY_VERSION4 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION3 = POLICY_VERSION3;
var VERSION_THREE_POLICY_VERSION = POLICY_VERSION5;
var VERSION_TWO_POLICY_VERSION2 = POLICY_VERSION4;
var securePolicyRandom5 = securePolicyRandom;
function draw5(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision5(observation, profile, random = securePolicyRandom5) {
  if (profile.policyVersion === VERSION_THREE_POLICY_VERSION) return chooseDecision4(observation, profile, random);
  if (profile.policyVersion === VERSION_TWO_POLICY_VERSION2) return chooseDecision3(observation, profile, random);
  if (profile.policyVersion === LEGACY_POLICY_VERSION4) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION3) return chooseDecision2(observation, profile, random);
  const o = permittedObservation5(observation), p = completeProfile5(profile);
  validate5(o, p);
  const analysis = analyzeDecision6(o, p), d = analysis.distribution, n = draw5(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw5(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint5(o, p), action };
}

// src/bots/v5/draw-responses.ts
var DRAW_RESPONSE_POT_ANCHORS2 = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
var DRAW_RESPONSE_KINDS2 = Object.freeze(["gutshot", "oesd", "flush", "combo"]);
var DRAW_RESPONSE_STREETS2 = Object.freeze(["flop", "turn", "river"]);
function normalizeDrawResponses2(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid draw response curves.");
  const out = {};
  for (const key of Object.keys(input)) if (!DRAW_RESPONSE_KINDS2.includes(key)) throw new Error("Unknown draw response kind.");
  for (const kind of DRAW_RESPONSE_KINDS2) {
    const streets = input[kind];
    if (streets === void 0) continue;
    if (!streets || typeof streets !== "object" || Array.isArray(streets)) throw new Error("Invalid draw response streets.");
    out[kind] = {};
    for (const street of Object.keys(streets)) if (!DRAW_RESPONSE_STREETS2.includes(street)) throw new Error("Unknown draw response street.");
    for (const street of DRAW_RESPONSE_STREETS2) {
      const points = streets[street];
      if (points === void 0) continue;
      if (!Array.isArray(points) || points.length !== 7 || points.some((n) => !Number.isFinite(n) || n < -1 || n > 1)) throw new Error("Draw response needs seven values between -1 and 1.");
      out[kind][street] = [...points];
    }
  }
  return out;
}
function drawResponseKind2(drawClass) {
  if (drawClass === "combo") return "combo";
  if (drawClass === "nut-flush" || drawClass === "flush") return "flush";
  if (drawClass === "open-ended" || drawClass === "double-gutshot") return "oesd";
  return drawClass === "gutshot" ? "gutshot" : null;
}
function drawResponseOffset2(curves, kind, street, betToPot) {
  if (!curves || !kind || !DRAW_RESPONSE_STREETS2.includes(street)) return 0;
  const points = curves[kind]?.[street];
  if (!points) return 0;
  if (betToPot <= DRAW_RESPONSE_POT_ANCHORS2[0]) return points[0];
  for (let i = 1; i < 7; i++) if (betToPot <= DRAW_RESPONSE_POT_ANCHORS2[i]) {
    const t = (betToPot - DRAW_RESPONSE_POT_ANCHORS2[i - 1]) / (DRAW_RESPONSE_POT_ANCHORS2[i] - DRAW_RESPONSE_POT_ANCHORS2[i - 1]);
    return points[i - 1] + t * (points[i] - points[i - 1]);
  }
  return points[6];
}
function adjustDrawContinuation2(chance, offset) {
  if (offset === 0) return chance;
  const bounded = Math.max(1e-6, Math.min(0.999999, chance));
  return 1 / (1 + Math.exp(-(Math.log(bounded / (1 - bounded)) + 4 * offset)));
}

// src/bots/v5/profiles.ts
var POLICY_VERSION7 = "synthetic-cash-1.4.0";
var ARCHETYPES7 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS6 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp10 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid10 = (n) => 1 / (1 + Math.exp(-n));
var traits6 = (values) => Object.fromEntries(TRAIT_KEYS6.map((key, i) => [key, values[i]]));
var PRESETS6 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits6([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits6([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits6([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits6([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits6([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits6([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits6([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits6([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS6 = Object.freeze({ ...PRESETS6.tag.traits });
var POPULATION_WEIGHTS6 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit6(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile6(profile) {
  if (!ARCHETYPES7.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION7) throw new Error("Bot policy version mismatch.");
  unit6(profile.aggression, "aggression");
  unit6(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS6) t[key] = unit6(profile.traits?.[key], key) ?? PRESETS6[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS6, environment)) throw new Error("Unknown population environment.");
  return { ...profile.drawResponses ? { drawResponses: normalizeDrawResponses2(profile.drawResponses) } : {}, archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit6(profile.skill, "skill") ?? PRESETS6[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v5/memory.ts
function publicActionEvents5(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v5/boundary.ts
var rate5 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory5(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate5(p.vpip), pfr: rate5(p.pfr), aggression: rate5(p.aggression), foldToBet: rate5(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation6(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents5(o.publicEvents) };
  if (o.chipUnit !== void 0) {
    if (!Number.isSafeInteger(o.chipUnit) || o.chipUnit < 1) throw new Error("Invalid public chip unit.");
    result2.chipUnit = o.chipUnit;
  }
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    if (o.rake.rounding !== void 0 && !["floor", "half-even"].includes(o.rake.rounding)) throw new Error("Invalid public rake rounding.");
    result2.rake = { ...o.rake.rounding ? { rounding: o.rake.rounding } : {}, basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory5(o.memory);
  return result2;
}
function validate6(o, p) {
  completeProfile6(p);
  if (o.policyVersion !== POLICY_VERSION7 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint6(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.2:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v5/pricing.ts
function contestablePricing3(o) {
  const callAmount = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || !Number.isSafeInteger(callAmount) || callAmount < 0) throw new Error("Invalid call exposure.");
  const contributions = o.seats.map((s) => ({ id: s.id, amount: s.totalCommitted + (s.id === own.id ? callAmount : 0) }));
  if (contributions.some((s) => !Number.isSafeInteger(s.amount) || s.amount < 0)) throw new Error("Invalid contribution exposure.");
  const ordered2 = [...contributions].sort((a, b) => b.amount - a.amount);
  const unmatched = ordered2.length > 1 ? Math.max(0, ordered2[0].amount - ordered2[1].amount) : 0;
  const adjusted = contributions.map((s) => ({ ...s, amount: s.amount - (s.id === ordered2[0]?.id ? unmatched : 0) }));
  const ownCap = adjusted.find((s) => s.id === own.id).amount;
  const totalAfterRefund = adjusted.reduce((n, s) => n + s.amount, 0);
  const contestableAfterCall = adjusted.reduce((n, s) => n + Math.min(s.amount, ownCap), 0);
  const excludedChips = contributions.reduce((n, s) => n + s.amount, 0) - contestableAfterCall;
  const afterCall = o.seats.filter((s) => !s.folded).map((s) => ({
    stack: s.stack - (s.id === own.id ? callAmount : 0),
    streetCommitted: s.streetCommitted + (s.id === own.id ? callAmount : 0)
  }));
  const ableToAct = afterCall.filter((s) => s.stack > 0);
  const knownRunout = o.street === "preflop" && afterCall.length >= 2 && (ableToAct.length === 0 || ableToAct.length === 1 && afterCall.every((s) => s.streetCommitted <= ableToAct[0].streetCommitted));
  const rakeApplies = o.rake && (!o.rake.noFlopNoDrop || o.board.length >= 3 || knownRunout);
  const chipUnit = o.chipUnit ?? 1, denominator = 10000n * BigInt(chipUnit);
  const numerator = BigInt(totalAfterRefund) * BigInt(o.rake?.basisPoints ?? 0), whole = numerator / denominator, remainder = numerator % denominator;
  const roundedUnits = whole + (o.rake?.rounding === "half-even" && (2n * remainder > denominator || 2n * remainder === denominator && whole % 2n === 1n) ? 1n : 0n);
  const estimatedRake = rakeApplies ? Math.min(o.rake.cap, Number(roundedUnits) * chipUnit) : 0;
  const price = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall);
  const rakeAdjustedPrice = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall - Math.min(contestableAfterCall, estimatedRake));
  return { callAmount, contestableAfterCall, excludedChips, price, rakeAdjustedPrice, estimatedRake };
}

// src/bots/v5/preflop.ts
var PREFLOP_MODEL_VERSION4 = "preflop-designed-1.2.0";
var RANKS4 = "23456789TJQKA";
var SUITS4 = "cdhs";
var CLASS_ROWS4 = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank12 = (card) => RANKS4.indexOf(card[0]) + 2;
var PREFLOP_CLASSES4 = Object.freeze(CLASS_ROWS4.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank12(handClass), lowRank = rank12(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp10((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp10((14 - highRank) / 7) * clamp10((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp10((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES4 = new Map(PREFLOP_CLASSES4.map((c) => [c.handClass, c]));
function getClass4(handClass) {
  const c = CLASSES4.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards4(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand4(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards4(cards);
  const [a, b] = [...cards].sort((x, y) => rank12(y) - rank12(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass4(handClass, deadCards = []) {
  const c = getClass4(handClass);
  checkCards4(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS4[c.highRank - 2] + SUITS4[a], RANKS4[c.lowRank - 2] + SUITS4[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos4(deadCards = []) {
  checkCards4(deadCards);
  return PREFLOP_CLASSES4.flatMap((c) => combosForClass4(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition4(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
function physicalPosition3(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b2) => a.id - b2.id), n = order.length, b = order.findIndex((s) => s.id === o.button), i = order.findIndex((s) => s.id === seatId), d = (i - b + n) % n;
  if (i < 0 || b < 0 || n < 2 || n > 10) throw new Error("Invalid seat position.");
  if (d === 0) return n === 2 ? "BTN/SB" : "BTN";
  if (n === 2 || d === 2) return "BB";
  if (d === 1) return "SB";
  const behind = n - d + 2;
  if (behind === 3) return "CO";
  if (behind === 4) return "HJ";
  if (behind === 5) return n === 6 ? "UTG/LJ" : "LJ";
  return d === 3 ? "UTG" : `UTG+${d - 3}`;
}
var DEPTH_ANCHORS4 = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket4(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp10(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS4[0], upper = lower;
  for (const point of DEPTH_ANCHORS4) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS4 = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES4 = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth4 = (n) => {
  const x = clamp10(n);
  return x * x * (3 - 2 * x);
};
function classWeight4(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES4[p.archetype], b = depthBracket4(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const playersBehind = m.playersBehind ?? (position === "UTG" ? m.seats - 1 : position === "MP" ? 4 : position === "CO" ? 3 : position === "BTN" ? m.seats === 2 ? 1 : 2 : position === "SB" ? 1 : 0);
  const openingIndex = playersBehind <= 1 ? position === "BTN" ? 3 : 4 : playersBehind === 2 ? 3 : playersBehind === 3 ? 2 : playersBehind === 4 ? 1 : 0;
  const rawCutoff = node === "unopened" ? base.cutoffs[openingIndex] + Math.max(0, playersBehind - 5) * 2.5 : base.cutoffs[POSITIONS4.indexOf(position)];
  const positional = base.cutoffs[1] + (rawCutoff - base.cutoffs[1]) * awareness;
  const openingInitiativeCredit = node === "unopened" ? (4 + 8 * p.skill) * (0.55 + 0.45 * t.positionAwareness) + Math.max(0, 5 - playersBehind) * 2 * t.positionAwareness * p.skill + (m.seats === 2 ? 8 * (0.5 + 0.5 * p.skill) : 0) : 0;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp10((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp10((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = node !== "unopened" && m.callBB > 0 ? Math.log2(clamp10(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = node === "unopened" ? 0 : Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = node === "unopened" ? 0 : Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - openingInitiativeCredit - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid10((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth4((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth4((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp10((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp10(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth4((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp10(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid10((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp10((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp10(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp10(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability, openingInitiativeCredit, playersBehind };
}
function context4(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId, pricing = contestablePricing3(o);
  const ordered2 = [...o.seats].sort((a, b) => a.id - b.id), actorIndex = ordered2.findIndex((s) => s.id === own.id), buttonIndex = ordered2.findIndex((s) => s.id === o.button), bbIndex = (buttonIndex + (ordered2.length === 2 ? 1 : 2)) % ordered2.length;
  let playersBehind = 0;
  for (let step = 1; step < ordered2.length; step++) {
    const index2 = (actorIndex + step) % ordered2.length, seat = ordered2[index2];
    if (!seat.folded && !seat.allIn) playersBehind++;
    if (index2 === bbIndex) break;
  }
  return { position: preflopPosition4(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: pricing.price, playersBehind, limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition4(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes4(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp10(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp10((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop4(observation, profile) {
  const o = permittedObservation6(observation), p = completeProfile6(profile);
  validate6(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand4(o.ownCards), c = context4(o), w = classWeight4(getClass4(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket4(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION4, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes4(o, p, c, w), diagnostics: { baseScore: getClass4(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, openingInitiativeCredit: w.openingInitiativeCredit, playersBehind: w.playersBehind, physicalPosition: physicalPosition3(o), contestableAfterCall: contestablePricing3(o).contestableAfterCall, excludedChips: contestablePricing3(o).excludedChips, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES4.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/v5/features.ts
var rank13 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts5(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh5(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey5 = "";
var lastNutsResult5 = false;
function unbeatableRiver5(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey5) return lastNutsResult5;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey5 = key;
  lastNutsResult5 = unbeatable;
  return unbeatable;
}
function handFeatures6(ownCards, board) {
  const ownRanks = ownCards.map(rank13).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp10(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp10((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank13), boardRanks = board.map(rank13), groups = counts5(allRanks), boardGroups = counts5(boardRanks), suits = counts5(all.map((c) => c[1])), boardSuits = counts5(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp10((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank13);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank13(c) === r)).length;
    const privateQuality = clamp10(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank13(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank13(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank13(c) === r));
      nutDraw = ownInSuit.some((c) => rank13(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh5(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh5([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp10((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp10(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp10(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver5(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures4(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures6(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank13), newRank = rank13(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank13).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext5(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition4(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const outstandingWager = Math.max(0, ...opponents.map((s) => s.streetCommitted)) - own.streetCommitted;
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: contestablePricing3(o).price, betToPot: Math.max(0, outstandingWager) / Math.max(o.bigBlind, o.pot - Math.max(0, outstandingWager)), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v5/ranges.ts
var RANGE_MODEL_VERSION4 = "public-action-ranges-1.1.0";
var clamp11 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid11 = (x) => 1 / (1 + Math.exp(-x));
var DECK4 = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank14 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes4 = new Map(PREFLOP_CLASSES4.map((c) => [c.handClass, c]));
var combos4 = enumerateStartingCombos4().map((c) => ({ ...c, meta: classes4.get(c.handClass) }));
var shapeCache4 = /* @__PURE__ */ new Map();
var analysisCache4 = /* @__PURE__ */ new Map();
var MAX_CACHE4 = 8;
function putBounded4(cache, key, value, max = MAX_CACHE4) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape4(cards, board) {
  const hi = Math.max(...cards.map(rank14));
  if (!board.length) {
    const m = classes4.get(className4(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank14(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank14(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank14));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank14));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank14(c) === 14 && top2 === 5 ? 1 : rank14(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank14)), ownRanks = cards.map(rank14), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank14));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank14(c) === r)).length;
    const quality = clamp11(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank14(c) === r));
    if (cards.some((c) => c[1] === suit && rank14(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp11(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className4(cards) {
  const sorted = [...cards].sort((a2, b2) => rank14(b2) - rank14(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes4(board) {
  const key = board.join("");
  const hit = shapeCache4.get(key);
  if (hit) return hit;
  return putBounded4(shapeCache4, key, combos4.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape4(c.cards, board)), 4);
}
function observed4(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp11(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief4(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed4(known?.vpip, priors.vpip, adapt), r = observed4(known?.pfr, priors.pfr, adapt), a = observed4(known?.aggression, priors.aggression, adapt), f = observed4(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp11(v.value, 0.08, 0.82), pfr: clamp11(r.value, 0.03, 0.7), aggression: clamp11(a.value, 0.08, 0.85), fold: clamp11(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence4(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods4(o, seatId, b, e, comboIndex) {
  const m = combos4[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition4(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp11((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp11((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid11((score - threshold) * 12), premium = sigmoid11((score - 0.88) * 24);
    const aggressive = sigmoid11((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp11(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp11(enter * (1 - clamp11(aggressive * 0.65)) + 0.12 * m.speculative * clamp11((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp11(1 - enter, 0.015, 0.98), clamp11(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes4(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp11(observedPrice / 2), value = sigmoid11((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp11((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp11(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp11(sigmoid11((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp11(1 - sigmoid11((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp11(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer4(o, p, seatId, dead, events) {
  const b = belief4(o, p, seatId), indices = combos4.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods4(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos4[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes4(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos4[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp11((1 - sigmoid11((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp11(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed4(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream4(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative4(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick4(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity4(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream4(seed), cdfs = ranges.map(cumulative4);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick4(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK4.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical7(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  return { seedKey: JSON.stringify(publicKey), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze4(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges4(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical7(o, p), hit = analysisCache4.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence4(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer4(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer4(o, p, s.id, dead, events).range);
  const ownPublic = infer4(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity4(o, ranges, hashSeed4(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION4, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp11(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp11(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded4(analysisCache4, keys4.cacheKey, freeze4(result2));
}

// src/bots/v5/strategy.ts
function memoryAdjustment5(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp10(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp10(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing4(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp10(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext4(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision8(observation, profile) {
  const o = permittedObservation6(observation), p = completeProfile6(profile);
  validate6(o, p);
  const t = p.traits, f = handFeatures6(o.ownCards, o.board), c = decisionContext5(o), memory8 = memoryAdjustment5(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop4(o, p);
    return {
      version: POLICY_VERSION7,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges4(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures4(o.ownCards, o.board), line = lineContext4(o, c);
  const futureClosed = terminal || call >= own.stack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
  const sampleSupport = clamp10(ranges.equitySamples / 48), samplePrecision = clamp10(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp10((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp10((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp10(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const realization = futureClosed ? 1 : clamp10(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureClosed ? 0 : streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = futureClosed || f.draw === 0 ? 0 : Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureClosed ? 0 : (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp10(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const pricing = contestablePricing3(o), rakeAdjustedPrice = pricing.rakeAdjustedPrice;
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp10(sigmoid10((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const secondCardRealization = futureClosed ? 1 : clamp10(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid10((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp10(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid10((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid10((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp10(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp10(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid10((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp10(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp10(continueChance + mistakeAdjustment, 5e-3, 0.998);
  const drawWillingnessAdjustment = !terminal && f.draw > 0 && !f.made ? (t.drawCalling - 0.5) * 0.5 * (1 - f.strength) : 0;
  if (call > 0) continueChance = adjustDrawContinuation2(continueChance, drawWillingnessAdjustment);
  const responseKind = drawResponseKind2(terminal ? runout.missedDraw ? runout.previousDrawClass : "none" : f.drawClass);
  if (o.legal.callAmount > 0) continueChance = adjustDrawContinuation2(continueChance, drawResponseOffset2(p.drawResponses, responseKind, o.street, c.betToPot));
  raising = clamp10(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  let guaranteedChopCallEV = null;
  if (terminal && f.absoluteNuts && f.playsBoard && o.seats.length === 2 && c.activePlayers === 2 && call > 0 && !o.legal.canRaise) {
    const net = Math.max(0, pricing.contestableAfterCall - pricing.estimatedRake);
    const unit8 = o.chipUnit ?? 1, units = net / unit8;
    const share = (Math.floor(units / 2) + (units % 2 !== 0 && o.actingSeat !== o.button ? 1 : 0)) * unit8;
    guaranteedChopCallEV = share - call;
  }
  if (f.absoluteNuts) continueChance = guaranteedChopCallEV !== null && guaranteedChopCallEV < 0 ? 0 : 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION7,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing4(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.4.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment, drawWillingnessAdjustment, contestableAfterCall: pricing.contestableAfterCall, excludedChips: pricing.excludedChips, estimatedRake: pricing.estimatedRake, guaranteedChopCallEV }
  };
}

// src/bots/v5/policy.ts
var LEGACY_POLICY_VERSION5 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION4 = POLICY_VERSION3;
var VERSION_FOUR_POLICY_VERSION = POLICY_VERSION6;
var VERSION_THREE_POLICY_VERSION2 = POLICY_VERSION5;
var VERSION_TWO_POLICY_VERSION3 = POLICY_VERSION4;
var securePolicyRandom6 = securePolicyRandom;
function draw6(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision6(observation, profile, random = securePolicyRandom6) {
  if (profile.policyVersion === VERSION_FOUR_POLICY_VERSION) return chooseDecision5(observation, profile, random);
  if (profile.policyVersion === VERSION_THREE_POLICY_VERSION2) return chooseDecision4(observation, profile, random);
  if (profile.policyVersion === VERSION_TWO_POLICY_VERSION3) return chooseDecision3(observation, profile, random);
  if (profile.policyVersion === LEGACY_POLICY_VERSION5) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION4) return chooseDecision2(observation, profile, random);
  const o = permittedObservation6(observation), p = completeProfile6(profile);
  validate6(o, p);
  const analysis = analyzeDecision8(o, p), d = analysis.distribution, n = draw6(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw6(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint6(o, p), action };
}

// src/bots/v6/draw-responses.ts
var DRAW_RESPONSE_POT_ANCHORS3 = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
var DRAW_RESPONSE_KINDS3 = Object.freeze(["gutshot", "oesd", "flush", "combo"]);
var DRAW_RESPONSE_STREETS3 = Object.freeze(["flop", "turn", "river"]);
function normalizeDrawResponses3(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid draw response curves.");
  const out = {};
  for (const key of Object.keys(input)) if (!DRAW_RESPONSE_KINDS3.includes(key)) throw new Error("Unknown draw response kind.");
  for (const kind of DRAW_RESPONSE_KINDS3) {
    const streets = input[kind];
    if (streets === void 0) continue;
    if (!streets || typeof streets !== "object" || Array.isArray(streets)) throw new Error("Invalid draw response streets.");
    out[kind] = {};
    for (const street of Object.keys(streets)) if (!DRAW_RESPONSE_STREETS3.includes(street)) throw new Error("Unknown draw response street.");
    for (const street of DRAW_RESPONSE_STREETS3) {
      const points = streets[street];
      if (points === void 0) continue;
      if (!Array.isArray(points) || points.length !== 7 || points.some((n) => !Number.isFinite(n) || n < -1 || n > 1)) throw new Error("Draw response needs seven values between -1 and 1.");
      out[kind][street] = [...points];
    }
  }
  return out;
}
function drawResponseKind3(drawClass) {
  if (drawClass === "combo") return "combo";
  if (drawClass === "nut-flush" || drawClass === "flush") return "flush";
  if (drawClass === "open-ended" || drawClass === "double-gutshot") return "oesd";
  return drawClass === "gutshot" ? "gutshot" : null;
}
function drawResponseOffset3(curves, kind, street, betToPot) {
  if (!curves || !kind || !DRAW_RESPONSE_STREETS3.includes(street)) return 0;
  const points = curves[kind]?.[street];
  if (!points) return 0;
  if (betToPot <= DRAW_RESPONSE_POT_ANCHORS3[0]) return points[0];
  for (let i = 1; i < 7; i++) if (betToPot <= DRAW_RESPONSE_POT_ANCHORS3[i]) {
    const t = (betToPot - DRAW_RESPONSE_POT_ANCHORS3[i - 1]) / (DRAW_RESPONSE_POT_ANCHORS3[i] - DRAW_RESPONSE_POT_ANCHORS3[i - 1]);
    return points[i - 1] + t * (points[i] - points[i - 1]);
  }
  return points[6];
}
function adjustDrawContinuation3(chance, offset) {
  if (offset === 0) return chance;
  const bounded = Math.max(1e-6, Math.min(0.999999, chance));
  return 1 / (1 + Math.exp(-(Math.log(bounded / (1 - bounded)) + 4 * offset)));
}

// src/bots/v6/profiles.ts
var POLICY_VERSION8 = "synthetic-cash-1.5.0";
var ARCHETYPES8 = Object.freeze(["nit", "station", "tag", "lag", "fit-or-fold", "maniac", "passive-reg", "stronger-reg"]);
var TRAIT_KEYS7 = Object.freeze(["positionAwareness", "bluffFrequency", "valueThreshold", "drawCalling", "sizeSensitivity", "riskTolerance", "riverCuriosity", "slowPlay", "multiwayCaution", "adaptation", "memoryRetention", "mistakeRate", "sizingAggression"]);
var clamp12 = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
var sigmoid12 = (n) => 1 / (1 + Math.exp(-n));
var traits7 = (values) => Object.fromEntries(TRAIT_KEYS7.map((key, i) => [key, values[i]]));
var PRESETS7 = {
  nit: { aggression: 0.25, looseness: 0.13, skill: 0.52, traits: traits7([0.65, 0.12, 0.78, 0.25, 0.85, 0.24, 0.18, 0.3, 0.88, 0.35, 0.6, 0.12, 0.35]) },
  station: { aggression: 0.12, looseness: 0.9, skill: 0.23, traits: traits7([0.15, 0.08, 0.62, 0.93, 0.2, 0.72, 0.92, 0.15, 0.12, 0.12, 0.45, 0.48, 0.25]) },
  tag: { aggression: 0.62, looseness: 0.34, skill: 0.68, traits: traits7([0.8, 0.4, 0.59, 0.54, 0.68, 0.48, 0.42, 0.25, 0.68, 0.64, 0.72, 0.12, 0.55]) },
  lag: { aggression: 0.8, looseness: 0.68, skill: 0.65, traits: traits7([0.84, 0.73, 0.5, 0.66, 0.46, 0.7, 0.62, 0.2, 0.48, 0.6, 0.65, 0.2, 0.76]) },
  "fit-or-fold": { aggression: 0.3, looseness: 0.4, skill: 0.36, traits: traits7([0.42, 0.15, 0.7, 0.35, 0.78, 0.3, 0.18, 0.18, 0.7, 0.2, 0.4, 0.25, 0.35]) },
  maniac: { aggression: 0.95, looseness: 0.89, skill: 0.28, traits: traits7([0.23, 0.97, 0.32, 0.83, 0.14, 0.95, 0.85, 0.05, 0.12, 0.15, 0.35, 0.55, 0.94]) },
  // New-policy semantics: a designed loose/passive low-stakes recreational player.
  "passive-reg": { aggression: 0.25, looseness: 0.72, skill: 0.3, traits: traits7([0.28, 0.17, 0.65, 0.82, 0.32, 0.64, 0.75, 0.32, 0.3, 0.24, 0.55, 0.4, 0.32]) },
  "stronger-reg": { aggression: 0.67, looseness: 0.4, skill: 0.86, traits: traits7([0.94, 0.52, 0.58, 0.56, 0.76, 0.52, 0.48, 0.36, 0.84, 0.9, 0.9, 0.05, 0.64]) }
};
var DEFAULT_CUSTOM_TRAITS7 = Object.freeze({ ...PRESETS7.tag.traits });
var POPULATION_WEIGHTS7 = Object.freeze({
  low: Object.freeze([0.1, 0.23, 0.1, 0.06, 0.13, 0.09, 0.25, 0.04]),
  mid: Object.freeze([0.12, 0.12, 0.24, 0.16, 0.08, 0.06, 0.12, 0.1]),
  high: Object.freeze([0.08, 0.05, 0.26, 0.23, 0.03, 0.04, 0.07, 0.24]),
  neutral: Object.freeze(Array(8).fill(0.125))
});
function unit7(value, name) {
  if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}
function completeProfile7(profile) {
  if (!ARCHETYPES8.includes(profile.archetype) || profile.policyVersion !== POLICY_VERSION8) throw new Error("Bot policy version mismatch.");
  unit7(profile.aggression, "aggression");
  unit7(profile.looseness, "looseness");
  if (profile.aggression === void 0 || profile.looseness === void 0) throw new Error("Invalid bot profile.");
  const t = {};
  for (const key of TRAIT_KEYS7) t[key] = unit7(profile.traits?.[key], key) ?? PRESETS7[profile.archetype].traits[key];
  const environment = profile.environment ?? "neutral";
  if (!Object.hasOwn(POPULATION_WEIGHTS7, environment)) throw new Error("Unknown population environment.");
  return { ...profile.drawResponses ? { drawResponses: normalizeDrawResponses3(profile.drawResponses) } : {}, archetype: profile.archetype, policyVersion: profile.policyVersion, aggression: profile.aggression, looseness: profile.looseness, skill: unit7(profile.skill, "skill") ?? PRESETS7[profile.archetype].skill, environment, traits: t, ...profile.personalityId !== void 0 ? { personalityId: profile.personalityId } : {}, ...profile.unknown !== void 0 ? { unknown: profile.unknown } : {} };
}

// src/bots/v6/memory.ts
function publicActionEvents6(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/v6/boundary.ts
var rate6 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory6(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate6(p.vpip), pfr: rate6(p.pfr), aggression: rate6(p.aggression), foldToBet: rate6(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation7(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents6(o.publicEvents) };
  if (o.chipUnit !== void 0) {
    if (!Number.isSafeInteger(o.chipUnit) || o.chipUnit < 1) throw new Error("Invalid public chip unit.");
    result2.chipUnit = o.chipUnit;
  }
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    if (o.rake.rounding !== void 0 && !["floor", "half-even"].includes(o.rake.rounding)) throw new Error("Invalid public rake rounding.");
    result2.rake = { ...o.rake.rounding ? { rounding: o.rake.rounding } : {}, basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory6(o.memory);
  return result2;
}
function validate7(o, p) {
  completeProfile7(p);
  if (o.policyVersion !== POLICY_VERSION8 || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint7(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.2:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/v6/pricing.ts
function contestablePricing4(o) {
  const callAmount = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || !Number.isSafeInteger(callAmount) || callAmount < 0) throw new Error("Invalid call exposure.");
  const contributions = o.seats.map((s) => ({ id: s.id, amount: s.totalCommitted + (s.id === own.id ? callAmount : 0) }));
  if (contributions.some((s) => !Number.isSafeInteger(s.amount) || s.amount < 0)) throw new Error("Invalid contribution exposure.");
  const ordered2 = [...contributions].sort((a, b) => b.amount - a.amount);
  const unmatched = ordered2.length > 1 ? Math.max(0, ordered2[0].amount - ordered2[1].amount) : 0;
  const adjusted = contributions.map((s) => ({ ...s, amount: s.amount - (s.id === ordered2[0]?.id ? unmatched : 0) }));
  const ownCap = adjusted.find((s) => s.id === own.id).amount;
  const totalAfterRefund = adjusted.reduce((n, s) => n + s.amount, 0);
  const contestableAfterCall = adjusted.reduce((n, s) => n + Math.min(s.amount, ownCap), 0);
  const excludedChips = contributions.reduce((n, s) => n + s.amount, 0) - contestableAfterCall;
  const afterCall = o.seats.filter((s) => !s.folded).map((s) => ({
    stack: s.stack - (s.id === own.id ? callAmount : 0),
    streetCommitted: s.streetCommitted + (s.id === own.id ? callAmount : 0)
  }));
  const ableToAct = afterCall.filter((s) => s.stack > 0);
  const knownRunout = o.street === "preflop" && afterCall.length >= 2 && (ableToAct.length === 0 || ableToAct.length === 1 && afterCall.every((s) => s.streetCommitted <= ableToAct[0].streetCommitted));
  const rakeApplies = o.rake && (!o.rake.noFlopNoDrop || o.board.length >= 3 || knownRunout);
  const chipUnit = o.chipUnit ?? 1, denominator = 10000n * BigInt(chipUnit);
  const numerator = BigInt(totalAfterRefund) * BigInt(o.rake?.basisPoints ?? 0), whole = numerator / denominator, remainder = numerator % denominator;
  const roundedUnits = whole + (o.rake?.rounding === "half-even" && (2n * remainder > denominator || 2n * remainder === denominator && whole % 2n === 1n) ? 1n : 0n);
  const estimatedRake = rakeApplies ? Math.min(o.rake.cap, Number(roundedUnits) * chipUnit) : 0;
  const price = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall);
  const rakeAdjustedPrice = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall - Math.min(contestableAfterCall, estimatedRake));
  return { callAmount, contestableAfterCall, excludedChips, price, rakeAdjustedPrice, estimatedRake };
}

// src/bots/v6/preflop.ts
var PREFLOP_MODEL_VERSION5 = "preflop-designed-1.2.0";
var RANKS5 = "23456789TJQKA";
var SUITS5 = "cdhs";
var CLASS_ROWS5 = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank15 = (card) => RANKS5.indexOf(card[0]) + 2;
var PREFLOP_CLASSES5 = Object.freeze(CLASS_ROWS5.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank15(handClass), lowRank = rank15(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp12((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp12((14 - highRank) / 7) * clamp12((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp12((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES5 = new Map(PREFLOP_CLASSES5.map((c) => [c.handClass, c]));
function getClass5(handClass) {
  const c = CLASSES5.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards5(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand5(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards5(cards);
  const [a, b] = [...cards].sort((x, y) => rank15(y) - rank15(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass5(handClass, deadCards = []) {
  const c = getClass5(handClass);
  checkCards5(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS5[c.highRank - 2] + SUITS5[a], RANKS5[c.lowRank - 2] + SUITS5[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos5(deadCards = []) {
  checkCards5(deadCards);
  return PREFLOP_CLASSES5.flatMap((c) => combosForClass5(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition5(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
function physicalPosition4(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b2) => a.id - b2.id), n = order.length, b = order.findIndex((s) => s.id === o.button), i = order.findIndex((s) => s.id === seatId), d = (i - b + n) % n;
  if (i < 0 || b < 0 || n < 2 || n > 10) throw new Error("Invalid seat position.");
  if (d === 0) return n === 2 ? "BTN/SB" : "BTN";
  if (n === 2 || d === 2) return "BB";
  if (d === 1) return "SB";
  const behind = n - d + 2;
  if (behind === 3) return "CO";
  if (behind === 4) return "HJ";
  if (behind === 5) return n === 6 ? "UTG/LJ" : "LJ";
  return d === 3 ? "UTG" : `UTG+${d - 3}`;
}
var DEPTH_ANCHORS5 = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket5(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp12(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS5[0], upper = lower;
  for (const point of DEPTH_ANCHORS5) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS5 = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES5 = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth5 = (n) => {
  const x = clamp12(n);
  return x * x * (3 - 2 * x);
};
function classWeight5(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES5[p.archetype], b = depthBracket5(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const playersBehind = m.playersBehind ?? (position === "UTG" ? m.seats - 1 : position === "MP" ? 4 : position === "CO" ? 3 : position === "BTN" ? m.seats === 2 ? 1 : 2 : position === "SB" ? 1 : 0);
  const openingIndex = playersBehind <= 1 ? position === "BTN" ? 3 : 4 : playersBehind === 2 ? 3 : playersBehind === 3 ? 2 : playersBehind === 4 ? 1 : 0;
  const rawCutoff = node === "unopened" ? base.cutoffs[openingIndex] + Math.max(0, playersBehind - 5) * 2.5 : base.cutoffs[POSITIONS5.indexOf(position)];
  const positional = base.cutoffs[1] + (rawCutoff - base.cutoffs[1]) * awareness;
  const openingInitiativeCredit = node === "unopened" ? (4 + 8 * p.skill) * (0.55 + 0.45 * t.positionAwareness) + Math.max(0, 5 - playersBehind) * 2 * t.positionAwareness * p.skill + (m.seats === 2 ? 8 * (0.5 + 0.5 * p.skill) : 0) : 0;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp12((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp12((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = node !== "unopened" && m.callBB > 0 ? Math.log2(clamp12(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = node === "unopened" ? 0 : Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = node === "unopened" ? 0 : Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - openingInitiativeCredit - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid12((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth5((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth5((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp12((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp12(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth5((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp12(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid12((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp12((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp12(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp12(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability, openingInitiativeCredit, playersBehind };
}
function context5(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId, pricing = contestablePricing4(o);
  const ordered2 = [...o.seats].sort((a, b) => a.id - b.id), actorIndex = ordered2.findIndex((s) => s.id === own.id), buttonIndex = ordered2.findIndex((s) => s.id === o.button), bbIndex = (buttonIndex + (ordered2.length === 2 ? 1 : 2)) % ordered2.length;
  let playersBehind = 0;
  for (let step = 1; step < ordered2.length; step++) {
    const index2 = (actorIndex + step) % ordered2.length, seat = ordered2[index2];
    if (!seat.folded && !seat.allIn) playersBehind++;
    if (index2 === bbIndex) break;
  }
  return { position: preflopPosition5(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: pricing.price, playersBehind, limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition5(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes5(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp12(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp12((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop5(observation, profile) {
  const o = permittedObservation7(observation), p = completeProfile7(profile);
  validate7(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand5(o.ownCards), c = context5(o), w = classWeight5(getClass5(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket5(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION5, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes5(o, p, c, w), diagnostics: { baseScore: getClass5(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, openingInitiativeCredit: w.openingInitiativeCredit, playersBehind: w.playersBehind, physicalPosition: physicalPosition4(o), contestableAfterCall: contestablePricing4(o).contestableAfterCall, excludedChips: contestablePricing4(o).excludedChips, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES5.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/v6/features.ts
var rank16 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts6(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh6(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey6 = "";
var lastNutsResult6 = false;
function unbeatableRiver6(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey6) return lastNutsResult6;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey6 = key;
  lastNutsResult6 = unbeatable;
  return unbeatable;
}
function handFeatures7(ownCards, board) {
  const ownRanks = ownCards.map(rank16).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp12(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp12((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank16), boardRanks = board.map(rank16), groups = counts6(allRanks), boardGroups = counts6(boardRanks), suits = counts6(all.map((c) => c[1])), boardSuits = counts6(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp12((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank16);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank16(c) === r)).length;
    const privateQuality = clamp12(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank16(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank16(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank16(c) === r));
      nutDraw = ownInSuit.some((c) => rank16(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh6(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh6([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp12((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp12(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp12(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver6(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures5(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures7(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank16), newRank = rank16(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank16).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext6(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition5(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const outstandingWager = Math.max(0, ...opponents.map((s) => s.streetCommitted)) - own.streetCommitted;
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: contestablePricing4(o).price, betToPot: Math.max(0, outstandingWager) / Math.max(o.bigBlind, o.pot - Math.max(0, outstandingWager)), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/v6/ranges.ts
var RANGE_MODEL_VERSION5 = "public-action-ranges-1.1.0";
var clamp13 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid13 = (x) => 1 / (1 + Math.exp(-x));
var DECK5 = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank17 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes5 = new Map(PREFLOP_CLASSES5.map((c) => [c.handClass, c]));
var combos5 = enumerateStartingCombos5().map((c) => ({ ...c, meta: classes5.get(c.handClass) }));
var shapeCache5 = /* @__PURE__ */ new Map();
var analysisCache5 = /* @__PURE__ */ new Map();
var MAX_CACHE5 = 8;
function putBounded5(cache, key, value, max = MAX_CACHE5) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape5(cards, board) {
  const hi = Math.max(...cards.map(rank17));
  if (!board.length) {
    const m = classes5.get(className5(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank17(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank17(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank17));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank17));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank17(c) === 14 && top2 === 5 ? 1 : rank17(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank17)), ownRanks = cards.map(rank17), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank17));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank17(c) === r)).length;
    const quality = clamp13(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank17(c) === r));
    if (cards.some((c) => c[1] === suit && rank17(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp13(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className5(cards) {
  const sorted = [...cards].sort((a2, b2) => rank17(b2) - rank17(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes5(board) {
  const key = board.join("");
  const hit = shapeCache5.get(key);
  if (hit) return hit;
  return putBounded5(shapeCache5, key, combos5.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape5(c.cards, board)), 4);
}
function observed5(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp13(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief5(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed5(known?.vpip, priors.vpip, adapt), r = observed5(known?.pfr, priors.pfr, adapt), a = observed5(known?.aggression, priors.aggression, adapt), f = observed5(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp13(v.value, 0.08, 0.82), pfr: clamp13(r.value, 0.03, 0.7), aggression: clamp13(a.value, 0.08, 0.85), fold: clamp13(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence5(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods5(o, seatId, b, e, comboIndex) {
  const m = combos5[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition5(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp13((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp13((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid13((score - threshold) * 12), premium = sigmoid13((score - 0.88) * 24);
    const aggressive = sigmoid13((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp13(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp13(enter * (1 - clamp13(aggressive * 0.65)) + 0.12 * m.speculative * clamp13((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp13(1 - enter, 0.015, 0.98), clamp13(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes5(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp13(observedPrice / 2), value = sigmoid13((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp13((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp13(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp13(sigmoid13((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp13(1 - sigmoid13((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp13(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer5(o, p, seatId, dead, events) {
  const b = belief5(o, p, seatId), indices = combos5.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods5(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos5[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes5(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos5[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp13((1 - sigmoid13((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp13(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed5(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream5(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative5(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick5(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity5(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream5(seed), cdfs = ranges.map(cumulative5);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick5(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK5.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical8(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  const equityStream = { own: publicKey.own, board: publicKey.board, street: publicKey.street, actor: publicKey.actor, seats: ordered2.map((s) => ids.get(s.id)), line: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.action?.type]) };
  return { seedKey: JSON.stringify(equityStream), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze5(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges5(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical8(o, p), hit = analysisCache5.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence5(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer5(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer5(o, p, s.id, dead, events).range);
  const ownPublic = infer5(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity5(o, ranges, hashSeed5(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION5, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp13(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp13(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded5(analysisCache5, keys4.cacheKey, freeze5(result2));
}

// src/bots/v6/strategy.ts
function memoryAdjustment6(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp12(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp12(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing5(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp12(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext5(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision10(observation, profile) {
  const o = permittedObservation7(observation), p = completeProfile7(profile);
  validate7(o, p);
  const t = p.traits, f = handFeatures7(o.ownCards, o.board), c = decisionContext6(o), memory8 = memoryAdjustment6(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop5(o, p);
    return {
      version: POLICY_VERSION8,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges5(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures5(o.ownCards, o.board), line = lineContext5(o, c);
  const futureClosed = terminal || call >= own.stack || o.seats.filter((s) => !s.folded && s.id !== o.actingSeat).every((s) => s.allIn);
  const sampleSupport = clamp12(ranges.equitySamples / 48), samplePrecision = clamp12(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp12((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp12((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp12(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const realization = futureClosed ? 1 : clamp12(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureClosed ? 0 : streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = futureClosed || f.draw === 0 ? 0 : Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureClosed ? 0 : (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp12(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const pricing = contestablePricing4(o), rakeAdjustedPrice = pricing.rakeAdjustedPrice;
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp12(sigmoid12((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const secondCardRealization = futureClosed ? 1 : clamp12(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid12((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp12(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid12((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid12((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp12(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp12(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid12((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp12(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp12(continueChance + mistakeAdjustment, 5e-3, 0.998);
  const drawWillingnessAdjustment = !terminal && f.draw > 0 && !f.made ? (t.drawCalling - 0.5) * 0.5 * (1 - f.strength) : 0;
  if (call > 0) continueChance = adjustDrawContinuation3(continueChance, drawWillingnessAdjustment);
  const responseKind = drawResponseKind3(terminal ? runout.missedDraw ? runout.previousDrawClass : "none" : f.drawClass);
  if (o.legal.callAmount > 0) continueChance = adjustDrawContinuation3(continueChance, drawResponseOffset3(p.drawResponses, responseKind, o.street, c.betToPot));
  raising = clamp12(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  let guaranteedChopCallEV = null;
  if (terminal && f.absoluteNuts && f.playsBoard && o.seats.length === 2 && c.activePlayers === 2 && call > 0 && !o.legal.canRaise) {
    const net = Math.max(0, pricing.contestableAfterCall - pricing.estimatedRake);
    const unit8 = o.chipUnit ?? 1, units = net / unit8;
    const share = (Math.floor(units / 2) + (units % 2 !== 0 && o.actingSeat !== o.button ? 1 : 0)) * unit8;
    guaranteedChopCallEV = share - call;
  }
  if (f.absoluteNuts) continueChance = guaranteedChopCallEV !== null && guaranteedChopCallEV < 0 ? 0 : 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION8,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing5(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.5.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment, drawWillingnessAdjustment, contestableAfterCall: pricing.contestableAfterCall, excludedChips: pricing.excludedChips, estimatedRake: pricing.estimatedRake, guaranteedChopCallEV }
  };
}

// src/bots/v6/policy.ts
var LEGACY_POLICY_VERSION6 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION5 = POLICY_VERSION3;
var VERSION_FIVE_POLICY_VERSION = POLICY_VERSION7;
var VERSION_FOUR_POLICY_VERSION2 = POLICY_VERSION6;
var VERSION_THREE_POLICY_VERSION3 = POLICY_VERSION5;
var VERSION_TWO_POLICY_VERSION4 = POLICY_VERSION4;
var securePolicyRandom7 = securePolicyRandom;
function draw7(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision7(observation, profile, random = securePolicyRandom7) {
  if (profile.policyVersion === VERSION_FIVE_POLICY_VERSION) return chooseDecision6(observation, profile, random);
  if (profile.policyVersion === VERSION_FOUR_POLICY_VERSION2) return chooseDecision5(observation, profile, random);
  if (profile.policyVersion === VERSION_THREE_POLICY_VERSION3) return chooseDecision4(observation, profile, random);
  if (profile.policyVersion === VERSION_TWO_POLICY_VERSION4) return chooseDecision3(observation, profile, random);
  if (profile.policyVersion === LEGACY_POLICY_VERSION6) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION5) return chooseDecision2(observation, profile, random);
  const o = permittedObservation7(observation), p = completeProfile7(profile);
  validate7(o, p);
  const analysis = analyzeDecision10(o, p), d = analysis.distribution, n = draw7(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw7(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint7(o, p), action };
}

// src/bots/memory.ts
var rate7 = () => ({ count: 0, opportunities: 0 });
var make = (seatId) => ({ seatId, hands: 0, vpip: rate7(), pfr: rate7(), aggression: rate7(), foldToBet: rate7(), showdowns: [] });
function buildOpponentMemory7(hands, observingSeat, retention) {
  if (!Number.isFinite(retention) || retention < 0 || retention > 1) throw new Error("Memory retention must be between 0 and 1.");
  if (!Number.isInteger(observingSeat) || observingSeat < 0 || observingSeat > 9) throw new Error("Invalid observing seat.");
  const limit = Math.ceil(retention * 120);
  if (!limit) return { windowHands: 0, opponents: [] };
  const distinct = /* @__PURE__ */ new Map();
  for (const hand of hands) if (!distinct.has(hand.handId)) distinct.set(hand.handId, hand);
  const window2 = [...distinct.values()].slice(-limit), records = /* @__PURE__ */ new Map();
  for (const hand of window2) {
    const seats = new Set(hand.seats.map((s) => s.id));
    const folded = /* @__PURE__ */ new Set();
    const preActed = /* @__PURE__ */ new Set(), voluntary = /* @__PURE__ */ new Set(), raised = /* @__PURE__ */ new Set();
    const committed = /* @__PURE__ */ new Map();
    let wager = 0, currentStreet = "preflop";
    const seen = /* @__PURE__ */ new Set();
    for (const e of hand.events) {
      if (e.handId !== hand.handId || seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.type === "street") {
        currentStreet = e.street ?? currentStreet;
        committed.clear();
        wager = 0;
        continue;
      }
      if (e.seatId === void 0 || !seats.has(e.seatId)) continue;
      const id2 = e.seatId, amount = Number.isSafeInteger(e.amount) && e.amount >= 0 ? e.amount : 0;
      if (e.type === "blind") {
        committed.set(id2, (committed.get(id2) ?? 0) + amount);
        wager = Math.max(wager, committed.get(id2));
        continue;
      }
      if (e.type !== "action" || !e.action) continue;
      const street = e.street ?? currentStreet, facing = wager > (committed.get(id2) ?? 0);
      if (e.action.type === "fold") folded.add(id2);
      if (id2 !== observingSeat) {
        const r = records.get(id2) ?? make(id2);
        records.set(id2, r);
        if (street === "preflop") {
          preActed.add(id2);
          if (e.action.type === "raise" || e.action.type === "call" && amount > 0) voluntary.add(id2);
          if (e.action.type === "raise") raised.add(id2);
        } else {
          r.aggression.opportunities++;
          if (e.action.type === "raise") r.aggression.count++;
          if (facing) {
            r.foldToBet.opportunities++;
            if (e.action.type === "fold") r.foldToBet.count++;
          }
        }
      }
      if (e.action.type === "raise") {
        committed.set(id2, e.action.to);
        wager = Math.max(wager, e.action.to);
      } else if (e.action.type === "call") committed.set(id2, (committed.get(id2) ?? 0) + amount);
    }
    for (const seat of hand.seats) {
      if (seat.id === observingSeat) continue;
      const r = records.get(seat.id) ?? make(seat.id);
      records.set(seat.id, r);
      r.hands++;
      if (preActed.has(seat.id)) {
        r.vpip.opportunities++;
        r.pfr.opportunities++;
        if (voluntary.has(seat.id)) r.vpip.count++;
        if (raised.has(seat.id)) r.pfr.count++;
      }
      if (!folded.has(seat.id) && seat.revealedCards.length === 2 && seat.revealedCards.every((c) => /^[2-9TJQKA][cdhs]$/.test(c)) && new Set(seat.revealedCards).size === 2) r.showdowns = [...r.showdowns, [...seat.revealedCards]].slice(-8);
    }
  }
  return { windowHands: window2.length, opponents: [...records.values()].sort((a, b) => a.seatId - b.seatId) };
}
function publicActionEvents7(events) {
  return events.map((e) => ({ id: e.id, handId: e.handId, revision: e.revision, type: e.type, seatId: e.seatId, amount: e.amount, action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0, street: e.street, decisionId: e.decisionId }));
}

// src/bots/boundary.ts
var rate8 = (r) => {
  if (!r || !Number.isSafeInteger(r.count) || !Number.isSafeInteger(r.opportunities) || r.count < 0 || r.count > r.opportunities) throw new Error("Invalid public-memory rate.");
  return { count: r.count, opportunities: r.opportunities };
};
function memory7(m) {
  if (!Number.isSafeInteger(m.windowHands) || m.windowHands < 0 || m.windowHands > 120 || m.opponents.length > 9) throw new Error("Invalid public memory window.");
  return { windowHands: m.windowHands, opponents: m.opponents.map((p) => ({ seatId: p.seatId, hands: p.hands, vpip: rate8(p.vpip), pfr: rate8(p.pfr), aggression: rate8(p.aggression), foldToBet: rate8(p.foldToBet), showdowns: p.showdowns.slice(-8).map((cards) => {
    if (cards.length !== 2 || cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || cards[0] === cards[1]) throw new Error("Invalid public showdown.");
    return [...cards];
  }) })).sort((a, b) => a.seatId - b.seatId) };
}
function permittedObservation8(o, withContext = true) {
  const result2 = { handId: o.handId, revision: o.revision, actingSeat: o.actingSeat, decisionId: o.decisionId, policyVersion: o.policyVersion, ownCards: [...o.ownCards], board: [...o.board], street: o.street, button: o.button, pot: o.pot, bigBlind: o.bigBlind, seats: o.seats.map((s) => ({ id: s.id, stack: s.stack, streetCommitted: s.streetCommitted, totalCommitted: s.totalCommitted, folded: s.folded, allIn: s.allIn })), legal: { actor: o.legal.actor, fold: o.legal.fold, check: o.legal.check, callAmount: o.legal.callAmount, minRaiseTo: o.legal.minRaiseTo, maxRaiseTo: o.legal.maxRaiseTo, canRaise: o.legal.canRaise, shortAllInTo: o.legal.shortAllInTo, reopened: o.legal.reopened }, publicEvents: publicActionEvents7(o.publicEvents) };
  if (o.chipUnit !== void 0) {
    if (!Number.isSafeInteger(o.chipUnit) || o.chipUnit < 1) throw new Error("Invalid public chip unit.");
    result2.chipUnit = o.chipUnit;
  }
  if (withContext && o.rake) {
    if (!Number.isSafeInteger(o.rake.basisPoints) || o.rake.basisPoints < 0 || o.rake.basisPoints > 1e4 || !Number.isSafeInteger(o.rake.cap) || o.rake.cap < 0) throw new Error("Invalid public rake.");
    if (o.rake.rounding !== void 0 && !["floor", "half-even"].includes(o.rake.rounding)) throw new Error("Invalid public rake rounding.");
    result2.rake = { ...o.rake.rounding ? { rounding: o.rake.rounding } : {}, basisPoints: o.rake.basisPoints, cap: o.rake.cap, noFlopNoDrop: o.rake.noFlopNoDrop };
  }
  if (withContext && o.memory) result2.memory = memory7(o.memory);
  return result2;
}
function validate8(o, p) {
  completeProfile(p);
  if (o.policyVersion !== POLICY_VERSION || p.policyVersion !== o.policyVersion) throw new Error("Bot policy version mismatch.");
  if (!o.handId || !o.decisionId || !Number.isSafeInteger(o.revision) || o.revision < 0) throw new Error("Missing bot decision identity.");
  if (o.street === "complete" || o.legal.actor !== o.actingSeat) throw new Error("Bot does not own the current turn.");
  if (o.ownCards.length !== 2 || ![0, 3, 4, 5].includes(o.board.length)) throw new Error("Invalid visible card count.");
  const cards = [...o.ownCards, ...o.board];
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid visible cards.");
  const own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || own.folded || own.allIn || !Number.isSafeInteger(own.stack) || own.stack <= 0) throw new Error("Bot seat cannot act.");
  if (![o.pot, o.bigBlind, o.legal.callAmount, own.streetCommitted].every((n) => Number.isSafeInteger(n) && n >= 0) || o.bigBlind === 0) throw new Error("Invalid chip amount.");
  if (o.legal.callAmount > own.stack || o.legal.check !== (o.legal.callAmount === 0)) throw new Error("Inconsistent legal actions.");
  if (!o.legal.canRaise && (o.legal.minRaiseTo !== null || o.legal.maxRaiseTo !== null || o.legal.shortAllInTo !== null)) throw new Error("Raise bounds supplied when raising is closed.");
  if (o.legal.canRaise && !o.legal.reopened) throw new Error("Raising is not reopened.");
  if (o.legal.canRaise && (o.legal.minRaiseTo === null || o.legal.maxRaiseTo === null || !Number.isSafeInteger(o.legal.minRaiseTo) || !Number.isSafeInteger(o.legal.maxRaiseTo) || o.legal.minRaiseTo > o.legal.maxRaiseTo && o.legal.shortAllInTo !== o.legal.maxRaiseTo || o.legal.minRaiseTo <= own.streetCommitted + o.legal.callAmount || o.legal.maxRaiseTo > own.streetCommitted + own.stack)) throw new Error("Invalid legal raise bounds.");
  if (o.legal.shortAllInTo !== null && (!Number.isSafeInteger(o.legal.shortAllInTo) || o.legal.shortAllInTo !== own.streetCommitted + own.stack || o.legal.shortAllInTo <= own.streetCommitted + o.legal.callAmount)) throw new Error("Invalid short all-in bound.");
}
function fingerprint8(o, p) {
  const text = JSON.stringify({ observation: o, profile: p });
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `cash-v1.2:${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

// src/bots/pricing.ts
function contestablePricing5(o) {
  const callAmount = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  if (!own || !Number.isSafeInteger(callAmount) || callAmount < 0) throw new Error("Invalid call exposure.");
  const contributions = o.seats.map((s) => ({ id: s.id, amount: s.totalCommitted + (s.id === own.id ? callAmount : 0) }));
  if (contributions.some((s) => !Number.isSafeInteger(s.amount) || s.amount < 0)) throw new Error("Invalid contribution exposure.");
  const ordered2 = [...contributions].sort((a, b) => b.amount - a.amount);
  const unmatched = ordered2.length > 1 ? Math.max(0, ordered2[0].amount - ordered2[1].amount) : 0;
  const adjusted = contributions.map((s) => ({ ...s, amount: s.amount - (s.id === ordered2[0]?.id ? unmatched : 0) }));
  const ownCap = adjusted.find((s) => s.id === own.id).amount;
  const totalAfterRefund = adjusted.reduce((n, s) => n + s.amount, 0);
  const contestableAfterCall = adjusted.reduce((n, s) => n + Math.min(s.amount, ownCap), 0);
  const excludedChips = contributions.reduce((n, s) => n + s.amount, 0) - contestableAfterCall;
  const afterCall = o.seats.filter((s) => !s.folded).map((s) => ({
    stack: s.stack - (s.id === own.id ? callAmount : 0),
    streetCommitted: s.streetCommitted + (s.id === own.id ? callAmount : 0)
  }));
  const ableToAct = afterCall.filter((s) => s.stack > 0);
  const knownRunout = o.street === "preflop" && afterCall.length >= 2 && (ableToAct.length === 0 || ableToAct.length === 1 && afterCall.every((s) => s.streetCommitted <= ableToAct[0].streetCommitted));
  const rakeApplies = o.rake && (!o.rake.noFlopNoDrop || o.board.length >= 3 || knownRunout);
  const chipUnit = o.chipUnit ?? 1, denominator = 10000n * BigInt(chipUnit);
  const numerator = BigInt(totalAfterRefund) * BigInt(o.rake?.basisPoints ?? 0), whole = numerator / denominator, remainder = numerator % denominator;
  const roundedUnits = whole + (o.rake?.rounding === "half-even" && (2n * remainder > denominator || 2n * remainder === denominator && whole % 2n === 1n) ? 1n : 0n);
  const estimatedRake = rakeApplies ? Math.min(o.rake.cap, Number(roundedUnits) * chipUnit) : 0;
  const price = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall);
  const rakeAdjustedPrice = callAmount === 0 ? 0 : callAmount / Math.max(1, contestableAfterCall - Math.min(contestableAfterCall, estimatedRake));
  return { callAmount, contestableAfterCall, excludedChips, price, rakeAdjustedPrice, estimatedRake };
}

// src/bots/preflop.ts
var PREFLOP_MODEL_VERSION6 = "preflop-designed-1.2.0";
var RANKS6 = "23456789TJQKA";
var SUITS6 = "cdhs";
var CLASS_ROWS6 = [
  "AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28",
  "KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12",
  "QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6",
  "JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3",
  "TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2",
  "99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2",
  "88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2",
  "77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3",
  "66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6",
  "55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10",
  "44:51 43s:38 43o:16 42s:30 42o:8",
  "33:47 32s:27 32o:7",
  "22:43"
];
var rank18 = (card) => RANKS6.indexOf(card[0]) + 2;
var PREFLOP_CLASSES6 = Object.freeze(CLASS_ROWS6.flatMap((row) => row.split(" ")).map((entry) => {
  const [handClass, score] = entry.split(":"), highRank = rank18(handClass), lowRank = rank18(handClass.slice(1)), pair = highRank === lowRank, suited = handClass.endsWith("s"), gap = highRank - lowRank;
  const speculative = pair ? clamp((11 - highRank) / 7) : suited && highRank === 14 ? 0.55 : suited ? clamp((14 - highRank) / 7) * clamp((5 - gap) / 4) : 0;
  return Object.freeze({ handClass, comboCount: pair ? 6 : suited ? 4 : 12, highRank, lowRank, pair, suited, baseScore: Number(score), speculative, blocker: clamp((highRank === 14 ? 0.7 : highRank === 13 ? 0.3 : 0) + (lowRank === 13 ? 0.2 : 0)) });
}));
var CLASSES6 = new Map(PREFLOP_CLASSES6.map((c) => [c.handClass, c]));
function getClass6(handClass) {
  const c = CLASSES6.get(handClass);
  if (!c) throw new Error("Unknown starting-hand class.");
  return c;
}
function checkCards6(cards) {
  if (cards.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c)) || new Set(cards).size !== cards.length) throw new Error("Invalid or duplicated cards.");
}
function classifyStartingHand6(cards) {
  if (cards.length !== 2) throw new Error("A starting hand must contain two cards.");
  checkCards6(cards);
  const [a, b] = [...cards].sort((x, y) => rank18(y) - rank18(x));
  return a[0] + b[0] + (a[0] === b[0] ? "" : a[1] === b[1] ? "s" : "o");
}
function combosForClass6(handClass, deadCards = []) {
  const c = getClass6(handClass);
  checkCards6(deadCards);
  const dead = new Set(deadCards), result2 = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (c.pair && b <= a || !c.pair && (c.suited ? a !== b : a === b)) continue;
    const cards = [RANKS6[c.highRank - 2] + SUITS6[a], RANKS6[c.lowRank - 2] + SUITS6[b]];
    if (!cards.some((card) => dead.has(card))) result2.push(cards);
  }
  return result2;
}
function enumerateStartingCombos6(deadCards = []) {
  checkCards6(deadCards);
  return PREFLOP_CLASSES6.flatMap((c) => combosForClass6(c.handClass, deadCards).map((cards) => ({ cards, handClass: c.handClass })));
}
function preflopPosition6(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b) => a.id - b.id), n = order.length, button = order.findIndex((s) => s.id === o.button), index2 = order.findIndex((s) => s.id === seatId);
  if (n < 2 || n > 10 || button < 0 || index2 < 0) throw new Error("Invalid seat position.");
  const distance = (index2 - button + n) % n;
  if (distance === 0) return "BTN";
  if (n === 2) return "BB";
  if (distance === 1) return "SB";
  if (distance === 2) return "BB";
  if (distance === n - 1) return "CO";
  const earlyCount = Math.ceil((n - 4) / 2);
  return distance - 3 < earlyCount ? "UTG" : "MP";
}
function physicalPosition5(o, seatId = o.actingSeat) {
  const order = [...o.seats].sort((a, b2) => a.id - b2.id), n = order.length, b = order.findIndex((s) => s.id === o.button), i = order.findIndex((s) => s.id === seatId), d = (i - b + n) % n;
  if (i < 0 || b < 0 || n < 2 || n > 10) throw new Error("Invalid seat position.");
  if (d === 0) return n === 2 ? "BTN/SB" : "BTN";
  if (n === 2 || d === 2) return "BB";
  if (d === 1) return "SB";
  const behind = n - d + 2;
  if (behind === 3) return "CO";
  if (behind === 4) return "HJ";
  if (behind === 5) return n === 6 ? "UTG/LJ" : "LJ";
  return d === 3 ? "UTG" : `UTG+${d - 3}`;
}
var DEPTH_ANCHORS6 = [
  { bb: 20, smallPair: -11, suitedConnectors: -15, suitedAce: -5, offsuitBroadway: 2 },
  { bb: 40, smallPair: -7, suitedConnectors: -9, suitedAce: -2, offsuitBroadway: 1 },
  { bb: 60, smallPair: -3, suitedConnectors: -4, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 100, smallPair: 0, suitedConnectors: 0, suitedAce: 0, offsuitBroadway: 0 },
  { bb: 150, smallPair: 3, suitedConnectors: 5, suitedAce: 2, offsuitBroadway: -2 },
  { bb: 200, smallPair: 6, suitedConnectors: 9, suitedAce: 4, offsuitBroadway: -4 },
  { bb: 300, smallPair: 8, suitedConnectors: 12, suitedAce: 5, offsuitBroadway: -5 }
];
function depthBracket6(effectiveBB) {
  if (!Number.isFinite(effectiveBB) || effectiveBB < 0) throw new Error("Invalid effective stack.");
  const depth = clamp(effectiveBB, 20, 300);
  let lower = DEPTH_ANCHORS6[0], upper = lower;
  for (const point of DEPTH_ANCHORS6) {
    if (point.bb <= depth) lower = point;
    if (point.bb >= depth) {
      upper = point;
      break;
    }
  }
  const fraction = upper.bb === lower.bb ? 0 : (depth - lower.bb) / (upper.bb - lower.bb);
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return { lowerBB: lower.bb, upperBB: upper.bb, fraction, smallPair: blend("smallPair"), suitedConnectors: blend("suitedConnectors"), suitedAce: blend("suitedAce"), offsuitBroadway: blend("offsuitBroadway") };
}
var POSITIONS6 = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
var BASES6 = {
  nit: { looseness: 0.13, cutoffs: [80, 76, 70, 62, 72, 68] },
  station: { looseness: 0.9, cutoffs: [40, 37, 34, 28, 27, 24] },
  tag: { looseness: 0.34, cutoffs: [68, 64, 58, 49, 58, 50] },
  lag: { looseness: 0.68, cutoffs: [58, 54, 46, 36, 45, 38] },
  "fit-or-fold": { looseness: 0.4, cutoffs: [70, 66, 61, 55, 60, 53] },
  maniac: { looseness: 0.89, cutoffs: [40, 36, 29, 20, 25, 20] },
  "passive-reg": { looseness: 0.72, cutoffs: [47, 43, 38, 32, 31, 28] },
  "stronger-reg": { looseness: 0.4, cutoffs: [66, 62, 55, 46, 55, 47] }
};
var smooth6 = (n) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};
function classWeight6(c, p, position, node, effectiveBB, m) {
  const t = p.traits, base = BASES6[p.archetype], b = depthBracket6(effectiveBB), awareness = 0.4 + 0.6 * t.positionAwareness;
  const playersBehind = m.playersBehind ?? (position === "UTG" ? m.seats - 1 : position === "MP" ? 4 : position === "CO" ? 3 : position === "BTN" ? m.seats === 2 ? 1 : 2 : position === "SB" ? 1 : 0);
  const openingIndex = playersBehind <= 1 ? position === "BTN" ? 3 : 4 : playersBehind === 2 ? 3 : playersBehind === 3 ? 2 : playersBehind === 4 ? 1 : 0;
  const rawCutoff = node === "unopened" ? base.cutoffs[openingIndex] + Math.max(0, playersBehind - 5) * 2.5 : base.cutoffs[POSITIONS6.indexOf(position)];
  const positional = base.cutoffs[1] + (rawCutoff - base.cutoffs[1]) * awareness;
  const openingInitiativeCredit = node === "unopened" ? (4 + 8 * p.skill) * (0.55 + 0.45 * t.positionAwareness) + Math.max(0, 5 - playersBehind) * 2 * t.positionAwareness * p.skill + (m.seats === 2 ? 8 * (0.5 + 0.5 * p.skill) : 0) : 0;
  const depthEffect = c.pair && c.highRank <= 9 ? b.smallPair * clamp((11 - c.highRank) / 7) : c.suited && c.highRank === 14 ? b.suitedAce : c.suited && c.highRank - c.lowRank <= 3 ? b.suitedConnectors * clamp((5 - (c.highRank - c.lowRank)) / 4) : !c.suited && !c.pair && c.lowRank >= 10 ? b.offsuitBroadway : 0;
  const score = c.baseScore + depthEffect;
  const nodePressure = node === "facing-4bet" ? 31 : node === "facing-3bet" ? 20 : node === "facing-open" ? 8 : node === "limped" ? 1 : 0;
  const reference = node === "facing-4bet" ? 24 : node === "facing-3bet" ? 10 : node === "facing-open" ? 3 : 1;
  const pricePressure = node !== "unopened" && m.callBB > 0 ? Math.log2(clamp(m.callBB / reference, 0.25, 16)) * (3 + t.sizeSensitivity * 5) : 0;
  const oddsPressure = node === "unopened" ? 0 : Math.max(0, m.price - 0.25) * (6 + t.sizeSensitivity * 10);
  const openerPressure = m.openerPosition === "UTG" ? 3 * p.skill : m.openerPosition === "BTN" ? -3 * t.positionAwareness : 0;
  const multiway = (m.coldCallers + m.limpers * 0.35) * t.multiwayCaution * (c.speculative > 0.5 ? -0.7 : 1.6);
  const tablePressure = node === "unopened" ? 0 : Math.max(-4, m.seats - 6) * t.multiwayCaution * 0.7;
  const environment = p.environment === "low" ? -0.8 : p.environment === "high" ? 0.8 : 0;
  const cutoff = positional - openingInitiativeCredit - (p.looseness - base.looseness) * 24 + nodePressure + pricePressure + oddsPressure + openerPressure + multiway + tablePressure + environment + m.rakeFraction * 20;
  const width = 4.5 + t.mistakeRate * 2.5;
  let continuation = sigmoid((score - cutoff) / width);
  const firstIn = node === "unopened" || node === "limped";
  const coreValue = smooth6((c.baseScore - 74) / 20);
  let protection = firstIn ? coreValue : smooth6((c.baseScore - (node === "facing-open" ? 78 : node === "facing-3bet" ? 82 : 88)) / (node === "facing-open" ? 22 : node === "facing-3bet" ? 18 : 12));
  if (!firstIn) {
    protection += (1 - protection) * clamp((60 - effectiveBB) / 40) * coreValue * 0.35;
    protection -= Math.max(0, Math.log2(Math.max(1, m.callBB / reference))) * t.sizeSensitivity * 0.15 * protection * (1 - protection);
  }
  continuation = Math.max(continuation, clamp(protection));
  const valueThreshold = node === "facing-4bet" ? 91 : node === "facing-3bet" ? 87 : node === "facing-open" ? 80 : 74;
  const valueSpan = node === "facing-4bet" ? 9 : node === "facing-3bet" ? 12 : node === "facing-open" ? 18 : 20;
  const premiumValue = smooth6((c.baseScore - valueThreshold) / valueSpan);
  const trapProbability = clamp(t.slowPlay * (1 - p.aggression) * (0.08 + 0.32 * (1 - p.skill)) * (node === "facing-3bet" ? 1.4 : node === "facing-4bet" ? 1.25 : 1), 0, 0.3);
  const openingPreference = sigmoid((p.aggression + p.skill * 0.65 - 0.55) * 8);
  let ordinaryRaise = firstIn ? openingPreference : 0.06 + p.aggression * 0.32;
  if (node === "limped") ordinaryRaise *= 0.65 + Math.min(0.25, m.limpers * 0.07) + p.aggression * 0.15;
  if (m.squeeze) ordinaryRaise += t.bluffFrequency * p.aggression * 0.16 * c.blocker;
  if (!firstIn) ordinaryRaise += Number(c.suited) * c.blocker * t.bluffFrequency * p.aggression * 0.12;
  let raiseConditional = ordinaryRaise * (1 - premiumValue) + (1 - trapProbability) * premiumValue;
  const shortCommit = clamp((55 - effectiveBB) / 35) * premiumValue * t.riskTolerance;
  if (!firstIn) raiseConditional += shortCommit * 0.16;
  raiseConditional = clamp(raiseConditional, 0, 1);
  const mistakes = t.mistakeRate * (1 - p.skill * 0.8) * 0.025 * (1 - coreValue);
  continuation = clamp(continuation * (1 - mistakes) + p.looseness * 0.35 * mistakes);
  return { handClass: c.handClass, comboCount: c.comboCount, continueWeight: continuation, raiseWeight: continuation * raiseConditional, callWeight: continuation * (1 - raiseConditional), score, cutoff, premiumValue, trapProbability, openingInitiativeCredit, playersBehind };
}
function context6(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), opponents = o.seats.filter((s) => s.id !== own.id && !s.folded);
  const effectiveStackBB = Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) / o.bigBlind;
  const actions = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = actions.filter((e) => e.action?.type === "raise");
  const firstRaise = actions.findIndex((e) => e.action?.type === "raise"), lastRaise = actions.map((e) => e.action?.type).lastIndexOf("raise");
  const limpers = new Set(actions.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const coldCallers = lastRaise < 0 ? 0 : new Set(actions.slice(lastRaise + 1).filter((e) => e.action?.type === "call" && e.seatId !== own.id).map((e) => e.seatId)).size;
  const node = raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened";
  const opener = raises[0]?.seatId, pricing = contestablePricing5(o);
  const ordered2 = [...o.seats].sort((a, b) => a.id - b.id), actorIndex = ordered2.findIndex((s) => s.id === own.id), buttonIndex = ordered2.findIndex((s) => s.id === o.button), bbIndex = (buttonIndex + (ordered2.length === 2 ? 1 : 2)) % ordered2.length;
  let playersBehind = 0;
  for (let step = 1; step < ordered2.length; step++) {
    const index2 = (actorIndex + step) % ordered2.length, seat = ordered2[index2];
    if (!seat.folded && !seat.allIn) playersBehind++;
    if (index2 === bbIndex) break;
  }
  return { position: preflopPosition6(o), node, effectiveStackBB, modifiers: { seats: o.seats.length, callBB: o.legal.callAmount / o.bigBlind, price: pricing.price, playersBehind, limpers, coldCallers, squeeze: raises.length === 1 && coldCallers > 0, openerPosition: opener === void 0 ? null : preflopPosition6(o, opener), rakeFraction: (o.rake?.cap ?? 0) > 0 ? (o.rake?.basisPoints ?? 0) / 1e4 : 0 } };
}
function sizes6(o, p, c, weight) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const result2 = [], own = o.seats.find((s) => s.id === o.actingSeat), facing = own.streetCommitted + o.legal.callAmount;
  const add = (label, to, w) => {
    const raiseTo = clamp(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), o.legal.minRaiseTo, o.legal.maxRaiseTo), existing = result2.find((s) => s.raiseTo === raiseTo);
    if (existing) existing.weight += w;
    else result2.push({ label: raiseTo === o.legal.maxRaiseTo ? "All-in" : label, raiseTo, weight: w });
  };
  const deep = Math.max(0, Math.min(200, c.effectiveStackBB) - 100) / 100, short = Math.max(0, 40 - c.effectiveStackBB) / 20;
  if (c.node === "unopened" || c.node === "limped") {
    const open = 2.25 + p.traits.sizingAggression * 0.65 + deep * 0.2 - short * 0.2 + (c.position === "SB" ? 0.3 : 0) + (p.environment === "low" ? 0.25 : 0);
    const isolation = c.modifiers.limpers * (0.8 + p.traits.sizingAggression * 0.45);
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.55, 0.25]]) add(c.modifiers.limpers ? "Isolation raise" : "Open raise", (open + isolation + offset) * o.bigBlind, w);
  } else {
    const outOfPosition = c.position === "SB" || c.position === "BB";
    const multiple = c.node === "facing-open" ? outOfPosition ? 3.5 : 3 : 2.25;
    const callers = c.modifiers.coldCallers * facing * 0.7;
    for (const [offset, w] of [[-0.25, 0.25], [0, 0.5], [0.5, 0.25]]) add(c.modifiers.squeeze ? "Squeeze" : c.node === "facing-open" ? "3-bet" : "4-bet+", facing * (multiple + offset + deep * 0.15) + callers, w);
  }
  if (c.node !== "unopened" && c.effectiveStackBB <= 40 && weight.premiumValue > 0.5) add("All-in", o.legal.maxRaiseTo, clamp((45 - c.effectiveStackBB) / 30) * (0.4 + weight.premiumValue));
  const total = result2.reduce((sum, s) => sum + s.weight, 0);
  return result2.map((s) => ({ ...s, weight: s.weight / total }));
}
function analyzePreflop6(observation, profile) {
  const o = permittedObservation8(observation), p = completeProfile(profile);
  validate8(o, p);
  if (o.street !== "preflop" || o.board.length) throw new Error("Preflop analysis requires a preflop observation.");
  const handClass = classifyStartingHand6(o.ownCards), c = context6(o), w = classWeight6(getClass6(handClass), p, c.position, c.node, c.effectiveStackBB, c.modifiers);
  let raise = o.legal.canRaise ? w.raiseWeight : 0;
  let call = o.legal.canRaise ? w.callWeight : w.continueWeight;
  let fold = 1 - w.continueWeight, check = 0;
  if (o.legal.check) {
    fold = 0;
    call = 0;
    check = 1 - raise;
  } else if (!o.legal.fold) {
    call += fold;
    fold = 0;
  }
  if (!o.legal.canRaise) raise = 0;
  const b = depthBracket6(c.effectiveStackBB);
  return { modelVersion: PREFLOP_MODEL_VERSION6, handClass, comboCount: w.comboCount, position: c.position, node: c.node, effectiveStackBB: c.effectiveStackBB, distribution: { fold, check, call, raise }, sizing: sizes6(o, p, c, w), diagnostics: { baseScore: getClass6(handClass).baseScore, adjustedScore: w.score, rangeCutoff: w.cutoff, continueWeight: w.continueWeight, premiumValue: w.premiumValue, trapProbability: w.trapProbability, openingInitiativeCredit: w.openingInitiativeCredit, playersBehind: w.playersBehind, physicalPosition: physicalPosition5(o), contestableAfterCall: contestablePricing5(o).contestableAfterCall, excludedChips: contestablePricing5(o).excludedChips, lowerDepthBB: b.lowerBB, upperDepthBB: b.upperBB, depthFraction: b.fraction, limpers: c.modifiers.limpers, coldCallers: c.modifiers.coldCallers, squeeze: Number(c.modifiers.squeeze), callBB: c.modifiers.callBB, callPrice: c.modifiers.price, openerPosition: c.modifiers.openerPosition ?? "none", classCount: PREFLOP_CLASSES6.length, totalCombinations: 1326, evidence: "DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED" } };
}

// src/bots/features.ts
var rank19 = (card) => "23456789TJQKA".indexOf(card[0]) + 2;
function counts7(values) {
  const result2 = /* @__PURE__ */ new Map();
  for (const v of values) result2.set(v, (result2.get(v) ?? 0) + 1);
  return result2;
}
function straightHigh7(values) {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let high = 14; high >= 5; high--) if (Array.from({ length: 5 }, (_, i) => high - i).every((x) => s.has(x))) return high;
  return 0;
}
var lastNutsKey7 = "";
var lastNutsResult7 = false;
function unbeatableRiver7(own, board, best) {
  const key = [...own].sort().join("") + "|" + [...board].sort().join("");
  if (key === lastNutsKey7) return lastNutsResult7;
  const seen = /* @__PURE__ */ new Set([...own, ...board]);
  const unseen = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s)).filter((c) => !seen.has(c));
  let unbeatable = true;
  outer: for (let i = 0; i < unseen.length - 1; i++) for (let j = i + 1; j < unseen.length; j++) if (compareRanks(evaluate([...board, unseen[i], unseen[j]]), best) > 0) {
    unbeatable = false;
    break outer;
  }
  lastNutsKey7 = key;
  lastNutsResult7 = unbeatable;
  return unbeatable;
}
function handFeatures8(ownCards, board) {
  const ownRanks = ownCards.map(rank19).sort((a, b) => b - a), [hi, lo] = ownRanks, suited = ownCards[0][1] === ownCards[1][1], connected = hi - lo === 1;
  if (!board.length) {
    const pair = hi === lo;
    return { strength: pair ? 0.52 + (hi - 2) / 12 * 0.46 : clamp(0.1 + (hi - 2) / 12 * 0.4 + (lo - 2) / 12 * 0.28 + (suited ? 0.06 : 0) + (connected ? 0.045 : 0) - Math.max(0, hi - lo - 3) * 0.02), draw: 0, made: pair, handClass: pair ? "pocket-pair" : hi >= 11 && lo >= 10 ? "broadway" : suited && connected ? "suited-connector" : suited ? "suited" : "unpaired", drawClass: "none", wetness: 0, vulnerability: 0, playsBoard: false, nutDraw: false, overcards: 0, suited, connected, pairRank: pair ? hi : 0, blockerStrength: clamp((ownRanks.includes(14) ? 0.65 : 0) + (ownRanks.includes(13) ? 0.3 : 0)), absoluteNuts: false, cleanOuts: 0, pairedBoard: false };
  }
  const all = [...ownCards, ...board], allRanks = all.map(rank19), boardRanks = board.map(rank19), groups = counts7(allRanks), boardGroups = counts7(boardRanks), suits = counts7(all.map((c) => c[1])), boardSuits = counts7(board.map((c) => c[1]));
  const best = evaluate(all), category = best[0], boardTop = Math.max(...boardRanks), playsBoard = board.length === 5 && compareRanks(best, evaluate(board)) === 0;
  const overcards = ownRanks.filter((r) => r > boardTop).length;
  const maxBoardSuit = Math.max(...boardSuits.values());
  const ordered2 = [...new Set(boardRanks)].sort((a, b) => a - b);
  let connection = 0;
  for (let i = 0; i < ordered2.length; i++) connection = Math.max(connection, ordered2.filter((v) => v >= ordered2[i] && v <= ordered2[i] + 4).length);
  const wetness = clamp((maxBoardSuit >= 3 ? 0.5 : maxBoardSuit === 2 ? 0.22 : 0) + Math.max(0, connection - 1) * 0.17 + (boardGroups.size < board.length ? 0.12 : 0));
  let handClass = ["high-card", "pair", "two-pair", "trips", "straight", "flush", "full-house", "quads", "straight-flush"][category];
  let strength = [0.15 + hi / 14 * 0.13, 0.45, 0.73, 0.81, 0.86, 0.91, 0.96, 0.985, 0.998][category];
  const pairRank = category === 1 ? best[1] : 0;
  if (category === 1) {
    const ownPair = ownRanks.includes(pairRank);
    if (hi === lo && hi > boardTop) {
      handClass = "overpair";
      strength = 0.67;
    } else if (ownPair && pairRank === boardTop) {
      handClass = "top-pair";
      strength = 0.58 + Math.min(hi === pairRank ? lo : hi, 14) / 14 * 0.055;
    } else if (ownPair) {
      handClass = hi === lo ? "underpair" : "middle-pair";
      strength = 0.36 + pairRank / 14 * 0.12;
    } else {
      handClass = "board-pair";
      strength = 0.16 + hi / 14 * 0.16 + overcards * 0.035;
    }
  }
  if (category === 2 && [best[1], best[2]].every((r) => (boardGroups.get(r) ?? 0) >= 2)) {
    handClass = "board-two-pair";
    strength = 0.28 + hi / 14 * 0.14;
  }
  if (category === 3 && !ownRanks.includes(best[1])) {
    handClass = "board-trips";
    strength = 0.3 + hi / 14 * 0.2;
  }
  if (category === 3 && hi === lo && groups.get(hi) === 3) {
    handClass = "set";
    strength = 0.84;
  }
  if (category === 5) {
    const flushSuit = [...suits.entries()].find(([, n]) => n >= 5)[0];
    const ownFlush = ownCards.filter((c) => c[1] === flushSuit).map(rank19);
    const privateHigh = Math.max(0, ...ownFlush);
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank19(c) === r)).length;
    const privateQuality = clamp(1 - higherUnknown / 9);
    strength = (boardSuits.get(flushSuit) ?? 0) >= 4 ? 0.46 + privateQuality * 0.46 : 0.64 + privateQuality * 0.28;
  }
  if (category === 6) {
    if ((boardGroups.get(best[1]) ?? 0) >= 3) strength = 0.53 + best[2] / 14 * 0.32;
    if ([...boardGroups.entries()].some(([r, n]) => typeof r === "number" && r > best[1] && n >= 2)) strength -= 0.12;
  }
  if (category === 7 && (boardGroups.get(best[1]) ?? 0) === 4) {
    handClass = "board-quads";
    strength = 0.25 + hi / 14 * 0.4;
  }
  if (playsBoard) {
    handClass = `board-${handClass}`;
    strength = 0.34 + hi / 14 * 0.1;
  }
  let flushDraw = false, nutDraw = false, backdoor = false, blockerStrength = 0;
  for (const [suit, count] of boardSuits) {
    if (count >= 2) {
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank19(c) === r));
      if (ownCards.some((c) => c[1] === suit && rank19(c) === highestUnboarded)) blockerStrength = count >= 3 ? 0.85 : 0.45;
    }
  }
  if (boardRanks.filter((r) => r >= 10).length >= 2) blockerStrength = Math.max(blockerStrength, ownRanks.includes(14) ? 0.4 : ownRanks.includes(13) ? 0.2 : 0);
  for (const [suit, n] of suits) {
    const ownInSuit = ownCards.filter((c) => c[1] === suit);
    if (n === 4 && ownInSuit.length) {
      flushDraw = true;
      const highestUnboarded = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank19(c) === r));
      nutDraw = ownInSuit.some((c) => rank19(c) === highestUnboarded);
    }
    if (n === 3 && board.length === 3 && ownInSuit.length === 2) backdoor = true;
  }
  const completing = [];
  if (!straightHigh7(allRanks)) {
    for (let r = 2; r <= 14; r++) if (!allRanks.includes(r)) {
      const h = straightHigh7([...allRanks, r]);
      if (h && ownRanks.some((v) => !boardRanks.includes(v) && (v <= h && v >= h - 4 || v === 14 && h === 5))) completing.push(r);
    }
  }
  const outs = completing.length;
  const straightDraw = outs >= 2 ? completing.at(-1) - completing[0] === 5 ? "open-ended" : "double-gutshot" : outs === 1 ? "gutshot" : "none";
  const live = board.length < 5, combo = flushDraw && outs > 0;
  const drawClass = !live ? "none" : combo ? "combo" : flushDraw ? nutDraw ? "nut-flush" : "flush" : straightDraw !== "none" ? straightDraw : backdoor ? "backdoor" : "none";
  const pairedBoard = boardGroups.size < board.length;
  const flushOuts = flushDraw ? 9 : 0, straightOuts = outs * 4;
  const rawOuts = combo ? Math.min(15, flushOuts + straightOuts - 2) : Math.max(flushOuts, straightOuts);
  const cleanOuts = live ? Math.max(0, rawOuts * (flushDraw ? nutDraw ? 0.97 : 0.76 : 0.85) * (pairedBoard ? 0.76 : 1) + overcards * (pairedBoard ? 0.5 : 1.3)) : 0;
  const draw9 = live ? clamp((flushDraw ? 0.32 : 0) + (outs >= 2 ? 0.28 : outs === 1 ? 0.14 : 0) + (backdoor ? 0.05 : 0), 0, 0.58) : 0;
  const vulnerability = category <= 3 ? clamp(wetness * (category === 1 ? 0.8 : category === 2 ? 0.55 : 0.3) + (category === 1 ? (14 - pairRank) / 14 * 0.15 : 0)) : category === 4 && maxBoardSuit >= 3 ? 0.35 : 0;
  strength = clamp(strength - vulnerability * 0.09);
  const absoluteNuts = category === 8 && best[1] === 14 || board.length === 5 && category >= 3 && unbeatableRiver7(ownCards, board, best);
  return { strength, draw: draw9, made: category > 0 && !handClass.startsWith("board-"), handClass, drawClass, wetness, vulnerability, playsBoard, nutDraw, overcards, suited, connected, pairRank, blockerStrength, absoluteNuts, cleanOuts, pairedBoard };
}
function runoutFeatures6(own, board) {
  if (board.length < 4) return { previousDrawClass: "none", missedDraw: false, drawCompleted: false, flushCompletion: false, straightCompletion: false, pairingCard: false, overcardArrival: false };
  const before = board.slice(0, -1), previous = handFeatures8(own, before), newCard = board.at(-1);
  const priorFlush = previous.drawClass.includes("flush") || previous.drawClass === "combo";
  const priorStraight = ["gutshot", "open-ended", "double-gutshot", "combo"].includes(previous.drawClass);
  const currentCategory = evaluate([...own, ...board])[0];
  const flushCompleted = priorFlush && currentCategory === 5;
  const straightCompleted = priorStraight && currentCategory === 4;
  const drawCompleted = flushCompleted || straightCompleted || previous.draw > 0 && currentCategory >= 6;
  const boardRanks = before.map(rank19), newRank = rank19(newCard);
  const beforeSuits = before.filter((card) => card[1] === newCard[1]).length;
  const connected = before.map(rank19).filter((r) => Math.abs(r - newRank) <= 4).length;
  return {
    previousDrawClass: previous.drawClass,
    missedDraw: board.length === 5 && previous.draw > 0 && !drawCompleted,
    drawCompleted,
    flushCompletion: beforeSuits === 2 || beforeSuits === 3,
    straightCompletion: connected >= 3,
    pairingCard: boardRanks.includes(newRank),
    overcardArrival: newRank > Math.max(...boardRanks)
  };
}
function decisionContext7(o) {
  const own = o.seats.find((s) => s.id === o.actingSeat), active = o.seats.filter((s) => !s.folded), opponents = active.filter((s) => s.id !== o.actingSeat), total = o.seats.length;
  const button = o.seats.findIndex((s) => s.id === o.button), physicalPosition6 = preflopPosition6(o);
  const position = physicalPosition6 === "BTN" || physicalPosition6 === "CO" ? "late" : physicalPosition6 === "SB" || physicalPosition6 === "BB" ? "blinds" : physicalPosition6 === "UTG" ? "early" : "middle";
  const postOrder = [...o.seats.slice(button + 1), ...o.seats.slice(0, button + 1)].filter((s) => !s.folded && !s.allIn);
  const postIndex = postOrder.findIndex((s) => s.id === o.actingSeat), inPosition = postIndex === postOrder.length - 1;
  const bbSeat = o.publicEvents.filter((e) => e.type === "blind").at(-1)?.seatId ?? o.seats[(button + (total === 2 ? 1 : 2)) % total].id;
  const bbIndex = o.seats.findIndex((s) => s.id === bbSeat);
  const turnOrder = o.street === "preflop" ? [...o.seats.slice(bbIndex + 1), ...o.seats.slice(0, bbIndex + 1)].filter((s) => !s.folded && !s.allIn) : postOrder;
  const turnIndex = turnOrder.findIndex((s) => s.id === o.actingSeat);
  const outstandingWager = Math.max(0, ...opponents.map((s) => s.streetCommitted)) - own.streetCommitted;
  const effective = Math.max(0, Math.min(own.stack + own.streetCommitted, Math.max(0, ...opponents.map((s) => s.stack + s.streetCommitted))) - own.streetCommitted);
  const pre = o.publicEvents.filter((e) => e.type === "action" && e.street === "preflop"), raises = pre.filter((e) => e.action?.type === "raise");
  const firstRaise = pre.findIndex((e) => e.action?.type === "raise");
  const limpers = new Set(pre.slice(0, firstRaise < 0 ? void 0 : firstRaise).filter((e) => e.action?.type === "call" && (e.amount ?? 0) > 0).map((e) => e.seatId)).size;
  const lastRaiseIndex = pre.map((e) => e.action?.type).lastIndexOf("raise");
  const callsSince = lastRaiseIndex >= 0 ? pre.slice(lastRaiseIndex + 1).filter((e) => e.action?.type === "call").length : 0;
  const street = o.publicEvents.filter((e) => e.type === "action" && e.street === o.street), streetRaises = street.filter((e) => e.action?.type === "raise");
  const checkedEarlier = street.some((e) => e.seatId === o.actingSeat && e.action?.type === "check");
  const ownPreflopAggressor = raises.at(-1)?.seatId === o.actingSeat;
  const flop = o.publicEvents.filter((e) => e.type === "action" && e.street === "flop");
  const delayedCbetOpportunity = o.street === "turn" && ownPreflopAggressor && flop.length > 0 && !flop.some((e) => e.action?.type === "raise");
  return { position, inPosition, effectiveStackBB: effective / o.bigBlind, spr: effective / Math.max(o.pot, o.bigBlind), activePlayers: active.length, playersBehind: Math.max(0, turnOrder.length - turnIndex - 1), price: contestablePricing5(o).price, betToPot: Math.max(0, outstandingWager) / Math.max(o.bigBlind, o.pot - Math.max(0, outstandingWager)), preflopNode: raises.length >= 3 ? "facing-4bet" : raises.length === 2 ? "facing-3bet" : raises.length === 1 ? "facing-open" : limpers ? "limped" : "unopened", limpers, squeeze: raises.length === 1 && callsSince > 0, ownPreflopAggressor, checkedEarlier, delayedCbetOpportunity, raisesThisStreet: streetRaises.length, lastAggressor: streetRaises.at(-1)?.seatId ?? raises.at(-1)?.seatId ?? null };
}

// src/bots/ranges.ts
var RANGE_MODEL_VERSION6 = "public-action-ranges-1.1.0";
var clamp14 = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
var sigmoid14 = (x) => 1 / (1 + Math.exp(-x));
var DECK6 = [..."23456789TJQKA"].flatMap((r) => [..."cdhs"].map((s) => r + s));
var rank20 = (c) => "23456789TJQKA".indexOf(c[0]) + 2;
var classes6 = new Map(PREFLOP_CLASSES6.map((c) => [c.handClass, c]));
var combos6 = enumerateStartingCombos6().map((c) => ({ ...c, meta: classes6.get(c.handClass) }));
var shapeCache6 = /* @__PURE__ */ new Map();
var analysisCache6 = /* @__PURE__ */ new Map();
var MAX_CACHE6 = 8;
function putBounded6(cache, key, value, max = MAX_CACHE6) {
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}
function shape6(cards, board) {
  const hi = Math.max(...cards.map(rank20));
  if (!board.length) {
    const m = classes6.get(className6(cards));
    return { strength: m.baseScore / 100, draw: m.speculative, blocker: m.blocker, strong: m.baseScore >= 90 };
  }
  const all = [...cards, ...board], counts8 = new Array(15).fill(0), bc = new Array(15).fill(0);
  const suits = { c: 0, d: 0, h: 0, s: 0 }, bs = { c: 0, d: 0, h: 0, s: 0 };
  for (const c of all) {
    counts8[rank20(c)]++;
    suits[c[1]]++;
  }
  for (const c of board) {
    bc[rank20(c)]++;
    bs[c[1]]++;
  }
  const pairs = counts8.map((n, r) => n >= 2 ? r : 0).filter(Boolean).sort((a, b) => b - a), trips = pairs.filter((r) => counts8[r] >= 3);
  let straight = 0, privateStraightDraw = false;
  const have = new Set(all.map(rank20));
  if (have.has(14)) have.add(1);
  const boardHave = new Set(board.map(rank20));
  if (boardHave.has(14)) boardHave.add(1);
  for (let top2 = 14; top2 >= 5; top2--) {
    let n = 0;
    for (let r = top2 - 4; r <= top2; r++) if (have.has(r)) n++;
    if (n === 4 && cards.some((c) => {
      const r = rank20(c) === 14 && top2 === 5 ? 1 : rank20(c);
      return r >= top2 - 4 && r <= top2 && !boardHave.has(r);
    })) privateStraightDraw = true;
    if (n === 5 && !straight) straight = top2;
  }
  const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5), drawSuit = Object.keys(suits).find((s) => suits[s] === 4);
  const top = Math.max(...board.map(rank20)), ownRanks = cards.map(rank20), ownPair = ownRanks[0] === ownRanks[1];
  let strength = 0.15 + hi / 14 * 0.1, draw9 = 0, blocker = 0;
  if (pairs.length) {
    const pr = pairs[0];
    strength = ownPair && pr > top ? 0.69 : ownRanks.includes(pr) && pr === top ? 0.59 + hi / 14 * 0.04 : ownRanks.includes(pr) ? 0.38 + pr / 14 * 0.11 : 0.2 + hi / 14 * 0.07;
  }
  if (pairs.length >= 2) strength = pairs.slice(0, 2).some((r) => bc[r] < 2) ? 0.75 : 0.32 + hi / 14 * 0.04;
  if (trips.length) strength = ownRanks.includes(trips[0]) ? 0.83 : 0.4 + hi / 14 * 0.05;
  if (straight) strength = 0.85;
  if (flushSuit) {
    const privateHigh = Math.max(0, ...cards.filter((c) => c[1] === flushSuit).map(rank20));
    const higherUnknown = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r > privateHigh && !all.some((c) => c[1] === flushSuit && rank20(c) === r)).length;
    const quality = clamp14(1 - higherUnknown / 9);
    strength = bs[flushSuit] >= 4 ? 0.46 + quality * 0.46 : 0.64 + quality * 0.28;
  }
  if (trips.length && pairs.some((r) => r !== trips[0])) strength = bc[trips[0]] >= 3 ? 0.59 + pairs.find((r) => r !== trips[0]) / 14 * 0.28 : 0.95;
  if (pairs.some((r) => counts8[r] === 4)) {
    const q = pairs.find((r) => counts8[r] === 4);
    strength = bc[q] === 4 ? 0.45 + hi / 14 * 0.4 : 0.995;
  }
  if (board.length < 5) {
    if (drawSuit && cards.some((c) => c[1] === drawSuit)) draw9 = 0.7;
    if (!straight && privateStraightDraw) draw9 = Math.max(draw9, 0.5);
    if (drawSuit && !straight && privateStraightDraw) draw9 = 0.95;
  }
  for (const suit of Object.keys(bs)) if (bs[suit] >= 2) {
    const highest = Array.from({ length: 13 }, (_, i) => 14 - i).find((r) => !board.some((c) => c[1] === suit && rank20(c) === r));
    if (cards.some((c) => c[1] === suit && rank20(c) === highest)) blocker = Math.max(blocker, bs[suit] >= 3 ? 0.9 : 0.4);
  }
  return { strength: clamp14(strength), draw: draw9, blocker, strong: strength >= 0.82 };
}
function className6(cards) {
  const sorted = [...cards].sort((a2, b2) => rank20(b2) - rank20(a2)), a = sorted[0][0], b = sorted[1][0];
  return a === b ? a + b : a + b + (sorted[0][1] === sorted[1][1] ? "s" : "o");
}
function boardShapes6(board) {
  const key = board.join("");
  const hit = shapeCache6.get(key);
  if (hit) return hit;
  return putBounded6(shapeCache6, key, combos6.map((c) => c.cards.some((x) => board.includes(x)) ? { strength: 0, draw: 0, blocker: 0, strong: false } : shape6(c.cards, board)), 4);
}
function observed6(rate10, prior, adaptation) {
  const n = Math.max(0, rate10?.opportunities ?? 0), count = clamp14(rate10?.count ?? 0, 0, n), weight = n / (n + 24) * adaptation;
  return { value: prior * (1 - weight) + (n ? count / n : prior) * weight, weight };
}
function belief6(o, p, seatId) {
  const low = p.environment === "low", high = p.environment === "high";
  const priors = { vpip: low ? 0.38 : high ? 0.27 : 0.31, pfr: low ? 0.16 : high ? 0.23 : 0.2, aggression: low ? 0.29 : high ? 0.45 : 0.37, fold: low ? 0.38 : high ? 0.47 : 0.43 };
  const known = o.memory?.opponents.find((m) => m.seatId === seatId), adapt = p.traits?.adaptation ?? 0.5;
  const v = observed6(known?.vpip, priors.vpip, adapt), r = observed6(known?.pfr, priors.pfr, adapt), a = observed6(known?.aggression, priors.aggression, adapt), f = observed6(known?.foldToBet, priors.fold, adapt);
  return { vpip: clamp14(v.value, 0.08, 0.82), pfr: clamp14(r.value, 0.03, 0.7), aggression: clamp14(a.value, 0.08, 0.85), fold: clamp14(f.value, 0.1, 0.82), confidence: (v.weight + r.weight + a.weight + f.weight) / 4, source: known ? "public observed rates shrunk toward synthetic population prior" : "synthetic population prior; no private opponent profile" };
}
function evidence6(o) {
  const results = [], commits = /* @__PURE__ */ new Map(), checked = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let street = "preflop", pot = 0, wager = 0, raises = 0;
  const active = new Set(o.seats.map((s) => s.id));
  for (const event2 of o.publicEvents) {
    if (seen.has(event2.id)) continue;
    seen.add(event2.id);
    if (event2.type === "street") {
      street = event2.street ?? street;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
      continue;
    }
    const id2 = event2.seatId;
    if (id2 === void 0) continue;
    const amount = Math.max(0, event2.amount ?? 0);
    if (event2.type === "blind") {
      commits.set(id2, (commits.get(id2) ?? 0) + amount);
      pot += amount;
      wager = Math.max(wager, commits.get(id2));
      continue;
    }
    if (event2.type === "refund") {
      pot = Math.max(0, pot - amount);
      continue;
    }
    if (event2.type !== "action" || !event2.action) continue;
    const es = event2.street ?? street;
    if (es !== street) {
      street = es;
      commits.clear();
      checked.clear();
      wager = 0;
      raises = 0;
    }
    const board = o.board.slice(0, es === "flop" ? 3 : es === "turn" ? 4 : es === "river" || es === "complete" ? 5 : 0), facing = Math.max(0, wager - (commits.get(id2) ?? 0));
    const additional = event2.action.type === "raise" ? Math.max(0, event2.action.to - (commits.get(id2) ?? 0)) : amount;
    results.push({ event: event2, board, raises, size: additional / Math.max(o.bigBlind, pot), facing, pot, checked: checked.has(id2), playersAtAction: active.size });
    if (event2.action.type === "fold") active.delete(id2);
    if (event2.action.type === "check") checked.add(id2);
    if (event2.action.type === "raise") {
      wager = Math.max(wager, event2.action.to);
      commits.set(id2, event2.action.to);
      raises++;
    } else if (event2.action.type === "call") commits.set(id2, (commits.get(id2) ?? 0) + amount);
    pot += amount;
  }
  return results;
}
function likelihoods6(o, seatId, b, e, comboIndex) {
  const m = combos6[comboIndex].meta, act = e.event.action.type;
  const observedPrice = act === "fold" || act === "call" ? e.facing / Math.max(o.bigBlind, e.pot) : e.size;
  const normalize2 = (fold, check, call2, raise2) => {
    const facing = e.facing > 0 || act === "call";
    const f2 = facing ? fold : 2e-3, c = facing ? call2 : 0, k = facing ? 0 : check, total = f2 + c + k + raise2;
    return { fold: f2 / total, check: k / total, call: c / total, raise: raise2 / total };
  };
  if (!e.board.length) {
    const position = preflopPosition6(o, seatId), late = position === "BTN" ? 1 : position === "CO" ? 0.7 : position === "SB" ? 0.45 : position === "BB" ? 0.3 : position === "MP" ? 0.2 : 0;
    const seat = o.seats.find((s) => s.id === seatId), depth = clamp14((seat.stack + seat.totalCommitted) / o.bigBlind, 20, 250);
    const speculative = m.speculative * clamp14((depth - 35) / 165, -0.1, 1) * 0.07;
    const score = m.baseScore / 100 + speculative;
    const threshold = 0.71 - late * 0.13 - (b.vpip - 0.31) * 0.6 - (o.seats.length <= 3 ? 0.09 : 0) + e.raises * 0.105 + Math.max(0, observedPrice - 1) * 0.025;
    const enter = sigmoid14((score - threshold) * 12), premium = sigmoid14((score - 0.88) * 24);
    const aggressive = sigmoid14((score - (threshold + 0.08)) * 15) * (0.4 + b.pfr * 1.25) + premium * 0.3;
    const raise2 = clamp14(aggressive * (e.raises > 1 ? 0.65 : 1) + (1 - enter) * (0.016 + b.aggression * 0.035) * (1 + m.blocker) / (1 + e.raises * 1.8), 0.012, 0.98);
    const call2 = clamp14(enter * (1 - clamp14(aggressive * 0.65)) + 0.12 * m.speculative * clamp14((depth - 30) / 170), 0.015, 0.94);
    return normalize2(clamp14(1 - enter, 0.015, 0.98), clamp14(0.95 - aggressive * 0.45, 0.15, 0.98), call2, raise2);
  }
  const f = boardShapes6(e.board)[comboIndex], multi = e.playersAtAction > 2;
  const threat = clamp14(observedPrice / 2), value = sigmoid14((f.strength - (0.62 + threat * 0.13 + (multi ? 0.035 : 0))) * 15);
  const bluff = (0.04 + b.aggression * 0.17) * (1 - value) * (e.board.length < 5 ? 0.35 + f.draw * 0.75 : 0.25 + f.blocker * 0.9) * (multi ? 0.6 : 1);
  const raise = clamp14((value * (0.6 + b.aggression * 0.36) + bluff) * (e.checked ? 0.5 + f.strength * 0.5 + f.draw * 0.15 : 1), 9e-3, 0.98);
  const drawPrice = e.facing / Math.max(1, e.pot + e.facing), drawValue = e.board.length < 5 ? f.draw * clamp14(0.6 - drawPrice) * 0.8 : 0;
  const call = clamp14(sigmoid14((f.strength - (0.42 + threat * 0.17 + (multi ? 0.04 : 0))) * 12) * (0.84 - value * 0.2) + drawValue, 0.012, 0.97);
  return normalize2(clamp14(1 - sigmoid14((f.strength - (0.45 + threat * 0.14)) * 11) - f.draw * 0.15, 0.012, 0.98), clamp14(0.91 - value * (0.39 + b.aggression * 0.24) - bluff * 0.5, 0.08, 0.97), call, raise);
}
function infer6(o, p, seatId, dead, events) {
  const b = belief6(o, p, seatId), indices = combos6.flatMap((c, i) => c.cards.some((card) => dead.has(card)) ? [] : [i]);
  const n = indices.length, weights = new Float64Array(n).fill(1 / n), updates = [];
  const relevant = events.filter((e) => e.event.seatId === seatId);
  for (const e of relevant) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      weights[i] *= Math.pow(likelihoods6(o, seatId, b, e, indices[i])[e.event.action.type], 0.82 + 0.12 * b.confidence);
      total += weights[i];
    }
    const contamination = 0.025 + 0.035 * (1 - b.confidence);
    for (let i = 0; i < n; i++) weights[i] = (1 - contamination) * weights[i] / total + contamination / n;
    let squares2 = 0, premium2 = 0;
    for (let i = 0; i < n; i++) {
      squares2 += weights[i] ** 2;
      if (combos6[indices[i]].meta.baseScore >= 90) premium2 += weights[i];
    }
    updates.push({ eventId: e.event.id, street: e.event.street ?? "preflop", action: e.event.action.type, effectiveCombos: 1 / squares2, premiumMass: premium2 });
  }
  let premium = 0, strong = 0, draw9 = 0, mean = 0, nuts = 0, squares = 0, fold = 0;
  const features = boardShapes6(o.board);
  const weighted = indices.map((index2, i) => {
    const c = combos6[index2], f = features[index2], w = weights[i];
    if (c.meta.baseScore >= 90) premium += w;
    if (f.strong) strong += w;
    if (f.draw >= 0.5) draw9 += w;
    mean += w * f.strength;
    if (f.strength >= 0.9) nuts += w;
    squares += w * w;
    fold += w * clamp14((1 - sigmoid14((f.strength - 0.46) * 11) - f.draw * 0.25) * (0.65 + b.fold), 0.025, 0.94);
    return { cards: [...c.cards], weight: w };
  });
  const uncertainty = clamp14(0.65 - 0.27 * b.confidence - 0.04 * Math.min(4, relevant.length), 0.22, 0.85);
  return { range: { seatId, combos: weighted, observedActions: relevant.length, effectiveCombos: 1 / squares, uncertainty, priorSource: b.source, premiumMass: premium, strongMadeMass: strong, drawMass: draw9, updates }, strength: mean, nutMass: nuts, foldChance: fold };
}
function hashSeed6(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomStream6(seed) {
  let n = seed;
  return () => {
    n = n + 1831565813 >>> 0;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cumulative6(range) {
  let sum = 0;
  return range.combos.map((c) => sum += c.weight);
}
function pick6(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function sampleEquity6(o, ranges, seed) {
  const wanted = ranges.length <= 1 ? 96 : ranges.length <= 3 ? 72 : 48, random = randomStream6(seed), cdfs = ranges.map(cumulative6);
  let samples = 0, total = 0, squares = 0, attempts = 0;
  const maxAttempts = wanted * 150;
  while (samples < wanted && attempts++ < maxAttempts) {
    const used = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), holes = [];
    let compatible = true;
    for (let i = 0; i < ranges.length; i++) {
      const cards = ranges[i].combos[pick6(cdfs[i], random())].cards;
      if (cards.some((c) => used.has(c))) {
        compatible = false;
        break;
      }
      cards.forEach((c) => used.add(c));
      holes.push(cards);
    }
    if (!compatible) continue;
    const board = [...o.board], remaining = DECK6.filter((c) => !used.has(c));
    while (board.length < 5) {
      const index2 = Math.floor(random() * remaining.length);
      board.push(remaining[index2]);
      remaining[index2] = remaining.at(-1);
      remaining.pop();
    }
    const own = evaluate([...o.ownCards, ...board]);
    let tied = 1, beaten = false;
    for (const cards of holes) {
      const comparison = compareRanks(evaluate([...cards, ...board]), own);
      if (comparison > 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied++;
    }
    const share = beaten ? 0 : 1 / tied;
    total += share;
    squares += share * share;
    samples++;
  }
  const equity = samples ? total / samples : 1 / (ranges.length + 1), variance = samples > 1 ? Math.max(0, (squares - total * total / samples) / (samples - 1)) : 0;
  return { equity, samples, standardError: samples > 1 ? Math.sqrt(variance / samples) : 0.5, limited: samples < wanted };
}
function canonical9(o, p) {
  const index2 = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(index2), ...o.seats.slice(0, index2)], ids = new Map(ordered2.map((s, i) => [s.id, i]));
  const publicKey = { own: [...o.ownCards].sort(), board: o.board, street: o.street, actor: ids.get(o.actingSeat), pot: o.pot, bb: o.bigBlind, seats: ordered2.map((s) => [s.stack, s.streetCommitted, s.totalCommitted, s.folded, s.allIn]), events: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.amount, e.action?.type, e.action?.type === "raise" ? e.action.to : null]), memory: o.memory?.opponents.map((m) => [ids.get(m.seatId), m.vpip.count, m.vpip.opportunities, m.pfr.count, m.pfr.opportunities, m.aggression.count, m.aggression.opportunities, m.foldToBet.count, m.foldToBet.opportunities]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)), environment: p.environment, adaptation: o.memory?.opponents.length ? p.traits?.adaptation : 0 };
  const equityStream = { own: publicKey.own, board: publicKey.board, street: publicKey.street, actor: publicKey.actor, seats: ordered2.map((s) => ids.get(s.id)), line: o.publicEvents.map((e) => [e.type, e.seatId === void 0 ? null : ids.get(e.seatId), e.street, e.action?.type]) };
  return { seedKey: JSON.stringify(equityStream), cacheKey: JSON.stringify([publicKey, o.seats.map((s) => s.id), o.publicEvents.map((e) => e.id)]) };
}
function freeze6(analysis) {
  for (const r of [...analysis.opponents, ...analysis.foldedOpponents ?? []]) {
    for (const c of r.combos) {
      Object.freeze(c.cards);
      Object.freeze(c);
    }
    Object.freeze(r.combos);
    for (const u of r.updates) Object.freeze(u);
    Object.freeze(r.updates);
    Object.freeze(r);
  }
  Object.freeze(analysis.opponents);
  Object.freeze(analysis.foldedOpponents);
  Object.freeze(analysis.assumptions);
  return Object.freeze(analysis);
}
function analyzeRanges6(o, p) {
  if (o.ownCards.length !== 2 || (/* @__PURE__ */ new Set([...o.ownCards, ...o.board])).size !== o.ownCards.length + o.board.length) throw new Error("Range inference requires unique known cards.");
  const keys4 = canonical9(o, p), hit = analysisCache6.get(keys4.cacheKey);
  if (hit) return hit;
  const dead = /* @__PURE__ */ new Set([...o.ownCards, ...o.board]), events = evidence6(o), buttonIndex = o.seats.findIndex((s) => s.id === o.button), ordered2 = [...o.seats.slice(buttonIndex), ...o.seats.slice(0, buttonIndex)];
  const active = ordered2.filter((s) => s.id !== o.actingSeat && !s.folded), inferred = active.map((s) => infer6(o, p, s.id, dead, events));
  const foldedOpponents = ordered2.filter((s) => s.id !== o.actingSeat && s.folded).map((s) => infer6(o, p, s.id, dead, events).range);
  const ownPublic = infer6(o, p, o.actingSeat, new Set(o.board), events), ranges = inferred.map((r) => r.range);
  const sampled = ranges.length ? sampleEquity6(o, ranges, hashSeed6(keys4.seedKey)) : { equity: 1, samples: 0, standardError: 0, limited: false };
  const strength = inferred.length ? inferred.reduce((n, r) => n + r.strength, 0) / inferred.length : ownPublic.strength, nuts = inferred.length ? inferred.reduce((n, r) => n + r.nutMass, 0) / inferred.length : ownPublic.nutMass;
  const foldEquity = active.some((s) => s.allIn) ? 0 : inferred.reduce((n, r) => n * r.foldChance, 1);
  const assumptions = ["Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.", "Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.", "Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.", "Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.", "Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled."];
  if (sampled.limited) assumptions.push("Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.");
  const result2 = { modelVersion: RANGE_MODEL_VERSION6, opponents: ranges, foldedOpponents, equity: sampled.equity, equitySamples: sampled.samples, equityStdError: sampled.standardError, rangeAdvantage: clamp14(ownPublic.strength - strength, -1, 1), nutAdvantage: clamp14(ownPublic.nutMass - nuts, -1, 1), foldEquity, uncertainty: sampled.limited ? 0.95 : inferred.length ? inferred.reduce((n, r) => n + r.range.uncertainty, 0) / inferred.length : 0, assumptions };
  return putBounded6(analysisCache6, keys4.cacheKey, freeze6(result2));
}

// src/bots/strategy.ts
function memoryAdjustment7(o, p, lastAggressor) {
  const opponents = o.memory?.opponents.filter((m) => o.seats.some((s) => s.id === m.seatId && !s.folded) && m.seatId !== o.actingSeat) ?? [];
  if (!opponents.length) return { call: 0, bluff: 0 };
  const relevant = lastAggressor !== null ? opponents.filter((m) => m.seatId === lastAggressor) : opponents;
  let call = 0, bluff = 0;
  for (const m of relevant) {
    const n = m.aggression.opportunities, conf = n / (n + 24);
    call += (n ? m.aggression.count / n - 0.35 : 0) * conf;
  }
  for (const m of opponents) {
    const n = m.foldToBet.opportunities, conf = n / (n + 24);
    bluff += (n ? m.foldToBet.count / n - 0.45 : 0) * conf;
  }
  return { call: clamp(call / Math.max(1, relevant.length) * p.traits.adaptation * p.skill * 0.2, -0.07, 0.07), bluff: clamp(bluff / opponents.length * p.traits.adaptation * p.skill * 0.3, -0.1, 0.1) };
}
function postflopSizing6(o, p, f, c, r, equity) {
  if (!o.legal.canRaise) return [];
  if (o.legal.shortAllInTo !== null) return [{ label: "Short all-in", raiseTo: o.legal.shortAllInTo, weight: 1 }];
  const own = o.seats.find((s) => s.id === o.actingSeat), base = own.streetCommitted + o.legal.callAmount, min = o.legal.minRaiseTo, max = o.legal.maxRaiseTo;
  const candidates = [];
  const add = (label, to, weight) => {
    const raiseTo = clamp(Math.round(to / (o.chipUnit ?? 1)) * (o.chipUnit ?? 1), min, max), prior = candidates.find((x) => x.raiseTo === raiseTo);
    if (prior) prior.weight += weight;
    else candidates.push({ label: raiseTo === max ? "All-in" : label, raiseTo, weight });
  };
  const terminal = o.street === "river", polarized = terminal && (equity > 0.78 || equity < 0.3);
  const thin = f.made && equity >= 0.5 && equity < 0.72;
  const target = thin ? 0.32 + p.traits.sizingAggression * 0.32 : 0.4 + p.traits.sizingAggression * 0.65 + f.wetness * 0.18 + (polarized ? 0.2 + Math.max(0, r.nutAdvantage) * 0.35 : 0);
  const noise = p.traits.mistakeRate * (1 - p.skill * 0.65);
  for (const fraction of [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3]) {
    let weight = Math.exp(-Math.abs(fraction - target) * (3 - noise * 1.5));
    if (fraction >= 1.5) weight *= polarized ? 0.25 + 0.55 * p.traits.sizingAggression + Math.max(0, r.nutAdvantage) * 0.5 : 0.025 + p.traits.sizingAggression * 0.1;
    if (c.activePlayers > 2 && fraction >= 1.5 && !f.absoluteNuts) weight *= 0.45;
    add(`${Math.round(fraction * 100)}% pot`, base + (o.pot + o.legal.callAmount) * fraction, weight);
  }
  if (c.spr < 1.7 && (equity > 0.62 || f.draw > 0.3 && p.traits.riskTolerance > 0.65)) add("All-in", max, 0.2 + equity * 0.45 + p.traits.riskTolerance * 0.2);
  const total = candidates.reduce((sum, x) => sum + x.weight, 0);
  return candidates.map((x) => ({ ...x, weight: x.weight / total }));
}
function lineContext6(o, c) {
  const actions = o.publicEvents.filter((e) => e.type === "action");
  const previousStreet = o.street === "river" ? "turn" : o.street === "turn" ? "flop" : null;
  const previousRaise = actions.filter((e) => e.street === previousStreet && e.action?.type === "raise").at(-1);
  return {
    continuationBet: o.street === "flop" && c.ownPreflopAggressor && c.raisesThisStreet === 0 && o.legal.callAmount === 0,
    barrel: previousStreet !== null && previousRaise?.seatId === o.actingSeat && c.raisesThisStreet === 0 && o.legal.callAmount === 0
  };
}
function analyzeDecision12(observation, profile) {
  const o = permittedObservation8(observation), p = completeProfile(profile);
  validate8(o, p);
  const t = p.traits, f = handFeatures8(o.ownCards, o.board), c = decisionContext7(o), memory8 = memoryAdjustment7(o, p, c.lastAggressor);
  if (o.street === "preflop") {
    const preflop = analyzePreflop6(o, p);
    return {
      version: POLICY_VERSION,
      label: "SYNTHETIC / NOT HUMAN-VALIDATED",
      features: f,
      context: c,
      distribution: preflop.distribution,
      families: { value: Number(preflop.diagnostics.premiumValue ?? 0), bluff: 0, semiBluff: 0, trap: Number(preflop.diagnostics.trapProbability ?? 0), checkRaise: 0, delayedCbet: 0 },
      sizing: preflop.sizing,
      memoryAdjustment: memory8,
      preflop
    };
  }
  const ranges = analyzeRanges6(o, p), call = o.legal.callAmount, own = o.seats.find((s) => s.id === o.actingSeat);
  const multi = Math.max(0, c.activePlayers - 2), terminal = o.street === "river", runout = runoutFeatures6(o.ownCards, o.board), line = lineContext6(o, c);
  const pricing = contestablePricing5(o), rakeAdjustedPrice = pricing.rakeAdjustedPrice;
  const ownAfterCall = Math.max(0, own.stack - call), matchedStreet = own.streetCommitted + call;
  const opponentAfterMatching = Math.max(0, ...o.seats.filter((s) => !s.folded && s.id !== own.id).map((s) => Math.max(0, s.stack - Math.max(0, matchedStreet - s.streetCommitted))));
  const remainingEffectiveExposure = terminal ? 0 : Math.min(ownAfterCall, opponentAfterMatching);
  const futureClosed = remainingEffectiveExposure === 0;
  const futureExposureWeight = remainingEffectiveExposure / (remainingEffectiveExposure + Math.max(1, pricing.contestableAfterCall));
  const sampleSupport = clamp(ranges.equitySamples / 48), samplePrecision = clamp(1 - ranges.equityStdError * 2, 0.2, 1);
  const rangeWeight = clamp((0.42 + 0.53 * p.skill - ranges.uncertainty * 0.08) * sampleSupport * samplePrecision, 0, 0.95);
  const localEquity = clamp((f.strength - 0.14 + f.draw * 0.38) / (1 + multi * 0.23));
  const mistakeScale = t.mistakeRate * (1 - p.skill * 0.8);
  const attachment = f.made && !f.absoluteNuts ? Math.max(0, p.looseness - 0.35) * (0.05 + mistakeScale * 0.17) : 0;
  const missedFit = p.archetype === "fit-or-fold" && !f.made && f.draw < 0.12 ? 0.08 : 0;
  const perceivedEquity = clamp(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight) + attachment - missedFit);
  const openRealization = clamp(0.9 + (c.inPosition ? 0.07 : -0.06) + p.skill * 0.045 + (f.nutDraw ? 0.055 : 0) - multi * 0.035 * t.multiwayCaution - f.vulnerability * 0.055, 0.55, 1);
  const realization = 1 - (1 - openRealization) * futureExposureWeight;
  const streetsRemaining = o.street === "flop" ? 2 : o.street === "turn" ? 1 : 0;
  const futureCost = futureExposureWeight * streetsRemaining * 0.018 * Math.min(1, c.spr / 4) * (c.inPosition ? 0.55 : 1.2) * (f.draw > 0 ? 1 : 0.55) * (1 - p.skill * 0.35);
  const impliedOdds = f.draw === 0 ? 0 : futureExposureWeight * Math.min(0.065, f.draw * (f.nutDraw ? 0.16 : 0.07) * (1 - Math.exp(-c.spr / 7)) * (c.inPosition ? 1 : 0.7));
  const reverseImpliedOdds = futureExposureWeight * (f.vulnerability * 0.035 + (f.draw > 0 && !f.nutDraw ? f.wetness * 0.025 : 0)) * Math.min(1, c.spr / 5) * (1 + multi * 0.2);
  const realizedEquity = clamp(perceivedEquity * realization + impliedOdds - futureCost - reverseImpliedOdds);
  const fourSuitBoard = [..."cdhs"].some((suit) => o.board.filter((card) => card[1] === suit).length >= 4);
  const textureCaution = !f.absoluteNuts && (fourSuitBoard || f.playsBoard) ? Math.max(0, 0.82 - f.strength) * c.betToPot / (1 + c.betToPot) * (0.6 + 0.4 * ranges.uncertainty) : 0;
  const threat = textureCaution + Math.min(0.15, Math.max(0, c.betToPot - 0.6) * t.sizeSensitivity * 0.035) + Math.max(0, c.raisesThisStreet - 1) * 0.025 * p.skill;
  const riskPremium = 8e-3 + (1 - t.riskTolerance) * 0.025 + multi * t.multiwayCaution * 0.012 + threat;
  const curiosity = terminal && f.made && !f.playsBoard ? t.riverCuriosity * 0.055 + memory8.call : memory8.call * 0.4;
  const clarity = 15 + p.skill * 7 - Math.min(4, ranges.equityStdError * 20);
  let continueChance = clamp(sigmoid((realizedEquity - rakeAdjustedPrice - riskPremium + curiosity) * clarity), 5e-3, 0.998);
  let drawContinue = 0;
  if (!terminal && f.draw > 0) {
    const remaining = 52 - o.ownCards.length - o.board.length, clean2 = f.cleanOuts * (1 - Math.min(0.35, multi * 0.055 * t.multiwayCaution));
    const oneCard = clean2 / remaining, twoCard = 1 - (1 - oneCard) * (1 - clean2 / (remaining - 1));
    const openSecondCardRealization = clamp(0.16 + (c.inPosition ? 0.16 : 0) + (f.nutDraw ? 0.12 : 0) + Math.min(0.12, c.spr * 0.015) - multi * 0.025, 0, 0.6);
    const secondCardRealization = 1 - (1 - openSecondCardRealization) * futureExposureWeight;
    const drawProxy = o.street === "flop" ? oneCard + (twoCard - oneCard) * secondCardRealization : oneCard;
    drawContinue = sigmoid((drawProxy - rakeAdjustedPrice) * 22 + (t.drawCalling - 0.5) * 2 + p.skill * 0.75);
    continueChance = Math.max(continueChance, drawContinue);
  }
  const equity = clamp(ranges.equity * rangeWeight + localEquity * (1 - rangeWeight));
  const air = 1 - sigmoid((equity - 0.44) * 12), valueThreshold = 0.59 + t.valueThreshold * 0.15 + (call > 0 ? 0.045 : 0) + multi * 0.035;
  const value = sigmoid((equity - valueThreshold) * 14) * (f.made ? 1 : 0.15);
  const foldEquity = clamp(ranges.foldEquity + memory8.bluff);
  const pressureDenominator = 1 + multi * (0.65 + t.multiwayCaution);
  const blockerSelection = 0.7 + f.blockerStrength * (0.45 + 0.35 * p.skill);
  const missedSelection = terminal && runout.missedDraw ? 0.7 + f.blockerStrength * 0.45 : 1;
  const bluff = clamp(t.bluffFrequency * p.aggression * (0.08 + foldEquity * 0.3) * air * blockerSelection * missedSelection / pressureDenominator * (call > 0 ? 0.65 : 1), 0, 0.4);
  const semiBluff = !terminal ? f.draw * p.aggression * (0.16 + t.riskTolerance * 0.32) * (0.5 + foldEquity) / pressureDenominator : 0;
  const thinValue = f.made && !f.playsBoard && equity > 0.5 && equity < 0.8 ? sigmoid((equity - 0.58) * 15) * p.skill * 0.13 * (call > 0 ? 0.35 : 1) : 0;
  const protection = !terminal && f.made && equity > 0.45 ? f.vulnerability * (0.08 + 0.12 * p.aggression) / (1 + multi * 0.5) : 0;
  const trap = call === 0 ? value * t.slowPlay * (1 - f.wetness * 0.8) * 0.5 * (c.spr > 2 ? 1 : 0.35) : 0;
  const checkRaise = c.checkedEarlier && call > 0 ? (value * 0.2 + semiBluff * 0.35 + bluff * 0.45) * p.aggression : 0;
  const advantage = clamp(0.5 + ranges.rangeAdvantage * 0.5);
  const cbet = line.continuationBet ? (value * 0.055 + air * 0.12 * advantage * (1 - f.wetness * 0.45)) * p.aggression / pressureDenominator : 0;
  const delayedCbet = c.delayedCbetOpportunity && call === 0 ? (value * 0.08 + air * foldEquity * 0.08) * p.aggression / pressureDenominator : 0;
  const scare = Number(runout.flushCompletion || runout.straightCompletion || runout.overcardArrival);
  const barrel = line.barrel ? (value * 0.09 + air * 0.11 * (advantage * 0.45 + scare * p.skill * 0.3 + f.blockerStrength * 0.25) * foldEquity) * p.aggression / pressureDenominator : 0;
  let raising = value * (0.22 + p.aggression * 0.67) + bluff + semiBluff + checkRaise + delayedCbet + cbet + barrel + thinValue + protection - trap;
  if (c.raisesThisStreet > 1) raising *= 0.55 + equity * 0.4;
  if (c.spr < 1.3 && f.made && equity > 0.55) raising += 0.1 * t.riskTolerance;
  const mistakeAdjustment = mistakeScale * ((f.made && equity < 0.7 ? p.looseness * 0.035 : 0) - (p.archetype === "nit" && equity < 0.55 ? 0.025 : 0));
  continueChance = clamp(continueChance + mistakeAdjustment, 5e-3, 0.998);
  const drawWillingnessAdjustment = !terminal && f.draw > 0 && !f.made ? (t.drawCalling - 0.5) * 0.5 * (1 - f.strength) : 0;
  if (call > 0) continueChance = adjustDrawContinuation(continueChance, drawWillingnessAdjustment);
  const responseKind = drawResponseKind(terminal ? runout.missedDraw ? runout.previousDrawClass : "none" : f.drawClass);
  if (o.legal.callAmount > 0) continueChance = adjustDrawContinuation(continueChance, drawResponseOffset(p.drawResponses, responseKind, o.street, c.betToPot));
  raising = clamp(raising + mistakeScale * (p.aggression - 0.5) * (0.035 + f.draw * 0.04), 5e-3, 0.97);
  let guaranteedChopCallEV = null;
  if (terminal && f.absoluteNuts && f.playsBoard && o.seats.length === 2 && c.activePlayers === 2 && call > 0 && !o.legal.canRaise) {
    const net = Math.max(0, pricing.contestableAfterCall - pricing.estimatedRake);
    const unit8 = o.chipUnit ?? 1, units = net / unit8;
    const share = (Math.floor(units / 2) + (units % 2 !== 0 && o.actingSeat !== o.button ? 1 : 0)) * unit8;
    guaranteedChopCallEV = share - call;
  }
  if (f.absoluteNuts) continueChance = guaranteedChopCallEV !== null && guaranteedChopCallEV < 0 ? 0 : 1;
  if (terminal && f.absoluteNuts && !f.playsBoard && o.legal.canRaise) raising = 1;
  if (!o.legal.canRaise) raising = 0;
  let distribution;
  if (call === 0) distribution = { fold: 0, check: 1 - raising, call: 0, raise: raising };
  else {
    const fold = o.legal.fold ? 1 - continueChance : 0, remaining = 1 - fold;
    distribution = { fold, check: 0, call: remaining * (1 - raising), raise: remaining * raising };
  }
  return {
    version: POLICY_VERSION,
    label: "SYNTHETIC / NOT HUMAN-VALIDATED",
    features: f,
    context: c,
    distribution,
    families: { value, bluff, semiBluff, trap, checkRaise, delayedCbet, cbet, barrel, protection, thinValue },
    sizing: postflopSizing6(o, p, f, c, ranges, equity),
    memoryAdjustment: memory8,
    ranges,
    postflop: { modelVersion: "public-range-postflop-1.6.0", showdownEquity: ranges.equity, perceivedEquity, realization, realizedEquity, potOdds: c.price, rakeAdjustedPrice, futureCost, impliedOdds, reverseImpliedOdds, rangeWeight, modelUncertainty: ranges.uncertainty, textureCaution, foldEquity, drawContinue, futureBettingClosed: futureClosed, remainingEffectiveExposure, futureExposureWeight, continuationBet: line.continuationBet, barrel: line.barrel, runout, mistakeAdjustment, drawWillingnessAdjustment, contestableAfterCall: pricing.contestableAfterCall, excludedChips: pricing.excludedChips, estimatedRake: pricing.estimatedRake, guaranteedChopCallEV }
  };
}

// src/bots/policy.ts
var LEGACY_POLICY_VERSION7 = POLICY_VERSION2;
var VERSION_ONE_POLICY_VERSION6 = POLICY_VERSION3;
var VERSION_SIX_POLICY_VERSION = POLICY_VERSION8;
var VERSION_FIVE_POLICY_VERSION2 = POLICY_VERSION7;
var VERSION_FOUR_POLICY_VERSION3 = POLICY_VERSION6;
var VERSION_THREE_POLICY_VERSION4 = POLICY_VERSION5;
var VERSION_TWO_POLICY_VERSION5 = POLICY_VERSION4;
var securePolicyRandom8 = securePolicyRandom;
function supportedPolicy(version) {
  return version === VERSION_SIX_POLICY_VERSION || version === VERSION_FIVE_POLICY_VERSION2 || version === VERSION_FOUR_POLICY_VERSION3 || version === POLICY_VERSION || version === LEGACY_POLICY_VERSION7 || version === VERSION_ONE_POLICY_VERSION6 || version === VERSION_TWO_POLICY_VERSION5 || version === VERSION_THREE_POLICY_VERSION4;
}
function draw8(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Bot random draw must be in [0, 1).");
  return n;
}
function chooseDecision8(observation, profile, random = securePolicyRandom8) {
  if (profile.policyVersion === VERSION_SIX_POLICY_VERSION) return chooseDecision7(observation, profile, random);
  if (profile.policyVersion === VERSION_FIVE_POLICY_VERSION2) return chooseDecision6(observation, profile, random);
  if (profile.policyVersion === VERSION_FOUR_POLICY_VERSION3) return chooseDecision5(observation, profile, random);
  if (profile.policyVersion === VERSION_THREE_POLICY_VERSION4) return chooseDecision4(observation, profile, random);
  if (profile.policyVersion === VERSION_TWO_POLICY_VERSION5) return chooseDecision3(observation, profile, random);
  if (profile.policyVersion === LEGACY_POLICY_VERSION7) return chooseDecision(observation, profile, random);
  if (profile.policyVersion === VERSION_ONE_POLICY_VERSION6) return chooseDecision2(observation, profile, random);
  const o = permittedObservation8(observation), p = completeProfile(profile);
  validate8(o, p);
  const analysis = analyzeDecision12(o, p), d = analysis.distribution, n = draw8(random);
  let action;
  if (n < d.fold) action = { type: "fold" };
  else if (n < d.fold + d.check) action = { type: "check" };
  else if (n < d.fold + d.check + d.call) action = { type: "call" };
  else {
    const sizeDraw = draw8(random);
    let total = 0;
    const chosen = analysis.sizing.find((s) => {
      total += s.weight;
      return sizeDraw < total;
    }) ?? analysis.sizing.at(-1);
    if (!chosen) throw new Error("No legal raise available.");
    action = { type: "raise", to: chosen.raiseTo };
  }
  return { handId: o.handId, revision: o.revision, seatId: o.actingSeat, decisionId: o.decisionId, policyVersion: p.policyVersion, observationHash: fingerprint8(o, p), action };
}

// src/rules/provenance.ts
var SUFFIX = /\+cfg\.[0-9a-f]{64}$/;
function ordered(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Rule configuration contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(ordered).join(",")}]`;
  if (typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${ordered(record[key])}`).join(",")}}`;
  }
  throw new Error("Rule configuration contains a non-JSON value.");
}
function ruleProfileConfigVersion(profile, baseVersion = profile.version) {
  if (typeof baseVersion !== "string" || !baseVersion.length) throw new Error("A base rule version is required.");
  const base = baseVersion.replace(SUFFIX, "");
  if (!base) throw new Error("A base rule version is required.");
  const rules2 = { ...profile };
  delete rules2.version;
  const rake = profile.rake, { cap, rounding } = rake;
  const rakeSettings = { ...rake };
  delete rakeSettings.dealtIn;
  delete rakeSettings.cap;
  delete rakeSettings.rounding;
  const configuration = { schema: "cash-rule-configuration/1", rules: { ...rules2, rake: { ...rakeSettings, rounding: rounding ?? "floor", ...rake.capByDealtIn ? {} : { cap } } } };
  const fingerprint9 = [...sha256(new TextEncoder().encode(ordered(configuration)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${base}+cfg.${fingerprint9}`;
}
function withRuleProfileConfigVersion(profile) {
  return { ...structuredClone(profile), version: ruleProfileConfigVersion(profile) };
}

// src/storage/study-import.ts
var previews = /* @__PURE__ */ new WeakMap();
function selectPublicStudyRows(preview, indices) {
  const accepted = previews.get(preview);
  requireData(accepted, "Import preview is unavailable or unverified. Review the source file again.");
  requireData(Array.isArray(indices) && indices.length > 0 && new Set(indices).size === indices.length && indices.every((index2) => Number.isSafeInteger(index2) && accepted.has(index2)), "Select one or more distinct verified study rows. Invalid or unknown rows cannot be imported.");
  return [...indices].sort((a, b) => a - b).map((index2) => structuredClone(accepted.get(index2)));
}

// src/session/bot-observation.ts
var publicCache = /* @__PURE__ */ new WeakMap();
var memoryCache = /* @__PURE__ */ new WeakMap();
function publicMemoryHands(hands, sessionId, observingSeat) {
  const trusted = isVerifiedHistory(hands), key = `${sessionId}:${observingSeat}`, cached = trusted ? publicCache.get(hands)?.get(key) : void 0;
  if (cached) return cached;
  const selected = [];
  for (let i = hands.length - 1; i >= 0 && selected.length < 120; i--) {
    const h = hands[i];
    if (h.sessionId === sessionId && h.view.seats.some((s) => s.id === observingSeat)) selected.push(h);
  }
  const result2 = selected.reverse().map((h) => ({
    handId: h.id,
    seats: h.view.seats.map((s) => ({ id: s.id, revealedCards: h.view.street === "complete" && h.view.board.length === 5 && !s.folded && Object.hasOwn(h.view.handLabels, s.id) ? [...s.hole] : [] })),
    events: h.view.events.filter((e) => e.type === "action" || e.type === "blind" || e.type === "street").map(publicEvent)
  }));
  if (trusted) {
    const map = publicCache.get(hands) ?? /* @__PURE__ */ new Map();
    map.set(key, freezeSnapshot(result2));
    publicCache.set(hands, map);
  }
  return result2;
}
function publicEvent(e) {
  return {
    id: e.id,
    handId: e.handId,
    revision: e.revision,
    type: e.type,
    seatId: e.seatId,
    amount: e.amount,
    street: e.street,
    action: e.action ? e.action.type === "raise" ? { type: "raise", to: e.action.to } : { type: e.action.type } : void 0
  };
}
function withPublicContext(observation, rake, profile, hands, sessionId) {
  const retention = profile.traits?.memoryRetention ?? 0.5, key = `${sessionId}:${observation.actingSeat}:${retention}`, trusted = isVerifiedHistory(hands);
  let memory8 = trusted ? memoryCache.get(hands)?.get(key) : void 0;
  if (!memory8) {
    memory8 = buildOpponentMemory7(publicMemoryHands(hands, sessionId, observation.actingSeat), observation.actingSeat, retention);
    if (trusted) {
      const map = memoryCache.get(hands) ?? /* @__PURE__ */ new Map();
      map.set(key, freezeSnapshot(memory8));
      memoryCache.set(hands, map);
    }
  }
  return { ...observation, rake: { ...rake }, memory: memory8 };
}

// src/session/controller.ts
var DEFAULT_SETTINGS = { seats: 6, stake: "0", smallBlind: 100, bigBlind: 200, buyIn: 2e4, archetypes: ["tag", "station", "nit", "lag", "passive-reg", "fit-or-fold", "stronger-reg", "maniac", "tag"], rakeMode: "none", rakeBasisPoints: 500, rakeCap: 300, noFlopNoDrop: true, minBuyInBB: 1, maxBuyInBB: 500, allowTopUp: true };
var id = (kind) => `${kind}:${newHandId()}`;
var now = () => (/* @__PURE__ */ new Date()).toISOString();
function seeded(token) {
  let state = token >>> 0;
  return () => {
    state += 1831565813;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rules(settings) {
  if (settings.rakeMode === "pokerstars-usd-2026") {
    requireData((settings.chipUnit ?? 1) === 1, "Sourced USD rake requires one-cent chips.");
    return withRuleProfileConfigVersion(pokerStarsProfile(settings.smallBlind, settings.bigBlind));
  }
  return withRuleProfileConfigVersion({ id: "practice-cash", version: "0.3.0", mode: "cash", smallBlind: settings.smallBlind, bigBlind: settings.bigBlind, chipUnit: settings.chipUnit ?? 1, rake: { basisPoints: settings.rakeMode === "custom" ? settings.rakeBasisPoints : 0, cap: settings.rakeMode === "custom" ? settings.rakeCap : 0, noFlopNoDrop: settings.noFlopNoDrop }, shortRaiseReopens: "cumulative", oddChipOrder: "clockwise-from-button" });
}
var SessionController = class {
  constructor(port = new BrowserPersistence()) {
    this.port = port;
  }
  data = null;
  status = "loading";
  error = "";
  busy = false;
  listeners = /* @__PURE__ */ new Set();
  failed = null;
  clock = null;
  lastTick = Date.now();
  visible = true;
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((fn) => fn());
  }
  owns() {
    return this.port.writable !== false;
  }
  async initialGuestData() {
    const initial = { schemaVersion: 4, revision: 0, epoch: 0, wallet: 0, initialBankroll: 1e6, ledger: [], sessions: [], hands: [], active: null, importedHands: [] };
    await appendMoney(initial, { id: id("initial"), at: now(), epoch: 0, kind: "adjustment", walletDelta: 1e6, tableDelta: 0, pokerNet: 0, note: "Initial virtual bankroll" });
    return initial;
  }
  async init() {
    this.busy = true;
    this.status = "loading";
    this.emit();
    try {
      this.data = await this.port.load();
      if (!this.owns()) {
        this.status = "readonly";
        this.error = "Another tab owns this session. Close it, then Retry to continue here.";
        return;
      }
      if (!this.data) {
        const initial = await this.initialGuestData();
        await this.persist(null, initial);
      } else {
        await auditSnapshot(this.data);
        this.status = "ready";
      }
      this.error = "";
      this.startClock();
    } catch (e) {
      this.error = e.message;
      if (this.port.deleted || e instanceof PracticeDataDeletedError) this.clearDeletedState();
      else this.status = "error";
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  startClock() {
    this.lastTick = Date.now();
    if (typeof document === "undefined") return;
    this.visible = document.visibilityState !== "hidden";
    document.addEventListener("visibilitychange", this.visibilityChanged);
    window.addEventListener("pagehide", this.pageHide);
    window.addEventListener("pageshow", this.pageShow);
    if (!this.clock) this.clock = setInterval(() => {
      void this.tick();
    }, 5e3);
  }
  pageShow = (event2) => {
    if (event2.persisted) window.location.reload();
  };
  visibilityChanged = () => {
    this.visible = document.visibilityState !== "hidden";
    this.lastTick = Date.now();
  };
  pageHide = () => {
    this.close();
    window.addEventListener("pageshow", this.pageShow, { once: true });
  };
  stopClock() {
    if (this.clock) clearInterval(this.clock);
    this.clock = null;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityChanged);
      window.removeEventListener("pagehide", this.pageHide);
      window.removeEventListener("pageshow", this.pageShow);
    }
  }
  close() {
    this.stopClock();
    this.port.close();
  }
  clearDeletedState() {
    this.stopClock();
    this.data = null;
    this.failed = null;
    this.status = "deleted";
  }
  accountClock(d) {
    const time = Date.now();
    const delta = Math.max(0, Math.min(time - this.lastTick, 1e4));
    this.lastTick = time;
    if (d.active) {
      const session = d.sessions.find((s) => s.id === d.active.sessionId);
      if (this.visible && !d.active.paused) session.activeMs += delta;
      session.lastActiveAt = null;
    }
  }
  async tick() {
    if (!this.data?.active || !this.visible || this.data.active.paused) {
      this.lastTick = Date.now();
      return;
    }
    await this.mutate(async () => {
    }, true);
  }
  async persist(expected, next) {
    await verifyTransition(this.data, next);
    this.failed = { expected, next };
    try {
      await timedAsync("persistence.commit", () => this.port.commit(expected, next));
      this.data = next;
      this.failed = null;
      this.status = "ready";
    } catch (e) {
      if (this.port.deleted || e instanceof PracticeDataDeletedError) this.clearDeletedState();
      else this.status = /another tab|revision changed|ownership/i.test(e.message) ? "readonly" : "error";
      throw e;
    }
  }
  async mutate(change, quiet = false) {
    if (this.busy || this.status !== "ready" || !this.data) return;
    this.busy = true;
    if (!quiet) this.emit();
    this.error = "";
    try {
      const next = draftSnapshot(this.data);
      this.accountClock(next);
      await change(next);
      next.revision = this.data.revision + 1;
      await this.persist(this.data.revision, next);
    } catch (e) {
      this.error = e.message;
    } finally {
      this.busy = false;
      if (!quiet || this.error) this.emit();
    }
  }
  async retry() {
    if (this.busy) return;
    this.busy = true;
    this.emit();
    try {
      const latest = await this.port.load();
      requireData(this.owns(), "Another tab owns this session. Close it before retrying.");
      if (this.failed && latest && this.failed.next.ledger[0]?.hash !== latest.ledger[0]?.hash) {
        this.failed = null;
        this.data = latest;
      }
      if (this.failed) {
        if (latest && canonical3(latest) === canonical3(this.failed.next)) {
          this.data = latest;
          this.failed = null;
        } else if ((latest?.revision ?? null) === this.failed.expected) {
          await this.persist(this.failed.expected, this.failed.next);
        } else {
          this.failed = null;
          this.data = latest;
          requireData(latest, "Saved state missing.");
        }
      } else {
        this.data = latest;
      }
      if (!this.data) {
        this.busy = false;
        await this.init();
        return;
      }
      await auditSnapshot(this.data);
      this.startClock();
      this.status = "ready";
      this.error = "";
    } catch (e) {
      this.error = e.message;
      if (this.port.deleted || e instanceof PracticeDataDeletedError) this.clearDeletedState();
      else this.status = /another tab|revision changed|ownership/i.test(this.error) ? "readonly" : "error";
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async takeOver() {
    if (this.busy) return;
    if (!this.port.takeOver) {
      await this.retry();
      return;
    }
    this.busy = true;
    this.emit();
    try {
      await this.port.takeOver();
      this.failed = null;
      this.data = await this.port.load();
      requireData(this.data, "Saved state missing. Retry initialization.");
      await auditSnapshot(this.data);
      this.status = "ready";
      this.error = "";
      this.startClock();
    } catch (e) {
      this.error = e.message;
      if (this.port.deleted || e instanceof PracticeDataDeletedError) this.clearDeletedState();
      else this.status = "error";
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async adjustBankroll(targetCents, note, reset = false) {
    await this.mutate(async (d) => {
      requireData(cents(targetCents) && targetCents <= 1e12, "Choose a virtual bankroll between $0 and $10 billion.");
      requireData(typeof note === "string" && note.trim().length > 0 && note.length <= 200, "Enter a short adjustment reason.");
      if (reset) {
        d.epoch++;
        d.initialBankroll = targetCents;
      }
      await appendMoney(d, { id: id(reset ? "reset" : "adjustment"), kind: reset ? "reset" : "adjustment", at: now(), epoch: d.epoch, walletDelta: targetCents - d.wallet, tableDelta: 0, pokerNet: 0, note: note.trim() });
    });
  }
  async startSession(settings) {
    await this.mutate(async (d) => {
      requireData(!d.active, "Cash out the existing session before starting another.");
      const savedSettings = normalizeTableSettings(settings), seats = tableParticipants(savedSettings), profiles = tableProfiles(savedSettings);
      const buyIn = seats.find((s) => s.id === 0).stack;
      requireData(buyIn <= d.wallet, "Insufficient wallet funds. Adjust your virtual bankroll in Cashier.");
      const sessionId = id("session"), timestamp3 = now(), profile = rules(savedSettings);
      const game = startHand({ handId: newHandId(), seats, button: 0, profile });
      delete savedSettings.seatStacks;
      d.sessions.push({ id: sessionId, epoch: d.epoch, startedAt: timestamp3, endedAt: null, settings: savedSettings, profile, buyIns: buyIn, cashOut: 0, activeMs: 0, lastActiveAt: null, handIds: [] });
      d.active = { sessionId, game, profiles, number: 1, startedAt: timestamp3, frames: [projectView(game, 0)], paused: false, pending: null, exitMode: null };
      recordConfigurationBoundary(d);
      await appendMoney(d, { id: `buy-in:${sessionId}`, kind: "buy-in", at: timestamp3, epoch: d.epoch, walletDelta: -buyIn, tableDelta: buyIn, pokerNet: 0, sessionId, note: "Wallet to table" });
      await this.settle(d);
    });
  }
  async savePreset(name, settings, presetId) {
    await this.mutate(async (d) => {
      saveNamedPreset(d, { id: presetId ?? id("preset"), name, settings, at: now() });
    });
  }
  async clonePreset(sourceId, name) {
    await this.mutate(async (d) => {
      cloneNamedPreset(d, sourceId, { id: id("preset"), name, at: now() });
    });
  }
  loadPreset(presetId) {
    requireData(this.data, "Saved data unavailable.");
    return loadNamedPreset(this.data, presetId);
  }
  async queueConfiguration(settings, expectedSessionId, expectedHandId) {
    await this.mutate(async (d) => {
      queueTableConfiguration(d, { id: id("configuration"), settings, expectedSessionId, expectedHandId, at: now() });
    });
  }
  async cancelQueuedConfiguration(expectedSessionId, requestId) {
    await this.mutate(async (d) => {
      cancelQueuedConfiguration(d, expectedSessionId, requestId);
    });
  }
  async topUp(amount) {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && a.game.street === "complete", "Finish the hand before adding chips.");
      const s = d.sessions.find((s2) => s2.id === a.sessionId);
      requireData(!a.exitMode, "This session is ending; no more chips can be added.");
      requireData(s.settings.allowTopUp, "Top-ups are disabled for this table.");
      requireData(cents(amount) && amount > 0 && amount <= d.wallet, "Choose a positive top-up within wallet funds.");
      const transferId = id("top-up");
      a.game = topUpTable(a.game, 0, amount, transferId, s.settings.maxBuyInBB * s.profile.bigBlind);
      s.buyIns += amount;
      await appendMoney(d, { id: transferId, kind: "top-up", at: now(), epoch: d.epoch, walletDelta: -amount, tableDelta: amount, pokerNet: 0, sessionId: s.id, note: "Wallet to table; next-hand chips" });
    });
  }
  async closeSession(d) {
    if (!d.active) return;
    const a = d.active;
    requireData(a.game.street === "complete", "Finish the active hand before cashing out.");
    const s = d.sessions.find((s2) => s2.id === a.sessionId);
    const amount = a.game.seats.find((s2) => s2.id === 0).stack;
    await appendMoney(d, { id: `cash-out:${s.id}`, kind: "cash-out", at: now(), epoch: d.epoch, walletDelta: amount, tableDelta: -amount, pokerNet: 0, sessionId: s.id, note: "Table to wallet" });
    s.cashOut = amount;
    s.endedAt = now();
    s.lastActiveAt = null;
    d.active = null;
  }
  async cashOut() {
    await this.mutate((d) => this.closeSession(d));
  }
  async requestEndSession(mode, expectedSessionId, expectedHandId) {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && a.sessionId === expectedSessionId && a.game.handId === expectedHandId, "This session or hand has changed. Review the current table before ending it.");
      requireData(mode === "finish" || mode === "fold", "Choose how to finish the hand.");
      requireData(!a.exitMode || a.exitMode === mode, "This session is already ending.");
      a.exitMode = mode;
      a.paused = false;
      await this.advanceExit(d);
      await this.settle(d);
    });
  }
  async advanceExit(d) {
    const a = d.active;
    if (!a || a.exitMode !== "fold" || a.game.actor !== 0 || a.game.street === "complete") return;
    const { handId, revision } = a.game;
    a.game = applyCommand(a.game, { handId, revision, seatId: 0, decisionId: `exit:${handId}:${revision}`, action: { type: "fold" } });
    a.frames.push(projectView(a.game, 0));
  }
  async nextHand() {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && a.game.street === "complete", "Finish the current hand first.");
      requireData(!a.exitMode, "This session is ending.");
      const changed = await applyQueuedConfiguration(d, { reconfigure: reconfigureTable, rules, at: now() });
      requireData(a.game.seats.find((s) => s.id === 0).stack > 0, "Add chips or cash out before dealing.");
      a.game = nextHand(a.game, newHandId());
      a.number++;
      a.startedAt = now();
      a.frames = [projectView(a.game, 0)];
      a.pending = null;
      a.paused = false;
      recordConfigurationBoundary(d, changed);
      await this.settle(d);
    });
  }
  async act(action, handId, revision) {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && !a.paused && a.game.actor === 0, "Action is not on Hero.");
      requireData(a.exitMode !== "fold", "Fold and leave is already committed.");
      requireData(a.game.handId === handId && a.game.revision === revision, "Obsolete action rejected.");
      a.game = applyCommand(a.game, { handId, revision, seatId: 0, decisionId: `hero:${handId}:${revision}`, action });
      a.frames.push(projectView(a.game, 0));
      await this.settle(d);
    });
  }
  async setPaused(paused) {
    await this.mutate(async (d) => {
      if (d.active) d.active.paused = paused;
    });
  }
  async prepareBot() {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && !a.paused && a.game.actor !== null && a.game.actor !== 0, "No bot action is pending.");
      if (a.pending) return;
      const actor = a.game.actor;
      const p = a.profiles[actor];
      requireData(p && supportedPolicy(p.policyVersion), "This saved policy version is unavailable. The table has been preserved.");
      const drawToken = crypto.getRandomValues(new Uint32Array(1))[0];
      a.pending = { handId: a.game.handId, revision: a.game.revision, seatId: actor, decisionId: `bot:${a.game.handId}:${a.game.revision}:${actor}`, policyVersion: p.policyVersion, drawToken, decision: null };
    });
    if (this.status !== "ready" || !this.data?.active?.pending || this.data.active.pending.decision) return;
    await this.mutate(async (d) => {
      const a = d.active;
      const p = a.pending;
      const base = observeBot(a.game, p.seatId, p.policyVersion, p.decisionId);
      const observation = timed("bot.publicMemory", () => withPublicContext(base, a.game.profile.rake, a.profiles[p.seatId], d.hands, a.sessionId));
      p.decision = timed("bot.policy", () => chooseDecision8(observation, a.profiles[p.seatId], seeded(p.drawToken)));
    });
  }
  async commitBot(handId, revision) {
    await this.mutate(async (d) => {
      const a = d.active;
      requireData(a && !a.paused && a.game.handId === handId && a.game.revision === revision, "Obsolete bot callback rejected.");
      const p = a.pending;
      requireData(p?.decision && p.handId === handId && p.revision === revision && p.policyVersion === a.profiles[p.seatId]?.policyVersion, "Bot decision was not durably prepared.");
      const legal = legalActions(a.game), proposal = p.decision, action = proposal.action, unit8 = a.game.profile.chipUnit;
      const identity2 = proposal.handId === p.handId && proposal.revision === p.revision && proposal.seatId === p.seatId && proposal.decisionId === p.decisionId && proposal.policyVersion === p.policyVersion;
      const actionLegal = !!action && (action.type === "fold" ? legal.fold : action.type === "check" ? legal.check : action.type === "call" ? legal.callAmount > 0 : action.type === "raise" ? legal.canRaise && Number.isSafeInteger(action.to) && action.to % unit8 === 0 && action.to <= legal.maxRaiseTo && (action.to >= legal.minRaiseTo || action.to === legal.shortAllInTo) : false);
      const publicAction = action?.type === "raise" ? Number.isSafeInteger(action.to) ? { type: "raise", to: action.to } : null : action && ["fold", "check", "call"].includes(action.type) ? { type: action.type } : null;
      let command = { handId: p.handId, revision: p.revision, seatId: p.seatId, decisionId: p.decisionId, policyVersion: p.policyVersion, action: publicAction };
      if (!identity2 || !actionLegal) {
        const fallback = legal.check ? { type: "check" } : { type: "fold" };
        const violation = { id: `violation:${p.decisionId}`, at: now(), handId: p.handId, revision: p.revision, seatId: p.seatId, policyVersion: p.policyVersion, proposedAction: publicAction, fallback, reason: !identity2 ? "Invalid proposed action identity" : "Proposed action rejected by legal bounds" };
        requireData(!d.policyViolations?.some((v) => v.id === violation.id), "Duplicate policy violation.");
        d.policyViolations = [...d.policyViolations ?? [], violation];
        command = { handId: p.handId, revision: p.revision, seatId: p.seatId, decisionId: p.decisionId, policyVersion: p.policyVersion, action: fallback };
      }
      a.game = applyCommand(a.game, command);
      a.pending = null;
      a.frames.push(projectView(a.game, 0));
      await this.advanceExit(d);
      await this.settle(d);
    });
  }
  async settle(d) {
    const a = d.active;
    if (!a || a.game.street !== "complete") return;
    if (d.hands.some((h) => h.id === a.game.handId)) {
      if (a.exitMode) await this.closeSession(d);
      return;
    }
    assertAccounting(a.game);
    const view = projectView(a.game, 0);
    const hero = view.seats.find((s) => s.id === 0);
    const net = hero.stack - hero.startingStack;
    const endedAt = now();
    const record = { id: a.game.handId, sessionId: a.sessionId, epoch: d.sessions.find((s) => s.id === a.sessionId).epoch, number: a.number, startedAt: a.startedAt, endedAt, view, frames: structuredClone(a.frames), net, provenance: makeCashHandProvenance(view.profile), ...a.configuration ? { configuration: structuredClone(a.configuration) } : {}, privateProfiles: structuredClone(a.profiles), previousHash: d.hands.at(-1)?.hash ?? GENESIS, hash: "" };
    d.hands = [...d.hands, await seal(record)];
    const session = d.sessions.find((s) => s.id === a.sessionId);
    session.handIds = [...session.handIds, record.id];
    a.pending = null;
    await appendMoney(d, { id: `settle:${record.id}`, kind: "hand-net", at: endedAt, epoch: record.epoch, walletDelta: 0, tableDelta: net, pokerNet: net, sessionId: a.sessionId, handId: record.id, note: "Settled hand net after rake; refunds included" });
    if (a.exitMode) await this.closeSession(d);
  }
  async savePlayerNote(sessionId, seatId, text, expectedNoteRevision = 0) {
    if (this.busy || this.status !== "ready" || !this.data) return false;
    await this.mutate(async (data) => {
      data.userNotes = savePlayerNote(data, sessionId, seatId, text, expectedNoteRevision);
    });
    return !this.error && getPlayerNote(this.data, sessionId, seatId)?.text === text.trim();
  }
  async deletePlayerNote(sessionId, seatId, expectedNoteRevision) {
    if (this.busy || this.status !== "ready" || !this.data) return false;
    await this.mutate(async (data) => {
      data.userNotes = deletePlayerNote(data, sessionId, seatId, expectedNoteRevision);
    });
    return !this.error && !getPlayerNote(this.data, sessionId, seatId);
  }
  async exportHistory() {
    requireData(this.data, "No saved history available.");
    return publicHistory(this.data.hands);
  }
  async importHistory(text) {
    await this.mutate(async (d) => {
      const imported = await parsePublicHistory(text);
      const known = new Set(d.importedHands.map((h) => h.handId));
      d.importedHands = [...d.importedHands, ...imported.filter((h) => !known.has(h.handId))];
    });
  }
  async importSelectedStudyHands(preview, indices) {
    await this.mutate(async (d) => {
      const selected = selectPublicStudyRows(preview, indices), known = new Map(d.importedHands.map((h) => [h.handId, h]));
      for (const hand of selected) {
        const prior = known.get(hand.handId);
        requireData(!prior || canonical3(prior) === canonical3(hand), "A different imported record already uses this hand identity. No records were replaced.");
        known.set(hand.handId, hand);
      }
      const existing = new Set(d.importedHands.map((h) => h.handId));
      d.importedHands = [...d.importedHands, ...selected.filter((h) => !existing.has(h.handId))];
    });
  }
  async deleteSavedPracticeData(confirmation) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.emit();
    try {
      requireData(confirmation === DELETE_PRACTICE_CONFIRMATION, "Type the exact deletion confirmation.");
      requireData(this.status === "ready" && this.data && this.owns(), "An owned ready save is required for deletion.");
      requireData(this.data.active === null, "End and cash out the table before deleting saved practice data.");
      requireData(this.port.erase, "This storage environment does not support safe deletion.");
      await this.port.erase(this.data.revision);
      this.clearDeletedState();
    } catch (e) {
      this.error = e.message;
      if (this.port.deleted || e instanceof PracticeDataDeletedError) this.clearDeletedState();
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async startFreshPracticeData() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.emit();
    try {
      requireData(this.status === "deleted" && this.port.startFresh, "Delete saved practice data before explicitly starting fresh.");
      await this.port.startFresh(await this.initialGuestData());
      this.data = null;
      this.failed = null;
      this.busy = false;
      await this.init();
    } catch (e) {
      this.error = e.message;
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async protectStorage() {
    return this.port instanceof BrowserPersistence ? this.port.requestProtection() : false;
  }
};

// src/stats/projection.ts
var CASH_PROJECTION_VERSION = "cash-projection-1";
var empty = (key, label) => ({ key, label, hands: 0, profit: 0, rake: 0, byBlind: /* @__PURE__ */ new Map() });
function append(group, hand, rake) {
  group.hands++;
  group.profit += hand.net;
  group.rake += rake;
  const blind = hand.view.profile.bigBlind;
  group.byBlind.set(blind, (group.byBlind.get(blind) ?? 0) + hand.net);
}
function result(group) {
  const bb = [...group.byBlind].reduce((sum, [blind, net]) => sum + net / blind, 0);
  return { key: group.key, label: group.label, hands: group.hands, profit: group.profit, rake: group.rake, bb100: group.hands ? 100 * bb / group.hands : null };
}
var metricKeys = Object.keys(STAT_DEFINITIONS);
function rate9(numerator, denominator) {
  if (denominator === 0) return { numerator, denominator, percent: null, ci95: null, status: "NO_OPPORTUNITIES" };
  const p = numerator / denominator, z = 1.959963984540054, scale = 1 + z * z / denominator;
  const center = (p + z * z / (2 * denominator)) / scale;
  const radius = z * Math.sqrt((p * (1 - p) + z * z / (4 * denominator)) / denominator) / scale;
  return { numerator, denominator, percent: 100 * p, ci95: [100 * Math.max(0, center - radius), 100 * Math.min(1, center + radius)], status: denominator < 100 ? "INSUFFICIENT_SAMPLE" : "DESCRIPTIVE" };
}
var CashStatsProjection = class {
  history = null;
  immutable = /* @__PURE__ */ new WeakSet();
  ids = /* @__PURE__ */ new Set();
  sessionNumbers = /* @__PURE__ */ new Map();
  all = empty("cash", "All cash hands");
  sessionGroups = /* @__PURE__ */ new Map();
  positions = /* @__PURE__ */ new Map();
  stakes = /* @__PURE__ */ new Map();
  configurations = /* @__PURE__ */ new Map();
  configurationHistory = /* @__PURE__ */ new Map();
  counters = Object.fromEntries(metricKeys.map((k) => [k, [0, 0]]));
  complete = 0;
  diagnostics = { version: CASH_PROJECTION_VERSION, projectedHands: 0, cachedSnapshotHits: 0, mutableFallbacks: 0, rebuilds: 0, lastInvalidation: null, checkpoint: { hands: 0, lastId: null, lastHash: null } };
  getDiagnostics() {
    return { ...this.diagnostics, checkpoint: { ...this.diagnostics.checkpoint } };
  }
  reset(reason = "explicit recovery or data/rules/policy version change") {
    this.history = null;
    this.ids.clear();
    this.sessionNumbers.clear();
    this.all = empty("cash", "All cash hands");
    this.sessionGroups.clear();
    this.positions.clear();
    this.stakes.clear();
    this.configurations.clear();
    this.configurationHistory.clear();
    this.counters = Object.fromEntries(metricKeys.map((k) => [k, [0, 0]]));
    this.complete = 0;
    this.diagnostics.rebuilds++;
    this.diagnostics.lastInvalidation = reason;
    this.diagnostics.checkpoint = { hands: 0, lastId: null, lastHash: null };
  }
  isImmutable(value, visiting = /* @__PURE__ */ new WeakSet()) {
    if (value === null || typeof value !== "object") return true;
    if (this.immutable.has(value)) return true;
    if (!Object.isFrozen(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
    if (visiting.has(value)) return false;
    visiting.add(value);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!("value" in descriptor) || !this.isImmutable(descriptor.value, visiting)) {
        visiting.delete(value);
        return false;
      }
    }
    visiting.delete(value);
    this.immutable.add(value);
    return true;
  }
  validateSequence(records, start) {
    const ids = new Set(this.ids), numbers = new Map(this.sessionNumbers);
    let previous = start ? records[start - 1].hash : "0".repeat(64);
    for (let i = start; i < records.length; i++) {
      const hand = records[i];
      assertCashHandProvenance(hand);
      if (typeof hand.id !== "string" || !hand.id || ids.has(hand.id)) throw new Error("Duplicate or missing canonical hand ID");
      if (hand.previousHash !== previous) throw new Error("Statistics history gap or out-of-order chain");
      if (hand.number !== (numbers.get(hand.sessionId) ?? 0) + 1) throw new Error("Statistics session hand sequence has a gap or is out of order");
      if (hand.view.street !== "complete" || hand.view.profile.mode !== "cash") throw new Error("Statistics projection requires canonical settled cash hands");
      ids.add(hand.id);
      numbers.set(hand.sessionId, hand.number);
      previous = hand.hash;
    }
  }
  add(hand) {
    const one = deriveCashStats([hand], [], 0);
    const row = one.configurationHistory[0], history = this.configurationHistory.get(row.key) ?? { row: { ...row, hands: 0, profit: 0, bb100: null }, aggregate: empty(row.key, "") };
    append(history.aggregate, hand, one.rake);
    history.row.firstHandNumber = Math.min(history.row.firstHandNumber, hand.number);
    history.row.lastHandNumber = Math.max(history.row.lastHandNumber ?? 0, hand.number);
    if (hand.startedAt < history.row.startedAt) history.row.startedAt = hand.startedAt;
    this.configurationHistory.set(row.key, history);
    append(this.all, hand, one.rake);
    const session = this.sessionGroups.get(hand.sessionId) ?? empty(hand.sessionId, "");
    append(session, hand, one.rake);
    this.sessionGroups.set(hand.sessionId, session);
    for (const [map, groups] of [[this.positions, one.positions], [this.stakes, one.stakes], [this.configurations, one.configurations]]) {
      for (const group of groups) {
        const aggregate = map.get(group.key) ?? empty(group.key, group.label);
        append(aggregate, hand, one.rake);
        map.set(group.key, aggregate);
      }
    }
    for (const key of metricKeys) {
      this.counters[key][0] += one.metrics[key].numerator;
      this.counters[key][1] += one.metrics[key].denominator;
    }
    this.complete += one.opportunityCoverage.completeHands;
    this.ids.add(hand.id);
    this.sessionNumbers.set(hand.sessionId, hand.number);
    this.diagnostics.projectedHands++;
  }
  derive(records, sessions, now2 = Date.now()) {
    if (records === this.history) this.diagnostics.cachedSnapshotHits++;
    else {
      if (!isVerifiedHistory(records) && !this.isImmutable(records)) {
        this.reset("mutable history requires independent full replay");
        this.diagnostics.mutableFallbacks++;
        return deriveCashStats([...records], [...sessions], now2);
      }
      if (this.history && (records.length < this.history.length || this.history.some((record, index2) => records[index2] !== record))) this.reset("history prefix replaced, removed, reordered or version changed");
      const start = this.history?.length ?? 0;
      this.validateSequence(records, start);
      try {
        for (let i = start; i < records.length; i++) this.add(records[i]);
      } catch (error) {
        this.reset("projection failed; next call must rebuild");
        throw error;
      }
      this.history = records;
      const last = records.at(-1);
      this.diagnostics.checkpoint = { hands: records.length, lastId: last?.id ?? null, lastHash: last?.hash ?? null };
    }
    const sessionResults = sessions.map((session) => {
      const activeMs2 = session.activeMs + (session.endedAt === null && session.lastActiveAt !== null ? Math.max(0, now2 - session.lastActiveAt) : 0);
      const group = result(this.sessionGroups.get(session.id) ?? empty(session.id, session.startedAt));
      return { ...group, label: session.startedAt, id: session.id, startedAt: session.startedAt, endedAt: session.endedAt, activeMs: activeMs2, perHour: activeMs2 > 0 ? group.profit * 36e5 / activeMs2 : null };
    });
    const all = result(this.all), activeMs = sessionResults.reduce((sum, session) => sum + session.activeMs, 0);
    const stakes = [...this.stakes.values()].map(result);
    return {
      ...all,
      namespace: "cash",
      activeMs,
      perHour: activeMs > 0 ? all.profit * 36e5 / activeMs : null,
      winningSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit > 0).length,
      losingSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit < 0).length,
      evenSessions: sessionResults.filter((s) => s.endedAt !== null && s.profit === 0).length,
      activeSession: sessionResults.find((s) => s.endedAt === null) ?? null,
      sessions: sessionResults,
      mixedStakes: stakes.length > 1,
      metrics: Object.fromEntries(metricKeys.map((key) => [key, rate9(...this.counters[key])])),
      positions: [...this.positions.values()].map(result),
      stakes,
      configurations: [...this.configurations.values()].map(result),
      configurationHistory: includeConfigurationBoundaries([...this.configurationHistory.values()].map(({ row, aggregate }) => {
        const total = result(aggregate);
        return { ...row, hands: total.hands, profit: total.profit, bb100: total.bb100 };
      }), sessions),
      disclosure: `Observed virtual cash simulation only. ${all.hands} settled hands; ${sessionResults.length} sessions. ${CASH_STAT_FORMULAS.uncertainty} ${CASH_STAT_FORMULAS.rake}`,
      opportunityCoverage: { completeHands: this.complete, missingFrames: all.hands - this.complete }
    };
  }
};
export {
  BrowserPersistence,
  CashStatsProjection,
  DEFAULT_SETTINGS,
  POLICY_VERSION,
  SessionController,
  canonical3 as canonical,
  digest,
  observeTimings,
  supportedPolicy,
  validateData
};
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
