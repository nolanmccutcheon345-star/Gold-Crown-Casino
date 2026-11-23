# Step 5E — verified recovery and R1 qualification

**Release decision: NOT READY FOR R1. Version 7 remains published.** This candidate is not authorized for deployment while mandatory original criteria or their required evidence remain incomplete. The public site is https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ . All work continued in the existing project `appgprj_6ae62e96ac688191bffc3c629e66a5b0`; Poker MaxEV was not accessed or modified during this work.

The production candidate tested by the complete local suite is `37aa22575baaf582f845a70e1862ba6e6409aa48`. Subsequent commits add browser assertions, corrected synthetic fixtures, source-bound evidence and release annotations; they do not change its production runtime. The late background-save and draft-preservation repairs are included in this tested runtime. The final saved-source receipt records the final Git commit and saved version separately.

## Implemented source

Thirteen production files changed from saved Version 10. The authoritative poker engine, evaluator, dealing, settlement and bot policies were preserved.

- `src/storage/financial-checkpoint.ts` and `recovery-contracts.ts`: versioned committed-state checkpoint, compact financial/provenance index, ordered incremental journal, retained previous acceleration generation and transactional promotion.
- `src/storage/browser.ts`, `verified.ts` and `segments.ts`: verify canonical financial records, current manifest, required resident archive and index before enabling play; reject inconsistent or corrupt data; fence concurrent writers and full-history adoption; retain canonical records and migration backups.
- `src/session/controller.ts`, `types.ts` and `notes.ts`: explicit bounded-history readiness, safe full-history loading, source-compatible notes, and read-only history export after storage failure without attempting another payout or silently clearing the failure.
- `src/stats/projection.ts`, `src/session/bot-observation.ts`: verified statistics and permitted public-observation checkpoints with independent replay checks. Every statistics hand identity must agree with the financial index. Public memory retains at most the last 120 observed hands per seat, without hidden-card access.
- `src/ui/app.ts`, `async-cash-stats.ts`, `cash-results-filter.ts`: distinguish verified funds from pending full-history audit, bounded history pages and explicit older-history loading; cash result filters by session and stake with truthful denominators and unavailable time metrics.

The checkpoint is not an unverified cached balance. Required financial checks execute on every recovery. Older canonical hand bodies remain available and independently auditable. Local checksums detect corruption; they are not protection against an attacker who rewrites every local record and checksum.

## Recovery and performance

The measured bottleneck was repeatedly deserializing, freezing and hashing complete historical hand/frame graphs. Compact verified recovery avoids repeating those graphs during normal startup. Full historical auditing remains available and expensive.

| Saved hands | V10 prepared recovery | Candidate prepared recovery | Candidate first installation | Explicit full audit |
|---:|---:|---:|---:|---:|
| 0 | 0.031 s | 0.017 s | 0.021 s | 0.006 s |
| 100 | 0.145 s | 0.271 s | 0.390 s | 0.110 s |
| 500 | 1.292 s | 1.031 s | 2.227 s | 1.746 s |
| 1,000 | 2.559 s | 0.601 s | 4.535 s | 3.587 s |
| 5,000 | 13.603 s | 1.674 s | 20.699 s | 19.121 s |
| 10,000 | 29.351 s | 2.221 s | 42.765 s | 39.813 s |

The final captures use runtime export `d8c7f06`; all 119 imported production-file hashes match the complete tested candidate `37aa225`. The comparison independently checks identical fixture bytes, balances, table chips, net results and hand counts against the recorded V10 baseline. There is **one actual Chromium/Linux observation per size**, using native IndexedDB and a fresh document, not a fresh renderer or physical iPhone. These are not latency percentiles or controlled-GC measurements. The 100-hand result was slower than baseline; earlier 100/500-hand regressions are also retained. First conversion and full older-history loading remain substantial costs.

