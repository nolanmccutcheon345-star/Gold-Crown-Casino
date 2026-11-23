# Step5F engineering and external-verification report

**NOT READY FOR R1. Version7 remains live. No deployment was performed.** The final application passed 2,017 automated tests, actual desktop/mobile cash workflows, native migration/rollback, and 10,000-hand recovery/history/audit tests. Mandatory external verification and complete current criterion-level qualification remain open.

## Source and publication

Project: `/workspace/sites/ai-texas-hold-em`, project ID `appgprj_6ae62e96ac688191bffc3c629e66a5b0`.
Starting saved Version11 source: `c2de7f98518c8400ccdf58339abb1ba27f1f3f78`.
Final fully tested application source: **`0f25769de66acb229803293781ab3d6cb5a558da`**. [Executed release receipt](TEST_EVIDENCE/step5f/release-qualified/manifest.json) pins source and exact compiled assets. Later integration changes add evidence/documentation/QA fixtures; 147 production inputs and all three build artifacts were hash-compared against that receipt without differences. The save-only Sites response identifies the final integration commit/version; no newer publication is implied.

Public site: [AI Texas Hold Em — Version7](https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/). Read-only Sites inspection still returned public access, latest saved11 and no candidate-preview URL before the final save. Actual guest gameplay, cashout and reload on Version7 passed without Google sign-in. No Poker MaxEV operation was performed.

## Implemented fixes

- `src/storage/verified.ts`: reduced retained immutability-provenance capacity without skipping descendant checks; separately replaced full historical hand references in the private financial index with frozen `{id, sessionId, net}` records at all three insertion paths.
- `src/storage/browser.ts`: a missing/invalid current manifest with surviving canonical/backup records now fails safely, including the initialization transaction race. It cannot silently replace a saved bankroll with a fresh wallet.
- `src/storage/public-history-batch.ts`, `src/ui/history-file.ts`, controller and UI: bounded, redacted, individually study-importable history files; durable-read and erasure fences; sequential export controls and Safari-compatible share/download/copy paths.
- Optional numeric performance bridge in `src/performance/public-diagnostics.ts` and timing/controller entry points. It emits allowlisted stage names and durations only, with no cards, decisions, policy parameters, saved data or network telemetry.
- Hosted-CI configuration, exact candidate packaging, bounded test traces, partial phase receipts and source-qualified release reporting. No poker rules, payouts, archetypes or synthetic policy logic were replaced.

The orphan-manifest regression was reproduced against Version11: a retained 12,345,578-cent account could appear as a fresh default 1,000,000-cent wallet. The repaired path blocks non-destructively. Full account-origin deletion remains an unavoidable browser-data-loss boundary.

## Original 10.072-second preparation outlier

**UNATTRIBUTED.** The older aggregate covers 69,055 preparations, p50 5.93ms, p95 27.39ms, p99 40.59ms, maximum10,072.24ms. Its largest policy call was1,718.17ms, establishing at least8,354.07ms outside policy computation in the largest preparation, but there is no exact timestamp/input/GC trace for that event. The original workload was Node-based, so browser rendering is not an evidenced explanation.

New matched profiles preserve per-decision stage paths, CPU/allocation traces, GC overlap, fixture/source hashes and independent reconciliation. Eight scenarios passed: **8,066 preparations and1,320 complete controller hands**. No final measured preparation exceeded one second. This is smaller than the original sample and cannot prove rare stalls are absent.

A newly measured baseline805.08ms peak contained794.52ms persistence work,487.38ms checkpoint preparation,304.10ms transaction work and217.85ms overlapping GC; policy evaluation was0.376ms. Nested/overlapping timings are not additive. This explains that new sample, not the historical10.072s event. Keep monitoring with complete stage traces, exact source/workload and separate startup/migration/audit versus ordinary-play labels. Do not hide future stalls with think-time or skipped checks.

## Matched preparation, recovery and memory results

Node24.22.1/Linux x64, identical fixture hashes/seeds, nominal2/6/10-seat rotations (a9-seat surviving table also occurred). Shared-host load varied. These matched timings precede the final private-index metadata fix and remain bound to their original execution commits.

| Saved hands | Preparations per side | Before p50 / p95 / p99 / max ms | After p50 / p95 / p99 / max ms |
|---:|---:|---|---|
|100|1,004|10.70 /46.36 /115.71 /194.25|10.23 /45.54 /124.66 /187.96|
|1,000|1,009|9.70 /43.93 /170.59 /196.95|11.90 /55.65 /174.42 /258.93|
|10,000|1,010|12.24 /58.16 /413.17 /805.08|11.31 /46.81 /352.78 /434.78|

