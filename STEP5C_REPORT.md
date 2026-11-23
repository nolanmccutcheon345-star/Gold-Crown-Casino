# Step 5C — recovery, rollback and R1 release evidence

**NOT READY FOR R1. Do not deploy. Version 7 remains the public release.**

Existing project: `/workspace/sites/ai-texas-hold-em`, Site `appgprj_6ae62e96ac688191bffc3c629e66a5b0`, https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ . Saved Version 8 source `f54cacfb0aa3c861313b691e773a6716379c50a0` remains an ancestor. The final executed production-code checkpoint is **`c71e63289635fa256cd93ba948e66a2bcbf7b222`**. Later commits contain test evidence, QA helpers and reports; they do not change production code. The saved candidate's native version number and exact pushed commit are reported after the Sites save succeeds. Saving does not publish.

All **302 original acceptance requirements** and **86 deferred features** remain preserved, including their exact IDs and criterion text. Four governing PDF hashes and both original-register hashes pass `scripts/check-spec-integrity.mjs`. No Poker MaxEV project was opened or modified during this work. A complete retrospective audit of earlier project writes is not fabricated.

## Implemented changes

| Production components | Actual change |
|---|---|
| `src/storage/integrity.ts`, `verified.ts`, `segments.ts` | Eliminate a duplicate full audit only for the exact privately branded immutable snapshot; native SHA256 where available with byte-identical fallback; bounded key encoding; lower-allocation freezing; bounded reads; complete canonical, financial and session validation retained. |
| `src/storage/recovery-scheduler.ts` | Yield between checked records using measured new background tasks, then MessageChannel/timer fallbacks. No artificial bot delay, early gameplay, omitted check or arbitrary verification timeout. |
| `src/storage/rollback.ts`, `browser.ts` | Exact pre-upgrade snapshot and independently verifiable migration receipt committed atomically with the new manifest/segments; idempotent interrupted-upgrade recovery; read-only backup inspection. |
| `src/session/controller.ts` | Reuse verified recovery provenance without reauditing; emit quiet-save completion so controls cannot remain disabled after a clock write. |
| `src/session/bot-observation.ts` | Separate bounded freezer for disposable allowlisted public-memory projections. Bot information boundaries and policies remain unchanged. |
| `src/stats/projection.ts`, `src/ui/async-cash-stats.ts`, `app.ts` | Cooperative cold statistics using the same validation and aggregation algorithms; publish a complete result atomically. Show calculating/unknown rather than partial totals. Cancel replaced histories; include appended tails; reuse identical references on ordinary renders. |
| UI accessibility/disclosure modules | Persistent public turn/board/payout/recovery announcements, focus preservation, skip link, complete rank/suit labels, reduced-motion support, explicit offline-practice/no-RTA disclosure, import-rights confirmation and preserved pasted JSON drafts. |

**Engine 0.4.0 and synthetic policy 1.6.0 are unchanged.** No chip, card or settlement authority moved into UI, projections or bots. Old policy versions remain readable and are not resampled or rewritten.

Independent review found and repaired: missing zero-net settlement/history pairs; symbol accessors escaping rejection; transport aliases changed after asynchronous hashing. A real browser reproduced the quiet-save disabled-control defect four times, then verified four passing repairs. Full-suite failures also caught a dropped storage error name; that repair and the original failure receipts are retained. See [observed defects](TEST_EVIDENCE/step5c/DEFECTS.md) and [independent review](tests/step5c-independent/REVIEW.md).

## Cold recovery: actual costs and remaining limits

The original 10,000-hand Node profile spent approximately 2.20s reading/parsing, 10.34s hashing outer segments, 8.13s freezing and 22.82s in two full canonical/financial audits. CPU samples identify canonical serialization, freezing and hash compression, with garbage collection also material. This is not bot-policy computation. The application uses vanilla DOM; React hydration is not applicable.

The final Node profile still spends 10.22s in one full audit, 9.17s hashing hand segments and 5.86s freezing transport records. The freeze moved to the hash boundary to prevent retained-object mutation; it is reused later. Nested stage timers must not be added twice. Full canonical history remains readable and auditable, not replaced with an unverified persisted summary.

| Saved hands | Node baseline → measured candidate, seconds | Native Chromium baseline → final scheduler, seconds |
|---:|---:|---:|
| 0 | 0.0023 → 0.0036 | 0.013 → 0.017 |
| 100 | 0.169 → 0.074 | 0.226 → 0.176 |
| 500 | 2.038 → 1.021 | 3.114 → 2.176 |
| 1,000 | 3.814 → 2.278 | 6.561 → 4.870 |
| 5,000 | 21.520 → 11.934 | 35.668 → **45.340; fresh repeat 17.986** |
| 10,000 | 43.558 → 27.169 | 70.946 → **40.324** |

