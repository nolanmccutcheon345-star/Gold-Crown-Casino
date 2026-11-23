# Step 5C independent recovery review

Baseline source: `f54cacfb0aa3c861313b691e773a6716379c50a0` (saved Version 8).

Executed `npx vitest run tests/step5c-independent --reporter=verbose` on the baseline: **24 tests, 21 PASS, 3 FAIL**. The three failing checks represent two distinct defects, not three different defects. Exact output: [baseline.log](evidence/baseline.log). TypeScript and scoped ESLint passed after test-authoring corrections. No browser or physical-device verification is claimed by this lane.

## Findings requiring repair

1. **Incomplete zero-net settlement is not rejected.** A real-engine checked-down shared-board royal flush leaves Hero's final stack equal to the starting stack. Removing both the canonical completed-hand record and the `hand-net` financial event leaves scalar wallet/table reconciliation unchanged. Both full and incremental audits currently accept this incomplete snapshot. A controller may then advance to the next hand without preserving the missing record. Normal atomic commits should prevent this state, but corruption/recovery checks must reject it before gameplay. The fixture does not bypass the engine's betting or settlement calculations: only its test-only deck is controlled, and the incomplete persistence boundary is constructed deliberately. This is a recovery-integrity defect, not an observed production double payout.
2. **Symbol-keyed accessors evade recursive accessor rejection.** `Object.values(Object.getOwnPropertyDescriptors(value))` omits symbol-keyed descriptors. A symbol getter on a supplied snapshot is accepted by `auditSnapshot`, despite the declared accessor rejection. This has limited ordinary persistence reachability because JSON and structured-clone storage omit symbol properties; no monetary exploit is demonstrated. The optimized freezer should reject all own accessors without executing them, including symbols and nonenumerable properties.

## Independent passing evidence

- A test-only oracle imports no production engine, accounting, integrity, statistics, or hash implementation. It separately replays wallet/table transfers and manual adjustments, reconstructs every completed hand's public debits/refunds/awards/rake, and compares reconstructed balances with hand results, settlement identities, and session totals.
- Populated preflop, flop, turn and river saves reconstruct byte-for-byte after segment storage and match that independent oracle.
- Every completed hand position and first/middle/last financial records are probed after resealing the outer storage chain using an independent Node SHA-256 implementation. Recovery still rejects damaged inner canonical hashes. Therefore a correct container checksum alone does not confer trusted-history status.
- Missing, duplicated and reordered inner financial records fail even with valid fresh outer transport checksums.
- A frozen copied snapshot with a corrupt wallet does not acquire private verified-snapshot provenance and the controller commits nothing.
- Own, root financial-ledger, nonenumerable, array-index and extra array-property getters fail without invocation. This matters when inserting cooperative yields before freezing: reading root arrays or iterating them before checking descriptors would invoke their getters before rejection.
- A precommit interruption and a lost acknowledgement after payout both restore one settlement, retain the hand, exclude a later bankroll edit from poker profit, and cash out once. A stale controller's retry cannot overwrite the recovered newer state.

## Candidate implementation review and executed rerun

The recovery owner's candidate source was copied into this isolated review worktree for verification and then removed; only tests and evidence are committed by this lane. Exact reviewed source hashes, command, environment and results are recorded in [review-source.json](evidence/review-source.json). This is explicitly a snapshot of the owner's uncommitted candidate, not a false attribution to the Version 8 commit.

Executed **78 tests in five files: 78 PASS, 0 FAIL, 0 skipped**, including all 24 new independent checks and the existing incremental, storage, financial-integrity and quota/lost-ack recovery suites. Output: [candidate-review.log](evidence/candidate-review.log). TypeScript and scoped ESLint passed. All three baseline failures passed after the implementation owner's repairs.

The implementation preserves the relevant trust boundaries:

