# Step 5A — cash release hardening

**NOT READY FOR R1.** Published **Version 7** remains at https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/. The tested Step 5A source is preserved in the existing Site repository, but is **not deployed**: the user's publish-only-after-release-checks condition is not satisfied. No Site was recreated, and Poker MaxEV was not accessed or modified.

Project: `/workspace/sites/ai-texas-hold-em`. Final tested runtime commit: `727371f` (subsequent commits contain evidence/status only). The authoritative engine, cash controller, statistics implementation and persistence schema remain unchanged. Engine/rules0.3.0, schema4, new-session synthetic bot policy1.3.0. Existing sessions still dispatch their frozen1.2/1.1/1.0/phase0 policies.

## Implemented and verified changes

| Source | Change and evidence |
|---|---|
| `src/bots/strategy.ts` | Proves a narrow heads-up river shared-board chop before overriding the nuts guard: folds only when the guaranteed integer-cent payout after rake/odd chips is less than the call cost. Private winning nuts and zero/positive-value chops retain protection. Fresh holdouts pass. |
| `src/bots/pricing.ts` | Includes no-flop-no-drop rake when the proposed preflop call necessarily forces a board runout. Does not invent unresolved opponents' future calls. Independent pricing and settlement tests pass. |
| `src/bots/policy.ts`, `profiles.ts`, `v3/` | Freezes the old1.2 implementation and assigns1.3 only to new sessions. Fixed-token old-version compatibility and recovery regressions pass. |
| `src/ui/app.ts` | During pending or failed initial storage reads, shows restoration/retry state instead of a false $0 bankroll/default table. Actual delayed-read/failure/retry UI verified. |
| `src/session/types.ts`, `src/storage/integrity.ts` | Adds optional public policy-version labels to hand export and validates bounded, inert provenance on import. No per-seat latent traits, policy objects, seeds or private cards are exposed. Original stored records/hashes and legacy imports remain intact. |
| `tests/step5a-*`, `tests/r1critical`, `tests/browser/step5a-*`, scripts | Independent pricing/reconstruction/holdout tests, conditional populations, failure/recovery tests, actual UI endurance harness, release classification, public-event arithmetic and history-cost profiling. Test harnesses are excluded from production builds. |

## Strong-regular 0/30 investigation

[Full report](tests/step5a-bots/REPORT.md) and compressed raw reconstruction retain all64 original probe hands, every public sequence and the30 decision inputs: own holdings, public board/history, legal bounds, pot/eligible amounts, depth, inferred range and policy parameters. Test-only opponent cards are labelled audit-only and never supplied to the bot.

All30 opportunities were on the **turn**; none held the absolute nuts. Independent enumeration of1,035 opposing holdings ×44 rivers ×30 states evaluated **1,366,200 runouts**. Under the bot's own synthetic inferred range,28 calls were negative-value and2 positive-value. That range is an assumption, not ground truth. Large prices (1.52–74.5pot increments), value-weighted action priors, conservative risk/size penalties,96-trial sampling noise and the recorded random draws explain the result. No inaccessible-side-pot incentive or legal-action-filtering defect was found in these30 cases.

The30 continuation probabilities sum to1.194. Conditional on those fixed states and independent policy draws, zero calls has18.134% probability. This is not a confidence interval or an alternative-path simulation; only7 blocks supplied the30 opportunities. The set and AA examples had positive conditional callEVs of+$98.47 and+$227.57 but continuation probabilities11.47% and69.70%. Risk premiums17.17 and19.24percentage points are not expert-validated. Therefore **not all30 folds are certified strategically correct**. Against the probe's true any-two policy the bot is exploitable; it cannot legitimately know that hidden policy.

**Before/after the original probe:0/30 →0/30, with identical distributions.** No calling quota was added. A separate confirmed defect was repaired: on a royal-flush board, a$198 call returned exactly$197.50 after capped rake, yet the old nuts guard forced a call. The corrected policy folds that guaranteed−$0.50 case. Fresh heldout120 shared-board cases (74negative/46positive),40 private royal cases and explicit zero-value tests all pass, including both buttons, odd cents, variable rake and excess refunds.

The stratified matrix executed **27,000 legal decisions** (9hand strata ×3public-history conditions ×1,000). Continued actions against passive/mixed/frequent-aggressor history were: private nuts1000/1000 in each; sets998/998/997; top two999/998/996; QQ bluff-catchers581/827/992; weak air5/6/8; nut-flush draws299/447/308. Independent10/40/70%-air reference ranges make QQ's conditional callEV−$6/$0/+$6. Turn EV assumes checkdown after calling. These are controlled synthetic references, not solver-balanced ranges or measured humans. Conditional Wilson intervals and raw inputs are retained. Ace-high underdefence and nonmonotonic noisy draw decisions remain plausibility concerns.

## Independent call pricing

[Pricing evidence](tests/step5a-pricing/README.md):19 tests passed, covering32 exact heads-up cases,10 targeted multiway cases at2/3/6/9/10 seats, and300 seeded complete hands with3,282 priced decisions. Coverage includes949 stack-exhausting calls,907 excluded-chip cases,539 inaccessible-tier cases,698 folded-money states,216 multipot settlements,181 refunds and142 raked hands. The independent event accountant does not import production pricing or settlement calculations.

