# Patch 111 — Casino Table Life and Scratched-Horse Stability

Integrated from the user-supplied archive internally labelled "Patch 104". It follows the reviewed **Patch 109** premium visual layer and the no-op **Patch 110** seven-game compatibility checkpoint.

## Features

- Roulette, craps, baccarat and horse racing: patron reactions to Hero's bets/results, player-to-player replies, gestures, comings/goings and five quick-chat choices per table (at most one Hero message per round).
- Poker cash, tournament and Omaha: twenty extra conversation threads and additional post-fold activity.
- Blackjack: surrender, split-aces, five-card, insurance and group reactions.
- Slots: occasional neighbour small talk.
- Horse racing: scratched horses excluded from running-order calculations and draw updates, preventing missing-path errors while the race runs.

## Integration notes

`src/casino/view.ts` was manually reconciled because Patch 109 adds `roomMarquee` headers to the same render function. The Patch 109 premium UI imports, headers, art and presentation CSS have been retained. The original author changes in other overlapping files were applied without conflict. Quick-chat controls were raised to a 44px minimum tap height with a narrow-phone grid and visible focus.

No engine odds, game results, virtual-chip accounting, bot strategy, or backup format was intentionally altered. Conversation data uses public in-game state only. No production deployment or real-money gambling is involved.

## Verification and limits

- Author's 11 new `tests/ux106/table-life-6.test.ts` checks: passed under a standalone CommonJS runner, not official Vitest.
- Focused runtime checks: quick chat, one-message-per-round limit, existing marquees and three scratched-horse race renders passed.
- Application source TypeScript typecheck passed with temporary declarations for missing external hash-package types; 911 source/test TS/TSX files and 38 CSS files parsed.
- Full `npm ci --offline` is blocked by missing cached `yocto-queue@0.1.0`; full Vite/Vitest E2E suite, running app browser check, real Safari/iPhone and production deployment are unverified.
