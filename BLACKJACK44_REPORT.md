# Version 44 — Patch 24 reveal polish

Base: Version 43 `4d1f92786b8f9ed2ab1970f57fd75ab88edf4f68`. Save-only candidate; production V7, private V12 and R1 V39 unchanged.

## Change and merge

Hero hands with no exposed cards show their bet and Waiting, without a misleading zero total. Their accessible label says “Your hand: no cards yet.” An empty dealer area says “Dealing…” during the reveal; ordinary betting still says “Place your bet”. Disabled blackjack actions retain their positions but have opacity 0.38 and reduced saturation.

Applied the supplied screens/CSS/test changes selectively. The upstream deal-pace replacement was unnecessary: Version 43 already removes empty other-player hands. Its newer split-movement, balance/session masking, visible-count grading and announcement boundaries are preserved byte-for-byte. No engine, ledger, persistence, shoe reserve, financial calculation or reveal scheduling change.

## Verification

- All blackjack tests plus Version 42 and 43 independent regressions: **382 PASS, 0 FAIL, 0 SKIP**.
- Lint and production build (including TypeScript check): PASS.
- Original 302 requirement IDs, 86 deferred features and governing hashes: PASS.
- Browser: **27 rounds / nine pace-and-viewport configurations / 3,342 reveal observations PASS**. Tested empty-hand accessible labels, no empty totals, Dealing prompt, disabled opacity/desaturation, enabled opacity, counts, locked actions, Show all, reload equivalence, save audits and hand visibility.
- Actual live 320×568 and 390×844 screenshot retained in TEST_EVIDENCE/blackjack44/reveal.jpg.

This focused presentation change did not rerun the entire poker/tournament project suite. Version 43's 2,772-pass/9-optional-skip full run remains prior-build evidence, not a new Version 44 result. Existing large-bundle warning remains. Desktop Chromium viewport testing does not establish physical Safari or VoiceOver behavior.

## Remaining

New paced-dealing controls/announcements and this polish still need physical iPhone Safari/VoiceOver checks. Side bets, Free Bet and other players in public history export are unchanged and unfinished. Original mandatory R1 gates remain unresolved; no acceptance row is promoted by this presentation patch.

**NOT READY FOR R1.**
