# Step5H full-history residency during explicit maintenance

Native-browser qualification found a specific pressure path: after `loadFullHistory` adopted every canonical hand, `auditSavedArchive` retained that full snapshot in both `controller.data` and an `expected` local while the storage port independently reconstructed another full archive. The hidden Study/Results view caches could retain the same first graph. This is separate from the unexplained historical 10.07-second bot-preparation outlier.

The controller now remembers the exact privately verified compact predecessor of a read-only expansion in a WeakMap. Entire non-hand headers and hand index identities/hashes must agree before this association is made. Explicit audit or storage maintenance returns to that same compact commitment in a helper whose scope ends before the independent full reconstruction starts. A verified full snapshot without this predecessor uses the existing compact-snapshot capability. UI subscribers synchronously clear history, replay projection, filtered results and pending statistics caches on the full-to-compact transition. Original canonical records, ledger, policies, stored statistics, engine actions, and full audit code are unchanged. There is no production forced GC.

The ten new executable checks cover exact predecessor/immutable ledger identity before both operations; complete canonical/export/statistics/independent financial agreement after reload; verified-full fallback; quota/audit failure with safe retry; manual adjustment after expansion; unverified replacement; changed non-hand metadata; ownership loss; and UI invalidation wiring. Actual browser rendering and memory tests are separately owned by the root release run.

Executed targeted regression: **71/71 PASS** across seven files. Typecheck and focused lint PASS. `evidence/tests.log`, `vitest.json`, `typecheck.log`, and `lint.log` preserve the executed results. The initial test attempt had nine fixture failures because it expected compact state on the very first legacy installation load; the fixture now explicitly completes installation before tested recovery. The first TypeScript attempt exposed a test-spy union return type; the spy is now explicitly typed by operation. Those failed attempts remain in `*-first` evidence.

## Retention diagnostic

`build-retention.mjs` builds the identical harness twice: baseline uses the actual pre-change controller at `e67f65b`; candidate uses the current controller. All other storage code, fixture data and process flags match. Each mode runs in a new Node process. The fixture is read-only; only lease/installation metadata may enter a test-local in-memory overlay. No production saves are read or changed.

At each labeled boundary, three diagnostic GC/event-loop turns measure retained graphs. A WeakRef reports whether the original expanded AppData is still reachable **before** the storage port starts its complete independent audit. Another sample is captured while the independently audited return graph is live. This proves graph reachability and retained heap; it is not browser scheduling, peak allocation, device performance, or an ordinary latency benchmark. Root browser qualification must corroborate usability under natural garbage collection.

Reproduce from repository root, using an existing read-only fixture:

```sh
node tests/step5h-residency/build-retention.mjs /tmp/ai-texas-5h-residency-build
node --expose-gc --max-old-space-size=4096 /tmp/ai-texas-5h-residency-build/baseline.mjs /tmp/ai-texas-5g-storage-fresh1000 /tmp/baseline1000.json baseline
node --expose-gc --max-old-space-size=4096 /tmp/ai-texas-5h-residency-build/candidate.mjs /tmp/ai-texas-5g-storage-fresh1000 /tmp/candidate1000.json candidate
```

The first diagnostic attempted a previously compacted scratch clone whose original disk-index file no longer described its mutated rows (882 indexed files absent). It failed readiness and is preserved in `baseline1000.log`; no measurements from that failure are used. The successful rerun uses an intact frozen fixture through a read-only overlay (`baseline1000-rerun.log`).

## Executed matched results

Decimal MB, retained JavaScript heap after diagnostic GC. All four full audits passed and exact receipts (revision, hand count, wallet, canonical checksum/currentness) agreed between builds. Each original expanded snapshot was reachable before baseline audits and unreachable before candidate audits. The ledger hash also matched before and after each audit.

| Saved hands | Audit-start heap before / after | Audit-return heap before / after | After-audit heap before / after |
|---|---:|---:|---:|
| 1,000 | 74.03 / 19.00 MB | 128.57 / 74.69 MB | 73.47 / 19.59 MB |
| 10,000 | 638.26 / 48.50 MB | 1236.41 / 642.56 MB | 646.71 / 52.86 MB |

At 10,000 hands the simultaneous-audit return heap fell from 1,236.41 MB to 642.56 MB; this is a specific avoided duplicate graph, not a claim that total browser memory is below that value. Resident heap before audit fell from 638.26 MB to 48.50 MB. Full archive materialization still requires substantial memory and CPU, and physical-device limits remain unverified. Raw per-stage samples, timing observations and the exact source hashes are in `evidence/summary.json`, `baseline*.json`, `candidate*.json`, and `retention-source.json`. Recorded timings include diagnostic GC and concurrent test load and must not be quoted as a matched user-facing latency benchmark.

This patch does **not** attribute or claim to fix the historical 10.07-second ordinary bot-preparation outlier. It fixes the separately reproduced full-history-to-explicit-audit residency problem.

All original fine-grained timing samples are preserved losslessly as `*-timings.json.gz` with an uncompressed SHA-256 and count in each small report. Reports show exact aggregate counts/totals/extremes and the bounded phase samples; no recorded sample was discarded.
