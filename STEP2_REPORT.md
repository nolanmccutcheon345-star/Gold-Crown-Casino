# Step 2 — playable cash gameplay verification

The existing AI Texas Hold Em project has a playable, engine-owned no-limit cash game. No project was recreated. Owner-only access was removed through native Sites access controls on the user's instruction; guest practice works without application Google sign-in. Publication result and tested source are recorded in TEST_EVIDENCE/publication.json.

## Code delivered

| Component | Files | Result |
|---|---|---|
| Authoritative engine | src/core/engine.ts, evaluator.ts | Owned next-hand transition, heads-up/bust positions, shared live/settled pot tiers, unmatched excess, revealed hand names; retained complete legal-action, deck, evaluation and settlement system. |
| Stable interface | src/contracts/index.ts, ARCHITECTURE_CONTRACT.md | Additive v0.2.0 contract; adapters submit commands and never move chips. |
| Playable UI | src/ui/app.ts, styles.css | Configurable rake, legal raise-to/all-in controls, live side pots, refund/history details, showdown labels and protected next-hand/setup flow. |
| Bots | src/bots/policy.ts | Private observations, coherent basic policies, one sampled decision per authoritative revision and safe cache lifecycle. |
| Tests | tests/core/progression.test.ts, tests/bots/privacy-counterfactual.test.ts, tests/verification/, tests/oracle/ | Position/betting/pot/evaluator/accounting/privacy coverage and independent reference checks. |
| Evidence audit | scripts/verify-public-history.mjs, tests/integration/history-audit.test.ts, scripts/record-checks.mjs | Independent event-money replay, rake formula and consecutive-hand balance audit; reproducible logs. |

## Executed checks

The 122-test integrated suite passed with zero failed or skipped tests at 5debfac8da11e764af2c9789ffd0963201335850. TypeScript, ESLint, production build and PDF/register integrity passed. See TEST_EVIDENCE/2026-10-31T18-50-00-247Z/manifest.json and logs. A subsequent auditor-only change at 5cd3cac passed all five targeted tests (one new), typecheck and targeted lint. Application source has not changed since cbf7dfb; SHA-256 evidence confirms this.

The integrated run included two 10,000-hand deterministic batches: no-rake seeds 610000–619999 (120,935 actions; 7,889 showdowns), rake-on seeds 710000–719999 (121,182 actions; 7,840 showdowns; 3,775,983 cents rake). Every transition was checked for conservation, card uniqueness, legal actor, pot decomposition and termination. PokerKit 0.7.7 compared 242 targeted/seeded hand rankings and compatible betting/settlement fixtures, including minimum re-raise, cumulative short raises, 200/210/360 side pots and folded-contribution odd-chip ties. This is cross-check coverage, not proof of equivalence for every poker-room rule.

Actual cloud Chromium used visible UI controls. The six-seat endurance session completed 100 consecutive hands without app reload, with 1,370 actions, 74 showdowns and 3 split pots. Independent public-event replay verified every hand and stack carry between hands; 600,000 initial cents = 600,000 final cents. Its natural run produced no side pot; deterministic engine/oracle tests provide multiway side-pot evidence. Full export, auditor output, screenshot and summary are in TEST_EVIDENCE/step2/endurance-100-*.

Additional browser journeys covered heads-up button movement, fold and raise refunds, checked-down rake showdown, double-click jam and all-in call, nine-seat automatic all-in runout, nine-seat pause/history/resume, setup locking and action locking. Two actual ten-seat hands completed at mobile CSS width, with no horizontal overflow and a 20,000-cent visible final total. Mobile iframe download capture timed out and is not marked passed. Physical mobile devices and human validation were not tested. Earlier runner timeout/reset did not reset the endurance table; limited batch logs and full exported history distinguish this.

## Exact completed hand

Browser hand hand-b38dc68940b67d69c618bab0f5360311, third consecutive heads-up hand; source: TEST_EVIDENCE/step2/heads-up-rake-history.json, independently audited in heads-up-rake-accounting.json.

| Stage | Exact action / state |
|---|---|
| Starting stacks | Hero $101; Alex $99. Hero is button/small blind. |
| Blinds | Hero posts $1; Alex posts $2. |
| Hole cards | Hero A♦ 9♠; Alex 2♥ 5♦ (opponent revealed only at showdown). |
| Preflop | Hero calls $1; Alex checks. |
| Flop | 4♦ 4♣ K♠; Alex checks, Hero checks. |
| Turn | Q♣; Alex checks, Hero checks. |
| River | 6♦; Alex checks, Hero checks. |
| Showdown | Hero wins with pair of fours, ace kicker. |
| Settlement | Gross pot $4; 5% rake $0.20 (cap $5, no-flop-no-drop); Hero award $3.80. |
| Final accounting | Hero $102.80 + Alex $97 + house $0.20 = $200. |

Other exact browser refunds: Hero raise-to $16 from a $2 blind commits $14 additional; opponent fold returns $14 unmatched, leaving a $4 pot. Hero $20 all-in with opponent fold returns $18 unmatched, leaving a $4 award. The double-click call/jam exports each contain one Hero decision and one settlement.

## Acceptance and limitations

ACCEPTANCE_STATUS.csv records 42 PASS and 260 NOT_EXECUTED, with evidence per passed requirement. No broad acceptance row was promoted solely by a partial test. All original 302 requirements and 86 deferred features are unchanged. Contracts-only intermediate verification had four expected missing-implementation failures; integrated tests then passed. DEF-004 (position transition), DEF-005 (decision reroll) and UX-001 were fixed. No observed critical gameplay defect remains in the tested scope.

Step 2's core cash gameplay is implemented, tested and published as Site version 2 from 80c59b9aba9a5ead060c995a5be34a5e35a0e1a6. Native deployment appgdep_6ae63e89da208191b4b350518d4a66b0 succeeded at 2026-10-31T19:16:32.864904+00:00. A guest six-seat hand then completed on the live origin; the $34.86 pot went to Jordan's king-high flush, and independent event replay preserved the $1,200 table total. See live-step2-* evidence. Full V7 R1 is not complete. Durable bankroll/ledger and reload recovery, full statistics, advanced human-calibrated bots, complete device/user testing and tournaments remain unfinished. Basic bots are synthetic foundations. Generic practice cash rules do not claim certified TDA/PokerStars or ante/straddle/missed-blind support.

Next task: G3 durable transaction/event storage and wallet lifecycle, exact resume, sealed pending decisions and single-tab ownership, with failure-injection tests before broader bot realism work.
