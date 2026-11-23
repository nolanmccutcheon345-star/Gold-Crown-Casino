# Synthetic cash opponents — version 1.0.0

Evidence tier: **DESIGNED / SYNTHETIC / NOT HUMAN-VALIDATED**. `synthetic-cash-1.0.0` is an engineered behavioral model, not a solver, a measured room population, a claim of poker expertise, or a prediction of real earnings. The eight archetype names describe intended tendencies. A “stronger reg” name is a hypothesis to test, not strength certification.

`legacy-v0.ts` preserves the prior implementation byte-for-byte. Existing `synthetic-phase0-0.1.0` profiles retain that exact policy, entropy consumption and decision hash. Optional memory/rake/new traits do not alter legacy sampling. New sessions use the new version; integrations must never rewrite an active or historical legacy profile.

## Stable construction and environment

`createProfile(config, seed, environment)` is deterministic and uses a separate local seed stream for seating-time personality construction. It never reads deck entropy or game state. Explicit custom controls are applied exactly; unspecified traits receive small bounded, correlated variation from the archetype baseline. A copied configuration and seed reproduces the same individual. The returned profile is persisted once by the session controller.

Random and Unknown draw an actual archetype from a designed population mixture. Unknown keeps `unknown:true`; its actual archetype/traits/personality ID are private construction data and must never appear in ordinary Live or Study views. Custom starts from a chosen base and permits explicit overrides. The same explicit archetype, seed and skill retains its traits/skill across environment changes. Monetary stakes are never used as an input to assign skill. Low/mid/high environment presets are hypothetical contexts and mixtures, not observed live populations.

| Archetype | Intended behavior |
| --- | --- |
| Nit | Selective entry, price-sensitive continuation, few bluffs, multiway caution |
| Station | Loose/passive entry, frequent calls, draw chasing and river curiosity |
| TAG | Position-aware selective entry, raise-first opening, value and controlled semibluffs |
| LAG | Broader entry, aggressive isolation/squeeze, more bluffs and larger sizing |
| Fit-or-fold | Extra penalty on missed postflop hands; relatively few speculative continuations |
| Maniac | Broad entry, frequent aggression, weaker size sensitivity and more bounded mistakes |
| Low-stakes recreational (`passive-reg`) | New-version loose/passive recreation model, overlimps, overcalls and draw curiosity; legacy key semantics remain unchanged |
| Stronger reg | More position/multiway/price awareness, public-evidence adaptation and fewer modeled mistakes; not solver validated |

## Thirteen controls and actual policy paths

| Trait | Policy effect |
| --- | --- |
| positionAwareness | Position and players-behind pressure |
| bluffFrequency | Air, blocker and squeeze bluff mixture |
| valueThreshold | Strength threshold for the value family |
| drawCalling | Draw-price continuation and implied realization |
| sizeSensitivity | Call price and bet-to-pot pressure |
| riskTolerance | Stack exposure, semibluff and low-SPR commitment |
| riverCuriosity | Marginal made-hand bluff catching |
| slowPlay | Checking strong hands on safer boards; never a reason to miss a terminal guaranteed value raise |
| multiwayCaution | Multiway bluff suppression, draw discount and continuation pressure |
| adaptation | Bounded, sample-shrunk adjustment from public opponent rates |
| memoryRetention | Session projection window: `ceil(retention * 120)` most recent distinct hands |
| mistakeRate | Small stable-profile noise mixture after context evaluation; cannot fold pocket aces or a proven unbeatable hand |
| sizingAggression | Opening/isolation and postflop size-family weights, including overbets |

Skill is a separate control affecting awareness, adaptation and modeled mistakes. No trait can change cards, legal action bounds, pots, payouts or engine authority.

## Decision features and approximations

Visible cards feed the existing engine evaluator. Private hand contribution is distinguished from board-only trips, two pair, quads and shared river ranks. Flush strength depends on private suit rank relative to available higher cards; full-house strength is discounted when trips are shared or a higher board pair threatens it. Draws distinguish gutshots, open-ended/double-gutshot, flush/nut-flush, combo and backdoor cases. Board-only straight draws do not count as private outs. Nut-suit and A/K blockers contribute only a bounded part of the bluff family.

