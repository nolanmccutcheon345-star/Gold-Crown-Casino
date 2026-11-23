# Step 5D independent recovery review

Baseline production source: `104b9d64b60276866a25f8bf65827efa65e1df2a` (saved Version9, unpublished). No production files were edited in this lane.

## Executed baseline

`npx vitest run tests/step5d-independent --reporter=json --outputFile=tests/step5d-independent/evidence/baseline-fixed.json`: **21/21 PASS**, one file, no skipped checks. Typecheck and scoped ESLint passed. The initial typecheck exposed one missing required field in the test-only pending-bot fixture; it was supplied and the complete suite rerun. Original logs remain available. No product behavior or assertion was weakened.

The tests independently reconstruct original canonical JSON and SHA256 using Node crypto rather than production digest/canonical helpers. Expected accounting uses `tests/step5c-independent/accounting-reference.ts`, which imports no engine, hash, integrity, projection or production accounting function. Engine functions generate the fixture actions; the independent reference replays public debits, refunds and awards and reconciles all wallet/table/session events.

Executed boundaries:

- Cold canonical reconstruction agrees byte-for-byte and financially with the source, and a copied frozen snapshot does not inherit verified provenance.
- Missing ledger, hand, closed-session and imported-history segments fail closed without writing any data.
- Corrupt checkpoint count/tail/revision and valid-checksum stale/future/negative segment counts fail closed.
- Duplicate, reordered and mismatched-index inner financial events fail even after independently resealing the outer transport hashes.
- Corrupted historical private policy metadata fails the unchanged canonical hand hash, even when outer transport hashes are recomputed.
- Interrupted reads, truncated read results and array-index accessors prevent controller readiness and cause zero commits; the accessor never executes.
- Unknown saved schema99 refuses without archive changes.
- A real three-way all-in hand has Hero5,000c, opponent10,000c and opponent20,000c. Exact actions: Hero raises to5,000c; seat1 calls; seat2 raises to20,000c; seat1 calls its remaining stack. Fixed test-only cards give HeroAA, seat1KK, seat2QQ on2d3d7c8c9h. Expected main pot15,000c toHero, side pot10,000c toseat1, uncalled refund10,000c toseat2; ending stacks15,000/10,000/10,000c.
- Aborting before the final committed call restores the pre-call state; losing the acknowledgement after the committed call restores the paid state. Replaying the stale callback cannot pay again. Cashout returns15,000c exactly once; wallet1,010,000c, table0, poker profit10,000c, all independently reconciled after a second reopen.

## Proposed optimization review boundary

A lossless packed representation may be used only if it reconstructs the complete original records and passes their existing original outer and inner hashes, financial/session/game semantics and immutable-object validation. A persisted self-hashed summary alone cannot grant verified provenance. Canonical serialization memoization must be scoped and limited to genuinely immutable values; neither arbitrary `Object.isFrozen` nor caller-provided hash values establish trust.

A valid complete packed snapshot can provide recovery when its redundant legacy hand copy is damaged, provided all original record/hash/semantic checks pass and financial event sequence verification remains intact. That does not establish that the redundant copy was audited. Do not silently rewrite damaged originals; retain an explicit independent legacy/full-audit path and disclose its result. Missing/corrupt packed data may fall back only through the complete independent original recovery path, never through partially reconstructed values.

Pending candidate review: strict codec type/reference/cycle/allocation boundaries, preserved original hashes, independently verified restore equivalence, fallback behavior, and asynchronous mutable-alias safety. These are **NOT_EXECUTED** until a production codec exists and the resulting tests run. This report does not claim browser, physical-device, hosted-CI or acceptance-requirement completion.

Independent legacy-receipt baseline extension: **25/25PASS** across two files (`evidence/legacy-baseline.json`), typecheck/scoped lint PASS. Four additional active-street fixtures construct the exact legacy format2 manifest and version1 migration receipt using the independent stable JSON/hash oracle rather than production `prepareSegments`. `verifyMigrationBackup` must continue verifying those unchanged receipts even if a newer writer adds optional packed replicas or manifest fields. This prevents redefinition of the old target hash through a new production serializer. Counts overlap the earlier21tests; they are not46distinct tests.