The1k cell regressed at several quantiles; no universal speedup is claimed. The10k after cell still had35preparations above250ms although its p95 met the provisional target.

| Saved hands | First conversion before → after | Repeated checkpoint recovery median / max before → after | Full audit before → after |
|---:|---|---|---|
|100|378.5 →442.9ms|189.2 /229.7 →232.8 /304.2ms|484.6 →560.0ms|
|1,000|3,082.1 →2,780.4ms|385.1 /448.8 →411.7 /470.5ms|2,903.7 →2,923.8ms|
|10,000|30,696.1 →30,623.9ms|1,278.8 /1,412.0 →1,238.0 /1,272.5ms|40,413.4 →33,036.8ms|

A separate fresh-process CPU/allocation pair began from a checkpoint installed by another process. Each side completed1,010preparations/164hands. Profiled startup was1.54s before versus2.87s after, one sample each under different host load; no faster-startup claim. Profiled preparation p95 was65.76→75.16ms, maximum516.37→481.91ms. CPU self-time showed canonical writing, serialization and GC dominating this workload. Allocation samples measure churn, not retained heap. [Full performance report](tests/step5f-performance/README.md), [comparison](tests/step5f-performance/comparison.json).

Two distinct retained-object defects were proven:

| Retention experiment | Before | After | Evidence boundary |
|---|---:|---:|---|
|10k freezer WeakSet internal table|134,217,768B|2,097,192B|Actual heap retainer path; hand roots collected in both versions|
|10k isolated freezer post-GC heap|143.47MB|11.36MB|Three fresh processes per cell; not whole-app memory|
|1k compact financial-index post-GC heap|66,998,648B|16,669,664B|Compact120-hand state remains live; archived hand/view/frame WeakRefs now collect|
|10k whole-controller after-play heap|186.63MB|54.56MB|Matched earlier freezer-fix run, before the later financial-index fix|
|10k whole-controller full-history-retained heap|785.27MB|653.09MB|Optional complete archive intentionally retained|

All selected descendants remained frozen and canonical bytes/accounting agreed. [Freezer proof](tests/step5f-memory/README.md), [financial-index proof](tests/step5f-memory/CHECKPOINT_RETENTION.md), [independent52-test review](tests/step5f-independent/evidence/checkpoint-retention-review/review.json). Lifetime cache cardinality is not an absolute constant. A separate unchanged packed-node cache retained about4MiB at1k; no global leak-free claim is made.

Storage is **not reduced**: the matched10k conversion stored497,624,350 serialized bytes; canonical action frames dominate. Final native-browser counting, including native record/metadata representation, measured498,448,990bytes. These are serialized bytes, not physical IndexedDB allocation. Canonical history, journals, policy/rule versions and verified backups remain intact.

## Actual final browser recovery and gameplay

Chromium155/Linux cloud browser; mobile widths are CSS viewport tests, not physical phones. Recovery runs use hash-verified production modules and a fresh document after fixture preparation, not a fresh browser process or cleared disk cache. Final UI workflows execute the exact compiled release assets.

| Final recovery workload | Safe gameplay | History loading | Independent audit | Largest startup / history / audit-overlap task |
|---|---:|---:|---:|---|
|1k, history then audit|693.5ms|See receipt|3,574.5ms|169ms / no observed >50ms / no observed >50ms|
|10k, compact audit|2,248.7ms|NOT_EXECUTED in this cell|36,284.6ms|580ms / not selected / no observed >50ms|
|10k, history then audit|1,943.9ms|36,009.3ms|34,405.2ms|551ms /254ms / no observed >50ms|

All three passed exact wallet, ledger/event identity and hand-count reconciliation, and their isolated databases were deleted successfully. Gameplay readiness is separate from optional history/audit completion. Operator pauses are excluded from the individual phase durations; end-to-end elapsed includes them. No observed long task is not zero CPU work; these are not INP measurements.