Confirmed forced-runout defect:4000/20000-cent stacks; call3800 after the larger stack shoves;16000 is returned unmatched; eligible gross8000; rake400. Break-even equity is**50%**, not47.5%. Current1.3 accounts for that rake; frozen1.2 intentionally retains its historical decision behavior. No other pricing discrepancy was found in the tested cases. This is not a claim of exhaustive correctness across every possible state, side-pot-specific range equity, or full decision EV.

Pinned **PokerKit0.7.7** compatible evaluator/betting/side-pot comparisons passed. Named-room rake is not falsely claimed as PokerKit-certified; explicit custom practice rake has separate analytical fixtures.

## Executed tests and actual browser play

- **572/572 automated tests**,73files,0failures/0skips. Integrity, TypeScript, ESLint and production build all exited0. [Final manifest](TEST_EVIDENCE/2026-11-01T03-19-50-995Z/manifest.json), [test log](TEST_EVIDENCE/2026-11-01T03-19-50-995Z/unit-and-oracle.log). Includes all prior480 checks,20,000 accounting hands,100,000 actual CSPRNG deck diagnostics, independent oracles and targeted suites. Test counts are not acceptance requirements.
- An earlier integration run had527PASS/10FAIL solely from obsolete1.2 diagnostic-version expectations after introducing1.3. Corrected to1.3, then537/537 passed; after final coverage/export tests572/572 passed. Failures and reruns remain recorded. Separate authoring/environment/RPC failures are retained in lane evidence, not erased.
- **212 newly completed actual UI hands**:100 nine-seat,100 initially ten-seat,6 isolated IndexedDB recovery/session hands,5 final-candidate heads-up mobile smoke hands, and1 on published Version7. The ten-seat run had36hands with10 funded players and64with9 after a bust; no opponent refill was invented. Nine-seat run retained9funded players throughout.
- **105/105 Chromium layout cases** at2/3/6/9/10 seats and320/375/390/430/768/1280/844-landscape widths across preflop/river/showdown. Geometry, readable cards/labels, Hero bottom, seat badges, no horizontal overflow and accessible action shortcut verified. Actual6/9/10 screenshots are linked in [browser evidence](TEST_EVIDENCE/step5a/BROWSER.md).
- Exact committed-state reload at preflop/flop/turn/river; pending-bot write failure/retry; committed payout with lost acknowledgement/reload; two-tab ownership fencing/takeover; manual bankroll edit; repeated topups; six distinct cashouts; repeated6→9→6 configuration changes; public export, read-only replay, duplicate study import; all reconcile in isolated persistence.
- **4 populated migration scenarios ×19 checks** pass, one per street: pre-test snapshots, schema3 compatibility, schema4 upgrade/backup, old-reader safe refusal without deletion, reopen, pending-action once, unchanged money/history. Production saves were not used for destructive migration experiments.
- Published Version7 completed a new guest hand with no Google sign-in, queued legal exit, one cashout and reload. Available wallet250250→250050 cents, cumulative poker net250→50 cents,5→6 saved hands. All five prior parsed public hand records are unchanged.

Independent Python arithmetic audited217 public records: the212 new hands plus the5 existing published records. Per-seat starting stacks minus paid chips plus refunds/awards match ending stacks; all awards plus rake equal contestable chips; decision/event IDs are unique; visible cards are unique; winners belong to eligible, nonfolded seats. [Audit](TEST_EVIDENCE/step5a/public-event-audit.json). Endurance files intentionally omit replay frames and are audit artifacts, not importable history backups.

## Completed-hand and bankroll examples

Actual recovery-browser hand `hand-f64d2374da7d4ebc5ae960ed139c7564`: Hero3hTd versus Alex3cKh; both start$300 at$1/$3. Hero posts$1, Alex$3; Hero calls$2, Alex checks. Board5h7d2h /3d /Jh; Alex then Hero check every street. Gross pot$6, no rake/refund; Alex's pair of threes with king kicker wins$6. Hero ends$297, Alex$303; total remains$600. A lost payout acknowledgement was injected; reload produced one settlement and one$297 cashout, not a second award.

Available wallet after that session was$9,997; poker result−$3. A manual edit set the wallet to$5,000; reload retained$5,000 and poker result remained−$3. Later two$25 topups and a$550 cashout did not change poker P&L. Final six-session state after an additional−$12 raised hand and a break-even nine-seat hand: wallet$4,988, poker net−$15,22 unique ledger events,6settlements and6cashouts. Importing all six records twice and reloading leaves those values unchanged.

## Population quality and evidence boundaries

Eight configurations,8 independent blocks each,25 consecutive hands/block: **1,600 hands and15,043 actions per policy**, paired1.2/1.3 worlds. Ordinary-session action/settlement results were identical; rare corrected cases are covered by targeted tests. Stakes and skill are independent dimensions. Stacks, dealer, personality and permitted observed memory persist; simulation topups debit an explicit separate wallet through the engine.

