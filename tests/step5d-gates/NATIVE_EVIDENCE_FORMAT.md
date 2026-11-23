# Native browser and supplemental execution qualification

The qualifier now joins actual captured native browser workflows and separately executed supplemental suites to the original compiled release receipt. It does not execute these tests or promote canonical acceptance statuses.

For each actual completed desktop/mobile run, preserve the full original JSON capture. From the repository root:

```sh
node scripts/step5d-index-browser-evidence.mjs \
  TEST_EVIDENCE/step5d/release-repaired/manifest.json \
  TEST_EVIDENCE/step5d/browser/ACTUAL_CAPTURE.json \
  tests/browser/built-artifact/step5d/manifest.json \
  ACTUAL_40_CHARACTER_HARNESS_COMMIT \
  compiled-390 \
  TEST_EVIDENCE/step5d/browser/qualification-index.json
```

The indexer never edits the original capture. It refuses incomplete/failed runs, missing actual nine-hand/two-through-ten-seat workflow records, duplicate command IDs, changed captured bytes, different compiled assets, altered assertion-source files, or changed candidate runtime. A later QA-only harness commit is supported: each harness file and every production `src/` input is independently read from that Git object and checked against the captured source hashes and the original compiled execution. Production runtime bytes must also remain identical. This allows an honest test-harness correction without pretending the earlier test assertion bytes were executed.

Pass the resulting index to the auditor with `--browser-evidence <index>`. A qualification record's `browserCases` must select an actual execution ID, command, exact occurrence count and concrete expected/observed assertions. Overall capture PASS or a file's existence alone does not qualify an original criterion.

`cases[].suite` selects an actually recorded supporting suite such as `paired-reference`; repeated test names are never silently pooled. `reports[]` names a source-bound actual JSON result by an executed receipt field (or exact retained path/hash) and asserts concrete fields such as `full: true` and `totalHands: 4032`. A fast 42-hand run cannot qualify a required full matrix merely because its test case has the same name.

For separately executed supplemental suites, create an index containing `{id,path,sha256}` for each actual supplemental manifest and pass `--supplemental-evidence <index>`. A case/report selects it with `receipt: <id>`. The supplemental manifest must independently prove identical production source and exact compiled bytes against the successful original receipt through `qualificationBase`, with an actual passing command and its own source identity. There is no invented new build execution or inflation of the original suite count.

`browser-qualification.test.ts`, `supplemental-qualification.test.ts` and the expanded existing qualification contracts ran 61/61 PASS. Those are synthetic verifier tests, not 55 browser tests or acceptance requirements. Scoped lint, typecheck and script syntax checks passed. Actual browser and supplemental source/build receipts remain separate.

The same index command recognizes `step5d-exact-compiled-populated-statistics` captures. It verifies both 200-hand fixture cohorts before/after reload, exact independent 50000/90000-cent profits and72.5/75BB100, immutable histories/wallets, fresh-start accounting and the fixture-authority source receipt. The400 generated fixture hands remain0 UI-played hands.
