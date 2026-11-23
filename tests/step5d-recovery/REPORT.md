# Step 5D storage/recovery implementation and measured evidence

Scope: recovery lane only. The production runtime is frozen at storage commit `a1243ed` (integrated by the release owner). Full UI/browser/device/CI qualification and the 302-ID acceptance matrix are owned by the release integrator. This report does not claim R1 readiness or publication.

## Finding and implementation

The matched Version 9 10,000-hand cold restore takes **27.178s** in the Node storage reference. Of that time, original outer-hand canonicalization/hashing consumes 9.727s, repeated inner-hand canonicalization/hashing 7.800s, defensive transport freezing 6.135s, record reading/parsing 1.746s, and historical provenance checks 1.313s. Stages may nest; do not sum all recorded fields. Financial semantic reconciliation is 7.4ms; the financial chain hash validation is 121.8ms. The bottleneck is duplicated historical frame object work, not bankroll arithmetic.

The implementation keeps the existing storage and financial architecture. An optional, manifest-bound, lossless DAG transport stores complete hand records with repeated immutable subtrees represented once. It does **not** store an unverified financial summary, skip old hand checks, or introduce a lazy-history checkpoint. Every restored hand still passes the original outer segment hash, original inner record hash, predecessor ordering and all financial/provenance semantics before gameplay. Pure canonical encoding reuses a subtree only after private decoder ownership establishes deep immutability. Inner-hash proof is private and issued only after both hashes have just matched; explicit independent audits always rehash. No caller-owned frozen object or persisted self-hash grants financial trust.

Original Version 2 records remain unchanged for the tested frozen V7-R rollback reader. Packed data is an additive optional descriptor covered by the existing manifest checksum. The legacy reader can load the canonical rows and drops the extension when it next commits; the new reader then performs full legacy verification and reinstalls the optimization. Original old migration receipts reconstruct the same original manifest. Optional installation is one fenced IndexedDB transaction, with no extra financial event or revision. Failed quota/transaction writes preserve the already verified canonical save and surface a diagnostic.

A missing or damaged replica falls back to an independently verified original row with a diagnostic. If neither copy verifies, recovery fails closed. A complete valid packed copy can recover when the redundant original hand copy is damaged; its retained rollback archive is explicitly marked **not audited**. `auditCanonicalArchive()` validates those original rows separately and reports the exact revision/checksum. Generation and current-manifest fences prevent an older audit completion from certifying a newer save. Neither fallback nor audit silently repairs or deletes records.

## Matched cold measurements

Node v24.22.1, AMD EPYC 9V74 host, native WebCrypto SHA; actual production `SessionController.init` plus segmented restore through an in-memory serialized-string storage adapter. Baseline is original `104b9d6`; candidate source and every loaded source file are pinned in `evidence/final-matrix/*.source.json` and exact compressed bundles/maps. Six exact historical prefixes, one cold observation each, alternating baseline then candidate serially. **These are not p50/p95 estimates and not browser/device measurements.** No study imports are present. These fixtures are closed-session loads; the integrator's actual-browser suite covers active-hand reload.

| Saved hands | V9 seconds | Candidate seconds | Selected bytes MB | Both copies MB | Candidate heap after MB |
|---:|---:|---:|---:|---:|---:|
| 0 | 0.002 | 0.002 | 0.00 | 0.00 | 11.7 |
| 100 | 0.082 | 0.075 | 0.84 | 1.88 | 52.7 |
| 500 | 1.111 | 0.509 | 10.21 | 31.36 | 108.4 |
| 1,000 | 2.121 | 1.113 | 21.16 | 65.34 | 171.5 |
| 5,000 | 11.850 | 5.591 | 110.92 | 342.94 | 601.9 |
| 10,000 | 27.178 | 11.312 | 224.45 | 698.54 | 1094.8 |

At 10,000 hands, candidate recovery is **58.4% shorter**, but **11.312s still misses the provisional 5s target**. The common 1,000-hand reference is 1.113s; this does not establish physical-mobile readiness. Selected-copy required audit completion equals time to safe gameplay in this harness. An additional audit of the redundant rollback archive is excluded and explicitly separate; browser evidence measures it. There is no claim that required financial checks run after gameplay.

