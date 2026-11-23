# Step 5D device and accessibility verification

**NOT_EXECUTED until the specified person/device actually performs the check.** Version7 is public; Version9 and this candidate are unpublished. A result observed on Version7 does not verify this candidate. Physical iPhone Safari history export remains **AWAITING USER VERIFICATION**.

Use an explicitly delivered, identified candidate on a separate test origin/profile containing synthetic practice records. Record its exact source commit, bundle hash and version before testing. Do not erase a user's ordinary guest save, import private snapshots into production, or reuse a screenshot from another version. Existing browser hashes/functional receipts are useful engineering evidence, not a replacement for these checks.

## Original criteria and exact remaining dependency

| ID | Original acceptance criterion (unchanged) | Work-executable evidence | What still requires actual execution |
|---|---|---|---|
| U10 | Core actions operable and properly announced without animation-only meaning | Accessible names, public live-region text, reference integrity, keyboard focus, actual trusted browser keys | A declared screen reader must actually announce the dynamic turn, betting, payout and recovery changes; record the spoken output and any interruption/focus defect. |
| U11 | Measure decision compute P50/P95, 10-seat frame responsiveness and input-to-confirm latency on specified phone/desktop | Cloud/reference instrumented compute and rendered UI; no inferred phone result | Named physical phone and desktop runs, with actual response/paint/input measurements and sample counts. |
| V513 | Suspend/kill tab while bot thinking or a settlement pending; on recovery state/action revision and payouts match pre-interruption committed events. | Reload, pending-decision interruption, atomic write/payout recovery and explicit committed-state comparison | Actual mobile OS background/suspend/tab or app termination, tied to before/after committed-event receipts. Reload is a separate check. |
| V518 | Measure p50/p95 bot response, render time, memory and action error rates on declared reference devices during repeated 2/6/10-seat play; check keyboard/screen reader/color-independent card labels. | Browser timings/layout, text labels, public-information and functional action checks | Named devices, actual screen reader, repeated2/6/10-seat response/render/memory/error measurements. Unsupported browser heap API must be recorded as unavailable, not zero. |
| V707 | Three new test users on specified mobile/desktop view must locate minraise, raise-to total and call/additional amount, play 25 hands; record each actual misclick and observed ambiguity. No fictional completion. | A reproducible briefing and recording template; automated hands cannot satisfy it | Three actual people new to the app,25completed hands each, with genuine errors/ambiguities and observed comprehension. |

Keep these original rows unpassed until their complete criteria are evidenced. The six-case DOM audit is a bounded diagnostic, not a full WCAG certification. Solid-color contrast is measured only where all relevant colors are opaque; gradient/translucent backgrounds need rendered-pixel inspection. The44CSSpx core-control assertion is an engineering target, not an assertion that every WCAG AA target must be44px. W3C's AA minimum has24px and documented exceptions; enhanced target size is44px.

## iPhone Safari + VoiceOver (tester)

1. Record device model, iOS/Safari versions, candidate identity, CSS viewport/orientation, text zoom, VoiceOver state, storage/history size and power-saving settings. Begin in portrait and repeat the table/control portion in landscape.
2. Open as a guest. While restoring, listen for verification/loading. Confirm no wallet total is described as verified and no wager/cashout is possible before the relevant checks finish. If recovery fails, note the exact message; do not clear data to hide it.
3. Turn on VoiceOver in **Settings → Accessibility → VoiceOver**. Swipe through the page and double-tap focused controls. Find setup and use a2-player table; later repeat at6and10players.
4. Locate Hero's two cards: both rank and suit must be spoken. Unrevealed opponents must remain “Hidden card”; future cards/private bot parameters must not be spoken. Dealer/blind/acting-seat information must remain associated with the correct player.
5. Locate Fold, Check/Call, Raise-to, legal minimum/maximum and additional amount. Open **Custom percentage and editable BB shortcuts**; type a draft, wait beyond one ordinary clock-save interval, and confirm the editor, draft and focus remain usable. A draft must not itself submit a wager.
6. Play through a hand. Record actual spoken turn changes, the last public action, community cards, pot and final award/rake. The meaning must be available without animation or color alone. Record focus location after each action. If announcements interrupt one another or are missing, quote what was actually heard.
7. End the session using its normal workflow, note bankroll/table chips/poker result/history count, reload, and check those exact values. Manual bankroll adjustments must remain adjustments rather than poker winnings.
8. From history, prepare a redacted export. Try **Share / Save to Files** if offered, then **Download JSON**, then **View / copy JSON** if needed. Save the actual file; open it in Files/text viewer and record filename, byte size and hand count. Confirm complete JSON and only permitted completed-hand information. Import it as a study copy with rights confirmation and confirm unchanged bankroll/poker results/canonical history. Do not send private saved snapshots as ordinary exports.
9. Record PASS/FAIL per step, actual announcement text and any inaccessible or overlapping control. No VoiceOver pass is inferred from ARIA markup alone.

