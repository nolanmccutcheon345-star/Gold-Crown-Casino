# Step 5B statistics implementation and evidence

This isolated workstream changes `src/stats/cash.ts` and adds `src/stats/projection.ts`. It does not change the authoritative poker engine, ledger, imported study history, canonical records, or any original acceptance criterion.

## Acceptance mapping (supporting evidence, not an overall requirement PASS)

| Original ID | Source criterion | Implemented evidence | Remaining integration evidence |
|---|---|---|---|
| V421 | VPIP/PFR/3bet/raise/check-raise/fold-to-Cbet use eligible node opportunities; demonstrable histories; minimum N and CI or insufficient sample | `opportunities.test.ts`; all 19 prior statistics regressions; 100-opportunity boundary, Wilson interval, legal short all-ins, closed raising rights, multiway public sequences, absent frames | UI must visibly show each count/denominator and uncertainty; root browser gate |
| G04 | +10 BB/100 at 30 hands/hour yields projected +3 BB/hour, labelled projected | `projection.test.ts` uses independent explicit expected 3 BB/hour | Visible assumption-driven UI/root browser gate |
| X10 | 300 fast simulated hands at 30 hands/hour assumption show actual elapsed time separately from 10 live-equivalent hours | `projection.test.ts` checks actual 1 hour versus hypothetical 10 hours; $60 actual/hour versus hypothetical $6/hour at $1/$2 | Root browser execution and labels |
| V613 | Observed BB/100 unaffected by animation speed; actual clock cash/hour varies with duration; live-paced model assumption visible | Identical legal hand records with different actual session clocks; measured rate changes while BB/100 and projected pace stay invariant | Live/fast UI/browser integration |

No original acceptance tracker was modified by this workstream. Executable test counts are not mapped-requirement counts.

## Exact new denominator definitions

- **Postflop raise** counts each Hero decision facing a positive call amount with legal raising rights. A legal short all-in raise is eligible. An opening bet, closed raising after an insufficient all-in, or an all-in-only call is not a raise opportunity.
- **Check-raise** counts the first priced response after Hero checked on that street, only if raising is legal. Calling/folding consumes that opportunity; calling then later reraising the same street does not become a check-raise. Multiway opportunities are retained where legal.
- **Fold to flop cbet** counts a Hero response to the first flop bet by the final preflop aggressor, before any intervening raise. Intervening calls are allowed. Donk bets, limped pots, delayed turn bets and players without a response opportunity are excluded. This metric explicitly does not claim to count turn/river continuation bets.
- Missing postflop pre-action frames exclude the affected postflop metrics rather than inventing opportunities; known preflop metrics remain available. All rates show numerator/denominator, descriptive 95% Wilson intervals, and `INSUFFICIENT_SAMPLE` below 100 opportunities. No-opportunity rates and intervals are null. Session-correlated opportunities do not establish a calibrated skill confidence estimate.

Fixtures specify exact legal seat/action order before asserting independently counted numerators and denominators. Shared hand analysis is used by incremental and full calculation, while aggregation is independently implemented. Independent fixture expectations separately verify the definition itself, including the missed check-raise case.

## Projection safety and performance

`CashStatsProjection.derive(records,sessions,now)` is a disposable read-only projection; `deriveCashStats` remains the full-history reference. It aggregates newly committed canonical hands once and rereads active session clocks/closure each call. By-blind integer net accumulation produces exact mixed-stake BB/100 agreement. Manual wallet resets, buys, top-ups, withdrawals and cashouts never enter hand-result profit. Imported study records remain outside the canonical `StoredHand[]` input.

The cache reuses historical work only for immutable snapshots. `isVerifiedHistory` from the storage validator privately brands histories only after cryptographic canonical audit or a checked immutable append. That capability skips duplicate recursive immutability inspection; a matching public hash or manually frozen clone cannot create it. Unbranded immutable histories still receive a recursive immutability check. A populated legacy fixture test proves this audited capability branch against full replay. Mutable input always runs full reference replay, even when caller-provided hashes have not changed. It checks exact immutable prefixes, IDs, sequence links, and per-session hand numbers. A rejected append does not partially update the last good aggregate. Replaced/restored records invalidate the projection. Schema/data/rule/policy changes cannot reuse mutable or replaced historical content. Matching public hash strings are never used as authority to skip validation. This cache is **not** a replacement for cryptographic storage validation or authoritative ledger reconciliation.

`getDiagnostics()` reports version, processed hand count, cache hits, mutable fallback, rebuild reason, and last committed ID/hash/length checkpoint. Returned UI results are fresh values, so consumer mutation cannot poison cached state.

## Executed microbenchmark

Reproduce: `node_modules/.bin/vite-node tests/step5b-statistics/profile.ts`.

`evidence/stats-microbenchmark.json` records 0, 100, 500, 1,000 and 5,000 saved-hand inputs at 2, 6 and 10 seats. Each full/reused aggregation has 30 samples, nearest-rank p50/p95/p99/max, initial rebuild, append-one timing, record bytes, environment, and exact full-reference equality checks at each size and append. With 30 samples, p99 equals the maximum and is not a robust device-wide tail estimate.

This **Node-only statistics microbenchmark** uses legal preflop-fold walk templates with distinct record/event IDs. It excludes browser rendering, policy evaluation, storage and cryptographic validation. It cannot establish bot-preparation or mobile responsiveness targets. The first cold projection includes deep immutability inspection; its cost is separately reported, not hidden in the reuse timing.

At 5,000 saved hands on the recorded Node 24 / Linux / AMD EPYC environment:

| Seats | Full stats p95 ms | Reused stats p95 ms | Cold build ms | Append one ms |
|---|---:|---:|---:|---:|
| 2 | 69.420 | 0.059 | 421.656 | 4.852 |
| 6 | 64.593 | 0.042 | 960.671 | 2.682 |
| 10 | 109.605 | 0.005 | 1768.026 | 2.926 |

The immutable projection removes repeated full-history statistics aggregation from ordinary actions. Initial loading and recovery remain work that requires explicit measurement and a verified immutable boundary; those timings are not claimed as optimized by this table.

## Executed regression

- Statistics-only suite after integration with performance checkpoint: 56 tests (19 existing + 37 new), zero failures.
- Broader prior-baseline engine/session-accounting/history regression invocation: 89 tests across 8 files, zero failures, 72.16 seconds (`evidence/regression.log`). Includes two independent 200-hand mixed-stake sessions with manual reset, top-up, recovery and cashout; the additional audited-capability test was added afterward.
- TypeScript and scoped ESLint checks: exit 0 (`evidence/typecheck.log`, `evidence/lint.log`).
- UI/browser checks are owned by the parent integration workstream and are not claimed executed here.
