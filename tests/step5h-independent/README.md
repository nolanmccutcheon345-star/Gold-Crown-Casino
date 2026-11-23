# Step5H independent storage-retirement verification

The bounded replica-cache implementation at `029c9b3647b026242a5195fce375f82f8a4a144e` passed this independent review. The change retains all authoritative canonical records, financial events and verified pre-upgrade backups; only redundant optional packed copies leave the cache. This is local protocol/financial evidence, not native-browser storage usage, physical-device testing or release approval.

| Execution | Actual result |
|---|---|
| Complete 14-case baseline on Version13 production | 6 PASS /8 FAIL: the previous implementation deliberately did not compact an already packed archive |
| First candidate review | 14/14 PASS |
| Final independent retirement and recovery fixtures | **15/15 PASS**, zero failed/skipped |
| Existing independent packed, recovery, migration/rollback, quota, storage and PokerKit regression | **211/211 PASS**, 15 files, zero failed/skipped |
| Typecheck, scoped fixture lint, original specification integrity | PASS;302 original acceptance IDs and86 deferred IDs preserved |

The final15 and broader211 executions are separate suites and overlap the root's full release coverage. They must not be added to the original acceptance-requirement count. The raw receipts, commands, exact test-source hashes and production hashes are indexed in [receipt.json](receipt.json).

The fixture constructs124 genuine engine-completed heads-up cash hands using the controller and a memory persistence port. It independently assembles the **old complete replica set**, so the new writer does not define the expected cache window. Assertions require the newest120 copies after maintenance while all canonical rows remain byte-exact under an independently implemented sorted JSON serializer and Node SHA-256. Full financial reconstruction uses the independent BigInt accounting reference. Every indexed hand, permitted replay frame, public export/import ID, private policy-version record and canonical hand hash remains unchanged.

Executed adversarial checks cover:

- Missing/corrupt cold canonical records, including an outer checksum resealed around an invalid inner hand: maintenance rejects and keeps every surviving replica.
- Interrupted publication and injected quota exhaustion: the atomic draft, including its deletions, is discarded; retry retains exact money and history.
- A different tab acquiring the writer lease and an actual Version13 writer cached before same-revision maintenance: stale writes fail without changing storage.
- Actual frozen **Version13** and **V7-R** readers: each reads the trimmed representation, performs one manual adjustment, and current code restores unchanged historical hands and public export. These are actual preserved source builds, not guessed old-reader emulators.
- Populated version1 migration: the exact pre-upgrade snapshot and receipt survive optional cache maintenance and independently verify afterward.
- Ordinary settlement at the cache boundary with its cold canonical replacement missing: the settlement commit fails safely, the only surviving copy remains, repair restores the same active hand/revision, retry settles once, and duplicate cashout creates no extra transfer or hand.
- Corrupted retained hot replica: canonical fallback recovers without rewriting saved records or duplicating settlement.

`version13-runtime.json` binds94 actual production source files to immutable saved Version13 `8419a0ec5f25eb208c14d87131d6c3edfd210c3e`; its generated bundle hash is verified in an executable test. The separate existing V7-R artifact remains pinned to the original compatible recovery source. Original published Version7 is not misrepresented as a compatible rollback runtime.

The initial15-case candidate attempt is retained as [candidate-final.json](candidate-final.json),14 PASS/1 FAIL. Its new duplicate-cashout assertion incorrectly required the entire persisted envelope to remain byte-identical. The established controller can publish a no-money revision after `closeSession` returns for an inactive session. Source inspection and the corrected assertion now require identical wallet, financial ledger and historical hands, rather than forbidding a harmless revision. No production cashout behavior was changed. The corrected15-case execution is [candidate-qualified.json](candidate-qualified.json). An earlier10-case authoring run is also retained but is not used for candidate qualification.

Existing large caches require the explicit, fully audited maintenance call; new saves bound their packed cache automatically, while normal appends retire only a bounded number of old copies. Maintenance requires a valid canonical archive and can fail safely if storage is corrupt or lacks quota. It is not a claim that all existing guest stores have already shrunk. Browser eviction or user deletion of the entire origin remains a possible data-loss boundary; public history exports are not financial backups.

## Materialized-history maintenance follow-up

The independent follow-up reviews `da3e1a9c996947ddb518864f1e1de13ff25e2fa3`: releasing an already expanded read-only archive before another independent full scan. Its six executable cases use 124 actual engine-completed hands and the real persistence/controller path. The old maintenance implementation yielded **1 PASS / 5 FAIL**; the candidate yielded **6/6 PASS**. These checks establish the controller boundary and exact saved-data preservation, not a browser memory measurement.

The candidate returns to the exact verified compact predecessor before calling the audit or storage maintenance port, while actions remain locked. Every saved byte remains unchanged by a read-only audit, including a failed audit. Full reconstruction and independent BigInt accounting still agree afterward. Active-session maintenance is refused without changing committed cards, chips or pending state. Same-revision substitution of nonfinancial metadata or an independently valid but different hand hash chain is rejected before adopting a full history; this prevents binding that different history to an earlier compact predecessor.

Source review found the Cashier callbacks are declared in `bind(shown)`, outside `renderBody`, and do not capture a full `AppData` local. The closed-table guard makes their captured `shown` and `endingSession` null. The synchronous full-to-compact notification clears `historySource`, replay/history views, filtered results and statistics caches. An already pending statistics prewarm may hold its input until its next cooperative cancellation boundary. These are source-level retention observations; the owning browser lane must verify mounted UI and actual heap behavior.

The combined candidate execution contains **44 PASS / 1 FAIL** across45 cases. The sole failure is the existing 124 indexed-read retirement case reaching the unchanged20-second Vitest limit at20,050ms while separate release tests and10,000-hand memory profiling ran in the shared environment. Its raw failure is preserved in `materialized-candidate.json`; no assertion or timeout was weakened. The unchanged test's isolated recheck **PASS** took11,377ms (`materialized-retirement-recheck.json`:1 PASS,14 cases filtered out). Thus each of the45 distinct cases has a passing execution, but this lane does not report a clean45-case single run. Typecheck and scoped lint passed. The follow-up does **not** attribute or resolve the historical10.07-second bot-preparation outlier.
