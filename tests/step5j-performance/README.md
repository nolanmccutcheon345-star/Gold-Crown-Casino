# Step 5J repeated performance qualification

This folder contains test-only diagnostics. Production poker, bot, accounting, storage and UI code are unchanged. `profile.ts` preserves the existing Step 5G production-controller diagnostic and adds per-seat measured preparation samples and context identifiers. `run.mjs` verifies all 94 compiled production inputs against application commit `138cdcf325129c69f127d0e16bc94942abea752f` before executing.

Run from the repository root with installed lockfile dependencies and **new** output/fixture paths:

```sh
node tests/step5j-performance/run.mjs /absolute/new-evidence /absolute/new-fixtures
python3 tests/step5j-performance/summarize.py /absolute/new-evidence
node tests/step5g-performance/analyze-trace.mjs /absolute/new-evidence/1000-profiled 1000 /absolute/new-evidence/1000-profiled/analysis.json
```

The seven planned scenarios are three fresh-process 1,000-history natural-GC repeats at 1,200 preparations each; 100-history/800-preparation and 10,000-history/1,200-preparation runs; a separately labeled 1,000-history CPU/allocation profile; and 500-preparation pending-reload stress. They finish the last hand and cash out, so actual preparation counts can exceed targets. Each rotates nominal 2/6/10-player sessions and checks their actual observed decision counts. The full raw timing trace is compressed losslessly; exact executed commands and timestamps are retained. One preparation means one ordinary controller preparation, excluding the separately recorded repeated idempotency call.

Fixtures are extracted and upgraded in separate processes. The measured process retains a disk record index, reads the production checkpoint, then performs three further recoveries, actual policy decisions and authoritative settlements. Initial conversion, fresh verified recovery, ordinary preparation, commit, explicit full history materialization and explicit independent archive audit have separate phase windows. No intentional bot think time is included. Nearest-rank quantiles describe the observations, not a population guarantee. Repeated 1k runs have the same seed and input corpus; their repeated poker contexts are not statistically independent samples. Natural-GC and forced-GC/profiler cohorts are not pooled.

These are the unmodified production `BrowserPersistence`, session controller, policies and engine through the existing **file-backed IndexedDB request reference**. They do not measure native IndexedDB, browser main-thread tasks, rendering, INP or a physical device. The previous canonical-only saved-data fixture is preserved rather than silently converted into a freshly packed archive. Logical serialized store bytes are not actual origin disk usage. Process memory includes reference-storage indexes and diagnostics; unforced samples are neither post-GC retained-heap measurements nor an isolated application memory guarantee. Explicit full archive work remains expensive and is not hidden inside a startup average.

Every completed scenario checks engine chip accounting after every action, durable preparation idempotency, complete cashout, unchanged manual-adjustment totals, exact independent financial replay, and full-replay versus incremental statistics agreement. Read-only full history and audit must not write financial state or duplicate records. The reload-stress cohort additionally checks pending-decision identity and revision/ledger counts across reload, then rejects stale commits. Assertions fail the process; `summarize.py` checks receipts, sample counts, trace hashes, compressed profile artifacts and canonical record totals. These scenario/assertion counts are not automated-test counts or V7 requirement passes.

The initial launcher failed before application measurement because Node24 rejects `.bin` as an executable extension. Its receipt remains in `initial-launch-failure/`. The repaired harness executes `.mjs` from scratch and archives byte-identical `.bin` artifacts. This was a test-launch defect, not a production recovery defect.

The historical 10.072-second observation remains **UNATTRIBUTED**. Its missing original decision trace, exact denominator and phase/GC context cannot be reconstructed by labeling a new subsecond peak as the same event. The existing safeguards and monitoring protocol remain applicable; see the final `STEP5J_PERFORMANCE.md` and raw execution receipts for observed results and remaining release limits.
