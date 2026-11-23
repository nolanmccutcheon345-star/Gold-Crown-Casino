# Step 5D — tested candidate; NOT READY FOR R1

Version 7 remains the public release at https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/. All work continued in `/workspace/sites/ai-texas-hold-em`, project `appgprj_6ae62e96ac688191bffc3c629e66a5b0`, from saved V9 commit `104b9d64b60276866a25f8bf65827efa65e1df2a`. No other Site or Poker MaxEV was accessed or modified. A historical audit proving every earlier write is not available; that separate acceptance obligation remains open.

The complete repaired release execution and compiled application use **`fed76a93d45a387e87e1299bc78f8ece454e9775`**. Subsequent source commits add QA, independent reviews, evidence and acceptance metadata. The saved candidate's final source SHA is reported by the native Sites save receipt and final handoff. Every compiled browser run is independently bound to its actual QA revision and these unchanged production bytes; no later QA source is retroactively attributed to the earlier build.

## Implemented and repaired

- `src/storage/packed-hand.ts`: bounded, lossless shared-node JSON representation of immutable canonical hands. It rejects invalid references, forbidden keys and oversized expansions. Private construction provenance cannot be obtained by merely freezing an untrusted object.
- `src/storage/integrity.ts`, `segments.ts`, `verified.ts`, `src/session/hand-provenance.ts`: reuse exact immutable canonical bytes within a verification operation. Both original hand and segment hashes still execute freshly; sequence, predecessor, schema, semantic and financial checks remain mandatory. No persisted summary becomes trusted merely because it contains its own checksum.
- `src/storage/browser.ts`: optional packed replicas, transactional installation, lease/revision fencing, preserved original archives and verified fallback. New saves initialize the optional representation atomically. Optional packing retains its own pre-packed snapshot and no longer replaces the normal `previous` recovery snapshot.
- `src/session/controller.ts`, `types.ts`, `src/ui/app.ts`: distinguish verified current state from the separately audited retained original archive. Explicit archive audit is serialized, generation-fenced and available only after closing the table. Stale results cannot certify a newer state. Audit failure preserves records and is shown honestly.
- `src/ui/app.ts`: custom betting editor, drafts and focus survive clock/persistence rerenders only while the authoritative decision token is unchanged. New decisions invalidate old drafts. The actual UI regression failed before this repair and passed afterward.
- Hosted-workflow configuration, reproducible source/build receipts, strict evidence qualification, independent adversarial fixtures and compiled-browser workflows were added. Authored hosted CI is not an executed hosted run.

The authoritative poker engine, card ownership, settlement algorithms and bot policies were retained. No bot was given additional hidden information, forced calling percentages or artificial Hero advantages.

## Recovery performance and attribution

The dominant old cost was repeated traversal/freezing, canonical serialization and hashing of full hand frames—not bankroll arithmetic. Fresh 10,000-hand browser stage observations include transport freezing **6,789→85 ms**, inner hand-chain processing **21,991→7 ms** after paired fresh verification, segment/paired hashing **19,977→19,071 ms**, unpacking **3,765 ms**, financial semantics **12.5→9.7 ms**, and secondary statistics **6,337→912 ms**. Stage timers nest; they are not an additive CPU budget.

The selected complete history is still verified and materialized before play. This is a safer, faster representation, **not** constant-time checkpoint recovery or lazy historical loading. The approximately five-second 10,000-hand target is unmet.

Matched prepared-storage browser observations (Chrome 155/Linux, isolated native IndexedDB, HTTP preview/JavaScript SHA fallback; **one observation per cell**, seconds):

| Saved hands | V9 verified-ready | Candidate verified-ready | V9/candidate max startup Long Task |
|---:|---:|---:|---:|
| 0 | 0.040 | 0.037 | 0 / 0 ms |
| 100 | 0.161 | 0.110 | 0 / 0 ms |
| 500 | 2.202 | 1.257 | 0 / 0 ms |
| 1,000 | 4.416 | 2.725 | 0 / 0 ms |
| 5,000 | 24.974 | 13.064 | 228 / 52 ms |
| 10,000 | 48.860 | 26.942 | 433 / 101 ms |

Fresh-document controls at 1,000 hands: **6.053→2.742 s** from app mount to verified state. At 10,000: **57.558→26.556 s**, maximum startup task **540→106 ms**. Candidate navigation-to-ready was **4.820 s / 27.837 s**, respectively; secondary statistics completed **8.176 s / 31.907 s** after navigation. A 0 ms Long Task maximum means no task crossing the browser's threshold was observed, not zero computation.

Required financial/history verification finishes at readiness. A separate, explicit audit of the retained original copy took **52.546 s** at fresh 10,000 hands, with an **834 ms** maximum task; another same-document audit observed **1,058 ms**. It is not claimed to be an automatic background audit or removed from user-visible costs. The UI labels this additional archive unaudited until it actually completes.

