# Step 5G performance and retained-memory verification

This work continues without GitHub. Hosted CI is not executed or claimed by these local results. The original 10.072-second preparation outlier remains **UNATTRIBUTED**: its historical report does not contain the decision timestamp, full phase trace, or contemporaneous GC evidence. New measured peaks must not be substituted for that missing observation.

## Confirmed narrow change

`src/storage/packed-hand.ts` no longer puts the temporary graph constructed solely for write validation into the long-lived private provenance WeakSet. The temporary graph still undergoes exactly the same descriptor, type, reference, expansion and depth checks, and every node is still frozen. Both public decode APIs always privately brand every returned descendant. The encoding, hashes, schema, financial authority and engine are unchanged. The mode is a private decoder argument, not a caller-controlled public bypass.

The evidence supports a small write-only improvement, not a claim that archive memory or the old stall is solved. Each workload used the same 1,000 real canonical hands and three alternating, fresh Node processes per side; raw CPU, allocation and V8 heap artifacts are retained.

| Workload | Before retained WeakSet table | After retained table | Post-GC heap before / after |
|---|---:|---:|---:|
| Production packing, independent reference decode of output | 131,112 B in all three runs | 104 B in all three runs | 8,853,296–8,853,584 / 8,720,464–8,720,536 B |
| Production packing plus public decode; returned graphs retained until unwind | 4,194,344 B in all three runs | 4,194,344 B in all three runs | Approximately 12.91 MB on both sides |

The combined-workload null result is deliberately preserved. Legitimate public decoded nodes still need private provenance. Every run preserves **44,186,578 canonical bytes**, **18,989,319 packed bytes**, canonical SHA256 `16826bfcaba8105983fab4bacd85ba9c70c3185e0bc4729be169d12aeacaf3cb`, and 107,124 unique packed nodes. Source/encoded or source/decoded roots were collected before sampling. No stored bytes are removed, and this change does not reduce the roughly 498 MB canonical 10k fixture.

[Write-only comparison](packed-write-comparison/comparison.json), [combined comparison](packed-comparison/comparison.json). Both include exact source manifests and heap paths `module context → immutableNodes → WeakSet → internal table`. Timings are small and mixed; no general latency improvement is established. The source fix is `267b17c`; the unchanged write-only baseline is retained at `1ad872f`.

## Executed focused regression

The focused run passed **120/120 tests in five files**, with no failed or skipped tests; see [raw Vitest receipt](packed-tests.json). It covers independent canonical hashes and financial replay, all public decode brands, hostile descriptors/prototypes/references, expansion/depth rejection, packed fallback/corruption, and immutable boundaries. Typecheck and scoped ESLint also passed. The integrator's independent review and full release regression are separate receipts, not added to this count.

## Recovery-stress trace on exact saved Version 12

The unmodified Version 12 production source at `7ac2175` completed **12,011 ordinary bot preparations and 1,663 new complete hands**, starting with 1,000 saved hands. It rotates nominal 2/6/10-seat tables; bustouts can reduce occupied seats. Forty-eight pending-decision reloads preserved identity and accounting, repeated prepares were idempotent, stale commits were rejected, and final independent full-history statistics/financial replay agreed. Final storage contains 2,663 canonical hands.

Preparation latency (milliseconds): **p50 11.56 / p95 49.68 / p99 218.34 / maximum 291.80**. The maximum at decision 5,471 includes a 255.05 ms persistence commit, 197.45 ms recovery preparation, 17.99 ms policy calculation, and 7.07 ms natural GC overlap. These are nested, not additive. No measured preparation exceeded one second in this scenario; this is not proof that the historical rare event cannot recur.

This harness deliberately forces GC for memory samples and inserts pending-decision reloads. It is recovery stress, not uninterrupted-play or browser responsiveness evidence. First restoration, fixture construction, explicit history loading and full archive audit are separate windows. Fixture construction occurs in another process; the measured process retains a small disk key/index rather than a second 498 MB fixture string graph. The adapter executes actual production `BrowserPersistence`, controller, policy and engine through file-backed IDB request semantics, **not native IndexedDB**.

After forced GC, the 1k compact checkpoint uses 18.11 MB heap; after 1,663 additional hands the measured process uses 47.35 MB; full history uses 208.70 MB; after application scope unwind it uses 32.26 MB. These process figures include retained diagnostic windows and GC traces, so they must not be described as isolated application live heap. Canonical storage grows from 48,941,531 to 159,831,377 bytes with the additional hands. [Trace analysis](long-unprofiled/1000-analysis.json), [full report](long-unprofiled/1000-report.json).

## Sustained workload and reproduction

