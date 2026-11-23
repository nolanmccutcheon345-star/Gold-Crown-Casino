# Version39 — live count coach and Test me

Patch19 continues Version38 application source `97c21a3c277a0f2e7a8266ee561b11ece570d42c`. It adds a persistent public count strip, approximate count-aware live hints and insurance advice, quiet Test me feedback, shorter hints and explicit ante wording. All-method ace tallies and doubled Wong Halves remain supported. Hidden-count mode hides the displayed count and ace tally. Coach preferences are transient and must be reselected after reload.

## Implementation and integrity

The coach consumes only the public round, exposed cards and table rules. It cannot deal or settle. No engine, wallet, journal, persistence schema, poker policy or tournament runtime change was made. There is no migration and rollback to Version38 does not reset saves. The initial separate blackjack balance remains $2,000; the casino ante remains 50 cents once per round, including splits.

Two upstream issues were corrected: unused hint locals failed lint; insurance wording overstated what an approximate index proves. It now explicitly describes an approximate recommendation, without claiming knowledge of the actual unseen ten-card fraction or profitability.

## Executed browser evidence

Actual desktop Chromium at embedded 320×568, 390×844 and 1366×768 sizes: 54 live regression checks across 48 completed rounds/eight classic tables; 63 new coach checks across 30 completed rounds; 60 practice checks; 12 native IndexedDB checks; six cash accessibility workflow checks. These are separate from Vitest totals. A manual keyboard round also verified Test me feedback, a $5 loss plus 50-cent ante, and full audit.

The first coach harness failed an expected-action comparison for a natural against an ace. The established yes button submits even-money when legal; the harness incorrectly expected insurance. The original public exported decision proved the cause. The corrected harness passed; original failure and diagnosis remain in TEST_EVIDENCE/blackjack39/TEST_CORRECTIONS.md. No application behavior or test limit was relaxed to obtain that pass.

The final 30 coach round workflows measured p50=102.9ms, p95=608.5ms, maximum623.2ms. They include DOM waits and first-round reload/coach checks under concurrent regressions; they are not isolated computation or physical-device performance measurements. No naturally occurring count-specific deviation was observed in these rounds; deterministic public-input tests cover that branch and doubled-scale equivalence.

## Limits and release status

Count-play indices remain approximate, especially the four non-Hi-Lo systems. Exact two-deck charts, independently calibrated indices, side-bet wagering and Free Bet Blackjack remain unfinished. Reviewer-reported simulations in EXTERNAL_REVIEW.md are not executions performed in this qualification.

Owner-reported iPhone and VoiceOver checks apply to the previous Version38 candidate. The new Test me/count-strip controls have not received physical Safari or VoiceOver verification. Three independent 25-hand user studies and outstanding release/performance evidence remain required. The historical 10.07-second stall remains unattributed.

All 302 original requirement IDs and 86 deferred-feature IDs remain unchanged; spec-integrity passed. No automated test is automatically mapped to an original acceptance PASS. Production Version 7 and the original private Version 12 environment are not deployment targets. Only the R1 test site is to receive this candidate. **NOT READY FOR R1.**

## Standard regression result

Full standard Vitest completed in889.25seconds:2,681PASS,2FAIL,9SKIP. Both failures stemmed from stale derived R1 views after the prior owner-device evidence commit. Regeneration changed only evidence/notes forU10,U11,V518; no acceptance status changed. All12 affected registry/dependency tests then passed. Reconciled unique-case result: **2,683 passed, no unresolved failures, nine skipped**. This is not described as one all-green full run. Exact skipped names and initial failures are in full-summary.json. The nine skips remain seven opt-in PokerKit comparisons and two opt-in10,000-hand accounting batches.

Typecheck, lint, spec integrity and production build passed; two production builds were byte-identical.96 protected engine/bot/tournament/persistence/calculation files match Version38. The22 targeted coach cases overlap the standard total.

## Final responsive and hosted verification

All189 cash-table layout cases passed in real Chromium: seven viewport sizes,2–10 seats,preflop/river/complete. Evidence: blackjack39-layout.json. R1 packaging tests passed20/20. An initial package test still expected38 and was updated to assert exact39; no content/hash checks removed.

Saved application Version39 source: `41203c1e795fdc7aa2f9b89486886a6b1462a820`. Final R1 wrapper/package source: `1ce58258b73b77aae36f270a58e3ad0e0a572c0a` (native test-site version29, applicationVersion39). Deployment `appgdep_6afb68a96d6c81919a589c2936ba8ef6` succeeded. Wrapper wording explicitly distinguishes initial full-run failures from corrected targeted reruns. App JavaScript SHA256: `0596d593bf363990f62003973adfe9b0139b25e4ecaded79140025acf788abcb`.

Public HTTPS guest access and compiled-byte verification passed. One additional hosted$5/50-cent-ante round completed: Qs/Qs againstTs, Hit drewAd, dealerTs/8h; finalbalance$2,004.50. Test me correctly recorded disagreement with approximate stand advice despite the actual win. Public Hi-LoRC−4,TC−0.7,one ace matched the five exposed cards. Full replay audit passed. Reload through the final package preserved round, balance and saved decision review; no additional payout. Isolatedrun1794861135495-2369656016; no production records accessed. Screenshot and AX proof retained in this folder. This is real Chromium execution, not Safari or VoiceOver.
