# Step5F matched native recovery profiling

Prepared, not browser-executed. This is the Step5E recovery harness copied into an independent Step5F namespace. Existing Step5E reports, assertions and Step5D compressed canonical fixture bodies are unchanged.

Build the matched runtime module exports from the integrator checkout:

```sh
node tests/step5f-browser/build-runtimes.mjs all
```

Baseline is exact saved Version11 `c2de7f98518c8400ccdf58339abb1ba27f1f3f78`. Candidate is the actual source checkout HEAD, with its production dirty status and source hashes explicitly recorded. The optional third builder argument selects an explicit source checkout; it is not assumed to be the authoring worktree. Separate `step5f-fixtures` artifacts preserve historical evidence. Assets are byte-verified before importing. These module exports test the actual production recovery code, not the dist application entry point.

Open `/tests/browser/step5f-recovery.html`, select history size, baseline/candidate, closed/pending state and normal/conversion path. Use **Open top-level run** for a top-level measurement. The isolated native database is populated with the unchanged, raw-SHA-verified Step5D fixture. Normal recovery installs its selected verified checkpoint before measurement. The pending case uses actual frozen V11 production code to commit and pause a genuine pending bot decision before either selected reader is measured. Setup and installation are reported separately.

A real `location.replace` starts a fresh measurement document. Only a bounded scalar preparation receipt survives navigation. Both V11 and candidate already support compact/lazy history, so both must use their checked `totalHandCount`, `historyLoaded` and public `loadFullHistory` contracts. This removes the obsolete V10-only assumption that every saved hand body is resident; it does not relax any financial, pending-state, history-count or audit check. Both readers use the same ordinary history-load control and full independent audit.

The report distinguishes runtime import, initial shell, verified wallet/safe gameplay readiness, rendering paint proxies, secondary statistics, explicit history loading, independent canonical audit, and post-audit storage measurement. It retains independent ledger/table/settlement uniqueness checks, original hand counts, aggregate hand results, pending-state digest equality, source provenance, and cleanup. Every storage open must match this run's exact new `ai-texas-step5f-recovery-*` database. Production guest storage is refused.

The page provides complete downloadable JSON and bounded text chunks. Record all repeated runs, including failures and slow outliers. Compare exactly matched reader/size/state/path conditions. Do not relabel a single observation as a p95 distribution.

Limitations: a fresh document is not a new renderer process, forced garbage collection, cold disk cache, or physical device. Chromium heap observations may include preparation residue; they are coarse rather than precise retained-object measurements. Long Tasks are not INP. Historical/audit task windows may overlap and must not be summed as CPU attribution. Serialized JSON bytes are not physical IndexedDB disk allocation. Full audits are explicit after readiness, not implicitly background-completed. Browser, device and compiled-app verification must be recorded separately.

Authoring checks: typecheck, scoped lint and builder syntax validation passed after correcting a test-harness `prefer-const` style error. No browser was launched by this authoring workstream and no test result is fabricated.
