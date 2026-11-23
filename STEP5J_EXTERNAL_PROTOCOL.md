# Step 5J external checks — one identified candidate

**NOT_EXECUTED: no physical-device, screen-reader or independent-user result is claimed.** Physical iPhone export remains **AWAITING USER VERIFICATION**. V522 hosted CI remains BLOCKED pending the user's future GitHub connection; it does not prevent these checks.

Use only https://ai-texas-hold-em-r1-test.stevemccutcheon89.chatgpt.site/. The application source is **138cdcf325129c69f127d0e16bc94942abea752f**; the later main source **a41250f87af3db07f6a9a9c47507abd94bf25003** adds evidence without changing production inputs. Also record the hosted packaging commit from the final Step 5J report. This distinction prevents a wrapper update or an old Version 12 test from being mistaken for a different application build. Production Version 7 and the original Version 12 test Site are outside this protocol.

Open the HTTPS URL, choose **Verify and open candidate**, confirm that **Candidate and measurement proof** shows the source above, then use **Go to candidate table and controls**. Keep the complete resulting URL, including `run`, for reload/reopening. Each participant starts a separate run and uses only test play money. Do not import a production save or clear browser data. If verification fails, record the message; do not bypass it.

For performance collection, enable the existing timing-only option by adding `measurePerformance=1` to the candidate URL before opening it (`?measurePerformance=1` for a URL with no query; `&measurePerformance=1` if it already has one). Confirm `performanceOptIn: true` in the proof. Keep this option and the run identifier in the bookmarked URL. This records measurements; it does not control poker decisions.

## Governing criteria, unchanged

| ID | Original acceptance criterion |
|---|---|
| U10 | Core actions operable and properly announced without animation-only meaning |
| U11 | Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop |
| V518 | Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels. |
| V707 | Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion. |

The original criteria do not name a phone model or mandate a particular desktop OS. Declare the actual iPhone/Safari and physical desktop/browser before testing; record exact hardware, OS/browser versions, viewport, power mode, zoom and candidate identity. A cloud browser or narrow iframe cannot fill a physical-device row. The V7 Master also requires known/Unknown lineup setup, minimum/pot-sized raise comprehension, 25 consecutive hands, history, reload recovery and locating bankroll edit. Its proposed local-action p95 input-to-render target is under 250 ms; a DOM-confirmation proxy alone does not prove physical rendering latency.

## Physical iPhone Safari and desktop

Use `tests/step5j-external/device-reader-results.json` and `physical-performance.csv`. Unknown measurements stay **NOT_MEASURED**, never zero.

1. Record device/build details. Open as a guest and confirm loading changes to verified readiness before action/cashout controls work. Use a $1/$2 table and $200 buy-in. Complete repeated hands at **2, 6 and 10 seats**; also inspect **9 seats** in portrait and landscape. Check Hero at bottom, readable cards/stacks/bets/pots, controls within reach and no sideways scrolling.
2. Before submitting a raise, say the displayed call amount, minimum raise-to, raise-to total and additional chips. Choose and enter a size, then compare intended versus committed action. Try a below-minimum entry and correct it. Record any accidental/double action, overlap or unexplained focus move.
3. Record wallet, table chips, poker profit and canonical hand count. Reload during a hand, then reopen the same bookmarked URL after closing Safari during a pending bot turn. Compare recovered state and completed settlement. Report the actual interruption method; a tab close is not proof of an operating-system process kill.
4. Open **New Session** during a hand and use its explained finish/leave workflow. Confirm final settlement, one cashout and retained history, then create a different stakes/seating session. Make one small manual wallet adjustment and confirm poker profit does not change by that adjustment.
5. Open a completed hand and replay it. Prepare the ordinary **History export**; use **Share → Save to Files** or **Download JSON**, and use **View/copy JSON** if the first route fails. In Files, reopen the saved file. Keep the actual file and record filename, byte size and hand count. Import it only as a **Study copy**; check replay, permitted cards, unchanged wallet/profit and unchanged canonical hand count. Imported study copies may increase the displayed combined history list. A dismissed share sheet is not a saved file.
6. Repeat **2/6/10-seat** gameplay on the declared physical desktop. On each device, capture separate startup, active-play, history, audit and reload windows: export **Prepare observation file → Download observation JSON**, then use **Begin next measurement phase (export first)**. Record actual duration and completed hands; collect at least three active-play windows for the repeated measurement review. Keep slow samples.
7. Record decision-policy and full-preparation p50/p95 and sample counts separately, trusted input-to-confirm samples, frame/render measurements, long tasks, memory method and action errors/opportunities. The observation file identifies unsupported APIs. Its DOM confirmation proxy is not physical paint, durable settlement time or full INP. Where required render/memory measurements are unavailable, retain that limitation and arrange supported device tooling; do not mark U11/V518 complete from a subjective “feels fast.”

