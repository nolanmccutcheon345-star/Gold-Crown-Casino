# R09/F15 independent investigation: price-dependent equity resampling

Confirmed defect; not an arbitrary demand to call/fold more. The `tag` profile with personality seed555 used in `tests/step5b-bots/draw-responses.test.ts` has the reported reversals. The flop comparison is **150%→200% pot**, not200%→250%: baseline continuation.0528603→.1224703. Complete permitted decision inputs, profile, public actions, stacks, odds, weighted range combos and intermediate policy values are preserved in `evidence/price-investigation/baseline/inputs.json`.

The actual mechanical cause is the96-trial equity sampler's hash seed including pot size, stacks, commitments and action amounts. Changing a bet by one cent redraws every hypothetical opponent holding and runout. That introduces unrelated numerical noise into an otherwise smooth price response. At200%→200.05% ($40.00→$40.01 against a$20pot), the inferred posterior is **identical**, yet equity jumps.4322917→.4947917 and defense jumps.1224703→.2335695. The true equity under identical ranges/cards cannot change. Rake-adjusted price increases correctly and the draw-odds floor decreases; neither call pricing nor side-pot eligibility caused the reversal.

Independent exhaustive heads-up turn enumeration over1,035 legal opponent holdings×44possible rivers (45,540opponent terminal evaluations per draw) isolates the range shift from the sampler:

| Draw | Bet / pot | Exact weighted range equity | Old96-trial equity |
|---|---:|---:|---:|
| OESD |50%|.2616593151|.2239583333|
| OESD |75%|.2641927294|.3125000000|
| Combo |50%|.3953654942|.3281250000|
| Combo |75%|.3973686808|.4583333333|

The small true equity increases reflect the synthetic action-likelihood posterior changing with size; they do not justify the much larger random estimates. This independent enumeration uses the authoritative hand evaluator (already separately PokerKit-tested), not the production equity sampler. It proves equity for these supplied synthetic ranges, not the validity of the range model or full decision EV.

The minimal candidate uses common random numbers keyed only by visible cards, public seat order and public line topology. Every price-specific likelihood, full-priced cache key, legal bound, pot calculation, uncertainty adjustment and personality parameter is retained. No action quota, defense floor or global monotonic clamp was introduced. Hidden cards, future board cards and deck information never enter the equity stream.

Candidate discovery results:

| Context | Lower / higher bet | Before defense | Candidate defense |
|---|---|---|---|
| OESD flop |150% /200%|.05286 /.12247|.12240 /.08150|
| OESD turn |50% /75%|.28090 /.30319|.44812 /.30348|
| Combo turn |50% /75%|.78098 /.86705|.92432 /.71192|
| OESD flop, identical posterior |200% /200.05%|.12247 /.23357|.08150 /.08145|

The change removes the numerical discontinuity, but does not remove Monte Carlo estimation error. Per-observation96-trial standard errors in these cases remain about4–5percentage points. Across materially different posterior distributions, finite-sample conditional curves can still exhibit small irregularities. The12zero-offset reference curves (4draws×3streets×7prices) were decreasing except a small flush-turn100%→150% increase of.000560 (0.056percentage points); this uses different posteriors and is far below the400-decision sampling interval. It is explicitly recorded, not clamped away or claimed solver-optimal.

Validation executed before policy version advancement:

-3discovery-direction tests passed.
-Complete price-conditioned posterior arrays and fold-equity summaries remained exactly equal to the frozen previous implementation at all7anchor prices; different-priced posteriors still recomputed.
-96held-out one-cent overbet pairs across4newcard contexts×2archetypes×2personalityseeds×2streets×3sizes retained identical posterior/equity and smooth nonincreasing response.49,152seeded proposals executed; every distinct action was applied to an authoritative engine clone and conserved chips.
-The100,800-decision full draw-surface test passed, as did the Step4C/Step5A scoped range/pricing tests.
-Scoped suite:43PASS/1FAIL. The sole failure is the prior policy1.4 test asserting all new-policy changes remain confined to unmade draws. That assertion is incompatible with a newly versioned equity-stream correction. The separate exact frozen1.3 dispatch assertions passed. Root must freeze1.4, advance the current version, update the version-specific scope assertion, and rerun full regression before release.

Raw evidence: `evidence/price-investigation-tests.log`, `evidence/price-investigation/heldout-one-cent.json`, `evidence/price-investigation/exact-turn-equity.json`, `evidence/price-investigation/candidate-draw-surfaces.json`. No human calibration or strategic-expert approval is claimed. R09/F15 whole-criterion status belongs to the acceptance integrator after the new version and final verification are complete.

Additional fixed-card probes covered160one-cent pairs below the posterior-saturation boundary at25/50/75/100/150%pot. The range weights changed (cache not reused), while the maximum observed defense change was.0010821, or0.108percentage points. These use the same held-out card/profile set as the96overbet pairs. The additional executable check requires a responsive posterior and the previously used0.5percentage-point smoothness bound; it does not require arbitrary global monotonicity. Raw rows are in `evidence/price-investigation/tiny-changing-posterior.json`.
