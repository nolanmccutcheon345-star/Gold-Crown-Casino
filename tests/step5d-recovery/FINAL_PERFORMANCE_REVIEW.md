# Step 5D final recovery and performance evidence review

This section consolidates already executed browser and Node measurements. No new profiling run was performed to write it. Recovery is materially faster, but **10,000-hand readiness still misses the approximately five-second target**. The current architecture fully verifies and materializes complete selected history before enabling poker actions; it is not a constant-time financial checkpoint or lazy-history implementation.

## Measurement conditions and boundaries

Browser measurements use Chrome 155 on Linux, native IndexedDB in isolated databases, the actual production `mountApp` and asynchronous statistics code, and a 1,100 × 880 CSS viewport. Production guest databases were not accessed. The QA origin reports `secureContext=false` and `nativeSHA256=false`: these browser measurements use JavaScript SHA fallback, not WebCrypto. They must remain separate from the native-WebCrypto Node matrix. No physical device or INP measurement is claimed.

Each size/variant/context has **one observation (n=1)**. These cold figures cannot establish p50/p95/p99 or a statistically stable speedup. Exact inputs, raw receipts and source hashes are preserved; `FINAL_PERFORMANCE_EVIDENCE.json` gives SHA-256-linked scalar extracts and stage totals. Same-document candidate receipts pin source `94a8ed0`; fresh-document candidate receipts pin source `9cf0115c`, including the later initialization/previous-snapshot lifecycle repair. Baseline is frozen Version 9 source `104b9d6`. Node bundles are separately pinned historical candidate bytes, not retroactively relabeled as the repaired browser build.

`safeGameplayReadyMs` starts immediately before mounting the real application and ends when required recovery verification reports ready. `fullRequiredAuditCompleteMs` is identical: no required financial/history check was moved after gameplay. `secondaryStatisticsReadyMs` also waits for asynchronous statistics and the harness’s paint synchronization. Fresh-document `navigationTo…` adds document/module-start overhead. Shell and ready-paint fields use double `requestAnimationFrame` proxies, not standardized FCP/INP. Several paint proxies are roughly two seconds apart even when CPU work is tiny and no Long Task appears; the top-level control also exhibits this. These scheduling observations must not be labeled equivalent CPU stalls or subtracted from user-visible elapsed time.

## Six-size same-document browser comparison

Identical closed-session fixture bytes and accounting totals are compared. Fixture transfer/seeding and candidate one-time legacy verification/packing precede this measurement and are recorded separately. These runs retain the preparation document, so they are subsequent prepared-storage restores, not first-upgrade latency. All durations below are seconds except the Long Task columns. A 0 ms Long Task maximum means no task crossing the browser’s Long Task threshold was observed, not that the main thread did no work.

| Saved hands | V 9 verified ready s | Packed verified ready s | V 9 max Long Task ms | Packed max Long Task ms | Packed shell-paint proxy s | Packed statistics-ready s |
|---:|---:|---:|---:|---:|---:|---:|
|0|0.040|0.037|0|0|2.031|6.097|
|100|0.161|0.110|0|0|2.032|6.098|
|500|2.202|1.257|0|0|1.600|3.716|
|1,000|4.416|2.725|0|0|1.653|5.849|
|5,000|24.974|13.064|228|52|2.034|17.128|
|10,000|48.860|26.942|433|101|2.035|27.991|

At 10,000 hands, ready time is 48.860 s→26.942 s in this series, while maximum observed startup Long Task is 433 ms→101 ms. These are paired-workload observations, not population percentile claims. Normal startup still performs O(history size) work.

Use **`startupHeapPeakObserved`**, ending at statistics readiness, for candidate startup memory. The broader `heapPeakObserved` also includes the optional original-archive audit and must not be substituted. Older baseline receipts have only `heapPeakObserved` and no later optional audit, so that field is scoped to their startup window. These are coarse Chromium heap observations, not exact allocation measurements.