First-upgrade preparation of 10,000 hands took **70–73 s** and is excluded from subsequent-load timings above. Original serialized data was approximately **481.48 MB**; retaining originals plus **217.05 MB** of packed replicas totals **698.54 MB**. Fresh candidate startup heap peaked at **2.354 GB**, starting from **1.553 GB** of renderer residue. Fresh documents did not force clean processes/GC; these coarse browser heap readings do not demonstrate memory savings or small-phone capacity.

Node native-WebCrypto serial reference results, separately from browser measurements, were **2.45→2.26 ms; 82.20→75.06 ms; 1,111.15→509.12 ms; 2,121.26→1,112.58 ms; 11,850.44→5,590.81 ms; 27,177.68→11,311.57 ms** for the six sizes. These are also n=1, not percentile estimates.

Actual 5,000 bot preparations over 703 newly completed hands yielded **p50 4.294 ms, p95 26.679 ms, p99 36.387 ms, max 457.540 ms**. The maximum was attributed principally to approximately 431 ms in snapshot freezing during incremental integrity verification, with 9.99 ms GC overlap. No >1 s preparation occurred in that sample. The original **9.79 s** outlier remains unattributed; this run does not prove it impossible. The test ended with 10,703 hands, 10,990 ledger events and exact independent accounting/statistics agreement.

Full measurement methodology, stage profiles, memory limits, active-hand controls, raw hashes and all 21 browser recovery receipts: [FINAL_PERFORMANCE_REVIEW.md](tests/step5d-recovery/FINAL_PERFORMANCE_REVIEW.md), [FINAL_PERFORMANCE_EVIDENCE.json](tests/step5d-recovery/FINAL_PERFORMANCE_EVIDENCE.json), [CPU/profile report](tests/step5d-recovery/REPORT.md). A fresh candidate 10,000-hand pending-bot browser benchmark is not executed; do not infer it from the 1,000-hand pending case or closed-session matrix.

## Integrity, migration and rollback

Independent review executed **248/248 cases across 17 files**, including 120 new independent cases; these overlap the complete suite and are not added to its count. Coverage includes missing/duplicated/reordered events, malformed and stale checkpoints, version/sequence/hash disagreements, hostile packed graphs, interrupted writes/transactions, quota failures, concurrent ownership, all-in settlement, pending choices, historical policy versions and immutable history. Current exact state and independent full accounting/statistics replay agreed. Ordinary untrusted input continues to take full verification.

The first integrated attempt had **6 failing tests** plus one lint failure. It exposed the previous-snapshot overwrite and a second-reader representation-install conflict affecting fresh-save/reset lifecycles. Both were repaired, and unchanged original erasure/migration assertions now pass. Initial failure receipts remain saved; they were not rewritten as successes. A separate retained-copy corruption test correctly distinguishes a valid fully verified packed copy from a damaged old archive: startup can recover from the valid copy, the old archive remains explicitly unaudited, and its requested audit fails without resetting or rewriting data. If neither authoritative copy establishes integrity, gameplay blocks.

The current native browser archive workflow passed **7 checks**. The actual populated **V7→candidate→V7-R→candidate** workflow passed **9 checks**: interrupted migration published no partial backup/receipt/current state; retries preserved exact hand/ledger bytes; post-upgrade records, top-ups and manual adjustments survived; the pending 1.6 decision committed once; rollback UI actions and subsequent candidate restoration conserved records and money. Unchanged V7 refused unfamiliar data without modifying it.

**Rollback means the tested V7-R compatibility build**, comprising the frozen V7 interface and V8 compatible runtime—not redeployment of unchanged V7, nor overwriting newer records with an old backup. V7-R retains its older performance limitations. Procedure, trigger, provenance and limitations: [rollback README](tests/step5c-rollback/README.md). Native current-run evidence: [rollback](TEST_EVIDENCE/step5d/browser/step5d-native-rollback-pass.json), [archive audit](TEST_EVIDENCE/step5d/browser/step5d-native-archive.json).

## Executed verification

