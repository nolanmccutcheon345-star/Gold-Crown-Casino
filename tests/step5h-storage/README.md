# Step5H bounded redundant-history storage

The only runtime changes are `src/storage/segments.ts` and `src/storage/browser.ts`, committed as `029c9b3`. The authoritative engine, all financial events, original hand hashes, schemas, policy versions and public redaction remain unchanged.

## Implemented behavior

Fresh saves retain at most120 optional packed hand replicas. Every canonical hand remains in its original immutable v2 record, preserving the independent audit and frozen V7-R rollback. `packedHands.first` is an optional, checksum-bound cache coverage offset; omitted means zero. Current readers intentionally read cold canonical rows below that offset. Actual Version13 readers ignore the extra offset and retain their verified canonical fallback. No public codec or caller-controlled integrity bypass was added.

Normal appends retire at most the added hand count. Before deleting a redundant replica, the canonical outer/inner hashes and its verified financial index are checked. Failure preserves the copies and rejects the write. The existing compare-and-swap manifest and writer lease fence the entire transaction. A legacy unbounded archive never triggers a full historical scan on normal startup or a single bot preparation.

Existing large saves use explicit `BrowserPersistence.optimizeStorage()`: full independent canonical reconstruction first, then one atomic transaction publishes the bounded descriptor and corresponding current recovery checkpoint and deletes only obsolete replicas. Missing or corrupt canonical records prevent any deletion. `previous`, pre-upgrade and migration backups remain unchanged. The old recovery checkpoint is deliberately retained; repeating maintenance is inert. The root integration provides the user-facing maintenance control and native-browser tests separately.

## Exact logical footprint

These are measured UTF-8 serialized application-record bytes from the same save before/after maintenance. They do not estimate IndexedDB internal disk pages, indexes, browser cache, or diagnostic-file storage. Native origin usage is reported by the separate browser lane. Fixture preparation and diagnostic artifacts are outside the application record store.

| Saved hands | Before bytes | After bytes | Bytes saved | Before mean B/hand | After mean B/hand |
|---:|---:|---:|---:|---:|---:|
|100|3,032,591|3,032,591|0|30,325.91|30,325.91|
|1,000|69,361,745|54,432,363|14,929,382|69,361.74|54,432.36|
|5,000|355,315,725|263,087,201|92,228,524|71,063.15|52,617.44|
|10,000|714,676,203|515,204,703|199,471,500|71,467.62|51,520.47|

The10,000-hand save falls from714,676,203 to515,204,703 bytes:199,471,500 bytes (27.91%) less. This is a reduction of redundant amplification, not a claim that515MB is a small archive. Canonical replay frames remain the dominant cost. Fixtures have different seating/action distributions; the mean-per-hand column is not a longitudinal growth slope or a projection of100 hands to10,000.

|10,000-hand family|Before bytes / records|After bytes / records|
|---|---:|---:|
|backupManifests|0 / 0|799 / 1|
|canonicalHands|474,082,014 / 10,000|474,082,014 / 10,000|
|checkpoints|16,139,321 / 1|32,278,642 / 2|
|currentPreviousManifests|799 / 1|812 / 1|
|financialLedger|6,864,209 / 10,230|6,864,209 / 10,230|
|other|617 / 2|1,182 / 3|
|packedReplicas|217,052,420 / 10,000|1,440,222 / 120|
|sessions|536,823 / 101|536,823 / 101|

The additional16,139,321-byte recovery checkpoint is retained intentionally for rollback; it is not silently deleted to inflate savings. The maintenance backup is only799 bytes. This representative first-save fixture contains no legacy v1 whole-account backup; migration tests separately prove such backups remain intact. No diagnostics, CPU profiles, or test fixtures were stored inside the application database.

The474,082,014 canonical record bytes contain382,964,292 bytes of replay-frame values,47,453,937 of final-view values,35,207,504 of private policy-profile values,2,460,000 of provenance values, plus identifiers/timestamps/hash fields and JSON structure. These field values overlap semantically but are required by the existing history/rollback contract and remain byte-identical. A new canonical codec would require a broader verified migration/rollback design; this patch does not introduce one.

