# Browser full-audit interruption investigation

The two 10,000-hand native-browser attempts stopped without an audit receipt. Their cause remains **unattributed**. A CDP timeout is not a CPU profile or proof of an out-of-memory event. Preserve those attempts as NOT_COMPLETED.

Source inspection found a material workload difference: `step5f-recovery-frame.ts` first loads full history into `controller.data`, then independently reconstructs the archive in `auditCanonicalArchive`. Production history review retains references to that first graph (`historySource`, `reviewCache`, and the statistics coordinator); review projection does not deep-clone frames, and only 25 hand records are rendered. The second reconstruction is a real production-accessible cost (load history, then cashier audit), not solely test inflation. The earlier Node matrix reloaded compact state between history and audit and therefore did not qualify this combined retention case.

The focused `audit-retention.ts` experiment used the actual 1,000-hand fixture and unchanged production controller/storage. It forced GC at diagnostic boundaries and in the timing observer while the independent audit return graph was still live. Both paths passed full audit, retained exact wallet/history, and left the controller snapshot unchanged:

| Controller holds during audit | Audit-return live heap |
|---|---:|
| Compact 120-hand resident tail | 73,377,864 bytes |
| Full 1,000-hand archive | 127,256,080 bytes |

The additional 53,878,216 bytes demonstrate retained-graph pressure for this fixture. They do not prove the browser timeout cause or predict an exact 10k/browser heap. This is a diagnostic Node request reference, not browser execution or a latency benchmark. Actual source hashes, receipt and every memory sample are in `1000-report.json`; the executed bundle is retained unchanged. This source precedes the separate checkpoint metadata retention fix; do not relabel its measurements as post-fix performance.

Additional inspected paths:

- `storageSize()` cursor serialization, final evidence JSON/Blob construction and parent result structured-cloning occur after the audit receipt, so cannot explain a stall already observed inside audit.
- The old unbounded timing arrays add scalar diagnostic overhead. They do not contain hand graphs. The passing 1k browser case retained 8,252 stage rows and about274 heap samples.
- Cooperative scheduling yields between fully verified records after about8ms. It cannot preempt one large record or a GC pause.
- The private full-snapshot checkpoint map previously retained full hand objects when reused by an in-process compact state. That separate production fix/proof belongs to `step5f-memory`, not this experiment.

The QA-only browser harness now offers `workload=compact-audit`, `history-audit`, `history-only`, or `recovery-only`; the combined workflow remains the default. `pause=1` stops before expensive phases. Scalar receipts are rendered in `#qa-checkpoint`, copied to the parent panel, and saved under the isolated namespace's sessionStorage `:progress` key before work starts. These receipts remain IN_PROGRESS and cannot substitute for final audit results. The timing ring retains6,000 raw rows while phase/name counts, sums and maxima include every observation. Heap/task buffers are bounded; dropped task rows null out window maxima rather than falsely reporting a complete maximum. The production controller audit method now enforces session/busy guards; pending-hand audits are BLOCKED, not bypassed.

Safe browser sequence (root agent executes actual browser):

1. Choose 10,000 hands, Candidate, Closed session, Normal recovery, **Audit from compact state**, **Pause before expensive phases**. Run using a new isolated run ID.
2. At `Before independent canonical archive audit`, save the scalar receipt. Confirm 120 resident hands, exact wallet/history count and current source provenance. Then click **Continue**.
3. If audit returns, save its verified receipt before continuing the separate storage count. A successful compact audit does not pass the omitted full-history sequence.
4. Separately run **History then audit**, pausing before history and audit. Save each receipt and compare actual retained heap/current source. Keep this case unexecuted or interrupted unless its final audit receipt exists.
5. If either stalls, preserve its last scalar receipt, elapsed observation, exact source, browser information and tool failures. Do not silently convert it to PASS or erase the failed attempt.

Executed here: typecheck PASS; scoped lint PASS; three focused diagnostic-helper tests PASS; focused1k retained-graph experiment PASS. New browser modes themselves remain NOT_EXECUTED until actual browser use.
