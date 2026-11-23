# Step5B mechanical acceptance audit

Audited the current root `ACCEPTANCE_STATUS.csv` without modifying it. Original
A01–A10, B01–B19 and C01–C14 are already PASS; there are no P-prefixed original
rows. V503 is the suit-permutation requirement, not the differential state oracle.

| Original ID | Exact criterion / relevant original wording | Executed evidence and proposed mapping | Remaining scope |
|---|---|---|---|
| V502 | “Replay identical legal actions against independent reference engine for matched supported rule settings; compare active actor, wagers, refunds, eligible pots, and final awards; mark unsupported rules explicitly.” | New `pokerkit-trace.test.ts` + `pokerkit_trace.py`: PASS, 18 full seeded hands, 219 proposed actions, 81 collected-pot checkpoints, 4 refund hands, 5 side-pot hands, 18 folds. Independent PokerKit 0.7.7 agrees on active actors, wager amounts, stacks, active-street commitments, eligible pots, refunds and final awards. Complete inputs/expected/actual and environment in `pokerkit-trace-evidence.json`; runnable result in `pokerkit-trace-result.json`. Suitable evidence for the original requirement's explicitly supported matched rule settings. | Supported: no-rake NLHE cash showdown, integer units 1/5/100 cents, fixed starting button, 2/3/6 players. No claim for rake callbacks, ante/straddle/tournaments or all-fold return representation in this adapter. Other independent tests cover those supported cash mechanics; tournament/straddle remain unavailable. |
| V503 | Suit relabel metamorphic property; consistently permuted suits preserve winner ranks, legal actions and chip results. | Already PASS. `tests/r1critical/metamorphic.test.ts`: 24 suit permutations across 54 seeded hands; included in the parent's executed complete regression. | No additional test or status change needed. |
| V504 | “All money uses exact smallest integer units. Convert stakes and all payments to units without floating drift; scaled cash fixtures preserve legal/action ratios and reconciliation.” | Engine component PASS: existing 54-hand 2x/5x/100x metamorphic scaling plus exact integral rake/refunds; new `denomination.test.ts` covers 1/5/25/100-cent units, input rejection, split/rake units and explicit residual transfers. New V502 independent unit conversion uses exact divisibility assertions. | Actual UI decimal input/display round-trip evidence must be attached by browser/integration owner before whole-row promotion; these tests do not exercise HTML input. |
| V407 | Odd chips in tied three-way side pots, including a tournament TDA fixture. | Cash component PASS in `tests/r1critical/metamorphic.test.ts`, exact 202/210/360 pots and 50/121/301/300 awards; `bot-pricing-denomination.test.ts` adds whole-unit side-pot ties independently. | Original tournament TDA clause remains unexecuted later scope. Do not mark the whole mixed criterion PASS based on cash alone. |
| V409 | TDA 2026 v1.1 example plus separate cash profile for actor-specific cumulative short all-ins. | Cash component PASS in `tests/oracle/step2-pokerkit.test.ts` and `tests/verification/step2-acceptance.test.ts`: short totals 140/180 do not reopen; 150/200 reopen. | Exact sourced TDA tournament fixture is not implemented here. Retain mixed-scope gap. |
| X04 / X09 / V414 | Versioned occupancy-dependent rake, two/three–four/five-plus dealt-in caps, no flop/no drop and source rounding. | `rake.test.ts`, independent `pokerstars-source.json`, `denomination.test.ts` and `bot-pricing-denomination.test.ts` now cover exact source rows, changing five-to-three actual occupancy, half-even ties, capped side pots, refunds before rake, split awards, immutable legacy profile and rejection of unlisted USD stakes. Official source retrieved 2026-11-01; exact URL/version preserved. | Only the declared USD regular-NLHE source is supported; no other venue, currency or Zoom profile claimed. UI configuration evidence belongs to integration owner. |
| V430 | Crash/refresh after bot command, street close, unmatched-return and payout equals uninterrupted state, no double payout. | Existing current-root `tests/step5b-acceptance/controller-boundaries.test.ts` now has exact three-boundary acknowledgement-loss tests, including refund-and-payout; existing `tests/step3/controller.test.ts` adds every street, pending reservation, failed write and lost acknowledgement. Parent reports these passed in its complete 867-test run. | Do not duplicate these tests. Browser crash/suspend evidence should remain distinct from injected persistence failures. |
| V606 | Genuine CSPRNG private snapshot resumes exact future cards/stacks/policy after preflop/bot action without double charge. | Existing `tests/step3/controller.test.ts` checks deep equality of private deck/cursor, frozen policies, frames and wallet on four streets, and exact pending-action recovery. Parent's actual browser pending-reload tests can supply the browser half. | Physical device/tab kill is separate V513 evidence, not implied by unit resume. |
| V701 | 100 rerenders/preparations plus pause/resume and retried callback retain one sampled action and one reducer event. | Current-root `tests/step5b-acceptance/controller-boundaries.test.ts` has the exact 100-preparation/controller/view/pause scenario; parent reports its executed PASS. Existing engine integration covers duplicate command identity. | A real UI rerender/timer journey is separate browser evidence; no claim made from pure projections alone. |
| V605 | Missing secure entropy prevents normal deal and gives actionable error; no Math.random fallback. | Engine fail-closed and production CSPRNG source tests already pass; current-root controller-boundary test verifies refusal without wallet debit. | UI error presentation is not exercised by this lane. |

## V502 adapter differences are explicit

PokerKit leaves already collected pots separate from outstanding street bets;
eligible-pot equality is therefore checked at its actual collection boundaries
and final settlement. Actor, wager and stack equality is checked after **every**
proposed action. The application retains settled street-commitment evidence while
PokerKit clears its working bets; active-street commitments are compared exactly.

One trace exposes a PokerKit zero-cost check from a sole matched funded player
with no legal raise after the other funded player folds. The application runs
out automatically. The adapter records and drains that administrative no-op only
when all three independent conditions hold; it does not inject any paid action
or choose any strategy. The exact normalization is retained in the JSON trace.

Initial harness runs exposed missing manual PokerKit runout-count automation and
this administrative no-op. These were adapter defects/representation differences,
not changed production expectations. No production engine changes were made.

Command actually run:

`PYTHONPATH=/workspace/scratch/4441cfdf5595/pokerkit-reference RUN_ORACLE=1 STEP5B_TRACE_REPORT=1 npm test -- tests/step5b-engine/pokerkit-trace.test.ts --reporter=json --outputFile=tests/step5b-engine/pokerkit-trace-result.json`

Result: **1 test passed, 0 failed**, containing the 18 full-hand differential
fixtures above. `npm run lint -- --quiet`: PASS. `npm run typecheck`: PASS after
the explicit trace-fixture type addition. These are automated-test counts,
not additional original V7 requirement IDs.