Public action sequences identify limps, isolation, an open, three-/four-bets, squeeze opportunities, initiative, earlier checks and checked-through flop/delayed continuation bets. Street-effective callable stack includes chips an all-in opponent already committed. Heads-up/three-handed blind positions are explicit. Relative range advantage is a small board/initiative approximation, not an inferred solved range.

Live draw continuation uses a disclosed heuristic: private straight/flush outs, overlap and dirty-out discounts, cautious overcard credit, multiway discount, one-card hit probability and a reduced second-card realization allowance when future betting remains. It compares this proxy with actual call price. This is **not exact equity** and does not assume that future streets are free. Terminal all-ins remove future-betting costs. Deeper stacks/position/nut draws can increase estimated realization, but implied odds are not promised money.

Preflop blind calls have a distinct price baseline; a single big blind is not treated like a large postflop wager. Competent aggressive styles enter unopened pots mainly by raising. All presets retain stochastic action/sizing over ordinary contexts. Pocket aces do not fold preflop. On the river, potentially very strong ranks are checked against all legally possible unseen opponent holdings using only own cards plus the public board and the existing evaluator. A single-context memo bounds memory. This is a rank bound, not a strategic solver, equity estimate or read of actual opponent cards. Proven unbeatable private river hands prefer legal value raises. Weak four-flush/full-house ranks receive no blanket “strong hand” continuation floor.

Sizing is a normalized mixture of legal raise-to totals. Preflop families include opens, isolation and re-raises; postflop families cover 25%, one-third, 50%, 75%, 100%, 150%, 200% and 300% of the pot after calling. Identical totals are coalesced after legal clamps; short all-ins use the exact engine boundary. The policy cannot reopen betting or award money.

## Public memory definitions and privacy

`buildOpponentMemory` accepts only `PublicMemoryHand`: committed public events and explicitly revealed cards. It reads no deck, hidden/mucked hole cards, private profiles, import data, notes or arbitrary event details. Folded seats cannot acquire showdown entries even if malformed input supplies “revealed” cards. Duplicate hand/event IDs do not inflate counters. At most 120 distinct recent hands and eight revealed showdowns per opponent are retained.

- VPIP: hands with a positive preflop call or raise / hands with at least one observed preflop decision. Forced blind all-ins without a choice are excluded.
- Internal field `pfr`: hands with an observed preflop raise / hands with at least one observed preflop decision. This is a **descriptive observed-decision rate, not canonical legal-raise-opportunity PFR**. The frozen public format lacks initial stacks/legal snapshots needed to reconstruct all short-all-in/reopening opportunities. UI/reports must disclose this denominator. Independent simulation can calculate canonical PFR from actual legal states.
- Postflop aggression: bet/raise actions / all actual postflop fold/check/call/bet/raise decisions.
- Fold-to-bet: postflop folds facing a positive unmatched wager / all observed postflop decisions facing such a wager. Free checks are excluded. Blind contributions and street resets are reconstructed only to identify these public opportunities.

Adaptation shrinks rate differences by `N/(N+24)` and caps call/bluff offsets. No player is special-cased by seat ID or Hero status. Memory does not assert a complete opponent range, unobserved card-removal knowledge, or calibrated frequency.

## Sampling, evidence and remaining limitations

Action and size are sampled solely from the supplied independent stream. Production defaults to CSPRNG. The session controller persists the draw token/pending result; this module does not own storage. Cache identity includes the complete new profile, allowed memory, public rake and permitted observation. One cache belongs to one hand; changed decision IDs at a sampled revision and stale/cross-hand requests cannot reroll. Partial entropy failure fails closed. No pending decision eviction or arbitrary raise-count cap exists.

Pre-registered tests cover position/price/multiway effects, distinct styles, draw sensitivity, public-memory effects, deterministic personalities, legacy equivalence, privacy counterfactuals and legal complete hands. Independent testing exposed excessive preflop/strong-hand folding, missed value and affordable-draw folds in the first candidate; those were treated as defects, with structural fixes and regression tests. This document does not claim the entire G4 acceptance gate passed.

Still provisional: no full Bayesian weighted ranges, no solved strategies, no rights-cleared human holdouts, no population calibration, no complete per-draw per-street editable call curves, no verified live-win transfer, and no tournament-specific model. Public-memory estimates are sparse-window observations. Context-stratified independent evaluation and actual browser/performance evidence remain required before release claims.
