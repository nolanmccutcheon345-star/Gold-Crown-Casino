# Independent oracle, development only

Pinned dependency: `pokerkit==0.7.7` (MIT). Python is never bundled into the browser.
Primary references inspected 2026-10-31:
- https://pypi.org/project/pokerkit/0.7.7/
- https://pokerkit.readthedocs.io/en/stable/evaluation.html
- https://pokerkit.readthedocs.io/en/stable/simulation.html

Run from the project root:
```
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/oracle/requirements.txt
RUN_ORACLE=1 ORACLE_PYTHON=.venv/bin/python npx vitest run tests/oracle
```
The regular unit run explicitly skips the independent Python suite unless RUN_ORACLE=1. A skipped suite is NOT execution evidence. CI's separate oracle job installs the pinned version and requires execution.

Coverage: 242 pairwise 5/7-card hand comparisons, a three-way unequal-stack all-in with main and side pot, a short opening all-in after an earlier check, and a DEF-003 legal five-handed tied showdown with different folded contributions. The Python process imports no application code and computes its own outcomes. PokerKit orders positions SB, BB, ..., BTN for >=3 players; the adapter explicitly maps application seat IDs to positions.

Practice-profile short opening fixture: BB=2; SB checks flop; BB bets final 1; BTN minimum raise-to=3. If BTN calls, the earlier checker can also raise-to 3. This pins our transparent practice profile against PokerKit's CASH_GAME behavior. It does not claim that all rooms use one universal rule.

Not covered by this oracle: rake/rounding, general odd-chip priority beyond the DEF-003 equal split, cash seat eligibility, dead/missed blinds, straddles, cumulative short raises, tournament button profiles, tournament lifecycle, persistence, bot realism, or the full 302 acceptance requirements. Independent analytical fixtures supplement some of these; no unverified FIX06/FIX06B expected result has been invented.

DEF-003 regression: folded contributions 1, 2, 5 and tied surviving contributions 7, 7 yield one contestable pot of 22 and awards 11/11. Segmenting at folded-only thresholds creates tiers 5+4+9+4 and incorrectly gives the same seat two odd chips (12/10). PokerKit independently produces application-seat stacks `[104,99,98,104,95]` from the recorded legal actions.

## Step 2 compatible additions

`step2-pokerkit.test.ts` additionally compares the exact 100 → 260 → minimum 420 sequence, cumulative short raises 100 → 140 → 180 (no reopening), 100 → 150 → 200 (reopening to 300), and all-in contributions 50/120/300/300 with pots 200/210/360 and respective eligibility. It maps the actual simulator's 20 heads-up hands to PokerKit's fixed intra-hand positions. Between-hand button selection remains an analytical application test; PokerKit does not supply a cross-hand table director.