The selected 10,000-hand candidate still spends 4.888s unpacking (1.597s JSON parsing, 3.280s checked graph hydration), 5.280s on paired original hashes (including 2.335s canonical encoding), 144ms on hand provenance, 182ms on ledger hashing and 5.6ms on financial semantics. This remains O(history size). Further reducing time to gameplay requires a separately designed, independently verifiable current-state boundary or reducing complete hand representation complexity; skipping validation is not an acceptable fix.

Fixture encoding is intentionally outside these subsequent-startup measurements and recorded separately: **27.584s** at 10,000 hands. First Version 9 upgrade must also pay full legacy restore plus encoding, serialization and atomic installation. In the separate deterministic hot-stress adapter with JavaScript SHA fallback, first initialization/installation was 53.836s and the following packed reload 15.854s; these different conditions must not be mixed with the native-SHA cold matrix. The integrator's native-IDB browser harness distinguishes first installation from prepared packed startup.

Rollback compatibility costs storage: original 481.48MB plus about 217.05MB of packed records, total 698.54MB serialized reference data at 10,000 hands. Real IndexedDB quota and physical storage overhead may differ. Quota failure keeps the verified original data usable at its original slower speed. This lane makes no mobile storage-capacity guarantee.

Candidate 10,000-hand timed recovery overlaps 200 reported GC events totaling 1.083s, largest event 53.2ms. Cold baseline lacks the added clock-window fields, so its GC total is explicitly not a comparable startup-only statistic. Node heap after 10,000-hand candidate restore is 1,094.8MB versus 1,412.1MB baseline; these figures include the in-memory storage adapter, not only the application. CPU profiles include fixture extraction/encoding as well as restore; stage timers identify the exact restore costs. Browser maximum tasks, rendering and memory require the separate native browser evidence.

## Sustained bot preparation and rare stalls

The final source-pinned 5,000-preparation trace begins with 10,000 saved hands, rotates 2/6/10-seat sessions (natural bustouts also produce nine occupied seats), and completes 703 additional hands. It uses the same deterministic seed and Hero policy as the retained Step 5C workload. Every measured prepare is followed by an identical duplicate prepare and then an actual engine commit. Test-only entropy removes WebCrypto `subtle`, so this stress uses the same JavaScript SHA fallback as Step 5C; do not compare its recovery speed with the native-SHA matrix.

| Measured preparation | Step 5C retained run | Step 5D run |
|---|---:|---:|
| Samples | 5,000 | 5,000 |
| p50 | 4.024ms | 4.294ms |
| p95 | 25.020ms | 26.679ms |
| p99 | 31.267ms | 36.387ms |
| Maximum | 750.620ms | 457.540ms |

The small median/tail increases are retained, not hidden. One Step 5D preparation exceeded 250ms. The 457.540ms maximum occurs at decision 3,322 / 10,475 total hands, six players, flop. CPU sampling attributes about 431.1ms to `freezeSnapshot` inside `integrity.incremental`, while policy evaluation takes 22.94ms and overlapping reported GC is 9.99ms. The second-largest preparation is 219.516ms, with about 200.1ms sampled in the same freezer. The specific allocation/WeakSet suboperation is not established, so this is a measured residual freezer cost, not a proven GC-only cause. Complete permitted decision inputs, stage trace, CPU samples and source-mapped exact bundle are retained.

The original 9.79s sample had no contemporaneous trace. This run cannot retrospectively explain it. No multi-second preparation recurred in these 5,000 samples. Node event-loop-delay p95/p99/max were 57.44/86.05/573.05ms under continuous simulated play; these are not browser long-task or INP numbers. Maximum sampled heap during stress was 4.236GB, falling to 267MB after releasing the full in-memory archive and forced collection. Both physical copies, trace arrays and diagnostic observations are retained by the stress adapter, so these memory numbers do not establish browser leaks or browser capacity.

