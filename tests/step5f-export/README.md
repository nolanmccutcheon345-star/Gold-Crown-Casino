# Step 5F — bounded public history export

Confirmed defect (independent workstream): the existing 1,000-hand fixture produced a 78,537,178-byte pretty JSON export, which the existing 10 MB study importer rejected. The original importer limits and validation are unchanged.

`createPublicHistoryBatch(readHand, {startIndex, total})` reads individual verified canonical records. The caller must pin the source revision and owns the UI action lock. Defaults are at most 100 hands and 2,000,000 UTF-8 bytes per file. A measured byte boundary may produce fewer hands. Each batch starts a new public hash chain at GENESIS and contains existing public projections and original policy-version provenance. It never rewrites canonical hand hashes, financial journals, or private records.

The result contains `history`, exact compact `text`, zero-based inclusive `startIndex`, exclusive `nextIndex`, `total`, and `bytes`. The next user-prepared file starts at `nextIndex`. One lookahead record may be read to detect a byte boundary. A single oversized hand causes a visible error; it is not skipped or truncated. The error is a supported limitation, not successful full export.

`prepareHistoryBatchFiles(batch)` uses the exact bounded text for `.json` download and `.json.txt` share fallback. It does not pretty-print or change bytes. Filenames identify the inclusive human-readable source range and total. Existing share preparation remains separate from the subsequent user tap, preserving synchronous Web Share invocation. Existing `prepareHistoryFiles` stays compatible for legacy callers; the main interface must use the new batch path to fix large exports.

Public history remains explicitly study-only. It is **not** a resumable save or financial backup. This change does not claim recovery after deleting browser storage or device loss.

## Executed evidence

Source-bound receipt: `evidence/execution.json`. Twenty tests passed: 14 bounded-export tests and six existing transport tests. They cover the actual existing 100-hand compressed canonical fixture, exact UTF-8 boundaries, empty history, invalid options, count limits, oversized records, read failures, independently importable hash chains, original IDs/views/frames/net, private-field restrictions, unchanged canonical source bytes, strict and preview study import, numbered transport bytes, and synchronous share invocation using a test port. Typecheck, scoped lint, and unchanged 302/86 integrity checks passed.

The retained initial lint log records one test-local `prefer-const` defect, repaired before the source-bound rerun. No failed behavioral assertion was weakened.

These are Node tests. Actual browser, physical mobile export, and the independent 1,000-hand integration checks are separate evidence and are not claimed here.

Reproduce:

```sh
node node_modules/vitest/vitest.mjs run tests/step5f-export/batch.test.ts tests/ui/history-file.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js src/storage/public-history-batch.ts src/ui/history-file.ts tests/step5f-export
node scripts/check-spec-integrity.mjs
```
