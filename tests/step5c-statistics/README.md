# Cooperative cold statistics preparation

Measured trigger: the managed Chromium 5,000-hand native recovery run recorded candidate `statisticsRebuildMs=2320.1` after storage recovery (baseline2837ms). The former first-render call `session() -> cashStats() -> CashStatsProjection.derive()` performed that complete per-hand loop synchronously. This change addresses the main-thread scheduling of that measured work, not its mathematical formulas or financial validation.

`CashStatsProjection.prewarm()` accepts only the storage audit's private verified-history capability. It creates a fresh disposable projection, uses the same per-hand sequence/provenance validation and `add()` method as synchronous derivation, and cooperates between fully processed records through the existing recovery scheduler. No projection is returned before the complete history succeeds. Cancellation rejects the unfinished projection. No persisted summary, schema field, policy change, bankroll mutation or shortcut around an integrity check is introduced.

`AsyncCashStats` coordinates UI readiness. The established incremental derivation remains the normal append path; larger restored/replaced histories prepare asynchronously. Partial historical totals are represented by an em dash and explicit “Calculating verified statistics” status, never by a fabricated zero. Verified bankroll and current table chips remain visible and all engine/controller legality and persistence locks remain in force. Appended canonical tails are included before a result is returned. Replaced history and explicit deletion cancel stale preparation. A preparation failure hides totals with a visible retry message. The coordinator never consumes imported study history.

The first32 records retain the existing synchronous path; ordinary single-hand appends also remain incremental. Large cold projection work is still proportional to saved hands. This is a responsiveness improvement; no reduced total wall time, physical-device result or complete R1 performance gate is claimed without the subsequent browser measurement.

Executed in this lane:

- `npx vitest run tests/step5c-statistics tests/step5b-statistics tests/step5c-accessibility tests/ui --reporter=json --outputFile=tests/step5c-statistics/results.json`: **235/235PASS**, zero failures or skips. Includes13 new tests.
- `npm run typecheck`: PASS.
- `npx eslint src/stats/projection.ts src/ui/async-cash-stats.ts src/ui/app.ts tests/step5c-statistics`: PASS.

Independent read-only integrity review found no integrity defect in audited-source requirements, atomic publication, stale/erased preparation cancellation, appended-tail accounting or controller-owned balances. The reviewer is executing a separate regression after integration. Browser recovery/production-UI responsiveness must be measured by the root integrator; this lane did not execute browser tools.
