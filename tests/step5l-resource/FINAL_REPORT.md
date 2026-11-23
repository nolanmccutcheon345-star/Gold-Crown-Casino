# Step 5L completed resource qualification

**The fresh 10,000-hand workload and its independent archive verification passed.** This closes the previously interrupted resource execution; it does not establish R1 release readiness or complete physical-device, browser performance, human usability, screen-reader or CI gates.

## Source and recovery

The original long-run TypeScript profile was recovered byte-for-byte from its surviving emitted source map (SHA-256 `8cfb28066dcc6f656d31f3590447094f0988d778a1f5515dbd9935e680485d77`). The old interrupted store is preserved as an explicitly unqualified forensic archive. Its surviving physical files include 1,754 hand-shaped records, but the live key index was lost; 1,637 was only the last previously reported log observation. None of those records is counted in the new successful run. This does not recover Git commit `1805380`.

The fresh run began with zero saved hands. Its 94 production inputs match the recorded application candidate `3ecea1c2b71c8e8b9963547da676171f91f21716`. Repository baseline at launch was the honest reconstruction `c9a4c11fe32c18cecda68eb2a0bfcc97b09b8879`; the then-uncommitted harness is identified by its actual source/bundle hashes, not falsely attributed to that Git object:

- Executed profile source SHA-256: `bbef1d501b14f20ffc2a7b3206bec6cdf0bc4a0de6ebcf335c992a3e11a051d4`.
- Executed runner bundle SHA-256: `ec0f632fc5883f12b4aff154a55e7e4b177ea9c03b64ab3b4b4396aa09ed16ec`.
- Full run source-receipt SHA-256: `fb0e3fab54bfbe410ae3c87f764366d8a0efb530c9ecdc9fe8a0c41f9a8fc68d`.
- All 99 imported input hashes and the exact read-only cache-size getter were independently reviewed in `../step5l-regression/resource-harness-review.json`.

No production module was edited by this lane. The test-only getter exposes cache counts, not cards or decisions. The reconstructed launcher enables periodic pending-reload/stale-commit checks that were disabled in the original sustained-mode harness.

## Executed results

- Exactly **10,000 newly completed canonical hands**, **74,117 ordinary bot preparations**, **91,573 actions**, **250 sessions**, with successful process exit 0.
- **74 pending-decision recoveries and stale-commit rejection checks**, plus milestone controller recoveries. Every ordinary preparation was also checked for decision idempotence.
- Engine chip accounting asserted after every action. Production incremental statistics agree with production full-history calculation.
- A separate process independently hashed/replayed **10,000 canonical hands**, **10,508 financial events** and **20,979 storage records** using the separately authored BigInt oracle. All settlements, sessions, money transfers and ending stacks reconcile exactly.
- Nine final resource-verification groups pass. These are check groups, not nine V7 acceptance IDs or additional Vitest cases.
- Separate 10-hand launch smoke, five corrupted-evidence rejection checks and four lossless-part handoff checks passed. Typecheck and scoped lint passed.

Final balances in cents: **98,791,469 wallet + 0 table = 100,000,000 manual funding − 1,208,531 poker result**. Initial/manual funding was never counted as poker winnings. Each of the 250 sessions has one terminal cashout. The test uses virtual money only and a deliberately conservative Hero policy; its losses are not a realism or real-world profitability finding.

Nominal sessions rotate 2/6/10 seats, $1/$2, $200 buy-in, no rake, alternating low/high synthetic population settings. Opponent bust-outs produce some smaller actual tables: completed hands by occupied seats were 2:3,360; 4:3; 5:227; 6:3,090; 8:128; 9:620; 10:2,572. The run reached five board cards in 4,299 hands and ended earlier in 5,701; five-board-card counts are not automatically showdown counts. Independent rake and betting/hand-ranking comparisons belong to the separate regression suite.

## Performance and resources

Reference environment: Node 24.22.1, Linux x64, AMD EPYC 9V74, 9 logical CPUs, 4 GiB Node heap limit. This is the production controller/persistence implementation through a disk-backed IndexedDB request reference, **not native IndexedDB or physical-browser timing**. Early concurrent regression intervals are recorded in `concurrent-work.json`; it is not an isolated matched speedup experiment.

