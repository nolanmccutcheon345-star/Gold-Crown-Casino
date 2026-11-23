# AI Texas Hold Em — Step 3.5 / 3.6

Existing Site: https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/

Project: `/workspace/sites/ai-texas-hold-em`, `appgprj_6ae62e96ac688191bffc3c629e66a5b0`. This continues the Version 3 project. No replacement Site or Poker MaxEV project was used. **Version 4 is published** from `81701e63cca28ca75e80c816e7b8ad39ec04b1f3`; native deployment succeeded, access remains public. Evidence: `TEST_EVIDENCE/step36/publication.json`. Step 4 has not started.

## Implemented fixes

- Reproduced the nine-player below-table grid, Hero card/label overlap and disabled setup with an active session before editing. The old 7–10-seat mobile CSS switched to a grid, and setup offered no usable session-ending path. `browser/reproduction.json` and `before-nine.jpg` preserve evidence.
- `src/ui/table-layout.ts`, `styles.css`, `app.ts`: table-relative 2–10-seat perimeter, Hero bottom, separate card/name/stack/status/bet rows, seat-derived dealer/blind badges and adaptive board cards. Compact representations keep central board/pot space. A fixed mobile shortcut bar reaches the table, betting controls and New Session.
- `src/session/controller.ts`, `types.ts`, `src/ui/session-controls.css`, `app.ts`: persisted finish/fold exit intent, immutable hand/session identity checks, legal next-turn fold, all-in runout, exactly-once settlement plus cashout. Starting another session preserves all previous records and wallet. The poker engine is unchanged and remains chip authority.
- `src/ui/history-file.ts`, `app.ts`: prepared JSON/compatible text files; synchronous user-gesture native sharing when supported; download plus readable/copyable JSON and pasted study-only import fallbacks. No financial import credits.
- `src/storage/browser.ts`, `integrity.ts`: schema 4 includes exit intent. Known v2/v3 upgrades preserve records, current/previous and pre-migration backup atomically; revision/owner fencing protects old writers. Unknown/future versions fail closed. Downgrading schema 4 to Version 3 is unsupported and refused safely. Staging adapter database names are injectable; production database is unchanged.

## Exact New Session workflow

1. No active session: **New session** opens stakes, seats, buy-in, rules and opponent configuration.
2. Active hand: **New session → Finish current hand & end session** keeps Hero in control until settlement; **Fold & leave after this hand** queues a legal fold (or waits if already all-in). Committed money is never erased. Both automatically close and cash out only after the hand settles.
3. Completed hand: **New session → Cash out $X & configure new session** returns remaining chips exactly once and opens setup.
4. **Take your seat** starts the next configured session with a new buy-in. History, poker P&L and manual-adjustment records remain. Pending exit intent survives reload; stale tabs cannot create or cash out a replacement session.

## Automated regression

Final source `13993c5`: **262/262 tests PASS**, 24 files,zero failures or skips. Includes the previous 190 tests, 17 exit tests, 6 file-sharing tests, 12 layout tests and 37 populated-migration tests; 20,000 seeded accounting hands and pinned PokerKit 0.7.7 independent comparisons executed. TypeScript, ESLint, production build, and 302/86 integrity checks PASS. Logs: `TEST_EVIDENCE/2026-10-31T21-29-11-192Z/manifest.json`. The first attempt’s 258 passes / 4 missing-dependency failures remain in `2026-10-31T21-27-17-005Z`; final rerun resolves them.

Acceptance tracker: **64 PASS, 238 NOT_EXECUTED** across 302 original requirements. U06 and V702 have exact new evidence; broad mobile/recovery rows retain scope limitations.262 automated tests do not mean 262 acceptance requirements passed.

## Executed browser evidence

All evidence below is from the actual managed Chromium browser via the Sites preview, not a DOM simulator or a physical iPhone.

