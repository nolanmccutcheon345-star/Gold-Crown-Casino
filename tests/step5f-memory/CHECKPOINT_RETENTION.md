# Step 5F compact-checkpoint retention correction

The private financial checkpoint declared `Map<string, Pick<StoredHand, 'id' | 'sessionId' | 'net'>>`, but inserted complete hand objects at runtime. TypeScript's `Pick` does not copy or remove properties. `prepareCompactSnapshot` reused that checkpoint, so its nominal 120-hand resident snapshot retained all earlier cards, replay frames and private profiles through `checkpoint.hands → Map → table → StoredHand`.

Production commit `120c6aabe84c78b9404856d4a8773936195760d2` changes only `src/storage/verified.ts`: all three insertion sites (full audit indexing, compact audit indexing, and appended-hand transition verification) now store a fresh frozen `{id, sessionId, net}` object. The private type is read-only. Every current reader of this map uses identity membership or size; none requires a full hand body. Full canonical records, hand descriptors, hashes, checkpoint/journal verification, settlement reconciliation and engine authority are unchanged. This helper runs only after the existing descriptor freezing and financial validation boundaries; it creates no financial trust capability.

## Executed matched retention proof

The exact baseline harness source is `5bee680bb30a74880e2e9d8fc00686ac8a6207ab`; candidate source is `120c6aabe84c78b9404856d4a8773936195760d2`. Only `verified.ts` differs among bundled source inputs. Both tracked input snapshots were clean. Each fresh Node process restored the same archived 1,000-hand canonical segmented fixture, completed the full audit, promoted to a compact snapshot, released the reader map and original full AppData, and kept the compact state alive through heap capture. The compact state has 120 resident hands and 880 archived hands.

| Check | Baseline | Candidate |
|---|---:|---:|
| Original full AppData after eight turn/GC cycles | Collected | Collected |
| First archived hand | Retained | Collected |
| Its complete view and replay-frame array | Retained | Collected |
| Post-GC process heap | 66,998,648 bytes | 16,669,664 bytes |
| Actual private Map value in heap | Complete StoredHand | Financial metadata only |

The independent financial oracle agrees in both processes: wallet 99,825,110 cents, table 0, poker result −174,890, manual adjustments 100,000,000, 1,000 hands, 10 sessions and 1,026 unique financial events. Canonical fixture SHA-256 and every resident-tail hand hash match. The private compact state remains verified. No canonical hand is deleted: only an unnecessary in-memory alias is removed.

This is one matched process per version under explicit GC, not a browser benchmark, a confidence interval, or an attribution of the original 10.072-second stall. The separate freezer and packed-node WeakSet capacity findings still apply. This change removes the demonstrated full-hand retention path; it does not claim all caches or loaded history views are free of memory cost.

[Comparison and source receipts](checkpoint-comparison.json), [baseline heap path](evidence/checkpoint-before/checkpoint-retainers.json), [candidate heap path](evidence/checkpoint-after/checkpoint-retainers.json). Actual heap bytes are compressed losslessly with SHA-256 manifests. Numeric primitive fields such as `net` do not appear as named pointer edges in V8's heap graph; the production helper and TypeScript source establish the three-field metadata shape.

## Tests actually run

Typecheck and scoped ESLint passed. **50/50 tests passed**, zero failed or skipped:

- Three new financial regression cases: independent full/compact accounting equality; real engine settlement, stale-action rejection and exact cashout after compact promotion; untrusted clone and corrupted-wallet rejection.
- Twenty-eight existing independent compact checkpoint/journal/corruption/all-in tests.
- Existing private-freezer and recovery-verification tests.

Raw executed results are in [checkpoint-tests.json](checkpoint-tests.json). The 50 includes existing tests and must not be added to an integrated test count as 50 new tests. The heap proof is a separate executable assertion and not an additional mapped V7 acceptance PASS.

Reproduce at each exact source checkout:

```sh
node tests/step5f-memory/build-profile.mjs /absolute/output tests/step5f-memory/checkpoint-retention-profile.ts
node --expose-gc --input-type=module - /absolute/output retained < /absolute/output/bundle.mjs.bin
```

Use `collected` instead of `retained` for the corrected source. Then run the artifact analyzer from the final evidence checkout:

```sh
python tests/step5f-memory/analyze-checkpoint-retention.py /absolute/output
```

The harness fails if actual WeakRef reachability differs from the stated expectation, if the independent financial accounting changes, or if the compact tail differs. The analyzer separately asserts the exact retaining Map path and records lossless heap artifacts. Production guest data is never accessed.
