# Independent Y09 all-in boundary investigation

Current source in this isolated worktree: production policy `synthetic-cash-1.5.0` at `83b205d` plus test-only additions. This follows an independent acceptance fixture whose original blanket monotonic assertion failed; it does not edit that failed test or policy.

Reconstructed public line: three players each commit1000 preflop; flop5h8hJs; actor holds9c7d with3000 chips left; actor checks, player behind checks, initial raiser bets. The actor has eight gross straight-completing cards (four sixes and four tens). The policy’s6.8 clean outs are a synthetic two-tone discount, not an independently solved range-adjusted out count.

The broad1500 versus4500 bet comparison changes the actor’s future options:1500 call leaves1500;4500 is capped to the actor’s3000 and guarantees the actor sees the runout. Independent engine actions confirm this. Pricing is correct:1500/6000=.25 versus3000/9000=.333333;1500 excess is excluded in the latter. All-in realization can legitimately offset some increased price. These two broad contexts therefore do not justify a blanket monotonic claim or an arbitrary minimum fold/call quota.

A finer independent probe found a separate real approximation defect:

| Opponent wager | Actor call | Remaining after call | Price | Posterior equity | Stronger-reg defense | Station defense |
|---:|---:|---:|---:|---:|---:|---:|
|2999|2999|1|.333296288|.296296296|.046179286|.114431380|
|3000|3000|0|.333333333|.296296296|.322854806|.579422778|

The posterior equity is exactly unchanged, so this jump is not the previously fixed Monte Carlo seed discontinuity. `futureClosed` is binary; at exactly zero remaining chips, the second-card realization jumps from approximately.1425 to1, and future-cost discounts disappear. At2999 the actor can already legally raise all-in to3000, obtaining that runout for one additional cent. Treating a residual cent as substantial future exposure is inconsistent with the available actions.

Recommended investigation/fix: smoothly attenuate future denial/cost/realization with the actor’s effective exposure remaining after calling, reaching the existing all-in limit as that exposure approaches zero. Preserve real range changes, distinct personalities and legal choices; do not enforce global monotonic action frequencies. Version any policy change and rerun independent held-out near-stack-limit cases.

Actual executable diagnostic: `double-gutshot-review.ts`; full observations/policy inputs/mechanical outcomes: `double-gutshot-review.json`; console output: `double-gutshot-review.log`. Four wager contexts, four archetypes each, actual engine call/behind-fold continuations with accounting assertions. No solver, expert, human calibration or browser claims.
