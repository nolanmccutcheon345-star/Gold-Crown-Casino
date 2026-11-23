# Step 5A reliability and continuous-session evidence

This test lane does not modify production poker, wallet, statistics or bot systems. Browser harnesses are test-only and excluded from the production build. All 302 requirement IDs and 86 deferred items remain owned by the unchanged master packages and release dashboard.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| New composite reliability + continuous-session harness tests on policy 1.2 | PASS, 17/17 | `evidence/new-tests-baseline.log` |
| Existing session, statistics, storage, migration and exit tests on policy 1.2 | PASS, 81/81 | `evidence/recovery-regression-baseline.log` |
| Combined relevant tests on final candidate policy 1.3 | PASS, 98/98, 9 files | `evidence/recovery-regression-candidate.log` |
| TypeScript project check | PASS, exit 0 | `evidence/typecheck-candidate.log` |
| ESLint on owned TS harnesses/tests/scripts | PASS, exit 0 | `evidence/lint-candidate.log` (empty successful output) |
| Browser/endurance/recovery runs | NOT_EXECUTED by this lane; root runs actual browser | Test harnesses below; root browser evidence is authoritative |
| Physical iPhone Safari export | AWAITING USER VERIFICATION | No physical-device claim |
| Human calibration / expert strategic review | NOT_EXECUTED | Synthetic diagnostics only |

These are executable test counts, not 98 mapped V7 requirements. An initial test-authoring run failed eight new assertions because an intentionally stale callback correctly reports `Obsolete bot callback rejected`; the harness now asserts that rejection and exact unchanged state. No runtime behavior was changed to satisfy it.

The composite tests use actual current bots at 2, 6, 9 and 10 seats in both Live and Study configurations. Each completes three hands with parallel duplicate callbacks, an interrupted write or lost acknowledgement, repeated close/reopen, identity retention, completed-history study import twice, manual bankroll adjustment, and faulted final cashout/retry. Wallet/table/poker ledgers and immutable completed records reconcile. Imported study hands do not modify active game, wallet, recorded poker profit or original hand records. The short controller tests use isolated memory CAS storage; actual IndexedDB and multiple-tab evidence must come from the browser harness.

## Continuous populations

Preregistered plan: `population.ts` (`PLAN`), committed before candidate results. Each policy ran eight independent blocks per configuration, 25 consecutive hands per block: **1,600 hands and 15,043 actions per policy**, covering **1,600 paired worlds**, not 3,200 independent worlds. Exact records: `evidence/baseline-1.2/sessions.json.gz` and `evidence/candidate-1.3/sessions.json.gz`; summaries include source commit, SHA-256, definitions, counts, intervals and compute timings. Candidate runtime source: `e28359080990da862b98cfbbc59edec55b09fadf` (1.2 freeze, board-chop correction, forced-runout rake correction).

Stacks, dealer movement, identities and permitted observed memory carry between hands. Between-hand test topups use the authoritative `topUpTable` transition and debit a separately recorded simulation wallet. Every hand uses an independent event accountant; every session preserves wallet + table chips + accumulated rake. No stack is directly refilled, and topups are not counted as winnings. This is simulation funding, not a claim that production UI offers opponent rebuys.

| Configuration (200 hands each) | Limp / unopened priced opportunities | PFR / legal raising hand-opportunities | 3-bet / first legal re-raise opportunities | Flop hands | Multiway flop hands |
|---|---:|---:|---:|---:|---:|
| Loose-passive $1/$2 | 93/578 (16.1%) | 128/1170 (10.9%) | 17/311 (5.5%) | 110 | 51 |
| Recreational $1/$3 | 82/540 (15.2%) | 175/1185 (14.8%) | 29/448 (6.5%) | 125 | 55 |
| Mixed $2/$5 | 75/577 (13.0%) | 155/1167 (13.3%) | 27/380 (7.1%) | 102 | 39 |
| Aggressive $5/$10 | 29/574 (5.1%) | 209/1176 (17.8%) | 38/488 (7.8%) | 81 | 36 |
| Tough six-max | 1/605 (0.2%) | 198/1174 (16.9%) | 24/539 (4.5%) | 41 | 22 |
| Heads-up | 0/200 | 139/327 (42.5%) | 12/127 (9.4%) | 21 | 0 |
| Nine-handed | 72/726 (9.9%) | 196/1792 (10.9%) | 33/737 (4.5%) | 117 | 59 |
| Ten-handed | 63/810 (7.8%) | 214/1990 (10.8%) | 42/840 (5.0%) | 114 | 74 |

