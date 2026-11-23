# Bot evidence semantic review (proposal only)

Reviewed current executed source `fed76a93d45a387e87e1299bc78f8ece454e9775`, its release receipt and actual compressed hand records. This review does not change acceptance statuses or count additional unit tests.

The current main reference report contains **4,032 hands / 44,598 actions**, 42 cells with 96 hands and eight blocks each. The paired sensitivity report contains **1,344 hands / 7,878 actions**, 14 cells. Independent Python inspection matched every paired seed, block, button, initial card/stack vector and focus profile, and independently reconciled emitted financial events for **5,776 hands**, including 400 continuous nine-seat ecology hands. All matched comparisons and financial reconciliations passed. Benchmark `initial.stack` is recorded after blinds; the review reconstructs opening stacks by adding the exact blind events. Ecology records already contain opening stacks.

| Original ID | Proposed qualification | Required evidence / remaining gap |
|---|---|---|
| F20 | Finite synthetic functional check | Full reference cohort, 96-hand self-play, exact nuts/pricing guards and role-invariance cases. No claim of eliminating every strategic exploit. |
| R20 | Independent strategy/reference scope | Seven separately authored fixed heuristics and narrow fixed-range exact references. Shared rank evaluation has separate mechanics validation; no own policy is a strategic gold standard. |
| R21 | Current exact probe supplement verified | 3,072 hands, 12,357 actions; one selected case passed and two unrelated cases intentionally skipped. All six exact probes, 32 repetitions, 96 outcome rows and 48 paired rows. |
| R23 | Current nine-seat ecology | Eight 50-hand blocks; every seat acted in every block; 50 distinct carried stack states each. Public-action range updates and seat relabel invariance supplement the complete traces. |
| Y10 | Explicit cash component only | Current full 800-hand ecology, 55 top-ups, separate wallets, carry-forward stacks and inspected complete hands. Whole original remains NOT_EXECUTED because deferred FUT032 churn is absent. |
| Y13 | Frozen adversarial results with uncertainty | All seven references, per-cell N and eight-block intervals; preserve negative results and do not infer GTO from wins. |
| V418 | Current full composition supplement verified | 960 hands, 10,468 actions, two passed cases; six cells with 160 hands/eight blocks. All 960 raw hands independently reconciled. |
| V517 | Matched sensitivity and role neutrality | Exact 1,344 paired input matches, independently recomputed paired block intervals, plus explicit Hero-name/seat invariance checks. |
| V610 | High-volume synthetic transfer audit | 4,032 main plus 1,344 paired, frozen model/protocol/agent hashes and all losses. This reruns consumed seeds; it is not a newly blinded holdout. |

There are **34 negative outcome cells** across the main and paired reports. Current aggressive nine-seat 250BB strong-regular outcomes include −2.8530 BB/hand versus random (descriptive 95% interval −8.0718 to −0.1285) and −0.5311 versus overbluff (−0.9094 to −0.2379), each from 96 hands/eight blocks. These intervals have few clusters and multiple comparisons; they do not establish a mechanical defect, human realism or real-world profitability. The original 0/30 oversized-continuation finding remains a research finding. No minimum calling quota is recommended.

The exact report predicates, named cases, input seeds, rules, expected/observed claims and caveats are in `BOT_EVIDENCE_QUALIFICATION_PROPOSAL.json`. `review-bot-evidence.py` reproduces the independent raw-artifact inspection. Smoke tests must not satisfy high-volume report predicates. Root integration owns the final release receipt and actual qualification decisions.

## Current supplements completed

Source `d9586fd989b8ebed761653205cff3abd6b550f27` adds test/CI evidence only. Independent comparison verified all **143 runtime inputs** against the full-suite candidate and read/hash-verified its **three compiled artifacts**. Both supplement receipts pass and retain their exact source/build relationship. This is not a claim that the full suite reran at the metadata-only commit.

The exact R21 probe report has 3,072 completed hands. Independent review recomputed all 96 row means and standard deviations, checked actual trace policy versions and reconciled all 96 retained representative complete hands. Full diagnostics are retained for the first seed per cell, not every one of the 3,072 hands. Current strong-profile means include −1.5495 BB/hand versus minbet, −1.8644 versus hyper-overbet and −0.8622 versus max-aggression, each from 32 hands. All-in continuation versus max-aggression is 1/24. This is a different experiment from the original 0/30 small-bet-then-shove finding; neither is replaced by a calling quota.

Representative causes are recorded precisely. A9hh opens to 499c at 20BB, then faces 3,501c into 4,499c: the modeled call price is correctly 0.437625 and fold probability is 0.836018 under a conservative initial facing-3-bet prior. The true any-two probe identity is deliberately unavailable. In the minbet example, A9hh plays the board's full house on 5d5h6h6s5s; modelled share 0.067708 is near call price 0.071531 after repeated aggression updates. It folds, and the actual opponent's 77 beats the board. This is not folding the nuts or demonstrated numeric pricing corruption. The adequacy of later adaptation remains a policy research question.

Current V418 retained the negative −21.49 BB and −131.74 BB totals for loose/tight compositions versus stack-pressure, each across 160 hands. These are descriptive synthetic results, not automatic coding failures. No policy, test threshold or seed was changed to remove them.
