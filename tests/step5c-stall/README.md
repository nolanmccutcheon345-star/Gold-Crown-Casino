# Step 5C rare-stall reproduction

This harness exercises the actual controller, policy version 1.6, engine, immutable transition verifier and segmented persistence serializer. It does not instantiate a browser or impersonate browser responsiveness. The serialized-storage reference keeps strings and restored objects in RAM; its memory demand differs from IndexedDB.

Build and run an isolated reference workload (run from the repository root):

```
node tests/step5c-stall/build.mjs
mkdir -p tests/step5c-stall/evidence/baseline
STALL_RUN=baseline STALL_DECISIONS=5000 node --expose-gc --max-old-space-size=6144 --cpu-prof --cpu-prof-dir=tests/step5c-stall/evidence/baseline --cpu-prof-name=run.cpuprofile /tmp/step5c-stall-run.mjs > tests/step5c-stall/evidence/baseline/run.log 2>&1
node tests/step5c-stall/summarize-cpu.mjs tests/step5c-stall/evidence/baseline
```

`STALL_ARCHIVE=none` starts with zero saved hands. The default archive is the independently verified 10,000-hand Step 5B corpus. `STALL_PRESSURE_MB` optionally retains additional synthetic JavaScript numeric-array allocations, capped at 1,024 MB; this is explicitly forced allocation pressure, not a claim that normal gameplay allocates it. `STALL_RUN` selects a separate evidence directory. Never point these fixtures at production browser storage.

The synthetic entropy seed is `0x51c57a11`. Seating rotates through 2, 6 and 10 per 25 completed hands. Opponents can bust normally. Every measured preparation is followed by a duplicate prepare identity check and actual engine commit. An interrupted durable pending decision is restored at the end; retry preserves its exact identity and action, and an obsolete commit cannot apply twice. Full financial replay, unique settlements and full-replay/incremental statistics agreement are asserted after the run.

A read-only build-time hook captures only the bot's permitted observation and its own profile by reference. Slow-decision evidence is diagnostic private synthetic data, not a normal public history export. Production source is not modified. CPU sampling, stage intervals, GC entries and a 10 ms event-loop monitor run together. The trace retains each preparation's execution stages. CPU samples are aligned with process.hrtime and performance.now; boundary samples can straddle stages. Event-loop measurements describe this Node workload, not INP, React hydration, physical mobile performance or an actual browser main thread.

The original 9,791 ms observation had no simultaneous CPU/GC/phase capture. A new reproduction cannot retrospectively prove its cause. Maximum latency and the number of observations above 250 ms must be reported even when percentile targets pass. No artificial think-time, action timeout, omitted integrity check or timing winsorization is used.

The initial matched baseline/recovery-optimized runs use a deterministic crypto wrapper with `getRandomValues` only. Thus both exercise the supported JavaScript SHA fallback; native-WebCrypto measurements are supplied by the independent recovery matrix. Do not relabel these as native crypto performance.

After reproducing the three runs, `node tests/step5c-stall/compare.mjs` checks identical financial endpoints, commit and hand counts, street/seat sample populations, and successful pending-decision recovery. Detailed final source and instrumented-bundle hashes are in `evidence/public-freeze/provenance.json`. The report distinguishes the resolved public-freeze path from remaining GC and cold-recovery limits.