Profiles/skills are explicitly selected independently of stakes. These configured environments have measured synthetic differences; this is not measured human population resemblance. Whole-session-block bootstrap and conditional Wilson intervals are included in summaries. Most river bluff-catching and overbet cells contain fewer than ten opportunities; no strong conclusion is justified. Only one natural multi-pot hand occurred, so these populations do not replace targeted side-pot/pricing tests.

Candidate and baseline produced identical public action sequences and settlements in all paired ordinary-session hands (`evidence/paired-comparison.json`). The rare targeted correction scenarios therefore require the separate targeted bot/pricing suites. Candidate decision-compute p95 ranges 11.36–21.92 ms across configurations; maximum observed 78.10 ms. These measurements are Node compute time, not mobile UI latency or an independent performance benchmark.

## Full-hand inspection and remaining plausibility questions

Five deliberately selected completed hands were inspected (large pots / multiway / heads-up), with full hole cards available only in synthetic offline test records. No expert or solver signoff is claimed.

* `5a:heads-up:2:1`: LAG Qd9d opens to496 cents; stronger regular As8s calls296. Board7d Ah8d: check/check. Turn5d: regular bets992, LAG raises to3968, regular calls2976. RiverAd: regular bets2976, LAG raises to15336 all-in, regular calls12360. Both contributed19800; gross39600, rake400, award39200 to regular's full house. Regular started20200 and ends39600 (+19400); LAG started19800 and ends0 (−19800). Net−400 exactly equals rake. This shows a coherent draw completion followed by paired-board reversal, while the LAG's thin flush shove remains a strategic-plausibility review question.
* `5a:nine-handed:6:19`: KK versus AK after multiway preflop raises; KK has1591 cents unmatched returned. Paid40850−refund1591=39259 contested; rake400; award38859 to KK. Ending chips177413 plus rake400 equal starting177813. JJ correctly remains folded in the offline record although it would have made a set; bots never used the future board.
* `5a:ten-handed:1:2`: station KQo cold-calls a large four-bet, later shoves air on Jd3h4d5h2s. AK and AQ call and split the wheel; paid90669, rake600, awards90069. This is a conspicuous synthetic recreational error, not evidence of calibrated calling-station behavior.
* `5a:loose-passive-1-2:1:9`: recreational QJo limp/reraises and TT calls; both check down an ace-high board and QJ wins second pair. The preflop overvaluation is another plausibility question.
* `5a:aggressive-5-10:5:7`: maniac AJo four-bets, QQ station calls; flop checks through, turn trips value bet/call, river shove/call. Net stack loss equals2000-cent rake.

Heads-up reached a flop only21/200 hands; tough six-max41/200. In HU, the SB opened127/200 and folded73/200; BB folded95/127 (74.8%), called20 and reraised12. Eleven of twelve re-raises ended in an opener fold. This is a model-plausibility concern worth further independent assessment, not a confirmed pricing defect or license to force calling quotas. `evidence/heads-up-review.json` reconstructs exact permitted observations and complete public preflop sequences for selected folds: LAG77's observed fold had a model fold probability0.88% (rare stochastic mistake), stronger QTo60.9% and JTo29.9% against3.29BB opens. Distribution diagnostics describe this authored model, not strategic truth.

## Browser harnesses and reproducibility

* `/tests/browser/step5a-play.html`: real UI endurance; select 9 seats/320px or10/390px and100hands. Optional interrupted pending-write fault. `#qa-result` reports counts/timing/heap/stalls; `#qa-records` holds complete public hand accounting records (replay frames omitted explicitly). Double-click attempts exercise stale/busy action guards. Hero topups use Cashier only. Opponents are never refilled; `fundedSeatCounts` reveals any shrinking lineup and must be reported honestly.
* `/tests/browser/step5a-recovery.html?run=r1-final`: real app with isolated named IndexedDB. Same URL in another tab tests ownership; reload tests recovery. Fault buttons exercise before-payout write failure, committed-payout lost acknowledgement and prepared-bot write failure. `#persistence-proof` exposes test-only hashes and accounting counts. Ordinary app History/export/Study import controls remain available.
* `/tests/browser/migration-staging.html`: existing isolated populated v3 migration/backup/old-reader/reopen harness; `#run-migration-all`, then inspect `#migration-report`.
* Re-run populations: `./node_modules/.bin/vite-node scripts/step5a-population.ts candidate-1.3` on the intended runtime commit. Re-run selected HU diagnostic review: `./node_modules/.bin/vite-node scripts/step5a-hu-review.ts`.

This lane provides no R1 release signoff by itself. Master requirement coverage, browser evidence, external validation, known feature gaps and publishing decisions remain in the root release dashboard/report.

## Confirmed history-size performance deficiency

