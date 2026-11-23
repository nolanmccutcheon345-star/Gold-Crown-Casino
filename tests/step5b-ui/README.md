# Step 5B UI implementation evidence

Original requirement wording was read from `docs/specs/acceptance-source.json`. Original IDs and criteria are unchanged. These are supporting checks, not additional V7 acceptance requirements.

Executed on the implementation worktree: `npx vitest run tests/ui tests/step5b-ui` → **76 passed, 0 failed, 7 files**. This includes 38 new checks and 38 existing UI utility checks. Full output is `evidence/ui-tests.log`. `npx eslint src/ui tests/step5b-ui` also exited 0. After controller/statistics integration, `npm run typecheck` passed and the UI + configuration + statistics + engine test selection passed **201 / 201 tests in 14 files** (`evidence/integration-tests.log`). A production build also completed (`evidence/build.log`). No browser completion is claimed by this lane.

| Original IDs | Implemented UI | Executable support | Remaining verification |
|---|---|---|---|
| U04, V408, V505 | 25/33/50/75/100/150/200% presets, custom percent, editable BB total/increment; cumulative street total and additional chips; explicit pot-after-call basis; no min/max clipping | `bet-sizing.test.ts`: fixed expected cent totals, numeric/BB/increment equivalence, short all-in, no-reopen, denomination boundaries | Actual browser facing a bet and prior commitment |
| V612 | Accessible 0–300% pot slider, dollar total, additional amount, exact min/max and chip unit; invalid proposal disables commitment; existing hand/revision and operation guards retained | Same proposal tests | 360px legibility and rapid double-tap actual browser test |
| D02 | Capacity separate from occupied physical seat IDs; empty perimeter placeholders; Hero remains bottom | `capacity.test.ts`, `opponent-capacity.test.ts`; existing table-layout tests retained | Actual ten-position/six-occupied gameplay, no empty bot action |
| D08, V706 | Host edits queue for next hand; stack targets, blinds, rake, denomination; cancel queue; current hand untouched by UI | Configuration/engine lanes own authoritative transition tests | Actual active-hand edit → settlement → next-hand browser workflow |
| D10, U09 | Save/load/clone/update named presets; load is draft-only; clone selects a separate saved copy | Configuration lane owns identity/history invariance tests | Actual browser round trip including modified rake |
| U01 | One-click synthetic $1/$2, nine-player, $300 table; editable next-hand setup | Configuration helper tests | Actual click → live table and guest access |
| G04, X10, V613 | Assumed live pace input; hypothetical live-equivalent hours, projected BB/hour and projected $/hour separate from measured app-clock time | Statistics lane owns independent numerical fixtures | Actual browser labels and fixed-hand-count pace runs |
| V421 | Postflop raise, check-raise, fold-to-flop-cbet frequencies with numerator/eligible denominator, sample warning and intervals | Statistics lane owns canonical opportunity tests | Actual Results view on representative histories |
| V432, V608 | Host-only draw editor: four draw kinds × three streets × seven price anchors; bounded −1..+1 synthetic adjustments; missed-draw-only river disclosure | `draw-setup.test.ts`, `opponent-capacity.test.ts` | Policy lane conditional frequencies and browser profile persistence |

All controls propose actions or settings to the existing controller. The UI never moves chips, deals cards or settles a hand. No straddle variant was enabled.

UI performance changes are limited to removing full-history mapping from every subscription notification, deriving statistics with the verified projection service, and lazily creating read-only history view models when Study is opened. The history cache is used only for privately verified snapshots and identical immutable history-array identity. Unverified histories are projected afresh. `ui.sync`, `ui.render`, `ui.historyProjection` and `statistics.aggregate` timing hooks support the root agent's actual-browser measurements.

The root agent owns browser execution and acceptance-status updates. This file does not assert that any complete original V7 requirement passed solely because a UI utility test passed.

Independent review found and repaired two integration defects: consumed per-seat targets could remain in the Host draft after a new hand, and the legacy global mutation wrapper reset an unchanged sizing proposal to zero. Host drafts now reload at a new-hand boundary and remove consumed targets unless explicitly queued; proposal initialization is keyed to authoritative hand/revision changes only.

Final focused source review (after version provenance, readable mobile amounts, draft focus preservation, and live-pace input repair): `npx vitest run tests/ui tests/step5b-ui` passed **113/113 tests in 11 files**, with raw output in `evidence/final-ui-tests.log`. Typecheck and scoped UI/provenance/browser-harness lint passed. These 113 executable tests are not 113 original acceptance requirements. Actual browser outcomes remain recorded by the root integration lane.
