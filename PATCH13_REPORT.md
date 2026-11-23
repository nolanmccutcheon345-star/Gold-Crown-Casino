# Patch 13 — compact host setup

Applied supplied patch cleanly to exact Version29 source 2a352b3fd367ea46a3db9068ddad367d502882db. Production changes limited to app.ts, opponent-setup.ts, and new host-setup.css. No engine, bot, financial, storage, or schema changes. All setup fields remain inside the form.

## Executed browser evidence
TEST_EVIDENCE/patch13/browser: 16 setup workflows (2/6/9/10 players at 320x568,395x627,768x1024,1366x650), each 14 assertions: collapsed controls, pinned initial start button, no overflow, rake and opponent rerender, 15 custom traits, saved presets, invalid-hidden-field focus, starting chosen seats, and queued changes preserving game and wallet. All PASS. Memory persistence fixture; real app/controller/engine.

Four accessibility/import workflows passed on isolated native IndexedDB; four complete hands across two sessions passed pending-action, settled and cashout reloads, with exactly two cashouts. Actual browser keyboard Space opened the buy-in disclosure; a blank minimum in a collapsed section prevented start and focused the newly opened invalid control. Initial role locator did not resolve the native summary; retargeted its exact source-backed summary selector. This was an automation locator issue, not a product failure.

## Scope and limitations
Physical Safari, VoiceOver and independent users NOT_EXECUTED. Screenshot claims supplied by patch author are not independent measurements from this run. Historical10.07-second stall not investigated or claimed fixed. Entire R1 is NOT READY while external mandatory gates remain. Original302-ID and86-future registries unchanged and integrity script PASS. ProductionVersion7 and privateVersion12 untouched; only R1 test site may receive this qualified UI update.

Manual Chromium smoke: keyboard Enter on start created ten-player $1/$2 $200 table. Hero folded facing $2 preflop without committing chips; bots completed showdown, Jordan won with aces/kings vs Quinn aces/jacks; Hero result $0, rake$0. See browser/manual-game.txt.

Standard regression completed: 2181 PASS, 0 FAIL, 9 optional skips. Single full run; no retries or timeout changes. Typecheck, lint and production build PASS. Skips remain seven opt-in PokerKit and two high-volume accounting cases; not executed this turn.
