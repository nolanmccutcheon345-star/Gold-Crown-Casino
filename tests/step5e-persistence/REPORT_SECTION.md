> Historical profiling snapshot: this section preserves the measurements and source IDs taken before the final background-save UI repairs. The final runtime is `37aa225`; its fresh six-size native recovery comparison is [here](../../TEST_EVIDENCE/step5e/final-recovery-comparison.md), and the final release decision is in [STEP5E_REPORT.md](../../STEP5E_REPORT.md). Earlier measurements are retained, not relabeled as later executions.

# Step5E performance and recovery evidence

The final candidate restored a prepared 10,000-hand guest save to verified, playable state in **2.340 seconds**, versus **29.351 seconds** for the saved Version10 baseline in the matched browser observation. This does **not** make first migration or a complete historical audit instantaneous: the candidate's separately recorded first installation took **63.233 seconds**, and its later explicit full canonical audit took **50.527 seconds**. These three operations must remain distinct in release claims.

The browser captures identify runtime source `21e11810405f1844ed6f9c28d3d8f91d0e25047f`. The full release execution identifies `72ee5357f6d2aeac2c03d1c176e4ef3bdc12a913`; `git diff` finds no `src/` changes between those commits, or between production checkpoint `398360f` and the tested release commit. Evidence and harness commits have their own provenance. No publication or R1 signoff follows from this report section.

## Measured cause and implemented boundary

The expensive historical work was repeated deserialization, freezing and hashing of complete hand/frame graphs. The final Node CPU/stage investigation still measures this cost when a full canonical audit is requested: at 10,000 hands, median stages include 8.898s outer hand hashing,7.458s inner hand-chain hashing and 6.178s transport freezing. These intervals can nest and must not be added as independent wall-clock totals. Independent financial arithmetic is small by comparison; the full financial-semantic stage is about 6.1ms. [Node qualification and CPU profiles](../step5e-performance/evidence/qualification.json) preserve the actual measurements.

The implementation keeps the canonical v2 record chains and existing optional packed replicas. It adds a versioned financial checkpoint, a compact all-hand financial/provenance index, and an ordered journal. Checkpoints contain the complete compact ledger, sessions, active engine state and pending decision, statistics/public-memory projections, and at most120 actual recent canonical hand bodies. Index entries are explicitly metadata; they are not substituted for complete historical hands. Every 64 committed revisions a new checkpoint bounds journal replay to63 revisions. Current and previous acceleration generations are retained; only older acceleration keys are retired. Canonical records and migration backups are not pruned by this operation.

Before the application enables poker actions, the actual `BrowserPersistence.load` path executes:

1. Envelope/version/checksum verification, exact checkpoint identity, and journal revision, sequence, predecessor-hash, unique-identity and append-offset checks.
2. Exact comparison of reconstructed current header and collection counts with the canonical current manifest.
3. Independent replay of every financial ledger event, unique settlement/session identities, bankroll/table reconciliation, rules/policy provenance, resident hand hashes, active engine accounting, permitted public bot memory and statistics reconciliation.
4. Reads and checks of the actual canonical ledger, closed-session and imported-study records, including their outer chains and agreement with the checkpoint.
5. Verification that the resident hand tail remains recoverable from its canonical rows or existing exact packed replicas, matches the checkpoint, and reaches the canonical manifest tail. Damage to both archival copies cannot be hidden by a valid checkpoint copy.
6. Key-only inventory verification for the retained archive, followed by a final current-manifest fence. A concurrent change requires retry; it does not authorize stale financial state.

These checks run before readiness. They are not replaced by a persisted “verified” flag. The poker engine remains responsible for poker actions, cards, chip movements and payouts; checkpoint and journal code record engine-produced facts and verify accounting rather than calculating a second settlement.

Older full hand bodies outside the resident tail are not read or claimed audited during ordinary recovery. The UI exposes historical audit status, and explicit history loading/export or a full canonical audit performs the retained complete reconstruction. Individual indexed reads verify the requested hand against its financial-index identity. Full-history results cannot overwrite a newer live state. The currently implemented broad older-history load still performs an expensive full audit; this is a known usability cost, not completed background work.

Large first conversions now perform mandatory full canonical verification and install the financial checkpoint directly. Archives above 120 hands are no longer automatically re-encoded wholesale into packed replicas merely to enable checkpoint recovery. Existing packed copies, explicit packing and small-archive compatibility remain supported. This removes unnecessary conversion work without skipping the original audit.

## Actual browser observations

The [read-only aggregated report](../../TEST_EVIDENCE/step5e/recovery-summary.md) and [source-pinned raw-data index](../../TEST_EVIDENCE/step5e/recovery-summary.json) compare exact fixtures in Chrome 155 on Linux, a 1250×850 managed iframe, HTTP context with JavaScript SHA fallback, actual IndexedDB and the production mounted application. Each run navigates to a fresh document after fixture setup. The renderer process, caches and garbage collection are not forced cold.

