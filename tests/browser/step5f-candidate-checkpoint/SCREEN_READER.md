# Real screen-reader and keyboard session

Record the actual device/OS, browser and version, screen reader and version, verbosity settings, candidate source/build and run URL. Use the isolated candidate. Do not use a text-to-speech recording of the page or an accessibility-tree dump as the screen-reader result.

On iPhone, Apple documents VoiceOver under **Settings → Accessibility → VoiceOver**. Practice its gestures first if needed: swipe to select items and double-tap to activate. A novice learning VoiceOver should not be mistaken for an app accessibility defect; record both the control behavior and the user's assistive-technology experience. Official references checked November 1, 2026: [turn on and practice VoiceOver](https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/27/ios/27), [VoiceOver gestures](https://support.apple.com/en-is/guide/iphone/iph3e2e2281/ios). Select the guide matching the actual installed OS; those links do not assert the tester's OS version.

Use the tester's actual desktop screen-reader/browser combination as well. Record it rather than assuming NVDA, VoiceOver or another reader was used. Use Tab/Shift-Tab, Enter/Space and native field/select keys. If a mouse or sighted assistance is needed to continue, first record the blocked task and exact workaround.

| Task | Record actual spoken output and outcome |
|---|---|
| Guest startup/recovery | Loading versus verified-ready state is understandable; unavailable actions are communicated. |
| Setup and navigation | Reach setup, player count, stakes, buy-in, opponent lineup and main navigation; fields have useful names and visible/announced errors. |
| Cards and positions | Hero cards give rank and suit; concealed cards remain concealed; dealer, blinds, acting player and seat association are understandable without color. |
| Turn changes | Quote what was heard for Hero's turn and opponent actions; record missing/overlapping announcements or unexpected focus moves. |
| Betting | Identify Check/Call/Fold/Bet/Raise, minimum/maximum, total and additional amount; enter a draft and wait through background saves; draft and focus remain usable. |
| Invalid proposal | Attempt a below-minimum amount, hear/locate the error and correct it; no unintended wager. |
| Board and payout | Quote street, board, pot and final award/rake announcements. Explain the result using speech alone; note ambiguity. |
| Cashier/session | Reach wallet controls, top-up when permitted, safe end-session and cashout; understand why unsafe controls are unavailable. |
| History/export/replay | Reach a completed hand, move through replay and export controls; no premature opponent reveal or private parameters. |
| Reload | Return to the same isolated save, understand verification and resumed state, and continue without duplicate actions/payouts. |

Repeat the core paths at **2, 6 and 10 seats**. The physical-phone layout check additionally covers nine seats. Record actual utterances in `device-reader-results-template.json`; the harness's DOM announcement field is comparison material only. Preserve failures before making repairs, then rerun affected tasks with the actual reader. U10 is not complete until core actions work and are properly announced; automated labels/focus checks are partial evidence.
