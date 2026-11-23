# Exact-candidate external verification — Step 5N

Use https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/ . Record the displayed application source **3ecea1c2b71c8e8b9963547da676171f91f21716**, packaging **2ab7ff9dbedcfcdcb712c6b01e423133426474b8**, test revision 7 (test-site numbering; distinct from production Version 7). Production Version 7 and private Version 12 are not this candidate. If the identity differs, record it before interpreting results. Use only virtual money and an isolated test account; do not clear unrelated saves.

## First: attribute the iPhone PASS already reported

The owner reported physical iPhone Safari testing **PASSED** in the Step 5N directive. That is genuine user-reported evidence; no device, date, candidate or individual results were supplied. Do not repeat checks unnecessarily. Please supply:

- Test URL/build, iPhone model, iOS/Safari versions and approximate test date.
- Whether the passed checks included 9/10 occupied seats, bets/raises, cashout/New Session, refresh/close/reopen, and exporting JSON to Files and reopening it.
- Whether actual VoiceOver interaction or instrumented timing/memory measurements were performed. If not, say “not tested”; ordinary successful play does not imply either.

Enter previously completed observations in device-reader-results.csv with their actual dates. The existing general report remains in ../owner-iphone-report.json; do not replace its unknown details with guesses.

## Only missing iPhone/device checks

1. Confirm guest access and the exact candidate. At 2/6/9/10 occupied seats, inspect portrait/landscape and Hero cards/labels, pot, dealer and action controls.
2. Complete ordinary hands using fold/check/call, legal raise-to and all-in confirmation. Record action errors and delays; inspect payouts.
3. Record wallet/table/P&L, make a labeled manual adjustment, cash out, and confirm poker winnings exclude that adjustment. Reload during a pending bot turn, close/reopen Safari, compare the recovered hand and balances.
4. Save a history JSON to Files through Download or Share, find and reopen it, then import into Study and confirm no wallet/P&L change. Merely displaying copy-JSON does not prove a file download.
5. U11 and V518 also require declared physical phone/desktop measurements. At repeated 2/6/10-seat play record sample counts, decision-compute and response P50/P95, render/frame timing, input-to-confirm latency, memory metric/units, and attempted/erroneous actions. Preserve instrumentation output and separate intentional bot delay from compute. Mark unavailable metrics NOT_EXECUTED. Cloud emulation is not physical evidence.

## Actual VoiceOver — U10 and V518

Use a tester comfortable with VoiceOver. Record actual reader/browser versions. Enable Settings → Accessibility → VoiceOver; use swipes and double taps. Test the following and record what was spoken and where focus moved:

1. Setup and table: page/section names, seats/positions, actor, dealer/blinds, Hero card rank/suit, hidden opponents, board, pot, stack and legal amounts.
2. Finish a real hand without visual-only information: check/call/fold/raise-to controls, input limits/errors, street transitions and winner/payout announcements.
3. Cashier and New Session, history/replay and export/import: dialog focus enters/returns, controls are operable and no keyboard/focus trap exists.
4. Repeat keyboard paths on a declared desktop. Check that announcements do not continually interrupt speech and errors remain understandable without color or animation.

An ARIA label or automated accessibility PASS is not a screen-reader result. Save actual speech/focus observations in device-reader-results.csv and issue reproductions in issues.csv.

## Three independent new users — V707

Invitation to share (not sent): “Please test a virtual-money poker practice app you have not used before. Independently set up a table, play 25 observed hands, end the session and inspect history. We are testing the interface, not poker skill. Say what you expect controls to do and report confusion. No real money is involved.”

Use anonymous IDs P1/P2/P3. Record distinctness, prior app experience, physical device/browser, observer and exact build in participants.csv. Before play, each user must locate minimum raise, raise-to total and call/additional amount without coaching. Observe 25 completed hands per participant. Log each real hand ID/outcome, every misclick, ambiguity, assistance and recovery issue in hand-observations.csv and issues.csv. Include setup, whose turn, blinds/positions, bets/raises, pots/payouts, ending session/cashout and history. Choose and record mobile/desktop views in advance; do not convert automated hands into participant results. The three users must actually complete 75 observed hands in total.

Record severity as blocker/major/minor, exact steps, expected/observed behavior, screenshot or recording reference where permitted, and retest result. Do not conceal assistance by marking the task independently completed. Stop on money corruption, duplicated payout, unrecoverable state or hidden-card exposure; retain evidence.

## Submission

Return completed CSVs and evidence references; do not provide personal credentials or actual private bankroll records. Empty forms are not test completion. No participant, actual reader, instrumented physical performance or per-check export result has been invented in this kit.
