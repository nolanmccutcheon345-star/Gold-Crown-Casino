# Step4B — advanced synthetic cash opponents

Existing project: `/workspace/sites/ai-texas-hold-em`. Site: https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/

**Published Version 6**, native deployment succeeded on 2026-10-31 at 23:34:46 UTC from source `92072fb46e48f6acbc321d91348bf9b0aac196c0`. Publication proof: `TEST_EVIDENCE/step4b/publication.json`. The deployed guest journey also passed. This release does not certify full G4 human realism. No Poker MaxEV project was accessed. All302 acceptance requirements and86 deferred features remain intact.

## Implemented

The eight existing archetypes now use `synthetic-cash-1.1.0`: nit, TAG, LAG, calling station, recreational, maniac, fit-or-fold and stronger regular. Existing Unknown, Custom, Random, independent skill/population controls and stable seeded individuals remain available.

- `src/bots/preflop.ts`: explicit169-class model and1326 physical combinations; six positional roles across2–10 seats; unopened/limped/open/3-bet/4-bet contexts; isolation, cold callers, squeezes, price, effective-stack interpolation and legal sizing. Shared premium-value logic bounds deliberate traps instead of applying generic passivity to AA.
- `src/bots/ranges.ts`: normalized synthetic public-action likelihoods, compatible weighted combos, historical board/player context, public-memory shrinkage, folded posterior diagnostics, uncertainty and deterministic joint showdown-share sampling. It never receives actual opponent profiles, undisclosed holes or future cards.
- `src/bots/strategy.ts` / `features.ts`: range-aware equity/realization, pot odds/rake, future cost, implied/reverse-implied risk, board development, cbet/delayed cbet/barrel, bluff/semibluff, protection/thin value, check-raise/trap and overlapping stack-aware sizes. Unsupported equity samples receive no trust.
- `policy.ts`, `profiles.ts`, `boundary.ts`, `range-contract.ts`: stable interfaces, new-version identity and frozen dispatch. `src/bots/v1/` preserves Version5 behavior byte-for-byte except import paths; phase0 remains frozen too. Active older sessions keep their exact policy, pending samples and history.
- `src/storage/integrity.ts`: public study imports reject private range/decision diagnostic fields. The existing export projection already excludes them. UI exposes the phase label while preserving table layout, cashier and session controls.

The engine remains the sole owner of cards, legal transitions, chips and payouts. Model cards and numerical assumptions are versioned in `src/bots/MODEL_CARDS.md`, `PREFLOP_MODEL_1_1.md`, `docs/models/RANGES_1_1.md` and `tests/postflop4b/MODEL.md`.

## AA root cause and identical-scenario comparison

The untouched1.0 audit legally replayed all8000 original samples. It was genuinely first-in UTG, six-handed,100BB, $1/$2, actor3/button0/SB1/BB2, no prior voluntary action, call$2/minraise$4/max$200. Calls were open limps; no defensive calls, checks, folds or all-ins were misclassified. The old AA continuation guard prevented folding but left raising dominated by aggression/skill. Passive profiles therefore limped routinely, rather than deliberately choosing a bounded trap.

Same1,000 action seeds per profile, same cards and numeric personality traits:

| Profile | Old raise / limp | New raise / limp |
|---|---:|---:|
| Nit |507 /493|955 /45|
| Station |271 /729|956 /44|
| TAG |962 /38|986 /14|
| LAG |958 /42|993 /7|
| Fit-or-fold |449 /551|963 /37|
| Maniac |924 /76|1000 /0|
| Recreational |350 /650|935 /65|
| Strong regular |963 /37|988 /12|

These are executed synthetic samples, not human frequencies. Before implementation, the registered guard run had11PASS/4FAIL; all14 coherence guards now pass. AA/KK/QQ/AK and weaker broadways/pairs/connectors share the continuous value mechanism. There is no AA-only target-frequency override.

## Position, depth and public-range examples

