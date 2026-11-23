# Step 5A independent call-pricing verification

Executed 2026-11-01 against the Version 7 baseline, then the current 1.3 candidate. This lane owns pricing verification; the integrator approved the narrow current-policy rake correction. The authoritative poker engine, financial ledger, and frozen 1.2 implementation were not changed.

## Confirmed defect and correction

Preflop no-flop-no-drop pricing omitted rake even when the hypothetical call necessarily runs out the board. Exact reachable example (integer cents): stacks `[4000,20000]`, blinds `100/200`, 5% rake capped at `501`; button/SB calls to `200`, BB shoves to `20000`. The short caller owes `3800`; `16000` is returned; matched and eligible gross are `8000`. Calling forces showdown, rake is `400`, and eligible net is `7600`.

- Before: estimated rake `0`; adjusted break-even fraction `3800/8000 = 47.5%`.
- After: estimated rake `400`; adjusted fraction `3800/7600 = 50%`.
- Actual engine settlement after calling: rake `400`, independently reconciled refunds, awards and ending stacks.

The correction recognizes a forced runout only when at least two nonfolded players remain and the post-call state has zero funded players, or one funded player who has already matched every nonfolded opponent. An opponent who still owes a call is not assumed to call. A higher folded street contribution is not used as a live opponent's betting obligation. No deck, future board, opponent private cards or engine settlement method is consulted.

`evidence/forced-runout-red.log` records the failing 18-test run before the correction: 11 passed, six substantive assertions failed and the incomplete-evidence sentinel failed. `evidence/forced-runout-green.log` records the initial 18/18 green run. The final suite adds a frozen-policy compatibility check and records **19/19 passed**, zero failed, in `evidence/final-run.log`.

## Independent method and measured coverage

`reference.ts` has no production imports. It independently derives the legal call cost from public street contributions and remaining stack; decomposes contributions into vertical intervals; identifies unmatched single-contributor refunds; excludes layers the caller cannot win; and allocates rake from the main pot upward. Exact predeclared numeric totals also anchor the fixed fixtures. Only fixture construction imports the actual engine; all action sequences are legally applied, with test-only unique-card rigging permitted by the architecture contract.

- 32 exact heads-up fixtures: preflop/flop/turn/river × minimum/pot/three-pot/shove × rake off/on.
- 10 multiway fixtures: 2/3/6/9/10 seats × rake off/on, multiple all-in depths, short calls, dead money and returned excess. A common royal-flush board makes tied winners analytically certain, allowing independent exact cent splits and odd-chip order without reusing a hand evaluator.
- Known-runout positive and unresolved-call negative fixtures, uncapped/capped rake, exclusion invariance and secret-getter checks.
- **300 seeded completed hands**, with 30 trials for each seat-count/rake pair. **3,282** decisions compared; **2,868** positive call prices; **949** calls exhausting the caller's stack; **907** decisions with excluded chips; **539** decisions with inaccessible contribution layers; **698** decisions with folded dead money. Final settlements include **216** multiple-pot hands, **181** refunds and **142** rake events.
- Every generated transition checks authoritative accounting; final event replay separately reconstructs all stacks and checks unique decision/event IDs and `contributions − refunds = awards + rake`.

These are 19 executable test cases, not 300 or 3,282 acceptance requirements. The 300 trials deliberately exercise contribution geometry, not human strategy or independent general hand-ranking accuracy. Fixed public boards and seeded unique hole cards are used; the generator is a test action policy, not a realistic bot.

## Actual commands and results

```sh
STEP5A_PRICING_REPORT=1 npm test -- tests/step5a-pricing --reporter=verbose
npm run typecheck
./node_modules/.bin/eslint tests/step5a-pricing src/bots/pricing.ts
node scripts/check-spec-integrity.mjs
PYTHONPATH=/workspace/scratch/4441cfdf5595/pokerkit-reference RUN_ORACLE=1 npm test -- tests/oracle --reporter=verbose
npm test -- tests/strategy4c --reporter=verbose
```

Final pricing suite, typecheck, scoped lint and specification integrity returned exit code 0. The original four governing PDF hashes, original register hashes, **302** acceptance IDs and **86** deferred IDs remain unchanged.

The existing pinned PokerKit **0.7.7** suite actually ran: **4/4 tests passed**, including 240 five/seven-card comparisons and compatible action-order/reopening/all-in side-pot fixtures. This is independent existing mechanics evidence, not a claim that PokerKit validated this application's practice rake profile.

The additional unchanged Step4C suite returned **12 passed / 1 failed**: its old test changes a postflop all-in observation to preflop and expects the former zero-rake estimate. That historical expectation conflicts with the confirmed correction. The failure is recorded in `evidence/strategy4c.log`; the integrator owns routing that old assertion to frozen 1.2 behavior. The new suite separately confirms frozen 1.2 still returns zero while current 1.3 returns the required 400. Do not describe this recorded run as fully passing.

`evidence/pricing-audit.json.gz` contains 48 exact case/batch records, public decision inputs, reference slices, completed event sequences and reproducible batch seeds/actions. `evidence/manifest.json` records the uncompressed content hash. No browser testing was performed by this lane.

## Meaning and limits

`contestableAfterCall` is gross money eligible under the immediate hypothetical call, including the caller's own chips once. It is not profit or a forecast of future opponent contributions. Under a closed-betting equity model, incremental calling value is `equity × eligible net − call cost`; different side pots may require different equity estimates. Inaccessible higher layers never increase eligible winnings. They can affect the practice profile's total rake, which is charged main-pot first, up to the cap. That explicitly selected profile is not asserted to match every real poker room.

The forced-runout correction accounts for a board that necessarily follows the priced call. For unresolved future betting, rake and equity remain estimates; no opponent future calls, folds or side-pot outcomes are forecast. No solver verification, expert review, human calibration or real-money profitability is claimed.
