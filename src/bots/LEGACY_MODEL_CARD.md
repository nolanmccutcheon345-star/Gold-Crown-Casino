# Phase 0 synthetic bot policies
Version: synthetic-phase0-0.1.0. Evidence tier: DESIGNED / SYNTHETIC / NOT_HUMAN_VALIDATED.

The eight policy presets share a coarse own-card/board-feature model with distinct aggression and looseness, plus a fit-or-fold penalty. Decisions condition on street, visible board draws, pot price, stack exposure, multiway pressure and a coarse preflop position signal. Raise sizes are sampled conditionally within engine-provided legal raise-to bounds. These features are engineering hypotheses, not measured population rates, equity, strategy certification or a completed G4 model.

| Preset | Aggression | Looseness | Intended hypothesis |
| --- | ---: | ---: | --- |
| Nit | .25 | .12 | Continues fewer marginal hands |
| Station | .12 | .90 | Calls more and raises less |
| TAG | .62 | .32 | Selective entry with stronger aggression |
| LAG | .79 | .67 | Broader entry and more aggression |
| Fit-or-fold | .29 | .40 | Folds more missed postflop hands |
| Maniac | .94 | .87 | Broad entry and frequent aggression |
| Passive reg | .24 | .42 | Moderate entry with fewer raises |
| Stronger reg | .66 | .40 | Moderately broader controlled aggression (name is a preset, not measured strength) |

A single policy input contains own hole cards and permitted public information only. Unknown extra fields and card-bearing events are excluded. Policies have no opponent memory, shared private state, engine state, deck access or financial write access. The engine must reject every stale/illegal decision. Policy randomness uses crypto separately from deck entropy. The in-memory cache is bound to one hand. It preserves one sampled decision per full canonical observation, rejects decision-ID reuse with altered context, rejects a second decision ID at the same authority revision, and rejects new sampling of a stale revision. It reserves the authority node before drawing and blocks retries after a partial entropy failure instead of rerolling. There is no arbitrary per-hand action cap and no eviction of pending samples. The UI must replace the cache only after successful creation of the next hand, never on pause or rerender; completed-hand identities are not retained across that boundary. It does not yet implement durable crash/reload restoration; V701–V703 cannot be marked PASS on this module alone.

Not implemented: full weighted range trajectories, at-seat trait variation, editable per-draw 25–300% call surfaces, adaptive public-only memory, cross-lineup strength audit, calibrated conditional distributions/uncertainty, human datasets. All remain G4 requirements. The unit tests verify local mechanics, privacy projection and selected directional hypotheses only, not completed archetype realism.

## Step 2 evidence scope
Actual engine-derived privacy fixtures cover preflop/flop/turn/river, all eight presets, and 64 identical private policy streams per paired context. Hero-card substitutions and future-deck permutations preserve both the exact conditional probabilities and sampled joint action/size. Throwing getters detect forbidden deck/other-hole reads. Folded Hero cards stay absent from observations and public showdown history. Policies remain memoryless; this does not validate a future adaptive-memory implementation. Direct engine callback tests cover duplicate commits and stale same-hand/cross-hand commands, but do not replace browser pause/reload/worker lifecycle testing. Durable pending decisions and crash recovery remain unfinished.
