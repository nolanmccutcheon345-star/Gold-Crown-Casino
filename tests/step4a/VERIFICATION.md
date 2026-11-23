# Step 4A independent verification checkpoint

Runtime tested: policy changes through `89665b70e67762e051b1d84f4e4fb7d06b01d5e9`, policy version `synthetic-cash-1.0.0`. Independent test/evaluator source: `32d825318453c46116923c0787b5ab0ad285b94c`. All eight runtime SHA-256 entries in `run.json` were compared with integration main and matched exactly.

These are designed synthetic opponents. This checkpoint establishes the listed mechanical, privacy and conditional behavioral properties. It does **not** establish realistic human frequencies, solver quality, calibrated opponent ranges, coaching validity or real-poker performance.

## Executed evidence

- `npm test -- tests/step4a --reporter=verbose`: **28/28 PASS**, zero failures/skips, including five secrecy/cache/memory tests, five canonical-history projection tests, four independent opportunity-denominator tests, seven severe-hand/context regressions and the two forced-draw checks.
- Full experiment: `STEP4A_EVALUATE=1 STEP4A_REPORT_DIR=<directory> npm test -- tests/step4a/evaluate.test.ts --reporter=verbose` exited0. **256,000 controlled decisions**, 32 contexts ×8 fixed seeded profiles ×1,000 decisions. **13/13 preregistered/prospective behavioral checks PASS**.
- **1,600 complete engine hands**, 400 each at2/6/9/10 seats, generated **21,352 legal decisions**. Every hand terminated, every checked decision was legal, every sealed deck had52 unique cards, and final stacks plus rake conserved initial chips. Maximum36 decisions per hand. There were866 showdowns,734 uncontested endings and90 hands with multiple pots.
- Typecheck and lint passed. These runs do not substitute for the integrator's whole-repository regression, oracle or actual browser testing.

Raw final evidence supplied to the integrator: `/workspace/scratch/4441cfdf5595/step4a-final-evaluation/` (`run.json`, `controlled-decisions.json`, `complete-hands.json`, `SUMMARY.md`). Focused runner log: `step4a-final-focused.log`. The source manifest and JSON contain exact counters, denominators, Wilson intervals, profiles, source hashes and scenario diagnostics.

## Controlled results

Each count below is out of1,000 matching conditional decisions, **not** a VPIP/PFR estimate. Intervals are descriptive95% Wilson intervals for this synthetic Monte Carlo experiment.

| Context / action | TAG | Stronger regular |
|---|---|---|
| Unopened AA / raise | 962;94.83–97.22% | 963;94.94–97.30% |
| Private royal flush on river / raise | 1000;99.62–100% | 1000;99.62–100% |
| Cheap forced nut-flush draw / call | 984;97.42–99.01% | 988;97.91–99.31% |
| Flop nut-flush draw + two overcards, half-pot / fold | 76;6.11–9.41% | 59;4.60–7.54% |
| Weak private heart on four-heart river, overbet / fold | 580;54.92–61.02% | 494;46.31–52.50% |

The forced-draw proof enumerates all1,035 legal opposing holdings for AhKh on Qh7h2c3d. At least7 of44 possible river cards produce an outright win through a heart, even discounting dirty paired-board outcomes. Calling200 into a final2400 pot costs8.33%, below the15.91% conservative win bound. The no-future-betting, no-rake payoff lower bound is+181.82cents. This one narrowly defined positive-payoff result is not a general decision-EV model.

Whole-hand rates have separately audited denominators. Example six-seat cohort:

| Profile | VPIP count/opportunities | PFR count/legal raise opportunities | 3-bet count/opportunities |
|---|---:|---:|---:|
| Nit | 74/300 | 28/300 | 4/120 |
| Station | 201/300 | 27/300 | 13/166 |
| TAG | 98/300 | 61/300 | 20/140 |
| LAG | 155/300 | 86/300 | 18/126 |
| Fit-or-fold | 77/300 | 30/300 | 5/132 |
| Maniac | 204/298 | 135/298 | 39/121 |
| Passive recreational | 168/300 | 41/300 | 11/154 |
| Stronger regular | 93/300 | 44/300 | 13/134 |

The recorded table configurations use fresh mixed stacks, independent deck/button/seat-assignment/policy streams and alternating explicit rake profiles. They are descriptive synthetic cohorts, not population targets. Actors within a hand are correlated; opportunity intervals do not validate human frequencies. No across-hand memory is used in this cohort; public memory has separate projection/privacy tests. Internal public-memory `pfr` is an explicitly documented observed-raise/acted-hands proxy, not the canonical legal-raise-opportunity statistic above.

