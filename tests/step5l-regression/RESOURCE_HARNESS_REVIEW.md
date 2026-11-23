# Independent read-only resource-harness review

Reviewed the fresh resource runner, launcher, separate archive verifier and final report verifier, including their independent financial oracle and disk request adapter. The reviewed files and compiled bundle are bound by SHA-256 in `resource-harness-review.json`.

No blocking count/accounting-proof defect was found. The launcher starts an empty account, the loop counts actual authoritative settlements, and completion requires exactly the target hand count with the final session cashed out. Production integrity checks remain enabled. Every bot preparation is checked for idempotence, and every thousandth preparation receives pending recovery and stale-commit rejection checks. The separately executed archive verifier independently hashes and replays all canonical financial events and hand chip movements using BigInt.

All **99** recorded input hashes match the files inspected, including **94** production files matching the original recorded candidate. The compiled bundle hash matches its receipt. Its one production-source addition is exactly the recorded read-only policy-cache size getter. This confirms bytes, not recovery of the unavailable original Git object.

The run was still in progress during this review. **This review is not a 10,000-hand PASS or an acceptance-gate qualification.** Final successful execution, full canonical archive verification and final metrics remain required.

Interpret the eventual results carefully:

- Controller reloads retain the Node process, module caches and disk key index; they are not cold browser startup measurements.
- Memory includes growing diagnostic window, context and GC arrays. Resource checkpoints deliberately collect garbage; ordinary decision timing remains separately recorded.
- Node event-loop timing includes instrumentation, test audits, forced GC, synchronous disk operations and shared-host work. It is not browser INP.
- Storage totals describe logical JSON payloads, not browser-origin allocation. Canonical history remains unbounded by design; only redundant caches, replicas and journal/checkpoint generations have fixed bounds.
- The adapter does not reproduce native IndexedDB durability, cross-tab behavior or its heartbeat. Its timer check covers the controller clock.
- This run uses no rake and nominal 2/6/10-seat sessions. Independent event arithmetic is not an independent poker hand evaluator or complete betting-legality oracle.
- Production full-history statistics are compared with the production incremental projection. The financial ledger and hand-chip replay have a separately authored oracle.
- CPU/allocation sampling is disabled for this full run; phase and GC traces remain available. The historical 10.072-second event remains unattributed.

No running harness, application source, test data or deployment was changed during this review.
