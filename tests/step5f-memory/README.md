# Step 5F immutable-boundary memory correction

The confirmed defect was retained **capacity** in the module-global `frozen` WeakSet after historical data had been collected. It was not a retained-hand object leak and does not establish the cause of the original 10.072-second preparation outlier.

`src/storage/verified.ts` now retains private immutability provenance for successful roots and shallow structural boundaries: snapshot collections/records and transport values. Every uncached descendant still has its property descriptors inspected and is frozen before its ancestor is branded. A call-local completed-node Set keeps shared-DAG traversal linear; that temporary table is discarded after the walk. Arbitrary `Object.isFrozen` or caller metadata never grants trust. Financial verification, full hashes, engine authority and journal checks are unchanged.

The memoized depth is bounded; total lifetime table capacity is not an absolute numerical cap. New copied collection arrays still inspect their own reference descriptors. This avoids rewalking deep old records without pretending all history-related operations are O(new records). Monolithic legacy wrappers may rewalk uncached descendants once when separately audited; prepared bounded-tail recovery is evaluated by the controller/browser workstreams.

## Actual matched profile

Exact baseline source `f1014a12aacb0a7aa8c6994dd9a30bcd6e19e973`; exact final source `010dc337f0b760549142aacaabf8a2b976d06461`; only `src/storage/verified.ts` differs among bundled inputs. Three fresh Node processes per cell used the same archived records, with fixture read/parse separately recorded. Inspector CPU, sampled live allocations and actual V8 retained-object graphs are preserved. These are freezer experiments, not ordinary bot or browser latency.

| Stored hands | Independent object count | Old retained table | New retained table | Old post-GC heap | New post-GC heap | Old/new median total freeze |
|---:|---:|---:|---:|---:|---:|---:|
|1,000|464,705|16,777,256 B|262,184 B|27.507–27.508 MB|10.993 MB|544.9/389.8 ms|
|10,000|5,150,102|134,217,768 B|2,097,192 B|143.469–143.484 MB|11.365 MB|6323.5/4691.0 ms|

Initial heap was approximately 9.50 MB in each process. Every selected graph was independently checked as recursively frozen; canonical JSON bytes match before/after and across all six observations per size. Row/root WeakRefs were collected after eight event-loop/explicit-GC cycles. The heap graph specifically follows `module context frozen → WeakSet → internal table`: 128 MiB becomes 2 MiB at 10,000 hands. Sampled allocation profiles independently identify the corresponding private table allocations. This does not establish zero retention in other caches or isolated whole-application memory.

The 10k baseline per-record maximum was 388.7–433.5 ms versus 17.4–22.2 ms after this change. The old outlier was a **bot preparation** maximum; these new per-record freezer timings must not be substituted for it. Reference-host work was concurrent, and the 1k before/after processes overlapped; these observations do not establish physical-device responsiveness or confidence intervals.

[Machine comparison](comparison.json), [baseline artifacts](evidence/baseline-exact), [final artifacts](evidence/final-exact). Each first-sample heap includes `heap-retainers.json` and `heap-artifact.json`. Compressed raw heap bytes are retained losslessly; files above 20 MiB are split with per-part and full checksums. Concatenate the listed parts in manifest order, verify compressed SHA-256, decompress, then verify raw SHA-256 to inspect in a profiler.

## Executed tests and provenance

The frozen runtime fix is commit `0de14f2`. The focused execution passed 43/43 tests across new descriptor/symbol/frozen-root/structural-sharing/DAG cases and existing recovery/private-boundary suites. Raw result: [focused-final-tests.json](focused-final-tests.json). An independent owner separately ran 46 checkpoint/journal/packed-capability tests; its receipt is outside this lane. Root performs full integrated regression and actual browser qualification.

Initial prototypes and a test-only TypeScript cast failure are retained in [preliminary-attempts.json](preliminary-attempts.json). Initial uncommitted harness results are explicitly not used as final candidate qualification. Exact baseline/final builds are clean tracked-source snapshots with each input hash recorded. No earlier test execution was retagged, no requirement ID changed, and no policy/calibration claim follows.

Reproduce with the appropriate source checkout:

```sh
node tests/step5f-memory/build-profile.mjs /absolute/output
HEAP_SNAPSHOT=1 node --expose-gc --input-type=module - /absolute/output/sample 10000 < /absolute/output/bundle.mjs.bin
python tests/step5f-memory/analyze-profile.py /absolute/output/sample
```

Omit `HEAP_SNAPSHOT=1` for repeats without a full retained-heap snapshot. Preserve source manifests and run separate processes for each observation. Production data is not accessed.

## Separate packed-cache residual measurement

A follow-up probe at exact source `efb1f116e423923488e572146f0882fcda773aa8` measured the unchanged private `immutableNodes` WeakSet in `packed-hand.ts`. This is a separate cache and is not fixed by shallow memoization in `verified.ts`.

One fresh process packed and decoded 1,000 actual canonical hand records. Their 44,186,578 canonical JSON bytes produced 18,989,319 packed JSON bytes and 107,124 unique packed nodes. Packing independently validates by decoding once, so this workload constructed 214,248 immutable nodes in total. Every resulting descendant was independently verified frozen and privately branded, and canonical JSON round-tripped exactly. After all roots were collected over eight event-loop/GC cycles, the retained `immutableNodes → WeakSet → table` capacity was **4,194,344 bytes**, approximately 4 MiB. Whole-process post-GC heap was 12,899,976 bytes from a 7,268,752-byte initial heap.

This one sample establishes remaining packed-cache backing capacity, not an unbounded object leak or its effect at 10,000 hands. Pack plus unpack timings (including serialization and immediate assertions) were p50 3.00 ms, p95 7.47 ms, p99 10.52 ms, maximum 20.45 ms; they are not ordinary bot-preparation latency. No production packed-hand code was changed. The earlier freezer reduction must not be represented as removal of all cache memory pressure.

[Packed residual report](evidence/packed-residual/report.json), [exact source manifest](evidence/packed-residual/source.json), [retained path](evidence/packed-residual/heap-retainers.json), [lossless heap artifact manifest](evidence/packed-residual/heap-artifact.json). The harness passed TypeScript and scoped ESLint before execution. This probe contributes no additional V7 acceptance PASS and no additional automated unit-test count.

```sh
node tests/step5f-memory/build-profile.mjs /absolute/output tests/step5f-memory/packed-profile.ts
node --expose-gc --input-type=module - /absolute/output 1000 < /absolute/output/bundle.mjs.bin
python tests/step5f-memory/analyze-profile.py /absolute/output immutableNodes
```
