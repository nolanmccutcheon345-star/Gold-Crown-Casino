# Step4C strategic audit — registered before fixes

Baseline: Version6 source frozen under `src/bots/v2`; active candidate is the same logic with policy identity 1.2.0 before this lane's changes. No frequencies are chosen as human targets.

Analytically supported defect hypothesis: capped calls must be priced against chips the caller can win, not a deeper opponent's uncalled excess or inaccessible side pot. This is an advisory amount; the existing engine remains solely authoritative for actual chips/pots/payouts.

Independent predictions before implementation:

1. Legal heads-up fixture, stacks4000c/20000c, blinds100c/200c. After limp/check the pot is400c. BB shoves19800c on the flop. SB calls only3800c, so the engine must return16000c and contest8000c. Correct break-even showdown share before rake is3800/8000=.475, not3800/24000=.158333. A stronger opponent's modeled continuation should decrease when this falsely cheap price is repaired; no exact target frequency.
2. Three-way actual commitments after a short call2000/5000/5000 expose6000c to the short caller, exclude6000c as side pot, and preserve all12000c in the engine. Dead folded contributions below the caller's cap remain contestable; those above it do not.
3. Equal funded commitments and no uncalled excess retain the original price. Contributions already committed are counted once, and a new call is added once.
4. Estimate the configured hand rake from chips after uncalled refunds, capped once per hand. Existing engine charges rake from main pots first. No-flop-no-drop estimates zero for a preflop observation. The estimate excludes possible future actions and is not solver EV.
5. Complete legal continuation must agree with these analytical amounts and conserve all chips. Rerunning a saved observation must remain deterministic. Hidden cards and future deck may not affect current pricing or decisions.

Separate audit topics: private versus shared board features, draw/runout semantics, public likelihood normalization, range card removal, and sizing overlap. Fix only reproduced defects; do not expand the scope into solver design or claim independent human review.

Additional mechanical hypothesis before changing bet-size diagnostics: a capped call is not the opponent's actual wager. In the same HU fixture, the visible shove is19800/400=49.5 pots, not3800/(20200-3800)=0.2317 pots. Preserve actual uncapped outstanding wager for threat and board-vulnerability sensitivity; use capped amount only for call-cost arithmetic.
