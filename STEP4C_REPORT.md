# Step4C — independent synthetic-opponent audit

Published **Version7** at https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ from source `a0bfc0950771a6dc1b786e00c13be7f3485b8dcb`. Native deployment succeeded2026-11-01T02:14:30Z; exact IDs and archive provenance are in `TEST_EVIDENCE/step4c/publication.json`. Existing Site retained, governed by the unchanged V7 master and Acceleration Addendum. The implementation is in `/workspace/sites/ai-texas-hold-em`; Poker MaxEV was not accessed.

## What changed

New sessions use `synthetic-cash-1.2.0`. The existing engine, chip ledger, persistence schema and responsive seating were unchanged. The previously published1.1 policy is frozen in `src/bots/v2`;1.0 and phase0 remain supported. Compatibility tests compare exact old actions, distributions, entropy consumption and fingerprints, and recover an interrupted old-policy session without reroll or double settlement.

Implemented files: `src/bots/preflop.ts`, `pricing.ts`, `features.ts`, `strategy.ts`, policy/version dispatch and model cards; UI footer identifies Step4C. New verification lives in `tests/compat4c`, `tests/preflop4c`, `tests/strategy4c`, `tests/step4c` and the Step4C actual-browser harness. Evaluation code is not imported into the production bundle.

## TAG opening investigation

The old9.48% UTG /19.99% BTN numbers were **entry** probabilities (raise plus limp), for six-max100BB, neutral default TAG, zero rake. They correctly weighted all169 classes and1,326 physical combinations. They were not all-hand VPIP, nor nine/ten-handed ranges. Actual old RFI was9.29% /19.58%.

The policy charged first-in hands with a defensive call-price penalty and a total-table-size penalty, even when earlier players had folded. Full-ring early seats also shared an overly coarse pressure category. The correction separates opening initiative from facing a raise, grades physical seats by remaining responders, and retains personality, skill, population and depth effects. Widening is an authored strategic hypothesis, not fitting to a target VPIP or certified solver result.

| Six-max100BB exact combination-weighted RFI | Before UTG / BTN | After UTG / BTN |
|---|---|---|
| TAG | 9.29% /19.58% | 15.01% /33.03% |
| Strong regular | 10.43% /23.76% | 18.34% /45.35% |

Executed1,288 exact configurations across2/6/9/10 seats, eight styles and seven stack depths,96 parameter ablations and344,064 paired sampled decisions. Each final sample uses matched cards and separate action entropy. TAG after:593/4096 UTG raises,14.48% (Wilson95%13.43–15.59);1,336/4096 BTN,32.62% (31.20–34.07). Full before/after tables and interpretation are in `tests/preflop4c/REPORT.md`.

ART/GTO's own six-max100BB2BB-open pages report19.9% UTG /46.5% BTN; rake is unspecified on the pages read. GTO Wizard documents materially different open sizes, depth and rake configurations. These are technical references, not interchangeable conditions or measured humans. TAG remains deliberately tighter. Folded-card bunching is not modeled. Primary links and human-data provenance limits are in `TEST_EVIDENCE/step4c/EXTERNAL_REFERENCES.md`.

## Confirmed pricing defects

Short callers previously counted unmatched excess and higher side pots they could not win. A$38 call after a deep player's$198 flop shove into$4 was priced as$38/$240=15.83%; after the$160 uncalled return, correct immediate price is$38/$80=47.5%. The same capped call made the visible shove look like a0.2317-pot bet instead of49.5 pots. The new read-only pricing helper fixes those inputs without moving chips. The engine already returned and paid chips correctly.

Development probe:4,096 complete fixed-scenario continuations, with all eight styles and256 matched action seeds per version. Fresh held-out37BB/175BB cases independently require48.6486%, versus old16.9811%; the new model matches the arithmetic. Three-way43BB capped cases likewise correct25.4545% to32.5581%. Independent complete side-pot fixtures include folded dead money and rake. Tranche-specific strategic equity remains approximate even though call eligibility and money settlement are correct.

## Independent population results

The event-based evaluator does not use policy diagnostics to count behavior. Fresh baseline/candidate cohorts each contain1,440 completed hands across72 table/personality blocks:2/6/9/10 seats,20/100/250BB,low/mid/high environments, heterogeneous stacks, two lineup forms, Unknown/Custom and independent skill. These are controlled trials resetting stacks per hand, not live bankroll sessions or representative human samples. Candidate cohort:13,273 legal actions,554 flops,292 multiway flops.

| Candidate style | VPIP count/opportunities (rate;95% block interval) | PFR count/opportunities (rate;95% block interval) |
|---|---|---|
| Nit | 82/1160 (7.07%;5.44–9.04) | 52/1154 (4.51%;3.30–5.95) |
| TAG | 221/1482 (14.91%;12.74–17.25) | 176/1473 (11.95%;9.88–14.11) |
| LAG | 288/1346 (21.40%;18.25–24.48) | 235/1342 (17.51%;14.90–20.33) |
| Calling station | 376/1061 (35.44%;32.19–38.99) | 137/1058 (12.95%;10.47–15.55) |
| Recreational | 396/1344 (29.46%;27.18–32.27) | 199/1336 (14.90%;12.88–16.96) |
| Maniac | 332/892 (37.22%;33.16–41.23) | 271/890 (30.45%;25.91–34.53) |
| Fit or fold | 132/1132 (11.66%;9.64–13.85) | 88/1125 (7.82%;5.84–9.93) |
| Strong regular | 187/1034 (18.09%;15.58–20.92) | 147/1022 (14.38%;11.80–17.19) |

