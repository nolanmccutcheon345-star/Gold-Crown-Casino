# Patch 14 — folded-seat readability and home-screen artwork

Applied supplied patch14 to exact saved Version30 source 0331f557315b92d20102d360a5c2fcf6efe7fa11. Changes are limited to presentation, declarative home-screen metadata and supplied icon resources. No poker engine, bot policy, financial, persistence or schema changes.

## Implemented

Folded names/stacks and seat markers retain full element opacity; hidden card backs alone dim. The setup start bar has an opaque background. Decorative empty-activity spade is hidden from assistive technology. Added opaque 180/192/512px PNGs, an Apple touch icon and a web manifest. The home-screen label is Poker Night AI; visible application title remains AI Texas Hold Em. Manifest requests browser display, not standalone mode.

## Verification scope

Executed evidence is stored in TEST_EVIDENCE/patch14. The new resource browser page checks resource responses, decoded dimensions and actual document declarations. The folded-seat fixture uses legal engine actions and validates canonical data before mounting the real app. Its computed opacity checks do not establish universal WCAG contrast conformance. Existing browser accessibility coverage is automated, not real VoiceOver verification.

Physical iPhone/Android installation, launch behavior, icon mask rendering and actual VoiceOver are NOT_EXECUTED. No claim of fixing the historical 10.07-second stall. Mandatory external R1 gates remain unresolved; entire R1 remains NOT READY.

## Physical verification on the exact candidate

1. Open the R1 test Site in Safari, verify its displayed candidate commit and enter the game. Record device model, OS, browser and commit.
2. Retain/bookmark the COMPLETE URL including ?run=. This test site's local records belong to that isolated run.
3. Share → Add to Home Screen. Confirm the Poker Night AI label and cards/chips artwork. Capture a screenshot.
4. Launch the shortcut and record whether it opens Safari or a separate window and whether it opens the same run. The manifest start URL is ./, so it may start a new isolated test account. Return to the saved full URL to recover the earlier run; a different run does not establish data deletion.
5. Play a hand, inspect folded names/stacks/blind markers, open Setup and verify the pinned start bar remains opaque and usable. Confirm bet entry, first-tap actions and multiway showdown readability.
6. Repeat Android Add to Home Screen if available, recording browser and mask. Installation/browser-storage continuity is not inferred from desktop Chromium.

No production Version7 or original privateVersion12 changes are authorized by this report. Only the R1 test Site receives the qualified candidate. The original302-ID and86-feature registers remain intact.

## Completed automated run

Standard suite: 2,181 PASS, 0 FAIL, 9 optional skips (seven opt-in PokerKit comparisons and two large accounting batches). One full run, no retries or timeout modifications. Typecheck, lint, production build and specification integrity check PASS. Full JSON includes every test name/status.

Browser resource verification: 13 checks PASS; folded-seat opacity checks PASS at 395px and desktop; setup start-bar computed background is opaque rgb(18,29,34). Four actual UI hands across two sessions passed pending, settled and cashout reload checks with exactly two cashouts.

Six automated accessibility workflows PASS (2/6/10 seats at 320px/1280px). The 189-case layout matrix is still running at source packaging; final results will be recorded in the R1 packaging evidence before publication. No layout PASS is claimed here until complete.
