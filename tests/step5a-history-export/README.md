# Step5A public export provenance correction

Confirmed cause: `publicHistory` constructed an explicit redacted record without any policy-version field. The UI already displays optional `policyVersions` on imported review records, so no UI change is required.

The additive optional `PublicHand.policyVersions` contains only sorted, distinct policy version strings derived from the source hand's frozen profiles. Private archetypes, traits, personalities, ranges, per-seat associations and singular `policyVersion` objects remain blocked. Version labels contain 1–80 ASCII letters/digits/periods/underscores/plus/minus characters, begin with a letter or digit, and are limited to ten distinct entries. Import accepts unfamiliar well-formed historical/future labels as inert provenance; it never loads code based on those strings. Unsorted, duplicate, object-valued, oversized or markup-containing metadata is rejected, even with a recomputed public hash.

No saved-data schema, original stored hand, ledger event or original hash is modified. Fresh export creates a separate redacted public hash chain including the metadata. Legacy imports without the field retain their original records and hashes. Genuinely absent provenance remains absent; the current bot version is never invented for an old hand. The previous frozen application importer also accepts the additive field. Reimporting an existing hand retains the original imported record rather than rewriting its provenance.

Actual verification (2026-11-01):

- Baseline RED run: **16 failed / 9 passed** in the initial 25-test suite (`evidence/red.log`). Failures reproduce missing exported metadata and lack of validation.
- Final focused run: **26 new tests**, plus 19 existing redaction, session/bot persistence and file transport tests: **45 passed / 0 failed** (`evidence/green.log`). Includes controller-level study import twice with no wallet, ledger, live history or session mutation.
- TypeScript typecheck and scoped ESLint: exit 0, captured in corresponding logs.

Commands:

```sh
npm test -- tests/step5a-history-export tests/compat4b/redaction.test.ts tests/session-bots4a.test.ts tests/ui/history-file.test.ts --reporter=verbose
npm run typecheck
./node_modules/.bin/eslint tests/step5a-history-export src/storage/integrity.ts src/session/types.ts
```

This isolated lane did not run a browser or alter the browser-test candidate. The integrator must verify the imported History/Replay policy label after cherry-picking the patch and completing the active endurance run. Public hashes detect accidental/tampered content relative to their supplied digest; they are not a signature certifying the authenticity of an external file's claimed provenance.