## Completed-hand example inspected

This is a deterministic **engine** example, not a browser hand: `step4a-sim:6:4909665`, button2, $1/$2 blinds at seats3/4. Starting stacks in seat order were$100/$200/$400/$40/$100/$200.

- Preflop: seat5 calls$2; seats0/1 fold; seat2 calls$2; seat3 completes$1; seat4 checks. Pot$8.
- Flop Qc6sKh: seat3 bets$4; seat4 folds; seat5 calls$4; seat2 folds. Pot$16.
- Turn Kd: seats3/5 check. River3s: seats3/5 check.
- Seat3 shows6c6d, sixes full of kings; seat5 showsAs2c. Seat3 receives$16. Rake$0, refunds$0.
- Ending stacks: $100/$200/$398/$50/$98/$194. Total$1,040 before and after; the winner gains$10 and other losses total$10. Full authoritative event sequence, pots and payouts are in `complete-hands.json`.

## Defects found and repaired

1. Initial nit/TAG/stronger profiles folded unopened AA383/228/215 times per1,000; private royal-flush overbet folds were231/120/81. These were structural coherence failures. Later repairs produce zero folds in those contexts.
2. Initial repair still produced excessive competent-profile AA limps and terminal private-nut flat calls. New prospective value guards were registered before their repair and now pass.
3. A strictly profitable, forced cheap nut-flush draw had TAG fold probability82.374%. The independent payoff proof and failure were preserved; the final exact decision distribution and sampled984/1000calls pass the continuation guard.
4. The blanket strong-made-hand safeguard treated weak four-suit flushes like private monsters. Final tests distinguish weak flush from nut flush and shared-board full house from private quads.
5. The evaluator itself initially correlated cyclic profile assignment with button position and adjacent first RNG draws. That first whole-hand cohort is **not** used for final descriptive rates. Final seat/button/policy streams are independent and action draws are paired per sample; a raise-size draw cannot shift later matched samples.

Failed/earlier evidence was supplied separately as `step4a-first-evaluation/`, `step4a-corrected-evaluation/`, and `step4a-draw-bound-initial.log`. Sample protocols changed during test repair, so do not interpret raw count differences across those runs as a calibrated effect-size estimate.

## Meaningful remaining limitations and next range work

Passing directional checks does not make the profiles human-realistic. The final nit continues early-position JTo450/1000 times (245raises); that marginal broadway entry is loose for the intended tight label. The six-seat nit cohort VPIP is74/300 (24.7%), versus59/500 (11.8%) at ten seats. These labels currently describe relative rough priors, not validated position-dependent ranges.

Other recorded priorities for4B:

- Stack sensitivity is weak in the97s facing-open contrast: TAG continues141/1000 at20BB versus147/1000 at200BB. This is detectable but not a validated deep/shallow strategy.
- Missed-AK flop initiative increases TAG betting from43/1000 to72/1000 and stronger regular from72/1000 to109/1000. Whole-hand continuation-bet samples are small; barrel/initiative frequencies remain uncalibrated.
- Whole-hand check-raises were TAG2/62 and stronger regular1/51. These small samples and low observed rates warrant broader value/bluff/check-raise range scenarios, not a realism PASS.
- On a shared-board full house facing an overbet, TAG folds907/1000 and stronger regular874/1000. Private quads are distinguished correctly, but no persistent weighted opponent-range or tie-aware strategy model has been established by this work.
- No legally sourced human holdout or venue/player-disjoint calibration has been run. Wider169-class opening/limping/cold-calling/3-betting ranges, sequence-conditioned ranges and external baseline comparison remain future work.

## Acceptance boundaries

E01–E05 and R13/R14 receive narrow executed privacy evidence: unseen/folded cards, future deck and arbitrary annotations are inaccessible through the tested observation/history interfaces; consistent seat relabeling preserves decisions. This is local interface privacy, not a claim that local browser private storage is cryptographically inaccessible to its owner.

R03–R07 and R09–R12 receive measured scenario evidence, not exhaustive range/realism acceptance. R08 weighted evolving ranges, broader R17 sequence modeling and R18 human holdout remain unestablished. No original acceptance CSV or any of the302 requirements/86 deferred IDs was modified by this independent lane. Actual browser hands and publication are the integrator's evidence, not these headless results.
