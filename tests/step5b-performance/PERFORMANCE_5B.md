# Step5B measured performance and immutable-storage evidence

The repeat-history bottleneck was confirmed in actual V8 CPU profiles and production controller calls. Every bot preparation previously performed two full state clones, two full canonical integrity replays, two retry-buffer clones and, in browser storage, two complete snapshot hashes/copies/writes. Those costs scaled with all saved frames, not the current decision. Bot policy evaluation itself was small in the preflop reference workload.

## Final paired Node reference

Source checkpoint: `c977e3c48e51dd153990c34939807488f338030a`; exact source-file SHA256 values and active-snapshot SHA256 per cell are in [latencies.json](evidence/final-paired/latencies.json). Each cell feeds the **same canonical active policy1.3 snapshot** to frozen Step5A9d937a3 and the candidate with final storage validation fixes. The 25 genuine completed mixed-action hands are repeated with unique hand/event identities; histories retain complete frames and each hand has independently reconciled funding/cashout. Current seats are2/6/10; historical hands are six-max. Fresh private draw tokens remain stochastic. No artificial think delay is included.

Node reference CAS port deliberately excludes serialization. Browser measurements must be reported separately. Nearest-rank p95/p99 with fewer than20samples are observed extrema, not reliable population-tail estimates. The5000-hand cells have **one sample each**. Shared container CPU may contain other work.

| Saved hands | Current seats | Samples per runtime | Baseline p50/p95/p99/max ms | Candidate p50/p95/p99/max ms |
|---:|---:|---:|---|---|
|0|2|20|0.96/2.24/5.30/5.30|0.54/1.06/5.61/5.61|
|0|6|20|0.81/1.39/1.48/1.48|0.50/0.94/1.20/1.20|
|0|10|20|1.00/1.53/2.61/2.61|0.60/0.89/1.00/1.00|
|100|2|20|245.42/276.11/285.79/285.79|0.87/1.54/3.49/3.49|
|100|6|20|241.42/258.40/258.75/258.75|0.83/1.04/2.81/2.81|
|100|10|20|234.77/257.38/257.96/257.96|0.80/1.03/1.06/1.06|
|500|2|5|1249.58/1281.23/1281.23/1281.23|1.18/1.58/1.58/1.58|
|500|6|5|1233.81/1263.99/1263.99/1263.99|1.49/1.54/1.54/1.54|
|500|10|5|1254.80/1301.42/1301.42/1301.42|2.07/3.60/3.60/3.60|
|1000|2|3|2637.67/2653.03/2653.03/2653.03|1.81/2.05/2.05/2.05|
|1000|6|3|2604.27/2713.27/2713.27/2713.27|2.16/3.09/3.09/3.09|
|1000|10|3|2638.20/2811.76/2811.76/2811.76|2.03/2.03/2.03/2.03|
|5000|2|1|15235.95/15235.95/15235.95/15235.95|7.47/7.47/7.47/7.47|
|5000|6|1|18299.90/18299.90/18299.90/18299.90|8.37/8.37/8.37/8.37|
|5000|10|1|14891.28/14891.28/14891.28/14891.28|8.05/8.05/8.05/8.05|

All15measured preparation cells were below250ms after optimization. This is not a blanket mobile/device guarantee. At100hands/sixseats,20samples measured p95 **258.40→1.04ms** in the Node reference. The original pre-edit V8 profile is preserved at [baseline.cpuprofile](evidence/baseline/baseline.cpuprofile); the final paired production profile is [final-paired.cpuprofile](evidence/final-paired/final-paired.cpuprofile). CPU profiles include fixture creation and cold audits as explicitly marked; aggregate CPU percentages must not be mistaken for per-decision percentages.

## Separate costs that are deliberately retained

| Saved hands | JSON bytes | Full audit p50 ms | Full clone ms | JSON serialize ms | Full snapshot digest ms | Full reference statistics p50 ms |
|---:|---:|---:|---:|---:|---:|---:|
|0|510|0.29|0.05|0.02|0.43|0.04|
|100|3016430|64.22|21.77|8.90|76.98|3.30|
|500|15169475|328.17|134.22|50.33|349.60|12.76|
|1000|30361655|640.49|266.94|112.41|744.68|26.16|
|5000|152702176|3426.55|1713.06|624.02|3660.00|391.97|

Full canonical audit remains mandatory at load/migration/import/takeover/retry. Large cold recovery remains proportional to total history bytes; a152.7MB canonical fixture is **not** an instantaneous recovery guarantee. No claim of physical-device5k-history support is made. New hot paths retain shallow prefix/session metadata comparisons; thousands of separate closed sessions still add small metadata overhead. They do not clone/hash/serialize prior canonical hand records on ordinary actions.

## Integrity implementation

