# Step 5B implementation and release evidence

**NOT READY FOR R1. Version 7 remains published.** Existing project: `/workspace/sites/ai-texas-hold-em`. Public site: https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ . No replacement Site or Poker MaxEV work was performed.

## Measured root cause and optimization

V8 CPU profiles and instrumented production controller calls confirmed that each bot preparation repeated two full canonical-history clones, two full integrity replays and two retry-buffer clones. Browser persistence also hashed/copied/serialized the entire snapshot twice. These operations scaled with all saved hand frames even when one current action changed. Policy evaluation was a small component of the measured preflop workload. This application uses vanilla DOM rendering, not React; there is no React profiler result.

The fix uses privately verified immutable canonical prefixes, structurally shared snapshots, incremental financial/statistical projections, bounded public-opponent summaries and append-only IndexedDB history/event/session segments. A compact manifest is committed atomically with ownership/revision checks. New events and affected engine state are still verified on every transaction. Full audit remains mandatory on load, recovery, migration, takeover, retry and imports. Frozen objects or caller-supplied hashes cannot grant trust. Unknown future formats fail without erasing data. Legacy history and policy dispatch are preserved.

### Matched actual-browser timing

Chromium 155, Linux cloud browser, same 100-hand canonical fixture, six occupied seats, 20 preparations per implementation, no intentional bot think delay. Fixture hash and raw samples: [browser performance evidence](TEST_EVIDENCE/step5b/browser/performance-100-six-final.json). The frozen reference snapshot uses policy 1.3 on both sides to avoid conflating strategic changes with storage performance.

| Bot preparation | p50 ms | p95 ms | p99 ms | Maximum ms |
|---|---:|---:|---:|---:|
| Before | 612.9 | 643.2 | 648.1 | 648.1 |
| After | 6.7 | 28.5 | 29.2 | 29.2 |

The timed baseline window recorded 40 browser long tasks (p95 273ms, max279ms); the candidate window recorded zero. Candidate stage p95: policy1.2ms, transaction3.7ms, commit4.2ms, segment preparation0.6ms. This is not a measured INP score, physical-phone result or guarantee for every cold-load workload.

### History-size and player-count matrix

All 15 paired Node cells ran at 0/100/500/1,000/5,000 saved hands × 2/6/10 current seats. Exact p50/p95/p99/max, CPU profiles, corpus construction, sample sizes and separate range/history/statistics/serialization costs are in [PERFORMANCE_5B.md](tests/step5b-performance/PERFORMANCE_5B.md). At100hands/6seats Node p95 was258.40→1.04ms (N20). At5,000hands/10seats the observed preparation was14,891.28→8.05ms (**N1**, not a reliable tail estimate). All measured hot-preparation cells were below250ms.

The5,000-hand corpus contains152.7MB of canonical frames. Full cold integrity audit still took3,426.55ms, serialization624.02ms and full independent statistics391.97ms. Those costs were not disabled or disguised. A5,000-hand browser reference attempt became unresponsive and supplied no valid paired timing; large-history cold recovery and lower-powered-device responsiveness remain limitations. Cold postflop policy profiling separately used30samples per2/6/10-seat flop/turn/river cell; the largest observed whole-policy p95 was36.44ms. No sampling budget was reduced for performance.

## Cash functionality implemented

- Separate table capacity and occupied seats; editable seats between hands; one-click live $1/$2; immutable named preset save/load/clone; custom stakes, buy-ins and opponent settings.
- Pot-fraction raise-to controls account for prior contribution and call cost; min/max, short all-in, explicit confirmation and stale/double-click protections; mobile numeric input remains legible.
- Explicit versioned rake profiles and dealt-in-player caps; pending rule/settings changes take effect at safe hand boundaries and preserve old records.
- Actual elapsed-hour results separated from hypothetical hands/hour projections; independent opportunity denominators, confidence/sample disclosures and session/stake/rule breakdowns.
- Conditional draw-response editor affects only configured profile/class/street contexts; stable policy versions and historical dispatch remain supported.
- Study-only partial import preview, immutable original hashes, explicit atomic local-data reset/reinitialization, manual player notes isolated from finances and bots, and ended-session opt-in designed-style information.
- Immutable per-session/per-hand configuration boundaries record population, original public Host selections, rules/rake/policy versions and exact results. Legacy metadata stays explicitly unknown;320/390px browser checks preserve old hashes and financial totals.
- Fail-closed guards retain unsupported variants as unavailable; no hidden settings/URL flags enable them. All original future features remain in the86-item register.

### Original18 failed criteria

No original ID, wording or criterion was changed. Full original text, evidence, ownership and next action are in [R1_DASHBOARD.md](R1_DASHBOARD.md).