| Hands | V 9 observed startup heap MB | Packed startup heap MB | Packed heap before recovery MB | Packed optional preparation s |
|---:|---:|---:|---:|---:|
|0|8.0|12.7|5.5|0.022|
|100|14.5|32.7|20.1|0.210|
|500|90.9|129.4|78.2|3.046|
|1,000|152.4|277.0|73.7|6.864|
|5,000|656.8|1248.9|286.4|34.422|
|10,000|1426.0|2312.6|1839.2|73.300|

The 2,312.6 MB candidate startup peak at 10,000 hands follows preparation in the same document and starts from 1,839.2 MB. The 2,566.1 MB combined startup-plus-archive-audit peak is a different metric. Preparation took 73.300 s at 10,000 hands and includes verified legacy restore plus replica installation; it is intentionally excluded from the 26.942 s subsequent-ready figure. This cost cannot be omitted from first-upgrade planning.

## Fresh-document controls

The harness prepares the isolated IndexedDB, then performs a real `location.replace` into a new document/module context before measurement. It does **not** force a new browser process, renderer heap, disk cache, or GC cycle. Consequently fresh document is a stronger execution-context control but not clean-process cold memory. All four closed controls use the same canonical fixture per size and reconcile exact wallet/hand/settlement totals.

| Hands / reader | Verified ready from mount s | Navigation→ready s | Ready-paint proxy from mount s | Statistics-ready from mount s | Navigation→statistics s | Max startup Long Task ms |
|---|---:|---:|---:|---:|---:|---:|
|1,000 / V 9|6.053|7.816|6.114|8.182|9.945|710|
|1,000 / packed|2.742|4.820|4.065|6.098|8.176|0|
|10,000 / V 9|57.558|59.662|59.605|65.935|68.039|540|
|10,000 / packed|26.556|27.837|28.594|30.626|31.907|106|

| Hands / reader | Synchronous shell render ms | Shell-paint proxy s | Heap before MB | Startup heap peak MB |
|---|---:|---:|---:|---:|
|1,000 / V 9|4.5|0.058|1076.1|1101.5|
|1,000 / packed|4.0|2.038|101.8|105.5|
|10,000 / V 9|4.4|2.045|142.2|1113.5|
|10,000 / packed|4.8|2.034|1553.1|2354.1|

The fresh candidate 1,000-hand controller becomes verified at 2.742 s after mount, but navigation-to-ready is 4.820 s and the statistics-ready observation is 8.176 s after navigation. Do not translate the 2.742 s recovery timing into a claim that the complete user-visible startup always finishes within three seconds. At 10,000 hands, fresh candidate readiness is 26.556 s from mount / 27.837 s from navigation; the five-second objective is not met. Startup maximum task is 106 ms, versus 540 ms in that fresh baseline control.

Fresh 10,000-hand candidate starts at 1,553.1 MB and peaks at 2,354.1 MB during startup. The fresh 1,000-hand baseline starts at 1,076.1 MB, while its candidate starts at 101.8 MB. These unequal renderer/process residue conditions prevent a defensible causal memory-reduction or leak-reclamation claim from these coarse observations. No physically small-memory device capacity is established.

## Active-hand and pending-decision recovery

Pending fixtures create an actual heads-up hand after the saved archive, have Hero call, durably prepare the next bot decision, and explicitly pause before reload. Exact committed active-state digests are compared before/after restoration. They are paused-state recovery tests, not measurements of how quickly an unpaused bot next acts. The available baseline controls are top-level same-document runs; the candidate is a fresh embedded document, so this table is an executed-case inventory, not a matched speedup experiment.

| Reader / context | Saved hands | Verified ready s | Statistics-ready s | Max startup Long Task ms | Exact pending state preserved |
|---|---:|---:|---:|---:|---|
|V 9 / top-level|100|0.127|6.099|0|True|
|V 9 / top-level|1,000|3.811|7.115|111|True|
|V 9 / top-level|10,000|44.646|49.739|1353|True|
|Packed / fresh embedded|1,000|2.683|6.098|0|True|

