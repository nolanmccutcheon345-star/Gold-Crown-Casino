# Independent Step 4A evaluation plan

Authored against contracts `4674db4`, before importing the new policy implementation. All opponents and experiments are synthetic. These tests do not establish human realism, human validation, solver accuracy or decision EV.

## Controlled decision experiments

Sample 1,000 decisions per archetype per context with fixed, separate policy seeds. Record exact fold/check/call/raise counts and 95% Wilson intervals. Context-specific action counts are **not** VPIP/PFR estimates. Scenarios start from executable engine states and sampled actions must be legal when applied to those states.

1. Unopened marginal hands: early-position versus button action. The latter legitimately includes earlier folds, so this is an unopened-position/remaining-field contrast, not a pure causal position estimate.
2. Marginal hands facing an open versus a re-raise: fewer loose continues when facing stronger prior action. AA remains a useful nondegeneracy control, with no arbitrary real-player frequency target.
3. Limped versus unopened pots: distinguish passive entry and isolation. Do not count every legal preflop action as a raise opportunity when raising is closed.
4. Matched heads-up flop price: a weak made hand should fold at least as often to a 2-pot bet as to a small bet. A live flush draw should affect continuation/semibluffing; after a missed river it cannot retain live-draw value.
5. Same pot/board and different preflop aggressor: continuation-bet behavior should use public initiative rather than only cards.
6. Heads-up versus multiway air at matched pot-fraction price: inspect suppressed bluffing and record the changed SPR/field-size confound explicitly.
7. Short versus deep effective stacks: inspect decision and sizing changes; do not presume every archetype moves identically.
8. River nuts, marginal bluffcatcher and missed draw: inspect value/bluff separation, legal sizing and excessive fold/raise degeneracy.

Broad archetype hypotheses: station continues marginal hands more than nit; maniac raises air more than passive profiles; TAG raises strong hands more than station; fit-or-fold gives up missed flops more than stronger regulars. These are behavioral design checks, not empirical labels. Report failures and distributions rather than editing target bands after seeing output.

## Complete legal hands and denominator audit

Run 1,600 deterministic complete hands: 400 each at 2, 6, 9 and 10 seats. Rotate the eight profiles through seats, use independent deck and policy streams, and exercise short/deep stacks and explicit rake. Assert unique cards, legal sampled actions, engine accounting, nonnegative stacks, maximum bounded hand length and total payout plus rake conservation.

Collect once-per-hand/player VPIP opportunities (at least one voluntary preflop decision), PFR opportunities (at least one legal preflop raise), and 3-bet opportunities (exactly one prior raise with a legal raise available). Collect flop continuation-bet opportunities for the last preflop aggressor when facing no flop bet; fold-to-price opportunities only when facing a positive call; check-raise opportunities only after the same player checked that street and later faces a legal raise opportunity. Each metric records numerator, denominator, interval and definition. Diagnostic decision-level quantities are labeled as such.

## Privacy and recovery boundaries

- Trap getters for Hero/other private cards, unrevealed deck and private profiles must never be read by public-memory projection or policies.
- Consistent seat relabeling must preserve sampled action under identical entropy; no privileged Hero/seat-zero treatment.
- Mutating unseen cards/future deck must leave observation and decision unchanged.
- Sampling must not mutate observations, legal state or historical inputs.
- Production controller tests cover persisted reservation/decision, legacy policy dispatch and recovery; authored browser staging is not executed browser evidence until the integration owner runs visible controls.

Original acceptance rows stay unchanged until the integrator records executed evidence. No standalone browser is launched by this lane.

## Prospective coherence checks after the first observed failures

The first run exposed excessive AA/nut folds. After those were repaired, review exposed excessive competent-profile AA limps, terminal nut flat-calls and draw folds. The following new guards are registered before their policy repair; they are behavioral design constraints, not fitted real-player frequencies:

- TAG and stronger regular raise unopened AA at least90% and raise a terminal royal flush at least95% when an opponent still has chips and a raise is legal. At terminal no-rake heads-up nuts, raising cannot reduce the award if the opponent folds and can increase it if called; there is no later street to induce.
- TAG and stronger regular continue at least90% when holding AhKh on Qh7h2c3d and facing a200-cent all-in into2000. Calling costs200 for a2400 final pot (8.33%). Enumerate every legal opponent holding and the remaining heart river cards independently; verify at least7 of44 rivers are outright wins (15.91%) even allowing dirty board-pair outs. This gives a conservative positive-EV bound with no future betting cost. It is not a full decision EV model.
- Ordinary non-all-in flop half-pot draw continuation remains a measured qualitative contrast, not a range-free equity theorem; future betting cost and opponent range matter.
- Four-heart river low flushes and shared-board full houses must be distinguished from the corresponding nut flush/private quads. Report actual frequencies; do not impose a made-up calibrated target.