Coarse10k compact-run heap:876.85MB at ready,692.06MB after audit,1.22GB peak. Combined-run heap:1.37GB at ready,1.26GB after history,1.09GB after audit,2.10GB peak. Those samples include renderer/preparation residue and allocation churn, not isolated steady-state post-GC memory. They cannot be equated to the old fixture-inclusive2.59GB maximum or used to qualify iPhone memory limits. A separate1k retained-graph experiment measured73.38MB with compact state versus127.26MB when loaded history remained live during audit, demonstrating duplicate graph pressure.

Earlier baseline/candidate10k attempts became unresponsive and remain **NOT_COMPLETED**, with retained interruption receipts. The baseline had reached audit; the candidate stage was not recoverable. New successful runs use the later index fix, bounded trace collection and phase checkpoints. They do not retroactively attribute those earlier tool/page timeouts.

Evidence: [1k final](TEST_EVIDENCE/step5f/browser/recovery-final-1000.json), [10k compact](TEST_EVIDENCE/step5f/browser/recovery-final-10000-compact-audit.json), [10k combined](TEST_EVIDENCE/step5f/browser/recovery-final-10000-combined.json).

Final compiled UI workflows passed **11 complete hands at1280CSSpx and11 at390CSSpx**,58workflow records per run. Both cover2–10seats, notes, pending-bot interruption and rerenders, actual reloads, legal betting/showdown, exact raise and$3/$7stakes, top-ups, manual adjustment/P&L separation, eleven settlements/cashouts, history/replay/redacted export/study import, and statistics filters. Final desktop wallet1,200,532cents/profit532cents; mobile wallet1,197,021cents/profit−2,979cents; table funds zero and no active session. [Desktop](TEST_EVIDENCE/step5f/browser/final-compiled-1280.json), [mobile](TEST_EVIDENCE/step5f/browser/final-compiled-390.json), [actual9-seat screenshot](TEST_EVIDENCE/step5f/browser/final-nine-seat-390.jpg).

Exact final desktop hand `hand-cd08413782cab3a39300d1d0fc970a47`: heads-up$3/$7,$350stacks; Hero posts$3 and calls$4, opponent checks. Flop3h6s7h: opponent checks, Hero bets$7, opponent folds. Engine refunds Hero's unmatched$7, awards the$14matched pot, rake$0; Hero ends$357, opponent$343. Net+$7, total$700conserved.

The earlier b27 exact bundle also passed **100 continuous actual UIhands** at10seats/390CSSpx: five payout-boundary reloads,100settlements, one session, one cashout, final wallet1,161,582cents and no active game. [Long-session receipt](TEST_EVIDENCE/step5f/browser/compiled-stress-100-390.json). This predates the later financial-index fix and is not retagged as a final-source100-hand run. Final-source100-hand and actual-device endurance remain unexecuted.

## Financial, corruption, migration and rollback safety

The full2017-test suite includes engine/evaluator, rake/refund/side-pot conservation, hidden-information and bot-idempotency, statistics, corruption, checkpoint/journal and storage failures. PokerKit and independent reference comparisons executed. The final full reference matrix ran4,032hands, paired matrix1,344, table composition960 and ecology800; these hand counts are not additional automated test cases or acceptance IDs.

The independent combined protocol check passed62/62 (overlapping full-suite cases), and the later index-fix review passed52/52. Native IndexedDB checks passed8/8: populated reconciliation, reload, transaction abort, injected quota failure, ownership fencing across two connections, payout/cashout retries, missing-manifest preservation and stale export after erasure. Two connections do not themselves constitute a physical two-tab test; actual final two-tab/OS-kill/disk-exhaustion qualification remains separate.

Final native populated migration/rollback passed **9/9checks**: actual frozenV7 creates saved hands and pending action; interrupted migration leaves bytes intact; current code preserves exact records and verified pre-upgrade backup; newer settlements/top-ups/cashouts/adjustments persist; originalV7 refuses unfamiliar data without deletion; **V7-R** restores the latest valid state, commits the pending decision once, executes real Fold/New Session/Cashout controls, and round-trips to current code. Unknown schema99 also fails safely. [Final browser receipt](TEST_EVIDENCE/step5f/browser/rollback-final.json), [rollback procedure](tests/step5c-rollback/README.md).

Redeploying originalV7 alone is not a valid rollback. V7-R is the tested compatibility release (frozenV7 interface with the compatible reader/engine/policy runtime), not a data-schema downgrade. Never restore the older backup over newer valid hands/events.

Whole-origin user deletion/eviction removes same-origin backups too. Guest saves are not guaranteed to survive that boundary or synchronize across devices. Redacted study exports cannot restore wallet/active-session state; no external full-wallet backup capability is claimed.