| ID | Requirement | Resolution |
|---|---|---|
| D02 | 10 seats, 6 occupied including Hero | PASS |
| D08 | Reconfigure seat between hands | PASS |
| D10 | Clone named preset and modify rake | PASS |
| G04 | +10 bb/100 projected at 30 hands/hour | PASS |
| U01 | One-click live $1/$2 preset | PASS |
| U04 | Quick bet presets | PASS |
| U09 | Preset custom save/load | PASS |
| X09 | Correct published online rake profile (versioned) with changing number of dealt-in players | PASS |
| X10 | 300 simulated hands/hour played in fast mode, $1/$2, 30-hand/h assumption | PASS |
| V408 | Raise-to pot-fraction with prior street contributions | PASS |
| V414 | Rake cap depends on number dealt in | PASS |
| V421 | Node-opportunity denominators | PASS |
| V432 | Draw-price profile editor actually affects behavior | PASS |
| V505 | Bet control equivalence including nonzero commitment | PASS |
| V608 | Opponent editor independent conditional effect | PASS |
| V612 | Large bet mobile preview and double input | PASS |
| V613 | R1 statistical honesty actual vs hypothetical pace | PASS |
| V706 | Rule-profile freeze across in-progress hand | Cash component PASS; original NOT_EXECUTED (explicitly deferred straddles) |

## Additional bot defects found and repaired

The original strong-regular0/30 pressure result remains a documented policy research finding; no minimum calling quota was introduced. Two separately reproduced numerical/strategic approximation defects were investigated during Step5B:

1. Changing a price by one cent resampled unrelated Monte Carlo deals, obscuring the price response. Policy 1.5 uses common random samples keyed to permitted cards/public line topology, while posterior prices and cache keys still change. Held-out price pairs and exact turn enumeration provide separate evidence.
2. A draw facing a wager2999c versus3000c at a3000c effective stack received abruptly different realization/future-cost assumptions. The one-cent-left and fully-all-in states had almost identical prices but very different continuation probabilities. Policy 1.6 weights future exposure by remaining effective chips divided by remaining effective chips plus currently eligible pot. In the original stronger-regular fixture continuation is now32.2977%→32.2855%, preserving the former exact-all-in endpoint. Independent168 held-out triples/8,064 proposals passed;84 exact all-in/river comparisons retained prior distributions. The worst held-out one-cent defense delta was0.001114. See [boundary report](tests/step5b-exposure/REPORT.md). Policy 1.5 is frozen byte-exact for historical sessions; no existing canonical record is rewritten.

Current1.6 independently authored reference agents completed4,032 held-out hands/44,598 legal actions in42 cells; another1,344 paired hands isolated rake and lineup sensitivity, and96 self-play hands completed. Full actions, outcomes, opportunity counts and block intervals are in [current benchmark evidence](tests/step5b-acceptance/evidence/current-benchmark-5069ea8/README.md). Losses are retained: aggressive nine-max250BB versus overbluff averaged−0.531BB/hand (eight-block95%interval−0.909 to−0.238);42comparisons and rare heavy tails limit interpretation. Separate exact-reference checks covered27,000 stratified legal proposals, including nuts and explicitly declared catcher EVs. No policy was tuned to these benchmark outputs.

These remain explicitly synthetic approximations, not solver-verified or measured-human calibration. Winning or losing simulated money is not evidence of real-world profitability.

## Actual browser verification

Raw reports and screenshots are in [TEST_EVIDENCE/step5b/browser](TEST_EVIDENCE/step5b/browser).

| Executed workflow | Observed result / boundary |
|---|---|
| Full cash setup/session workflow |20PASS reports,5completed hands; named preset cloning, sparse seating, queued rule/stake changes, exact pending reload, repeated6↔9sessions, redacted export and study-only import.|
| Responsive seating |35/35 cases:2/3/6/9/10players at320/360/375/390/430/768/1280px. Actual6/9/10 screenshots retained.|
| Legal controls |40/40 interface cases across2–10players, mobile/desktop, custom stakes, sidepots, closed raising and short all-ins. Native Tab/Enter committed one legal action. Screen-reader use remains unexecuted.|
| Statistics and pace |300canonical-hand formula fixture and100station engine hands displayed in actual UI; Fast/Relaxed3hands each share exact outcome digest while actual elapsed-hour results differ. Hypothetical pace changes do not change actual results.|
| Continuous100 UI hands |100canonical hands and100unique settlements independently reconciled;6 midpoint pending reloads passed. Final large QA report rendered the old harness unresponsive, so second-half UI timings were not recovered. Compact reporting fixed the harness; read-only recovery cannot reconstruct lost timing observations.|
| Populated migration/recovery |9PASS actual IndexedDB/popup checks for schemas2/3/4, aborted writes, lost acknowledgements, ownership, backup restoration and future-format refusal. Production user saves untouched.|
| Storage failures / multi-tab |7PASS quota/lost-ACK/ownership checks plus7PASS literal second-tab concurrent poker reports: oldwriter fenced, exactlyoneaction/settlement, same recovered digest.|
| Notes/privacy |4PASS actual UI checks: manual creation, pendingbot exactdecision, draft/focus/caret through realbotcommit, failure/retry, reload, plaintext XSS protection, export exclusion and deletion.|
| Persona privacy |5PASS reports covering6hands, Unknown/Random labels, all8DESIGNED archetypes, activeLive privacy and opt-in ended-session disclosure only.|
| Currentpolicy 1.6 |25 actual UI hands,all 10 occupied,12 PASS reports,25 settlements,two exact pending/post-payout reloads. Combined365 preparations:p50 29.3ms/p95 61.8ms/p99 82.3ms/max95.4ms;0 runtime long tasks.3,594 UI renders:p95 5ms/max23.1ms. Originalrawsamples and [quantiles](TEST_EVIDENCE/step5b/browser/current16-quantiles.json) retained. This is a different mixed-street workload, not the paired100-history reference. |
| PublishedVersion 7 guest |Actual public guest hand and cashout passed withoutGoogle. Hero folded$1SB; opponent received$1uncalledreturn+$2pot. Hero$200→$199table; cashout once. Wallet$2500.50→$2499.50, savedhands6→7, cumulative result+$0.50→−$0.50.|

