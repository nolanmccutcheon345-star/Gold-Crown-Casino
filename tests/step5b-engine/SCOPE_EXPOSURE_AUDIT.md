# Scope, exposure and rollback audit

## Confirmed source gap and small implementation

The current Host UI described antes/straddles as unavailable, but had no explicit
disabled run-it-twice or bomb-pot controls. This did not satisfy original X15's
visible unsupported-control requirement even though the engine had no alternative
board/deal path.

`src/session/release-scope.ts` now supplies a deeply frozen, disabled catalog for
run-it-twice, bomb pots, extra games, tournaments, peer multiplayer, table chat,
dealer errors/floor rulings and real-time assistance. Tournament phases remain
R2/R3; optional post-release features are not treated as missing R1 mechanics.
The existing FUT001/FUT004/FUT005/FUT055 records remain unchanged.

`assertSupportedCashScope(candidate)` rejects attempts to enable known unavailable
flags, alternate modes/games, multiple boards/runouts and enabled nested feature
containers. It reads no URL or local storage. Plain cash profiles and explicitly
off legacy flags remain compatible.

`src/ui/release-scope.ts` renders a collapsed disclosure section with native
disabled buttons and individual unsupported explanations. There are no callbacks
or feature-toggle setters. Root must integrate `unavailableFeaturesMarkup()` into
Host and call the guard from settings/profile and restored active-profile
validation; these new modules alone do not wire themselves into the application.
Parent browser QA must verify those actual integrations, including malicious URL
and local-flag attempts, before whole-row PASS for X15/V521/V615.

## Executed tests

`npm test -- tests/step5b-engine/replay-exposure.test.ts tests/step5b-engine/release-scope.test.ts --reporter=json --outputFile=tests/step5b-engine/scope-exposure-result.json`

**32 tests passed, 0 failed.** Guard tests cover all disabled catalog entries,
unsupported direct/nested/URL-like flags, no global URL/storage reads, native
disabled markup with per-control reasons, and preserved 86-record backlog.

U07/X12 disclosure fixtures cover:

- Five players, four all-in at 50/120/300/300, fifth player's folded dead money 2.
  Main/side pots are exactly 202/210/360; payouts 50/121/301/300; the folded player
  receives no award and appears in no eligible pot.
- A separate flop fixture leaves one opponent all-in while three funded players
  continue side-pot action. The all-in opponent remains hidden until betting ends.
- Every selectable public replay frame and exported/imported frame hides folded
  opponent cards; pre-settlement opponent cards remain hidden. Export/replay
  operations leave canonical records unchanged.
- Rehashed imports attempting early all-in disclosure or final folded-card
  disclosure are rejected, rather than trusted because their hash is consistent.

Current root `src/ui/app.ts` has an explicit `data-testid="ev-availability"`
notice: all-in-adjusted EV is **NOT IMPLEMENTED** and full decision EV is not
calculated. No all-in-equity recommendation is produced by these fixtures. This
is source inspection; actual visibility belongs to browser QA, not a fabricated
unit-test claim. U07's rules-permitted disclosure is exercised directly above;
actual selectable replay controls remain the existing UI/browsing evidence.

`npm run typecheck` and `npm run lint -- --quiet`: **PASS**. No engine betting,
settlement or hidden-card behavior was changed by this task.

## Z03 remains partial

Inspected `TEST_EVIDENCE/step5b/browser/recovery-final.json`: actual Chromium 155
reports **9/9 PASS** and `productionDatabaseAccessed: false`. It verifies populated
schema 2/3/4 migration, exact backup retention, old-reader refusal, interrupted
IndexedDB transaction recovery, lost acknowledgement, actual two-tab fencing,
isolated restoration of the pre-migration backup, and safe future-format/schema
refusal. The schema-4 example preserves wallet 190000 cents, three hands and 14
ledger events. Isolated old-backup restoration preserves wallet 190000 and three
hands.

However, `tests/browser/step5b-baseline.js` explicitly comes from **9d937a3**, the
unpublished Step5A source baseline. It is not evidence of an actual deployed
Version7 rollback. The restored backup predates migration; retaining all new
post-migration hands and money through deployment rollback was not tested. Safe
refusal is valuable integrity evidence, but it is not the original Z03 promise
that the previous working release can be restored with all valid histories.

Keep whole Z03 **NOT_EXECUTED** with these partial results. Its next task is a
compatible rollback artifact plus an isolated deployment/restore exercise that
includes both pre- and post-migration data. No destructive production test or
silent downgrade is proposed.