`profile.ts` adds a mode that disables every explicit GC and every injected midplay reload while retaining natural GC observations, exact phase timings and independent final auditing. It keeps the 20 slowest complete permitted decision contexts, so a late rare stall cannot be lost behind the first 50 moderately slow observations. No cards, policies, snapshots or private diagnostics are added to the ordinary application or public timing bridge.

The initial 100-hand fixture smoke passed ten preparations/five complete hands, zero forced GC calls, zero injected pending reloads, and independent financial/statistics agreement. It is harness verification, not a release benchmark.

```sh
# Exact-code codec before/after bundles must already be built from their recorded sources.
node tests/step5g-performance/compare-packed.mjs /absolute/before /absolute/after /absolute/new-output write-only

# Sustained workload: output and fixture folders must be new.
STEP5G_SUSTAINED=1 STEP5F_PROFILE=1 STEP5F_READY_FIXTURE=1 node tests/step5g-performance/run.mjs /absolute/new-profile /tmp/new-fixture 10000 4000
```

CPU sampling is 1 ms; allocation sampling is 32 KiB including collected objects. Do not pool profiled/unprofiled, forced-GC/natural-GC, or different saved-history distributions. This work does not establish physical phone, native storage, rendering, INP, expert strategy or measured human-calibration results. No original acceptance requirement is automatically passed by a scenario or an unmapped unit test.

## Fresh packed-save representation

The 1k/10k long-session fixtures above contain canonical rows without optional packed replicas. Fresh guest saves enable replicas, so those fixture sizes are not universal guest-storage estimates. Two additional diagnostics wrote validated 100/1,000-hand fixtures into empty isolated stores using the actual initial `BrowserPersistence.commit(null,data)` path, then reopened and audited them. These are representative populated first-save representations, **not 1,000 newly observed UI hands**. No production save was touched.

| Saved hands | Canonical hand rows | Packed replicas | Checkpoint | Total serialized store |
|---:|---:|---:|---:|---:|
| 100 | 1,034,330 B | 769,000 B | 1,153,384 B | 3,032,591 B |
| 1,000 | 44,181,173 B | 20,420,779 B | 4,018,736 B | 69,361,745 B |
| 10,000 follow-up | 474,082,014 B | 217,052,420 B | 16,139,321 B | 714,676,203 B |

Both **PASS**: every canonical/replica pair agrees through an independent backward-reference decoder, compact financial replay agrees, and full canonical reconstruction/audit agrees. The fixtures have different hand/table distributions; do not extrapolate the 100-hand row to 10k. Ledger, sessions and metadata explain the remaining total. Canonical rows are retained for independent auditing and rollback; this patch removes none of them.

At 1,000 hands, post-GC process heap is 13.64 MB after fixture-installation scope unwinds, 19.38 MB at verified compact readiness, and 73.35 MB while full history plus audit are held. Resident memory remains about 468 MB from fixture/allocation high-water; this is not 468 MB of live retained JavaScript. These are warm Node diagnostic processes with forced GC and a disk request reference, not browser/phone memory. The 10k first-save representation was subsequently executed below. Physical low-quota/eviction behavior remains unverified. [100-hand receipt](packed-storage/100-report.json), [1,000-hand receipt](packed-storage/1000-report.json).

The bounded 10k follow-up also **PASS**ed using the unchanged diagnostic bundle with `--max-old-space-size=4096 --expose-gc`. It validated all **10,000 canonical/replica pairs** independently, then reopened the checkpoint and completed full canonical audit with identical original data SHA256 `c7903b0a41365821564b712457b4fcf72e51c56ac71d318c98a251a5d4507441`. Independent replay reports wallet 98,640,349 cents, zero table chips, 10,000 hands, 101 sessions and 10,230 financial events; the audit is current and verified. No canonical record, financial event or policy version was rewritten.

After three GC/event-loop cycles at each boundary, the 10k process has **19.34 MB heap after fixture scope unwinds, 41.85 MB at compact readiness, and 633.96 MB with full history/audit held**. RSS is 2.16–2.17 GB, retaining fixture/allocator high-water; it is not 2.17 GB of live app objects. No heapdump was taken. The actual 714.68 MB store includes 217.05 MB of optional packed replicas in addition to retained canonical records. This quantifies the additional storage concern without removing records or weakening audit/rollback guarantees.

[10k run receipt](packed-storage-10000/run-receipt.json) pins exact fixture, compiled bundle and canonical hashes; [scalar report](packed-storage-10000/report.json) preserves record-family and memory measurements. Every compiled input still matches the execution source. The unchanged report template mentions 100/1,000 in its scope text; the companion receipt explicitly corrects that label to this executed 10,000-hand invocation. This remains an isolated populated initial-save representation, not 10,000 newly observed UI hands or a physical/native-browser quota test. It does not automatically promote an original acceptance requirement.