- Controller startup/retry/takeover reuse only an exact object already present in the private `WeakMap` after a full audit. The recursive freeze prevents subsequent changes. Copied objects, caller-supplied hashes and `Object.isFrozen` do not confer this capability.
- Segment loading still checks the manifest hash, every segment ordinal/link/hash, record count and terminal checkpoint. The full canonical ledger and hand chains still run independently after transport decoding. Chunked reads do not skip historical records.
- Full and incremental active-state verification now require a completed active hand's canonical record, settlement event and matching final public frame. The existing exact engine/ledger top-up exception remains intact.
- The optimized recursive freeze includes symbol and nonenumerable descriptors. During review, a draft cooperative loop that read root arrays and array elements before descriptor checks was identified and repaired before this passing run; getter tests verify no invocation.
- Native SHA-256 is an alternative implementation of the same existing canonical bytes, with the existing JavaScript SHA-256 retained for managed HTTP environments. The production canonical serialization function was not changed in the reviewed diff. The existing independent Node SHA comparison passed; the implementation owner's separate native/fallback tests are not counted in this lane's 78 tests.
- Explicit `auditSnapshot` still performs a full audit, even for a previously branded object. Cooperative scheduling leaves gameplay gated until complete verification; it is not a cached summary substituted for verification.

No additional critical defect was found in this reviewed change. The root integration run must repeat these tests on the final combined commit, including the separately owned migration/rollback changes. This review does not establish physical-device usability, cold-load performance targets, human calibration, hosted CI, or R1 release readiness. Automated test counts are not original V7 acceptance-ID counts.

## Final cooperative recovery/statistics follow-up

Reviewed and executed a combined snapshot based on `3307a9f` with `2eac353` (ordinary-task recovery yields), `86c55db` (cooperative statistics preparation) and `e68e9d5` (immutable transport boundary). The precise executed source and tests are fingerprinted in [final-cooperative-source.json](evidence/final-cooperative-source.json).

Two additional probes demonstrated a pre-existing generic-reader alias gap: a callback could modify manifest `initialBankroll` after the manifest hash was checked, or retain and modify a closed-session timestamp after that segment's hash was checked. Both changes could be accepted. Native IndexedDB returns private cloned values, so this is not evidence of an ordinary guest-data exploit. The failed before log is preserved at [async-boundary-before.log](evidence/async-boundary-before.log). The repair freezes the manifest and each descriptor-read transport entry before awaited hashing, reusing the existing private freeze provenance later. It does not substitute summaries for records or remove checks.

Final independent execution: **122/122 tests passed in 11 files, 0 failed, 0 skipped**, including all 26 independent checks, existing financial/recovery regressions, cooperative scheduling, statistics cancellation/tail tests, and populated migration/rollback tests. TypeScript and scoped ESLint also passed. Full output: [final-cooperative-review.log](evidence/final-cooperative-review.log).

The async statistics factory accepts only privately verified immutable history, builds its aggregate privately, and returns nothing until the whole requested history succeeds. The UI coordinator rejects superseded/cancelled work by generation, withholds partial totals, incorporates appended tails before returning current results, and reads session clocks afresh. It never writes bankroll, table chips, canonical history or engine state. Ordinary-task yields leave recovery untrusted and gameplay unavailable until the complete audit succeeds. No new asynchronous financial authority or stale-result defect was found in this combined review.

The root's later identical-reference prefix shortcut was separately read-only reviewed as equivalent to the old identity-prefix comparison for that case; it was not part of this 122-test execution snapshot. The final main-branch regression and native-browser responsiveness evidence remain separate requirements.

## Low-overhead task-backend follow-up

Independently reviewed scheduler refinement `640f34b`: a new background `postTask` is preferred, with a shared `MessageChannel` and ordinary timer fallbacks. The existing eight-millisecond work budget and verification gating remain unchanged. No skipped validation, artificial think-time masking, or early trusted-state publication was introduced.

Added two independent queue probes: a second message-post failure after three waiters have queued, and creation of a replacement queue while older waiters drain. Every waiter resumed exactly once; both old and replacement ports closed. Executed **64/64 tests in eight files**, including these probes, all prior independent recovery checks, backend failure cases, and asynchronous statistics tests. TypeScript and scoped ESLint passed. Evidence: [scheduler-final-review.log](evidence/scheduler-final-review.log) and [scheduler-final-source.json](evidence/scheduler-final-source.json). These automated checks support queue correctness; native-browser latency measurements remain separate parent evidence.
