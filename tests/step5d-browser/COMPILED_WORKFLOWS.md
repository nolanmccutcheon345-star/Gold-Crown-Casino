# Exact compiled candidate browser qualification

This page is authored QA, **not an executed browser PASS**. It must run against the final candidate. No production source is changed by this harness.

1. Run the candidate's required typecheck, lint, build, tests and release checks; retain its actual successful execution receipt with `sourceCommit`, `buildHashes`, and `status: PASS`.
2. From the repository root run `node tests/step5d-browser/prepare-compiled.mjs TEST_EVIDENCE/step5d/<actual-run>/manifest.json`. The script rejects changed or unmatched build bytes. Fixtures are ignored and reproducible; retain the generated manifest with the browser receipt.
3. Serve the repository with its existing Vite QA server (`npm run dev -- --port 5173`). Open `/tests/browser/step5d-compiled.html` through the authorized browser. Choose a width and click **Run 2–10 compiled cash workflows**.
4. Preserve `#qa-status`, all chunks from `#qa-evidence`, screenshots, and the hash proof in the application iframe. Repeat at desktop/mobile widths as required. A run executes nine actual hands, one for each occupied count 2–10. It does not itself prove every physical-device requirement.
5. Separately open the linked `/tests/browser/step5c-rollback.html` and run its populated native migration/rollback fixture. That harness uses its pinned V7/V7-R compatibility bundles and current candidate modules; its result is separate from this exact-compiled workflow.

The page verifies every exact production JS/CSS byte against the build receipt, then executes these bytes using typed Blob URLs (Vite cannot instrument `.bin` copies). The original application entry mounts its own UI/controller. Only the default application IndexedDB name is redirected to a unique `ai-texas-step5d-compiled-...` QA database. All application mutations use actual DOM controls; the QA verifier imports current source only to read and independently validate stored manifests, public exports and full-replay statistics. No controller mutation APIs are invoked by the QA verifier. Keep verifier source pinned to the same candidate while testing. The QA database remains available for reload evidence and never opens the production guest database.

Executed checks, only after a successful run:

- Guest startup and manual bankroll adjustment excluded from poker winnings.
- Preset save/clone/update/load preserves the original and financial history.
- All 2–10 occupied seats, Hero at bottom, perimeter bounds, non-overlap, hidden opponent cards, dealer/blind association; low/mid/high/neutral population presets, randomized lineup, custom settings, unknown profile, all eight initial archetypes.
- Actual complete hands, exact one settlement per hand and one cashout per ended session, conserved Hero wallet/table ledger, payout/pot agreement and policy versions.
- `pending`: B12 rapid double Call commits once; B13 all Hero action buttons disabled during an unpaused opponent turn; actual document reload preserves committed pending state.
- `jam`: B12 rapid double Jam commits once, with independent financial reconciliation.
- Completed hands remain stopped for 1,100 ms without an explicit new-hand action (U06 component); payout reload; top-up; safe session ending and new sessions preserve earlier records.
- History exported JSON payload equals the download Blob; schema, redaction, provenance and all permitted canonical replay frames match. Replay starts with hidden opponent cards and reaches settlement. Study import does not mutate financial/canonical history. This proves payload availability, **not a physical iOS share/download**.
- Statistics count and BB/100 match full replay; M06 small-sample/uncertainty and no-real-world-profit disclosures; M08 local hidden-card inspectability disclosure.

V510 scope: public replay and export are tested. There is no developer full-state diagnostics control in the ordinary application UI; do not claim an unimplemented diagnostics feature was tested. Physical iPhone export remains **AWAITING USER VERIFICATION**. Timing deadlines prevent a hanging test; they are not performance targets or substituted PASS results.

Receipts are `{status, run, width, browser, reports[]}`. Each command has `name`, `status`, `result`, and visible-control `trace`. Failures retain all preceding records and the actual error. The final PASS additionally requires nine hands, nine settlements, nine cashouts and no active session. Authored typecheck/scoped lint logs are separate from browser evidence.

The `notes` command writes a user-authored public observation through the actual player-note editor, verifies its durable saved text and unchanged financial/game digest, and all later actual reload checks compare its digest. Public history export must exclude that private manual note. This adds notes persistence to the same compiled workflow without exposing bot-private information.

## Additional active post-bot recovery and high-stakes source checks

`postbot` runs after the initial pending-decision reload. It resumes the actual compiled application at its supported1,800ms pace, matches the reserved decision ID to exactly one new committed opponent action, and pauses while the same hand remains active. A hand that already settled is an explicit scenario failure. The parent performs another real document reload and requires equality of the full financial/active digest plus explicit game, remaining-deck and private-hole-card hashes, stacks/commitments, frozen rule version and policy versions. No hidden card values are emitted. Normal play then completes the same hand; it does not add a fixture hand to the nine actual-hand count.

`high-stakes-disclosure` is an unstarted R22 setup inspection. It configures custom$50/$100 and$10,000 buy-in, checks synthetic/not-measured population disclosure and DESIGNED source labels, opens bounded editable personality controls, and confirms stake changes do not silently change selected opponent style/skill priors. It checks practice-rake provenance and unchanged wallet/session/history, then restores$1/$2 setup before normal gameplay. This proves the stated synthetic design scope; it does not claim measured population frequencies, venue calibration or a played high-stakes hand. The original successful390px nine-hand receipt remains a separate earlier execution.
