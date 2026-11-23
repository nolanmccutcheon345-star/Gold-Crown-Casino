# Version36 — revised Patch18 and B1 headless blackjack

Base: Version35 application source f28ee8d2e6d59f5de69c9e46c3a43d0d49b3bdcb. This is a development addition, not an R1 release or a completed blackjack mode. The superseded Patch18 ZIP was not used. The revised supplied brief is preserved in TEST_EVIDENCE/blackjack36/USER_DESIGN_BRIEF.md.

## Implemented scope

- Play → Blackjack: nine table catalogue, six illustrative side-bet paytables, strategy drill/chart, five-system count trainer and experimental count-play drill. Sample table screens remain test fixtures, not playable tables. Free Bet and live side-bet settlement remain unavailable.
- User-confirmed casino default: 50 cents once per round, including all splits. Home defaults to no fee; explicit No ante and $1 configurations remain available. Starting blackjack balance is independently specified as $2,000; this preview creates no wallet or wager and never transfers poker/tournament funds.
- Classic blackjack B1 reducer: secure multi-deck shuffling with unique physical IDs; cents ledger; legal hit/stand/double/split up to four hands; split-ace restrictions; surrender, insurance, even money only on 3:2 naturals; H17/S17; 3:2/6:5 settlement; revision/idempotency controls and full deterministic replay validation. The public view omits the dealer hole card, future shoe and private replay commands.
- Version35 app integration was merged manually so tournament fast-forward, recovery export and previous cash/interface fixes stay intact.

## Review and limits

Two reproduced coach defects were repaired: no-DAS tables no longer permit doubling after a split, and hint selection considers the remaining legal actions when surrender is unavailable (8,8 versus ace could incorrectly become Hit instead of Split). See docs/reports/VERSION36_COACH_REVIEW.md.

Advice uses fixed rank probabilities after visible-card removal, without full finite-shoe depletion or resplit modeling. This affects all table models, especially close two-deck decisions. Feedback says 'model suggests' / 'matches the model'. Count indices are experimental for every system. Embedded fixtures are not proof of independent published-chart validation. Unattributed correlation claims were removed from the UI. No house-edge simulation or profitability claim is supplied.

B1 is a correctness foundation only: full-state clone/replay and ledger scans are not suitable for an indefinitely growing live archive. Persistent transactions, bounded archived records, interruption recovery, export, live controller wiring and independent blackjack reference comparison are still required before sit-down becomes available. Replay verifies internal consistency; durable storage must also anchor the latest committed sequence so an older valid prefix cannot silently replace acknowledged play. Engine rejects Free Bet/side-bet commands. Exhausted shoes fail atomically rather than inventing cards.

## Verification

Executed logs and results are in TEST_EVIDENCE/blackjack36. Independent review exercised 200 further rounds across all eight classic profiles with separately calculated payouts, in addition to the engine suite's 250 rounds. No accounting discrepancy was found. These fixtures do not establish house edge or complete game calibration. Automated test totals are not original acceptance IDs. Browser measurements use Linux Chromium and same-origin fixed-size frames, not physical iPhone/iPad Safari or VoiceOver. The first browser harness attempt used an obsolete cash submit selector; the corrected selector is #setup-submit. No application criterion was weakened. The first tournament-controls attempt was interrupted before result collection; only the later completed four-check run is counted. Direct Enter-key activation of a strategy answer produced feedback and moved focus to Next hand. This is not a screen-reader test.

## Next implementation

Connect a separately versioned blackjack controller and transactional persistence with archived completed rounds, exact-cent independent replay and reload/conflict tests; then enable classic tables and coach hints through the public view. Implement and independently validate Free Bet and each side-bet paytable before enabling them. Preserve the illustrative previews until then. Exact finite-deck coach calculation and empirical house-edge qualification remain separate work.

The 302 original acceptance records and 86 deferred features are preserved unchanged. Blackjack has its own scope here; no V7 criterion is invented or promoted. ProductionVersion7 and the original privateVersion12 environment remain untouched. Physical-device, real screen-reader, new-user and existing release gates remain open; the historical 10.07-second cash stall is not explained by this work. NOT READY FOR R1.

## Final executed totals

Full standard suite:2,494PASS,0FAIL,9optionalSKIP. Additional independently authored engine tests:10PASS,0FAIL (not included in the full-run count). The skipped cases are seven gated PokerKit comparisons and two explicit10,000-hand accounting batches; no new PokerKit execution is claimed this turn. Typecheck, lint, real Vite production build and governing specification integrity checks passed.

Browser:42blackjack preview/practice checks across320×568,390×844and1366×768; four complete2/6/9/10seat cash workflows including wallet-neutral study import and focus/status checks; four320px tournament control/auto-deal checks. Exact JSON and screenshots are linked by path in TEST_EVIDENCE/blackjack36. First strategy render measured29.1/30.0/32.7ms; first count-play render57.7/64.8/66.7ms in three separate desktop Chromium frames. These are single samples per viewport, not percentiles or phone-performance qualification.