Final independent full replay and incremental statistics agree. The exact endpoint matches Step 5C: **10,703 hands; 10,990 ledger events; 21,917 commits; wallet 98,549,380 cents; table 20,300 cents**. Unique hand IDs, one settlement per hand, wallet+table conservation, active-state accounting, pending-choice reload identity and stale callback rejection all passed executable assertions. One interrupted pending decision was restored and committed once. Policy version remains `synthetic-cash-1.6.0`; no poker engine or opponent policy was changed.

## Verification and retained evidence

- `evidence/batch-final-targeted.json`: 112/112 targeted executed tests passed; includes strict packed input, populated streets, actual settled hands for eight archetypes, original-byte equality, full financial replay, missing/corrupted copy and descriptor cases, migration receipts, rollback and interrupted writes. Earlier 84/84 runs overlap and must not be added to this count.
- Independent reviewer: 117/117 new boundary/adversarial tests and 199/199 broader retained tests passed against `a1243ed`, with native digest spies, failed-proof revocation, clone isolation, exact predecessor enforcement, semantic corruption rejection, frozen V7-R operations and audit completion races. Those counts and exact tests are in that lane's evidence; they are not new original V7 acceptance IDs.
- `evidence/final-matrix/`: all six baseline/candidate raw timing reports compressed; exact source/bundle/map provenance; CPU profiles; concise summary; typecheck/lint output and SHA-256 artifact manifest.
- `evidence/stall-final/`: 5,000-decision PASS receipt, full compressed trace and CPU profile, source/bundle/map, CPU attribution, action-input record for the slow preparation and exact financial endpoint.
- Test helpers pass TypeScript and ESLint. A test-only nullable TypeScript annotation and a probe `let` lint issue were repaired without changing measured bundle behavior; retained bundles preserve the exact code executed.

Reproduction uses the committed bundles without depending on later source edits. Decompress `final-matrix/baseline.bundle.mjs.gz` and `candidate.bundle.mjs.gz` to the paths expected in `run-matrix.mjs`; invoke `node tests/step5d-recovery/run-matrix.mjs` from the project root. This recreates serial cold evidence using the retained canonical fixture. `build-profile.mjs` rebuilds from an explicitly supplied source worktree and writes SHA receipts. For hot stress, `build-stall.mjs <source-root>` generates `/tmp/step5d-stall-final.mjs`; run with `STALL_SOURCE_ROOT=<source-root> STALL_RUN=final STALL_DECISIONS=5000 node --expose-gc --max-old-space-size=6144 --cpu-prof --cpu-prof-dir=tests/step5d-recovery/evidence/stall-final --cpu-prof-name=run.cpuprofile /tmp/step5d-stall-final.mjs`, then `summarize-stall.mjs` on that evidence directory. Running these commands intentionally creates new measurement receipts.

## Release implications

This is a safe, measured reduction in complete-history recovery work, with a significant disk-space tradeoff. It does not satisfy the 10,000-hand 5s target in the Node reference. First-upgrade installation remains expensive. Required financial and history validation are retained. Original 302 requirements and 86 deferred features were not edited by this lane. No publication was performed. R1 readiness remains the integrator's decision based on the actual browser candidate, all mandatory gates and external device/human/hosted-CI dependencies.

## Post-integration retained-regression repair

The integrated release suite subsequently exposed six failures in the original migration/erasure tests. The earlier targeted results remain accurate but were insufficient coverage. A representation install during a second reader's load changed a fresh save's manifest and invalidated the first controller before its intended deletion; installation also replaced the exact `previous` migration snapshot. New/restarted saves now create the empty packed descriptor in their first atomic transaction, and representation installation preserves `previous` while retaining `pre-packed-v1`. All CAS and erasure guards remain unchanged. Original assertions now pass (84/84 broadened run), plus two new initialization cases; typecheck/lint pass. `evidence/integration-repair/` preserves before, intermediate and final results. Earlier performance artifacts remain explicitly pinned historical candidate measurements; the final browser release candidate must be refreshed.
