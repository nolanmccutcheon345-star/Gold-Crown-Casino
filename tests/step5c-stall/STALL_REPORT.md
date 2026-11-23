# Step 5C rare-stall baseline

The original 9.79-second preparation remains unattributed: its Step 5B run did not retain simultaneous CPU/GC tracing. A new 5,000-decision production-controller run on the genuine 10,000-hand corpus did **not** reproduce a multi-second preparation, but did capture two attributable slow preparations and a user-action stall. These are evidence of remaining latency risks, not proof that the original issue is eliminated.

|Baseline f54cac runtime, policy 1.6|N|p50 ms|p95 ms|p99 ms|max ms|
|---|---:|---:|---:|---:|---:|
|Bot preparation|5,000|5.11|25.75|33.43|851.30|
|Policy evaluation|5,000|0.17|19.37|26.24|66.46|
|Node event-loop delay histogram|10ms sampling|19.63|48.14|73.33|1,245.71|

The workload completed 703 new hands, retaining 10,703 canonical hands and 10,990 financial events. Tables rotated 2/6/10 seats, with natural bust-outs. No think-time or timeout was used. Duplicate preparation preserved the sampled decision; restoring an interrupted pending decision and retrying an obsolete commit passed. Full financial validation, unique settlements and independent full-replay versus incremental statistics agreed. The final virtual balance is 98,549,380c in the wallet plus 20,300c at the table; it reconciles to the initial wallet plus new poker results.

## Attributable execution paths

1. Decision 2,151, 10 seats, 10,298 saved hands: 851.30ms preparation. Public memory took 845.34ms. CPU sampling attributes 844.46ms to `freezeSnapshot`; no GC event overlapped. Policy took 0.26ms. The cache's public-memory projection was bounded to the active session, not all 10,298 hands. This establishes the freezing path, but does not alone distinguish descriptor traversal, native WeakSet growth or another native operation inside that function. It would be incorrect to call this range-equity computation or claim a specific WeakSet cause without further instrumentation.
2. Decision 1,260, 6 seats, 10,192 hands: 653.33ms preparation. The JSON storage-reference write interval overlapped a 623.47ms major GC; CPU sampling independently attributes 623.70ms to GC. Policy took 20.80ms.
3. After decision 4,970, a heads-up Hero action took 1,237.81ms, overlapping 1,114.14ms major GC. The longest gameplay heartbeat interval was 1,245.13ms. Counting only bot preparation would miss this direct-interaction risk.

Source-phase windows, GC timestamps and sampled execution stacks are retained in `evidence/baseline/trace.json.gz`, `run.cpuprofile.gz`, `cpu-summary.json`, and `responsiveness.json`. Slow decision records contain the bot's permitted observation and own profile, with complete public action history; they are private synthetic diagnostics, not a public history export. The exact instrumented bundle is retained as `run.bundle.mjs.gz` with its SHA256.

Cold controller initialization took 45.35s; pending-decision recovery at 10,703 hands took 48.04s. The separate independent archive hash verification took 8.72s and statistics comparison 3.84s. Final full financial/statistical reconciliation took 17.79s. These are separately measured and are not hidden inside intentional think-time.

Memory samples peaked at 3.54GB heap during the gameplay checkpoints, falling to 1.55GB after major GC. This reference holds both serialized storage strings and restored objects in RAM; it is **not** an IndexedDB heap or physical-device measurement. Root-coordinated browser tests remain separate.

Two of 5,000 preparations exceeded 250ms (0.04% in this workload). The sample does not exclude the much rarer Step 5B frequency (one 9.79s sample among 67,982 preparations). Decisions are correlated by session, so an IID confidence interval would overstate certainty. The known freeze and GC paths merit optimization and matched reruns; the historical 9.79s finding must remain documented unless a measured reproduction establishes its cause.

## Matched recovery-optimized rerun

Recovery runtime `4b0ed5e` was integrated into the isolated benchmark as `fcfacaf`. The same 5,000 decisions produced the same 703 completed hands, seat/street sample counts, final wallet/table balance, ledger count and 21,917 commits. Full reconciliation and interrupted-pending idempotence passed again. This harness's deterministic crypto wrapper exposes no `subtle`; **both** runs therefore exercise the supported SHA fallback. The separate recovery matrix measures native-WebCrypto acceleration.

