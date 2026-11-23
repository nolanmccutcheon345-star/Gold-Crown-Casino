# Version 12 candidate: short tester guide

Use the **separate testing Site URL supplied by Steve**, not the public Version 7 Site. The testing page must say **Isolated candidate verification**. If the hosting platform asks you to sign in, use your own authorized account; do not share credentials. The poker app itself does not require Google sign-in. No production bankroll or history should be imported for these checks.

1. In **Tester and device details**, enter an anonymous label, choose **Physical device**, and record your device model, OS and browser versions. If using a screen reader, record its name and version too.
2. Select **Verify and open candidate**, then **Go to candidate table and controls**. Asset verification is not wallet verification: wait for the app's own loading state to finish before playing. If it says BLOCKED, record that message and stop.
3. Copy or bookmark the **complete URL after opening**. It includes a run ID. Always use this same URL for reload/recovery testing. A different run ID starts another isolated test save.
4. When reporting a result, use **Go to observation form → Prepare observation file**. Download/share that file. Use **Show / copy JSON** if saving is unavailable. This diagnostic file is separate from the app's hand-history export.

## iPhone Safari

Use actual Safari on the iPhone, not a simulated phone window. Record the exact model and iOS version; do not guess a Safari version that the device does not display.

- Set up $1/$2, a $200 buy-in and mixed opponents. Complete hands at **2, 6 and 10 seats**, then check **9 seats**. Check portrait and landscape: Hero at the bottom, readable cards/stacks/pots and accessible betting buttons. Save a screenshot of any overlap or horizontal scrolling.
- Before a raise, read the minimum, raise-to total, additional amount and call amount. Select a size and confirm the actual committed action. Record any double tap, unintended action or rejected input; do not call a missing measurement zero.
- Open **New session** during a hand. Follow the explanation to finish/leave safely. After the hand, confirm one cashout, preserved history and a new configurable session.
- Note bankroll, table chips, result and hand count. Reload the same bookmarked URL during a hand, open the candidate again and compare. Separately close/reopen Safari during a pending bot move. Record exactly what you did; closing a tab is not an operating-system process-kill test.
- After a completed hand, open the app's **Hand history** and prepare its export. Choose **Share → Save to Files**, or **Download JSON** if offered. Locate the actual file in Files. Keep it for review; a successful share-sheet dismissal alone is not proof it was saved.
- Import that file through the app's **study-only import**, confirming rights to use it. Check the imported hand/replay and confirm that the wallet, poker results and original hand count did not increase. If the file is split into batches, keep every batch and test each import.
- Play an extended session, then save an observation file. Record duration and completed hands. The diagnostic timing samples are useful; they do not automatically prove physical-device acceptance. Unsupported memory measurements remain **NOT_MEASURED**.

**iPhone export remains AWAITING USER VERIFICATION** until a real file from this candidate is saved, reopened and checked. Send the history file and diagnostic file separately, with device details and any screenshots.

## VoiceOver on iPhone

Turn on **Settings → Accessibility → VoiceOver**. Swipe left/right to move through items; double-tap to activate the selected item. If new to VoiceOver, practice its controls before testing and record your experience level.

Using speech rather than the visual table, reach setup, start a game and identify your cards, blinds, current actor and pot. Make a check/call and a raise, correct an invalid amount, hear the next street and the payout, then use Cashier, History/replay and reload. Repeat core play at 2, 6 and 10 seats.

Write the **exact words actually spoken**, including missing or repeated announcements, lost focus and tasks needing sighted help. Record the blocked task before using a workaround. A DOM text report, automated label check or computer voice reading a screenshot does not count as a VoiceOver test. A declared desktop screen-reader/browser session is also needed for the complete device matrix; see `SCREEN_READER.md`.

## Three new users

Use **three different people who have never used this app**. Assign P1, P2 and P3. Agree on an actual phone and desktop across the study and authorized candidate access before starting. Do not send invitations automatically.

For each person, the observer reads the opening in `NEW_USER_STUDY.md`, then asks the user to set up a table and locate/explain the minimum raise, raise-to total, additional amount and call amount **before coaching**. The person plays **25 complete, observed hands** through ordinary controls, then reviews history, reloads and ends a session.

Use `hand-observation-form.csv` for all **75 observed hand rows** and `FEEDBACK_FORM.md` for comprehension and issues. Record every actual misclick, ambiguity and assistance prompt. Leave unobserved rows unexecuted; simulated hands and one person repeating the test do not qualify. Preserve failures, fix reproducible defects and repeat the affected task. No participant results are claimed yet.

For detailed performance, device, spoken-output and issue fields, use the included checklists and blank JSON forms. **No original acceptance requirement automatically passes when a form is filled.**
