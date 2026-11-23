# Step 5N independent regression and import screening

**PASS for the executed local checks; not R1 certification or hosted CI.**

The untouched release runner executed against exact source `831e9a67658766ca8bcec02fbc0a82a0eb27c4da` in a fresh isolated Git worktree. Installed locked dependencies were shared; this was not a fresh GitHub clone/install. The execution used pinned PokerKit **0.7.7**. No source inputs were dirty or changed while running.

```sh
ORACLE_PYTHON=/tmp/ai-texas-step5l-oracle/bin/python \
  node scripts/step5d-ci-runner.mjs release test-results/step5n-release
python tests/step5l-regression/verify-emitted-hands.py \
  test-results/step5n-release test-results/step5n-release/independent-hand-replay.json
```

Results: **2,115/2,115 cases PASS in 225 files, zero failed or skipped**; 29 runner-contract checks, original 302/86 specification integrity, registry consistency, typecheck, full lint, separate paired-reference 1/1 and production build passed. The increase from the prior 2,114 is the already committed Step 5L repeated stack-target test, not a new fabricated count. Eight oracle-related cases are included in the 2,115 total. The existing 20,000-hand accounting batch was enabled.

Independent Python integer replay imports no application code and rechecked **7,136 emitted hands / 118,246 events**, including 4,660 refund hands, 91 split hands and one side-pot hand. All six intentionally corrupted records were rejected. These are the existing reference/composition/ecology run records, not another 7,136 played hands. Independent PokerKit comparisons cover betting/rank/settlement semantics separately.

The fresh build matches all three compiled candidate asset hashes and all **142 production files** in the surviving original `3ecea1c2...` execution receipt. That equivalence does not recover or manufacture the original Git object. Source/build agreement is in `evidence/runtime-agreement.json`; exact case names, command lines, timestamps and hashes are in `evidence/manifest.json`.

All 132 generated release output files are preserved losslessly in `evidence/release-evidence.zip` (18,034,890 bytes, SHA-256 `149ba056ca242f717f0191983025e7313af8787b6f9fc312b236cb0cc9756e65`). The original uncompressed output is 60,421,804 bytes. Every ZIP member was read back and checked against `evidence/archive-manifest.json`; original internal output paths remain unchanged. Unzip into a new directory to inspect complete raw records and logs. No existing evidence was overwritten.

## Security and repository footprint boundary

Byte-pattern screening examined all **8,640 tracked files / 2,952,912,371 logical bytes** and found no matching GitHub/OpenAI/AWS token formats, private-key headers, long authorization/token fields or credentialed URLs. No possible secret values were emitted. `audit-tracked.py` retains the patterns and a bounded-memory scanner; 13 positive, negative and cross-read-boundary controls passed. This is screening, not proof that secrets are absent. The archived compressed internals and complete historical Git objects have **not** received equivalent content review and must not be declared cleared by this result.

Sensitive-looking filenames were inspected as test/profiling metadata: the early `live-bankroll.json` is a synthetic browser-test balance triplet, not a private-user save. Current runtime uses browser-origin IndexedDB, a per-database writer lease and public redacted study-only history. The UI explicitly identifies virtual chips. Actual candidate/production-origin verification remains the root browser lane's evidence.

Checkout bytes are not wire/storage measurements: unique raw Git-blob payload is **2,763,541,080 bytes**; exact duplicate logical payload is **189,371,291 bytes**, already deduplicated by Git. Large historical F10 outputs often share size but differ in provenance bytes, so replacing them with one run would falsify evidence. Heap snapshots, CPU profiles and diagnostic archives should remain in their verified independent backup until content-audited; any lean GitHub import must also preserve the dependency closure for required fixtures and historical provenance verifiers. No files were removed or altered for size.

This lane changes no production rules, bot policies, money movement, storage or interface, no acceptance statuses, and no deployment/access settings. Physical-device, actual screen-reader, independent-human, GitHub CI and browser-performance gates remain separately evidence-bound.