|SHA-fallback matched workload|Before|After recovery optimization|
|---|---:|---:|
|Preparation p50 / p95 / p99 / max ms|5.11 / 25.75 / 33.43 / 851.30|4.47 / 26.21 / 34.79 / 722.56|
|Cold controller recovery seconds|45.35|28.76|
|Pending recovery at 10,703 hands seconds|48.04|31.20|
|Node loop p95 / p99 / max ms|48.14 / 73.33 / 1245.71|52.07 / 74.06 / 725.61|

The public-memory freeze stall persists: decision 2,132 took 722.56ms, of which 719.68ms was public-memory processing, 718.65ms CPU-sampled in `freezeSnapshot`, with no overlapping GC. A separate 660.12ms preparation overlapped major GC, including 635.71ms CPU sampling in the collector. Its policy timer was 654.61ms **including GC**; attributing that whole timer to strategy complexity would be incorrect. These results motivate a separate bounded public-projection freezer; they do not establish that the rare-stall problem is resolved.

## Confirmed bounded-freezer fix and final matched run

Production change `23e3c72` keeps freshly copied public-memory projections out of the canonical storage freezer's long-lived WeakSet. A per-projection traversal set is discarded after freezing. All nested output remains immutable, accessors are rejected unread, and private `isVerifiedHistory` provenance still controls cache eligibility. No poker, policy, financial-ledger or canonical-validation behavior changes. The historical scan is unchanged because profiling did not identify it as the large stall.

|5,000-decision matched workload|Original f54cac|Recovery optimized|Bounded public freezer|
|---|---:|---:|---:|
|Preparation p50 ms|5.11|4.47|4.04|
|Preparation p95 ms|25.75|26.21|24.66|
|Preparation p99 ms|33.43|34.79|31.04|
|Preparation maximum ms|851.30|722.56|570.96|
|Public-memory maximum ms|845.34|719.68|7.68|
|Node loop maximum ms|1245.71|725.61|580.91|

Final public-memory p50/p95/p99 are 0.64/1.44/1.99ms. The recurring large public-freeze path did not recur in this matched run. The remaining 570.96ms preparation is predominantly GC (549.46ms sampled collector self-time; PerformanceObserver reports 451.70ms overlap). The second-largest preparation was 57.22ms. These two GC instruments measure different boundaries; neither is presented as exact total collection accounting.

All three runs produced the same 703 new completed hands, 10,703 total hands, 10,990 ledger events, 21,917 commits, 98,549,380c wallet and 20,300c seated balance. Decision populations were 279 heads-up, 1,847 six-seat, 695 nine-seat and 2,179 ten-seat; street opportunities were 3,383 preflop, 584 flop, 553 turn and 480 river. Exact endpoint/count comparisons are executable in `compare.mjs`. Complete action-by-action transcripts were not retained for cross-run equality; the runtime test entropy and unchanged policy logic supply matched inputs, with independent financial/statistical reconciliation on every run.

Final SHA-fallback cold initialization was 26.31s and pending recovery at 10,703 hands was 30.04s. These remain substantial waits. No browser responsiveness or physical-device claim follows from these Node measurements.

Executed focused verification: **20/20 tests passed**, full typecheck and scoped lint passed. Four new public-freezer cases cover deeply immutable copies, exact permitted-memory and decision equivalence across all eight archetypes, counterfeit frozen histories that must not receive cache trust, and rejection of accessor-producing bugs without invoking getters. The first test run had one test-fixture mistake: it altered a nonprojected deal event. The corrected fixture identifies the actual projected public event by ID; the failed run is preserved as `public-freeze-initial-tests.json`. No product assertion was relaxed.

Across these three instrumented workloads, **15,000 actual preparations** were executed, plus the separate 20-decision harness sanity run. The original 9.79s observation remains a documented unknown. GC stalls still occur under the heavy reference workload, and 5,000 final samples cannot establish absence of a roughly once-in-68,000 event. This work confirms and repairs the recurring public-memory freezing deficiency; it does not justify claiming all rare stalls or large-history mobile recovery are solved.
