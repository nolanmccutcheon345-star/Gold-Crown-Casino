# Patch15 — Poker Night AI visible branding

Applied supplied patch15 cleanly to saved Version31 source187bc6ed0f21024d0f097913eca2d464aac24781. Production changes: index.html, src/ui/app.ts, src/ui/history-file.ts only. Header/accessibility label, felt watermark, footer, HTML title/description and history share-sheet title now say Poker Night AI.

No storage/database key, exported format identifier, filename prefix, engine, bot, ledger, checkpoint, schema or profile change. Historical records and release artifacts keep their original names/provenance. Public productionVersion7 and privateVersion12 must remain unchanged. R1 test Site URL is retained.

## Executed checks

Typecheck, lint, production build and302/86 specification integrity check PASS. Vite retains its existing >500kB bundle warning; this patch does not claim a performance optimization.

Actual Chromium: nine focused brand/layout cases PASS (2/9/10 seats at320×568,395×627,1366×650). Every case also executes the existing table-layout/betting-control fixture assertions. New accessible brand name, header/watermark/footer and no application horizontal overflow verified. Four accessibility/import-rights workflows PASS with isolated native IndexedDB. Four full hands across two sessions PASS, including pending-action, settled and cashout reloads; exactly two cashouts. Evidence in TEST_EVIDENCE/patch15/browser.

This turn did not repeat the entire189-case matrix; its priorVersion31 results are not relabeled as Version32 results. Physical Safari, actual VoiceOver and independent participants remain unverified. The historic10.07-second stall is not claimed fixed. R1 remains NOT READY while mandatory external gates are open.

## Supplied tournament brief

Preserved unchanged as an external proposal in docs/proposals/SUPPLIED_TOURNAMENT_BRIEF.md. Technical answers and limits in TOURNAMENT_SOURCE_REVIEW.md. No tournament/blackjack implementation, requirements reclassification or schema migration in this release. A future multi-table controller requires a durable round-transaction design; the current single-cash-table checkpoint cannot be assumed to support it. Seed-only archives require proof of complete deterministic inputs before replacing required histories.

Full standard suite: 2181PASS, 0FAIL, 9optional skips. Single full run; no retries or timeout changes. The seven opt-in PokerKit and two high-volume accounting cases were not executed this turn.
