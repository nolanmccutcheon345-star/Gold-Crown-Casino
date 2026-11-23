# Latest qualified candidate: device and usability checks

Use the **new, separately identified candidate URL** supplied with the release report. Do not use the public Version 7 Site or the older Version 12 testing Site for these results. Both are being preserved. Record the exact source commit and asset/build hashes displayed by the candidate. Results from an older candidate do not automatically verify a newer one.

**Before testing:** sign in with your own authorized account if the private Sites platform requires it. Do not share credentials or import a production bankroll. Select **Verify and open candidate**, then **Go to candidate table and controls**. Wait for the app to verify its save. Bookmark the complete URL, including the run ID, and use it for every reload. If access or verification is blocked, record the message and stop that check. The observer and the hand-history exports are separate files; neither is a complete bankroll backup.

## iPhone Safari — actual phone

Record phone model, iOS version, browser version if available, orientation, text zoom, power mode, candidate source/build, starting hand count and test duration. Leave unavailable measurements **NOT_MEASURED**.

1. Create a $1/$2 table with a $200 buy-in. Complete hands at **2, 6 and 10 seats**, and check **9 seats**. Check portrait and landscape, readable cards/stacks/pots, Hero at the bottom and reachable action buttons without sideways scrolling.
2. Before a raise, identify the displayed **call amount, minimum raise, raise-to total and additional chips now**. Submit a chosen amount. Record intended versus committed action, invalid-size feedback and any accidental double tap.
3. Open **New Session** during a hand. Use the explained finish/leave workflow. Confirm settlement, one cashout and preserved history; then change stakes/seating for another session.
4. Record bankroll, table chips, profit and hand count. Reload during a hand and compare after verified recovery. Separately close/reopen Safari during a pending bot move. Record the actual interruption mechanism; closing a tab is not an OS process-kill test.
5. After completing a hand, use **History → Export → Share → Save to Files**, or **Download JSON** where offered. Open the actual file in Files. Keep its filename, bytes and contents for review; dismissing the share sheet is not proof of saving. Import it for **Study only**. Verify replay/redaction and unchanged wallet, results and original hand count. Keep every batch if export is split.
6. Play an extended session. Capture observations separately for active play, history browsing, audit and reload. Record freezes or action delays with timestamps, even if recovery succeeds. Export the observation file and the actual history file separately.

**Physical iPhone export remains AWAITING USER VERIFICATION** until an identified candidate's actual file has been saved, reopened and checked.

## Physical desktop and performance — U11 / V518

Declare one actual desktop/laptop, OS/browser version and hardware before testing. Repeat **2-, 6- and 10-seat** play on it and on the phone. Keep the same workload/settings per comparison. Record duration and completed hands. Capture supported candidate metrics: decision computation and preparation separately, p50/p95 with sample counts, input-to-confirm latency, render/frame responsiveness, memory and actual action errors. Intentionally delayed bot animation is not compute time. An unavailable browser memory API is **NOT_MEASURED**, not zero.

Cloud Chromium emulation is separate engineering evidence. It cannot fill the actual phone or desktop rows. Do not label a loading indicator “financially ready” until the app reports verified readiness.

## VoiceOver and keyboard — U10 / V518

On iPhone, enable **Settings → Accessibility → VoiceOver**. Swipe to move between elements and double-tap to activate. Record the actual reader version if available and your experience level. On a declared desktop, use a real supported screen reader with its browser and version recorded; also test keyboard-only operation with Tab/Shift+Tab, arrows, Enter and Space.

Using spoken output, identify Hero cards, blinds, acting player and pot; make a check/call and raise; correct an invalid amount; hear a street change and payout; reach Cashier, History/replay and recovery. Repeat core play at 2, 6 and 10 seats. Confirm suit names are understandable without color. Record the **exact words heard**, missing/repeated announcements, lost focus, keyboard traps and any sighted assistance. Save audio only with the participant's agreement. Automated labels or a voice reading a screenshot are not screen-reader verification.

## Three new users — V707

Use **three different people who have never used this app**, identified only as P1/P2/P3. Arrange authorized private-candidate access and an actual phone/desktop across the study before starting. No invitations have been sent automatically.

Read this neutral opening: “This is virtual-money poker practice. We are testing the interface, not your poker skill. Please say what you expect each control to do and where something is unclear. I will observe before helping.”

For each person: ask them to set up a table and explain minimum raise, raise-to total, call amount and additional chips **before coaching**. Observe **25 complete hands through normal controls**, including actor/blinds/positions, betting and payouts. Then ask them to review history, reload and safely end the session. Use the 75-row sheet and feedback form. Record every actual misclick, ambiguity and assistance prompt. Unobserved is not “zero errors”; a partially played hand is not complete; simulated hands do not count. Preserve failures, repair reproducible defects and repeat affected tasks.

Return device/build details, per-hand observations, issue steps/severity, relevant screenshots or spoken evidence, the diagnostic file and the exported history file. A completed form does not automatically pass an original requirement. **No physical-device, screen-reader or new-user outcome is claimed yet.** Hosted CI V522 remains BLOCKED for the future GitHub connection and does not prevent these tests.
