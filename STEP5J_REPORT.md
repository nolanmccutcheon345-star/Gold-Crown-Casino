# Step 5J — exact candidate and release qualification

**NOT READY FOR R1.** Production Version 7 remains unchanged. The public R1 test Site is ready for additional external testing of a precisely identified application; that is not release approval.

## Candidate identity and changes

- Public test: https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/
- HTTPS width checks: https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/responsive
- Application source: **138cdcf325129c69f127d0e16bc94942abea752f**.
- Qualified test wrapper: **1de3de1519cb78eff1186708f81ddc0e8700ed73**, R1 test **Site Version 4**, deployment **appgdep_6ae889f69c808191bb161bbb4193e6a0**, succeeded.
- Incoming main development source: a41250f87af3db07f6a9a9c47507abd94bf25003. Its291 changed paths relative to138 are evidence, reports and candidate packaging;147 production/build inputs compared are identical. This turn's fresh build reproduces all three deployed compiled asset hashes exactly. The accompanying final main-source save contains the new evidence and does not change application behavior.
- Main production V7 remains source a0bfc0950771a6dc1b786e00c13be7f3485b8dcb / deployment appgdep_6ae6a07f5f488191b00077a585fd5d8a. Original private V12 test remains fd52c644da201747d043ff42943c97d48816f727 / SiteVersion1 / custom access revision1. No access changes were made in Step5J. No Poker MaxEV access occurred.

[Source comparison](TEST_EVIDENCE/step5j/source-comparison.json), [rebuilt bytes](TEST_EVIDENCE/step5j/rebuilt-asset-agreement.json), [native Site provenance](TEST_EVIDENCE/step5j/site-provenance.json).

Only the test wrapper changed: new responsive.html/js provides same-origin HTTPS iframe widths; Verify stays disabled until its handlers are ready; a scoped shortcut-navigation style fixes observed horizontal overflow from inherited application nav styling. The initial wrapperV3 was tested, the overflow repaired, and wrapperV4 published and verified. Engine, bot, financial, storage and application CSS bytes are unchanged. Security checks were never bypassed. An HTTP ancestor was the prior mobile-preview restriction; a supported HTTPS ancestor resolves it. These are Chromium CSS-width checks, not phone/touch emulation or physical Safari evidence.

## Actual hosted browser work

Fresh direct HTTPS guest opening required no Google sign-in. Linux Chrome155 was used through supported interactive browser controls. One actual UI hand at each occupied count2–10 completed; then a tenth heads-up hand exercised committed-blind safe exit. The authoritative CSPRNG engine dealt the hands; no private engine or deck access was used to choose actions.

| Players | Hero result | Ending table-chip total |
|---:|---:|---:|
|2|+$2.00|$40|
|3|−$12.63|$60|
|4|+$3.00|$80|
|5|−$20.00|$100|
|6|−$2.00|$120|
|7|−$20.00|$140|
|8|−$20.00|$160|
|9|+$7.64|$180|
|10|−$20.00|$200|

Each session used$20per seat,$1/$2,no rake. All-fold endings, regular showdowns and short-stack/all-in calls occurred. Exact actions, street contributions, board, permitted cards and107 replay frames are in the actual489,753-byte [nine-hand download](TEST_EVIDENCE/step5j/hosted-nine-hands.json). No new side-pot/rake scenario is inferred merely from these hands; independent engine/oracle cases cover those mechanics.

Completed-hand example: Hero6♦9♣ posts$1SB, Alex$2BB; Hero raises to$4 using Enter; Alex folds. Engine refunds Hero's unmatched$2, awards the$4matched pot to Hero, ends stacks$22/$18, rake$0, Hero net+$2. This is a legal uncontested outcome, not a showdown claim.

Post-payout reload preserved the3-player settlement. Active9-player reload resumed the same committed hand, later settled Hero+$7.64. After9hands, available wallet$9,936.01, table$0, poker result−$81.99 agreed with **$10,000initial +$18manual adjustment −$81.99poker**. The recorded adjustment had Poker$0; an earlier rapid adjustment attempt was not confirmed and is not counted. Full archive audit verified9hands, that wallet and revision389 without changing the save.

