# Original provenance criteria audit

This audit inspects existing repository and native publication artifacts. It does not run or claim a deployment, browser smoke, remote CI job, or inspection of Poker MaxEV. The original acceptance criteria remain unchanged. Recommendations below apply to whole original requirements, not to the component observations.

| Original ID | Original acceptance criterion | Evidence present | Whole-criterion recommendation and remaining evidence |
| --- | --- | --- | --- |
| U16 | “Verified unique project ID + site URL, deployment build, original sites unchanged by all write calls” | `.openai/hosting.json` has project `appgprj_6ae62e96ac688191bffc3c629e66a5b0` in root commit `02aa774` and the current tree. Existing native publication records target that ID and the dedicated AI Texas URL. | NOT_EXECUTED. Identity/build components have evidence; the available artifacts are not a complete historical all-write audit or pre/post proof that original sites were unchanged. Do not infer the latter from the absence of a Poker MaxEV reference. |
| Z02 | “New project/site identity proven and old project unchanged; signed-off deploy SHA and actual browser smoke recorded.” | Root initialization; Version 1 native deployment record in `8cb06b1:TEST_EVIDENCE/publication.json`; Version 2 publication with exact source and actual guest smoke; subsequent exact source/version/archive/deployment artifacts through Version 7. | NOT_EXECUTED. The published source/deployment and browser components are documented for earlier versions, but the historical old-project nonmutation component is not independently established by the available local artifacts. This audit is not a new source/deploy signoff. |
| V522 | “Every required critical test has runnable command/fixture plus build+seed+evidence; CI blocks errors; canonical V5 document is authority; V4 archive cannot override it.” | `.github/workflows/verify.yml`; `scripts/r1-release-gate.mjs`; executed release-gate results and manifest in `tests/step5b-acceptance/evidence/release-gate/`. The original wording is retained; governing V7 explicitly supersedes the older authority wording. | NOT_EXECUTED. The local gate tests and refusing-release result are recorded. Remote CI execution is explicitly NOT_EXECUTED, and the complete critical-test-to-build/seed/evidence mapping is incomplete. Authored workflow configuration does not prove hosted CI ran. |
| V620 | “Every passing critical test records commit/build, engine+policy+room versions, test input/seed when applicable, actual expected/observed, runtime environment and artifact path; missing evidence blocks release.” | Prior `TEST_EVIDENCE/<timestamp>/manifest.json` files include source commits, versions, commands, environment, expected exit and observed exit plus logs. Several targeted manifests include fixture seeds/hashes; browser artifacts include real outcomes and conditions. Current source/evidence can now be byte-inventoried. | NOT_EXECUTED. No complete per-passing-critical-result coverage is established. A present-day hash inventory cannot retrospectively supply the source/build, runtime versions or input seed of an earlier run. Missing entries remain release blockers. |

Original text: `docs/specs/V7_All_302_Acceptance_Tests.txt` lines 574, 760, 1078 and 1172; governing evidence requirements: `docs/specs/V7_Master.txt` lines 835–879.

## Existing native publication chain

- Root commit `02aa774` initializes this independent project; `.openai/hosting.json` has not changed since that root commit.
- The Version 1 artifact at `8cb06b1:TEST_EVIDENCE/publication.json` records succeeded deployment `appgdep_6ae632565e848191863b3b08098d59ae` of source `5768172804606ce30a5fdd4a1ad9ad503f55067a`. Its live browser smoke is explicitly **BLOCKED_AUTO_APPROVAL**, not PASS.
- `TEST_EVIDENCE/publication.json` records Version 2 source `80c59b9aba9a5ead060c995a5be34a5e35a0e1a6`, archive hash, succeeded deployment, public audience and one completed guest hand. Linked raw public history/accounting/browser artifacts remain present.
- `TEST_EVIDENCE/step3/publication.json`, `step36/publication.json`, `step4a/publication.json`, `step4b/publication.json` and `step4c/publication.json` preserve the subsequent native version/deployment identities. They all target this project's ID.
- Version 7 records source `a0bfc0950771a6dc1b786e00c13be7f3485b8dcb`, saved version `appgver_2d9ec2edd4f48191a3860251b687e9a7`, deployment `appgdep_6ae6a07f5f488191b00077a585fd5d8a`, archive SHA-256 `89ad752544b29a557dcd5ca2550b77624e2f82f6981a12d075902d68bbb39a26` and succeeded time `2026-11-01T02:14:30.204417+00:00`.
- The Version 7 URL is `https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site/`. Actual prior published-origin smoke and accounting are documented in `TEST_EVIDENCE/step4c/BROWSER.md` and its linked raw files. This audit does not relabel those observations as tests of later Step 5B code.

All saved native records inspected point to this Site. That is narrower than proving that *all* historical write calls across every Site did so. No new access to, modification of, or connection to Poker MaxEV was performed to fill the gap.

## Final snapshot helper

Run from the final integrated source after its actual checks:

```sh
node scripts/capture-qa-provenance.mjs --output TEST_EVIDENCE/step5b/provenance/current-inventory.json
node scripts/capture-qa-provenance.mjs --check TEST_EVIDENCE/step5b/provenance/current-inventory.json
```

The inventory hashes source/test/fixture/configuration files, existing test/browser evidence, and any existing `dist` files. It records the current Git commit, tree, dirty paths, source version constants and runtime of the inventory process. The manifest excludes itself to avoid a self-reference. `--check` detects changed/missing/added bytes and rejects internally inconsistent inventories. Its PASS means only that the captured byte set agrees; it does not run tests or establish that an existing build came from that source. It deliberately does not attach current source or policy versions to earlier browser outcomes.