The candidate pending case preserves wallet 99,805,110 c, table 20,000 c, exactly 1,000 completed hands/settlements and 1,027 ledger events. Its navigation-to-ready is 4.721 s, startup heap peak 899.8 MB from 755.4 MB before recovery, and no startup Long Task was observed. A fresh candidate 10,000-hand pending browser case is **not present** in this evidence set. Current Node stress separately restores a durably prepared choice and rejects a duplicate stale commit.

## Required audit versus retained-original archive audit

Every selected complete packed record has freshly verified original outer/inner hashes plus predecessor and semantic/financial checks before ready. The optional retained-original archive audit validates the additional old-format copy after statistics readiness. It is explicit QA invocation, **not an automatic background audit**, and the UI accurately labels that redundant archive as not audited until completion. It never changes the active financial state. All reported completed audits returned `verified`, `current=true`, and matched the recovered wallet and hand count.

| Candidate case | Required audit/ready s | Optional original audit duration s | Original audit completed from mount s | Optional audit max Long Task ms |
|---|---:|---:|---:|---:|
|closed / 1,000|2.725|4.626|10.476|96|
|closed / 5,000|13.064|25.576|42.707|466|
|closed / 10,000|26.942|52.244|80.241|1058|
|fresh-closed / 1,000|2.742|5.484|11.584|61|
|fresh-closed / 10,000|26.556|52.546|83.177|834|
|fresh-pending / 1,000|2.683|4.790|10.889|50|

The optional audit remains expensive: fresh 10,000-hand audit 52.546 s with 834 ms maximum task; same-document 10,000-hand audit 52.244 s with 1058 ms maximum task. Those stalls must not be hidden behind the smaller startup-task number. They occur during the separate explicit full original-copy audit, not skipped pre-play financial verification.

## Attribution and Node reference

Fresh-browser startup stage totals at 10,000 hands (excluding the later optional audit) expose the real work. Stage timers nest and include scheduling wall time; the table is attribution, not an additive CPU-time budget.

| Stage | V 9 ms | Packed ms |
|---|---:|---:|
|`recovery.read.hands`|2751.0|884.8|
|`recovery.freezeTransport`|6789.3|85.3|
|`recovery.unpackHand`|not applicable|3765.1|
|`recovery.segmentHash.hands`|19977.4|19071.2|
|`recovery.handChain`|21991.0|7.3|
|`recovery.handSemantics`|2288.2|235.3|
|`recovery.ledgerChain`|273.6|232.0|
|`recovery.financialSemantics`|12.5|9.7|
|`statistics.prewarm`|6336.5|912.2|
|`ui.render`|23.4|18.8|

The core bottleneck was repeated full-history object traversal/freezing and duplicate canonical serialization/hashing of repeated hand frames, rather than bankroll arithmetic. Lossless shared immutable nodes reduce that duplicate work. The paired hash stage still freshly computes both required original hashes; the later inner-chain pass only reuses the private proof for the exact immutable object while retaining order/semantics. No persisted self-hash or unchecked summary grants trust. Browser hashing remains dominant with JS SHA fallback. Closed fixtures do not rebuild bot decision memory at startup; hot stress measures it separately.

The serial Node 24/AMD EPYC reference uses native WebCrypto SHA and a serialized-string storage adapter, not native IndexedDB. One observation each, exact canonical prefixes, zero study imports:

| Saved hands | V 9 Node ready s | Packed Node ready s |
|---:|---:|---:|
|0|0.002|0.002|
|100|0.082|0.075|
|500|1.111|0.509|
|1,000|2.121|1.113|
|5,000|11.850|5.591|
|10,000|27.178|11.312|

Node 10,000-hand timed candidate recovery overlaps 200 reported GC events totaling 1.083 s, maximum 53.2 ms. Baseline lacks equivalent recovery-window clock fields, so no matched GC reduction is claimed. Full CPU profiles include fixture work, while stage timers scope recovery. The Node adapter retains original and packed serialized copies in RAM, so its heap numbers cannot substitute for browser memory.

