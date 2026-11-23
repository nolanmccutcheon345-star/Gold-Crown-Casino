# Version 42 — Patch 22 full-table blackjack integration

Status: saved development candidate only; not an R1 release approval. Production Version 7 and the R1 Version 39 deployment are not changed by this work.

## Source and scope

Base: Version 41, `22a31381205b77d99b15bf184443460e3d800f60`. Input: user-provided `poker-night-ai-patch22-full-table.zip`; upstream notes retained in `TEST_EVIDENCE/blackjack42/UPSTREAM_NOTES.md`. The final commit is the Sites saved-version source identity; this report lives in that commit.

Integrated casino-order dealing, 2/4/6 computer-player selection, first/middle/third-base Hero seats, public exposed-card counts, dealer play-out for other live hands, deterministic seat-policy replay, and phone layout. Other-seat chips never enter Hero's ledger. Preserved Version 41's accessible soft-17 rule fallback and Version 40's name escaping and waiting-state action disabling. Cash and tournament authority remain unchanged.

## Confirmed defect corrected during integration

Independent testing reproduced the upstream 20-card guard forcing a mimic-dealer player to stand on soft 15 in a valid double-deck session. Removed that policy override. Seated tables now shuffle between rounds when the ordinary cut card is reached or 64 cards remain, whichever comes first. The displayed cut marker uses that same threshold. Heads-up penetration and replay remain unchanged.

Seat policy is explicitly `seat-styles-2`; unqualified upstream `seat-styles-1` saves are not silently relabelled. The persisted engine/save envelope versions remain compatible with existing heads-up records. A frozen Version 41 reducer fixture proves old heads-up replay equality across all eight tables, and proves Version 41 rejects new seated records instead of accepting them incorrectly.

The 64-card reserve is practical, not a proof against every adversarial split/draw sequence. Exhaustion rejects the action atomically; a round could remain blocked pending a future explicit recovery policy. No mid-round discard reshuffle or silent alteration of decisions was introduced.

## Executed evidence

- Targeted final blackjack suite: 360 PASS, 0 FAIL. Includes 1,200 randomized full-table rounds across three rule sets with every dealt card accounted for and exact replay; seven independent boundary/regression tests.
- Typecheck, lint, production build: PASS. Build asset hashes in `TEST_EVIDENCE/blackjack42/build-hashes.json`. Vite retains the existing large-bundle warning.
- Requirement integrity: PASS — original 302 acceptance IDs, 86 deferred features and governing document hashes unchanged.
- Live heads-up Chromium browser regression: 54 checks, 48 rounds, all eight classic tables, three viewport sizes; reload, counts/ace tallies, public export, full audit and stale-tab rejection PASS.
- Live seated Chromium browser run: 108 rounds across 27 configurations (2/4/6 others × Hero seats 1/4/7 × 320×568, 390×844, 1366×768). All 27 configuration reloads, replay audits, independent Hero net calculations and overflow/hand visibility checks PASS.
- Actual live phone screenshot and geometry: `TEST_EVIDENCE/blackjack42/live-phone.jpg` and `phone-metrics.json`. At capture, Hero bottom/control top were 372.8/448 px at 320×568 and 516.6/724 px at 390×844; count strip top was 6 px on both.

The first geometry harness sampled before smooth scrolling finished and failed; its rerun waits for the visible hand to clear controls. This is recorded as a harness timing correction, not a product defect fixed by the run. Browser measurements use desktop Chromium embedded viewports, not physical phones. The legacy sample screen still includes unavailable side-bet spots and can exceed a small viewport; it is not the live game.

Full project suite: **2,751 PASS / 0 FAIL / 9 SKIP**, 663.7 seconds. The skipped cases are the seven opt-in PokerKit comparisons and two opt-in 10,000-hand accounting workloads; they are not counted as executed. Exact names/statuses are retained in `summary.json` and the full reporter JSON. The final targeted suite additionally covers the finalized shared cut-point/display calculation.

## Remaining limits / release gates

- Other players act immediately as part of Hero/Deal commits. No paced card-by-card animation yet.
- Public history export still contains Hero's hands only. Full authoritative save/replay includes seated players.
- Side bets and Free Bet remain unavailable in live play.
- Seat styles are frozen synthetic rules, not tournament/casino strategy validation. Existing coach indices and close two-deck calculations remain approximate.
- Physical iPhone Safari and VoiceOver must cover this candidate's new seats/status announcements. Earlier owner confirmation is retained for the earlier version only.
- Three independent new-user sessions and original performance/release evidence remain open. This work does not close unrelated R1 requirements or explain the historic 10.07-second stall.

## Device follow-up

On this exact candidate, select six other players and try all three Hero seats. Confirm count and Hero cards remain usable at Deal, insurance, split and settlement; controls respond once; reload restores the same round; and VoiceOver reads card names, seat order, the Played status and disabled controls. Record device, iOS version, build identity, observed actions and failures. Do not count this checklist as executed evidence.

Verdict: NOT READY FOR R1.