- **105/105 layout cases PASS**: 2/3/6/9/10 players × 320/375/390/430px phone, 768px tablet, 1280px desktop, 844×390 landscape × preflop contributions/river action/showdown. Assertions cover seat containment/pairwise overlap, board separation, Hero bottom, label/card separation, text overflow, horizontal overflow, 44px shortcut targets and visible primary controls after the action shortcut. Separate actual next-hand test checks dealer 0→1, SB 1→2, BB 2→3 with Hero staying 0. Initial 70-case artifact is retained; expanded105 is authoritative.
- Actual 390px screenshots: `fixed-six-mobile.jpg`, `fixed-nine-mobile.jpg`, `fixed-ten-mobile.jpg`. Synthetic legal-hand fixtures isolate visual tests; screenshots are real rendered app components, not design mockups.
- **4/4 populated migration scenarios PASS**, using eight uniquely named non-production databases. Before snapshots, exact current/backup checksums, all four streets, actual frozen old reader, upgrade/reopen, cloned-backup restoration, pending decision once-only application and stale retry rejection. Each preserves wallet $1,900, 3 canonical hands, 3 study records, 3 sessions, 14 ledger entries, +$1.50 poker result and $0.50 rake. No production user data was opened by staging.
- **Actual session journeys PASS**: 9→6→9→6, queued fold + reload, continued decisions through showdown + automatic end, completed-hand cashout, subsequent reload, no-active-hand new setup, second-tab read-only/takeover and old-tab failed session creation. Exported nine-hand record independently reconciles every event/pot/refund/payout; four hands were newly completed in this preview journey. Prior Step 2 100-hand endurance remains retained, not newly claimed.
- **Export/import PASS in Chromium**: 654,658-byte desktop download and narrow-mobile copy fallback parsed to identical JSON with 9 unique completed hands; private-key scan and independent per-hand chip accounting pass. Mobile pasted import and actual file-chooser import both leave wallet $2,167.50, table $0, lifetime poker result −$32.50 unchanged. Native iOS sharing remains awaiting physical verification.

## Completed-hand accounting example

Hand `hand-a421b109d060b82ac474bf5dd6128f7b`: six seats, $20 each, $1/$2, no rake. Jordan/Riley/Casey fold; Hero calls $2, Alex completes $1, Morgan checks. Flop 9h 5h 8d: Alex checks, Morgan bets $4.50, Hero calls $4.50, Alex folds. Turn 3s: Morgan/Hero check. River Jc: Morgan/Hero check. Morgan receives $15; stacks Hero $13.50, Alex $18, Morgan $28.50, others $20 each, total $120. Hero loses $6.50. Finish-hand exit returns Hero's $13.50 once: wallet $2,151→$2,164.50. Reload retains those values and one hand-net/one cashout. Full public events and audit are retained.

## Published guest verification

The published HTTPS site restored the prior Version 3 test wallet ($2,492) and its existing hand without Google sign-in. After safe ownership takeover, a new nine-seat $20 session ran through showdown. New Session / Finish Current Hand intent survived a page reload. Hero called Quinn’s $9.50 preflop raise; other seats folded (SB $1 and BB $2 remained), then both checked flop Kh6d4c, turn Qd and river7d. Hero won the $22 pot, ending at $32.50 (+$12.50). Automatic cashout produced wallet $2,504.50 and table $0, one new hand-net and one new cashout. Post-payout reload retained the exact values. Two saved hands exported/downloaded and independently reconciled, including the original untouched hand. New Session setup is enabled again. Evidence: `browser/published-workflow.json`, `published-export.json`, `published-audit.json`, `published-cashout.jpg`. No production data was reset or used for destructive migration experiments.

## Status and limitations

- **PASS:** repaired seating/session controls, tested desktop/mobile Chromium interactions, export redaction and study import, populated migration/safe downgrade refusal, tested recovery/accounting.
- **FAIL:** no unresolved application failure observed in these completed checks. The first full test attempt had four missing-PokerKit environment failures; raw logs are retained and the pinned dependency is restored before rerun.
- **AWAITING USER VERIFICATION:** physical iPhone Safari download/share/copy, native touch/rotation and Files import. See `IPHONE_VERIFICATION.md`; no physical-device pass is asserted.
- **NOT_EXECUTED:** successful downgrade preserving post-v4 records (unsupported), partial-corrupt-payload salvage, broad V7 physical-device/human/performance acceptance and hosted CI. Safe refusal and pre-upgrade backup restoration do not prove the broader Z03 rollback requirement. These are preserved requirements, not silently waived.

All 302 acceptance rows and 86 future features remain intact. Automated test count, browser-case count and mapped acceptance count are separate. Requested engineering fixes are implemented; physical-iPhone signoff is pending. Full V7 G3/R1 is not asserted, and Step 4 remains on hold.
