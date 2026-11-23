# Step 5L recovered-source audit

Executed `python3 tests/step5l-recovery-audit/audit.py` against the native Sites Git recovery of development Version 15 (`b4dfd689ecd2216d4d84fecc99ac61f60ba8fcde`) and R1 test packaging source (`566f3b11032841c492e6e148bb9a1139e74247b7`). This lane made no application-source, deployment, sharing, ledger or engine changes.

## Verified findings

The saved R1 package contains the original candidate execution receipt for application source `3ecea1c2b71c8e8b9963547da676171f91f21716`, receipt SHA-256 `849f69855b34267a5912fa2b87efc049453a7655b9db79b1dfa49eff285bff08`. Of its 1,599 source-path hashes, **1,594 already match the recovered Version 15 exactly**.

The 142 production `src/` files comprise 141 exact retained Version 15 files and one localized difference in `src/ui/app.ts`. Adding only `aria-label="Table settings"` to the existing configure button reconstructs bytes whose SHA-256 is `08036f04b9b1dda8e0a51eb106eb84c64edcf25e946e4a98fa495c444fcf9de6`, exactly the original candidate receipt hash. The independently retained unminified runtime also contains that attribute. The audit computes the replacement in memory; the integrator owns any actual source edit.

The other four differences are test-only:

| Path | Recovery status |
|---|---|
| `tests/step5g-gates/dependency-status.test.ts` | Version 15 exists; exact Step 5K replacement bytes not found. Original candidate hash retained. |
| `tests/step5k-accessibility/README.md` | Original bytes not found; original candidate hash retained. |
| `tests/step5k-hosted/README.md` | Original bytes not found; original candidate hash retained. |
| `tests/step5k-hosted/build-qa.mjs` | Original bytes not found; original candidate hash retained. Compiled outputs and input/output manifests survive. |

The performance bundle sourcemap survives at `/workspace/scratch/4441cfdf5595/step5k-performance-fixtures-3ecea1c/build/profile.mjs.map`: all **98 embedded project source/test texts** match the recovered Version 15. This independently confirms that the covered engine, bot, storage, statistics and controller sources were unchanged. It is not an original Git-object recovery and does not cover erased files absent from the bundle.

All three retained compiled release assets match their recorded bytes and SHA-256 values. This proves retained compiled identity; a fresh build comparison is an independent integrator check.

## Surviving evidence and loss boundaries

`retained-step5k-artifacts.json` inventories **46** top-level raw Step 5K files, including 36 JSON records and actual screenshots/deployment archives, with observed byte sizes and SHA-256 hashes. A recorded PASS remains a historical execution result; it is not a fresh execution or automatic whole-requirement qualification. `step5k-resource-first.json` preserves the original failed stale-export harness outcome. The tab-close record still requires its separately retained operation evidence. The keyboard result is OBSERVED and does not prove real VoiceOver.

`archive-inventory.json` covers seven relevant surviving archives. None contains a Git object database or original application `src/` tree. The `.tar`-named scratch deployment copies are compressed/rewrapped artifacts with different byte hashes from the native uncompressed deployment receipts; their filenames must not be used as a claim of native archive identity. The restored native packaging Git tree is the stronger source of those compiled assets.

A scoped `/tmp` search found the interrupted resource-test preparer, smoke run source map and evidence, generated long-run script and independent verifier. The resource lane owns recovery and qualification of those files. It did not find the missing Step 5K QA builder, original `1805380` checkpoint or a Git bundle. No unrelated project was opened.

At this audit, `3ecea1c...` and `1805380` are not present in either restored local Git object database. This is **not proof of permanent loss from every provider-side store**. Authenticated remote object retrieval and native saved-version history are tracked separately by the integrator. The entire original Step 5K commit/tree has not been recovered merely because production bytes can be reconstructed exactly.

## Reproduction and evidence

- `audit.py`: comparison implementation using immutable Version 15 `git show` bytes, not a concurrently edited working tree.
- `recovered-release-execution-receipt.json`: original durable receipt copied without edits.
- `source-comparison.json`: every one of the 1,599 source paths and observed comparison.
- `source-map-comparison.json`: all 98 embedded project-source comparisons.
- `recovery-audit.json`: machine-readable findings, object availability and limitations.
- `retained-step5k-artifacts.json`: raw surviving artifact inventory.
- `archive-inventory.json`: archive inspection without extraction or mutation.
- `execution.log`: actual read-only audit result.

The audit does not change any original acceptance status, requirement wording, count, deferred-feature record or release gate. Production Version 7 and both testing deployments were untouched by this lane.
