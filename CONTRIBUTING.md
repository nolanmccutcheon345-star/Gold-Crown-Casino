# Contributing

Read `AGENTS.md`, `ARCHITECTURE_CONTRACT.md`, the governing V7 records under `docs/specs`, and the current `R1_DASHBOARD.md` before changing code. V7 governs the product and its Acceleration Addendum governs execution. Earlier version archives do not override the governing specification.

Use a scoped branch or isolated worktree. One integrator owns shared engine, financial and persistence contracts; do not edit those concurrently. Preserve all 302 original requirement IDs/wording and all 86 deferred-feature IDs. Keep runtime changes tied to a reproduced defect and appropriate independent fixtures. New tests must exercise behavior, not merely duplicate implementation.

Install locked dependencies with Node 24 and `npm ci`; Python 3.12 plus `python -m pip install -r tests/oracle/requirements.txt` is required for the independent PokerKit lane. Run:

```sh
npm run typecheck
npm run lint
node --test tests/step5f-ci/workflow.test.mjs tests/step5n-ci/workflow.test.mjs
node scripts/step5d-ci-runner.mjs critical test-results/my-critical
node scripts/step5d-ci-runner.mjs oracle test-results/my-oracle
```

Use a new evidence directory for every run. The runner fails if source inputs are dirty or change during execution: commit proposed code first, then run qualification. Oracle Python can be selected with `ORACLE_PYTHON`. On a compatible browser runner, install Chromium with `npx playwright install --with-deps chromium`, then run browser mode with the successful same-commit critical manifest. Managed ChatGPT Sites interactive testing uses the supported cloud browser; do not replace an unavailable preview capability with an unapproved browser-control method.

Push/PR CI runs critical, oracle and compiled-browser checks. Full high-volume tests and final release refusal are manually dispatched with `release_candidate=true`; the 10,000-hand resource workflow is a separate explicit run. A failed or unexecuted check remains failed or unexecuted. Do not count a local test as hosted Actions evidence, an emulated browser as a physical device, DOM assertions as VoiceOver, or synthetic hands as independent participants.

Keep source receipts, hashes and necessary deterministic fixtures. New logs/artifacts belong under ignored `test-results/` until the integrator maps and deliberately preserves the needed evidence. Never amend a historical test receipt or alter an old hand/policy version to fit a newer outcome. See `SECURITY.md` before sharing diagnostics and `LICENSE_DECISION.md` before external redistribution.
