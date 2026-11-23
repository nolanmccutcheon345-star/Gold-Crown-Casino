# Step5C independent gate verification

Source `c409bab5a3b325b10806ff24345c91272e793da8`; production policy `synthetic-cash-1.6.0`, unchanged in this lane. Frozen protocol is commit `05f84499bba53006ddf0a029f35244614cad39c0`. No result was used to tune a policy, seed, fixture, response assumption or acceptance threshold.

Executed:

```sh
STEP5C_ECOLOGY_FULL=1 STEP5C_GATE_EVIDENCE_DIR=tests/step5c-gates/evidence/full-c409bab npx vitest run tests/step5c-gates/river.test.ts tests/step5c-gates/ecology.test.ts --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=tests/step5c-gates/evidence/full-c409bab/vitest.json
```

**4/4 tests passed, 0 failed, 0 skipped.** This is four executable diagnostics, not four V7 requirement PASS statuses. Independent evaluator and chip-utility algebra assertions passed. Typecheck/lint and separate original-register audit passed. Raw reports preserve exact public sequences, permitted own cards, legal actions, profiles, decisions, hypothetical ranges, independent utility and all canonical simulated hands.

## F10: useful evidence, still partial

8,192 actual legal sampled decisions in 3.307 seconds; 16 fixed river situations, 256 samples per archetype/situation (four stable identities × 64 paired seeds). Each action is evaluated against three predeclared, independently implemented response/range models. Strong regular minus weak recreational average: **+192.07 cents per decision**, equal-weighting the 48 situation/range cells. By model: value-heavy +179.21c, broad +196.75c, recreational +200.25c. There are **33 positive and 15 negative cells**. All board clusters retained; descriptive eight-board-cluster bootstrap95% is **−1.48c to +397.22c**. This interval includes zero and does not represent a human-population confidence interval.

Examples under the broad conditional range:

| Fixed situation | Strong minus weak utility | Observation |
|---|---:|---|
| Nut flush checked to | +192.53c | Strong profile uses larger value sizes more often. |
| K-high straight facing150%pot | +1,100.37c | Strong profile raises134/256 versus weak62/256. |
| Set of aces on four-heart board, checked to | −271.10c | Strong bets141/256 versus weak52/256; synthetic response model penalizes vulnerable value bets. |
| Low flush facing150%pot | −135.42c | Strong folds54/256 versus weak35/256; this declared opponent model rewards more calls. |
| Set of queens on four-straight board, checked to | −259.82c | Strong bets134/256 versus weak62/256 and incurs more modeled value-betting losses. |

**Fixture-label correction:** the original protocol prose called QhQc on AhKh8h4h2s a “third-nut flush”; because Ah/Kh are on the board, it is the **nut flush**. AsAd on that board is a **set of aces**, not an overpair. The frozen actual card fixtures, independently computed ranks, legal actions and numerical results were correct and unchanged. This annotation corrects labels without changing the benchmark.

The positive finite-sample average does not establish general superior dangerous-river adjustment. A no-re-raise artificial opponent response and undisclosed stipulated range are not a solver or a measured population; negative cells are research findings, not by themselves confirmed production mechanical defects. **F10 remains NOT_EXECUTED/PARTIAL** pending broader independently reviewed held-out dangerous-board/range coverage. Do not force continuation quotas or modify policies to win this diagnostic.

Raw evidence: `evidence/full-c409bab/F10-river.json`.

## Y10: continuous cash component, whole criterion remains unexecuted

**800 continuous hands, 9,169 actions, 16 independent50-hand table blocks**, completed in42.362seconds of Node execution. Six-seat loose-passive and nine-seat mixed lineups use mismatched25/40/65/100/150/200BB starting depths, stable personality identities and persistent public observations. Dealer advances and actual ending stacks carry to the next hand. **55 explicit engine top-ups** debit separate simulation wallets. Every completed hand independently reconciles contributions, refunds, rake and awards; every boundary conserves wallet+table+rake. This is functional simulation, not browser performance.