## Export and independently testable candidate

A reproduced export defect produced78,537,178-byte pretty JSON, exceeding the unchanged10MBstudy-import limit. The new bounded path exported the same1,000canonical hands in22files, maximum1,999,972bytes, restoring every permitted hand/frame/result exactly once with original canonical SHA unchanged. Files are individually importable, policy/private cards remain redacted, and imports never credit bankroll. Exact UI export/import also passed in both final compiled workflows. Physical iOS Files/Share remains **AWAITING USER VERIFICATION**.

[Final portable review package](tests/browser/step5f-candidate-checkpoint.zip):399,159bytes; SHA-256 `fc557342b30d2fea9fd0806ec227998914c6f2aac66f66108c458b4fb8a8f678`. It contains the exact final compiled bytes, source/hash receipt, independent observation wrapper and blank verification forms. It supersedes the earlier b27 package for new review.

There is **no independently hosted candidate URL**: inspected Sites tools expose production deployment and the project returned `current_preview_url:null`. Version7 was not replaced to obtain testing access. The package refuses production origin and remaps only its isolated test database. It does not migrate/read production saves. Internal plain-HTTP preview correctly blocked the manual wrapper's secure-context requirement; no security check was bypassed. This is not a passed physical/manual-package launch test.

Desktop alternative: unzip, run `python serve_candidate.py`, open `http://localhost:8765/?measurePerformance=1`, choose Verify and open candidate, retain the generated full run URL. For physical testers, place the verified package on an **authorized separate HTTPS origin**; localhost on the developer's machine is not an iPhone URL. The included server is not authenticated/TLS hosting. [Complete access procedure](tests/step5f-external/PORTABLE_CANDIDATE.md).

## External verification and hosted CI

- **U11/V518 devices:** no new physical device result. Original criteria require declared reference phone/desktop measurements, not invented model/OS combinations. Record device, OS/browser, source/build, orientation/zoom/power mode, p50/p95 preparation/response, rendering, memory availability and input errors. Play repeated2/6/10-seat hands and additional9-seat mobile layout. Test cashier, New Session, reload/pending bot, history and Files export. [Phone checklist](tests/step5f-external/PHONE_CHECKLIST.md).
- **U10 real screen reader:** NOT_EXECUTED. This environment exposes no controllable real screen reader/spoken-output capture. Test accessible names, additional call/raise-to amounts, focus, announcements/errors, game-state understanding, cashier/history using an identified real reader/browser. [Reader checklist](tests/step5f-external/SCREEN_READER.md).
- **V707:**0/3 independent new users and0/75observed participant hands. [Neutral25-hand protocol](tests/step5f-external/NEW_USER_STUDY.md), [ready-to-share invitation draft](tests/step5f-external/INVITATION.md), [feedback form](tests/step5f-external/FEEDBACK_FORM.md) and blank records are included. No invitation sent or participants invented.
- **V522 hosted CI:** BLOCKED on dedicated repository/runner connection; no actual run URL. Read-only GitHub discovery found no authorized installed AI Texas Hold Em repository. Five-job workflow fetches full history, restores checksum-verified historical objects, disables persisted checkout credentials, runs checks/oracles and retains artifacts. Local execution is not hosted CI. Required action: designate/create the dedicated repository, authorize this project's full-history push/connector access and enable hosted Actions/required checks; then retain the actual candidate-SHA run URL/logs/artifacts. No unrelated repository was modified.

## Acceptance accounting and mandatory gates

All302original IDs and exact criteria remain preserved: **221PASS,0FAIL,5BLOCKED,76NOT_EXECUTED** in [ACCEPTANCE_STATUS.csv](ACCEPTANCE_STATUS.csv). These are accumulated original requirement statuses, not2,017new acceptance passes. The preserved Step5E snapshot qualified229/237R1critical IDs; it is not a fresh Step5Fqualification.

The [new302-IDdashboard](TEST_EVIDENCE/step5f/release-qualified-status.md) and [machine report](TEST_EVIDENCE/step5f/release-qualified-status.json) independently validated the final receipt and returned **NOT_READY_FOR_R1**. Fresh criterion-level qualification remains pending (0/237promoted by this read-only generator); that is a mapping/qualification backlog, not237observed product failures. No historical PASS is silently copied onto a changed candidate. Whole mixed criteria, includingV706straddles andZ14's retained scope split, remain truthful.

