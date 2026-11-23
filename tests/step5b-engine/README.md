# Step 5B engine and sourced-rake evidence

This lane adds no secondary poker authority. Existing actions, card dealing,
settlement and historical practice profiles remain in `src/core/engine.ts`.

## Source fixture

The official PokerStars `.com` [rake page](https://www.pokerstars.com/poker/room/rake/?no_redirect=1)
was retrieved on **2026-11-01** through the web retrieval tool. The snapshot date
is not represented as a publication date. The retrieved page's numbered lines
134–173 specify no flop/no drop, dealt-in occupancy, half-to-even rounding, and
the USD regular NLHE schedule. `pokerstars-source.json` preserves the factual
transcription used by independent fixture tests. Only its 15 exact USD stake
pairs are offered. Zoom micro stakes, other currencies/venues and unlisted
stakes are not mislabeled. Source rates can change: this saved version remains
explicitly dated and existing hands retain their complete profile.

The `$1/$2` row is 5%, capped at 125 cents for two and three–four dealt-in players,
275 cents for five or more. The `$0.10/$0.25` row independently distinguishes all
three occupancy groups (50, 100, 200 cents), avoiding a test that passes despite
confusing identical two/three–four caps at `$1/$2`.

## Implemented boundaries

- `pokerStarsProfile(sb,bb)` builds the sourced profile; `resolveRake` resolves
  its cap from the funded seats actually dealt, each new hand.
- `calculateRake` uses exact integer arithmetic, rounds once, caps once and
  receives only contested money after uncalled returns. Legacy practice profiles
  keep floor rounding. Custom whole-chip profiles floor to their declared unit.
- `reconfigureTable(previous,seats,profile,transferId)` accepts completed hands
  only, records signed external per-seat transfers and an idempotent latest
  request. Older reused IDs fail closed. A subsequent `nextHand` advances the
  physical seat ring even when the old button or blind seat was removed.
- The caller must capture the completed canonical history first, pair Hero's
  transfer with the wallet, and call `nextHand` in the **same atomic transaction**.
  The intermediate completed table is not a new poker result or export/replay.
- Stack/blind/bet/top-up denomination is validated. Odd chips and rake use that
  unit. Changing denomination can explicitly return residual cents to the wallet;
  old completed hands and their original rounding are unchanged. PokerStars USD
  profiles require one-cent denomination.
- Bot observations include a public denomination only for non-default units;
  default-cent historical observation shapes remain compatible.

## Executed verification

2026-11-01, isolated branch `step5b/engine`, Node/Vitest 3.2.4:

`npm test -- tests/step5b-engine tests/core`: **100 passed, 0 failed**, 7 files.
The new lane contributes 52 test cases, not 52 mapped V7 requirements. Tests
include source rows, half-even ties, all 2–10 dealt-in cap values, refunds, side
pots/splits, legacy floor preservation, sparse seats, removed button/blind,
reconfiguration retries/reload, unchanged canonical replay, 20 repeated 6/9-seat
changes and 120 hands across denominations 1/5/25/100 cents.

`npm run typecheck`: **PASS**.

`PYTHONPATH=/workspace/scratch/4441cfdf5595/pokerkit-reference RUN_ORACLE=1 npm test -- tests/oracle tests/core tests/verification tests/r1critical tests/step5b-engine`:
**162 passed, 0 failed, 2 skipped** (16 passing files, one opt-in accounting file
skipped), 66.78 seconds. This included actual PokerKit 0.7.7 exact raise/reopening,
side-pot and heads-up comparisons, 240 seeded hand-rank comparisons, 100,000
production CSPRNG shuffles, and 400 persistent session hands.

The skipped accounting suite was then explicitly executed:
`RUN_ACCOUNTING_BATCH=1 npm test -- tests/verification/accounting-batch.test.ts --reporter=json --outputFile=tests/step5b-engine/accounting-result.json`.
**2 passed, 0 failed**, executing **20,000 seeded mixed-stack hands**: 10,000
rake-free and 10,000 custom-rake, 2–10 players. The JSON report is retained here.

The final cap-denomination validation fix and a new five-to-three dealt-in
transition fixture were separately rerun with
`npm test -- tests/step5b-engine/rake.test.ts tests/step5b-engine/denomination.test.ts --reporter=json --outputFile=tests/step5b-engine/rake-denomination-result.json`:
**45 passed, 0 failed**. This lane now contains 53 authored test cases. Earlier
suite counts above are the actual counts at those runs, not retrospectively
inflated by that additional test.

`npm run lint -- --quiet`: **PASS**. `node scripts/check-spec-integrity.mjs`:
**PASS**, all original 302 acceptance IDs, 86 future feature IDs and hashes intact.

Integration browser testing is reported separately; this lane alone does not
claim an R1 acceptance PASS or a deployed release. Full V706 includes integration
configuration and unsupported straddle behavior, so these engine tests alone do
not close that criterion.

## Independent current-policy pricing follow-up

`bot-pricing-denomination.test.ts` uses an independent public contribution-layer
reference, decimal half-even calculation and unit-based split calculation. It
imports neither engine settlement nor pricing arithmetic for expected values.
The test does apply actual proposed bot actions through the engine, checking
conservation and duplicate-command rejection at each step.

The audit caught a genuine mismatch in current policy 1.4: a supported custom
five-cent profile at 5% with a 150-cent contested pot must round 1.5 five-cent
units to two units (10 cents). Bot pricing instead rounded 7.5 cents to 8 cents,
then floored to one five-cent unit. Engine and independent reference were 10;
bot estimated 5. The failing test is retained in
`bot-pricing-denomination-before-fix.json`. Root fixed this independently in
`5ca044d`, rounding the fraction in declared chip units before converting to
cents; no settlement code was shared with the advisory pricing implementation.

After that production fix:
`STEP5B_BOT_PRICING_REPORT=1 npm test -- tests/step5b-engine/bot-pricing-denomination.test.ts --reporter=json --outputFile=tests/step5b-engine/bot-pricing-denomination-result.json`:
**31 passed, 0 failed**, including sourced occupancy caps, source half-even ties,
custom units 1/5/25/100, inaccessible side pots, refunds, exact tied settlements,
guaranteed board-chop decisions at both positions with positive/zero/negative
call values, and hidden-field getter rejection.

The same executed suite completed **36 seeded full bot hands**, spanning four
denominations and 2/6/10 players: **301 decisions, 35 raises and 25 calls**. All
proposals were legal and conserving; repeat application was inert. None of those
25 sampled bot calls happened to face excluded chips; dedicated deterministic
side-pot fixtures cover that condition. This is functional synthetic evidence,
not human calibration or a performance measurement. The 28 recorded fixture
cases, observations, independent expected figures and payouts are preserved in
`bot-pricing-denomination-evidence.json`.
