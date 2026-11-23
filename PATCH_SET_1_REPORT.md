# Phone patch set 1 — implementation and verification

**Applied and saved for review; NOT READY FOR R1. Nothing was deployed.**

The recovered base was saved Version 22, `e5d2fbcd7aaea8d651ac4cf16625e3f7708fc759`. The uploaded three-patch ZIP was applied in order; all 13 supplied full-file copies matched. The application base used by the reviewer and Version 22 had identical application files. Uploaded ZIP SHA-256: `864357547269ab535d090216c3e68ee036b342fa23534e581ced26e95ac5073a`.

Initial application commit: `ccfb48e2dfed98474b493834077d85ad8e3660ed`.
Final application commit, including the observed showdown-overlap repair: `76613ea994541a9aa83bc2b332d9cae19549acac`. The subsequent evidence commit adds tests and receipts only. Final compiled hashes are in [final-build-sha256.json](TEST_EVIDENCE/patch-set-1/final-build-sha256.json).

## Implemented

- Compact 2–10-seat phone geometry with Hero at the bottom, one-row navigation, fixed betting controls, one-BB minus/plus controls, and a native More sizes disclosure. Updated description, viewport safe-area support, typography, winner highlight and shown-hand labels.
- Remembered Pace preference, shorter scheduling delays after Hero folds, cleared start notice after action, and contribution-level pot presentation only when someone is all-in. The legal-action and committed-decision guards remain intact.
- The synthetic live $1/$2 preset declares whole-dollar chips. Sourced cent-based rake and fractional custom rake caps retain compatible denominations. Existing frozen hand/rules profiles are preserved.
- Visual inspection found a further defect: a nine-way showdown list covered Hero’s stack at 390 × 664. The final change bounds the list to a named, focusable scroll region. All names remain reachable; trusted Home/End interaction was tested.

No production changes were made to the poker engine, bot policies, storage, statistics, or session controller. No desktop rendering redesign was attempted.

## Executed tests

| Check | Actual result | Evidence |
|---|---|---|
| Full original regression, PokerKit and accounting flags enabled | **2,112 passed / 3 failed / 0 skipped**, 2,115 total; 1,814 seconds | [Full JSON](TEST_EVIDENCE/patch-set-1/full-tests.json) |
| Both failed files rerun with unchanged 20-second limits | **14 passed / 2 timed out**, 16 total | [Verbose log](TEST_EVIDENCE/patch-set-1/failed-tests-rerun.log) |
| Independent denomination/configuration review | **57/57 passed**, including 11 new tests; overlapping existing tests are not added to the full-suite count | [Review](TEST_EVIDENCE/patch-set-1/chip-preset/REVIEW.md) |
| Final layout and new financial unit tests | **23/23 passed** | [JSON](TEST_EVIDENCE/patch-set-1/showdown-fix-unit.json) |
| Final typecheck, lint and real production Vite build | **PASS**; existing large-bundle warning retained | [Checks](TEST_EVIDENCE/patch-set-1/showdown-fix-checks.json) |
| Original geometry matrix | **105/105 passed**; its old completed-hand fixture was later strengthened, so this alone does not establish playable recovery | [JSON](TEST_EVIDENCE/patch-set-1/browser/original-105-layout.json) |
| Expanded uploaded-patch layout coverage | **189 distinct passing cases across runs**: 113 retained passes plus 76 reruns | [Coverage and provenance](TEST_EVIDENCE/patch-set-1/browser/layout-189-coverage.json) |
| Final overlap repair: all 2–10 seats, seven viewports, showdown | **63/63 passed**; includes unobscured-table assertion at supported phone heights and complete list access | [JSON](TEST_EVIDENCE/patch-set-1/browser/showdown-63.json) |
| Betting/sizing interface | **40/40 passed** | [JSON](TEST_EVIDENCE/patch-set-1/browser/sizing-40.json) |
| Browser accessibility assertions | **6/6 cases passed**; 2/6/10 seats at 320/1280 widths; labels, focus, drafts, contrast and targets | [JSON](TEST_EVIDENCE/patch-set-1/browser/a11y.json) |
| Trusted keyboard actions | Fold-to-Call Tab/Enter committed once; final shown-hand Home/End scroll passed | [Actions](TEST_EVIDENCE/patch-set-1/browser/keyboard.json), [shown hands](TEST_EVIDENCE/patch-set-1/browser/showdown-keyboard.json) |
| Complete browser hands | **12 completed**: four workflow hands, six matched-pace hands, and two compiled-build smoke hands | [Flow](TEST_EVIDENCE/patch-set-1/browser/flow.json), [pace](TEST_EVIDENCE/patch-set-1/browser/pace.json), [final smoke](TEST_EVIDENCE/patch-set-1/browser/final-compiled-smoke.json) |

