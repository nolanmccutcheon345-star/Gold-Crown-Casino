# Step5D held-out F10 results and interpretation

Protocol/executable frozen before outcomes at `2e0e0d3`; unchanged production policy `synthetic-cash-1.6.0`, engine0.4.0, exact `practice-cash@0.1.0` test profile (no rake). This is a new independent synthetic diagnostic, not measured-human calibration, solver validation, expert certification or full poker decisionEV. Exact room version is taken from the test helper, not assumed to be the production setup default.

**49,152legal decisions**,192fixed situations,576conditional range cells,24holdings across12new board families,40/150BB, checked-to and33%/150%/300%pot. Four new stable identities ×32paired draws =128opportunities per archetype/situation. Execution took15.700s on the recorded Node/Linux environment. Every submitted action was accepted by the authoritative engine with accounting invariants. Complete public histories, own cards, board, legal actions, stacks, all profiles/decision distributions and independent action utilities are preserved in the gzip artifact; compression removes no records.

| Diagnostic | Observed |
|---|---:|
| Mean strong-minus-weak one-node utility | +343.99c |
| Descriptive12board-family bootstrap95% | +169.28c to+556.08c |
| Positive/negative/tied conditional cells | 454/101/21 |
| Value-heavy / broad / recreational range mean | +428.17/+352.87/+250.93c |
| Checked-to /33% /150% /300%pot mean | +140.01/+281.59/+451.84/+502.52c |
|40BB /150BB mean | +166.90/+521.08c |
| Trips-only mean | -123.84c |
| Mean excluding full houses (post-outcome sensitivity) | +164.12c |
| Mean excluding flushes and full houses (post-outcome sensitivity) | +123.47c |

The two exclusion summaries are explicitly post-outcome sensitivity checks, not predeclared acceptance thresholds. Eleven of12board-family means are positive; broadway-four-straight is−4.63c. All101negative cells remain. The largest is a set of eights facing300%pot on8c9dTh4sJc at40BB against the stipulated recreational range: strong-minus-weak−3096.16c. The reference assigns enough weak hands to this oversized betting range to reward more continuation. The production bot has no privileged knowledge of that stipulated range; this does **not** independently prove a mechanical defect or justify an arbitrary calling quota. Trips on danger boards deserve continued strategic research.

Additional independent verification: **23,760/23,760exact hand-comparison outcomes agree with PokerKit0.7.7** (all990compatible opponent holdings for each of24own holdings). A separate enumeration identifies mathematically unlosable holdings: stronger-reg folded **0/5,376priced opportunities** at those nodes. These checks validate the reference rankings and the recorded nuts-fold property; they do not calibrate opponent ranges or certify every decision.

## Recommendation

The expanded held-out evidence supports the original requirement's **average** stronger-versus-weak adjustment within the explicitly declared synthetic validation domain: mean advantage is positive at both depths, every price/context and every stipulated range, with a positive descriptive board-cluster interval. It does not say the stronger regular is always best;101negative cells and negative trips-only subgroup are disclosed. **Propose F10 PASS only after integration review of this scope and the unchanged original criterion.** The lane does not edit its canonical status. This is a bounded synthetic R1 claim, not universal poker optimality, human/expert calibration or profitability. If the integration owner judges the stipulated no-re-raise reference insufficient for the intended criterion, keep wholeNOT_EXECUTED and retain these results as partial evidence; do not tune the reference to obtain approval.

The original0/30small-bet-then-shove research finding is not relabeled or supposedly solved by this different diagnostic. No production strategy, action quota, risk penalty, hand selection or sizing distribution changed.

## Executed commands

`STEP5D_GATE_EVIDENCE_DIR=tests/step5d-gates/evidence/river node node_modules/vitest/vitest.mjs run tests/step5d-gates/river-heldout.test.ts --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=tests/step5d-gates/evidence/river-vitest.json`

`RUN_ORACLE=1 PYTHONPATH=/workspace/scratch/4441cfdf5595/pokerkit-reference node node_modules/vitest/vitest.mjs run tests/step5d-gates/river-reference-review.test.ts --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=tests/step5d-gates/evidence/reference-vitest.json`

**1/1held-out diagnostic and2/2reference-review tests passed**. Later changes only compress the full evidence and redirect future outputs to `evidence/current-run` so full-suite concurrency cannot overwrite the frozen review artifact. Raw source hashes remain those actually executed. Nineteen qualification-contract tests passed separately; they do not count as nineteen passed V7 requirements.