The100 UI hand run used policy 1.5; it must not be represented as100hands of later1.6. Physical iPhone Safari export remains **AWAITING USER VERIFICATION**. Automated redacted JSON/copy/import checks pass; automated download-event capture did not establish physical download delivery. Exact manual steps are in [IPHONE_VERIFICATION.md](IPHONE_VERIFICATION.md).

## Completed resource stress and remaining bottleneck

[RESOURCE_REPORT.md](tests/step5b-resource/RESOURCE_REPORT.md) records10,000 actual controller/engine hands,101 sessions,67,982 policy 1.5 decisions and230,586 durable transitions. Full and incremental financial/statistical calculations agreed at every checkpoint. All10,000 settlements were unique. The final archive retained every canonical hand and was independently restored. The final integrated source restored the same archive again in39.29seconds, with identical SHA256,10,230 financial events,101 sessions,98,640,349cwallet andzero seated balance.

Full-run preparation p50/p95/p99/max was7.36/23.82/31.55/9,791.03ms. The9.79secondoutlier remains unattributed; aCPU/GC-profiled60decision repeat did not reproduce it (max44.75ms). Cold10k initialization/reloads took42.14/43.04/56.09seconds. Across that profile canonical serialization consumed44.41s,self deep-freeze35.81s,SHAcompression25.06s; GC overlapped only3.9–7.0% of recovery windows. Six full audits across three loads expose duplicated recovery validation. No mandatory validation was disabled.

The Node reference retains serialized records and application objects together; its481.49MBstorage,1.64GBGC-normalizedheap at10k and~554MBquiescent residualheap do not measure browser/mobile memory or prove a leak. Caches and timer/listener counts stayed bounded; residualretainers need classification. The next measured performance task is to remove duplicate verification of the same proven immutable load, inspect heap retainers, and move/schedule full cold recovery off the main thread while retaining complete canonical validation.

Actual archivedVersion 7 staging gave7/7 checks PASS, including cleanup:3old+3newhands and22 events survived migration,downgrade refusal andexactcurrent recovery. Version 7 cannot run the newer schema/policy. Safe refusal is not a working rollback; wholeZ03 remains unsatisfied. No production saves were modified.

## Acceptance accounting and release decision

[ACCEPTANCE_STATUS.csv](ACCEPTANCE_STATUS.csv) is the only mutable original-ID status registry; other dashboards are generated and checked. Step5A's120cashPASS included six mixed cash/tournament partial components while overall114PASS used whole criteria. There were no duplicate IDs. Correct same-status baseline totals were114/18/5/165 overall and114/18/0/105 in the237critical-original-row subset. Separate explicitly governed cash-component evidence no longer inflates original PASS counts.

Tournament and explicitly deferred clauses remain assigned later without excusing mandatory cash features. Original source hashes, criterion text and order, and all86future IDs are checked. The runnable release gate fails on real required failures, blockers or unexecuted checks. External expert/human-calibration claims remain distinct from mechanical/synthetic evidence.

## Final verification addendum

The complete integrated suite at source checkpoint `d5f2aef` executed **1,263/1,263 tests in138files, zero failures/skips**, with `RUN_ORACLE=1` and `RUN_ACCOUNTING_BATCH=1`. Raw results and exact command/source/build hashes: [final-pass/manifest.json](TEST_EVIDENCE/step5b/final-pass/manifest.json) and [vitest.json](TEST_EVIDENCE/step5b/final-pass/vitest.json). Included independent PokerKit comparisons and the20,000-hand accounting batch passed. Typecheck, lint and the production build passed. The536.48kB minified/182.61kB gzip main bundle triggers Vite's existing500kB warning; its threshold was not relaxed.

