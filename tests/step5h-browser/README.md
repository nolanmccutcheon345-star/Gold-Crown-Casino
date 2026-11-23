# Step5H native storage and performance harness

This page is executable test infrastructure. No browser result is claimed until its actual returned receipt is saved by the integrator. Tests never open the production database and never modify the public Site or the frozen Version12 test Site.

Build exact isolated production-module exports after committing production changes:

```sh
node tests/step5h-browser/build-runtimes.mjs baseline
node tests/step5h-browser/build-runtimes.mjs candidate
```

The baseline is saved Version13, source `8419a0ec5f25eb208c14d87131d6c3edfd210c3e`. The candidate manifest records the actual HEAD, every compiled production input and every emitted artifact hash. The page refuses a dirty production snapshot and rechecks the same manifest after navigation. This is a QA entrypoint exposing actual production modules, not the application's dist entrypoint. Use the existing exact-compiled-app browser suite separately.

Open `tests/browser/step5h-storage.html` through the supported preview, choose the reader, saved hands, storage path and decision target, then select **Run isolated native storage check**. Supported archive populations are 0,100,1,000,5,000 and10,000. Select0 decisions for storage/recovery-only comparisons;30/100/500 decisions add bounded controlled engine play, finishing/cashing out the current hand before stopping. New decisions use production entropy, so identical canonical input does not imply identical future action paths; use these as repeatable workload classes, not paired deterministic policy comparisons.

Preparation streams an original hash-verified Step5D canonical fixture into one unique test database. Actual production recovery validates it, then actual `BrowserPersistence.commit(null,data)` creates the corresponding fresh-save representation in a second unique database. For the explicit **Version13 upgrade + compact** path, preparation always creates the save with frozen Version13. Measurement opens it with the chosen reader. Candidate then calls the production `optimizeStorage()` method explicitly, with native cursor and origin estimates before and after; frozen baseline never substitutes candidate compaction. Both paths verify the same immutable original-hand commitment and independent accounting afterward. The temporary fixture database is closed and deleted before the measurement navigation. Only a bounded hashed scalar receipt persists through navigation. No large fixture graph is kept in sessionStorage.

The fresh document measures verified wallet readiness and initial production UI rendering. Then it records origin usage and inventories the target database with one cursor row at a time. Initial UI mounting and controlled bot work are separate: the controlled loop uses a fresh production controller without UI think-time or UI automatic bot scheduling. Bot-prepare windows end before the event-loop yield, and repeated preparation must retain the exact committed decision. Complete original history commitments and independent canonical audits must agree; financial totals are independently summed with distinct settlement identities.

`navigator.storage.estimate()` is an actual browser API reading, but it is an **origin-wide estimate**, potentially including other QA databases, cache files, metadata, padding and concurrent activity. Before/after estimates and database counts are recorded. They are not a per-database physical allocation measurement. Cursor counts separately report exact UTF-8 JSON value/key/wrapper payloads, family totals, component-value subtotals and bounded largest-row diagnostics. Component fields overlap parent totals and must not be added to them. Root's separate source profile should supply the detailed canonical field distribution and 100/1k/5k/10k growth comparison.

Long tasks and animation-frame gaps are timestamped. Timing hooks distinguish recovery, serialization/checkpoint/transaction subspans, controlled preparation/commit and explicit archive loading/auditing. Raw timings, tasks and frame intervals are bounded with dropped counts; all phase/name totals retain counts and maxima. Browser GC and exact retained allocations are unavailable through standard browser APIs; a long task must not be attributed to GC merely from a gap. These are not INP, physical-phone measurements or human-play results.

Full scalar/trace evidence is available through **Download full evidence**. Successful completion cleans only this run's two isolated databases and records origin usage afterward. A failure preserves the failure phase and reason; it is not promoted to a passing smaller workload. Test-data deletion is guarded by exact generated names. Peak temporary native storage may exceed a gigabyte at10k because fixture and freshly written representations overlap during preparation; quota failures must be reported rather than bypassed. Do not run high-volume cases concurrently or while another task relies on the same preview.

Support tests verify namespace/parameter bounds, independent family accounting, UTF-8 byte accounting and bounded retained diagnostics. Typecheck and scoped lint are recorded separately. The harness does not grant V522 hosted CI, physical-device, screen-reader or new-user acceptance.

## Managed HTTP preview quota diagnostic

The first native100-hand run reported `UNAVAILABLE` for `navigator.storage.estimate()` on the managed HTTP preview. Preserve that original receipt. `originEstimate` now prefers the standard API, then feature-detects the browser's legacy `navigator.webkitTemporaryStorage.queryUsageAndQuota` callback without requesting quota or persistence. This is test-only inspection through an exposed API; no HTTPS setting, origin, authorization or browser security configuration is changed.

If the legacy API returns, its receipt names the actual API and flags it **deprecated** and **nonstandard**. Report its value as a browser-reported origin/partition-wide temporary-storage reading, not exact disk allocation or a guaranteed equivalent of `StorageManager.estimate`. Other databases, caches and implementation overhead remain in scope. A zero value is a reported value, not evidence that an existing logical database occupies no space. Callback errors, missing APIs, invalid numeric values and the optional diagnostic's5-second deadline produce FAILED/UNAVAILABLE, never guessed bytes or a passing storage-capacity result. The diagnostic deadline does not alter or skip any poker, history, financial or recovery operation.

