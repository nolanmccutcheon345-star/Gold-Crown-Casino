# Version 34 — playable single-table freezeouts

This candidate implements six- and nine-player home-event freezeouts using the existing authoritative poker reducer. Larger fields remain unavailable previews. This is a tested development milestone, not full tournament, R1, human-calibration, physical-device or screen-reader signoff.

## Implemented

- Home $20 six/nine-player, Home $50 nine-player and Home $100 nine-player events; frozen schedules and payout ladders. Levels advance at completed-hand boundaries, using the displayed hands-per-level pacing.
- Correct tournament forced bets, dead-button movement across eliminated seats, heads-up transitions, elimination ranks, tied simultaneous bust prizes, integer rounding and exact chip/prize accounting.
- Persistent separate virtual tournament balance, entry/prize/manual-adjustment ledger, tournament results and ROI. Cash bankroll, storage and statistics remain separate.
- Public-only tournament table, legal betting controls, current actions, saved-hand summaries, standings, pause/resume, spectator play, optional Watch to result and terminal return to lobby.
- Atomic IndexedDB compare-and-swap, current/previous snapshots, version/hash/sequence validation, deterministic prepared decisions, authoritative full replay before restored gameplay and exactly-once prizes.
- Canonical hand history retains the complete engine state and policy/rules provenance. Redundant historical display frames are reconstructed on demand. Public controller export is redacted; this is a tournament format, not the cash study-import format. No claim of a complete tournament replay/import UI.

## Defects found and repaired

1. Dealer marker crossed an existing empty-seat gap despite the prior small blind surviving. Added occupied/dead prior-SB fixtures and independent sparse-ring rotations.
2. Real browser play stalled at hand 7 after Hero elimination because the bot position helper required a live dealer seat. Fixed public position ordering, dead-SB interpretation and range ordering; also preserved public dead-ante contributions through sanitization for correct call pricing. Frozen historical cash policies remain unchanged. Added real policy preparation/reload/commit regression after Hero elimination.
3. The root timer attempted commitment when only a pending token existed, obscuring the original preparation error. It now commits only a prepared decision.
4. Registration initially retained lobby scroll position. Successful registration now brings the level strip/table into view, with accessible control focus that does not force additional scrolling.
5. Historical public frame duplication caused approximately 4.16/8.43 MB logical snapshots for matched 49/59-hand fixtures. Compaction retains canonical records and exact replay equivalence, reducing these to 348,443/521,572 bytes. Independent Node medians were approximately 392→40 ms and 758→52 ms for encode/decode/equality; these are not physical-device or browser-origin storage measurements.

## Executed browser evidence

- `TEST_EVIDENCE/tournament34/browser/full-event.json`: actual application registration, Hero UI actions and normal bot decisions; six-player tournament finished in 25 hands. Hero won $78 virtual prize after $20 entry, net +$58. Paused active-hand reload preserved state and returning to lobby did not duplicate payout.
- `browser/full-event-nine.json`: actual nine-player event completed 69 hands. Hero finished eighth, received $0; bots continued to a unique winner. Virtual balance was $99,980 from $100,000 after the $20 entry.
- `browser/native-storage.json`: native IndexedDB six/nine-player legal all-in fixtures, chip totals 30,000/45,000, exact prize liabilities, compare-and-swap conflict, pending decision restoration, full authoritative replay, redacted export and no duplicate event/prize.
- `browser/layout-final.json`: ten six/nine-seat cases at 320×568,390×844,430×932,844×390 and1366×650; no seat overlaps/horizontal overflow, accessible action geometry. Phones may scroll the table; controls remain pinned.
- `browser/cash-flow.json`: four actual cash hands, two cashouts, pending/settled/cashout reloads, accounting and preserved history.
- `browser/accessibility.json`: four automated cash accessibility/import workflows at2/6/9/10 seats. Actual VoiceOver and physical devices were not executed.

## Verification provenance

Final execution totals are in `TEST_EVIDENCE/tournament34/verification-summary.json`; exact source/build byte hashes are in `provenance.json`. Standard full-suite skips are explicitly listed there. The first full run was invalidated by edits arriving while Vitest retained cached modules (13 failures); it was retained as `full-tests-initial.json`, not used for qualification. The first targeted oracle command used a nonexistent `.venv` path and failed four tests; rerunning with the existing pinned PokerKit0.7.7 environment passed. Final full and targeted logs remain separate; their counts must not be added as unique tests.

Original requirement evidence is mapped in `acceptance-evidence.csv`, preserving exact IDs/wording. T01–T08,T18,T22 have scoped executed evidence. Tournament strategy adaptation T21, full replay-interface provenance T24, selectable forward-button V506 and multi-table requirements are not claimed complete. The full302 original registry and86 deferred-feature register remain unchanged and verified by `spec-integrity.log`.

## Limits and next work

Multi-table balancing, background tables, table breaks, hand-for-hand coordination, re-entry and tournament-specific bubble/ICM opponent adaptation remain unfinished. Existing synthetic cash policies provide the initial opponents; no solver/expert/human-data calibration is claimed. Browser eviction/deletion can remove local guest saves. Long tournament archives still require full validation on restore; this release does not establish 10,000-hand tournament scalability or resolve the historical unexplained10.07-second cash preparation stall.

Development Version34 is save-only. Deploy only the exact built assets to the existing isolated public R1 test Site after predeployment checks pass. ProductionVersion7 and original privateVersion12 remain unchanged. Test-site run IDs isolate both cash and tournament databases; retain the complete run URL to resume. Rollback to the preceding R1 packaging commit leaves cash saves intact and retains the separate tournament database for future forward recovery.
