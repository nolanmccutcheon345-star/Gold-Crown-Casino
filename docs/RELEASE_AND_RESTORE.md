# Exact candidate, restoration and release safety

Production Version 7, the public R1 test origin and original private Version 12 origin are separate environments. This CI workflow does not publish any of them. An Actions success is one piece of evidence, not R1 release approval.

## Identify source and compiled bytes

Record the actual repository HEAD/tree, clean status, Node/npm versions, lockfile hash, compiled-file hashes, provider run URL/job results/artifact identifiers and original acceptance mapping. `scripts/step5d-ci-runner.mjs` writes this source/build receipt; its `providerClaim` field requires independent comparison with actual GitHub results. Browser mode rejects a different commit, changed assets or failed upstream receipt and consumes the compiled artifact without rebuilding it.

The preserved Step 5L baseline is saved main Site Version 17, source `831e9a67658766ca8bcec02fbc0a82a0eb27c4da`. Its source tree equals reviewed `4849f92f2e426cf12bc8de7a1dbbc17139e3aaa8`. The public R1 package remains `566f3b11032841c492e6e148bb9a1139e74247b7`, identifying application `3ecea1c2b71c8e8b9963547da676171f91f21716`. That original application Git object was not recovered. Production source and compiled assets were reconstructed and matched independently; do not manufacture the missing commit or claim its original QA files exist.

Use `STEP5L_REPORT.md`, its exact receipts and the independent backup guide for the original source recovery. A new GitHub import must retain actual available history required by frozen-policy, rollback and evidence tests. Do not use shallow history or recreate historical commit identities. `tests/step5f-ci/source-preflight.mjs` verifies genuine preserved object packs and rejects missing ancestors.

## Verify a fresh clone

Use the exact private repository URL returned by GitHub, never a guessed owner. Clone with complete history, check the intended full SHA, run source-preflight, `npm ci`, typecheck/lint, critical and oracle modes, then build. Compare the three compiled asset hashes with the qualified receipt. Preserve the actual clone/build output. A source copy, Git bundle verification or workflow definition does not prove a GitHub clone occurred.

Do not discard historical evidence merely because it is large. Current tests and original-ID evidence mapping depend on preserved fixtures, source-object parts and audit records. New generated run output is ignored by default. Keep any omitted archival bytes in verified independent backups and explicitly repair/verifiably resolve their references before making a smaller import; never mark missing evidence PASS.

## Upgrade and rollback

Before an authorized production upgrade, run the exact candidate against backed-up representative populated saves in the isolated test origin. Verify pre-upgrade snapshots, repeated/interrupted migration, current-wallet/ledger validation, interrupted settlement and two-tab rejection. Preserve current and previous schema versions, policy versions and canonical histories. Never experiment on a production user's save to establish these results.

The preserved tested procedures are in `tests/step5c-rollback/` and later recovery evidence. Code rollback and data rollback are distinct. Redeploying Version 7 alone is not a valid recovery path for an unfamiliar newer save. Use the verified V7-R controlled restoration path and its compatible snapshot requirements; if integrity or compatibility fails, keep the application in a non-destructive repair state.

A release operator must record the old saved Site version and archive hash, exact new source/build, upgrade checks, rollback trigger and restoration steps. First qualify the R1 test Site only. Publish production only after all mandatory gates genuinely pass and the owner gives final production authorization. Then verify guest gameplay and save safety on the actual HTTPS build and retain the native deployment receipt. No action in this document itself authorizes publication.