Follow-up to root's actual mobile endurance slowdown: `scripts/step5a-profile-history.ts` independently reproduced growing preparation latency **without UI, DOM, browser timers, harness exports, IndexedDB, or same-session bot memory**. This is a genuine production controller/save-path scaling deficiency, not solely test-report overhead. No production source was changed.

The profiling corpus replays 100 actual completed nine-seat synthetic hands from candidate records into complete public frames and independently funded/cashed-out sessions. It checks exact payouts and validates all hand/ledger hashes and accounting. Each checkpoint then opens one new nine-seat session. This measures representative growing historical payload rather than a claimed recreation of root's exact browser session. Evidence includes source commit, exact source-file SHA-256 values, input corpus hash, every validated snapshot hash, environment and sample counts in `evidence/history-cost-profile.json`; stdout is retained in the adjacent `.log`.

| Saved hands | Snapshot bytes | Controller bot preparation median, 3 samples | Full validation median, 5 samples | One full clone median | Harness all-history export median | Production snapshot hash median |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 714,520 | 63.4 ms | 14.6 ms | 5.9 ms | 19.9 ms | 15.3 ms |
| 25 | 1,688,778 | 154.5 ms | 34.0 ms | 13.9 ms | 44.0 ms | 34.9 ms |
| 50 | 3,241,110 | 301.0 ms | 63.6 ms | 25.8 ms | 80.3 ms | 65.6 ms |
| 75 | 5,086,900 | 465.2 ms | 108.2 ms | 42.7 ms | 128.6 ms | 109.7 ms |
| 100 | 6,699,010 | 625.5 ms | 139.8 ms | 59.2 ms | 170.1 ms | 143.3 ms |

Environment: Node v24.22.1, Linux x64, AMD EPYC 9V74, nine visible logical CPUs. These are diagnostic samples on a shared host, not mobile-device benchmarks. Preparation uses the same deep-copy MemoryPort pattern as the endurance harness. Production BrowserPersistence additionally hashes the full snapshot and performs IndexedDB writes; those costs are not included in the preparation column. The independent snapshot-hash column measures its hashing operation only, not real IndexedDB latency.

`prepareBot` executes two durable mutations. Each deep-clones AppData, rehashes every saved hand including replay frames during `validateData`, clones the retry candidate, and snapshots the whole object in the port. A later action commit repeats those operations. At 100 hands, hand-chain hashing alone took138.0 ms versus139.8 ms for full validation. Stats derivation was2.7 ms. This locates the dominant cost in repeated history processing, not bot computation or statistics.

The endurance harness also exports/hashes the full public history at every settlement, retaining another public copy. That contributes once-per-hand cost and allocation pressure; it cannot explain growing per-action preparation by itself. RUNNING reports contain IDs/metrics only; full records are posted only on PASS/FAIL. Shared-browser heap and GC peaks are not evidence of a leak; no retained-object or post-GC leak analysis was executed.

**Release impact: unresolved R1 responsiveness gap.** Passing conservation and no-stall checks does not establish acceptable long-session performance. Do not remove integrity checks to obtain faster timing.

Next safe work:

1. Preserve root's completed endurance evidence. In a separate test-only change, export only the newly settled public hand, re-sealing its predecessor hash to the already exported chain; prove byte-identical complete exports against current `publicHistory` and import validation. Do not modify an active browser run via hot reload.
2. Repeat single-focused-tab browser profiling using an isolated populated IndexedDB database at25/100/500 saved hands. Add bounded timing spans around clone, chain validation, snapshot digest, IndexedDB transaction and render. Keep report payloads small; separately test a throttled mobile viewport. Track per-decision latency rather than confusing variable actions per hand with latency growth.
3. Prototype removing only the redundant retry-candidate clone on an isolated branch, after proving candidate ownership and immutability while a save is delayed or rejected. Measure the limited gain; this does not eliminate historical hash and full-snapshot growth.
4. If that is insufficient, design verified immutable history-prefix reuse/incremental persistence as a separate change. Full verification must remain mandatory on load, migration, import, takeover and recovery. A cache must reject altered old records, reordered/deleted prefixes, stale hash tokens and forged matching IDs; it must not trust an unvalidated saved hash alone.
5. Before adoption, rerun all engine/ledger/history/replay suites plus before-write failure, lost acknowledgement, interrupted prepare/commit, stale callback, duplicate settlement/cashout, restore every street, ownership fencing, populated migration/downgrade, and export/import equivalence. Then repeat100-hand nine/ten-seat real UI runs against the exact candidate and compare timings with integrity assertions enabled. Publish only after the performance and original R1 release gates pass.