- `storage/verified.ts`: private in-memory provenance, recursive freezing, structural sharing, exact ordered-prefix checks, new-record hashes, new ledger replay, session financial and hand-ID reconciliation, current engine/frame verification. Caller hashes or Object.isFrozen alone cannot grant trust.
- `storage/segments.ts` and `browser.ts`: version2 compact manifest with append-only canonical ledger/hand/closed-session/import segments; transactionally fenced revision and ownership; current/previous manifests; byte-exact pre-segment-v1 backup; unknown formats refuse without resets. Previous manifests remain reconstructible because closed records are never overwritten.
- Full recovery verifies every stored segment byte, ordinal, chain and tail, then canonical financial/replay constraints. Imported shelves validate each original record and replay independently because deduplicated shelves legitimately combine multiple source chains.
- Cached public opponent memory uses only the permitted projection and privately verified frozen history identity; cache invalidates on history-array identity/seat/session/retention. Imported study records and hidden cards never enter memory.
- A legacy completed-hand top-up frame is accepted only by reconstructing its exact backed ledger/engine transfer delta. Historical transfer receipts never bypass active-hand replay equality.
- Financial kinds are explicit; table-adjustment conserves wallet/table money and never credits poker P&L. Closed sessions reject subsequent nonmanual financial events. Queue identity is rechecked even if the immutable queued settings object is reused.

## Verification and uncertainty

112 focused tests across8files passed after all independent review fixes; source typecheck and lint passed. This count includes16 independent adversarial tests authored by a separate agent, not112 mapped acceptance IDs. The reviewer subsequently extended coverage to29cases and reported all29PASS in the integrated project. Initial failing evidence is retained. [Final local regression](evidence/independent-review-final.log), [transaction/recovery regression](evidence/storage-expanded-final.log).

A separate actual continuous5000-hand engine session (one buy-in, carried stacks, moved blinds, all-fold test driver) is preserved in [open-session/latencies.json](evidence/open-session/latencies.json). It uses sparse all-fold histories, not the mixed-action corpus. All12cells ran:0/100/1000/5000saved hands×2/6/10current seats. The89.6MB5000-hand ten-seat cell measured9062.81→2.82ms (one sample, earlier validated candidate checkpoint); the final paired15-cell matrix above supersedes earlier candidate-only timing for final-source claims.

Node timing is not browser responsiveness, INP, iPhone verification, strategic calibration, solver proof or release signoff. Dedicated actual-browser staging pages are `tests/browser/step5b-performance.html` and `tests/browser/step5b-recovery.html`; only root-executed browser evidence can mark those checks passed. Final-paired reference deals are preflop; cold postflop range-building cost needs its own measurement rather than being inferred from preflop policy timings. Physical iPhone export remains awaiting the user.

## Reproduce

```sh
node_modules/.bin/esbuild scripts/step5b-profile.ts --bundle --platform=node --format=esm --outfile=/tmp/step5b-profile-final.mjs
mkdir -p tests/step5b-performance/evidence/final-paired
PROFILE_PAIRED=1 PROFILE_PHASE=final-paired node --max-old-space-size=6500 --cpu-prof --cpu-prof-dir=tests/step5b-performance/evidence/final-paired --cpu-prof-name=final-paired.cpuprofile /tmp/step5b-profile-final.mjs
```

## Cold postflop range and policy measurements

The remaining range/equity component was measured separately on deterministic legal flop/turn/river contexts with120 permitted prior public histories. Each cell has30samples, unique public-event IDs force a full range-cache miss, and the older/fixed range implementations receive the same visible observation/profile. Both keep the same bounded96/72/48joint-trial budgets. The initial and corrected CPU profiles/raw p50/p95/p99/max are in `evidence/postflop-policy` and `evidence/postflop-crn`. These are Node synthetic workload measurements, not physical-phone/INP evidence.

|Seats|Street|Previous range p95ms|Corrected range p95ms|Corrected whole policy p95ms|
|---:|---|---:|---:|---:|
|2|flop|13.99|13.60|12.07|
|2|turn|12.29|13.33|15.82|
|2|river|9.18|14.35|9.55|
|6|flop|11.89|12.57|10.21|
|6|turn|12.29|21.19|12.55|
|6|river|14.55|15.87|14.40|
|10|flop|27.10|25.87|20.26|
|10|turn|24.41|30.20|31.72|
|10|river|34.66|35.96|36.44|

Public-history action projection and opportunity-counter reconstruction are also timed per cell; they are distinct from range evaluation and persistence. Cold range cost stays bounded by current players/public lines, not total saved canonical histories. The largest measured whole-policy p95 here was36.44ms at10seats/river. Timing differences under the shared host do not justify a claim of uniform speedup from the numerical fix; its purpose is stable price comparisons, with no change to trial budget.
