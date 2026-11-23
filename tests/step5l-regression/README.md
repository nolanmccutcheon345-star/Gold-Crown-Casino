# Step 5L fresh release regression

**PASS for the executed local regression; not R1 release approval.** The actual tested source is `791cb3ed52294c725d79eeb39ccb51161c1317ea`, a test-only successor to recovered runtime checkpoint `c9a4c11fe32c18cecda68eb2a0bfcc97b09b8879`. All 142 production source files and the three freshly compiled release assets match the original tested application bytes associated with `3ecea1c2b71c8e8b9963547da676171f91f21716`. This does not recover or invent that original Git commit.

## Demonstrated test defect repaired

The saved Version 15 dependency-status test expected an older dashboard snapshot `229/237` and source `37aa225...`, while the canonical register and generated dashboard correctly retained the subsequent `170/237` source-bound snapshot. The unchanged test reproduced **4 PASS / 1 FAIL**, retained under `first-failure/`.

The test now independently parses the canonical original-ID register, selects its 237 mandatory rows, counts qualified rows, and checks the dashboard count and single recorded source against those values. It still verifies the distinct original historical `229` qualification artifact and the honest historical-vs-current wording. No acceptance criterion or status was changed. Focused rerun: **5/5 PASS**, scoped lint PASS.

## Fresh complete release execution

```sh
ORACLE_PYTHON=/tmp/ai-texas-step5l-oracle/bin/python \
  node scripts/step5d-ci-runner.mjs release TEST_EVIDENCE/step5h/step5l-release
```

The existing runner was used unchanged, with pinned PokerKit 0.7.7 installed in an isolated virtual environment. All checks passed: 29 runner contracts, original 302/86 integrity, canonical/generated registry consistency, typecheck, full lint, **2,114/2,114 automated cases in 224 files**, separate paired-reference **1/1**, and production build. Full suite: zero failed or skipped cases; eight oracle-related cases are included in that total. No hosted CI was executed.

The run included the existing 20,000-hand accounting batch, 4,032 main reference hands, 1,344 paired reference hands, 960 table-composition hands and 800 continuous ecology hands. These are workload counts, not acceptance requirements. `manifest.json` preserves all command lines, environment flags, source/test hashes, case names, results and build hashes. Dirty inputs and changed inputs were both empty.

Actual runner timestamps: 2026-11-03T01:11:31.975Z–01:17:05.619Z. The main test phase took 275,246 ms. The same host was also executing the resource stress workload and browser checks, so these durations are not isolated performance benchmarks.

## Independent event replay

`verify-emitted-hands.py` imports no application code. It uses Python integer arithmetic to replay all **7,136** emitted main/paired/composition/ecology hands, validates unique event IDs, revision order, cards, per-seat balances, refunds, rake, pot eligibility, split/odd-chip distributions, payout maps and chip conservation. The producer contracts explicitly distinguish post-blind initial stacks in reference/composition records from pre-blind starting stacks in ecology records.

Result: **7,136 hands / 118,246 events passed**, 4,660 refund hands, 91 split hands and one side-pot hand. Six independently altered records were rejected: duplicate event, incorrect ending stack, award, pot, payout map and duplicate card. This is a second calculation on existing emitted hands, not an additional 7,136 played hands. Betting legality and hand ranking are covered by the separate engine and PokerKit tests, not inferred from this financial replay.

```sh
python3 tests/step5l-regression/verify-emitted-hands.py \
  TEST_EVIDENCE/step5h/step5l-release NEW_INDEPENDENT_REPORT.json
```

## Full R21 probes

Executed the existing supplemental `probes` runner against the passing full-release receipt and unchanged build. All six fixed probe policies ran 32 repetitions across the existing matrix: **3,072 hands / 12,357 legal decisions / 96 result rows**. One selected test passed; the two unrelated benchmark cases were deliberately unselected and remain SKIP, never PASS.

The unchanged independent reviewer checked 96 retained detailed example hands, exact outcome summaries and 148 runtime input hashes, with zero financial failures. Results remain synthetic, not human calibration or proof of strategically optimal play. The historical 0/30 and rare stall findings are not relabeled as fixed by this run.

## Applied-policy/rules provenance rerun

Executed the original observer setup/configuration over 47 unchanged assertion files selected from fresh passing cases and the existing criterion categories. Selection artifacts are explicitly `SELECTION_ONLY_NOT_QUALIFIED`; they do not claim acceptance PASS. `RUN_ACCOUNTING_BATCH=1` preserved full selected accounting scope.

Result: **577/577 PASS, zero failures/skips, 577 per-case metadata files**. Observation and candidate source both identify `791cb3e...`; all 148 runtime inputs match. This is a new observational rerun and is not attached retroactively to an older execution. The acceptance lane must review which original criteria those actual applied profiles/rules support.

Observer timestamps: 2026-11-03T01:19:55.481471Z–01:21:03.440516Z, two workers. The 577 cases overlap the full suite and are not added to its distinct case count.

## Evidence

- `TEST_EVIDENCE/step5h/step5l-release/`: complete fresh execution, case outputs and independent replay.
- `TEST_EVIDENCE/step5h/step5l-probes/`: full probe receipt, raw results and independent review.
- `tests/step5l-regression/evidence/observer/`: actual applied-profile/rules observations and original assertions.
- `summary.json`: source identities, counts, limitations and receipt hashes.
- `first-failure/` and `focused/`: retained demonstrated stale-test failure and repair verification.

No engine, bot policy, ledger, storage, application UI, access setting or deployment changed in this regression lane. Physical iPhone, actual VoiceOver, independent human testers and hosted CI remain separate requirements.
