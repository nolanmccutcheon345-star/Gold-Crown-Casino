# Step5G independent integrity review

The proposed packed-graph optimization passed independent review and targeted
regression. This is local engineering evidence; it does not pass physical-device,
screen-reader, hosted-CI or new-user requirements.

| Execution | Source | Result |
|---|---|---|
|Version12 baseline|`7ac2175ba3478102c521a149ce339f0fbc4d586b`|468PASS,0FAIL,2explicit opt-in accounting-batch skips,35files|
|Packed optimization plus independent fixtures|`900f1a2`|439PASS,0FAIL,0SKIP,33files|

Commands, source hashes, runtime, exact assertions and outputs are preserved in
[baseline receipt](evidence/baseline/receipt.json),
[candidate receipt](evidence/optimized/receipt.json), their `vitest.json` files,
and [review](evidence/review.json). The candidate selection omits the baseline's
two opt-in10,000-hand-per-profile accounting batches; it does not silently mark
them passed. Counts overlap the full regression suite and are not additional
V7 acceptance requirements.

Only `src/storage/packed-hand.ts` changed in production. Reviewed implementation
commit: `267b17c6648bd5120b16dbadd1e575dafedaa908`. The new private argument controls
only insertion into the provenance WeakSet. Public decoders always insert fully
validated, frozen outputs; the packing path fully validates and freezes its
temporary reconstruction, then discards it. Descriptor, type, reference, edge,
depth and expanded-size checks remain mandatory. Neither caller freezing nor
successful packing confers financial-snapshot trust.

The two new independent fixtures verify an aggregate expansion that exceeds the
limit although each string is individually legal, and a permitted shared Unicode
expansion against an independent Node SHA-256 of canonical JSON. Existing tests
also reject forged frozen descriptors, accessors without invoking them, forward
or cyclic references, unknown schemas, corrupted checkpoints, reordered and
duplicated events, and invalid financial summaries.

Executed coverage includes PokerKit0.7.7 comparisons, betting/settlement and chip
conservation, independent BigInt financial replay, compact/full accounting
agreement, pending-bot idempotency, migration/compatible rollback, quota/retry,
missing-manifest recovery, redaction and bounded study export/import.

- A missing manifest with a retained12,345,578-cent wallet blocks gameplay and
  preserves surviving records; it does not initialize a replacement bankroll.
- Injected settlement-write failure preserves the prior canonical state; retry
  creates one settlement, and repeated cashout does not create another transfer.
- The actual1,000-hand export fixture produces22files, maximum1,999,972bytes.
  Every permitted hand/frame/result imports once; canonical SHA stays unchanged.
- Typecheck, scoped fixture lint, and the specification-integrity script passed.
  All302original acceptance IDs and86deferred IDs remain preserved.

The retained-memory measurements and rare-stall investigation belong to the
separate performance lane. This review does not attribute the historical10.07s
outlier, establish an absolute memory bound, or substitute Node protocol tests
for native-browser or physical-device execution.