There is **one observation per reader/size**. The following values are observed latencies, not p50/p95/p99 estimates or evidence of rare-stall rates. Installation is recorded separately before prepared normal recovery. Full audit is invoked after history browsing; it is not automatically completed in the background at readiness.

| Saved hands | Version10 ready, s | Final candidate ready, s | Candidate first installation, s | Candidate explicit full audit, s | Candidate maximum pre-ready Long Task, ms |
|---:|---:|---:|---:|---:|---:|
| 0 | 0.031 | 0.027 | 0.020 | 0.007 | 0 |
| 100 | 0.145 | 1.123 | 0.413 | 0.131 | 499 |
| 500 | 1.292 | 1.478 | 3.380 | 2.530 | 344 |
| 1,000 | 2.559 | 0.905 | 5.989 | 5.587 | 226 |
| 5,000 | 13.603 | 2.477 | 31.169 | 28.005 | 620 |
| 10,000 | 29.351 | 2.340 | 63.233 | 50.527 | 654 |

The 100- and 500-hand candidate observations were slower than baseline; they are retained rather than described as universal speedups. All final prepared observations were below 2.5s in this environment, including the 10,000-hand target below 5s. Small-sample variability and renderer residue prevent a causal explanation for every individual difference.

At10,000 hands, the final browser records2.337s inside `persistence.load`, including1.133s `recovery.fastRestore`,748.5ms canonical financial-archive verification,282.9ms resident-archive verification and 168.1ms key inventory. The 480.0ms financial-checkpoint audit is nested within fast restore. UI render stages during recovery total about 2.2ms. Financial verification and its underlying data reads therefore remain real costs; startup is not claimed O(1) in ledger size.

Two additional executed candidate observations are separate from the paired matrix:

- [Direct first conversion with 1,000 hands](../../TEST_EVIDENCE/step5e/browser/final-first-conversion-1000.json):5.589s to ready, including full canonical verification and checkpoint installation; no paired baseline conversion run is claimed.
- [Reload with a genuine pending bot decision and 1,000 saved hands](../../TEST_EVIDENCE/step5e/browser/final-pending-1000.json):0.748s to ready. The fixture and active-state checks passed. The hot workload below separately executes the recovered decision and stale-action rejection.

At10,000 hands, full audit completed104.548s after mounting because the workflow also waited for observation/paint proxies and explicitly loaded older history first. Its actual audit duration was 50.527s. The two values describe different intervals. Double-requestAnimationFrame proxies in the managed iframe are not physical screen-paint measurements; they must not be confused with wallet readiness. Older secondary-statistics markers also included paint/poll waits and are not directly comparable with the later MutationObserver readiness metric.

Three older baseline captures misclassified history-interaction tasks as startup tasks because the tasks began0.3–0.4ms before the history marker. Recomputed windows retain the entire993ms,4,239ms and 9,067ms stalls as history-interaction work at 1,000/5,000/10,000 hands. Actual pre-history completed-task maxima for those runs are0/0/153ms. The raw values and corrections remain in the aggregation. The final10,000-hand history and audit windows have maximum observed tasks of 460ms and 991ms respectively. Long Tasks are not INP, and these results do not establish physical-phone responsiveness.

Memory observations require particular caution. The candidate's reported10,000-hand ready-phase heap is1,149.47MB and its sampled overall peak2,424.43MB; the corresponding baseline observations are390.71MB and 2,293.68MB. Even the candidate zero-hand capture reports731.29MB, showing substantial renderer residue from prior preparation/work. These are coarse Chromium `usedJSHeapSize` observations, not isolated application retention or a demonstrated memory reduction. Serialized stored key/value data at 10,000 hands is498.45MB for the candidate and 699.83MB for baseline; these figures are not physical IndexedDB allocation or mobile quota guarantees.

## Complete Node pipeline and sustained decisions

The final [cold qualification](../step5e-performance/evidence/qualification.json) executes the actual `BrowserPersistence.load`, including canonical financial rows, resident archive, inventory and final manifest fence, through an asynchronous serialized-string IDB reference. It executes 18 full restorations,18 checkpoint restorations and 6 separate checkpoint-install measurements, with 3 native Inspector CPU profiles. All selected archive hashes, independent integer financial replay, settlement identities and full-replay statistics agree. It reads at most120 canonical hand bodies on each fast restore. The adapter does not establish native browser disk latency, durability, UI or device performance; its lease is pre-acquired in the single-process reference.