## Executed codec review

Production codec checkpoint `ac58729` plus test-only probe type correction `8868adf`: **74/74PASS** across three independent files (`evidence/packed-initial.json`), scoped lint and final typecheck PASS. The original probe typing failure is preserved, then corrected by its owner; it did not concern production codec behavior. Of these74,49are new codec checks and25are the earlier baseline checks. Counts overlap earlier runs.

The codec review independently checks primitive/Unicode canonical bytes and SHA256, repeated object sharing, private immutable provenance versus financial trust, complete canonical record roundtrips and event-accounting equivalence for all four active-street fixtures. Hostile `__proto__`/constructor/prototype keys stay inert own properties. Unsupported JavaScript-only values refuse rather than normalize; forward/self/negative/fractional/string references, duplicate fields, future format and extra root/ref fields reject. Eight accessor locations reject without executing the getter. Exponential expansion, excessive depth and node-count fixtures reject. A copied/frozen object cannot impersonate the decoder's private immutable-node capability, and that capability alone never grants an audited financial snapshot.

No codec correctness defect was found in the tested checkpoint. Packed storage installation, replica fallback, canonical-only cross-audit and transactional lifecycle remain **NOT_EXECUTED** in this lane pending integration; a green pure codec does not establish storage release readiness.

## Executed packed storage, rollback and asynchronous status review

Runtime checkpoints `b50e867`, `0f2fabc` and `20ac9c8`: **106/106 independent tests PASS** (`evidence/storage-race-fixed.json`). This total includes all earlier tests, plus native JSON-text decoder boundaries and 23 packed-storage lifecycle checks. Typecheck and scoped ESLint results are retained separately. No physical-device, browser or hosted-CI claim is made by this suite.

Both complete hand representations reconstruct the original canonical bytes and independently reconciled financial state. The packed path validates original hand and storage hashes; the independent canonical-only path reads the retained original records. Missing or corrupt packed records fall back only through full original verification, with diagnostics and no repairs. Missing/corrupt financial ledger records and loss of both hand copies fail closed. Newly settled hands from all three current rake profile modes are exercised without JSON normalization. Unsupported optional JavaScript values refuse only the optional codec and retain canonical persistence.

Installation interrupted at a replica, pre-packed backup, previous manifest or current manifest publishes no partial change; retry preserves exact balances, ledger and history. Actual frozen V7-R code reads the populated packed manifest through original records, makes one manual adjustment, and writes an original-compatible manifest that the current reader restores exactly. A cached V7-R writer is fenced even when representation installation changes only the manifest checksum at the same financial revision.

Two genuine regressions were found and preserved:

- The first legacy-v1 migration returned before initializing optional packing; the second load unexpectedly changed durable metadata. The retained run initially had **22/24 PASS** (`retained-storage-before.json`). Runtime `0f2fabc` fixes first-load initialization; both original repeated-load assertions then pass.
- An asynchronous retained-archive audit could complete after a newer revision was committed and loaded, falsely marking that newer manifest verified. The controlled barrier test initially had **22/23 PASS** (`archive-race-before.json`), with this assertion failing. Runtime `20ac9c8` binds completion to generation and exact stored/in-memory manifest; the unchanged race test now passes.

One original retained Step5B assertion deliberately differs under redundant-copy recovery: it corrupted only the retained original hand, then required ordinary startup to reject despite a complete valid packed replica. After the migration repair, the unchanged retained-plus-independent run had **128/129 PASS** (`storage-repaired.json`), with that one assertion still failing. This is **not** reported as an original green regression. The approved replacement boundary is stronger and explicit: verify complete selected logical records and finances; label retained originals `not-audited`; require a separate canonical-only audit to detect corruption; preserve all durable bytes; reject both-copy damage and any invalid financial ledger. The independent suite executes all these conditions. The original retained test update is owned by the integrator.