Inside the original16,139,321-byte checkpoint:7,341,074 bytes of hand-index values;5,044,150 of financial-ledger values;2,578,656 of resident-hand values;655,604 of statistics;519,057 of sessions;201 of bot memory. These are contained within the checkpoint, not extra database rows. Field subtotals exclude field-name/JSON punctuation overhead. The reports include every other field and family, with raw-family SHA256 equality checks.

## Reconstruction and timing

All four complete scenarios PASS. Every canonical raw-record family is identical before/after; full reconstructed AppData hashes, original hand chains, each actual redacted public-hand export hash and independent complete financial replay agree. Every case finishes a current full canonical audit and an idempotence check. The10k endpoint is wallet98,640,349 cents, table0, poker result−1,359,651 cents,10,000 hands,10,230 financial events and101 sessions. No balance, settlement, record, or policy version is rewritten.

|Hands|Verified recovery before / after (ms)|Explicit maintenance incl. full audit (ms)|Separate final canonical audit (ms)|
|---:|---:|---:|---:|
|100|210.83 / 170.87|0.34|98.63|
|1,000|352.08 / 277.20|2626.51|1876.35|
|5,000|937.68 / 823.81|11882.46|10594.27|
|10,000|1081.22 / 1158.29|24139.90|22054.20|

These are single matched observations from Node24.22.1 on the Linuxx64 reference host (AMD EPYC9V74,9 available logical CPUs), with a4GiB V8 heap cap and disk-backed asynchronous request reference. They are not native IndexedDB/phone measurements or p50/p95 estimates. The10k post-maintenance recovery is slightly slower in this pair; no generalized speedup is claimed. Full proof windows additionally hash and export every hand and therefore must not be labeled startup or ordinary bot preparation. Explicit10k maintenance costs24.14s but remains outside ordinary gameplay. The historical10.07s bot-preparation sample remains unattributed.

Post-GC10k heap is43.14MB at initial compact readiness,43.81MB after releasing the independent full-proof scope, and45.21MB at post-maintenance compact readiness. RSS peaks around988.7MB from explicit full-history work/allocator high-water. This patch does not establish a live-heap reduction. Canonical history remains lazy for normal recovery, and full audit/export remains explicit and potentially expensive.

## Verification and reproduction

- Existing focused storage/recovery/independent suites:254/254 PASS, no failed cases. Typecheck, scoped ESLint and the302/86 specification registry pass. [Raw test receipt](initial-regression.json).
- Independent reviewer executes separate actualVersion13/V7-R, only-copy corruption, quota, interrupted transaction, stale-owner, ordinaryappend and public-export fixtures; those counts belong to that lane, not these four profiling scenarios.
- [baseline-source-verification.json](baseline-source-verification.json) verifies all94 runtime inputs in the frozen first-save fixture bundle against saved Version13 Git objects. [measure-source.json](measure-source.json) pins all current measurement/runtime input hashes and the bundled harness hash. [summary.json](summary.json) hashes every scalar report.
- The initial100-hand measurement failed because the legacy first-save fixture metadata carried `size:0`; the actual committed manifest contained100 hands. The failed log is retained. The harness now reads the committed manifest count, and the complete100-hand scenario was rerun. An initial TypeScript metadata-property error was corrected before successful execution. Neither failed attempt is claimed passed.

The source baseline directories are isolated scratch fixtures, never production saves. The harness clones immutable record files by hard link into a new directory; its write-once adapter only replaces/unlinks clone paths. Original source rows remain unchanged. Prepare a new output directory for every run; do not overwrite prior evidence. Compile `measure.ts` with esbuild, then execute:

```sh
node --expose-gc --max-old-space-size=4096 /absolute/measure.mjs \
  /absolute/existing-full-packed-fixture /absolute/new-isolated-clone \
  /absolute/new-report.json
```

A5,000-hand fixture was extracted from the original SHA-verified gzip with `prepare-fixture.mjs`, then written through the retained exactVersion13 first-save bundle before the candidate comparison. Other sizes reuse the original Step5G baseline stores read-only. The retained5000baseline report's inherited scope text mentions100/1000; its execution arguments, manifest count and independent5000-report prove this5,000-hand invocation. Native browser quota/eviction, physical-device, screen-reader and participant checks remain separate. No original acceptance status or release gate is automatically promoted by these measurements.