History replay was keyboard-stepped from preflop through settlement with hidden opponents before release. Download and visible-copy fallback were byte-identical. Study import validated9rows, imported9separate study copies, and left wallet/result unchanged. The tenth hand then posted Hero's$1SB; New session→Fold & leave after this hand committed a legitimate fold, cashed remaining$19once, retained the hand, and ended wallet**$9,935.01**,table**$0**,poker**−$82.99**. Another reload retained those values. Results correctly reported10canonical hands and excluded study copies/manual adjustments.

An independent second same-origin tab was blocked safely by session ownership; closing it and Retry restored the test run. This is a bounded ownership test, not a newly executed simultaneous-action race oracle.

Width sweeps covered2/3/6/9/10seats at frame widths320/375/390/430/768/1280. After the wrapper fix,30observed configurations had no horizontal document overflow, seat-box overlap or hole-card/player-label overlap. Chromium's scrollbar leaves client widths305/360/375/415/753/1265; both dimensions are disclosed. Three-seat measurements were after settlement; the other configurations had live controls. The sticky table/action shortcuts remained available. Six-, nine- and ten-player actual screenshots are retained. This does not prove all card-label/side-pot combinations or real touch accuracy.

[Browser observations](TEST_EVIDENCE/step5j/step5j-browser-evidence.json), [two-seat raw bounds](TEST_EVIDENCE/step5j/step5j-two-seat-layouts.json), [six](TEST_EVIDENCE/step5j/step5j-hosted-six.jpg), [nine](TEST_EVIDENCE/step5j/step5j-hosted-nine.jpg), [ten](TEST_EVIDENCE/step5j/step5j-hosted-ten.jpg).

Keyboard Enter operated betting, cashout, replay, history and session controls. Two Tab destinations were recorded; the traversal driver stopped at a button without an HTML id, so no complete focus-route PASS is claimed. Mobile Table settings has a symbol-only AX name `⚙`, recorded as a usability/accessibility review concern. Actual VoiceOver is not executed.

Browser-tool limitations are preserved: the download-event wait timed out and reset automation variables although the actual file reached disk and verified; earlier raw in-memory layout records were lost, so24layout outcomes are retained as the executed tool-output summary rather than invented raw coordinates. The6heads-up bounds and laterDOMevidence are saved. A final results screenshot timed out; existing three actual screenshots remain. Some bounded action loops ended before asynchronous settlement and then continued the same hand successfully. These tool wall times are not attributed to bot CPU stalls. No screenshot, device or focus result is fabricated.

## Executed checks

- Fresh targeted regression: **97PASS,0FAIL**; four default-skipped oracle cases then explicitly run.
- Explicit PokerKit0.7.7 suite: **4PASS,0FAIL,0SKIP** after installing the pinned dependency. Initial4dependency failures are retained separately; they were missing-package failures, not changed poker assertions.
- Updated registry release-gate tests: **21PASS**,0FAIL; regenerated dashboard now records138candidate/170qualified/67unqualified, preserving original statuses and historical execution hashes.
- Evidence verifier: **6PASS** including corrupt identity, altered build/hash, missing seat execution and duplicate cashout rejection.
- Actual export: **60/60assertions PASS**, covering all sizes, per-frame/end conservation, awards, unique events/cards/decisions, permitted-card redaction, provenance and observed wallet agreement.
- Typecheck, fresh production build, exact rebuilt-asset comparison, scoped new-code lint, and governing-spec integrity:PASS.
- Independent replay of **7,136retained hand traces**,0financial failures. These are rechecked existing traces, not newly played UI hands.
- The full **2,114-test** release receipt remains source-bound and was independently verified; that complete suite was **not rerun** in Step5J. Test cases, assertions, simulated hands and original acceptance IDs are kept separate.

## Performance and Z14

Seven new reference-runtime scenarios: **7,343preparations /1,162completed hands**, all verified financial/full-statistics replay agreement. Three matched1k-history repeats p95=48.83/48.96/50.74ms; maximum271.66/283.02/288.50ms. At10k, p50/p95/p99/max=14.23/56.75/411.98/548.40ms; verified startup1,348.66ms, subsequent recovery median/max1,190.55/1,274.62ms. These use actual production modules with a disk-backed IndexedDB request reference in Node, not native-browser/device measurements.

