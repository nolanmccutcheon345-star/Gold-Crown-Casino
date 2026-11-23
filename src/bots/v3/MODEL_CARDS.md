# Synthetic cash opponents — version 1.2.0

Evidence tier: **DESIGNED / SYNTHETIC / NOT HUMAN-VALIDATED**. These are versioned engineered behaviors, not measured human populations, solved strategies, certified expert play or predictions of real earnings. Eight styles, Unknown, Custom and Random remain available. Skill is independent of stakes and population selection. Stable seeded, bounded, correlated personality traits persist with the session.

## Modules and authority

- `policy.ts`: version dispatch, allowlisted observations, one action draw and an optional size draw, action identity and one-hand cache. The session controller durably reserves the draw token and seals the proposed action before committing it once.
- `profiles.ts`: eight archetypes, thirteen traits, individual personality construction and synthetic low/mid/high/neutral population mixtures. The numerical baseline traits are retained from1.0. They are engineering assumptions.
- `preflop.ts`: explicit169-class ordinal table with6/4/12 combinations per pair/suited/offsuit class (1326 total), physical seat positions and five betting nodes. Stack sensitivity interpolates20/40/60/100/150/200/300BB. Position, size, opener, limpers, callers, squeeze opportunity, skill, population and personality affect continuation, raise and call weights. First-in initiative is separated from priced defense, with the actual remaining responders and graduated physical opening seats. See `PREFLOP_MODEL_1_2.md`.
- `ranges.ts`: uncertain weighted combo inference from public action sequences and sample-shrunk public observations. No actual opponent profile or hidden cards enter it. Current own/community blockers remove impossible combos. Joint compatible-range samples estimate showdown share including ties, with separate Monte Carlo error and model uncertainty. See `../../docs/models/RANGES_1_1.md`.
- `features.ts` and `strategy.ts`: made hands/private contribution, clean/dirty draws, public board development, weighted-range equity, position, realization, future costs, implied/reverse-implied risk, pot odds/rake and public lines. Value, thin value, protection, cbet/delayed cbet, barrel, selected bluff/semibluff, check-raise and trap families overlap. All sizing is bounded by engine legality. See `../../tests/postflop4b/MODEL.md`.
- `pricing.ts`: read-only capped-call pricing excludes unmatched excess and higher side pots the acting stack cannot win. The actual outstanding wager, rather than the capped call, supplies sizing context. Rake remains an advisory estimate; the engine is authoritative.
- `memory.ts` and `boundary.ts`: bounded public-action and revealed-showdown projection, field allowlist and validation. Live/Study controls never receive the private distributions, diagnostic ranges or Unknown identities.

The poker engine alone moves chips, deals cards and settles pots. Advisory equity is not a money ledger, payout or full decision EV. Side-pot-specific strategic equity, solved multi-street search and empirical likelihood fitting remain limitations; settlement itself remains authoritative and independently tested.

## Original premium-hand defect

The exact frozen1.0 first-in UTG audit reproduced the reported AA frequencies. Classification and fixture were correct. General aggression dominated conditional raising even when the value hand was strongest; the old AA continuation guard prevented folds but allowed routine passive limps. Version1.1 uses a continuous premium-value mechanism across hand classes and bounded deliberate trap probability. No AA-only raise-frequency override or empirical claim was added. Pre-registered synthetic release bounds and exact old samples are in `tests/step4b`.

## Version and privacy contract

New sessions use `synthetic-cash-1.2.0`. Saved1.1 sessions dispatch to `v2/`, frozen from published Version 6 byte-for-byte except relative imports. Saved1.0 sessions dispatch to `v1/`, frozen byte-for-byte except relative imports; its original model card is retained there. Phase0 sessions retain `legacy-v0.ts`. Do not rewrite active profiles, pending decisions or historical metadata when releasing a policy.

Action entropy is independent of deterministic advisory sampling. Fingerprints include the complete allowed observation and own policy. Rerenders, failed writes and reloads must not reroll a committed decision. Tests compare frozen decisions, sampling consumption and hashes; interrupted old-policy saves settle once before starting new-policy sessions.

Public memory uses at most120 completed canonical hands in the same session. VPIP/PFR memory rates use hands with an actual preflop decision, not reconstructed canonical legal-raise opportunity denominators. Aggression uses postflop decisions; fold-to-bet uses positive-price postflop decisions. Sparse observations shrink toward synthetic priors. Exact public player statistics and independent simulation opportunities retain their separately defined denominators.

## Limits and evidence

Range advantage, nut advantage, implied odds, realization, fold equity and mistake parameters remain approximations. Showdown-share standard error covers finite sampling only. It does not express confidence in human realism. Bounded adaptation can be exploited, and intended recreational weaknesses remain. Low/mid/high presets are hypothetical contexts, not measured rooms or stake-to-skill rules.

The historical research reviewed in `TEST_EVIDENCE/step4b/QUALITATIVE_SOURCES.md` is not an eligible action-frequency calibration dataset. There is no licensed human holdout, blind human comparison or independent solver certification. Simulation results must retain the policy version, seed, opportunities and uncertainty. Full release evidence is recorded separately after tests execute; this model card alone does not pass a gate.

## Step4C evidence boundary

The TAG range audit corrected the old entry-versus-RFI description, separated opening initiative from call-defense penalties, and removed the total-table-size penalty when the same players remain behind. The authored initiative credit is a synthetic strategic hypothesis, not a fit to human frequencies or a claim of solver equivalence. Folded-card bunching inference is not modeled. Capped-call pricing and inaccessible-pot exclusion are arithmetic fixes; tranche-specific strategic equity and multi-street EV remain approximate. Independent held-out experiments and complete-hand examples are recorded under `tests/step4c` and `TEST_EVIDENCE/step4c`. No external expert has reviewed this release and no rights-verified, context-matched human holdout has been evaluated.