These are **single cold observations**, except the two disclosed final 5,000-hand observations; they are not p50/p95/p99 estimates. The Node reference keeps serialized strings and application objects in memory and uses native SHA. The browser uses Chrome155/Linux, actual isolated IndexedDB and HTTP SHA fallback. The same hash-preserving canonical archive subsets end at closed-session boundaries. Setup/fixture extraction is timed separately. No physical-phone or secure-HTTPS throughput inference is made. Node measurements pin `4ba7c03`; final browser scheduling pins `c71e632`. The last scheduler change does not run in the Node reference environment.

The final 10,000-hand maximum observed browser long task was **495ms versus 53,154ms** in the baseline. The final 5,000-hand fresh repeat was **212ms versus 26,180ms**. These are not INP measurements and do not prove every interaction stays below 250ms. The earlier 5,000-hand run's 45.34s recovery and 7.36s heartbeat gap remain recorded. An automation wait timed out during that run; its causal contribution is unproven. We do not discard it or label it GC without a browser CPU trace.

A measured intermediate timer-yield version removed blocking but regressed 10,000-hand total recovery to74.78s. A separate browser diagnostic measured4.1ms median overhead per timer yield versus approximately0ms for new background tasks, with responsive timer heartbeats. The final scheduler was selected from those measurements and then exercised on the full canonical dataset. Both intermediate and final results remain available.

**The cold bottleneck is not eliminated.** Forty-second recovery, historical memory demand, remaining latency variability and full-history work are significant limitations. The10,000-hand archive contains approximately481.5MB of canonical serialized storage. Browser heap observations and native/reference GC samples are retained; fixture/reference duplication means those values are not physical-device capacity claims. Normal startup no longer audits the same verified snapshot twice or blocks in one monolithic statistics loop, but still verifies every required historical record before gameplay.

Evidence: [Node comparison and CPU profile](tests/step5c-recovery/evidence/final-release/comparison.json), [native-browser comparison](TEST_EVIDENCE/step5c/browser/recovery-summary.json), individual `step5c-cold-*` JSONs, [recovery design and safeguards](tests/step5c-recovery/RECOVERY_REPORT.md), [scheduler measurement](tests/step5c-recovery/YIELD_REFINEMENT.md).

## Rare preparation stall

The original9.79s observation had no contemporaneous CPU/GC trace and **remains unattributed**. It did not recur in four matched5,000-preparation workloads: **20,000 instrumented preparations** total. The measured public-memory freeze deficiency was repaired; no policy was changed to improve timing or force calls.

| Node preparation latency, 5,000 samples/run | Original V8 | Latest instrumented runtime |
|---|---:|---:|
| p50 | 5.11ms | 4.02ms |
| p95 | 25.75ms | 25.02ms |
| p99 | 33.43ms | 31.27ms |
| Maximum | 851.30ms | **750.62ms** |

The intermediate bounded-freezer run's maximum was570.96ms; the later750.62ms result is retained, not hidden. Its CPU samples include642.53ms GC and75.77ms evaluator self-time. The original public-memory path took845.34ms without overlapping GC; after the bounded-freezer repair the earlier matched run's public-memory maximum was7.68ms. The latest reference loop maximum was759.17ms. Node GC instrumentation and browser long tasks measure different things.

Every run produced703 new completed hands,10,703 total hands,10,990 ledger events and21,917 commits, with the same seat/street opportunities, wallet98,549,380c and Hero table funds20,300c. Full independent accounting, full-replay versus incremental statistics, pending-decision restoration and stale-action rejection passed. That table amount includes committed chips where applicable; it is not a claimed cashout amount. The original once-in-roughly68,000 observation is too rare to be excluded by5,000 final samples.

Evidence: [stall report](tests/step5c-stall/STALL_REPORT.md), [latest raw run](tests/step5c-stall/evidence/release-final/report.json), [CPU attribution](tests/step5c-stall/evidence/release-final/cpu-summary.json), [endpoint comparison](tests/step5c-stall/evidence/release-final/matched-endpoints.json).

## Migration and rollback

**Nine actual native-browser checks passed** using populated real V7 saves, interrupted migration, post-upgrade hands/top-ups/cashouts/manual adjustments, a pending1.6 decision, an older-code refusal and current-code resumption. The exact backup and receipt are verified, not merely present. Abort publishes none of the transaction; retry commits once. Unknown schema99 fails without overwriting data.