| Execution | Actual result | Boundary |
|---|---|---|
| Complete repaired suite | **1,554/1,554 PASS**, 0 FAIL, 0 SKIP; 170 files | [Source/build manifest](TEST_EVIDENCE/step5d/release-repaired/manifest.json); typecheck, lint, build, specification/registry checks pass |
| Paired independent reference | **1/1 PASS**, 1,344 hands | Separate executed suite; not 1,344 acceptance criteria |
| Full composition supplement | **2/2 PASS**, 960 hands | Exact same 143 runtime inputs and compiled assets |
| Exact exploit probes | **1 selected PASS**, 2 unrelated cases deselected; 3,072 hands | Retains negative findings; no forced call quota |
| Compiled cash workflows | **27 completed UI hands**, all 2–10 seats at 320/390/1280 px | 51/46/51 workflow records; nine settlements and cashouts per run; exact compiled assets |
| Populated compiled statistics | **18 workflow records PASS**, 400 saved fixture hands | Two 200-hand mixed-stakes fixtures; **zero UI-played fixture hands**; reload, reset-marker and explicit restart verified |
| Current accessibility regression | **6/6 cases, 282 assertions PASS** | 2/6/10 seats at 320/1280; programmatic focus/names/labels/draft preservation, not screen-reader execution |
| Native archive / rollback | **7 / 9 checks PASS** | Isolated native IndexedDB, current source plus pinned historical compatibility artifacts |
| Published V7 guest smoke | **One additional actual hand, cashout and reload PASS** | No sign-in; live policy 1.2 retained; no new deployment |
| Final additive QA checks | **63/63 PASS**, 0 FAIL/SKIP; typecheck, lint and rebuild PASS | Evidence-verifier contracts and populated-fixture checks overlap other runs; all 143 production inputs and all three compiled files still match the main release execution |

Compiled cash checks exercised archetypes/unknown/custom/random configuration, synthetic population presets, stable identities, every supported seat count, Hero-only action controls, rapid duplicate actions, queued pending choice, reload before/after a committed bot action and payout, manual wallet changes, top-ups, exact-once cashout, notes, preset cloning, public replay/export and study-only import, uncertainty labels and BB/100. The later 320/1280 runs additionally verify unstarted custom $50/$100 configuration disclosure and active post-bot committed-state reload. The 390 capture does not claim those later-added assertions.

For an exact example from the 320-pixel run: heads-up $1/$2, Hero calls $1; opponent checks. Board **5s 2c 7d / Kd / 2d**. Both check flop and turn; opponent bets **$6** on river; Hero calls **$6**. Opponent receives **$16**, rake **$0**; stacks finish **$192/$208**, Hero net **−$8**. Card/state hashes and the committed bot revision match through the active-hand reload. A later $50 top-up changes wallet/table allocation while keeping −$8 poker P&L, and cashout settles once. Full public events are preserved in [320px capture](TEST_EVIDENCE/step5d/browser/step5d-compiled-mobile-320-pass.json).

The separate live V7 smoke began with $9,999 and one existing hand, bought in $200, posted $1/$2, folded Hero's 5c9h, returned Alex's unmatched $1 and awarded Alex $2. Hero cashed out $199; after actual reload the wallet showed **$9,998**, zero table chips and **two saved hands**. [Observed live DOM](TEST_EVIDENCE/step5d/browser/step5d-v7-guest-smoke.txt).

Screenshots are real source-mounted browser QA, not generated images or physical-device results: [6-seat mobile](TEST_EVIDENCE/step5d/browser/step5d-mobile-six.jpg), [9-seat mobile](TEST_EVIDENCE/step5d/browser/step5d-mobile-nine.jpg), [10-seat mobile](TEST_EVIDENCE/step5d/browser/step5d-mobile-ten.jpg), [10-seat controls](TEST_EVIDENCE/step5d/browser/step5d-mobile-ten-controls.jpg), [desktop](TEST_EVIDENCE/step5d/browser/step5d-ten-seat-desktop.jpg). Captures show the viewport available to the browser, not a stitched whole-phone screenshot.

## Original acceptance and release obligations

The ID-preserving register contains **218 PASS / 0 FAIL / 5 BLOCKED / 79 NOT_EXECUTED = 302**. The 237 critical original rows contain 218 PASS and 19 NOT_EXECUTED; nine explicitly authorized cash components have supporting PASS while their whole mixed criteria remain NOT_EXECUTED. These nine are not additional original PASS requirements. **V706 remains whole NOT_EXECUTED**, with verified cash rules and preserved deferred straddle scope. All original criterion/source hashes and all **86 deferred features** are unchanged.

