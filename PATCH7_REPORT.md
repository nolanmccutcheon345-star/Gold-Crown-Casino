# Patch7 phone controls qualification

Base: 4064d300e77c5471d9e70b7e05dea2784019a91e (Version25). Exact resulting source is the commit containing this report; build hashes are in TEST_EVIDENCE/patch7/provenance.json.

## Implemented
User Patch7 applied to app.ts, bet-sizing.ts and phone-play.css. Numeric amount, presets and increments synchronize the pot-percentage proposal; an explicitly chosen percentage survives background updates and chip rounding. Action buttons remain the bottom row; mobile pot captions and notes are compact. Version25 history input reset is preserved.

Real browser testing found expanded sizing overflow at short heights. The added dynamic-viewport cap keeps controls accessible at 390x400 and landscape 844x390 without clipping the slider. A first attempted cap failed three slider overlap checks and was corrected, not waived.

No engine, bot policy, ledger, persistence or schema changes. Original 302 requirements, 86 deferred features and four governing PDF hashes pass the integrity check. External acceptance gates are unchanged.

## Executed browser checks
- Sizing: 15 controls plus rapid double-submit protection passed.
- Current-source sizing/accessibility matrix: 66/66 passed. All 123 production file hashes matched. An initial run against an old frozen fixture is explicitly excluded; rebuilt fixture results are gates-final.json.
- New Patch7 matrix: 7/7 passed, including short phones and landscape, expanded/invalid states, percentage round trips and background updates.
- Desktop/tablet action accessibility: 18/18 passed.
- In-place DOM updates: 18/18 passed.
- Interface gates: 40/40 passed; trusted keyboard Tab/Return workflow passed.
- Accessibility/import workflows: 4/4 passed for 2,6,9,10 seats, including same-file input reuse.
- Cash workflow: five completed hands, four sessions, three cashouts and 52 UI actions passed. Final wallet $9,658.50 plus table $300 = $9,958.50; poker net -$41.50. Active-hand reload digest agreed exactly.

Evidence: TEST_EVIDENCE/patch7/browser/. Failed intermediate short-height results remain recorded. These are Chromium browser measurements, not physical Safari or VoiceOver verification.

## Final results
189/189 layout cases passed across all 2–10-player tables and preflop/river/complete states. Typecheck, lint, production build and specification integrity passed.

Standard suite: 2,125 passed, 1 failed, 9 skipped. The full preflop matrix exceeded its existing 20-second limit (21.526 seconds). Same unchanged test, assertions and limit passed in isolation in 19.176 seconds. Thus 2,126 distinct tests passed across the two runs, but this was NOT a zero-failure single run. Archive reconciliation passed. Timing margin of the exhaustive preflop test remains narrow; no timeout or assertion was relaxed.

The nine skips are seven opt-in PokerKit checks plus two opt-in 10,000-hand accounting batches. They were not executed during this UI patch qualification. Exact skipped names remain in full-tests.json and the packaged test summary.

Full raw reports: TEST_EVIDENCE/patch7/full-tests.json and preflop-retry.json. Browser results are independent counts, not original acceptance requirements. No mandatory external R1 requirement was newly marked PASS.

## Device checks still required
On the exact hosted candidate: verify Safari bet input does not zoom; keyboard remains open while typing; first taps register; three-or-more-player showdown stays readable; expanded sizing and invalid amounts leave bottom buttons fixed. Physical VoiceOver is still unverified. Historical 10-second stall has not been attributed or claimed fixed by this UI patch.
