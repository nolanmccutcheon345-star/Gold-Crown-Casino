# Actual published V7 rollback verification

**Z03:** “Previous working release can be restored with preserved valid user
histories and no duplicated money or orphaned event.” The unchanged original
criterion is in `docs/specs/acceptance-source.json`; the prior release identity is
recorded in `TEST_EVIDENCE/step4c/publication.json`.

This verification uses actual published source
`a0bfc0950771a6dc1b786e00c13be7f3485b8dcb`, not the unpublished Step5A baseline.
`build-frozen-v7.mjs` archives that Git object, bundles an entry point exporting
its unchanged persistence, controller and policy implementations, and records
the SHA-256 of all 33 compiled project sources. The pinned browser bundle has
SHA-256 `4859639d1913674812ddd097d1faf5bc7414f13ebe5e27fd4ac64d065752b6c7`.
Two consecutive builds produced that same hash. The exact generated bundle is
excluded from source lint because it must retain the old implementation; the
executable artifact tests independently verify its bytes and all source hashes.

```sh
node tests/step5b-rollback/build-frozen-v7.mjs
npm test -- tests/step5b-rollback/frozen-v7-artifact.test.ts
```

The artifact suite executed **3 PASS, 0 FAIL, 0 SKIPPED**. It also executes the
published policy registry: original `synthetic-cash-1.2.0` and legacy policies are
supported, while later `1.5.0` and `1.6.0` are not. Browser execution uses
`tests/browser/step5b-published-rollback.html`, button `#rollback-run`; complete
machine-readable evidence appears in `#rollback-evidence`.

The native IndexedDB browser harness creates three genuine V7 hands and a pending
fourth hand; migrates their actual V7 envelope with current code; completes three
post-migration hands plus top-up, cashouts and a manual bankroll edit; and saves a
new-policy pending action. It then loads the same data with V7, verifies exact
non-lease storage bytes after refusal, restores the exact latest current state,
commits its pending decision once, and verifies unknown-schema refusal. Only two
unique `ai-texas-step5b-published-rollback-*` database names are used. No production
database or Site deployment is involved. A test-only native connection tracker
closes isolated handles at teardown and requires actual database deletion success.

The parent integrator executes the browser harness and preserves its raw results
under `TEST_EVIDENCE/step5b/browser/rollback-*.json`. The first completed functional
run passed all six substantive checks, preserving **six hands, 22 money events
and seven sessions**, including three post-migration hands. Its teardown reported
a blocked deletion; the harness now closes tracked isolated connections and waits
for native deletion completion. The final browser record, rather than this source
description, determines whether teardown passed. Earlier QA hash-verification
failures (HTTP `crypto.subtle` availability and Vite's transformed JS response)
occurred before seeding financial data and were corrected using SHA-256 of Vite's
explicit raw asset. The frozen published artifact was never modified.

**Whole Z03 is not satisfied by these passing safety checks.** V7 rejects the
new segmented envelope with “Unknown guest snapshot format. Existing data was
preserved.” The newer source can recover all saved records and the pending action,
but that is recovery to current code, not a usable rollback to V7. A pre-migration
backup excludes later hands and events, and the published policy registry cannot
execute current policies. No destructive replacement or unverified conversion is
attempted. A separately implemented and verified compatible rollback release is
still needed before claiming the exact original criterion passes.
