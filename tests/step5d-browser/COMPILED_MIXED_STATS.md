# Populated mixed-stakes display and deletion: exact compiled candidate

This additive page leaves the existing compiled gameplay harness unchanged. It contains **two200-hand engine fixtures, zero UI-played hands**. Fixture construction is not bot behavior validation or browser gameplay endurance. Authoring/typecheck does not establish browser PASS.

Preparation after preserving a successful exact build receipt:

```
node tests/step5d-browser/prepare-compiled.mjs TEST_EVIDENCE/step5d/release-repaired/manifest.json
node tests/step5d-browser/capture-mixed-stats-source.mjs
```

The second command refuses if any current production source bytes differ from the commit that produced the exact compiled artifact. It records hashes for every production source and the fixture/QA files. It does not rebuild or change the artifact. Keep the generated ignored `tests/browser/built-artifact/step5d/{manifest,mixed-stats-source}.json` alongside actual execution evidence.

Open `/tests/browser/step5d-compiled-stats.html` on the existing Vite QA server. Select390 or1280px, click `#stats-run`, preserve all `#stats-evidence` chunks and screenshots. `#stats-status` reports actual progress/failure; successful receipts distinguish planned400, verified400 fixture hands and zero UI-played hands.

For each cohort, actual authoritative engine commands construct100 alternating-button heads-up hands at each stake. Hero calls from small blind; the opponent folds. Natural CSPRNG cards never affect these prescribed all-fold payouts. Stable opponent personality seeds are7611/7612; the policy is not consulted. The independent arithmetic is50×(SB+BB) per100 hands:

| Cohort | Per-stake profit | Total profit | Mixed BB/100 |
|---|---|---|---|
| $1/$2 → $2/$5 | $150, $350 | $500 |72.5|
| $1/$2 → $5/$10 | $150, $750 | $900 |75|

An external+$123.45 wallet adjustment, two+$12.34 top-ups and two cashouts are recorded independently of poker profit. Canonical old-hand bytes, scalar ledger reconciliation, policy versions and actual frozen rule profiles are retained in hashed metadata. The fixture test verifies both exact cohorts and segmented reconstruction before browser execution.

The native IndexedDB namespace is unique: `ai-texas-step5d-compiled-stats-<run>-<cohort>`. The actual production bundle is hash-verified and loaded byte-for-byte. Only its default database name is redirected. The read-only QA verifier checks persisted canonical hashes; all displayed results/filtering, deletion and explicit restart are exercised through actual compiled DOM controls.

Each browser cohort checks:

1. Overall200hands, independent dollar profit, mixed BB/100, separate100-hand stake groups and the explicit mixed-blind formula. EV unavailable and synthetic-population disclosures remain visible.
2. Each actual hand-history stake filter returns exactly100 correctly labeled original records; All stakes returns200. Display/navigation never changes the saved snapshot or canonical history hash.
3. Actual document reload, with no reseeding, preserves the wallet and old-hand hashes; statistics/filter checks repeat.
4. Wrong deletion confirmation preserves all data. Exact `DELETE ALL PRACTICE DATA` removes canonical hands, packed copies, backups, ledger, sessions and presets from only that isolated test database. The nonpersonal erasure marker and lease are the only permitted survivors.
5. Actual reload remains deleted and creates no automatic bankroll. Explicit **Start fresh practice** creates exactly one+$10,000 initial adjustment with zero poker profit and no old records. Another actual reload verifies the fresh profile.

The test retains isolated fresh databases and nonpersonal fixture receipts for inspection; it never touches guest production saves. The deletion scope does not cover an active-hand attempt: existing lifecycle/controller tests separately verify active-table refusal. Neither this page nor source hashes prove physical iPhone export, hosted CI, human calibration, or screen-reader-user validation.
