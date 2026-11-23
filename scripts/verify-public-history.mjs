import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Independent event-accounting audit. No engine or policy imports. */
export function verifyPublicHistory(payload) {
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const cents = value => Number.isSafeInteger(value) && value >= 0;
  require(payload.format === 'ai-texas-hold-em-public-history', 'Unknown export format');
  require(Array.isArray(payload.hands) && payload.hands.length > 0, 'No completed hands');
  const handIds = new Set();
  let prior = null;
  const summaries = payload.hands.map(({ kind, handId, view }) => {
    require(kind === 'public-redacted' && handId === view.handId && !handIds.has(handId), 'Invalid or duplicate hand');
    handIds.add(handId);
    require(view.street === 'complete' && view.actor === null && view.pot === 0, 'Hand not settled');
    require(!('deck' in view) && !('burned' in view), 'Private deck in export');
    const balances = new Map();
    for (const seat of view.seats) {
      require(!balances.has(seat.id) && cents(seat.startingStack) && cents(seat.stack), 'Invalid seat balance');
      if (prior) require(prior.get(seat.id) === seat.startingStack, 'Next-hand stack discontinuity');
      balances.set(seat.id, seat.startingStack);
    }
    if (prior) for (const [id, stack] of prior) require(stack === 0 || balances.has(id), 'Funded seat disappeared');
    const ids = new Set(); const decisions = new Set(); const awards = {};
    let committed = 0, refunds = 0, rake = 0, awarded = 0;
    for (const event of view.events) {
      require(event.handId === handId && !ids.has(event.id), 'Invalid or duplicate event'); ids.add(event.id);
      if (event.type === 'action') {
        require(event.decisionId && !decisions.has(event.decisionId), 'Duplicate decision'); decisions.add(event.decisionId);
      }
      if (!['blind', 'action', 'refund', 'award', 'rake'].includes(event.type)) continue;
      require(cents(event.amount), 'Invalid event amount');
      if (event.type === 'rake') { rake += event.amount; continue; }
      require(balances.has(event.seatId), 'Unknown event seat');
      const debit = event.type === 'blind' || event.type === 'action';
      const next = balances.get(event.seatId) + (debit ? -event.amount : event.amount);
      require(cents(next), 'Event creates negative or fractional stack'); balances.set(event.seatId, next);
      if (debit) committed += event.amount;
      if (event.type === 'refund') refunds += event.amount;
      if (event.type === 'award') { awarded += event.amount; awards[event.seatId] = (awards[event.seatId] ?? 0) + event.amount; }
    }
    require(committed - refunds === awarded + rake, 'Pot does not balance');
    require(rake === view.rake, 'Rake mismatch');
    const rules = view.profile.rake;
    require(cents(rules.basisPoints) && rules.basisPoints <= 10000 && cents(rules.cap), 'Invalid rake profile');
    const eligibleForRake = !rules.noFlopNoDrop || view.board.length >= 3;
    const expectedRake = eligibleForRake ? Math.min(rules.cap, Number(BigInt(committed - refunds) * BigInt(rules.basisPoints) / 10000n)) : 0;
    require(rake === expectedRake, 'Rake differs from frozen practice profile');
    require(view.pots.reduce((sum, pot) => sum + pot.amount, 0) === awarded, 'Pot awards mismatch');
    require(JSON.stringify(Object.entries(awards).sort()) === JSON.stringify(Object.entries(view.payouts).sort()), 'Payout mismatch');
    for (const seat of view.seats) require(balances.get(seat.id) === seat.stack, 'Final stack differs from event replay');
    const starting = view.seats.reduce((sum, seat) => sum + seat.startingStack, 0);
    const ending = view.seats.reduce((sum, seat) => sum + seat.stack, 0);
    require(starting === ending + rake, 'Chip conservation failed');
    const cards = [...view.board, ...view.seats.flatMap(seat => seat.hole)];
    require(new Set(cards).size === cards.length && cards.every(card => /^[2-9TJQKA][cdhs]$/.test(card)), 'Invalid or repeated visible card');
    prior = balances;
    return { handId, status: 'PASS', actions: decisions.size, startingCents: starting, committedCents: committed,
      refundedCents: refunds, contestableCents: committed - refunds, awardedCents: awarded, rakeCents: rake,
      endingCents: ending, payoutsCents: view.payouts };
  });
  return { status: 'PASS', method: 'Independent public event accounting; no engine imports', hands: summaries };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/verify-public-history.mjs exported-history.json');
  console.log(JSON.stringify(verifyPublicHistory(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
}
