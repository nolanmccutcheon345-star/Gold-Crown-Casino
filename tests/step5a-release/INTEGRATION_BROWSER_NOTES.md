> Historical draft checkpoint. Root subsequently completed both100-hand runs, final five-hand smoke and live-origin checks. The final authoritative browser outcome is in TEST_EVIDENCE/step5a/BROWSER.md; pending counts below are retained as chronology.

# Step 5A browser integration evidence — draft snapshot

**Recommendation: NOT READY FOR R1.** Root-executed browser checks demonstrate useful working recovery, accounting, export and layout behavior. They do not close the confirmed history-processing slowdown or the missing exact R1 release requirements. No publication is recommended from this evidence.

This note summarizes artifacts read from `/workspace/sites/ai-texas-hold-em/TEST_EVIDENCE/step5a/`. The release-test agent did not operate the browser or rerun these checks. Paths below are repository-relative. Counts are browser cases/assertions or recorded hands, not mapped V7 acceptance requirements. Root must merge final evidence and counts before release reporting.

| Check | Recorded result | Exact evidence and scope |
|---|---|---|
| Existing published-site gameplay | Completed hand recorded | `TEST_EVIDENCE/step5a/step5a-live-before.json`: one heads-up $1/$2 hand, Hero−$8, opponent award$16, zero rake. This predates candidate publication and is not proof that new candidate code is live. The exported hand alone does not establish every guest/authentication condition. |
| Four-street reload | PASS | `step5a-recovery.json` plus `recovery-assertions.json`: preflop/flop/turn/river game fingerprints and financial values match before/after reload. AppData revisions may advance through session-clock saves; the authoritative game revision/hash stays fixed at each checkpoint. |
| Interrupted prepared-bot save | Recovery demonstrated | `step5a-recovery.json`, steps `bot-save-failed` and `bot-reloaded`: error preserves the preflop game and pending identity; reload resumes to flop without changing wallet or settled-hand count. The supplied two snapshots are not an independent proof of every entropy draw; automated reservation/idempotence tests supply that separate coverage. |
| Committed payout with lost acknowledgement | PASS, one settlement/cashout | Steps `payout-ack-lost` and `payout-reload-settled-once`: after reload, one hand, one settlement, one cashout, four unique ledger entries; wallet999700 cents, poker net−300 cents. |
| Manual bankroll edit and reload | PASS | Steps `manual-edit` / `manual-edit-reload`: wallet becomes500000 cents; poker net remains−300, one hand and one settlement. |
| Study import and replay | PASS for recorded workflow | `study-import` / `replay-settlement`: imported shelf gains one record while original hands, wallet, poker result and ledger remain unchanged. |
| Multiple tabs and explicit takeover | PASS | `second-tab-readonly`, `takeover-new-owner`, `takeover-old-owner`; old tab action disabled. The game fingerprint, stack and wallet remain unchanged across takeover. |
| Session exit/new session/topups | PASS for recorded workflow | Recovery trace covers six-seat random lineup, fold/leave, nine-player new session/end, and a later session with two2500-cent topups. Final cashout and reload retain500000-cent wallet, four completed hands, four settlements, four cashouts, sixteen unique ledger entries and poker net−300. This is not a full factorial workflow test of all seat counts/stakes/profile combinations. |
| Browser download and copy fallback | PASS | `export-checks.json`: actual downloaded JSON valid, identical to copy fallback, no private fields, opponent cards redacted before showdown; SHA-256 `ac38d3ef3d9ab5dc3a9f5eafbd5406d6412d87eff465a970b0bf3b9559ca3afe`. Canonical public export: `step5a-public-hand.json`. This is supported cloud-browser evidence, not physical iOS Share/Save-to-Files verification. |
| Responsive layout assertions | PASS,105/105 cases | `step5a-layout.json`: five seat counts2/3/6/9/10 × three phasespreflop/active/complete × seven viewports320×740,375×812,390×844,430×932,768×1024,844×390,1280×900. Every case reports actionReachable=true, no failures and no horizontal overflow. Actual client widths can exclude scrollbars. |
| Mobile screenshots | Artifacts present | `step5a-mobile-6.jpg`, `step5a-mobile-9.jpg`, `step5a-mobile-10.jpg`. These are root-captured browser screenshots, not a new physical-iPhone inspection by this agent. |
| Populated IndexedDB migration/restoration | PASS,4/4 street scenarios;76/76 internal checks | `step5a-migrations.json`: each preflop/flop/turn/river case passes19 checks. Isolated staging snapshots, v3→v4 migration, atomic backup, exact game/pending hashes, clone restoration, real old-reader rejection of v4, close/reopen, single pending commit and stale retry all pass. Historical wallet190000 cents, three hands, three sessions, poker net150 cents and rake50 cents remain preserved. Production user saves were not the staging target. |
| Loading/error/retry UI guard | PASS in completed rerun | `step5a-loading-final.json` records loading and error screens without financial/table displays, then the committed retry UI: Saved on this device, wallet$1,234.56, cumulative result$0, no played hands, and controller ready/wallet123456/revision1/ledger2. The older `step5a-loading-after.json` retains false intermediate retry checks captured before asynchronous rendering settled; they are not erased or counted as final PASS assertions. `step5a-loading-before.txt` preserves the original defect reproduction. |

