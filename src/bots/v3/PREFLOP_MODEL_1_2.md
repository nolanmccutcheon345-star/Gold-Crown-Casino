# Preflop model 1.2.0 — synthetic opening initiative

This remains an authored synthetic opponent model. It is not solver output, expert-reviewed human behavior, or a measured human population. No external charts were copied into the policy.

The Version 6 audit reproduced the reported TAG entry rates exactly: 9.47998585895% UTG and 19.99125862956% BTN. These were six-handed, 100BB, default seeded TAG, neutral population, no rake, no ante, $1/$2, and only folds before the acting seat. All 169 classes were weighted by their 1,326 physical combinations. Entry includes raising and limping; actual model RFI was 9.29397650767% / 19.58138070241%. They were not VPIP or measured human ranges. The default profile contains stable seeded variation; skill, position awareness and size sensitivity affect the result.

Three mechanical/model-structure problems were separated from a strategic hypothesis:

- Unopened decisions received the same call-price and odds-pressure penalties used when defending against an existing raise. They now receive a distinct initiative/steal prior; contested pots retain price pressure.
- A total-seat penalty continued to tighten a folded-to button even though it faced the same two blinds. First-in pressure now uses actual publicly remaining responders, with separate increments for full-ring early seats instead of one flat UTG bucket. Existing six-role interfaces are retained; detailed physical labels are diagnostic only.
- Raw pot odds included uncallable excess in short-stack all-in situations. The shared read-only `contestablePricing` estimate excludes unmatched/refundable chips and contribution tiers above the actor's maximum entitlement. It does not construct authoritative pots or mutate money.

The strategic hypothesis is that a competent synthetic regular should recognize first-in initiative, positional realization and the reduction in opposition in blind-steal spots. A smooth ordinal-score credit depends on skill, position awareness and actual responders; heads-up first-in receives an additional authored discount for one opponent and the posted small blind. This changes classes together rather than forcing target percentages or hardcoding particular hands. Recreational passivity, distinct original cutoff shapes, bounded premium traps, stack-depth interpolation, price-sensitive calls and mixed sizing remain.

Engineering checks were registered and executed before candidate edits. The ordinary A5s/77 early-position and QJo cutoff raise-majority checks are **qualitative engineering hypotheses**, motivated by independent six-max reference examples. They do not prove those hands profitable under our different sizing/rake tree, and are not empirical calibration. Mechanical checks separately cover callable price, folded-seat invariance and graduated early-position pressure. The original failing logs are preserved.

## Reference boundary

- [ART/GTO UTG](https://artgto.com/learn/ranges/utg/open/) and [button](https://artgto.com/learn/ranges/bu/open/): publisher's own solver reports 100BB six-max RFI 19.9% / 46.5% to 2BB. Rake is not exposed on these read pages, so exact comparability is unverified. This is a technical comparator, not human observation or a required policy target.
- [GTO Wizard solution descriptions](https://blog.gtowizard.com/status-and-info-about-our-solutions/): the provider distinguishes six-max and nine-max, stack depths, open sizes and rake schedules. Its described six-max general sizes include 2BB early, 2.3BB CO, 2.5BB BTN and 3BB SB; NL50/500 rake caps differ. No actual Wizard decision dataset was obtained or solver run by this project.
- [GTO Wizard solution update](https://blog.gtowizard.com/simplified-solutions-and-a-new-interface/): explicitly separates opening-size, depth and rake families. This supports conditioning comparisons, not an assumed universal chart.

Public sources were read on 2026-11-01 UTC. No licensed or independently observed human action dataset was available to this lane. Numerical credits remain provisional and versioned. The independent full-hand evaluation must judge population effects separately; matching isolated references cannot certify realism.

Detailed paired results and exact configurations: `tests/preflop4c/REPORT.md` and `tests/preflop4c/evidence/opening-audit.json.gz`. Card-bunching inference from prior folds is not modeled; folded-seat invariance is a declared simplification.