| Requested gate | Original criterion | Outcome and remaining obligation |
|---|---|---|
| F10 | Strong reg adjusts size/line more accurately on average; avoid unconditional "always best" claims | **PASS, bounded synthetic assessment.** Fresh 49,152 legal decisions over 192 situations / 576 cells; mean stronger-minus-weak stipulated one-node utility +343.99 cents, with negative families/cells retained. Independent oracle references and assumptions reviewed. [Signoff](tests/step5d-gates/F10_SIGNOFF.md). No human/expert/solver/full-decision-EV claim. |
| U10 | Core actions operable and properly announced without animation-only meaning | **NOT_EXECUTED in full.** Actual keyboard and automated focus/labels are partial; screen-reader announcements require execution. |
| U11 | Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop | **NOT_EXECUTED in full.** Cloud and Node timings exist; specified physical phone/desktop interaction measurements remain. |
| U16 | Verified unique project ID + site URL, deployment build, original sites unchanged by all write calls | **NOT_EXECUTED in full.** Current identity/source/build proven; complete historical all-write audit absent. No access to Poker MaxEV was used to manufacture it. |
| Z02 | New project/site identity proven and old project unchanged; signed-off deploy SHA and actual browser smoke recorded. | **NOT_EXECUTED in full.** Existing project, deployed V7 and current smoke verified; historical nonmutation evidence incomplete, candidate intentionally unpublished. |
| Z12 | Every test status has evidence and build, `NOT_EXECUTED`/`NOT_AVAILABLE`/`BLOCKED` recorded honestly; gates check critical applicable tests rather than test count alone. | **NOT_EXECUTED in full.** Strict qualification now refuses incomplete source/input/expected-observed/browser links; remaining per-criterion gaps are enumerated in the current audit. |
| V513 | Suspend/kill tab while bot thinking or a settlement pending; on recovery state/action revision and payouts match pre-interruption committed events. | **NOT_EXECUTED in full.** Actual document reload, interrupted transaction and exact revisions verified; physical OS suspension/kill remains. |
| V518 | Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels. | **NOT_EXECUTED in full.** Cloud partial results retained; specified devices/screen reader and remaining performance qualification required. |
| V522 | Every required critical test has runnable command/fixture plus build+seed+evidence; CI blocks errors; canonical V5 document is authority; V4 archive cannot override it. | **NOT_EXECUTED in full.** Local runner and fail-closed gates work; hosted CI has no connected authorized execution target. Original wording retained; V7 governs current precedence. |
| V620 | Every passing critical test records commit/build, engine+policy+room versions, test input/seed when applicable, actual expected/observed, runtime environment and artifact path; missing evidence blocks release. | **NOT_EXECUTED in full.** See current strict qualification report and exact remaining IDs. A green test count does not fill these gaps. |
| V707 | Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion. | **NOT_EXECUTED.** Requires three actual new users, 25 hands each and observed results. Automated hands are not substitutes. |

See [R1_DASHBOARD.md](R1_DASHBOARD.md), [ACCEPTANCE_STATUS.csv](ACCEPTANCE_STATUS.csv), [strict current execution qualification](TEST_EVIDENCE/step5d/execution-qualification.json). The final strict audit qualifies **172 of 227 effective critical PASS records** (218 whole-original PASS plus nine declared cash components). **55 require further complete criterion/provenance evidence**; this is not 55 newly observed product failures. Their exact IDs, original wording and next proof dependencies are listed in [REMAINING_EVIDENCE_WORK.md](tests/step5d-gates/REMAINING_EVIDENCE_WORK.md). The enforced audit actually exited 1, blocking release. Existing historical PASS statuses are preserved as historical assessments; the stricter candidate qualifier separately blocks release when their complete candidate evidence is missing. It does not invent new IDs or silently promote a source association into passed coverage.

Hosted CI: workflow/configuration and local execution are retained, but **no hosted run occurred**. The native Sites source repository is not a discovered GitHub Actions repository. A connected, authorized repository/runner execution target and an actual successful source-bound run are required. [CI record](tests/step5d-ci/FINAL_CI_STATUS.md).

Physical iPhone Safari export remains **AWAITING USER VERIFICATION**. No physical screen-reader, named-phone performance, OS kill or three-new-user test was claimed. Exact device instructions: [DEVICE_VERIFICATION.md](tests/step5d-accessibility/DEVICE_VERIFICATION.md). Human-data calibration and independent expert strategy assessment remain distinct unperformed evidence classes.

## Release decision and exact next work

**NOT READY FOR R1. Do not deploy.** Preserve the tested candidate while keeping V7 public. There are ten unresolved original release checks after F10, plus the failed engineering recovery target and remaining strict candidate-evidence gaps. Passing test suites do not waive them.

Next engineering task: design and adversarially verify a bounded, transactional current-state/financial checkpoint and journal that permits independently provable essential recovery without materializing every old hand. Retain full original histories and explicit full replay; prove sequence/financial/settlement agreement and corruption refusal before enabling faster play. Prototype against the existing hashed 0–10,000-hand fixtures, including a fresh pending 10,000-hand case, measure secure-context hashing and first-upgrade/storage/memory costs, and reprofile snapshot freezing. Do not solve the target by skipping verification.

In parallel, close the exact remaining evidence links, obtain the historical write audit and authorized hosted runner, execute named-device/reader/kill/export tests, and arrange the three new-user sessions. Only after these mandatory gates pass should the existing Site receive a new public deployment. Run-it-twice, bomb pots, expanded personalities, variants and tournament modes remain preserved for their assigned later releases.