The tested emergency artifact is explicitly **V7-R**: exact published V7 UI plus the frozen, tested Version8 runtime from`f54cacfb`. Its manifest pins95 source files. It preserves newer records and pending policy versions, completes legal actions and cashout, and can return to the candidate without losing post-upgrade hands. It is **not unchanged V7, a schema downgrade or a cure for arbitrary corruption**. It reintroduces Version8's cold-recovery costs and historical interface limits. A defect also present in that frozen runtime needs a separately repaired recovery build.

No production-data migration or rollback deployment was attempted. Follow the [tested deployment/rollback procedure](tests/step5c-rollback/README.md); never overwrite current records with the older snapshot or claim redeploying unchanged Version7 is sufficient. Evidence: [native rollback execution](TEST_EVIDENCE/step5c/browser/rollback-release.json), generated pinned recovery artifact and full regression receipt.

## Executed verification

- Full suite at`c71e632`: **1,363/1,363 passed,153 files,0 failures,0 skips**, with PokerKit0.7.7 comparisons,20,000-hand accounting batch, complete engine/rake/side-pot, hidden-information, policy/idempotence, statistics, migration and recovery suites enabled. Specification integrity, typecheck, lint and production build passed. [Execution receipt](TEST_EVIDENCE/step5c/integrated-final-candidate/manifest.json).
- Two additional independent scheduler failure tests passed after that full run; the independently executed combined queue/recovery/statistics review passed64/64. These overlapping targeted counts are not added to the full-suite count or to302 acceptance IDs.
- Independent recovery/async-statistics review passed122/122 before the scheduler refinement. Earlier failed fixtures and repaired defects remain in evidence; no assertions were removed to obtain a green result.
- Browser100-hand run on`3307a9f`: **100 hands and100 settlements**, exact pending and post-payout reloads.37 hands started with10 funded players,63 with9 after natural bust-outs. No invented refills. Preparation p95 was113.6ms for the first50 hands and74.0ms for the second50; actual preparation includes persistence and excludes intentional think-time. It is not a matched causal estimate of history-size effects. [Full evidence](TEST_EVIDENCE/step5c/browser/endurance-100-before-prewarm.json).
- Complete real cash workflow:20 passing checks spanning quick start, named/sparse presets, queued rules, interrupted-bot reload, showdown, next-hand rule application, rake-only changes, replay/export/study import, repeated safe exits and9→6 new sessions. [Evidence](TEST_EVIDENCE/step5c/browser/cash-workflow.json).
- Native quota/lost-ack/stale-ownership checks:7PASS. Actual separate browser tabs: concurrent old writer fenced, new writer commits once, one settlement, exact recovery. [Storage evidence](TEST_EVIDENCE/step5c/browser/resource-final.json), [two-tab evidence](TEST_EVIDENCE/step5c/browser/two-tabs-final.json).
- Accessible-controls/rights/export workflow:4/4PASS at2/6/9/10 seats; actual redacted JSON and study-only import, persistent announcements, focus, quiet-save completion. Notes:3/3PASS at2/6/10 seats, including failed-write recovery and pending-bot protection. These are browser functional checks, not physical VoiceOver evidence.
- Exact production-bundle bytes were independently compared with the executed build hashes before loading through typed Blob URLs, avoiding Vite's HTML instrumentation. Keyboard Tab/Enter traversed navigation and submitted actions. Manual bankroll10000→12000 remained a2000 adjustment, with poker result0 before play. In the played1/2 heads-up hand, Hero8dQs posted1 and folded; Alex's unmatched1 returned and2 pot awarded. Hero199 cashed out once. Reload showed wallet11999, table0, poker−1 and one saved hand. [Built-artifact evidence](TEST_EVIDENCE/step5c/browser/built-workflow.json). This run pins the earlier verified56800d6 artifact; the final artifact smoke is recorded separately.
- The deployed Version7 guest site was actually opened without Google authentication, a hand completed, cashout performed and reload checked. It remains unchanged. [Live guest evidence](TEST_EVIDENCE/step5c/browser/live-guest.json).

Final-candidate browser play additionally completed **25 hands with all10 seats funded at each deal**,25 settlements, exact pending-decision and post-payout reloads. Its two preparation batches contained185 and167 samples, p95=123.4/77.7ms and maxima147.5/105.1ms. This final25-hand run is separate from the earlier100-hand run. [Evidence](TEST_EVIDENCE/step5c/browser/endurance-final25.json). The final runtime also passed35portrait/desktop and15landscape/tablet layout cases,3populated-statistics display checks and an additional exact-compiled-artifact hand/cashout/reload smoke. [Browser execution index](TEST_EVIDENCE/step5c/BROWSER.md) lists exact runtimes, hashes, failed attempts and screenshots. The final compiled hand restored wallet9999, table0, poker−1 and exactly one policy-versioned record. No executable harness, authored test or planned check is counted as a PASS before its result exists. No physical iPhone/Safari export, OS kill, actual screen-reader session, hosted CI or new-user study is claimed.

