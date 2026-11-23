Step5E integrity verification

Before gameplay, the candidate verifies the current canonical manifest, the
checkpoint and ordered journal, every canonical financial-ledger and closed-session
record, archive-key continuity, the active engine state, and the exact current
wallet/table reconciliation. It validates the 120 resident hand bodies against a
global financial hand index. Older complete hand bodies remain canonical and are
loaded or audited separately; startup does not claim those bodies were audited.
Local hashes detect accidental corruption, not an actor who replaces and reseals
the entire device save.

The independent lane executed **104 tests, all passing**, before the final combined
release regression. These are executable test cases, not 104 original V7 acceptance
requirements. Evidence: `evidence/vitest.json` and `evidence/verification.json`.

| Executed test file | Passed | Exact verification |
|---|---:|---|
| `financial-reference.test.ts` | 41 | Four betting-street recovery states; raw event/hash/index corruption; independently resealed inconsistencies; exact session accounting; manual edits/resets excluded from poker result; full action/refund/award/rake replay |
| `large-reference.test.ts` | 1 | Independent streamed canonical replay and financial agreement at 0, 100, 500, 1,000, 5,000 and 10,000 hands |
| `public-memory-checkpoint.test.ts` | 34 | Per-seat last-120 matching hands across 360 records, including sparse seat participation; contiguous/overlapping updates; session reset; exact index membership; forbidden fields/accessors rejected |
| `compact-boundary.test.ts` | 28 | Actual production checkpoint/journal restoration after 126–129 engine-settled hands with 120 resident bodies; settlement/index/statistics/memory corruption; private-capability rejection; current-head stale checkpoint rejection; interrupted all-in settlement |

The compact-boundary tests found a genuine semantic gap: a statistics checkpoint's
first hand ID could disagree with the financial index while count, final ID and
aggregate totals matched. Fix `a2b9815` binds **every** statistics hand ID to the
financial-index prefix. The retained reproducer and all 28 expanded compact tests
passed after repair.

The all-in interruption cases independently reconciled a **14,700 main pot,
10,000 side pot, 300 rake and 10,000 uncalled refund**, yielding Hero's exact
**9,700** net. Both interruption-before-commit and committed-write/lost-acknowledgement
recovery retained one settlement and one cashout. Imported study hands and manual
bankroll changes never entered poker profit.

Final-runtime review of `899dd53` found no additional money-loss or duplicate-payout
path in the inspected recovery contract. The global hand offset is applied during
canonical appends; full-history adoption is fenced by exact controller state,
revision, ledger and active-game comparisons. Cross-tab writes retain the lease
and current-manifest compare-and-swap check. Full-audit receipts become current
only when the generation and final manifest still match. These are code-review
findings, not additional executed browser claims.

Checkpoint rotation retains the prior acceleration generation and removes only
older acceleration keys in the same transaction as promotion. Canonical events
are retained. A corrupt checkpoint under an otherwise current matching head
**fails closed**; do not describe this as automatic fallback to an older checkpoint.
Retaining an old backup does not authorize overwriting newer events. Rollback must
use the tested compatible V7-R/canonical recovery procedure, with its separately
recorded evidence; unchanged V7 redeployment is not a valid data rollback.

Limits: the large existing fixture contains eight table sizes, 26 top-ups and 101
cashouts, but only 100/200 blinds, `synthetic-cash-1.5.0` and zero rake. Smaller
legacy/current fixtures separately cover other stakes, policies and rake; the
10,000-hand fixture itself is **not** mixed-stake/policy/rake evidence. These Node
tests do not establish native IndexedDB durability, physical-device compatibility,
external human calibration, hosted CI or complete R1 acceptance coverage. Consult
the separately executed browser/release evidence and original-ID dashboard.

Final-regression timer diagnosis

The unchanged `timer-lifecycle.test.ts` 50-session/reload test reproduced its
20,000 ms timeout in isolation. A retained CPU profile attributed 14.85 seconds
(68.23% of 21.77 seconds sampled) to `structuredClone`; 14.25 seconds came from the
test reference cloning the entire database at every transaction. Real IndexedDB
reads clone requested records. The test-only reference now snapshots the Map
without cloning unrelated bodies; each `get` and `put` retains its structured-clone
boundary and transaction requests remain serialized. No production code, 50-session
requirement, timer/listener assertion or test timeout was relaxed. The original
test passed in **4.347 seconds**, and four new isolation/abort/serialization checks
passed. The related reference suite passed 67 of 70 cases; the three failures were
the already reproduced quota/readonly export regressions separately assigned to
the integration owner, not new failures introduced by this reference change.
Evidence: `evidence/timer-lifecycle-before.json`,
`evidence/timer-lifecycle-after.json` and `evidence/timer-cpu-before/summary.json`.

