# Step 4A — synthetic opponent release

Project: `/workspace/sites/ai-texas-hold-em` · Site `appgprj_6ae62e96ac688191bffc3c629e66a5b0` · https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/

**Version5 is published**, deployment succeeded, from source `55dd531b028b34cf48636f5b5209e3862ab1b45e`. The authoritative native deployment record is `TEST_EVIDENCE/step4a/publication.json`. The existing project and public guest audience are retained; Poker MaxEV was not accessed.

## What changed

New policy `synthetic-cash-1.0.0` provides eight different synthetic styles: nit, TAG, LAG, calling station, recreational, maniac, fit-or-fold and stronger regular. It also supports Random, Unknown and Custom, thirteen trait controls, independent skill controls, low/mid/high/neutral populations, and stable individual seeds. All numerical population priors are designed, not measured human data.

Modules: `src/bots/{profiles,features,strategy,memory,boundary,policy}.ts`. The session service (`src/session/controller.ts`, `bot-observation.ts`) persists personality and reserved decisions. Public-history memory only includes permitted events and actual revealed cards. The engine's cards, chips, legality and payouts remain unchanged. `legacy-v0.ts` preserves the old policy byte-for-byte for old sessions and sealed histories.

The policy uses position, prior public raises/limps, isolation/squeeze nodes, effective stacks, price, made-hand contribution, draw quality, blockers, board texture, initiative and bounded public memory. Draw realization and range advantage are approximations. River rank bounds enumerate possible unseen opposing holdings from own/public cards only; they do not read actual hidden cards or solve strategy. Action and size draws are stable across retry/reload.

Setup and public between-hand observations are in `src/ui/opponent-{setup,study}.ts`. Active hands lock Study. Unknown/private profiles remain undisclosed in ordinary controls and redacted exports. Policy-version provenance appears in sessions/history/replay; configuration results are segmented by frozen policy-version set in `src/stats/cash.ts`.

## Executed checks

- **339/339 automated tests PASS**, 34 files, zero failed/skipped. Integrity, TypeScript, ESLint and production build PASS. Includes all prior 262 tests, PokerKit 0.7.7 compatible independent fixtures and 20,000 seeded accounting hands. Exact log: `TEST_EVIDENCE/2026-10-31T22-29-14-912Z/manifest.json`.
- Independent full experiment: **256,000 decisions**, 32 contexts ×8 fixed profiles ×1,000 samples; **13/13 behavioral checks PASS**. **1,600 completed engine hands**, **21,352 legal actions**, 866 showdowns, 734 uncontested endings, 90 multi-pot hands; no accounting or termination failures. Raw counters, opportunity denominators, Wilson intervals and runtime hashes: `TEST_EVIDENCE/step4a/final-evaluation/`.
- Actual Chromium UI: **20 complete hands**, five each at 2/6/9/10 seats and widths 1280/390/320/430. Real app controls, controller, bot timers and engine; isolated in-memory wallets. All twenty records independently reconciled; five unique settlement events per session, no horizontal overflow. `TEST_EVIDENCE/step4a/browser/hand-accounting-audit.json`.
- Final responsive browser matrix: **105/105 PASS**, 2/3/6/9/10 seats × seven portrait/landscape/tablet/desktop viewports × preflop/river/showdown. Seat/board/card/label overlap, clipping, Hero placement and action-shortcut visibility asserted. `browser/layout-matrix-final.json`.
- Separate actual IndexedDB integration journey: new six-seat Unknown/Custom session; study locked during play; reload after a Hero action; complete showdown; reload after payout; one cashout; settings preserved; manual adjustment survives reload with poker result unchanged; both legacy/current history version labels visible. DOM evidence in `browser/step4a-*.txt`.

Browser decision-preparation p95: 27.9/28.0/41.3/38.1 ms for 2/6/9/10 seats, respectively. Maximum observed browser long task was156 ms. These measurements include test rendering/storage overhead and are not physical-phone certification or a long-session performance guarantee.

## Measured examples

Each conditional row uses 1,000 independent seeded decisions per fixed profile in the **same scenario**. These are synthetic outcomes, not human frequency calibration.

| Scenario/action | Nit | Calling station | TAG | Stronger regular |
|---|---:|---:|---:|---:|
| Unopened AA / raise | 507 | 271 | 962 | 963 |
| JTo early position / continue | 450 | 958 | 558 | 576 |
| Flop nut-flush draw + two overcards, half-pot / call | 817 | 921 | 779 | 740 |
| Same draw scenario / raise | 43 | 40 | 145 | 201 |

