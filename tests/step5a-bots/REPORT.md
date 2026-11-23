# Step5A targeted bot investigation

Runtime changed only the narrow, proven losing guaranteed-chop case. Generic strong-regular continuation, risk premiums, range inference and sizing remain unchanged. Policy1.2 is frozen for existing sessions; new policy1.3 contains the correction. No human-frequency calibration, solver solution or independent expert approval is claimed.

## The original0/30 result

PASS: reconstructed all64 original stronger-reg/probe-shove hands, every committed event/action and ending stack. The30 observed oversized opportunities were **all turn**, not river. None held the absolute nuts. Original version1.2 and new1.3 distributions are identical in all30 states, so the before/after result remains0/30. Full public sequences, test-only hidden holdings, legal bounds, stacks, memory, traits and the complete inferred range are retained in `evidence/original-thirty.json.gz`. Hole cards not visible to the acting player are labelled audit-only and never enter observations.

The30 continuation probabilities sum to1.194 expected continuations. Conditional on these fixed decision states and independent policy draws, the probability of zero continuations is18.134%. This is a conditional path calculation, not a confidence interval or a replay with alternative branches. The observed0/30 comprises only7 contributing blocks; it cannot support a claim that the stronger regular always folds oversized bets.

Independent enumeration of all1035 available opposing holdings and44 possible river cards per state (1,366,200 ranked runouts total) gives28 negative and2 positive callEVs under **the bot's own synthetic inferred range**. It does not certify that range as correct. See `evidence/exact-original-posteriors.json` for exact equity,96-trial estimate, standard error, price, risk premium and decision threshold.

| Recorded state | Exact inferred-range equity | Break-even price | Conditional callEV | Original continuation |
| --- | ---: | ---: | ---: | ---: |
|22 on8s Td Js2s;300BB starting stack |57.81% |49.57% |+9846.84c |11.47% |
|Ad As onJh Qs5h5c;175BB |79.02% |46.51% |+22757.20c |69.70% |
|Ad5d onKd9sAs5s;300BB |48.16% |49.61% |−1733.95c |6.86% |

Root cause is a combination of mostly weak/drawing hands, very large bet prices (1.52–74.5pot increments), value-weighted synthetic action priors, conservative risk/size adjustments, bounded96-trial equity noise and the recorded random draws. No unmatched-chip incentive or illegal-action filtering error was found in this30-state reconstruction. The set and AA folds were possible under their distributions; AA was more likely to continue than fold.

The high-stakes set response has a17.17percentage-point synthetic risk premium; AA has19.24points. These can suppress profitable calls under the model's own posterior. They might model distrust of an uncertain prior, but their strategic magnitude is **not expert-validated**. This remains a disclosed strategic-plausibility limitation. We have not asserted all30 folds were strategically correct or adjusted a quota to force calls. Against the probe's true any-two policy, many folds are exploitable; observing several actions is not the same as knowing that policy.

Example complete public prefixes (amounts in cents; full histories are in the retained evidence):

- Ac5s,75BB: SB limp100, BB check; Ad9s3d flop BB bet300, SB raise-to600, BB call300; Kc turn BB check, SB shove14200 into1600; BB fold. Bot sees no future card or Jd7d opponent holding.
-22,300BB: SB raise-to565, BB call365;8sTdJs flop BB bet200, SB call200;2s turn BB shove59235 into1530; SB fold. Actual8h3c is audit-only.
- AA,175BB: SB limp100, BB raise-to778, SB call578; JhQs5h flop BB check, SB bet200, BB call200;5c turn BB bet1467, SB raise-to34022, BB fold facing32555. ActualTd8c is audit-only.

## Confirmed defect and repair

PASS: on a royal-flush board in a100BB heads-up hand, the old `absoluteNuts` guard forced a call although every holding ties. With400c already in the pot,19800c remaining call and5% rake capped500c, calling pays19750c versus keeping19800c by folding: **−50c guaranteed**. Original evidence: `terminal-tie-before.json`.

Policy1.3 now proves only the narrow HU river shared-board case with no raise alternative. It computes the integer-cent split after rake and button-based odd-chip allocation; a provably negative call folds. Positive/zeroEV chops continue. Private winning nuts retain their protection. Multiway cases are excluded from this proof rather than approximated by equal division across potentially different pot tiers.

Fresh post-freeze holdout:120 shared-board cases (74negative,46positive; zeroEV tested separately),40 private royal cases, both buttons, unequal stacks, refunded excess, three board forms, variable rake/cap and odd cents. All matched exact settlement; no false shared-board classification. Saved1.2 decisions retain their original behavior at fixed random tokens.

## Independent stratified sensitivity matrix

PASS:9 hand strata ×3 public-memory conditions ×1000 actual policy samples =27,000 legal decision opportunities. All proposed actions were applied to cloned authoritative states and conserved chips. Evidence includes public-memory source histories, exact conditional range computations, policy inputs, counts and conditional Wilson intervals in `stratified-matrix.json.gz`; readable counts in `stratified-summary.json`.

Reference ranges use exact enumeration independent of production range inference/sampling. Turn matrix EV assumes a check-down after calling: no further payments, folds or range changes. It is not full future-street decision EV. Strong value versus high-card air is mixed at10/40/70% air. “Balanced” is explicitly a40%air break-even reference against a pure bluff-catcher facing a2-pot terminal bet; it is not a complete solved strategy. The bot does not receive the true mixture label. Manufactured public history fixtures distinguish passive, mixed and frequent aggression, with only permitted showdown observations.

| Hand / board | Passive history | Mixed history | Frequent-aggressor history |
| --- | ---: | ---: | ---: |
|Private nuts |1000/1000 |1000/1000 |1000/1000 |
|Set |998/1000 |998/1000 |997/1000 |
|Top two pair |999/1000 |998/1000 |996/1000 |
|QQ bluff-catcher |581/1000 |827/1000 |992/1000 |
|Weak air |5/1000 |6/1000 |8/1000 |
|Nut-flush draw, turn |299/1000 |447/1000 |308/1000 |

QQ's independent conditional EV is−600/0/+600c against10/40/70% air, respectively. This demonstrates clear losing, close and profitable scenarios without requiring the bot to know the hidden range. Private nuts and strong value continue; weak air largely folds. Blocker card removal changes the reference combination sets as expected.

Known limitations: ace-high bluff-catchers continued only5–27/1000 even where the deliberately overbluffing70%air reference makes calls positiveEV. Draw and blocker decisions can be nonmonotonic under the96-trial deterministic equity sampler. Memory currently uses shrunk action rates; it does not infer a complete showdown-conditioned, action-specific opponent strategy. These prevent a claim of robust exploit resistance or expert-level play. No further risk/threshold tuning was applied after the freeze.

## Execution and status

- PASS: retained reconstruction, old/new unchanged original states, exact posterior enumeration, narrow-rake regression, old-version fixed-token compatibility, fresh holdout, stratified policy legality and chip accounting.
- Resolved harness failure: initial synchronous exact enumeration caused a Vitest workerRPC timeout after its assertions completed. The report is preserved as `posterior-first-rpc-timeout.log`; yielding between rows and caching repeated own ranks fixed the harness. Clean rerun in `posterior.log` completed31.29s with no errors.
- PASS: TypeScript and scoped ESLint (logs included). This lane executed12 targeted executable tests, including batch fixtures; these counts are not302 acceptance requirements.
- NOT_EXECUTED by this lane: browser/deployment, independent expert strategy review, measured-human calibration. Parent owns full regressions/browser/publish and overallR1 decision.
- No acceptance IDs or deferred features changed. Tests and audit evidence are not product-visible hidden-card controls.