The newly observed548ms peak includes nested persistence/checkpoint/serialization costs; it does not explain the historical**10.072sUNATTRIBUTED**event. No new reference preparation exceeded1s, but repeated seeded contexts do not establish an independent recurrence probability. CPU/allocation traces and risk assessment are retained. Explicit10k full-history loading29.90s and audit28.06s remain meaningful limitations, with coarse natural-GC memory reaching about746decimalMB while full history was retained. No speculative redesign or integrity-check removal was made.

Separate real hosted HTTPS telemetry, following the9-player reload through10-player play:17preparations,p50/p95/p99/max**158.4/235.3/235.3/235.3ms**;17policy calls maximum50.8ms;236renders p95**20.2ms**,max43.4ms;12observed long tasks,max**86ms**; verified saved indicator714.6ms after observer installation. Native fast restore176ms. Two coarse heap samples,max18,862,511bytes. This small workflow sample includes startup/history and is not general INP, mobile performance or long-session qualification. [Hosted telemetry](TEST_EVIDENCE/step5j/hosted-performance-summary.json), [repeated performance report](STEP5J_PERFORMANCE.md).

## Acceptance and remaining work

All302 original IDs and86deferred features remain intact. Canonical totals remain**221PASS/0FAIL/6BLOCKED/75NOT_EXECUTED**. The237R1 rows are a subset of302; historical230effectivecashpasses include mixed cash components. Current candidate qualification is **170/237**, up46. All105previous additional mapping reviews were completed;**67remain unqualified:8known concerns+59specific current-evidence gaps**, not67observed runtime failures. Fresh hosted subchecks supplement the evidence without automatically promoting whole criteria.

The authoritative ACCEPTANCE_STATUS.csv candidate columns and generated R1_DASHBOARD.md now use this review; original statuses remain unchanged. The exact302-row matrix and all outstanding clauses are in [release-status.csv](tests/step5j-gates/release-status.csv) and [gate review](STEP5J_GATE_REVIEW.md). V706's deferred straddle portion and Z14's full original mixed criterion remain unexecuted. No tournaments or deferred variants were deleted or made R1 failures.

|Gate|Remaining requirement|
|---|---|
|U10|Actual named screen-reader core-action and announcement verification; bounded keyboard checks only are available.|
|U11|Declared physical phone/desktop decisioncomputeP50/P95,10-seat responsiveness,input-to-confirm measurements.|
|U16|Complete historical provider all-write provenance.801Gitcommits and retained receipts establish recorded targets, not every administrative write.|
|Z02|Same historical isolation evidence gap and final signed-off release-deployment conjunction. Current candidate guest smoke is verified.|
|Z14|Complete cash workflow/performance evidence conjunction; historical rare stall remains a documented risk, large archive operations costly; original deferred portion unchanged.|
|V518|Actual declared reference-device2/6/10-seat measurements and real reader/keyboard/color-independent checks.|
|V522|**BLOCKED**, future user GitHub connection and actual hostedCI run. No setup request repeated.|
|V707|Three independent first-time humans×25observed hands; **0participants,0human hands executed**.|

The additional59clauses include exact continuous100-hand UI/current-candidate matrices, side-pot/action boundary displays, populated statistics, migration/privacy/multitab evidence and source-bound review receipts. Their exact IDs and next actions are in the matrix; do not reduce the release list to only the eight named concerns.

For the user: use [STEP5J_EXTERNAL_PROTOCOL.md](STEP5J_EXTERNAL_PROTOCOL.md) and the [standardized forms](tests/step5j-external/README.md). Test the ordinary HTTPS candidate on an actual iPhone/Safari and declared desktop; save/reopen the real history JSON in Files; record actual VoiceOver speech and failures. Three new participants each locate call/minraise/raise-to, play25observed hands without coaching, then end/cashout/review history. Record actual misclicks, ambiguity, assistance and severity. No invitation has been sent. **Physical iPhone export remains AWAITING USER VERIFICATION.**

Next engineering action: close the exact remaining59current-evidence clauses with the existing candidate/harnesses, remediate demonstrated accessibility issues, and combine actual external results and future hostedCI before signing off deployment. Keep publicV7 stable. Synthetic opponents are not claimed to be expert-reviewed, human-calibrated or solver-verified.