At 10,000 hands, maximum startup Long Task was 720 ms and full-audit Long Task 1,127 ms. Long Tasks are not INP. The coarse ready heap was 1.469 GB and sampled peak 2.588 GB, including fixture construction and renderer residue. They do not establish isolated application allocation or a memory reduction. Serialized storage was approximately498MB, not physical disk allocation or a mobile quota guarantee. The prior 1,000-hand pending-decision reload reached readiness in0.748s; final-candidate pending-action recovery is additionally exercised in actual compiled reload and tab-close workflows.

[Final six-size comparison](TEST_EVIDENCE/step5e/final-recovery-comparison.md) links the raw observations, exact source/byte checks, separate paint proxies, startup/history/audit windows and memory measurements.

The complete Node persistence workload separately ran 18 canonical restores, 18 checkpoint restores and six installations. At 10,000 hands, checkpoint recovery p50 was 1,175.9 ms and maximum 1,301.7 ms, versus full replay p50 25,922.0 ms. Each cell has only three samples. All accounting, selected archive hashes and full-replay statistics agreed. The asynchronous serialized-IDB adapter is not a browser disk benchmark.

The sustained Node workload executed **2,000 bot preparations**, 297 new hands, eight pending-action reloads and eight stale-action rejections on a 10,000-hand archive. Preparation p50/p95/p99/maximum: **9.12 / 41.85 / 340.32 / 461.59 ms**. The slowest trace was dominated by checkpoint/persistence work, not bot policy. The prior 9.79-second outlier was not reproduced; its historical cause remains unproven. No artificial think-time, skipped verification or arbitrary timeout was used to conceal processing costs.

Full methodology, per-size stage timings, CPU profiles, memory caveats and exact evidence: [recovery report](tests/step5e-persistence/REPORT_SECTION.md), [browser aggregation](TEST_EVIDENCE/step5e/recovery-summary.md), [complete Node qualification](tests/step5e-performance/evidence/qualification.json), [sustained workload](tests/step5e-performance/hot-evidence/qualification.json).

## Integrity, migration and rollback

The independent replay checks include missing, duplicate, reordered and corrupted events; inconsistent checkpoint identities and statistics; interrupted transactions, quota failures, stale ownership, pending decisions and all-in settlement. One independent all-in example reconciles 14,700 cents main pot, 10,000 cents side pot, 300 cents rake and 10,000 cents uncalled refund, with Hero net +9,700 cents. Both before-commit interruption and committed-write/lost-ack recovery retain one settlement and cashout. See [independent review](tests/step5e-independent/INTEGRITY_REPORT_SECTION.md).

Actual native-browser checks passed six storage scenarios and nine populated upgrade/rollback scenarios. They verify original V7 backup, interrupted migration, post-upgrade activity, old-reader safe refusal, V7-R recovery of the latest state and candidate re-entry. **Redeploying unchanged V7 alone is not a valid data rollback.** V7-R is the tested compatible recovery path. Current corrupt checkpoints fail safely; the previous checkpoint is not silently adopted over newer financial events.

No destructive production-save experiment was performed. Injected quota exceptions are not actual device-quota exhaustion, and an aborted browser transaction is not an OS power-loss test.

## Executed verification and repaired defects

The final full local run passed **1,911/1,911 automated tests in 195 files, zero failures and zero skips**, plus typecheck, lint, specification integrity, registry, CI-contract and build checks. [Immutable execution receipt](TEST_EVIDENCE/step5e/release-draftfix/manifest.json). A separate paired-reference rerun and selected probe run are retained separately and are not added to the unique full-suite count. PokerKit 0.7.7 reference comparisons, complete hand traces, chip conservation, rake, side pots, bot privacy, accounting and recovery are included in the executed evidence.

The first candidate full run failed eight of 1,841 tests. Its evidence remains intact. Repairs addressed export after quota/read-only failure, corruption hidden by a resident checkpoint copy, and optional-packing abort followed by an unintended second installation. A 50-session test timeout was traced by CPU profile to its reference database cloning the entire archive for every transaction; fixing that test adapter preserved record isolation, 50 sessions and the original timeout. The same test then passed in 4.347 seconds. No production integrity check was disabled.