| Hands | Full canonical restore median, ms | Complete checkpoint recovery median, ms | Checkpoint recovery observed maximum, ms |
|---:|---:|---:|---:|
| 0 | 1.3 | 3.9 | 8.2 |
| 100 | 131.6 | 242.6 | 255.8 |
| 500 | 1,619.1 | 859.8 | 870.4 |
| 1,000 | 2,599.8 | 508.3 | 531.2 |
| 5,000 | 14,572.5 | 1,138.6 | 1,233.4 |
| 10,000 | 25,922.0 | 1,175.9 | 1,301.7 |

Each median and maximum above comes from 3 observations. The source's descriptive p95 and p99 equal the maximum at this sample size; they are not tail guarantees. Node 24.22.1 ran on an AMD EPYC 9V74 host with native SHA and timing instrumentation. The run-condition record identifies overlapping local regression activity, so this is not a controlled quiet-machine speedup experiment. Superseded earlier Node traces that omitted additional persistence checks are retained in separately named directories and excluded from complete-startup claims.

The final [2,000-decision qualification](../step5e-performance/hot-evidence/qualification.json) uses the actual controller and persistence path, begins at 10,000 saved hands, and ends at 10,297 hands. Its production files are bound to runtime `398360f`; the profiling/source receipt is `39b58bd8ab806b51f16dfb94259fe7051ad660c6`. Preparation latency was **p50 9.12ms, p95 41.85ms, p99 340.32ms, maximum 461.59ms**. This is a genuine2,000-observation distribution, still limited to its deterministic synthetic workload and Node environment.

Every preparation checked duplicate preparation, and 8 pending-action reloads preserved identity and rejected stale duplicate commits. The workload performed 8,831 commits,137 checkpoint promotions and 8,704 obsolete acceleration-row removals, with at most131 retained acceleration records. It exercised actual occupied counts2, 5, 6 and 10 through rotating2/6/10-player sessions and natural bustouts. Full canonical audit and independent financial/statistics replay passed, and original canonical bytes remained unchanged. Final amounts were wallet 98,584,245 cents, table 19,206 cents and cumulative poker net−1,396,549 cents against 100,000,000 cents in manual funding.

The slowest preparation was decision 1,832 at 10,264 saved hands. Its trace contains 449.03ms persistence commit, including254.69ms recovery-record preparation and 193.67ms transaction, while bot policy took9.49ms; nested timings are not additive. Periodic checkpoint construction/serialization and observed collection costs explain measured long-tail work in this run. The original untraced **9.79-second outlier was not reproduced, and its historical cause remains unproven**. Node event-loop maximum 867.70ms is not a browser Long Task or INP measurement. No claim of human calibration or solver verification follows from this synthetic workload.

## Failure handling, rollback and evidence limits

Canonical writes, journal/checkpoint writes, current-head publication and retirement of obsolete acceleration generations share the fenced IndexedDB transaction. Aborted/quota-failed writes retain the last committed financial state. Checkpoint installation retains a pre-install manifest; v1 migration retains and verifies the original populated backup/receipt. An older compatible writer changing canonical current state invalidates the fast head and requires full verified reconstruction; it cannot silently advance or roll back only a cached summary. Missing, duplicate, reordered, corrupted or inconsistent required records fail readiness without resetting the bankroll or awarding a second payout. An optional packed-install abort no longer starts a second installation that changes storage after the failed attempt.

The [native storage capture](../../TEST_EVIDENCE/step5e/browser/native-PASS.json) passes 6 checks covering populated reconciliation, reload, actual transaction abort, injected quota failure, two-connection ownership and exactly-once payout/cashout. The [native rollback capture](../../TEST_EVIDENCE/step5e/browser/rollback-PASS.json) passes 9 checks including actual V7 creation, interrupted migration, preserved records/pending action, post-upgrade activity, unchanged V7 downgrade refusal, V7-R restoration/action/cashout and candidate re-entry. Plain redeployment of unchanged V7 is not the rollback procedure; the tested compatibility path is V7-R. These tests use isolated databases, not destructive production saves.

The [full local release execution](../../TEST_EVIDENCE/step5e/release-final/manifest.json) records **1,863/1,863 passing automated tests across 189 files**, with no failures or skips, plus passing typecheck, lint and build. The separate paired-reference rerun is one repeated executable scenario, not an additional original acceptance ID. The specification check confirms 302 original acceptance IDs and 86 deferred features preserved. Automated test counts are not mapped V7 acceptance counts, and local execution is not hosted CI.

Local digests detect corruption and inconsistent sequences; they do not authenticate against an attacker who can rewrite every local record and recompute its hashes. Strict durability is requested where supported, with the existing default-durability fallback. Browser eviction, user-cleared site data, private-mode loss and hardware failure are outside what same-origin backups can guarantee. Guest storage is not cross-device synchronization. Large imports, first-time migration, full-history views/audits, storage quota, physical-device export and repeated device performance remain limits requiring truthful reporting. This section supports the recovery engineering findings; it does not close unrelated mandatory R1 gates or authorize deployment.
