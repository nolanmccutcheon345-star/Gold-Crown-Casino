# Step4C independent evaluation results

Runtime tested: root frozen candidate `9522e55`, strategy `fb11262` and preflop `4b023d9`; verifier worktree contains equivalent runtime via `b305d92`/`ea0453a`. No policy changes were made in this lane. Baseline is preserved Version6 policy1.1; candidate is1.2. All results are synthetic. No external expert reviewed these hands and no human dataset was processed.

## Executed evidence

The final lane test run passed17/17 across4 files; root independently runs the repository suite. Large-batch counts below are scenario counts, not extra unit tests or V7 acceptance requirements.

- Development baseline:1,440 population hands +1,024 probe hands.
- Fresh paired evaluation:1,440 population hands per model and4,096 probe hands per model. Each population cohort has72 table/personality blocks; probes have8 blocks×8 hands per archetype/probe.
- Conditional evaluation:49,152 sampled responses/model =6 families×8 archetypes×8 board/personality variants×128 action draws. Every sample independently validated against legal actions.96 complete recorded policy continuations/model; prefixes explicitly scripted.
- Additional side-pot coverage:96 completed candidate hands across all8 archetypes, after the random populations produced no side-pot hands. This is a disclosed coverage follow-up, not a blind holdout.
- Total batch hands:13,824, with84,516 legal action events including the identified scripted prefixes.98,304 conditional response samples are separate. Repeated execution for test-runner repair is not added again.

Protocol and seeds were committed before candidate evaluation (`b0b794d`, expanded conditional fixtures `7c36c84`). Fresh deck/action seeds and novel25/75/175/300BB probe depths were used; population configurations/personality schedules were retained for controlled comparisons. This is an operational synthetic holdout, not blinded human validation. Do not reuse these consumed outcomes as unseen evidence after tuning.

## Observed population rates

Each row pools the planned mixed seat/depth/skill/rake/environment cells. VPIP counts voluntary call/raise among hand-player records with a voluntary decision; PFR requires a legal preflop raise opportunity. These are not six-max default-profile opening ranges. Intervals bootstrap whole table/personality blocks, preserving within-block dependence. Conditional cells under100 opportunities or8 blocks are explicitly marked insufficient; no strategic pass threshold is inferred.

| Archetype | Before VPIP | Candidate VPIP | Candidate VPIP95% | Before PFR | Candidate PFR | Candidate PFR95% |
|---|---:|---:|---:|---:|---:|---:|
|nit|65/1144 (5.68%)|82/1160 (7.07%)|5.44–9.04%|44/1138 (3.87%)|52/1154 (4.51%)|3.30–5.95%|
|tag|180/1461 (12.32%)|221/1482 (14.91%)|12.74–17.25%|152/1453 (10.46%)|176/1473 (11.95%)|9.88–14.11%|
|lag|242/1329 (18.21%)|288/1346 (21.40%)|18.25–24.48%|197/1326 (14.86%)|235/1342 (17.51%)|14.90–20.33%|
|station|340/1051 (32.35%)|376/1061 (35.44%)|32.19–38.99%|134/1048 (12.79%)|137/1058 (12.95%)|10.47–15.55%|
|passive-reg|350/1326 (26.40%)|396/1344 (29.46%)|27.18–32.27%|183/1319 (13.87%)|199/1336 (14.90%)|12.88–16.96%|
|maniac|295/877 (33.64%)|332/892 (37.22%)|33.16–41.23%|243/875 (27.77%)|271/890 (30.45%)|25.91–34.53%|
|fit-or-fold|107/1105 (9.68%)|132/1132 (11.66%)|9.64–13.85%|68/1098 (6.19%)|88/1125 (7.82%)|5.84–9.93%|
|stronger-reg|154/1019 (15.11%)|187/1034 (18.09%)|15.58–20.92%|118/1010 (11.68%)|147/1022 (14.38%)|11.80–17.19%|

Candidate population:1,440 hands,13,273 actions,554 flops,292 multiway flops. Exact opportunities for limps, overlimps, isolation, cold calls,3/4bets, squeeze, fold3bet, blind defense, cbet, barrels, checkraise, draw actions, value/air proxies, bluff-catching, WTSD/W$SD/WWSF are in `evidence/population-key-rates.csv` and compressed summaries. Position, depth, seat count, environment, skill, rake, selection, board, street, previous-action node and HU/multiway are marginal breakdowns; they are not a fully powered joint-factorial experiment. Absent metrics in a raw summary mean zero observed opportunities, not a zero-frequency strategy.

Candidate Node decision preparation p50/p95/max:0.081/17.757/80.217ms across13,273 decisions. Runs shared the machine with other work. Node process heap snapshots include retained evaluation records and are not live-browser memory measurements. Parent owns real browser/physical-device verification.

## Independent correction checks

Fresh37BB focus versus175BB opponent: after1BB limp/check, the deeper opponent shoves on flop. Actual focus call36BB; contestable post-call pot74BB. Correct price36/74=48.64864865%, while baseline used16.98113208% by including uncallable excess. Candidate matches independently derived commitment-tier arithmetic on all8 novel board variants. With Ac7d across these varied flop patterns, TAG calls912→14/1024; stronger951→16/1024; station791→22/1024. The reduction is tied to corrected price, not an action quota.

Fresh three-player43BB focus versus175/95BB opponents: both deeper opponents commit61BB, focus can contribute43BB. Call42BB into129BB contestable =32.55813953%, versus old25.45454545%. TAG calls120→43/1024; stronger121→43; station208→104. Candidate price matches all8 independent fixtures.