No production file was edited in this independent lane. Further same-load hash-proof optimization remains pending independent review; the above counts do not establish its behavior.

## Executed paired-hash proof review

Runtime `a1243ed`: **117/117 independent tests PASS** (`hash-proof-final.json`). Broader retained incremental, recovery, accessor/alias, scheduler and rollback regression including these tests: **199/199 PASS** (`proof-regression.json`), with typecheck and scoped ESLint PASS. These counts overlap; 199 is not added to 117. The previously documented retained redundant-copy assertion is outside this broader command and remains the integrator's explicit semantics update.

Eleven additional checks observe actual native SHA-256 calls. Both original inner and outer hashes execute before a private exact-object proof is issued. Failed inner or outer comparison grants no proof; a failed later comparison revokes an earlier proof. A cloned caller-frozen object cannot inherit it. Reordered and duplicated proven objects still fail the original predecessor checks. An explicit `auditSnapshot` rehashes recovered hands, while ordinary restore may reuse only successful freshly executed hashes on exact privately immutable decoded objects. Verified hand hashes do not bypass current wallet reconciliation or net/ruleset-provenance checks; those corruptions still reject after independent valid inner/outer resealing. Recovered finances agree with the separate event-accounting oracle.

The initial proof run was **115/117 PASS** (`hash-proof-initial.json`). One test used a legacy fixture with intentionally absent provenance, so no provenance assertion applied; the test now adds an independently fingerprinted current-format provenance fixture before corrupting its replay profile. The other asserted the former error stage: invalid packed inner hash now rejects earlier, explicitly reports a fallback, and the resealed conflicting checkpoint then rejects. Its failure condition was retained and the more precise new failure path asserted. Neither initial failure represented a newly demonstrated product integrity defect.

Review conclusion for the tested storage boundary: no unresolved finance, hash-proof, decoder or transactional rollback defect was demonstrated. This does not waive the slower recovery targets, browser/device tests, hosted CI, independent human checks or other R1 gates. Full historical audit still reconstructs original records; checksums detect accidental corruption and are not an authenticity mechanism against a user who rewrites and rehashes their own local data.

## Integrated lifecycle regression follow-up

The integrator's full suite subsequently exposed six failures outside the earlier 199-test subset: five retained erasure integration cases and the original migration backup assertion. This required reopening the production freeze; the earlier subset was not sufficient release evidence.

Independent reproduction (`lifecycle-before.json`) executed **49 tests: 41 PASS, 8 FAIL**. The six original failures reproduced unchanged; two additional checks exposed the prerequisite: loading a newly created save installed packed metadata at the same financial revision, invalidating the original controller's manifest CAS. Its requested deletion or adjustment consequently never committed. The stale write then succeeded because no deletion marker/new wallet existed. This was a real lifecycle defect, not a demonstrated bypass of an already committed erasure marker. Separately, optional installation overwrote `previous` with an intermediate representation instead of retaining the exact preceding migration/financial snapshot.

Runtime repair `53b2834` creates the empty packed descriptor atomically for new wallets and explicit restarts, and retains `previous` while using `pre-packed-v1` for representation backup. Revision, checksum, lease and erasure checks were not relaxed. All original erasure/migration assertions remain unchanged. One independent interruption parameter for writing `previous` became inapplicable because that write is removed; it was replaced by an explicit test preserving the exact previous financial envelope through an interrupted installation and successful retry.

Final independently executed result: **248/248 PASS across 17 files** (`lifecycle-final.json`), including **120 Step5D independent tests**, all retained migration/erasure cases, and earlier async/accessor, recovery, incremental and rollback checks. Typecheck and scoped ESLint PASS. Three new lifecycle cases verify inert second load, actual committed deletion before stale-write rejection, and explicit fresh-wallet identity preservation. All financial/hash/corruption/incomplete-settlement invariants continue passing. These totals replace, rather than add to, prior subset totals. Native browser erasure/restart qualification remains the integrator's separate responsibility.
