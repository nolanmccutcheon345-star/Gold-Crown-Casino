# Patch Set 2 — qualified development candidate

Base: Version24, cbdc8abd384997d309af2dc2e28a09eb7d7f343a. Supplied patches5 and6 were applied sequentially. Reviewer claims are retained separately in TEST_EVIDENCE/patch-set-2/reviewer-notes.md, not counted as execution here.

## Implemented
- Actual application renders through keyed in-place DOM reconciliation instead of replacing the complete content tree.
- AbortController retires previous render listeners before rebinding.
- Sticky340px action column from1181px; pinned controls extended through1180px; compact desktop header and coarse-pointer targets.
- Integration repair: capture and clear history file input immediately, permitting same-file selection after rights rejection or cancelled preview. Native File/DataTransfer integration tests cover rejection, two repeated previews, cancellation and subsequent study import.
- Version24 phone seat ring and Version23 bounded showdown region preserved. Engine, bot policy, ledger, storage schemas and all302 original requirements/86 deferred features unchanged.

## Executed
Evidence directory: TEST_EVIDENCE/patch-set-2.
- Full npm test:2126 discovered;2117 PASS,0 FAIL,9 SKIPPED (full-tests.json). Seven opt-in PokerKit checks and two10000-hand accounting batches were skipped by their existing flags. They are not new PASS evidence. Prior reported range/archive timeouts did not recur in this run; no unrelated performance defect is claimed fixed.
- Final project typecheck, full lint and production build PASS. Existing>500kB chunk warning remains.
- Responsive matrix:189/189 PASS (2–10seats ×7viewports ×preflop/river/showdown), actual installed dependencies and immutable-source-input hash manifest. An earlier35-case source-module partial run is retained but not added to the189count.
- Native DOM harness:18/18 PASS, including100updates, keyed identity, fresh controls, focus/caret/scroll restoration and exactly-once rebinding.
- Desktop/tablet controls:18/18 PASS at701,768,844,1024,1180,1181,1280,1366,1920px,9/10seats; before/after400px scroll, button bounds and44px heights, settings/session overlap.
- Interface suite40/40 PASS; separate real Tab/Enter commits exactly1Call with accounting true.
- Accessibility/import workflows4/4 PASS for2/6/9/10seats. Automated focus/native event verification, not VoiceOver or physical-device evidence.
- Privacy/drafts/export:3commands PASS, including100renders, hidden-information checks, partial draft/caret preservation, public export and study import. Filesystem download receipt remains unexecuted; mobile export still awaits physical iPhone verification.
- Flow:4phases PASS,4completed hands/2sessions, pending/settled/cashout reloads. Initial$10000,2×$300buy-ins,$262+$299cashouts,final$9961wallet/$0table/−$39poker result. Cashout count remains2after reload. Nine distinct completed hands across retained flow/integrity/accessibility evidence, plus one separately observed real held-Fold hand.
- Actual six-second mouse-held Fold accepted across background updates; hand settled with$15awarded toQuinn,$0rake,Hero$200. Screenshot and DOM settlement retained.

## Matched rendering measurement
Actual app/dependencies, exact Version24 UI baseline vs candidate, identical legal nine-seat Hero-turn fixture. Three alternating trials per build;100measured updates after10warmups each:300samples/build. Proposal clicks do not invoke full render, so they are measured separately; Continue-session invokes actual render, followed by forced layout. All game/ledger/wallet equality checks PASS.

| Synchronous render + layout | Version24 | Candidate |
|---|---:|---:|
| p50 ms |13.5|5.7|
| p95 ms |25.4|10.4|
| p99 ms |38.8|20.7|
| max ms |82.0|76.7|
| button identity preserved |0/300|300/300|

This is a Chromium156 Linux cloud microbenchmark without CPU throttle. It is not INP/paint, long-session or physical-device qualification. Historical10.07s stall remains unattributed. No solver/human calibration claim.

## Limits / release
Short laptop heights still require scrolling to see all lower seats; controls remain accessible. Physical Safari/VoiceOver/human studies and original mandatory R1 gates are not marked passed. No acceptance statuses are inflated from automated counts. ProductionVersion7 and currently published R1 candidate remain unchanged; save this work as an unpublished development version. No deployment or guest-save migration performed.
