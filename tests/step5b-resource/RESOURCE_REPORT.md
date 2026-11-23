# U12 completed resource run and V708 recovery evidence

**10,000 completed cash hands, 101 sessions, 67,982 bot decisions and 230,586 durable transitions.** The run finished in 24.61minutes using actual controller/engine and policy`synthetic-cash-1.5.0`. There were 3,665 five-card-board endings and 6,335 earlier endings. Tables started at 2/6/10 seats; normal bust-outs reduced occupancy. This is a Node test harness, not browser/device or human-realism evidence.

Every canonical hand and financial event was retained. At each checkpoint, full financial validation and independent full-replay statistics matched the incremental projections. All 10,000 unique hand settlements occurred once. The final virtual wallet is 98,640,349cents, with zero seated balance. A separate process restored the complete 25,928,759-byte gzip archive, checked its canonical SHA256, all session memberships, unique hands, wallet/table deltas and poker results; verification passed (`evidence/full/archive-verification.json`). The archive is synthetic private analysis evidence, not a public hand-history export.

## Resource trend

|Completed hands|Sessions|GC heap MB|RSS MB|Stored segments MB|Storage records|Full audit + stats replay ms|
|---:|---:|---:|---:|---:|---:|---:|
|0|0|10.10|52.16|0.00|4|5.58|
|100|1|18.88|161.20|1.12|207|43.61|
|1000|10|196.27|924.19|44.96|2038|1229.87|
|2000|20|372.95|1520.37|91.58|4069|2780.71|
|3000|30|623.13|2259.70|142.21|6101|4262.65|
|4000|40|708.54|3473.48|184.71|8133|5475.17|
|5000|50|1097.67|3752.52|235.79|10168|7832.94|
|6000|60|1215.28|3757.04|287.22|12201|8781.68|
|7000|70|1308.98|3760.97|333.22|14233|10743.08|
|8000|80|1424.52|3764.29|382.45|16266|11388.24|
|9000|90|1549.82|3768.39|435.76|18299|12778.49|
|10000|101|1639.96|3773.62|481.49|20333|14567.36|

The persistence reference holds serialized strings in RAM in addition to application objects; IndexedDB/browser heap usage is not inferred from these figures. Storage contained exactly required append-only records plus two overwritten manifests, with no accumulating full-snapshot copies. Maximum new segment writes per commit 2; maximum header 221,795bytes. Total history grows with actual hands, as required to preserve it. Range caches stayed at at most 4 shape entries and 8 analysis entries; public opponent memory stayed within its 120-hand bound (observed maximum 100 in these sessions).

The actual controller lifecycle kept at most 1 timer and 0 after close. A separate 50-session fake-time test exercised the real controller and BrowserPersistence heartbeat: maximum 2 timers, and all timers/listeners released after every close. Six quota/lifecycle automated tests passed, with typecheck and scoped lint passing (`reference-tests.log`).

## Latency and unresolved resource limits

|Measurement|N|p50 ms|p95 ms|p99 ms|max ms|
|---|---:|---:|---:|---:|---:|
|Full-run bot preparation|67982|7.36|23.82|31.55|9791.03|
|Full-run policy evaluation|67982|0.16|18.39|24.45|3193.35|
|Full-run complete hand|10000|74.83|291.40|406.33|9967.69|
|Follow-up bot preparation on same 10k corpus|60|3.44|32.66|44.75|44.75|

**The original 9.79second preparation sample remains unattributed.** It was not captured with a simultaneous CPU/GC trace, and the 60-decision follow-up did not reproduce it. Do not describe this as proof that all multi-second stalls are eliminated.

The attributable follow-up used the same full10,000-hand archive with actual production serialization/controller functions, CPU sampling, GC trace and stage timing. Cold initialization and two full reloads took 42.14,43.04 and56.09seconds. GC overlapped 1.64,2.55 and3.93seconds (3.9–7.0%); it does not explain most full recovery time. Profile self time was dominated by storage canonical serialization 44.41seconds, deep freeze 35.81seconds and SHA256 compression 25.06seconds; GC self time 12.67seconds. Six full integrity audits across three loads also demonstrate repeated full verification at restore and controller initialization. No mandatory verification was disabled.

The initial full-run immediate post-close GC sample still held 2.22GB. A follow-up that unwound async frames and performed four full GC/event-loop cycles stabilized near 554MB heap; retained objects/capacities are not classified. Accordingly this evidence does **not** establish leak-free memory reclamation or mobile readiness for10,000 stored hands.

Next technical actions: heap-retainer analysis of the remaining memory; retain full canonical trust-boundary validation while eliminating demonstrably duplicate same-snapshot auditing; evaluate bounded/lazy history access and off-thread or cooperatively scheduled full recovery. Measure actual large-history browser/device recovery separately. These are measured limitations, not reasons to weaken checks.

## V708 and evidence boundaries

Actual BrowserPersistence/controller reference tests injected QuotaExceededError at hand/current writes. They verified visible controller error status, blocked further actions, valid committed-only redacted export, restore of the last committed active hand, exact-once retry/lost-ack settlement, and stale-lease rejection with takeover recovery. This agent did not execute real browser/native quota exhaustion; parent browser evidence is separate.

The10000-hand run used policy 1.5, now frozen for compatibility. The later 1.6 remaining-exposure fix has its own 94-test / 8,064-proposal validation and cold-policy timings under `tests/step5b-exposure`; this resource run is not relabeled as 1.6. All full histories remain recoverable and auditable. Automated counts are not mapped V7 acceptance counts.

Reproduce resource run using README.md. Tail profiling: bundle `profile-tail.ts` with esbuild, run Node with `--expose-gc --max-old-space-size=6144 --trace-gc --cpu-prof`; then run `summarize-tail.mjs` against the bundle. CPU/GC/raw timing evidence is under `evidence/tail/`.
