# Step 5N CI implementation evidence

This work changes workflow/test infrastructure and repository documentation only. It does not change production engine, bots, bankroll, storage or UI source. Hosted GitHub execution is **NOT_EXECUTED** until the actual connected provider run and artifact records prove it. The root workstream owns repository creation, authentication, hosted execution and V522 certification.

## Implemented

- Ordinary push/PR runs retain critical and independent PokerKit lanes and now execute the exact compiled-browser lane. The browser job downloads the successful same-commit build; the existing runner rejects altered or mismatched compiled assets.
- Critical/oracle Vitest concurrency is capped at two workers. The full release remains four workers, retaining every selected test and assertion. Ordinary critical excludes only the existing explicit oracle/high-volume accounting selections; those remain in their own lanes.
- All official GitHub Actions are pinned to full commits, verified against their release/commit pages on 2026-11-02 (America/Chicago). `action-pins.json` retains the exact primary-source URLs. Token permissions remain contents-read, checkout credentials are not persisted, and workflows contain no deployment or release permission.
- Browser setup covers all integer seat counts2–10 on desktop/mobile Chromium. A keyboard-only setup/complete-hand/cashout/history journey checks accessible DOM state. These are not real VoiceOver or physical-device tests.
- The separately dispatched `resource.yml` plays10,000 fresh hands, then runs independent canonical/financial replay and resource-report checks, with a180-minute cap and seven-day full evidence retention. The synthetic account is runner-temporary; logs, receipts, canonical archive and timing trace are the uploaded evidence. The harness refuses changed recorded production hashes and cannot silently carry a historical PASS to new application bytes.
- README, contributor, security, license-decision and release/restore documentation now describe the actual R1 candidate and release boundaries. No public source license has been selected. Credential/private-save patterns are ignored by default.

## Actually executed locally

| Check | Result | Evidence |
|---|---|---|
| Workflow contracts plus existing runner contracts | 49PASS,0FAIL,0SKIP | evidence/final-contracts.tap |
| Initial narrower workflow contracts | 20PASS | evidence/workflow-contracts.tap |
| TypeScript checking | PASS | evidence/final-typecheck.log |
| Complete source/test lint | PASS after fixing two regex-spacing errors in the new contract test | evidence/initial-lint.log; evidence/final-lint.log |
| Both workflow YAML parses | PASS | evidence/yaml-validation.json |
| Original specification hashes/302 IDs/86 future IDs | PASS | evidence/specification.log |
| Playwright discovery | 26 cases in3files; **not executed** | evidence/browser-enumeration.log |

Contract counts are infrastructure tests, not additional V7 acceptance IDs. The initial20 are a subset of the final49 and are not added together. No browser execution, hosted run, repository privacy, remote clone, branch protection or V522 PASS is claimed by this lane. Root records those separately.

## Import safety

The recovered checkout has8,640tracked files totaling2,952,912,371logical bytes at baseline. This includes repeated historical evidence paths; identical Git blobs are stored once. Several frozen-policy/rollback tests use actual historical Git objects, and source-preflight reconstructs authenticated originals from preserved packs and heap chunks. Omitting all evidence, shallow cloning, or creating an unrelated root commit would break those existing checks. No such shortcut is implemented.

Large evidence must not be imported unscreened. Root's source/security inventory must review compressed diagnostics and prove the dependency closure before excluding redundant archives. Keep full independent backups and manifest/hash references for any intentionally omitted artifact; do not rewrite tests or acceptance PASS to conceal a missing fixture. Existing tracked evidence is not removed by adding `.gitignore`; new routine generated runs stay under ignored `test-results` and are uploaded as CI artifacts.

## Remaining execution dependencies

The connected-account repository creation, fresh remote clone/build and real Actions run URLs remain the root integration task. This lane does not invent access permissions. Release workflow `r1-release` continues to refuse unresolved mandatory gates; a green ordinary development workflow cannot authorize production publication. Keep Version7 and private Version12 unchanged.

## Actual clean-commit ordinary-lane execution

At `5c5dfba07186678805b562c8f77e0b1e57f4019b`, the exact source-preflight and modified bounded critical runner executed locally. Source-preflight restored and validated genuine preserved original objects without changing the branch or working tree. Critical mode passed **2,105/2,105 tests in219files, zero failures or skips**, plus all runner/specification/registry/typecheck/lint/build commands. It took284.697seconds for the selected Vitest suite. These tests overlap the full release suite; do not add them to the root's full regression count.

The fresh compiled JS/CSS/HTML SHA-256 hashes exactly match the hosted candidate. See `evidence/critical-execution.json`, verbatim `evidence/critical-local/manifest.json`, `vitest.json` and logs, and `evidence/source-preflight.json`. Original receipt paths refer to ignored `test-results/step5n-critical`; relocated evidence copies are hashed in the summary. This is still **local execution**, not a GitHub-hosted run or V522 completion. The new26 browser cases remain authored/discovered, not executed by this lane.