## Desktop keyboard + screen reader (tester)

Record OS, browser, screen reader and versions. Use a declared supported combination (for example the team's actual NVDA/Chrome or VoiceOver/Safari setup), not an assumed one. Repeat2/6/10seats using Tab, Shift-Tab, Enter/Space and native select/number-field keys. Confirm the skip link, visible focus, stable expanded custom-sizing editor, error messages, raise-total/additional distinction, safe session exit, cashier, history and export. Do not use the mouse to rescue a blocked keyboard path without recording the failure first. Record the actual spoken announcements separately from the DOM text.

## Mobile interruption and payout check (tester + engineer)

Perform only against the isolated candidate QA save. The engineer must capture a bounded diagnostic receipt from the committed transaction: candidate identity, saved revision, hand ID/revision, current ledger count/tail, wallet, table funds, hand/settlement identities and policy/rules versions. It must omit hidden cards, deck and private bot parameters. An exported completed-history file alone cannot establish an active decision's revision.

For each case, capture the last committed receipt, then use the physical OS to (a) background/suspend Safari while a bot is thinking, (b) terminate Safari from the app switcher while a decision is pending, (c) close the tab near settlement, and (d) terminate immediately after a visible payout. Reopen normally and capture the recovered receipt before further play. Pending work may resume from the last committed state; an uncommitted intermediate animation is not authoritative. Compare identity/revision/event sequence, exactly one settlement per completed hand, exact wallet/table reconciliation and retained history. Record the actual interruption mechanism and timing. A desktop page reload, synthetic `visibilitychange` or `pagehide` event is not this physical OS test.

If the last committed receipt cannot be captured, record the narrower observed UI outcome and leave the exact V513 assertion unverified. Never invent an interrupted transaction simply because termination occurred near a payout.

## Named-device performance (engineer)

Use matched seeded QA workloads and matched history sizes, without changing real production entropy. Capture0/100/500/1000/5000/10000-hand clean-load and active-hand recovery separately. On each physical device record source/bundle, OS/browser, CPU/device model, power/thermal settings, storage bytes, sample count, p50/p95/p99/max, shell readiness, safe-gameplay readiness, full-audit completion, render durations, long tasks, measured input-to-commit/paint and supported memory metrics. Keep intentional bot think time separate from preparation and storage work. Keep slow observations; do not silently discard warm/cold differences or classify a pause as GC without a trace.

For trusted actions record input event, committed revision and subsequent rendered confirmation; note whether the platform provides Event Timing/INP or only explicitly instrumented intervals. Unsupported APIs are **NOT_MEASURED**, not fabricated zeroes. Play repeated2/6/10-seat sessions and count actual rejected/duplicate/stale actions. These device results remain open until measured.

## Three-new-user comprehension check (coordinator)

Recruit three real people who have not used this app. Record an anonymous tester label, actual device/view and candidate identity. Before explaining the interface, ask each to point out the minimum legal raise, the total street amount for “raise to”, the amount added now, and the call amount. Record their answers verbatim and whether correct; do not coach first and call it discovery.

Each plays25complete hands through the UI. Record every intended action, actual unintended action/misclick, rejected entry and observed ambiguity. A zero-error entry is valid only when someone actually observed that hand. Mark abandoned/incomplete hands separately. Do not substitute bot simulations, engineer test clicks or an experienced tester repeating three times. Correct confirmed defects, then use new observations for the affected workflow without erasing the original record.

The companion `device-results-template.json` is blank by design. It is a recording aid, not executed evidence.

Reference methodology checked against primary W3C sources: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum ; https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced ; https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum .
