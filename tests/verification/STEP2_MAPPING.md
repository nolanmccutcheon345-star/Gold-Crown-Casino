# Step 2 independent acceptance mapping proposal

The integration owner controls acceptance status. This file does not change any original requirement or acceptance CSV. Each row below has a dedicated executable test in `tests/verification/step2-acceptance.test.ts`, named with its original ID and exact title. The supplied tracker remains authoritative.

Initial execution against contracts-only commit 79f29b6:18/22 tests passed, 4 failed because nextHand(3) and uncalledBet(1) were not implemented yet. After engine 645e2e6:22/22 passed. The 22 tests cover 21 named requirements plus one supplemental funded-seat transition scenario. Final status must use the integration owner’s committed-source evidence.

| ID | Exact title | Specific evidence |
|---|---|---|
| A01 | New hand, 10 active seats | Ten seats, 20 unique hole cards, three burns, 5 board cards, 52-card uniqueness and cursor checks through all streets. |
| A03 | Tests with same deterministic seed and same actions | Seed30303, identical scripted legal actions and deep equality after every reducer transition. |
| A06 | Four cards of one suit on board plus qualifying own suit | Four-club board plus Qc makes A-Q-9-7-2 flush and beats three aces; exact payout. |
| A07 | Same top pair but different kicker | Top pair aces with king kicker beats top pair aces with queen kicker; exact payout. |
| A08 | Board makes best five-card hand for two players | Royal-flush board ties two live players; folded SB contributes odd chip, clockwise winner gets3 vs2. |
| B03 | Several physical seats empty | Unsorted occupied physical IDs1, 5, 8; current and next-hand button/blinds skip empty seats. |
| B04 | Big blind offered option after limpers/calls | HU SB call preserves BB check/raise option; also three-handed limpers. |
| B05 | Bet 100 → opponent raises to 260 | Actual flop bet100, raise-to260; increment160, min420;419 rejected. PokerKit differential also matches. |
| B06 | A bet 100 → B short all-in 150 | Short150 over100 does not reopen; later full250 re-evaluates rights and gives min350. |
| B07 | A bet 100 → B all-in 140 → C all-in 180 | Exact100→140→180, earlier bettor cannot raise. PokerKit differential also matches. |
| B08 | A bet 100 → B all-in 150 → C all-in 200 | Exact100→150→200, earlier bettor can raise-to300. PokerKit differential also matches. |
| B09 | Hero owes 20 and has 13 remaining | Hero owes20 with13; all-in call13, main45 eligible all, side14 excludesHero; exact final stacks. |
| B14 | End of street | Final actor required before street advances; street commitments reset, one street event, duplicate command inert. |
| B17 | No-limit raise sequence | Thirty consecutive legal full raises before capped jam/call; no arbitrary raise-count restriction. |
| B18 | Invalid inputs NaN, negatives, fractions below chip unit, huge amounts | NaN, negative, fractional cent, infinities, MAX_SAFE_INTEGER and1e100 rejected with deep state equality. |
| C01 | Four active players all-in for 50, 120, 300, 300 | Exact50/120/300/300 produces200/210/360 and correct eligible sets before rake. PokerKit differential matches. |
| C02 | One all-in player loses main, wins separate side? | 50-stack wins main;120-stack loses main but wins first side;300-stack wins deepest side. All winners eligible. |
| C03 | Player folds after putting chips in | Folded10 and2 remain dead money; only surviving bettor receives unmatched10 refund; contested22 awarded. |
| C04 | Uncalled excess raise | Unmatched20000 returned before rake; contestable20000 less capped 500; separate active uncalled projection. |
| C09 | Rake 5% capped $5 on postflop $200 pot | Postflop20000 cents pot, 5% with500-cent cap gives500 rake exactly once. Practice rounding floors cents; no claimed venue compatibility. |
| D03 | Heads-up button position on rotating deals | Twenty complete HU hands with nextHand, alternating button/SB/BB, postflop actor and exact funded-chip carry. PokerKit validates intra-hand HU action order only. |

## Boundaries

- Supplemental 9→2 test eliminates seven players through actual hands and verifies funded-seat rotation. It does not test arbitrary administrative cash seat exits or blind-wait policies and is not offered as full B19 acceptance.
- `tests/oracle/step2-pokerkit.test.ts` compares compatible B05/B07/B08/C01/C02 and intra-hand HU positions with independently installed PokerKit 0.7.7. PokerKit does not own between-hand button selection; no claim that it verifies cash seat movement or tournament rules.
- `tests/verification/accounting-batch.test.ts` is explicitly opt-in via RUN_ACCOUNTING_BATCH=1. Its two tests run10, 000 rake-free and10, 000 rake-on seeded hands. These are20, 000 hand samples, not20, 000 acceptance tests. Checks include every-transition chip identity, unique cards, valid actor, termination, provisional pot decomposition, idempotent commit and winner eligibility. Seeds 610000–619999 and 710000–719999. Five-percent rake capped 500 cents, no-flop-no-drop.
- No browser or human acceptance requirement is claimed by these Node/Python tests. No persistence, tournament, or bot-realism validation is implied.
