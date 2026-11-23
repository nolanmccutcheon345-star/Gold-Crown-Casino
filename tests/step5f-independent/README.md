# Step 5F independent integrity checks

The test files here exercise the existing production engine/controller/storage with independent BigInt financial and raw-event accounting. They are Node protocol tests, not native browser, physical-device or human verification.

## Missing manifest defect

`orphaned-manifest.test.ts` removes only the committed `current` key using an actual asynchronous reference transaction after a settled, cashed-out hand. Financial, archive and recovery records remain. A new reader must block non-destructively rather than initialize another wallet over those records.

At baseline `c2de7f98518c8400ccdf58339abb1ba27f1f3f78`, both tests fail. The reader returns `null`; controller initialization changes a 12,345,578-cent wallet with one completed hand into the default 1,000,000-cent wallet and zero visible hands. Surviving storage is overwritten. `evidence/baseline-atomic` retains the actual failed results and observations. No production code was changed by this verification lane.

The preceding `evidence/baseline` attempt used direct Map deletion while the test reference's close/lease transaction was still queued. That transaction restored its prior snapshot, so those observations do not reproduce origin corruption. The attempt is retained as invalid fault injection. The corrected tests delete through a serialized transaction; their expected integrity requirement was not relaxed.

Complete browser origin deletion/eviction is a different boundary. If every local record is removed, local checkpoints and same-origin migration backups are removed too. A new load cannot infer the previous wallet from absent data. A public redacted study export is not a private wallet/session backup and must never be imported as funds.

## Manifest fix, write failures and independent review

Root fix `dc3be9e32af9fe6fd5cc633a123cb8d1961ab775` was applied for independent review. The reader now permits a new guest only if the store is genuinely empty except for its writer lease; initial commit repeats that guard in its own transaction. Twelve tests passed in `evidence/manifest-adversarial/vitest.json`: the two original regressions, backup-only and unknown-only orphan records, five invalid `current` values, a record inserted between empty read and initial commit, complete origin deletion, and a final-commit failure followed by export and exactly-once retry.

The failed-write case retains the previous completed hand and every committed storage record, permits its redacted study export while gameplay remains in error, then retries the next settlement once. Independent BigInt financial and canonical hand-event replay agree before and after. Repeated cashout does not add a second transfer for a session. The storage reference is asynchronous and transactional; these are protocol tests, not a physical browser quota/eviction result. `tsc --noEmit` also passed.

## Actual public-export capacity

`export-capacity.test.ts` reads existing canonical 100/1,000-hand fixtures and verifies their complete uncompressed SHA-256 before independent raw-event/hand-hash reconciliation. It uses the actual `publicHistory`, `prepareHistoryFiles` and study-import parser. Originals remain unchanged and private fields and premature opponent cards are absent.

| Saved hands | Actual pretty JSON bytes | Compact JSON characters | Study import |
| --- | ---: | ---: | --- |
| 100 | 1,754,698 | 952,535 | PASS, 100 hands |
| 1,000 | 78,537,178 | 40,798,878 | FAIL: 10,000,000-character cap |

The actual existing UI generates both JSON and plain-text Files plus the complete text, so this 1,000-hand case involves two 78.5 MB file payloads. Node timings measured 908 ms for public-history construction and 461 ms for file construction in that run; these are not browser main-thread timings or a physical-device result. `evidence/export-baseline` retains 1 PASS / 1 FAIL and the exact file hashes. The export test preserves its required roundtrip expectation rather than accepting rejection as a passing export.

Recommended repair: keep the import cap, provide independently sealed bounded public-history batches that each fit the current parser and retain full original hand IDs and redacted events. Do not make an ordinary history import credit funds or restore live state. Verified pre-upgrade snapshots and V7-R rollback are same-origin recovery mechanisms; they do not survive deletion of every browser record. There is currently no demonstrated external full-wallet/session backup/restore path. The public export is explicitly study-only and cannot recover a cleared wallet.

Commands (from repository root):

```sh
STEP5F_INDEPENDENT_EVIDENCE=tests/step5f-independent/evidence/manifest-adversarial node node_modules/vitest/vitest.mjs run tests/step5f-independent/orphaned-manifest.test.ts tests/step5f-independent/safe-write-export.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/manifest-adversarial/vitest.json
STEP5F_INDEPENDENT_EVIDENCE=tests/step5f-independent/evidence/export-baseline node node_modules/vitest/vitest.mjs run tests/step5f-independent/export-capacity.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/export-baseline/vitest.json
node node_modules/typescript/bin/tsc --noEmit
```

## Independent freeze/cache review

Applied runtime change `0de14f286bcb7cec35d1acce7cb61f7841d6e1e5` for review. Eighteen new tests in `immutable-boundary.test.ts` and 28 existing independent compact checkpoint/journal tests passed, 46/46 total, recorded in `evidence/freeze-review/vitest.json`. Typecheck and scoped ESLint also passed.

The new tests use independently constructed raw financial events with a separate Node SHA-256 implementation and hand-written packed graph inputs. They cover caller-frozen roots with mutable children, new descendants behind cloned structural boundaries, shared DAG nodes below the retained-cache depths, nonenumerable and symbol data, visible/hidden/symbol/array-index accessors, unsuccessful traversal followed by repair, cycles, cloned/resealed financial tampering, private packed-node provenance, forward/cyclic references, and `__proto__` data. No cached financial capability is granted to untrusted clones. Accessors are rejected before invocation. Packed nodes constructed by the decoder remain recursively immutable; their cloned or caller-frozen equivalents receive no private packed trust.