Play took **4,410.81 seconds (73.51 minutes)**. Ordinary preparation p50/p95/p99/max was **12.08 / 49.41 / 337.89 / 783.55 ms** across 74,117 samples; none exceeded one second. The slowest measured preparation included 767.71 ms in nested persistence commit, 643.38 ms in recovery preparation and 108.24 ms in JSON serialization; policy evaluation took 0.189 ms and measured GC overlap was 13.79 ms. Nested spans must not be added. The original **10.072-second historical event remains UNATTRIBUTED**, not fixed by the absence of a repeat.

| Completed hands | Logical storage MB | Post-GC heap MB | RSS MB |
|---:|---:|---:|---:|
|0|0.006|12.17|60.91|
|100|24.53|31.88|322.06|
|1,000|74.24|36.92|381.29|
|5,000|299.67|83.02|477.77|
|10,000 before cashout|586.51|114.20|544.80|
|10,000 after cashout|586.51|110.23|585.89|

MB is decimal. Memory includes growing diagnostic windows/contexts, GC records and the disk index; it is not a pure retained-app heap. No fixture construction is included because the account started empty. Ordinary play uses natural GC; resource checkpoints deliberately force GC outside preparation timings.

Final logical bytes: canonical hands 520,439,667; financial ledger 7,032,162; sessions 1,043,229; 120 redundant packed replicas 2,905,515; two checkpoints 42,444,089; 94 journal records 12,635,043; other heads/manifests/lease 14,181. Total **586,513,886 bytes**. This is JSON payload size, not browser-origin allocation. Canonical history intentionally grows; redundant replicas never exceeded 120, checkpoint generations two, journal records 126, and current-policy caches 4/8. The controller timer count stayed one and became zero after close; native IDB heartbeat is outside this adapter.

Warm-process/controller recovery measured 0.517 s at 100 hands, 0.772 s at 1,000, 1.217 s at 5,000 and 1.836 s at 10,000. The 74 pending recoveries had p50/p95/p99/max 1.204 / 1.684 / 1.712 / 1.712 s. Module caches and the disk index survive these controller reloads, so they are **not cold-browser startup claims**.

Explicit full-history loading took **28.14 s**, and full archive audit **25.58 s**. Coarse sampled heap peaked at **963.53 MB**, RSS **1,713.30 MB**, during/after bulk history/audit work. Those samples are not normalized post-GC retained-object measurements, but they remain a meaningful large-archive memory limitation. Node event-loop p50/p95/p99/max was 11.89 / 63.41 / 222.43 / 652.21 ms; it includes diagnostics, forced GC, independent test audits and synchronous reference storage, and is not browser INP.

## Preserved evidence

`evidence/full-10000/` contains successful process/source receipts, the complete report, all milestone resources, full canonical/financial reconciliation, independent verifier bytes, measured slow-event paths and summary. The exact compressed trace (147,174,384 bytes) and canonical record archive (38,273,763 bytes) are preserved losslessly in 18 and 5 hash-verified parts respectively. `archive-parts.json` binds the ordered pieces and complete hashes; `artifacts.py restore` reassembles them from a clean checkout. Originals remain local but are excluded from Git to avoid redundant large payloads.

The full canonical archive's uncompressed stream hash is `43366c37790e52ee0b4df43438461d7cd689fad442a66dd1c1f1843a6f567e9a`. Report SHA-256 is `709e2d561a7734d50008eee6d78eee5c1eb258f823df7b2bdbe5fda494f9bf72`. Independent verification receipt SHA-256 is `21a5057f24637a953fb1893db79773a4d0273803811d92626413e24365cf1dbd`.

The original interrupted remnants are separately preserved under `recovered/interrupted-forensic/`, with every member hashed and read back from the archive. That is byte-preservation evidence only, not a certified recoverable guest save or another passed workload.

All Site deployments and access policies remain unchanged by this lane. Physical-device, actual VoiceOver, independent-new-user, hosted CI and other complete-release conjunctions remain separate gates. No human calibration, solver validation or real-user results are claimed.
