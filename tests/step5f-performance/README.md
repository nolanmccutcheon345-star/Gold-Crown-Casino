# Step 5F performance evidence

This workstream changed profiling infrastructure only. Production changes measured in the candidate are the integrated `6af65c2` source: bounded freeze memoization, missing-manifest protection, numeric timing instrumentation, and bounded public export. The poker engine and policy are unchanged. The production file hashes in `candidate/source.json` are authoritative; the worktree merge commit is `27d104d`.

## Result and scope

The matched Node reference runs passed **6 scenarios**, comprising **6,046 ordinary bot preparations and 992 completed hands** across before/after runs. Each side has 3,023 preparations and 496 completed hands. Initial/final independent financial outputs, fixture hashes, decision counts by seat count/street, and hand counts match exactly; see [comparison.json](comparison.json). This is scenario evidence, not 6,046 new Vitest tests or V7 acceptance IDs. The disk-reference regression test is one Vitest test.

No measured preparation in those runs exceeded one second. This **does not explain or disprove the original 10.072-second outlier**. It remains an unattributed historical observation and a monitoring/release-risk item. These synthetic repetitions do not establish a rare-event probability or actual mobile browser latency.

Fixtures were decompressed and written by a separate child process. The measured process retains a small key/file index, not the entire 481 MB serialized archive in JavaScript. The real `BrowserPersistence`, controller, engine, policy, recovery, and audits run through an asynchronous request/transaction reference backed by files. This is **not native IndexedDB**, browser durability/scheduling, rendering, physical-device, or INP evidence. The shared AMD EPYC host ran other workstreams; host load and Node flags are recorded per report. Candidate timing overhead is included. Percentiles are nearest-rank observations, not confidence intervals.

## Matched ordinary preparation

Times in milliseconds; each cell is **p50 / p95 / p99 / maximum**.

| Saved hands initially | Decisions per side | Baseline | Candidate |
|---:|---:|---:|---:|
| 100 | 1,004 | 10.70 / 46.36 / 115.71 / 194.25 | 10.23 / 45.54 / 124.66 / 187.96 |
| 1,000 | 1,009 | 9.70 / 43.93 / 170.59 / 196.95 | 11.90 / 55.65 / 174.42 / 258.93 |
| 10,000 | 1,010 | 12.24 / 58.16 / 413.17 / 805.08 | 11.31 / 46.81 / 352.78 / 434.78 |

This mixed result supports preserved ordinary-play performance and a lower largest observed 10k tail, not a universal latency improvement. Source changed beyond the freeze function; use the isolated [freeze measurements](../step5f-memory/) for causal cache comparisons.

Each scenario rotates nominal 2/6/10-player sessions (bustouts can reduce occupied seats), uses actual legal policy actions, finishes the last hand, cashes out, and compares independent financial replay and full-history statistics. Four pending-action reloads per scenario preserve pending decisions and ledger counts; repeated preparation is idempotent and stale commits are rejected. Both sides used policy `synthetic-cash-1.6.0`. No ordinary decision window includes explicit history loading, full audit, fixture construction, intentional bot think-time, or deliberate forced-GC memory sampling.

The new baseline maximum **805.08 ms** has a recorded path: decision 993, `persistence.commit` 794.52 ms, `persistence.prepareRecovery` 487.38 ms, transaction 304.10 ms, policy 0.376 ms, natural GC overlap 217.85 ms. Those are nested durations and must not be added. It identifies periodic financial checkpoint work/serialization plus GC in **this new sample**. It is not evidence of the original outlier's cause. See [baseline/10000-analysis.json](baseline/10000-analysis.json) and [candidate/10000-analysis.json](candidate/10000-analysis.json).

## Recovery and memory

Each fast-recovery row has **three fresh controller/port instances in the same process**, after the initial mandatory full conversion. Times below are p50 / maximum, in milliseconds. First conversion and explicitly requested full audit remain separate.

| Initial hands | Fast recovery before | Fast recovery after | First full conversion before / after | Full audit before / after |
|---:|---:|---:|---:|---:|
| 100 | 189 / 230 | 233 / 304 | 378 / 443 | 485 / 560 |
| 1,000 | 385 / 449 | 412 / 471 | 3,082 / 2,780 | 2,904 / 2,924 |
| 10,000 | 1,279 / 1,412 | 1,238 / 1,273 | 30,696 / 30,624 | 40,413 / 33,037 |

