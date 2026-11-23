# Version38 — ace side counts and doubled Wong Halves

Continues playable Version37 (`d6359e6f49521b3a41fbbb6642521c0afe69cf11`). All eight classic tables remain playable. This change adds count practice and display functionality; it does not change the authoritative blackjack engine, money ledger, persistence schema, poker engine, bots or tournament runtime.

## Delivered behavior

All five methods now display an ace side tally in both the practice trainer and live count coach: aces seen, aces unseen, expected aces unseen and excess unseen aces. Unseen includes unexposed dealer cards; values are derived only from public exposures and initial deck count. The trainer and live hidden-count mode ask for running count and aces seen, grade each independently, and support Enter. New exposed cards clear stale feedback. New practice shoes reset both tallies.

A sixth menu option is **Wong Halves ×2 · whole-number tags**. The tags for 2,3,4,5,6,7,8,9,10–K,A are +1,+2,+2,+3,+2,+1,0,−1,−2,−2. Running count, displayed true count and count-play thresholds use doubled units. The original Halves true count is also shown. Count drills scale their scenarios consistently. An ace is still one ace in the side tally, not two.

Hi-Lo, Halves and Zen already reckon aces in the main count. Their new ace tally is informational practice; it is not added again to the betting count or used to fabricate adjusted playing indices. Hi-Opt II and Omega II retain their existing ace-neutral betting adjustment: (running count + 2 × excess unseen aces) / estimated decks left. Playing indices use the main count. Counts shown to one decimal are rounded independently; conversions use unrounded values internally.

Primary reference for the distinction: https://www.qfit.com/CVBlackjackHelp/sidecounthandling.htm. Arithmetic equivalence is tested; this does not validate the approximate strategy model, external casino indices, betting profitability or measured human performance.

## Executed evidence

See `TEST_EVIDENCE/blackjack38/` for exact receipts. Independent arithmetic/model/privacy tests: 77 passed, zero failed/skipped, against implementation checkpoint ba70335. Initial counting/strategy/screen regression: 55 passed (overlaps the full suite).

Chromium browser tests: 60 practice checks, 54 live checks with 48 measured completed rounds across eight classic tables, and 12 native IndexedDB checks. Viewports: 320×568, 390×844, 1366×768. Live tests include each count option, independent public-card tag sums, ace grading, keyboard Enter, active-round reload, synthetic cached-page recovery, separate financial ledger agreement, public export, full replay audit and concurrent stale-tab rejection. Native tests include interrupted transactions, lost acknowledgements and fail-closed corruption/missing-record recovery. Samples in the practice harness are labelled sample data and are not counted as played rounds.

The native transaction abort is a simulated quota-style failure, not physical storage exhaustion. Embedded desktop Chromium widths are not actual touch, iPhone Safari or VoiceOver verification. The historical cash 10.07-second stall remains unattributed; this work makes no claim to resolve it.

## Compatibility and scope

No data migration. Version37 can read Version38 saves because count practice preferences are transient and no financial schema or journal action changed. R1 packaging retains the previous compiled build and manifest as rollback reference. Rollback never resets or deletes tester saves. Main production Version7 and original private Version12 are unchanged.

The separate blackjack balance remains $2,000 initially; default casino ante remains 50¢ once per round including splits. Free Bet and six side-bet paytables remain previews with wagers unavailable. Exact finite-deck/resplit strategy, independently verified count indices and house-edge simulations remain unfinished.

The 302 original acceptance IDs and 86 future-feature IDs remain intact. No new unit-test total is counted as an original acceptance PASS. External physical-device, real screen-reader, human-user and outstanding CI/release gates remain unchanged. **NOT READY FOR R1.**

## Final standard regression receipt

Typecheck, lint and production build passed. Two production builds were byte-identical. Standard Vitest: **2,661 passed, zero failed, 9 skipped** in 746.56 seconds. The nine skips are unchanged opt-in comparisons: seven PokerKit tests and two 10,000-hand accounting batches. Exact names and their provenance are in full-summary.json. The independent and initial targeted test totals overlap this run; do not add them.

All126 browser checks passed. The48 measured round workflows had p50=45.7ms, p95=685.7ms, maximum908.8ms, including DOM polling and reload. These are desktop Chromium workflow timings under concurrent regressions, not isolated computation, physical-device or rare-stall qualification.

Exact byte comparison preserved99 engine/policy/finance/persistence files against Version37. Original302/86 register integrity check passed.