Guest saves are device/browser-local and can be lost through browser eviction or user deletion. The diagnostic export and public hand-history export are different files; neither is a complete bankroll restore backup.

## Actual VoiceOver and keyboard

Use actual VoiceOver on the iPhone (or the tester's normal supported desktop reader/browser), record reader/version and experience, and keep the source/build proof. Enable VoiceOver using the device's accessibility controls. Swipe to select and double-tap to activate on iPhone; a novice's gesture-learning problem should be recorded separately from an application defect. Test the desktop core path with Tab/Shift+Tab, arrows, Enter and Space.

At **2, 6 and 10 seats**, use spoken output to identify rank/suit, concealed opponents, dealer/blinds, acting player and pot. Make a check/call and a raise; correct an invalid amount; hear turn/street changes and the payout. Navigate Cashier, safe session exit, History/replay/export and reload recovery. Check visible focus, return focus, no keyboard trap and suit meaning without color. For each task, record **the exact words actually heard**, missing/repeated announcements, lost focus and any sighted assistance in `device-reader-results.json`. Audio recording is optional and requires the participant's agreement. An accessibility-tree dump or DOM announcement string is supporting comparison material, not spoken-output evidence.

## Three independent new users: 25 observed hands each

Recruit **three different people who have never used this application**. Use anonymous P1/P2/P3 and at least one actual narrow phone and one actual desktop across the study. Declare their devices before execution. No invitations have been sent by this preparation.

Read this opening unchanged: “This is virtual-money poker practice. We are testing the interface, not your poker skill. Please say what you expect a control to do and tell us when anything is unclear. I will observe before helping. You can stop at any time.” Ask permission before recording audio/video; do not collect credentials or private production histories.

Ask each person, without pointing to controls, to set up a known/Unknown lineup; identify actor/blinds/positions; locate and explain minimum raise, raise-to total, additional chips and call amount **before coaching**; then play **25 consecutive, completed, observed hands** through ordinary controls. Where a legal opportunity occurs, ask them to explain/use a pot-sized proposal. Have them interpret pot/payout, find history/replay and bankroll edit, reload the same run, and safely end/cash out the session. Do not rig actions or force a poker decision to manufacture an opportunity. Mark a missing opportunity as such.

The observer fills `participant-results.csv` and the **75-row** `hand-observations.csv`. Record exact displayed amounts, the participant's explanation, intended/actual action, each misclick/ambiguity and any assistance. Only enter zero errors after actually observing the hand. An unfinished or unobserved hand does not count. If stuck, ask “What would you try next?” before helping; record the blocker and exact assistance. Coached success is not unassisted discovery.

Record defects in `issues.csv`: **critical** for financial/state/privacy integrity or unsafe recovery, **major** for an unintended action or blocked core task, **minor** for understandable but confusing presentation. Preserve failures and reproduction evidence; fix reproducible defects and repeat affected tasks. A reviewer checks all three real participants, 25 observed completed hands each, comprehension and defects before assigning V707. Internal agents and simulations cannot fill participant rows.

Return the completed forms, diagnostic JSON, actual exported history file and relevant screenshots/recordings. This protocol creates no external PASS. All four original criteria remain NOT_EXECUTED until actual evidence supports their full scope.