Later browser diagnostics retained three failed test attempts: a preset selector expected a custom-only input, an unwrapped diagnostic JSON panel caused overflow, and a synthetic mixed-session fixture reassigned hand epochs after a bankroll reset. Their test-only fixes preserve the original application assertions. The application correctly rejected the invalid mixed fixture; the corrected 400-hand fixture passed actual recovery and UI checks.

## Browser evidence and release boundaries

Exact production build bytes were exercised at 320, 390 and 1,280 CSS pixels: **33 completed UI hands** across three 11-hand workflows, with legal actions, all eight archetypes, manual adjustments, top-ups, cashouts, notes, presets, history, replay, imports, filters, rapid actions and repeated reloads. The separate 66-case matrix covers mobile/tablet/desktop perimeter seating, literal stakes, min/max/raise-to amounts, all pot-size shortcuts and duplicate/stale action rejection. Its constructed states are not counted as completed UI hands.

Additional real browser executions cover native persistence (six checks), rollback (nine), accessibility labels/focus at 2/6/9/10 seats (four hands), Unknown/Random/population behavior (five scenarios), hidden-information and 100-rerender checks, secure-entropy refusal, historical configuration at 320/390 pixels, actual separate-tab ownership, and three matched hands at each of Fast and Relaxed pace. Formula/statistics fixtures contain 300+300+100+400 engine-created hands and **zero** UI-played hands; fixture timestamps do not establish hours of actual browser play.

On the final compiled candidate, actual tabs 95 → 96 → 99 exercised pending-action and post-payout close/reopen boundaries. A real tab was closed while an unpaused, durably prepared bot decision was pending, then reopened under a different tab ID. Pre-application state, decision/action token, ledger and hand hashes matched; the action committed once. A second close/reopen after payout preserved one hand and one settlement, followed by one cashout. [Raw receipt](TEST_EVIDENCE/step5e/browser-clockfix/tab-close-observed.json) and [actual tab operations](TEST_EVIDENCE/step5e/browser-clockfix/tab-close-cua-operations.json). This is not physical OS suspension or a kill during pending settlement.

Trusted keyboard input completed a heads-up hand and cashout: $10,000 starting bankroll, $200 buy-in, Hero small blind $1 then fold, $1 uncalled big-blind refund, $2 contested pot awarded to Alex, $199 Hero cashout and final bankroll $9,999. One settlement and one cashout were independently reconciled. This proves the exercised keyboard path, not a human screen-reader session or full accessibility conformance.

Public Version 7 still opens as a guest without Google sign-in. Its existing saved state was inspected without changing the user's public-site bankroll/history. Candidate improvements remain unpublished.

## Remaining external obligations

Physical iPhone Safari export remains **AWAITING USER VERIFICATION**. Use [the device procedure](tests/step5d-accessibility/DEVICE_VERIFICATION.md): complete a hand, prepare export, use Share or download/Files, reopen the JSON, confirm valid redacted records, and import it only into Study with the rights confirmation. Record iPhone/iOS/Safari versions and the actual outcome. Guest saves do not synchronize across devices.

Named physical reference-device measurements, actual screen-reader announcements, three new human testers playing 25 hands each, and complete historical Sites write-audit evidence remain external dependencies. GitHub is connected, but no authorized repository/runner for this Sites project was found; unrelated repositories were not modified. The local CI workflow and failure gate are executable, but no hosted CI run is claimed.

The opponent system remains explicitly synthetic. No independent human-data calibration, expert strategic signoff or proof of real-world poker profitability is claimed. All 302 original requirements and all 86 deferred features remain preserved, including tournaments, straddles, run-it-twice, bomb pots and additional variants.

