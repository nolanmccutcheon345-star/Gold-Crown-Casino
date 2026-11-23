# Step 5J repeated performance qualification

**Seven diagnostic scenarios PASS: 7,343 ordinary bot preparations and 1,162 newly completed hands.** This is executed engineering evidence, not 7,343 automated tests or V7 requirement passes. Production application code was unchanged. The historical 10.072-second outlier remains **UNATTRIBUTED**, not fixed.

Application candidate: `138cdcf325129c69f127d0e16bc94942abea752f`. Main source checkpoint: `a41250f87af3db07f6a9a9c47507abd94bf25003`. All 94 compiled production source files were independently byte-hashed against that application commit before execution. Source, compiled bundle, raw spans, GC observations, CPU/allocation artifacts and exact command receipts are retained in [evidence](tests/step5j-performance/evidence/source.json). No deployment or production-save operation was performed by this workstream.

## Measured ordinary preparation

Milliseconds; nearest-rank observed quantiles. 2, 6 and 10-player sessions were actually exercised in every scenario. Each cohort completes the final hand, hence counts above its nominal target.

| Initial saved hands / cohort | Preparations | New complete hands | p50 | p95 | p99 | Maximum |
|---|---:|---:|---:|---:|---:|---:|
| 1000-natural-1 | 1,205 | 192 | 10.98 | 48.83 | 204.78 | 271.66 |
| 1000-natural-2 | 1,205 | 192 | 11.14 | 48.96 | 186.72 | 283.02 |
| 1000-natural-3 | 1,205 | 192 | 11.85 | 50.74 | 192.13 | 288.50 |
| 100-natural | 813 | 114 | 12.38 | 59.11 | 143.90 | 261.21 |
| 10000-natural | 1,203 | 191 | 14.23 | 56.75 | 411.98 | 548.40 |
| 1000-profiled | 1,205 | 192 | 13.72 | 64.80 | 212.57 | 289.98 |
| 1000-reload-stress | 507 | 89 | 11.80 | 58.48 | 123.96 | 265.23 |

The three natural-GC 1k repeats use the same saved corpus and seeded poker workload in fresh processes. They measure timing repeatability; their repeated contexts are not independent human/poker samples. All three ended with the same independent financial totals and 1,192 canonical hands. Zero of these 7,343 observed preparations exceeded one second. The sampling design does not establish an IID recurrence rate or a probability bound for the historical stall. CPU/allocation-profiled and forced-GC/reload cohorts remain separate rather than being pooled into a more favorable tail.

Environment: Node v24.22.1, Linux x64, AMD EPYC 9V74, nine visible logical CPUs, shared container; process flags and observed host load are in every receipt. Actual production controller, storage, policies and engine run through a serialized **disk-backed IndexedDB request reference**. This is not native browser IndexedDB, mobile hardware, browser long-task or INP evidence. Hero follows a bounded test policy (check/fold/occasional call), not a human-calibrated strategy.

## Verified readiness and explicit archive work

Fixture extraction and initial schema/checkpoint installation occurred in a separate process. The 10k installation itself took 32.09 seconds; it is not silently included in or relabeled as normal checkpoint startup. These timings concern an already installed populated save. Full history and audit are requested after the additional hands above.

| Cohort | Fresh verified checkpoint startup ms | Three further recoveries: median / max ms | Explicit full-history load ms | Explicit full audit ms |
|---|---:|---:|---:|---:|
| 1000-natural-1 | 541.07 | 377.50 / 440.50 | 2834.54 | 2875.42 |
| 1000-natural-2 | 556.68 | 391.08 / 407.78 | 2948.55 | 2798.75 |
| 1000-natural-3 | 527.79 | 407.86 / 427.08 | 3643.17 | 2868.15 |
| 100-natural | 297.96 | 179.39 / 185.30 | 42.40 | 450.59 |
| 10000-natural | 1348.66 | 1190.55 / 1274.62 | 29897.09 | 28056.90 |
| 1000-profiled | 644.17 | 520.10 / 532.61 | 3372.12 | 3218.76 |
| 1000-reload-stress | 607.47 | 406.21 / 441.67 | 3119.10 | 2929.31 |

The 10k checkpoint reached verified readiness in 1.35 seconds in this reference runtime. That does not make complete archive browsing or auditing immediate: full materialization remained 29.90 seconds and independent audit 28.06 seconds. These are explicit, separately recorded operations; no integrity work was skipped. Recovery after materializing the enlarged 10k history took 2.18 seconds. Physical-device limits and native hosted-browser responsiveness require their own evidence.

## Observed peak and profiler findings

