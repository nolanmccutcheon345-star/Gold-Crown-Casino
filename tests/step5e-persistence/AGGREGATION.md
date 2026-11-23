# Read-only browser recovery aggregation

Run after collecting the final native-browser captures:

```sh
node tests/step5e-persistence/check-browser-aggregation.mjs
node tests/step5e-persistence/aggregate-browser-recovery.mjs \
  TEST_EVIDENCE/step5e/browser \
  TEST_EVIDENCE/step5e/recovery-summary \
  ACTUAL_FINAL_RUNTIME_SOURCE_COMMIT
```

The third positional argument is the **captured runtime source commit**, not the current documentation/evidence commit. Obtain it from `runtimeSource.sourceCommit` in the final capture. A prefix is accepted. Omitting it preserves every candidate source and flags duplicate matrix cells for review; it never silently chooses the fastest/latest run. Older/preliminary captures remain separately listed and SHA256-pinned. Normal startup, first conversion and pending-action scenarios stay separate. Missing measurements remain NOT_EXECUTED. One observation does not become a latency percentile.

The script reads raw captures without modifying them and writes separate `.json` and `.md` reports. It recomputes task windows from raw timestamps. In three older baseline captures (1,000/5,000/10,000 hands), a history-interaction task began0.3–0.4ms before the history marker. The original start-based classification reported that task as startup work. Corrected reporting retains its whole993/4,239/9,067ms duration in the history-overlap window while excluding it from tasks completed before history. Measured UI render stages inside each task provide supporting context. Original reported values remain in the output alongside corrections.

The report separates safe-wallet readiness from later explicit full audit, and distinguishes actual statistics readiness from legacy paint/poll waiting. Heap observations are coarse Chromium process data, serialized storage bytes are not physical disk allocation, nested stage durations are not additive, and Long Tasks are not INP. Failed captures remain failed. Different fixture hashes or browser conditions prevent a matched comparison.

Ten executable aggregation checks cover boundary-crossing tasks, unavailable observations, failed captures, source isolation, missing measurements, duplicate samples and raw-byte preservation. Their execution log is `aggregation-checks.log`. This validates the aggregation code, not the application's release gates.