Final original acceptance totals are **221 PASS, 0 FAIL, 5 BLOCKED and 76 NOT_EXECUTED**, across exactly 302 IDs. The five BLOCKED original criteria concern external validation outside the mandatory R1 release set; they are not silently waived human-calibration claims. The canonical register separately records **229/237 current R1 criteria qualified**. Of 230 historically effective cash PASS components, 229 are currently qualified; Z14 retains its historical status but lacks current evidence for the complete no-regression conjunction. The remaining seven mandatory originals are NOT_EXECUTED in full. Original requirement status, current candidate qualification and automated test counts are separate measures; a passing cash component does not turn the entire mixed V706 criterion into PASS.

| Mandatory ID opened at Step 5D | Final original status | Actual outcome / remaining work |
|---|---|---|
| U10 | NOT_EXECUTED | Labels, focus, keyboard and four seat-count browser cases passed; actual screen-reader announcements still required. |
| U11 | NOT_EXECUTED | Cloud measurements recorded; declared physical phone/desktop timing and trusted input measurements remain. |
| U16 | NOT_EXECUTED | Existing project identity and current writes are traced; complete historical provider write audit remains unavailable. |
| Z02 | NOT_EXECUTED | Same project and live guest site verified; historical isolation audit and signed-off candidate deployment/smoke remain. |
| Z12 | PASS | Source-linked status audit and actual release-command refusal verified; unexecuted and blocked outcomes remain explicit. |
| V513 | PASS | Actual tab closure during a pending bot decision, new-tab recovery and once-only action/payout verified. No physical OS-kill claim. |
| V518 | NOT_EXECUTED | Repeated cloud 2/6/10-seat accessibility/performance checks are partial; named-device and spoken screen-reader evidence remain. |
| V522 | NOT_EXECUTED | Local workflow and refusal controls work; no authorized hosted project repository/runner or actual CI run obtained. |
| V620 | PASS | Each linked passing critical case has source/build, applied engine/policy/rules, inputs, expected/observed, environment and artifact evidence; missing evidence blocks release. |
| V707 | NOT_EXECUTED | Three new human users must each play 25 hands with actual sizing-comprehension and misclick records. |

The final supplementary qualifier regression passed **104/104** cases. These repeat/support evidence checks and are not added to the 1,911 unique full-suite count. The release command actually exited 1 with **NOT_READY**, with no candidate/source-verification errors. The prior 55 proof gaps were investigated individually: 54 now qualify, with Z14 retained. See [canonical dashboard](R1_DASHBOARD.md), [original-ID register](ACCEPTANCE_STATUS.csv), and [current evidence work](tests/step5d-gates/REMAINING_EVIDENCE_WORK.md).


## Final-candidate corrections and retained attempts

The initial ten-player browser endurance attempt completed **99 unique hands**, although its old loop ran 100 iterations. Its raw failure is retained. A separate controlled browser reproduction established a real application defect: a quiet clock save set the controller busy without notifying the UI, so New Hand could still look enabled while its request was rejected. The controller now publishes the save lock immediately. No action queue, replay, timeout workaround or additional payout authority was introduced.

Publishing that lock exposed a second actual browser regression: disabled replacement inputs could lose their unfinished Cashier values and focus. The UI now carries unsubmitted values and focus only across the same view/decision, discarding them on navigation, deliberate focus change or a new poker decision. Actual held-save verification passed **13/13** checks covering Cashier amounts/note, setup, player notes, betting drafts, intentional navigation and unchanged financial state. The before failures remain recorded. Exact causality for the earlier 99-hand click remains unproven; the controlled save-lock reproduction is separate evidence.

Three simultaneous compiled workflow attempts and a repeated 10,000-hand recovery/audit attempt became uninspectable through the browser API. Their incomplete attempts and timeout observations are retained; an application crash, memory exhaustion or extension cause was not established. Fresh sequential workflows subsequently passed at 320/390/1280, totaling 33 actual UI hands. A ten-player screenshot also succeeded after completed diagnostic tabs were closed. These observations do not establish a physical-device performance guarantee.

Two warning-display diagnostics initially failed because their test-only download control was a button where the shared helper required an anchor. Both complete tests passed after that harness correction. A tab-close diagnostic initially omitted newly required hand identity/count arguments; its failure is retained, and the corrected complete actual close/reopen workflow passed. One old configuration diagnostic failed with an insufficiently detailed record; a stricter occupied-seat-to-public-selection comparison passed at 320/390 without claiming the prior cause was proven. No failed attempt was rewritten as PASS.

The complete corrected suite is 1,911 unique test cases. A separate 26-case browser-harness unit run passed, including repeated cases from the full suite; counts are not added. The current fixed-probe supplement passed its one selected test (3,072 simulated hands); two unrelated tests were intentionally not selected, not claimed passed. Neither simulated hands nor automated cases are original acceptance IDs.

## Final long-session resource findings

The exact controller/engine/bot/storage dependencies completed 10,000 actual controller hands across 101 sessions, 85,558 actions and 69,055 bot decisions with 10 reloads. Independent full financial/statistics replay and a separate fresh-process reconstruction of the complete archive passed. The final wallet was 98,646,795 cents with no table balance. All 10,000 settlements and 20,331 canonical records were accounted for, with a maximum of one controller timer and zero after close. The Node workload does not import the later UI module; its dependency hashes are explicitly compared to the final candidate without relabeling the original execution commit.

Preparation p50/p95/p99/maximum were **5.93 /27.39 /40.59 /10,072.24 ms**. Policy maximum was 1,718.17 ms. The immediate cleanup heap sample was 2.022 GB versus 11.4 MB baseline, and therefore did not demonstrate complete reclamation. At 10,000 hands the retained canonical JSON itself was approximately 497.8 MB. These are real limits of the measured full-history segmented-reference workload; it is separate from native IndexedDB checkpoint recovery. The final functional PASS is explicitly accompanied by **performance/memory NOT_RESOLVED**. See [complete run and limits](tests/step5b-resource/evidence/step5e-4ab9ea3/completion.json) and [independent archive reconstruction](tests/step5b-resource/evidence/step5e-4ab9ea3/archive-verification.json).

The earlier 2,000-decision fast-persistence benchmark did not reproduce a multi-second tail. It must not be substituted for the later 69,055-decision full-history workload or used to hide its 10-second maximum. The separate targeted CPU/GC results below do not establish the cause of that earlier preparation outlier.

The final compiled endurance run passed **100 distinct UI hands, 100 settlements, 99 new-hand transitions, six reloads and one cashout**, with 223 retained workflow records. Manual funding of 1,200,000 cents reconciled to final wallet 1,130,465 cents and poker loss 69,535 cents. This is additional to the 33 short-workflow UI hands; fixture hands and Node simulations are separate. The after-run accessibility-tree inspection timed out on the large diagnostic report, but the complete PASS download was preserved and independently verified. No 100-hand INP or physical-device responsiveness claim follows. [Full trace](TEST_EVIDENCE/step5e/browser-clockfix/stress10-PASS.json).

One completed final-candidate hand is `hand-d0b0cda819e18be90c5b2d90a330482d`: heads-up $1/$2, Hero calls the additional $1 and BB checks; 7h8cQc flop checks through; 5c turn, BB bets $3 and Hero calls; Qh river checks through. Seat 1 receives the $10 pot, rake $0, Hero result −$5, exactly one settlement. The [320px trace](TEST_EVIDENCE/step5e/browser-clockfix/compiled-320-PASS.json) records the exact public actions and rule fingerprint.

The final 10,000-hand native-browser recheck passed on the actual final runtime: **2.2205 s** from mount to verified safe gameplay (**2.3731 s** from navigation), 42.7645 s separate first installation, 40.6623 s explicit older-history load and 39.8127 s separate full audit. Maximum startup Long Task 720 ms, audit Long Task 1,127 ms. The coarse ready heap 1.469 GB and sampled peak 2.588 GB include fixture preparation/renderer residue and do not establish isolated application retention. This was a fresh document with completed diagnostics closed, not a forced-cold process or physical device. The earlier incomplete concurrent attempt remains retained. [Full final measurement](TEST_EVIDENCE/step5e/browser-clockfix/recovery-10000-final-PASS.json).

A targeted 500-decision CPU/GC diagnostic passed 77 new hands and 4 full reloads. Preparation p50/p95/p99/maximum were 4.48/24.59/36.34/52.44 ms, so it did not reproduce or explain the original 10.072 s preparation sample. It measured a 66.61 s legacy full-history reload, including a 30.37 s transport-freezing interval with 3.74 s overlapping GC. This explains measured full-replay recovery work, not the untraced earlier preparation event. A reused deterministic seed initially collided with an archived hand; the guard rejected it before commit with identical manifest, revision, ledger and funds. That failed diagnostic is retained separately from the corrected-seed run.

A further no-profiler heap-retainer probe showed the full data, hand array and record map collected after scope exit, while the module’s private `frozen` WeakSet retained a 128 MiB backing table. This is confirmed cache-capacity retention in Node 24, not proof of an unbounded object leak or attribution of all 586 MB in the instrumented run. The next performance change should bound or scope this immutable-data memoization while preserving descriptor validation and private trust boundaries; trusting Object.isFrozen would weaken the private trust boundary, while discarding all memoization on each action would repeat expensive traversal. [CPU/GC evidence](tests/step5e-performance/resource-tail-evidence/analysis.json),[heap-retainer proof](tests/step5e-performance/resource-cleanup-evidence/analysis.json).

## Evidence provenance and remaining release actions

The metadata supplement reran the relevant original assertions and captured the rules/profile actually applied to each case, including retained historical policy versions. It did not assign one current policy version to all old records. The final narrow browser reruns covered native recovery, rollback, three statistics fixtures, two uncertainty displays, persona selection, resources, separate-tab ownership and entropy refusal. These are repeated evidence checks, not additional unique cases in the 1,911-test total.

The two uncertainty-display records were copied from the rendered diagnostic JSON. The small-sample diagnostic download event timed out twice; those attempts are recorded in `TEST_EVIDENCE/step5e/browser-provenance/capture-methods.json`. No successful diagnostic download or physical mobile export is inferred from those captures.

The exact next technical work is to instrument the rare preparation tail at its full execution boundary and bound the confirmed immutable-data memoization capacity without weakening descriptor checks. Recheck the complete Z14 no-regression criterion against matched workloads, including small-history startup, full-history loading, storage growth and peak memory. Keep essential financial validation before play.

The external release work is concrete: obtain the provider's historical project-write audit; designate an authorized hosted repository/runner and execute its failure-blocking workflow; run named-device and screen-reader checks; and recruit three new users for 25 observed hands each. Do not substitute automation for those people or devices. A signed-off candidate deployment and guest smoke must follow all prerequisite gates.

For physical iPhone export, record the **actual version tested**, iPhone model, iOS and Safari. Complete a hand, open History, prepare its redacted export, use Share → Save to Files or Download JSON, reopen the saved JSON and inspect its hand count and permitted cards. Import it only as a Study copy with the rights confirmation; confirm wallet, poker results and canonical history are unchanged. Record each outcome and any fallback needed. The current public URL serves Version 7; it does not verify this unpublished candidate. Candidate device testing needs an explicitly identified review environment. Status remains **AWAITING USER VERIFICATION**.

All 302 original IDs/criteria and 86 deferred entries are preserved by the executed hash check. The current-ID annotation records separate original statuses and current-source qualification; it does not rewrite the frozen automated execution receipt. This remains an unpublished candidate, not a release approval.

The source host rejected the 39.6 MiB compressed heap diagnostic at its 32 MiB per-file limit. The same bytes are now retained as five checksum-verified parts, with an executable reconstruction tool. Only unpublished diagnostic-containing ancestry was rewritten; the tested runtime and build bytes are unchanged. The exact original source objects and old/new mapping are also archived, so execution receipts keep their original IDs. See [lossless diagnostic and original-source restoration](tests/step5e-performance/source-preservation/README.md). This is a packaging correction, not a new application test or a deployment.
