# Patch16 — navigation and tournament previews

Base: saved Version32 source 6d14d6cfc43c13025122ec0fbcf303e3d76013c9. Supplied patch16 applied cleanly. This is a presentation-only tournament preview; registration remains disabled. No tournament engine, entry purchase, tournament bankroll, actual table balancing, bubble play or tournament results are implemented by this patch.

## Implemented

Four primary destinations (Play, History, Stats, Cashier), Play and Stats subnavigation, compact active-table game disclosure, 15 illustrative tournament presets with field/pace choices and prize/blind previews. Sample in-event screens are test fixtures, not playable events. Supplied design brief preserved in docs/proposals/SUPPLIED_TOURNAMENT_BRIEF_PATCH16.md.

Independent source review found and corrected inherited-property category validation, winner wrongly labeled Out, undefined names in 90-player sample fixtures, and unsupported venue/human field claims. Structures, fees and field ranges are explicitly illustrative. Hands-per-level pace discloses the assumed 30 hands/hour. Added Escape dismissal and focus restoration for the game disclosure. Updated authored browser navigation helpers for the grouped menu.

## Executed evidence

89 tournament unit tests PASS. Typecheck, lint and production build PASS. Existing Vite large-bundle warning remains. Specification hash check preserves all 302 original requirements and 86 deferred features. No engine, bot, ledger, storage schema or identifiers changed.

Actual Chromium UI fixtures: four navigation/layout cases (320×568/10 seats, 390×844/9, 1024×768/6, 1440×900/2). Each browsed all 15 presets, disabled registration, field/pace controls, grouped navigation, no horizontal overflow, unchanged cash-table display and overlay geometry. Existing table fixture validates seats/cards/board and legal action controls. Escape focus tested both by fixture events and actual supported keyboard input. Four separate accessibility/import workflows completed hands at 2/6/9/10 seats, checking persistent status, hidden-card labels, focus, same-file retry and import financial isolation. These are not VoiceOver tests.

Recovery workflow: four completed hands across two sessions; pending-action, settled and cashout reloads PASS, exactly two cashouts. First attempt failed its combined pace/hand check because the concurrently running accessibility fixture changed the same origin-wide Pace preference. The financial snapshot retained exactly one hand and its settlement. Retained failed evidence, then ran the full workflow separately: PASS. Fixtures that mutate this preference must be run serially on the shared origin.

Evidence: TEST_EVIDENCE/patch16/browser. The full authored Playwright CLI suite was not executed; supported interactive Chromium ran the real-app fixture pages. Physical Safari/iPad, VoiceOver, independent participants and historical performance outlier are not newly verified. No tournament acceptance criterion is promoted to PASS on preview evidence. R1 remains NOT READY while mandatory release gates are unresolved.

Full standard regression completed: **2,270 PASS, 0 FAIL, 9 optional skips** (seven opt-in PokerKit comparisons and two high-volume accounting cases). No test retry or timeout increase in the completed run. Full report and exact skip names are in TEST_EVIDENCE/patch16. The interrupted pre-resumption invocation produced no completed report and is not counted as a pass.

Responsive Chromium matrix: **105/105 PASS**, 2/3/6/9/10 seats at seven portrait, tablet, desktop and landscape viewport sizes, across preflop, river and showdown fixtures. Evidence: browser/layout105.json. This matrix tests real rendered geometry, not physical-device behavior.