Rollback-compatible storage adds a complete packed copy while retaining the original canonical records: approximately 481.48 MB→698.54 MB of serialized storage at 10,000 hands, including 217.05 MB additional replica data. Browser fixture-transfer bytes(482.33 MB) include archive record wrappers and are not the same metric. Actual IndexedDB disk/quota overhead was not inferred from either. First packing cost is explicit; failure preserves the verified original save at its slower speed and surfaces a diagnostic.

## Sustained gameplay and the original 9.79-second outlier

The source-pinned Node trace runs 5,000 actual policy 1.6 preparations after a genuine 10,000-hand archive, completes 703 additional hands, rotates 2/6/10-seat sessions with natural bustouts, and verifies every duplicate prepare is stable before one engine commit. The test uses deterministic seed `0x51c57a11`; like the retained Step 5C stress it intentionally uses JS SHA fallback. It is neither a browser latency run nor human calibration.

| Bot preparation | Step 5C retained 5k run | Step 5D 5k run |
|---|---:|---:|
|p50|4.024 ms|4.294 ms|
|p95|25.020 ms|26.679 ms|
|p99|31.267 ms|36.387 ms|
|Maximum|750.620 ms|457.540 ms|

Only one Step 5D preparation exceeded 250 ms. At decision 3322/six seats/flop, CPU sampling places about 431.1 ms in `freezeSnapshot` during `integrity.incremental`; policy evaluation is 22.94 ms and reported overlapping GC 9.99 ms. The second-largest 219.516 ms preparation also samples about 200.1 ms in that freezer. The specific native allocation/WeakSet suboperation remains unproven. No multi-second preparation occurred in these 5,000 samples, but the original 9.79 s observation had no contemporaneous CPU/GC trace and remains **unattributed**. It must not be declared eliminated.

Node event-loop-delay p95/p99/max are 57.44/86.05/573.05 ms under continuous stress. These are not browser Long Tasks or INP. Public-memory preparation p95 is 1.591 ms and policy p95 20.200 ms; full preparation includes reservation, verification and durable commit. Final independent accounting and full/incremental statistics agree:10,703 hands,10,990 ledger events, wallet 98,549,380 c and table 20,300 c. The pending choice survives reload unchanged and a duplicate stale commit is rejected.

## Release implications

Large-history recovery is safer to inspect and substantially faster in the measured environment, with shorter observed startup tasks, but remains linear, uses significant memory/storage and misses the five-second 10,000-hand target. First legacy upgrade and optional full original-copy audit remain costly. Common 1,000-hand verified-controller recovery is around 2.7 s in the browser candidate observations, while navigation/paint/statistics delays remain visible and separately reported. No physical-device performance, INP, unlimited storage capacity, leak-free reclamation or release-readiness claim follows from these measurements. Keep the source checkpoint and the published version stable while mandatory gates remain unmet.

## Evidence links

- [Browser scalar extracts, source pins and raw-file SHA-256s](FINAL_PERFORMANCE_EVIDENCE.json).
- [Fresh candidate 10,000-hand raw browser receipt](../../TEST_EVIDENCE/step5d/browser/step5d-fresh-candidate-packed-closed-10000.json) and [fresh Version 9 comparison](../../TEST_EVIDENCE/step5d/browser/step5d-fresh-baseline-closed-10000.json).
- [Fresh pending-decision browser receipt](../../TEST_EVIDENCE/step5d/browser/step5d-fresh-candidate-packed-pending-1000.json).
- [Matched Node matrix](evidence/final-matrix/summary.json), [5,000-decision trace receipt](evidence/stall-final/report.json) and [sample-aligned CPU attribution](evidence/stall-final/cpu-summary.json).
- [Integrity implementation and lifecycle-repair report](REPORT.md).