Official sources checked for the feature boundary:

- [Chrome's StorageManager introduction](https://developer.chrome.com/blog/estimating-available-storage-space) describes `estimate()` as the modern replacement for `navigator.webkitTemporaryStorage.queryUsageAndQuota()`.
- [Chrome storage partitioning documentation](https://privacysandbox.google.com/cookies/storage-partitioning) marks the Chrome-specific quota APIs deprecated and describes partitioned storage.

The updated support suite executes9tests (the original4 plus5fallback tests) with modern-preference, legacy-success, retained modern error, unsupported and invalid/error/timeout checks. Unit results do not establish that the actual preview browser exposes or successfully runs the legacy API. Root must preserve a fresh native receipt to establish that.

## Explicit10k prebuilt baseline restore

The original native10k `path=upgrade` run became unresponsive during **fixture preparation**, before the fresh measurement navigation. It did not produce a final receipt and is not a passing10k recovery or ordinary-bot measurement. That preparation path reconstructs the complete original graph and then creates a second full-packed save in the same renderer, which can retain large overlapping representations. Exact retained-object attribution for the stalled run is unavailable; this harness change must not be presented as proof of the stall’s cause.

The separate **Prebuilt Version13 restore (10k only)** option (`path=prebuilt`) streams a previously independently validated frozenV13 first-save representation into one empty, uniquely named test database. It never creates the full history graph during browser setup. The compressed fixture uses31 bounded gzip parts, per-part compressed/raw SHA256 commitments, an overall raw commitment, sorted unique keys and an exact current manifest. The current manifest is installed only after the entire streamed dataset passes its checks. At most16 rows are held in a write batch, with a32MiB row/parser bound; no whole archive array is created by the loader.

The supplied archive contains30,334 records and714,676,151 logical value bytes. It excludes only the52-byte old ephemeral writer lease from the earlier714,676,203-byte measurement; the new browser acquires its own lease. All canonical hands, packed replicas, financial events, sessions and checkpoints match the verified baseline family hashes. Source `8419a0e` is checked against the retained first-save bundle's94 runtime inputs. This is a **prebuilt baseline restore**, not a native-browser measurement of new-save creation. The initial failed strict52-byte lease assumption is retained as a generator failure, then resolved with the recorded explicit scope.

After setup, the existing production recovery, independent financial checks, explicit audited cache compaction, controlled decisions, original history commitment and full canonical audit still run. No application check is skipped to improve a preparation time. A successful prebuilt run must be reported separately from the stalled original run. The independent streaming verification command and its actual receipt check all31 compressed parts and all30,334 rows before browser execution; they do not claim native gameplay success.

```sh
node tests/step5h-browser/verify-prebuilt-fixture.mjs \
  tests/browser/step5h-prebuilt-10000 /absolute/new-verification.json
```

## Partial receipts before expensive audits

The page now emits a separate **PARTIAL / RUNNING** scalar receipt after verified recovery, storage measurement/compaction, controlled play/cashout, and full-history commitment comparison before the final canonical audit. The visible `#progress-summary`, downloadable `#progress-download`, and `#progress-evidence` textarea contain only completed checks, exact runtime source identity, bounded family totals, accounting sums, latency summaries and heap readings. It retains at most64KiB in this run's sessionStorage key; no diagnostic data enters IndexedDB. A failed optional sessionStorage write is displayed without affecting application verification.

These checkpoints do not grant a passing overall result, final archive audit or cleanup. If the page later hangs, preserve the latest checkpoint and failed interaction evidence as an incomplete run. The default combined full-history load → canonical audit still executes unchanged. Receipt construction never traverses or retains canonical histories, pending decisions, private cards, raw timing arrays or bot contexts. Each download replaces/revokes the previous bounded blob. Support tests check incomplete status, exact scalar copying, non-retention and size bounds; actual browser receipts still require execution.

## Mounted expanded-history maintenance workflow

Open `tests/browser/step5h-ui-maintenance.html` and click **Run mounted UI verification** after rebuilding the candidate module bundle. The page restores the existing exact1,000-hand fixture into a unique synthetic namespace, performs ordinary initial recovery to establish a checkpoint, then mounts the real application UI with a fresh controller. Preparation is not presented as startup latency evidence.

The page scripts visible, enabled application-button clicks: Hand history → Load and verify all older hands → Cashier → Check retained history copy; then repeats full history loading → Cashier → Reduce saved-history storage; finally reloads the full history again. Test-only wrappers observe the actual port calls and immediately forward them unchanged. Each call must start with at most120 resident hands, all1,000 committed hands, busy controls and verified independent finances. Original IDs/hashes/net results and the complete non-history state commitment must remain identical. It records visible notices, selected view, focus and scalar heap samples; maintenance must focus its completion status. No direct controller maintenance method is called by the test.

`#qa-status`, `#qa-summary`, `#qa-evidence` and the download link expose partial/final receipts. Only actual completed checks qualify; unit support tests do not prove browser execution. Synthetic HTMLElement clicks are not trusted pointer input, physical-device, keyboard or screen-reader evidence. This tests the actual production UI modules through a QA entrypoint; it does not replace exact-dist-entrypoint qualification.
