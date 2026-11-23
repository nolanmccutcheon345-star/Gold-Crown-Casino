# AI Texas Hold Em — Step 3

Existing project: `appgprj_6ae62e96ac688191bffc3c629e66a5b0` at `/workspace/sites/ai-texas-hold-em`. Published URL remains https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/. Source and prior Step 2 evidence are preserved. Poker MaxEV was not accessed or modified.

Version 3 is published from `c6b271881fb1f70a542fb14cc4d8fb5beb1c661a`; native deployment succeeded. Live HTTPS guest access, exact preflop/river/payout recovery, two-tab stale action rejection, one complete hand and manual-adjustment persistence were verified. Published $16 hand payout independently audited. Evidence: `TEST_EVIDENCE/step3/publication.json` and `TEST_EVIDENCE/step3/browser/live-*.json`.

## Implemented

- Separate wallet/table ledger, unique hash-chained financial events, explicit manual adjustments and wallet reset epochs, buy-in, capped between-hand topup, exactly-once cashout. The engine alone moves table chips. Manual changes never enter poker P&L.
- IndexedDB atomic snapshot and previous backup; checksum/ledger reconciliation; compare-and-swap revision; Web Locks and transactional ownership fencing with lease fallback; visible read-only/takeover and failed-save Retry. Saved candidates are published to UI only after commit. Lost acknowledgements reconcile the exact candidate without replaying money.
- Private exact game recovery with frozen rules/policies, deck position, history and pending bot reservation/action. Bot randomness is reserved durably before sampling; crash/reload does not reroll the decision. BFCache reopen and expired uncontested lease recovery are handled.
- Completed-hand-derived cash statistics: P&L, mixed-stake BB/100, actual recorded active-time $/hour, closed-session results, VPIP/PFR/3-bet/fold-to-3-bet, WTSD/W$SD/WWSF, positions/stakes/configuration, contributed rake attribution, opportunity counts and uncertainty. Definitions: `src/stats/DEFINITIONS.md`. No EV or real-poker performance claim.
- Immutable canonical hand records and private policy-version metadata, public frame replay, filters, versioned redacted JSON export and study-only import. Canonical engine replay rejects rehashed illegal actions, forged payouts and premature reveals. Imports cannot credit the financial ledger.
- Cashier, results/session history, continue/new session and storage recovery controls; guest practice remains public without Google login. Configurable min/max BB and topup policy freeze per session.

Files: `src/session/{types,controller}.ts`, `src/storage/{browser,integrity}.ts`, `src/stats/cash.ts`, `src/core/{engine,replay}.ts`, `src/ui/app.ts`, `src/ui/styles.css`, corresponding controller/storage/stats/core tests, and browser recovery harness/specification. Stable core contracts are additive; prior engine legality/settlement code remains authoritative.

## Executed validation

Final integrated source `cad4498f864af3e2727321207443c09f1ff2c8e8`: **190/190 tests PASS**, 18 files, zero failed/skipped. TypeScript, ESLint, production build and four-document/302-requirement/86-feature integrity checks PASS. Includes PokerKit 0.7.7 compatible independent fixtures and 20,000 seeded accounting hands (10,000 no rake, 10,000 rake). Evidence: `TEST_EVIDENCE/2026-10-31T20-34-01-746Z/manifest.json`. The earlier 20:28 run is retained as a superseded checkpoint; the final 20:34 run is authoritative.

Independent focused rerun: 53/53 controller/storage/statistics cases PASS. Initial failing regression logs and fixed results are retained. Key repaired defects: early-reveal/negative-raise rehashed import, malformed metadata, BFCache listener lifetime, expired owner lease self-block, HTTP-preview missing WebCrypto digest, and duplicate header control IDs. Portable SHA-256 is pinned and independently checked against Node crypto; CSPRNG deck entropy remains unchanged.

Actual browser tests passed: all-street reload, tab close/reopen, pending bot recovery, interrupted payout before commit and after lost acknowledgement, repeated payout reload, retry, multi-tab takeover/stale writer rejection, double-click topup/cashout, history replay/filter/export/import, and desktop/mobile gameplay. `TEST_EVIDENCE/step3/BROWSER_REPORT.md` includes exact hand and wallet arithmetic. Existing Step 2 100-hand evidence is retained, not claimed as newly rerun.

**Mobile export download is BLOCKED by the browser automation's embedded-frame blob restriction.** The link renders; desktop download/import pass. Physical-device tests, populated-schema deployment rollback, real browser quota exhaustion (injected write failures were tested), and the broad V7 human/device matrix remain unexecuted. The standalone authored Playwright spec and hosted GitHub Actions are NOT_EXECUTED.

Acceptance is conservative: **62 PASS, 240 NOT_EXECUTED** across all original 302 rows; broader rows keep partial-evidence notes. Step 3 browser checklist additionally has the explicit mobile-export BLOCKED result. All 86 deferred features remain intact. No original requirement is removed or weakened.

## Limits and phase status

The implemented persistent cash slice is ready for use, with no known open critical bankroll-conservation, duplicate-payout or tested-recovery defect. **Step 3 is not fully signed off**, because mobile export verification and the broader recovery/platform matrix remain incomplete. Full V7 G3/R1 is not asserted.

Guest data belongs to this browser/device, not automatic cross-device synchronization. Browser site-data clearing/eviction can remove it; optional storage protection is a request, not a guarantee. Public export is study-only, not a financial restore. Migration supports known v2→v3 and refuses unknown schemas; rollback to the old in-memory release is not a data-preserving migration. Active-time checkpointing may lose the last unsaved few seconds on abrupt close, as disclosed. Synthetic bots are not human-validated. Tournament namespaces/features remain deferred.

Next task: execute mobile export on an allowed top-level mobile/physical-browser runner, then verify populated-schema rollback/upgrade and broaden the recovery/browser matrix before G3 signoff. Advanced opponent calibration remains the subsequent product increment.


## Follow-up

This Version3 report is historical. Step3.5/3.6 repairs, migration tests, mobile export fallback and current verification status are recorded in `STEP36_REPORT.md` and `IPHONE_VERIFICATION.md`. The old embedded-download blocker is mitigated; physical iPhone verification remains pending.