The earlier integrated run had1,244PASS/17FAIL. Failures exposed a manual test fixture missing the new configuration boundary, legacy-fixture metadata that did not exist in historical versions, changed rejection-message precedence, and a generated dashboard that needed new evidence links. A follow-up also found an exact full/incremental BB/100 rounding mismatch. That calculation now aggregates integer cents before division; exact equality assertions remain. All initial failures are preserved under [final-integrated](TEST_EVIDENCE/step5b/final-integrated); none was silently relabeled PASS.

The final release-status check is recorded separately below. All original302criteria and86deferred features remain unchanged. No remoteCI, screen-reader, physical-device or measured-human validation is claimed. Publication remains withheld. The current tested production sources are preserved in Git and the existing Site source repository; saved-version identity is reported in the native save receipt.

## Final original-ID counts and release blockers

| Universe | PASS | FAIL | BLOCKED | NOT_EXECUTED |
|---|---:|---:|---:|---:|
| All302original requirements |215|1|5|81|
|237R1-critical original rows |215|1|0|21|

Eight explicitly governed mixed requirements have separately verified cash components; they remain NOT_EXECUTED as whole original requirements. They are not added to215PASS. Original18Step5A failures are17wholePASS andV706cashPASS/wholeNOT_EXECUTED for explicitly deferred straddles. Registry/release-gate regression:18/18PASS after the final mapping. `npm run release:check` deliberately returned1, refusing publication.

**14 cash-release gates remain unresolved: one FAIL and13NOT_EXECUTED.** Exact unchanged criteria and supporting evidence are in the dashboard; the next action is explicit for each:

| Original ID | Status | Next action |
|---|---|---|
| F10 | NOT_EXECUTED | Run an independent, predeclared dangerous-river size/line utility comparison for strong versus weak profiles; current heuristic benchmarks do not establish average strategic accuracy. |
| U10 | NOT_EXECUTED | Execute screen-reader announcements and keyboard-only navigation for betting, turn changes and payouts on the declared supported browser/device. |
| U11 | NOT_EXECUTED | Measure bot compute, ten-seat rendering and trusted input-to-confirm latency on the named physical phone and desktop; retain current Chromium cloud measurements as partial evidence. |
| U16 | NOT_EXECUTED | Recover the existing historical Site write audit proving all writes targeted this project; do not access or modify Poker MaxEV to manufacture retrospective proof. |
| Y10 | NOT_EXECUTED | Validate continuous six-/nine-handed population and stack dynamics with documented allowed rebuy/churn scope and independent strategic plausibility review; controlled per-hand resets are partial only. |
| Z02 | NOT_EXECUTED | Link the preserved initial project/deploy/browser artifacts to a complete historical old-project nonmutation audit; no new project or old-site edits. |
| Z03 | FAIL | Implement and test a compatible rollback path or recovery release that preserves all post-migration hands/events and current policy versions; restoring only the old backup is insufficient. |
| Z12 | NOT_EXECUTED | Complete missing per-critical-result build/version/input provenance and rerun the canonical evidence/dashboard audit; this report and executable refusal are partial evidence. |
| V436 | NOT_EXECUTED | Verify explicit practice-only/no-real-time-assistance disclosures, rights-gated external data ingestion and absence of live-poker integrations against the deployed candidate. |
| V513 | NOT_EXECUTED | Perform actual mobile OS suspend/tab-kill during pending decisions and payout, then compare committed revisions/events after reopening; desktop reload is partial evidence. |
| V518 | NOT_EXECUTED | Complete named-device 2/6/10-seat timing/memory/error measurements and screen-reader/color-independent action checks; investigate large cold recovery and the unattributed tail. |
| V522 | NOT_EXECUTED | Run the configured hosted CI gate on the candidate and complete every critical fixture/build/seed/evidence link; local execution is not hosted CI execution. |
| V620 | NOT_EXECUTED | Audit every passing critical result for its original commit/build/engine/policy/rules/seed/expected-observed/environment/artifact provenance; do not retroactively assign current hashes. |
| V707 | NOT_EXECUTED | Recruit three actual new users on the specified devices; each locates minraise/raise-to/call amounts and plays 25 hands with real misclick/ambiguity records. |

**Recommendation: NOT READY FOR R1.** Preserve Version7 until these gates are satisfied. The immediate technical priorities are measured cold-recovery/audit duplication and retained-memory analysis, followed by compatible rollback. Physical iPhone export is still AWAITING USER VERIFICATION. No expert-review or independently measured human-calibration claim is made. All302original criteria and86future features are preserved.