## Failed large-profile capture, preserved

The first natural-GC 10k attempt reached 4,008 observed complete preparation spans, with p50/p95/p99/max **12.92/52.23/424.37/797.06 ms**. Its timing trace and CPU profile survive, but the inherited assertion that compressed profiling artifacts must be under 24 MiB failed while storing the allocation profile. The final scenario report and its memory/assertion receipt were not written. Therefore this attempt remains **FAIL (evidence capture)**, and is not counted as a passed complete scenario. It does not explain the old 10.072-second observation. [Failure receipt](natural-10000-profiled/capture-failure.json).

The harness now saves the completed scalar execution receipt before expensive profile serialization. It retains oversized profile data losslessly in 16 MiB chunks, with per-part and complete-file hashes. Four executable tests pass for exact reassembly, missing/reordered/duplicated/corrupted parts, overwrite refusal and a pre-read reassembly budget. [Latest 4-test receipt](profile-artifact-budget-tests.json); the earlier 3-test run is retained separately and not added to the latest count. Profile serialization/reassembly memory is diagnostic overhead, outside ordinary gameplay; it must not be presented as application live heap. No production verification or poker code was disabled.

## Complete natural-GC 10k repeat

The repaired capture completed **PASS** at source `2243bfa`: **1,002 preparations and 164 complete hands**, starting from a separately prepared 10,000-hand checkpoint. There were zero forced GC calls and zero injected midplay reloads. Actual production engine/controller/policy/persistence functions ran through the same disk request reference. Final compact accounting and statistics agree with independent full-history replay; explicit full audit also passed. This is a new complete scenario, not retrospective promotion of the failed 4,008-preparation capture.

| Measurement | Observed result |
|---|---:|
| Ordinary preparation p50 / p95 / p99 / max | 11.82 / 54.89 / 374.77 / 470.19 ms |
| Policy p50 / p95 / p99 / max | 0.29 / 25.07 / 31.78 / 104.78 ms |
| Fresh verified checkpoint startup | 1,571.08 ms |
| Three subsequent fresh-controller recoveries: median / maximum | 1,283.76 / 1,435.41 ms |
| Explicit full history load | 27,593.34 ms |
| Explicit independent canonical audit | 27,013.85 ms |

The maximum at decision 881 contains persistence commit 461.32 ms, recovery preparation 353.43 ms, transaction 104.18 ms, reference JSON serialization 81.08 ms, policy 0.36 ms and GC overlap 14.50 ms. These nested spans are not additive. Approximate CPU sampling attribution during ordinary preparation is dominated by `canonicalWriter.write` (11.16 sampled seconds), the reference adapter's JSON serialization (3.06 seconds), canonical array/string assembly (1.74 seconds), GC (1.65 seconds), freeze traversal (1.18 seconds), and financial-context validation (0.68 seconds). The source map, CPU clock anchors and complete trace are preserved. This confirms periodic serialization/checkpoint work in this new subsecond peak; it does **not** identify the original 10.072-second event.

The 10k fixture initially consumes 497,624,350 bytes and reaches 534,103,670 bytes after the 164 new hands. Packing was not silently added to this existing canonical-only archive. Coarse natural-GC process samples show 48.97 MB heap at first readiness, 89.31 MB after active play, 713.37 MB with full history held, and 720.94 MB after scope unwind; the final sample is **not post-GC retained-heap evidence**. RSS reaches 1.54 GB. Natural garbage awaiting collection, diagnostics, archive materialization and profiler overhead are included. No physical-phone or isolated steady-state-app claim follows. Allocation sampling describes cumulative churn, not live heap or stored bytes.

The complete 21,492,094-byte allocation gzip is preserved in two parts of 16,777,216 and 4,714,878 bytes. Per-part/full hashes were checked, reassembly parsed successfully, and the final summary verifies each profiling artifact. [Report](natural-10000-qualified/10000-report.json), [CPU/allocation/trace analysis](natural-10000-qualified/10000-analysis.json), [all successful scenario summary](summary.json).

Across the two complete stress scenarios and the ten-preparation harness smoke, **three scenarios passed with 13,023 preparations and 1,832 completed hands**. These are not new unit-test or acceptance-requirement counts. The 4,008-preparation capture failure remains separate. No new ordinary preparation exceeded one second in either fully recorded stress scenario; the limited and differently instrumented samples cannot exclude the historical rare stall. The follow-up quantifies 10k fresh-packed storage, while full-history materialization, actual browser quota/eviction behavior and physical-phone responsiveness remain material validation work. No release gate or original criterion is waived by these results.