The largest new ordinary preparation was 548.40 ms at decision 1,011 in the 10k natural run. It contains persistence commit 517.40 ms, recovery preparation 405.80 ms, transaction 110.64 ms, reference serialization 75.52 ms, policy 18.48 ms and overlapping observed GC 25.52 ms. These nested spans identify periodic checkpoint/serialization work in this measured peak; they do not identify the historical 10.072-second event. Its exact decision context and nested phase windows are preserved in [analysis.json](tests/step5j-performance/evidence/10000-natural/analysis.json). The separate 1k CPU profile records approximately 11.45 sampled seconds in canonical writer `write`, 2.48 seconds in the reference adapter JSON serialization, 1.69 seconds in GC and 1.42 seconds in immutable traversal across ordinary preparations. These are aggregate sampled self-times, not one stall. The source map and profiler clock uncertainty bracket remain available. Its slowest preparation was 289.98 ms with 17.84 ms overlapping observed GC. Nested durations must not be summed as disjoint work.

Allocation sampling includes collected objects across the complete profile, including explicit archive work. The large cumulative sort/string/canonical-write allocation estimates are churn, not retained application heap. No new retained-object leak or production defect is established by these samples, so no speculative architecture or policy change was introduced. None of these observations attributes the old 10.072-second event.

## Memory, storage and accounting

In the 10k natural run, coarse heap samples were 68.77 MB at first readiness; 89.20–272.71 MB during ordinary play; 745.93 MB with full history retained; and 744.10 MB after scope unwind without forced GC. Maximum sampled RSS was 1,052.68 MB. These decimal MB figures include diagnostic/reference-store overhead and garbage awaiting collection. They are not post-GC retained heap, measured browser memory, or a guarantee for iPhones. The earlier matched retained-graph diagnostic remains separately preserved; it must not be compared to these unforced samples as a before/after optimization.

The existing 10k canonical-only fixture grew logically from 497,624,350 to 537,435,537 serialized bytes after 191 new hands. This is logical reference-store payload, not browser-reported origin usage and not the earlier fresh-packed-save footprint. No canonical records, financial events or policy provenance were removed.

All seven scenarios executed chip-accounting assertions after authoritative actions, durable preparation idempotency, exact cashout, unchanged manual-adjustment totals, independent financial replay and full-replay/incremental statistics agreement. The 507-preparation recovery-stress run injected two pending-decision reloads (decisions 250 and 500); both retained revision, ledger count and exact pending identity, and both subsequent stale commits were rejected. Explicit full-history reads/audits left financial state and record counts unchanged. The three matched 1k runs each finished with wallet 99,791,427 cents, table zero, cumulative poker result −208,573 cents, manual total 100,000,000 cents and 1,192 canonical hands. These are isolated synthetic fixture accounts, not production guest data.

## Release-risk assessment and monitoring

- Observed frequency: no new >1-second preparation in these bounded cohorts; the original 10.072-second observation lacks its per-decision trace and comparable denominator. No defensible historical occurrence rate or claim of eradication is available.
- Consequence: a synchronous recurrence can block controls and announcements; a delayed asynchronous operation may delay only the bot. The old evidence cannot establish which happened. Long explicit history/audit work remains a separate measured responsiveness/memory risk.
- Financial consequence controls: durable pending identities, revision/lease ownership, exactly-once commits and independent reconciliation remain enabled. The new reload/stale-action checks support those controls; they do not explain the old event.
- If it recurs, preserve exact application/build identity, run seed/corpus and table size, phase windows, pending decision/revision, GC/CPU trace where available, native task/frame intervals, storage usage and memory availability. Retain the failed run receipt. Do not restart a hand, skip verification, alter think-time or erase the event to produce favorable metrics.
- Release interpretation: normal bot preparation meets the provisional 250 ms p95 aim in these reference cohorts. This evidence alone does not close Z14’s entire cash-workflow/performance conjunction or U11/V518 physical-device gates. The complete original Z14 remains NOT_EXECUTED for explicitly preserved favorites/bookmarks, even when a cash subcomponent is qualified. Final qualification must combine current HTTPS browser workflows and the actual external checks; no public release approval is implied.

## Executed evidence and limitations

Summary validation PASS checks all seven receipts, canonical record totals, per-seat coverage, timing counts, source hashes, profile-part checksums and parsable retained artifacts. Full project TypeScript check, scoped ESLint and specification-integrity checks PASS; all 302 original requirements and 86 deferred features remain intact. The first diagnostic launcher failed before measured app execution because Node rejected a `.bin` executable extension; its failure is preserved under `initial-launch-failure`, and the repaired launcher executes `.mjs` while retaining identical `.bin` evidence. No failed application scenario is concealed.

This workstream did not execute a hosted CI job, an interactive browser, a physical phone, VoiceOver, three human participants, a new PokerKit suite or the complete unit suite. Those counts must come from their own actual receipts. Existing source/runtime receipts are not retagged as newly executed tests.

Reproduction and methodology: [README](tests/step5j-performance/README.md). Machine-readable [summary](tests/step5j-performance/evidence/summary.json), [execution list](tests/step5j-performance/evidence/executions.json), [CPU/allocation analysis](tests/step5j-performance/evidence/1000-profiled/analysis.json), and [validation result](tests/step5j-performance/summary-validation.log).