A native checkpoint is already verified before gameplay; the full canonical audit remains available and independently agrees. Full conversion cannot be relabeled fast startup. The 10k full history view retained **785.27 MB before / 653.09 MB after** post-GC JavaScript heap. At compact recovery after conversion it retained **173.53 / 39.99 MB**; after active play **186.63 / 54.56 MB**; after function-scope unwind **155.22 / 25.03 MB**. RSS at final unwind was **1,093.98 / 973.57 MB**: allocator/native resident memory does not immediately shrink with reachable JavaScript heap. These are measured application-reference process values, not a mobile memory guarantee. Fixture allocation is excluded.

Three GC cycles outside timed operations normalize each memory sample. `nodeEventLoopDelay` includes deliberate GC samples and pending reloads and therefore is **diagnostic stress**, not normal-play main-thread responsiveness. Browser long tasks/INP must use separate browser evidence.

The isolated freeze retainer work demonstrates the old `frozen` WeakSet's 128 MiB backing table and its reduction to 2 MiB without retaining the original roots. It does not show the whole app is leak-free. The separate `packed-hand.ts` `immutableNodes` probe retained a 4 MiB backing table after 1,000 actual hands and 214,248 decoded nodes; all roots were collected. See that workstream's separate residual probe; do not extrapolate its capacity to every archive. No cache was cleared or integrity check disabled here.

## Fresh-process CPU/allocation pair

A second matched pair starts from a checkpoint installed in a **different fixture-preparation process**. The actual measured processes do not inherit a legacy reconstruction's graphs or cache high-water. These two additional scenarios each passed 1,010 preparations, 164 completed hands, independent financial/statistics reconciliation, four interrupted-decision reloads, stale-action rejection, and canonical audit: **8 final scenarios / 8,066 preparations / 1,320 hands overall**. Do not combine profiled and unprofiled latency distributions.

See [fresh-checkpoint-comparison.json](fresh-checkpoint-comparison.json), [baseline CPU/allocation analysis](fresh-checkpoint-baseline-profile/10000-analysis.json), and [candidate analysis](fresh-checkpoint-profile/10000-analysis.json). Baseline production is exactly `c2de7f9` (isolated profiling commit `718d6ee`); candidate production is exactly `6af65c2`. Raw reports retain the old memory-label string `firstConversion.readyFull`; `inputReadyCheckpoint=true` and the actual `freshCheckpoint.controllerInit` window identify that sample correctly as verified compact checkpoint readiness. Comparison summaries add `logicalPhase`; raw evidence is unchanged.

| Measurement | Baseline | Candidate |
|---|---:|---:|
| Fresh verified startup, one sample (ms) | 1,537.12 | 2,869.73 |
| Preparation p50 / p95 / p99 / max (ms) | 13.69 / 65.76 / 422.95 / 516.37 | 15.27 / 75.16 / 432.32 / 481.91 |
| Heap at fresh readiness (MB, post-GC) | 43.73 | 40.07 |
| Heap after active play (MB, post-GC) | 69.66 | 55.13 |
| Heap with full history retained (MB, post-GC) | 786.11 | 654.04 |
| Heap after audit, compact state (MB, post-GC) | 199.11 | 69.00 |
| Heap after function-scope unwind (MB, post-GC) | 156.03 | 25.93 |

The single profiled startup is slower in the candidate; this is **not evidence of faster fresh startup**. Node Inspector CPU sampling (1 ms), allocation sampling (32 KiB, including collected objects), and different shared-host load are included. Both meet the provisional five-second reference target, but neither establishes a physical-device guarantee. The strongest memory improvement occurs after full import/history/audit; an already compact fresh checkpoint did not start with the 128 MiB cache high-water.

The candidate's newly traced maximum is 481.91 ms at decision 697: recovery preparation 316.09 ms, transaction 120.76 ms, policy 24.48 ms, natural GC overlap 15.83 ms. Ordinary-preparation CPU samples accumulate most self time in the canonical serializer (`canonicalWriter.write` in `integrity.ts`, 12.87 s), the reference's `JSON.stringify` writes (3.57 s), GC (2.22 s), financial-prefix `contextDelta` validation (1.66 s), and freeze traversal (1.47 s). Sampling/clock alignment is approximate and retained in the analysis; nested wall timings provide exact phase boundaries. This supports investigating periodic checkpoint serialization if further tail reduction is required; it does not justify skipping prefix or financial integrity checks.

