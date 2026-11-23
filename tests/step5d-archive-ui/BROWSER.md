# Native retained-history UI runner

Authored for root execution at `/tests/browser/step5d-archive.html` using `#archive-run`. The result is exposed in `#archive-result` and the complete JSON in `#archive-evidence`. **This file documents an executable harness, not an executed browser PASS.** Root must retain the actual result and final source identity.

Seven checks exercise the production app/controller/BrowserPersistence and native IndexedDB:

1. A legally generated populated save has packed history installed; its next load independently verifies the current representation while accurately labeling the retained copy not yet audited.
2. Both visible audit control and public controller refuse the full retained-copy check during an active table without changing current state or durable bytes.
3. Actual Fold and Cashout interface actions settle one more hand and return table money exactly once; a settled but still-seated table remains blocked until cashout.
4. The full independent audit after cashout reports verified hands, wallet and saved revision. Every non-lease persisted byte and the complete in-memory data digest remain unchanged.
5. A damaged retained canonical hand with an intact packed representation permits exact current-state recovery without silently repairing or overwriting the damaged copy; the UI does not claim the separate copy passed.
6. The visible full check rejects that corrupt retained copy with a non-destructive failure. Current verified bankroll, records and revision remain intact; no duplicate payout or reset occurs.
7. Restoring only the exact original row in this isolated synthetic test fixture allows a fresh independent verification, again without modifying the current save. This does not claim a user-facing automatic repair feature.

The harness uses only a newly named `ai-texas-step5d-archive-*` database. It never opens the production guest database. Native deletion is checked to completion only for that disposable test database. Controller clocks/ports and tracked handles are closed first. Lease renewals are excluded from byte-equality comparisons; all actual canonical/packed/header/backup records are included.

Local authoring checks: typecheck PASS; scoped ESLint PASS. Their logs are in `evidence/browser-harness-*`. Browser actions are programmatic application controls, not trusted keyboard, physical iPhone, OS suspension or actual screen-reader evidence.
