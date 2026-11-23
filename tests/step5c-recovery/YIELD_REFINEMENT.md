# Ordinary-task yield refinement

Executed native Chromium155 HTTP scheduling comparison (`evidence/yield-diagnostic-browser.json`):

|Backend|500 empty tasks p50 / p95 ms|250 chunks × 8ms work, total ms|Maximum16ms heartbeat gap|
|---|---:|---:|---:|
|Nested timer|4.1 /4.3|3039.7|24.2ms|
|New background postTask|0 /0.1|2021.6|21.3ms|
|MessageChannel|0 /0.1|2026.2|32.5ms|

All three produced zero50ms long tasks in this bounded synthetic diagnostic. Scheduler.postTask, Scheduler.yield and MessageChannel were available in this actual insecure HTTP environment. One actual input probe was handled with0.4ms event age during the **timer** phase; there was no recorded postTask/input probe, so this result must not be relabeled as such. These are task-scheduling measurements, not full poker recovery results.

The prior normal-timer recovery kept the UI responsive but paid a measured roughly4ms delay at every yield. The shared recovery scheduler now prefers **new background-priority tasks**, preserving the8ms work budget and ordinary timer/input opportunities without using boosted `scheduler.yield` continuations. Statistics prewarming already calls the same scheduler; no formulas, record traversal, validation or publication rules changed.

If postTask throws or rejects, a shared MessageChannel is used. It has at most one channel and one posted message, handles waiting continuations in order, and closes both ports after its final idle message. If channel construction/posting fails, ordinary timers remain the fallback. No timeout grants trust, drops verification or skips work. Node reference runs remain unscheduled. Actual Safari capability and physical-device performance are unverified.

Eight new backend tests cover preference, pending-task gating, synchronous rejection, asynchronous rejection, concurrent-channel reuse/idle closure, construction failure, posting failure, the8ms budget and Node behavior. Combined targeted recovery/statistics/integrity tests, typecheck and scoped lint passed; exact test totals are in `evidence/task-backends-vitest.json`. The parent must rerun actual large-history browser recovery before claiming this refinement improves end-to-end recovery.
