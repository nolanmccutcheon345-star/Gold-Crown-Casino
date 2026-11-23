# Version35 — Patch17 and tournament review repairs

Base application: 254c8f360568e54e2b8b5d85e7232ce90836d828 (Version34). User-supplied Patch17 was applied to the actual source, not the reviewer's stand-in build. This is a single-table development candidate, not R1 signoff.

## Changes and findings

1. Patch17: legal preflop BB/raise-multiple and postflop pot suggestions, BB steppers, queued Check/Fold, optional auto-deal with Hold, pinned Hero cards/BB stack, plain seat labels and removal of the premature final-table banner. Presets propose only; the engine validates and commits. Engine chip unit remains one; rounded shortcuts do not establish physical chip denomination rules. No slider was added.
2. Independent review caught queued Check/Fold surviving a manual action. Explicit Fold/Call/Raise/All-in now cancel the request before submission. Auto-deal countdown resets while paused or away; Hold stays explicit.
3. A new versioned preflop short-stack overlay applies to new events at own stacks <=12BB. It uses own cards/public position, stack depth, raises/limpers, eligible call price and bounded personality variation. Existing cash and already-started tournament policies are unchanged. Event metadata, pending replay and exports retain the overlay version. It is a synthetic ordinal approximation, not ICM/Nash/solver/human calibration. Deep stacks facing short stacks retain the inherited policy.
4. Completed events are immutable archived records; per-action checkpoints contain financial ledger, active event and ordered archive hashes. Real Node/noble SHA256 paired medians at0/1/2/10 completed events changed from1.41/50.63/100.83/608.46ms to1.02/1.31/1.36/1.89ms. Seven samples per workload, not physical-phone or browser-origin measurements. Full recovery audits still scale with all history; active-event history also remains in the checkpoint. This does not resolve the historical unexplained cash10.07-second stall.
5. New accounts start with$2,000 virtual tournament funds and a versioned genesis. Legacy$100,000 genesis and all subsequent balances/adjustments stay unchanged. No cash transfer, reset or fabricated winnings.
6. Skip to result is available only after Hero elimination. It executes normal controller prepare/commit/deal operations without viewing delay, yields to the browser between steps, and stops on cancellation, pause, navigation, conflict or error. No fabricated standings or discarded hands. Normal/Fast action pace is also available.
7. Previous snapshots are now read and fully audited for explicit private recovery export. Corrupt current data blocks play. No automatic restoration: an older snapshot may omit an acknowledged wager or prize. Export is a repair aid, not guaranteed data recovery.

## Migration and rollback

Legacy format1 loads remain supported. First normal write atomically writes format2 checkpoint, completed archive bodies and pre-archive-migration backup. Quota/interruption aborts the complete transaction. Existing event/rule/policy records are retained. Archive IDs/hashes are append-only. Independent review repaired shallow-frozen descendants and legacy migration prefix checks.

Version34 cannot read format2; rolling back code alone is not a safe data rollback. Keep this reader available to recover upgraded test saves. Verified previous/pre-migration snapshots must never silently replace a later acknowledged state. ProductionVersion7 is not deployed or migrated; R1 run namespaces remain isolated.

## Executed evidence

- Full standard suite:2,390PASS,0FAIL,9optionalSKIP. One additional explicit incomplete-shove test passed after the full run (test-only change). Explicit optional skips: TEST_EVIDENCE/tournament35/full-tests.json and verification-summary.json (counts are tests, not V7 requirement IDs).
- Targeted suite with pinned PokerKit0.7.7:208PASS,0FAIL. targeted-oracle.json.
- Native IndexedDB browser: seven checks passed (quota-aborted migration, populated migration/backup, exact active+archive restore, stale concurrent writer, corrupt current with verified previous export, corrupted archive, missing archive).
- Small-phone browser: four interaction checks passed (preset/stepper does not submit, Hero cards visible320x568, Hold prevents deal, opt-in countdown deals).
- Legacy-policy post-bust browser:63 total hands, cancelled/reloaded at45, remaining18hands completed in15.28s; exact paused hand/balance restored, no duplicate prize.
- New-policy six-player browser:38hands; nine-player browser:46hands. Reload and terminal finish passed in both.
- Cash browser regression: four complete workflows at2/6/9/10seats passed, including announcements/focus, full showdown, repeated study-file selection and import with unchanged canonical ledger/bankroll. These are automated DOM checks, not VoiceOver or physical-device evidence.
- Ten six/nine-player viewport cases passed initial integrated UI checks. Additional final browser results are saved in browser/.
- Independent review:29UI/sizing/fast-forward checks and48runtime/policy checks passed; counts overlap and must not be summed as unique cases.
- Controlled policy opportunities:3BBUTG144→555 shoves/1326combos, button549→854/1326; explicit full conditions and raw data in tests/tournament-bots35. Three held-out events77/74/68→56/49/56hands,45000chips conserved; fold/checkHero ranks5/7/3→4/4/4. Three events do not establish exploit resistance or realistic human distributions.

## Remaining limitations

Casino/series/multi-table play remains preview-only. Tournament-specific ICM/bubble adaptation, true chip-denomination rules, randomized starting seat/lineups, integrated cash Stats navigation and full tournament replay/import UI remain unfinished. Tournament results are on the Tournaments page. Physical iPhone, Safari, VoiceOver and independent human usability checks remain unexecuted. All302 original requirements and86 deferred IDs remain preserved. T21 has new partial evidence, not full acceptance signoff. No R1 READY claim.
