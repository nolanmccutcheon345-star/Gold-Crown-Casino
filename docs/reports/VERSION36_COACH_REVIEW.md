# Version 36 coach review

Date: 2026-11-16 UTC. Reviewed supplied Patch 18 strategy, counting and drill modules on source base `69fc5a3`.

## Reproduced defects and bounded repairs

1. `evaluate([6,5], 6, noDAS, undefined, {afterSplit:true})` offered double (EV 0.6782619826705999) despite the no-double-after-split rule. It now returns `double:null`. Chart split suppression uses a separate option so no-DAS initial hands still permit double and surrender.
2. For H17 late-surrender rules, 8,8 against an ace with surrender unavailable but split legal, the coach returned hit. It now chooses the highest model-value available action, split, instead of discarding all alternatives except hit/stand.

Both regression fixtures failed before the repair. Existing fixture assertions and thresholds were preserved; reference-test names now identify supplied fixtures rather than implying independent publication verification. Count metadata comments and visible descriptive notes no longer imply measured accuracy.

## Executed verification

- Baseline: `npx vitest run tests/blackjack/strategy.test.ts tests/blackjack/counting.test.ts --reporter=verbose`: 26 passed.
- Added regression fixtures before code repair: 14 passed, 2 failed (the two defects above).
- Final targeted run at 22:35:53 UTC: same two test files, 29 passed, 0 failed, 0 skipped; Vitest total duration 1.38 s.
- `npx eslint src/blackjack/strategy.ts src/blackjack/drills.ts src/blackjack/counting.ts tests/blackjack/strategy.test.ts tests/blackjack/counting.test.ts`: exit 0.
- `npm run typecheck`: exit 0.

## Scope and remaining limits

This is a fixed-rank-distribution expected-value model after visible-card removal, not exact finite-shoe enumeration or simulation. Further depletion and resplitting are omitted. The same approximation applies to six-deck and two-deck tables. Rounded deviation thresholds use a linear count-to-rank-frequency estimate; they are not verified operational index tables. The 18 supplied Hi-Lo reference entries remain regression fixtures, not independent-source evidence. No independent published chart or correlation source was verified in this review.

The five tag systems remain unchanged. Full-deck balance, supplied tag tables, half-deck true-count arithmetic and the supplied ace-side-count example are tested. Practice question grading uses the model/chart. Deviation-drill EVs are base-count values, but the UI correctly does not display them for count questions.

No poker, tournament, bankroll, save format or original requirement registry was changed by this review. No claim of browser, physical-device, VoiceOver, exact-strategy, real-money edge or human calibration validation is made here.
