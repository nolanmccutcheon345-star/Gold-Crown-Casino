# Step 5L interrupted U12 recovery and fresh resource qualification

This is a test-only resource workload, not a poker-engine or storage redesign.

## Recovery provenance

The Step 5K development checkout was lost, but `/tmp/step5k-longrun-smoke-evidence/profile.mjs.bin.map` survived. Its `sourcesContent` contains the original `tests/step5k-longrun/profile.ts` verbatim. The recovered SHA-256 is `8cfb28066dcc6f656d31f3590447094f0988d778a1f5515dbd9935e680485d77`, exactly the hash recorded in that original smoke execution's source manifest. The recovered original is retained as `.txt` under `recovered/`; this does not claim recovery of Git commit `1805380`.

All 94 production modules imported by that runner compare byte-for-byte to the old candidate source manifest for `3ecea1c2b71c8e8b9963547da676171f91f21716`. `recovered/production-input-agreement.json` records every comparison. Root source recovery/build verification separately establishes whether the whole application matches the hosted build; the profile alone cannot prove UI source or Git commit identity.

The interrupted original `/tmp/step5k-longrun-10000-data` is preserved untouched. Its earlier 1,637-hand log observation is **NOT a 10,000-hand PASS**. A new read-only inventory found 1,754 unique hand-shaped records and two candidate manifests reporting that count; the missing live key-to-file index prevents certifying the exact last committed manifest, and no completion is inferred (see `recovered/interrupted-data-inventory.json`). A new run starts a separate zero-hand account, not a prepopulated fixture and not a resumed partial count.

## Reconstructed launcher and reviewed harness changes

`profile.ts` is the recovered source with pending-decision reload/stale-commit checks explicitly enabled every 1,000 preparations. Those checks were present but disabled by `sustained=true` in the original run. The complete source/bundle hashes and delta description are in each execution's `source.json`. A test-only esbuild hook exposes only the sizes of the two bounded current-policy caches; it changes no policy input, distribution, action, chip movement or persistence result. No production file is modified.

`run.mjs` is a newly authored launcher. It verifies every recorded production-input hash before compiling, refuses existing evidence/storage paths, creates an empty disk-reference index, records the exact execution command and its exit code, and writes ongoing logs. The profile rotates 2-, 6- and 10-player sessions, using the actual production controller, legal actions, deterministic seeded test entropy, bot policies, engine, checkpoints and journal. It uses a $1,000,000 synthetic manual budget, never counts manual funding as poker P&L, checks accounting after every action, persists/idempotently rechecks each bot decision, and closes each session legitimately. Tables use $1/$2 blinds and $200 buy-ins with no rake in this resource workload; separate regression cases cover rake. Sessions rotate nominal 2/6/10 seats, alternating low/high synthetic population settings and normally cashing out after 40 hands. Hero checks when allowed; otherwise the test calls only every fourth hand with call cost at most $40 and folds the remainder. These deliberate test choices are not human behavior calibration.

```sh
node tests/step5l-resource/run.mjs tests/step5l-resource/evidence/full-10000 /tmp/step5l-longrun-10000-data 10000
node --input-type=module -e 'import {build} from "esbuild"; await build({entryPoints:["tests/step5l-resource/verify-archive.ts"],outfile:"/tmp/step5l-resource-verify.mjs",bundle:true,platform:"node",format:"esm"})'
node /tmp/step5l-resource-verify.mjs tests/step5l-resource/evidence/full-10000
```

The smoke run uses the same script with goal 10 and different new paths. It is only a launch/verification smoke check, not U12 completion.

## Required completion evidence

A completed release resource run must have a successful process receipt, `0-report.json` status PASS, initialHands 0, goalHands/completedHands 10,000, closed final session, exact independently verified canonical archive, and successful full-history/statistics/accounting agreement. `progress.json` is explicitly RUNNING and cannot establish PASS. The separate streaming verifier rechecks every canonical segment/hash, every actual hand's BigInt chip events, every unique settlement and all ledger/session balances; it does not import production engine, checkpoint, statistics or integrity implementation.

Resource checkpoints occur at zero, 100 and each 1,000 completed hands plus final cashout. They record logical storage families, real retained store-record counts, sampled natural and post-GC process memory, bounded range-cache sizes, controller interval count and financial reconciliation. Canonical hand/journal evidence remains available. Temporary packed replicas must stay at most 120, checkpoint generations at most two, journal records at most 126, policy caches at most 4/8, one live controller clock and zero after close. Historical storage itself intentionally grows with preserved canonical hands; “bounded storage” does not mean silently deleting old hands.

## Limits

The disk-backed serialized IndexedDB request reference exercises production methods but is **not native IndexedDB, actual browser main-thread timing, INP, device memory, touch input, or browser durability evidence**. Its transactions are a test reference, not crash-atomic disk files. The hidden EventTarget document enables the real controller's interval without nondeterministic active-time writes. This reference does not activate native-IDB lease heartbeat timers. Browser endurance is a separate required lane. The reload helper constructs a new controller/storage port in the same process: module caches and the disk-record index survive. Its timings are warm-process/controller recovery, not process-cold startup or an actual browser reload.

Ordinary actions use natural GC. Explicit resource checkpoints force GC outside measured actions and report both before/after values. Process memory includes test store indexes, growing per-operation window and decision-context arrays, GC records and reference-adapter allocations; it is not a measured pure-application heap. Full-run Node event-loop delay also includes synchronous diagnostic writes, checkpoint independent replay and forced-GC sampling. Instrumentation overhead is included. Trace spans nest and must not be summed as disjoint durations. Original 10.072-second stall remains UNATTRIBUTED even if this run sees no similar event.

## Durable large-evidence handoff

After successful full execution and independent archive verification, `artifacts.py pack` retains each complete compressed trace/archive as ordered ≤8 MiB binary parts with per-part and whole-file SHA-256 and byte lengths. The full compressed originals remain local but are excluded from source commits to avoid duplicate large Git payloads. Every byte is recoverable from the committed parts; this is reversible chunking, not lossy summarization.

```sh
python3 tests/step5l-resource/artifacts.py pack tests/step5l-resource/evidence/full-10000
python3 tests/step5l-resource/artifacts.py verify tests/step5l-resource/evidence/full-10000
# After a clean checkout, reassemble before rerunning stream verifiers/analysis:
python3 tests/step5l-resource/artifacts.py restore tests/step5l-resource/evidence/full-10000
```

The smoke handoff test actually packed, verified, deleted only its copied compressed originals, restored them byte-for-byte and rejected a corrupted part. This does not delete the original synthetic run evidence. Part restoration refuses existing mismatched originals and verifies all source bytes.