Final candidate review and browser follow-through

The final local release run at `37aa22575baaf582f845a70e1862ba6e6409aa48`
passed **1,911/1,911 tests in 195 files, with zero failed or skipped cases**.
The independent read-only receipt review checked the raw Vitest result against the
release manifest, all eight command exit codes, equal start/end commits, empty
changed-input lists, and current production/build SHA-256 hashes. All agreed.
The independent lane contributes **108** of those tests (the original 104 plus
four reference-transaction checks); it is not additional acceptance coverage.
The paired-reference run passed one repeated executable test on a different
scenario; do not count that as a new original requirement. The receipt explicitly
states local execution only, with no hosted CI, device or deployment claim.
See `evidence/final-release-receipt-review.json` and
`TEST_EVIDENCE/step5e/release-draftfix/manifest.json`.

The failed original ten-seat browser stress run remains a failure: 100 loop
reports represented only 99 unique hands and 99 settlements. Financial counts
agreed. The independently retained old-runtime probe demonstrated a real hidden
busy-clock window in which an enabled Next Hand click could be silently dropped.
The original browser receipt did not log busy state at the click, so that exact
failure's cause is consistent with, but not proven by, the separate reproducer.

Review of the busy-state repair identified another concrete UI defect: the ready
render restored focus but erased unsubmitted Cashier text. The actual held-clock
browser test reproduced this against the pre-fix source-hashed bundle: five
checks passed, then the sixth failed. Bankroll draft `12345.67`, note
`Unsaved clock-boundary note`, and top-up `75.25` reverted to `9800`,
`Manual bankroll adjustment`, and `1`. After the guarded draft-carry fix, the same
browser page passed **13/13 checks**. The wallet, ledger and settled poker state
remained unchanged; Cashier, Host Setup, player-note and betting drafts survived,
and intentional navigation or a changed poker decision invalidated stale focus.
Evidence: `TEST_EVIDENCE/step5e/browser-clockfix/cashier-clock-before-FAIL.json`
and `cashier-clock-after-PASS.json`. These held acknowledgements use the actual
runtime with a test memory port; native durability has separate evidence.

Additional actual source-based browser checks were executed in independent tabs:

| Browser workflow | Observed result |
|---|---|
| Privacy, 100 rerenders, pending-action identity, drafts, redacted export/study import | Three authored commands PASS; one unchanged pending action committed once |
| Secure entropy unavailable, then restored | PASS; no hand or financial change before secure retry |
| Native IndexedDB quota, lost acknowledgement, stale ownership and recovery | Seven commands PASS; aborted writes left committed bytes intact and recovery settled once |
| Actual second browser tab, concurrent poker action | PASS; old writer fenced with zero action delta, new writer committed one action and one settlement; recovered financial digests equal |
| Matched Fast and Relaxed play | Three complete hands per pace, 12 bot turns each; identical canonical-outcome digest, random stream, net −398 cents and BB/100; actual elapsed time changed the actual hourly rate |
| Configuration history at 320 and 390 CSS pixels | Original run: 320 FAIL, 390 PASS. Strengthened exact occupied-seat mapping plus diagnostics: both PASS |

The original configuration failure lacked the failed rows and the harness then
discarded its iframe. Its root cause remains unproven. The original assertion
assumed both configured opponents remained occupied after a natural hand. The
replacement checks exact public selection/count mappings against the actual
occupied IDs while retaining hidden-profile DOM checks. Both retest layouts
retained all three seats, so that retest does not itself demonstrate that a bust
caused the original failure. Keep the first FAIL receipt alongside the retest.

Raw results and actual popup identity are in
`TEST_EVIDENCE/step5e/browser-clockfix/`; the independent observation and source
hash inventory is `evidence/browser-independent-37aa225.json`. These are source
QA workflows, separate from the parent's exact compiled application runs.
Browser checks shared the host with recovery profiling and the release runner;
their elapsed timings are not isolated performance benchmarks. They do not
establish physical iPhone Safari export, screen-reader-user testing, expert poker
review, human calibration, hosted CI, or full R1 signoff.