VPIP requires an actual voluntary preflop decision; PFR additionally requires a legal raise opportunity. Intervals resample whole table/personality blocks1,000 times, not individual actions. Paired policy changes alter later opportunities, so denominators differ. RFI by physical position, limp/overlimp/isolation/cold-call/3bet/4bet/squeeze/defense, cbet/barrel/check-raise/draw/value/air proxies, showdown outcomes, sizes and contextual strata are in `tests/step4c/evidence/population-key-rates.csv` and compressed complete traces. Rare postflop cells are marked insufficient; operational air/value proxies do not prove intent or decision EV.

## Held-out exploit findings and full hands

Eight independently authored probe opponents use permitted observations only. The final cohort uses novel seeds, boards,25/75/175/300BB stacks and mirrored roles, with8 blocks×8 hands per style/probe. Outcome uncertainty uses whole blocks. Targeted conditional sampling adds1,024 opportunities per style/family (eight independent variants×128 draws),49,152 decisions per model, and96 complete continuations per model. These counts are distinct from automated test and V7 requirement counts.

**Remaining weakness:** strong regular against the minimum-flop-bet/turn-shove probe returned−2.340BB/hand over64 hands,95% block interval−3.918 to−0.597, and continued0/30 observed oversized responses. Seven contributing response blocks are insufficient for a clustered conditional interval. TAG against the selective missed-draw probe returned−3.818BB/hand (−8.456 to−0.508). These short artificial matches identify candidates for refinement, not mathematical exploitability or real-money loss rates. Candidate policies were not retuned on this holdout. Across development, held-out and identified coverage follow-ups, the independent lane retained13,824 completed experimental hands and84,516 legal action events, plus98,304 separately sampled conditional decisions; duplicate reruns are not counted. Conservative jam priors and slow adaptation are hypotheses for follow-up, not established causes.

A coherent corrected development hand: short QdJd calls$38 on Qs7h2c after the deep player's$198 shove; engine returns$160, deals6s3d, awards the$80 pot to QJ over8c9c. Final$80/$160 plus zero rake equals$240. A raked three-way AA/KQ/KJ fixture produces a$60 main pot and$60 side pot; after$5 rake, payouts$55/$60 conserve$120. These are controlled examples, not expert endorsements. Questionable probe hands and the unreviewed expert packet are preserved by the independent lane.

## Regression, browser and claims

Final integration gate: **480/480 automated tests PASS**,58 files, no failed/skipped; integrity, typecheck, lint and build PASS. Includes PokerKit0.7.7 compatible fixtures and20,000 seeded accounting hands. Manifest: `TEST_EVIDENCE/2026-11-01T02-12-48-035Z/manifest.json`. After additive evaluator legality/interval assertions, the independent lane reran17/17PASS, but packaging caught a TypeScript narrowing error in that new test helper. An explicit raise discriminator fixed it; the failed typecheck is preserved and the complete480-test release gate, typecheck, lint, integrity and build then all passed. Initial failures and fixes remain recorded: two historical version-label assertions, three contradictory manual fixtures, an evaluation RNG pairing issue and a probe-runner timeout. None was silently relabeled PASS; corrected executions are retained.

Actual browser:20 completed UI hands at2/6/9/10 seats,105/105 responsive cases and a separate real IndexedDB reload→split pot→single cashout journey. An engine-free event replay reconciled those21 hands. Published Version7 added one complete guest hand, queued safe exit/reload and automatic single cashout; its five exported histories also passed independent accounting, with the four prior records exactly unchanged. Total newly played browser hands:22. Browser preparation maximum100.9ms, observed long-task maximum177ms; process heap estimates and limits are documented in `TEST_EVIDENCE/step4c/BROWSER.md`. No claim of physical-device performance or memory-leak clearance.

Hidden-information checks preserve identical distributions and sampled actions after genuine concealed Hero-card/future-deck changes;384 paired decisions across eight styles/three streets plus128 role-relabeling pairs and independent verifier checks passed. Normalized public posteriors remove known cards. No hidden cards or future deck enter the bot interface. This local guest application still exposes its full local engine state to a user inspecting developer tools; it is not a secure multiplayer server.

| Validation layer | Status |
|---|---|
| A: exercised poker mechanics/accounting/recovery | PASS for executed scope; broader V7 cases remain unexecuted |
| B: stable, legal, distinct synthetic policies | PASS; exploit weaknesses remain explicitly documented |
| C: actual independent expert-reviewed plausibility | BLOCKED / NOT_REVIEWED; packet prepared |
| D: statistical resemblance to measured human play | BLOCKED; no rights-verified, context-matched human holdout evaluated |

Human data were investigated, including IRC, HandHQ/PHH, ACPC and Pluribus sources. They are not all human or matched live-cash samples; PHH maintainers also document unresolved underlying asset permissions. No data was silently treated as licensed calibration evidence. Numerical presets remain synthetic and no solver, expert or profitability certification is claimed.

The302-row acceptance tracker remains76PASS /0FAIL /5BLOCKED /221NOT_EXECUTED, updated with scoped evidence and unexecuted gaps; automated tests do not equal accepted requirements. All86 deferred features and original specification records remain hash-verified. G3 retains conditional user signoff; physical iPhone export remains **AWAITING USER VERIFICATION**. No tournament or unrelated deferred features were added.

Recommendation: publish the mechanically verified incremental improvement as labeled synthetic practice, but **do not grant full synthetic cash-release realism signoff yet**. Next: investigate public range adaptation under repeated small-bet/jam probes; preregister fresh longer held-out sessions after any fix; expand rare river/side-pot conditional coverage; obtain rights-cleared human data or actual independent expert review; complete physical iPhone export verification. Never tune to this consumed holdout and then reuse it as unseen evidence.
