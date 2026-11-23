# Step5F native browser verification harness

Preparation only: browser checks are NOT_EXECUTED until the visible harness is run and its source-bound result downloaded. Typecheck, scoped lint and Node syntax check of the builder passed when authored. No CLI browser automation was used.

From the integrator checkout:

```sh
node tests/step5f-browser/build-runtimes.mjs candidate
```

An explicit third argument selects the actual source checkout when invoking a builder from an isolated worktree:

```sh
node /path/to/tests/step5f-browser/build-runtimes.mjs candidate /workspace/sites/ai-texas-hold-em
```

The resulting files are under `tests/browser/step5f-fixtures`, with source commit, current production dirty status, per-source SHA-256, builder SHA-256 and asset hashes. Candidate module bytes are imported only after verification. These are actual production module exports for native integration testing, not the compiled dist application entry point. Separate complete compiled-application workflow evidence is still required. Existing Step5E runtimes, results, and V7-R rollback fixtures are unchanged. The optional baseline is saved Version11 `c2de7f98518c8400ccdf58339abb1ba27f1f3f78`.

Open `/tests/browser/step5f-native.html` in the managed browser, click **Run native transaction checks**, and download the resulting `step5f-native.json`. Eight checks run sequentially against newly named synthetic IndexedDB databases. The runtime `indexedDB.open` guard rejects every database except the two exact names created by this run.

Checks retain existing populated reconciliation, normal reload, actual transaction abort and injected quota rejection, independent-connection takeover, exact-once payout/cashout. New checks:

- A separate populated synthetic account is closed, then only `current` is deleted in one committed native transaction. Recovery must block with a clear missing-manifest message and no new wallet. All surviving non-lease records must retain the same hash; `current` must remain absent. This does not claim whole-origin deletion recovery.
- The main synthetic account has resident completed history. A second native connection explicitly takes ownership and deletes that test account through the production controller. The stale first controller's bounded export must refuse to return erased data, leave its retained snapshot unchanged, and never rewrite durable storage. Previously downloaded files cannot be revoked.

Every opened connection is closed and both exact synthetic names are deleted during cleanup. A cleanup failure is reported, not concealed. Tests do not use the production guest database and do not test a physical disk power failure, actual disk exhaustion, separate-tab scheduling, physical iPhone export, or V7-R rollback. Those require their own evidence.