| ID | Exact original criterion | Current mandatory-gate outcome |
|---|---|---|
|U10|Core actions operable and properly announced without animation-only meaning|NOT_EXECUTED: real screen-reader speech and keyboard/gesture qualification; automated accessibility is partial evidence only.|
|U11|Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop|NOT_EXECUTED: declared physical reference phone/desktop response, frame and input-to-confirm measurements.|
|U16|Verified unique project ID + site URL, deployment build, original sites unchanged by all write calls|NOT_EXECUTED: current project identity verified, but complete provider historical project-write audit is unavailable.|
|Z02|New project/site identity proven and old project unchanged; signed-off deploy SHA and actual browser smoke recorded.|NOT_EXECUTED: historical isolation audit and final signed-off deployment/smoke incomplete. Do not deploy merely to manufacture this evidence.|
|Z14|No compulsory training modal; hand replay and notes respect private-card disclosure; uninterrupted play, touch/keyboard support, bounded storage, no performance regression.|NOT_QUALIFIED: combined engineering workflows now pass, but full criterion-level no-regression/bounded-storage qualification and external interaction evidence remain incomplete. Original mixed-scope status stays intact.|
|V518|Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels.|NOT_EXECUTED: physical-device matrix and real screen reader; Chromium emulation is not a substitute.|
|V522|Every required critical test has runnable command/fixture plus build+seed+evidence; CI blocks errors; canonical V5 document is authority; V4 archive cannot override it.|BLOCKED execution dependency: no authorized dedicated hosted repository/runner or provider run URL. Original whole status remains NOT_EXECUTED.|
|V707|Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion.|NOT_EXECUTED: 0/3 independent new users, 0/75 observed participant hands.|

## Executed counts and preserved failures

| Execution | Result |
|---|---|
|Final exact-source complete automated suite|2,017/2,017PASS,207files,0FAIL/0SKIP; typecheck/lint/build/spec/registry/CI contracts PASS|
|Independent paired-reference lane|1/1PASS repeated with distinct1,344-hand scenario, not an extra original criterion|
|Local release-status/workflow contracts rerun|29/29PASS; not hosted CI|
|Final exact compiled desktop/mobile|11+11complete UIhands;58workflow records each; allPASS|
|Earlier exact compiled mobile / long session|11hands plus100continuous ten-seat hands PASS, source b27 retained|
|Native transaction checks|8/8PASS, preceding metadata-only index fix|
|Final populated native rollback|9/9PASS on post-fix runtime|
|Final recovery/history/audit|1kcombined,10kcompact-audit,10kcombined PASS; independent balances/event identities/history agree|
|First integrated attempt|1,993/2,001PASS,8FAIL plus lint failure; retained. Seven missing pinned-PokerKit path failures and one synthetic gate-fixture metadata defect were repaired.|
|First post-index-fix attempt|2,014/2,014tests PASS but overallFAIL from packaged-observer lint globals; retained and corrected before final full rerun|
|Earlier10kbrowser attempts|NOT_COMPLETED; raw interruption evidence retained, exact cause unproven|

Focused suites overlap the full suite and must not be summed into a fictitious unique test total. Every original receipt retains its actual source/hash/date. Final source-bound artifacts were verified again after integration.

## Release decision and remaining work

**NOT READY FOR R1. Keep Version7 live.** Save the tested source without deploying. Establish an authorized isolated HTTPS candidate host, connect and execute hosted CI, obtain real screen-reader/device results and three observed25-hand new-user studies, complete the provider historical write audit and criterion-level evidence mapping, and retain the final signed-off upgrade/rollback/deployment record. Final-source endurance/two-tab/OS-kill and physical-device storage limits need their own executed qualification; do not infer them from injected failures or earlier-source runs.

Engineering limitations remain: original10.072soutlier unattributed; sample size cannot exclude rare stalls; full archive loading/audit still takes tens of seconds and substantial memory/storage; unchanged packed-cache capacity remains; external full-wallet backup is absent. Synthetic bots remain heuristic approximations without independent expert assessment, measured-human calibration, solver certification or evidence of real-world profitability.

All **86deferred features** remain intact in [BACKLOG_86.csv](BACKLOG_86.csv), including run-it-twice, bomb pots, hundreds of personalities, variants and tournaments. No original requirement or future feature was deleted, re-IDed, weakened or silently deferred in this phase.