Allocation samples show high **cumulative allocation churn** from canonical string construction, sorting, and descriptor traversal over the full run and explicit archive audits. Tens-of-GB allocation estimates are not a retained heap or live storage size. Actual post-GC memory is reported separately above. No measured ordinary preparation in the final eight scenarios reached one second; the original rare 10.072-second sample remains unattributed.

## Storage accounting

The exact supplied 10k fixture has **481,483,729 JSON bytes** before installing acceleration records. After conversion, this run has **497,624,350 bytes**:

| Record family | Bytes |
|---|---:|
| Canonical hand rows | 474,082,014 |
| Canonical financial ledger | 6,864,209 |
| Canonical sessions | 536,823 |
| One verified checkpoint | 16,139,321 |
| Recoverable pre-install manifest | 683 |
| Current manifest, checkpoint head, lease | 1,300 |
| Packed replicas | 0 |

Within canonical hands, value bytes attributable to per-action frames are 382,964,292; final views 47,453,937; private profiles 35,207,504; provenance 2,460,000. Field subtotals exclude JSON keys/envelope syntax. Most space is canonical recorded state, not redundant packed replicas. After 164 additional hands the baseline totals 534.34 MB, including two checkpoint generations 40.72 MB and journals 4.64 MB. The candidate total is 534,339,123 bytes, 50 bytes lower; the canonical hand count and independent financial outputs agree. This tiny difference is not an optimization result. This change makes **no storage-reduction claim** and deletes no canonical history. Guest saves still depend on available browser quota and cannot survive arbitrary browser/user deletion without a verified external backup.

## Original outlier and monitoring

The original artifact is [Step5E resource report](../step5b-resource/evidence/step5e-4ab9ea3/report.json): 69,055 preparations, p50 5.926 ms, p95 27.385 ms, p99 40.589 ms, maximum 10,072.242 ms; policy maximum 1,718.172 ms. At least 8,354.070 ms of the largest preparation was outside its policy call, but its individual decision, timestamp, GC trace, and phase path were not retained. Full restores were outside preparation windows. That old `SegmentReference` retained canonical objects and serialized strings together and did not execute browser rendering/native storage. Its relevant production source hashes match this baseline. It is not legitimate to infer that the WeakSet table caused that one sample.

Keep numeric timing telemetry opt-in and bounded. Preserve phase identity, wall duration, candidate version, history size bucket, action count, natural GC/long-task evidence where available, and whether recovery/audit was in progress; never expose cards, deck, private policy state, or bankroll data in public telemetry. A repeated multi-second **ordinary** preparation or stalled turn should trigger trace capture and renewed investigation before release qualification. Existing mandatory external gates remain independent blockers; this report alone cannot authorize R1.

## Reference failures retained

`baseline-initial-failure`, `manifest-diagnostic`, and `manifest-diagnostic2` preserve failed attempts using repeated writes to the same physical host filename. The saved-current compare-and-swap guard rejected stale revisions; it was not bypassed. In the third attempt the last six recorded writes were monotonic 234739–234744, but a later file read returned 234657 without an intervening recorded current write; index filenames were unique. The cause of that host/reference anomaly is not established, and it was not reproduced in native IndexedDB. The final reference instead uses write-once physical generations under `/tmp`, switching only its key index. Six complete matrix scenarios passed; the explicit 1,500-transition/reopen test validates its reference bookkeeping. These failed attempts are **not labeled production defects**, and no production concurrency checks were weakened.

## Reproduction and preservation

From this repository with installed dependencies:

```sh
npm run typecheck
npx vitest run tests/step5f-performance/disk-records.test.ts
node tests/step5f-performance/run.mjs /tmp/step5f-evidence /tmp/step5f-fixtures 100,1000,10000 1000
node tests/step5f-performance/analyze.mjs tests/step5f-performance/baseline tests/step5f-performance/candidate /tmp/step5f-comparison.json
STEP5F_PROFILE=1 STEP5F_READY_FIXTURE=1 node tests/step5f-performance/run.mjs /tmp/step5f-profile /tmp/step5f-ready-fixtures 10000 1000
```

Use fresh output/fixture folders. Source manifests contain exact input SHA256 and compiled bundle SHA256. Saved `profile.mjs.bin` / `.map.bin` are exact executable/source-map bytes renamed to avoid linting historical bundles; copy them to `.mjs` / `.mjs.map` in a scratch folder when reproducing an old source artifact. Trace JSONL and CPU/allocation JSON are losslessly gzip-compressed. No evidence file exceeds 24 MiB. Original/failed results remain separate from final measured runs.
