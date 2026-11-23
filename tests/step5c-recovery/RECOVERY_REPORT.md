# Step 5C cold recovery: executed evidence

The 10,000-hand cold initialization was reproduced at **43.56 seconds**, then reduced to **25.30 seconds (41.9%)** without skipping historical or financial verification. This remains too slow to claim the large-history bottleneck is eliminated. Browser responsiveness and mobile capacity require separate browser/device evidence.

## Matched cold measurements

Node24.22.1 on the managed Linux executor, actual production `restoreSegments` + `SessionController.init`, reference storage containing the same serialized canonical records. Each fixture ends at a complete closed-session boundary. Original hand, ledger and closed-session segment bytes/hashes remain unchanged; only the fixture header/count/tail and its checksum are reconstructed. Before and after consume identical data. Archive streaming/setup is outside the timed recovery window. No React is used by this application.

|Saved hands|Before ms|After ms|Samples per phase|
|---:|---:|---:|---:|
|0|2.31|3.81|1|
|100|169.12|110.03|1|
|500|2,037.55|1,022.74|1|
|1,000|3,814.10|2,053.36|1|
|5,000|21,520.24|13,934.63|1|
|10,000|43,557.57|25,295.20|1|

These are individual cold measurements, **not statistically reliable p50/p95/p99 estimates**. The separate rare-stall lane collects thousands of decision samples. Raw `baseline/*.json`, `optimized/*.json`, CPU profiles and `comparison.json` contain the measured stages, GC entries and memory figures. Reference storage retains serialized strings in RAM; these Node heap figures are not browser heap or physical-device claims.

At10k, baseline JSON reading/parsing took2.20s, outer segment hashing/canonicalization10.34s, recursive freeze8.13s and two complete financial/history audits22.82s. Afterward, reading/parsing took1.85s, segment hashes8.58s, freeze5.12s and **one** complete audit9.67s. Stage intervals overlap nesting (readParse is included in read.*); do not sum both. CPU samples substantiate recursive canonicalization, descriptor allocation/freezing and SHA compression as primary costs, with GC secondary. No solver or bot policy is involved in this cold path.

## Implemented and verified

- Controller initialization, retry and takeover reuse only the exact privately branded, recursively immutable snapshot that the persistence port has already fully audited. A clone, caller checksum, arbitrary `Object.freeze`, or persisted summary cannot grant trust. Explicit `auditSnapshot` still independently replays every canonical record.
- Freezing inspects each property descriptor directly, reducing temporary descriptor allocation. It now rejects symbol-keyed accessors too. Cooperative pre-freezing checks root/array-index descriptors before reading their values, so getters are not invoked.
- Native SHA-256 handles records of at least4096 encoded bytes when available. Smaller records and managed HTTP environments use the original Noble SHA-256. Both paths match independent Node SHA-256 and retain exact historical bytes/hashes. No card entropy source changed.
- Only JSON encodings of at most512 short property names are cached. No data value, serialized hand, checksum or verification result is cached. A500-hand/21.1MB microbenchmark showed roughly20–23% less serialization time; a streaming canonical writer did not consistently improve and was not adopted. Numeric-looking keys, Unicode, nonfinite values, undefined/sparse arrays and long/over-capacity key cases match the original canonical implementation.
- Cold segment reads are bounded to64 records. Browser recovery yields between complete checked records when its8ms work budget is spent. It continues displaying a loading state; **no poker action becomes eligible until every required check succeeds**. This schedules real verification work rather than masking delays with bot think-time or skipping checks.
- Independent review reproduced a genuine integrity gap: an active **zero-net completed hand** could omit both its history row and settlement event while scalar balances still reconciled. Full and incremental checks now require that completed active hands have the canonical settlement and matching public final frame. Existing exact top-up reconciliation remains intact.

37 targeted tests passed across four files; typecheck and scoped lint passed. The separate independent review executed78 tests including24 new adversarial checks against these changes. Its source hashes and results are recorded separately; final integrated regression belongs to the parent release report. Initial development failures remain in evidence; final results are not inferred from authored tests.

## Reproduce

`node tests/step5c-recovery/build.mjs`, then:

`node --expose-gc --max-old-space-size=6144 --cpu-prof --cpu-prof-dir=tests/step5c-recovery/evidence /tmp/step5c-recovery.mjs 10000 reproduce 1`

Substitute0/100/500/1000/5000 for other sizes and increase the last argument for repeated cold samples. The immutable25.9MB gzip fixture is `tests/step5b-resource/evidence/full/canonical-segments.jsonl.gz`. The source does not access production saves. `summarize.mjs` builds the matched evidence summary. `build-frozen-v8.mjs` creates the exact-f54 source baseline browser bundle and pins its source-file/bundle hashes.

The browser harness is `/tests/browser/step5c-recovery.html`. It streams the canonical archive into isolated IndexedDB databases, checks the same fixture with frozen Version8 and the candidate, and records loading-state heartbeats, long tasks, cold recovery, actual post-recovery statistics rebuilding and ready-status paint. It exports complete evidence. This harness being authored does not establish a browser PASS; actual executions are recorded by the parent.

## Remaining limitations

Full trust-boundary recovery still reads and validates all canonical bytes: no unverified checkpoint or lazy summary replaces them. The500MB10k corpus therefore retains linear I/O, serialization and deep-freeze costs and substantial memory use. A verified indexed/lazy history architecture would require a deliberate additional storage/controller contract; it was not improvised in this fix. Physical-phone10k capacity, OS suspend/kill, screen reader and iPhone export are not verified by Node tests. The original9.79second bot-preparation outlier cannot be retroactively attributed without its missing contemporaneous trace; the stall lane reports fresh reproducible cases separately.