| Metric (actual opportunities) | Loose six,400hands | Mixed nine,400hands |
|---|---:|---:|
| VPIP | 580/2,335 =24.84% | 775/3,571 =21.70% |
| PFR | 266/2,335 =11.39% | 398/3,570 =11.15% |
| Open limps / priced unopened opportunity | 167/1,169 =14.29% | 139/1,501 =9.26% |
| 3-bets / first legal re-raise opportunity | 40/682 =5.87% | 70/1,427 =4.91% |
| Multiway flops / all flops | 99/217 =45.62% | 141/229 =61.57% |
| Top-up events | 21 | 34 |
| Hands with side pots | 0 | 1 |
| River pair-proxy calls / priced pair-proxy decisions | 13/15 | 5/9 |

Rare river samples are explicitly too small for a precise ecology claim. The populations differ in seating as well as composition; these rates are not a causal estimate of archetype effects. Exact opportunity definitions, eight-block descriptive intervals and all raise-size buckets are retained in `Y10-ecology.json`. They do not certify measured human likeness. Low observed air-betting and rare side pots deserve broader future review; no thresholds were adjusted to hide these observations.

Six complete hands were inspected using fixed selection rules: first hand, largest gross committed pot, first side-pot hand (or second hand when none) for each population. Their full records are in `inspected-complete-hands.json`.

- `5c:loose-six:0:0`: station limps QJ, second station checks AJ in big blind; checked-down KK55 board awards the ace kicker.500c contributed−25c rake=475c award.
- `5c:loose-six:5:18`: strong regular isolates77, checks full house on997flop, raises turn, value-bets four-spade river; station calls a king-high flush.20,886c paid−5,346c unmatched refund−400c rake=15,140c award. Slow play and later value line are internally interpretable; no claim this is universally optimal.
- `5c:loose-six:0:1`: limped two-player pot; nit with9J gains a full house onTT99turn, bets and takes a fold.600c paid−200c refund−20c rake=380c award.
- `5c:mixed-nine:0:0`: station KQ limps, strong regular65 checks big blind, all streets check; pair of sixes wins.500c−25c=475c award.
- `5c:mixed-nine:3:45`: station88 raises and later folds after strong regularAA/second stationQQ escalating action; AA's last2,683c go in on flop and QQ calls.65,087c−400c=64,687c award after all-in runout. The station's unusual3-bet/fold is retained, not removed as inconvenient evidence.
- `5c:mixed-nine:3:13`: stronger-regJTs opens then folds to a squeeze with callers. StationAA, short LAGKQ and maniacJ9 reachK3869; maniac's turn bet produces a short all-in call and two pots.27,386c−400c=26,986c toAA, split17,622c main+9,364c side. The maniac bluff and JTs preflop fold are candidates for strategic range review, not an assertion of optimality.

**Original Y10 remains NOT_EXECUTED/PARTIAL; its explicitly governed R1 cash component is PASS.** Automatic turnover/churn remains deferred FUT032 under V7 section9. `Y10_SCOPE_DECISION.md` explains the exact original text, existing scope separation and executed cash evidence. No original criterion is relabeledPASS and no required cash feature is newly deferred. The original criterion does not impose an additional named-human-expert signoff; synthetic functional evidence and complete-hand engineering inspection support the cash component without claiming independent expert or human calibration.

## Exact remaining-gate accounting

The read-only `scripts/audit-r1-gate-evidence.mjs` verifies all302original IDs and criterion fields, all86deferred entries, links, statuses and release decision. At the starting registry it found the exact14 gates: **F10, U10, U11, U16, Y10, Z02, Z03, Z12, V436, V513, V518, V522, V620, V707**. All215PASS rows had existing evidence files; file presence does not repair missing original build/version/input provenance. Current integration and browser evidence determine later status changes. Physical iPhone export remains **AWAITING USER VERIFICATION**. No human, physical-device, hostedCI or historic provider-wide write audit is fabricated.
