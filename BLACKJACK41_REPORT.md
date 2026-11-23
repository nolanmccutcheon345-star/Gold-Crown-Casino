# Version 41 — Patch 21 casino-table presentation

Base: Version 40, `6dbc2296a3f7076a7aa467da7b9e47a6939047f5`.
External input: poker-night-ai-patch21-casino-table.zip, Patch 21. Applied cleanly; source changes restricted to presentation and post-command scrolling. No engine, financial ledger, controller, settlement, schema or persistence changes.

## Implemented
Casino felt/rail, decorative table-specific payout and dealer-rule arcs, rack/shoe/discard visuals, card corners/court faces, denomination-colored chips and curved seven-seat sample. Classic live table scrolls its status strip into view after Sit/Deal/Rebet, respecting reduced motion.

Integrator correction: soft-17 rule was missing from the accessible fallback, while inherited phone CSS also hid the fallback and its insurance span. Added dealer rule and explicit display overrides so clipped text remains accessible. Browser DOM verified block/inline at short-phone size. This is not a real VoiceOver result.

Existing V40 escaped names and disabled Hero actions while another seat acts are preserved. Full-table and side-bet screens remain samples; classic main game remains the playable mode. No new side-bet wagering or Free Bet settlement is enabled.

## Executed browser evidence
Supported interactive Chromium via Sites preview. Browser regression page `tests/browser/blackjack38.html` ran current source, despite its historical filename: PASS 54 checks, 48 completed rounds at 320x568, 390x844 and 1366x768. Covers all eight classic tables, public counts, ace tally, keyboard grading, balance/ante accounting, reload, export/audit and two-tab behavior. Raw result: `TEST_EVIDENCE/blackjack41/browser-regression.json`.

Independent manual live Sit/Deal at 320x568 and 390x844 with Count coach on:

| Viewport | Strip top | Hero hand bottom | Controls top | Horizontal overflow |
|---|---:|---:|---:|---|
| 320x568 | 6 | 325.78 | 448 | No |
| 390x844 | 6 | 501.64 | 724 | No |

Screenshot and raw measurements are in `TEST_EVIDENCE/blackjack41/`. Desktop Chromium scrollbars reduce iframe content width by 15px; these checks do not substitute for physical iPhone Safari.

## Remaining limitation — do not claim full-table fit
The seven-seat sample with another player's split still exceeds pinned-control space on initial load: Hero bottom 568.38 vs controls top 470 at 320x568; 764.23 vs 746 at 390x844. Seven seats fit horizontally and all four Hero buttons are disabled while Lou acts. Classic live layout is fixed; the sample does not invoke the live post-command scroll and needs further full-table layout qualification before becoming playable. No blanket all-screens overlap PASS.

Real iPhone/Safari and VoiceOver must recheck this visual change, especially scroll/focus behavior, arc text and chip rendering. Prior V38 owner confirmation is not reused for Patch 21. Windows forced-colors was not physically tested.

## Release safety
Save only. Production Version 7, public R1 application Version 39 and original private Version 12 are unchanged. All 302 acceptance IDs and 86 deferred features preserved. NOT READY FOR R1: existing mandatory external/qualification gates remain unresolved. Count-play estimates, exact two-deck strategy and full-table/side-bet integration are not resolved by this patch.

## Automated qualification
Full Vitest run completed: 2,731 passed, 0 failed, 9 skipped, 2,740 total. Seven skips are opt-in independent PokerKit comparisons; two are opt-in 10,000-hand-per-profile accounting batches. They were not executed or counted as PASS. Full list: `TEST_EVIDENCE/blackjack41/summary.json`. No timeout retries used.
Final targeted markup/independent safeguard run: 18 passed, 0 failed/skipped, including the added accessible-dealer-rule test. Typecheck, lint, production build and spec-integrity checks passed. Existing production bundle >500kB warning remains. Generated historical benchmark files were restored to their baseline versions to avoid overwriting prior evidence; new output hashes are recorded separately.
