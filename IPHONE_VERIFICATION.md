# Current owner confirmation — Version38

On November 16, 2026, Steve reported: “I’ve done the iPhone and voiceover checks they’re good.” Both checks are recorded **PASS — USER CONFIRMED** for the current Version38 handoff. Evidence: TEST_EVIDENCE/blackjack38/owner-device-confirmation.json. Device metadata, individual steps and numerical performance measurements were not supplied; no retest of the confirmed checks is requested. Historical statements below describe prior candidates and do not override this confirmation.

# Physical iPhone verification — Step 5C continuation

Mobile export status: **AWAITING USER VERIFICATION**. The user reported four of five earlier Version 4 physical-iPhone checks passed. That report is retained; it does not verify Safari export or the unpublished Step 5C candidate. Current automated viewport screenshots were captured in Chromium, not on a physical iPhone or Safari.

Open https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/ in Safari. Version 7 remains published because R1 release gates are not yet satisfied. The download/share/copy workflow below is available there; the later candidate changes are not deployed. Guest practice requires no Google login. Do not clear website data; the bankroll is saved on this browser/device. Record which published version you test: a Version 7 result cannot be relabeled as candidate verification.

1. Note your available bankroll, poker result and saved-hand count in Cashier / Results.
2. Tap **New session**. If a hand is active, choose **Finish current hand & end session** and continue your decisions, or **Fold & leave after this hand**. The latter folds at your next legal turn; if already all-in, it waits for settlement. Do not expect an immediate reset of committed chips.
3. When the hand ends, confirm the setup screen appears and remaining chips return to Cashier once. Create 6-, 9- and 10-player sessions in turn. Check that Hero stays at the bottom, every other seat remains around the felt, cards do not cover labels, and dealer/blind badges stay with the seats. Try portrait and landscape. Use the bottom **Your action / Action controls** shortcut to reach betting controls.
4. Complete at least one hand, then open **Hand history → Prepare history export**. If **Share / Save to Files** appears, tap it and choose **Save to Files**, then open the saved JSON (or `.json.txt` fallback). The button is shown only when the browser reports compatible file sharing. Cancelling the share sheet must leave the prepared export available.
5. If native sharing is unavailable, try **Download JSON** and open Safari's Downloads/Files. If that is blocked, choose **View / copy JSON → Copy JSON** (or long-press/select/copy the text). This fallback uses the same redacted JSON. You can paste it directly into **Import pasted JSON** without relying on a download.
6. Use **Import study history** to select the saved file, or **Import pasted JSON → Import study copy**. Imported records must be marked study-only. Available bankroll, poker result and the completed-hands statistics must not increase. Re-importing the same file must not add winnings or duplicate its study records.
7. Reload Safari, then confirm the bankroll, saved hands and any active hand remain. Check that reopening New session still offers the correct safe workflow.

Expected file: `ai-texas-hold-em-history.json`, or `ai-texas-hold-em-history.json.txt` for a plain-text sharing fallback. The JSON starts with format `ai-texas-hold-em-public-history`, contains completed hands and permitted replay frames, and must not expose future deck cards, unrevealed opponent cards, seeds or private policy data. Public policy-version labels in the future candidate identify implementation provenance only, without per-seat archetypes or traits. This is a study export, not a bankroll backup or cross-device money transfer.

Please record iPhone model, iOS version, Safari versus an in-app browser, portrait/landscape, selected player count, whether sharing/download/copy succeeded, saved filename, and before/after bankroll and poker-result values. Screenshots of the 6/9/10 tables and any failed step will establish physical-device evidence. Avoid showing unrelated personal data.

## Candidate-only device gates

These checks remain NOT_EXECUTED. Run them only once the tested candidate is available on an explicitly identified test origin or approved release; do not assume the current Version 7 site contains these changes. Use an expendable guest practice session and retain its records; never clear production data to manufacture a clean result.

1. **U10 / V518, VoiceOver and keyboard:** enable VoiceOver; navigate the table, hear Hero's full card ranks/suits, current actor, legal call/raise amounts, board and payout. Complete a hand using the supported keyboard controls with a paired keyboard. Record actual announcements, focus order, any trap and any inaccessible control. A browser accessibility-tree assertion is not this test.
2. **V513, OS interruption:** note bankroll, session, hand and street. Suspend Safari while an opponent is thinking, reopen and finish the hand. Repeat with Safari terminated from the app switcher and immediately after payout. Record the before/after counts, stack, bankroll and history. Each hand must settle once; an already committed decision must not be sampled or committed twice. OS termination can discard an uncommitted interaction, but must preserve committed financial events.
3. **U11 / V518, physical responsiveness:** record device/OS/browser and power mode; play repeated 2-, 6- and 10-seat hands. Record button-to-visible-confirmation delays separately from intentional bot thinking, any stalled turns, heat/memory reload, overlapping controls, and saved-history size. Actual percentile claims require retained timing samples from the candidate's diagnostic build.
4. **V707, new-user comprehension:** three actual new testers each locate the minimum raise, total raise-to amount and additional call amount, then play 25 hands on their recorded mobile/desktop setup. Preserve each real ambiguity and misclick, including zero when actually observed. Do not substitute developer automation for these participants.

Physical export, VoiceOver, OS kill/suspend, reference-device timing and new-user testing are separate checks. Confirming one does not pass the others.
