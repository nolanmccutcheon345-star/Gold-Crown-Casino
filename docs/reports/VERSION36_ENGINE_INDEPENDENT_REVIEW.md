# Version 36 independent B1 engine review

Reviewed engine source from commit `7c86b0eb7769fbb0afc06e0afcf533622729a586` on 2026-11-16 UTC. This review did not author or modify the reducer. The reviewed code remains an isolated headless classic-blackjack milestone, not a playable or durable-storage release.

## Actual execution

- `npx vitest run tests/blackjack/engine.test.ts --reporter=verbose`: 39 passed, 0 failed, 0 skipped; 2.73 s at 22:37:39 UTC. This includes the author's 250-round conservation/replay scenario.
- `npx vitest run tests/blackjack/engine-independent.test.ts --reporter=verbose`: 10 passed, 0 failed, 0 skipped; 0.808 s at 22:39:09 UTC.
- New independent tests cover 25 rounds at each of the eight classic catalogue tables (200 rounds total), split siblings with different outcomes, and equality of public views when only the hidden hole/future cards differ.
- The independent payout oracle calculates totals and returns directly from card ranks, rules, final hands and insurance stakes, without importing engine hand-total or payout helpers. Every round checks exact net and wallet conservation, one settlement record, inert command retries and full JSON replay.
- Lint of the added test file and project typecheck both exited 0.

## Findings and limits

No critical payout or rules defect was reproduced in these runs. The tests substantiate a separate $2,000 default balance, per-round fees, natural versus split-21 treatment, ordinary win/loss/push accounting, split/double stakes, late surrender and insurance in the exercised cases. The new independent oracle deliberately excludes even-money commands; existing reducer fixtures cover them.

Before live integration, the reducer still needs durable transactional storage, versioned migration, UI wiring and end-to-end recovery qualification. The reducer explicitly rejects Free Bet and side bets. It clones growing state and independently replays the full journal for restoration; these correctness scaffolds are not a proven long-session storage/performance solution. Shoe exhaustion fails atomically, but that is not evidence of an implemented resumable exhaustion procedure for arbitrary future rule/penetration configurations.

No browser gameplay, real-device result, expert blackjack-strategy review, real-money edge, or human calibration is claimed by this headless review. Production and R1 test deployments were not changed.