Unchanged-river controls retain exactly the same before/after sampled counts. Missed-draw river raises: TAG182/1024, station43/1024, stronger185/1024. No-pair/no-current-draw river raises: TAG113/1024, station35/1024, stronger127/1024. This rejects automatic always/never behavior in these specific contexts, not every possible betting line. The “small river” fixture is clamped by the legal$2 minimum into a$4 pot, so it is a half-pot wager—not a quarter-pot wager.

## Complete-hand review packet

`evidence/expert-review-packet.json.gz` contains14 fully recorded review hands. Status is **NOT_REVIEWED_BY_EXTERNAL_EXPERT**. Sealed test cards are present for post-hand audit only; acting bots receive their permitted observations.

- Coherent candidate example: TAG Kd5c, board Ks8h3h9c2d. Scripted limp/check and checked flop/turn; opponent bets$2 into$4 on river. TAG calls$2 and beats8s5s, receives$8; starting$274/$350 becomes$278/$346. Described as an analytical example, not expert endorsement.
- Confirmed defective baseline example: strong regular Ac7d at37BB faces a175BB opponent flop shove. Baseline falsely prices the capped call at16.98%; corrected candidate uses48.65% and folds this representative hand. The defect is arithmetic regardless of the particular hidden opponent holding or outcome.
- Side-pot follow-up: top set with AcAd on Ah7h2c calls under a43BB cap while two deeper players have each committed61BB; all96 actual policy continuations retain at least two pot tiers and independently conserve62600 cents. Prefix is scripted; subsequent choices and runouts use policies/engine.
- Questionable candidate line: strong regular Ac5s in a75BB game checks BB after a limp, bets$3 on Ad9s3d, calls a minraise to$6, checks Kc, then folds to a$142 turn shove. This can be reasonable with an uncertain value-heavy prior. Against the fixed repeated pressure probe, its aggregate failure to continue merits longer adaptation tests; it is not automatically a mechanical bug.

## Exploit probes and remaining weaknesses

Eight new observation-only probes ran: quarter-pressure, river-polarizer, thin-value, missed-selective, never-fold, stack-pressure, probe-shove and multiway-squeeze. Focus/button roles rotate.64 hands and8 clusters per profile/probe give outcome intervals but still weak rare-tail coverage; response denominators are often much smaller. True probe identities are never passed to the evaluated bot.

Stronger regular versus probe-shove: mean+1.773→−2.340BB/hand; candidate block-bootstrap95%[−3.918,−0.597]. It continued0/30 observed oversized-bet opportunities,7 contributing clusters. Cluster response interval is withheld; conditional Wilson upper11.35% does not address cluster dependence or unseen premium tails. TAG versus missed-selective averaged−3.818BB/hand [−8.456,−0.508]. These are follow-up priorities for public-memory adaptation and polarized-range assumptions, not established mathematical exploitability bounds. Most other intervals are broad; positive probe results do not prove real-money profitability.

Actual postflop sizing included410 raises across115 archetype/street/hand-class cells; none of those fine cells reached100 observations. Size distributions are retained, but evidence is insufficient to rule out exploitable sizing tells. Hand-strength association is confounded by board, price and multiway context. Value/air/draw labels are independently defined operational proxies, not true bluff intention or solver EV.

## Privacy, failures and evidence boundaries

Executed tests prove equal observations/actions when undisclosed other cards and future cards change, no reads of forbidden getter fields, normalized nonnegative range weights with known-card removal, cyclic-seat/Hero-name invariance, legal complete hands, unique decision events and independent pot/payout reconciliation. These tests address application-level isolation; client-side state is not cryptographically hidden from developer tools.

Harness defects repaired transparently: first no-flush-draw fixture had an actual wheel gutshot and was replaced with a truly no-draw holding; role-relabelling fixture initially forgot legal.actor and was corrected; small-bet classification initially used a changing pot denominator, so it was frozen at the wager event and baseline rerun. First candidate probe run completed outputs but hit a Vitest60-second worker RPC timeout; yielding between independent blocks fixed the runner, and the complete candidate probe cohort reran successfully. Original failures remain in evidence; none is silently marked PASS.

A: applicable mechanics checks PASS with this lane and parent regression evidence. B: functional, distinct synthetic policies PASS for tested contexts, with material behavioral limitations retained. C: independent expert-reviewed plausibility NOT_EXECUTED. D: statistically validated human resemblance NOT_EXECUTED/BLOCKED by absent suitable verified human holdout.

Recommendation: publish the tested synthetic development improvement, but withhold full realism and R1 release signoff. Continue with longer independent pressure/adaptation cohorts, tail-stratified call tests, controlled size-tell analysis and actual independent expert review. Do not tune on these samples and reuse them as fresh validation. Physical-iPhone export remains AWAITING USER VERIFICATION; this lane performed no physical-device test. All302/86 registers remain parent-owned and unchanged by this lane.

## Reproduction

Use `STEP4C_MODEL=baseline-1.1|candidate-1.2 STEP4C_COHORT=development|heldout STEP4C_MODE=population STEP4C_REPORT_DIR=<raw-directory> scripts/step4c-evaluate.sh` (72blocks×20hands). For probes set `STEP4C_MODE=probes STEP4C_PROBE_BLOCKS=8 STEP4C_PROBE_HANDS=8`; development used2blocks×8. Conditional runs use `STEP4C_MODEL=... STEP4C_CONDITIONAL=1 STEP4C_REPORT_DIR=... node node_modules/vitest/vitest.mjs run tests/step4c/conditional.test.ts`; side-pots use `STEP4C_SIDEPOTS=1 ... tests/step4c/sidepot.test.ts`. Packaging: `python scripts/step4c-package.py --baseline <raw-baseline> --heldout <raw-heldout>`. Raw payload hashes are in `evidence/manifest.json`.
