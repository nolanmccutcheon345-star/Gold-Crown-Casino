# Real release-scope boundary verification

Executed 2026-11-01 against the integrated existing project at
`/workspace/sites/ai-texas-hold-em`, including root guard wiring `f4bb3bb`.
The isolated engine worktree contains the new test and raw result; no production
user database or live site was touched. The root source HEAD at verification
completion was `e755b45465e9b7a272ca2dcc11e254f72c97d319`.

## Executed evidence

```text
npm test -- tests/step5b-engine/release-scope-integration.test.ts --reporter=json --outputFile=/workspace/sites/ai-texas-step5b-engine/tests/step5b-engine/scope-integration-result.json
50 passed / 0 failed / 0 skipped; process exit 0
Vitest test-file duration: 338.693 ms (not a gameplay performance measurement)

npm run typecheck
process exit 0

npx eslint tests/step5b-engine/release-scope-integration.test.ts
process exit 0

node scripts/check-spec-integrity.mjs
PASS: original governing hashes unchanged, 302 unique requirements and 86 deferred features
```

Raw executable assertions and per-test results are in
`release-scope-integration.test.ts` and `scope-integration-result.json`.

## Boundary coverage

The tests submit eleven routes: run it twice, bomb pots, alternative poker games,
tournaments, multiplayer, table chat, dealer errors, real-time assistance,
multiple boards, nested feature flags, and unknown experimental variants.
For each route, the real public engine initializer rejects before secure-card
entropy is requested; settings normalization rejects before opponent identities
are sampled; and `SessionController.startSession` preserves the wallet, ledger,
session list and durable snapshot without a new buy-in or write. A subsequent
ordinary session starts successfully.

Both external full audit and branded incremental audit independently reject the
same attempted routes in active engine profiles and saved session settings.
Rejected candidates gain no verified-snapshot capability. Original committed
cards, deck, wallet, ledger and persisted bytes remain identical. Ordinary
checkpoint transitions continue to pass both incremental and full audit.

Queued configuration and named-preset attempts are exercised through the actual
controller while a real bot decision is pending. Every rejected request preserves
the complete snapshot, pending decision and durable-write count. Explicitly off
legacy flags remain accepted through the engine, controller and full validator.

Four populated schema-3 fixtures (preflop, flop, turn, river), each containing
three completed hands, restore with the original `synthetic-phase0-0.1.0` pending
policy. The restored pending decision commits exactly one engine action. Earlier
hand hashes, ledger hashes and private policy bytes remain unchanged, and wallet,
table and completed-hand accounting pass afterward.

No engine, policy, configuration or integrity module is mocked. A copying CAS
memory port isolates persistence from real user data; secure random dealing and
the actual controller/engine/policy implementations execute normally. A spy is
used only to assert that rejected engine initialization requests no entropy.

## Acceptance mapping and limits

This supports the authority and persistence portions of **X15, V521 and V615**.
It does not by itself assert whole-requirement PASS or browser visibility. The
parent integrator owns the real browser disabled-control/URL/storage tests and
the acceptance tracker. It adds 50 automated cases, not 50 original V7
requirements. No physical-device, expert-calibration or production-rollback
claim is made. Z03 remains subject to the previously documented actual-deployment
rollback gap.