The full suite ran on the initial patch commit. The final change is limited to showdown markup/CSS; the 23 focused unit checks, 63 showdown cases and final compiled hand ran after that repair. The full 2,115-test suite was **not** rerun after those two presentation-file changes. This is not an all-green regression claim.

Two timing failures remain: the exhaustive 1,680-context preflop report and the legacy archive-retirement/full-reconciliation test. The third original timeout, compaction idempotence, passed on rerun. No assertions or time limits were weakened. Five oracle-path tests, including enabled independent PokerKit comparisons, passed in the full run. These unit-fixture timeouts do not establish the cause of the historical 10.07-second browser stall.

Browser work used the supported interactive browser, repository harnesses and actual compiled Vite output. The standalone `npm run test:browser` Playwright command was not executed. Chromium viewport tests are not physical Safari or screen-reader results.

## Financial and recovery evidence

The four-hand workflow restored a pending bot decision exactly once, restored completed settlement and cashout, and finished with four unique hand records, four settlements, two cashouts, wallet $10,018 and no seated chips. Faster and relaxed pace runs produced identical canonical outcomes and RNG calls across three matched hands each.

On the **final compiled source**, Hero called $7, checked, called another $6, and checked. Board: 4♠ 7♥ 3♥ 10♦ A♣. Taylor’s pocket eights beat Hero’s K♠ Q♠; Taylor received the $29 pot, rake $0. Hero’s $300 stack ended at $287 (−$13). Cashout moved $287 back to the wallet without adding poker profit. Reload restored **wallet $9,987 / table $0 / cumulative poker result −$13**, with one saved hand. Exact displayed state and build verification are retained in the final smoke receipt.

The independent chip tests cover side pots, $15 unmatched-bet return, split/odd chips, rake, old cent-denominated records, residual-cent refund, top-up, duplicate cashout and manual-adjustment exclusion. Whole-dollar custom rake is a real rules change: a $30 pot at 5% floors to $1, not $1.50. It is not merely formatting.

## Evidence quality and remaining limits

The first expanded matrix exposed invalid manually assembled completed-hand fixtures (missing immutable configuration/provenance) and stale focus references after clock renders. Fixtures now validate before mounting and re-query current nodes. Initial failures are retained. One long JSON capture was truncated; only its 174 complete records were recovered, and every failed or missing case was rerun. A later bundle run timed out after 28 passing cases and is not presented as a completed matrix. These are documented harness failures, not hidden PASS substitutions.

Screenshots: [6 seats](TEST_EVIDENCE/patch-set-1/screenshots/mobile-6.jpg), [9 seats](TEST_EVIDENCE/patch-set-1/screenshots/mobile-9.jpg), [10 seats](TEST_EVIDENCE/patch-set-1/screenshots/mobile-10.jpg), [corrected multiway showdown](TEST_EVIDENCE/patch-set-1/screenshots/mobile-9-showdown-fixed.jpg). These are actual 390 × 664 Chromium viewport captures, not physical-iPhone evidence. At very short heights (for example 320 × 568), the whole table can still require scrolling; primary action controls remain accessible. Desktop scrolling and full UI rerendering remain unchanged.

All four governing PDF hashes, all **302 original requirements** and all **86 deferred features** remain intact. No original acceptance status was promoted because of these counts. The prior 229/237 qualification belongs to its recorded candidate; it is not automatically transferred to this patch. Existing open reviews U10, U11, U16, Z02, Z14, V518, V522 and V707 remain open. Actual VoiceOver, physical-device metrics/export, three new users with 25 observed hands each, hosted CI, full historical write proof and final release qualification remain unresolved.

Production Version 7 is unchanged. Public R1 test revision 10 still packages `886bba85aa9b1c3f76076b0c668d01fe82d9972d`, running application `ee719faa9975762895bde75478546bd396880f4e`. The original private Version 12 site was not touched. All new browser saves used isolated synthetic test namespaces.

**Next engineering task:** qualify the two timeout cases without relaxing their checks, then obtain exact-candidate iPhone/VoiceOver verification. Keep the saved phone patch unpublished until the applicable release checks pass.
