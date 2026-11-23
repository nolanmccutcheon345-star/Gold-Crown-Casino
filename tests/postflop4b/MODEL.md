# Synthetic postflop model 1.1

The policy receives only an allowed observation and its own fixed profile. Preflop actions and sizes come directly from the explicit preflop range service. Postflop actions use the public-action range service's simultaneous opponent showdown-share estimate, uncertainty, half-pot fold-equity prior and relative range/nut summaries.

Showdown share is not decision EV. The policy separately records immediate pot odds, capped estimated rake, position-sensitive equity realization, future-street cost, implied and reverse-implied risk. Low-skill pair attachment, nit caution, missed-flop fit-or-fold behavior and aggressive overpressure are bounded context-dependent synthetic errors. No numeric rate is human-calibrated.

Public action sequences distinguish initiative, checked-through delayed continuation bets, prior-street barrels and check-raise opportunities. Already-dealt board prefixes distinguish completed and missed draws. Missed draws receive a selective blocker/fold-equity-dependent bluff component, not an automatic river bet. Multiway pressure reduces weak bluffs and speculative continues. Value, protection, thin value, draws and bluffs share overlapping legal sizes; near-commitment stacks add an all-in option.

Exact visible-card unbeatable hands retain the existing no-fold safeguard and private river nuts value-raise. The existing independently proven cheap, forced nut-flush-draw guard is retained. Four-suit weak contributions and board-only made hands receive a smooth price-dependent caution when the inferred opponent prior remains uncertain. This repaired an executed regression where a weak four-flush hand overcalled an extreme price; the original test threshold was not changed.

The service makes no action-random draws, reads no actual opponent policy, and never reads hidden cards or authoritative deck state. Action sampling and validation remain in the version facade and authoritative engine. Diagnostic fractions are model components, not individually normalized action probabilities; only the returned distribution is an action probability distribution.

Focused tests include an independently controlled advisory prior to verify that equity, price, future costs and public lines actually affect the policy, plus existing hidden-card, seat-relabel, exact-nut, forced-draw and weak-board regressions. These are implementation and synthetic-design checks, not human validation or a solver comparison.