At200hands/configuration, loose-passive$1/$2 limped93/578 unopened priced opportunities (16.1%), versus29/574 (5.1%) in aggressive$5/$10 and1/605 (0.2%) in tough six-max. PFR was128/1170 (10.9%),209/1176 (17.8%),198/1174 (16.9%) respectively. Multiway flops were51/110,36/81 and22/41. Nine-/ten-handed configurations had59/117 and74/114 multiway flops. [All configurations, 3bet/aggression/size/draw/river denominators and block intervals](tests/step5a-release/README.md).

Five complete large/multiway/HU hands were inspected. A calling-station KQo four-bet cold-call followed by a river air shove, a LAG flush shove on a paired board, and recreational QJo limp/reraise deserve strategic review. HU BB folded95/127 opens (74.8%);11/12 reraises induced an opener fold; flops21/200. These are synthetic-model concerns, not human-calibration evidence or a reason to impose arbitrary quotas. Sparse river cells and96-trial equity noise limit conclusions.

Evidence categories remain separate: **mechanics correctness** has executed independent/regression evidence; **synthetic bot functionality** has executable conditional/population evidence; **independent expert strategic review** is NOT_EXECUTED; **measured-human calibration** is BLOCKED by missing qualifying datasets/review. Simulated winnings imply no real-poker profitability.

## R1 coverage and remaining blockers

[Dashboard](R1_DASHBOARD.md) and [full302-row matrix](R1_REQUIREMENTS.csv) retain every original ID/title/criterion verbatim, scope, priority, evidence, observed defect and owner/next action. `ACCEPTANCE_STATUS.csv` is updated, not merely proposed.

| Coverage | PASS | FAIL | BLOCKED | NOT_EXECUTED |
|---|---:|---:|---:|---:|
| All302 original requirements |114|18|5|165|
|237 release-critical whole rows, including3 external usability/device gates |114|18|0|105|
| Same237, cash-only component of6 mixed tournament/cash rows |120|18|0|99|

Scope classification:234cash-critical,0desirable/nonblocking,22R2single-table,19R3multi-table,16deferred enhancement,11external dependencies. No mandatory cash feature was silently made optional. Missing tournament-only functionality is not an R1 defect. Six mixed criteria retain whole-row NOT_EXECUTED while their cash components have evidence.

The18 FAIL rows represent11 missing implementation groups: independent capacity/empty seats; safe next-hand configuration; named preset save/clone/load; specified one-click9-seat150BB default; full percentage/BB sizing shortcuts; custom-percent sizing; mobile pot slider; assumed live-paced profit projection; sourced occupancy-dependent rake caps; additional raise/checkraise/fold-to-cbet opportunity stats; baseline per-street draw-price controls. These are honest source-inspection gaps, not fabricated failed automated assertions. Exact IDs and next actions are in the dashboard.

Five inherited BLOCKED rows were investigated individually: R18 lacks a rights-cleared matched human holdout; R19 lacks required human strata; Y03 lacks qualifying provenance and disjoint split; Y04 lacks evaluated human-heldout scoring; Y05 lacks actual independent blinded expert review. They block human-validation claims, not an honestly labelled synthetic R1. Separately, V707's three-new-user/25-hand comprehension study and the declared physical-device/accessibility matrix remain unexecuted cash gates.

**Confirmed unresolved performance deficiency:** history is repeatedly cloned and rehashed on each durable bot reservation/preparation/commit. Nine/ten browser runs had preparation p95**719/723ms**, maxima931/978ms and longest tasks3151/2727ms. Shared-browser heap peaks419/326MB include harness records and do not establish a leak. Independent profiling without UI, IndexedDB or harness exports reproduces median preparation63.4ms at10saved hands versus625.5ms at100, with snapshot714KB→6.7MB. Full history validation alone139.8ms at100hands; snapshot hashing143.3ms. No integrity checks were bypassed for speed. Full10,000persistent-session/bounded-storage gate remains NOT_EXECUTED.

## Export/device status and next action

Desktop actual JSON download is PASS. At390px, all292,811 characters were correctly selected by the copy fallback; five complete public records imported as study-only, versions displayed, hidden preflop cards remained hidden, replay settlement matched, and wallet$9,000/table$1,001/P&L+$1/five canonical hands stayed unchanged. The cloud tool explicitly reports **“Blob downloads are not supported in embedded frames”**; mobile iframe download capture is BLOCKED_BY_AUTOMATION, not passed and not diagnosed as an app failure. Native iOS share/download remains **AWAITING USER VERIFICATION**. Earlier user-reported4/5 iPhone passes are retained; this turn claims no physical-device test. [Exact iPhone steps](IPHONE_VERIFICATION.md).

Next implementation: safely reduce repeated whole-history work while proving snapshot ownership, immutable-prefix validation and unchanged recovery semantics; profile25/100/500-hand populated isolated saves and repeat long9/10-seat browser runs. Then close the11 mandatory cash feature groups, remaining exact acceptance scenarios and real-user/device gates. Do not proceed to tournaments or additional archetypes. **All302 requirements and86 deferred features remain preserved and hash-verified.**
