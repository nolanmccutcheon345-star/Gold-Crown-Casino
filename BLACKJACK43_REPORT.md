# Version 43 — paced full-table blackjack

Saved candidate based on Version 42, commit `2280c25c473186fad6f4e8a6395e3e4e437ecb72`, integrating the supplied Patch 23. No deployment requested or performed in this integration. Production Version 7, original private Version 12 and R1 Version 39 remain separate and unchanged.

## Implemented

Slow, Casino and Fast card reveals at seated tables; Show all; locked actions until reveal completes; counts based on exposed cards; name wrapping. Heads-up remains immediate. Reload resumes the authoritative saved state immediately, not the unfinished animation.

Additional confirmed defects fixed during integration:

- Final balance, session totals, mistake feedback and shoe position no longer reveal future outcomes. The frozen balance is labelled “Balance before reveal”.
- Live count quizzes grade the displayed cards, not the already-committed future cards.
- Split cards move between hands at the correct reveal point instead of displaying the final split arrangement during the initial deal. A presentation helper follows recorded card movement; it does not choose actions.
- Completed-seat announcements wait for the reveal to reach that player, including players who stand without drawing. Double markers wait for their card.
- Closing the view cancels reveal timers. Actions and export/review controls are guarded during reveals.

Version 42's reserve/cut-point correction and seat-styles-2 policy are preserved. Authoritative blackjack engine, runtime, persistence, seat policy, cash and tournament authority are unchanged. Original 302 requirements, 86 deferred features and governing hashes pass integrity verification.

## Executed verification

- Final focused tests: 19 PASS, 0 FAIL, 0 SKIP, including 300 mixed full-table rounds checking physical-card reveal layouts and independent boundary tests.
- Typecheck, lint and production build PASS. Existing Vite large-bundle warning remains (main JS about 821 kB, 273 kB gzip); this is not a measured phone-performance result.
- Final Chromium browser run: 27 rounds, nine configurations (320×568, 390×844, 1366×768 × Slow/Casino/Fast), 3,275 reveal observations. Buttons/counts/results, Show all, reload equivalence, save audits, hand visibility and overflow checks PASS.
- Heads-up browser regression: 54 checks, 48 rounds PASS.
- Mid-reveal hidden-count quiz independently graded visible cards and ace tally correctly.
- An earlier paced browser run also passed 27 rounds/2,912 observations. The final run follows the additional drawless-player announcement correction.

Full project suite: **2,772 PASS / 0 FAIL / 9 SKIP**, 702.0 seconds. Seven opt-in PokerKit comparisons and two opt-in 10,000-hand accounting workloads were skipped; exact names are retained in summary.json. The final 19-test focused run covers the last announcement-boundary correction.

Browser checks use desktop Chromium at embedded viewport sizes, not physical iPhones. Timing includes test-machine contention and is not a casino-speed or device-performance benchmark. Raw evidence, logs, browser receipts and a live screenshot are in `TEST_EVIDENCE/blackjack43/`.

## Remaining work and release status

New pace selector, Show all, and dealing/seat announcements still need iPhone Safari and VoiceOver verification. Patch notes report successful Version 42 owner checks; those are not counted as Version 43 verification.

Side bets and Free Bet remain unavailable in live play; exported public history still contains Hero's hands only. Approximate coach indices/two-deck calculations, three independent new-user sessions, measured performance and existing mandatory R1 gates remain unresolved. This change does not close unrelated acceptance rows or explain the historic stall. Hosted CI remains blocked pending connection.

**NOT READY FOR R1.**