Six-seat whole-hand VPIP: nit74/300 (24.7%), station201/300 (67.0%), TAG98/300 (32.7%), maniac204/298 (68.5%). Denominator: at least one voluntary preflop decision in that hand/player. PFR: nit28/300, station27/300, TAG61/300, maniac135/298; denominator is at least one **legal preflop raise opportunity**, including legal short all-ins. Exact 3-bet, continuation-bet and check-raise denominators and descriptive intervals are in `tests/step4a/VERIFICATION.md`. Within-hand samples are correlated. The opponent Study observed-raise rate has a separately disclosed acted-hands denominator.

## Completed browser hand and bankroll proof

During integration, six players began with$200 each, buttonHero, AlexSB$1, MorganBB$2. Preflop: Jordan folded, Riley called$2, Casey raised to$6.89, Hero called$6.89, Alex completed to$6.89, Morgan and Riley folded. Flop6c2h5s, turn5d, river8c: Alex, Casey and Hero checked each street. Hero3s2c beat Alex9h4s and CaseyAdQd. Hero received$24.67, rake$0, refunds$0. Final stacks: Hero217.78, Alex193.11, Morgan198, Jordan200, Riley198, Casey193.11; total$1,200. Hero profit$17.78.

Wallet$2,167.50 → buy-in$200 → $1,967.50. Reload retained the hand and eventual$217.78 stack. Cashout credited that stack once, producing$2,185.28. A manual+$100 adjustment produced$2,285.28 after reload while cumulative poker P&L remained−$14.72 (prior records included). Existing nine canonical hands were retained and the new hand became the tenth; prior imported study hands stayed separate.

## Published guest check

Version5 retained the previous$2,504.50wallet and two canonical hands. A new Unknown-opponent$1/$2 heads-up session bought in$200, survived reload after the preflop call, and completed a real hand. HeroKh7h called$1 to complete the blind; Alex checked. Both checked all three streets onTd9sJs/Th/8h. AlexAcQc won$4 with a queen-high straight over Hero’s jack-high straight. Final stacks$198/$202 conserve$400. Reload after payout retained the result; cashout credited$198 once, leaving wallet$2,502.50 and three saved hands. No Google authentication was required. This is **one additional published browser hand**, separate from the20 isolated UI-runner hands. Evidence: `TEST_EVIDENCE/step4a/browser/live-guest.json`.

## Defects and honest limits

Early candidate failures and corrected logs are retained. Repaired: excessive AA/nut folds, missed terminal value, profitable cheap-draw folds, weak shared-board/flush strength, blind position and all-in effective-stack errors. The evaluation's initial seed/position correlation was also repaired before final statistics.

Remaining realism issues are explicit: nit early JTo continues45%; TAG97s stack-depth sensitivity is weak; c-bet/check-raise samples and frequencies need broader review; shared-board/tie-aware ranges are rudimentary. There are no persistent weighted opponent ranges, solver-verified strategies, licensed human calibration, complete 169-class range validation, tournament policies or full human-realism certification. The app remains a local guest simulator; developer tools can inspect local hidden state, while ordinary UI and bot APIs are redacted.

**The playable synthetic Step4A increment is verified; full G4 human-realism signoff is not complete.** G3 has the user's conditional signoff. Physical iPhone4/5 is user-reported; mobile export remains **AWAITING USER VERIFICATION**. No physical device check was performed here.

Acceptance tracker: **69 PASS / 0 FAIL / 5 BLOCKED / 228 NOT_EXECUTED =302**. BLOCKED rows concern unavailable human datasets/review. Automated test totals are not acceptance counts. Original302 requirements and86 deferred entries remain byte/hash verified. Broader rows retain partial-evidence notes rather than an invented PASS.

## Next tasks

**4B:** Build and validate position/node-specific 169-class weighted ranges; strengthen stack-depth and clean/dirty-draw realization; persist public-line range beliefs; improve board-only/tie decisions, value/bluff/check-raise and barrel consistency. Start with the recorded nit-JTo and97s counterexamples. Add matched context tests before changing policy version.

**4C:** Compare frozen versions against independent baseline/exploit strategies (minbet, overbet, limp-all, always-call, never-bluff, maximum aggression); measure full action sequences and population ecology across seeds, stakes and rake; conduct longer browser/device load and recovery runs. Use rights-cleared, player/session/venue-disjoint human data and blinded reviews only if available. Record failures and uncertainty; complete the remaining G4 checks and physical mobile export check before claiming realism signoff.