All169-class range weights were measured across1,680 advisory contexts (283,920 class rows). Actual6/4/12 combination weights are used. These are designed model outputs before engine constraints, not1,680 independently observed human opportunities. Independent enumeration checks actual legal UTG/BTN decisions against the published weighted ranges.

At100BB the designed first-in entry mass is nit UTG5.31%/BTN11.09%, TAG9.48%/19.99%, LAG15.28%/32.88%. Exact grids, contexts and class ordering are retained in `TEST_EVIDENCE/step4b/preflop/`.

For stronger-reg97s, CO facing-open, stated6-seat/3BB-call/30%-price advisory context, continuation changes with effective depth:

| Depth | Continue probability |
|---|---:|
|20BB|0.56%|
|40BB|1.45%|
|60BB|3.18%|
|100BB|5.89%|
|150BB|12.29%|
|200BB|21.09%|
|250BB|25.39%|

This is a synthetic speculative-hand/realization design, not solver advice.

In the recorded deep-river public range example, one opponent's effective combo count changes402.7 after preflop call →436.3 after flop check →318.2 after flop call →338.2 after turn check →270.4 after turn call →230.0 after the large river lead. Preflop-premium-class mass moves8.96%→5.22%→8.75%→5.35%→7.15%→18.80%. These trace summaries are conditioned on cards public at the current decision; no actual opponent holes are used. Current showdown-share estimate71.35% uses96 joint samples; separate model uncertainty is0.49. This is not full decision EV. Full compatible weights, observations and assumptions are preserved in `tests/step4b/evidence/representative-full-range.json.gz`.

## Executed verification

- **438/438 automated tests PASS**,48 files, zero failed/skipped, including all prior339 tests. Integrity, TypeScript, ESLint and production build PASS. Exact final manifest: `TEST_EVIDENCE/2026-10-31T23-21-46-242Z/manifest.json`. Earlier integrated97-test and425-test runs are retained too; counts are not added together.
- Independent PokerKit0.7.7 compatible evaluator/settlement comparisons executed.20,000 seeded accounting hands executed (10,000 with rake,10,000 without); these are scenario iterations, not20,000 acceptance requirements.
- Independent Step4B lane **28/28PASS**. Paired synthetic experiment: **5,192 completed hands**, **22,395 legal decisions**:1,920 scripted-prefix continuation hands,3,072 hands against six fixed probes,200 nine-handed all-bot hands.8,000 candidate AA samples were compared with the original8,000 baseline. Full traces, seeds, versions, counts, uncertainty and compressed hashes are in `tests/step4b/evidence/`.
- **20 actual browser UI hands PASS** at2/6/9/10 seats with94 UI clicks and182 prepared bot decisions. Independent public-event replay verified260 legal action records, unique settlements, refunds, payouts, stack continuity and chip conservation. No horizontal overflow. These isolated UI runs use a test persistence port; the real IndexedDB journey below is separate.
- **105/105 responsive browser cases PASS**:2/3/6/9/10 players ×320/375/390/430/768/1280 widths and844-landscape ×preflop/river/showdown. Seat/board/card/name overlap, clipping, Hero-bottom position and action-shortcut visibility were asserted. Screenshots are actual browser captures, not generated mockups.
- Real guest IndexedDB journey: existing10 hands and$2,285.28 bankroll survived the upgrade; bought in$200, reloaded during a relaxed bot turn, restored the same22 hole cards and committed$2 contribution, then saw exactly one opponent raise to$7.27. Completed showdown with$14.54 awarded to Alex; Hero−$7.27. Cashout$192.73 returned bankroll to$2,278.01, table$0, cumulative result−$21.99. Reload preserved those amounts; prior manual adjustments and history remained present. Safe New Session returned to configuration after cashout.