Existing compact tests additionally re-executed full-replay versus checkpoint accounting agreement, checkpoint/journal corruption rejection, private trust restrictions and interrupted all-in side-pot/rake/refund settlement with exactly-once payout. Cyclic JavaScript input still fails closed with the previous recursion-overflow behavior; this patch does not introduce cycle support. Ordinary serialized JSON cannot contain a cycle. No trust regression was found in the reduced memoization change; memory/performance measurements belong to the separate profiling lane.

```sh
node node_modules/vitest/vitest.mjs run tests/step5f-independent/immutable-boundary.test.ts tests/step5e-independent/compact-boundary.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/freeze-review/vitest.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js tests/step5f-independent
```

## Bounded export repair verification

After helper/transport change `2cb4c58`, the capacity test exercises the new actual bounded-file path rather than the replaced all-history UI path. The original failed artifact above remains unchanged. Both representative fixtures now pass, 2/2, in `evidence/export-bounded/vitest.json`.

| Canonical hands | Files | Largest file bytes | Total file bytes | Reimported IDs |
| --- | ---: | ---: | ---: | ---: |
| 100 | 1 | 952,535 | 952,535 | 100 exactly once |
| 1,000 | 22 | 1,999,972 | 40,802,973 | 1,000 exactly once |

The test opens the actual `prepareHistoryBatchFiles` JSON and text files, independently recomputes each public hash chain using Node SHA-256, imports each file through the unchanged parser, compares every complete view/frame/net result with its canonical source, checks redaction and verifies the entire canonical source SHA-256 is unchanged. Each file is below the 2,000,000-byte bound and independently starts its public chain at genesis. No canonical hand was truncated or omitted. This is Node executable verification, not physical Safari download/share verification and not a wallet backup/restore claim.

```sh
STEP5F_INDEPENDENT_EVIDENCE=tests/step5f-independent/evidence/export-bounded node node_modules/vitest/vitest.mjs run tests/step5f-independent/export-capacity.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/export-bounded/vitest.json
```

## Bounded controller export and durable privacy fence

After root integration `7779cc1`, three production controller/storage protocol tests passed in `evidence/bounded-controller`: exporting a prior committed hand while a later settlement write has failed; readonly export with an actual second owner; and rejecting that stale reader's all-resident export after the writer either erases the account or advances its financial revision. Every bounded export is read-only, leaves ledger/storage unchanged, and preserves error/readonly status. The failed settlement still retries exactly once. The indexed canonical reader is used even for resident hands, so a stale in-memory copy does not bypass durable manifest checks.

`evidence/controller-attempt-lock-setup` retains the initial 1 PASS / 2 FAIL harness attempt. Its writer was directly attached as writable without acquiring the runtime's Web Lock, so the second owner legitimately obtained the free lock. The corrected setup explicitly calls `writer.takeOver()` before creating the second owner. No product assertion was weakened; all three then passed. This is Node transaction/Web Lock protocol evidence, not physical multi-tab browser verification.

```sh
STEP5F_INDEPENDENT_EVIDENCE=tests/step5f-independent/evidence/bounded-controller node node_modules/vitest/vitest.mjs run tests/step5f-independent/safe-write-export.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/bounded-controller/vitest.json
```

## Final combined independent run

`evidence/final-independent/vitest.json` records **62 PASS, 0 FAIL** on the integrated runtime fixes: 34 Step5F tests (11 manifest/partial deletion, 3 bounded controller/write-failure, 18 immutability/provenance and 2 actual-fixture export tests) plus the 28 existing independent compact-recovery tests. These are executable test cases, not 62 V7 requirement IDs. Earlier failures are preserved in their original evidence directories.

```sh
STEP5F_INDEPENDENT_EVIDENCE=tests/step5f-independent/evidence/final-independent node node_modules/vitest/vitest.mjs run tests/step5f-independent tests/step5e-independent/compact-boundary.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/final-independent/vitest.json
```

## Follow-up: private checkpoint hand retention

Independently reviewed narrow runtime fix `120c6aabe84c78b9404856d4a8773936195760d2` as integrated in exact candidate source `7df0f0ba3964771f9f9cae7e636f70108b5e53cd`. The private `Checkpoint.hands` map now holds frozen `{id, sessionId, net}` copies at all three insertion sites instead of retaining complete runtime `StoredHand` objects behind a TypeScript `Pick` type. All consumers use only `has` and `size`; none relies on value identity, cards, frames or full records. Canonical histories and their independent validation remain unchanged. No production code was edited by this review.

Focused regressions passed **52/52**: 18 independent immutability/provenance cases, 28 independent compact financial/journal/corruption/all-in cases, 3 compact-finance cases and 3 failed-write/stale-export cases. Exact source SHA-256, review findings and raw results are in `evidence/checkpoint-retention-review`. These tests establish correctness/trust regression evidence; they do not independently measure heap savings.

```sh
node node_modules/vitest/vitest.mjs run tests/step5f-independent/immutable-boundary.test.ts tests/step5e-independent/compact-boundary.test.ts tests/step5f-memory/checkpoint-finance.test.ts tests/step5f-independent/safe-write-export.test.ts --reporter=json --outputFile=tests/step5f-independent/evidence/checkpoint-retention-review/vitest.json
```
