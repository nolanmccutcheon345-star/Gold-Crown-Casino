# Exact-candidate external test round

Candidate URL: https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/

Application source `3ecea1c2b71c8e8b9963547da676171f91f21716`; test-site package `566f3b11032841c492e6e148bb9a1139e74247b7`, Site revision 6. Use the ordinary public test URL, not production or the private V12 site. Record the displayed candidate identity before testing. If it differs, stop and record the mismatch. Use a new isolated test run; do not clear a browser's unrelated saved data. These tests use virtual money only.

No external results have been entered. The forms distinguish observations from planned actions. GitHub/hosted CI V522 remains BLOCKED pending the user's later connection.

## iPhone Safari and declared reference devices

Record phone model, iOS version, Safari version and date. Use actual normal Safari on the device. Repeat the specified performance observations on a declared physical desktop/browser. Chromium CSS-width captures do not satisfy these device clauses.

1. Open the test URL without Google sign-in. Confirm the application source above. Set up 2, 6, 9 and 10 occupied seats; inspect portrait and landscape. Hero stays at the bottom, cards and labels remain separate, and all acting-player and legal-sizing indicators remain readable.
2. Complete hands through ordinary controls. Exercise fold, check, call, numeric bet/raise-to and the all-in confirmation; record wrong taps, clipping, delays or stalls. Check minimum and maximum sizes, whether amounts are totals or additions, whose turn it is, and the final payout.
3. Record wallet and table stack. Make a labeled manual adjustment and confirm that poker P&L does not increase. Cash out once, start another session and confirm history remains. Refresh during a pending bot action, then close/reopen Safari; compare the recovered hand and wallet.
4. Open hand history, replay and export. Use Share/Save to Files or the supported download route, save the JSON, locate it in Files and reopen it. Record file name/size and whether it is valid readable JSON. Import into Study only and confirm it does not alter the bankroll or original results. Never describe a visible-copy fallback as a successfully downloaded file.
5. For U11 and V518, measure repeated 2/6/10-seat play. Log sample count, decision-compute and response p50/p95, render timing, input-to-confirm, frame responsiveness, memory metric/units and action errors in `physical-performance.csv`. Use documented device instrumentation; intentional think-time and tap-to-visible response are separate from compute. If a metric is unavailable, mark it NOT_EXECUTED and name the limitation.

Physical iPhone Safari export remains **AWAITING USER VERIFICATION** until these steps are actually observed.

## VoiceOver and keyboard

Record the actual reader and browser versions. On iPhone, enable Settings → Accessibility → VoiceOver. A tester familiar with VoiceOver should swipe through the page and double-tap controls; an unfamiliar user's learning difficulty must not be mistaken for application failure. A physical Mac with VoiceOver can additionally exercise keyboard interaction.

Verify announced page/section names, actor, dealer/blinds, Hero card rank and suit, board, hidden-opponent status, pot, stack, call amount and total raise-to limits. Operate all available legal betting controls and hear validation errors, street changes and payout without relying on color or animation. Navigate Cashier, New Session, history/replay and export/import. Confirm dialog focus enters, exits and returns appropriately, status announcements do not repeatedly interrupt speech, and there is no keyboard trap. Record actual speech and focus targets, not just whether an ARIA attribute exists. Preserve problems and retest fixes. Do not enter PASS based only on automated accessibility checks.

## Three independent new users

Invitation to share (not sent): “Please help test a virtual-money poker practice application. We need three people who have not used this application. Each person will independently set up a table, play 25 observed hands, end the session and inspect history. We are testing the interface, not your poker skill. Please say what you expect a control to do and report anything confusing. No real money is involved.”

For each P1/P2/P3, record prior application experience, device/browser and candidate source in `participants.csv`. Have an observer watch 25 completed hands. Before play, ask the participant to locate the call/additional amount, minimum raise and raise-to total, then configure the table without step-by-step coaching. During play ask them to identify the actor, player positions, pot and payout when naturally relevant. At the end ask them to cash out and review history. Avoid instructing them where to tap; record any assistance when needed.

Use one row per actually observed hand in `hand-observations.csv`; all 75 rows start blank. Record misclicks and ambiguity even if they recover. Enter reproducible issues in `issues.csv`: critical = corrupted money/state or blocked completion; major = core task requires assistance; minor = recoverable confusion or visual problem. Do not count bot simulations, staff repetitions, unobserved hands or fictional participants. Re-test resolved issues and retain the original result.

The exact governing descriptions are preserved in `original-criteria.json`. Completion of one task does not automatically satisfy the other clauses of its original requirement.