Published guest follow-up: completed one additional real hand against the 1.1.0 strong regular after an active-hand reload. Hero Ts7d completes the $1 SB to $2; Alex checks BB, then both check Qc8s3h/Qd/6s. Alex shows 2d5s; Hero wins on the ten kicker. Main pot $4, no rake/refund; ending stacks $202/$198 total $400. Safe New Session cashes out $202 exactly once. Bankroll $2,502.50 → $2,302.50 after buy-in → $2,504.50 after cashout; reload retains $2,504.50, table $0, lifetime poker +$4.50 and four histories. Old 1.0 and phase0 histories remain versioned and intact. Buy-in/cashout each contribute $0 poker result. An engine-independent public-event audit passed for all four exported completed histories. This follow-up and the separate preview IndexedDB hand are additional to the 20-hand UI batch.

Browser preparation p95/max milliseconds:2seats51.1/51.1;6seats51.7/76.0;9seats56.6/72.8;10seats49.1/63.0. Largest observed browser long task136ms; no stalled turns. These are cloud Chromium measurements at mobile CSS widths, not physical-iPhone CPU measurements. Node cold10-seat range median25.64ms/max45.46ms is separately recorded.

## Complete hands and residual behavior

An actual six-seat browser hand (`hand-85e541dd7b2a5c72f16cc3dd133f556b`): SB$1/BB$2; Jordan folds, Riley raises to$7.48, Casey folds, Hero calls$7.48, both blinds fold. Riley/Hero check flopAd5s5d, turnQc, river7s. HeroJc4s loses to Riley7c8c. Pot$17.96, rake$0, refund$0; Riley receives$17.96. Six starting$400 stacks total$2,400; final stacks$392.52/$399/$398/$400/$410.48/$400 still total$2,400.

A controlled TAG draw-completion sequence: preflop raise/call$6, flop bet/call$6; AhKh makes the nut flush on Qh7h2c8h. TAG bets$18, opponent folds. Engine refunds$18 uncalled and awards$24; ending$212/$188 from$200 each. Scripted prefixes are explicitly identified. The bet/fold after the prefix were policy decisions. More examples and all archetype comparisons are in `tests/step4b/VERIFICATION.md`.

The new nine-handed100-hand cohort is much tighter:48 flops and16 multiway flops versus84/53 before. Nit VPIP4/113, TAG10/109, LAG13/113, stronger12/110, station36/113 and maniac31/106. These are simulator hand-opportunity counts. Actual unopened entries align with summed conditional policy probabilities; no sampler defect was found. This limited cohort does not establish human-like table ecology.

All six probes ran: minbet, hyper-overbet, limp-all, never-bluff, always-call and maximum aggression. Stronger-reg means per hand were−1.269/−1.584/+.075/+.188/+.239/−.582BB, respectively; each32-hand descriptive interval crosses0. Nit continued0/15 observed all-in opportunities and fit-or-fold0/16; those samples can miss rare profitable premium calls. Station/recreational/maniac losses against constant shoves were large but uncertain. No low-exploitability or certified-strength claim is supported. All profiles checked one declared missed-draw river in8/8 continuations; that single context does not prove universal river passivity.

## Acceptance and next work

Tracker: **76PASS /0FAIL /5BLOCKED /221NOT_EXECUTED =302**. Seven narrowly supported implementation rows advanced (R03/R05/R08/R10/R15/R21/R23); broader context, joint-line and external-reference rows retain partial-evidence notes. Automated test counts, simulated hands and V7 requirement counts remain distinct. All86 deferred entries remain unchanged.

Physical iPhone mobile export remains **AWAITING USER VERIFICATION**. Licensed human holdouts, blinded human comparison, calibrated population frequencies, solver benchmarking, physical-device performance and full G4 signoff remain unavailable/unverified. Approximate range/nut advantage, half-pot fold equity, independent range factors, bounded sampling and lack of side-pot-specific strategic equity remain limitations; authoritative settlement is unaffected.

Step4C should use fresh, pre-registered evaluation seeds and larger independent sessions; stratify rare shove tails and small/overbet response curves; quantify joint-line likelihoods and population ecology; evaluate side-pot-aware strategic equity and off-main-thread reasoning if physical-device latency warrants; obtain rights-cleared action-level human data or blinded expert review before any realism claim. Keep the physical-iPhone export check separate. Do not tune to this held-out sample and then reuse it as fresh validation.
