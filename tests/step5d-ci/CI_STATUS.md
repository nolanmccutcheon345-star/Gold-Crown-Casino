# Step 5D — hosted CI dependency and executable release checks

**V522 remains NOT_EXECUTED / partial. No hosted workflow was executed.** This lane does not modify original criterion wording/status or deploy the Site.

Original V522: “Every required critical test has runnable command/fixture plus build+seed+evidence; CI blocks errors; canonical V5 document is authority; V4 archive cannot override it.” The original wording is retained; governing V7 supersedes the earlier specification while preserving the execution/provenance obligation.

## Exact infrastructure dependency

The existing checkout has no configured Git remote. The project is the existing Sites project `appgprj_6ae62e96ac688191bffc3c629e66a5b0`; its source push/save is handled by the Sites integration. A read-only connected GitHub search for exact `ai-texas-hold-em` completed both returned pages with zero matches. No GitHub `owner/repository`, Actions installation, existing workflow run, hosted runner or hosted CI dispatch target was identified. See [actual connector evidence](evidence/hosted-dependency.json). This does not prove that no differently named or unconnected repository exists.

A GitHub workflow file in this Sites repository does not execute itself. To run it remotely, an explicitly selected, authorized GitHub repository must contain this exact source and have GitHub Actions enabled with an available runner, or the source host must provide an equivalent CI runner integration. No account, repository, mirror, permission expansion or secret was created. No other project was accessed. Repository identification/connection and the first actual provider run are still required. Provider environment values in a receipt are marked as unverified claims until matched to an actual service run and downloaded artifact.

## Implemented

- Existing `.github/workflows/verify.yml` now runs ordinary critical tests, typecheck, lint, specification/registry checks and build on push and pull request. Independent PokerKit checks run in their own job.
- Manual release qualification additionally enables the existing 20,000-hand accounting batch, full 800-hand ecology suite, 4,032-hand six-cell reference matrix and a separate1,344-hand paired rake/depth reference run. The paired flag selects only the two paired cells, so it is never enabled on the main full suite. Its one repeated executable test and hand counts are recorded separately; no acceptance-count inflation. Ordinary runs explicitly exclude the conditional oracle/accounting files instead of reporting their skipped cases as PASS. Policy/seed semantics and all existing assertions are retained.
- The browser job downloads the ordinary job's exact compiled artifact. It checks source commit and every generated asset hash before and after actual Playwright execution and never rebuilds that artifact. Its output directory cannot clear its upstream receipt. Existing authored Playwright tests now use current setup/export controls and the required rights → preview → select → confirm import workflow; semantic assertions remain.
- The release-decision job downloads the release and browser artifacts and checks their source and compiled-byte agreement. It invokes the Step5D qualified-evidence auditor and the original-ID release gate. Missing evidence, missing integration, stale/different source, changed/extra/missing build assets, failed command or unresolved mandatory criteria fail closed. The qualified auditor is supplied by the independent gate lane; its complete candidate execution remains an integration task.
- Logs, per-case test outcomes, source/test hashes, build hashes, source/tree commits, environment, provider claims and generated fixture results are retained. Both successful and failed job evidence uploads use `always()`. No deployment action is present and no production credential is used.
- Local and hosted invocations use the same portable runner, with no managed-Work absolute build-helper dependency. Hosted checkouts use normal `npm ci` and `npm run build`.

## Actual local execution

| Check | Result | Evidence / boundary |
|---|---|---|
| Portable ordinary-check runner at `bfd5b9d` | PASS: 1,357/1,357 Vitest tests, 149 files, zero failures/skips | [Receipt](evidence/critical-local/manifest.json); excludes the separately gated oracle and high-volume accounting files. This is a baseline runtime validation, not a test of future recovery changes. |
| Same run: specification, generated registry, typecheck, lint, build | PASS | Same receipt and individual logs. |
| Initial CI contract suite within that run | 14/14 PASS | [Initial contract output](evidence/contract-tests.tap). |
| Final CI provenance/plan contract suite | 19/19 PASS | [Final contract output](evidence/contract-tests-source-boundary.tap); includes wrong-commit, modified/missing/extra assets, dirty or missing exact-source proof, deleted/new inputs, failed/missing browser execution and fail-closed command wiring. Counts overlap the initial14 and must not be added. |
| Final workflow YAML and explicit structural assertions | 8 checks PASS | [Parser evidence](evidence/workflow-structure-final.json); PyYAML parsing/explicit invariants, not complete actionlint or GitHub service validation. |
| Real original-ID release check | Expected exit1: NOT READY, 11 mandatory gates unresolved | [Actual refusal](evidence/release-refusal.json). |
| Hosted CI / authored Playwright browser job | NOT_EXECUTED | No connected target; managed browser policy permits root's CUA checks, not a local browser CLI workaround. |
| Full qualified-evidence release-decision job | NOT_EXECUTED in this lane | Must execute after the gate auditor and final recovery candidate are integrated. Missing auditor cannot yield PASS. |

