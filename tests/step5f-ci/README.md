# Step 5F hosted CI and release-gate evidence

**Hosted CI is NOT_EXECUTED. No workflow run URL exists.** The GitHub connection is active, but fresh read-only discovery found no designated AI Texas Hold Em repository among the installation's four repositories. No unrelated repository content was read or modified. Sites production remains outside this workflow.

## Implemented correction

The retained workflow used shallow checkout defaults in all five jobs. Historical source qualification reads older commits with `git show`; an actual shallow-clone reproduction could not read its original assertion commit. The same full clone retained the exact bytes. GitHub's [official checkout documentation](https://github.com/actions/checkout#checkout-v4) confirms the single-commit default and full-history setting.

All jobs now fetch complete history and avoid retaining checkout credentials. A source preflight restores the exact archived original execution objects from the verified split diagnostic/source archive, validates the provider SHA when supplied, and confirms that neither branch nor working tree changes. Each job retains its own bootstrap receipt. This is necessary for the original execution IDs retained during the Step 5E artifact-size correction; it does not relabel historical evidence as a new run.

Ordinary source changes still run typecheck, lint, build, critical unit tests and an independent PokerKit lane. The high-volume suite, exact compiled-browser artifact test and fail-closed R1 decision remain explicit release checks. No deployment command or write-scoped workflow permission was added.

The new local contract tests exercise real shallow/full Git clones, missing-history refusal, mismatched provider SHA, all five job configurations, compiled artifact reuse and release conditions. Initial test-harness failures are retained: its job-name regex omitted digits and therefore missed `r1-release`; the actual workflow was present. Five initial lint errors were fixed. These diagnostic failures are not hosted run failures or application defects.

At source `26037b6ae38cfa7daf2d62960ab408ffb2728702`, the combined contract run passed **40/40** (12 new and 28 retained cases), with zero failures/skips. Scoped lint and YAML parsing passed. Actual local source preflight restored the original objects and preserved the branch/tree; the executed specification check preserved all 302 original criteria and 86 future entries. See [execution receipt](evidence/verification.json), [local bootstrap](evidence/local-source-preflight.json), [current gate audit](evidence/baseline-gates.json), and [read-only provider discovery](evidence/hosted-discovery.json). No full application suite or browser run was performed by this CI-only workstream; the integrator owns final-candidate regression.

## Exact infrastructure action needed

Designate a dedicated authorized repository for this existing Sites project—either provide its `owner/repository` URL or create a new private project repository under the connected account. Authorize a supported authenticated source-mirroring path that preserves the existing Git history and exact candidate commit; an empty repository or source ZIP by itself is not enough. Enable GitHub-hosted Actions runners and allow the connected GitHub app access to that repository. Do not supply passwords or tokens in chat and do not repurpose another poker or business repository.

Once that concrete target and push path exist:

1. Mirror the tested candidate history without rewriting its commit. Keep the Sites project and Version 7 deployment unchanged.
2. Verify the GitHub branch SHA equals the candidate SHA. Push/PR checks run the ordinary `critical` and `oracle` jobs.
3. Retain the actual provider run URL, source SHA, job IDs, check conclusions, logs and artifact IDs. Compare each receipt and compiled hash with the downloaded artifacts. Environment variables alone are not proof of hosted execution.
4. On the chosen candidate branch, manually run **Verify V7 development and R1 release gates** with `release_candidate=true`. The configured release decision is expected to fail until every mandatory criterion has actual qualifying evidence.
5. Configure required status checks for `critical` and `oracle` on the designated repository, then verify a deliberately failing disposable branch is blocked and remove that branch through the normal reversible workflow. Do not claim repository protection merely because the YAML exists.

The available connector exposes read-only workflow runs/jobs/artifacts and rerun operations, but no repository-create or new workflow-dispatch operation was advertised. No Actions permission was verified without a project target. The exact missing dependency is the project repository/runner and authorized synchronization—not generic Google sign-in or an invented CI success.

## Original gate audit

`audit-current-gates.mjs` verifies all original criterion fields and IDs against the authoritative source, preserves all 86 deferred entries, and computes the unresolved list from the actual current register. It inventories only local saved publication records for this project. It does not execute those old browser or deployment actions again.

At the Version 11 baseline, the computed unqualified R1 list is **U10, U11, U16, Z02, Z14, V518, V522, V707**: 229 of 237 critical rows currently qualified, with 221 PASS / 0 FAIL / 5 BLOCKED / 76 NOT_EXECUTED original statuses. Later production edits require new qualification; these baseline counts must not be reused automatically for the final Step 5F candidate.

U16 and Z02 still lack a complete provider-level historical project write audit. Saved publication records consistently identify this project, but they cannot prove no earlier write targeted another project. Obtain a provider-supported export covering initial creation through the candidate save, with timestamp, action, target project ID, result and source/deployment identity where applicable. The exposed worker-runtime-log capability is not an API mutation audit. Do not access or modify Poker MaxEV to manufacture retrospective evidence. Existing Version 7 publication/browser evidence is preserved separately from any future candidate release smoke.

No original requirement status was changed by this workstream. The whole V522 criterion remains incomplete until the hosted run and other required critical evidence actually exist. Local workflow tests, bootstrap success and saved unpublished versions do not authorize R1 publication.
