# U12 resource harness and V708 recovery extensions

These are isolated automated/Node checks; they do not claim rendered-browser, device or physical quota-exhaustion verification.

`quota-recovery.test.ts` invokes the actual BrowserPersistence/controller through the asynchronous serialized IndexedDB reference, injecting a `QuotaExceededError` during hand/current writes. It checks committed-only redacted export, blocked actions after failure, retry/reload, lost payout acknowledgement and competing-owner takeover. `timer-lifecycle.test.ts` drives 50 complete sessions with real controller/lease lifecycle code under fake time: one controller clock plus one lease heartbeat; all three event listeners and timers are removed on every close. Initial combined run: **6/6 PASS** (`reference-tests.log`).

`run-resource.ts` runs the full controller with current production bot policy for every opponent action. Hero uses a documented fixed test policy. Tables rotate 2/6/10 seats per 100 hands; normal bust-outs can reduce occupancy. All canonical hands and money events are retained through production segmented preparation/restoration. Checkpoints independently replay statistics, verify all financial records, measure GC-normalized memory/storage, and inspect bounded range cache sizes using read-only build-time instrumentation. Output archives contain synthetic private canonical data needed for full audit, not production user saves.

Reproduce the 10,000-hand run:

```sh
node tests/step5b-resource/build-resource.mjs
RESOURCE_HANDS=10000 RESOURCE_RUN=full node --expose-gc --max-old-space-size=6144 /tmp/step5b-resource-run.mjs > tests/step5b-resource/full.log 2>&1
```

The explicit heap limit is a Node stress-test condition, not a supported mobile-memory budget. Canonical history necessarily grows with hands; bounded storage means exactly the required append-only segments plus current/previous manifests, with no accumulating full backups. All final histories are streamed to `canonical-segments.jsonl.gz`; completed measurements belong in `evidence/full/report.json`. A partial 1,000-hand pilot was deliberately stopped before completion to switch archival to streaming and avoid artificial memory duplication; it is not a 10,000-hand PASS.

Final execution is complete. See `RESOURCE_REPORT.md` for the10,000-hand result, independent archive restoration, measured memory and recovery costs, and explicit unresolved tail/reclamation limits. The follow-up CPU/GC probe did not reproduce the original9.79second preparation outlier; it did attribute the slow full recovery to canonical serialization, deep freezing and hashing. No browser or leak-free claim is made.