The final CI changes only extend qualification checks; the large ordinary suite was not unnecessarily repeated after those runner-only refinements. Root must run the integrated candidate's final release suite and actual browser tests. The 1,357 automated cases do not represent 1,357 V7 acceptance requirements. All302 original IDs and86 deferred features remain unchanged by this lane.

## Commands after integration

```sh
node scripts/step5d-ci-runner.mjs critical TEST_EVIDENCE/step5d/critical-candidate
ORACLE_PYTHON=python node scripts/step5d-ci-runner.mjs oracle TEST_EVIDENCE/step5d/oracle-candidate
ORACLE_PYTHON=python node scripts/step5d-ci-runner.mjs release TEST_EVIDENCE/step5d/full-candidate
```

Each output directory must be new; existing manifests are never overwritten. Browser mode is intended for an authorized hosted runner. In the current managed Sites environment, root records real CUA browser evidence separately. The hosted workflow's final gate intentionally fails until qualified per-ID evidence and every mandatory gate are satisfied. Saving or building a Sites version does not substitute for an executed hosted CI gate.

Implementation reference: official [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data) and [workflow contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts), read November1,2026. These support artifact transfer and run-context recording, not a claim that this project's workflow ran remotely.

Release-mode refinement: current F10 independent oracle review is included in the oracle job and excluded from ordinary suites to avoid skipped-test inflation. Fresh F10 and review outputs use separate run directories. The frozen F10 compressed reference input, populated-v3 JSON and both test protocols are captured in source hashes. The earlier1,357-case baseline predates these new gate tests; it is not relabeled as a final integrated execution. Updated runner contracts pass22/22 ([evidence](evidence/contract-tests-release-reference.tap)); no full suite was rerun in this lane for this refinement. Root runs the integrated release suite after profiling.

Generated-report qualification refinement: release receipts now hash the actual main/paired reference, composition and ecology JSON files and retain each file’s own sourceCommit/full/count fields. Release mode explicitly enables the960-hand composition matrix; ordinary mode remains small. F01/R03 outputs use `STEP5D_GATES_EVIDENCE_DIR`; the qualitative source fixture is included in input hashes. Paired cases retain their separate supporting-suite receipt. Contract checks24/24PASS ([evidence](evidence/contract-tests-generated-reports.tap)); no synthetic result or full flag is manufactured from a filename. This refinement was authored in the isolated lane during root’s existing run and was not applied to that running checkout. Root decides whether to execute the integrated refinement separately.

Supplemental composition mode executes the two existing composition cases with full960-hand workload and no engine-suite/reference rerun or rebuild. It requires the prior successful full-suite receipt and checks all current runtime inputs plus every compiled byte against that receipt before and after testing. Its own source/test/result hashes and `qualificationBase` remain explicit. It does not rewrite earlier receipts or claim that a new build ran. Contract checks26/26PASS ([evidence](evidence/contract-tests-composition-supplement.tap)); root executes the actual supplemental mode after integrating this change.

```sh
node scripts/step5d-ci-runner.mjs composition TEST_EVIDENCE/step5d/composition-supplement TEST_EVIDENCE/step5d/EXACT-PRIOR-RUN/manifest.json
```

Replace the illustrative prior path with the actual successful full-suite manifest. Missing, dirty, mismatched or altered source/artifact provenance refuses the supplemental run.

Supplemental `probes` mode selects only the existing fixed-exploit test with `STEP4B_EVALUATE=1` and32 repetitions (3,072 complete heads-up hands), retaining two unrelated deselected cases as skipped, never PASS. It uses the same exact prior-build/runtime comparison as composition mode. Raw report bytes and historical comparison labels remain untouched. A hashed execution-provenance sidecar records the actual source, actual trace policy versions, count fields and raw-report SHA256; a candidate policy mismatch fails closed. This is synthetic evidence, not solver or human calibration. Contracts28/28PASS ([evidence](evidence/contract-tests-probe-supplement.tap)); root performs the actual high-volume supplement after integration.

```sh
node scripts/step5d-ci-runner.mjs probes TEST_EVIDENCE/step5d/probes-supplement TEST_EVIDENCE/step5d/EXACT-PRIOR-RUN/manifest.json
```