The nine aggregate booleans in `recovery-assertions.json` are all true. They do not convert every trace step or every original criterion into a separate acceptance PASS. `step5a-results.txt` records the four-hand results screen: poker result−$3, BB/100−25, three break-even sessions and one losing session, with imported study hands and manual edits excluded. Its displayed elapsed-time rate is a transient app-clock observation, not a live-poker profitability result.

## Exact browser hand example

`hand-f64d2374da7d4ebc5ae960ed139c7564` in `step5a-public-hand.json`: heads-up $1/$3, starting stacks30000 cents each. Hero posts100 and calls200 more; opponent posts300 and checks. Both check flop5h7d2h, turn3d and riverJh. Hero3hTd loses the pair-of-threes kicker comparison to opponent3cKh. Pot600 cents, rake0, opponent award600; ending stacks29700/30300 and Hero net−300. The lost-acknowledgement recovery subsequently cashes out Hero29700 exactly once, restoring wallet999700. Subsequent manual wallet editing does not change this−300 poker result.

## Endurance remains pending at this draft's last root reading

* Nine-seat320px run: **96/100 completed**, all nine seats still funded.
* Ten-seat390px run: **93/100 completed**, currently nine funded seats after a bust. This must not be reported as100 hands with ten continuously funded players.

These are root-reported progress checkpoints, not final artifact-derived PASS results. Do not label either run complete or silently extend their counts. Root will retain final reports/records and integrate any later outcome separately.

The independent no-UI profiling evidence in `tests/step5a-release/evidence/history-cost-profile.json` confirms the production history-processing gap: bot preparation median63.4 ms at10 saved hands versus625.5 ms at100; repeated full history hashing/cloning dominates. Harness exports add once-per-hand overhead, but do not explain the per-decision growth. Shared browser heap peaks are not proof of a memory leak. Passing conservation/no-stall assertions is insufficient to declare long-session responsiveness acceptable.

## Open gates and device limits

`R1_DASHBOARD.md` currently identifies18 exact implementation gaps, including D02/D08/D10, G04, U01/U04/U09, X09/X10, V408/V414/V421/V432/V505/V608/V612/V613/V706. It also preserves unexecuted release-critical criteria such as V707 (three new users completing the prescribed25-hand comprehension workflow). This note does not amend acceptance statuses or copy aggregate counts that root is still reconciling. Tournament-only unimplemented scope is not treated as a cash-game defect.

The user previously reported **4/5 physical iPhone checks passed**. **Physical iPhone Safari export remains AWAITING USER VERIFICATION.** Cloud layout/download checks do not close it. On the physical iPhone: finish a hand, open History, prepare the export, use Download JSON or Share/Save to Files, open the saved file, then import it into the study shelf; confirm the saved hand appears and bankroll/poker results do not change. Record iOS/Safari version, which route worked and any failure; do not report this complete until the user confirms it.

All302 requirement IDs and86 deferred features remain preserved; this draft adds evidence notes only. The existing published Version7 should remain unchanged while the candidate, exact acceptance gaps and performance work remain under review.