## Exact original acceptance statuses and release gates

Canonical source: [all302 original rows](ACCEPTANCE_STATUS.csv). Generated [R1 dashboard](R1_DASHBOARD.md) and [requirements view](R1_REQUIREMENTS.csv) preserve that universe.

**217 PASS /0 FAIL /5 BLOCKED /80 NOT_EXECUTED.** The237 release-critical original rows contain217PASS and20NOT_EXECUTED. Nine explicitly authorized mixed cash components are verified; those are **not nine additional original PASS requirements**. The executable release check correctly exits nonzero with **11 unresolved mandatory gates**. [Actual release-check output](TEST_EVIDENCE/step5c/release-gate.txt).

| Original remaining-at-start ID | Current disposition |
|---|---|
| F10 | NOT_EXECUTED/partial:8,192 fixed river decisions support limited synthetic findings; broader held-out dangerous-board accuracy remains unproven. |
| U10 | NOT_EXECUTED/partial: keyboard, labels, focus and DOM announcements verified; actual supported screen reader remains. |
| U11 | NOT_EXECUTED/partial: cloud timing available; named physical phone/desktop responsiveness and remaining cold/stall issues remain. |
| U16 | NOT_EXECUTED/partial: current unique project identity proven; complete historical all-write nonmutation audit unavailable. |
| Y10 | OriginalNOT_EXECUTED; **R1 cash component PASS**.800 continuous hands, carry-forward stacks,55 engine top-ups, composition/sizing and full-hand inspection. Original scenario's churn is explicitly FUT032/V7§9. No new deferral or invented expert requirement. |
| Z02 | NOT_EXECUTED/partial: initial identity/deploy/browser evidence exists; historical old-project nonmutation proof still incomplete. |
| Z03 | **PASS** through the tested V7-R controlled compatible recovery, with limitations above. |
| Z12 | NOT_EXECUTED/partial: actual execution receipts and fail-closed gate exist; complete critical-result→qualified-evidence mapping remains. |
| V436 | **PASS**: practice/no-real-money/no-RTA disclosure and rights-confirmed, study-only ingestion verified. |
| V513 | NOT_EXECUTED/partial: exact browser reload/recovery tested; actual mobile OS suspend/kill remains. |
| V518 | NOT_EXECUTED/partial: cloud timing/memory/error/layout evidence; named devices and screen reader remain. |
| V522 | NOT_EXECUTED/partial: local gates execute; hosted CI has not run. |
| V620 | NOT_EXECUTED/partial: current per-case/build/fixture receipts exist; all effective critical evidence is not yet joined to qualified receipts. Historical archives need not be relabeled, and current hashes cannot be assigned retroactively. |
| V707 | NOT_EXECUTED: three actual new users must each play25 hands and record sizing ambiguities/misclicks. |

V706 remains **originalNOT_EXECUTED / cash componentPASS**; deferred straddles are not claimed complete. All18 earlier Step5A R1 cash feature gaps retain their Step5B evidence; V706’s whole mixed criterion remains unexecuted. The five BLOCKED original rows are R18,R19,Y03,Y04,Y05: external human calibration/licensed evaluation dependencies, not required claims of this synthetic cash release.

The river diagnostic's strong-profile modeled advantage was+192.07c across48 fixed situation/range cells;33 positive and15 negative. Its eight-board-cluster descriptive interval crosses zero. Neither those numbers nor simulator winnings establish human calibration, expert review, solver verification or real-world profitability. The original0/30 exploit observation remains a research finding; no arbitrary calling quota was imposed.

## Next implementation and device participation

The next technical task is a measured, independently verifiable indexed/worker recovery design that reduces large-save canonical serialization and resident history demand while retaining current-session/ledger verification before actions. Do not simply trust a cached summary. Preserve the full independent reconciliation path and cloned populated-data migration/rollback tests. Investigate the remaining cold variability and rare GC/preparation tails with retained traces.

In parallel, finish effective critical-evidence mapping and hosted CI; obtain actual screen-reader, named-device, OS-interruption and three-user evidence. Physical iPhone export is **AWAITING USER VERIFICATION**. Exact separate instructions are in [IPHONE_VERIFICATION.md](IPHONE_VERIFICATION.md). Tests performed on published Version7 do not verify this unpublished candidate.

**Do not publish until every mandatory gate passes.** No tournaments, run-it-twice, bomb pots, new variants or extra personality expansion were added or removed.
