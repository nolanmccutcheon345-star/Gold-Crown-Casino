# Step 3.6 independent migration verification

This is a test-only lane. No production database is opened by these tests and no production code is changed in this commit. Browser tests remain the integrator's responsibility.

## Previous release provenance

`frozen-v3/` contains eleven unmodified source files from `e5653b557225d57b392625487066c116adccd05c`. Every file is byte-identical to the published version-3 source `c6b271881fb1f70a542fb14cc4d8fb5beb1c661a`, recorded in `TEST_EVIDENCE/step3/publication.json`. The manifest records both git blob identities and SHA-256. An executable test checks every frozen file against both hashes.

The frozen old controller, engine, policy and reader generate the populated fixture. Only test entropy, time and a check/call policy are deterministic. One test-only private deck fixture establishes an independently calculable rake result. None of these fixtures, fake entropy functions, frozen modules or transaction references are imported into the application bundle.

`fixtures/populated-v3.json` has full private test snapshots at preflop, flop, turn and river, each with a durably sampled bot decision. These are synthetic test records, not copied user data. Regeneration is explicit:

```sh
WRITE_STEP36_FIXTURE=1 npm test -- tests/step36/fixture-provenance.test.ts
```

Ordinary runs reproduce the fixture in memory and compare it with the checked-in file without modifying it.

## Independent expected money

All amounts below are integer cents.

| Event group | Expected value |
|---|---:|
| Starting wallet after manual baseline | 150000 |
| Session 1 buy-in / top-up / cashout | 20000 / 100 / 19800 |
| Session 1 two completed hand results | -100, -200 |
| Manual wallet increase | +50000 |
| Session 2 buy-in / top-up / cashout | 50000 / 550 / 51000 |
| Session 2 gross pot / rake / award | 1000 / 50 / 950 |
| Session 2 Hero net | +450 |
| Manual wallet correction | -150 |
| Session 3 buy-in / current table assets | 10000 / 10000 |
| Final wallet | 190000 |
| Completed-hand poker net | +150 |

The ledger includes four manual adjustments (including genesis), three buy-ins, two top-ups, two cashouts and three settlement events. Three completed public records are also present on the study shelf, without financial authority.

## Executed checkpoint

At production-source commit `f0c030a` (cherry-picked as `eaf5242`), this independent lane executed:

```sh
npm test -- tests/step36 tests/storage --reporter=verbose
npm run typecheck
npm run lint
```

**40 tests passed, zero failed/skipped**; typecheck and lint passed. The run log was supplied as `step36-independent.log`. The integrator must rerun after merging or changing production source; this checkpoint does not assert later changes passed.

Coverage includes populated schemas 2→4 and 3→4; exact cards, deck cursor, policy versions, actions, hand/ledger hashes and monetary values; resumed pending actions without reroll/double commit; future schema and invalid data refusal; actual old reader rejection of version4; current downgrade guard; and actual old cached writer rejection by revision fencing.

Storage adapter tests use an explicitly labeled asynchronous transactional reference database. They exercise production `BrowserPersistence.load/commit` and frozen old `BrowserPersistence.load/commit`, including rollback after backup/current writes, readonly migration, backup preservation and restoration into an isolated clone. They do not constitute actual IndexedDB/browser evidence.

## Acceptance evidence boundaries

| V7 requirement | Evidence contributed | Remaining scope |
|---|---|---|
| M09 | Versioned populated migration, unchanged historical stats inputs/hashes, validation and fail-closed corrupted state | Partial-corruption salvage and full import/export/browser matrix are not established here. |
| Z03 | Actual shipped old reader refuses new schema; old cached writer cannot overwrite; exact pre-upgrade backup retained/restored in a clone | Restoring the old release after **new post-migration records exist** is not proved by restoring an earlier backup. Do not mark full rollback acceptance PASS from these tests alone. |
| U14, V606 | Exact all-street migration/recovery and pending-action identity | Real browser/CSPRNG reload, suspend and interrupted save evidence belongs to the integrator. |
| V703 | A migrated sampled decision is reused and applied once; duplicate callback has no effect | Full reservation/sample/dispatch interruption cases also use prior Step3 evidence. |
| V512, V708 | Atomic abort, readonly behavior, same-owner stale-revision fencing and invalid snapshot preservation | Two actual browser tabs, visible error/recovery controls and real quota interruption remain separate evidence. |
| M10 | Frozen profiles/rules/immutable completed records survive migration unchanged | Future policy-code compatibility and presentation labels are not broadly validated. |

Schema4 is intentional. The frozen v3 reader accepts unknown optional fields, so keeping a durable exit command under version3 would silently allow old code to ignore its meaning. The executable old-reader test demonstrates this. Version4 forces the actual old reader to refuse the new snapshot; current migration adds an explicit null exit intent to old snapshots.

No acceptance CSV or original requirement/deferred-feature records are changed by this lane.
