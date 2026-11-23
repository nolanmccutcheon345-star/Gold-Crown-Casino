# Step 4C strategic audit and corrected pricing

This lane independently reproduced two mechanical policy defects. The authoritative engine already settled both cases correctly; it was never changed. Version 6 behavior remains frozen in `src/bots/v2`.

## Defects and resolution

1. **Inaccessible chips inflated call odds.** A legal heads-up $1/$2 hand began with $40/$200 stacks. After limp/check the pot was $4. The deep player shoved $198 on Qs7h2c; the short player held QdJd and could call only $38. Old analysis divided $38 by $240 (15.83%), counting $160 that the engine must return. The correct contestable pot is $80 and price is47.5%. In a separate three-way fixture, commitments after a capped call are $20/$50/$50; the short player can win $60, not the $60 higher side pot.

2. **A capped call disguised an overbet.** Old context treated that visible $198 shove into $4 as a0.2317-pot bet because it substituted the $38 call and used the inflated total pot. It now describes the actual visible49.5-pot wager. The actual effective call is still only $38; the pricing helper separately calculates capped exposure. This distinction prevents a large displayed wager from looking small merely because the caller is short.

`src/bots/pricing.ts` now exposes pure `contestablePricing`: call amount, contestable-after-call, excluded chips, immediate price, configured rake estimate and rake-adjusted price. It adds the call once, removes unmatched excess, caps contribution tiers at the caller’s final commitment, and retains folded dead money below that cap. This is advisory math only; no balances, game state or payouts are mutated. The practice rake estimate uses matched chips, the per-hand cap and the current no-flop-no-drop condition; the engine still controls actual rake at settlement.

Postflop reasoning model is now `public-range-postflop-1.2.0`. Range likelihoods and the exact engine evaluator were not changed. Root integrates the same helper into preflop.

## Executed evidence

- Original pricing regression:1 failed /1 passed. Overbet interpretation regression then independently failed. Both logs are retained.
- Corrected runtime gate:44/44 passed (new pricing tests plus existing range/response checks). Typecheck and lint passed. An earlier55/55 run also included existing complete sequences before the model-label-only bump; those sequences must use the current1.2 label when root reruns them.
- Final lane:13/13 passed across3 files. This includes actual legal settlement, rake, inaccessible side pots, no hidden getter reads, and same public decisions after real Hero-hole/future-deck counterfactuals on flop/turn/river for every archetype. There are384 paired seeded decisions across the three streets plus128 role-relabeled pairs.
- Paired conditional benchmark:4,096 complete continuations (8 profiles ×256 action seeds ×2 versions). They repeat one fixed public scenario, not4,096 independent dealt hands or population sessions. Every action passed through the engine and settled with exact chip conservation. Full seeded choices and representative complete public hand records are retained in `evidence/paired-short-call.json`.

## Conditional measured results

One opportunity is a call/fold decision facing the fixed short-stack overbet. Same cards, numerical personality and random draw in each version. The posterior showdown share is unchanged at0.78125. Thus the change is attributable to price/size interpretation, not a new hidden-card assumption. Intervals below are95% Wilson intervals for conditional seeded Bernoulli choices, not human confidence, population/session uncertainty or model uncertainty.

| Archetype | Before calls /256 | After calls /256 | After rate and95% interval |
|---|---:|---:|---|
| nit | 255 | 132 | 51.6% [45.5%, 57.6%] |
| station | 255 | 169 | 66.0% [60.0%, 71.5%] |
| tag | 256 | 162 | 63.3% [57.2%, 68.9%] |
| lag | 256 | 183 | 71.5% [65.7%, 76.7%] |
| fit-or-fold | 256 | 116 | 45.3% [39.3%, 51.4%] |
| maniac | 255 | 183 | 71.5% [65.7%, 76.7%] |
| passive-reg | 256 | 151 | 59.0% [52.9%, 64.8%] |
| stronger-reg | 256 | 189 | 73.8% [68.1%, 78.8%] |

These numbers are not tuned targets. The changed public range model still estimates QJ favorably against its uncertain shove hypotheses, so continuation remains substantial, especially for the strong regular. A true weak probe hand happens to lose the fixed runout if called; that fact is unavailable to the bot and is not a tuning label.

## Complete-hand examples and limits

In the heads-up called branch: SB posts $1, BB $2; SB calls $1; BB checks; flop Qs7h2c; BB bets $198; SB calls its remaining $38. Engine returns $160 to BB; turn6s, river3d. QdJd beats8c9c; $80 is awarded to SB. Final stacks $80/$160, total $240. The folded branch gives BB the $4 contestable pot and returns its unmatched $198; final stacks $38/$202. Both branches are legitimate and conserved.

In the raked three-way case: AA short seat raises preflop to $10, both deeper opponents call. Flop9h7d2c: the first deep seat shoves $40, the other calls $40, short AA calls only $10. Turn6s/river3d. Main pot $60 pays $55 after the $5 cap to AA; $60 side pot pays KQ over KJ. Final stacks $55/$60/$0 plus $5 rake equal $120.

**Classification:** the pricing defects and resolutions are analytically supported and quantitatively executed. No independent human expert reviewed these hands. No claim of solver-optimal play, real-human calibration or exploitability bounds follows. Existing tests found no new hidden-card, normalized-range or complete-sequence defect in the exercised cases. That is a scoped result, not proof covering all poker situations.

The posterior still uses synthetic likelihoods and bounded sampling. Strategic showdown share combines all active opponents rather than calculating separate tranche-specific equity; when a deeper player can win a side pot without beating an already-all-in short player, this may be conservative. Rake is an immediate estimate, not a future-street forecast. These remain explicit limits.

Reproduce: `STEP4C_STRATEGY_REPORT=1 ./node_modules/.bin/vitest run tests/strategy4c --reporter=verbose`. Runtime source commit: `fb11262`; later commits in this lane contain test/evidence only. Independent verifier reserved different stack/board cases rather than reusing this development fixture as held-out evidence.

## Integration fixture correction

The integration run exposed three legacy context hypotheses whose manual observation had contradictory betting data: acting BB had200c committed, opponent only100c, yet legal metadata claimed a200c call; postflop variants retained those preflop commitments and an arbitrary300c pot. These were suitable only as legal-boundary mock inputs, not price-dependent strategy fixtures. The corrected hypotheses now obtain observations from actual `startHand → applyCommand → observeBot` histories. Cheap versus costly raises produce real200c/600c calls; draw and missed-flop fixtures include genuine limp/check/bet actions and correct contribution totals. All original strict direction assertions are retained, with additional runs against frozen1.1 and current policy. No runtime parameters or expected values were tuned.

Executed `tests/bots/policy.test.ts`:18/18PASS, typecheck/lintPASS. Original failures are retained in `evidence/legacy-fixtures-before.log`; this lane sees the two postflop failures before replacing fixtures because the preflop lane’s shared-pricing integration is not in this worktree. The parent integration additionally reproduced the same contradiction for its preflop price test. The corrected fixtures exercise both policy versions rather than replacing the requirements.
